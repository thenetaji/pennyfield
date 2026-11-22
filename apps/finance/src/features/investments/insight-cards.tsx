import * as React from "react";
import { View } from "react-native";

import { axisLabels, withSkia } from "@studio/charts";
import type { BarChartProps } from "@studio/charts/components";
import { monthName, monthShort, parseKey, type DateKey } from "@studio/dates";
import { formatMoneyForSpeech } from "@studio/money";
import { useTokens } from "@studio/theme";
import { Card, SegmentedControl, Text } from "@studio/ui";

import type { InvestmentSummary, PortfolioInsights } from "@/data/hooks";
import { StatStrip, type Stat } from "@/features/activity-chart/monthly-card";
import { TYPE_LABELS } from "@/lib/investments/tax";

import { dateLabel } from "./format";

const BarChart = withSkia<BarChartProps>(() =>
  import("@studio/charts/components").then((m) => ({ default: m.BarChart })),
);

export type Fmt = (minor: number) => string;

const monthYear = (key: DateKey) => {
  const { month, year } = parseKey(key);
  return `${monthShort(month)} ${year}`;
};

function CardTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <View className="mb-2 flex-row items-baseline justify-between gap-2">
      <Text variant="headline">{title}</Text>
      {detail ? (
        <Text variant="footnote" tone="secondary" numeric>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/** Value today, the real yearly return, interest still to come and interest earned but not yet paid. */
export function SummaryCard({
  insights,
  fmt,
  onSetSlab,
}: {
  insights: PortfolioInsights;
  fmt: Fmt;
  onSetSlab: () => void;
}) {
  const top: Stat[] = [
    { label: "Invested", value: fmt(insights.invested) },
    {
      label: "Return a year",
      value: insights.xirr === null ? "–" : `${insights.xirr.toFixed(2)}%`,
      tone: insights.xirr !== null && insights.xirr < 0 ? "expense" : undefined,
    },
  ];
  const bottom: Stat[] = [
    { label: "Earned, not paid", value: fmt(insights.accrued) },
    { label: "Interest to come", value: fmt(insights.interestToCome) },
  ];
  return (
    <Card className="mx-4 gap-2 rounded-[20px] px-4 pb-3 pt-3.5">
      <StatStrip stats={top} />
      <StatStrip stats={bottom} />
      {insights.interestToComeAfterTax === null ? (
        <Text variant="footnote" tone="accent" onPress={onSetSlab}>
          Set your tax slab to see returns after tax
        </Text>
      ) : (
        <Text variant="footnote" tone="secondary" numeric onPress={onSetSlab}>
          {`After ${Number((insights.taxRate ?? 0).toFixed(1))}% tax: ${fmt(insights.interestToComeAfterTax)} to come`}
        </Text>
      )}
    </Card>
  );
}

/** Payers heading past the yearly interest limit above which they deduct TDS. */
export function TdsCard({
  insights,
  fmt,
}: {
  insights: PortfolioInsights;
  fmt: Fmt;
}) {
  if (insights.tds.length === 0) return null;
  return (
    <Card className="mx-4 gap-1.5 rounded-[20px] px-4 py-3">
      <Text variant="headline" tone="warning">
        TDS likely this year
      </Text>
      {insights.tds.map((w) => (
        <Text key={w.issuer} variant="subhead" numeric>
          {`${w.issuer}: about ${fmt(w.interest)} interest, over the ${fmt(w.limit)} limit`}
        </Text>
      ))}
      <Text variant="footnote" tone="secondary">
        If your total income is below the taxable limit, give the bank Form 15G
        (15H if 60 or older) to stop TDS.
      </Text>
    </Card>
  );
}

const UPCOMING_SHOWN = 8;

/** The next payouts the terms promise, with the year's total. */
export function UpcomingCard({
  insights,
  fmt,
}: {
  insights: PortfolioInsights;
  fmt: Fmt;
}) {
  const [all, setAll] = React.useState(false);
  if (insights.upcoming.length === 0) return null;
  const interest = insights.upcoming
    .filter((p) => p.kind === "interest")
    .reduce((sum, p) => sum + p.amount, 0);
  const shown = all
    ? insights.upcoming
    : insights.upcoming.slice(0, UPCOMING_SHOWN);
  return (
    <Card className="mx-4 rounded-[20px] px-4 py-3">
      <CardTitle
        title="Coming up"
        detail={`${fmt(interest)} interest in 12 months`}
      />
      {shown.map((p) => (
        <View
          key={`${p.investmentId}:${p.dateKey}:${p.kind}`}
          className="min-h-9 flex-row items-center gap-3"
        >
          <Text variant="footnote" tone="secondary" numeric className="w-24">
            {dateLabel(p.dateKey)}
          </Text>
          <View className="min-w-0 flex-1">
            <Text variant="subhead" numberOfLines={1}>
              {p.name}
            </Text>
          </View>
          <Text
            variant="subhead"
            numeric
            tone={p.kind === "principal" ? "default" : "income"}
          >
            {`${p.kind === "principal" ? "" : "+"}${fmt(p.amount)}`}
          </Text>
        </View>
      ))}
      {insights.upcoming.length > UPCOMING_SHOWN ? (
        <Text
          variant="footnote"
          tone="accent"
          className="pt-1"
          onPress={() => setAll((v) => !v)}
        >
          {all ? "Show less" : `Show all ${insights.upcoming.length}`}
        </Text>
      ) : (
        <Text variant="footnote" tone="secondary" className="pt-1">
          {"Expected from each investment's rate and schedule."}
        </Text>
      )}
    </Card>
  );
}

function MonthBars({
  data,
  currency,
  locale,
  fmt,
  label,
}: {
  data: readonly { key: DateKey; amount: number }[];
  currency: string;
  locale?: string;
  fmt: Fmt;
  label: string;
}) {
  const [selected, setSelected] = React.useState<number | null>(null);
  const bars = React.useMemo(
    () => data.map((d) => ({ key: d.key, value: d.amount })),
    [data],
  );
  const labels = React.useMemo(
    () =>
      axisLabels(
        data.map((d) => d.key),
        "month",
      ),
    [data],
  );
  return (
    <BarChart
      data={bars}
      currency={currency}
      locale={locale}
      labels={labels}
      selectedIndex={selected}
      onSelect={setSelected}
      height={110}
      formatLabel={(i) =>
        data[i] ? `${monthYear(data[i].key)} · ${fmt(data[i].amount)}` : ""
      }
      accessibilityLabel={`${label}. ${data
        .filter((d) => d.amount > 0)
        .map(
          (d) =>
            `${monthName(parseKey(d.key).month)}, ${formatMoneyForSpeech(d.amount, currency, { sign: "none", locale })}`,
        )
        .join("; ")}`}
    />
  );
}

/** Principal coming back per month for a year, to spot gaps and bunching. */
export function LadderCard({
  insights,
  fmt,
  locale,
}: {
  insights: PortfolioInsights;
  fmt: Fmt;
  locale?: string;
}) {
  const { months, later } = insights.ladder;
  const total = months.reduce((sum, m) => sum + m.amount, 0);
  if (total === 0 && later === 0) return null;
  return (
    <Card className="mx-4 rounded-[20px] px-4 pb-3 pt-3.5">
      <CardTitle
        title="Money coming back"
        detail={`${fmt(total)} in 12 months`}
      />
      <MonthBars
        data={months}
        currency={insights.currency}
        locale={locale}
        fmt={fmt}
        label="Principal coming back per month"
      />
      {later > 0 ? (
        <Text variant="footnote" tone="secondary" numeric className="pt-1">
          {`Later: ${fmt(later)}`}
        </Text>
      ) : null}
    </Card>
  );
}

/** Interest received per month, and this tax year against the last. */
export function InterestCard({
  insights,
  fmt,
  locale,
  thisYear,
  lastYear,
}: {
  insights: PortfolioInsights;
  fmt: Fmt;
  locale?: string;
  thisYear: number;
  lastYear: number | null;
}) {
  const total = insights.interestMonths.reduce((sum, m) => sum + m.amount, 0);
  if (total === 0) return null;
  const stats: Stat[] = [
    { label: "This tax year", value: fmt(thisYear), tone: "income" },
    ...(lastYear !== null
      ? [{ label: "Last tax year", value: fmt(lastYear) }]
      : []),
  ];
  return (
    <Card className="mx-4 rounded-[20px] px-4 pb-3 pt-3.5">
      <CardTitle
        title="Interest received"
        detail={`${fmt(total)} in 12 months`}
      />
      <StatStrip stats={stats} />
      <View className="mt-1">
        <MonthBars
          data={insights.interestMonths}
          currency={insights.currency}
          locale={locale}
          fmt={fmt}
          label="Interest received per month"
        />
      </View>
    </Card>
  );
}

const SPLITS = ["Type", "Issuer", "Rating"] as const;
/** One payer or rating above this share of the money is called out. */
const CONCENTRATION = 0.5;

/** Where the money sits: by type, by bank or issuer, or by rating. */
export function SplitCard({
  open,
  fmt,
}: {
  open: readonly InvestmentSummary[];
  fmt: Fmt;
}) {
  const { colors } = useTokens();
  const [by, setBy] = React.useState(0);
  const groups = new Map<string, number>();
  for (const s of open) {
    const inv = s.investment;
    const value = Math.max(0, inv.amount - s.totals.principalBack);
    const key =
      by === 0
        ? TYPE_LABELS[inv.type]
        : by === 1
          ? inv.issuer.trim() || inv.name
          : inv.rating.trim() ||
            (inv.type === "gsec" || inv.type === "tbill"
              ? "Sovereign"
              : inv.type === "fd"
                ? "Bank deposit"
                : "Unrated");
    groups.set(key, (groups.get(key) ?? 0) + value);
  }
  const total = [...groups.values()].reduce((a, b) => a + b, 0);
  if (total === 0 || open.length < 2) return null;
  const rows = [...groups.entries()].sort((a, b) => b[1] - a[1]);
  const top = rows[0];
  const heavy =
    by > 0 && rows.length > 1 && top && top[1] / total > CONCENTRATION;
  return (
    <Card className="mx-4 gap-2 rounded-[20px] px-4 py-3">
      <CardTitle title="Split" />
      <SegmentedControl
        values={SPLITS}
        selectedIndex={by}
        onChange={setBy}
        accessibilityLabel="Split by"
      />
      {rows.map(([label, value]) => {
        const share = value / total;
        return (
          <View key={label} className="gap-1 pt-1">
            <View className="flex-row items-baseline gap-2">
              <Text
                variant="subhead"
                numberOfLines={1}
                className="min-w-0 flex-1"
              >
                {label}
              </Text>
              <Text variant="footnote" tone="secondary" numeric>
                {`${Math.round(share * 100)}%`}
              </Text>
              <Text variant="subhead" numeric>
                {fmt(value)}
              </Text>
            </View>
            <View
              className="h-1.5 overflow-hidden rounded-full"
              style={{ backgroundColor: colors.fill }}
            >
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(2, share * 100)}%`,
                  backgroundColor: colors.accent,
                }}
              />
            </View>
          </View>
        );
      })}
      {heavy && top ? (
        <Text variant="footnote" tone="warning">
          {`${Math.round((top[1] / total) * 100)}% is with ${top[0]}. Spreading it out lowers the risk if one ${by === 1 ? "issuer" : "rating"} goes bad.`}
        </Text>
      ) : null}
    </Card>
  );
}
