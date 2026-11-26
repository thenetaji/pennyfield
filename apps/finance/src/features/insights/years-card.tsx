import * as React from "react";
import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { formatMoney } from "@studio/money";
import { useTokens } from "@studio/theme";
import { Card, Text } from "@studio/ui";

export type YearRow = { key: string; label: string; income: number; spent: number };

/** One row per year, newest first: what came in, what went out and what was kept. */
export function YearsCard({
  years,
  currency,
  locale,
  decimals,
}: {
  years: readonly YearRow[];
  currency: string;
  locale?: string;
  decimals?: number;
}) {
  const { colors } = useTokens();
  const max = Math.max(1, ...years.map((y) => Math.max(y.income, y.spent)));
  const money = (v: number) => formatMoney(v, currency, { locale, decimals });
  const rows = [...years].reverse();
  if (rows.length === 0) return null;
  return (
    <Card className="mx-4 p-0">
      {rows.map((y, i) => {
        const kept = y.income - y.spent;
        return (
          <Animated.View
            key={y.key}
            entering={FadeInDown.delay(i * 50).duration(260)}
            className={`px-4 py-3.5 ${i > 0 ? "border-t border-separator" : ""}`}
          >
            <View className="flex-row items-baseline justify-between">
              <Text variant="headline">{y.label}</Text>
              <Text variant="subhead" numeric tone={kept >= 0 ? "income" : "expense"}>
                {`${kept >= 0 ? "Kept +" : "Short −"}${money(Math.abs(kept))}`}
              </Text>
            </View>
            <View className="mt-2 gap-1.5">
              <BarLine
                label="In"
                value={`+${money(y.income)}`}
                share={y.income / max}
                color={colors.income}
              />
              <BarLine
                label="Out"
                value={`−${money(y.spent)}`}
                share={y.spent / max}
                color={colors.expense}
              />
            </View>
          </Animated.View>
        );
      })}
    </Card>
  );
}

function BarLine({
  label,
  value,
  share,
  color,
}: {
  label: string;
  value: string;
  share: number;
  color: string;
}) {
  const { colors } = useTokens();
  return (
    <View className="flex-row items-center gap-2.5">
      <Text variant="caption" tone="secondary" className="w-7">
        {label}
      </Text>
      <View className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: colors.fill }}>
        <View
          className="h-full rounded-full"
          style={{ width: `${Math.max(1, share * 100)}%`, backgroundColor: color }}
        />
      </View>
      <Text variant="footnote" numeric className="w-[104px] text-right" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
