import { useRouter } from "expo-router";
import * as React from "react";
import { StyleSheet, View } from "react-native";

import { IconTile, Card, Pressable, Text } from "@studio/ui";
import type { Insights } from "@/data/hooks";
import { formatMoney } from "@studio/money";
import { withAlpha, type CategoryColorKey } from "@studio/theme";
import { useTokens } from "@studio/theme";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { shareOfMax } from "@/features/insights/share";

import { HomeSectionHeader } from "./section-header";

const ROWS = 4;
const easeOutQuint = Easing.bezier(0.22, 1, 0.36, 1);

function ShareBar({
  share,
  color,
  index,
}: {
  share: number;
  color: string;
  index: number;
}) {
  const { colors } = useTokens();
  const reduced = useReducedMotion();
  const target = share;
  const grow = useSharedValue(reduced ? target : 0);
  React.useEffect(() => {
    grow.value = reduced
      ? target
      : withDelay(
          500 + index * 40,
          withTiming(target, { duration: 500, easing: easeOutQuint }),
        );
  }, [grow, target, reduced, index]);
  const style = useAnimatedStyle(() => ({ width: `${grow.value * 100}%` }));
  return (
    <View
      className="mt-2 h-[3px] w-full overflow-hidden rounded-full"
      style={{ backgroundColor: withAlpha(colors.text, 0.06) }}
    >
      <Animated.View
        className="h-full rounded-full"
        style={[{ backgroundColor: color }, style]}
      />
    </View>
  );
}

type TopCategoriesProps = {
  insights: Insights;
  locale?: string;
  showDecimals: boolean;
};

/** Four largest categories as rows with a share bar scaled to the largest; each opens Insights on this month. */
function TopCategories({ insights, locale, showDecimals }: TopCategoriesProps) {
  const router = useRouter();
  const { category: palette, colors } = useTokens();
  const rows = insights.categories.slice(0, ROWS);
  if (rows.length === 0) return null;
  const decimals = showDecimals ? undefined : 0;
  const max = rows[0]?.amount ?? 0;
  const openInsights = (select?: string) =>
    router.navigate({
      pathname: "/insights",
      params: {
        period: "month",
        offset: "0",
        kind: insights.kind,
        nav: String(Date.now()),
        ...(select ? { select } : {}),
      },
    });

  return (
    <View>
      <HomeSectionHeader
        title="Top categories"
        actionLabel="Insights"
        onAction={() => openInsights()}
      />
      <Card className="overflow-hidden rounded-[20px] p-0">
        {rows.map((r, index) => {
          const key = (r.category?.color ?? "gray") as CategoryColorKey;
          const amount = formatMoney(r.amount, insights.currency, {
            locale,
            sign: "none",
            decimals,
          });
          return (
            <Pressable
              key={r.categoryId ?? "none"}
              role="button"
              scale={1}
              accessibilityLabel={`${r.category?.name ?? "Uncategorised"}, ${amount}, ${r.percent} percent`}
              onPress={() => openInsights(r.category?.name)}
              className="min-h-[62px] flex-row items-center gap-3 px-4 py-3 active:bg-fill"
              style={
                index > 0
                  ? {
                      borderTopWidth: StyleSheet.hairlineWidth * 2,
                      borderTopColor: colors.separator,
                    }
                  : null
              }
            >
              <IconTile
                icon={r.category?.icon ?? "tag.fill"}
                color={key}
                size={36}
              />
              <View className="min-w-0 flex-1">
                <Text
                  variant="callout"
                  numberOfLines={1}
                  className="font-medium tracking-[-0.2px]"
                >
                  {r.category?.name ?? "Uncategorised"}
                </Text>
                <ShareBar
                  share={shareOfMax(r.amount, max)}
                  color={palette[key]}
                  index={index}
                />
              </View>
              <View className="items-end">
                <Text
                  variant="callout"
                  numeric
                  className="font-semibold tracking-[-0.2px]"
                >
                  {amount}
                </Text>
                <Text
                  variant="caption"
                  tone="tertiary"
                  numeric
                  className="mt-[3px]"
                >
                  {`${r.percent}%`}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}

export { TopCategories };
