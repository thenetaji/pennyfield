import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMonthReport, useSettings, useTodayKey } from "@/data/hooks";
import { useMoneyText } from "@/features/explore/shared";
import { monthOfPeriod, reportPeriod } from "@/features/report/labels";
import { shareViewAsImage } from "@/features/share/capture";
import { firstParam } from "@/features/insights/params";
import { haptic, useTokens } from "@studio/theme";
import { Button, Pressable, SymbolIcon, Text, showToast } from "@studio/ui";

type Page = { eyebrow: string; headline: string; line?: string };

export default function RecapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ month: string }>();
  const { colors } = useTokens();
  const money = useMoneyText();
  const settings = useSettings();
  const today = useTodayKey();
  const periodSettings = React.useMemo(
    () => ({ weekStart: settings.week_start, monthStart: settings.month_start }),
    [settings.week_start, settings.month_start],
  );
  const [period] = React.useState(() =>
    reportPeriod(firstParam(params.month) ?? "", today, periodSettings),
  );
  const report = useMonthReport(period, periodSettings, today);
  const [page, setPage] = React.useState(0);
  const pageRef = React.useRef<View>(null);
  const reduced = useReducedMotion();
  const month = monthOfPeriod(period);

  const top = report.categories[0];
  const biggest = report.biggest[0];
  const pages: Page[] = [
    {
      eyebrow: `${month} in money`,
      headline: money(report.current.spent),
      line: `across ${report.transactionCount} ${report.transactionCount === 1 ? "entry" : "entries"}`,
    },
    ...(top
      ? [
          {
            eyebrow: "Most of it went to",
            headline: top.category?.name ?? "Uncategorised",
            line: money(top.current),
          },
        ]
      : []),
    ...(biggest
      ? [
          {
            eyebrow: "Your biggest single spend",
            headline: biggest.title.trim() || "No title",
            line: money(biggest.amount),
          },
        ]
      : []),
    ...(report.noSpend.days.length > 0
      ? [
          {
            eyebrow: "Days you spent nothing",
            headline: String(report.noSpend.days.length),
            line:
              report.noSpend.longest.length > 1
                ? `Your longest run was ${report.noSpend.longest.length} days`
                : undefined,
          },
        ]
      : []),
    {
      eyebrow: "Money left over",
      headline: money(Math.abs(report.current.net)),
      line:
        report.current.net >= 0
          ? "You earned more than you spent"
          : "You spent more than you earned",
    },
  ];

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    if (next !== page) {
      haptic("selection");
      setPage(next);
    }
  };
  const share = async () => {
    try {
      await shareViewAsImage(pageRef, `recap-${page + 1}`, `${month} recap`);
    } catch {
      showToast({ message: "Couldn't share this page" });
    }
  };
  return (
    <View ref={pageRef} collapsable={false} className="flex-1" style={{ backgroundColor: colors.chartInk }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={64} onScroll={onScroll}>
        {pages.map((p, i) => (
          <View key={p.eyebrow} style={{ width }} className="flex-1 justify-center px-8">
            <Animated.View key={i === page ? "shown" : "waiting"} entering={i === page && !reduced ? FadeInDown.duration(420) : undefined}>
            <Text variant="callout" style={{ color: "rgba(255,255,255,0.7)" }}>
              {p.eyebrow}
            </Text>
            <Text variant="hero" numeric adjustsFontSizeToFit numberOfLines={2} style={{ color: "#fff" }}>
              {p.headline}
            </Text>
            {p.line ? (
              <Text variant="headline" className="pt-2" style={{ color: "rgba(255,255,255,0.8)" }}>
                {p.line}
              </Text>
            ) : null}
            </Animated.View>
          </View>
        ))}
      </ScrollView>
      <View className="absolute left-0 right-0 flex-row items-center justify-between px-5" style={{ top: insets.top + 8 }}>
        <View className="flex-row gap-1.5" accessibilityLabel={`Page ${page + 1} of ${pages.length}`}>
          {pages.map((p, i) => (
            <View
              key={p.eyebrow}
              style={{ width: 22, height: 3, borderRadius: 2, backgroundColor: i === page ? "#fff" : "rgba(255,255,255,0.3)" }}
            />
          ))}
        </View>
        <Pressable role="button" accessibilityLabel="Close" hitSlop={12} scale={0.92} onPress={() => router.back()}>
          <SymbolIcon name="xmark" size={18} color="#fff" weight="bold" />
        </Pressable>
      </View>
      <View className="absolute left-0 right-0 px-8" style={{ bottom: insets.bottom + 20 }}>
        <Button variant="secondary" onPress={share}>
          Share this page
        </Button>
      </View>
    </View>
  );
}
