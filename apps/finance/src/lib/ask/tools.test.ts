import { runTool, type AskLine } from "./tools";

const line = (dateKey: string, amount: number, kind: AskLine["kind"] = "income", title = "Salary"): AskLine => ({
  id: dateKey + title,
  kind,
  title,
  dateKey,
  amount: amount * 100,
  categoryName: kind === "income" ? "Salary" : "Food",
});
const lines = [
  line("2026-03-31", 900000),
  line("2026-04-30", 800000),
  line("2026-05-31", 900000),
  line("2026-06-30", 700000),
  line("2026-06-10", 300, "expense", "Zomato"),
];
const ctx = { today: "2026-11-28", digits: 2 };

it("finds the day a running total crossed an amount", () => {
  expect(runTool("milestone", { kind: "income", amount: 2000000, from: "2026-04-01" }, lines, ctx)).toEqual({
    reached: true,
    date: "2026-06-30",
    runningTotal: 2400000,
    totalNow: 2400000,
  });
});

it("filters by payee and kind", () => {
  expect(runTool("total", { payee: "zomato" }, lines, ctx)).toMatchObject({ total: 300, count: 1 });
});
