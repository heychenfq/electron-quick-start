
import { contextBridge } from 'electron';
import InstantiationService from '@electron-tools/ioc';
import { ElectronIPCRenderer, SubscribableWithSubscription } from '@electron-tools/ipc';
import './log/common/log';
import './update/preload/update.preload';

export class Application {
	private readonly instantiationService: InstantiationService = new InstantiationService();
	startup(name: string) {
		this.instantiationService.registerService('ipcClient', new ElectronIPCRenderer(name))
		this.instantiationService.init();
		exposeInMainWorld('bridge', {
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
			call: <R>(service: string, method: string, ...args: any[]): R => {
				const serviceInstance = this.instantiationService.getService(service);
				const serviceMethod = serviceInstance[method];
				if (!serviceMethod) {
					throw new Error(`service ${service} has not method ${method}`);
				}
				return serviceMethod.apply(serviceInstance, args);
			},
			on: <T>(service: string, event: string, ...args: any[]): SubscribableWithSubscription<T> => {
				const serviceInstance = this.instantiationService.getService(service);
				const serviceEvent = serviceInstance[event];
				if (!serviceEvent) {
					throw new Error(`service ${service} has not event ${event}`);
				}
				const subject = serviceEvent.apply(serviceInstance, args);
				return {
					subscribe(cb) {
						const subscription = subject.subscribe(cb);
						return {
							unsubscribe: () => {
								subscription.unsubscribe();
							},
						};
					},
				}
			},
		});
	}
}

function exposeInMainWorld(apiKey: string, api: Record<string, any>) {
	try {
		contextBridge.exposeInMainWorld(apiKey, api);
	} catch(e) {
		(window as any)[apiKey] = api;
	}
}
