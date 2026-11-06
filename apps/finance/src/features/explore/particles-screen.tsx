import { Canvas, Picture, Skia, createPicture, useClock } from "@shopify/react-native-skia";
import { addDays, diffDays } from "@studio/dates";
import * as React from "react";
import { Platform, View, type LayoutChangeEvent } from "react-native";
import { Easing, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { useEntrance } from "@/components/app/scroll-reveal";
import { useTodayKey } from "@/data/hooks";
import { useExploreLines } from "@/data/hooks/useExploreLines";
import { monthTicks, particleLayouts } from "@/lib/explore/particles";
import { haptic, useTokens, type CategoryColorKey } from "@studio/theme";
import { Chip, Pressable, Text, showToast } from "@studio/ui";

import { useMoneyText } from "./shared";

const MAX_PARTICLES = 3000;
const MAX_LABELS = 15;
const MAX_DOT_RADIUS = 7;
const AXIS = 24;

const GpuParticleField = React.lazy(() => import("./particles-gpu"));

function ParticleField({
  layouts,
  colors,
  mode,
  width,
  height,
}: {
  layouts: ReturnType<typeof particleLayouts>;
  colors: string[];
  mode: "time" | "category";
  width: number;
  height: number;
}) {
  const reduced = useReducedMotion();
  const clock = useClock();
  const enter = useEntrance(1000);
  const progress = useSharedValue(mode === "time" ? 0 : 1);
  React.useEffect(() => {
    progress.value = withTiming(mode === "time" ? 0 : 1, {
      duration: reduced ? 0 : 900,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [mode, progress, reduced]);
  const count = layouts.scale.length;
  const { timeX, timeY, groupX, groupY, scale } = layouts;
  const skColors = React.useMemo(() => colors.map((c) => Skia.Color(c)), [colors]);
  const picture = useDerivedValue(() => {
    const t = progress.value;
    const grown = enter.value;
    const now = reduced ? 0 : clock.value / 1400;
    return createPicture((canvas) => {
      const paint = Skia.Paint();
      for (let i = 0; i < count; i += 1) {
        const eased = Math.min(1, Math.max(0, t * 1.5 - (i % 40) * 0.0125));
        const drift = now + i;
        const x = timeX[i]! + (groupX[i]! - timeX[i]!) * eased + Math.sin(drift) * 1.6;
        const y = timeY[i]! + (groupY[i]! - timeY[i]!) * eased + Math.cos(drift * 0.8) * 1.6;
        paint.setColor(skColors[i]!);
        canvas.drawCircle(
          x,
          y,
          scale[i]! * 16 * Math.min(1, Math.max(0, grown * 1.6 - (i % 60) * 0.01)),
          paint,
        );
      }
    });
  });
  return (
    <Canvas style={{ width, height }} accessibilityLabel={`${count} transactions as particles`}>
      <Picture picture={picture} />
    </Canvas>
  );
}

export function useParticleData(width: number, height: number) {
  const today = useTodayKey();
  const from = addDays(today, -365);
  const lines = useExploreLines(from, today);
  const { category } = useTokens();
  return React.useMemo(() => {
    const spending = lines.filter((l) => l.kind === "expense").slice(-MAX_PARTICLES);
    // The axis starts at the first entry, so a few months of data still fill the width.
    const start = spending.reduce((min, l) => (l.dateKey < min ? l.dateKey : min), today);
    const span = Math.max(1, diffDays(start, today));
    const layouts = particleLayouts(
      spending.map((l) => ({
        time: diffDays(start, l.dateKey) / span,
        amount: l.amount,
        group: l.categoryId ?? "none",
      })),
      width,
      Math.max(0, height - AXIS),
    );
    const colors = spending.map(
      (l) => category[l.color as CategoryColorKey] ?? category.gray,
    );
    return { layouts, colors, spending, ticks: monthTicks(start, today) };
  }, [lines, width, height, from, today, category]);
}

export default function ParticlesScreen() {
  const money = useMoneyText();
  const [engine, setEngine] = React.useState<"skia" | "webgpu">("skia");
  const reduced = useReducedMotion();
  const gpuProgress = React.useRef({ from: 0, to: 0, at: 0 });
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const [mode, setMode] = React.useState<"time" | "category">("time");
  const { layouts, colors, spending, ticks } = useParticleData(size.width, size.height);
  const total = spending.reduce((sum, l) => sum + l.amount, 0);
  const names = new Map(spending.map((l) => [l.categoryId ?? "none", l.categoryName]));
  const gpuValue = () => {
    const { from, to, at } = gpuProgress.current;
    const t = reduced ? 1 : Math.min(1, (Date.now() - at) / 900);
    return from + (to - from) * t * t * (3 - 2 * t);
  };
  const toggle = () => {
    haptic("medium");
    setMode((m) => {
      const next = m === "time" ? "category" : "time";
      gpuProgress.current = {
        from: gpuValue(),
        to: next === "category" ? 1 : 0,
        at: Date.now(),
      };
      return next;
    });
  };
  return (
    <View className="flex-1 gap-3 bg-bg pb-6 pt-2">
      <View className="px-4" style={{ paddingTop: 8 }}>
        <Text variant="subhead" tone="secondary">
          {`${spending.length} transactions in the last year`}
        </Text>
        <Text variant="hero" numeric>
          {money(total)}
        </Text>
      </View>
      <View className="flex-row gap-2 px-4">
        <Chip label="By time" selected={mode === "time"} onPress={() => mode !== "time" && toggle()} />
        <Chip label="By category" selected={mode === "category"} onPress={() => mode !== "category" && toggle()} />
        {Platform.OS !== "web" ? (
          <Chip
            label="WebGPU"
            selected={engine === "webgpu"}
            onPress={() => setEngine((e) => (e === "webgpu" ? "skia" : "webgpu"))}
          />
        ) : null}
      </View>
      <View
        className="flex-1"
        onLayout={(e: LayoutChangeEvent) =>
          setSize({
            width: Math.round(e.nativeEvent.layout.width),
            height: Math.round(e.nativeEvent.layout.height),
          })
        }
      >
      <Pressable
        role="button"
        accessibilityLabel={mode === "time" ? "Group by category" : "Spread over time"}
        scale={1}
        onPress={toggle}
        className="flex-1"
      >
        {size.width > 0 && layouts.scale.length > 0 ? (
          engine === "webgpu" ? (
            <React.Suspense fallback={null}>
              <GpuParticleField
                layouts={layouts}
                colors={colors}
                progress={gpuValue}
                width={size.width}
                height={size.height}
                onFail={() => {
                  setEngine("skia");
                  showToast({ message: "WebGPU isn't available here, so this stays on Skia" });
                }}
              />
            </React.Suspense>
          ) : (
            <ParticleField
              layouts={layouts}
              colors={colors}
              mode={mode}
              width={size.width}
              height={size.height}
            />
          )
        ) : null}
        {mode === "category"
          ? layouts.centers.slice(0, MAX_LABELS).map((center) => (
              <Text
                key={center.group}
                variant="caption"
                numberOfLines={1}
                pointerEvents="none"
                className="absolute font-medium"
                style={{
                  left: center.x - 50,
                  top: center.y + center.radius + MAX_DOT_RADIUS + 2,
                  width: 100,
                  textAlign: "center",
                }}
              >
                {names.get(center.group) ?? ""}
              </Text>
            ))
          : ticks.map((tick) => (
              <Text
                key={tick.label}
                variant="caption"
                tone="tertiary"
                pointerEvents="none"
                className="absolute"
                style={{ left: Math.min(12 + tick.time * Math.max(0, size.width - 24), size.width - 34), bottom: 2 }}
              >
                {tick.label}
              </Text>
            ))}
      </Pressable>
      </View>
    </View>
  );
}
