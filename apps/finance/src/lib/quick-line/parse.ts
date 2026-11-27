import { daysInMonth, diffDays, makeKey, parseKey, weekday } from "@studio/dates";
import type { DateKey } from "@studio/dates";
import { findMemory, guessCategories } from "./guess";

export type QuickLineAccount = { id: string; name: string };
export type QuickLineCategory = { id: string; name: string; kind: "expense" | "income" };
export type QuickLinePerson = { id: string; name: string };
export type QuickLineMemory = {
  titleNorm: string;
  title: string;
  kind: "expense" | "income";
  categoryId: string | null;
  accountId: string | null;
  lastAmount: number | null;
  useCount: number;
};

export type QuickLine = {
  title: string;
  /** Minor units; null until a number is typed. */
  amount: number | null;
  kind: "expense" | "income" | "lent" | "borrowed";
  accountId: string | null;
  categoryId: string | null;
  /** Days before today. */
  daysAgo: number;
  /** Matched saved person for lent, borrowed and split lines. */
  personId: string | null;
  /** The name as said, even when no such person is saved. */
  personName: string | null;
  /** People sharing the bill, you included; 1 when not split. When above 1, amount is your share. */
  splitCount: number;
  memo: string;
  categorySource: "said" | "history" | "keyword" | null;
  accountSource: "said" | "history" | null;
};

