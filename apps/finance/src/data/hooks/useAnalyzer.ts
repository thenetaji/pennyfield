import type { PeriodSettings } from "@studio/dates";
import { useLiveData } from "@/data/use-live-data";
import { readAnalyzer, type Analyzer } from "./analyzer";
import { useTodayKey } from "./useTodayKey";

export type {
  Analyzer,
  AnalyzerRepeat,
  AnalyzerUnusual,
} from "./analyzer";

/** This month's forecast, unusual categories, spending patterns and repeat payments. */
export function useAnalyzer(settings: PeriodSettings): Analyzer {
  const today = useTodayKey();
  return useLiveData(
    [
      "transactions",
      "transaction_splits",
      "categories",
      "recurring_rules",
      "fx_rates",
      "settings",
    ],
    `${today}:${settings.weekStart}:${settings.monthStart}`,
    (db) => readAnalyzer(db, today, settings),
  );
}
