import { keyToLocalMs } from "@studio/dates";
import {
  addSplitLine,
  autoReceives,
  budgetHint,
  buildRuleInput,
  buildTransactionInput,
  collapsedCategory,
  dateChipLabel,
  draftFromTransaction,
  emptyDraft,
  isSaveDisabled,
  kindChangePatch,
  rememberAccounts,
  lendTitle,
  lendToggle,
  MAX_SPLIT_LINES,
  receiptChanges,
  segmentOf,
  titleAfterPerson,
  toggleId,
  removeSplitLine,
  repeatLabel,
  resolveDefaults,
  saveBlock,
  splitRemaining,
  startSplit,
  updateSplitLine,
  type Draft,
} from "./logic";

const accounts = [{ id: "a1" }, { id: "a2" }, { id: "a3" }];
const categories = [
  { id: "food", kind: "expense" },
  { id: "rent", kind: "expense" },
  { id: "pay", kind: "income" },
];
const base: Draft = {
  ...emptyDraft(
    {
      kind: "expense",
      accountId: "a1",
      transferAccountId: null,
      categoryId: null,
    },
    keyToLocalMs("2026-10-05", 14, 32),
  ),
  amount: 10000,
};
const same = { sameCurrency: true, receivesAmount: 0 };

describe("splits", () => {
  it("starts with the full amount on the current category and an empty line", () => {
    const lines = startSplit(5000, "food");
    expect(lines.map((l) => [l.categoryId, l.amount])).toEqual([
      ["food", 5000],
      [null, 0],
    ]);
    expect(splitRemaining(5000, lines)).toBe(0);
  });

  it("computes the remainder against the total, including overshoot", () => {
    let lines = startSplit(10000, "food");
    lines = updateSplitLine(lines, lines[0]!.key, { amount: 6000 });
    expect(splitRemaining(10000, lines)).toBe(4000);
    lines = updateSplitLine(lines, lines[1]!.key, { amount: 5000 });
    expect(splitRemaining(10000, lines)).toBe(-1000);
  });

  it("caps at 8 lines and collapses below 2", () => {
    let lines = startSplit(100, "food");
    for (let i = 0; i < 10; i++) lines = addSplitLine(lines);
    expect(lines).toHaveLength(MAX_SPLIT_LINES);
    const two = startSplit(100, "food");
    expect(removeSplitLine(two, two[1]!.key)).toBeNull();
    expect(collapsedCategory(two)).toBe("food");
    expect(removeSplitLine(lines, lines[0]!.key)).toHaveLength(
      MAX_SPLIT_LINES - 1,
    );
  });
});

describe("defaults", () => {
  const input = {
    params: {},
    lastKind: "income" as const,
    lastAccountId: "a2",
    defaultAccountId: "a1",
    accounts,
    categories,
  };

  it("uses last kind and last account", () => {
    expect(resolveDefaults(input)).toMatchObject({
      kind: "income",
      accountId: "a2",
      categoryId: null,
    });
  });

  it("prefers params, then falls back to the default account when the last one is gone", () => {
    expect(
      resolveDefaults({
        ...input,
        params: { kind: "expense", accountId: "a3" },
      }),
    ).toMatchObject({ kind: "expense", accountId: "a3" });
    expect(
      resolveDefaults({ ...input, lastAccountId: "archived" }).accountId,
    ).toBe("a1");
    expect(
      resolveDefaults({ ...input, lastAccountId: null, defaultAccountId: null })
        .accountId,
    ).toBe("a1");
  });

  it("ignores an invalid kind and a category of the wrong kind", () => {
    expect(
      resolveDefaults({
        ...input,
        params: { kind: "bogus", categoryId: "pay" },
      }),
    ).toMatchObject({ kind: "income", categoryId: "pay" });
    expect(
      resolveDefaults({
        ...input,
        params: { kind: "expense", categoryId: "pay" },
      }).categoryId,
    ).toBeNull();
  });

  it("picks a different destination for transfers", () => {
    expect(
      resolveDefaults({ ...input, params: { kind: "transfer" } }),
    ).toMatchObject({ accountId: "a2", transferAccountId: "a1" });
  });

  it("kind change keeps a matching category and drops splits", () => {
    const draft = {
      accountId: "a1",
      categoryId: "food",
      transferAccountId: null,
    };
    expect(
      kindChangePatch(draft, "income", accounts, categories),
    ).toMatchObject({ categoryId: null, splits: null });
    expect(
      kindChangePatch(draft, "expense", accounts, categories).categoryId,
    ).toBe("food");
    expect(
      kindChangePatch(draft, "transfer", accounts, categories),
    ).toMatchObject({ categoryId: null, transferAccountId: "a2" });
  });
});

