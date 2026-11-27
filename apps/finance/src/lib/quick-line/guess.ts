import type {
  QuickLineCategory,
  QuickLineMemory,
} from "./parse";

type Kind = "expense" | "income";

const KEYWORDS: Record<string, readonly string[]> = {};
const add = (words: string, ...names: string[]) => {
  for (const word of words.split(" ")) KEYWORDS[word] = names;
};

add("zomato swiggy restaurant cafe coffee chai dinner lunch breakfast pizza dominos kfc mcd", "Food", "Eating out", "Dining", "Restaurants");
add("zepto blinkit instamart bigbasket grocery groceries vegetables milk dmart", "Groceries");
add("uber ola rapido auto cab metro bus train irctc petrol fuel parking toll", "Transport", "Travel", "Fuel");
add("amazon flipkart myntra ajio meesho nykaa shopping clothes shoes", "Shopping");
add("netflix spotify prime hotstar youtube icloud apple chatgpt subscription", "Subscriptions");
add("airtel jio vi recharge electricity bill wifi broadband gas", "Bills", "Utilities");
add("rent", "Rent", "Housing", "Home");
add("doctor medicine pharmacy apollo hospital clinic checkup 1mg pharmeasy", "Health", "Medical");
add("movie pvr inox bookmyshow game", "Fun", "Entertainment");
add("gym salon haircut spa", "Personal care", "Fitness");
add("course udemy books fees tuition coaching", "Education");
add("atm withdrawal", "Cash", "ATM");
add("salary stipend", "Salary");
add("interest dividend", "Interest", "Investments");
add("refund cashback", "Refunds", "Cashback");

const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** Best saved row for a title: exact first, then one containing the other, most used first. */
export function findMemory(
  title: string,
  kind: Kind,
  memory: readonly QuickLineMemory[],
): QuickLineMemory[] {
  const norm = title.trim().toLowerCase();
  if (norm.length < 2) return [];
  const rows = memory.filter((m) => m.kind === kind);
  const exact = rows.filter((m) => m.titleNorm === norm);
  const loose = rows
    .filter(
      (m) =>
        m.titleNorm !== norm &&
        m.titleNorm.length >= 3 &&
        (norm.includes(m.titleNorm) || (norm.length >= 3 && m.titleNorm.startsWith(norm))),
    )
    .sort((a, b) => b.useCount - a.useCount);
  return [...exact.sort((a, b) => b.useCount - a.useCount), ...loose];
}

/** Category ids for a title, best first: what the user chose before, then merchant keywords. */
export function guessCategories(
  title: string,
  kind: Kind,
  options: {
    categories: readonly QuickLineCategory[];
    memory: readonly QuickLineMemory[];
  },
): string[] {
  const pool = options.categories.filter((c) => c.kind === kind);
  const ids = new Set<string>();
  const push = (id: string | null) => {
    if (id && pool.some((c) => c.id === id)) ids.add(id);
  };
  for (const row of findMemory(title, kind, options.memory)) push(row.categoryId);
  for (const word of words(title)) {
    for (const name of KEYWORDS[word] ?? []) {
      const target = name.toLowerCase();
      for (const c of pool) {
        if (c.name.toLowerCase().includes(target)) push(c.id);
      }
    }
  }
  return [...ids].slice(0, 3);
}
