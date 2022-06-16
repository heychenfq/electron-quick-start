import { UpdateInfo } from "electron-updater";
import { inject, service } from "@electron-tools/ioc";
import { ElectronIPCRenderer, ClientChannel } from '@electron-tools/ipc';
import { UpdateCommands, UpdateEvents } from "../common/update";

@service('updateService')
export class UpdateService {
	private readonly channel: ClientChannel;
	constructor(
		@inject('ipcClient')
		ipcClient: ElectronIPCRenderer,
	) {
		this.channel = ipcClient.getChannel('update');
	}

	onError() {
		return this.channel.event<Error>(UpdateEvents.ERROR);
	}

	onCheckingForUpdate() {
		return this.channel.event<void>(UpdateEvents.CHECKING_FOR_UPDATE);
	}

	onUpdateAvailable() {
		return this.channel.event<UpdateInfo>(UpdateEvents.UPDATE_AVAILABLE);
	}

	onUpdateNotAvailable() {
		return this.channel.event<UpdateInfo>(UpdateEvents.UPDATE_NOT_AVAILABLE);
	}

	onDownloadProgress() {
		return this.channel.event<UpdateInfo>(UpdateEvents.DOWNLOAD_PROGRESS);
	}

	onUpdateDownloaded() {
		return this.channel.event<UpdateInfo>(UpdateEvents.UPDATE_DOWNLOADED);
	}

	checkForUpdates() {
		return this.channel.invoke(UpdateCommands.CHECK_FOR_UPDATES);
	}

	checkForUpdatesAndNotify() {
		return this.channel.invoke(UpdateCommands.CHECK_FOR_UPDATES_AND_NOTIFY);
	}
}
