import { useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@studio/icons";
import { haptic, useTokens } from "@studio/theme";
import { Button, Pressable, Text } from "@studio/ui";

import { useActions } from "@/data/actions";

type Page = {
  icon: string;
  title: string;
  lines: readonly string[];
  example?: readonly [string, string][];
};

const PAGES: readonly Page[] = [
  {
    icon: "pencil",
    title: "Title and category",
    lines: [
      "Title is who you paid or what for.",
      "Category is the kind of money.",
      "Type a title once. Next time its category fills in by itself.",
    ],
    example: [
      ["Swiggy", "Food"],
      ["Rent", "Home"],
      ["Uber", "Transport"],
      ["Salary", "Income"],
    ],
  },
  {
    icon: "square.grid.2x2",
    title: "Keep categories few",
    lines: [
      "About ten is enough. Fewer categories make clearer charts.",
      "Pick by what you'd want to cut back on, not by shop.",
    ],
    example: [
      ["Spending", "Food · Groceries · Home · Bills"],
      ["", "Transport · Shopping · Health · Fun"],
      ["Income", "Salary · Business · Interest"],
    ],
  },
  {
    icon: "tag.fill",
    title: "Notes and tags are optional",
    lines: [
      "Note: a detail you'd forget, like what you bought.",
      "Tag: something across categories, like a trip or a wedding.",
      "Not sure? Skip both.",
    ],
  },
  {
    icon: "arrow.left.arrow.right",
    title: "Moving money isn't spending",
    lines: [
      "Bank to wallet, paying a card bill, buying an FD or bond: use Transfer.",
      "Interest and payouts count as income.",
    ],
  },
  {
    icon: "briefcase.fill",
    title: "Business money",
    lines: [
      "Turn on Business for a category in Categories.",
      "Its entries stay out of your personal totals and get their own page.",
    ],
  },
  {
    icon: "chart.line.uptrend.xyaxis",
    title: "Investments",
    lines: [
      "Swipe left on Activity to see FDs and bonds.",
      "Add one with the amount, rate and dates, or import your Stable Bonds reports.",
    ],
  },
];

/** Short how-to: shown once after setup, and again from Settings. */
export function GuideScreen() {
  const router = useRouter();
  const actions = useActions();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTokens();
  const scroller = React.useRef<ScrollView>(null);
  const [page, setPage] = React.useState(0);
  const last = page === PAGES.length - 1;

  const close = () => {
    actions.settings.set("guide_seen", true);
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const next = () => {
    haptic("selection");
    if (last) return close();
    scroller.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 12 }}>
      <View className="flex-row justify-end px-5 py-2">
        <Pressable role="button" onPress={close} hitSlop={12}>
          <Text variant="callout" tone="secondary">
            {last ? "Close" : "Skip"}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {PAGES.map((p) => (
          <View key={p.title} style={{ width }} className="justify-center px-8">
            <View
              className="mb-8 h-16 w-16 items-center justify-center rounded-[20px]"
              style={{ backgroundColor: colors.accent }}
            >
              <AppIcon name={p.icon} size={30} color={colors.onAccent} />
            </View>
            <Text variant="title1">{p.title}</Text>
            <View className="mt-4 gap-3">
              {p.lines.map((line) => (
                <Text key={line} variant="body" tone="secondary">
                  {line}
                </Text>
              ))}
            </View>
            {p.example ? (
              <View className="mt-8 overflow-hidden rounded-[22px] bg-surface">
                {p.example.map(([left, right], i) => (
                  <View
                    key={`${left}${right}`}
                    className="flex-row items-center justify-between px-4 py-3.5"
                    style={
                      i > 0
                        ? { borderTopWidth: 0.5, borderTopColor: colors.separator }
                        : null
                    }
                  >
                    <Text variant="body" className="font-medium">
                      {left}
                    </Text>
                    <Text variant="subhead" tone="secondary" className="ml-4 shrink text-right">
                      {right}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <View className="flex-row justify-center gap-2 py-6">
        {PAGES.map((p, i) => (
          <View
            key={p.title}
            className="h-1.5 rounded-full"
            style={{
              width: i === page ? 20 : 6,
              backgroundColor: i === page ? colors.accent : colors.fill,
            }}
          />
        ))}
      </View>
      <View className="px-5">
        <Button size="lg" onPress={next}>
          {last ? "Start" : "Next"}
        </Button>
      </View>
    </View>
  );
}
