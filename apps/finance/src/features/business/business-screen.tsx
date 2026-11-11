import { useRouter, type Href } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { withSkia } from "@studio/charts";
import type { CashFlowChartProps } from "@studio/charts/components";
import {
  addDays,
  ALL_DATES,
  diffDays,
  monthShort,
  periodFor,
} from "@studio/dates";
import {
  convertWithRates,
  formatMoney,
  formatMoneyForSpeech,
} from "@studio/money";
import { Stagger } from "@studio/motion";
import {
  Amount,
  Card,
  ListGroup,
  ListRow,
  Pressable,
  SegmentedControl,
  Text,
} from "@studio/ui";
import {
  useAccounts,
  useBusinessTransactions,
  useCategories,
  useRateLookup,
  useSettings,
  useTodayKey,
} from "@/data/hooks";
import { normalizeTitle } from "@/db/repos/titleMemory";
import { useRangeStore } from "@/features/insights/range-store";
import { categoryBreakdown, profitSummary } from "@/features/tags/model";
import { MenuChip } from "@/features/transaction-form/menu-chip";
import { TransactionListRow } from "@/features/transactions/transaction-list-row";
import { useMoneyContext } from "@/features/transactions/use-money-context";

import {
  byPayee,
  filterItems,
  lastMonths,
  monthlyFlow,
  type PayeeRow,
} from "./model";

const CashFlowChart = withSkia<CashFlowChartProps>(() =>
  import("@studio/charts/components").then((m) => ({
    default: m.CashFlowChart,
  })),
);

const SCOPES = ["Month", "Year", "All", "Custom"] as const;
const ANY = "";

const percent = (ratio: number | null) =>
  ratio === null ? "–" : `${Math.round(ratio * 100)}%`;

const monthTitle = (key: string) =>
  `${monthShort(Number(key.slice(5, 7)))} ${key.slice(0, 4)}`;

