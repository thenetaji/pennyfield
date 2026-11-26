import type { NativeStackNavigationOptions } from "expo-router";

import { useTokens, washTop } from "@studio/theme";

/**
 * Header chrome shared by every stack: a solid `bg` header (true black in dark, paper in light),
 * no blur material, no hairline. `headerBlurEffect: 'none'` stops UIKit substituting a grey
 * system material, and `headerShadowVisible: false` removes the scroll-edge hairline.
 */
export function headerChrome(colors: {
  bg: string;
  accent: string;
  text: string;
}): NativeStackNavigationOptions {
  return {
    headerTransparent: false,
    headerBlurEffect: "none",
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.accent,
    headerTitleStyle: { color: colors.text },
  };
}

/** `tinted` matches the header bar to a screen whose top carries the soft accent wash. */
export function useTabStackOptions({ tinted = false }: { tinted?: boolean } = {}): NativeStackNavigationOptions {
  const { colors } = useTokens();
  return {
    ...headerChrome(tinted ? { ...colors, bg: washTop(colors) } : colors),
    headerLargeTitleEnabled: false,
    contentStyle: { backgroundColor: colors.bg },
  };
}
