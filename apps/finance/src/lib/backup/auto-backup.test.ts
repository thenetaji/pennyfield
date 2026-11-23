import { backupDue, isoWeek, staleWeeklies, weeklyName } from "./auto-backup";

describe("automatic backup", () => {
  it("names weeks the ISO way", () => {
    expect(isoWeek(new Date(2026, 10, 23))).toBe("2026-W48");
    expect(isoWeek(new Date(2027, 0, 1))).toBe("2026-W53");
  });

  it("keeps eight weekly copies and rewrites this week's", () => {
    const now = new Date(2026, 10, 23);
    const names = [
      "Pennyfield backup.json",
      weeklyName("2026-W48"),
      weeklyName("2026-W41"),
      weeklyName("2026-W40"),
      weeklyName("2025-W48"),
      "Pennyfield backup notes.json",
      "holiday.json",
    ];
    expect(staleWeeklies(names, now)).toEqual([
      weeklyName("2026-W48"),
      weeklyName("2026-W40"),
      weeklyName("2025-W48"),
    ]);
  });

  it("is due once a day", () => {
    expect(backupDue(null, 1)).toBe(true);
    expect(backupDue(0, 23 * 3_600_000)).toBe(false);
    expect(backupDue(0, 24 * 3_600_000)).toBe(true);
  });
});
