import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { addMonths, diffDays, monthShort, parseKey } from "@studio/dates";
import { formatMoney } from "@studio/money";
import { haptic, useTokens } from "@studio/theme";
import {
  barRight,
  Button,
  HeaderButton,
  ListRow,
  Switch,
  Text,
} from "@studio/ui";

import { Eyebrow, HeroWash, Panel } from "@/components/app/surface";
import { bondPricing } from "@/lib/investments/bond-price";

import { InfoTip, type GlossaryKey } from "./info-tip";

import {
  useAccounts,
  useExpectedFlows,
  useInvestment,
  useSetting,
  useInvestmentInsights,
  useTaxContext,
} from "@/data/hooks";
import { useMoneyContext } from "@/features/transactions/use-money-context";
import {
  endDate,
  gainClass,
  monthsHeld,
  PAYOUT_KIND_LABELS,
  TYPE_LABELS,
} from "@/lib/investments/tax";

import {
  dateLabel,
  GAIN_CLASS_LABELS,
  investmentLine,
  rateLabel,
  SCHEDULE_LABELS,
} from "./format";

type Fact = { label: string; value: string | undefined; tip?: GlossaryKey; tone?: "income" | "expense" };

/** One investment: what went in, what came back, how it is taxed, and every payout. */
export function InvestmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const money = useMoneyContext();
  const tax = useTaxContext();
  const accounts = useAccounts({ includeArchived: true });
  const [needBy] = useSetting("cash_need_date");
  const detail = useInvestment(id);
  const insights = useInvestmentInsights();
  const { colors } = useTokens();
  const { flows } = useExpectedFlows(id);
  const [afterTds, setAfterTds] = React.useState(true);

  React.useEffect(() => {
    if (!detail && router.canGoBack()) router.back();
  }, [detail, router]);

  if (!detail) return <View className="flex-1 bg-bg" />;

  const inv = detail.investment;
  const decimals = money.showDecimals ? undefined : 0;
  const fmt = (minor: number, sign: "none" | "auto" = "none") =>
    formatMoney(minor, inv.currency, { locale: money.locale, sign, decimals });
  const accountName = (accountId: string | null) =>
    accounts.find((a) => a.id === accountId)?.name;
  const end = endDate(inv);
  const tdsLabel = tax.rules === "india" ? "TDS" : "Tax withheld";

  const terms: Fact[] = [
    { label: "Type", value: TYPE_LABELS[inv.type] },
    {
      label: inv.type === "fd" ? "Bank" : "Issuer",
      value: inv.issuer || undefined,
    },
    { label: "Platform", value: inv.platform || undefined },
    {
      label: inv.type === "fd" ? "FD number" : "ISIN",
      value: inv.reference || undefined,
    },
    { label: "Rating", value: inv.rating || undefined },
    {
      label: inv.type === "fd" ? "Rate" : "Yield (YTM)",
      value: rateLabel(inv.rate),
      tip: inv.type === "fd" ? undefined : "ytm",
    },
    { label: "Interest paid", value: SCHEDULE_LABELS[inv.payout] },
    { label: "Bought", value: dateLabel(inv.buyDate) },
    {
      label: "Matures",
      value: inv.maturityDate ? dateLabel(inv.maturityDate) : undefined,
    },
    {
      label: "Closed",
      value: inv.closedOn ? dateLabel(inv.closedOn) : undefined,
    },
    {
      label: "Months held",
      value: end ? String(monthsHeld(inv.buyDate, end)) : undefined,
    },
    { label: "Paid from", value: accountName(inv.fromAccountId) },
    {
      label: "Taxed as",
      value: GAIN_CLASS_LABELS[gainClass(inv, tax.rules)],
    },
    { label: "Note", value: inv.note || undefined },
  ];
  const received: Fact[] = [
    { label: "Interest", value: fmt(detail.totals.interest) },
    {
      label: tdsLabel,
      value: detail.totals.tds > 0 ? fmt(detail.totals.tds) : undefined,
    },
    { label: "Principal back", value: fmt(detail.totals.principalBack) },
    {
      label: detail.gain !== null && detail.gain < 0 ? "Loss" : "Gain",
      value: detail.gain !== null ? fmt(Math.abs(detail.gain)) : undefined,
    },
  ];
  const r = insights.returns[inv.id];
  const open = detail.status !== "closed";
  const pct = (v: number) => `${Number(v.toFixed(2))}%`;
  const returns: Fact[] = r
    ? [
        {
          label: "Actual return",
          tip: "xirr",
          value:
            r.xirr === null
              ? undefined
              : inv.rate !== null
                ? `${pct(r.xirr)} (rate ${pct(inv.rate)})`
                : pct(r.xirr),
        },
        {
          label: "Total interest",
          value: r.expectedInterest > 0 ? fmt(r.expectedInterest) : undefined,
        },
        {
          label: "Interest to come",
          tip: "interestToCome",
          value: open && r.interestToCome > 0 ? fmt(r.interestToCome) : undefined,
        },
        {
          label: "Interest earned so far",
          value: open && r.accrued > 0 ? fmt(r.accrued) : undefined,
        },
        {
          label: "Total gain",
          value: r.expectedGain > 0 ? fmt(r.expectedGain) : undefined,
        },
        {
          label: "You get back",
          value: r.expectedInterest > 0 ? fmt(r.totalAtMaturity) : undefined,
        },
        {
          label: "Rate after tax",
          value:
            insights.taxRate !== null && inv.rate !== null
              ? pct(inv.rate * (1 - insights.taxRate / 100))
              : undefined,
        },
      ]
    : [];
  const facts = (list: Fact[]) =>
    list
      .filter((f) => f.value !== undefined)
      .map((f, i) => <FactRow key={f.label} fact={f} first={i === 0} />);

  const price = bondPricing(inv);
  const perUnit = (minor: number) => `${fmt(minor)} each`;
  const pricing: Fact[] = price
    ? [
        { label: "Units", value: String(price.units) },
        { label: "Face value", value: perUnit(price.faceValue), tip: "faceValue" },
        { label: "Clean price", value: perUnit(price.cleanPrice), tip: "cleanPrice" },
        {
          label: "Accrued interest",
          value:
            price.accrued === 0
              ? undefined
              : price.accrued > 0
                ? `${fmt(price.accrued)} paid`
                : `${fmt(-price.accrued)} received`,
          tip: "accrued",
        },
        { label: "Dirty price", value: perUnit(price.dirtyPrice), tip: "dirtyPrice" },
        {
          label: price.premium >= 0 ? "Premium paid" : "Discount",
          value:
            Math.abs(price.premium) < 100
              ? "None"
              : `${price.premium > 0 ? "−" : "+"}${fmt(Math.abs(price.premium))}`,
          tip: "premium",
          tone: Math.abs(price.premium) < 100 ? undefined : price.premium > 0 ? "expense" : "income",
        },
      ]
    : [];

  const addPayout = () =>
    router.push({
      pathname: "/investments/[id]/payout",
      params: { id: inv.id },
    });

  const tdsRate = tax.rules === "india" ? 0.1 : 0;
  const lines = scheduleLines(flows, detail.payouts, tdsRate);
  const years = groupByYear(lines);
  const totalBack = lines.reduce((sum, l) => sum + (afterTds ? l.net : l.gross), 0);
  const backDone = lines.filter((l) => l.received).length;
  const tenure = end ? tenureLabel(inv.buyDate, end) : null;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="pb-12"
    >
      <Stack.Screen
        options={{
          title: inv.name,
          ...barRight(
            <HeaderButton
              symbol="pencil"
              label="Edit investment"
              onPress={() =>
                router.push({
                  pathname: "/investments/[id]/edit",
                  params: { id: inv.id },
                })
              }
            />,
          ),
        }}
      />
      <HeroWash>
        <View className="px-5 pb-6 pt-4">
          <Text
            variant="footnote"
            tone={detail.status === "due" ? "warning" : "secondary"}
            className="font-semibold uppercase tracking-[1.4px]"
          >
            {investmentLine(detail, needBy)}
          </Text>
          <View className="mt-4 flex-row items-center">
            <View className="flex-1">
              <Text variant="caption" tone="secondary" className="uppercase tracking-[1.2px]">
                You put in
              </Text>
              <Text variant="title2" tone="expense" numeric className="mt-1">
                {`−${fmt(inv.amount)}`}
              </Text>
            </View>
            {tenure ? (
              <View
                className="rounded-full px-3 py-1"
                style={{ borderWidth: 1, borderColor: colors.separator }}
              >
                <Text variant="footnote" tone="secondary">
                  {tenure}
                </Text>
              </View>
            ) : null}
            <View className="flex-1 items-end">
              <Text variant="caption" tone="secondary" className="uppercase tracking-[1.2px]">
                You get back
              </Text>
              <Text variant="title2" tone="income" numeric className="mt-1">
                {lines.length > 0 ? `+${fmt(totalBack)}` : "—"}
              </Text>
            </View>
          </View>
        </View>
      </HeroWash>

      {lines.length > 0 ? (
        <View
          className="mx-4 mt-4 flex-row items-center justify-center rounded-[14px] py-2.5"
          style={{ backgroundColor: colors.fill }}
        >
          <Text variant="footnote" tone="secondary" className="font-semibold uppercase tracking-[1.2px]">
            {backDone === 0
              ? `${lines.length} payouts ahead`
              : `${backDone} of ${lines.length} paid so far`}
          </Text>
        </View>
      ) : null}

      {years.map(([year, rows], index) => (
        <View key={year}>
          <Eyebrow
            trailing={
              index === 0 && tdsRate > 0 ? (
                <View className="flex-row items-center gap-2">
                  <Text variant="footnote" tone="secondary">
                    After {tdsLabel}
                  </Text>
                  <Switch
                    value={afterTds}
                    onValueChange={(v) => {
                      haptic("selection");
                      setAfterTds(v);
                    }}
                    accessibilityLabel={`Show amounts after ${tdsLabel}`}
                  />
                </View>
              ) : undefined
            }
          >
            {`${year} · ${rows.length} ${rows.length === 1 ? "payout" : "payouts"}`}
          </Eyebrow>
          <Panel>
            {rows.map((l, i) => (
              <View
                key={`${l.dateKey}${l.kind}`}
                className="flex-row items-center justify-between px-4 py-3.5"
                style={
                  i > 0
                    ? { borderTopWidth: 0.5, borderTopColor: colors.separator }
                    : null
                }
              >
                <View>
                  <Text variant="body" className="font-medium">
                    {shortDate(l.dateKey)}
                  </Text>
                  <Text variant="subhead" tone="secondary">
                    {l.kind === "interest" ? "Interest" : "Your money back"}
                    {l.received ? " · Received" : ""}
                  </Text>
                </View>
                <Text variant="headline" numeric tone="income">
                  {`+${fmt(afterTds ? l.net : l.gross)}`}
                </Text>
              </View>
            ))}
          </Panel>
        </View>
      ))}

      <View className="mt-6 px-4">
        <Button size="lg" variant={detail.status === "closed" ? "secondary" : "primary"} onPress={addPayout}>
          Add payout
        </Button>
      </View>

      {price ? (
        <>
          <Eyebrow>Bond price</Eyebrow>
          <Panel>{facts(pricing)}</Panel>
          <Text variant="footnote" tone="secondary" className="px-8 pt-2">
            {Math.abs(price.premium) < 100
              ? "You paid face value, so nothing is lost or gained on the price."
              : price.premium > 0
                ? `At the end you get ${fmt(price.faceTotal)} back, ${fmt(price.premium)} less than the ${fmt(price.cleanTotal)} you paid for the bonds. Your yield already counts this.`
                : `At the end you get ${fmt(price.faceTotal)} back, ${fmt(-price.premium)} more than the ${fmt(price.cleanTotal)} you paid for the bonds.`}
          </Text>
        </>
      ) : null}

      {returns.some((f) => f.value !== undefined) ? (
        <>
          <Eyebrow>Returns</Eyebrow>
          <Panel>{facts(returns)}</Panel>
        </>
      ) : null}

      {detail.payouts.length > 0 ? (
        <>
          <Eyebrow>Received</Eyebrow>
          <Panel>
            {facts(received)}
            {detail.payouts.map((p) => (
              <ListRow
                key={p.id}
                label={PAYOUT_KIND_LABELS[p.kind]}
                subtitle={[
                  dateLabel(p.dateKey),
                  p.tds > 0 ? `${tdsLabel} ${fmt(p.tds)}` : undefined,
                  accountName(p.accountId),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                value={fmt(p.gross)}
                chevron
                onPress={() =>
                  router.push({
                    pathname: "/investments/[id]/payout",
                    params: { id: inv.id, payoutId: p.id },
                  })
                }
              />
            ))}
          </Panel>
        </>
      ) : null}

      <Eyebrow>Details</Eyebrow>
      <Panel>
        {facts(terms)}
        <ListRow
          label="Payout schedule"
          chevron
          onPress={() =>
            router.push({
              pathname: "/investments/[id]/schedule",
              params: { id: inv.id },
            })
          }
        />
      </Panel>
    </ScrollView>
  );
}

