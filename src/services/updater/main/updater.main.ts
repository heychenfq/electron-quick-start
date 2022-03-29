import { autoUpdater } from 'electron-updater';
import { memoize } from 'src/core/base/decorators';
import { Event } from 'src/core/base/event';
import { Disposable } from 'src/core/base/lifecycle';

autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = true;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.channel = 'latest';

class UpdaterService extends Disposable {

	@memoize private get onError(): Event<string> { return Event.fromNodeEventEmitter(autoUpdater, 'error'); }
	@memoize private get onUpdateNotAvailable(): Event<void> { return Event.fromNodeEventEmitter<void>(autoUpdater, 'update-not-available'); }
	@memoize private get onUpdateAvailable(): Event<IUpdate> { return Event.fromNodeEventEmitter(autoUpdater, 'update-available'); }
	@memoize private get onUpdateDownloaded(): Event<IUpdate> { return Event.fromNodeEventEmitter(autoUpdater, 'update-downloaded'); }

	constructor() {
		super();
	}

	async checkForUpdates() {
		const result = await autoUpdater.checkForUpdates();
		console.log(result);
		return result;
	}

	async checkForUpdatesAndNotify() {
		const result = await autoUpdater.checkForUpdatesAndNotify();
		console.log(result);
		return result;
	}
}

export const updateService = new UpdaterService();
