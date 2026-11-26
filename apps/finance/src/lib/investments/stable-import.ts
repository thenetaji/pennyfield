import type { DateKey } from "@studio/dates";

import type { InvestmentPayoutSchedule } from "@/db/schema";
import type { InvestmentInput, ScheduleInput } from "@/db/repos/investments";

export interface StablePayout {
  dateKey: DateKey;
  kind: "interest" | "principal";
  gross: number;
  tds: number;
  net: number;
}

export interface StableBond {
  isin: string;
  name: string;
  issuer: string;
  buyDate?: DateKey;
  units?: number;
  ytm?: number;
  /** Major units. */
  invested?: number;
  faceValue?: number;
  /** Major units per unit, clean price; unit-weighted over buys. */
  price?: number;
  /** Major units; signed, positive was paid to the seller. */
  accrued?: number;
  maturityDate?: DateKey;
  sellDate?: DateKey;
  payouts: StablePayout[];
}

export const STABLE_PLATFORM = "Stable Bonds";

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

const pad = (n: number) => String(n).padStart(2, "0");

export function parseStableDate(cell: string | undefined): DateKey | null {
  const text = (cell ?? "").trim();
  const named = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(text);
  if (named) {
    const month = MONTHS.indexOf(named[1].toLowerCase());
    if (month < 0) return null;
    return `${named[3]}-${pad(month + 1)}-${pad(Number(named[2]))}` as DateKey;
  }
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Math.floor(Number(text));
    if (serial < 20000 || serial > 80000) return null;
    return new Date((serial - 25569) * 86_400_000)
      .toISOString()
      .slice(0, 10) as DateKey;
  }
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return iso ? (iso[1] as DateKey) : null;
}

function num(cell: string | undefined): number | undefined {
  const n = Number((cell ?? "").replace(/,/g, "").trim());
  return (cell ?? "").trim() !== "" && Number.isFinite(n) ? n : undefined;
}

const lower = (s: string | undefined) => (s ?? "").trim().toLowerCase();

function columns(header: string[]): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((h, i) => {
    const key = lower(h);
    if (key && !map.has(key)) map.set(key, i);
  });
  return map;
}

function cellAt(row: string[], cols: Map<string, number>, name: string) {
  const i = cols.get(name);
  return i === undefined ? undefined : row[i];
}

type Kind = "investment" | "holdings" | "cashflow";

function reportKind(rows: string[][]): Kind | null {
  const title = lower(rows[1]?.[0]);
  if (title === "consolidated investment report") return "investment";
  if (title === "holdings report") return "holdings";
  if (title === "upcoming cashflow") return "cashflow";
  return null;
}

/** Rows after the first header row starting with `first` and containing `also`. */
function table(rows: string[][], first: string, also: string) {
  const at = rows.findIndex(
    (r) => lower(r[0]) === first && r.some((c) => lower(c) === also),
  );
  if (at < 0) return null;
  return { cols: columns(rows[at]), body: rows.slice(at + 1) };
}

