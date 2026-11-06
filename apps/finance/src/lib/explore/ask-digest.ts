export type DigestLine = {
  kind: "expense" | "income";
  title: string;
  dateKey: string;
  amount: number;
  categoryName: string;
};

const TOP_CATEGORIES = 10;
const TOP_PAYEES = 10;
const MONTHS = 6;

const sumBy = (lines: readonly DigestLine[], key: (l: DigestLine) => string) => {
  const totals = new Map<string, number>();
  for (const line of lines) totals.set(key(line), (totals.get(key(line)) ?? 0) + line.amount);
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
};

/**
 * The facts the on-device model answers from. Its context window is small and it adds up badly, so
 * totals are worked out here and only the most useful ones are sent.
 */
export function askDigest(
  lines: readonly DigestLine[],
  today: string,
  format: (minor: number) => string,
): string {
  const months = [...new Set(lines.map((l) => l.dateKey.slice(0, 7)))].sort().slice(-MONTHS);
  const monthly = months.map((month) => {
    const within = lines.filter((l) => l.dateKey.startsWith(month));
    const total = (kind: DigestLine["kind"]) =>
      within.reduce((sum, l) => (l.kind === kind ? sum + l.amount : sum), 0);
    const categories = sumBy(within.filter((l) => l.kind === "expense"), (l) => l.categoryName)
      .slice(0, TOP_CATEGORIES)
      .map(([name, amount]) => `${name} ${format(amount)}`)
      .join(", ");
    return `${month}: spent ${format(total("expense"))}, earned ${format(total("income"))}. ${categories}`;
  });
  const recent = lines.filter(
    (l) => l.kind === "expense" && months.slice(-3).some((m) => l.dateKey.startsWith(m)),
  );
  const payees = sumBy(recent.filter((l) => l.title.trim()), (l) => l.title.trim())
    .slice(0, TOP_PAYEES)
    .map(([name, amount]) => `${name} ${format(amount)}`)
    .join(", ");
  return [`Today is ${today}.`, ...monthly, `Biggest payees in the last 3 months: ${payees}.`].join("\n");
}

export const ASK_INSTRUCTIONS = (digest: string) =>
  `You answer questions about the user's own spending in one or two short sentences. Use only the facts below and quote their amounts exactly. Don't add or compare numbers unless the facts show them. If the facts don't cover the question, say you can't tell from what's here. Never give investment or tax advice.\n\nFacts:\n${digest}`;
