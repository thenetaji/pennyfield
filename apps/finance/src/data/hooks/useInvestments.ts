import {
  getInvestmentDetail,
  listAllInvestments,
  listAllPayouts,
  listInvestments,
  type InvestmentDetail,
  type InvestmentSummary,
} from "@/db/repos/investments";
import { getSetting } from "@/db/repos/settings";
import { useLiveData } from "@/data/use-live-data";
import {
  resolveTaxRules,
  summarizeTaxYears,
  taxYearStartMonth,
  type TaxRules,
  type TaxYearSummary,
} from "@/lib/investments/tax";
import type { Db } from "@/db/types";

import { useTodayKey } from "./useTodayKey";

const TABLES = ["investments", "investment_payouts", "settings"] as const;

export function useInvestments(): InvestmentSummary[] {
  const today = useTodayKey();
  return useLiveData(TABLES, today, (db) => listInvestments(db, today));
}

export function useInvestment(
  id: string | undefined,
): InvestmentDetail | undefined {
  const today = useTodayKey();
  return useLiveData(TABLES, `${id ?? ""}:${today}`, (db) =>
    id ? getInvestmentDetail(db, id, today) : undefined,
  );
}

export interface TaxContext {
  rules: TaxRules;
  startMonth: number;
}

function readTaxContext(db: Db): TaxContext {
  const rules = resolveTaxRules(
    getSetting(db, "tax_rules"),
    getSetting(db, "display_currency"),
  );
  return {
    rules,
    startMonth: taxYearStartMonth(
      rules,
      getSetting(db, "tax_year_start_month"),
    ),
  };
}

export function useTaxContext(): TaxContext {
  return useLiveData(["settings"], "", readTaxContext);
}

/** Interest, tax withheld and gains per tax year, newest first. */
export function useTaxYears(): TaxYearSummary[] {
  return useLiveData(TABLES, "", (db) => {
    const { rules, startMonth } = readTaxContext(db);
    return summarizeTaxYears(
      listAllInvestments(db),
      listAllPayouts(db),
      rules,
      startMonth,
    );
  });
}

export type {
  InvestmentDetail,
  InvestmentSummary,
} from "@/db/repos/investments";
