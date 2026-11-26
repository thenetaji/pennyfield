import { useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { addMonths, keyToLocalMs, monthShort, parseKey, toDateKey } from "@studio/dates";
import { formatMoney } from "@studio/money";
import { Button, ListRow, OptionPicker, Pressable, Text } from "@studio/ui";

import {
  Eyebrow,
  ChangePill,
  HeroWash,
  Panel,
  StatHero,
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
import { backAfter, TYPE_LABELS, taxYearOf } from "@/lib/investments/tax";

import { rateLabel } from "./format";
import {
  InterestCard,
  LadderCard,
  SplitCard,
  SummaryCard,
  TdsCard,
  UpcomingCard,
} from "./insight-cards";

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
  const money = useMoneyContext();
  const today = useTodayKey();
  const list = useInvestments();
  const years = useTaxYears();
  const tax = useTaxContext();
  const [needBy, setNeedBy] = useSetting("cash_need_date");
  const [showClosed, setShowClosed] = React.useState(false);
  const [showReturns, setShowReturns] = React.useState(false);
  const insights = useInvestmentInsights();
  const [slab, setSlab] = useSetting("tax_slab_percent");
  const [slabOpen, setSlabOpen] = React.useState(false);

  const add = () => router.push("/investments/new");

  if (list.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-4 px-8 pb-24">
        <Text variant="body" tone="secondary" className="text-center">
          No investments yet.
        </Text>
        <Button size="lg" onPress={add}>
          Add investment
        </Button>
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
  const lastYear = years.find((y) => y.startYear === thisYear - 1);
  const late = needBy
    ? open.filter((s) => backAfter(s.investment, needBy))
    : [];

  const row = (s: InvestmentSummary, last: boolean) => {
    const inv = s.investment;
    const when = inv.closedOn ?? inv.maturityDate;
    const sub = [TYPE_LABELS[inv.type], inv.issuer].filter(Boolean).join(" · ");
    const right = [rateLabel(inv.rate), when ? monthYear(when) : undefined]
      .filter(Boolean)
      .join(" · ");
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
          className={`min-h-[56px] flex-row items-center justify-between gap-3 px-4 py-3 ${last ? "" : "border-b border-border"}`}
        >
          <View className="flex-1">
            <Text variant="headline" numberOfLines={1}>
              {inv.name}
            </Text>
            {sub ? (
              <Text variant="subhead" tone="secondary" numberOfLines={1}>
                {sub}
              </Text>
            ) : null}
          </View>
          <View className="items-end">
            <Text variant="headline" numeric>
              {fmt(inv.amount)}
            </Text>
            {right ? (
              <Text variant="subhead" tone="secondary" numeric>
                {right}
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
        <StatHero
          label="Invested"
          value={fmt(insights.invested)}
          sub={`Interest to come ${fmt(insights.interestToCome)}`}
          change={
            insights.accrued > 0
              ? { text: `+${fmt(insights.accrued)} earned`, positive: true }
              : undefined
          }
        />
      </HeroWash>

      {open.length > 0 ? (
        <>
          <Eyebrow>HOLDINGS</Eyebrow>
          <Panel>{open.map((s, i) => row(s, i === open.length - 1))}</Panel>
        </>
      ) : null}

      {closed.length > 0 ? (
        <>
          <Eyebrow>CLOSED</Eyebrow>
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

      <Eyebrow>MORE</Eyebrow>
      <Panel>
        <ListRow
          label="Tax by year"
          chevron
          onPress={() => router.push("/investments/tax")}
        />
        <ListRow
          label="Returns"
          chevron
          onPress={() => setShowReturns((v) => !v)}
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

      {showReturns ? (
        <View className="mt-6 gap-4">
          <SummaryCard
            insights={insights}
            fmt={fmt}
            onSetSlab={() => setSlabOpen(true)}
          />
          <TdsCard insights={insights} fmt={fmt} />
          <UpcomingCard insights={insights} fmt={fmt} />
          <LadderCard insights={insights} fmt={fmt} locale={money.locale} />
          <InterestCard
            insights={insights}
            fmt={fmt}
            locale={money.locale}
            thisYear={yearInterest}
            lastYear={lastYear ? lastYear.interest : null}
          />
          <SplitCard open={open} fmt={fmt} />
        </View>
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
