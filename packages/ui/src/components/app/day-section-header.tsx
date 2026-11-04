import { View } from "react-native";

import { Text } from "../ui/text";

type DaySectionHeaderProps = {
  label: string;
  total?: string;
  /** Lines up with rows drawn as inset cards. */
  inset?: boolean;
};

function DaySectionHeader({
  label,
  total,
  inset = false,
}: DaySectionHeaderProps) {
  return (
    <View
      accessibilityRole="header"
      className={`flex-row items-baseline justify-between bg-bg pb-2 pt-5 ${inset ? "px-8" : "px-4"}`}
    >
      <Text variant="footnote" tone="secondary" className="font-semibold">
        {label}
      </Text>
      {total ? (
        <Text variant="footnote" tone="secondary" numeric>
          {total}
        </Text>
      ) : null}
    </View>
  );
}

export { DaySectionHeader };
export type { DaySectionHeaderProps };
