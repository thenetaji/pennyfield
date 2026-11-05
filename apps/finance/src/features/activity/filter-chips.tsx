import { ScrollView } from "react-native";

import { Chip, Pressable, Text } from "@studio/ui";
import { useAccounts, useCategories } from "@/data/hooks";
import type { TransactionKind } from "@/db/schema";

import { formatMoney, minorDigits } from "@studio/money";
import { haptic } from "@studio/theme";

import { nextAmountStep, useActivityFilters } from "./filter-store";

const KIND_LABEL: Record<TransactionKind, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  lent: "Lent",
  borrowed: "Borrowed",
  repaid_to_me: "Repaid to me",
  repaid_by_me: "Repaid by me",
};

const QUICK_KINDS = ["expense", "income"] as const;

/** Quick filters (type, memo, amount) plus any filter set in the sheet; Clear when something is on. */
function FilterChips({ currency, locale }: { currency: string; locale?: string }) {
  const kinds = useActivityFilters((s) => s.kinds);
  const categoryId = useActivityFilters((s) => s.categoryId);
  const accountId = useActivityFilters((s) => s.accountId);
  const memoOnly = useActivityFilters((s) => s.memoOnly);
  const minAmount = useActivityFilters((s) => s.minAmount);
  const toggleMemo = useActivityFilters((s) => s.toggleMemo);
  const setMinAmount = useActivityFilters((s) => s.setMinAmount);
  const toggleKind = useActivityFilters((s) => s.toggleKind);
  const setCategory = useActivityFilters((s) => s.setCategory);
  const setAccount = useActivityFilters((s) => s.setAccount);
  const clear = useActivityFilters((s) => s.clear);
  const categories = useCategories();
  const accounts = useAccounts({ includeArchived: true });

  const category = categoryId
    ? categories.find((c) => c.id === categoryId)
    : undefined;
  const account = accountId
    ? accounts.find((a) => a.id === accountId)
    : undefined;
  const any =
    kinds.length > 0 || !!category || !!account || memoOnly || minAmount !== null;
  const amountLabel = `Over ${formatMoney((minAmount ?? nextAmountStep(null) ?? 0) * 10 ** minorDigits(currency), currency, { locale, sign: "none", decimals: 0 })}`;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="items-center gap-2 px-4 py-1"
      keyboardShouldPersistTaps="handled"
    >
      {QUICK_KINDS.map((kind) => (
        <Chip
          key={kind}
          label={KIND_LABEL[kind]}
          selected={kinds.includes(kind)}
          onPress={() => {
            haptic("selection");
            toggleKind(kind);
          }}
        />
      ))}
      {kinds
        .filter((kind) => !(QUICK_KINDS as readonly string[]).includes(kind))
        .map((kind) => (
          <Chip
            key={kind}
            label={KIND_LABEL[kind]}
            selected
            onPress={() => toggleKind(kind)}
          />
        ))}
      <Chip
        label="With memo"
        selected={memoOnly}
        onPress={() => {
          haptic("selection");
          toggleMemo();
        }}
      />
      <Chip
        label={amountLabel}
        selected={minAmount !== null}
        onPress={() => {
          haptic("selection");
          setMinAmount(nextAmountStep(minAmount));
        }}
      />
      {category ? (
        <Chip
          label={category.name}
          icon={category.icon}
          selected
          onPress={() => setCategory(null)}
        />
      ) : null}
      {account ? (
        <Chip
          label={account.name}
          icon={account.icon}
          selected
          onPress={() => setAccount(null)}
        />
      ) : null}
      {any ? (
      <Pressable
        role="button"
        scale={1}
        dimTo={0.6}
        onPress={clear}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className="h-8 justify-center px-2"
      >
        <Text variant="callout" tone="accent">
          Clear
        </Text>
      </Pressable>
      ) : null}
    </ScrollView>
  );
}

export { FilterChips };
