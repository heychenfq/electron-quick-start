import { UpdateInfo } from "electron-updater";
import { inject, service } from "../../instantiation/common/instantiation";
import { IChannel } from "../../ipc/common/ipc";
import { IPCRendererClient } from "../../ipc/sandbox/ipc.sandbox";
import { UpdateCommands, UpdateEvents } from "../common/update";

@service('updateService')
export class UpdateService {
	private readonly channel: IChannel;
	constructor(
		@inject('ipcRendererClient')
		ipcRendererClient: IPCRendererClient,
	) {
		this.channel = ipcRendererClient.getChannel('update');
	}

	onError() {
		return this.channel.listen<Error>(UpdateEvents.ERROR);
	}

	onCheckingForUpdate() {
		return this.channel.listen<void>(UpdateEvents.CHECKING_FOR_UPDATE);
	}

	onUpdateAvailable() {
		return this.channel.listen<UpdateInfo>(UpdateEvents.UPDATE_AVAILABLE);
	}

	onUpdateNotAvailable() {
		return this.channel.listen<UpdateInfo>(UpdateEvents.UPDATE_NOT_AVAILABLE);
	}

	onDownloadProgress() {
		return this.channel.listen<UpdateInfo>(UpdateEvents.DOWNLOAD_PROGRESS);
	}

	onUpdateDownloaded() {
		return this.channel.listen<UpdateInfo>(UpdateEvents.UPDATE_DOWNLOADED);
	}

	checkForUpdates() {
		return this.channel.call(UpdateCommands.CHECK_FOR_UPDATES);
	}

	checkForUpdatesAndNotify() {
		return this.channel.call(UpdateCommands.CHECK_FOR_UPDATES_AND_NOTIFY);
	}
}
