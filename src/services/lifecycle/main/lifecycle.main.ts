import { app, BrowserWindow } from 'electron';
import { inject, service } from '@electron-tools/ioc';
import { Barrier, timeout } from '../../../core/base/async';
import { Emitter, Event } from '../../../core/base/event';
import { Disposable, DisposableStore } from '../../../core/base/lifecycle';
import { isMacintosh, isWindows } from '../../../core/base/platform';
import { cwd } from '../../../core/base/process';
import { IServerChannel } from '../../ipc/common/ipc';
import { IpcMainServer } from '../../ipc/main/ipc.main';
import { LogService } from '../../log/common/log';
import { LifecycleCommands, LifecyclePhase, WillShutdownEvent, ShutdownReason, WindowLoadEvent } from '../common/lifecycle';


export const enum UnloadReason {

	/**
	 * The window is closed.
	 */
	CLOSE = 1,

	/**
	 * All windows unload because the application quits.
	 */
	QUIT = 2,

	/**
	 * The window is reloaded.
	 */
	RELOAD = 3,
}

@service('lifecycleMainService')
export class LifecycleMainService extends Disposable {

	private readonly _onBeforeShutdown = this._register(new Emitter<void>());
	readonly onBeforeShutdown = this._onBeforeShutdown.event;

	private readonly _onWillShutdown = this._register(new Emitter<WillShutdownEvent>());
	readonly onWillShutdown = this._onWillShutdown.event;

	private readonly _onWillLoadWindow = this._register(new Emitter<WindowLoadEvent>());
	readonly onWillLoadWindow = this._onWillLoadWindow.event;

	private readonly _onBeforeCloseWindow = this._register(new Emitter<BrowserWindow>());
	readonly onBeforeCloseWindow = this._onBeforeCloseWindow.event;

	private _quitRequested = false;
	get quitRequested(): boolean { return this._quitRequested; }

	private _wasRestarted: boolean = false;
	get wasRestarted(): boolean { return this._wasRestarted; }

	private _phase = LifecyclePhase.Starting;
	get phase(): LifecyclePhase { return this._phase; }

	private readonly windowToCloseRequest = new Set<number>();
	private windowCounter = 0;

	private pendingQuitPromise: Promise<boolean> | undefined = undefined;
	private pendingQuitPromiseResolve: { (veto: boolean): void } | undefined = undefined;

	private pendingWillShutdownPromise: Promise<void> | undefined = undefined;

	private readonly mapWindowIdToPendingUnload = new Map<number, Promise<boolean>>();

	private readonly phaseWhen = new Map<LifecyclePhase, Barrier>();

	constructor(
		@inject('logService')
		private readonly logService: LogService,
		@inject('ipcMainServer')
		private readonly ipcServer: IpcMainServer,
	) {
		super();
		this.registerListeners();
		this.registerChannel();
	}

