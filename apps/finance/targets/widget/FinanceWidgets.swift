import AppIntents
import SwiftUI
import WidgetKit

private let addLink = URL(string: "cadence://transaction/new")!

struct Snapshot: Codable {
  var label = "Spent this month"
  var spent = "–"
  var outlook = "Open Finance to update"
}

enum SnapshotStore {
  private static let groupId = "group.com.thenetaji.cadence"

  static func read() -> Snapshot {
    guard let dir = container(),
      let data = try? Data(contentsOf: dir.appendingPathComponent("widget.json")),
      let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data)
    else { return Snapshot() }
    return snapshot
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

struct SpendEntry: TimelineEntry {
  let date: Date
  let snapshot: Snapshot
}

struct SpendProvider: TimelineProvider {
  func placeholder(in context: Context) -> SpendEntry { SpendEntry(date: .now, snapshot: Snapshot()) }

  func getSnapshot(in context: Context, completion: @escaping (SpendEntry) -> Void) {
    completion(SpendEntry(date: .now, snapshot: SnapshotStore.read()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SpendEntry>) -> Void) {
    completion(Timeline(entries: [SpendEntry(date: .now, snapshot: SnapshotStore.read())], policy: .never))
  }
}

struct SpendWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: SpendEntry

  var body: some View {
    switch family {
    case .accessoryRectangular:
      VStack(alignment: .leading) {
        Text(entry.snapshot.label).font(.caption2)
        Text(entry.snapshot.spent).font(.headline).minimumScaleFactor(0.6)
      }
      .widgetURL(addLink)
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        Image(systemName: "plus").font(.title3.weight(.semibold))
      }
      .widgetURL(addLink)
    default:
      VStack(alignment: .leading, spacing: 4) {
        Text(entry.snapshot.label).font(.caption).foregroundStyle(.secondary)
        Text(entry.snapshot.spent)
          .font(.system(.title, design: .rounded).weight(.bold))
          .minimumScaleFactor(0.5)
          .lineLimit(1)
        Text(entry.snapshot.outlook)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(family == .systemSmall ? 2 : 3)
        Spacer(minLength: 0)
        Link(destination: addLink) {
          Label("Add", systemImage: "plus")
            .font(.footnote.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(.quaternary, in: Capsule())
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

struct SpendWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SpendWidget", provider: SpendProvider()) { entry in
      SpendWidgetView(entry: entry).containerBackground(.fill.tertiary, for: .widget)
    }
    .configurationDisplayName("This month")
    .description("What you've spent and what's safe to spend, with a button to add more.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular])
  }
}

@available(iOS 18.0, *)
struct OpenAddIntent: AppIntent {
  static let title: LocalizedStringResource = "Add a transaction"
  static let openAppWhenRun = true

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(addLink))
  }
}

@available(iOS 18.0, *)
struct AddControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "AddControl") {
      ControlWidgetButton(action: OpenAddIntent()) {
        Label("Add transaction", systemImage: "plus")
      }
    }
    .displayName("Add transaction")
    .description("Opens the Add sheet. You can also put this on the Action Button.")
  }
}

@main
struct FinanceWidgets: WidgetBundle {
  var body: some Widget {
    SpendWidget()
    if #available(iOS 18.0, *) {
      AddControl()
    }
  }
}
