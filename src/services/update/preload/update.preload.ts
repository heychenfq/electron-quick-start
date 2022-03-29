import { inject, service } from "../../instantiation/common/instantiation";
import { IChannel } from "../../ipc/common/ipc";
import { IPCRendererClient } from "../../ipc/preload/ipc.preload";
import { UpdateCommands, UpdateEvents } from "../common/update";

@service('updateService')
export class UpdateService {
	private readonly channel: IChannel;
	constructor(
		@inject('ipcRendererClient')
		ipcRendererClient: IPCRendererClient,
	) {
		this.channel = ipcRendererClient.getChannel('updateService');
	}

	onCheckingForUpdate() {
		return this.channel.listen<void>(UpdateEvents.CHECKING_FOR_UPDATE);
	}

	checkForUpdates() {
		return this.channel.call(UpdateCommands.CHECK_FOR_UPDATES);
	}

	checkForUpdatesAndNotify() {
		return this.channel.call(UpdateCommands.CHECK_FOR_UPDATES_AND_NOTIFY);
	}
}
