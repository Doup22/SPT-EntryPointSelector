import { app, BrowserWindow, ipcMain } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { Config, LocationId, Locations, Position } from './types';

const configDir = resolve('..', 'config');
const configPath = resolve(configDir, 'config.json');
if (!existsSync(configDir)) {
  mkdirSync(configDir);
}

function getConfig(): Config {
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (error) {
    return {
      onlyOnce: false,
      disabled: false,
      maps: {} as any,
      lastMap: 'bigmap',
    };
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: resolve(__dirname, 'client', 'public', 'preload.js'),
    },
    show: false,
    autoHideMenuBar: true,
  });
  // win.webContents.openDevTools();

  let positionMaps: Locations = {};
  ipcMain.handle('getPositionMaps', () => {
    try {
      positionMaps = JSON.parse(readFileSync(resolve('..', 'data', 'positionMaps.json'), 'utf8'));
      return positionMaps;
    } catch (error) {
      return [];
    }
  });
  ipcMain.handle('getConfig', () => getConfig());
  ipcMain.handle('changeOnlyOnce', (event, checked: boolean) => {
    try {
      const config = getConfig();
      config.onlyOnce = checked;
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      return config;
    } catch (error) { return getConfig(); }
  });
  ipcMain.handle('changeDisabled', (event, checked: boolean) => {
    try {
      const config = getConfig();
      config.disabled = checked;
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      return config;
    } catch (error) { return getConfig(); }
  });
  ipcMain.handle('changeMap', (event, map: LocationId) => {
    try {
      const config = getConfig();
      config.lastMap = map;
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      return config;
    } catch (error) { return getConfig(); }
  });
  ipcMain.handle('setEntryPoint', (event, map: string, position: Position) => {
    const positionMapped = positionMaps[map].find(p => p.pixel.x === position.x && p.pixel.y === position.y);
    try {
      const config = getConfig();
      if (positionMapped) config.maps[map as LocationId] = positionMapped.locations.map(x => x.id);
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      return config;
    } catch (error) { return getConfig(); }
  });

  win.loadFile(resolve(__dirname, 'client', 'index.html'));
  win.maximize();
  win.show();
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
