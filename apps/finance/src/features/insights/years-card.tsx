import * as React from "react";
import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { HeroWash } from "@/components/app/surface";
import { formatMoney } from "@studio/money";
import { useTokens } from "@studio/theme";
import { Amount, Text } from "@studio/ui";

export type YearRow = { key: string; label: string; income: number; spent: number };

type Fmt = { currency: string; locale?: string; decimals?: number };

const rateOf = (income: number, spent: number) =>
  income > 0 ? Math.round(((income - spent) / income) * 100) : null;

/** Everything since the first entry: what was kept, what came in and went out, then one row per year. */
export function AllTimeSummary({
  income,
  spent,
  years,
  yearTitle,
  currency,
  locale,
  decimals,
}: Fmt & { income: number; spent: number; years: readonly YearRow[]; yearTitle: string }) {
  const { colors } = useTokens();
  const money = (v: number) => formatMoney(v, currency, { locale, decimals });
  const kept = income - spent;
  const rate = rateOf(income, spent);
  const outShare = income > 0 ? Math.min(1, spent / income) : 1;
  return (
    <View>
      <HeroWash>
        <View className="px-5 pb-5 pt-4">
          <Text variant="footnote" tone="secondary" className="font-semibold uppercase tracking-[1.4px]">
            {kept >= 0 ? "Kept so far" : "Short so far"}
          </Text>
          <View className="mt-1 flex-row items-end justify-between gap-3">
            <Amount value={money(Math.abs(kept))} variant="hero" tone={kept >= 0 ? "income" : "expense"} />
            {rate !== null ? (
              <View className="mb-2 rounded-full px-2.5 py-1" style={{ backgroundColor: colors.accentSoft }}>
                <Text variant="footnote" className="font-semibold" style={{ color: colors.accentText }}>
                  {`${rate}% saved`}
                </Text>
              </View>
            ) : null}
          </View>
          <View className="mt-4 h-2.5 flex-row-reverse overflow-hidden rounded-full" style={{ backgroundColor: colors.income }}>
            <View style={{ width: `${outShare * 100}%`, backgroundColor: colors.expense }} />
          </View>
          <View className="mt-3 flex-row">
            <Side label="Came in" value={`+${money(income)}`} tone="income" />
            <Side label="Went out" value={`−${money(spent)}`} tone="expense" end />
          </View>
        </View>
      </HeroWash>

      {years.length > 0 ? (
        <>
          <Text
            variant="footnote"
            tone="secondary"
            accessibilityRole="header"
            className="px-5 pb-2 pt-6 font-semibold uppercase tracking-[1.4px]"
          >
            {yearTitle}
          </Text>
          <HeroWash className="mt-0">
            {[...years].reverse().map((y, i) => (
              <YearLine key={y.key} year={y} index={i} money={money} />
            ))}
          </HeroWash>
        </>
      ) : null}
    </View>
  );
}

function Side({ label, value, tone, end }: { label: string; value: string; tone: "income" | "expense"; end?: boolean }) {
  return (
    <View className={`flex-1 ${end ? "items-end" : ""}`}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="headline" tone={tone} numeric numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function YearLine({ year, index, money }: { year: YearRow; index: number; money: (v: number) => string }) {
  const { colors } = useTokens();
  const kept = year.income - year.spent;
  const rate = rateOf(year.income, year.spent);
  const outShare = year.income > 0 ? Math.min(1, year.spent / year.income) : 1;
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(260)}
      className={`px-5 py-4 ${index > 0 ? "border-t border-separator" : ""}`}
    >
      <View className="flex-row items-center justify-between">
        <Text variant="headline">{year.label}</Text>
        <Text variant="subhead" numeric tone={kept >= 0 ? "income" : "expense"}>
          {`${kept >= 0 ? "+" : "−"}${money(Math.abs(kept))}${rate !== null ? ` · ${rate}%` : ""}`}
        </Text>
      </View>
      <View className="mt-2.5 h-1.5 flex-row-reverse overflow-hidden rounded-full" style={{ backgroundColor: colors.income }}>
        <View style={{ width: `${outShare * 100}%`, backgroundColor: colors.expense }} />
      </View>
      <View className="mt-2 flex-row justify-between">
        <Text variant="caption" tone="secondary" numeric>
          {`In +${money(year.income)}`}
        </Text>
        <Text variant="caption" tone="secondary" numeric>
          {`Out −${money(year.spent)}`}
        </Text>
      </View>
    </Animated.View>
  );
}
