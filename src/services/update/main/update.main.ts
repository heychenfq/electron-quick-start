import { autoUpdater, UpdateInfo } from 'electron-updater';
import { inject, service } from '@electron-tools/ioc';
import { ElectronIPCMain, ServerChannel } from '@electron-tools/ipc';
import { memoize } from '../../../core/base/decorators';
import { UpdateCommands, UpdateEvents } from '../common/update';
import { LogService } from '../../log/common/log';
import { fromEvent, Observable } from 'rxjs';

autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = true;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.channel = 'latest';

@service('updateMainService')
export class UpdateMainService {

	@memoize get onError(): Observable<Error> { 
		return fromEvent<Error>(autoUpdater, 'error');
	}
	@memoize get onCheckingForUpdate(): Observable<void> {
		return fromEvent<void>(autoUpdater, 'checking-for-update');
	}
	@memoize get onUpdateAvailable(): Observable<UpdateInfo> { 
		return fromEvent<UpdateInfo>(autoUpdater, 'update-available');
	}
	@memoize get onUpdateNotAvailable(): Observable<UpdateInfo> { 
		return fromEvent<UpdateInfo>(autoUpdater, 'update-not-available');
	}
	@memoize get onDownloadProgress(): Observable<UpdateInfo> {
		return fromEvent<UpdateInfo>(autoUpdater, 'download-progress');
	}
	@memoize get onUpdateDownloaded(): Observable<UpdateInfo> { 
		return fromEvent<UpdateInfo>(autoUpdater, 'update-downloaded');
	}

	constructor(
		@inject('ipcMain')
		private readonly ipcMain: ElectronIPCMain,
		@inject('logService')
		logService: LogService,
	) {
		autoUpdater.logger = logService;
		this.registerIPCServerChannel();
	}

	async checkForUpdates() {
		const result = await autoUpdater.checkForUpdates();
		return result.updateInfo;
	}

	checkForUpdatesAndNotify() {
		return autoUpdater.checkForUpdatesAndNotify();
	}

	private registerIPCServerChannel() {
		const serverChannel: ServerChannel = {
			invoke: (_ctx, command, _arg): Promise<any> => {
				switch(command) {
					case UpdateCommands.CHECK_FOR_UPDATES:
						return this.checkForUpdates();
					case UpdateCommands.CHECK_FOR_UPDATES_AND_NOTIFY:
						return this.checkForUpdatesAndNotify();
					default:
						throw new Error(`[update] command: ${command} not found`);
				}
			},
			event: (_ctx: string, event: string): Observable<any> => {
				switch(event) {
					case UpdateEvents.ERROR: 
						return this.onError;
					case UpdateEvents.CHECKING_FOR_UPDATE:
						return this.onCheckingForUpdate;
					case UpdateEvents.UPDATE_AVAILABLE:
						return this.onUpdateAvailable;
					case UpdateEvents.UPDATE_NOT_AVAILABLE:
						return this.onUpdateNotAvailable;
					case UpdateEvents.DOWNLOAD_PROGRESS:
						return this.onDownloadProgress;
					case UpdateEvents.UPDATE_DOWNLOADED:
						return this.onUpdateDownloaded;
					default:
						throw new Error(`event ${event} not available`);
				}
			},
		};
		this.ipcMain.registerChannel('update', serverChannel);
	}
}
