import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { Stagger } from "@studio/motion";
import {
  Amount,
  barRight,
  Button,
  HeaderButton,
  ListGroup,
  ListRow,
  Text,
} from "@studio/ui";

import {
  useAccounts,
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

type Fact = { label: string; value: string | undefined };

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
    { label: "Rate", value: rateLabel(inv.rate) },
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
          label: "Return a year",
          value:
            r.xirr === null
              ? undefined
              : inv.rate !== null
                ? `${pct(r.xirr)} (rate ${pct(inv.rate)})`
                : pct(r.xirr),
        },
        {
          label: "Interest over the term",
          value: r.expectedInterest > 0 ? fmt(r.expectedInterest) : undefined,
        },
        {
          label: "Still to come",
          value: open && r.interestToCome > 0 ? fmt(r.interestToCome) : undefined,
        },
        {
          label: "Earned, not paid",
          value: open && r.accrued > 0 ? fmt(r.accrued) : undefined,
        },
        {
          label: "Total at maturity",
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
      .map((f) => <ListRow key={f.label} label={f.label} value={f.value} />);

  const addPayout = () =>
    router.push({
      pathname: "/investments/[id]/payout",
      params: { id: inv.id },
    });

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 pb-12"
    >
      <Stack.Screen
        options={{
          title: "",
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
      <Stagger index={0} className="items-center gap-1 px-6 pt-4">
        <Text
          variant="title2"
          numberOfLines={2}
          accessibilityRole="header"
          className="text-center"
        >
          {inv.name}
        </Text>
        <Text
          variant="footnote"
          tone={detail.status === "due" ? "warning" : "secondary"}
        >
          {investmentLine(detail, needBy)}
        </Text>
        <Amount
          value={fmt(inv.amount)}
          variant="hero"
          animate="intro"
          accessibilityLabel={`${inv.name}, ${formatMoneyForSpeech(inv.amount, inv.currency, { sign: "none", locale: money.locale })} invested`}
        />
      </Stagger>

      {detail.status === "closed" ? null : (
        <Stagger index={1} className="px-4">
          <Button size="lg" onPress={addPayout} accessibilityLabel="Add payout">
            Add payout
          </Button>
        </Stagger>
      )}

      {returns.some((f) => f.value !== undefined) ? (
        <Stagger index={2}>
          <ListGroup
            header="Returns"
            footer="Expected figures come from the rate and schedule. Return a year counts money on the dates it actually moved."
          >
            {facts(returns)}
          </ListGroup>
        </Stagger>
      ) : null}

      <Stagger index={2}>
        <ListGroup header="Received">{facts(received)}</ListGroup>
      </Stagger>

      {detail.payouts.length > 0 ? (
        <Stagger index={3}>
          <ListGroup header="Payouts">
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
          </ListGroup>
        </Stagger>
      ) : null}

      <Stagger index={4}>
        <ListGroup header="Details">{facts(terms)}</ListGroup>
      </Stagger>
      {detail.status === "closed" ? (
        <View className="px-4">
          <Button
            variant="secondary"
            onPress={addPayout}
            accessibilityLabel="Add payout"
          >
            Add payout
          </Button>
        </View>
      ) : null}
    </ScrollView>
  );
}
