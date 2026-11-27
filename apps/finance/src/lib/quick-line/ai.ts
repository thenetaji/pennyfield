import { aiRespond, aiStatus } from "../../../modules/finance-ai";

export type AiLine = {
  title?: string;
  /** Major units, as said. */
  amount?: number;
  kind?: "expense" | "income" | "lent" | "borrowed";
  category?: string;
  account?: string;
  person?: string;
  daysAgo?: number;
};

const INSTRUCTIONS = `You turn one sentence about money into JSON for a personal finance app in India.
Reply with JSON only, no prose: {"title":string,"amount":number,"kind":"expense"|"income"|"lent"|"borrowed","category":string,"account":string,"person":string,"daysAgo":number}.
title is the shop, payee or short thing bought, 1-3 words. amount is in rupees as a plain number (250, 1500, 120000).
category and account must be copied exactly from the lists given, or left out. person only for lending.
daysAgo is 0 for today, 1 for yesterday. Leave out any field you are not sure about.`;

/** Asks Apple's on-device model to read a line the rules could not; null when the model is missing or answers nonsense. */
export async function aiReadLine(
  text: string,
  lists: { categories: readonly string[]; accounts: readonly string[] },
): Promise<AiLine | null> {
  if ((await aiStatus()) !== "ready") return null;
  const prompt = `Categories: ${lists.categories.join(", ")}
Accounts: ${lists.accounts.join(", ")}
Sentence: ${text}`;
  const reply = await aiRespond(prompt, INSTRUCTIONS);
  if (!reply) return null;
  const json = reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1);
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const num = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
    const kind = ["expense", "income", "lent", "borrowed"].includes(raw.kind as string)
      ? (raw.kind as AiLine["kind"])
      : undefined;
    return {
      title: str(raw.title),
      amount: num(raw.amount),
      kind,
      category: str(raw.category),
      account: str(raw.account),
      person: str(raw.person),
      daysAgo: num(raw.daysAgo),
    };
  } catch {
    return null;
  }
}
