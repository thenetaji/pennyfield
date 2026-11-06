import * as React from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { SegmentedControlProps } from "./segmented-control.types";
import { Text } from "./text";
import { cn } from "../../lib/utils";
import { readableOn, useTweenedColor } from "../../lib/tint";
import { haptic, useTokens } from "@studio/theme";

const INSET = 4;

function SegmentedControl({
  values,
  selectedIndex,
  onChange,
  accessibilityLabel,
  className,
  disabled = false,
  disabledIndexes,
  tintColor,
}: SegmentedControlProps) {
  const { colors } = useTokens();
  const reduced = useReducedMotion();
  const fill = useTweenedColor(tintColor ?? colors.accent);
  const [width, setWidth] = React.useState(0);
  const slot = values.length > 0 ? width / values.length : 0;
  const x = useSharedValue(selectedIndex * slot);
  React.useEffect(() => {
    const target = selectedIndex * slot;
    x.value = reduced || slot === 0 ? target : withTiming(target, { duration: 220 });
  }, [selectedIndex, slot, x, reduced]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width - INSET * 2);
  return (
    <View
      role="tablist"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onLayout={onLayout}
      style={{ padding: INSET, opacity: disabled ? 0.45 : 1 }}
      className={cn("h-11 flex-row rounded-[13px] bg-fill", className)}
    >
      {slot > 0 && selectedIndex >= 0 ? (
        <Animated.View
          pointerEvents="none"
          className="absolute rounded-[10px]"
          style={[
            { left: INSET, top: INSET, bottom: INSET, width: slot, backgroundColor: fill },
            thumb,
          ]}
        />
      ) : null}
      {values.map((label, index) => {
        const selected = index === selectedIndex;
        const off = disabledIndexes?.includes(index) ?? false;
        return (
          <Pressable
            key={label}
            role="tab"
            accessibilityState={{ selected, disabled: disabled || off }}
            disabled={disabled}
            onPress={() => {
              if (off) {
                haptic("error");
                return;
              }
              if (selected) return;
              haptic("selection");
              onChange(index);
            }}
            className="flex-1 items-center justify-center rounded-[10px]"
          >
            <Text
              variant="subhead"
              tone={off ? "tertiary" : "default"}
              className={selected ? "font-semibold" : "font-medium"}
              style={selected ? { color: readableOn(fill, "#141210", "#FFFFFF") } : undefined}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export { SegmentedControl };
export type { SegmentedControlProps };
