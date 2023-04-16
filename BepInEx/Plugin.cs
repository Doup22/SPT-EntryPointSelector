using BepInEx;

namespace EntryPointSelector
{
  [BepInPlugin("net.usama8800.entry-point-selector", "Entry Point Selector", "1.2.0")]
  public class Plugin : BaseUnityPlugin
  {
    private void Awake()
    {
      new LocationSelectPatch().Enable();
    }
  }
}
