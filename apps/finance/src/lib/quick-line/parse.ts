export type QuickLineAccount = { id: string; name: string };
export type QuickLineCategory = { id: string; name: string };

export type QuickLine = {
  title: string;
  /** Minor units; null until a number is typed. */
  amount: number | null;
  kind: "expense" | "income";
  accountId: string | null;
  categoryId: string | null;
  /** Days before today. */
  daysAgo: number;
};

const AMOUNT = /^\+?([\p{Sc}]?)(\d[\d,]*(?:\.\d+)?)(k?)([\p{Sc}]?)$/iu;
const INCOME_WORDS = new Set(["income", "earned", "received"]);
const DAYS_AGO: Record<string, number> = { today: 0, yesterday: 1 };

const matches = (word: string, name: string) => {
  const n = name.toLowerCase();
  return word.length >= 3 && (n === word || n.split(/\s+/).includes(word));
};

/** Reads "uber 250 card yesterday": the first number is the amount, names of accounts and categories are matched, and the rest is the title. */
export function parseQuickLine(
  text: string,
  options: {
    accounts: readonly QuickLineAccount[];
    categories: readonly QuickLineCategory[];
    /** Decimal places of the display currency. */
    digits: number;
  },
): QuickLine {
  const result: QuickLine = {
    title: "",
    amount: null,
    kind: "expense",
    accountId: null,
    categoryId: null,
    daysAgo: 0,
  };
  const title: string[] = [];
  for (const raw of text.trim().split(/\s+/).filter(Boolean)) {
    const word = raw.toLowerCase();
    const number = result.amount === null ? AMOUNT.exec(raw) : null;
    if (number) {
      const value = Number(number[2]!.replaceAll(",", "")) * (number[3] ? 1000 : 1);
      result.amount = Math.round(value * 10 ** options.digits);
      if (raw.startsWith("+")) result.kind = "income";
      continue;
    }
    if (word in DAYS_AGO) {
      result.daysAgo = DAYS_AGO[word]!;
      continue;
    }
    if (INCOME_WORDS.has(word)) {
      result.kind = "income";
      continue;
    }
    const account = result.accountId
      ? undefined
      : options.accounts.find((a) => matches(word, a.name));
    if (account) {
      result.accountId = account.id;
      continue;
    }
    const category = result.categoryId
      ? undefined
      : options.categories.find((c) => matches(word, c.name));
    if (category) {
      result.categoryId = category.id;
      // A category name can also be all the title there is ("food 200").
      if (title.length === 0) title.push(raw);
      continue;
    }
    title.push(raw);
  }
  result.title = title
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return result;
}