describe("remembered accounts", () => {
  const last = {
    expense: "a1",
    income: "a2",
    transfer: "a2",
    transfer_to: "a1",
  };
  const input = {
    params: {},
    lastKind: "expense" as const,
    lastAccountId: "a3",
    defaultAccountId: "a1",
    accounts,
    categories,
  };

  it("opens each kind on its own last account and the last transfer pair", () => {
    expect(
      resolveDefaults({
        ...input,
        lastAccounts: last,
        params: { kind: "income" },
      }).accountId,
    ).toBe("a2");
    expect(
      resolveDefaults({
        ...input,
        lastAccounts: last,
        params: { kind: "transfer" },
      }),
    ).toMatchObject({ accountId: "a2", transferAccountId: "a1" });
  });

  it("switches account when the kind changes, ignoring unknown ids", () => {
    const draft = {
      accountId: "a1",
      categoryId: null,
      transferAccountId: null,
    };
    expect(
      kindChangePatch(draft, "income", accounts, categories, last),
    ).toMatchObject({ accountId: "a2", receives: null });
    expect(
      kindChangePatch(draft, "income", accounts, categories, { income: "gone" })
        .accountId,
    ).toBeUndefined();
  });

  it("records the account per kind and the transfer destination, not lending", () => {
    expect(rememberAccounts({}, "transfer", "a1", "a2")).toEqual({
      transfer: "a1",
      transfer_to: "a2",
    });
    expect(rememberAccounts(last, "lent", "a1", null)).toBe(last);
  });
});

describe("save validation", () => {
  it("requires an amount, and a category (which shakes rather than disables)", () => {
    expect(saveBlock({ ...base, amount: 0 }, same)).toBe("amount");
    expect(isSaveDisabled("amount")).toBe(true);
    expect(saveBlock(base, same)).toBe("category");
    expect(isSaveDisabled("category")).toBe(false);
    expect(saveBlock({ ...base, categoryId: "food" }, same)).toBeNull();
  });

  it("blocks unbalanced splits and shakes on a missing split category", () => {
    const lines = startSplit(10000, "food");
    expect(saveBlock({ ...base, splits: lines }, same)).toBe("split_total");
    const balanced = updateSplitLine(
      updateSplitLine(lines, lines[0]!.key, { amount: 6000 }),
      lines[1]!.key,
      { amount: 4000 },
    );
    expect(saveBlock({ ...base, splits: balanced }, same)).toBe(
      "split_category",
    );
    const full = updateSplitLine(balanced, lines[1]!.key, {
      categoryId: "rent",
    });
    expect(saveBlock({ ...base, splits: full }, same)).toBeNull();
  });

  it("needs two different accounts and a receives amount across currencies", () => {
    const t: Draft = { ...base, kind: "transfer", transferAccountId: "a1" };
    expect(saveBlock(t, same)).toBe("accounts");
    const ok = { ...t, transferAccountId: "a2" };
    expect(saveBlock(ok, same)).toBeNull();
    expect(saveBlock(ok, { sameCurrency: false, receivesAmount: 0 })).toBe(
      "receives",
    );
    expect(
      saveBlock(ok, { sameCurrency: false, receivesAmount: 120 }),
    ).toBeNull();
  });

  it("prefills receives from the rate", () => {
    expect(autoReceives(100000, "INR", "USD", 0.012)).toBe(1200);
    expect(autoReceives(100000, "INR", "USD", null)).toBe(0);
    expect(autoReceives(5000, "INR", "INR", null)).toBe(5000);
  });
});

