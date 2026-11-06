import { Canvas, Path, Picture, Skia, createPicture } from "@shopify/react-native-skia";
import Matter from "matter-js";
import * as React from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { useExploreLines } from "@/data/hooks/useExploreLines";
import { coinCount, coinValue } from "@/lib/explore/coins";
import { haptic, useTokens, withAlpha } from "@studio/theme";
import { Text } from "@studio/ui";
import { monthShort, parseKey } from "@studio/dates";

import { useMonths, useMoneyText, useTilt } from "./shared";

const WALL = 40;
const PHYSICS_STEP = 1000 / 60;
const MAX_STEPS = 8;
const MIN_COIN = 9;
const MAX_COIN = 22;
/** How much of the jar the coins should fill, so few big savings and many small ones both look full. */
const FILL = 0.5;

function shakeCoins(engine: Matter.Engine) {
  for (const body of Matter.Composite.allBodies(engine.world)) {
    if (body.isStatic) continue;
    Matter.Sleeping.set(body, false);
    Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * 9, y: -8 - Math.random() * 6 });
  }
}

function JarView({
  countsKey,
  size,
}: {
  /** Coins per month, comma separated: the jar refills only when these change. */
  countsKey: string;
  size: { width: number; height: number };
}) {
  const { colors, ramp } = useTokens();
  const tilt = useTilt();
  const { width, height } = size;
  const [picture, setPicture] = React.useState<ReturnType<typeof createPicture> | null>(null);
  const [engine] = React.useState(() => Matter.Engine.create({ enableSleeping: true }));

  React.useEffect(() => {
    Matter.Composite.clear(engine.world, false);
    const counts = countsKey.split(",").map(Number);
    const total = Math.max(1, counts.reduce((sum, c) => sum + c, 0));
    const COIN = Math.min(MAX_COIN, Math.max(MIN_COIN, Math.sqrt((FILL * width * height) / (total * Math.PI))));
    const wall = { isStatic: true };
    Matter.Composite.add(engine.world, [
      Matter.Bodies.rectangle(width / 2, height + WALL / 2, width, WALL, wall),
      Matter.Bodies.rectangle(-WALL / 2, height / 2, WALL, height * 3, wall),
      Matter.Bodies.rectangle(width + WALL / 2, height / 2, WALL, height * 3, wall),
    ]);
    const coins: { body: Matter.Body; month: number }[] = [];
    counts.forEach((count, month) => {
      for (let i = 0; i < count; i += 1) {
        const body = Matter.Bodies.circle(
          COIN + Math.random() * (width - COIN * 2),
          -COIN * 2 - coins.length * 12,
          COIN,
          { restitution: 0.35, friction: 0.08, density: 0.002 },
        );
        coins.push({ body, month });
      }
    });
    Matter.Composite.add(engine.world, coins.map((c) => c.body));

    // Older months are the faint end of the ramp, so the layers read as time.
    const shades = counts.map((_, month) =>
      Skia.Color(ramp[Math.round((1 - month / Math.max(1, counts.length - 1)) * (ramp.length - 1))]!),
    );
    const coinPaint = Skia.Paint();
    const rimPaint = Skia.Paint();
    rimPaint.setStyle(1);
    rimPaint.setStrokeWidth(1.5);
    rimPaint.setColor(Skia.Color(withAlpha(colors.surface, 0.35)));
    let frame = 0;
    let last = 0;
    let owed = 0;
    const step = (time: number) => {
      // Fixed steps, so coins fall at the same speed on a slow frame rate.
      owed = Math.min(owed + (last === 0 ? PHYSICS_STEP : time - last), PHYSICS_STEP * MAX_STEPS);
      last = time;
      const lean = tilt.value;
      engine.gravity.x = lean.x * -1;
      engine.gravity.y = lean.x === 0 && lean.y === 0 ? 1 : Math.max(0.15, -lean.y);
      for (; owed >= PHYSICS_STEP; owed -= PHYSICS_STEP) Matter.Engine.update(engine, PHYSICS_STEP);
      setPicture(
        createPicture((canvas) => {
          for (const { body, month } of coins) {
            coinPaint.setColor(shades[month]!);
            canvas.drawCircle(body.position.x, body.position.y, COIN, coinPaint);
            canvas.drawCircle(body.position.x, body.position.y, COIN * 0.72, rimPaint);
          }
        }),
      );
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [engine, countsKey, width, height, ramp, colors.surface, tilt]);

  const glass = React.useMemo(() => {
    const path = Skia.Path.Make();
    path.moveTo(1, 0);
    path.lineTo(1, height - 22);
    path.quadTo(1, height - 1, 22, height - 1);
    path.lineTo(width - 22, height - 1);
    path.quadTo(width - 1, height - 1, width - 1, height - 22);
    path.lineTo(width - 1, 0);
    return path;
  }, [width, height]);

  const shake = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      haptic("medium");
      shakeCoins(engine);
    });

  return (
    <GestureDetector gesture={shake}>
      <View accessibilityRole="button" accessibilityLabel="Shake the jar" style={{ width, height }}>
        <Canvas style={{ width, height }}>
          {picture ? <Picture picture={picture} /> : null}
          <Path path={glass} color={colors.separator} style="stroke" strokeWidth={2} />
        </Canvas>
      </View>
    </GestureDetector>
  );
}

export default function JarScreen() {
  const money = useMoneyText();
  const months = useMonths(12);
  const lines = useExploreLines(months[0]?.from ?? "", months[months.length - 1]?.to ?? "");
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const saved = months.map((m) => {
    const net = lines.reduce(
      (sum, l) =>
        l.dateKey < m.from || l.dateKey > m.to
          ? sum
          : sum + (l.kind === "income" ? l.amount : -l.amount),
      0,
    );
    return Math.max(0, net);
  });
  const total = saved.reduce((sum, s) => sum + s, 0);
  const value = coinValue(total);
  const counts = saved.map((s) => coinCount(s, value));
  const coins = counts.reduce((sum, c) => sum + c, 0);
  const first = months[0];
  const last = months[months.length - 1];
  return (
    <View className="flex-1 gap-3 bg-bg px-4 pb-8 pt-2">
      <View style={{ paddingTop: 8 }}>
        <Text variant="subhead" tone="secondary">
          {first && last
            ? `Saved ${monthShort(parseKey(first.to).month)} to ${monthShort(parseKey(last.to).month)}`
            : "Saved"}
        </Text>
        <Text variant="hero" numeric>
          {money(total)}
        </Text>
        <Text variant="footnote" tone="secondary">
          {coins > 0
            ? `Each coin is ${money(value)}. Tap to shake, tilt to pour.`
            : "Months where you earn more than you spend fill this jar."}
        </Text>
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
        {size.width > 0 && size.height > 0 ? <JarView countsKey={counts.join(",")} size={size} /> : null}
      </View>
    </View>
  );
}
