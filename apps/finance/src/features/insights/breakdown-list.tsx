import * as React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

import { IconTile, Pressable, Text } from "@studio/ui";
import type { BreakdownSlice } from "@/data/hooks";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { durations, useTokens } from "@studio/theme";

import { asColorKey } from "./breakdown-model";
import { ShareBar } from "./share-bar";

type Money = {
  currency: string;
  locale?: string;
  showDecimals: boolean;
};

type RowProps = Money & {
  slice: BreakdownSlice;
  nested?: boolean;
  last: boolean;
  /** Group rows: whether the member categories are showing. */
  expanded?: boolean;
  /** Largest amount among the rows at this level; bars scale to it. */
  max: number;
  onPress?: () => void;
};

const countLabel = (count: number) =>
  count === 1 ? "1 transaction" : `${count} transactions`;

function Row({
  slice,
  nested = false,
  last,
  expanded,
  max,
  onPress,
  currency,
  locale,
  showDecimals,
}: RowProps) {
  const { colors, category } = useTokens();
  const color = asColorKey(slice.color);
  const amount = formatMoney(slice.amount, currency, {
    locale,
    decimals: showDecimals ? undefined : 0,
  });
  const tile = nested ? 28 : 38;
  const inset = nested ? 52 + tile + 12 - 16 : 64;
  const grouped = slice.children.length > 0;
  return (
    <Pressable
      role="button"
      disabled={!onPress}
      accessibilityState={grouped ? { expanded } : undefined}
      accessibilityLabel={`${slice.name}, ${formatMoneyForSpeech(slice.amount, currency, { sign: "none", locale })}, ${slice.percent} percent, ${countLabel(slice.count)}`}
      onPress={onPress}
      scale={1}
      className="flex-row items-center bg-surface py-2.5 pr-4 active:bg-fill"
      style={{ minHeight: nested ? 52 : 60, paddingLeft: nested ? 52 : 16 }}
    >
      <IconTile icon={slice.icon} color={color} size={tile} />
      <View className="ml-3 flex-1">
        <Text variant={nested ? "callout" : "body"} numberOfLines={1}>
          {slice.name}
        </Text>
        {nested ? null : (
          <ShareBar amount={slice.amount} max={max} color={category[color]} />
        )}
        {grouped || nested ? (
          <Text variant="caption" tone="tertiary" className="mt-1">
            {grouped
              ? `${slice.children.length} ${slice.children.length === 1 ? "category" : "categories"}`
              : countLabel(slice.count)}
          </Text>
        ) : null}
      </View>
      <View className="ml-4 items-end" style={{ minWidth: 72 }}>
        <Text
          variant={nested ? "callout" : "body"}
          numeric
          numberOfLines={1}
          className="font-medium"
        >
          {amount}
        </Text>
        <Text variant="footnote" tone="tertiary" numeric>
          {`${slice.percent}%`}
        </Text>
      </View>
      {last ? null : (
        <View
          pointerEvents="none"
          style={{
            left: inset,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.separator,
          }}
          className="absolute bottom-0 right-0"
        />
      )}
    </Pressable>
  );
}

type BreakdownListProps = Money & {
  slices: readonly BreakdownSlice[];
  onOpen: (slice: BreakdownSlice) => void;
};

/**
 * One row per slice: icon, name, share bar (scaled to the largest row), amount and percent. A group row toggles its member categories
 * underneath; rows with a screen (category, tag, account) open it.
 */
function BreakdownList({ slices, onOpen, ...money }: BreakdownListProps) {
  const [open, setOpen] = React.useState<ReadonlySet<string>>(new Set());
  const max = slices.reduce((m, s) => Math.max(m, s.amount), 0);
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return (
    <>
      {slices.map((slice, index) => {
        const grouped = slice.children.length > 0;
        const expanded = grouped && open.has(slice.key);
        const last = index === slices.length - 1;
        return (
          <Animated.View
            key={slice.key}
            layout={LinearTransition.duration(durations.row)}
          >
            <Row
              {...money}
              slice={slice}
              max={max}
              last={last && !expanded}
              expanded={expanded}
              onPress={
                grouped
                  ? () => toggle(slice.key)
                  : slice.target
                    ? () => onOpen(slice)
                    : undefined
              }
            />
            {expanded
              ? slice.children.map((child, i) => (
                  <Row
                    {...money}
                    key={child.key}
                    slice={child}
                    max={slice.children[0]?.amount ?? 0}
                    nested
                    last={last && i === slice.children.length - 1}
                    onPress={child.target ? () => onOpen(child) : undefined}
                  />
                ))
              : null}
          </Animated.View>
        );
      })}
    </>
  );
}

export { BreakdownList };
