using EFT;
using EFT.UI.Matchmaker;
using HarmonyLib;
using SPT.Common.Http;
using SPT.Reflection.Patching;
using SPT.Reflection.Utils;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace EntryPointSelector
{
    public class LocationSelectPatch : ModulePatch
    {
        protected override MethodBase GetTargetMethod()
        {
            // Using PublicFlags to access public methods instead of private methods
            var desiredType = typeof(MatchmakerOfflineRaidScreen);
            var desiredMethod = desiredType.GetMethod("Show", BindingFlags.Public | BindingFlags.Instance);

            return desiredMethod;
        }

        [PatchPrefix]
        private static bool PatchPrefix(
          RaidSettings raidSettings
        )
        {
            Logger.LogInfo($"EntryPointSelector {raidSettings?.LocationId}");
            _ = new
            {
                locationId = raidSettings?.LocationId
            };

            RequestHandler.PostJson("/eps/location", "{\"locationId\": \"" + raidSettings?.LocationId + "\"}");

            return true;
        }
    }
}