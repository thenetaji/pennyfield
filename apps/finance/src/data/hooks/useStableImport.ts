import { useCallback } from "react";

import { useActions } from "@/data/actions";
import { useDb } from "@/db/context";
import { investmentCurrency, listAllInvestments } from "@/db/repos/investments";
import {
  STABLE_PLATFORM,
  parseStableReports,
  toInvestmentPlan,
} from "@/lib/investments/stable-import";
import { minorDigits } from "@studio/money";

export interface StableImportResult {
  create: number;
  update: number;
  skipped: string[];
}

export function useStableImport(): (sheets: string[][][][]) => StableImportResult {
  const db = useDb();
  const actions = useActions();
  return useCallback(
    (sheets) => {
      const digits = minorDigits(investmentCurrency(db));
      const existing = new Map(
        listAllInvestments(db)
          .filter((r) => r.platform === STABLE_PLATFORM && r.reference)
          .map((r) => [r.reference, r.id]),
      );
      const result: StableImportResult = { create: 0, update: 0, skipped: [] };
      for (const bond of parseStableReports(sheets)) {
        const plan = toInvestmentPlan(bond, { digits });
        if ("skipped" in plan) {
          result.skipped.push(`${bond.isin}: ${plan.skipped}`);
          continue;
        }
        const id = existing.get(bond.isin);
        if (id) {
          actions.investments.update(id, plan.input);
          actions.investments.setSchedule(id, plan.schedule);
          result.update += 1;
        } else {
          const row = actions.investments.create(plan.input);
          actions.investments.setSchedule(row.id, plan.schedule);
          result.create += 1;
        }
      }
      return result;
    },
    [db, actions],
  );
}
