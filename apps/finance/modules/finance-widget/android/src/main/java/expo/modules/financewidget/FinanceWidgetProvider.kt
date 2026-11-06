package expo.modules.financewidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONObject

class FinanceWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { manager.updateAppWidget(it, views(context)) }
  }

  companion object {
    private const val PREFS = "finance_widget"
    private const val KEY = "snapshot"
    private const val ADD_LINK = "cadence://transaction/new"

    fun save(context: Context, json: String) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply()
    }

    fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, FinanceWidgetProvider::class.java))
      ids.forEach { manager.updateAppWidget(it, views(context)) }
    }

    private fun views(context: Context): RemoteViews {
      val saved = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
      val snapshot = runCatching { JSONObject(saved ?: "{}") }.getOrDefault(JSONObject())
      val views = RemoteViews(context.packageName, R.layout.finance_widget)
      views.setTextViewText(R.id.finance_widget_label, snapshot.optString("label", "Spent this month"))
      views.setTextViewText(R.id.finance_widget_spent, snapshot.optString("spent", "–"))
      views.setTextViewText(R.id.finance_widget_outlook, snapshot.optString("outlook", "Open Finance to update"))
      val add = Intent(Intent.ACTION_VIEW, Uri.parse(ADD_LINK)).setPackage(context.packageName)
      views.setOnClickPendingIntent(
        R.id.finance_widget_add,
        PendingIntent.getActivity(context, 0, add, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
      )
      return views
    }
  }
}
