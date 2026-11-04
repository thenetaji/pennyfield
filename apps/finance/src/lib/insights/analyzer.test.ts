import {
  dayPartOf,
  forecast,
  patterns,
  repeatPayments,
  unusualCategories,
  type AnalyzerLine,
} from "./analyzer";

let seq = 0;
const line = (
  dateKey: string,
  amount: number,
  extra: Partial<AnalyzerLine> = {},
): AnalyzerLine => ({
  transactionId: `t${++seq}`,
  title: "",
  accountId: "a",
  categoryId: "food",
  dateKey,
  hour: 13,
  amount,
  recurringRuleId: null,
  ...extra,
});

const NOV = { from: "2026-11-01", to: "2026-11-30" };
const OCT = { from: "2026-10-01", to: "2026-10-31" };
const SEP = { from: "2026-09-01", to: "2026-09-30" };
const AUG = { from: "2026-08-01", to: "2026-08-31" };

describe("forecast", () => {
  it("adds bills still due and the everyday pace for the days left", () => {
    const lines = Array.from({ length: 10 }, (_, i) =>
      line(`2026-11-${String(i + 1).padStart(2, "0")}`, 1000),
    );
    const result = forecast(lines, NOV, OCT, "2026-11-10", 5000);
    expect(result).toEqual({
      spent: 10000,
      projected: 10000 + 5000 + 1000 * 20,
      upcoming: 5000,
      perDay: 1000,
      daysLeft: 20,
    });
  });

  it("keeps recurring payments out of the everyday pace", () => {
    const lines = [
      line("2026-11-01", 30000, { recurringRuleId: "rent" }),
      ...Array.from({ length: 10 }, (_, i) =>
        line(`2026-11-${String(i + 1).padStart(2, "0")}`, 500),
      ),
    ];
    const result = forecast(lines, NOV, OCT, "2026-11-10", 0);
    expect(result?.perDay).toBe(500);
    expect(result?.projected).toBe(35000 + 500 * 20);
  });

  it("leans on last month's pace in the first days", () => {
    const october = Array.from({ length: 31 }, (_, i) =>
      line(`2026-10-${String(i + 1).padStart(2, "0")}`, 700),
    );
    // One big day on the 1st should not set the pace for the whole month.
    const result = forecast(
      [...october, line("2026-11-01", 7000)],
      NOV,
      OCT,
      "2026-11-01",
      0,
    );
    expect(result?.perDay).toBe(Math.round(7000 / 7 + 700 * (6 / 7)));
  });

  it("returns null outside the period", () => {
    expect(forecast([], NOV, OCT, "2026-12-02", 0)).toBeNull();
  });
});

describe("unusualCategories", () => {
  const history = [OCT, SEP, AUG];

  it("compares with earlier months cut at the same day", () => {
    const lines = [
      // Usual: 1,000 of food by the 10th; the rest of each month never counts.
      line("2026-10-05", 1000),
      line("2026-10-25", 9000),
      line("2026-09-05", 1000),
      line("2026-08-05", 1000),
      line("2026-11-03", 2000),
      line("2026-10-05", 1000, { categoryId: "travel" }),
      line("2026-09-05", 1000, { categoryId: "travel" }),
      line("2026-08-05", 1000, { categoryId: "travel" }),
      line("2026-11-04", 1000, { categoryId: "travel" }),
    ];
    expect(unusualCategories(lines, NOV, history, "2026-11-10")).toEqual([
      { categoryId: "food", amount: 2000, usual: 1000, percent: 100 },
    ]);
  });

  it("reports spending well below usual once a week has passed", () => {
    const lines = [
      line("2026-10-02", 4000),
      line("2026-09-02", 4000),
      line("2026-08-02", 4000),
      line("2026-11-02", 1000),
    ];
    expect(unusualCategories(lines, NOV, history, "2026-11-05")).toEqual([]);
    expect(
      unusualCategories(lines, NOV, history, "2026-11-12")[0],
    ).toMatchObject({ categoryId: "food", percent: -75 });
  });

  it("does not flag a category with nothing spent yet", () => {
    const lines = [
      line("2026-10-02", 4000),
      line("2026-09-02", 4000),
      line("2026-08-02", 4000),
    ];
    expect(unusualCategories(lines, NOV, history, "2026-11-20")).toEqual([]);
  });

  it("ignores differences too small to matter", () => {
    const lines = [
      line("2026-10-02", 100000, { categoryId: "rent" }),
      line("2026-09-02", 100000, { categoryId: "rent" }),
      line("2026-08-02", 100000, { categoryId: "rent" }),
      line("2026-11-02", 100000, { categoryId: "rent" }),
      line("2026-10-02", 100, { categoryId: "coffee" }),
      line("2026-09-02", 100, { categoryId: "coffee" }),
      line("2026-08-02", 100, { categoryId: "coffee" }),
      line("2026-11-02", 400, { categoryId: "coffee" }),
    ];
    expect(unusualCategories(lines, NOV, history, "2026-11-05")).toEqual([]);
  });
});

