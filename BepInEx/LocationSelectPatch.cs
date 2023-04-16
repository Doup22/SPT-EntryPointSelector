using Aki.Reflection.Patching;
using Aki.Reflection.Utils;
using Aki.Common.Http;
using EFT;
using EFT.UI.Matchmaker;
using System.Reflection;

namespace EntryPointSelector
{
  public class LocationSelectPatch : ModulePatch
  {

    protected override MethodBase GetTargetMethod()
    {
      var desiredType = typeof(MatchmakerOfflineRaidScreen);
      var desiredMethod = desiredType.GetMethod("Show", PatchConstants.PrivateFlags);

      return desiredMethod;
    }

    [PatchPrefix]
    private static bool PatchPrefix(
      RaidSettings raidSettings
    )
    {
      Logger.LogInfo($"EntryPointSelector {raidSettings?.LocationId}");
      RequestHandler.PostJson("/eps/location", "{\"locationId\": \"" + raidSettings?.LocationId + "\"}");
      return true;
    }
  }
}