	private registerListeners(): void {
		const appListeners = new DisposableStore();
		// before-quit: an event that is fired if application quit was
		// requested but before any window was closed.
		appListeners.add(Event.fromNodeEventEmitter(app, 'before-quit')(() => {
			if (this._quitRequested) {
				return;
			}

			this.logService.log('Lifecycle#app.on(before-quit)');
			this._quitRequested = true;

			// Emit event to indicate that we are about to shutdown
			this.logService.log('Lifecycle#onBeforeShutdown.fire()');
			this._onBeforeShutdown.fire();

			// macOS: can run without any window open. in that case we fire
			// the onWillShutdown() event directly because there is no veto
			// to be expected.
			if (isMacintosh && this.windowCounter === 0) {
				this.fireOnWillShutdown(ShutdownReason.QUIT);
			}
		}));

		// window-all-closed: an event that only fires when the last window
		// was closed. We override this event to be in charge if app.quit()
		// should be called or not.
		appListeners.add(Event.fromNodeEventEmitter(app, 'window-all-close')(() => {
			this.logService.log('Lifecycle#app.on(window-all-closed)');

			// Windows/Linux: we quit when all windows have closed
			// Mac: we only quit when quit was requested
			if (this._quitRequested || !isMacintosh) {
				app.quit();
			}
		}));

		// will-quit: an event that is fired after all windows have been
		// closed, but before actually quitting.
		Event.once(Event.fromNodeEventEmitter<Electron.Event>(app, 'will-quit'))((e) => {
			this.logService.log('Lifecycle#app.on(will-quit)');

			// Prevent the quit until the shutdown promise was resolved
			e.preventDefault();

			// Start shutdown sequence
			const shutdownPromise = this.fireOnWillShutdown(ShutdownReason.QUIT);

			// Wait until shutdown is signaled to be complete
			shutdownPromise.finally(() => {

				// Resolve pending quit promise now without veto
				this.resolvePendingQuitPromise(false /* no veto */);

				// Quit again, this time do not prevent this, since our
				// will-quit listener is only installed "once". Also
				// remove any listener we have that is no longer needed
				appListeners.dispose();
				// see https://github.com/electron/electron/issues/33643
				(e.defaultPrevented as any) = false;
				app.quit();
			});
		});
	}

	private registerChannel() {
		const serverChannel: IServerChannel = {
			call: (_ctx, command, arg): Promise<any> => {
				switch(command) {
					case LifecycleCommands.QUIT:
						return this.quit();
					case LifecycleCommands.RELAUNCH:
						return this.relaunch();
					case LifecycleCommands.KILL:
						return this.kill(arg[0]);
					default:
						throw new Error(`[lifecycle] comment ${command} not found`);
				}
			},
			listen: (_ctx, _event, _arg) => {
				throw new Error('[lifecycle] no available event');
			},
		};
		this.ipcServer.registerChannel('lifecycle', serverChannel);
	}

	private fireOnWillShutdown(reason: ShutdownReason): Promise<void> {
		if (this.pendingWillShutdownPromise) {
			return this.pendingWillShutdownPromise; // shutdown is already running
		}

		this.logService.log('Lifecycle#onWillShutdown.fire()');

		const joiners: Promise<void>[] = [];

		this._onWillShutdown.fire({
			reason,
			join(promise) {
				joiners.push(promise);
			},
		});

		this.pendingWillShutdownPromise = (async () => {

			// Settle all shutdown event joiners
			try {
				await Promise.allSettled(joiners);
			} catch (error) {
				this.logService.error(error);
			}
		})();

		return this.pendingWillShutdownPromise;
	}

	set phase(value: LifecyclePhase) {
		if (value < this.phase) {
			throw new Error('Lifecycle cannot go backwards');
		}

		if (this._phase === value) {
			return;
		}

		this.logService.log(`lifecycle (main): phase changed (value: ${value})`);

		this._phase = value;

		const barrier = this.phaseWhen.get(this._phase);
		if (barrier) {
			barrier.open();
			this.phaseWhen.delete(this._phase);
		}
	}

	async when(phase: LifecyclePhase): Promise<void> {
		if (phase <= this._phase) {
			return;
		}

		let barrier = this.phaseWhen.get(phase);
		if (!barrier) {
			barrier = new Barrier();
			this.phaseWhen.set(phase, barrier);
		}

		await barrier.wait();
	}

