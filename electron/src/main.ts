/* eslint-disable no-empty */
import { app, BrowserWindow, ipcMain } from 'electron';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { Config, LocationId, Locations, Position } from './types';

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: resolve('client', 'public', 'preload.js'),
    },
    show: false,
  });

  let positionMaps: Locations = {};
  ipcMain.handle('getPositionMaps', () => {
    try {
      positionMaps = JSON.parse(readFileSync(resolve('..', 'data', 'positionMaps.json'), 'utf8'));
      return positionMaps;
    } catch (error) {
      return [];
    }
  });
  ipcMain.handle('getConfig', () => {
    try {
      return JSON.parse(readFileSync(resolve('..', 'config', 'config.json'), 'utf8'));
    } catch (error) {
      return {
        onlyOnce: false,
        disabled: false,
        maps: {},
      };
    }
  });
  ipcMain.on('changeOnlyOnce', (event, checked: boolean) => {
    try {
      const config = JSON.parse(readFileSync(resolve('..', 'config', 'config.json'), 'utf8'));
      config.onlyOnce = checked;
      writeFileSync(resolve('..', 'config', 'config.json'), JSON.stringify(config, null, 2));
    } catch (error) { }
  });
  ipcMain.on('changeDisabled', (event, checked: boolean) => {
    try {
      const config = JSON.parse(readFileSync(resolve('..', 'config', 'config.json'), 'utf8'));
      config.disabled = checked;
      writeFileSync(resolve('..', 'config', 'config.json'), JSON.stringify(config, null, 2));
    } catch (error) { }
  });
  ipcMain.on('setEntryPoint', (event, map: string, position: Position) => {
    try {
      const config: Config = JSON.parse(readFileSync(resolve('..', 'config', 'config.json'), 'utf8'));
      const positionMapped = positionMaps[map].find(p => p.pixel.x === position.x && p.pixel.y === position.y);
      if (positionMapped) config.maps[map as LocationId] = positionMapped.locations.map(x => x.id);
      writeFileSync(resolve('..', 'config', 'config.json'), JSON.stringify(config, null, 2));
    } catch (error) { }
  });

  win.loadFile(resolve('dist', 'client', 'index.html'));
  win.maximize();
  win.show();
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
