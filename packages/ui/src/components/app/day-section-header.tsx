import { View } from "react-native";

import { useTokens, withAlpha } from "@studio/theme";

import { Text } from "../ui/text";

type DaySectionHeaderProps = {
  label: string;
  total?: string;
  /** Lines up with rows drawn as inset cards. */
  inset?: boolean;
  /** Draws a hairline bar of this length (0–1), e.g. the day's spend against the biggest day. */
  share?: number;
};

function DaySectionHeader({
  label,
  total,
  inset = false,
  share,
}: DaySectionHeaderProps) {
  const { colors } = useTokens();
  return (
    <View
      accessibilityRole="header"
      className={`bg-bg pb-2 pt-5 ${inset ? "px-8" : "px-4"}`}
    >
      <View className="flex-row items-baseline justify-between">
      <Text variant="footnote" tone="secondary" className="font-semibold">
        {label}
      </Text>
      {total ? (
        <Text variant="footnote" tone="secondary" numeric>
          {total}
        </Text>
      ) : null}
      </View>
      {share !== undefined ? (
        <View
          className="mt-1.5 h-[2px] overflow-hidden rounded-full"
          style={{ backgroundColor: withAlpha(colors.text, 0.06) }}
        >
          <View
            className="h-full rounded-full"
            style={{
              width: `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%`,
              backgroundColor: withAlpha(colors.text, 0.32),
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

export { DaySectionHeader };
export type { DaySectionHeaderProps };
