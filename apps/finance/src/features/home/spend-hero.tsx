import { useRouter } from "expo-router";
import * as React from "react";
import { ActionSheetIOS, Platform, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import {
  SymbolIcon,
  Pressable,
  Text,
  AnimatedNumber,
  Card,
  OptionPicker,
  type Option,
  type TextTone,
} from "@studio/ui";
import { evenPace, foldOlder, withSkia } from "@studio/charts";
import { useSetting, type AllTimeSpend, type HomeSpend } from "@/data/hooks";
import { addDays, monthShort, parseKey } from "@studio/dates";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { haptic, useTokens, withAlpha } from "@studio/theme";

import { flowAmount } from "@/features/insights/labels";

import type { SpendCurveProps, TideBarsProps } from "@studio/charts/components";

import { useHeroPeriod, type HeroPeriod } from "./period-store";
import { paceDelta } from "./curve";
import { WeekStrip } from "./week-strip";

/** Skia loads lazily (CanvasKit first on web), keeping chart code out of the initial graph. */
const SpendCurve = withSkia<SpendCurveProps>(() =>
  import("@studio/charts/components").then((m) => ({ default: m.SpendCurve })),
);
const TideBars = withSkia<TideBarsProps>(() =>
  import("@studio/charts/components").then((m) => ({ default: m.TideBars })),
);

const MAX_BARS = 12;
const PERIOD_OPTIONS: readonly Option<HeroPeriod>[] = [
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

type SpendHeroProps = {
  spend: HomeSpend;
  allTime: AllTimeSpend;
  /** "October". */
  monthLabel: string;
  /** "September". */
  previousLabel: string;
  /** Last day of the month, for the right-hand date label. */
  monthEnd: string;
  /** What the all-spending monthly budget allows in the display currency (amount plus rollover); 0 without one. */
  budget: number;
  /** The budget's pace status is at risk or over: only then is running ahead of the even pace a warning. */
  budgetAtRisk?: boolean;
  /** Formatted income this month, shown in the strip when there is no budget. */
  earned: string;
  earnedZero: boolean;
  locale?: string;
  showDecimals: boolean;
};

/** Native action sheet on iOS; the app's own picker sheet elsewhere. */
function usePeriodMenu(
  period: HeroPeriod,
  onChange: (next: HeroPeriod) => void,
) {
  const [open, setOpen] = React.useState(false);
  const show = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            ...PERIOD_OPTIONS.map((o) =>
              o.value === period ? `${o.label}  ✓` : o.label,
            ),
            "Cancel",
          ],
          cancelButtonIndex: PERIOD_OPTIONS.length,
        },
        (index) => {
          const next = PERIOD_OPTIONS[index];
          if (next) onChange(next.value);
        },
      );
    } else setOpen(true);
  };
  const picker = (
    <OptionPicker
      visible={open}
      title="Spent"
      options={PERIOD_OPTIONS}
      selected={period}
      onSelect={onChange}
      onClose={() => setOpen(false)}
    />
  );
  return { show, picker };
}

/** Splits "₹8,07,855" into the symbol (drawn smaller) and the rolling digits. Suffix symbols stay with the digits. */
function splitSymbol(formatted: string): { symbol: string; digits: string } {
  const match = /^([−+-]?[^\d•]*)(.*)$/.exec(formatted);
  const symbol = match?.[1] ?? "";
  return symbol && match?.[2]
    ? { symbol, digits: match[2] }
    : { symbol: "", digits: formatted };
}

function Stat({
  label,
  value,
  tone,
  divider,
}: {
  label: string;
  value: string;
  tone?: TextTone;
  divider?: boolean;
}) {
  const { colors } = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      className="flex-1 px-4"
      style={
        divider
          ? {
              borderLeftWidth: StyleSheet.hairlineWidth * 2,
              borderLeftColor: colors.separator,
            }
          : null
      }
    >
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
      <AnimatedNumber
        value={value}
        variant="headline"
        tone={tone}
        fit
        align="left"
        intro
        className="mt-0.5 font-semibold"
      />
    </View>
  );
}

