import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import {
  Card,
  ListGroup,
  ListRow,
  OptionPicker,
  Pressable,
  Text,
  type Option,
} from "@studio/ui";
import {
  useAccounts,
  useCategories,
  useEntryCount,
  useSetting,
} from "@/data/hooks";
import { AppIcon } from "@studio/icons";
import { pressScale, useTokens } from "@studio/theme";
import { ordinal } from "@/features/budgets/logic";
import { moneyLocale } from "@/features/transactions/use-money-context";
import { formatMoney } from "@studio/money";
import Constants from "expo-constants";
import { APP_NAME } from "@/constants/app";
import { isDefaultHomeLayout } from "@/lib/home/layout";

type Picker = "week" | "month" | "account" | null;

const weekOptions: readonly Option<1 | 7>[] = [
  { value: 1, label: "Monday" },
  { value: 7, label: "Sunday" },
];

const monthOptions: readonly Option<number>[] = Array.from(
  { length: 28 },
  (_, i) => ({ value: i + 1, label: ordinal(i + 1) }),
);

const THEME_LABELS = { system: "Auto", light: "Light", dark: "Dark" };
const PALETTE_LABELS = {
  system: "System",
  titanium: "Titanium",
  paper: "Paper",
};

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 items-center gap-0.5">
      <Text variant="headline" numeric>
        {value.toLocaleString()}
      </Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

/** What the app holds, at a glance; opens About. */
function SummaryCard({ onPress }: { onPress: () => void }) {
  const { colors } = useTokens();
  const accounts = useAccounts();
  const categories = useCategories();
  const entries = useEntryCount();
  const version = Constants.expoConfig?.version ?? "";
  const detail = [
    plural(entries, "entry", "entries"),
    plural(accounts.length, "account", "accounts"),
    plural(categories.length, "category", "categories"),
  ].join(", ");
  return (
    <View className="px-4">
      <Pressable
        role="button"
        accessibilityLabel={`${APP_NAME} ${version}, ${detail}`}
        accessibilityHint="Opens About"
        scale={pressScale.row}
        onPress={onPress}
      >
        <Card className="px-4 pb-3.5 pt-4">
          <View className="flex-row items-center gap-3.5">
            <Image
              source={require("../../../assets/images/icon.png")}
              style={{ width: 54, height: 54, borderRadius: 13 }}
              accessibilityIgnoresInvertColors
            />
            <View className="min-w-0 flex-1 gap-0.5">
              <Text variant="title2" className="font-semibold">
                {APP_NAME}
              </Text>
              <View className="flex-row items-center gap-1">
                <AppIcon name="lock" size={11} color={colors.textTertiary} />
                <Text variant="footnote" tone="secondary" numberOfLines={1}>
                  Private, stored on this device
                </Text>
              </View>
            </View>
            <AppIcon
              name="chevron.right"
              size={13}
              color={colors.textTertiary}
            />
          </View>
          <View
            className="mt-3.5 flex-row pt-3"
            style={{
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.separator,
            }}
          >
            <Stat value={entries} label={entries === 1 ? "Entry" : "Entries"} />
            <Stat
              value={accounts.length}
              label={accounts.length === 1 ? "Account" : "Accounts"}
            />
            <Stat
              value={categories.length}
              label={categories.length === 1 ? "Category" : "Categories"}
            />
          </View>
        </Card>
      </Pressable>
    </View>
  );
}

