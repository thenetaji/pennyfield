import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { formatMoney } from "@studio/money";
import { ListRow } from "@studio/ui";

import { Panel } from "@/components/app/surface";
import { useInvestmentInsights, useInvestments } from "@/data/hooks";
import { LadderCard, SummaryCard, UpcomingCard } from "@/features/investments/insight-cards";
import { useMoneyContext } from "@/features/transactions/use-money-context";

/** Insights' investment chapter: totals, the next payouts and what comes back when. Hidden with no holdings. */
export function InvestmentsChapter({ label }: { label: React.ReactNode }) {
  const router = useRouter();
  const money = useMoneyContext();
  const list = useInvestments();
  const insights = useInvestmentInsights();
  if (!list.some((s) => s.status !== "closed")) return null;

  const currency = list[0]?.investment.currency ?? "INR";
  const fmt = (minor: number) =>
    formatMoney(minor, currency, {
      locale: money.locale,
      sign: "none",
      decimals: money.showDecimals ? undefined : 0,
    });
  const openPage = () => router.push("/activity?page=investments");

  return (
    <View>
      {label}
      <View className="gap-4 pt-2">
        <SummaryCard insights={insights} fmt={fmt} onSetSlab={openPage} />
        <UpcomingCard insights={insights} fmt={fmt} />
        <LadderCard insights={insights} fmt={fmt} locale={money.locale} />
        <Panel>
          <ListRow label="All investments" chevron onPress={openPage} />
        </Panel>
      </View>
    </View>
  );
}
