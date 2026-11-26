import * as React from "react";
import { Modal, Pressable as RNPressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@studio/icons";
import { haptic, useTokens } from "@studio/theme";
import { Button, Pressable, Text } from "@studio/ui";

export const GLOSSARY = {
  faceValue: {
    title: "Face value",
    body: "The amount the issuer repays for each bond at the end. Interest is worked out on this amount.",
  },
  cleanPrice: {
    title: "Clean price",
    body: "The price of the bond itself, without the interest that has built up since its last payout. Pay above face value and you get less back at the end than you paid.",
  },
  dirtyPrice: {
    title: "Dirty price",
    body: "What you actually pay: the clean price plus the interest built up since the last payout. That extra interest comes back to you with the next payout.",
  },
  accrued: {
    title: "Accrued interest",
    body: "Interest built up since the bond's last payout. Buy before the record date and you pay it to the seller; buy after and you are credited it. It evens out at the next payout.",
  },
  premium: {
    title: "Premium or discount",
    body: "Bought above face value is a premium: that part is not repaid, so it comes out of your interest. Bought below is a discount: you get the difference on top.",
  },
  ytm: {
    title: "Yield (YTM)",
    body: "Your real yearly return if you hold to the end, counting the price you paid, every interest payout and what you get back. Compare bonds by YTM, not by the coupon.",
  },
  coupon: {
    title: "Coupon rate",
    body: "The interest rate printed on the bond, paid on face value. If you paid above face value, your real return (YTM) is lower than this.",
  },
  tds: {
    title: "TDS",
    body: "Tax the issuer cuts from your interest before paying it, usually 10%. If your income is below the taxable limit, submit Form 121 to the issuer to avoid it. Otherwise claim it back in your tax return.",
  },
  xirr: {
    title: "Actual return",
    body: "Your yearly return from the real dates and amounts of money in and out. It is the fairest way to compare one investment with another.",
  },
  interestToCome: {
    title: "Interest to come",
    body: "Interest your investments will still pay until they end, before tax. Deposits that pay at maturity add all of theirs on the last day.",
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;

/** A small "i" that opens a plain explanation of one term. */
export function InfoTip({ term, size = 15 }: { term: GlossaryKey; size?: number }) {
  const [open, setOpen] = React.useState(false);
  const { colors } = useTokens();
  const insets = useSafeAreaInsets();
  const entry = GLOSSARY[term];
  return (
    <>
      <Pressable
        role="button"
        accessibilityLabel={`What is ${entry.title}`}
        hitSlop={10}
        scale={0.9}
        onPress={() => {
          haptic("selection");
          setOpen(true);
        }}
      >
        <AppIcon name="info.circle" size={size} color={colors.textTertiary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <RNPressable
          accessibilityLabel="Close"
          onPress={() => setOpen(false)}
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" }}
        >
          <RNPressable onPress={() => undefined}>
            <View
              className="mx-3 rounded-[24px] bg-surface px-5 pb-4 pt-5"
              style={{ marginBottom: insets.bottom + 12 }}
            >
              <View className="flex-row items-center gap-2.5">
                <View
                  className="h-8 w-8 items-center justify-center rounded-[10px]"
                  style={{ backgroundColor: colors.accentSoft }}
                >
                  <AppIcon name="info.circle" size={18} color={colors.accent} />
                </View>
                <Text variant="title2">{entry.title}</Text>
              </View>
              <Text variant="body" tone="secondary" className="mt-3">
                {entry.body}
              </Text>
              <View className="mt-5">
                <Button size="lg" variant="secondary" onPress={() => setOpen(false)}>
                  Got it
                </Button>
              </View>
            </View>
          </RNPressable>
        </RNPressable>
      </Modal>
    </>
  );
}
