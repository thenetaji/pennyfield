import ExpoModulesCore
import FoundationModels

public class FinanceAIModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FinanceAI")

    AsyncFunction("status") { () async -> String in
      guard #available(iOS 26.0, *) else { return "unavailable" }
      let model = SystemLanguageModel.default
      if case .available = model.availability { return "ready" }
      if case .unavailable(let reason) = model.availability, reason == .modelNotReady {
        return "downloading"
      }
      return "unavailable"
    }

    AsyncFunction("respond") { (prompt: String, instructions: String) async -> String? in
      guard #available(iOS 26.0, *) else { return nil }
      guard case .available = SystemLanguageModel.default.availability else { return nil }
      do {
        let session = LanguageModelSession(instructions: instructions)
        return try await session.respond(to: prompt).content
      } catch {
        return nil
      }
    }
  }
}
