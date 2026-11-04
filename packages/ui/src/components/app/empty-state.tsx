import * as React from "react";
import { View, type LayoutChangeEvent } from "react-native";

import Animated from "react-native-reanimated";

import { AppIcon } from "@studio/icons";
import { Button } from "../ui/button";
import { Text } from "../ui/text";
import { fadeIn, Float } from "@studio/motion";
import { useTokens } from "@studio/theme";

type EmptyStateProps = {
  /** Optional headline above the message, for a first-run screen. */
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
};

const LIFT = 0.1;

/**
 * Centred in the space below the last fixed element, lifted 10% so it sits above optical centre.
 * The action is always a secondary button; labels are verb + object.
 */
function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  icon = "tray",
}: EmptyStateProps) {
  const { colors } = useTokens();
  const [height, setHeight] = React.useState(0);
  const onLayout = React.useCallback(
    (event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height),
    [],
  );
  return (
    <View
      onLayout={onLayout}
      className="min-h-[200px] flex-1 items-center justify-center gap-4 px-6"
      style={{ paddingBottom: height * LIFT * 2 }}
    >
      <Float>
        <Animated.View
          entering={fadeIn(0)}
          className="size-14 items-center justify-center rounded-full bg-fill"
        >
          <AppIcon name={icon} size={24} color={colors.textTertiary} />
        </Animated.View>
      </Float>
      <Animated.View entering={fadeIn(120)} className="items-center gap-4">
        <View className="items-center gap-1.5">
          {title ? (
            <Text variant="title2" className="text-center font-semibold">
              {title}
            </Text>
          ) : null}
          <Text
            variant="callout"
            tone="secondary"
            className="max-w-[300px] text-center"
          >
            {message}
          </Text>
        </View>
        {actionLabel && onAction ? (
          <Button variant="secondary" onPress={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </Animated.View>
    </View>
  );
}

export { EmptyState };
export type { EmptyStateProps };
