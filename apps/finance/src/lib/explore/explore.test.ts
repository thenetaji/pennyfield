import { coinCount, coinValue } from "./coins";
import { moneyMapTiles } from "./money-map";
import { monthTicks, particleLayouts } from "./particles";
import { nearestDot, spiralDots } from "./spiral";
import { monthMoneyRunsOut, spreadOf, whatIfForecast } from "./what-if";
import { workTimeLabel } from "./work-time";
import { askDigest } from "./ask-digest";

describe("moneyMapTiles", () => {
  const items = [
    { key: "a", name: "A", amount: 600, color: "red" },
    { key: "b", name: "B", amount: 300, color: "blue" },
    { key: "c", name: "C", amount: 100, color: "green" },
  ];

  it("gives bigger amounts bigger tiles that stay inside the map", () => {
    const tiles = moneyMapTiles(items, 300, 400);
    const area = (key: string) => {
      const t = tiles.find((x) => x.key === key)!;
      return t.width * t.height;
    };
    expect(area("a")).toBeGreaterThan(area("b"));
    expect(area("b")).toBeGreaterThan(area("c"));
    for (const t of tiles) {
      expect(t.x + t.width).toBeLessThanOrEqual(300);
      expect(t.y + t.height).toBeLessThanOrEqual(400);
    }
  });

  it("folds the smallest items into one tile and keeps the total", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      key: String(i),
      name: String(i),
      amount: 100 - i,
      color: "red",
    }));
    const tiles = moneyMapTiles(many, 300, 400);
    expect(tiles.length).toBe(14);
    expect(tiles.reduce((sum, t) => sum + t.amount, 0)).toBe(many.reduce((sum, t) => sum + t.amount, 0));
  });

  it("draws nothing before it has a size or without spending", () => {
    expect(moneyMapTiles(items, 0, 0)).toEqual([]);
    expect(moneyMapTiles([{ ...items[0]!, amount: 0 }], 300, 400)).toEqual([]);
  });
});

describe("whatIfForecast", () => {
  const input = {
    balance: 10000,
    monthlyIncome: 5000,
    monthlySpend: 4000,
    spread: 500,
    spendChangePercent: 0,
    extraIncome: 0,
    oneOff: 0,
    months: 12,
  };

  it("follows what's left over each month", () => {
    const end = whatIfForecast(input).at(-1)!;
    expect(end.mid).toBe(22000);
  });

  it("applies each change", () => {
    expect(whatIfForecast({ ...input, spendChangePercent: -50 }).at(-1)!.mid).toBe(46000);
    expect(whatIfForecast({ ...input, extraIncome: 1000 }).at(-1)!.mid).toBe(34000);
    expect(whatIfForecast({ ...input, oneOff: 3000 })[0]!.mid).toBe(7000);
  });

  it("is certain today and less certain later", () => {
    const points = whatIfForecast(input);
    expect(points[0]!.high).toBe(points[0]!.low);
    expect(points[12]!.high - points[12]!.low).toBeGreaterThan(points[1]!.high - points[1]!.low);
  });

  it("finds when the money runs out", () => {
    expect(monthMoneyRunsOut(whatIfForecast(input))).toBeNull();
    expect(monthMoneyRunsOut(whatIfForecast({ ...input, monthlySpend: 8000 }))).toBe(4);
  });

  it("has no spread with one month to go on", () => {
    expect(spreadOf([100])).toBe(0);
    expect(spreadOf([100, 300])).toBeGreaterThan(0);
  });
});

describe("workTimeLabel", () => {
  it("picks a sensible unit", () => {
    expect(workTimeLabel(25, 100)).toBe("15 min");
    expect(workTimeLabel(100, 100)).toBe("1 hour");
    expect(workTimeLabel(350, 100)).toBe("3.5 hours");
    expect(workTimeLabel(4000, 100)).toBe("5 work days");
  });
});

