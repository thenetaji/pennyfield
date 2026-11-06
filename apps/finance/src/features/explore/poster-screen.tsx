import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { useEntrance } from "@/components/app/scroll-reveal";
import { useTodayKey, useSetting } from "@/data/hooks";
import { useExploreLines } from "@/data/hooks/useExploreLines";
import { shareViewAsImage } from "@/features/share/capture";
import { parseKey } from "@studio/dates";
import { monoRamp, useTokens } from "@studio/theme";
import { Button, Text, showToast } from "@studio/ui";
import * as React from "react";
import { ScrollView, View, type LayoutChangeEvent } from "react-native";

import { useMoneyText } from "./shared";

const RATIO = 1.32;
const STRANDS_PER_MONTH = 14;
const FOOTER = 92;

/** Small repeatable generator: the same year always draws the same poster. */
function seededRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

type Strand = { path: ReturnType<typeof Skia.Path.Make>; color: string; width: number };

function drawStrands(
  monthly: { amount: number; color: string }[],
  width: number,
  height: number,
  seed: number,
): Strand[] {
  const random = seededRandom(seed);
  const peak = Math.max(1, ...monthly.map((m) => m.amount));
  const rowHeight = height / monthly.length;
  return monthly.flatMap((month, row) => {
    const swing = (month.amount / peak) * rowHeight * 1.5;
    const phase = random() * Math.PI * 2;
    return Array.from({ length: STRANDS_PER_MONTH }, (_, strand) => {
      const path = Skia.Path.Make();
      const base = rowHeight * (row + 0.5) + (strand - STRANDS_PER_MONTH / 2) * 1.6;
      const wobble = 1 + random() * 1.4;
      const offset = random() * 0.8;
      for (let step = 0; step <= 40; step += 1) {
        const t = step / 40;
        const y =
          base +
          Math.sin(t * Math.PI * 2 * wobble + phase + offset) * swing * Math.sin(t * Math.PI);
        if (step === 0) path.moveTo(t * width, y);
        else path.lineTo(t * width, y);
      }
      return { path, color: month.color, width: 0.6 + random() * 1.1 };
    });
  });
}

export default function PosterScreen() {
  const { colors, accentKey: accent } = useTokens();
  const money = useMoneyText();
  const today = useTodayKey();
  const [hidden] = useSetting("hide_amounts");
  const year = parseKey(today).year;
  const lines = useExploreLines(`${year}-01-01`, today);
  const ref = React.useRef<View>(null);
  const [width, setWidth] = React.useState(0);
  const height = Math.round(width * RATIO);
  const spending = React.useMemo(() => lines.filter((l) => l.kind === "expense"), [lines]);
  const total = spending.reduce((sum, l) => sum + l.amount, 0);
  const strands = React.useMemo(() => {
    if (width === 0) return [];
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const within = spending.filter((l) => parseKey(l.dateKey).month === i + 1);
      return { amount: within.reduce((sum, l) => sum + l.amount, 0) };
    });
    // The poster is always dark, so it takes the dark shades in either theme.
    const shades = monoRamp(accent, "dark");
    const peak = Math.max(1, ...monthly.map((m) => m.amount));
    const shaded = monthly.map((m) => ({
      amount: m.amount,
      color: shades[Math.round((1 - m.amount / peak) * (shades.length - 1))]!,
    }));
    const spent = shaded.filter((m) => m.amount > 0);
    return spent.length > 0 ? drawStrands(spent, width, height - FOOTER, Math.round(total) + year) : [];
  }, [spending, width, height, total, year, accent]);
  const draw = useEntrance(1800, strands.length > 0);
  const share = async () => {
    try {
      await shareViewAsImage(ref, `pennyfield-${year}`, "Share your year");
    } catch {
      showToast({ message: "Couldn't share the poster" });
    }
  };
  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 px-4 pb-12 pt-2"
    >
      <View
        ref={ref}
        collapsable={false}
        onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
        className="overflow-hidden rounded-[22px]"
        style={{ backgroundColor: colors.chartInk, height: height || 400 }}
      >
        {width > 0 ? (
          <Canvas style={{ position: "absolute", width, height: height - FOOTER }}>
            {strands.map((strand, i) => (
              <Path
                key={i}
                path={strand.path}
                color={strand.color}
                opacity={0.72}
                end={draw}
                style="stroke"
                strokeWidth={strand.width}
              />
            ))}
          </Canvas>
        ) : null}
        <View className="absolute bottom-0 left-0 right-0 justify-center px-5" style={{ height: FOOTER, backgroundColor: colors.chartInk }}>
          <Text variant="title1" style={{ color: "#fff" }}>
            {`${year} in money`}
          </Text>
          {!hidden ? (
            <Text variant="callout" numeric style={{ color: "rgba(255,255,255,0.72)" }}>
              {money(total)}
            </Text>
          ) : null}
        </View>
      </View>
      <Text variant="footnote" tone="secondary">
        {"Each band is a month. Wilder, brighter lines mean more spending."}
      </Text>
      <Button onPress={share}>Share poster</Button>
    </ScrollView>
  );
}
