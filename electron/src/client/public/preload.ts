import { contextBridge, ipcRenderer } from 'electron';
import { Config, LocationId, Locations, Position } from '../../types';

declare global {
  interface Window {
    electron: {
      getPositionMaps: () => Promise<Locations>;
      changeOnlyOnce: (checked: boolean) => void;
      changeDisabled: (checked: boolean) => void;
      getConfig: () => Promise<Config>;
      setEntryPoint: (map: LocationId, position: Position) => void;
    },
  }
}

window.electron = window.electron || {};

contextBridge.exposeInMainWorld('electron', {
  getPositionMaps: () => ipcRenderer.invoke('getPositionMaps'),
  changeOnlyOnce: (checked: boolean) => ipcRenderer.send('changeOnlyOnce', checked),
  changeDisabled: (checked: boolean) => ipcRenderer.send('changeDisabled', checked),
  getConfig: () => ipcRenderer.invoke('getConfig'),
  setEntryPoint: (map: LocationId, position: Position) => ipcRenderer.send('setEntryPoint', map, position),
});