	registerWindow(window: BrowserWindow): void {
		const windowListeners = new DisposableStore();

		// track window count
		this.windowCounter++;

		// Window Will Load
		// windowListeners.add(window.onWillLoad(e => this._onWillLoadWindow.fire({ window, reason: e.reason })));

		windowListeners.add(Event.fromNodeEventEmitter<Electron.Event>(window, 'close')((e) => {
			// The window already acknowledged to be closed
			const windowId = window.id;
			if (this.windowToCloseRequest.has(windowId)) {
				this.windowToCloseRequest.delete(windowId);

				return;
			}

			this.logService.log(`Lifecycle#window.on('close') - window ID ${window.id}`);

			// Otherwise prevent unload and handle it from window
			e.preventDefault();
			this.unload(window, UnloadReason.CLOSE).then(veto => {
				if (veto) {
					this.windowToCloseRequest.delete(windowId);
					return;
				}

				this.windowToCloseRequest.add(windowId);

				// Fire onBeforeCloseWindow before actually closing
				this.logService.log(`Lifecycle#onBeforeCloseWindow.fire() - window ID ${windowId}`);
				this._onBeforeCloseWindow.fire(window);

				// No veto, close window now
				window.close();
			});
		}));

		// Window After Closing
		windowListeners.add(Event.fromNodeEventEmitter(window, 'closed')(() => {
			this.logService.log(`Lifecycle#window.on('closed') - window ID ${window.id}`);

			// update window count
			this.windowCounter--;

			// clear window listeners
			windowListeners.dispose();

			// if there are no more code windows opened, fire the onWillShutdown event, unless
			// we are on macOS where it is perfectly fine to close the last window and
			// the application continues running (unless quit was actually requested)
			if (this.windowCounter === 0 && (!isMacintosh || this._quitRequested)) {
				this.fireOnWillShutdown(ShutdownReason.QUIT);
			}
		}));
	}

	async reload(window: BrowserWindow): Promise<void> {
		// Only reload when the window has not vetoed this
		const veto = await this.unload(window, UnloadReason.RELOAD);
		if (!veto) {
			window.reload();
		}
	}

	unload(window: BrowserWindow, reason: UnloadReason): Promise<boolean /* veto */> {

		// Ensure there is only 1 unload running at the same time
		const pendingUnloadPromise = this.mapWindowIdToPendingUnload.get(window.id);
		if (pendingUnloadPromise) {
			return pendingUnloadPromise;
		}

		// Start unload and remember in map until finished
		const unloadPromise = this.doUnload(window, reason).finally(() => {
			this.mapWindowIdToPendingUnload.delete(window.id);
		});
		this.mapWindowIdToPendingUnload.set(window.id, unloadPromise);

		return unloadPromise;
	}

	private async doUnload(window: BrowserWindow, reason: UnloadReason): Promise<boolean /* veto */> {

		// Always allow to unload a window that is not yet ready
		if (window.isDestroyed()) {
			return false;
		}

		this.logService.log(`Lifecycle#unload() - window ID ${window.id}`);

		// first ask the window itself if it vetos the unload
		const windowUnloadReason = this._quitRequested ? UnloadReason.QUIT : reason;
		let veto = await this.onBeforeUnloadWindowInRenderer(window, windowUnloadReason);
		if (veto) {
			this.logService.log(`Lifecycle#unload() - veto in renderer (window ID ${window.id})`);

			// a veto resolves any pending quit with veto
			this.resolvePendingQuitPromise(true /* veto */);

			// a veto resets the pending quit request flag
			this._quitRequested = false;
			return true;
		}

		// finally if there are no vetos, unload the renderer
		await this.onWillUnloadWindowInRenderer(window, windowUnloadReason);

		return false;
	}

	private resolvePendingQuitPromise(veto: boolean): void {
		if (this.pendingQuitPromiseResolve) {
			this.pendingQuitPromiseResolve(veto);
			this.pendingQuitPromiseResolve = undefined;
			this.pendingQuitPromise = undefined;
		}
	}

	private onBeforeUnloadWindowInRenderer(window: BrowserWindow, reason: UnloadReason): Promise<boolean /* veto */> {
		const channel = this.ipcServer.getChannel('lifecycle', (client) => {
			return client.ctx === window.id.toString();
		});
		return channel.call(LifecycleCommands.HANDLE_BEFORE_SHUTDOWN, [reason]);
	}

