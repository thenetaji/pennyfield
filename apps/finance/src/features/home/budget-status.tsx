import { useRouter } from "expo-router";
import * as React from "react";
import { StyleSheet, View } from "react-native";

import { Card, Pressable, Text } from "@studio/ui";
import type { BudgetSpent } from "@/data/hooks";
import type { CategoryRow } from "@/db/schema";
import { toBudgetView, type BudgetView } from "@/features/budgets/model";
import { pressScale, useTokens, withAlpha } from "@studio/theme";

import { HomeSectionHeader } from "./section-header";

const ROWS = 4;
const SEVERITY: Record<BudgetView["status"], number> = {
  over: 0,
  at_risk: 1,
  on_track: 2,
};

/** Spent, then bills still due, on the empty track of what is left; spend past the limit runs on in the warning colour. */
function SlimBar({ view }: { view: BudgetView }) {
  const { colors } = useTokens();
  const over = view.ratio > 1;
  const scale = Math.max(view.ratio, 1);
  const pct = (v: number) => `${(Math.max(0, v) / scale) * 100}%` as const;
  return (
    <View
      className="mt-2 h-1.5 flex-row overflow-hidden rounded-full"
      style={{ backgroundColor: colors.fill }}
    >
      <View
        style={{ width: pct(Math.min(view.ratio, 1)), backgroundColor: colors.chart }}
      />
      <View
        style={{
          width: pct(view.upcomingRatio),
          backgroundColor: withAlpha(colors.chart, 0.5),
        }}
      />
      {over ? (
        <>
          <View
            style={{ width: pct(view.ratio - 1), backgroundColor: colors.warning }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: pct(1),
              top: 0,
              bottom: 0,
              width: 2,
              marginLeft: -1,
              backgroundColor: colors.surface,
            }}
          />
        </>
      ) : null}
    </View>
  );
}

function BudgetLine({
  view,
  separator,
  onPress,
}: {
  view: BudgetView;
  separator: boolean;
  onPress: () => void;
}) {
  const { colors } = useTokens();
  const over = view.ratio > 1;
  return (
    <Pressable
      role="button"
      accessibilityLabel={view.accessibilityLabel}
      scale={pressScale.row}
      onPress={onPress}
      className="px-4 py-3 active:bg-fill"
      style={
        separator
          ? {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.separator,
            }
          : null
      }
    >
      <View className="flex-row items-baseline justify-between gap-3">
        <Text variant="subhead" numberOfLines={1} className="min-w-0 flex-1 font-medium">
          {view.name}
        </Text>
        <Text
          variant="subhead"
          numeric
          numberOfLines={1}
          tone={over ? "warning" : "secondary"}
          className={over ? "font-semibold" : undefined}
        >
          {view.headline}
        </Text>
      </View>
      <SlimBar view={view} />
    </Pressable>
  );
}

type BudgetStatusProps = {
  budgets: readonly BudgetSpent[];
  categories: ReadonlyMap<string, CategoryRow>;
  todayKey: string;
  locale?: string;
  showDecimals: boolean;
};

/**
 * Budget status on Home, one slim bar per budget: the all-spending budget first, then category budgets that need attention (over, then at
 * risk, then the most used). Hidden when there are no budgets.
 */
function BudgetStatus({
  budgets,
  categories,
  todayKey,
  locale,
  showDecimals,
}: BudgetStatusProps) {
  const router = useRouter();
  const views = React.useMemo(() => {
    const all = budgets.map((p) =>
      toBudgetView(p, { locale, showDecimals, todayKey, categories }),
    );
    return all
      .sort(
        (a, b) =>
          (a.scope === "all" ? -1 : 0) - (b.scope === "all" ? -1 : 0) ||
          SEVERITY[a.status] - SEVERITY[b.status] ||
          b.ratio - a.ratio,
      )
      .slice(0, ROWS);
  }, [budgets, locale, showDecimals, todayKey, categories]);
  if (views.length === 0) return null;

  return (
    <View>
      <HomeSectionHeader
        title="Budgets"
        actionLabel="All"
        onAction={() => router.navigate("/budgets")}
      />
      <Card className="overflow-hidden rounded-[20px] p-0">
        {views.map((view, index) => (
          <BudgetLine
            key={view.id}
            view={view}
            separator={index < views.length - 1}
            onPress={() =>
              router.push({ pathname: "/budget/[id]", params: { id: view.id } })
            }
          />
        ))}
      </Card>
    </View>
  );
}

export { BudgetStatus };
