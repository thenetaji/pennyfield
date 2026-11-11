import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { Alert, ScrollView, View } from "react-native";

import {
  Amount,
  ListGroup,
  ListRow,
  SegmentedControl,
  showToast,
  Card,
  Text,
} from "@studio/ui";
import { useActions } from "@/data/actions";
import {
  useRateLookup,
  useSettings,
  useTagTotals,
  useTodayKey,
  useBusinessTransactions,
  useTagTransactions,
  useTags,
} from "@/data/hooks";
import { TransactionListRow } from "@/features/transactions/transaction-list-row";
import { useMoneyContext } from "@/features/transactions/use-money-context";
import {
  ALL_DATES,
  isInPeriod,
  monthShort,
  periodFor,
  type Period,
} from "@studio/dates";
import {
  convertWithRates,
  formatMoney,
  formatMoneyForSpeech,
} from "@studio/money";
import { Stagger } from "@studio/motion";
import { haptic, useTokens } from "@studio/theme";

import { categoryBreakdown, profitSummary, tagColorKey } from "./model";
import { TagPill } from "./tag-pill";

const ALL = { from: ALL_DATES.from, to: ALL_DATES.to };
const SCOPES = ["Month", "Year", "All time"] as const;

const percent = (ratio: number | null) =>
  ratio === null ? "–" : `${Math.round(ratio * 100)}%`;

const monthTitle = (month: string) =>
  `${monthShort(Number(month.slice(5, 7)))} ${month.slice(0, 4)}`;

