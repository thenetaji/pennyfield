import { createTestDb } from "../test-helpers";
import { createAccount } from "./accounts";
import { createCategory, updateCategory } from "./categories";
import { listForPeriod } from "./transactionQueries";
import { spendLines } from "./reports";
import { createTransaction } from "./transactions";

const RANGE = { from: "2026-11-01", to: "2026-11-30" };

function setup() {
  const db = createTestDb();
  const account = createAccount(db, {
    name: "Cash",
    type: "cash",
    currency: "INR",
    color: "green",
    icon: "banknote",
  });
  const make = (name: string, isBusiness: boolean) =>
    createCategory(db, {
      name,
      kind: "expense",
      icon: "tag",
      color: "blue",
      isBusiness,
    });
  const tools = make("Tools", true);
  const food = make("Snacks", false);
  const at = new Date(2026, 10, 5, 12).getTime();
  const add = (
    amount: number,
    input: Partial<Parameters<typeof createTransaction>[1]>,
  ) =>
    createTransaction(db, {
      kind: "expense",
      amount,
      accountId: account.id,
      occurredAt: at,
      ...input,
    });
  return { db, tools, food, add };
}

const total = (lines: { amount: number }[]) =>
  lines.reduce((s, l) => s + l.amount, 0);

describe("business and personal sides", () => {
  it("follows the category unless the entry overrides it", () => {
    const { db, tools, food, add } = setup();
    add(1000, { categoryId: tools.id });
    add(200, { categoryId: food.id });
    add(50, { categoryId: food.id, side: "business" });
    add(30, { categoryId: tools.id, side: "personal" });

    expect(total(spendLines(db, RANGE, { side: "business" }))).toBe(1050);
    expect(total(spendLines(db, RANGE, { side: "personal" }))).toBe(230);
    expect(total(spendLines(db, RANGE))).toBe(1280);
  });

  it("splits each split line by its own category", () => {
    const { db, tools, food, add } = setup();
    add(300, {
      splits: [
        { categoryId: tools.id, amount: 100 },
        { categoryId: food.id, amount: 200 },
      ],
    });
    expect(total(spendLines(db, RANGE, { side: "business" }))).toBe(100);
    expect(total(spendLines(db, RANGE, { side: "personal" }))).toBe(200);
    expect(listForPeriod(db, { ...RANGE, side: "business" })).toHaveLength(1);
  });

  it("drops per-entry exceptions when the category is switched", () => {
    const { db, food, add } = setup();
    add(50, { categoryId: food.id, side: "business" });
    add(70, { categoryId: food.id });
    updateCategory(db, food.id, { isBusiness: true });
    expect(total(spendLines(db, RANGE, { side: "business" }))).toBe(120);
    updateCategory(db, food.id, { isBusiness: false });
    expect(total(spendLines(db, RANGE, { side: "business" }))).toBe(0);
  });
});
