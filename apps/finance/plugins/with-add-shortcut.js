// Lets Siri, Shortcuts and the Action Button open the Add sheet. App Shortcuts must live in the app's own target,
// where Xcode extracts their metadata, so the code goes into AppDelegate.swift.
const { withAppDelegate } = require("expo/config-plugins");

const INTENT = `

@available(iOS 16.0, *)
struct AddTransactionIntent: AppIntent {
  static let title: LocalizedStringResource = "Add a transaction"
  static let openAppWhenRun = true

  @MainActor
  func perform() async throws -> some IntentResult {
    await UIApplication.shared.open(URL(string: "cadence://transaction/new")!)
    return .result()
  }
}

@available(iOS 16.4, *)
struct FinanceShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddTransactionIntent(),
      phrases: ["Add a transaction in \\(.applicationName)", "Add spending to \\(.applicationName)"],
      shortTitle: "Add transaction",
      systemImageName: "plus"
    )
  }
}
`;

module.exports = (config) =>
  withAppDelegate(config, (mod) => {
    if (mod.modResults.contents.includes("AddTransactionIntent")) return mod;
    mod.modResults.contents = `import AppIntents\n${mod.modResults.contents}${INTENT}`;
    return mod;
  });
