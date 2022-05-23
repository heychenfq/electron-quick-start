import { Barrier, disposableTimeout } from "../../../core/base/async";
import { Emitter } from "../../../core/base/event";
import { Disposable } from "../../../core/base/lifecycle";
import { inject, service } from "@electron-tools/ioc";
import { IChannel, IServerChannel } from "../../ipc/common/ipc";
import { IPCRendererClient } from "../../ipc/sandbox/ipc.sandbox";
import { LogService } from "../../log/common/log";
import { BeforeShutdownErrorEvent, BeforeShutdownEvent, handleVetos, LifecycleCommands, LifecyclePhase, ShutdownReason, WillShutdownEvent } from "../common/lifecycle";

@service('lifecycleService')
export class LifecycleService extends Disposable {

	private static readonly BEFORE_SHUTDOWN_WARNING_DELAY = 5000;
	private static readonly WILL_SHUTDOWN_WARNING_DELAY = 5000;

	private readonly _onBeforeShutdown = this._register(new Emitter<BeforeShutdownEvent>());
	readonly onBeforeShutdown = this._onBeforeShutdown.event;

	private readonly _onWillShutdown = this._register(new Emitter<WillShutdownEvent>());
	readonly onWillShutdown = this._onWillShutdown.event;

	private readonly _onDidShutdown = this._register(new Emitter<void>());
	readonly onDidShutdown = this._onDidShutdown.event;

	private readonly _onBeforeShutdownError = this._register(new Emitter<BeforeShutdownErrorEvent>());
	readonly onBeforeShutdownError = this._onBeforeShutdownError.event;

	private readonly _onShutdownVeto = this._register(new Emitter<void>());
	readonly onShutdownVeto = this._onShutdownVeto.event;

	private _phase = LifecyclePhase.Starting;
	get phase(): LifecyclePhase { return this._phase; }

	private readonly phaseWhen = new Map<LifecyclePhase, Barrier>();

	protected shutdownReason: ShutdownReason | undefined;
	private readonly channel: IChannel;

	constructor(
		@inject('logService')
		private readonly logService: LogService,
		@inject('ipcRendererClient')
		private readonly ipcClient: IPCRendererClient,
	) {
		super();
		this.registerChannel();
		this.channel = ipcClient.getChannel('lifecycle');
	}

	quit() {
		return this.channel.call('quit');
	}

	kill(code: number) {
		return this.channel.call('kill', [code]);
	}

	relaunch() {
		this.channel.call('relaunch');
	}

	set phase(value: LifecyclePhase) {
		if (value < this.phase) {
			throw new Error('Lifecycle cannot go backwards');
		}

		if (this._phase === value) {
			return;
		}

		this.logService.log(`lifecycle: phase changed (value: ${value})`);

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

	private registerChannel() {
		const serverChannel: IServerChannel = {
			call: (_ctx, command, arg): Promise<any> => {
				switch(command) {
					case LifecycleCommands.HANDLE_BEFORE_SHUTDOWN:
						return this.handleBeforeShutdown(arg[0]);
					case LifecycleCommands.HANDLE_WILL_SHUTDOWN:
						return this.handleWillShutdown(arg[0]);
					default:
						throw new Error(`[Lifecycle] unknown command ${command}`);
				}
			},
			listen: (_ctx, _event, _arg) => {
				throw new Error('not available event');
			},
		}
		this.ipcClient.registerChannel('lifecycle', serverChannel);
	}

	private async handleBeforeShutdown(reason: ShutdownReason) {
		this.logService.log(`[lifecycle] onBeforeUnload (reason: ${reason})`);
		const logService = this.logService;

		const vetos: (boolean | Promise<boolean>)[] = [];
		const pendingVetos = new Set<string>();

		// before-shutdown event with veto support
		this._onBeforeShutdown.fire({
			reason,
			veto(value, id) {
				vetos.push(value);

				// Log any veto instantly
				if (value === true) {
					logService.info(`[lifecycle]: Shutdown was prevented (id: ${id})`);
				}

				// Track promise completion
				else if (value instanceof Promise) {
					pendingVetos.add(id);
					value.then(veto => {
						if (veto === true) {
							logService.info(`[lifecycle]: Shutdown was prevented (id: ${id})`);
						}
					}).finally(() => pendingVetos.delete(id));
				}
			},
		});

		const longRunningBeforeShutdownWarning = disposableTimeout(() => {
			logService.warn(`[lifecycle] onBeforeShutdown is taking a long time, pending operations: ${Array.from(pendingVetos).join(', ')}`);
		}, LifecycleService.BEFORE_SHUTDOWN_WARNING_DELAY);

		try {
			// First: run list of vetos in parallel
			const veto = await handleVetos(vetos, (error: Error) => {
				this.logService.error(`[lifecycle]: Error during before-shutdown phase (error: ${error.message})`);
				this._onBeforeShutdownError.fire({ reason, error });
			});
			// veto: cancel unload
			if (veto) {
				this.logService.log('[lifecycle] onBeforeUnload prevented via veto');
				// Indicate as event
				this._onShutdownVeto.fire();
				return true;
			}
			this.logService.log('[lifecycle] onBeforeUnload continues without veto');
	
			this.shutdownReason = reason;
			return false;
		} finally {
			longRunningBeforeShutdownWarning.dispose();
		}
	}

	private async handleWillShutdown(reason: ShutdownReason) {
		this.logService.log(`[lifecycle] onWillUnload (reason: ${reason})`);
		
		// trigger onWillShutdown events and joining
		const joiners: Promise<void>[] = [];
		const pendingJoiners = new Set<string>();

		this._onWillShutdown.fire({
			reason,
			join(promise, id) {
				joiners.push(promise);
				// Track promise completion
				pendingJoiners.add(id);
				promise.finally(() => pendingJoiners.delete(id));
			},
		});

		const longRunningWillShutdownWarning = disposableTimeout(() => {
			this.logService.warn(`[lifecycle] onWillShutdown is taking a long time, pending operations: ${Array.from(pendingJoiners).join(', ')}`);
		}, LifecycleService.WILL_SHUTDOWN_WARNING_DELAY);

		try {
			await Promise.allSettled(joiners);
		} catch (error: any) {
			this.logService.error(`[lifecycle]: Error during will-shutdown phase (error: ${error.message})`); // this error will not prevent the shutdown
		} finally {
			longRunningWillShutdownWarning.dispose();
		}

		// trigger onDidShutdown event now that we know we will quit
		this._onDidShutdown.fire();
	}
}
