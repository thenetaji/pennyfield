import * as React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable, Text } from "@studio/ui";
import { useTokens } from "@studio/theme";

import { useSelection } from "./selection-store";
import { useTransactionActions } from "./use-transaction-actions";

function BarButton({
  label,
  onPress,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      haptic="light"
      hitSlop={6}
      onPress={onPress}
      className="h-11 items-center justify-center px-2"
    >
      <Text
        variant="headline"
        tone={destructive ? "expense" : "accent"}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Bulk actions for the rows picked in select mode; hidden when nothing is picked. */
export function SelectionBar() {
  const ids = useSelection((s) => s.ids);
  const clear = useSelection((s) => s.clear);
  const actions = useTransactionActions();
  const { colors } = useTokens();
  const insets = useSafeAreaInsets();
  React.useEffect(() => clear, [clear]);
  if (ids.length === 0) return null;
  return (
    <View
      className="absolute inset-x-3 gap-1 rounded-[22px] bg-surface px-3 pb-1 pt-2"
      style={{
        bottom: insets.bottom + 56,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center justify-between px-2">
        <Text variant="footnote" tone="secondary" numeric>
          {ids.length === 1 ? "1 selected" : `${ids.length} selected`}
        </Text>
        <BarButton label="Done" onPress={clear} />
      </View>
      <View className="flex-row justify-between">
        <BarButton label="Category" onPress={() => actions.bulk.category(ids)} />
        <BarButton label="Counts as" onPress={() => actions.bulk.side(ids)} />
        <BarButton
          label="Delete"
          destructive
          onPress={() => actions.bulk.remove(ids, clear)}
        />
      </View>
    </View>
  );
}
