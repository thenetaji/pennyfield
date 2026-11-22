import * as React from "react";
import { ScrollView, Share, View } from "react-native";

import { monthName } from "@studio/dates";
import { formatMoney } from "@studio/money";
import { Stagger } from "@studio/motion";
import { Button, EmptyState, ListGroup, ListRow } from "@studio/ui";

import {
  useInvestments,
  useSetting,
  useSettings,
  useTaxContext,
  useTaxYears,
} from "@/data/hooks";
import { PickRow } from "@/features/entry/form-row";
import { useMoneyContext } from "@/features/transactions/use-money-context";
import type {
  TaxRules,
  TaxRulesSetting,
  TaxYearSummary,
} from "@/lib/investments/tax";

const RULE_OPTIONS: { value: TaxRulesSetting; label: string }[] = [
  { value: "auto", label: "From currency" },
  { value: "india", label: "India" },
  { value: "general", label: "Other country" },
];

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: monthName(i + 1),
}));

type Line = { label: string; amount: number; always?: boolean };

/** The figures a tax return asks for, named the way the return names them. */
export function taxLines(year: TaxYearSummary, rules: TaxRules): Line[] {
  if (rules === "general")
    return [
      { label: "Interest", amount: year.interest, always: true },
      { label: "Tax withheld", amount: year.tds },
      { label: "Capital gains", amount: year.gains.gain },
    ];
  return [
    { label: "Interest (Schedule OS)", amount: year.interest, always: true },
    { label: "TDS to claim", amount: year.tds, always: true },
    { label: "Short-term bond gains, slab rate", amount: year.gains.short },
    { label: "Long-term bond gains, 12.5%", amount: year.gains.long },
    { label: "Unlisted bond gains, slab rate", amount: year.gains.unlisted },
  ];
}

/** Interest, tax withheld and bond gains for each tax year, ready to copy into a return. */
export function TaxYearsScreen() {
  const money = useMoneyContext();
  const years = useTaxYears();
  const tax = useTaxContext();
  const [rulesSetting, setRules] = useSetting("tax_rules");
  const [startMonth, setStartMonth] = useSetting("tax_year_start_month");
  const decimals = money.showDecimals ? undefined : 0;
  const settings = useSettings();
  const currency =
    useInvestments()[0]?.investment.currency ?? settings.display_currency;
  const fmt = (minor: number) =>
    formatMoney(minor, currency, {
      locale: money.locale,
      sign: "auto",
      decimals,
    });

  const share = (year: TaxYearSummary) => {
    const lines = taxLines(year, tax.rules)
      .filter((l) => l.always || l.amount !== 0)
      .map((l) => `${l.label}: ${fmt(l.amount)}`);
    void Share.share({
      message: [`Tax year ${year.label}`, ...lines].join("\n"),
    });
  };

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 pb-12 pt-2"
    >
      <Stagger index={0}>
        <ListGroup
          footer={
            tax.rules === "india"
              ? "Tax years run 1 April to 31 March. Check interest and TDS against your AIS on the income tax portal."
              : undefined
          }
        >
          <PickRow
            label="Tax rules"
            value={
              RULE_OPTIONS.find((o) => o.value === rulesSetting)?.label ?? ""
            }
            options={RULE_OPTIONS}
            selected={rulesSetting}
            onSelect={setRules}
          />
          {tax.rules === "general" ? (
            <PickRow
              label="Year starts in"
              value={monthName(tax.startMonth)}
              options={MONTH_OPTIONS}
              selected={startMonth}
              onSelect={setStartMonth}
            />
          ) : null}
        </ListGroup>
      </Stagger>

      {years.length === 0 ? (
        <View className="pt-16">
          <EmptyState
            icon="taxes"
            message="Interest and gains show here once you add a payout."
          />
        </View>
      ) : (
        years.map((year, i) => (
          <Stagger key={year.startYear} index={i + 1}>
            <ListGroup header={year.label}>
              {taxLines(year, tax.rules)
                .filter((l) => l.always || l.amount !== 0)
                .map((l) => (
                  <ListRow
                    key={l.label}
                    label={l.label}
                    value={fmt(l.amount)}
                  />
                ))}
            </ListGroup>
            <View className="flex-row px-4 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onPress={() => share(year)}
                accessibilityLabel={`Share tax year ${year.label}`}
              >
                Share
              </Button>
            </View>
          </Stagger>
        ))
      )}
    </ScrollView>
  );
}