describe("draft to repo input", () => {
  it("maps an expense", () => {
    const d: Draft = {
      ...base,
      categoryId: "food",
      title: " Lunch ",
      memo: "x",
    };
    expect(buildTransactionInput(d, same, "rule1")).toMatchObject({
      kind: "expense",
      amount: 10000,
      accountId: "a1",
      categoryId: "food",
      recurringRuleId: "rule1",
      occurredAt: d.occurredAt,
    });
  });

  it("maps splits without a category", () => {
    const lines = startSplit(10000, "food");
    const balanced = updateSplitLine(
      updateSplitLine(lines, lines[0]!.key, { amount: 7000 }),
      lines[1]!.key,
      { amount: 3000, categoryId: "rent" },
    );
    const input = buildTransactionInput({ ...base, splits: balanced }, same);
    expect(input.splits).toEqual([
      { categoryId: "food", amount: 7000 },
      { categoryId: "rent", amount: 3000 },
    ]);
    expect(input.categoryId).toBeUndefined();
  });

  it("maps transfers with the receives amount only across currencies", () => {
    const t: Draft = { ...base, kind: "transfer", transferAccountId: "a2" };
    expect(buildTransactionInput(t, same).transferAmount).toBe(10000);
    expect(
      buildTransactionInput(t, { sameCurrency: false, receivesAmount: 120 })
        .transferAmount,
    ).toBe(120);
  });

  it("builds the rule with next_due after this first occurrence", () => {
    const d: Draft = {
      ...base,
      categoryId: "food",
      repeat: { frequency: "monthly", interval: 1, endDate: null },
    };
    const rule = buildRuleInput(d, same, "Food");
    expect(rule).toMatchObject({
      startDate: "2026-10-05",
      nextDue: "2026-11-05",
      frequency: "monthly",
      title: "Food",
      categoryId: "food",
    });
    const weekly = buildRuleInput(
      {
        ...d,
        repeat: { frequency: "weekly", interval: 2, endDate: "2027-01-01" },
      },
      same,
      "Food",
    );
    expect(weekly).toMatchObject({
      nextDue: "2026-10-19",
      endDate: "2027-01-01",
    });
    expect(buildRuleInput({ ...d, repeat: null }, same, "Food")).toBeNull();
  });

  it("uses the first split category for a repeating split", () => {
    const lines = startSplit(10000, "food");
    const rule = buildRuleInput(
      {
        ...base,
        splits: lines,
        repeat: { frequency: "daily", interval: 1, endDate: null },
      },
      same,
      "",
    );
    expect(rule?.categoryId).toBe("food");
  });
});

describe("labels and factories", () => {
  it("labels repeat and date", () => {
    expect(repeatLabel(null)).toBe("Never");
    expect(repeatLabel({ frequency: "monthly", interval: 1 })).toBe("Monthly");
    expect(repeatLabel({ frequency: "weekly", interval: 3 })).toBe(
      "Every 3 weeks",
    );
    expect(
      dateChipLabel(keyToLocalMs("2026-10-05", 14, 32), "2026-10-05"),
    ).toBe("Today 14:32");
    expect(dateChipLabel(keyToLocalMs("2026-10-04", 9, 5), "2026-10-05")).toBe(
      "Yesterday 09:05",
    );
    expect(
      dateChipLabel(keyToLocalMs("2026-10-05", 14, 32), "2026-10-05", false),
    ).toBe("Today");
  });

  it("keeps receives only for cross-currency transfers", () => {
    const src = {
      kind: "transfer" as const,
      title: "",
      memo: "",
      amount: 1000,
      currency: "INR",
      accountId: "a1",
      categoryId: null,
      transferAccountId: "a2",
      transferAmount: 12,
      transferCurrency: "USD",
      occurredAt: 1,
      splits: [],
    };
    expect(draftFromTransaction(src, 5)).toMatchObject({
      receives: 12,
      occurredAt: 5,
    });
    expect(
      draftFromTransaction(
        { ...src, transferCurrency: "INR", transferAmount: 1000 },
        5,
      ).receives,
    ).toBeNull();
  });
});

