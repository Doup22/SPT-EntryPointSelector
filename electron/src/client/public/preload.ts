import { contextBridge, ipcRenderer } from 'electron';
import { Config, LocationId, Locations, Position } from '../../types';

declare global {
  interface Window {
    electron: {
      getPositionMaps: () => Promise<Locations>;
      changeOnlyOnce: (checked: boolean) => Promise<Config>;
      changeDisabled: (checked: boolean) => Promise<Config>;
      changeMap: (map: LocationId) => Promise<Config>;
      addEntryPoint: (map: LocationId, position: Position) => Promise<Config>;
      removeEntryPoint: (map: LocationId, position: Position) => Promise<Config>;
      getConfig: () => Promise<Config>;
    },
  }
}

window.electron = window.electron || {};

contextBridge.exposeInMainWorld('electron', {
  getPositionMaps: () => ipcRenderer.invoke('getPositionMaps'),
  changeOnlyOnce: (checked: boolean) => ipcRenderer.invoke('changeOnlyOnce', checked),
  changeDisabled: (checked: boolean) => ipcRenderer.invoke('changeDisabled', checked),
  changeMap: (map: LocationId) => ipcRenderer.invoke('changeMap', map),
  addEntryPoint: (map: LocationId, position: Position) => ipcRenderer.invoke('addEntryPoint', map, position),
  removeEntryPoint: (map: LocationId, position: Position) => ipcRenderer.invoke('removeEntryPoint', map, position),
  getConfig: () => ipcRenderer.invoke('getConfig'),
});
