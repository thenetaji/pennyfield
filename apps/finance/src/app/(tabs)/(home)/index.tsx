import { useRouter } from "expo-router";
import * as React from "react";

import { updateWidget } from "../../../../modules/finance-widget";
import { useWorkTime } from "@/features/explore/shared";
import { ScrollView, View } from "react-native";

import { AddFab } from "@/components/app/add-fab";
import { Reveal, ScrollRevealProvider, useScrollReveal } from "@/components/app/scroll-reveal";
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
import { HomeChapter, HomeSectionHeader } from "@/features/home/section-header";
import { SpendHero } from "@/features/home/spend-hero";
import { HomeTopBar } from "@/features/home/top-bar";
import { TopCategories } from "@/features/home/top-categories";
import { UpcomingBills } from "@/features/home/upcoming-bills";
import { WeekCard } from "@/features/home/week-card";
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
import { HOME_CHAPTERS, type HomeSectionId } from "@/lib/home/layout";
import { spendOutlook } from "@/lib/home/safe-to-spend";
import { budgetPace, elapsedDays } from "@/lib/budgets/pace";

const RECENT_COUNT = 5;
/** Bills are looked up at least this far ahead, and always to the end of the month. */
const BILLS_WINDOW_DAYS = 30;
const STAGGER = { base: 200, step: 55 } as const;
/** Sections answering one question sit close; a new question gets room. */
const GAP_WITHIN = "mt-5";
const GAP_BETWEEN = "mt-10";

export default function Home() {
  const router = useRouter();
  const reveal = useScrollReveal();
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
  const outlook = spendOutlook({
    spent: overall?.spent ?? spend.spent,
    available: overall?.available ?? null,
    upcoming: overall?.upcoming ?? 0,
    daysLeft: diffDays(today, month.to) + 1,
    elapsedDays: elapsedDays(month, today),
    totalDays: elapsedDays(month, month.to),
  });
  const outlookText = !outlook
    ? undefined
    : outlook.type === "safe"
      ? `${fmt(outlook.perDay)} ${outlook.daysLeft === 1 ? "left for today" : `a day for ${outlook.daysLeft} days`}${outlook.afterBills ? ", after bills" : ""}`
      : outlook.type === "over"
        ? `${fmt(outlook.amount)} over budget${outlook.daysLeft > 1 ? ` with ${outlook.daysLeft} days to go` : ""}`
        : `On track for ${fmt(outlook.total)} by ${end.day} ${monthName(end.month)}`;

  const workTime = useWorkTime()(spend.spent);
  const outlookLine = [outlookText, workTime ? `About ${workTime} of work` : null]
    .filter(Boolean)
    .join("\n");
  const widgetSpent = fmt(spend.spent);
  const widgetLabel = `Spent in ${monthName(end.month)}`;
  React.useEffect(() => {
    updateWidget({ label: widgetLabel, spent: widgetSpent, outlook: outlookText ?? "" });
  }, [widgetLabel, widgetSpent, outlookText]);

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
      case "week":
        return spend.week.length > 0 ? (
          <WeekCard
            spend={spend}
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
        scrollEventThrottle={100}
        onScroll={reveal.onScroll}
      >
        <ScrollRevealProvider value={reveal.register}>
        {empty ? (
          <EmptyState
            icon="bill"
            title="No transactions yet"
            message="Add your first transaction to get started."
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
                outlook={outlookLine}
                locale={locale}
                showDecimals={money.showDecimals}
              />
            </View>
            {layout
              .filter((section) => section.visible)
              .flatMap((section) => {
                const content = renderSection(section.id);
                return content ? [{ id: section.id, content }] : [];
              })
              .map(({ id, content }, index, shown) => {
                const chapter = HOME_CHAPTERS[id];
                const opensChapter =
                  chapter !== HOME_CHAPTERS[shown[index - 1]?.id ?? id] ||
                  index === 0;
                return (
                  <Stagger
                    key={id}
                    index={index}
                    {...STAGGER}
                    className={opensChapter ? GAP_BETWEEN : GAP_WITHIN}
                  >
                    {opensChapter ? <HomeChapter title={chapter} /> : null}
                    <Reveal>{content}</Reveal>
                  </Stagger>
                );
              })}
          </>
        )}
        </ScrollRevealProvider>
      </ScrollView>
      <AddFab />
    </View>
  );
}
