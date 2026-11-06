import * as React from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { haptic, useTokens } from "@studio/theme";
import { Text } from "@studio/ui";

const THUMB = 26;

export function Slider({
  label,
  shown,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  shown: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const { colors } = useTokens();
  const [width, setWidth] = React.useState(0);
  const usable = Math.max(1, width - THUMB);
  const pick = (x: number) => {
    const ratio = Math.min(1, Math.max(0, (x - THUMB / 2) / usable));
    const next = min + Math.round((ratio * (max - min)) / step) * step;
    if (next === value) return;
    haptic("selection");
    onChange(next);
  };
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => pick(e.x))
    .onUpdate((e) => pick(e.x));
  const left = ((value - min) / (max - min)) * usable;
  return (
    <View className="gap-1.5">
      <View className="flex-row items-baseline justify-between">
        <Text variant="subhead" tone="secondary">
          {label}
        </Text>
        <Text variant="headline" numeric>
          {shown}
        </Text>
      </View>
      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: shown }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => {
            const delta = e.nativeEvent.actionName === "increment" ? step : -step;
            onChange(Math.min(max, Math.max(min, value + delta)));
          }}
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          style={{ height: 36, justifyContent: "center" }}
        >
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.fill }}>
            <View style={{ width: left + THUMB / 2, height: 6, borderRadius: 3, backgroundColor: colors.chart }} />
          </View>
          <View
            style={{
              position: "absolute",
              left,
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: "#FFFFFF",
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            }}
          />
        </View>
      </GestureDetector>
    </View>
  );
}
