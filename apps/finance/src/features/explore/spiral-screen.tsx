import { Canvas, Circle, Picture, Skia, createPicture } from "@shopify/react-native-skia";
import { addDays, monthShort, parseKey } from "@studio/dates";
import * as React from "react";
import { ScrollView, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue } from "react-native-reanimated";

import { useEntrance } from "@/components/app/scroll-reveal";

import { useRangeDailyTotals, useTodayKey } from "@/data/hooks";
import { nearestDot, spiralDots, type SpiralDot } from "@/lib/explore/spiral";
import { haptic, useTokens, withAlpha } from "@studio/theme";
import { Card, Text } from "@studio/ui";

import { useMoneyText } from "./shared";

const YEARS_SHOWN = 3;
const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

const useFirstDay = (today: string) => addDays(today, -Math.round(YEARS_SHOWN * 365.25));

export default function SpiralScreen() {
  const { colors } = useTokens();
  const money = useMoneyText();
  const today = useTodayKey();
  const totals = useRangeDailyTotals(useFirstDay(today), today);
  const [size, setSize] = React.useState(0);
  const [selected, setSelected] = React.useState<SpiralDot | null>(null);
  // Whole years, ending this December: quiet dots draw the turn even with a few months of entries.
  const days = React.useMemo(() => {
    const first = totals.days.find((d) => d.amount > 0);
    if (!first) return [];
    const start = `${parseKey(first.dateKey).year}-01-01`;
    const seen = totals.days.filter((d) => d.dateKey >= start);
    const last = `${parseKey(today).year}-12-31`;
    const rest: { dateKey: string; amount: number }[] = [];
    for (let day = addDays(today, 1); day <= last; day = addDays(day, 1)) rest.push({ dateKey: day, amount: 0 });
    return [...seen, ...rest];
  }, [totals.days, today]);
  const dots = React.useMemo(
    () => spiralDots(days.map((d) => ({ dateKey: d.dateKey, amount: d.amount })), size),
    [days, size],
  );
  const pickable = React.useMemo(() => dots.filter((d) => d.dateKey <= today), [dots, today]);
  const marks = React.useMemo(() => {
    const peak = Math.max(1, ...dots.map((d) => d.amount));
    return {
      x: dots.map((d) => d.x),
      y: dots.map((d) => d.y),
      r: dots.map((d) => d.r),
      shade: dots.map((d) =>
        Skia.Color(
          d.amount > 0 ? withAlpha(colors.chart, 0.4 + 0.6 * Math.sqrt(d.amount / peak)) : colors.fill,
        ),
      ),
    };
  }, [dots, colors.chart, colors.fill]);
  const reveal = useEntrance(1500, dots.length > 0);
  const picture = useDerivedValue(() => {
    const shown = Math.round(marks.x.length * reveal.value);
    return createPicture((canvas) => {
      const paint = Skia.Paint();
      for (let i = 0; i < shown; i += 1) {
        paint.setColor(marks.shade[i]!);
        canvas.drawCircle(marks.x[i]!, marks.y[i]!, marks.r[i]!, paint);
      }
    });
  });
  const pick = (x: number, y: number) => {
    const dot = nearestDot(pickable, x, y);
    if (dot && dot.dateKey !== selected?.dateKey) {
      haptic("selection");
      setSelected(dot);
    }
  };
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => pick(e.x, e.y))
    .onUpdate((e) => pick(e.x, e.y));
  const date = selected ? parseKey(selected.dateKey) : null;
  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 px-4 pb-12 pt-2"
    >
      <Text variant="subhead" tone="secondary">
        Each dot is a day and its size is what you spent. January starts at the top and the year winds outward.
      </Text>
      <Card className="rounded-[20px] p-3">
      <View
        onLayout={(e: LayoutChangeEvent) => setSize(Math.round(e.nativeEvent.layout.width))}
        style={{ aspectRatio: 1 }}
      >
        {size > 0 ? (
          <GestureDetector gesture={pan}>
            <View style={{ width: size, height: size }}>
              <Canvas
                style={{ width: size, height: size }}
                accessibilityLabel={`Spiral of ${pickable.length} days of spending`}
              >
                <Picture picture={picture} />
                {selected ? (
                  <Circle
                    cx={selected.x}
                    cy={selected.y}
                    r={selected.r + 4}
                    color={colors.text}
                    style="stroke"
                    strokeWidth={2}
                  />
                ) : null}
              </Canvas>
              {MONTH_LABELS.map((label, i) => {
                const angle = ((i + 0.5) / 12) * 2 * Math.PI - Math.PI / 2;
                const reach = size / 2 - 7;
                return (
                  <Text
                    key={`${label}${i}`}
                    variant="caption"
                    tone="tertiary"
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      width: 14,
                      textAlign: "center",
                      left: size / 2 + Math.cos(angle) * reach - 7,
                      top: size / 2 + Math.sin(angle) * reach - 8,
                    }}
                  >
                    {label}
                  </Text>
                );
              })}
            </View>
          </GestureDetector>
        ) : null}
      </View>
      </Card>
      <Card className="flex-row items-center justify-between rounded-[20px] px-4 py-3">
        <Text variant="callout" tone="secondary">
          {date ? `${date.day} ${monthShort(date.month)} ${date.year}` : "Touch a dot"}
        </Text>
        <Text variant="headline" numeric>
          {selected ? money(selected.amount) : ""}
        </Text>
      </Card>
    </ScrollView>
  );
}
