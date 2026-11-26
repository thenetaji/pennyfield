import * as React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { View, type ViewProps } from "react-native";

import { useTokens, washTop } from "@studio/theme";
import { Amount, Pressable, Text, cn } from "@studio/ui";

/** Small letter-spaced caps label that names a block ("YOUR PORTFOLIO"). */
export function Eyebrow({
  children,
  trailing,
  className,
}: {
  children: string;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      className={cn("flex-row items-center justify-between px-5 pb-2 pt-6", className)}
    >
      <Text
        variant="footnote"
        tone="secondary"
        accessibilityRole="header"
        className="font-semibold uppercase tracking-[1.4px]"
      >
        {children}
      </Text>
      {trailing}
    </View>
  );
}

/** The white card that holds a screen's hero, set off from the grey page. */
export function HeroWash({ children, className }: { children: React.ReactNode; className?: string }) {
  const { isDark } = useTokens();
  return (
    <View
      className={cn("mx-4 mt-2 overflow-hidden rounded-[24px] bg-surface", className)}
      style={
        isDark
          ? null
          : {
              shadowColor: "#14120E",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.06,
              shadowRadius: 18,
            }
      }
    >
      {children}
    </View>
  );
}

/** The one big number on a screen, with an optional line under it and a change pill. */
export function StatHero({
  label,
  value,
  sub,
  change,
}: {
  label: string;
  value: string;
  sub?: string;
  change?: { text: string; positive: boolean };
}) {
  return (
    <View className="px-5 pb-6 pt-4">
      <Text
        variant="footnote"
        tone="secondary"
        className="font-semibold uppercase tracking-[1.4px]"
      >
        {label}
      </Text>
      <View className="mt-2 flex-row items-end justify-between">
        <Amount value={value} variant="hero" />
        {change ? <ChangePill {...change} /> : null}
      </View>
      {sub ? (
        <Text variant="subhead" tone="secondary" className="mt-1">
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/** Green (or red) pill for a gain or loss; the only place gain colour is used as a fill. */
export function ChangePill({ text, positive }: { text: string; positive: boolean }) {
  const { colors } = useTokens();
  return (
    <View
      className="mb-2 rounded-[8px] px-2.5 py-1"
      style={{ backgroundColor: positive ? colors.income : colors.expense }}
    >
      <Text variant="footnote" className="font-semibold" style={{ color: "#FFFFFF" }}>
        {text}
      </Text>
    </View>
  );
}

/** White rounded panel on the grey page, no border; rows inside separate with hairlines. */
export function Panel({ className, style, onPress, ...props }: ViewProps & { onPress?: () => void }) {
  const { isDark } = useTokens();
  const body = (
    <View
      className={cn("mx-4 overflow-hidden rounded-[22px] bg-surface", className)}
      style={[
        isDark
          ? null
          : {
              shadowColor: "#14120E",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.05,
              shadowRadius: 14,
            },
        style,
      ]}
      {...props}
    />
  );
  return onPress ? (
    <Pressable role="button" onPress={onPress}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** Light wash of the theme colour behind the top of a tab, fading into the page. Put it first in the screen. */
export function TopWash() {
  const { colors } = useTokens();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[washTop(colors), colors.bg]}
      style={{ position: "absolute", top: 0, left: 0, right: 0, height: 420 }}
    />
  );
}
