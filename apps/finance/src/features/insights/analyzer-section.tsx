import { useRouter } from "expo-router";
import * as React from "react";
import { StyleSheet, View } from "react-native";

import type { Analyzer, AnalyzerRepeat } from "@/data/hooks";
import { useActions } from "@/data/actions";
import { useAccounts } from "@/data/hooks";
import {
  Button,
  Card,
  IconTile,
  Pressable,
  Text,
  showToast,
} from "@studio/ui";
import { monthShort, parseKey } from "@studio/dates";
import { formatMoney } from "@studio/money";
import {
  haptic,
  useTokens,
  withAlpha,
  type CategoryColorKey,
} from "@studio/theme";
import { weekdayName } from "@/features/budgets/logic";
import { DAY_PARTS } from "@/lib/insights";


type AnalyzerSectionProps = {
  part: "normal" | "habits";
  analyzer: Analyzer;
  /** What the all-spending monthly budget allows, in the display currency; 0 without one. */
  budget: number;
  weekStart: number;
  locale?: string;
  showDecimals: boolean;
};

const MAX_UNUSUAL = 3;
const MAX_REPEATS = 3;

function useMoney(
  currency: string,
  locale: string | undefined,
  showDecimals: boolean,
) {
  return React.useCallback(
    (minor: number) =>
      formatMoney(minor, currency, {
        locale,
        sign: "none",
        decimals: showDecimals ? undefined : 0,
      }),
    [currency, locale, showDecimals],
  );
}

const dayMonth = (key: string) => {
  const { day, month } = parseKey(key);
  return `${day} ${monthShort(month)}`;
};

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View
        style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }}
      />
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Where the month lands at this pace: spent, bills still due and the everyday pace, against the budget. */
function ForecastCard({
  analyzer,
  budget,
  money,
}: {
  analyzer: Analyzer;
  budget: number;
  money: (minor: number) => string;
}) {
  const { colors } = useTokens();
  const f = analyzer.forecast;
  if (!f) return null;
  const everyday = f.perDay * f.daysLeft;
  const scale = Math.max(f.projected, budget, 1) * 1.04;
  const pct = (v: number) => `${(Math.max(0, v) / scale) * 100}%` as const;
  const over = budget > 0 ? f.projected - budget : 0;
  const end = dayMonth(analyzer.period.to);
  const verdict =
    budget <= 0
      ? `${money(f.perDay)} a day for the ${f.daysLeft} days left`
      : over > 0
        ? `${money(over)} over your ${money(budget)} budget`
        : `${money(-over)} under your ${money(budget)} budget`;
  const tone =
    budget > 0 && over > 0 ? "warning" : budget > 0 ? "income" : "secondary";
  return (
    <Card
      className="mx-4 px-4 py-4"
      accessible
      accessibilityLabel={`Forecast: about ${money(f.projected)} by ${end}. ${verdict}.`}
    >
      <Text variant="footnote" tone="secondary">
        At this pace, by {end}
      </Text>
      <Text
        variant="title1"
        numeric
        className="mt-0.5 font-bold tracking-[-0.5px]"
      >
        {money(f.projected)}
      </Text>
      <Text variant="subhead" tone={tone} className="mt-0.5 font-medium">
        {verdict}
      </Text>
      <View
        className="mt-4 h-3 flex-row overflow-hidden rounded-full"
        style={{ backgroundColor: colors.fill }}
      >
        <View style={{ width: pct(f.spent), backgroundColor: colors.chart }} />
        <View
          style={{
            width: pct(f.upcoming),
            backgroundColor: withAlpha(colors.chart, 0.5),
          }}
        />
        <View
          style={{
            width: pct(everyday),
            backgroundColor: withAlpha(colors.chart, 0.22),
          }}
        />
        {budget > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: pct(budget),
              top: 0,
              bottom: 0,
              width: 2,
              marginLeft: -1,
              backgroundColor: over > 0 ? colors.warning : colors.income,
            }}
          />
        ) : null}
      </View>
      <View className="mt-2.5 flex-row flex-wrap gap-x-4 gap-y-1">
        <Legend color={colors.chart} label={`Spent ${money(f.spent)}`} />
        {f.upcoming > 0 ? (
          <Legend
            color={withAlpha(colors.chart, 0.5)}
            label={`Bills due ${money(f.upcoming)}`}
          />
        ) : null}
        <Legend
          color={withAlpha(colors.chart, 0.22)}
          label={`Everyday ${money(everyday)}`}
        />
      </View>
    </Card>
  );
}