const lastDay = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(y ?? 0, m ?? 1, 0).getDate()).padStart(2, "0")}`;
};

/** Business money: profit, a 12-month chart, where income comes from and where costs go, filterable by range, category, account and payee. */
export default function BusinessScreen() {
  const router = useRouter();
  const money = useMoneyContext({ relativeDays: true });
  const rates = useRateLookup();
  const settings = useSettings();
  const today = useTodayKey();
  const items = useBusinessTransactions(true);
  const categories = useCategories();
  const accounts = useAccounts();
  const openRange = useRangeStore((s) => s.open);

  const [scope, setScope] = React.useState(0);
  const [custom, setCustom] = React.useState({
    from: addDays(today, -364),
    to: today,
  });
  const [categoryId, setCategoryId] = React.useState(ANY);
  const [accountId, setAccountId] = React.useState(ANY);
  const [payee, setPayee] = React.useState(ANY);
  const [selected, setSelected] = React.useState<number | null>(null);

  const range = React.useMemo(() => {
    if (scope === 2) return { from: ALL_DATES.from, to: ALL_DATES.to };
    if (scope === 3) return custom;
    const p = periodFor(scope === 0 ? "month" : "year", today, {
      weekStart: settings.week_start,
      monthStart: settings.month_start,
    });
    return { from: p.from, to: p.to };
  }, [scope, custom, today, settings.week_start, settings.month_start]);

  const previous = React.useMemo(() => {
    if (scope === 2) return null;
    const days = diffDays(range.from, range.to) + 1;
    return { from: addDays(range.from, -days), to: addDays(range.from, -1) };
  }, [scope, range]);

  const convert = React.useCallback(
    (minor: number, from: string) =>
      convertWithRates(minor, from, money.displayCurrency, rates),
    [money.displayCurrency, rates],
  );

  const filters = {
    categoryId: categoryId || null,
    accountId: accountId || null,
    payee: payee || null,
  };
  const all = filterItems(items, { ...ALL_DATES, ...filters });
  const shown = filterItems(all, range);
  const summary = profitSummary(shown, convert);
  const months = lastMonths(today);
  const flow = monthlyFlow(all, months, convert);
  const income = byPayee(shown, "income", convert);
  const costs = byPayee(shown, "expense", convert);
  const before = previous
    ? new Map(
        byPayee(filterItems(all, previous), "income", convert).map((r) => [
          r.key,
          r.amount,
        ]),
      )
    : null;
  const byCategory = categoryBreakdown(shown, convert);

  const decimals = money.showDecimals ? undefined : 0;
  const fmt = (minor: number, sign: "none" | "auto" = "none") =>
    formatMoney(minor, money.displayCurrency, {
      locale: money.locale,
      sign,
      decimals,
    });

  const pickCustom = (initial: { from: string; to: string }) => {
    openRange({
      initial,
      onApply: (r) => {
        setCustom(r);
        setScope(3);
      },
    });
    router.push("/insights-range" as Href);
  };
  const changeScope = (index: number) => {
    if (index === 3) pickCustom(custom);
    else setScope(index);
  };
  const pickMonth = (index: number | null) => {
    setSelected(index);
    const month = index === null ? null : months[index];
    if (!month) return;
    setCustom({ from: `${month}-01`, to: lastDay(month) });
    setScope(3);
  };

  const payees = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of items) {
      const name = i.title.trim();
      if (name) seen.set(normalizeTitle(name), name);
    }
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [items]);
  const usedCategories = new Set(
    items.flatMap((i) => [
      i.category?.id,
      ...i.splits.map((l) => l.category.id),
    ]),
  );
  const categoryOptions = categories
    .filter((c) => usedCategories.has(c.id))
    .map((c) => ({ value: c.id, label: c.name }));
  const accountOptions = accounts
    .filter((a) => items.some((i) => i.accountId === a.id))
    .map((a) => ({ value: a.id, label: a.name }));
  const withAny = (label: string, options: { value: string; label: string }[]) => [
    { value: ANY, label },
    ...options,
  ];
  const nameOf = (options: { value: string; label: string }[], value: string) =>
    options.find((o) => o.value === value)?.label;
  const filtered = Boolean(categoryId || accountId || payee);

  const payeeRows = (rows: PayeeRow[], change: boolean) =>
    rows.slice(0, 8).map((r) => {
      const prev = before?.get(r.key) ?? 0;
      const delta =
        change && before && prev > 0
          ? ` · ${r.amount >= prev ? "+" : "−"}${Math.round((Math.abs(r.amount - prev) / prev) * 100)}%`
          : "";
      return (
        <ListRow
          key={r.key}
          label={r.name}
          subtitle={`${percent(r.share)}${change ? " of income" : " of revenue"}${delta}`}
          value={fmt(r.amount)}
          onPress={() => setPayee(r.key === payee ? ANY : r.key)}
        />
      );
    });

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 pb-12"
    >
      <Stagger index={0} className="items-center gap-1 px-6 pt-4">
        <Amount
          value={fmt(summary.profit, "auto")}
          variant="hero"
          animate="intro"
          accessibilityLabel={`Profit ${formatMoneyForSpeech(summary.profit, money.displayCurrency, { locale: money.locale })}`}
        />
        <Text variant="footnote" tone="secondary" numeric>
          {`Profit · ${fmt(summary.revenue)} in · ${fmt(summary.costs)} out`}
        </Text>
        {scope === 3 ? (
          <Pressable
            role="button"
            accessibilityLabel="Change dates"
            onPress={() => pickCustom(custom)}
          >
            <Text variant="footnote" tone="accent" numeric>
              {`${custom.from} – ${custom.to}`}
            </Text>
          </Pressable>
        ) : null}
      </Stagger>

      <Stagger index={1} className="gap-3">
        <View className="px-4">
          <SegmentedControl
            values={SCOPES}
            selectedIndex={scope}
            onChange={changeScope}
            accessibilityLabel="Period"
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-4"
        >
          <MenuChip
            label={nameOf(categoryOptions, categoryId) ?? "Category"}
            icon="square.grid.2x2"
            title="Category"
            options={withAny("All categories", categoryOptions)}
            selected={categoryId}
            onSelect={setCategoryId}
            highlight={Boolean(categoryId)}
          />
          <MenuChip
            label={nameOf(accountOptions, accountId) ?? "Account"}
            icon="creditcard"
            title="Account"
            options={withAny("All accounts", accountOptions)}
            selected={accountId}
            onSelect={setAccountId}
            highlight={Boolean(accountId)}
          />
          <MenuChip
            label={nameOf(payees, payee) ?? "Payee"}
            icon="person"
            title="Payee"
            options={withAny("All payees", payees)}
            selected={payee}
            onSelect={setPayee}
            highlight={Boolean(payee)}
          />
          {filtered ? (
            <MenuChip
              label="Clear"
              title="Filters"
              options={[{ value: "clear", label: "Clear filters" }]}
              selected={null}
              onSelect={() => {
                setCategoryId(ANY);
                setAccountId(ANY);
                setPayee(ANY);
              }}
            />
          ) : null}
        </ScrollView>
      </Stagger>

      <Stagger index={2}>
        <ListGroup
          footer={
            summary.tax > 0
              ? undefined
              : "Put income tax in a category called Income tax to see profit after tax."
          }
        >
          <ListRow label="Revenue" value={fmt(summary.revenue)} />
          <ListRow label="Costs" value={fmt(summary.costs)} />
          <ListRow label="Profit" value={fmt(summary.profit, "auto")} />
          <ListRow label="Margin" value={percent(summary.margin)} />
          <ListRow label="ROI" value={percent(summary.roi)} />
          {summary.tax > 0 ? (
            <ListRow label="Income tax" value={fmt(summary.tax)} />
          ) : null}
          {summary.tax > 0 ? (
            <ListRow label="After tax" value={fmt(summary.afterTax, "auto")} />
          ) : null}
        </ListGroup>
      </Stagger>

      <Stagger index={3}>
        <Text variant="footnote" tone="secondary" className="px-8 pb-2">
          Last 12 months
        </Text>
        <Card className="mx-4 px-3 py-3">
          <CashFlowChart
            data={flow}
            currency={money.displayCurrency}
            locale={money.locale}
            labels={months.map((m, index) => ({
              index,
              text: monthShort(Number(m.slice(5, 7))).slice(0, 1),
            }))}
            selectedIndex={selected}
            onSelect={pickMonth}
            netMode="markers"
            focusIndex={months.length - 1}
            height={180}
            formatLabel={(i) => {
              const d = flow[i];
              const m = months[i];
              return d && m
                ? `${monthTitle(m)} · In ${fmt(d.income)} · Out ${fmt(d.spent)} · Profit ${fmt(d.income - d.spent, "auto")}`
                : "";
            }}
            accessibilityLabel={`Money in and out by month. ${flow
              .map((d, i) => `${monthTitle(months[i] ?? "")}: in ${fmt(d.income)}, out ${fmt(d.spent)}`)
              .join(". ")}`}
          />
        </Card>
        <Text variant="footnote" tone="secondary" className="px-8 pt-2">
          Tap a month to see it.
        </Text>
      </Stagger>

      {income.length > 0 ? (
        <Stagger index={4}>
          <ListGroup header="Income by source">{payeeRows(income, true)}</ListGroup>
        </Stagger>
      ) : null}

      {costs.length > 0 ? (
        <Stagger index={5}>
          <ListGroup header="Costs by payee">{payeeRows(costs, false)}</ListGroup>
        </Stagger>
      ) : null}

      {byCategory.length > 0 ? (
        <Stagger index={6}>
          <ListGroup header="Costs by category">
            {byCategory.slice(0, 8).map((row) => (
              <ListRow
                key={row.id}
                label={row.name}
                value={fmt(row.amount)}
                onPress={() =>
                  setCategoryId(row.id === categoryId ? ANY : row.id)
                }
              />
            ))}
          </ListGroup>
        </Stagger>
      ) : null}

      {shown.length > 0 ? (
        <Stagger index={7}>
          <Text variant="footnote" tone="secondary" className="px-8 pb-2">
            {shown.length === 1 ? "1 entry" : `${shown.length} entries`}
          </Text>
          <Card className="mx-4 p-0">
            {shown.slice(0, 100).map((item, i, list) => (
              <TransactionListRow
                key={item.id}
                item={item}
                context={money}
                separator={i < list.length - 1}
              />
            ))}
          </Card>
        </Stagger>
      ) : (
        <Text variant="callout" tone="secondary" className="px-8">
          No business entries for this period.
        </Text>
      )}
    </ScrollView>
  );
}