export default function Settings() {
  const router = useRouter();
  const accounts = useAccounts();
  const [displayCurrency] = useSetting("display_currency");
  const [weekStart, setWeekStart] = useSetting("week_start");
  const [monthStart, setMonthStart] = useSetting("month_start");
  const [defaultAccountId, setDefaultAccountId] =
    useSetting("default_account_id");
  const [theme] = useSetting("theme");
  const [palette] = useSetting("palette");
  const [haptics, setHaptics] = useSetting("haptics");
  const [showDecimals, setShowDecimals] = useSetting("show_decimals");
  const [lockEnabled] = useSetting("lock_enabled");
  const [hideAmounts] = useSetting("hide_amounts");
  const [homeLayout] = useSetting("home_layout");
  const version = Constants.expoConfig?.version ?? "";
  const homeSummary = isDefaultHomeLayout(homeLayout) ? "Default" : "Custom";
  const [picker, setPicker] = React.useState<Picker>(null);
  const close = () => setPicker(null);
  const defaultAccount = accounts.find((a) => a.id === defaultAccountId);
  const accountOptions = React.useMemo<readonly Option<string | null>[]>(
    () => accounts.map((a) => ({ value: a.id, label: a.name })),
    [accounts],
  );
  const privacy = [lockEnabled && "Face ID", hideAmounts && "Hidden"]
    .filter(Boolean)
    .join(", ");

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-7 py-4 pb-16"
    >
      <SummaryCard onPress={() => router.push("/settings/about")} />

      <ListGroup header="Money">
        <ListRow
          label="Accounts"
          icon={{ name: "bank", color: "blue", vivid: true }}
          value={accounts.length > 0 ? String(accounts.length) : undefined}
          chevron
          onPress={() => router.push("/accounts")}
        />
        <ListRow
          label="Categories"
          icon={{ name: "grid", color: "orange", vivid: true }}
          chevron
          onPress={() => router.push("/settings/categories")}
        />
        <ListRow
          label="Recurring"
          icon={{ name: "repeat", color: "green", vivid: true }}
          chevron
          onPress={() => router.push("/recurring")}
        />
        <ListRow
          label="Subscriptions"
          icon={{ name: "membership", color: "pink", vivid: true }}
          chevron
          onPress={() => router.push("/subscriptions")}
        />
        <ListRow
          label="Tags"
          icon={{ name: "tag", color: "indigo", vivid: true }}
          chevron
          onPress={() => router.push("/tags")}
        />
        <ListRow
          label="People"
          icon={{ name: "family", color: "teal", vivid: true }}
          chevron
          onPress={() => router.push("/people")}
        />
      </ListGroup>

      <ListGroup header="Entering money">
        <ListRow
          label="Currency"
          icon={{ name: "dollar", color: "green", vivid: true }}
          value={displayCurrency}
          chevron
          onPress={() => router.push("/settings/currency")}
        />
        <ListRow
          label="Default account"
          icon={{ name: "wallet", color: "cyan", vivid: true }}
          value={defaultAccount?.name}
          chevron
          onPress={() => setPicker("account")}
        />
        <ListRow
          label="Show decimals"
          icon={{ name: "cash", color: "gray", vivid: true }}
          value={formatMoney(124000, displayCurrency, {
            locale: moneyLocale(displayCurrency),
            decimals: showDecimals ? undefined : 0,
          })}
          switchValue={showDecimals}
          onSwitchChange={setShowDecimals}
        />
      </ListGroup>

      <ListGroup
        header="Calendar"
        footer="Monthly totals and budgets restart on this day, so set it to your payday if you like."
      >
        <ListRow
          label="Week starts on"
          icon={{ name: "calendar", color: "red", vivid: true }}
          value={weekStart === 7 ? "Sunday" : "Monday"}
          chevron
          onPress={() => setPicker("week")}
        />
        <ListRow
          label="Month starts on"
          icon={{ name: "salary", color: "amber", vivid: true }}
          value={ordinal(monthStart)}
          chevron
          onPress={() => setPicker("month")}
        />
      </ListGroup>

      <ListGroup header="Look and feel">
        <ListRow
          label="Appearance"
          icon={{ name: "paintbrush", color: "purple", vivid: true }}
          value={`${PALETTE_LABELS[palette]}, ${THEME_LABELS[theme]}`}
          chevron
          onPress={() => router.push("/settings/appearance")}
        />
        <ListRow
          label="Home screen"
          icon={{ name: "home", color: "indigo", vivid: true }}
          value={homeSummary}
          chevron
          onPress={() => router.push("/settings/home")}
        />
        <ListRow
          label="Haptics"
          icon={{ name: "phone", color: "gray", vivid: true }}
          switchValue={haptics}
          onSwitchChange={setHaptics}
        />
      </ListGroup>

      <ListGroup header="Privacy and reminders">
        <ListRow
          label="Face ID and privacy"
          icon={{ name: "faceid", color: "green", vivid: true }}
          value={privacy || "Off"}
          chevron
          onPress={() => router.push("/settings/privacy")}
        />
        <ListRow
          label="Reminders"
          icon={{ name: "bell", color: "red", vivid: true }}
          chevron
          onPress={() => router.push("/settings/reminders")}
        />
      </ListGroup>

      <ListGroup
        header="Your data"
        footer="Nothing leaves this device unless you back it up or export it."
      >
        <ListRow
          label="Backup and sync"
          icon={{ name: "cloud", color: "blue", vivid: true }}
          chevron
          onPress={() => router.push("/settings/backup")}
        />
        <ListRow
          label="Import and export"
          icon={{ name: "share", color: "teal", vivid: true }}
          chevron
          onPress={() => router.push("/settings/transfer")}
        />
      </ListGroup>

      <ListGroup>
        <ListRow
          label="About"
          icon={{ name: "info", color: "gray", vivid: true }}
          value={version}
          chevron
          onPress={() => router.push("/settings/about")}
        />
      </ListGroup>

      <OptionPicker
        visible={picker === "week"}
        title="Week starts on"
        options={weekOptions}
        selected={weekStart}
        onSelect={setWeekStart}
        onClose={close}
      />
      <OptionPicker
        visible={picker === "month"}
        title="Month starts on"
        options={monthOptions}
        selected={monthStart}
        onSelect={setMonthStart}
        onClose={close}
      />
      <OptionPicker
        visible={picker === "account"}
        title="Default account"
        options={accountOptions}
        selected={defaultAccountId}
        onSelect={(id) => {
          if (id !== null) setDefaultAccountId(id);
        }}
        onClose={close}
      />
    </ScrollView>
  );
}
