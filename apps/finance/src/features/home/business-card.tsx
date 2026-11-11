import { useRouter } from "expo-router";
import { View } from "react-native";

import { formatMoney } from "@studio/money";
import { Card, Pressable, Text } from "@studio/ui";

/** This month's business money, kept apart from the personal figures in the hero. */
export function BusinessCard({
  earned,
  spent,
  currency,
  locale,
  showDecimals,
}: {
  earned: number;
  spent: number;
  currency: string;
  locale?: string;
  showDecimals: boolean;
}) {
  const router = useRouter();
  const decimals = showDecimals ? undefined : 0;
  const fmt = (minor: number, sign: "none" | "auto" = "none") =>
    formatMoney(minor, currency, { locale, sign, decimals });
  const profit = earned - spent;
  const cells = [
    { label: "In", value: fmt(earned) },
    { label: "Out", value: fmt(spent) },
    { label: "Profit", value: fmt(profit, "auto") },
  ];
  return (
    <Pressable
      role="button"
      accessibilityLabel={`Business this month, ${cells.map((c) => `${c.label} ${c.value}`).join(", ")}`}
      scale={0.98}
      onPress={() => router.push("/business")}
    >
      <Card className="gap-2 rounded-[20px] px-4 py-3">
        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="secondary">
            Business this month
          </Text>
          <Text variant="caption" tone="accent" className="font-semibold">
            Details
          </Text>
        </View>
        <View className="flex-row">
          {cells.map((c) => (
            <View key={c.label} className="flex-1 gap-0.5">
              <Text variant="footnote" tone="secondary">
                {c.label}
              </Text>
              <Text variant="headline" numeric numberOfLines={1}>
                {c.value}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </Pressable>
  );
}
