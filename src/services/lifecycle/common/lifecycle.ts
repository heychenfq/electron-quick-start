
import { isThenable } from '../../../core/base/async';
import { IWindow, LoadReason } from '../../windows/common/window';

export interface WindowLoadEvent {

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
	KILL = 2,
}

/**
 * An event that is send out when the window is about to close. Clients have a chance to veto
 * the closing by either calling veto with a boolean "true" directly or with a promise that
 * resolves to a boolean. Returning a promise is useful in cases of long running operations
 * on shutdown.
 *
 * Note: It is absolutely important to avoid long running promises if possible. Please try hard
 * to return a boolean directly. Returning a promise has quite an impact on the shutdown sequence!
 */
export interface BeforeShutdownEvent {

	/**
	 * The reason why the application will be shutting down.
	 */
	readonly reason: ShutdownReason;

	/**
	 * Allows to veto the shutdown. The veto can be a long running operation but it
	 * will block the application from closing.
	 *
	 * @param id to identify the veto operation in case it takes very long or never
	 * completes.
	 */
	veto(value: boolean | Promise<boolean>, id: string): void;
}

/**
 * An event that signals an error happened during `onBeforeShutdown` veto handling.
 * In this case the shutdown operation will not proceed because this is an unexpected
 * condition that is treated like a veto.
 */
export interface BeforeShutdownErrorEvent {

	/**
	 * The reason why the application is shutting down.
	 */
	readonly reason: ShutdownReason;

	/**
	 * The error that happened during shutdown handling.
	 */
	readonly error: Error;
}

/**
 * An event that is send out when the window closes. Clients have a chance to join the closing
 * by providing a promise from the join method. Returning a promise is useful in cases of long
 * running operations on shutdown.
 *
 * Note: It is absolutely important to avoid long running promises if possible. Please try hard
 * to return a boolean directly. Returning a promise has quite an impact on the shutdown sequence!
 */
export interface WillShutdownEvent {

	/**
	 * The reason why the application is shutting down.
	 */
	readonly reason: ShutdownReason;

	/**
	 * Allows to join the shutdown. The promise can be a long running operation but it
	 * will block the application from closing.
	 *
	 * @param id to identify the join operation in case it takes very long or never
	 * completes.
	 */
	join(promise: Promise<void>, id: string): void;
}

export const enum LifecyclePhase {

	/**
	 * The first phase signals that we are about to startup getting ready.
	 *
	 * Note: doing work in this phase blocks an editor from showing to
	 * the user, so please rather consider to use `Restored` phase.
	 */
	Starting = 1,

	/**
	 * Services are ready and the window is about to restore its UI state.
	 *
	 * Note: doing work in this phase blocks an editor from showing to
	 * the user, so please rather consider to use `Restored` phase.
	 */
	Ready = 2,
}

export const enum LifecycleCommands {
	// renderer
	HANDLE_BEFORE_SHUTDOWN = 'handleBeforeShutdown',
	HANDLE_WILL_SHUTDOWN = 'handleWillShutdown',
	// main
	QUIT = 'quit',
	RELAUNCH = 'relaunch',
	KILL = 'kill',
}

// Shared veto handling across main and renderer
export function handleVetos(vetos: (boolean | Promise<boolean>)[], onError: (error: Error) => void): Promise<boolean /* veto */> {
	if (vetos.length === 0) {
		return Promise.resolve(false);
	}

	const promises: Promise<void>[] = [];
	let lazyValue = false;

	for (let valueOrPromise of vetos) {

		// veto, done
		if (valueOrPromise === true) {
			return Promise.resolve(true);
		}

		if (isThenable(valueOrPromise)) {
			promises.push(valueOrPromise.then(value => {
				if (value) {
					lazyValue = true; // veto, done
				}
			}, err => {
				onError(err); // error, treated like a veto, done
				lazyValue = true;
			}));
		}
	}

	return Promise.allSettled(promises).then(() => lazyValue);
}
