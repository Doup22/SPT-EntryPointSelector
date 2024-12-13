import type { DependencyContainer } from "tsyringe";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ILocationBase, ISpawnPointParam } from "@spt/models/eft/common/ILocationBase";
import type { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import type { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { WTTInstanceManager } from "./WTTInstanceManager";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import type { ILocation } from "@spt/models/eft/common/ILocation";
import type { IStartLocalRaidRequestData } from "@spt/models/eft/match/IStartLocalRaidRequestData";
import type { IStartLocalRaidResponseData } from "@spt/models/eft/match/IStartLocalRaidResponseData";

interface Config {
    autoOpen: boolean;
    disabled: boolean;
    maps: {
        [mapName: string]: string[]; // Map name as key and an array of string (UUIDs) as value
    };
    onlyOnce: boolean;
    lastMap: string;
}

interface EPSLocationInfo {
    locationId: string;
}

class EntryPointSelector implements IPreSptLoadMod, IPostDBLoadMod {
    private instanceManager: WTTInstanceManager = new WTTInstanceManager();
    debug = false;
    modName = "EntryPointSelector";
    private timeout?: NodeJS.Timeout;
    public configFilePath;

    public preSptLoad(container: DependencyContainer): void {
        this.instanceManager.preSptLoad(container, this.modName);
        this.instanceManager.debug = this.debug;
        this.configFilePath = this.initializeConfig();
        this.setupRoutes();
        if (this.debug) {
            this.instanceManager.logger.log(`${this.modName} Initialization Complete`, LogTextColor.GREEN);
        }
    }
    public postDBLoad(container: DependencyContainer): void {
        this.instanceManager.postDBLoad(container);
    }
    public setupRoutes(): void {
        // opens EPS on Raid Menu
        const openEPSOnRaid = {
            url: "/singleplayer/settings/raid/menu",
            action: (): Promise<ReturnType<typeof this.instanceManager.inraidCallbacks.getRaidMenuSettings>> => {
                if (this.debug) {
                    this.instanceManager.logger.log("Opening EPS on Raid Menu", LogTextColor.GREEN);
                }

                this.timeout = setTimeout(() => {
                    const exePath = resolve(__dirname, "..", "client", "EntryPointSelector.exe");
                    execFile(exePath, { cwd: resolve(__dirname, "..", "client") });
                    if (this.debug) {
                        this.instanceManager.logger.log("Executed EntryPointSelector.exe", LogTextColor.GREEN);
                    }
                }, 500);

                const result = this.instanceManager.inraidCallbacks.getRaidMenuSettings();
                return Promise.resolve(result); // Wrap the synchronous result in a promise
            },
        };
        // opens EPS on Location
        const openEPSOnLocation = {
            url: "/eps/location",
            action: async (_url: string, info: EPSLocationInfo): Promise<ReturnType<typeof this.instanceManager.httpResponseUtil.getBody>> => {
                clearTimeout(this.timeout);
                if (this.debug) {
                    this.instanceManager.logger.log("Processing /eps/location", LogTextColor.GREEN);
                }

                const config = JSON.parse(readFileSync(this.configFilePath, "utf8"));
                if (config.autoOpen) {
                    config.lastMap = info.locationId;
                    writeFileSync(this.configFilePath, JSON.stringify(config, null, 2));

                    const exePath = resolve(__dirname, "..", "client", "EntryPointSelector.exe");
                    execFile(exePath, { cwd: resolve(__dirname, "..", "client") });
                    if (this.debug) {
                        this.instanceManager.logger.log("Executed EntryPointSelector.exe on Location", LogTextColor.GREEN);
                    }
                }

                // Return an empty success response
                return Promise.resolve(this.instanceManager.httpResponseUtil.getBody({ success: true }));
            }

        };
        // intercepts the request to start a local raid, generates the location data, and returns it with filtered spawnpoints
        const main = {
            url: "/client/match/local/start",
            action: async (
                url: string,
                info: IStartLocalRaidRequestData,
                sessionId: string,
                output: string
            ): Promise<ReturnType<typeof this.instanceManager.httpResponseUtil.getBody>> => {
                try {
                    if (this.debug) {
                        this.instanceManager.logger.log(
                            `Processing /client/match/local/start | SessionID: ${sessionId}`,
                            LogTextColor.GREEN
                        );
                        this.instanceManager.logger.log(
                            `info: ${JSON.stringify(info, null, 2)}`,
                            LogTextColor.YELLOW
                        );
                        this.instanceManager.logger.log(
                            `output: ${typeof output}, constructor: ${output.constructor.name}`,
                            LogTextColor.YELLOW
                        );
                    }
        
                    let parsedOutput;
                    try {
                        parsedOutput = JSON.parse(output);
                        if (this.debug) {
                            this.instanceManager.logger.log(
                                `Parsed output: ${JSON.stringify(parsedOutput, null, 2)}`,
                                LogTextColor.YELLOW
                            );
                        }
                    } catch (parseError) {
                        if (this.debug) {
                            this.instanceManager.logger.log(
                                `Failed to parse output: ${parseError.message}`,
                                LogTextColor.RED
                            );
                        }
                        throw new Error("Invalid JSON string in output");
                    }
        
                    if (!info || !info.location) {
                        throw new Error("Invalid info object: location is undefined");
                    }
        
                    if (!parsedOutput?.data) {
                        throw new Error("output.data is undefined");
                    }
        
                    const raidResult = parsedOutput.data as IStartLocalRaidResponseData;
        
                    if (this.debug) {
                        this.instanceManager.logger.log(
                            `Extracted raidResult: ${JSON.stringify(raidResult, null, 2)}`,
                            LogTextColor.YELLOW
                        );
                    }
        
                    if (!raidResult || typeof raidResult !== "object") {
                        throw new Error("Invalid raidResult: Not an object or undefined");
                    }
        
                    if (!raidResult.locationLoot) {
                        if (this.debug) {
                            this.instanceManager.logger.log(
                                "raidResult.locationLoot is undefined, initializing default value",
                                LogTextColor.RED
                            );
                        }
                    }
        
                    const filteredSpawnPointParams = this.filterSpawnPointsForLocation(info.location);
                    if (this.debug) {
                        this.instanceManager.logger.log(
                            `Filtered spawn points: ${JSON.stringify(filteredSpawnPointParams, null, 2)}`,
                            LogTextColor.YELLOW
                        );
                    }
        
                    raidResult.locationLoot.SpawnPointParams = filteredSpawnPointParams;
        
                    return this.instanceManager.httpResponseUtil.getBody(raidResult);
                } catch (error) {
                    if (this.debug) {
                        this.instanceManager.logger.log(
                            `Error occurred: ${error.message}\nStack: ${error.stack}`,
                            LogTextColor.RED
                        );
                    }
                    return this.instanceManager.httpResponseUtil.getBody({
                        error: "An error occurred while processing the request",
                    });
                }
            },
        };

        this.instanceManager.staticRouter.registerStaticRouter(
            "StaticRoutePeekingSpt",
            [openEPSOnRaid, openEPSOnLocation, main],
            "aki"
        );
    }
    public filterSpawnPointsForLocation(locationId: string): ISpawnPointParam[] {
        if (this.debug) {
            this.instanceManager.logger.log(
                `Filtering spawn points for location with ID: '${locationId}'...`,
                LogTextColor.YELLOW
            );
        }

        let locationIdToLower = locationId.toLowerCase();
        const locationOverrides: Record<string, string> = {
            "factory4_night": "factory4_day",
        };

        locationIdToLower = locationOverrides[locationIdToLower] || locationIdToLower;


        const location: ILocation = this.instanceManager.database.locations[locationIdToLower];

        // Check if the location exists in the database
        if (!location) {
            this.instanceManager.logger.log(
                `Location with ID '${locationIdToLower}' not found in the database.`,
                LogTextColor.RED
            );
            return null;
        }

        if (this.debug) {
            // Log the spawn points before filtering
            this.instanceManager.logger.log(
                `Location '${locationIdToLower}' has ${location.base.SpawnPointParams.length} total spawn points before filtering.`,
                LogTextColor.YELLOW
            );
        }

        // Read and parse the config
        let config: Config;
        try {
            config = JSON.parse(readFileSync(this.configFilePath, "utf8"));
        } catch (error) {
            this.instanceManager.logger.log(
                `Error reading or parsing config file: ${error.message}`,
                LogTextColor.RED
            );
            return null;
        }

        // Check if the config is disabled
        if (config.disabled) {
            this.instanceManager.logger.log(
                "Configuration is disabled, cannot filter spawn points.",
                LogTextColor.RED
            );
            return null;
        }

        // Filter the spawn points based on the categories and config
        const filteredSpawnPointParams = location.base.SpawnPointParams.filter((spp: ISpawnPointParam) =>
            !spp.Categories.includes("Player") || config.maps[locationId]?.includes(spp.Id)
        );

        if (this.debug) {
            // Log how many spawn points passed the filter and if any were excluded
            this.instanceManager.logger.log(
                `Filtered ${filteredSpawnPointParams.length} spawn points for location '${locationId}'.`,
                LogTextColor.GREEN
            );
        }

        if (this.debug) {
            // Log how many spawn points were excluded
            const excludedCount = location.base.SpawnPointParams.length - filteredSpawnPointParams.length;
            if (excludedCount > 0) {
                this.instanceManager.logger.log(
                    `${excludedCount} spawn points were excluded based on the configuration.`,
                    LogTextColor.YELLOW
                );
            }
        }

        // If the "onlyOnce" config option is set, clear the spawns for this location
        if (config.onlyOnce) {
            config.maps[locationId] = [];
            writeFileSync(this.configFilePath, JSON.stringify(config, null, 2));
            if (this.debug) {
                this.instanceManager.logger.log(
                    `Cleared spawns for location '${locationId}' as 'onlyOnce' is enabled.`,
                    LogTextColor.GREEN
                );
            }
        }
        // Return the filtered spawn points as the result
        return filteredSpawnPointParams;
    }
    private initializeConfig(): string {
        const dir = resolve(__dirname, "..");
        const configFilePath = resolve(dir, "config", "config.json");

        if (!existsSync(configFilePath)) {
            if (!existsSync(resolve(dir, "config"))) {
                mkdirSync(resolve(dir, "config"));
            }
            writeFileSync(
                configFilePath,
                JSON.stringify({
                    autoOpen: true,
                    disabled: false,
                    lastMap: "bigmap",
                    maps: {},
                    onlyOnce: false,
                }, null, 2)
            );
            if (this.debug) {
                this.instanceManager.logger.log("Config Initialized", LogTextColor.GREEN);
            }
        } else {
            const config = JSON.parse(readFileSync(configFilePath, "utf8"));
            if (!config.maps || Object.keys(config.maps).length === 0) {
                config.maps = {};
                writeFileSync(configFilePath, JSON.stringify(config, null, 2));
            }
        }

        return configFilePath;
    }

}

module.exports = { mod: new EntryPointSelector() };
