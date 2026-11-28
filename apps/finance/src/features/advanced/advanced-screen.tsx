import { useRouter, type Href } from "expo-router";
import { ScrollView, View } from "react-native";

import { useAccounts, useSetting, useSettings, useTodayKey, useYearStart } from "@/data/hooks";
import { yearName, yearOf } from "@/lib/reports";
import { monthParam } from "@/features/report/labels";
import { periodFor, previousPeriod } from "@studio/dates";
import { ListGroup, ListRow } from "@studio/ui";

type Item = { label: string; subtitle: string; icon: string; href: Href };

export function AdvancedScreen() {
  const router = useRouter();
  const settings = useSettings();
  const today = useTodayKey();
  const yearStart = useYearStart();
  const lastYear = yearOf(today, yearStart) - 1;
  const lastMonth = monthParam(
    previousPeriod(
      periodFor("month", today, { weekStart: settings.week_start, monthStart: settings.month_start }),
    ),
  );
  const accounts = useAccounts();
  const [fundingMain] = useSetting("funding_main_account_id");
  const topUp = accounts.find((a) => a.id === fundingMain)?.name ?? "Off";
  const groups: { header: string; items: Item[] }[] = [
    {
      header: "Plan",
      items: [
        { label: "Income growth", icon: "chart.line.uptrend.xyaxis", subtitle: "Month by month, year by year", href: "/advanced/income" as Href },
        { label: "Budgets", icon: "budgets", subtitle: "Monthly limits", href: "/advanced/budgets" },
        { label: "What if", icon: "salary", subtitle: "Forecast your balance", href: "/explore/what-if" },
      ],
    },
    {
      header: "Data",
      items: [
        { label: "Accounts", icon: "building.columns.fill", subtitle: "Banks, cards and cash", href: "/accounts" },
        { label: "Auto top-up", icon: "arrow.left.arrow.right", subtitle: topUp, href: "/settings/top-up" },
        { label: "Categories", icon: "square.grid.2x2", subtitle: "Groups for spending", href: "/settings/categories" },
        { label: "Recurring", icon: "repeat", subtitle: "Bills and salary", href: "/recurring" },
        { label: "Subscriptions", icon: "creditcard.fill", subtitle: "Memberships", href: "/subscriptions" },
        { label: "Tags", icon: "tag.fill", subtitle: "Labels", href: "/tags" },
        { label: "People", icon: "person.2.fill", subtitle: "Lending and borrowing", href: "/people" },
      ],
    },
    {
      header: "Review",
      items: [
        { label: "Money map", icon: "grid", subtitle: "Spending by category", href: "/explore/map" },
        {
          label: "Monthly recap",
          icon: "calendar",
          subtitle: "Last month's summary",
          href: { pathname: "/recap/[month]", params: { month: lastMonth } },
        },
        {
          label: "Year in review",
          icon: "sparkles",
          subtitle: yearName(lastYear, yearStart),
          href: { pathname: "/review/[year]", params: { year: String(lastYear) } },
        },
        { label: "Ask", icon: "info", subtitle: "Ask about your money", href: "/explore/ask" as Href },
      ],
    },
  ];
  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-7 pb-16 pt-2"
      >
        {groups.map((group) => (
          <ListGroup key={group.header} header={group.header}>
            {group.items.map((item) => (
              <ListRow
                key={item.label}
                label={item.label}
                subtitle={item.subtitle}
                icon={{ name: item.icon, color: "blue" }}
                chevron
                onPress={() => router.push(item.href)}
              />
            ))}
          </ListGroup>
        ))}
      </ScrollView>
    </View>
  );
}
