import * as React from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useEntrance } from "@/components/app/scroll-reveal";

import { useTokens } from "@studio/theme";

import { shareOfMax } from "./share";

/** The one share bar Insights lists use: 4 pt, on a fill track, scaled to the largest row. */
function ShareBar({
  amount,
  max,
  color,
  className = "mt-1.5",
}: {
  amount: number;
  max: number;
  color: string;
  className?: string;
}) {
  const { colors } = useTokens();
  const share = shareOfMax(amount, max);
  const target = Math.max(share * 100, share > 0 ? 2 : 0);
  const grow = useEntrance(650);
  const fill = useAnimatedStyle(() => ({ width: `${target * grow.value}%` }));
  return (
    <View
      className={`h-1 overflow-hidden rounded-full ${className}`}
      style={{ backgroundColor: colors.fill }}
    >
      <Animated.View
        style={[{ height: 4, borderRadius: 2, backgroundColor: color }, fill]}
      />
    </View>
  );
}

export { ShareBar };
