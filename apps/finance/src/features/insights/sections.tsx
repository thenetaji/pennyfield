import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { Card, Pressable, Text, AnimatedNumber } from "@studio/ui";
import type { InsightsExtras } from "@/data/hooks";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";

import { percentText } from "./labels";

const TILE = { flex: 1, flexBasis: 0, minWidth: 0 } as const;

type MoneyProps = { currency: string; locale?: string };

type TileProps = {
  label: string;
  value: string;
  caption?: string;
  tone?: "default" | "income";
  onPress?: () => void;
  accessibilityLabel: string;
};

function Tile({
  label,
  value,
  caption,
  tone = "default",
  onPress,
  accessibilityLabel,
}: TileProps) {
  const body = (
    <>
      <Text variant="footnote" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
      <AnimatedNumber
        value={value}
        variant="headline"
        tone={tone}
        fit
        className="mt-1"
      />
      {caption ? (
        <Text
          variant="caption"
          tone="tertiary"
          numberOfLines={1}
          className="mt-0.5"
        >
          {caption}
        </Text>
      ) : null}
    </>
  );
  if (!onPress) {
    return (
      <Card
        className="rounded-[16px] px-4 py-3"
        style={TILE}
        accessible
        accessibilityLabel={accessibilityLabel}
      >
        {body}
      </Card>
    );
  }
  return (
    <Pressable
      role="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      scale={0.98}
      style={TILE}
    >
      <Card className="flex-1 rounded-[16px] px-4 py-3">{body}</Card>
    </Pressable>
  );
}

type StatsGridProps = MoneyProps & { extras: InsightsExtras; both?: boolean };

/** Daily average, biggest, count and savings rate as four compact tiles. */
const StatsGrid = React.memo(function StatsGrid({
  extras,
  both = false,
  currency,
  locale,
}: StatsGridProps) {
  const router = useRouter();
  const money = (value: number) =>
    formatMoney(value, currency, { locale, decimals: 0 });
  const speech = (value: number) =>
    formatMoneyForSpeech(value, currency, { sign: "none", locale });
  const { biggest, savingsRate } = extras;
  const biggestName = biggest
    ? biggest.title || biggest.category?.name || "Untitled"
    : undefined;
  const rate = percentText(savingsRate);
  return (
    <View className="gap-3 px-4">
      <View className="flex-row gap-3">
        <Tile
          label={both ? "Daily spend" : "Daily average"}
          value={money(extras.dailyAverage)}
          accessibilityLabel={`${both ? "Daily spend" : "Daily average"}, ${speech(extras.dailyAverage)}`}
        />
        {both ? (
          <Tile
            label="Savings rate"
            value={rate}
            tone={
              savingsRate !== null && savingsRate >= 0 ? "income" : "default"
            }
            accessibilityLabel={
              savingsRate === null
                ? "Savings rate, nothing earned"
                : `Savings rate, ${savingsRate} percent`
            }
          />
        ) : (
          <Tile
            label="Transactions"
            value={String(extras.transactionCount)}
            accessibilityLabel={`${extras.transactionCount} transactions`}
          />
        )}
      </View>
      <View className="flex-row gap-3">
        <Tile
          label={both ? "Biggest expense" : "Biggest"}
          value={biggest ? money(biggest.amount) : "—"}
          caption={biggestName}
          accessibilityLabel={
            biggest
              ? `Biggest, ${biggestName}, ${speech(biggest.amount)}`
              : "Biggest, none"
          }
          onPress={
            biggest
              ? () =>
                  router.push({
                    pathname: "/transaction/[id]",
                    params: { id: biggest.transactionId },
                  })
              : undefined
          }
        />
        {both ? (
          <Tile
            label="Expenses"
            value={String(extras.transactionCount)}
            accessibilityLabel={`${extras.transactionCount} expenses`}
          />
        ) : (
          <Tile
            label="Savings rate"
            value={rate}
            tone={
              savingsRate !== null && savingsRate >= 0 ? "income" : "default"
            }
            accessibilityLabel={
              savingsRate === null
                ? "Savings rate, nothing earned"
                : `Savings rate, ${savingsRate} percent`
            }
          />
        )}
      </View>
    </View>
  );
});

export { StatsGrid };
