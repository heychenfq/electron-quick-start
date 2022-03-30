/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { app, BrowserWindow, BrowserWindowConstructorOptions, Display, nativeImage, NativeImage, Rectangle, screen, SegmentedControlSegment, systemPreferences, TouchBar, TouchBarSegmentedControl } from 'electron';
import { RunOnceScheduler } from '../../../core/base/async';
import { CancellationToken } from '../../../core/base/cancellation';
import { Emitter, Event } from '../../../core/base/event';
import { Disposable, IDisposable } from '../../../core/base/lifecycle';
import { isLinux, isMacintosh, isWindows } from '../../../core/base/platform';
import { inject } from '../../instantiation/common/instantiation';
import { LogService } from '../../log/common/log';

export interface IWindow extends IDisposable {

	readonly onWillLoad: Event<ILoadEvent>;
	readonly onDidSignalReady: Event<void>;
	readonly onDidClose: Event<void>;
	readonly onDidDestroy: Event<void>;

	readonly whenClosedOrLoaded: Promise<void>;

	readonly id: number;
	readonly win: BrowserWindow | null; /* `null` after being disposed */

	readonly backupPath?: string;

	readonly remoteAuthority?: string;

	readonly lastFocusTime: number;

	readonly isReady: boolean;
	ready(): Promise<IWindow>;
	setReady(): void;

	readonly hasHiddenTitleBarStyle: boolean;

	addTabbedWindow(window: IWindow): void;

	load(isReload?: boolean): void;
	reload(): void;

	focus(options?: { force: boolean }): void;
	close(): void;

	getBounds(): Rectangle;

	send(channel: string, ...args: any[]): void;
	sendWhenReady(channel: string, token: CancellationToken, ...args: any[]): void;

	readonly isFullScreen: boolean;
	toggleFullScreen(): void;

	isMinimized(): boolean;

	serializeWindowState(): IWindowState;
}

export const enum LoadReason {

	/**
	 * The window is loaded for the first time.
	 */
	INITIAL = 1,

	/**
	 * The window is reloaded.
	 */
	RELOAD = 2,
}

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

export interface IWindowState {
	width?: number;
	height?: number;
	x?: number;
	y?: number;
	mode?: WindowMode;
	display?: number;
}

export const WindowMinimumSize = {
	WIDTH: 400,
	WIDTH_WITH_VERTICAL_PANEL: 600,
	HEIGHT: 270
};

export const defaultWindowState = function (mode = WindowMode.Normal): IWindowState {
	return {
		width: 1024,
		height: 768,
		mode
	};
};

export const enum WindowMode {
	Maximized,
	Normal,
	Minimized, // not used anymore, but also cannot remove due to existing stored UI state (needs migration)
	Fullscreen
}

export interface ILoadEvent {
	reason: LoadReason;
}

export const enum WindowError {

	/**
	 * Maps to the `unresponsive` event on a `BrowserWindow`.
	 */
	UNRESPONSIVE = 1,

	/**
	 * Maps to the `render-proces-gone` event on a `WebContents`.
	 */
	CRASHED = 2,

	/**
	 * Maps to the `did-fail-load` event on a `WebContents`.
	 */
	LOAD = 3
}

export interface IWindowCreationOptions {
	state: IWindowState;
	extensionDevelopmentPath?: string[];
	isExtensionTestHost?: boolean;
}


interface ILoadOptions {
	isReload?: boolean;
}

const enum ReadyState {

	/**
	 * This window has not loaded anything yet
	 * and this is the initial state of every
	 * window.
	 */
	NONE,

	/**
	 * This window is navigating, either for the
	 * first time or subsequent times.
	 */
	NAVIGATING,

	/**
	 * This window has finished loading and is ready
	 * to forward IPC requests to the web contents.
	 */
	READY
}

// export class AppWindow extends Disposable implements IWindow {

// 	//#region Events

// 	private readonly _onWillLoad = this._register(new Emitter<ILoadEvent>());
// 	readonly onWillLoad = this._onWillLoad.event;

// 	private readonly _onDidSignalReady = this._register(new Emitter<void>());
// 	readonly onDidSignalReady = this._onDidSignalReady.event;