export function parseStableReports(sheets: string[][][][]): StableBond[] {
  const bonds = new Map<string, StableBond>();
  const bondFor = (isin: string, name: string) => {
    let bond = bonds.get(isin);
    if (!bond) {
      bond = { isin, name, issuer: name, payouts: [] };
      bonds.set(isin, bond);
    }
    return bond;
  };
  const named = new Set<string>();
  const priced = new Map<string, { units: number; cost: number }>();

  for (const workbook of sheets) {
    for (const rows of workbook) {
      const kind = reportKind(rows);
      if (kind === "investment") {
        const t = table(rows, "date", "isin");
        if (!t) continue;
        for (const row of t.body) {
          const isin = (cellAt(row, t.cols, "isin") ?? "").trim();
          const date = parseStableDate(cellAt(row, t.cols, "date"));
          if (!isin || !date) continue;
          if (lower(cellAt(row, t.cols, "transaction type")) !== "buy") continue;
          const bond = bondFor(isin, (cellAt(row, t.cols, "bond name") ?? "").trim() || isin);
          const title = (cellAt(row, t.cols, "bond name") ?? "").trim();
          if (title) {
            bond.name = bond.issuer = title;
            named.add(isin);
          }
          // A second buy of the same ISIN adds to the position.
          bond.buyDate = bond.buyDate && bond.buyDate < date ? bond.buyDate : date;
          const units = num(cellAt(row, t.cols, "quantity (units)"));
          const invested = num(cellAt(row, t.cols, "invested amount (inr)"));
          if (units !== undefined) bond.units = (bond.units ?? 0) + units;
          if (invested !== undefined) bond.invested = (bond.invested ?? 0) + invested;
          const price = num(cellAt(row, t.cols, "price / unit (inr)"));
          const accrued = num(cellAt(row, t.cols, "accrued at buy (inr)"));
          if (price !== undefined && units !== undefined && units > 0) {
            const before = priced.get(isin) ?? { units: 0, cost: 0 };
            const next = { units: before.units + units, cost: before.cost + price * units };
            priced.set(isin, next);
            bond.price = next.cost / next.units;
          }
          if (accrued !== undefined) bond.accrued = (bond.accrued ?? 0) + accrued;
          bond.ytm = num(cellAt(row, t.cols, "ytm (%)")) ?? bond.ytm;
          bond.faceValue = num(cellAt(row, t.cols, "face value (inr)")) ?? bond.faceValue;
        }
      } else if (kind === "holdings") {
        const t = table(rows, "isin", "security name");
        if (!t) continue;
        for (const row of t.body) {
          const isin = (cellAt(row, t.cols, "isin") ?? "").trim();
          const maturity = parseStableDate(cellAt(row, t.cols, "maturity"));
          if (!isin || !maturity) continue;
          const security = (cellAt(row, t.cols, "security name") ?? "")
            .replace(/\s+[A-Za-z]{3}'\d{2}$/, "")
            .trim();
          const bond = bondFor(isin, security || isin);
          if (!named.has(isin) && security) bond.name = bond.issuer = security;
          bond.maturityDate = maturity;
        }
      } else if (kind === "cashflow") {
        const t = table(rows, "date", "payout type");
        if (!t) continue;
        for (const row of t.body) {
          const date = parseStableDate(row[0]);
          if (!date) break;
          const isin = (cellAt(row, t.cols, "isin") ?? "").trim();
          if (!isin) continue;
          const bond = bondFor(isin, (cellAt(row, t.cols, "bond name") ?? "").trim() || isin);
          const type = lower(cellAt(row, t.cols, "payout type"));
          const principal = num(cellAt(row, t.cols, "principal (inr)")) ?? 0;
          const interest = num(cellAt(row, t.cols, "interest before tds (inr)")) ?? 0;
          const tds = num(cellAt(row, t.cols, "tds (inr)")) ?? 0;
          if (type === "auto-sell") bond.sellDate = date;
          if (type === "interest" || interest > 0)
            bond.payouts.push({ dateKey: date, kind: "interest", gross: interest, tds, net: interest - tds });
          if (type !== "interest" && principal > 0)
            bond.payouts.push({ dateKey: date, kind: "principal", gross: principal, tds: 0, net: principal });
        }
      }
    }
  }

  return [...bonds.values()].map((b) => ({
    ...b,
    payouts: b.payouts
      .filter((p) => p.gross > 0)
      .sort((x, y) => x.dateKey.localeCompare(y.dateKey) || x.kind.localeCompare(y.kind)),
  }));
}

function dayNumber(key: string): number {
  return Date.parse(`${key}T00:00:00Z`) / 86_400_000;
}

function payoutSchedule(dates: string[]): InvestmentPayoutSchedule {
  if (dates.length < 2) return "cumulative";
  const gaps = dates.slice(1).map((d, i) => dayNumber(d) - dayNumber(dates[i]));
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const options: [InvestmentPayoutSchedule, number][] = [
    ["monthly", 30.4],
    ["quarterly", 91.3],
    ["half_yearly", 182.6],
    ["yearly", 365],
  ];
  return options.reduce((best, o) =>
    Math.abs(o[1] - avg) < Math.abs(best[1] - avg) ? o : best,
  )[0];
}

export type StablePlan =
  | { input: InvestmentInput; schedule: ScheduleInput[] }
  | { skipped: "missing_amount" };

export function toInvestmentPlan(
  bond: StableBond,
  opts: { digits: number },
): StablePlan {
  if (!bond.invested || bond.invested <= 0 || !bond.buyDate)
    return { skipped: "missing_amount" };
  const scale = 10 ** opts.digits;
  const minor = (v: number) => Math.round(v * scale);
  const interestDates = bond.payouts
    .filter((p) => p.kind === "interest")
    .map((p) => p.dateKey);
  const redemption = bond.payouts.find((p) => p.kind === "principal");
  const maturityDate = bond.sellDate ?? bond.maturityDate ?? null;
  const early =
    bond.sellDate && bond.maturityDate && bond.sellDate < bond.maturityDate;
  const schedule: ScheduleInput[] = bond.payouts
    .filter((p) => minor(p.gross) > 0)
    .map((p) => ({ dateKey: p.dateKey, kind: p.kind, amount: minor(p.gross) }));
  const input: InvestmentInput = {
    name: bond.name,
    type: "bond",
    issuer: bond.issuer,
    platform: STABLE_PLATFORM,
    reference: bond.isin,
    listed: true,
    amount: minor(bond.invested),
    rate: bond.ytm ?? null,
    payout: payoutSchedule(interestDates),
    buyDate: bond.buyDate,
    maturityDate,
    firstPayoutDate: interestDates[0] ?? null,
    couponAmount: null,
    redemptionAmount: redemption ? minor(redemption.gross) : null,
    units: bond.units ?? null,
    faceValue: bond.faceValue != null ? minor(bond.faceValue) : null,
    cleanPrice: bond.price != null ? minor(bond.price) : null,
    accruedAtBuy: bond.accrued != null ? minor(bond.accrued) : null,
    ...(early ? { note: `Matures ${bond.maturityDate}` } : {}),
  };
  return { input, schedule };
}
