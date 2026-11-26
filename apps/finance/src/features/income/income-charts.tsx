import * as React from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";

import { haptic, useTokens } from "@studio/theme";
import { Text } from "@studio/ui";

export type ChartBar = { key: string; short: string; amount: number };

const SPRING = { damping: 16, stiffness: 140, mass: 0.7 };
const STAGGER_MS = 40;

/** Picks the bar under a finger and buzzes once per bar crossed, so sliding across the chart reads every month. */
function useScrub(count: number, onSelect: (index: number) => void) {
  const [width, setWidth] = React.useState(0);
  const last = React.useRef(-1);
  const pick = (x: number) => {
    if (width <= 0 || count === 0) return;
    const i = Math.min(count - 1, Math.max(0, Math.floor((x / width) * count)));
    if (i === last.current) return;
    last.current = i;
    haptic("selection");
    onSelect(i);
  };
  const gesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => pick(e.x))
    .onUpdate((e) => pick(e.x))
    .onFinalize(() => {
      last.current = -1;
    });
  return { gesture, onLayout: (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width) };
}

function GrowBar({
  share,
  index,
  color,
  replay,
  radius = 6,
}: {
  share: number;
  index: number;
  color: string;
  replay: string;
  radius?: number;
}) {
  const reduced = useReducedMotion();
  const h = useSharedValue(reduced ? share : 0);
  React.useEffect(() => {
    if (reduced) {
      h.value = share;
      return;
    }
    h.value = 0;
    h.value = withDelay(index * STAGGER_MS, withSpring(share, SPRING));
  }, [replay]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    h.value = reduced ? share : withSpring(share, SPRING);
  }, [share]); // eslint-disable-line react-hooks/exhaustive-deps
  const style = useAnimatedStyle(() => ({ height: `${Math.max(1.5, h.value * 100)}%` }));
  return (
    <Animated.View
      style={[{ width: "100%", backgroundColor: color, borderTopLeftRadius: radius, borderTopRightRadius: radius, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }, style]}
    />
  );
}

/** Bars that spring up one after another; slide a finger across to read each one. */
export function IncomeBars({
  bars,
  selected,
  onSelect,
  replay,
  height = 150,
}: {
  bars: readonly ChartBar[];
  selected: number;
  onSelect: (index: number) => void;
  replay: string;
  height?: number;
}) {
  const { colors } = useTokens();
  const max = Math.max(1, ...bars.map((b) => b.amount));
  const { gesture, onLayout } = useScrub(bars.length, onSelect);
  return (
    <View>
      <GestureDetector gesture={gesture}>
        <View onLayout={onLayout} className="flex-row items-end gap-1.5" style={{ height }}>
          {bars.map((b, i) => (
            <View key={b.key} className="h-full flex-1 justify-end">
              <GrowBar
                share={b.amount / max}
                index={i}
                replay={replay}
                color={i === selected ? colors.accent : colors.accentSoft}
              />
            </View>
          ))}
        </View>
      </GestureDetector>
      <AxisLabels bars={bars} selected={selected} />
    </View>
  );
}

/** Change against the period before: green bars rise above the line, red ones drop below it. */
export function GrowthBars({
  bars,
  selected,
  onSelect,
  replay,
  height = 150,
}: {
  bars: readonly ChartBar[];
  selected: number;
  onSelect: (index: number) => void;
  replay: string;
  height?: number;
}) {
  const { colors } = useTokens();
  const changes = bars.map((b, i) => {
    const prev = i > 0 ? bars[i - 1]?.amount : undefined;
    return prev && prev > 0 ? (b.amount - prev) / prev : 0;
  });
  const max = Math.max(0.01, ...changes.map((c) => Math.abs(c)));
  const half = height / 2;
  const { gesture, onLayout } = useScrub(bars.length, onSelect);
  return (
    <View>
      <GestureDetector gesture={gesture}>
        <View onLayout={onLayout} style={{ height }}>
          <View
            className="absolute left-0 right-0"
            style={{ top: half, height: 1, backgroundColor: colors.separator }}
          />
          <View className="flex-1 flex-row gap-1.5">
            {changes.map((c, i) => {
              const on = i === selected;
              const color = c >= 0 ? colors.income : colors.expense;
              return (
                <View key={bars[i]?.key ?? i} className="flex-1">
                  <View className="justify-end" style={{ height: half }}>
                    {c > 0 ? (
                      <GrowBar share={c / max} index={i} replay={replay} color={on ? color : `${color}66`} />
                    ) : null}
                  </View>
                  <View style={{ height: half, transform: [{ scaleY: -1 }] }} className="justify-end">
                    {c < 0 ? (
                      <GrowBar share={-c / max} index={i} replay={replay} color={on ? color : `${color}66`} />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </GestureDetector>
      <AxisLabels bars={bars} selected={selected} />
    </View>
  );
}

function AxisLabels({ bars, selected }: { bars: readonly ChartBar[]; selected: number }) {
  return (
    <View className="mt-1.5 flex-row gap-1.5">
      {bars.map((b, i) => (
        <Text
          key={b.key}
          variant="caption"
          tone={i === selected ? "default" : "tertiary"}
          className={`flex-1 text-center ${i === selected ? "font-semibold" : ""}`}
          numberOfLines={1}
        >
          {b.short}
        </Text>
      ))}
    </View>
  );
}