// 	private readonly _onDidClose = this._register(new Emitter<void>());
// 	readonly onDidClose = this._onDidClose.event;

// 	private readonly _onDidDestroy = this._register(new Emitter<void>());
// 	readonly onDidDestroy = this._onDidDestroy.event;

// 	//#endregion


// 	//#region Properties

// 	private _id: number;
// 	get id(): number { return this._id; }

// 	private _win: BrowserWindow;
// 	get win(): BrowserWindow | null { return this._win; }

// 	private _lastFocusTime = -1;
// 	get lastFocusTime(): number { return this._lastFocusTime; }

// 	private hiddenTitleBarStyle: boolean | undefined;
// 	get hasHiddenTitleBarStyle(): boolean { return !!this.hiddenTitleBarStyle; }

// 	//#endregion

// 	private readonly windowState: IWindowState;

// 	private representedFilename: string | undefined;

// 	private readonly whenReadyCallbacks: { (window: IWindow): void }[] = [];

// 	private currentHttpProxy: string | undefined = undefined;
// 	private currentNoProxy: string | undefined = undefined;

// 	constructor(
// 		@inject('logService')
// 		private readonly logService: LogService,
// 		@IEnvironmentMainService private readonly environmentMainService: IEnvironmentMainService,
// 		@IConfigurationService private readonly configurationService: IConfigurationService,
// 		@IProductService private readonly productService: IProductService,
// 		@IWindowsMainService private readonly windowsMainService: IWindowsMainService
// 	) {
// 		super();

// 		//#region create browser window
// 		{
// 			// Load window state
// 			const [state, hasMultipleDisplays] = this.restoreWindowState(config.state);
// 			this.windowState = state;
// 			this.logService.log('window#ctor: using window state', state);

// 			// in case we are maximized or fullscreen, only show later after the call to maximize/fullscreen (see below)
// 			const isFullscreenOrMaximized = (this.windowState.mode === WindowMode.Maximized || this.windowState.mode === WindowMode.Fullscreen);

// 			const windowSettings = this.configurationService.getValue<IWindowSettings | undefined>('window');

// 			const options: BrowserWindowConstructorOptions = {
// 				width: this.windowState.width,
// 				height: this.windowState.height,
// 				x: this.windowState.x,
// 				y: this.windowState.y,
// 				minWidth: WindowMinimumSize.WIDTH,
// 				minHeight: WindowMinimumSize.HEIGHT,
// 				show: !isFullscreenOrMaximized,
// 				title: this.productService.nameLong,
// 				webPreferences: {
// 					enableWebSQL: false,
// 					spellcheck: false,
// 					nativeWindowOpen: true,
// 					zoomFactor: zoomLevelToZoomFactor(windowSettings?.zoomLevel),
// 					nodeIntegration: true,
// 					contextIsolation: false,
// 				}
// 			};

// 			options.titleBarStyle = 'hidden';
// 			this.hiddenTitleBarStyle = true;
// 			if (!isMacintosh) {
// 				options.frame = false;
// 			}

// 			// Create the browser window
// 			this._win = new BrowserWindow(options);

// 			this._id = this._win.id;

// 			// Open devtools if instructed from command line args
// 			if (this.environmentMainService.args['open-devtools'] === true) {
// 				this._win.webContents.openDevTools();
// 			}

// 			if (isMacintosh) {
// 				this._win.setSheetOffset(22); // offset dialogs by the height of the custom title bar if we have any
// 			}

// 			// TODO@electron (Electron 4 regression): when running on multiple displays where the target display
// 			// to open the window has a larger resolution than the primary display, the window will not size
// 			// correctly unless we set the bounds again (https://github.com/microsoft/vscode/issues/74872)
// 			//
// 			// However, when running with native tabs with multiple windows we cannot use this workaround
// 			// because there is a potential that the new window will be added as native tab instead of being
// 			// a window on its own. In that case calling setBounds() would cause https://github.com/microsoft/vscode/issues/75830
// 			if (isMacintosh && hasMultipleDisplays && (!useNativeTabs || BrowserWindow.getAllWindows().length === 1)) {
// 				if ([this.windowState.width, this.windowState.height, this.windowState.x, this.windowState.y].every(value => typeof value === 'number')) {
// 					const ensuredWindowState = this.windowState as Required<IWindowState>;
// 					this._win.setBounds({
// 						width: ensuredWindowState.width,
// 						height: ensuredWindowState.height,
// 						x: ensuredWindowState.x,
// 						y: ensuredWindowState.y
// 					});
// 				}
// 			}

