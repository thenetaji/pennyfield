import * as React from "react";
import { View } from "react-native";

import { Card, SectionHeader, Text } from "@studio/ui";
import { axisLabels } from "@studio/charts/lib";
import { BarChart } from "@studio/charts/components";
import { useInsightsExtras, type Insights } from "@/data/hooks";
import {
  diffDays,
  type DateKey,
  type Period,
  type PeriodSettings,
} from "@studio/dates";
import { formatMoney } from "@studio/money";
import { useTokens } from "@studio/theme";
import type { BreakdownBy, InsightsScope } from "@/lib/insights";

import { barsTitle, scrubLabel } from "./labels";
import { RunningCard } from "./running-card";
import { StatsGrid } from "./sections";
import { TrendCard } from "./trend-card";

type TrendSectionProps = {
  insights: Insights;
  period: Period;
  kind: "expense" | "income";
  scope: InsightsScope;
  by: BreakdownBy;
  today: DateKey;
  settings: PeriodSettings;
  locale?: string;
};

/** Summary figures, the day-by-day bars, the running total against last period and the monthly trend. */
function TrendSection({
  insights,
  period,
  kind,
  scope,
  by,
  today,
  settings,
  locale,
}: TrendSectionProps) {
  const { colors } = useTokens();
  const extras = useInsightsExtras(period, kind, settings, today, scope);
  const windowKey = `${period.from}:${period.to}:${kind}`;
  const [scrubbed, setScrubbed] = React.useState<{
    window: string;
    index: number | null;
  }>({ window: windowKey, index: null });
  const scrub = scrubbed.window === windowKey ? scrubbed.index : null;
  const setScrub = React.useCallback(
    (index: number | null) => setScrubbed({ window: windowKey, index }),
    [windowKey],
  );
  const { currency } = insights;

  const bars = React.useMemo(
    () => insights.series.map((p) => ({ key: p.key, value: p.amount })),
    [insights.series],
  );
  const labels = React.useMemo(
    () =>
      axisLabels(
        insights.series.map((p) => p.key),
        insights.granularity,
      ),
    [insights.series, insights.granularity],
  );
  const average = formatMoney(insights.average, currency, {
    locale,
    decimals: 0,
  });
  const noun = insights.granularity === "day" ? "day" : "month";
  const days = diffDays(period.from, period.to) + 1;

  if (insights.total === 0 && extras.transactionCount === 0)
    return (
      <Text variant="callout" tone="secondary" className="py-10 text-center">
        Nothing in this period
      </Text>
    );

  return (
    <>
      <View className="pt-4">
        <StatsGrid extras={extras} currency={currency} locale={locale} />
      </View>
      <SectionHeader title={barsTitle(insights.granularity, kind)} />
      <Card className="mx-4 px-4 pb-1 pt-3">
        <View className="flex-row items-baseline justify-end">
          <Text variant="footnote" tone="tertiary" numeric>
            {`Avg ${average}/${noun}`}
          </Text>
        </View>
        <BarChart
          data={bars}
          currency={currency}
          locale={locale}
          labels={labels}
          average={insights.average}
          color={kind === "income" ? colors.income : undefined}
          selectedIndex={scrub}
          onSelect={setScrub}
          formatLabel={(index) =>
            scrubLabel(
              insights.series[index] ?? { key: period.from, amount: 0 },
              insights.granularity,
              currency,
              locale,
            )
          }
          accessibilityLabel={`${barsTitle(insights.granularity, kind)}, ${days} days, average ${average} per ${noun}`}
        />
      </Card>
      {insights.total > 0 ||
      insights.previousSeries.some((p) => p.amount > 0) ? (
        <RunningCard
          insights={insights}
          period={period}
          today={today}
          locale={locale}
        />
      ) : null}
      {insights.total > 0 ? (
        <TrendCard
          endRef={today >= period.from && today < period.to ? today : period.to}
          kind={kind}
          by={by}
          settings={settings}
          scope={scope}
          locale={locale}
        />
      ) : null}
    </>
  );
}

export { TrendSection };
