import * as React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

import { IconTile, Pressable, Text } from "@studio/ui";
import { Sparkline } from "@studio/charts/components";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { durations, haptic, type CategoryColorKey } from "@studio/theme";
import { useTokens } from "@studio/theme";

import { ShareBar } from "./share-bar";

export type CategoryListItem = {
  /** Category id; null for uncategorised lines (not drillable). */
  id: string | null;
  name: string;
  icon: string;
  color: CategoryColorKey;
  amount: number;
  percent: number;
  /** Against the previous period and its recent average; absent when there is no history to show. */
  trend?: CategoryListTrend;
};

export type CategoryListTrend = {
  /** One total per period, oldest first, ending with this one. */
  spark: readonly number[];
  /** Short change text: "12%", "New", "Same". */
  text: string;
  /** The change in money: "+₹2,400", "New", "Same". */
  amount: string;
  /** Arrow to draw before `text`. */
  arrow: "up" | "down" | null;
  /** True when the change is the welcome direction (spending fell, income rose). */
  good: boolean;
  /** Spoken form, e.g. "up 12 percent on September, 3-month average 4,100 rupees". */
  speech: string;
};

type CategoryListProps = {
  items: readonly CategoryListItem[];
  currency: string;
  locale?: string;
  showDecimals: boolean;
  onPress: (item: CategoryListItem) => void;
};

function CategoryRow({
  item,
  currency,
  locale,
  showDecimals,
  last,
  max,
  asPercent,
  onTogglePercent,
  onPress,
}: Omit<CategoryListProps, "items" | "onPress"> & {
  item: CategoryListItem;
  last: boolean;
  max: number;
  asPercent: boolean;
  onTogglePercent: () => void;
  onPress: () => void;
}) {
  const { colors, category } = useTokens();
  const amount = formatMoney(item.amount, currency, {
    locale,
    decimals: showDecimals ? undefined : 0,
  });
  const trend = item.trend;
  return (
    <Pressable
      role="button"
      disabled={item.id === null}
      accessibilityLabel={`${item.name}, ${formatMoneyForSpeech(item.amount, currency, { sign: "none", locale })}, ${item.percent} percent`}
      accessibilityHint={trend?.speech}
      onPress={onPress}
      scale={1}
      className="min-h-[60px] flex-row items-center bg-surface px-4 py-2.5 active:bg-fill"
    >
      <IconTile icon={item.icon} color={item.color} />
      <View className="ml-3 flex-1">
        <Text variant="body" numberOfLines={1}>
          {item.name}
        </Text>
        <ShareBar amount={item.amount} max={max} color={category[item.color]} />
      </View>
      {trend ? (
        <Pressable
          role="button"
          scale={1}
          dimTo={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityLabel={`${trend.speech}, show ${asPercent ? "amount" : "percent"}`}
          onPress={() => {
            haptic("selection");
            onTogglePercent();
          }}
          className="ml-3 items-center"
          style={{ width: 60 }}
        >
          <Sparkline
            values={trend.spark}
            width={48}
            height={20}
            endColor={category[item.color]}
          />
          <View className="mt-0.5 flex-row items-center">
            {trend.arrow && asPercent ? (
              <Text
                variant="caption"
                tone={trend.good ? "income" : "tertiary"}
                className="mr-0.5"
                style={{ fontSize: 8, lineHeight: 12 }}
              >
                {trend.arrow === "up" ? "▲" : "▼"}
              </Text>
            ) : null}
            <Text
              variant="caption"
              tone={trend.good ? "income" : "tertiary"}
              numeric
              numberOfLines={1}
            >
              {asPercent ? trend.text : trend.amount}
            </Text>
          </View>
        </Pressable>
      ) : null}
      <View className="ml-4 items-end" style={{ minWidth: 72 }}>
        <Text variant="body" numeric numberOfLines={1} className="font-medium">
          {amount}
        </Text>
        <Text variant="footnote" tone="tertiary" numeric>
          {item.percent}%
        </Text>
      </View>
      {last ? null : (
        <View
          pointerEvents="none"
          style={{
            left: 64,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.separator,
          }}
          className="absolute bottom-0 right-0"
        />
      )}
    </Pressable>
  );
}

/** One row per category: icon, name, share bar, change badge, amount and percent. */
function CategoryList({
  items,
  currency,
  locale,
  showDecimals,
  onPress,
}: CategoryListProps) {
  const [asPercent, setAsPercent] = React.useState(false);
  const max = items.reduce((m, item) => Math.max(m, item.amount), 0);
  const togglePercent = React.useCallback(() => setAsPercent((v) => !v), []);
  return (
    <>
      {items.map((item, index) => (
        <Animated.View
          key={item.id ?? "none"}
          layout={LinearTransition.duration(durations.row)}
        >
          <CategoryRow
            item={item}
            currency={currency}
            locale={locale}
            showDecimals={showDecimals}
            last={index === items.length - 1}
            max={max}
            asPercent={asPercent}
            onTogglePercent={togglePercent}
            onPress={() => onPress(item)}
          />
        </Animated.View>
      ))}
    </>
  );
}

export { CategoryList };
