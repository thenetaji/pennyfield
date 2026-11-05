import * as React from "react";

import { useTokens, withAlpha } from "@studio/theme";

import { heatOpacity } from "./grid";

/** Fill for a day by heat level: a faint wash for no spend, then the accent ramp; future days stay clear. */
export function useHeatFill() {
  const { colors, isDark } = useTokens();
  return React.useCallback(
    (cell: { level: number; future: boolean }) => {
      if (cell.future) return "transparent";
      if (cell.level === 0)
        return isDark
          ? withAlpha(colors.text, 0.06)
          : withAlpha(colors.text, 0.05);
      return withAlpha(
        colors.accent,
        heatOpacity(cell.level) + (isDark ? 0.08 : 0.12),
      );
    },
    [colors, isDark],
  );
}
