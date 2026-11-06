import { useRouter } from "expo-router";
import { View } from "react-native";

import type { HomeSpend } from "@/data/hooks/homeSpend";
import { addDays } from "@studio/dates";
import { Card, Pressable, Text } from "@studio/ui";

import { WeekStrip } from "./week-strip";

export function WeekCard({
  spend,
  locale,
  showDecimals,
}: {
  spend: HomeSpend;
  locale?: string;
  showDecimals: boolean;
}) {
  const router = useRouter();
  return (
    <Card className="rounded-[20px] px-4 pb-1 pt-3">
      <View className="flex-row items-center justify-between">
        <Text variant="caption" tone="secondary">
          Last 7 days
        </Text>
        <Pressable
          role="button"
          accessibilityLabel="Spending calendar"
          hitSlop={8}
          scale={0.96}
          onPress={() => router.push("/calendar")}
        >
          <Text variant="caption" tone="accent" className="font-semibold">
            Calendar
          </Text>
        </Pressable>
      </View>
      <WeekStrip
        days={spend.week}
        todayKey={addDays(spend.from, spend.dayIndex)}
        currency={spend.currency}
        locale={locale}
        showDecimals={showDecimals}
      />
    </Card>
  );
}
