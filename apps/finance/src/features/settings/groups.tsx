import type { Href } from "expo-router";

import { useAccounts, useSetting } from "@/data/hooks";
import type { RowDetail, SettingsStyle } from "@/db/repos/settings";
import { backupTimeLabel } from "@/features/backup/format";
import { ordinal } from "@/features/budgets/logic";
import { moneyLocale } from "@/features/transactions/use-money-context";
import { isDefaultHomeLayout } from "@/lib/home/layout";
import { formatMoney } from "@studio/money";
import type { Option } from "@studio/ui";
import Constants from "expo-constants";

export type GroupId = "money" | "entry" | "calendar" | "look" | "privacy" | "data";

export type SettingRow = {
  key: string;
  label: string;
  /** Other words people search for it by. */
  words?: string;
  value?: string;
  href?: Href;
  picker?: PickerId;
  toggle?: { value: boolean; onChange: (next: boolean) => void };
  /** Replaced by a field on the page. */
  custom?: "hourly_pay" | "settings_style";
};

export type SettingGroup = {
  id: GroupId;
  title: string;
  summary: string;
  /** Folded behind an info button. */
  note?: string;
  rows: SettingRow[];
};

export type PickerId = "week" | "month" | "account" | "rows";

const ROW_LABELS: Record<RowDetail, string> = {
  memo: "Memo",
  category: "Category",
  category_memo: "Category, memo",
  category_account: "Category, account",
};

export const ROW_OPTIONS: readonly Option<RowDetail>[] = [
  { value: "memo", label: "Memo, or category when there is none" },
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
export const STYLE_LABELS: Record<SettingsStyle, string> = {
  calm: "Calm",
  glass: "Glass",
  list: "List",
};

const THEME_LABELS = { system: "Auto", light: "Light", dark: "Dark" };
const PALETTE_LABELS = { system: "System", titanium: "Titanium", paper: "Paper" };

/** Every Settings row, in one place, so each style and the search show the same things. */
export function useSettingGroups(): SettingGroup[] {
  const accounts = useAccounts();
  const [displayCurrency] = useSetting("display_currency");
  const [weekStart] = useSetting("week_start");
  const [monthStart] = useSetting("month_start");
  const [defaultAccountId] = useSetting("default_account_id");
  const [theme] = useSetting("theme");
  const [palette] = useSetting("palette");
  const [haptics, setHaptics] = useSetting("haptics");
  const [showDecimals, setShowDecimals] = useSetting("show_decimals");
  const [lockEnabled] = useSetting("lock_enabled");
  const [hideAmounts] = useSetting("hide_amounts");
  const [homeLayout] = useSetting("home_layout");
  const [rowDetail] = useSetting("row_detail");
  const [lastBackup] = useSetting("last_backup_at");
  const [style] = useSetting("settings_style");

  const look = `${PALETTE_LABELS[palette]}, ${THEME_LABELS[theme]}`;
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
      id: "money",
      title: "Money",
      summary: "Accounts, categories, recurring and more",
      rows: [
        {
          key: "accounts",
          label: "Accounts",
          words: "bank card cash wallet balance",
          value: accounts.length > 0 ? String(accounts.length) : undefined,
          href: "/accounts",
        },
        { key: "categories", label: "Categories", words: "groups", href: "/settings/categories" },
        { key: "recurring", label: "Recurring", words: "bills salary rent repeat", href: "/recurring" },
        { key: "subscriptions", label: "Subscriptions", words: "membership", href: "/subscriptions" },
        { key: "tags", label: "Tags", words: "labels", href: "/tags" },
        { key: "people", label: "People", words: "lending borrow owe family friends", href: "/people" },
      ],
    },
    {
      id: "entry",
      title: "Entering money",
      summary: displayCurrency,
      rows: [
        {
          key: "currency",
          label: "Currency",
          words: "exchange rate display fx",
          value: displayCurrency,
          href: "/settings/currency",
        },
        {
          key: "default_account",
          label: "Default account",
          value: accounts.find((a) => a.id === defaultAccountId)?.name,
          picker: "account",
        },
        {
          key: "decimals",
          label: "Show decimals",
          words: "cents paise rounding",
          value: sample,
          toggle: { value: showDecimals, onChange: setShowDecimals },
        },
        {
          key: "rows",
          label: "Transaction rows",
          words: "memo subtitle second line",
          value: ROW_LABELS[rowDetail],
          picker: "rows",
        },
      ],
    },
    {
      id: "calendar",
      title: "Calendar and time",
      summary: `Month starts on the ${ordinal(monthStart)}`,
      note: "Monthly totals and budgets restart on the month's first day, so set it to your payday if you like. Hourly pay shows what things cost in hours of work; it stays on this device.",
      rows: [
        {
          key: "week",
          label: "Week starts on",
          value: weekStart === 7 ? "Sunday" : "Monday",
          picker: "week",
        },
        {
          key: "month",
          label: "Month starts on",
          words: "payday salary",
          value: ordinal(monthStart),
          picker: "month",
        },
        {
          key: "hourly",
          label: "Hourly pay",
          words: "work hours wage salary time cost",
          custom: "hourly_pay",
        },
      ],
    },
    {
      id: "look",
      title: "Look and feel",
      summary: look,
      rows: [
        {
          key: "appearance",
          label: "Appearance",
          words: "theme dark light color colour icon accent palette",
          value: look,
          href: "/settings/appearance",
        },
        {
          key: "home",
          label: "Home screen",
          words: "reorder sections layout",
          value: isDefaultHomeLayout(homeLayout) ? "Default" : "Custom",
          href: "/settings/home",
        },
        {
          key: "haptics",
          label: "Haptics",
          words: "vibration buzz",
          toggle: { value: haptics, onChange: setHaptics },
        },
        {
          key: "style",
          label: "Settings style",
          words: "calm glass list layout this page",
          value: STYLE_LABELS[style],
          custom: "settings_style",
        },
      ],
    },
    {
      id: "privacy",
      title: "Privacy and reminders",
      summary: privacy,
      rows: [
        {
          key: "privacy",
          label: "Face ID and privacy",
          words: "lock passcode hide amounts",
          value: privacy,
          href: "/settings/privacy",
        },
        {
          key: "reminders",
          label: "Reminders",
          words: "notifications alerts daily",
          href: "/settings/reminders",
        },
      ],
    },
    {
      id: "data",
      title: "Your data",
      summary: backedUp ? `Backed up ${backedUp}` : "Not backed up yet",
      note: "Nothing leaves this device unless you back it up or export it.",
      rows: [
        {
          key: "backup",
          label: "Backup and sync",
          words: "icloud drive restore",
          value: backedUp,
          href: "/settings/backup",
        },
        {
          key: "transfer",
          label: "Import and export",
          words: "csv spreadsheet erase delete",
          href: "/settings/transfer",
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