describe("patterns", () => {
  it("splits spending by part of day and weekday, counting a split once", () => {
    const lines = [
      line("2026-11-02", 300, { hour: 8, transactionId: "breakfast" }),
      line("2026-11-02", 600, { hour: 20, transactionId: "dinner" }),
      line("2026-11-02", 100, { hour: 20, transactionId: "dinner" }),
      line("2026-11-03", 1000, { hour: 1, transactionId: "late" }),
    ];
    const result = patterns(lines, NOV);
    expect(result.count).toBe(3);
    expect(result.average).toBe(667);
    expect(result.median).toBe(700);
    expect(result.largestShare).toBe(50);
    expect(result.dayParts.map((p) => [p.part, p.amount, p.count])).toEqual([
      ["morning", 300, 1],
      ["afternoon", 0, 0],
      ["evening", 700, 1],
      ["night", 1000, 1],
    ]);
    // 2 Nov 2026 is a Monday.
    expect(result.weekdays[0]).toEqual({
      weekday: 1,
      amount: 1000,
      percent: 50,
    });
  });

  it("puts the small hours in the night", () => {
    expect(dayPartOf(0)).toBe("night");
    expect(dayPartOf(4)).toBe("night");
    expect(dayPartOf(5)).toBe("morning");
    expect(dayPartOf(23)).toBe("night");
  });
});

describe("repeatPayments", () => {
  const gym = (dateKey: string, amount = 1500, extra = {}) =>
    line(dateKey, amount, {
      title: "Cult Fit",
      categoryId: "fitness",
      ...extra,
    });

  it("finds a monthly payment that is not set up yet", () => {
    const lines = [
      gym("2026-08-05"),
      gym("2026-09-05"),
      gym("2026-10-06", 1550),
      gym("2026-11-05"),
    ];
    expect(repeatPayments(lines, "2026-11-10")).toEqual([
      {
        title: "Cult Fit",
        amount: 1500,
        cadence: "monthly",
        count: 4,
        lastDate: "2026-11-05",
        nextDate: "2026-12-05",
        categoryId: "fitness",
        accountId: "a",
        yearly: 1500 * 12,
      },
    ]);
  });

  it("finds weekly ones and matches titles loosely", () => {
    const lines = ["2026-10-13", "2026-10-20", "2026-10-27", "2026-11-03"].map(
      (d, i) =>
        line(d, 200, { title: i % 2 ? " milk  delivery" : "Milk delivery" }),
    );
    expect(repeatPayments(lines, "2026-11-05")).toMatchObject([
      { cadence: "weekly", count: 4, nextDate: "2026-11-10", yearly: 200 * 52 },
    ]);
  });

  it("skips what is already recurring, irregular or stopped", () => {
    const linked = ["2026-08-01", "2026-09-01", "2026-10-01"].map((d) =>
      line(d, 900, { title: "Netflix", recurringRuleId: null }),
    );
    expect(repeatPayments(linked, "2026-10-05", new Set(["netflix"]))).toEqual(
      [],
    );
    const irregular = [
      "2026-08-01",
      "2026-08-04",
      "2026-09-20",
      "2026-10-01",
    ].map((d) => line(d, 500, { title: "Uber" }));
    expect(repeatPayments(irregular, "2026-10-05")).toEqual([]);
    const stopped = [gym("2026-04-05"), gym("2026-05-05"), gym("2026-06-05")];
    expect(repeatPayments(stopped, "2026-11-10")).toEqual([]);
  });

  it("does not mix very different amounts from the same payee", () => {
    const lines = [
      line("2026-08-03", 400, { title: "Amazon" }),
      line("2026-09-03", 6000, { title: "Amazon" }),
      line("2026-10-03", 120, { title: "Amazon" }),
    ];
    expect(repeatPayments(lines, "2026-10-10")).toEqual([]);
  });
});