// 			if (isFullscreenOrMaximized) {
// 				this._win.maximize();

// 				if (this.windowState.mode === WindowMode.Fullscreen) {
// 					this.setFullScreen(true);
// 				}

// 				if (!this._win.isVisible()) {
// 					this._win.show(); // to reduce flicker from the default window size to maximize, we only show after maximize
// 				}
// 			}

// 			this._lastFocusTime = Date.now(); // since we show directly, we need to set the last focus time too
// 		}
// 		//#endregion

// 		// respect configured menu bar visibility
// 		this.onConfigurationUpdated();

// 		// Eventing
// 		this.registerListeners();
// 	}

// 	setRepresentedFilename(filename: string): void {
// 		if (isMacintosh) {
// 			this._win.setRepresentedFilename(filename);
// 		} else {
// 			this.representedFilename = filename;
// 		}
// 	}

// 	getRepresentedFilename(): string | undefined {
// 		if (isMacintosh) {
// 			return this._win.getRepresentedFilename();
// 		}

// 		return this.representedFilename;
// 	}

// 	focus(options?: { force: boolean }): void {
// 		// macOS: Electron > 7.x changed its behaviour to not
// 		// bring the application to the foreground when a window
// 		// is focused programmatically. Only via `app.focus` and
// 		// the option `steal: true` can you get the previous
// 		// behaviour back. The only reason to use this option is
// 		// when a window is getting focused while the application
// 		// is not in the foreground.
// 		if (isMacintosh && options?.force) {
// 			app.focus({ steal: true });
// 		}

// 		if (!this._win) {
// 			return;
// 		}

// 		if (this._win.isMinimized()) {
// 			this._win.restore();
// 		}

// 		this._win.focus();
// 	}

// 	private readyState = ReadyState.NONE;

// 	setReady(): void {
// 		this.logService.info(`window#load: window reported ready (id: ${this._id})`);

// 		this.readyState = ReadyState.READY;

// 		// inform all waiting promises that we are ready now
// 		while (this.whenReadyCallbacks.length) {
// 			this.whenReadyCallbacks.pop()!(this);
// 		}

// 		// Events
// 		this._onDidSignalReady.fire();
// 	}

// 	ready(): Promise<IWindow> {
// 		return new Promise<IWindow>(resolve => {
// 			if (this.isReady) {
// 				return resolve(this);
// 			}

// 			// otherwise keep and call later when we are ready
// 			this.whenReadyCallbacks.push(resolve);
// 		});
// 	}

// 	get isReady(): boolean {
// 		return this.readyState === ReadyState.READY;
// 	}

// 	get whenClosedOrLoaded(): Promise<void> {
// 		return new Promise<void>(resolve => {

// 			function handle() {
// 				closeListener.dispose();
// 				loadListener.dispose();

// 				resolve();
// 			}

// 			const closeListener = this.onDidClose(() => handle());
// 			const loadListener = this.onWillLoad(() => handle());
// 		});
// 	}

// 	private registerListeners(): void {
// 		// Crashes & Unresponsive & Failed to load
// 		this._win.on('unresponsive', () => this.onWindowError(WindowError.UNRESPONSIVE));
// 		this._win.webContents.on('render-process-gone', (event, details) => this.onWindowError(WindowError.CRASHED, details));
// 		this._win.webContents.on('did-fail-load', (event, exitCode, reason) => this.onWindowError(WindowError.LOAD, { reason, exitCode }));
		
// 		// Prevent windows/iframes from blocking the unload
// 		// through DOM events. We have our own logic for
// 		// unloading a window that should not be confused
// 		// with the DOM way.
// 		// (https://github.com/microsoft/vscode/issues/122736)
// 		this._win.webContents.on('will-prevent-unload', event => {
// 			event.preventDefault();
// 		});

