/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { InraidCallbacks } from '@spt/callbacks/InraidCallbacks';
import type { LocationController } from '@spt/controllers/LocationController';
import type { ILocationBase, SpawnPointParam } from '@spt/models/eft/common/ILocationBase';
import type { ILocationsGenerateAllResponse } from '@spt/models/eft/common/ILocationsSourceDestinationBase';
import type { IRegisterPlayerRequestData } from '@spt/models/eft/inRaid/IRegisterPlayerRequestData';
import type { ISptLoadMod } from '@spt/models/external/IPreSptLoadMod';
import type { DependencyContainer } from '@spt/models/external/tsyringe';
import type { ILocations } from '@spt/models/spt/server/ILocations';
import type { ILogger } from '@spt/models/spt/utils/ILogger';
import type { DatabaseServer } from '@spt/servers/DatabaseServer';
import type { DynamicRouterModService } from '@spt/services/mod/dynamicRouter/DynamicRouterModService';
import type { StaticRouterModService } from '@spt/services/mod/staticRouter/StaticRouterModService';
import type { HttpResponseUtil } from '@spt/utils/HttpResponseUtil';
import { execFile } from 'child_process';
import type { Config, LocationId } from 'electron/src/types';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

function toJSON(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

const dir = resolve(__dirname, '..');
const configFilepath = resolve(dir, 'config', 'config.json');

if (!existsSync(configFilepath)) {
  if (!existsSync(resolve(dir, 'config'))) {
    mkdirSync(resolve(dir, 'config'));
  }
  writeFileSync(configFilepath, JSON.stringify({
    autoOpen: true,
    disabled: false,
    lastMap: 'bigmap',
    maps: {},
    onlyOnce: false,
  }, null, 2));
} else {
  const config = JSON.parse(readFileSync(configFilepath, 'utf8'));
  if (config.maps?.length === 0) {
    config.maps = {};
    writeFileSync(configFilepath, JSON.stringify(config, null, 2));
  }
}

const logFilepath = resolve(dir, 'log.log');
let newFile = true;
function log(logger: ILogger, url: string, info: any, output: string): any {
  if (newFile) {
    writeFileSync(logFilepath, '');
    newFile = false;
  }
  logger.info('info: ' + JSON.stringify(toJSON(info), null, 2));
  logger.info('data: ' + JSON.stringify(toJSON(output), null, 2));
  let file = readFileSync(logFilepath, 'utf8');
  file += '\n>>>>>> url: ' + url;
  file += '\ninfo: ' + JSON.stringify(toJSON(info), null, 2);
  file += '\ndata: ' + JSON.stringify(toJSON(output), null, 2);
  writeFileSync(logFilepath, file);
}

class EntryPointSelector implements ISptLoadMod {

  timeout: any;

  SptLoad(container: DependencyContainer): void {
    const logger = container.resolve<ILogger>('WinstonLogger');
    const databaseServer = container.resolve<DatabaseServer>('DatabaseServer');
    const staticRouterModService = container.resolve<StaticRouterModService>('StaticRouterModService');
    const dynamicRouterModService = container.resolve<DynamicRouterModService>('DynamicRouterModService');
    const locationController = container.resolve<LocationController>('LocationController');
    const inraidCallbacks = container.resolve<InraidCallbacks>('InraidCallbacks');
    const httsponse = container.resolve<HttsponseUtil>('HttsponseUtil');

    const setSpawnPointParams = {
      url: '/client/locations',
      action: (_url: string, _info: any, _sessionID: string, output: string): any => {
        const locations = databaseServer.getTables().locations;
        const returnResult: ILocationsGenerateAllResponse = {
          locations: undefined as any,
          paths: []
        };
        const spawnPointParams: { [key: string]: SpawnPointParam[] } = {};
        const data: ILocations = {};
        for (const name in locations) {
          if (name === 'base') {
            continue;
          }

          const map: ILocationBase = (locations as any)[name].base;
          spawnPointParams[map.Id] = map.SpawnPointParams.filter(x => x.Categories.includes('Player'));

          map.Loot = [];
          (data as any)[map._Id] = map;
        }
        writeFileSync(resolve(dir, 'data', 'spawnPointParams.json'), JSON.stringify(spawnPointParams, null, 2));

        returnResult.locations = data;
        returnResult.paths = (locations as any).base.paths;
        return httsponse.getBody(returnResult);
      }
    };
    const openEPSOnRaid = {
      url: '/singleplayer/settings/raid/menu',
      action: (_url: string, _info: any, _sessionID: string, output: string): any => {
        this.timeout = setTimeout(() => {
          console.log('Timeout');
          execFile(resolve(__dirname, '..', 'client', 'EntryPointSelector.exe'), {
            cwd: resolve(__dirname, '..', 'client')
          });
        }, 500);
        return inraidCallbacks.getRaidMenuSettings();
      }
    };
    const openEPSOnLocation = {
      url: '/eps/location',
      action: (_url: string, info: { locationId: string }, _sessionID: string, output: string): any => {
        clearTimeout(this.timeout);
        const config: Config = JSON.parse(readFileSync(configFilepath, 'utf8'));
        if (config.autoOpen) {
          config.lastMap = info.locationId as LocationId;
          writeFileSync(configFilepath, JSON.stringify(config, null, 2));
          execFile(resolve(__dirname, '..', 'client', 'EntryPointSelector.exe'), {
            cwd: resolve(__dirname, '..', 'client')
          });
        }
        return '';
      }
    };
    const main = {
      url: '/client/location/getLocalloot',
      action: (url: string, info: IRegisterPlayerRequestData, sessionID: string, output: string): any => {
        log(logger, url, info, output);
        inraidCallbacks.registerPlayer(url, info, sessionID);
        const location = locationController.get(sessionID, info);
        try {
          const config: Config = JSON.parse(readFileSync(configFilepath, 'utf8'));
          if (config.disabled) throw new Error();
          let locationId = info.locationId as LocationId;
          if (locationId === 'factory4_night') locationId = 'factory4_day';
          if (!config.maps[locationId]?.length) throw new Error();
          const SpawnPointParams = location.SpawnPointParams.filter(spp => {
            return !spp.Categories.includes('Player') || config.maps[locationId].includes(spp.Id);
          });
          if (config.onlyOnce) {
            config.maps[locationId] = [];
            writeFileSync(configFilepath, JSON.stringify(config, null, 2));
          }
          return httsponse.getBody({
            ...location,
            SpawnPointParams,
          });
        } catch (err) {
          return httsponse.getBody(location);
        }
      }
    };

    staticRouterModService.registerStaticRouter(
      'StaticRoutePeekingSpt',
      [
        // setSpawnPointParams,
        openEPSOnRaid,
        openEPSOnLocation,
      ],
      'Spt'
    );
    dynamicRouterModService.registerDynamicRouter(
      'DynamicRoutePeekingSpt',
      [
        main,
      ],
      'Spt'
    );

  }
}

module.exports = { mod: new EntryPointSelector() };