function UnusualCard({
  analyzer,
  money,
}: {
  analyzer: Analyzer;
  money: (minor: number) => string;
}) {
  const router = useRouter();
  const { colors } = useTokens();
  const rows = analyzer.unusual.slice(0, MAX_UNUSUAL);
  if (rows.length === 0) return null;
  return (
    <Card className="mx-4 overflow-hidden p-0">
      {rows.map((u, i) => {
        const up = u.percent > 0;
        const color = up ? colors.warning : colors.income;
        const name = u.category?.name ?? "Uncategorised";
        const change = `${up ? "+" : "−"}${Math.abs(u.percent)}%`;
        return (
          <Pressable
            key={u.categoryId ?? "none"}
            role="button"
            scale={1}
            disabled={!u.category}
            accessibilityLabel={`${name}, ${money(u.amount)} so far, usually ${money(u.usual)} by now, ${up ? "up" : "down"} ${Math.abs(u.percent)} percent`}
            onPress={() =>
              u.category &&
              router.push({
                pathname: "/category/[id]",
                params: {
                  id: u.category.id,
                  from: analyzer.period.from,
                  to: analyzer.period.to,
                  type: "month",
                  kind: "expense",
                },
              })
            }
            className="flex-row items-center gap-3 px-4 py-3 active:bg-fill"
            style={
              i < rows.length - 1
                ? {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.separator,
                  }
                : null
            }
          >
            <IconTile
              icon={u.category?.icon ?? "tag"}
              color={(u.category?.color ?? "gray") as CategoryColorKey}
            />
            <View className="min-w-0 flex-1">
              <Text variant="body" numberOfLines={1}>
                {name}
              </Text>
              <Text
                variant="footnote"
                tone="secondary"
                numeric
                numberOfLines={1}
              >
                {money(u.amount)} so far · usually {money(u.usual)}
              </Text>
            </View>
            <View
              className="rounded-full px-2 py-[3px]"
              style={{ backgroundColor: withAlpha(color, 0.12) }}
            >
              <Text
                variant="caption"
                numeric
                className="font-semibold"
                style={{ color }}
              >
                {change}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

function PatternsCard({
  analyzer,
  weekStart,
  money,
}: {
  analyzer: Analyzer;
  weekStart: number;
  money: (minor: number) => string;
}) {
  const { colors } = useTokens();
  const p = analyzer.patterns;
  if (p.count === 0) return null;
  const days =
    weekStart === 7 ? [p.weekdays[6], ...p.weekdays.slice(0, 6)] : p.weekdays;
  const peak = Math.max(...p.weekdays.map((d) => d.amount), 1);
  const top = p.weekdays.reduce((a, b) => (b.amount > a.amount ? b : a));
  const part = p.dayParts.reduce((a, b) => (b.amount > a.amount ? b : a));
  const partLabel = DAY_PARTS.find((d) => d.part === part.part)?.label ?? "";
  const shades = [0.9, 0.6, 0.38, 0.2];
  return (
    <Card className="mx-4 px-4 py-4">
      <Text variant="headline">Most on {weekdayName(top.weekday)}s</Text>
      <Text variant="footnote" tone="secondary">
        {top.percent}% of spending in the last 3 months
      </Text>
      <View
        className="mt-3 h-[72px] flex-row items-end gap-2"
        accessible
        accessibilityLabel={`Spending by weekday: ${days
          .map((d) => (d ? `${weekdayName(d.weekday)} ${d.percent}%` : ""))
          .join(", ")}`}
      >
        {days.map((d) =>
          d ? (
            <View key={d.weekday} className="flex-1 items-center gap-1">
              <View
                className="w-full rounded-[5px]"
                style={{
                  height: Math.max(4, (d.amount / peak) * 52),
                  backgroundColor:
                    d.weekday === top.weekday
                      ? colors.chart
                      : withAlpha(colors.chart, 0.2),
                }}
              />
              <Text
                variant="caption"
                tone={d.weekday === top.weekday ? "default" : "tertiary"}
              >
                {weekdayName(d.weekday).slice(0, 1)}
              </Text>
            </View>
          ) : null,
        )}
      </View>

      <View
        className="mt-5"
        style={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        }}
      />
      <Text variant="headline" className="mt-4">
        Mostly in the {partLabel.toLowerCase()}
      </Text>
      <View
        className="mt-3 h-3 flex-row overflow-hidden rounded-full"
        style={{ backgroundColor: colors.fill }}
        accessible
        accessibilityLabel={`By time of day: ${p.dayParts
          .map((d, i) => `${DAY_PARTS[i]?.label} ${d.percent}%`)
          .join(", ")}`}
      >
        {p.dayParts.map((d, i) => (
          <View
            key={d.part}
            style={{
              flex: Math.max(d.amount, 0),
              backgroundColor: withAlpha(colors.chart, shades[i] ?? 0.2),
            }}
          />
        ))}
      </View>
      <View className="mt-2.5 flex-row flex-wrap gap-x-4 gap-y-1">
        {p.dayParts.map((d, i) => (
          <Legend
            key={d.part}
            color={withAlpha(colors.chart, shades[i] ?? 0.2)}
            label={`${DAY_PARTS[i]?.label} ${d.percent}%`}
          />
        ))}
      </View>

      <View
        className="mt-5 flex-row pt-3.5"
        style={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        }}
      >
        {[
          { label: "Typical payment", value: money(p.median) },
          { label: "Average", value: money(p.average) },
          { label: "Payments", value: p.count.toLocaleString() },
        ].map((s) => (
          <View
            key={s.label}
            className="flex-1"
            accessible
            accessibilityLabel={`${s.label}, ${s.value}`}
          >
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {s.label}
            </Text>
            <Text variant="headline" numeric numberOfLines={1}>
              {s.value}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function RepeatsCard({
  analyzer,
  money,
}: {
  analyzer: Analyzer;
  money: (minor: number) => string;
}) {
  const { colors } = useTokens();
  const actions = useActions();
  const accounts = useAccounts();
  const [tracked, setTracked] = React.useState<ReadonlySet<string>>(new Set());
  const rows = analyzer.repeats
    .filter((r) => !tracked.has(r.title))
    .slice(0, MAX_REPEATS);
  if (rows.length === 0) return null;
  const track = (r: AnalyzerRepeat) => {
    const account = accounts.find((a) => a.id === r.accountId);
    // The amount is in the display currency; a rule on a foreign account would post the wrong figure.
    if (!account || account.currency !== analyzer.currency) {
      showToast({ message: "Set this one up in Recurring", haptic: "warning" });
      return;
    }
    try {
      actions.recurring.create({
        kind: "expense",
        title: r.title,
        amount: r.amount,
        accountId: r.accountId,
        categoryId: r.categoryId,
        frequency: r.cadence,
        startDate: r.nextDate,
        autoPost: false,
      });
      haptic("success");
      setTracked((prev) => new Set(prev).add(r.title));
      showToast({ message: `${r.title} added to Recurring` });
    } catch {
      showToast({ message: "Could not add it", haptic: "error" });
    }
  };
  return (
    <Card className="mx-4 overflow-hidden p-0">
      {rows.map((r, i) => {
        const cadence = r.cadence === "weekly" ? "Weekly" : "Monthly";
        return (
          <View
            key={r.title}
            className="flex-row items-center gap-3 px-4 py-3"
            style={
              i < rows.length - 1
                ? {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.separator,
                  }
                : null
            }
          >
            <IconTile
              icon={r.category?.icon ?? "repeat"}
              color={(r.category?.color ?? "gray") as CategoryColorKey}
            />
            <View
              className="min-w-0 flex-1"
              accessible
              accessibilityLabel={`${r.title}, ${cadence.toLowerCase()}, about ${money(r.amount)}, ${money(r.yearly)} a year, next around ${dayMonth(r.nextDate)}`}
            >
              <Text variant="body" numberOfLines={1}>
                {r.title}
              </Text>
              <Text
                variant="footnote"
                tone="secondary"
                numeric
                numberOfLines={1}
              >
                {cadence} · {money(r.amount)} · {money(r.yearly)}/yr
              </Text>
            </View>
            <Button
              variant="ghost"
              size="sm"
              accessibilityLabel={`Track ${r.title} as recurring`}
              onPress={() => track(r)}
            >
              Track
            </Button>
          </View>
        );
      })}
    </Card>
  );
}

function GroupLabel({ children }: { children: string }) {
  return (
    <Text variant="footnote" tone="secondary" className="px-8 pb-1.5 pt-4">
      {children}
    </Text>
  );
}

/** "normal" is the forecast, unusual spending and price rises; "habits" is repeat payments and patterns, further down the story. */
function AnalyzerSection({
  analyzer,
  budget,
  weekStart,
  locale,
  showDecimals,
  part,
}: AnalyzerSectionProps) {
  const money = useMoney(analyzer.currency, locale, showDecimals);
  const unusual = Math.min(analyzer.unusual.length, MAX_UNUSUAL);
  const repeats = Math.min(analyzer.repeats.length, MAX_REPEATS);
  const hasPatterns = analyzer.patterns.count > 0;
  const rises = analyzer.priceRises.slice(0, MAX_REPEATS);
  if (part === "habits") {
    if (repeats === 0 && !hasPatterns) return null;
    return (
      <View>
        {repeats > 0 ? (
          <>
            <GroupLabel>Repeat payments</GroupLabel>
            <RepeatsCard analyzer={analyzer} money={money} />
          </>
        ) : null}
        {hasPatterns ? (
          <>
            <GroupLabel>Your patterns</GroupLabel>
            <PatternsCard analyzer={analyzer} weekStart={weekStart} money={money} />
          </>
        ) : null}
      </View>
    );
  }
  if (!analyzer.forecast && unusual === 0 && rises.length === 0) return null;
  return (
    <View>
      {analyzer.forecast ? (
        <View className="pt-3">
          <ForecastCard analyzer={analyzer} budget={budget} money={money} />
        </View>
      ) : null}
      {unusual > 0 ? (
        <>
          <GroupLabel>Unusual this month</GroupLabel>
          <UnusualCard analyzer={analyzer} money={money} />
        </>
      ) : null}
      {rises.length > 0 ? (
        <>
          <GroupLabel>Prices that went up</GroupLabel>
          <Card className="mx-4 overflow-hidden p-0">
            {rises.map((rise, i) => (
              <View
                key={`${rise.title}:${rise.dateKey}`}
                className={`flex-row items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-separator" : ""}`}
              >
                <View className="flex-1 pr-3">
                  <Text variant="callout" numberOfLines={1}>
                    {rise.title}
                  </Text>
                  <Text variant="footnote" tone="secondary" numeric numberOfLines={1}>
                    {`${money(rise.from)} to ${money(rise.to)}`}
                  </Text>
                </View>
                <Text variant="callout" tone="warning" numeric className="font-semibold">
                  {`+${rise.percent}%`}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </View>
  );
}

export { AnalyzerSection };
