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

export type AskStep = { name: string; args: Record<string, unknown>; result: unknown };
/** What happened and when, in ms since the question was sent: shown under "Details". */
export type AskLogEntry = { ms: number; text: string };
export type AskAnswer = { text: string; steps: AskStep[]; log: AskLogEntry[] };

/** Carries the log out with the failure so the screen can show what went wrong where. */
export class AskError extends Error {
  constructor(
    message: string,
    readonly log: AskLogEntry[],
    readonly detail: string,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 40_000;

type Call = { status: number; body: string };

/** One request, with a timeout and one quiet retry when a mobile connection drops mid-request. */
async function post(url: string, key: string, body: string, note: (t: string) => void): Promise<Call> {
  for (let attempt = 1; ; attempt++) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body,
        signal: abort.signal,
      });
      return { status: res.status, body: await res.text() };
    } catch (e) {
      const why = abort.signal.aborted ? `no reply in ${TIMEOUT_MS / 1000}s` : String(e instanceof Error ? e.message : e);
      if (attempt >= 2) throw new Error(why);
      note(`Connection problem (${why}), trying again`);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** One question, answered by Gemini calling the local tools; earlier turns give it the thread. */
export async function askGemini(
  key: string,
  question: string,
  history: readonly { question: string; answer: string }[],
  lines: readonly AskLine[],
  ctx: AskContext,
  onStep?: (step: AskStep) => void,
  onStatus?: (text: string) => void,
): Promise<AskAnswer> {
  const steps: AskStep[] = [];
  const log: AskLogEntry[] = [];
  const started = Date.now();
  const note = (text: string) => {
    log.push({ ms: Date.now() - started, text });
    onStatus?.(text);
  };
  // Thinking makes Flash several times slower; these lookups don't need it. Dropped if the model refuses the setting.
  let thinking = true;
  const contents: Content[] = [
    ...history.flatMap((t): Content[] => [
      { role: "user", parts: [{ text: t.question }] },
      { role: "model", parts: [{ text: t.answer }] },
    ]),
    { role: "user", parts: [{ text: question }] },
  ];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    note(round === 0 ? "Asking Gemini" : `Sending ${steps.length} lookup result${steps.length === 1 ? "" : "s"} back to Gemini`);
    let res: Call;
    try {
      res = await post(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        key,
        JSON.stringify({
          systemInstruction: { parts: [{ text: instructions(ctx) }] },
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          contents,
          ...(thinking ? { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } } : {}),
        }),
        note,
      );
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      note(`Failed: ${why}`);
      throw new AskError("Couldn't reach Gemini. Check the internet connection and try again.", log, why);
    }
    if (res.status === 400 && thinking && /thinking/i.test(res.body)) {
      thinking = false;
      round--;
      note("Model doesn't take the thinking setting, asking again without it");
      continue;
    }
    if (res.status !== 200) {
      note(`Gemini answered ${res.status}`);
      const message =
        res.status === 400 && /API key/i.test(res.body)
          ? "That Gemini key was not accepted."
          : res.status === 429
            ? "Gemini's free limit is used up for now. Try again in a minute."
            : res.status >= 500
              ? "Gemini is having trouble right now. Try again shortly."
              : `Gemini answered ${res.status}.`;
      throw new AskError(message, log, res.body.slice(0, 600));
    }
    note("Gemini replied");
    const data = JSON.parse(res.body) as { candidates?: { content?: Content }[] };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    if (calls.length === 0)
      return { text: parts.map((p) => p.text ?? "").join("").trim() || "No answer came back.", steps, log };
    contents.push({ role: "model", parts });
    contents.push({
      role: "user",
      parts: calls.map((p) => {
        const step = {
          name: p.functionCall!.name,
          args: p.functionCall!.args ?? {},
          result: runTool(p.functionCall!.name, p.functionCall!.args ?? {}, lines, ctx),
        };
        steps.push(step);
        note(`Looked up: ${step.name}`);
        onStep?.(step);
        return { functionResponse: { name: step.name, response: { result: step.result } } };
      }),
    });
  }
  return { text: "That needed too many steps. Try asking it more simply.", steps, log };
}
