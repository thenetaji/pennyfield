import { merchantHistory } from "./useMerchantHistory";

const row = (id: string, title: string, amount: number, day: number, currency = "INR") => ({
  id,
  title,
  amount,
  currency,
  dateKey: `2026-10-${String(day).padStart(2, "0")}`,
  occurredAt: day,
});

describe("merchantHistory", () => {
  it("combines spellings and places the payment among them", () => {
    const rows = [
      row("a", "Tikhub", 300, 1),
      row("b", "TIKHUB.com", 500, 8),
      row("c", "Tikhub Pvt Ltd", 400, 15),
      row("d", "Swiggy", 900, 3),
      row("e", "Tikhub", 999, 4, "USD"),
    ];
    expect(merchantHistory(rows, { id: "b", title: "tikhub", currency: "INR" })).toEqual({
      payments: [
        { id: "a", amount: 300, dateKey: "2026-10-01", occurredAt: 1 },
        { id: "b", amount: 500, dateKey: "2026-10-08", occurredAt: 8 },
        { id: "c", amount: 400, dateKey: "2026-10-15", occurredAt: 15 },
      ],
      position: 2,
      total: 1200,
      average: 400,
      firstDate: "2026-10-01",
    });
  });

  it("needs at least two payments", () => {
    expect(merchantHistory([row("a", "Tikhub", 300, 1)], { id: "a", title: "Tikhub", currency: "INR" })).toBeNull();
  });
});
