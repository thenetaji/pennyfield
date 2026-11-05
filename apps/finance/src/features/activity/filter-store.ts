import { create } from "zustand";

import type { TransactionKind } from "@/db/schema";

type ActivityFilterState = {
  kinds: TransactionKind[];
  categoryId: string | null;
  accountId: string | null;
  /** Only transactions with a memo. */
  memoOnly: boolean;
  /** Only amounts at least this, in whole units of the display currency. */
  minAmount: number | null;
  /** The period Activity is showing, published by the screen so the sheet can count matches. */
  period: { from: string; to: string };
  setPeriod: (period: { from: string; to: string }) => void;
  toggleKind: (kind: TransactionKind) => void;
  setCategory: (id: string | null) => void;
  setAccount: (id: string | null) => void;
  toggleMemo: () => void;
  setMinAmount: (value: number | null) => void;
  clear: () => void;
};

/** Activity filters live outside the screen so the filter sheet and the chip row share them. */
export const useActivityFilters = create<ActivityFilterState>((set) => ({
  kinds: [],
  categoryId: null,
  accountId: null,
  memoOnly: false,
  minAmount: null,
  period: { from: "0000-01-01", to: "9999-12-31" },
  setPeriod: (period) =>
    set((s) =>
      s.period.from === period.from && s.period.to === period.to
        ? s
        : { period },
    ),
  toggleKind: (kind) =>
    set((s) => ({
      kinds: s.kinds.includes(kind)
        ? s.kinds.filter((k) => k !== kind)
        : [...s.kinds, kind],
    })),
  setCategory: (categoryId) => set({ categoryId }),
  setAccount: (accountId) => set({ accountId }),
  toggleMemo: () => set((s) => ({ memoOnly: !s.memoOnly })),
  setMinAmount: (minAmount) => set({ minAmount }),
  clear: () =>
    set({
      kinds: [],
      categoryId: null,
      accountId: null,
      memoOnly: false,
      minAmount: null,
    }),
}));

export function activeFilterCount(
  state: Pick<ActivityFilterState, "kinds" | "categoryId" | "accountId"> &
    Partial<Pick<ActivityFilterState, "memoOnly" | "minAmount">>,
): number {
  return (
    state.kinds.length +
    (state.categoryId ? 1 : 0) +
    (state.accountId ? 1 : 0) +
    (state.memoOnly ? 1 : 0) +
    (state.minAmount ? 1 : 0)
  );
}

/** Steps the quick amount chip goes through, in whole units; then off. */
export const AMOUNT_STEPS = [500, 1000, 5000, 10000] as const;

export function nextAmountStep(current: number | null): number | null {
  if (current === null) return AMOUNT_STEPS[0];
  const i = AMOUNT_STEPS.indexOf(current as (typeof AMOUNT_STEPS)[number]);
  return i >= 0 && i < AMOUNT_STEPS.length - 1 ? AMOUNT_STEPS[i + 1]! : null;
}

export function useActiveFilterCount(): number {
  return useActivityFilters((s) => activeFilterCount(s));
}
