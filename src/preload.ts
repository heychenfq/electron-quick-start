
import { ipcRenderer, contextBridge } from 'electron';
import './services/ipc/preload/ipc.preload';
import './services/update/preload/update.preload';
import { InstantiationService } from './services/instantiation/common/instantiation';

class Application {
	private readonly instantiationService: InstantiationService = new InstantiationService();
	startup() {
		this.instantiationService.init();
		exposeInMainWorld('nativeHost', {
			setTitle: (title: string) => ipcRenderer.send('set-title', title),
			appInfo: {
				nodeVersion: process.versions['node'],
				chromeVersion: process.versions['chrome'],
				electronVersion: process.versions['electron'],
			},
			call: <R>(service: string, method: string, ...args: any): R => {
				const serviceInstance = this.instantiationService.getService(service);
				const serviceMethod = serviceInstance[method]
				if (!serviceMethod) {
					throw new Error(`service ${service} has not method ${method}`);
				}
				return serviceMethod.apply(serviceInstance, args);
			}
		});
	}
}

new Application().startup();

function exposeInMainWorld(apiKey: string, api: Record<string, any>) {
	try {
		contextBridge.exposeInMainWorld(apiKey, api);
	} catch(e) {
		(window as any)[apiKey] = api;
	}
}
