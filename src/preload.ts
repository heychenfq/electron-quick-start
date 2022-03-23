
import { ipcRenderer, contextBridge } from 'electron';

exposeInMainWorld('electronAPI', {
	setTitle: (title: string) => ipcRenderer.send('set-title', title),
});

function exposeInMainWorld(apiKey: string, api: Record<string, any>) {
	try {
		contextBridge.exposeInMainWorld('electronAPI', {
			setTitle: (title: string) => ipcRenderer.send('set-title', title),
		});
	} catch(e) {
		(window as any)[apiKey] = api;
	}
}
