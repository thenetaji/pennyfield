import { monthShort, parseKey } from "@studio/dates";
import * as React from "react";
import { ScrollView, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated";

import { useExploreLines, type ExploreLine } from "@/data/hooks/useExploreLines";
import { groupInto, moneyMapTiles, type MapItem, type MapTile } from "@/lib/explore/money-map";
import { haptic, useTokens, withAlpha, type CategoryColorKey } from "@studio/theme";
import { Card, Chip, IconTile, Pressable, Text } from "@studio/ui";

import { useMonths, useMoneyText, useWorkTime } from "./shared";

const MONTHS = 12;

function Tile({
  tile,
  total,
  rank,
  count,
  onPress,
}: {
  tile: MapTile;
  total: number;
  rank: number;
  count: number;
  onPress: () => void;
}) {
  const { category, colors, isDark } = useTokens();
  // Biggest tile is the full colour, and each smaller one is fainter.
  const strength = 1 - (rank / Math.max(1, count - 1)) * 0.84;
  const strong = strength > 0.55;
  const ink = strong ? (isDark ? "#121110" : "#FFFFFF") : colors.text;
  const reduced = useReducedMotion();
  const money = useMoneyText();
  const key = (tile.color as CategoryColorKey) in category ? (tile.color as CategoryColorKey) : "gray";
  const roomy = tile.width >= 96 && tile.height >= 84;
  const percent = Math.round((tile.amount * 100) / Math.max(1, total));
  return (
    <Animated.View
      layout={reduced ? undefined : LinearTransition.duration(280)}
      entering={reduced ? undefined : FadeIn.delay(rank * 45).duration(320)}
      style={{ position: "absolute", left: tile.x, top: tile.y, width: tile.width, height: tile.height }}
    >
      <Pressable
        role="button"
        accessibilityLabel={`${tile.name}, ${money(tile.amount)}, ${percent} percent`}
        scale={0.98}
        onPress={onPress}
        className="flex-1 justify-between overflow-hidden rounded-[16px] p-2.5"
        style={{ backgroundColor: withAlpha(colors.chart, strength) }}
      >
        {tile.width >= 44 && tile.height >= 44 ? (
          <IconTile icon={tile.icon ?? "tag.fill"} color={key} size={roomy ? 32 : 24} />
        ) : null}
        {roomy ? (
          <View>
            <Text variant="footnote" numberOfLines={1} className="font-medium" style={{ color: ink }}>
              {tile.name}
            </Text>
            <Text variant="subhead" numeric numberOfLines={1} className="font-semibold" style={{ color: ink }}>
              {money(tile.amount)}
            </Text>
            <Text variant="caption" numeric style={{ color: ink, opacity: 0.7 }}>
              {`${percent}%`}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function TimeScrubber({
  labels,
  totals,
  selected,
  onSelect,
}: {
  labels: string[];
  totals: number[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const { colors } = useTokens();
  const [width, setWidth] = React.useState(0);
  const peak = Math.max(1, ...totals);
  const pick = (x: number) => {
    const index = Math.min(labels.length - 1, Math.max(0, Math.floor((x / Math.max(1, width)) * labels.length)));
    if (index === selected) return;
    haptic("selection");
    onSelect(index);
  };
  const pan = Gesture.Pan().runOnJS(true).minDistance(0).onBegin((e) => pick(e.x)).onUpdate((e) => pick(e.x));
  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Month"
        accessibilityValue={{ text: labels[selected] }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => {
          const next = selected + (e.nativeEvent.actionName === "increment" ? 1 : -1);
          if (next >= 0 && next < labels.length) onSelect(next);
        }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        className="flex-row items-end gap-1"
        style={{ height: 76 }}
      >
        {totals.map((total, i) => (
          <View key={labels[i]} className="flex-1 items-center gap-1">
            <View
              style={{
                width: "100%",
                height: Math.max(3, (total / peak) * 50),
                borderRadius: 4,
                backgroundColor: i === selected ? colors.chart : colors.fill,
              }}
            />
            <Text variant="caption" tone={i === selected ? "default" : "tertiary"}>
              {labels[i]?.slice(0, 1)}
            </Text>
          </View>
        ))}
      </View>
    </GestureDetector>
  );
}

const inPeriod = (line: ExploreLine, from: string, to: string) =>
  line.dateKey >= from && line.dateKey <= to;

export default function MapScreen() {
  const { colors } = useTokens();
  const money = useMoneyText();
  const workTime = useWorkTime();
  const months = useMonths(MONTHS);
  const first = months[0];
  const last = months[months.length - 1];
  const lines = useExploreLines(first?.from ?? "", last?.to ?? "");
  const spending = React.useMemo(() => lines.filter((l) => l.kind === "expense"), [lines]);
  const [selected, setSelected] = React.useState(months.length - 1);
  const [categoryKey, setCategoryKey] = React.useState<string | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const month = months[selected] ?? last;

  const totals = React.useMemo(
    () =>
      months.map((m) =>
        spending.reduce((sum, l) => (inPeriod(l, m.from, m.to) ? sum + l.amount : sum), 0),
      ),
    [months, spending],
  );
  const labels = months.map((m) => monthShort(parseKey(m.to).month));
  const current = React.useMemo(
    () => (month ? spending.filter((l) => inPeriod(l, month.from, month.to)) : []),
    [spending, month],
  );
  const categories = React.useMemo<MapItem[]>(
    () =>
      groupInto(current, (l) => ({
        key: l.categoryId ?? "none",
        name: l.categoryName,
        color: l.color,
        icon: l.icon,
      })),
    [current],
  );
  const open = categories.find((c) => c.key === categoryKey);
  const items = React.useMemo<MapItem[]>(
    () =>
      open
        ? groupInto(
            current.filter((l) => (l.categoryId ?? "none") === open.key),
            (l) => ({
              key: l.title.trim().toLowerCase() || "untitled",
              name: l.title.trim() || "No title",
              color: l.color,
              icon: l.icon,
            }),
          )
        : categories,
    [open, current, categories],
  );
  const tiles = React.useMemo(
    () => moneyMapTiles(items, size.width, size.height),
    [items, size],
  );
  const total = items.reduce((sum, i) => sum + i.amount, 0);
  const hours = workTime(total);

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 px-4 pb-12 pt-2"
    >
      <View>
        <Text variant="subhead" tone="secondary">
          {open ? `${open.name} in ${labels[selected]}` : `Spent in ${labels[selected]}`}
        </Text>
        <Text variant="hero" numeric>
          {money(total)}
        </Text>
        {hours ? (
          <Text variant="subhead" tone="secondary">
            {`About ${hours} of work`}
          </Text>
        ) : null}
      </View>
      {open ? (
        <View className="flex-row">
          <Chip label="All spending" selected onPress={() => setCategoryKey(null)} />
        </View>
      ) : null}
      <View
        onLayout={(e) =>
          setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
        }
        style={{ height: 420 }}
      >
        {tiles.map((tile, rank) => (
          <Tile
            key={tile.key}
            tile={tile}
            total={total}
            rank={rank}
            count={tiles.length}
            onPress={() => {
              if (open || tile.key === "other") return;
              haptic("medium");
              setCategoryKey(tile.key);
            }}
          />
        ))}
        {tiles.length === 0 && size.width > 0 ? (
          <View
            className="flex-1 items-center justify-center rounded-[14px]"
            style={{ backgroundColor: colors.fill }}
          >
            <Text variant="callout" tone="secondary">
              {`Nothing spent in ${labels[selected]}`}
            </Text>
          </View>
        ) : null}
      </View>
      <Card className="rounded-[20px] px-4 pb-3 pt-3">
        <Text variant="caption" tone="secondary" className="pb-1">
          Slide through the year
        </Text>
        <TimeScrubber
          labels={labels}
          totals={totals}
          selected={selected}
          onSelect={(i) => {
            setSelected(i);
            setCategoryKey(null);
          }}
        />
      </Card>
    </ScrollView>
  );
}