/**
 * The Home hero, spending first: a period label (menu: this month or all time), the total as the one big number
 * (long-press hides amounts), how it compares with the budget pace or last month at the same day, the spend curve,
 * then today, the daily average and what is left of the budget.
 */
function SpendHero({
  spend,
  allTime,
  monthLabel,
  previousLabel,
  monthEnd,
  budget,
  budgetAtRisk = false,
  earned,
  earnedZero,
  locale,
  showDecimals,
}: SpendHeroProps) {
  const router = useRouter();
  const { colors } = useTokens();
  const [hidden, setHidden] = useSetting("hide_amounts");
  const toggleHidden = () => {
    haptic("medium");
    setHidden(!hidden);
  };
  const period = useHeroPeriod((s) => s.period);
  const setPeriod = useHeroPeriod((s) => s.set);
  const all = period === "all";
  const menu = usePeriodMenu(period, (next) => {
    if (next === period) return;
    haptic("selection");
    setPeriod(next);
  });

  const decimals = showDecimals ? undefined : 0;
  const total = all ? allTime.spent : spend.spent;
  const currency = all ? allTime.currency : spend.currency;
  const formatted = formatMoney(total, currency, {
    locale,
    sign: "none",
    decimals,
  });
  const label = all ? "Spent all time" : `Spent in ${monthLabel}`;
  const days = spend.series.length;

  const actual = React.useMemo(
    () => spend.series.flatMap((d) => (d.actual === null ? [] : [d.actual])),
    [spend.series],
  );
  const hasBudget = budget > 0;
  const hasPrevious = spend.previousTotal > 0;
  const reference = React.useMemo(
    () =>
      hasBudget
        ? evenPace(budget, days)
        : hasPrevious
          ? spend.series.map((d) => d.pace)
          : [],
    [hasBudget, hasPrevious, budget, days, spend.series],
  );
  const referenceName = hasBudget ? "Budget" : hasPrevious ? previousLabel : "";
  const delta = paceDelta(actual, reference);
  const money = (minor: number) => flowAmount(minor, currency, locale);
  const against = hasBudget ? "budget pace" : previousLabel;
  const deltaText =
    delta === null || referenceName === ""
      ? ""
      : delta === 0
        ? `On ${against}`
        : `${money(Math.abs(delta))} ${delta < 0 ? "under" : "over"} ${against}`;
  const over = delta !== null && delta > 0;
  const deltaTone = over
    ? hasBudget && budgetAtRisk
      ? colors.warning
      : colors.textSecondary
    : colors.income;

  const bars = React.useMemo(
    () =>
      foldOlder(
        allTime.months.map((m, i) => ({
          label: m.label,
          amount: m.amount,
          current: i === allTime.months.length - 1,
        })),
        MAX_BARS,
      ),
    [allTime.months],
  );
  const dayLabel = (i: number) => {
    const { month, day } = parseKey(addDays(spend.from, i));
    const ref = reference[i];
    const value = actual[i];
    return [
      `${day} ${monthShort(month)}`,
      value !== undefined ? money(value) : "",
      ref !== undefined && referenceName
        ? `${referenceName} ${money(ref)}`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
  };
  const barLabel = (i: number) =>
    `${bars[i]?.label ?? ""} · ${flowAmount(bars[i]?.amount ?? 0, allTime.currency, locale)}`;
  const hasChart = all
    ? bars.length > 0
    : actual.some((v) => v > 0) || reference.length > 0;
  const speech = formatMoneyForSpeech(total, currency, {
    sign: "none",
    locale,
  });
  const { symbol, digits } = splitSymbol(formatted);
  const fmt = (minor: number) =>
    formatMoney(minor, spend.currency, { locale, sign: "none", decimals });
  const today =
    (actual[spend.dayIndex] ?? 0) - (actual[spend.dayIndex - 1] ?? 0);
  const left = budget - spend.spent;
  const start = parseKey(spend.from);
  const end = parseKey(monthEnd);

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Pressable
          role="button"
          accessibilityLabel={`${label}, ${speech}`}
          accessibilityHint="Change period"
          scale={0.99}
          onPress={menu.show}
          style={{
            minHeight: 40,
            justifyContent: "center",
            alignSelf: "flex-start",
            paddingRight: 8,
          }}
        >
          <Animated.View
            key={label}
            entering={FadeIn.duration(150)}
            className="flex-row items-center gap-1"
          >
            <Text variant="subhead" tone="secondary" className="font-medium">
              {label}
            </Text>
            <SymbolIcon
              name="chevron.down"
              size={11}
              color={colors.textTertiary}
              weight="bold"
            />
          </Animated.View>
        </Pressable>
      </View>
      <Pressable
        accessibilityLabel={speech}
        accessibilityActions={[
          {
            name: "longpress",
            label: hidden ? "Show amounts" : "Hide amounts",
          },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "longpress") toggleHidden();
        }}
        scale={0.99}
        onLongPress={toggleHidden}
        delayLongPress={450}
      >
        <View className="flex-row items-start" style={{ flexShrink: 1 }}>
          {symbol ? (
            <Text
              variant="display"
              className="mr-px text-[44px] font-semibold tracking-[-0.9px]"
              style={{ marginTop: 3 }}
            >
              {symbol}
            </Text>
          ) : null}
          <AnimatedNumber
            value={digits}
            variant="display"
            intro
            fit
            accessibilityLabel={formatted}
          />
        </View>
      </Pressable>
      {!all && deltaText ? (
        <Animated.View
          entering={FadeIn.delay(300).duration(220)}
          className="mt-1.5 flex-row items-center gap-1 self-start rounded-full px-2.5 py-1"
          style={{ backgroundColor: withAlpha(deltaTone, 0.12) }}
        >
          <SymbolIcon
            name={over ? "arrow-up-right" : "arrow-down-right"}
            size={12}
            color={deltaTone}
          />
          <Text
            variant="footnote"
            numeric
            numberOfLines={1}
            style={{ color: deltaTone }}
            className="font-semibold"
          >
            {deltaText}
          </Text>
        </Animated.View>
      ) : null}
      {hasChart ? (
        <Animated.View
          key={period}
          entering={FadeIn.duration(200)}
          className="mt-1"
        >
          {all ? (
            <View className="mt-3">
              <TideBars
                bars={bars}
                formatLabel={barLabel}
                accessibilityLabel={`Spent per month, ${speech} in total`}
              />
            </View>
          ) : (
            <SpendCurve
              actual={actual}
              reference={reference}
              days={days}
              formatLabel={dayLabel}
              startLabel={`${start.day} ${monthShort(start.month)}`}
              endLabel={`${end.day} ${monthShort(end.month)}`}
              referenceLabel={
                reference.length > 0 && referenceName
                  ? `${referenceName} ${money(reference[reference.length - 1] ?? 0)}`
                  : undefined
              }
              accessibilityLabel={`Spent in ${monthLabel}, ${speech} so far${deltaText ? `, ${deltaText}` : ""}`}
            />
          )}
        </Animated.View>
      ) : null}
      {!all ? (
        <Card className="mt-4 flex-row rounded-[20px] px-0 py-3.5">
          <Stat
            label="Today"
            value={fmt(today)}
            tone={today > 0 ? undefined : "tertiary"}
          />
          <Stat label="Per day" value={fmt(spend.perDay)} divider />
          {hasBudget ? (
            <Stat
              label={left >= 0 ? "Left" : "Over"}
              value={fmt(Math.abs(left))}
              tone={left >= 0 ? "income" : "expense"}
              divider
            />
          ) : (
            <Stat
              label="Earned"
              value={earned}
              tone={earnedZero ? "tertiary" : "income"}
              divider
            />
          )}
        </Card>
      ) : null}
      {!all && spend.week.length > 0 ? (
        <Card className="mt-3 rounded-[20px] px-4 pb-1 pt-3">
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
      ) : null}
      {menu.picker}
    </View>
  );
}

export { SpendHero, splitSymbol };
