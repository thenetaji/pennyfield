import * as React from "react";
import { View } from "react-native";

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
  return (
    <View
      className={`h-1 overflow-hidden rounded-full ${className}`}
      style={{ backgroundColor: colors.fill }}
    >
      <View
        style={{
          width: `${Math.max(share * 100, share > 0 ? 2 : 0)}%`,
          height: 4,
          borderRadius: 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export { ShareBar };
