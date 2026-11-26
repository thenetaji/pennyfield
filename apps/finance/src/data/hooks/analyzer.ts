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
  leaks,
  normaliseTitle,
  patterns,
  repeatPayments,
  unusualCategories,
  type AnalyzerLine,
  type Forecast,
  type Leak,
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

export interface AnalyzerLeak extends Leak {
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
  /** Payees well above usual, business and family left out; last month's until a week of this one has passed. */
  leaks: AnalyzerLeak[];
  leakPeriod: { from: DateKey; to: DateKey };
  /** Spending this month with no real category (none, Unknown, Other). */
  unlabelled: { count: number; amount: number; categoryId: string | null };
}

/** Business costs, money for family and tax are spent on purpose; they bury the payments worth a second look. */
const isPlanned = (c: CategoryRow | null) =>
  !!c &&
  (c.isBusiness ||
    /^(business|family)$/i.test(c.groupName ?? "") ||
    /^(family|tax|taxes)$/i.test(c.name.trim()));

const isUnlabelled = (c: CategoryRow | null) =>
  !c || /^(unknown|other|uncategori[sz]ed)$/i.test(c.name.trim());

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
  const oldest = history[history.length - 1] ?? period;
  const extra = previousPeriod(oldest);
  const from = [
    extra.from,
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
  const wants = pastOnly.filter((l) => !isPlanned(category(l.categoryId)));
  const early = diffDays(period.from, todayKey) < 7;
  const leakPeriod = early ? (history[0] ?? period) : period;
  const leakHistory = early ? [...history.slice(1), extra] : history;
  const inMonth = pastOnly.filter((l) => l.dateKey >= period.from && isUnlabelled(category(l.categoryId)));
  const unlabelledIds = new Set(inMonth.map((l) => l.categoryId));
  const known = new Set(listRules(db).map((r) => normaliseTitle(r.title)));

  return {
    currency: ctx.displayCurrency,
    period: { from: period.from, to: period.to },
    forecast: forecast(pastOnly, period, history[0] ?? period, todayKey, bills),
    unusual: unusualCategories(wants, period, history, todayKey).map(
      (u) => ({ ...u, category: category(u.categoryId) }),
    ),
    patterns: patterns(pastOnly, {
      from: addDays(todayKey, -(PATTERN_DAYS - 1)),
      to: todayKey,
    }),
    repeats: repeatPayments(wants, todayKey, known).map((r) => ({
      ...r,
      category: category(r.categoryId),
    })),
    priceRises: priceRises(pastOnly, todayKey),
    leaks: leaks(wants, leakPeriod, leakHistory, early ? leakPeriod.to : todayKey).map((l) => ({
      ...l,
      category: category(l.categoryId),
    })),
    leakPeriod: { from: leakPeriod.from, to: leakPeriod.to },
    unlabelled: {
      count: new Set(inMonth.map((l) => l.transactionId)).size,
      amount: inMonth.reduce((t, l) => t + l.amount, 0),
      categoryId: unlabelledIds.size === 1 ? ([...unlabelledIds][0] ?? null) : null,
    },
  };
}
