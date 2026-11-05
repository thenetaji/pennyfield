import * as React from "react";
import { View } from "react-native";

import { AnimatedNumber, Card, SectionHeader, Text } from "@studio/ui";
import { CumulativeDuo } from "@studio/charts/components";
import { buildDuo } from "@studio/charts/lib";
import { monthShort, parseKey } from "@studio/dates";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { useTokens } from "@studio/theme";

import type { MonthlyCashFlow } from "./cashflow-model";
import { flowAmount, percentText } from "./labels";

type CashFlowCardProps = {
  flow: MonthlyCashFlow;
  currency: string;
  locale?: string;
};

function Figure({
  label,
  value,
  tone,
  swatch,
  accessibilityLabel,
}: {
  label: string;
  value: string;
  tone?: "default" | "income" | "expense";
  swatch: { color: string; line?: boolean };
  accessibilityLabel: string;
}) {
  return (
    <View
      className="min-w-0 flex-1"
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <View className="flex-row items-center">
        <View
          className="mr-1.5"
          style={
            swatch.line
              ? {
                  width: 10,
                  height: 3,
                  borderRadius: 1.5,
                  backgroundColor: swatch.color,
                }
              : {
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: swatch.color,
                }
          }
        />
        <Text variant="footnote" tone="secondary" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <AnimatedNumber
        value={value}
        variant="headline"
        tone={tone}
        fit
        className="mt-0.5"
      />
    </View>
  );
}

/**
 * "Cash flow": money in and money out added up month by month as two lines, the gap between them shaded. The figures
 * above follow the scrubbed month; a scrub stays until the window of months changes.
 */
const CashFlowCard = React.memo(function CashFlowCard({
  flow,
  currency,
  locale,
}: CashFlowCardProps) {
  const { colors } = useTokens();
  const { months } = flow;
  const windowKey = `${months[0]?.key ?? ""}:${months.length}`;
  const [scrubbed, setScrubbed] = React.useState<{
    window: string;
    index: number | null;
  }>({ window: windowKey, index: null });
  const scrub = scrubbed.window === windowKey ? scrubbed.index : null;
  const setScrub = React.useCallback(
    (index: number | null) => {
      if (index !== null) setScrubbed({ window: windowKey, index });
    },
    [windowKey],
  );
  // A scrubbed month, else the period's own month, else the whole window (a year, a long range).
  const focus = scrub ?? (flow.focusIndex >= 0 ? flow.focusIndex : null);
  const first = months[0];
  const lastMonth = months[months.length - 1];
  const month =
    focus !== null
      ? months[focus]
      : first && lastMonth
        ? {
            key: first.key,
            from: first.from,
            to: lastMonth.to,
            income: flow.income,
            spent: flow.spent,
            net: flow.net,
            rate: flow.rate,
          }
        : undefined;
  const series = React.useMemo(
    () =>
      buildDuo(
        months.map((m) => m.income),
        months.map((m) => m.spent),
        months.length - 1,
      ),
    [months],
  );
  const labels = React.useMemo(() => {
    const step = months.length > 8 ? 2 : 1;
    return months.flatMap((m, index) =>
      index % step === 0
        ? [{ index, text: monthShort(parseKey(m.key).month) }]
        : [],
    );
  }, [months]);
  if (!month) return null;
  const money = (v: number) =>
    formatMoney(v, currency, { locale, decimals: 0 });
  const speech = (v: number) =>
    formatMoneyForSpeech(v, currency, { sign: "none", locale });
  const monthName = (key: string) =>
    `${monthShort(parseKey(key).month)} ${parseKey(key).year}`;
  const name =
    focus !== null
      ? monthName(month.key)
      : `${monthShort(parseKey(month.from).month)}${parseKey(month.from).year === parseKey(lastMonth?.key ?? month.key).year ? "" : ` ${parseKey(month.from).year}`} – ${monthName(lastMonth?.key ?? month.key)}`;
  const summary = `Cash flow, added up by month. ${months
    .map(
      (m) =>
        `${monthShort(parseKey(m.key).month)}: in ${speech(m.income)}, out ${speech(m.spent)}${m.rate === null ? "" : `, saved ${m.rate} percent`}`,
    )
    .join("; ")}`;
  return (
    <>
      <SectionHeader title="Cash flow" />
      <Card className="mx-4 px-4 pb-2 pt-3">
        <Text variant="footnote" tone="tertiary" className="pb-1.5">
          {name}
        </Text>
        <View className="flex-row gap-3 pb-1">
          <Figure
            label="In"
            value={money(month.income)}
            swatch={{ color: colors.income }}
            accessibilityLabel={`${name} in, ${speech(month.income)}`}
          />
          <Figure
            label="Out"
            value={money(month.spent)}
            swatch={{ color: colors.text }}
            accessibilityLabel={`${name} out, ${speech(month.spent)}`}
          />
          <Figure
            label={
              month.rate === null ? "Net" : `Net · ${percentText(month.rate)}`
            }
            value={formatMoney(month.net, currency, {
              locale,
              decimals: 0,
              sign: "auto",
            })}
            tone={month.net < 0 ? "expense" : "default"}
            swatch={{ color: colors.text, line: true }}
            accessibilityLabel={`${name} net, ${month.net < 0 ? "minus " : ""}${speech(Math.abs(month.net))}${month.rate === null ? "" : `, savings rate ${month.rate} percent`}`}
          />
        </View>
        <CumulativeDuo
          series={series}
          height={140}
          labels={labels}
          selectedIndex={scrub}
          onSelect={setScrub}
          focusIndex={flow.focusIndex >= 0 ? flow.focusIndex : undefined}
          inColor={colors.income}
          outColor={colors.text}
          inName="In"
          outName="Out"
          formatLabel={(i) => {
            const m = months[i];
            const point = series[i];
            return m && point
              ? `To ${monthShort(parseKey(m.key).month)} · In ${flowAmount(point.in ?? 0, currency, locale)} · Out ${flowAmount(point.out ?? 0, currency, locale)}`
              : "";
          }}
          accessibilityLabel={summary}
        />
        {focus !== null ? (
          <Text
            variant="footnote"
            tone="secondary"
            numeric
            className="pb-1 pt-1"
          >
            {flow.rate === null
              ? `${months.length} months · nothing earned`
              : `${months.length} months · kept ${percentText(flow.rate)} of ${money(flow.income)}`}
          </Text>
        ) : null}
      </Card>
    </>
  );
});

export { CashFlowCard };
