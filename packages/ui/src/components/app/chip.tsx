import { View } from "react-native";
import * as React from "react";

import { IconTile } from "./icon-tile";
import { AppIcon } from "@studio/icons";
import { Pressable } from "../ui/pressable";
import { Text } from "../ui/text";
import { cn } from "../../lib/utils";
import type { CategoryColorKey } from "@studio/theme";
import { useTokens } from "@studio/theme";

type ChipProps = {
  label: string;
  selected?: boolean;
  icon?: string;
  trailingIcon?: string;
  hint?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
};

function Chip({
  label,
  selected = false,
  icon,
  trailingIcon,
  hint,
  onPress,
  accessibilityLabel,
}: ChipProps) {
  const { colors } = useTokens();
  const iconColor = selected ? colors.onAccent : colors.textSecondary;
  return (
    <Pressable
      role="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      haptic="light"
      popWhen={selected}
      hitSlop={{ top: 6, bottom: 6 }}
      onPress={onPress}
      className={cn(
        "h-10 flex-row items-center gap-1.5 self-start rounded-full px-4",
        selected ? "bg-accent" : "bg-fill",
      )}
    >
      {icon ? <AppIcon name={icon} size={16} color={iconColor} /> : null}
      <Text
        variant="subhead"
        className="font-medium"
        style={selected ? { color: colors.onAccent } : undefined}
        numberOfLines={1}
      >
        {label}
      </Text>
      {hint ? (
        <Text
          variant="subhead"
          tone={selected ? "default" : "secondary"}
          style={selected ? { color: colors.onAccent, opacity: 0.8 } : undefined}
          numeric
          numberOfLines={1}
        >
          {hint}
        </Text>
      ) : null}
      {trailingIcon ? (
        <AppIcon name={trailingIcon} size={11} color={iconColor} />
      ) : null}
    </Pressable>
  );
}

type CategoryChipProps = {
  name: string;
  icon: string;
  color: CategoryColorKey;
  selected?: boolean;
  onPress?: () => void;
};

function CategoryChip({
  name,
  icon,
  color,
  selected = false,
  onPress,
}: CategoryChipProps) {
  const { colors } = useTokens();
  return (
    <Pressable
      role="button"
      accessibilityState={{ selected }}
      accessibilityLabel={name}
      haptic="light"
      popWhen={selected}
      hitSlop={{ top: 6, bottom: 6 }}
      onPress={onPress}
      className={cn(
        "h-10 flex-row items-center gap-2 self-start rounded-full pl-2 pr-4",
        selected ? "bg-accent" : "bg-fill",
      )}
    >
      {selected ? (
        <View className="h-[26px] w-[26px] items-center justify-center">
          <AppIcon name={icon} size={18} color={colors.onAccent} />
        </View>
      ) : (
        <IconTile icon={icon} color={color} size={26} />
      )}
      <Text
        variant="subhead"
        className="font-medium"
        numberOfLines={1}
        style={selected ? { color: colors.onAccent } : { color: colors.text }}
      >
        {name}
      </Text>
    </Pressable>
  );
}

export { CategoryChip, Chip };
export type { CategoryChipProps, ChipProps };
