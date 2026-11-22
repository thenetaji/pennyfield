import { Stack, useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { addMonths, keyToLocalMs, toDateKey } from "@studio/dates";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { Stagger } from "@studio/motion";
import {
  Amount,
  barRight,
  EmptyState,
  HeaderButton,
  ListGroup,
  ListRow,
  OptionPicker,
  Text,
} from "@studio/ui";

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

import { investmentLine } from "./format";
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

/** Every deposit and bond: what is still invested, the tax year, and a row each, closed ones folded away. */
export function InvestmentsScreen() {
  const router = useRouter();
  const money = useMoneyContext();
  const today = useTodayKey();
  const list = useInvestments();
  const years = useTaxYears();
  const tax = useTaxContext();
  const [needBy, setNeedBy] = useSetting("cash_need_date");
  const [showClosed, setShowClosed] = React.useState(false);
  const insights = useInvestmentInsights();
  const [slab, setSlab] = useSetting("tax_slab_percent");
  const [slabOpen, setSlabOpen] = React.useState(false);

  const add = () => router.push("/investments/new");
  const header = (
    <Stack.Screen
      options={{
        title: "Investments",
        ...barRight(
          <HeaderButton symbol="plus" label="Add investment" onPress={add} />,
        ),
      }}
    />
  );

  if (list.length === 0) {
    return (
      <View className="flex-1 justify-center bg-bg pb-24">
        {header}
        <EmptyState
          icon="investments"
          title="No investments yet"
          message="Add a fixed deposit or bond to track its interest, maturity and tax."
          actionLabel="Add investment"
          onAction={add}
        />
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

  const row = (s: InvestmentSummary) => (
    <ListRow
      key={s.investment.id}
      label={s.investment.name}
      subtitle={investmentLine(s, needBy)}
      value={fmt(s.investment.amount)}
      chevron
      onPress={() =>
        router.push({
          pathname: "/investments/[id]",
          params: { id: s.investment.id },
        })
      }
    />
  );

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 pb-12 pt-2"
    >
      {header}
      <Stagger index={0} className="gap-1 px-4">
        <Text variant="footnote" tone="secondary">
          Worth today
        </Text>
        <Amount
          value={fmt(insights.currentValue)}
          variant="hero"
          animate="intro"
          accessibilityLabel={`Worth today, ${formatMoneyForSpeech(insights.currentValue, currency, { sign: "none", locale: money.locale })}`}
        />
        <Text variant="subhead" tone="secondary" numeric>
          {`Interest this tax year: ${fmt(yearInterest)}`}
        </Text>
      </Stagger>

      <Stagger index={1} className="gap-4">
        <SummaryCard
          insights={insights}
          fmt={fmt}
          onSetSlab={() => setSlabOpen(true)}
        />
        <TdsCard insights={insights} fmt={fmt} />
        <UpcomingCard insights={insights} fmt={fmt} />
        <LadderCard insights={insights} fmt={fmt} locale={money.locale} />
      </Stagger>

      <Stagger index={2}>
        <ListGroup>
          <ListRow
            label="Tax by year"
            icon={{ name: "taxes", color: "blue" }}
            chevron
            onPress={() => router.push("/investments/tax")}
          />
          <ListRow
            label="Need the money by a date"
            icon={{ name: "calendar", color: "blue" }}
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
        </ListGroup>
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
      </Stagger>

      {open.length > 0 ? (
        <Stagger index={2}>
          <ListGroup header="Open">{open.map(row)}</ListGroup>
        </Stagger>
      ) : null}

      <Stagger index={3} className="gap-4">
        <InterestCard
          insights={insights}
          fmt={fmt}
          locale={money.locale}
          thisYear={yearInterest}
          lastYear={lastYear ? lastYear.interest : null}
        />
        <SplitCard open={open} fmt={fmt} />
      </Stagger>

      {closed.length > 0 ? (
        <Stagger index={4}>
          <ListGroup header={showClosed ? "Closed" : undefined}>
            {showClosed
              ? closed.map(row)
              : [
                  <ListRow
                    key="closed"
                    label={`Closed · ${closed.length}`}
                    chevron
                    onPress={() => setShowClosed(true)}
                  />,
                ]}
          </ListGroup>
        </Stagger>
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
