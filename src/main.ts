const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

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
  })
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
});