const NUMBER = /^\+?(\d[\d,]*(?:\.\d+)?)(k|l|lac|lakh|lakhs)?$/i;
const ORDINAL = /^(\d{1,2})(?:st|nd|rd|th)$/;
const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})$/;
const WORD = /^[\p{L}][\p{L}'’.-]*$/u;
const MONTH =
  /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/;
const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS: Record<string, number> = {
  monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6, sunday: 7, sun: 7,
};
const INCOME_WORDS = new Set(["income", "earned", "received", "got"]);
const FILLER = new Set([
  "spent", "paid", "pay", "bought", "for", "on", "at", "to", "from", "via", "using", "with",
  "by", "rupees", "rupee", "rs", "inr", "bucks", "i", "the", "a", "an", "my", "of", "and",
]);
const LEND_VERBS = new Set(["lent", "lend", "lending", "loaned"]);
const BORROW_VERBS = new Set(["borrowed", "borrow", "borrowing"]);
const GIVE_TAKE = new Set(["gave", "give", "given", "took", "take", "taken"]);
const ACCOUNT_ALIASES: Record<string, readonly string[]> = {
  card: ["card", "credit"], credit: ["card", "credit"],
  upi: ["upi", "bank", "savings"], gpay: ["upi", "bank", "savings"], phonepe: ["upi", "bank", "savings"],
  paytm: ["upi", "bank", "savings"], googlepay: ["upi", "bank", "savings"],
};

const UNITS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const isNumberWord = (w: string | undefined) =>
  w !== undefined &&
  (w in UNITS || w in TENS || w === "hundred" || w === "thousand" || w === "lakh" || w === "lakhs");

/** "two fifty" reads as 250 (how it is said aloud), "fifteen hundred" as 1500. */
function spoken(words: readonly string[], start: number): { value: number; length: number } | null {
  let total = 0;
  let cur = 0;
  let j = start;
  let last: "unit" | "tens" | "hundred" | "big" | null = null;
  let hundredInCur = false;
  while (j < words.length) {
    const w = words[j]!;
    if (w in UNITS) {
      if (last === "unit") break;
      cur += UNITS[w]!;
      last = "unit";
    } else if (w in TENS) {
      if (last === "unit" && cur < 10 && !hundredInCur) cur = cur * 100 + TENS[w]!;
      else if (last === "tens") break;
      else cur += TENS[w]!;
      last = "tens";
    } else if (w === "hundred") {
      cur = (cur || 1) * 100;
      hundredInCur = true;
      last = "hundred";
    } else if (w === "thousand" || w === "lakh" || w === "lakhs") {
      total += (cur || 1) * (w === "thousand" ? 1000 : 100000);
      cur = 0;
      hundredInCur = false;
      last = "big";
    } else if (w === "and" && (last === "hundred" || last === "big") && isNumberWord(words[j + 1])) {
      // joiner in "two hundred and fifty"
    } else break;
    j++;
  }
  return last === null ? null : { value: total + cur, length: j - start };
}

/** Most recent day-of-month (optionally in a given month) that is not after today. */
function daysAgoFor(day: number, month: number | null, today: DateKey): number | null {
  const now = parseKey(today);
  for (let back = 0; back <= (month ? 1 : 12); back++) {
    let y = now.year;
    let m = month ?? now.month;
    if (month) y -= back;
    else {
      const index = now.year * 12 + (now.month - 1) - back;
      y = Math.floor(index / 12);
      m = (index % 12) + 1;
    }
    if (day < 1 || m < 1 || m > 12 || day > daysInMonth(y, m)) continue;
    const key = makeKey(y, m, day);
    if (key <= today) return diffDays(key, today);
  }
  return null;
}

const monthNumber = (w: string) => MONTH_NAMES.indexOf(w.slice(0, 3)) + 1;
const titleCase = (s: string) => s.replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
const nameWords = (name: string) => name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Reads a typed or dictated line like "uber 250 card yesterday": the first amount wins, named accounts, categories, people and days are picked out, and what is left is the title. */
export function parseQuickLine(
  text: string,
  options: {
    accounts: readonly QuickLineAccount[];
    categories: readonly QuickLineCategory[];
    people: readonly QuickLinePerson[];
    memory: readonly QuickLineMemory[];
    /** Decimal places of the display currency. */
    digits: number;
    today: DateKey;
  },
): QuickLine {
  const cleaned = text
    .replace(/₹/g, " ")
    .replace(/\b(?:rs|inr)\.?\s*(?=\d)/gi, " ")
    .replace(/(\d)\s*(?:rs|inr|rupees?)\b\.?/gi, "$1 ");
  const raw = cleaned
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}+]+/u, "").replace(/[^\p{L}\p{N}]+$/u, ""))
    .filter(Boolean);
  const l = raw.map((t) => t.toLowerCase());
  const n = l.length;
  const used: boolean[] = l.map(() => false);
  const take = (...idx: number[]) => idx.forEach((i) => (used[i] = true));
  const free = (i: number) => i >= 0 && i < n && !used[i];

  let amount: number | null = null;
  let income = false;
  let daysAgo: number | null = null;
  let ways = 0;
  const minor = (v: number) => Math.round(v * 10 ** options.digits);

  const hasLoan = l.some((w) => w === "loan");
  const lend = l.some((w) => LEND_VERBS.has(w)) || (hasLoan && l.some((w) => w === "gave" || w === "give"));
  const borrow =
    l.some((w) => BORROW_VERBS.has(w)) ||
    (hasLoan && !lend && l.some((w) => ["took", "take", "taken", "got", "from"].includes(w)));
  const lendKind: "lent" | "borrowed" | null = borrow && !lend ? "borrowed" : lend ? "lent" : hasLoan ? "lent" : null;

  for (let i = 0; i < n; i++) {
    const w = l[i]!;
    if ((w === "ways" || w === "way") && i > 0 && free(i - 1)) {
      const prev = l[i - 1]!;
      const v = /^\d+$/.test(prev) ? Number(prev) : UNITS[prev];
      if (v && v >= 2) {
        ways = v;
        take(i - 1, i);
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (used[i]) continue;
    const w = l[i]!;
    const setDate = (value: number | null, ...idx: number[]) => {
      if (value === null || daysAgo !== null) return false;
      daysAgo = value;
      take(...idx);
      return true;
    };
    if (w === "today" && setDate(0, i)) continue;
    if (w === "yesterday" && setDate(1, i)) continue;
    if (w === "day" && l[i + 1] === "before" && l[i + 2] === "yesterday" && free(i + 1) && free(i + 2)) {
      if (setDate(2, i, i + 1, i + 2)) continue;
    }
    if (/^\d+$/.test(w) && /^days?$/.test(l[i + 1] ?? "") && l[i + 2] === "ago" && free(i + 1) && free(i + 2)) {
      if (setDate(Number(w), i, i + 1, i + 2)) continue;
    }
    if (w in WEEKDAYS) {
      const last = l[i - 1] === "last" && free(i - 1);
      let diff = (weekday(options.today) - WEEKDAYS[w]! + 7) % 7;
      if (last && diff === 0) diff = 7;
      if (setDate(diff, i)) {
        if (last) take(i - 1);
        continue;
      }
    }
    const ordinal = ORDINAL.exec(w);
    if (ordinal) {
      const day = Number(ordinal[1]);
      const monthTok = free(i + 1) && MONTH.test(l[i + 1]!) ? i + 1 : -1;
      if (setDate(daysAgoFor(day, monthTok >= 0 ? monthNumber(l[monthTok]!) : null, options.today), i, ...(monthTok >= 0 ? [monthTok] : []))) continue;
    }
    if (MONTH.test(w) && free(i + 1)) {
      const next = l[i + 1]!;
      const day = ORDINAL.exec(next)?.[1] ?? (/^\d{1,2}$/.test(next) ? next : undefined);
      if (day && setDate(daysAgoFor(Number(day), monthNumber(w), options.today), i, i + 1)) continue;
    }
    const slash = SLASH_DATE.exec(w);
    if (slash && setDate(daysAgoFor(Number(slash[1]), Number(slash[2]), options.today), i)) continue;
    if (/^\d{1,2}$/.test(w) && free(i + 1) && MONTH.test(l[i + 1]!)) {
      if (setDate(daysAgoFor(Number(w), monthNumber(l[i + 1]!), options.today), i, i + 1)) continue;
    }

    if (amount === null) {
      const num = NUMBER.exec(raw[i]!);
      if (num) {
        let value = Number(num[1]!.replaceAll(",", ""));
        const suffix = num[2]?.toLowerCase();
        const next = l[i + 1];
        if (suffix === "k") value *= 1000;
        else if (suffix) value *= 100000;
        else if (free(i + 1) && (next === "lakh" || next === "lakhs" || next === "lac")) {
          value *= 100000;
          take(i + 1);
        } else if (free(i + 1) && (next === "thousand" || next === "k")) {
          value *= 1000;
          take(i + 1);
        }
        amount = minor(value);
        if (raw[i]!.startsWith("+")) income = true;
        take(i);
        continue;
      }
      const say = spoken(l, i);
      if (say) {
        amount = minor(say.value);
        for (let k = 0; k < say.length; k++) take(i + k);
        continue;
      }
    }
    if (INCOME_WORDS.has(w)) {
      income = true;
      take(i);
    } else if (w === "salary") income = true;
  }

  const kind: QuickLine["kind"] = lendKind ?? (income ? "income" : "expense");
  if (lendKind) {
    for (let i = 0; i < n; i++) {
      if (free(i) && (LEND_VERBS.has(l[i]!) || BORROW_VERBS.has(l[i]!) || GIVE_TAKE.has(l[i]!) || l[i] === "loan" || INCOME_WORDS.has(l[i]!))) take(i);
    }
  }

  const split = !lendKind && (l.some((w, i) => w === "split" && free(i)) || ways > 0);
  l.forEach((w, i) => {
    if (w === "split" && free(i)) take(i);
  });

  const findPerson = (i: number): QuickLinePerson | undefined => {
    const w = l[i]!;
    if (w.length < 2) return undefined;
    return options.people.find((p) => nameWords(p.name).includes(w));
  };
  const isStop = (i: number) =>
    !free(i) || !WORD.test(raw[i]!) || FILLER.has(l[i]!) || l[i]! in ACCOUNT_ALIASES ||
    options.accounts.some((a) => nameWords(a.name).includes(l[i]!)) || l[i] === "cash";

  const people: { id: string | null; name: string }[] = [];
  const addPerson = (i: number) => {
    const saved = findPerson(i);
    take(i);
    if (saved) {
      people.push({ id: saved.id, name: saved.name });
      // "rahul sharma": the rest of a saved full name belongs to the same person.
      if (free(i + 1) && nameWords(saved.name).includes(l[i + 1]!)) take(i + 1);
    } else people.push({ id: null, name: titleCase(l[i]!) });
  };
  if (lendKind) {
    for (let i = 0; i < n && people.length === 0; i++) {
      if (free(i) && findPerson(i) && WORD.test(raw[i]!)) addPerson(i);
    }
    for (let i = 0; i < n && people.length === 0; i++) {
      const prev = l[i - 1];
      if (free(i) && !isStop(i) && (prev === "to" || prev === "from" || (i > 0 && (GIVE_TAKE.has(prev!) || LEND_VERBS.has(prev!) || BORROW_VERBS.has(prev!))))) addPerson(i);
    }
  } else if (split) {
    const at = l.findIndex((w, i) => (w === "with" || w === "between") && i < n);
    if (at >= 0) {
      for (let j = at + 1; j < n; j++) {
        if (l[j] === "and" && free(j)) continue;
        if (isStop(j) && !findPerson(j)) break;
        if (!free(j)) break;
        addPerson(j);
      }
    }
  }

  let accountId: string | null = null;
  let accountSource: QuickLine["accountSource"] = null;
  const candidates = () => l.map((w, i) => i).filter((i) => free(i) && !FILLER.has(l[i]!) && l[i]!.length >= 3);
  let best = { score: 0, id: null as string | null, tokens: [] as number[] };
  for (const a of options.accounts) {
    const words = nameWords(a.name);
    const tokens = candidates().filter((i) => words.some((nw) => nw.startsWith(l[i]!)));
    if (tokens.length > best.score) best = { score: tokens.length, id: a.id, tokens };
  }
  if (best.id) {
    accountId = best.id;
    take(...best.tokens);
  } else {
    for (const i of candidates()) {
      const hints = ACCOUNT_ALIASES[l[i]!];
      const account = hints && options.accounts.find((a) => hints.some((h) => a.name.toLowerCase().includes(h)));
      if (account) {
        accountId = account.id;
        take(i);
        if (l[i] === "card" && free(i - 1) && l[i - 1] === "credit") take(i - 1);
        break;
      }
    }
  }
  if (accountId) accountSource = "said";

  const pool = lendKind ? [] : options.categories.filter((c) => c.kind === kind);
  let categoryId: string | null = null;
  let categorySource: QuickLine["categorySource"] = null;
  let categoryWord = "";
  const pick = (test: (word: string, nameWord: string) => boolean) => {
    for (const i of candidates()) {
      const c = pool.find((cat) => nameWords(cat.name).some((nw) => test(l[i]!, nw)));
      if (c) return { c, i };
    }
    return null;
  };
  const said = pick((w, nw) => w === nw) ?? pick((w, nw) => w.length >= 4 && nw.startsWith(w));
  if (said) {
    categoryId = said.c.id;
    categorySource = "said";
    categoryWord = l[said.i]!;
    take(said.i);
  }

  const rest = l.map((w, i) => i).filter((i) => free(i) && !FILLER.has(l[i]!));
  const titleWords = rest.map((i) => l[i]!);
  if (titleWords.length === 0 && categoryWord) titleWords.push(categoryWord);
  const title = titleCase(titleWords.join(" "));

  if (!lendKind) {
    const rows = findMemory(title, kind as "expense" | "income", options.memory);
    if (!accountId) {
      const row = rows.find((r) => r.accountId && options.accounts.some((a) => a.id === r.accountId));
      if (row) {
        accountId = row.accountId;
        accountSource = "history";
      }
    }
    if (!categoryId) {
      const row = rows.find((r) => r.categoryId && pool.some((c) => c.id === r.categoryId));
      if (row) {
        categoryId = row.categoryId;
        categorySource = "history";
      } else if (title) {
        categoryId = guessCategories(title, kind as "expense" | "income", { categories: options.categories, memory: options.memory })[0] ?? null;
        if (categoryId) categorySource = "keyword";
      }
    }
  }

  const splitCount = split ? Math.max(ways, people.length + 1) : 1;
  let memo = "";
  if (splitCount > 1) {
    const total = amount === null ? null : amount / 10 ** options.digits;
    const names = people.map((p) => p.name);
    const who = names.length === 0 ? `${splitCount} ways` : `with ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]}`;
    const shown = total === null ? "" : ` ${Number.isInteger(total) ? total : total.toFixed(options.digits)}`;
    memo = `Split${shown} ${who}`;
    if (amount !== null) amount = Math.round(amount / splitCount);
  }

  return {
    title,
    amount,
    kind,
    accountId,
    categoryId,
    daysAgo: daysAgo ?? 0,
    personId: people[0]?.id ?? null,
    personName: people[0]?.name ?? null,
    splitCount,
    memo,
    categorySource,
    accountSource,
  };
}
