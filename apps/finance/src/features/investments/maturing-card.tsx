import { useRouter } from "expo-router";
import { View } from "react-native";

import { addDays } from "@studio/dates";
import { formatMoney } from "@studio/money";
import { Card, Pressable, Text } from "@studio/ui";

import { useInvestments, useTodayKey } from "@/data/hooks";

import { dateLabel } from "./format";

const WINDOW_DAYS = 30;
const MAX_ROWS = 3;

/** Investments that matured without a payout or mature in the next 30 days; nothing when there are none. */
export function MaturingCard({
  locale,
  showDecimals,
}: {
  locale?: string;
  showDecimals: boolean;
}) {
  const router = useRouter();
  const today = useTodayKey();
  const horizon = addDays(today, WINDOW_DAYS);
  const soon = useInvestments().filter(
    (s) =>
      s.status === "due" ||
      (s.status === "open" &&
        s.investment.maturityDate !== null &&
        s.investment.maturityDate <= horizon),
  );
  if (soon.length === 0) return null;
  const decimals = showDecimals ? undefined : 0;
  const shown = soon.slice(0, MAX_ROWS);
  return (
    <View className="mt-4">
      <Pressable
        role="button"
        accessibilityLabel={`Investments maturing, ${soon.length}`}
        scale={0.98}
        onPress={() => router.push("/investments")}
      >
        <Card className="gap-2 rounded-[20px] px-4 py-3">
          <View className="flex-row items-center justify-between">
            <Text variant="caption" tone="secondary">
              Maturing soon
            </Text>
            <Text variant="caption" tone="accent" className="font-semibold">
              Details
            </Text>
          </View>
          {shown.map((s) => (
            <View
              key={s.investment.id}
              className="flex-row items-baseline gap-2"
            >
              <Text variant="body" numberOfLines={1} className="min-w-0 flex-1">
                {s.investment.name}
              </Text>
              <Text
                variant="footnote"
                tone={s.status === "due" ? "warning" : "secondary"}
              >
                {s.status === "due"
                  ? "Add payout"
                  : dateLabel(s.investment.maturityDate ?? today)}
              </Text>
              <Text variant="headline" numeric>
                {formatMoney(s.investment.amount, s.investment.currency, {
                  locale,
                  sign: "none",
                  decimals,
                })}
              </Text>
            </View>
          ))}
          {soon.length > MAX_ROWS ? (
            <Text variant="footnote" tone="secondary">
              {`${soon.length - MAX_ROWS} more`}
            </Text>
          ) : null}
        </Card>
      </Pressable>
    </View>
  );
}
