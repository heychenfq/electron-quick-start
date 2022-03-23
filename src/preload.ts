
import { ipcRenderer, contextBridge } from 'electron';

exposeInMainWorld('electronAPI', {
	setTitle: (title: string) => ipcRenderer.send('set-title', title),
	appInfo: {
		nodeVersion: process.versions['node'],
		chromeVersion: process.versions['chrome'],
		electronVersion: process.versions['electron'],
	},
});

function exposeInMainWorld(apiKey: string, api: Record<string, any>) {
	try {
		contextBridge.exposeInMainWorld(apiKey, api);
	} catch(e) {
		(window as any)[apiKey] = api;
	}
}
