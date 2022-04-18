
import { app } from 'electron';
import ElectronRuntime, { lifecycleService, winService } from '@modern-js/electron-runtime';
import path from 'path';

const runtime = new ElectronRuntime({
	windowsConfig: [{
		name: 'main',
		loadUrl: 'http://localhost:8080',
		addBeforeCloseListener: true,
		options: {
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
				enableRemoteModule: true,
				preload: `${path.resolve(app.getAppPath(), '../output/preload.js')}`
			},
		},
	}],
});

app.whenReady().then(async () => {
	await runtime.init();
	winService.createWindow({ name: 'main' });
});