/** One tag, or with `business` every business entry: totals or profit, costs by category, and the transactions. */
export function TagScreen({ business: businessView = false }: { business?: boolean }) {
  const params = useLocalSearchParams<{ id: string }>();
  const id = businessView ? "" : params.id;
  const router = useRouter();
  const actions = useActions();
  const { category } = useTokens();
  const money = useMoneyContext({ relativeDays: true });
  const rates = useRateLookup();
  const tags = useTags();
  const totals = useTagTotals(ALL);
  const tagItems = useTagTransactions(businessView ? undefined : id);
  const businessItems = useBusinessTransactions(businessView);
  const items = businessView ? businessItems : tagItems;
  const tag = businessView
    ? { id: "", name: "Business", color: "amber" }
    : tags.find((t) => t.id === id);
  const total = totals.find((t) => t.tag.id === id);
  const leaving = React.useRef(false);
  const settings = useSettings();
  const today = useTodayKey();
  const [scope, setScope] = React.useState(0);
  const period = React.useMemo<Period | null>(
    () =>
      scope === 2
        ? null
        : periodFor(scope === 0 ? "month" : "year", today, {
            weekStart: settings.week_start,
            monthStart: settings.month_start,
          }),
    [scope, today, settings.week_start, settings.month_start],
  );
  const convert = React.useCallback(
    (minor: number, from: string) =>
      convertWithRates(minor, from, money.displayCurrency, rates),
    [money.displayCurrency, rates],
  );
  const summary = React.useMemo(
    () =>
      profitSummary(
        period ? items.filter((i) => isInPeriod(period, i.dateKey)) : items,
        convert,
      ),
    [items, period, convert],
  );

  React.useEffect(() => {
    if (!businessView && !tag && !leaving.current && router.canGoBack()) router.back();
  }, [tag, router]);

  const breakdown = React.useMemo(
    () => categoryBreakdown(items, convert),
    [items, convert],
  );

  if (!tag) return <View className="flex-1 bg-bg" />;

  const decimals = money.showDecimals ? undefined : 0;
  const currency = total?.currency ?? money.displayCurrency;
  const fmt = (minor: number) =>
    formatMoney(minor, currency, {
      locale: money.locale,
      sign: "none",
      decimals,
    });
  const count = total?.count ?? 0;
  // A tag with money both in and out reads as a business or project.
  const business =
    businessView || ((total?.earned ?? 0) > 0 && (total?.spent ?? 0) > 0);
  const signed = (minor: number) =>
    formatMoney(minor, currency, {
      locale: money.locale,
      sign: "auto",
      decimals,
    });

  const remove = () =>
    Alert.alert(`Delete ${tag.name}?`, "Transactions keep everything else.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          leaving.current = true;
          actions.tags.delete(tag.id);
          haptic("success");
          showToast({ message: "Tag deleted", haptic: false });
          if (router.canGoBack()) router.back();
        },
      },
    ]);

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 pb-12"
    >
      <Stack.Screen options={{ title: businessView ? "Business" : "" }} />
      <Stagger index={0} className="items-center gap-1 px-6 pt-4">
        {businessView ? null : (
          <TagPill name={tag.name} color={tag.color} size="md" />
        )}
        {business ? (
          <>
            <View className="pt-2">
              <Amount
                value={signed(summary.profit)}
                variant="hero"
                animate="intro"
                accessibilityLabel={`${tag.name}, profit ${formatMoneyForSpeech(summary.profit, currency, { locale: money.locale })}`}
              />
            </View>
            <Text variant="footnote" tone="secondary" numeric>
              {`Profit · ${fmt(summary.revenue)} in · ${fmt(summary.costs)} out`}
            </Text>
          </>
        ) : (
          <>
            <View className="pt-2">
              <Amount
                value={fmt(total?.spent ?? 0)}
                variant="hero"
                animate="intro"
                accessibilityLabel={`${tag.name}, spent ${formatMoneyForSpeech(total?.spent ?? 0, currency, { sign: "none", locale: money.locale })}`}
              />
            </View>
            <Text variant="footnote" tone="secondary" numeric>
              {count === 0
                ? "No transactions"
                : count === 1
                  ? "1 transaction"
                  : `${count} transactions`}
              {total && total.earned > 0
                ? ` · ${fmt(total.earned)} earned`
                : ""}
            </Text>
          </>
        )}
      </Stagger>

      {business ? (
        <Stagger index={1} className="gap-4">
          <View className="px-4">
            <SegmentedControl
              values={SCOPES}
              selectedIndex={scope}
              onChange={setScope}
              accessibilityLabel="Period"
            />
          </View>
          <ListGroup
            footer={
              summary.tax > 0
                ? undefined
                : "Put income tax in a category called Tax or Income tax to see profit after tax."
            }
          >
            <ListRow label="Revenue" value={fmt(summary.revenue)} />
            <ListRow label="Costs" value={fmt(summary.costs)} />
            <ListRow label="Profit" value={signed(summary.profit)} />
            <ListRow label="Margin" value={percent(summary.margin)} />
            <ListRow label="ROI" value={percent(summary.roi)} />
            {summary.tax > 0 ? (
              <ListRow label="Income tax" value={fmt(summary.tax)} />
            ) : null}
            {summary.tax > 0 ? (
              <ListRow label="After tax" value={signed(summary.afterTax)} />
            ) : null}
          </ListGroup>
          {scope > 0 && summary.months.length > 1 ? (
            <ListGroup header="By month">
              {summary.months.slice(0, 12).map((m) => (
                <ListRow
                  key={m.month}
                  label={monthTitle(m.month)}
                  subtitle={`${fmt(m.revenue)} in · ${fmt(m.costs)} out`}
                  value={signed(m.profit)}
                />
              ))}
            </ListGroup>
          ) : null}
        </Stagger>
      ) : null}

      {breakdown.length > 0 ? (
        <Stagger index={1}>
          <Text variant="footnote" tone="secondary" className="px-8 pb-2">
            {business ? "Costs by category" : "By category"}
          </Text>
          <Card className="mx-4 gap-4">
            {breakdown.slice(0, 5).map((row) => (
              <View
                key={row.id}
                className="gap-1.5"
                accessible
                accessibilityLabel={`${row.name}, ${fmt(row.amount)}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    variant="subhead"
                    numberOfLines={1}
                    className="mr-3 flex-1"
                  >
                    {row.name}
                  </Text>
                  <Text variant="subhead" numeric tone="secondary">
                    {fmt(row.amount)}
                  </Text>
                </View>
                <View
                  style={{ height: 6, borderRadius: 3, overflow: "hidden" }}
                  className="bg-fill"
                >
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      width: `${Math.max(row.share * 100, 4)}%`,
                      backgroundColor: category[tagColorKey(row.color)],
                    }}
                  />
                </View>
              </View>
            ))}
          </Card>
        </Stagger>
      ) : null}

      {items.length > 0 ? (
        <Stagger index={2}>
          <Text variant="footnote" tone="secondary" className="px-8 pb-2">
            Transactions
          </Text>
          <Card className="mx-4 p-0">
            {items.slice(0, 100).map((item, i, list) => (
              <TransactionListRow
                key={item.id}
                item={item}
                context={money}
                separator={i < list.length - 1}
              />
            ))}
          </Card>
        </Stagger>
      ) : null}

      {businessView ? null : (
        <Stagger index={3}>
          <ListGroup>
            <ListRow label="Delete tag" destructive centered onPress={remove} />
          </ListGroup>
        </Stagger>
      )}
    </ScrollView>
  );
}
