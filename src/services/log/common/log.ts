
import log from 'electron-log';
import { service } from '@electron-tools/ioc';

@service('logService')
export class LogService {
	constructor() {
		if (log.transports.ipc) {
			log.transports.ipc.level = false;
		}
		log.transports.remote.level = false;
	}
	log(...args: any[]): void {
		log.log(...args);
	}
	error(...args: any[]): void {
		log.error(...args);
	}
	warn(...args: any[]): void {
		log.warn(...args);
	}
	info(...args: any[]): void {
		log.info(...args);
	}
	verbose(...args: any[]): void {
		log.verbose(...args);
	}
	debug(...args: any[]): void {
		log.debug(...args);
	}
	silly(...args: any[]): void {
		log.info(...args);
	}
}
