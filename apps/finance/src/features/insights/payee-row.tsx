import * as React from "react";
import { StyleSheet, View } from "react-native";

import { IconTile, Pressable, Text } from "@studio/ui";
import type { CategoryRow } from "@/db/schema";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { categoryKeys, useTokens, type CategoryColorKey } from "@studio/theme";

import type { Payee } from "./payees-model";
import { ShareBar } from "./share-bar";

const asColor = (value: string | undefined): CategoryColorKey =>
  (categoryKeys as readonly string[]).includes(value ?? "")
    ? (value as CategoryColorKey)
    : "gray";

type PayeeRowProps = {
  payee: Payee;
  category: CategoryRow | null;
  currency: string;
  locale?: string;
  showDecimals: boolean;
  /** Largest amount in the list; the share bar scales to it. */
  max: number;
  separator: boolean;
  onPress: () => void;
};

/** Name, share bar and "6 × avg ₹420" on the left; total and share of the period trailing. */
const PayeeRow = React.memo(function PayeeRow({
  payee,
  category,
  currency,
  locale,
  showDecimals,
  max,
  separator,
  onPress,
}: PayeeRowProps) {
  const { colors, category: palette } = useTokens();
  const color = asColor(category?.color);
  const average = formatMoney(payee.average, currency, {
    locale,
    decimals: 0,
  });
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${payee.title}, ${formatMoneyForSpeech(payee.amount, currency, { sign: "none", locale })}, ${payee.count} ${payee.count === 1 ? "time" : "times"}, average ${formatMoneyForSpeech(payee.average, currency, { sign: "none", locale })}`}
      onPress={onPress}
      scale={1}
      className="min-h-[62px] flex-row items-center bg-surface px-4 py-2.5 active:bg-fill"
    >
      <IconTile icon={category?.icon ?? "tag.fill"} color={color} />
      <View className="ml-3 min-w-0 flex-1">
        <Text variant="body" numberOfLines={1}>
          {payee.title}
        </Text>
        <ShareBar amount={payee.amount} max={max} color={palette[color]} />
        <Text
          variant="caption"
          tone="tertiary"
          numeric
          numberOfLines={1}
          className="mt-1"
        >
          {payee.count === 1 ? "Once" : `${payee.count} × avg ${average}`}
        </Text>
      </View>
      <View className="ml-4 items-end" style={{ minWidth: 72 }}>
        <Text variant="body" numeric numberOfLines={1} className="font-medium">
          {formatMoney(payee.amount, currency, {
            locale,
            decimals: showDecimals ? undefined : 0,
          })}
        </Text>
        <Text variant="footnote" tone="tertiary" numeric>
          {`${payee.percent}%`}
        </Text>
      </View>
      {separator ? (
        <View
          pointerEvents="none"
          style={{
            left: 64,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.separator,
          }}
          className="absolute bottom-0 right-0"
        />
      ) : null}
    </Pressable>
  );
});

export { PayeeRow };
