import * as React from "react";
import { StyleSheet, View } from "react-native";

import { withSkia } from "@studio/charts";
import type { MonthlyBarsProps } from "@studio/charts/components";
import { AnimatedNumber, Card, Text, type TextTone } from "@studio/ui";
import { useTokens, withAlpha } from "@studio/theme";
import { useMonthlyTotals } from "@/data/hooks";
import { monthShort, parseKey, type Period } from "@studio/dates";
import { formatMoneyForSpeech } from "@studio/money";

import { monthScrub } from "./labels";

const MonthlyBars = withSkia<MonthlyBarsProps>(() =>
  import("@studio/charts/components").then((m) => ({ default: m.MonthlyBars })),
);

const SHOWN = 12;

type Stat = { label: string; value: string; tone?: TextTone };

/** The viewed period's figures in a row, above a chart. */
function StatStrip({ stats }: { stats: readonly Stat[] }) {
  const { colors } = useTokens();
  if (stats.length === 0) return null;
  return (
    <View
      className="mb-1 flex-row pb-3"
      style={{
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.separator,
      }}
    >
      {stats.map((stat) => (
        <View
          key={stat.label}
          className="flex-1"
          accessible
          accessibilityLabel={`${stat.label}, ${stat.value}`}
        >
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {stat.label}
          </Text>
          <AnimatedNumber
            value={stat.value}
            variant="headline"
            tone={stat.tone}
            fit
            align="left"
            className="mt-0.5 font-semibold"
          />
        </View>
      ))}
    </View>
  );
}

type MonthlyCardProps = {
  /** Month periods, newest first (the screen's month list). */
  months: readonly Period[];
  /** `from` of the month being viewed; null for all time. */
  viewedFrom: string | null;
  /** A bar was tapped: switch to that month. */
  onPick: (period: Period) => void;
  locale?: string;
  /** Figures for the month in view, shown above the bars. */
  stats?: readonly Stat[];
};

/** The viewed month's figures over twelve months of spending (bars) with income ticks; tap a bar to view that month. */
function MonthlyCard({
  months,
  viewedFrom,
  onPick,
  locale,
  stats = [],
}: MonthlyCardProps) {
  const { colors } = useTokens();
  const recent = React.useMemo(() => months.slice(0, SHOWN), [months]);
  const totals = useMonthlyTotals(recent);
  // Leading months with nothing in them only waste width; keep at least six.
  const shown = React.useMemo(() => {
    const first = totals.months.findIndex((m) => m.income > 0 || m.spent > 0);
    return totals.months.slice(
      Math.max(0, Math.min(first < 0 ? 0 : first, totals.months.length - 6)),
    );
  }, [totals.months]);
  const data = React.useMemo(
    () => shown.map((m) => ({ key: m.key, income: m.income, spent: m.spent })),
    [shown],
  );
  const labels = React.useMemo(
    () =>
      shown.map((m, index) => ({
        index,
        text: monthShort(parseKey(m.to).month),
      })),
    [shown],
  );
  const selectedIndex =
    viewedFrom === null ? null : shown.findIndex((m) => m.from === viewedFrom);
  const any = shown.some((m) => m.income > 0 || m.spent > 0);
  if (!any) return null;
  const summary = `Spending by month, last ${shown.length} months. ${shown
    .map(
      (m) =>
        `${monthShort(parseKey(m.to).month)} spent ${formatMoneyForSpeech(m.spent, totals.currency, { sign: "none", locale })}`,
    )
    .join("; ")}`;
  return (
    <Card className="mx-4 rounded-[20px] px-4 pb-3 pt-3.5">
      <StatStrip stats={stats} />
      <View style={{ height: 150 }}>
        <MonthlyBars
          data={data}
          currency={totals.currency}
          locale={locale}
          labels={labels}
          selectedIndex={
            selectedIndex !== null && selectedIndex >= 0 ? selectedIndex : null
          }
          onPick={(i) => {
            const picked = recent.find((p) => p.from === shown[i]?.from);
            if (picked) onPick(picked);
          }}
          formatLabel={(i) =>
            shown[i]
              ? monthScrub(
                  shown[i]!,
                  monthShort(parseKey(shown[i]!.to).month),
                  totals.currency,
                  locale,
                )
              : ""
          }
          accessibilityLabel={summary}
        />
      </View>
      <View
        className="mt-1 flex-row gap-4"
        importantForAccessibility="no-hide-descendants"
      >
        <View className="flex-row items-center gap-1.5">
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: withAlpha(colors.text, 0.35),
            }}
          />
          <Text variant="caption" tone="tertiary">
            Spent
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View
            style={{
              width: 10,
              height: 2.5,
              borderRadius: 1,
              backgroundColor: colors.income,
            }}
          />
          <Text variant="caption" tone="tertiary">
            Earned
          </Text>
        </View>
      </View>
    </Card>
  );
}

export { MonthlyCard, StatStrip };
export type { Stat };
