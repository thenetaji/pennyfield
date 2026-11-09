import { dayLabel } from "@studio/dates";
import { AppIcon } from "@studio/icons";
import { formatMoney } from "@studio/money";
import { useTokens } from "@studio/theme";
import {
  Button,
  Card,
  EmptyState,
  ListGroup,
  ListRow,
  Pressable,
  Text,
} from "@studio/ui";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { Platform, TextInput, View } from "react-native";
import { useSearchTransactions, useSetting, useTodayKey } from "@/data/hooks";
import { merchantTotals } from "@/features/activity/merchants";
import { pushRecentSearch } from "@/features/search/recent-searches";
import { TransactionDayList } from "@/features/transactions/transaction-day-list";
import { useMoneyContext } from "@/features/transactions/use-money-context";
import { normaliseTitle } from "@/lib/insights";

const DEBOUNCE_MS = 150;
const LIMIT = 200;
const MAX_MERCHANTS = 3;

export default function Search() {
  const router = useRouter();
  const { colors } = useTokens();
  const params = useLocalSearchParams<{ q?: string }>();
  const money = useMoneyContext();
  const [recent, setRecent] = useSetting("recent_searches");
  const [query, setQuery] = React.useState(params.q ?? "");
  const [term, setTerm] = React.useState(params.q ?? "");

  React.useEffect(() => {
    const timer = setTimeout(() => setTerm(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const active = query.trim() === "" ? "" : term;
  const results = useSearchTransactions(active);

  const latest = React.useRef({ term: "", found: false, recent });
  React.useEffect(() => {
    latest.current = { term: active, found: results.length > 0, recent };
  });
  const remember = React.useCallback(
    (text: string) => setRecent(pushRecentSearch(latest.current.recent, text)),
    [setRecent],
  );
  useFocusEffect(
    React.useCallback(
      () => () => {
        if (latest.current.found) remember(latest.current.term);
      },
      [remember],
    ),
  );

  const typing = query.trim() !== "";
  const today = useTodayKey();
  const needle = normaliseTitle(active);
  const merchants = React.useMemo(
    () =>
      needle === ""
        ? []
        : merchantTotals(results, "expense", money)
            .filter((m) => m.key.includes(needle) || needle.includes(m.key))
            .slice(0, MAX_MERCHANTS),
    [results, money, needle],
  );
  const fmt = (minor: number) =>
    formatMoney(minor, money.displayCurrency, {
      locale: money.locale,
      sign: "none",
      decimals: money.showDecimals ? undefined : 0,
    });
  const oldest = results[results.length - 1]?.dateKey ?? today;
  const header =
    merchants.length > 0 ? (
      <View className="gap-2 pt-2">
        {merchants.map((m) => (
          <Pressable
            key={m.key}
            role="button"
            scale={0.99}
            accessibilityLabel={`${m.title}, ${fmt(m.amount)} over ${m.count} payments, average ${fmt(m.average)}`}
            accessibilityHint="Opens every payment to this merchant"
            onPress={() =>
              router.push({
                pathname: "/payee",
                params: {
                  from: oldest,
                  to: today,
                  type: "custom",
                  kind: "expense",
                  key: m.key,
                  title: m.title,
                },
              })
            }
            className="mx-4"
          >
            <Card className="flex-row items-center gap-3 rounded-[18px] px-4 py-3.5">
              <View className="min-w-0 flex-1">
                <Text variant="headline" numberOfLines={1}>
                  {m.title}
                </Text>
                <Text
                  variant="footnote"
                  tone="secondary"
                  numeric
                  numberOfLines={1}
                >
                  {`${m.count} ${m.count === 1 ? "payment" : "payments"} · avg ${fmt(m.average)} · ${dayLabel(m.lastDate, today)}`}
                </Text>
              </View>
              <Text variant="headline" numeric>
                {fmt(m.amount)}
              </Text>
              <AppIcon
                name="chevron.right"
                size={12}
                color={colors.textTertiary}
              />
            </Card>
          </Pressable>
        ))}
      </View>
    ) : null;
  const footer =
    results.length >= LIMIT ? (
      <Text variant="footnote" tone="secondary" className="py-4 text-center">
        Showing first {LIMIT}
      </Text>
    ) : null;

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-6">
        <View className="h-10 flex-1 flex-row items-center gap-2 rounded-[12px] bg-fill px-3">
          <AppIcon
            name="magnifyingglass"
            size={16}
            color={colors.textTertiary}
          />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Title, note or amount"
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            maxFontSizeMultiplier={2}
            onSubmitEditing={() => remember(query)}
            accessibilityLabel="Search"
            style={
              Platform.OS === "web"
                ? ({ outlineStyle: "none" } as object)
                : undefined
            }
            className="h-10 flex-1 text-[17px] text-foreground"
          />
        </View>
        <Button variant="barSecondary" size="sm" onPress={() => router.back()}>
          Cancel
        </Button>
      </View>
      {typing && results.length === 0 && term === query ? (
        <EmptyState message="No matches" />
      ) : typing ? (
        <TransactionDayList
          items={results}
          context={money}
          header={header}
          footer={footer}
          keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      ) : recent.length > 0 ? (
        <View className="pt-4">
          <ListGroup header="Recent searches">
            {recent.slice(0, 5).map((entry) => (
              <ListRow
                key={entry}
                label={entry}
                onPress={() => {
                  setQuery(entry);
                  setTerm(entry);
                }}
              />
            ))}
          </ListGroup>
        </View>
      ) : null}
    </View>
  );
}
