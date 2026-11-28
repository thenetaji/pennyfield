import type { Href } from "expo-router";

import type { AccentPresetKey } from "@studio/theme";
import { useAccounts, useSetting } from "@/data/hooks";
import type { RowDetail } from "@/db/repos/settings";
import { backupTimeLabel } from "@/features/backup/format";
import { ordinal } from "@/features/budgets/logic";
import { moneyLocale } from "@/features/transactions/use-money-context";
import { isDefaultHomeLayout } from "@/lib/home/layout";
import { formatMoney } from "@studio/money";
import type { Option } from "@studio/ui";
import Constants from "expo-constants";
import { useAmountsHidden } from "@/features/privacy/use-amounts-hidden";

export type GroupId = "general" | "app" | "help" | "more";

export type SettingRow = {
  key: string;
  label: string;
  /** Symbol drawn on the row's tile. */
  icon: string;
  /** Other words people search for it by. */
  words?: string;
  value?: string;
  href?: Href;
  picker?: PickerId;
  toggle?: { value: boolean; onChange: (next: boolean) => void };
  /** Replaced by a field on the page. */
  custom?: "hourly_pay" | "accent";
};

export type SettingGroup = {
  id: GroupId;
  title: string;
  /** Folded behind an info button. */
  note?: string;
  rows: SettingRow[];
};

export type PickerId = "week" | "month" | "account" | "rows" | "archive";

const ROW_LABELS: Record<RowDetail, string> = {
  memo: "Note",
  category: "Category",
  category_memo: "Category, memo",
  category_account: "Category, account",
};

export const ROW_OPTIONS: readonly Option<RowDetail>[] = [
  { value: "memo", label: "Note or category" },
  { value: "category", label: "Category" },
  { value: "category_memo", label: "Category and memo" },
  { value: "category_account", label: "Category and account" },
];
export const WEEK_OPTIONS: readonly Option<1 | 7>[] = [
  { value: 1, label: "Monday" },
  { value: 7, label: "Sunday" },
];
export const MONTH_OPTIONS: readonly Option<number>[] = Array.from(
  { length: 28 },
  (_, i) => ({ value: i + 1, label: ordinal(i + 1) }),
);

const THEME_LABELS = { system: "Auto", light: "Light", dark: "Dark" };
const ACCENT_LABELS: Record<AccentPresetKey, string> = {
  violet: "Violet",
  emerald: "Emerald",
  blue: "Blue",
  teal: "Teal",
  plum: "Plum",
  bronze: "Bronze",
  ivory: "Ink",
};

