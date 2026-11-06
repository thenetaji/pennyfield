import { useRouter, type Href } from "expo-router";
import { ScrollView, View } from "react-native";

import { useSettings, useTodayKey } from "@/data/hooks";
import { useAskAvailable } from "@/features/explore/ask-available";
import { monthParam } from "@/features/report/labels";
import { periodFor, previousPeriod } from "@studio/dates";
import { ListGroup, ListRow } from "@studio/ui";

type Item = { label: string; subtitle: string; icon: string; href: Href };

export function AdvancedScreen() {
  const router = useRouter();
  const canAsk = useAskAvailable();
  const settings = useSettings();
  const today = useTodayKey();
  const lastMonth = monthParam(
    previousPeriod(
      periodFor("month", today, { weekStart: settings.week_start, monthStart: settings.month_start }),
    ),
  );
  const groups: { header: string; items: Item[] }[] = [
    {
      header: "Plan",
      items: [
        { label: "Budgets", icon: "budgets", subtitle: "Monthly limits", href: "/advanced/budgets" },
        { label: "What if", icon: "salary", subtitle: "Forecast your balance", href: "/explore/what-if" },
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
        ...(canAsk
          ? [{ label: "Ask", icon: "info", subtitle: "Ask about your spending", href: "/explore/ask" as Href }]
          : []),
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
