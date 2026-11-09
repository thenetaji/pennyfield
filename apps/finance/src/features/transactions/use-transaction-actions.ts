import { useRouter } from "expo-router";
import { useMemo } from "react";
import { ActionSheetIOS, Alert, Platform } from "react-native";

import { showToast } from "@studio/ui";
import { useActions } from "@/data/actions";
import { recentCategories } from "@/data/hooks/useRecentCategories";
import { listAccounts } from "@/db/repos/accounts";
import { getTransaction } from "@/db/repos/transactionQueries";
import type { TransactionListItem } from "@/db/repos/transactions";
import { useDb } from "@/db/context";
import { normaliseTitle } from "@/lib/insights";
import { transactions } from "@/db/schema";
import { toDateKey } from "@studio/dates";
import { collapseThen } from "@studio/motion";
import { sql } from "drizzle-orm";

import { inputFromItem, quickActionsFor } from "./quick-edit";

export interface TransactionActions {
  open: (id: string) => void;
  edit: (id: string) => void;
  duplicate: (id: string) => void;
  /** Deletes and shows the undo toast. */
  remove: (id: string) => boolean;
  /** Prompts for a new memo in place (iOS); elsewhere opens the editor. */
  editMemo: (id: string) => void;
  /** Every payment to the same merchant, all time. */
  openMerchant: (item: TransactionListItem) => void;
  /** Native action menu: edit, memo, category, account, merchant, duplicate, delete. */
  menu: (id: string) => void;
}

type Choice = { label: string; run: () => void; destructive?: boolean };

/** An action sheet on iOS, an alert elsewhere (Android shows at most three buttons). */
function choose(title: string | undefined, choices: readonly Choice[]) {
  if (Platform.OS === "ios") {
    const destructive = choices.findIndex((c) => c.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...choices.map((c) => c.label), "Cancel"],
        destructiveButtonIndex: destructive >= 0 ? destructive : undefined,
        cancelButtonIndex: choices.length,
      },
      (index) => choices[index]?.run(),
    );
    return;
  }
  Alert.alert(title ?? "Transaction", undefined, [
    ...choices.map((c) => ({
      text: c.label,
      style: c.destructive ? ("destructive" as const) : undefined,
      onPress: c.run,
    })),
    { text: "Cancel", style: "cancel" as const },
  ]);
}

const QUICK_CATEGORIES = 6;

/** Stable navigation and write handlers shared by every transaction list and the detail screen. */
export function useTransactionActions(): TransactionActions {
  const router = useRouter();
  const actions = useActions();
  const db = useDb();
  return useMemo(() => {
    const open = (id: string) =>
      router.push({ pathname: "/transaction/[id]", params: { id } });
    const edit = (id: string) =>
      router.push({ pathname: "/transaction/[id]/edit", params: { id } });
    const duplicate = (id: string) =>
      router.push({
        pathname: "/transaction/new",
        params: { duplicateOf: id },
      });
    const remove = (id: string): boolean =>
      !!collapseThen(id, () => removeNow(id));
    const removeNow = (id: string) => {
      const snapshot = actions.transactions.delete(id);
      if (!snapshot) return false;
      showToast({
        message: "Deleted",
        actionLabel: "Undo",
        onAction: () => actions.transactions.restore(snapshot),
      });
      return true;
    };
    const update = (
      item: TransactionListItem,
      patch: Parameters<typeof inputFromItem>[1],
      message: string,
    ) => {
      actions.transactions.update(item.id, inputFromItem(item, patch));
      showToast({
        message,
        actionLabel: "Undo",
        onAction: () =>
          actions.transactions.update(item.id, inputFromItem(item, {})),
      });
    };
    const editMemo = (id: string) => {
      const item = getTransaction(db, id);
      if (!item) return;
      if (Platform.OS !== "ios") {
        edit(id);
        return;
      }
      Alert.prompt(
        item.memo ? "Edit note" : "Add a note",
        item.title || undefined,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: (text?: string) => {
              const memo = (text ?? "").trim();
              if (memo !== item.memo.trim())
                update(item, { memo }, memo ? "Note saved" : "Note removed");
            },
          },
        ],
        "plain-text",
        item.memo,
      );
    };
    const openMerchant = (item: TransactionListItem) => {
      const today = toDateKey(Date.now());
      const oldest =
        db
          .select({ min: sql<string | null>`min(${transactions.dateKey})` })
          .from(transactions)
          .get()?.min ?? item.dateKey;
      router.push({
        pathname: "/payee",
        params: {
          from: oldest,
          to: today > item.dateKey ? today : item.dateKey,
          type: "custom",
          kind: item.kind === "income" ? "income" : "expense",
          key: normaliseTitle(item.title),
          title: item.title.trim(),
        },
      });
    };
    const pickCategory = (item: TransactionListItem) => {
      const kind = item.kind === "income" ? "income" : "expense";
      const options = recentCategories(db, kind, QUICK_CATEGORIES + 1)
        .filter((c) => c.id !== item.categoryId)
        .slice(0, QUICK_CATEGORIES);
      choose("Category", [
        ...options.map((c) => ({
          label: c.name,
          run: () => update(item, { categoryId: c.id }, `Moved to ${c.name}`),
        })),
        { label: "Other…", run: () => edit(item.id) },
      ]);
    };
    const pickAccount = (item: TransactionListItem) => {
      // Another currency would change what the amount means, so only same-currency accounts are offered.
      const options = listAccounts(db).filter(
        (a) =>
          a.id !== item.accountId &&
          a.id !== item.transferAccountId &&
          a.currency === item.currency,
      );
      if (options.length === 0) {
        edit(item.id);
        return;
      }
      choose(
        "Account",
        options.map((a) => ({
          label: a.name,
          run: () => update(item, { accountId: a.id }, `Moved to ${a.name}`),
        })),
      );
    };
    const menu = (id: string) => {
      const item = getTransaction(db, id);
      if (!item) return;
      const can = quickActionsFor(item);
      const choices: Choice[] = [
        { label: "Edit", run: () => edit(id) },
        { label: item.memo.trim() ? "Edit note" : "Add note", run: () => editMemo(id) },
      ];
      if (can.category)
        choices.push({ label: "Change category", run: () => pickCategory(item) });
      if (can.account)
        choices.push({ label: "Move to account", run: () => pickAccount(item) });
      if (can.merchant)
        choices.push({
          label: `All from ${item.title.trim()}`,
          run: () => openMerchant(item),
        });
      choices.push(
        { label: "Duplicate", run: () => duplicate(id) },
        { label: "Delete", run: () => remove(id), destructive: true },
      );
      choose(undefined, choices);
    };
    return { open, edit, duplicate, remove, editMemo, openMerchant, menu };
  }, [router, actions, db]);
}
