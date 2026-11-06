import { addDays, diffDays, parseKey } from "@studio/dates";
import * as React from "react";
import { View } from "react-native";

import { useRangeDailyTotals, useTodayKey } from "@/data/hooks";
import { useTokens } from "@studio/theme";
import { Text } from "@studio/ui";

import { Chart3D } from "../../../modules/finance-chart3d";

const DAYS = 182;

export default function ThreeDScreen() {
  const { colors } = useTokens();
  const today = useTodayKey();
  const from = addDays(today, -DAYS);
  const totals = useRangeDailyTotals(from, today);
  const points = React.useMemo(
    () =>
      totals.days
        .filter((d) => d.amount > 0)
        .map((d) => {
          const { year, month, day } = parseKey(d.dateKey);
          return {
            week: Math.floor(diffDays(from, d.dateKey) / 7),
            weekday: new Date(year, month - 1, day).getDay(),
            amount: d.amount / 100,
          };
        }),
    [totals.days, from],
  );
  return (
    <View className="flex-1 gap-3 bg-bg px-4 pb-8 pt-2">
      <Text variant="subhead" tone="secondary">
        Each dot is a day from the last six months. Drag to turn it.
      </Text>
      <Chart3D points={points} tint={colors.chart} style={{ flex: 1 }} />
    </View>
  );
}