// 		// Window close
// 		this._win.on('closed', () => {
// 			this._onDidClose.fire();

// 			this.dispose();
// 		});

// 		// Window Focus
// 		this._win.on('focus', () => {
// 			this._lastFocusTime = Date.now();
// 		});

// 		// Window (Un)Maximize
// 		this._win.on('maximize', (e: Electron.Event) => {
// 			app.emit('browser-window-maximize', e, this._win);
// 		});

// 		this._win.on('unmaximize', (e: Electron.Event) => {
// 			app.emit('browser-window-unmaximize', e, this._win);
// 		});

// 		// Window Fullscreen
// 		this._win.on('enter-full-screen', () => {
// 			this.sendWhenReady('vscode:enterFullScreen', CancellationToken.None);
// 		});

// 		this._win.on('leave-full-screen', () => {
// 			this.sendWhenReady('vscode:leaveFullScreen', CancellationToken.None);
// 		});
// 	}

// 	private async onWindowError(error: WindowError.UNRESPONSIVE): Promise<void>;
// 	private async onWindowError(error: WindowError.CRASHED, details: { reason: string; exitCode: number }): Promise<void>;
// 	private async onWindowError(error: WindowError.LOAD, details: { reason: string; exitCode: number }): Promise<void>;
// 	private async onWindowError(type: WindowError, details?: { reason: string; exitCode: number }): Promise<void> {

// 		switch (type) {
// 			case WindowError.CRASHED:
// 				this.logService.error(`Window: renderer process crashed (reason: ${details?.reason || '<unknown>'}, code: ${details?.exitCode || '<unknown>'})`);
// 				break;
// 			case WindowError.UNRESPONSIVE:
// 				this.logService.error('Window: detected unresponsive');
// 				break;
// 			case WindowError.LOAD:
// 				this.logService.error(`Window: failed to load (reason: ${details?.reason || '<unknown>'}, code: ${details?.exitCode || '<unknown>'})`);
// 				break;
// 		}

// 		// Inform User if non-recoverable
// 		switch (type) {
// 			case WindowError.UNRESPONSIVE:
// 			case WindowError.CRASHED:
// 				// Unresponsive
// 				if (type === WindowError.UNRESPONSIVE) {
// 					if (this._win && this._win.webContents && this._win.webContents.isDevToolsOpened()) {
// 						// TODO@electron Workaround for https://github.com/microsoft/vscode/issues/56994
// 						// In certain cases the window can report unresponsiveness because a breakpoint was hit
// 						// and the process is stopped executing. The most typical cases are:
// 						// - devtools are opened and debugging happens
// 						// - window is an extensions development host that is being debugged
// 						// - window is an extension test development host that is being debugged
// 						return;
// 					}

// 					// Show Dialog
// 					// const result = await this.dialogMainService.showMessageBox({
// 					// 	title: this.productService.nameLong,
// 					// 	type: 'warning',
// 					// 	buttons: [
// 					// 		mnemonicButtonLabel(localize({ key: 'reopen', comment: ['&& denotes a mnemonic'] }, "&&Reopen")),
// 					// 		mnemonicButtonLabel(localize({ key: 'wait', comment: ['&& denotes a mnemonic'] }, "&&Keep Waiting")),
// 					// 		mnemonicButtonLabel(localize({ key: 'close', comment: ['&& denotes a mnemonic'] }, "&&Close"))
// 					// 	],
// 					// 	message: localize('appStalled', "The window is not responding"),
// 					// 	detail: localize('appStalledDetail', "You can reopen or close the window or keep waiting."),
// 					// 	noLink: true,
// 					// 	defaultId: 0,
// 					// 	cancelId: 1
// 					// }, this._win);

// 					// // Handle choice
// 					// if (result.response !== 1 /* keep waiting */) {
// 					// 	const reopen = result.response === 0;
// 					// 	this.destroyWindow(reopen);
// 					// }
// 				}

// 				// Crashed
// 				else if (type === WindowError.CRASHED) {
// 					let message: string;
// 					if (!details) {
// 						// message = localize('appCrashed', "The window has crashed");
// 					} else {
// 						// message = localize('appCrashedDetails', "The window has crashed (reason: '{0}', code: '{1}')", details.reason, details.exitCode ?? '<unknown>');
// 					}

