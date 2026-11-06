import { useSetting, useSettings, useTodayKey } from "@/data/hooks";
import { useMoneyContext } from "@/features/transactions/use-money-context";
import { workTimeLabel } from "@/lib/explore/work-time";
import { monthPeriodsEnding } from "@/lib/insights";
import { formatMoney } from "@studio/money";
import * as React from "react";
import { useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import { Platform } from "react-native";
import { SensorType, useAnimatedSensor, useDerivedValue } from "react-native-reanimated";

/** The display currency's formatter, honouring Hide amounts and the decimals setting. */
export function useMoneyText() {
  const money = useMoneyContext();
  return React.useCallback(
    (minor: number) =>
      formatMoney(minor, money.displayCurrency, {
        locale: money.locale,
        sign: "none",
        decimals: money.showDecimals ? undefined : 0,
      }),
    [money.displayCurrency, money.locale, money.showDecimals],
  );
}

/** "3.5 hours" when hourly pay is set, otherwise null. */
export function useWorkTime() {
  const [hourlyPay] = useSetting("hourly_pay");
  return React.useCallback(
    (minor: number) => (hourlyPay ? workTimeLabel(minor, hourlyPay) : null),
    [hourlyPay],
  );
}

/** Calendar months up to this one, honouring the month-start setting, oldest first. */
export function useMonths(count: number) {
  const settings = useSettings();
  const today = useTodayKey();
  return React.useMemo(
    () =>
      monthPeriodsEnding(today, count, {
        weekStart: settings.week_start,
        monthStart: settings.month_start,
      })
        .slice()
        .sort((a, b) => (a.from < b.from ? -1 : 1)),
    [today, count, settings.week_start, settings.month_start],
  );
}

function useStillTilt(): SharedValue<{ x: number; y: number }> {
  return useSharedValue({ x: 0, y: 0 });
}

function useSensorTilt(): SharedValue<{ x: number; y: number }> {
  const reduced = useReducedMotion();
  const sensor = useAnimatedSensor(SensorType.GRAVITY, { interval: 32 });
  return useDerivedValue(() =>
    reduced ? { x: 0, y: 0 } : { x: sensor.sensor.value.x / 9.81, y: sensor.sensor.value.y / 9.81 },
  );
}

/** Which way the phone leans, -1 to 1; browsers stay level. */
export const useTilt = Platform.OS === "web" ? useStillTilt : useSensorTilt;
