import InstantiationService from '@electron-tools/ioc';
import { ElectronIPCMain } from '@electron-tools/ipc';
import './log/common/log';
import './update/main/update.main';

export class Application {
	private readonly instantiationService: InstantiationService = new InstantiationService();
	startup() {
		this.instantiationService.registerService('ipcMain', new ElectronIPCMain())
		this.instantiationService.init();
	}
}