// 					// Show Dialog
// 					// const result = await this.dialogMainService.showMessageBox({
// 					// 	title: this.productService.nameLong,
// 					// 	type: 'warning',
// 					// 	buttons: [
// 					// 		mnemonicButtonLabel(localize({ key: 'reopen', comment: ['&& denotes a mnemonic'] }, "&&Reopen")),
// 					// 		mnemonicButtonLabel(localize({ key: 'close', comment: ['&& denotes a mnemonic'] }, "&&Close"))
// 					// 	],
// 					// 	message,
// 					// 	detail: localize('appCrashedDetail', "We are sorry for the inconvenience. You can reopen the window to continue where you left off."),
// 					// 	noLink: true,
// 					// 	defaultId: 0
// 					// }, this._win);

// 					// Handle choice
// 					const reopen = result.response === 0;
// 					this.destroyWindow(reopen);
// 				}
// 				break;
// 		}
// 	}

// 	private destroyWindow(reopen: boolean): void {

// 		// 'close' event will not be fired on destroy(), so signal crash via explicit event
// 		this._onDidDestroy.fire();

// 		// make sure to destroy the window as it has crashed
// 		this._win?.destroy();

// 		// ask the windows service to open a new fresh window if specified
// 		if (reopen && this.config) {

// 			// Delegate to windows service
// 			const [window] = this.windowsMainService.open({
// 				context: OpenContext.API,
// 				userEnv: this.config.userEnv,
// 				cli: {
// 					...this.environmentMainService.args,
// 					_: [] // we pass in the workspace to open explicitly via `urisToOpen`
// 				},
// 				forceNewWindow: true,
// 			});
// 			window.focus();
// 		}
// 	}

// 	private onConfigurationUpdated(): void {
// 		// Proxy
// 		let newHttpProxy = (this.configurationService.getValue<string>('http.proxy') || '').trim()
// 			|| (process.env['https_proxy'] || process.env['HTTPS_PROXY'] || process.env['http_proxy'] || process.env['HTTP_PROXY'] || '').trim() // Not standardized.
// 			|| undefined;

// 		if (newHttpProxy?.endsWith('/')) {
// 			newHttpProxy = newHttpProxy.substr(0, newHttpProxy.length - 1);
// 		}

// 		const newNoProxy = (process.env['no_proxy'] || process.env['NO_PROXY'] || '').trim() || undefined; // Not standardized.
// 		if ((newHttpProxy || '').indexOf('@') === -1 && (newHttpProxy !== this.currentHttpProxy || newNoProxy !== this.currentNoProxy)) {
// 			this.currentHttpProxy = newHttpProxy;
// 			this.currentNoProxy = newNoProxy;

// 			const proxyRules = newHttpProxy || '';
// 			const proxyBypassRules = newNoProxy ? `${newNoProxy},<local>` : '<local>';
// 			this.logService.log(`Setting proxy to '${proxyRules}', bypassing '${proxyBypassRules}'`);
// 			this._win.webContents.session.setProxy({ proxyRules, proxyBypassRules, pacScript: '' });
// 		}
// 	}

// 	addTabbedWindow(window: IWindow): void {
// 		if (isMacintosh && window.win) {
// 			this._win.addTabbedWindow(window.win);
// 		}
// 	}

// 	load(configuration: INativeWindowConfiguration, options: ILoadOptions = Object.create(null)): void {
// 		this.logService.info(`window#load: attempt to load window (id: ${this._id})`);

// 		// Update configuration values based on our window context
// 		// and set it into the config object URL for usage.
// 		this.updateConfiguration(configuration);

// 		// If this is the first time the window is loaded, we associate the paths
// 		// directly with the window because we assume the loading will just work
// 		if (this.readyState === ReadyState.NONE) {
// 			this.currentConfig = configuration;
// 		}

// 		// Otherwise, the window is currently showing a folder and if there is an
// 		// unload handler preventing the load, we cannot just associate the paths
// 		// because the loading might be vetoed. Instead we associate it later when
// 		// the window load event has fired.
// 		else {
// 			this.pendingLoadConfig = configuration;
// 		}

