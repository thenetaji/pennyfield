package expo.modules.financewidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FinanceWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FinanceWidget")

    Function("update") { json: String ->
      val context = appContext.reactContext ?: return@Function
      FinanceWidgetProvider.save(context, json)
      FinanceWidgetProvider.refresh(context)
    }
  }
}