describe("lending drafts", () => {
  const lend: Draft = {
    ...base,
    kind: "lent",
    personId: "p1",
    title: "",
    tagIds: ["t1"],
  };

  it("maps a lend draft to a lending input with the person and tags, and no category", () => {
    expect(
      buildTransactionInput(
        { ...lend, categoryId: "food", title: "Rahul" },
        same,
      ),
    ).toMatchObject({
      kind: "lent",
      personId: "p1",
      categoryId: null,
      tagIds: ["t1"],
      amount: 10000,
    });
    expect(
      buildTransactionInput({ ...lend, kind: "borrowed" }, same).kind,
    ).toBe("borrowed");
  });

  it("needs a person but no category; amount blocks first", () => {
    expect(saveBlock({ ...lend, personId: null }, same)).toBe("person");
    expect(isSaveDisabled("person")).toBe(false);
    expect(saveBlock(lend, same)).toBeNull();
    expect(saveBlock({ ...lend, amount: 0, personId: null }, same)).toBe(
      "amount",
    );
  });

  it("defaults the title to the person only when nothing was typed", () => {
    expect(lendTitle(lend, "Rahul")).toBe("Rahul");
    expect(lendTitle({ ...lend, title: "Flights" }, "Rahul")).toBe("Flights");
    expect(lendTitle({ ...base, title: "" }, "Rahul")).toBe("");
    expect(titleAfterPerson("", undefined, "Rahul")).toBe("Rahul");
    expect(titleAfterPerson("Rahul", "Rahul", "Priya")).toBe("Priya");
    expect(titleAfterPerson("Flights", "Rahul", "Priya")).toBe("Flights");
  });

  it("puts every lending kind under the Lend segment with the right toggle labels", () => {
    expect(segmentOf("borrowed")).toBe("lend");
    expect(segmentOf("income")).toBe("income");
    expect(lendToggle("lent").kinds).toEqual(["lent", "borrowed"]);
    expect(lendToggle("repaid_by_me").labels).toEqual(["They paid", "I paid"]);
  });

  it("clears repeat and category when switching into lend", () => {
    const patch = kindChangePatch(
      { accountId: "a1", categoryId: "food", transferAccountId: null },
      "lent",
      accounts,
      categories,
    );
    expect(patch).toMatchObject({
      kind: "lent",
      categoryId: null,
      repeat: null,
      splits: null,
    });
  });

  it("never builds a recurring rule for lending", () => {
    const repeat = {
      frequency: "monthly" as const,
      interval: 1,
      endDate: null,
    };
    expect(buildRuleInput({ ...lend, repeat }, same, "x")).toBeNull();
  });

  it("round-trips person, tags and receipts through edit", () => {
    const draft = draftFromTransaction(
      {
        kind: "lent",
        title: "Rahul",
        memo: "",
        amount: 100,
        currency: "INR",
        accountId: "a1",
        categoryId: null,
        transferAccountId: null,
        transferAmount: null,
        transferCurrency: null,
        occurredAt: 1,
        splits: [],
        personId: "p1",
        tags: [{ id: "t1" }],
        attachments: [{ id: "att1", uri: "file://a.jpg", width: 1, height: 2 }],
      },
      1,
    );
    expect(draft).toMatchObject({
      kind: "lent",
      personId: "p1",
      tagIds: ["t1"],
    });
    expect(receiptChanges(draft.receipts, ["att1", "att2"])).toEqual({
      add: [],
      remove: ["att2"],
    });
    const added = [
      ...draft.receipts,
      { key: "n", uri: "file://b.jpg", width: null, height: null },
    ];
    expect(receiptChanges(added, ["att1"]).add.map((r) => r.uri)).toEqual([
      "file://b.jpg",
    ]);
    expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("budgetHint", () => {
  const budget = (
    name: string,
    scope: string,
    remaining: number,
    categoryIds: string[] = [],
    currency = "INR",
  ) => ({ budget: { name, scope, currency, categoryIds }, remaining });
  const budgets = [
    budget("Monthly spending", "all", 50000),
    budget("Food", "categories", 1200, ["food"]),
    budget("Treats", "categories", 300, ["food", "fun"]),
    budget("Travel", "categories", 9000, ["travel"], "USD"),
  ];

  it("uses the tightest category budget covering the expense", () => {
    expect(
      budgetHint(budgets, { categoryId: "food", currency: "INR", amount: 500 }),
    ).toEqual({ name: "Treats", left: 300, after: -200 });
  });

  it("falls back to the all-spending budget", () => {
    expect(
      budgetHint(budgets, {
        categoryId: "rent",
        currency: "INR",
        amount: 1000,
      }),
    ).toEqual({ name: "Monthly spending", left: 50000, after: 49000 });
  });

  it("never mixes currencies", () => {
    expect(
      budgetHint(budgets, {
        categoryId: "travel",
        currency: "USD",
        amount: 100,
      }),
    ).toEqual({ name: "Travel", left: 9000, after: 8900 });
    expect(
      budgetHint(budgets, { categoryId: "food", currency: "EUR", amount: 1 }),
    ).toBeNull();
  });
});
