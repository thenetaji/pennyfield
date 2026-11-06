import { detailedLines } from "@/db/repos/insight-lines";
import { listCategories } from "@/db/repos/categories";
import { useLiveData } from "@/data/use-live-data";
import type { Db } from "@/db/types";
import { convertLine } from "@/lib/insights";
import { conversionContext } from "./summary";

export type ExploreLine = {
  id: string;
  kind: "expense" | "income";
  title: string;
  dateKey: string;
  /** In the display currency. */
  amount: number;
  categoryId: string | null;
  categoryName: string;
  /** Category palette key. */
  color: string;
  icon: string;
};

export function readExploreLines(db: Db, from: string, to: string): ExploreLine[] {
  const ctx = conversionContext(db);
  const categories = new Map(
    [
      ...listCategories(db, "expense", { includeArchived: true }),
      ...listCategories(db, "income", { includeArchived: true }),
    ].map((c) => [c.id, c]),
  );
  return detailedLines(db, { from, to }).map((line) => {
    const category = line.categoryId ? categories.get(line.categoryId) : undefined;
    return {
      id: line.transactionId,
      kind: line.kind,
      title: line.title,
      dateKey: line.dateKey,
      amount: convertLine(line, ctx),
      categoryId: line.categoryId,
      categoryName: category?.name ?? "Uncategorised",
      color: category?.color ?? "gray",
      icon: category?.icon ?? "tag.fill",
    };
  });
}

/** Every income and expense line between two days, converted to the display currency. */
export function useExploreLines(from: string, to: string): ExploreLine[] {
  return useLiveData(
    ["transactions", "transaction_splits", "categories", "fx_rates", "settings"],
    `explore:${from}:${to}`,
    (db) => readExploreLines(db, from, to),
  );
}