type Line = {
  dateKey: string;
  kind: "interest" | "principal";
  gross: number;
  net: number;
  received: boolean;
};

const MATCH_DAYS = 7;

/** Expected payouts, with the recorded payout swapped in where one landed near the expected date. */
function scheduleLines(
  flows: readonly { dateKey: string; kind: "interest" | "principal"; amount: number }[],
  payouts: readonly { dateKey: string; kind: string; gross: number; tds: number }[],
  tdsRate: number,
): Line[] {
  const used = new Set<number>();
  return flows.map((f) => {
    const hit = payouts.findIndex(
      (p, i) =>
        !used.has(i) &&
        (p.kind === "interest") === (f.kind === "interest") &&
        Math.abs(diffDays(f.dateKey, p.dateKey)) <= MATCH_DAYS,
    );
    if (hit >= 0) {
      used.add(hit);
      const p = payouts[hit]!;
      return { dateKey: p.dateKey, kind: f.kind, gross: p.gross, net: p.gross - p.tds, received: true };
    }
    const tds = f.kind === "interest" ? Math.round(f.amount * tdsRate) : 0;
    return { dateKey: f.dateKey, kind: f.kind, gross: f.amount, net: f.amount - tds, received: false };
  });
}

function groupByYear(lines: readonly Line[]): [number, Line[]][] {
  const out = new Map<number, Line[]>();
  for (const l of lines) {
    const y = parseKey(l.dateKey).year;
    out.set(y, [...(out.get(y) ?? []), l]);
  }
  return [...out.entries()];
}

function shortDate(key: string): string {
  const { month, day } = parseKey(key);
  return `${monthShort(month)} ${day}`;
}

/** "5M 10D", the way platforms show a holding period. */
function tenureLabel(from: string, to: string): string {
  let months = 0;
  while (addMonths(from, months + 1) <= to) months += 1;
  const days = diffDays(addMonths(from, months), to);
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y}Y` : "", m ? `${m}M` : "", days ? `${days}D` : ""].filter(Boolean).join(" ") || "0D";
}

/** Label (with its explanation, when there is one) on the left, value on the right. */
function FactRow({ fact, first }: { fact: Fact; first: boolean }) {
  return (
    <View className={`min-h-[50px] flex-row items-center gap-3 px-4 py-3 ${first ? "" : "border-t border-border"}`}>
      <View className="flex-1 flex-row items-center gap-1.5">
        <Text variant="body">{fact.label}</Text>
        {fact.tip ? <InfoTip term={fact.tip} /> : null}
      </View>
      <Text variant="body" tone={fact.tone ?? "secondary"} numeric className="max-w-[60%] text-right">
        {fact.value}
      </Text>
    </View>
  );
}
