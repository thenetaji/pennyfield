import { useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { addMonths, keyToLocalMs, monthShort, parseKey, toDateKey } from "@studio/dates";
import { formatMoney } from "@studio/money";
import { Amount, Button, ListRow, OptionPicker, Pressable, showToast, Text } from "@studio/ui";

import {
  Eyebrow,
  ChangePill,
  HeroWash,
  Panel,
} from "@/components/app/surface";
import {
  useInvestmentInsights,
  useInvestments,
  useSetting,
  useTaxContext,
  useTaxYears,
  useTodayKey,
  type InvestmentSummary,
} from "@/data/hooks";
import { FormRow } from "@/features/entry/form-row";
import { DatePicker } from "@/features/transaction-form/date-picker";
import { useMoneyContext } from "@/features/transactions/use-money-context";
import { backAfter, taxYearOf } from "@/lib/investments/tax";
import type { UpcomingPayout } from "@/lib/investments/returns";
import type { InvestmentType } from "@/db/schema";

import { useStableImport } from "@/data/hooks/useStableImport";
import { AppIcon } from "@studio/icons";
import { haptic, useTokens } from "@studio/theme";

import { rateLabel } from "./format";
import { pickXlsxWorkbooks } from "./pick-xlsx";
import { TdsCard } from "./insight-cards";

const SLAB_OPTIONS = [0, 5, 10, 15, 20, 25, 30].map((value) => ({
  value: value as number | null,
  label: `${value}%`,
}));

const monthYear = (key: string) => {
  const { month, year } = parseKey(key);
  return `${monthShort(month)} ${year}`;
};

/** The Investments page of the Activity tab: what is invested, a row per holding, tax and returns. */
export function InvestmentsPage() {
  const router = useRouter();
  const importStable = useStableImport();
  const runImport = async () => {
    try {
      const books = await pickXlsxWorkbooks();
      if (!books) return;
      const result = importStable(books);
      const done = result.create + result.update;
      if (done === 0) {
        showToast({ message: "No bonds found. Pick the Investment and Upcoming Cashflow reports.", haptic: "warning" });
        return;
      }
      haptic("success");
      const parts = [
        result.create ? `${result.create} added` : "",
        result.update ? `${result.update} updated` : "",
      ].filter(Boolean);
      showToast({ message: parts.join(", "), haptic: false });
    } catch {
      showToast({ message: "Could not read those files", haptic: "warning" });
    }
  };
  const money = useMoneyContext();
  const today = useTodayKey();
  const list = useInvestments();
  const years = useTaxYears();
  const tax = useTaxContext();
  const [needBy, setNeedBy] = useSetting("cash_need_date");
  const [showClosed, setShowClosed] = React.useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = React.useState(false);
  const insights = useInvestmentInsights();
  const [slab, setSlab] = useSetting("tax_slab_percent");
  const [slabOpen, setSlabOpen] = React.useState(false);

  const { colors } = useTokens();
  const add = () => router.push("/investments/new");

  if (list.length === 0) {
    return (
      <View className="items-center px-6 pt-24">
        <View
          className="mb-5 h-16 w-16 items-center justify-center rounded-[20px]"
          style={{ backgroundColor: colors.accent }}
        >
          <AppIcon name="chart.line.uptrend.xyaxis" size={30} color={colors.onAccent} />
        </View>
        <Text variant="title2" className="text-center">
          No investments yet
        </Text>
        <Text variant="subhead" tone="secondary" className="mt-1 text-center">
          FDs and bonds, with every payout and tax.
        </Text>
        <View className="mt-8 gap-3 self-stretch">
          <Button size="lg" onPress={add}>
            Add investment
          </Button>
          <Button size="lg" variant="secondary" onPress={() => void runImport()}>
            Import Stable Bonds reports
          </Button>
        </View>
      </View>
    );
  }

  const open = list.filter((s) => s.status !== "closed");
  const closed = list.filter((s) => s.status === "closed");
  const currency = list[0]?.investment.currency ?? "INR";
  const decimals = money.showDecimals ? undefined : 0;
  const fmt = (minor: number) =>
    formatMoney(minor, currency, {
      locale: money.locale,
      sign: "none",
      decimals,
    });
  const thisYear = taxYearOf(today, tax.startMonth);
  const yearInterest =
    years.find((y) => y.startYear === thisYear)?.interest ?? 0;
  const late = needBy
    ? open.filter((s) => backAfter(s.investment, needBy))
    : [];

  const received = open.reduce((sum, s) => {
    const r = insights.returns[s.investment.id];
    return sum + (r ? r.expectedInterest - r.interestToCome : 0);
  }, 0);
  const earnedSoFar = received + insights.accrued;
  const rated = open.filter((s) => s.investment.rate !== null);
  const ratedAmount = rated.reduce((sum, s) => sum + s.investment.amount, 0);
  const avgRate =
    ratedAmount > 0
      ? rated.reduce((sum, s) => sum + s.investment.amount * (s.investment.rate ?? 0), 0) / ratedAmount
      : null;
  const months = upcomingByMonth(insights.upcoming).slice(0, showAllUpcoming ? 12 : 4);
  const maxYear = Math.max(1, ...insights.interestByYear.map((y) => y.amount));

  const row = (s: InvestmentSummary, last: boolean) => {
    const inv = s.investment;
    const r = insights.returns[inv.id];
    const when = inv.closedOn ?? inv.maturityDate;
    const sub = [
      TYPE_SHORT[inv.type],
      rateLabel(inv.rate),
      when ? `${inv.closedOn ? "closed" : "back"} ${monthYear(when)}` : undefined,
    ]
      .filter(Boolean)
      .join(" · ");
    const toCome = r && !inv.closedOn ? r.interestToCome : 0;
    return (
      <Pressable
        key={inv.id}
        role="button"
        accessibilityLabel={inv.name}
        onPress={() =>
          router.push({ pathname: "/investments/[id]", params: { id: inv.id } })
        }
      >
        <View
          className={`min-h-[64px] flex-row items-center gap-3 px-4 py-3 ${last ? "" : "border-b border-border"}`}
        >
          <TypeTile type={inv.type} />
          <View className="flex-1">
            <Text variant="headline" numberOfLines={1}>
              {inv.name}
            </Text>
            <Text variant="subhead" tone="secondary" numberOfLines={1}>
              {sub}
            </Text>
          </View>
          <View className="items-end">
            <Text variant="headline" numeric>
              {fmt(inv.amount)}
            </Text>
            {toCome > 0 ? (
              <Text variant="subhead" tone="income" numeric>
                {`+${fmt(toCome)} interest`}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="pb-24"
    >
      <HeroWash>
        <View className="px-5 pb-5 pt-4">
          <Text variant="footnote" tone="secondary" className="font-semibold uppercase tracking-[1.4px]">
            Invested
          </Text>
          <View className="mt-2 flex-row items-end justify-between">
            <Amount value={fmt(insights.invested)} variant="hero" />
            {earnedSoFar > 0 ? (
              <ChangePill text={`+${fmt(earnedSoFar)} earned`} positive />
            ) : null}
          </View>
          <View className="mt-4 flex-row">
            <Stat label="Interest to come" value={`+${fmt(insights.interestToCome)}`} tone="income" />
            <Stat label="Average rate" value={avgRate !== null ? `${Number(avgRate.toFixed(2))}%` : "—"} />
            <Stat
              label="All back by"
              value={insights.lastBackOn ? monthYear(insights.lastBackOn) : "—"}
            />
          </View>
          {insights.totalBack > 0 ? (
            <View
              className="mt-4 rounded-[14px] px-3.5 py-3"
              style={{ backgroundColor: colors.fill }}
            >
              <Text variant="subhead" tone="secondary">
                {`You get back ${fmt(insights.totalBack)} in total: your ${fmt(insights.invested)} plus ${fmt(insights.interestToCome)} interest.`}
              </Text>
            </View>
          ) : null}
        </View>
      </HeroWash>

      {insights.byType.length > 1 ? (
        <>
          <Eyebrow>Split</Eyebrow>
          <Panel>
            <View className="flex-row gap-1 px-4 pt-4">
              {insights.byType.map((t, i) => (
                <View
                  key={t.type}
                  className="h-2 rounded-full"
                  style={{
                    flex: t.invested,
                    backgroundColor: colors.accent,
                    opacity: 1 - i * 0.3,
                  }}
                />
              ))}
            </View>
            {insights.byType.map((t, i) => (
              <View
                key={t.type}
                className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <TypeTile type={t.type} />
                <View className="flex-1">
                  <Text variant="body" className="font-medium">
                    {TYPE_PLURAL[t.type]}
                  </Text>
                  <Text variant="subhead" tone="secondary">
                    {[`${t.count} held`, t.rate !== null ? `${Number(t.rate.toFixed(2))}% avg` : undefined]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <View className="items-end">
                  <Text variant="body" numeric className="font-medium">
                    {fmt(t.invested)}
                  </Text>
                  <Text variant="subhead" tone="secondary" numeric>
                    {`${Math.round((t.invested / Math.max(1, insights.invested)) * 100)}%`}
                  </Text>
                </View>
              </View>
            ))}
          </Panel>
        </>
      ) : null}

      {months.length > 0 ? (
        <>
          <Eyebrow
            trailing={
              upcomingByMonth(insights.upcoming).length > 4 ? (
                <Pressable role="button" hitSlop={10} onPress={() => setShowAllUpcoming((v) => !v)}>
                  <Text variant="footnote" tone="accent" className="font-semibold">
                    {showAllUpcoming ? "Less" : "Next 12 months"}
                  </Text>
                </Pressable>
              ) : undefined
            }
          >
            Coming to your bank
          </Eyebrow>
          <Panel>
            {months.map((m, mi) => (
              <View key={m.key} className={mi > 0 ? "border-t border-border" : ""}>
                <View className="flex-row items-baseline justify-between px-4 pb-1 pt-3">
                  <Text variant="footnote" tone="secondary" className="font-semibold uppercase tracking-[1.2px]">
                    {m.label}
                  </Text>
                  <Text variant="footnote" tone="income" numeric className="font-semibold">
                    {`+${fmt(m.total)}`}
                  </Text>
                </View>
                {m.items.map((p) => (
                  <View key={`${p.investmentId}${p.dateKey}${p.kind}`} className="flex-row items-center justify-between px-4 py-2">
                    <View className="flex-1 pr-3">
                      <Text variant="body" numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text variant="footnote" tone="secondary">
                        {`${dayMonth(p.dateKey)} · ${p.kind === "interest" ? "Interest" : "Your money back"}`}
                      </Text>
                    </View>
                    <Text variant="body" tone="income" numeric className="font-medium">
                      {`+${fmt(p.amount)}`}
                    </Text>
                  </View>
                ))}
                <View className="h-2" />
              </View>
            ))}
          </Panel>
        </>
      ) : null}

      {insights.interestByYear.length > 0 ? (
        <>
          <Eyebrow>Interest by year</Eyebrow>
          <Panel>
            {insights.interestByYear.map((y, i) => (
              <View
                key={y.year}
                className={`px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text variant="body" className="font-medium">
                    {String(y.year)}
                  </Text>
                  <Text variant="body" tone="income" numeric className="font-medium">
                    {`+${fmt(y.amount)}`}
                  </Text>
                </View>
                <View className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: colors.fill }}>
                  <View
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(3, (y.amount / maxYear) * 100)}%`, backgroundColor: colors.income }}
                  />
                </View>
              </View>
            ))}
          </Panel>
        </>
      ) : null}

      {open.length > 0 ? (
        <>
          <Eyebrow>Holdings</Eyebrow>
          <Panel>{open.map((s, i) => row(s, i === open.length - 1))}</Panel>
        </>
      ) : null}

      {closed.length > 0 ? (
        <>
          <Eyebrow>Closed</Eyebrow>
          <Panel>
            {showClosed ? (
              closed.map((s, i) => row(s, i === closed.length - 1))
            ) : (
              <ListRow
                label={`Closed · ${closed.length}`}
                chevron
                onPress={() => setShowClosed(true)}
              />
            )}
          </Panel>
        </>
      ) : null}

      <View className="mt-6">
        <TdsCard insights={insights} fmt={fmt} />
      </View>

      <Eyebrow>Tax and tools</Eyebrow>
      <Panel>
        <ListRow
          label="Tax by year"
          value={yearInterest > 0 ? `${fmt(yearInterest)} this year` : undefined}
          chevron
          onPress={() => router.push("/investments/tax")}
        />
        <ListRow
          label="Your tax slab"
          value={slab === null ? "Not set" : `${slab}%`}
          chevron
          onPress={() => setSlabOpen(true)}
        />
        <ListRow
          label="Import Stable Bonds reports"
          chevron
          onPress={() => void runImport()}
        />
        <ListRow
          label="Need the money by a date"
          switchValue={needBy !== null}
          onSwitchChange={(on) => setNeedBy(on ? addMonths(today, 12) : null)}
        />
        {needBy ? (
          <FormRow label="Date">
            <DatePicker
              value={keyToLocalMs(needBy, 12)}
              mode="date"
              display="compact"
              onChange={(ms) => setNeedBy(toDateKey(ms))}
            />
          </FormRow>
        ) : null}
      </Panel>
      {needBy ? (
        <Text
          variant="footnote"
          tone={late.length > 0 ? "warning" : "secondary"}
          className="px-8 pt-2"
        >
          {late.length === 0
            ? "Everything is back by then."
            : `${late.length} ${late.length === 1 ? "investment pays" : "investments pay"} back after this date.`}
        </Text>
      ) : null}

      <OptionPicker
        visible={slabOpen}
        title="Your income tax slab"
        options={[...SLAB_OPTIONS, { value: null, label: "Not set" }]}
        selected={slab}
        onSelect={setSlab}
        onClose={() => setSlabOpen(false)}
      />
    </ScrollView>
  );
}

const TYPE_SHORT: Record<InvestmentType, string> = {
  fd: "FD",
  bond: "Bond",
  gsec: "G-Sec",
  tbill: "T-Bill",
  other: "Other",
};

const TYPE_PLURAL: Record<InvestmentType, string> = {
  fd: "Fixed deposits",
  bond: "Bonds",
  gsec: "Government securities",
  tbill: "Treasury bills",
  other: "Other",
};

const TYPE_ICONS: Record<InvestmentType, string> = {
  fd: "building.columns.fill",
  bond: "doc.text.fill",
  gsec: "shield.fill",
  tbill: "doc.text.fill",
  other: "chart.line.uptrend.xyaxis",
};

function TypeTile({ type }: { type: InvestmentType }) {
  const { colors } = useTokens();
  return (
    <View
      className="h-10 w-10 items-center justify-center rounded-[12px]"
      style={{ backgroundColor: colors.accentSoft }}
    >
      <AppIcon name={TYPE_ICONS[type]} size={20} color={colors.accent} />
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "income" }) {
  return (
    <View className="flex-1">
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="headline" tone={tone} numeric className="mt-0.5">
        {value}
      </Text>
    </View>
  );
}

const dayMonth = (key: string) => {
  const { month, day } = parseKey(key);
  return `${day} ${monthShort(month)}`;
};

/** Upcoming payouts grouped by calendar month, soonest first. */
function upcomingByMonth(upcoming: readonly UpcomingPayout[]) {
  const out: { key: string; label: string; total: number; items: UpcomingPayout[] }[] = [];
  for (const p of upcoming) {
    const key = p.dateKey.slice(0, 7);
    let group = out[out.length - 1];
    if (!group || group.key !== key) {
      const { month, year } = parseKey(p.dateKey);
      group = { key, label: `${monthShort(month)} ${year}`, total: 0, items: [] };
      out.push(group);
    }
    group.total += p.amount;
    group.items.push(p);
  }
  return out;
}
