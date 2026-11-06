import { Canvas, Fill, Shader, Skia, useClock } from "@shopify/react-native-skia";
import { useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { useBudgets, useCategories } from "@/data/hooks";
import { displayName } from "@/features/budgets/logic";
import { useTokens, type CategoryColorKey } from "@studio/theme";
import { EmptyState, IconTile, Pressable, Text } from "@studio/ui";

import { useTilt, useMoneyText } from "./shared";

const LIQUID = Skia.RuntimeEffect.Make(`
uniform vec2 size;
uniform float time;
uniform float level;
uniform float lean;
uniform vec4 tint;

half4 main(vec2 p) {
  vec2 uv = p / size;
  float height = 1.0 - uv.y;
  float slope = (uv.x - 0.5) * lean * 0.5;
  float front = level + slope + 0.012 * sin(uv.x * 9.0 + time * 2.0) + 0.007 * sin(uv.x * 17.0 - time * 3.0);
  float back = level + slope * 0.7 + 0.014 * sin(uv.x * 7.0 - time * 1.4 + 1.7);
  float frontMask = smoothstep(front + 0.006, front - 0.006, height);
  float backMask = smoothstep(back + 0.006, back - 0.006, height);
  float depth = clamp((front - height) / max(front, 0.001), 0.0, 1.0);
  float alpha = max(frontMask * mix(0.16, 0.42, depth), backMask * 0.1);
  return half4(tint.rgb * alpha, alpha);
}
`);

function Tank({
  level,
  color,
  tilt,
  width,
  height,
  delay,
}: {
  level: number;
  delay: number;
  color: string;
  tilt: SharedValue<{ x: number; y: number }>;
  width: number;
  height: number;
}) {
  const reduced = useReducedMotion();
  const clock = useClock();
  const tint = React.useMemo(() => Array.from(Skia.Color(color)), [color]);
  const shown = useSharedValue(reduced ? level : 0);
  React.useEffect(() => {
    shown.value = reduced
      ? level
      : withDelay(delay, withTiming(level, { duration: 1200, easing: Easing.out(Easing.cubic) }));
  }, [shown, level, delay, reduced]);
  const uniforms = useDerivedValue(() => ({
    size: [width, height],
    time: reduced ? 0 : clock.value / 1000,
    level: shown.value,
    lean: -tilt.value.x,
    tint,
  }));
  if (!LIQUID) return null;
  return (
    <Canvas style={{ position: "absolute", left: 0, top: 0, width, height }} pointerEvents="none">
      <Fill>
        <Shader source={LIQUID} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}

export default function LiquidScreen() {
  const router = useRouter();
  const { colors } = useTokens();
  const money = useMoneyText();
  const budgets = useBudgets();
  const categories = useCategories();
  const tilt = useTilt();
  const [width, setWidth] = React.useState(0);
  const tile = Math.floor((width - 12) / 2);
  const tileHeight = 150;
  if (budgets.length === 0) {
    return (
      <View className="flex-1 bg-bg">
        <EmptyState
          message="No budgets to fill yet"
          actionLabel="Add budget"
          onAction={() => router.push("/budget/new")}
        />
      </View>
    );
  }
  const nameOf = (budget: (typeof budgets)[number]["budget"]) =>
    displayName(
      budget,
      budget.categoryIds.flatMap((id) => categories.find((c) => c.id === id)?.name ?? []),
    );
  const firstCategory = (budget: (typeof budgets)[number]["budget"]) =>
    categories.find((c) => c.id === budget.categoryIds[0]);
  const iconOf = (budget: (typeof budgets)[number]["budget"]) =>
    firstCategory(budget)?.icon ?? "budgets";
  const colorKeyOf = (budget: (typeof budgets)[number]["budget"]) =>
    (firstCategory(budget)?.color ?? "gray") as CategoryColorKey;
  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-3 px-4 pb-12 pt-2"
    >
      <Text variant="subhead" tone="secondary">
        The higher the level, the more of the budget is gone. Tilt your phone.
      </Text>
      <View
        className="flex-row flex-wrap gap-3"
        onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      >
        {width > 0
          ? budgets.map((item, index) => {
              const over = item.remaining < 0;
              const rawUsed = item.available > 0 ? item.spent / item.available : over ? 1 : 0;
              const used = over ? 1 : rawUsed;
              return (
                <Pressable
                  key={item.budget.id}
                  role="button"
                  accessibilityLabel={`${nameOf(item.budget)}, ${Math.round(used * 100)} percent used`}
                  scale={0.98}
                  onPress={() =>
                    router.push({ pathname: "/budget/[id]", params: { id: item.budget.id } })
                  }
                  className="justify-between overflow-hidden rounded-[20px] bg-surface p-3.5"
                  style={{
                    width: tile,
                    height: tileHeight,
                    borderWidth: StyleSheet.hairlineWidth * 2,
                    borderColor: colors.border,
                  }}
                >
                  <Tank
                    level={Math.min(1, used)}
                    color={over ? colors.warning : colors.chart}
                    delay={index * 90}
                    tilt={tilt}
                    width={tile}
                    height={tileHeight}
                  />
                  <View className="flex-row items-center gap-2">
                    <IconTile icon={iconOf(item.budget)} color={colorKeyOf(item.budget)} size={28} />
                    <Text variant="footnote" className="flex-1 font-medium" numberOfLines={1}>
                      {nameOf(item.budget)}
                    </Text>
                  </View>
                  <View>
                    <Text variant="title2" numeric tone={over ? "warning" : "default"}>
                      {item.available > 0 ? `${Math.round(rawUsed * 100)}%` : money(-item.remaining)}
                    </Text>
                    <Text variant="footnote" tone="secondary" numeric numberOfLines={1}>
                      {!over
                        ? `${money(item.remaining)} left`
                        : item.available > 0
                          ? `${money(-item.remaining)} over`
                          : "over budget"}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          : null}
      </View>
    </ScrollView>
  );
}
