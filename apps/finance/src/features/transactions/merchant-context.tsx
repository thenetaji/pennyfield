import * as React from "react";
import { View } from "react-native";

import type { BudgetSpent, MerchantHistory } from "@/data/hooks";
import { ordinal } from "@/features/budgets/logic";
import { fullDayLabel } from "@studio/dates";
import { formatMoney } from "@studio/money";
import { Card, Pressable, Text } from "@studio/ui";
import { useTokens } from "@studio/theme";

const BARS = 12;
const BAR_HEIGHT = 36;


type Props = {
  title: string;
  history: MerchantHistory | null;
  budget: BudgetSpent | undefined;
  currency: string;
  locale?: string;
  onOpenMerchant: () => void;
  onOpenBudget: () => void;
};

/** Where this payment sits: earlier payments to the same merchant, and the category budget it draws on. */
function MerchantContext({
  title,
  history,
  budget,
  currency,
  locale,
  onOpenMerchant,
  onOpenBudget,
}: Props) {
  const { colors } = useTokens();
  const money = (minor: number) =>
    formatMoney(minor, currency, { locale, sign: "none", decimals: 0 });
  const recent = history ? history.payments.slice(-BARS) : [];
  const current = history?.payments[history.position - 1]?.id;
  const max = Math.max(1, ...recent.map((p) => p.amount));

  return (
    <Card className="overflow-hidden rounded-[20px] p-0">
      {history ? (
        <Pressable
          role="button"
          accessibilityLabel={`${ordinal(history.position)} of ${history.payments.length} payments to ${title}, average ${money(history.average)}`}
          accessibilityHint="Opens every payment to this merchant"
          scale={0.99}
          onPress={onOpenMerchant}
          className="gap-3 px-4 py-3.5"
        >
          <View className="flex-row items-end justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {`${ordinal(history.position)} of ${history.payments.length} to ${title}`}
              </Text>
              <Text variant="headline" numeric>
                {`Avg ${money(history.average)}`}
              </Text>
            </View>
            <View className="items-end">
              <Text variant="caption" tone="secondary">
                {`Since ${fullDayLabel(history.firstDate)}`}
              </Text>
              <Text variant="footnote" numeric className="font-semibold">
                {money(history.total)}
              </Text>
            </View>
          </View>
          <View
            className="flex-row items-end gap-1"
            style={{ height: BAR_HEIGHT }}
            importantForAccessibility="no-hide-descendants"
          >
            {recent.map((p) => (
              <View
                key={p.id}
                className="flex-1 rounded-[3px]"
                style={{
                  height: Math.max(3, (p.amount / max) * BAR_HEIGHT),
                  backgroundColor:
                    p.id === current ? colors.accent : colors.textTertiary,
                  opacity: p.id === current ? 1 : 0.45,
                }}
              />
            ))}
          </View>
        </Pressable>
      ) : null}
      {history && budget ? <View className="mx-4 h-px bg-border" /> : null}
      {budget ? (
        <Pressable
          role="button"
          accessibilityLabel={`${budget.budget.name}, ${money(budget.spent)} of ${money(budget.available)}`}
          scale={0.99}
          onPress={onOpenBudget}
          className="gap-2 px-4 py-3.5"
        >
          <View className="flex-row justify-between gap-3">
            <Text variant="footnote" numberOfLines={1} className="min-w-0 flex-1">
              {budget.budget.name}
            </Text>
            <Text
              variant="footnote"
              numeric
              tone={budget.remaining < 0 ? "warning" : "secondary"}
            >
              {budget.remaining < 0
                ? `${money(-budget.remaining)} over`
                : `${money(budget.remaining)} left of ${money(budget.available)}`}
            </Text>
          </View>
          <View className="h-1.5 overflow-hidden rounded-full bg-fill">
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, budget.available > 0 ? (budget.spent / budget.available) * 100 : 100)}%`,
                backgroundColor: budget.remaining < 0 ? colors.warning : colors.accent,
              }}
            />
          </View>
        </Pressable>
      ) : null}
    </Card>
  );
}

export { MerchantContext };
