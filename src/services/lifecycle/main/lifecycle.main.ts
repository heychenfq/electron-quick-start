import { app, BrowserWindow, ipcMain } from 'electron';
import { Barrier, timeout } from '../../../core/base/async';
import { Emitter } from '../../../core/base/event';
import { Disposable, DisposableStore } from '../../../core/base/lifecycle';
import { isMacintosh, isWindows } from '../../../core/base/platform';
import { cwd } from '../../../core/base/process';
import { assertIsDefined } from '../../../core/base/types';
import { inject, service } from '../../instantiation/common/instantiation';
import { LogService } from '../../log/common/log';
import { IWindow, LoadReason, UnloadReason } from '../../windows/common/window';

interface WindowLoadEvent {

	/**
	 * The window that is loaded to a new workspace.
	 */
	window: IWindow;

	/**
	 * More details why the window loads to a new workspace.
	 */
	reason: LoadReason;
}

export const enum ShutdownReason {

	/**
	 * The application exits normally.
	 */
	QUIT = 1,

	/**
	 * The application exits abnormally and is being
	 * killed with an exit code (e.g. from integration
	 * test run)
	 */
	KILL
}

export interface ShutdownEvent {

	/**
	 * More details why the application is shutting down.
	 */
	reason: ShutdownReason;

	/**
	 * Allows to join the shutdown. The promise can be a long running operation but it
	 * will block the application from closing.
	 */
	join(promise: Promise<void>): void;
}

export const enum LifecycleMainPhase {

	/**
	 * The first phase signals that we are about to startup.
	 */
	Starting = 1,

	/**
	 * Services are ready and first window is about to open.
	 */
	Ready = 2,

	/**
	 * This phase signals a point in time after the window has opened
	 * and is typically the best place to do work that is not required
	 * for the window to open.
	 */
	AfterWindowOpen = 3
}

@service('lifecycleMainService')
export class LifecycleMainService extends Disposable {

	private readonly _onBeforeShutdown = this._register(new Emitter<void>());
	readonly onBeforeShutdown = this._onBeforeShutdown.event;

	private readonly _onWillShutdown = this._register(new Emitter<ShutdownEvent>());
	readonly onWillShutdown = this._onWillShutdown.event;

	private readonly _onWillLoadWindow = this._register(new Emitter<WindowLoadEvent>());
	readonly onWillLoadWindow = this._onWillLoadWindow.event;

	private readonly _onBeforeCloseWindow = this._register(new Emitter<IWindow>());
	readonly onBeforeCloseWindow = this._onBeforeCloseWindow.event;

	private _quitRequested = false;
	get quitRequested(): boolean { return this._quitRequested; }

	private _wasRestarted: boolean = false;
	get wasRestarted(): boolean { return this._wasRestarted; }

	private _phase = LifecycleMainPhase.Starting;
	get phase(): LifecycleMainPhase { return this._phase; }

	private readonly windowToCloseRequest = new Set<number>();
	private oneTimeListenerTokenGenerator = 0;
	private windowCounter = 0;

	private pendingQuitPromise: Promise<boolean> | undefined = undefined;
	private pendingQuitPromiseResolve: { (veto: boolean): void } | undefined = undefined;

	private pendingWillShutdownPromise: Promise<void> | undefined = undefined;

	private readonly mapWindowIdToPendingUnload = new Map<number, Promise<boolean>>();

	private readonly phaseWhen = new Map<LifecycleMainPhase, Barrier>();

	constructor(
		@inject('logService')
		private readonly logService: LogService,
	) {
		super();
		this.when(LifecycleMainPhase.Ready).then(() => this.registerListeners());
	}

