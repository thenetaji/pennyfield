import { useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { AddFab } from "@/components/app/add-fab";
import { EmptyState, Card } from "@studio/ui";
import {
  useAccounts,
  useAllTimeSpend,
  useBudgets,
  useCategories,
  useHomeSpend,
  useInsights,
  usePockets,
  useRecentTransactions,
  useSetting,
  useTodayKey,
  useUpcoming,
} from "@/data/hooks";
import { AccountsCard } from "@/features/home/accounts-card";
import { BudgetStatus } from "@/features/home/budget-status";
import { QuickAdd } from "@/features/home/quick-add";
import { Pockets } from "@/features/home/pockets";
import { HomeSectionHeader } from "@/features/home/section-header";
import { SpendHero } from "@/features/home/spend-hero";
import { HomeTopBar } from "@/features/home/top-bar";
import { TopCategories } from "@/features/home/top-categories";
import { UpcomingBills } from "@/features/home/upcoming-bills";
import { TransactionListRow } from "@/features/transactions/transaction-list-row";
import { useMoneyContext } from "@/features/transactions/use-money-context";
import {
  diffDays,
  monthName,
  parseKey,
  periodFor,
  previousPeriod,
} from "@studio/dates";
import { formatMoney } from "@studio/money";
import { Stagger } from "@studio/motion";
import type { HomeSectionId } from "@/lib/home/layout";
import { budgetPace, elapsedDays } from "@/lib/budgets/pace";

const RECENT_COUNT = 5;
/** Bills are looked up at least this far ahead, and always to the end of the month. */
const BILLS_WINDOW_DAYS = 30;
const STAGGER = { base: 200, step: 55 } as const;
/** Gap above each section; quick add sits closer to the hero. */
const SPACING: Record<HomeSectionId, string> = {
  accounts: "mt-3",
  quick_add: "mt-[22px]",
  pockets: "mt-[26px]",
  budgets: "mt-[26px]",
  bills: "mt-[26px]",
  top_categories: "mt-[26px]",
  recent: "mt-[26px]",
};

export default function Home() {
  const router = useRouter();
  const money = useMoneyContext({ relativeDays: true });
  const today = useTodayKey();
  const [weekStart] = useSetting("week_start");
  const [monthStart] = useSetting("month_start");
  const accounts = useAccounts();
  const categories = useCategories();
  const month = React.useMemo(
    () => periodFor("month", today, { weekStart, monthStart }),
    [today, weekStart, monthStart],
  );
  const spend = useHomeSpend(month, today);
  const allTime = useAllTimeSpend(today);
  const budgets = useBudgets();
  const occurrences = useUpcoming(
    Math.max(diffDays(today, month.to), BILLS_WINDOW_DAYS),
  );
  const insights = useInsights(month, "expense");
  const recent = useRecentTransactions(RECENT_COUNT);
  const [layout] = useSetting("home_layout");
  const pockets = usePockets();

  const { displayCurrency, rates, locale } = money;
  const categoryMap = React.useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const overall = budgets.find(
    (b) =>
      b.budget.scope === "all" &&
      b.budget.period === "monthly" &&
      b.budget.currency === displayCurrency,
  );
  const overallAtRisk = overall
    ? budgetPace({
        spent: overall.spent,
        available: overall.available,
        upcoming: overall.upcoming,
        recurringSpent: overall.recurringSpent,
        totalDays: elapsedDays(overall.period, overall.period.to),
        elapsedDays: elapsedDays(overall.period, today),
      }).status !== "on_track"
    : false;

  const decimals = money.showDecimals ? undefined : 0;
  const fmt = (minor: number, sign: "none" | "auto" = "none") =>
    formatMoney(minor, displayCurrency, { locale, sign, decimals });
  const end = parseKey(month.to);
  const previous = parseKey(previousPeriod(month).from);
  const empty = recent.length === 0;
  const hasBills = occurrences.some((o) => o.rule.kind === "expense");

  const renderSection = (id: HomeSectionId): React.ReactNode => {
    switch (id) {
      case "accounts":
        return (
          <AccountsCard
            accounts={accounts}
            displayCurrency={displayCurrency}
            rates={rates}
            locale={locale}
            showDecimals={money.showDecimals}
          />
        );
      case "quick_add":
        return <QuickAdd />;
      case "pockets":
        return pockets.length > 0 ? (
          <Pockets
            pockets={pockets}
            locale={locale}
            showDecimals={money.showDecimals}
          />
        ) : null;
      case "budgets":
        return budgets.length > 0 ? (
          <BudgetStatus
            budgets={budgets}
            categories={categoryMap}
            todayKey={today}
            locale={locale}
            showDecimals={money.showDecimals}
          />
        ) : null;
      case "bills":
        return hasBills ? (
          <UpcomingBills
            occurrences={occurrences}
            categories={categoryMap}
            todayKey={today}
            locale={locale}
            showDecimals={money.showDecimals}
          />
        ) : null;
      case "top_categories":
        return insights.categories.length > 0 ? (
          <TopCategories
            insights={insights}
            locale={locale}
            showDecimals={money.showDecimals}
          />
        ) : null;
      case "recent":
        return (
          <>
            <HomeSectionHeader
              title="Recent"
              actionLabel="All"
              onAction={() =>
                router.push({ pathname: "/activity", params: { now: "1" } })
              }
            />
            <Card className="overflow-hidden rounded-[20px] p-0">
              {recent.map((item, i) => (
                <TransactionListRow
                  key={item.id}
                  item={item}
                  context={money}
                  separator={i < recent.length - 1}
                />
              ))}
            </Card>
          </>
        );
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <HomeTopBar />
      <ScrollView
        contentContainerClassName="px-4 pb-28"
        contentContainerStyle={empty ? { flexGrow: 1 } : undefined}
        showsVerticalScrollIndicator={false}
      >
        {empty ? (
          <EmptyState
            icon="bill"
            title="No transactions yet"
            message="Add what you spend and Home shows this month's total, your pace and where it all went."
            actionLabel="Add transaction"
            onAction={() => router.push("/transaction/new")}
          />
        ) : (
          <>
            <View className="mt-2">
              <SpendHero
                spend={spend}
                allTime={allTime}
                monthLabel={monthName(end.month)}
                previousLabel={monthName(previous.month)}
                monthEnd={month.to}
                budget={overall ? Math.max(0, overall.available) : 0}
                budgetAtRisk={overallAtRisk}
                earned={fmt(spend.earned)}
                earnedZero={spend.earned <= 0}
                locale={locale}
                showDecimals={money.showDecimals}
              />
            </View>
            {layout
              .filter((section) => section.visible)
              .map((section, index) => {
                const content = renderSection(section.id);
                if (!content) return null;
                return (
                  <Stagger
                    key={section.id}
                    index={index}
                    {...STAGGER}
                    className={SPACING[section.id]}
                  >
                    {content}
                  </Stagger>
                );
              })}
          </>
        )}
      </ScrollView>
      <AddFab />
    </View>
  );
}
