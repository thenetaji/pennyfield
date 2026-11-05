import * as React from "react";
import { View } from "react-native";

import { withSkia } from "@studio/charts";
import type { BarChartProps } from "@studio/charts/components";
import { axisLabels, shortDay } from "@studio/charts";
import type { TransactionListItem } from "@/data/hooks";
import { sumItems } from "@/features/transactions/day-groups";
import type { MoneyContext } from "@/features/transactions/use-money-context";
import { addDays } from "@studio/dates";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { Card } from "@studio/ui";

import { StatStrip, type Stat } from "./monthly-card";

const BarChart = withSkia<BarChartProps>(() =>
  import("@studio/charts/components").then((m) => ({ default: m.BarChart })),
);

type DailyCardProps = {
  items: readonly TransactionListItem[];
  from: string;
  to: string;
  today: string;
  money: MoneyContext;
  stats: readonly Stat[];
  /** A bar was tapped: show that day in the list. */
  onPickDay: (dateKey: string) => void;
};

/** Spending per day of the viewed month with its daily average; tapping a day jumps the list to it. */
function DailyCard({ items, from, to, today, money, stats, onPickDay }: DailyCardProps) {
  const last = to < today ? to : today;
  const days = React.useMemo(() => {
    const out: string[] = [];
    for (let d = from; d <= last; d = addDays(d, 1)) out.push(d);
    return out;
  }, [from, last]);
  const data = React.useMemo(() => {
    const byDay = new Map<string, TransactionListItem[]>();
    for (const item of items) {
      if (item.kind !== "expense") continue;
      const list = byDay.get(item.dateKey);
      if (list) list.push(item);
      else byDay.set(item.dateKey, [item]);
    }
    return days.map((key) => ({
      key,
      value: sumItems(byDay.get(key) ?? [], money).spent,
    }));
  }, [items, days, money]);
  const [selected, setSelected] = React.useState<number | null>(null);
  React.useEffect(() => setSelected(null), [from]);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const labels = React.useMemo(() => axisLabels(days, "day"), [days]);
  if (days.length === 0 || total === 0) {
    return stats.length > 0 ? (
      <Card className="mx-4 rounded-[20px] px-4 pb-1 pt-3.5">
        <StatStrip stats={stats} />
      </Card>
    ) : null;
  }
  const average = Math.round(total / days.length);
  let peak = 0;
  data.forEach((d, i) => {
    if (d.value > (data[peak]?.value ?? 0)) peak = i;
  });
  const fmt = (minor: number) =>
    formatMoney(minor, money.displayCurrency, {
      locale: money.locale,
      sign: "none",
      decimals: 0,
    });
  const dayText = shortDay;
  return (
    <Card className="mx-4 rounded-[20px] px-4 pb-3 pt-3.5">
      <StatStrip stats={stats} />
      <View className="mt-1">
        <BarChart
          data={data}
          currency={money.displayCurrency}
          locale={money.locale}
          labels={labels}
          average={average}
          selectedIndex={selected}
          highlightIndex={peak}
          height={110}
          onSelect={(i) => {
            setSelected(i);
            const key = i === null ? undefined : data[i]?.key;
            if (key) onPickDay(key);
          }}
          formatLabel={(i) =>
            data[i] ? `${dayText(data[i]!.key)} · ${fmt(data[i]!.value)}` : ""
          }
          accessibilityLabel={`Spending per day, average ${formatMoneyForSpeech(average, money.displayCurrency, { sign: "none", locale: money.locale })}. Biggest day ${dayText(data[peak]!.key)}, ${formatMoneyForSpeech(data[peak]!.value, money.displayCurrency, { sign: "none", locale: money.locale })}.`}
        />
      </View>
    </Card>
  );
}

export { DailyCard };
