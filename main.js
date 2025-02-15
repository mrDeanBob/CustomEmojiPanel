const { app, BrowserWindow } = require('electron');
const path = require('path');
const chokidar = require('chokidar');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // For simplicity in this example, we'll enable Node integration.
      // (For production apps, consider using preload.js and contextIsolation.)
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  win.loadFile('index.html');

  // Watch the "./img" directory (and its subdirectories)
  const watcher = chokidar.watch(path.join(__dirname, 'img'), {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true
  });

  watcher.on('all', (event, filePath) => {
    console.log(`File ${filePath} changed (${event})`);
    // Send a message to the renderer process to update the HTML.
    win.webContents.send('folder-changed', { event, filePath });
  });
}

app.whenReady().then(createWindow);
