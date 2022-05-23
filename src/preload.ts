
import { contextBridge } from 'electron';
import InstantiationService from '@electron-tools/ioc';
import { Event } from './core/base/event';
import './services/services.sandbox';
import { UpdateService } from './services/update/sandbox/update.sandbox';

class Application {
	private readonly instantiationService: InstantiationService = new InstantiationService();
	startup() {
		this.instantiationService.init();
		exposeInMainWorld('nativeHost', {
			process: {
				platform: process.platform,
				arch: process.arch,
				versions: {
					electron: process.versions.electron,
					node: process.versions.node,
					chrome: process.versions.chrome,
				},
				type: process.type,
				cwd: () => process.cwd(),
			},
			updateService: this.instantiationService.getService<UpdateService>('updateService'),
			call: <R>(service: string, method: string, ...args: any[]): R => {
				const serviceInstance = this.instantiationService.getService(service);
				const serviceMethod = serviceInstance[method];
				if (!serviceMethod) {
					throw new Error(`service ${service} has not method ${method}`);
				}
				return serviceMethod.apply(serviceInstance, args);
			},
			on: <T>(service: string, event: string, ...args: any[]): Event<T> => {
				const serviceInstance = this.instantiationService.getService(service);
				const serviceEvent = serviceInstance[event];
				if (!serviceEvent) {
					throw new Error(`service ${service} has not event ${event}`);
				}
				return serviceEvent.apply(serviceInstance, args);
			},
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
