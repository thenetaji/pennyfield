import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export type WidgetSnapshot = {
  label: string;
  spent: string;
  outlook: string;
};

type Native = { update(json: string): void };

const native =
  Platform.OS === "web" ? null : requireOptionalNativeModule<Native>("FinanceWidget");

/** Hands the home screen widget its text; amounts are already formatted, so Hide amounts carries over. */
export function updateWidget(snapshot: WidgetSnapshot): void {
  try {
    native?.update(JSON.stringify(snapshot));
  } catch {
    // A widget that doesn't refresh must never get in the way of the app.
  }
}
