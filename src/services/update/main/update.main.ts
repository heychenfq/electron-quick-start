import { autoUpdater, UpdateInfo } from 'electron-updater';
import { memoize } from '../../../core/base/decorators';
import { Event } from '../../../core/base/event';
import { Disposable } from '../../../core/base/lifecycle';
import { IpcMainServer } from '../../ipc/main/ipc.main';
import { inject, service } from '../../instantiation/common/instantiation';
import { IServerChannel } from '../../ipc/common/ipc';
import { UpdateCommands, UpdateEvents } from '../common/update';

autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = true;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.channel = 'latest';

@service('updateMainService')
export class UpdateMainService extends Disposable {

	@memoize get onError(): Event<Error> { 
		return Event.fromNodeEventEmitter(autoUpdater, 'error'); 
	}
	@memoize get onCheckingForUpdate(): Event<void> {
		return Event.fromNodeEventEmitter(autoUpdater, 'checking-for-update');
	}
	@memoize get onUpdateAvailable(): Event<UpdateInfo> { 
		return Event.fromNodeEventEmitter<UpdateInfo>(autoUpdater, 'update-available'); 
	}
	@memoize get onUpdateNotAvailable(): Event<UpdateInfo> { 
		return Event.fromNodeEventEmitter<UpdateInfo>(autoUpdater, 'update-not-available'); 
	}
	@memoize get onDownloadProgress(): Event<UpdateInfo> {
		return Event.fromNodeEventEmitter<UpdateInfo>(autoUpdater, 'download-progress')
	}
	@memoize get onUpdateDownloaded(): Event<UpdateInfo> { 
		return Event.fromNodeEventEmitter(autoUpdater, 'update-downloaded'); 
	}

	constructor(
		@inject('ipcMainServer')
		private readonly ipcMainServer: IpcMainServer,
	) {
		super();
		this.#registerIPCServerChannel();
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

	#registerIPCServerChannel() {
		const serverChannel: IServerChannel = {
			call: (_ctx: string, command, _arg): Promise<any> => {
				switch(command) {
					case UpdateCommands.CHECK_FOR_UPDATES:
						return this.checkForUpdates();
					case UpdateCommands.CHECK_FOR_UPDATES_AND_NOTIFY:
						return this.checkForUpdatesAndNotify();
					default:
						throw new Error(`[UpdateMainService] command: ${command} not found`);
				}
			},
			listen: (_ctx: string, event: string, _arg): Event<any> => {
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
		this.ipcMainServer.registerChannel('updateService', serverChannel);
	}
}
