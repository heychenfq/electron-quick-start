


import { app, BrowserWindow, ipcMain }  from 'electron';
import path from 'path';
import { InstantiationService } from './services/instantiation/common/instantiation';
import { LifecyclePhase } from './services/lifecycle/common/lifecycle';
import { LifecycleMainService } from './services/lifecycle/main/lifecycle.main';
import './services/services.main';

class Application {
	private readonly instantiationService: InstantiationService = new InstantiationService();
	startup() {
		this.instantiationService.init();
		const lifecycleMainService = this.instantiationService.getService<LifecycleMainService>('lifecycleMainService');
		lifecycleMainService.phase = LifecyclePhase.Ready;
	}
}

new Application().startup();

const isDev = !app.isPackaged;
const APP_ROOT = app.getAppPath();

function createWindow () {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.resolve(__dirname, isDev ? '../output/preload.js' : './preload.js'),
    },
  });

  ipcMain.on('set-title', (event, title) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    win!.setTitle(title);
  });

  mainWindow.loadURL(isDev ? 'http://localhost:8080/index.html' : `file://${APP_ROOT}/browser/index.html`);
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  });
});
