import { View } from "react-native";

import { AppIcon } from "@studio/icons";
import { Pressable, SegmentedControl, Text } from "@studio/ui";
import type { PeriodType } from "@studio/dates";
import { haptic, useTokens } from "@studio/theme";

/** "all" is everything from the first entry to today. */
export type PeriodChoice = PeriodType | "all";
const TYPES: readonly PeriodChoice[] = ["week", "month", "year", "all", "custom"];

type PeriodControlsProps = {
  type: PeriodChoice;
  label: string;
  canForward: boolean;
  onType: (type: PeriodChoice) => void;
  onStep: (direction: 1 | -1) => void;
  /** Tapping the label edits a custom range. */
  onEditCustom: () => void;
  /** "FY" when years follow the financial year. */
  yearLabel?: string;
  /** Tapping the label of a week, month or year that is not current jumps back to now. */
  onJumpToCurrent: () => void;
};

function StepButton({
  symbol,
  label,
  disabled,
  onPress,
}: {
  symbol: string;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTokens();
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      disabled={disabled}
      scale={1}
      dimTo={0.6}
      hitSlop={6}
      onPress={() => {
        haptic("selection");
        onPress();
      }}
      className="h-11 w-11 items-center justify-center"
    >
      <AppIcon
        name={symbol}
        size={18}
        color={disabled ? colors.textTertiary : colors.accent}
      />
    </Pressable>
  );
}

/** Week | Month | Year | All | Custom, with a stepper row beneath (just the label for All). */
function PeriodControls({
  type,
  label,
  canForward,
  onType,
  onStep,
  onEditCustom,
  onJumpToCurrent,
  yearLabel = "Year",
}: PeriodControlsProps) {
  const custom = type === "custom";
  const all = type === "all";
  const tappable = custom || canForward;
  return (
    <View>
      <View className="px-4 pt-2">
        <SegmentedControl
          values={["Week", "Month", yearLabel, "All", "Custom"]}
          selectedIndex={TYPES.indexOf(type)}
          onChange={(index) => onType(TYPES[index] ?? "month")}
          accessibilityLabel="Period"
        />
      </View>
      {all ? (
        <View className="h-11 justify-center pt-1">
          <Text variant="headline" numberOfLines={1} className="text-center">
            {label}
          </Text>
        </View>
      ) : (
      <View className="flex-row items-center justify-between px-2 pt-1">
        <StepButton
          symbol="chevron.left"
          label="Previous period"
          onPress={() => onStep(-1)}
        />
        <Pressable
          role={tappable ? "button" : undefined}
          disabled={!tappable}
          scale={1}
          dimTo={0.6}
          onPress={custom ? onEditCustom : onJumpToCurrent}
          accessibilityLabel={
            custom || !canForward ? label : `${label}, go to current period`
          }
          className="h-11 justify-center"
        >
          <Text variant="headline" numberOfLines={1} className="text-center">
            {label}
          </Text>
        </Pressable>
        <StepButton
          symbol="chevron.right"
          label="Next period"
          disabled={!canForward}
          onPress={() => onStep(1)}
        />
      </View>
      )}
    </View>
  );
}

export { PeriodControls };
