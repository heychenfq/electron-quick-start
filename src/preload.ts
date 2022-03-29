
import { contextBridge } from 'electron';
import './services/ipc/sandbox/ipc.sandbox';
import './services/update/sandbox/update.sandbox';
import './services/log/common/log';
import { InstantiationService } from './services/instantiation/common/instantiation';
import { Event } from './core/base/event';

class Application {
	private readonly instantiationService: InstantiationService = new InstantiationService();
	startup() {
		this.instantiationService.init();
		exposeInMainWorld('nativeHost', {
			process: {
				platform: process.platform,
				arch: process.arch,
				env: process.env,
				versions: {
					electron: process.versions.electron,
					node: process.versions.node,
					chrome: process.versions.chrome,
				},
				type: process.type,
				cwd: () => process.cwd(),
			},
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
