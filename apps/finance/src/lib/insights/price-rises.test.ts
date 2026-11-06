import { priceRises } from "./price-rises";

const pay = (id: string, title: string, dateKey: string, amount: number) => ({
  transactionId: id,
  title,
  dateKey,
  amount,
});

describe("priceRises", () => {
  it("finds a steady payment whose latest amount went up", () => {
    const rises = priceRises(
      [
        pay("1", "Netflix", "2026-08-01", 64900),
        pay("2", "Netflix", "2026-09-01", 64900),
        pay("3", "Netflix", "2026-10-01", 64900),
        pay("4", "Netflix", "2026-11-01", 79900),
      ],
      "2026-11-06",
    );
    expect(rises).toEqual([
      { title: "Netflix", from: 64900, to: 79900, percent: 23, dateKey: "2026-11-01" },
    ]);
  });

  it("adds split lines of one transaction before comparing", () => {
    const rises = priceRises(
      [
        pay("1", "Gym", "2026-09-01", 1000),
        pay("2", "Gym", "2026-10-01", 1000),
        pay("3", "Gym", "2026-11-01", 700),
        pay("3", "Gym", "2026-11-01", 700),
      ],
      "2026-11-06",
    );
    expect(rises[0]?.to).toBe(1400);
  });

  it("ignores spending that was never steady", () => {
    expect(
      priceRises(
        [
          pay("1", "Uber", "2026-09-01", 200),
          pay("2", "Uber", "2026-10-01", 650),
          pay("3", "Uber", "2026-11-01", 900),
        ],
        "2026-11-06",
      ),
    ).toEqual([]);
  });

  it("ignores small changes and old rises", () => {
    const steady = [pay("1", "Rent", "2026-01-01", 10000), pay("2", "Rent", "2026-02-01", 10000)];
    expect(priceRises([...steady, pay("3", "Rent", "2026-11-01", 10300)], "2026-11-06")).toEqual([]);
    expect(priceRises([...steady, pay("3", "Rent", "2026-03-01", 12000)], "2026-11-06")).toEqual([]);
  });
});