// 		// Indicate we are navigting now
// 		this.readyState = ReadyState.NAVIGATING;

// 		// Load URL
// 		this._win.loadURL(FileAccess.asBrowserUri(this.environmentMainService.sandbox ?
// 			'vs/code/electron-sandbox/workbench/workbench.html' :
// 			'vs/code/electron-browser/workbench/workbench.html', require
// 		).toString(true));

// 		// Make window visible if it did not open in N seconds because this indicates an error
// 		// Only do this when running out of sources and not when running tests
// 		if (!this.environmentMainService.isBuilt && !this.environmentMainService.extensionTestsLocationURI) {
// 			this._register(new RunOnceScheduler(() => {
// 				if (this._win && !this._win.isVisible() && !this._win.isMinimized()) {
// 					this._win.show();
// 					this.focus({ force: true });
// 					this._win.webContents.openDevTools();
// 				}

// 			}, 10000)).schedule();
// 		}

// 		// Event
// 		this._onWillLoad.fire({ reason: options.isReload ? LoadReason.RELOAD : LoadReason.INITIAL });
// 	}

// 	private updateConfiguration(configuration: INativeWindowConfiguration): void {

// 		// Update window related properties
// 		configuration.fullscreen = this.isFullScreen;
// 		configuration.maximized = this._win.isMaximized();

// 		// Update in config object URL for usage in renderer
// 		this.configObjectUrl.update(configuration);
// 	}

// 	async reload(): Promise<void> {

// 		// Copy our current config for reuse
// 		const configuration = Object.assign({}, this.currentConfig);


// 		// Delete some properties we do not want during reload
// 		delete configuration.filesToOpenOrCreate;
// 		delete configuration.filesToDiff;
// 		delete configuration.filesToWait;

// 		configuration.isInitialStartup = false; // since this is a reload

// 		// Load config
// 		this.load(configuration, { isReload: true });
// 	}

// 	serializeWindowState(): IWindowState {
// 		if (!this._win) {
// 			return defaultWindowState();
// 		}

// 		// fullscreen gets special treatment
// 		if (this.isFullScreen) {
// 			let display: Display | undefined;
// 			try {
// 				display = screen.getDisplayMatching(this.getBounds());
// 			} catch (error) {
// 				// Electron has weird conditions under which it throws errors
// 				// e.g. https://github.com/microsoft/vscode/issues/100334 when
// 				// large numbers are passed in
// 			}

// 			const defaultState = defaultWindowState();

// 			const res = {
// 				mode: WindowMode.Fullscreen,
// 				display: display ? display.id : undefined,

// 				// Still carry over window dimensions from previous sessions
// 				// if we can compute it in fullscreen state.
// 				// does not seem possible in all cases on Linux for example
// 				// (https://github.com/microsoft/vscode/issues/58218) so we
// 				// fallback to the defaults in that case.
// 				width: this.windowState.width || defaultState.width,
// 				height: this.windowState.height || defaultState.height,
// 				x: this.windowState.x || 0,
// 				y: this.windowState.y || 0
// 			};

// 			return res;
// 		}

// 		const state: IWindowState = Object.create(null);
// 		let mode: WindowMode;

// 		// get window mode
// 		if (!isMacintosh && this._win.isMaximized()) {
// 			mode = WindowMode.Maximized;
// 		} else {
// 			mode = WindowMode.Normal;
// 		}

// 		// we don't want to save minimized state, only maximized or normal
// 		if (mode === WindowMode.Maximized) {
// 			state.mode = WindowMode.Maximized;
// 		} else {
// 			state.mode = WindowMode.Normal;
// 		}

// 		// only consider non-minimized window states
// 		if (mode === WindowMode.Normal || mode === WindowMode.Maximized) {
// 			let bounds: Rectangle;
// 			if (mode === WindowMode.Normal) {
// 				bounds = this.getBounds();
// 			} else {
// 				bounds = this._win.getNormalBounds(); // make sure to persist the normal bounds when maximized to be able to restore them
// 			}

// 			state.x = bounds.x;
// 			state.y = bounds.y;
// 			state.width = bounds.width;
// 			state.height = bounds.height;
// 		}

