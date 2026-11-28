/** Exact answers over every entry. The model picks a tool and its arguments; the arithmetic never happens in the model. */

export type AskLine = {
  id: string;
  kind: "expense" | "income";
  title: string;
  dateKey: string;
  /** Minor units, display currency. */
  amount: number;
  categoryName: string;
};

type Kind = "expense" | "income";
type Args = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const kindOf = (v: unknown): Kind => (v === "income" ? "income" : "expense");
const contains = (hay: string, needle?: string) =>
  !needle || hay.toLowerCase().includes(needle.toLowerCase());

const PERIOD = {
  from: { type: "string", description: "First day, YYYY-MM-DD. Leave out for since the first entry." },
  to: { type: "string", description: "Last day, YYYY-MM-DD. Leave out for today." },
};
const FILTER = {
  kind: { type: "string", enum: ["expense", "income"], description: "expense (spending) or income. Default expense." },
  category: { type: "string", description: "Only this category, as named in the category list." },
  payee: { type: "string", description: "Only entries whose title contains this text, e.g. Zomato." },
};

export const TOOL_DECLARATIONS = [
  {
    name: "total",
    description: "Sum and count of entries in a period, optionally for one category or payee.",
    parameters: { type: "object", properties: { ...FILTER, ...PERIOD } },
  },
  {
    name: "by_month",
    description: "Totals for each calendar month in a period. Use for trends, averages, best or worst month.",
    parameters: { type: "object", properties: { ...FILTER, ...PERIOD } },
  },
  {
    name: "top",
    description: "Biggest categories or payees by total in a period.",
    parameters: {
      type: "object",
      properties: {
        kind: FILTER.kind,
        by: { type: "string", enum: ["category", "payee"] },
        limit: { type: "number" },
        ...PERIOD,
      },
      required: ["by"],
    },
  },
  {
    name: "milestone",
    description: "The day the running total of a period first reached an amount, e.g. when income this financial year crossed 20 lakh.",
    parameters: {
      type: "object",
      properties: { ...FILTER, amount: { type: "number", description: "In rupees: 20 lakh = 2000000." }, ...PERIOD },
      required: ["amount"],
    },
  },
  {
    name: "entries",
    description: "Individual entries, biggest or newest first. Use for biggest purchases, last payment, or to show what made up a total.",
    parameters: {
      type: "object",
      properties: {
        ...FILTER,
        sort: { type: "string", enum: ["amount", "date"] },
        limit: { type: "number" },
        ...PERIOD,
      },
    },
  },
] as const;

export function runTool(
  name: string,
  args: Args,
  lines: readonly AskLine[],
  ctx: { today: string; digits: number },
): unknown {
  const major = (minor: number) => Math.round(minor) / 10 ** ctx.digits;
  const kind = kindOf(args.kind);
  const from = str(args.from) ?? "0000-01-01";
  const to = str(args.to) ?? ctx.today;
  const category = str(args.category);
  const payee = str(args.payee);
  const picked = lines.filter(
    (l) =>
      l.kind === kind &&
      l.dateKey >= from &&
      l.dateKey <= to &&
      contains(l.categoryName, category) &&
      contains(l.title, payee),
  );
  const sum = (ls: readonly AskLine[]) => ls.reduce((t, l) => t + l.amount, 0);
  const row = (l: AskLine) => ({
    date: l.dateKey,
    title: l.title || "(no title)",
    category: l.categoryName,
    amount: major(l.amount),
  });

  switch (name) {
    case "total":
      return { kind, from, to, total: major(sum(picked)), count: picked.length };
    case "by_month": {
      const months = new Map<string, number>();
      for (const l of picked) {
        const m = l.dateKey.slice(0, 7);
        months.set(m, (months.get(m) ?? 0) + l.amount);
      }
      return [...months.entries()].sort().map(([month, total]) => ({ month, total: major(total) }));
    }
    case "top": {
      const by = args.by === "payee" ? "payee" : "category";
      const groups = new Map<string, number>();
      for (const l of picked) {
        const key = by === "payee" ? l.title.trim() || "(no title)" : l.categoryName;
        groups.set(key, (groups.get(key) ?? 0) + l.amount);
      }
      return [...groups.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.min(num(args.limit) ?? 5, 20))
        .map(([name, total]) => ({ name, total: major(total) }));
    }
    case "milestone": {
      const target = (num(args.amount) ?? 0) * 10 ** ctx.digits;
      const sorted = [...picked].sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
      let running = 0;
      for (const l of sorted) {
        running += l.amount;
        if (running >= target)
          return { reached: true, date: l.dateKey, runningTotal: major(running), totalNow: major(sum(sorted)) };
      }
      return { reached: false, totalNow: major(running), stillNeeded: major(target - running) };
    }
    case "entries": {
      const sorted = [...picked].sort((a, b) =>
        args.sort === "date" ? (a.dateKey < b.dateKey ? 1 : -1) : b.amount - a.amount,
      );
      return sorted.slice(0, Math.min(num(args.limit) ?? 10, 30)).map(row);
    }
    default:
      return { error: `No tool called ${name}` };
  }
}
