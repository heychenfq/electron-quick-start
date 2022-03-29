


import { app, BrowserWindow, ipcMain }  from 'electron';
import './services/ipc/main/ipc.main';
import './services/update/main/update.main';
import './services/log/common/log';
// must be latest, other service should register first
import { InstantiationService } from './services/instantiation/common/instantiation';

class Application {
	private readonly instantiationService: InstantiationService = new InstantiationService();
	startup() {
		this.instantiationService.init();
		const logService = this.instantiationService.getService('logService');
		logService.log('app started');
	}
}

new Application().startup();

const isDev = !app.isPackaged;
const APP_ROOT = app.getAppPath();

function createWindow () {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      // preload: path.resolve(__dirname, isDev ? '../output/preload.js' : './preload.js'),
			contextIsolation: false,
			nodeIntegration: true,
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

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
});