// 		return state;
// 	}

// 	private restoreWindowState(state?: IWindowState): [IWindowState, boolean? /* has multiple displays */] {
		
// 		let hasMultipleDisplays = false;
// 		if (state) {
// 			try {
// 				const displays = screen.getAllDisplays();
// 				hasMultipleDisplays = displays.length > 1;

// 				state = this.validateWindowState(state, displays);
// 			} catch (err) {
// 				this.logService.warn(`Unexpected error validating window state: ${err}\n${err.stack}`); // somehow display API can be picky about the state to validate
// 			}
// 		}

// 		return [state || defaultWindowState(), hasMultipleDisplays];
// 	}

// 	private validateWindowState(state: IWindowState, displays: Display[]): IWindowState | undefined {
// 		this.logService.log(`window#validateWindowState: validating window state on ${displays.length} display(s)`, state);

// 		if (typeof state.x !== 'number'
// 			|| typeof state.y !== 'number'
// 			|| typeof state.width !== 'number'
// 			|| typeof state.height !== 'number'
// 		) {
// 			this.logService.log('window#validateWindowState: unexpected type of state values');
// 			return undefined;
// 		}

// 		if (state.width <= 0 || state.height <= 0) {
// 			this.logService.log('window#validateWindowState: unexpected negative values');
// 			return undefined;
// 		}

// 		// Single Monitor: be strict about x/y positioning
// 		// macOS & Linux: these OS seem to be pretty good in ensuring that a window is never outside of it's bounds.
// 		// Windows: it is possible to have a window with a size that makes it fall out of the window. our strategy
// 		//          is to try as much as possible to keep the window in the monitor bounds. we are not as strict as
// 		//          macOS and Linux and allow the window to exceed the monitor bounds as long as the window is still
// 		//          some pixels (128) visible on the screen for the user to drag it back.
// 		if (displays.length === 1) {
// 			const displayWorkingArea = this.getWorkingArea(displays[0]);
// 			if (displayWorkingArea) {
// 				this.logService.log('window#validateWindowState: 1 monitor working area', displayWorkingArea);

// 				function ensureStateInDisplayWorkingArea(): void {
// 					if (!state || typeof state.x !== 'number' || typeof state.y !== 'number' || !displayWorkingArea) {
// 						return;
// 					}

// 					if (state.x < displayWorkingArea.x) {
// 						// prevent window from falling out of the screen to the left
// 						state.x = displayWorkingArea.x;
// 					}

// 					if (state.y < displayWorkingArea.y) {
// 						// prevent window from falling out of the screen to the top
// 						state.y = displayWorkingArea.y;
// 					}
// 				}

// 				// ensure state is not outside display working area (top, left)
// 				ensureStateInDisplayWorkingArea();

// 				if (state.width > displayWorkingArea.width) {
// 					// prevent window from exceeding display bounds width
// 					state.width = displayWorkingArea.width;
// 				}

// 				if (state.height > displayWorkingArea.height) {
// 					// prevent window from exceeding display bounds height
// 					state.height = displayWorkingArea.height;
// 				}

// 				if (state.x > (displayWorkingArea.x + displayWorkingArea.width - 128)) {
// 					// prevent window from falling out of the screen to the right with
// 					// 128px margin by positioning the window to the far right edge of
// 					// the screen
// 					state.x = displayWorkingArea.x + displayWorkingArea.width - state.width;
// 				}

// 				if (state.y > (displayWorkingArea.y + displayWorkingArea.height - 128)) {
// 					// prevent window from falling out of the screen to the bottom with
// 					// 128px margin by positioning the window to the far bottom edge of
// 					// the screen
// 					state.y = displayWorkingArea.y + displayWorkingArea.height - state.height;
// 				}

// 				// again ensure state is not outside display working area
// 				// (it may have changed from the previous validation step)
// 				ensureStateInDisplayWorkingArea();
// 			}

// 			return state;
// 		}

// 		// Multi Montior (fullscreen): try to find the previously used display
// 		if (state.display && state.mode === WindowMode.Fullscreen) {
// 			const display = displays.find(d => d.id === state.display);
// 			if (display && typeof display.bounds?.x === 'number' && typeof display.bounds?.y === 'number') {
// 				this.logService.log('window#validateWindowState: restoring fullscreen to previous display');