/** Every Settings row, in one place, so the list, More and the search show the same things. */
export function useSettingGroups(): SettingGroup[] {
  const accounts = useAccounts();
  const [displayCurrency] = useSetting("display_currency");
  const [weekStart] = useSetting("week_start");
  const [monthStart] = useSetting("month_start");
  const [defaultAccountId] = useSetting("default_account_id");
  const [archivedThrough] = useSetting("archived_through");
  const [theme] = useSetting("theme");
  const [accent] = useSetting("accent");
  const [haptics, setHaptics] = useSetting("haptics");
  const [showDecimals, setShowDecimals] = useSetting("show_decimals");
  const [lockEnabled] = useSetting("lock_enabled");
  const [hideAmounts] = useAmountsHidden();
  const [homeLayout] = useSetting("home_layout");
  const [rowDetail] = useSetting("row_detail");
  const [lastBackup] = useSetting("last_backup_at");

  const look = `${ACCENT_LABELS[accent]}, ${THEME_LABELS[theme]}`;
  const privacy =
    [lockEnabled && "Face ID", hideAmounts && "Hidden"]
      .filter(Boolean)
      .join(", ") || "App lock off";
  const backedUp = lastBackup ? backupTimeLabel(lastBackup) : undefined;
  const sample = formatMoney(124000, displayCurrency, {
    locale: moneyLocale(displayCurrency),
    decimals: showDecimals ? undefined : 0,
  });

  return [
    {
      id: "general",
      title: "General",
      rows: [
        {
          key: "currency",
          icon: "banknote.fill",
          label: "Currency",
          words: "exchange rate display fx",
          value: displayCurrency,
          href: "/settings/currency",
        },
        {
          key: "default_account",
          icon: "creditcard.fill",
          label: "Default account",
          value: accounts.find((a) => a.id === defaultAccountId)?.name,
          picker: "account",
        },
        {
          key: "month",
          icon: "calendar",
          label: "Month starts on",
          words: "payday salary",
          value: ordinal(monthStart),
          picker: "month",
        },
      ],
    },
    {
      id: "app",
      title: "App",
      rows: [
        {
          key: "accent",
          icon: "paintbrush.fill",
          label: "Colour",
          words: "theme color colour accent violet emerald blue teal",
          custom: "accent",
        },
        {
          key: "appearance",
          icon: "sparkles",
          label: "Appearance",
          words: "theme dark light color colour icon accent palette",
          value: look,
          href: "/settings/appearance",
        },
        {
          key: "privacy",
          icon: "faceid",
          label: "Face ID and privacy",
          words: "lock passcode hide amounts",
          value: privacy,
          href: "/settings/privacy",
        },
        {
          key: "backup",
          icon: "square.and.arrow.down",
          label: "Backup",
          words: "icloud drive restore sync csv spreadsheet import export erase delete",
          value: backedUp,
          href: "/settings/backup",
        },
      ],
    },
    {
      id: "help",
      title: "Help",
      rows: [
        { key: "more", icon: "ellipsis.circle.fill", label: "More settings", words: "decimals week haptics hourly reminders archive", href: "/settings/more" },
        { key: "guide", icon: "questionmark.circle.fill", label: "How it works", words: "help tips guide title category tag", href: "/guide" },
        { key: "about", icon: "info.circle", label: "About", value: appVersion(), href: "/settings/about" },
      ],
    },
    {
      id: "more",
      title: "More",
      note: "Set the month start to your payday to match your pay cycle. Add hourly pay to see costs in hours of work.",
      rows: [
        {
          key: "decimals",
          icon: "percent",
          label: "Show decimals",
          words: "cents paise rounding",
          value: sample,
          toggle: { value: showDecimals, onChange: setShowDecimals },
        },
        {
          key: "rows",
          icon: "list.bullet.rectangle.fill",
          label: "Under each transaction",
          words: "transaction rows memo subtitle second line",
          value: ROW_LABELS[rowDetail],
          picker: "rows",
        },
        {
          key: "week",
          icon: "calendar",
          label: "Week starts on",
          value: weekStart === 7 ? "Sunday" : "Monday",
          picker: "week",
        },
        {
          key: "hourly",
          icon: "clock",
          label: "Hourly pay",
          words: "work hours wage salary time cost",
          custom: "hourly_pay",
        },
        {
          key: "haptics",
          icon: "iphone",
          label: "Haptics",
          words: "vibration buzz",
          toggle: { value: haptics, onChange: setHaptics },
        },
        {
          key: "home",
          icon: "house.fill",
          label: "Home screen",
          words: "reorder sections layout",
          value: isDefaultHomeLayout(homeLayout) ? "Default" : "Custom",
          href: "/settings/home",
        },
        {
          key: "reminders",
          icon: "bell.fill",
          label: "Reminders",
          words: "notifications alerts daily",
          href: "/settings/reminders",
        },
        {
          key: "archive",
          icon: "tray",
          label: "Archive",
          words: "year close new year financial reset",
          value: archivedThrough ? `Up to ${archivedThrough}` : "Off",
          picker: "archive",
        },
      ],
    },
  ];
}

export const appVersion = () => Constants.expoConfig?.version ?? "";

/** Rows whose label, words or group match every word typed. */
export function searchRows(
  groups: readonly SettingGroup[],
  query: string,
): { group: SettingGroup; row: SettingRow }[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return groups.flatMap((group) =>
    group.rows
      .filter((row) => {
        const text = `${row.label} ${row.words ?? ""} ${group.title}`.toLowerCase();
        return terms.every((term) => text.includes(term));
      })
      .map((row) => ({ group, row })),
  );
}
