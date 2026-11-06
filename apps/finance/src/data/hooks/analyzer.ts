import { listCategories } from "@/db/repos/categories";
import { analyzerLines } from "@/db/repos/insight-lines";
import { priceRises, type PriceRise } from "@/lib/insights/price-rises";
import { listRules, upcoming } from "@/db/repos/recurring";
import type { CategoryRow } from "@/db/schema";
import type { Db } from "@/db/types";
import {
  addDays,
  diffDays,
  periodFor,
  previousPeriod,
  type DateKey,
  type PeriodSettings,
} from "@studio/dates";
import { convertWithRates } from "@studio/money";
import {
  forecast,
  normaliseTitle,
  patterns,
  repeatPayments,
  unusualCategories,
  type AnalyzerLine,
  type Forecast,
  type Patterns,
  type RepeatPayment,
  type UnusualCategory,
} from "@/lib/insights";
import { conversionContext } from "./summary";

/** How far back the analyzer reads: enough months for "usual" and for repeat payments. */
const HISTORY_MONTHS = 3;
const PATTERN_DAYS = 90;
const REPEAT_DAYS = 180;

export interface AnalyzerUnusual extends UnusualCategory {
  category: CategoryRow | null;
}

export interface AnalyzerRepeat extends RepeatPayment {
  category: CategoryRow | null;
}

export interface Analyzer {
  currency: string;
  /** The current month by the owner's month start. */
  period: { from: DateKey; to: DateKey };
  forecast: Forecast | null;
  unusual: AnalyzerUnusual[];
  /** Over the last 90 days. */
  patterns: Patterns;
  repeats: AnalyzerRepeat[];
  priceRises: PriceRise[];
}

export function readAnalyzer(
  db: Db,
  todayKey: DateKey,
  settings: PeriodSettings,
): Analyzer {
  const ctx = conversionContext(db);
  const period = periodFor("month", todayKey, settings);
  const history = [previousPeriod(period)];
  for (let i = 1; i < HISTORY_MONTHS; i++)
    history.push(previousPeriod(history[i - 1] ?? period));
  const from = [
    history[history.length - 1]?.from ?? period.from,
    addDays(todayKey, -REPEAT_DAYS),
  ].sort()[0] as DateKey;
  const lines: AnalyzerLine[] = analyzerLines(db, {
    from,
    to: period.to,
  }).map((row) => ({
    transactionId: row.transactionId,
    title: row.title,
    accountId: row.accountId,
    categoryId: row.categoryId,
    dateKey: row.dateKey,
    hour: new Date(row.occurredAt).getHours(),
    amount: convertWithRates(
      row.amount,
      row.currency,
      ctx.displayCurrency,
      ctx.rates,
    ),
    recurringRuleId: row.recurringRuleId,
  }));
  const pastOnly = lines.filter((l) => l.dateKey <= todayKey);

  const bills = upcoming(
    db,
    todayKey,
    Math.max(diffDays(todayKey, period.to), 0),
  )
    .filter(
      (o) =>
        o.rule.kind === "expense" &&
        o.dueDate > todayKey &&
        o.dueDate <= period.to,
    )
    .reduce(
      (total, o) =>
        total +
        convertWithRates(
          o.rule.amount,
          o.rule.currency,
          ctx.displayCurrency,
          ctx.rates,
        ),
      0,
    );

  const categories = new Map(
    listCategories(db, undefined, { includeArchived: true }).map((c) => [
      c.id,
      c,
    ]),
  );
  const category = (id: string | null) =>
    id ? (categories.get(id) ?? null) : null;
  const known = new Set(listRules(db).map((r) => normaliseTitle(r.title)));

  return {
    currency: ctx.displayCurrency,
    period: { from: period.from, to: period.to },
    forecast: forecast(pastOnly, period, history[0] ?? period, todayKey, bills),
    unusual: unusualCategories(pastOnly, period, history, todayKey).map(
      (u) => ({ ...u, category: category(u.categoryId) }),
    ),
    patterns: patterns(pastOnly, {
      from: addDays(todayKey, -(PATTERN_DAYS - 1)),
      to: todayKey,
    }),
    repeats: repeatPayments(pastOnly, todayKey, known).map((r) => ({
      ...r,
      category: category(r.categoryId),
    })),
    priceRises: priceRises(pastOnly, todayKey),
  };
}
