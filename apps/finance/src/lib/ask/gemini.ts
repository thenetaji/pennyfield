import { TOOL_DECLARATIONS, runTool, type AskLine } from "./tools";

export const GEMINI_MODEL = "gemini-flash-latest";
const MAX_ROUNDS = 6;

type Part = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
};
type Content = { role: "user" | "model"; parts: Part[] };

export type AskContext = {
  today: string;
  digits: number;
  currency: string;
  /** First month of the financial year, 4 for April. */
  yearStart: number;
  categories: readonly string[];
  firstEntry: string | null;
};

const fyLine = (start: number) => {
  if (start === 1) return "Years are calendar years.";
  const pad = (n: number) => String(n).padStart(2, "0");
  const endMonth = start - 1;
  const endDay = new Date(Date.UTC(2027, endMonth, 0)).getUTCDate();
  return `The financial year starts on the 1st of month ${start}, so FY 2026-27 is 2026-${pad(start)}-01 to 2027-${pad(endMonth)}-${pad(endDay)}.`;
};

const instructions = (c: AskContext) =>
  `You answer questions about the user's own money in a personal finance app. Today is ${c.today}. Amounts are in ${c.currency}; write Indian style (₹1,20,000, 20L, 1.2 Cr).
${fyLine(c.yearStart)}
Entries start on ${c.firstEntry ?? "no date yet"}. Categories: ${c.categories.join(", ")}.
Always get numbers from the tools; never add up or guess yourself. Call as many tools as you need.
Answer in one to three short plain sentences with the exact numbers and dates. No advice unless asked.`;

/** One question, answered by Gemini calling the local tools; earlier turns give it the thread. */
export async function askGemini(
  key: string,
  question: string,
  history: readonly { question: string; answer: string }[],
  lines: readonly AskLine[],
  ctx: AskContext,
): Promise<string> {
  const contents: Content[] = [
    ...history.flatMap((t): Content[] => [
      { role: "user", parts: [{ text: t.question }] },
      { role: "model", parts: [{ text: t.answer }] },
    ]),
    { role: "user", parts: [{ text: question }] },
  ];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instructions(ctx) }] },
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          contents,
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 400 && /API key/i.test(detail)) throw new Error("That Gemini key was not accepted.");
      if (res.status === 429) throw new Error("Gemini's free limit is used up for now. Try again later.");
      throw new Error(`Gemini answered ${res.status}.`);
    }
    const data = (await res.json()) as { candidates?: { content?: Content }[] };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    if (calls.length === 0)
      return parts.map((p) => p.text ?? "").join("").trim() || "No answer came back.";
    contents.push({ role: "model", parts });
    contents.push({
      role: "user",
      parts: calls.map((p) => ({
        functionResponse: {
          name: p.functionCall!.name,
          response: { result: runTool(p.functionCall!.name, p.functionCall!.args ?? {}, lines, ctx) },
        },
      })),
    });
  }
  return "That needed too many steps. Try asking it more simply.";
}
