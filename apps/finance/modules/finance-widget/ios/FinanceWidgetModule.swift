import ExpoModulesCore
import WidgetKit

public class FinanceWidgetModule: Module {
  private static let groupId = "group.com.thenetaji.cadence"

  public func definition() -> ModuleDefinition {
    Name("FinanceWidget")

    Function("update") { (json: String) in
      guard let dir = FinanceWidgetModule.container() else { return }
      try? json.write(to: dir.appendingPathComponent("widget.json"), atomically: true, encoding: .utf8)
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  // SideStore renames App Groups per team (group.x.TEAMID); the embedded profile lists the real ids.
  private static func container() -> URL? {
    var ids = profileGroups()
    ids += Bundle.main.object(forInfoDictionaryKey: "ALTAppGroups") as? [String] ?? []
    ids.append(groupId)
    for id in ids where id.hasPrefix(groupId) {
      if let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id) { return url }
    }
    return nil
  }

  private static func profileGroups() -> [String] {
    guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
      let data = try? Data(contentsOf: url),
      let text = String(data: data, encoding: .isoLatin1),
      let start = text.range(of: "<?xml"),
      let end = text.range(of: "</plist>", range: start.lowerBound..<text.endIndex),
      let xml = String(text[start.lowerBound..<end.upperBound]).data(using: .isoLatin1),
      let plist = try? PropertyListSerialization.propertyList(from: xml, format: nil) as? [String: Any],
      let entitlements = plist["Entitlements"] as? [String: Any]
    else { return [] }
    return entitlements["com.apple.security.application-groups"] as? [String] ?? []
  }
}