	private onWillUnloadWindowInRenderer(window: BrowserWindow, reason: UnloadReason): Promise<void> {
		const channel = this.ipcServer.getChannel('lifecycle', (client) => {
			return client.ctx === window.id.toString();
		});
		return channel.call(LifecycleCommands.HANDLE_WILL_SHUTDOWN, [reason]);
	}

	quit(willRestart?: boolean): Promise<boolean /* veto */> {
		if (this.pendingQuitPromise) {
			return this.pendingQuitPromise;
		}

		this.logService.log(`Lifecycle#quit() - will restart: ${willRestart}`);

		this.pendingQuitPromise = new Promise(resolve => {

			// Store as field to access it from a window cancellation
			this.pendingQuitPromiseResolve = resolve;

			// Calling app.quit() will trigger the close handlers of each opened window
			// and only if no window vetoed the shutdown, we will get the will-quit event
			this.logService.log('Lifecycle#quit() - calling app.quit()');
			app.quit();
		});

		return this.pendingQuitPromise;
	}

	async relaunch(options?: { addArgs?: string[]; removeArgs?: string[] }): Promise<void> {
		this.logService.log('Lifecycle#relaunch()');

		const args = process.argv.slice(1);
		if (options?.addArgs) {
			args.push(...options.addArgs);
		}

		if (options?.removeArgs) {
			for (const a of options.removeArgs) {
				const idx = args.indexOf(a);
				if (idx >= 0) {
					args.splice(idx, 1);
				}
			}
		}

		const quitListener = () => {
			// Windows: we are about to restart and as such we need to restore the original
			// current working directory we had on startup to get the exact same startup
			// behaviour. As such, we briefly change back to that directory and then when
			// Code starts it will set it back to the installation directory again.
			try {
				if (isWindows) {
					const currentWorkingDir = cwd();
					if (currentWorkingDir !== process.cwd()) {
						process.chdir(currentWorkingDir);
					}
				}
			} catch (err) {
				this.logService.error(err);
			}

			// relaunch after we are sure there is no veto
			this.logService.log('Lifecycle#relaunch() - calling app.relaunch()');
			app.relaunch({ args });
		};
		app.once('quit', quitListener);

		// `app.relaunch()` does not quit automatically, so we quit first,
		// check for vetoes and then relaunch from the `app.on('quit')` event
		const veto = await this.quit(true /* will restart */);
		if (veto) {
			app.removeListener('quit', quitListener);
		}
	}

	async kill(code?: number): Promise<void> {
		this.logService.log('Lifecycle#kill()');

		// Give main process participants a chance to orderly shutdown
		await this.fireOnWillShutdown(ShutdownReason.KILL);

		// From extension tests we have seen issues where calling app.exit()
		// with an opened window can lead to native crashes (Linux). As such,
		// we should make sure to destroy any opened window before calling
		// `app.exit()`.
		//
		// Note: Electron implements a similar logic here:
		// https://github.com/electron/electron/blob/fe5318d753637c3903e23fc1ed1b263025887b6a/spec-main/window-helpers.ts#L5

		await Promise.race([

			// Still do not block more than 1s
			timeout(1000),

			// Destroy any opened window: we do not unload windows here because
			// there is a chance that the unload is veto'd or long running due
			// to a participant within the window. this is not wanted when we
			// are asked to kill the application.
			(async () => {
				for (const window of BrowserWindow.getAllWindows()) {
					if (window && !window.isDestroyed()) {
						let whenWindowClosed: Promise<void>;
						if (window.webContents && !window.webContents.isDestroyed()) {
							whenWindowClosed = new Promise(resolve => window.once('closed', resolve));
						} else {
							whenWindowClosed = Promise.resolve();
						}

						window.destroy();
						await whenWindowClosed;
					}
				}
			})()
		]);

		// Now exit either after 1s or all windows destroyed
		app.exit(code);
	}
}