import {
  getInvestmentDetail,
  listAllInvestments,
  listSchedule,
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
import {
  afterTax,
  cashFlows,
  effectiveSlab,
  expectedFlows,
  interestByMonth,
  investmentReturns,
  maturityLadder,
  tdsWarnings,
  upcomingPayouts,
  xirr,
  type ExpectedFlow,
  type InvestmentReturns,
  type PlannedInvestment,
  type TdsWarning,
  type UpcomingPayout,
} from "@/lib/investments/returns";
import { addDays, type DateKey } from "@studio/dates";

import { useTodayKey } from "./useTodayKey";

const TABLES = [
  "investments",
  "investment_payouts",
  "investment_schedule",
  "settings",
] as const;

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

export interface PortfolioInsights {
  currency: string;
  /** Principal still out in open investments. */
  invested: number;
  accrued: number;
  currentValue: number;
  interestToCome: number;
  /** Interest still to come after tax at the set slab; null until a slab is set. */
  interestToComeAfterTax: number | null;
  /** Tax rate on interest, cess included; null until a slab is set. */
  taxRate: number | null;
  xirr: number | null;
  returns: Record<string, InvestmentReturns>;
  upcoming: UpcomingPayout[];
  ladder: { months: { key: DateKey; amount: number }[]; later: number };
  interestMonths: { key: DateKey; amount: number }[];
  tds: TdsWarning[];
}

const UPCOMING_DAYS = 365;
const CHART_MONTHS = 12;

/** Every investment with its entered schedule attached. */
function plannedInvestments(db: Db): PlannedInvestment[] {
  const schedule = listSchedule(db);
  return listAllInvestments(db).map((inv) => {
    const own = schedule.filter((r) => r.investmentId === inv.id);
    return own.length > 0 ? { ...inv, schedule: own } : inv;
  });
}

/** One investment's expected payouts, entered or calculated; empty when the id is unknown. */
export function useExpectedFlows(id: string | undefined): {
  flows: ExpectedFlow[];
  entered: boolean;
} {
  return useLiveData(TABLES, id ?? "", (db) => {
    const inv = plannedInvestments(db).find((i) => i.id === id);
    return inv
      ? { flows: expectedFlows(inv), entered: !!inv.schedule }
      : { flows: [], entered: false };
  });
}

function readInsights(db: Db, today: DateKey): PortfolioInsights {
  const investments = plannedInvestments(db);
  const payouts = listAllPayouts(db);
  const { rules } = readTaxContext(db);
  const slab = getSetting(db, "tax_slab_percent");
  const taxRate = slab === null ? null : effectiveSlab(slab, rules);
  const returns: Record<string, InvestmentReturns> = {};
  let invested = 0;
  let accrued = 0;
  let interestToCome = 0;
  for (const inv of investments) {
    const own = payouts.filter((p) => p.investmentId === inv.id);
    const r = investmentReturns(inv, own, today);
    returns[inv.id] = r;
    if (inv.closedOn) continue;
    invested += r.currentValue - r.accrued;
    accrued += r.accrued;
    interestToCome += r.interestToCome;
  }
  return {
    currency:
      investments[0]?.currency ?? getSetting(db, "display_currency"),
    invested,
    accrued,
    currentValue: invested + accrued,
    interestToCome,
    interestToComeAfterTax:
      taxRate === null ? null : afterTax(interestToCome, taxRate),
    taxRate,
    xirr: xirr(
      cashFlows(investments, payouts, today, (inv) => returns[inv.id]?.accrued ?? 0),
    ),
    returns,
    upcoming: upcomingPayouts(investments, today, addDays(today, UPCOMING_DAYS)),
    ladder: maturityLadder(investments, payouts, today, CHART_MONTHS),
    interestMonths: interestByMonth(payouts, today, CHART_MONTHS),
    tds: rules === "india" ? tdsWarnings(investments, payouts, today) : [],
  };
}

/** Value, returns, what is coming and warnings across every investment. */
export function useInvestmentInsights(): PortfolioInsights {
  const today = useTodayKey();
  return useLiveData(TABLES, today, (db) => readInsights(db, today));
}
