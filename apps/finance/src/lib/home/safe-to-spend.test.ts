import { spendOutlook } from "./safe-to-spend";

const base = { upcoming: 0, daysLeft: 10, elapsedDays: 20, totalDays: 30 };

describe("spendOutlook", () => {
  it("shares what's left across the remaining days", () => {
    expect(spendOutlook({ ...base, spent: 6000, available: 10000 })).toEqual({
      type: "safe",
      perDay: 400,
      daysLeft: 10,
      afterBills: false,
    });
  });

  it("sets aside bills due before the period ends", () => {
    expect(spendOutlook({ ...base, spent: 6000, available: 10000, upcoming: 3000 })).toMatchObject({
      perDay: 100,
      afterBills: true,
    });
  });

  it("says how far over when bills or spending pass the budget", () => {
    expect(spendOutlook({ ...base, spent: 9000, available: 10000, upcoming: 2000 })).toEqual({
      type: "over",
      amount: 1000,
      daysLeft: 10,
    });
  });

  it("forecasts from the pace when there is no budget", () => {
    expect(spendOutlook({ ...base, spent: 2000, available: null })).toEqual({
      type: "forecast",
      total: 3000,
    });
    expect(spendOutlook({ ...base, spent: 0, available: null })).toBeNull();
  });

  it("counts the last day as one day", () => {
    expect(spendOutlook({ ...base, daysLeft: 0, spent: 0, available: 500 })).toMatchObject({
      perDay: 500,
      daysLeft: 1,
    });
  });
});
