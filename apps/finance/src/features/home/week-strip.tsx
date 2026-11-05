import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { Pressable } from "@studio/ui";
import { withSkia } from "@studio/charts";
import { addDays, dayLabel, weekday } from "@studio/dates";
import { formatMoney } from "@studio/money";

import type { MiniBarsProps } from "@studio/charts/components";

const MiniBars = withSkia<MiniBarsProps>(() =>
  import("@studio/charts/components").then((m) => ({ default: m.MiniBars })),
);

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const LANE = 16;
const HEIGHT = 36;
const AXIS = 24;

type WeekStripProps = {
  /** Daily spend, oldest first, the last entry being today. */
  days: readonly number[];
  todayKey: string;
  currency: string;
  locale?: string;
  showDecimals: boolean;
};

/** The last seven days as small bars with weekday initials; today is highlighted and each bar opens that day. */
function WeekStrip({
  days,
  todayKey,
  currency,
  locale,
  showDecimals,
}: WeekStripProps) {
  const router = useRouter();
  const keys = React.useMemo(
    () => days.map((_, i) => addDays(todayKey, i - (days.length - 1))),
    [days, todayKey],
  );
  const data = React.useMemo(
    () =>
      keys.map((key, i) => ({
        key,
        label: LETTERS[weekday(key) - 1] ?? "",
        value: days[i] ?? 0,
      })),
    [keys, days],
  );
  const today = days.length - 1;
  const fmt = (minor: number) =>
    formatMoney(minor, currency, {
      locale,
      sign: "none",
      decimals: showDecimals ? undefined : 0,
    });
  const open = (key: string) =>
    router.push({ pathname: "/activity", params: { day: key } });

  return (
    <View style={{ height: LANE + HEIGHT + AXIS }}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <MiniBars
          data={data}
          currentIndex={today}
          selectedIndex={today}
          onSelect={() => {}}
          formatValue={(i) => fmt(days[i] ?? 0)}
          accessibilityLabel="Last seven days"
          height={HEIGHT}
          lane={LANE}
        />
      </View>
      <View className="absolute inset-0 flex-row">
        {keys.map((key, i) => (
          <Pressable
            key={key}
            role="button"
            scale={0.96}
            haptic="selection"
            accessibilityLabel={`${dayLabel(key, todayKey)}, ${(days[i] ?? 0) > 0 ? fmt(days[i] ?? 0) : "nothing spent"}`}
            accessibilityHint="Shows that day's transactions"
            onPress={() => open(key)}
            className="flex-1"
          />
        ))}
      </View>
    </View>
  );
}

export { WeekStrip };
