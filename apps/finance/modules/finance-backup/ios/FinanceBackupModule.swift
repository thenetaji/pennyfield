import ExpoModulesCore

public class FinanceBackupModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FinanceBackup")

    Function("saveFolder") { (uri: String) -> Bool in
      BackupFolder.save(uri)
    }

    Function("clearFolder") {
      BackupFolder.clear()
    }

    AsyncFunction("write") { (name: String, text: String) async -> Bool in
      await BackupFolder.write(name, text)
    }

    AsyncFunction("list") { () async -> [String] in
      await BackupFolder.list()
    }

    AsyncFunction("head") { (name: String, bytes: Int) async -> String? in
      await BackupFolder.head(name, bytes)
    }

    AsyncFunction("remove") { (name: String) async -> Bool in
      await BackupFolder.delete(name)
    }
  }
}
