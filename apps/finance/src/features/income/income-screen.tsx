import * as React from "react";
import { ScrollView, View } from "react-native";

import { addMonths, monthShort, parseKey } from "@studio/dates";
import { convertWithRates, formatMoney } from "@studio/money";
import { haptic, useTokens, type CategoryColorKey } from "@studio/theme";
import { Amount, IconTile, Pressable, SegmentedControl, Text } from "@studio/ui";

import { ChangePill, Eyebrow, HeroWash, Panel, TopWash } from "@/components/app/surface";
import { usePeriodTransactions } from "@/data/hooks";
import { useMoneyContext } from "@/features/transactions/use-money-context";

const ALL_TIME = { from: "0000-01-01", to: "9999-12-31" };
const INCOME = ["income"] as const;
const BARS = 12;

type Bucket = { key: string; label: string; short: string; amount: number };
type Source = { id: string; name: string; icon: string; color: CategoryColorKey; amount: number };

const monthLabel = (key: string) => {
  const { month, year } = parseKey(`${key}-01`);
  return { label: `${monthShort(month)} ${year}`, short: monthShort(month).slice(0, 3) };
};

/** Income month by month and year by year: how it has grown, and where it comes from. */
export function IncomeScreen() {
  const money = useMoneyContext();
  const { colors } = useTokens();
  const items = usePeriodTransactions({ ...ALL_TIME, kinds: INCOME });
  const [mode, setMode] = React.useState<"month" | "year">("month");
  const [picked, setPicked] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);

  const { months, years, sources } = React.useMemo(() => {
    const byMonth = new Map<string, number>();
    const bySource = new Map<string, Source>();
    for (const item of items) {
      const value = convertWithRates(item.amount, item.currency, money.displayCurrency, money.rates);
      const key = item.dateKey.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + value);
      const cat = item.category ?? item.splits[0]?.category;
      if (cat) {
        const s = bySource.get(cat.id) ?? {
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          color: cat.color as CategoryColorKey,
          amount: 0,
        };
        s.amount += value;
        bySource.set(cat.id, s);
      }
    }
    const thisMonth = money.todayKey.slice(0, 7);
    const first = [...byMonth.keys()].sort()[0] ?? thisMonth;
    const monthList: Bucket[] = [];
    for (let k = first; k <= thisMonth; k = addMonths(`${k}-01`, 1).slice(0, 7))
      monthList.push({ key: k, ...monthLabel(k), amount: byMonth.get(k) ?? 0 });
    const byYear = new Map<string, number>();
    for (const m of monthList) byYear.set(m.key.slice(0, 4), (byYear.get(m.key.slice(0, 4)) ?? 0) + m.amount);
    const yearList: Bucket[] = [...byYear.entries()].map(([y, amount]) => ({
      key: y,
      label: y,
      short: `'${y.slice(2)}`,
      amount,
    }));
    return {
      months: monthList,
      years: yearList,
      sources: [...bySource.values()].sort((a, b) => b.amount - a.amount),
    };
  }, [items, money.displayCurrency, money.rates, money.todayKey]);

  const fmt = (minor: number) =>
    formatMoney(minor, money.displayCurrency, {
      locale: money.locale,
      sign: "none",
      decimals: money.showDecimals ? undefined : 0,
    });

  if (items.length === 0)
    return (
      <View className="flex-1 items-center bg-bg px-8 pt-24">
        <Text variant="title2" className="text-center">
          No income yet
        </Text>
        <Text variant="subhead" tone="secondary" className="mt-1 text-center">
          Add your salary and other income to see how it grows.
        </Text>
      </View>
    );

  const list = mode === "month" ? months : years;
  const bars = list.slice(-BARS);
  const selected = list.find((b) => b.key === picked) ?? list[list.length - 1];
  const index = selected ? list.indexOf(selected) : -1;
  const before = index > 0 ? list[index - 1] : undefined;
  const change =
    selected && before && before.amount > 0
      ? Math.round(((selected.amount - before.amount) / before.amount) * 100)
      : null;
  const recent = months.slice(-12).filter((m) => m.amount > 0);
  const average = recent.length > 0 ? recent.reduce((s, m) => s + m.amount, 0) / recent.length : 0;
  const best = months.reduce<Bucket | undefined>((b, m) => (!b || m.amount > b.amount ? m : b), undefined);
  const max = Math.max(1, ...bars.map((b) => b.amount));
  const total = sources.reduce((s, x) => s + x.amount, 0);
  const rows = [...list].reverse();
  const shownRows = showAll ? rows : rows.slice(0, 12);

  return (
    <View className="flex-1 bg-bg">
      <TopWash />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="pb-24">
        <View className="px-4 pb-3 pt-2">
          <SegmentedControl
            values={["Months", "Years"]}
            selectedIndex={mode === "month" ? 0 : 1}
            onChange={(i) => {
              setMode(i === 0 ? "month" : "year");
              setPicked(null);
            }}
            accessibilityLabel="Months or years"
          />
        </View>

        <HeroWash>
          <View className="px-5 pb-5 pt-4">
            <Text variant="footnote" tone="secondary" className="font-semibold uppercase tracking-[1.4px]">
              {`Income · ${selected?.label ?? ""}${selected?.key === money.todayKey.slice(0, 7) || selected?.key === money.todayKey.slice(0, 4) ? " so far" : ""}`}
            </Text>
            <View className="mt-2 flex-row items-end justify-between">
              <Amount value={fmt(selected?.amount ?? 0)} variant="hero" />
              {change !== null ? (
                <ChangePill text={`${change >= 0 ? "+" : ""}${change}%`} positive={change >= 0} />
              ) : null}
            </View>
            <Text variant="subhead" tone="secondary" className="mt-1">
              {before ? `${fmt(before.amount)} in ${before.label}` : "First on record"}
            </Text>

            <View className="mt-5 h-[140px] flex-row items-end gap-1.5">
              {bars.map((b) => {
                const on = b.key === selected?.key;
                return (
                  <Pressable
                    key={b.key}
                    role="button"
                    accessibilityLabel={`${b.label}, ${fmt(b.amount)}`}
                    scale={0.96}
                    className="h-full flex-1 justify-end"
                    onPress={() => {
                      haptic("selection");
                      setPicked(b.key);
                    }}
                  >
                    <View
                      className="w-full rounded-t-[6px] rounded-b-[3px]"
                      style={{
                        height: `${Math.max(2, (b.amount / max) * 100)}%`,
                        backgroundColor: on ? colors.accent : colors.accentSoft,
                      }}
                    />
                  </Pressable>
                );
              })}
            </View>
            <View className="mt-1.5 flex-row gap-1.5">
              {bars.map((b) => (
                <Text
                  key={b.key}
                  variant="caption"
                  tone={b.key === selected?.key ? "default" : "tertiary"}
                  className="flex-1 text-center"
                  numberOfLines={1}
                >
                  {b.short}
                </Text>
              ))}
            </View>
          </View>
        </HeroWash>

        <View className="mx-4 mt-4 flex-row gap-3">
          <StatCard label="Monthly average" value={fmt(average)} sub="Last 12 months" />
          <StatCard label="Best month" value={best ? fmt(best.amount) : "—"} sub={best?.label ?? ""} />
        </View>

        {sources.length > 0 ? (
          <>
            <Eyebrow>Where it comes from</Eyebrow>
            <Panel>
              {sources.slice(0, 6).map((s, i) => (
                <View
                  key={s.id}
                  className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <IconTile icon={s.icon} color={s.color} size={36} />
                  <View className="flex-1">
                    <Text variant="body" className="font-medium" numberOfLines={1}>
                      {s.name}
                    </Text>
                    <View className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: colors.fill }}>
                      <View
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(2, (s.amount / Math.max(1, total)) * 100)}%`, backgroundColor: colors.income }}
                      />
                    </View>
                  </View>
                  <View className="items-end">
                    <Text variant="body" numeric className="font-medium">
                      {fmt(s.amount)}
                    </Text>
                    <Text variant="caption" tone="secondary" numeric>
                      {`${Math.round((s.amount / Math.max(1, total)) * 100)}%`}
                    </Text>
                  </View>
                </View>
              ))}
            </Panel>
          </>
        ) : null}

        <Eyebrow
          trailing={
            rows.length > 12 ? (
              <Pressable role="button" hitSlop={10} onPress={() => setShowAll((v) => !v)}>
                <Text variant="footnote" tone="accent" className="font-semibold">
                  {showAll ? "Less" : `All ${rows.length}`}
                </Text>
              </Pressable>
            ) : undefined
          }
        >
          {mode === "month" ? "Month by month" : "Year by year"}
        </Eyebrow>
        <Panel>
          {shownRows.map((b, i) => {
            const prev = list[list.indexOf(b) - 1];
            const pct = prev && prev.amount > 0 ? Math.round(((b.amount - prev.amount) / prev.amount) * 100) : null;
            return (
              <Pressable
                key={b.key}
                role="button"
                scale={1}
                onPress={() => setPicked(b.key)}
                className={`flex-row items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <Text variant="body">{b.label}</Text>
                <View className="flex-row items-center gap-3">
                  {pct !== null && pct !== 0 ? (
                    <Text variant="footnote" tone={pct > 0 ? "income" : "expense"} numeric>
                      {`${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`}
                    </Text>
                  ) : null}
                  <Text variant="body" numeric className="min-w-[96px] text-right font-medium">
                    {fmt(b.amount)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Panel>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View className="flex-1 rounded-[20px] bg-surface px-4 py-3.5">
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="headline" numeric className="mt-1">
        {value}
      </Text>
      <Text variant="caption" tone="tertiary" className="mt-0.5">
        {sub}
      </Text>
    </View>
  );
}