describe("spiralDots", () => {
  const days = Array.from({ length: 400 }, (_, i) => ({
    dateKey: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
    amount: i % 2 ? 100 : 0,
  }));

  it("lines the same date up across years", () => {
    const dots = spiralDots(days, 300);
    const center = 150;
    const angle = (i: number) => Math.atan2(dots[i]!.y - center, dots[i]!.x - center);
    expect(angle(365)).toBeCloseTo(angle(0), 5);
    expect(Math.hypot(dots[365]!.x - center, dots[365]!.y - center)).toBeGreaterThan(
      Math.hypot(dots[0]!.x - center, dots[0]!.y - center),
    );
  });

  it("stays inside the square, with spending days bigger than quiet ones", () => {
    const dots = spiralDots(days, 300);
    for (const d of dots) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x).toBeLessThanOrEqual(300);
    }
    expect(dots[1]!.r).toBeGreaterThan(dots[0]!.r);
  });

  it("picks the nearest dot, and none when touching far away", () => {
    const dots = spiralDots(days, 300);
    expect(nearestDot(dots, dots[10]!.x, dots[10]!.y)?.dateKey).toBe(days[10]!.dateKey);
    expect(nearestDot(dots, -500, -500)).toBeNull();
  });
});

describe("coins", () => {
  it("keeps the jar to a sensible number of round coins", () => {
    for (const total of [37, 900, 123456, 98765432]) {
      const value = coinValue(total);
      expect(coinCount(total, value)).toBeLessThanOrEqual(90);
      expect(String(value)).toMatch(/^[125]0*$/);
    }
  });

  it("shows any saving as at least one coin, and nothing for none", () => {
    expect(coinCount(1, 1000)).toBe(1);
    expect(coinCount(0, 1000)).toBe(0);
  });
});

describe("particleLayouts", () => {
  it("puts one entry per transaction in every layout, grouped by category", () => {
    const layouts = particleLayouts(
      [
        { time: 0, amount: 10, group: "a" },
        { time: 1, amount: 900, group: "a" },
        { time: 0.5, amount: 100, group: "b" },
      ],
      300,
      600,
    );
    expect(layouts.scale).toHaveLength(3);
    expect(layouts.timeX[1]).toBeGreaterThan(layouts.timeX[0]!);
    expect(layouts.scale[1]).toBeGreaterThan(layouts.scale[0]!);
    expect(Math.abs(layouts.groupX[0]! - layouts.groupX[1]!)).toBeLessThan(20);
  });
});

describe("askDigest", () => {
  it("gives totals per month and the biggest payees", () => {
    const digest = askDigest(
      [
        { kind: "expense", title: "Uber", dateKey: "2026-10-03", amount: 300, categoryName: "Transport" },
        { kind: "expense", title: "Uber", dateKey: "2026-10-05", amount: 200, categoryName: "Transport" },
        { kind: "income", title: "Salary", dateKey: "2026-10-01", amount: 9000, categoryName: "Pay" },
      ],
      "2026-11-06",
      (minor) => `$${minor}`,
    );
    expect(digest).toContain("Today is 2026-11-06.");
    expect(digest).toContain("2026-10: spent $500, earned $9000. Transport $500");
    expect(digest).toContain("Uber $500");
  });
});

describe("monthTicks", () => {
  it("marks each month start inside the range", () => {
    const ticks = monthTicks("2026-06-15", "2026-11-06");
    expect(ticks.map((t) => t.label)).toEqual(["Jul", "Aug", "Sep", "Oct", "Nov"]);
    expect(ticks[0]!.time).toBeGreaterThan(0);
    expect(ticks[4]!.time).toBeLessThan(1);
  });

  it("thins out a long range and crosses the new year", () => {
    const ticks = monthTicks("2025-11-07", "2026-11-06");
    expect(ticks.length).toBeLessThanOrEqual(6);
    expect(ticks[0]!.label).toBe("Dec");
  });
});