	private registerListeners(): void {
		// before-quit: an event that is fired if application quit was
		// requested but before any window was closed.
		const beforeQuitListener = () => {
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
		};
		app.addListener('before-quit', beforeQuitListener);

		// window-all-closed: an event that only fires when the last window
		// was closed. We override this event to be in charge if app.quit()
		// should be called or not.
		const windowAllClosedListener = () => {
			this.logService.log('Lifecycle#app.on(window-all-closed)');

			// Windows/Linux: we quit when all windows have closed
			// Mac: we only quit when quit was requested
			if (this._quitRequested || !isMacintosh) {
				app.quit();
			}
		};
		app.addListener('window-all-closed', windowAllClosedListener);

		// will-quit: an event that is fired after all windows have been
		// closed, but before actually quitting.
		app.once('will-quit', e => {
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
				app.removeListener('before-quit', beforeQuitListener);
				app.removeListener('window-all-closed', windowAllClosedListener);
				app.quit();
			});
		});
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
			}
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

	set phase(value: LifecycleMainPhase) {
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

	async when(phase: LifecycleMainPhase): Promise<void> {
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

	registerWindow(window: IWindow): void {
		const windowListeners = new DisposableStore();

		// track window count
		this.windowCounter++;

		// Window Will Load
		windowListeners.add(window.onWillLoad(e => this._onWillLoadWindow.fire({ window, reason: e.reason })));

		// Window Before Closing: Main -> Renderer
		const win: BrowserWindow = assertIsDefined(window.win);
		win.on('close', (e) => {
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
		});

		// Window After Closing
		win.on('closed', () => {
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
		});
	}

	async reload(window: IWindow): Promise<void> {
		// Only reload when the window has not vetoed this
		const veto = await this.unload(window, UnloadReason.RELOAD);
		if (!veto) {
			window.reload();
		}
	}

	unload(window: IWindow, reason: UnloadReason): Promise<boolean /* veto */> {

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

	private async doUnload(window: IWindow, reason: UnloadReason): Promise<boolean /* veto */> {

		// Always allow to unload a window that is not yet ready
		if (!window.isReady) {
			return false;
		}

		this.logService.log(`Lifecycle#unload() - window ID ${window.id}`);

		// first ask the window itself if it vetos the unload
		const windowUnloadReason = this._quitRequested ? UnloadReason.QUIT : reason;
		let veto = await this.onBeforeUnloadWindowInRenderer(window, windowUnloadReason);
		if (veto) {
			this.logService.log(`Lifecycle#unload() - veto in renderer (window ID ${window.id})`);

			return this.handleWindowUnloadVeto(veto);
		}

		// finally if there are no vetos, unload the renderer
		await this.onWillUnloadWindowInRenderer(window, windowUnloadReason);

		return false;
	}

	private handleWindowUnloadVeto(veto: boolean): boolean {
		if (!veto) {
			return false; // no veto
		}

		// a veto resolves any pending quit with veto
		this.resolvePendingQuitPromise(true /* veto */);

		// a veto resets the pending quit request flag
		this._quitRequested = false;

		return true; // veto
	}

	private resolvePendingQuitPromise(veto: boolean): void {
		if (this.pendingQuitPromiseResolve) {
			this.pendingQuitPromiseResolve(veto);
			this.pendingQuitPromiseResolve = undefined;
			this.pendingQuitPromise = undefined;
		}
	}

	private onBeforeUnloadWindowInRenderer(window: IWindow, reason: UnloadReason): Promise<boolean /* veto */> {
		return new Promise<boolean>(resolve => {
			const oneTimeEventToken = this.oneTimeListenerTokenGenerator++;
			const okChannel = `vscode:ok${oneTimeEventToken}`;
			const cancelChannel = `vscode:cancel${oneTimeEventToken}`;

			ipcMain.once(okChannel, () => {
				resolve(false); // no veto
			});

			ipcMain.once(cancelChannel, () => {
				resolve(true); // veto
			});

			window.send('vscode:onBeforeUnload', { okChannel, cancelChannel, reason });
		});
	}

	private onWillUnloadWindowInRenderer(window: IWindow, reason: UnloadReason): Promise<void> {
		return new Promise<void>(resolve => {
			const oneTimeEventToken = this.oneTimeListenerTokenGenerator++;
			const replyChannel = `vscode:reply${oneTimeEventToken}`;

			ipcMain.once(replyChannel, () => resolve());

			window.send('vscode:onWillUnload', { replyChannel, reason });
		});
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