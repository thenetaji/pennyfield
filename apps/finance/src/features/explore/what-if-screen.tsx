import { Canvas, Group, LinearGradient, Path, Skia, Line as SkLine, vec } from "@shopify/react-native-skia";
import { addMonths, monthShort, parseKey } from "@studio/dates";
import * as React from "react";
import { ScrollView, View, type LayoutChangeEvent } from "react-native";

import { useEntrance } from "@/components/app/scroll-reveal";
import { useAccounts, useRateLookup, useSetting, useTodayKey } from "@/data/hooks";
import { useExploreLines } from "@/data/hooks/useExploreLines";
import { monthMoneyRunsOut, spreadOf, whatIfForecast, type WhatIfPoint } from "@/lib/explore/what-if";
import { convertWithRates } from "@studio/money";
import { useTokens, withAlpha } from "@studio/theme";
import { Button, Card, Text } from "@studio/ui";

import { useMonths, useMoneyText, useWorkTime } from "./shared";
import { Slider } from "./slider";

const HEIGHT = 220;
const HISTORY_MONTHS = 7;
const HORIZON = 12;

function ForecastChart({ points, baseline }: { points: WhatIfPoint[]; baseline: WhatIfPoint[] }) {
  const { colors } = useTokens();
  const [width, setWidth] = React.useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const draw = useEntrance(1000, width > 0);
  const all = [...points, ...baseline];
  const low = Math.min(0, ...all.map((p) => p.low));
  const high = Math.max(1, ...all.map((p) => p.high));
  const pad = (high - low) * 0.06;
  const y = (v: number) => HEIGHT - ((v - (low - pad)) / (high - low + pad * 2)) * HEIGHT;
  const x = (month: number) => (month / HORIZON) * width;
  const line = (list: WhatIfPoint[], pick: (p: WhatIfPoint) => number) => {
    const path = Skia.Path.Make();
    list.forEach((p, i) =>
      i === 0 ? path.moveTo(x(p.month), y(pick(p))) : path.lineTo(x(p.month), y(pick(p))),
    );
    return path;
  };
  const band = Skia.Path.Make();
  points.forEach((p, i) =>
    i === 0 ? band.moveTo(x(p.month), y(p.high)) : band.lineTo(x(p.month), y(p.high)),
  );
  [...points].reverse().forEach((p) => band.lineTo(x(p.month), y(p.low)));
  band.close();
  const area = Skia.Path.Make();
  points.forEach((p, i) =>
    i === 0 ? area.moveTo(x(p.month), y(p.mid)) : area.lineTo(x(p.month), y(p.mid)),
  );
  const lastPoint = points[points.length - 1];
  if (lastPoint) area.lineTo(x(lastPoint.month), y(0));
  if (points[0]) area.lineTo(x(points[0].month), y(0));
  area.close();
  return (
    <View onLayout={onLayout} style={{ height: HEIGHT }}>
      {width > 0 ? (
        <Canvas style={{ width, height: HEIGHT }}>
          <Group>
            <SkLine p1={vec(0, y(0))} p2={vec(width, y(0))} color={colors.separator} strokeWidth={1} />
            <Path path={area} opacity={draw}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, HEIGHT)}
                colors={[withAlpha(colors.accent, 0.3), withAlpha(colors.accent, 0)]}
              />
            </Path>
            <Path path={band} color={withAlpha(colors.accent, 0.18)} opacity={draw} />
            <Path path={line(baseline, (p) => p.mid)} color={colors.textTertiary} style="stroke" strokeWidth={1.5} end={draw} />
            <Path path={line(points, (p) => p.mid)} color={colors.accent} style="stroke" strokeWidth={2.5} strokeCap="round" end={draw} />
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
}

export default function WhatIfScreen() {
  const money = useMoneyText();
  const workTime = useWorkTime();
  const accounts = useAccounts();
  const rates = useRateLookup();
  const today = useTodayKey();
  const [currency] = useSetting("display_currency");
  const months = useMonths(HISTORY_MONTHS);
  const lines = useExploreLines(months[0]?.from ?? "", months[months.length - 1]?.to ?? "");
  const balance = React.useMemo(
    () => accounts.reduce((sum, a) => sum + convertWithRates(a.balance, a.currency, currency, rates), 0),
    [accounts, currency, rates],
  );
  const finished = months.slice(0, -1).map((m) => {
    const within = lines.filter((l) => l.dateKey >= m.from && l.dateKey <= m.to);
    const sum = (kind: "income" | "expense") =>
      within.reduce((total, l) => (l.kind === kind ? total + l.amount : total), 0);
    return { income: sum("income"), spent: sum("expense") };
  }).filter((m) => m.income > 0 || m.spent > 0);
  const average = (pick: (m: { income: number; spent: number }) => number) =>
    finished.length === 0 ? 0 : finished.reduce((sum, m) => sum + pick(m), 0) / finished.length;
  const monthlyIncome = average((m) => m.income);
  const monthlySpend = average((m) => m.spent);
  const spread = spreadOf(finished.map((m) => m.income - m.spent));
  // A slider step of about 1% of a month's spending, rounded to a tidy number.
  const unit = Math.max(1, 10 ** Math.round(Math.log10(Math.max(100, monthlySpend || 100000) / 20)));

  const [spendChange, setSpendChange] = React.useState(0);
  const [extraIncome, setExtraIncome] = React.useState(0);
  const [oneOff, setOneOff] = React.useState(0);
  const base = { balance, monthlyIncome, monthlySpend, spread, months: HORIZON };
  const points = whatIfForecast({ ...base, spendChangePercent: spendChange, extraIncome, oneOff });
  const baseline = whatIfForecast({ ...base, spendChangePercent: 0, extraIncome: 0, oneOff: 0 });
  const end = points[points.length - 1];
  const was = baseline[baseline.length - 1];
  const gap = (end?.mid ?? 0) - (was?.mid ?? 0);
  const runsOut = monthMoneyRunsOut(points);
  const hours = workTime(Math.abs(gap));
  const endMonth = monthShort(parseKey(addMonths(today, HORIZON)).month);

  if (finished.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-bg px-8">
        <Text variant="callout" tone="secondary" className="text-center">
          Needs at least one full month of data.
        </Text>
      </View>
    );
  }
  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 px-4 pb-12 pt-2"
    >
      <View>
        <Text variant="subhead" tone="secondary">
          {`Balance by ${endMonth} next year`}
        </Text>
        <Text variant="hero" numeric>
          {money(Math.max(0, end?.mid ?? 0))}
        </Text>
        <Text variant="subhead" tone={gap >= 0 ? "income" : "secondary"} numeric>
          {runsOut !== null
            ? `Runs out in ${runsOut} ${runsOut === 1 ? "month" : "months"}`
            : gap === 0
              ? "Based on your recent months"
              : `${money(Math.abs(gap))} ${gap > 0 ? "more" : "less"} than now${hours ? `, about ${hours} of work` : ""}`}
        </Text>
      </View>
      <Card className="px-3 py-4">
        <ForecastChart points={points} baseline={baseline} />
        <Text variant="caption" tone="tertiary" className="px-1 pt-2">
          Grey is your current path. The shaded band is your usual range.
        </Text>
      </Card>
      <Card className="gap-4 px-4 py-4">
        <Slider
          label="Monthly spending"
          shown={`${spendChange > 0 ? "+" : ""}${spendChange}%`}
          value={spendChange}
          min={-50}
          max={50}
          step={5}
          onChange={setSpendChange}
        />
        <Slider
          label="Extra income a month"
          shown={money(extraIncome)}
          value={extraIncome}
          min={0}
          max={unit * 40}
          step={unit}
          onChange={setExtraIncome}
        />
        <Slider
          label="One-off purchase"
          shown={money(oneOff)}
          value={oneOff}
          min={0}
          max={unit * 200}
          step={unit * 5}
          onChange={setOneOff}
        />
        {spendChange !== 0 || extraIncome !== 0 || oneOff !== 0 ? (
          <Button
            variant="secondary"
            size="sm"
            onPress={() => {
              setSpendChange(0);
              setExtraIncome(0);
              setOneOff(0);
            }}
          >
            Reset
          </Button>
        ) : null}
      </Card>
    </ScrollView>
  );
}
