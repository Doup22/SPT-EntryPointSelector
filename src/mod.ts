/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { InraidCallbacks } from '@spt-aki/callbacks/InraidCallbacks';
import type { LocationController } from '@spt-aki/controllers/LocationController';
import type { ILocationBase, SpawnPointParam } from '@spt-aki/models/eft/common/ILocationBase';
import type { ILocationsGenerateAllResponse } from '@spt-aki/models/eft/common/ILocationsSourceDestinationBase';
import type { IRegisterPlayerRequestData } from '@spt-aki/models/eft/inRaid/IRegisterPlayerRequestData';
import type { IPreAkiLoadMod } from '@spt-aki/models/external/IPreAkiLoadMod';
import type { DependencyContainer } from '@spt-aki/models/external/tsyringe';
import type { ILocations } from '@spt-aki/models/spt/server/ILocations';
import type { ILogger } from '@spt-aki/models/spt/utils/ILogger';
import type { DatabaseServer } from '@spt-aki/servers/DatabaseServer';
import type { DynamicRouterModService } from '@spt-aki/services/mod/dynamicRouter/DynamicRouterModService';
import type { StaticRouterModService } from '@spt-aki/services/mod/staticRouter/StaticRouterModService';
import type { HttpResponseUtil } from '@spt-aki/utils/HttpResponseUtil';
import type { Config, LocationId } from 'electron/src/types';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

function toJSON(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

const dir = resolve(__dirname, '..');
const filepath = resolve(dir, 'log.txt');
let newFile = true;
function _log(logger: ILogger, url: string, info: any, output: string): any {
  if (newFile) {
    writeFileSync(filepath, '');
    newFile = false;
  }
  logger.info('info: ' + JSON.stringify(toJSON(info), null, 2));
  logger.info('data: ' + JSON.stringify(toJSON(output), null, 2));
  let file = readFileSync(filepath, 'utf8');
  file += '\n>>>>>> url: ' + url;
  file += '\ninfo: ' + JSON.stringify(toJSON(info), null, 2);
  file += '\ndata: ' + JSON.stringify(toJSON(output), null, 2);
  writeFileSync(filepath, file);
}

class EntryPointSelector implements IPreAkiLoadMod {

  preAkiLoad(container: DependencyContainer): void {
    const _logger = container.resolve<ILogger>('WinstonLogger');
    const databaseServer = container.resolve<DatabaseServer>('DatabaseServer');
    const staticRouterModService = container.resolve<StaticRouterModService>('StaticRouterModService');
    const dynamicRouterModService = container.resolve<DynamicRouterModService>('DynamicRouterModService');
    const locationController = container.resolve<LocationController>('LocationController');
    const inraidCallbacks = container.resolve<InraidCallbacks>('InraidCallbacks');
    const httpResponse = container.resolve<HttpResponseUtil>('HttpResponseUtil');

    const _setSpawnPointParams = {
      url: '/client/locations',
      action: (_url: string, _info: any, _sessionID: string, _output: string): any => {
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
        return httpResponse.getBody(returnResult);
      }
    };

    staticRouterModService.registerStaticRouter(
      'StaticRoutePeekingAki',
      [
        // _setSpawnPointParams
      ],
      'aki'
    );

    dynamicRouterModService.registerDynamicRouter(
      'DynamicRoutePeekingAki',
      [
        {
          url: '/client/location/getLocalloot',
          action: (url: string, info: IRegisterPlayerRequestData, sessionID: string, _output: string): any => {
            inraidCallbacks.registerPlayer(url, info, sessionID);
            const location = locationController.get(info.locationId);
            try {
              const config: Config = JSON.parse(readFileSync(resolve(dir, 'config', 'config.json'), 'utf8'));
              if (config.disabled) throw new Error();
              let locationId = info.locationId as LocationId;
              if (locationId === 'factory4_night') locationId = 'factory4_day';
              if (!config.maps[locationId]) throw new Error();
              const SpawnPointParams = location.SpawnPointParams.filter(spp => {
                return !spp.Categories.includes('Player') || config.maps[locationId].includes(spp.Id);
              });
              return httpResponse.getBody({
                ...location,
                SpawnPointParams,
              });
            } catch (err) {
              return httpResponse.getBody(location);
            }
          }
        }
      ],
      'aki'
    );

  }
}

module.exports = { mod: new EntryPointSelector() };
