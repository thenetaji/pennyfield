import {
  canCreateTag,
  categoryBreakdown,
  nextTagColor,
  profitSummary,
  tagColorKey,
  tagPillColors,
  TAG_COLORS,
} from "./model";

describe("tag colours", () => {
  it("tints the pill from the palette colour", () => {
    expect(tagPillColors("#64D8A4")).toEqual({
      fg: "#64D8A4",
      bg: "rgba(100,216,164,0.16)",
      ring: "rgba(100,216,164,0.45)",
    });
  });

  it("falls back to gray for unknown keys and picks an unused colour next", () => {
    expect(tagColorKey("teal")).toBe("teal");
    expect(tagColorKey("chartreuse")).toBe("gray");
    expect(nextTagColor([])).toBe(TAG_COLORS[0]);
    expect(nextTagColor([{ color: TAG_COLORS[0]! }])).toBe(TAG_COLORS[1]);
  });
});

describe("create row", () => {
  it("offers to create only a new, non-empty name (case-insensitive)", () => {
    const tags = [{ name: "Goa trip" }];
    expect(canCreateTag("goa TRIP ", tags)).toBe(false);
    expect(canCreateTag("Goa", tags)).toBe(true);
    expect(canCreateTag("   ", tags)).toBe(false);
  });
});

describe("categoryBreakdown", () => {
  const food = { id: "f", name: "Food", color: "orange", icon: "food" };
  const fun = { id: "g", name: "Fun", color: "pink", icon: "party" };
  const identity = (minor: number) => minor;
  it("sums expenses per category, splits included, and ignores other kinds", () => {
    const rows = categoryBreakdown(
      [
        {
          kind: "expense",
          amount: 300,
          currency: "INR",
          category: food,
          splits: [],
        },
        {
          kind: "expense",
          amount: 500,
          currency: "INR",
          category: null,
          splits: [
            { amount: 200, category: food },
            { amount: 300, category: fun },
          ],
        },
        {
          kind: "income",
          amount: 9999,
          currency: "INR",
          category: fun,
          splits: [],
        },
        {
          kind: "lent",
          amount: 9999,
          currency: "INR",
          category: null,
          splits: [],
        },
      ],
      identity,
    );
    expect(rows.map((r) => [r.name, r.amount, r.share])).toEqual([
      ["Food", 500, 1],
      ["Fun", 300, 0.6],
    ]);
  });
});

describe("profitSummary", () => {
  const cat = (name: string) => ({ id: name, name, color: "blue", icon: "x" });
  const row = (
    kind: string,
    amount: number,
    dateKey: string,
    category = "Software",
    currency = "INR",
  ) => ({
    kind,
    amount,
    currency,
    dateKey,
    category: cat(category),
    splits: [],
  });
  const toInr = (minor: number, currency: string) =>
    currency === "USD" ? minor * 85 : minor;

  it("keeps income tax out of costs, takes it off after profit and groups by month", () => {
    const s = profitSummary(
      [
        row("income", 100, "2026-10-26", "Business", "USD"),
        row("expense", 2000, "2026-10-10"),
        row("expense", 500, "2026-11-04", "Proxies"),
        row("expense", 1000, "2026-11-07", "Income tax"),
        row("lent", 9999, "2026-11-01", ""),
      ],
      toInr,
    );
    expect(s).toMatchObject({
      revenue: 8500,
      costs: 2500,
      tax: 1000,
      profit: 6000,
      afterTax: 5000,
    });
    expect(s.margin).toBeCloseTo(6000 / 8500);
    expect(s.roi).toBeCloseTo(2.4);
    expect(s.months).toEqual([
      { month: "2026-11", revenue: 0, costs: 500, profit: -500 },
      { month: "2026-10", revenue: 8500, costs: 2000, profit: 6500 },
    ]);
  });

  it("has no margin without revenue and no ROI without costs", () => {
    expect(
      profitSummary([row("expense", 10, "2026-11-01")], toInr).margin,
    ).toBeNull();
    expect(
      profitSummary([row("income", 10, "2026-11-01")], toInr).roi,
    ).toBeNull();
  });
});
