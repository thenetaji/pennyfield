import type { TransactionListItem } from "@/data/hooks";
import type { TransactionInput } from "@/db/repos/transactions";

type QuickPatch = Partial<
  Pick<TransactionInput, "memo" | "categoryId" | "accountId" | "side">
>;

/** The full write input for an existing transaction with one field changed; tags are left as they are. */
export function inputFromItem(
  item: TransactionListItem,
  patch: QuickPatch,
): TransactionInput {
  const split = item.splits.length > 1;
  return {
    kind: item.kind,
    title: item.title,
    memo: item.memo,
    amount: item.amount,
    accountId: item.accountId,
    categoryId: split ? null : item.categoryId,
    splits: split
      ? item.splits.map((s) => ({ categoryId: s.category.id, amount: s.amount }))
      : undefined,
    transferAccountId: item.transferAccountId,
    transferAmount: item.transferAmount,
    occurredAt: item.occurredAt,
    recurringRuleId: item.recurringRuleId,
    personId: item.personId,
    side: item.side,
    ...patch,
  };
}

/** Which quick actions make sense for this row. */
export function quickActionsFor(item: TransactionListItem) {
  const plain = item.kind === "expense" || item.kind === "income";
  return {
    category: plain && item.splits.length <= 1,
    account: item.kind !== "transfer",
    merchant: plain && item.title.trim() !== "",
  };
}