// 				const defaults = defaultWindowState(WindowMode.Fullscreen); // make sure we have good values when the user restores the window
// 				defaults.x = display.bounds.x; // carefull to use displays x/y position so that the window ends up on the correct monitor
// 				defaults.y = display.bounds.y;

// 				return defaults;
// 			}
// 		}

// 		// Multi Monitor (non-fullscreen): ensure window is within display bounds
// 		let display: Display | undefined;
// 		let displayWorkingArea: Rectangle | undefined;
// 		try {
// 			display = screen.getDisplayMatching({ x: state.x, y: state.y, width: state.width, height: state.height });
// 			displayWorkingArea = this.getWorkingArea(display);
// 		} catch (error) {
// 			// Electron has weird conditions under which it throws errors
// 			// e.g. https://github.com/microsoft/vscode/issues/100334 when
// 			// large numbers are passed in
// 		}

// 		if (
// 			display &&														// we have a display matching the desired bounds
// 			displayWorkingArea &&											// we have valid working area bounds
// 			state.x + state.width > displayWorkingArea.x &&					// prevent window from falling out of the screen to the left
// 			state.y + state.height > displayWorkingArea.y &&				// prevent window from falling out of the screen to the top
// 			state.x < displayWorkingArea.x + displayWorkingArea.width &&	// prevent window from falling out of the screen to the right
// 			state.y < displayWorkingArea.y + displayWorkingArea.height		// prevent window from falling out of the screen to the bottom
// 		) {
// 			this.logService.log('window#validateWindowState: multi-monitor working area', displayWorkingArea);

// 			return state;
// 		}

// 		return undefined;
// 	}

// 	private getWorkingArea(display: Display): Rectangle | undefined {

// 		// Prefer the working area of the display to account for taskbars on the
// 		// desktop being positioned somewhere (https://github.com/microsoft/vscode/issues/50830).
// 		//
// 		// Linux X11 sessions sometimes report wrong display bounds, so we validate
// 		// the reported sizes are positive.
// 		if (display.workArea.width > 0 && display.workArea.height > 0) {
// 			return display.workArea;
// 		}

// 		if (display.bounds.width > 0 && display.bounds.height > 0) {
// 			return display.bounds;
// 		}

// 		return undefined;
// 	}

// 	getBounds(): Rectangle {
// 		const [x, y] = this._win.getPosition();
// 		const [width, height] = this._win.getSize();

// 		return { x, y, width, height };
// 	}

// 	toggleFullScreen(): void {
// 		this.setFullScreen(!this.isFullScreen);
// 	}

// 	get isFullScreen(): boolean { return this._win.isFullScreen() }

// 	private setFullScreen(fullscreen: boolean): void {
// 		this._win.setFullScreen(fullscreen);
// 	}

// 	isMinimized(): boolean {
// 		return this._win.isMinimized();
// 	}

// 	close(): void {
// 		if (this._win) {
// 			this._win.close();
// 		}
// 	}

// 	sendWhenReady(channel: string, token: CancellationToken, ...args: any[]): void {
// 		if (this.isReady) {
// 			this.send(channel, ...args);
// 		} else {
// 			this.ready().then(() => {
// 				if (!token.isCancellationRequested) {
// 					this.send(channel, ...args);
// 				}
// 			});
// 		}
// 	}

// 	send(channel: string, ...args: any[]): void {
// 		if (this._win) {
// 			if (this._win.isDestroyed() || this._win.webContents.isDestroyed()) {
// 				this.logService.warn(`Sending IPC message to channel '${channel}' for window that is destroyed`);
// 				return;
// 			}

// 			try {
// 				this._win.webContents.send(channel, ...args);
// 			} catch (error) {
// 				this.logService.warn(`Error sending IPC message to channel '${channel}' of window ${this._id}: ${toErrorMessage(error)}`);
// 			}
// 		}
// 	}

// 	override dispose(): void {
// 		super.dispose();
// 		this._win = null!; // Important to dereference the window object to allow for GC
// 	}
// }
