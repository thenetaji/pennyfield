import { useRouter, type Href } from "expo-router";
import { ScrollView, View } from "react-native";

import { useSettings, useTodayKey } from "@/data/hooks";
import { monthParam } from "@/features/report/labels";
import { periodFor, previousPeriod } from "@studio/dates";
import { ListGroup, ListRow } from "@studio/ui";

import { useAskAvailable } from "./ask-available";
import { useChart3DAvailable } from "../../../modules/finance-chart3d";

type Item = { label: string; subtitle: string; icon: string; href: Href };

export default function ExploreHub() {
  const router = useRouter();
  const canAsk = useAskAvailable();
  const has3D = useChart3DAvailable();
  const settings = useSettings();
  const today = useTodayKey();
  const lastMonth = monthParam(
    previousPeriod(
      periodFor("month", today, { weekStart: settings.week_start, monthStart: settings.month_start }),
    ),
  );
  const groups: { header: string; items: Item[] }[] = [
    {
      header: "See it",
      items: [
        { label: "Money map", icon: "grid", subtitle: "Every category as a tile", href: "/explore/map" },
        { label: "Year spiral", icon: "calendar", subtitle: "Every day, one turn a year", href: "/explore/spiral" },
        { label: "Every transaction", icon: "activity", subtitle: "Your spending as moving particles", href: "/explore/particles" },
        ...(has3D
          ? [{ label: "3D spending", icon: "square.grid.2x2", subtitle: "Weeks and amounts you can turn", href: "/explore/three-d" as Href }]
          : []),
      ],
    },
    {
      header: "Try it",
      items: [
        { label: "What if", icon: "salary", subtitle: "See where your spending leads", href: "/explore/what-if" },
        ...(canAsk
          ? [{ label: "Ask your money", icon: "info", subtitle: "Answered on this phone", href: "/explore/ask" as Href }]
          : []),
      ],
    },
    {
      header: "Feel it",
      items: [
        { label: "Liquid budgets", icon: "budgets", subtitle: "Budgets that tilt with your phone", href: "/explore/liquid" },
        { label: "Coin jar", icon: "savings", subtitle: "Savings as coins you can shake", href: "/explore/jar" },
      ],
    },
    {
      header: "Share it",
      items: [
        { label: "Your year as a poster", icon: "paintbrush", subtitle: "Art drawn from your own spending", href: "/explore/poster" },
        {
          label: "Monthly recap",
          icon: "share",
          subtitle: "Last month as a short story",
          href: { pathname: "/recap/[month]", params: { month: lastMonth } },
        },
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
                icon={{ name: item.icon, color: "gray" }}
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
