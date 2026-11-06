export type SpendOutlook =
  | { type: "safe"; perDay: number; daysLeft: number; afterBills: boolean }
  | { type: "over"; amount: number; daysLeft: number }
  | { type: "forecast"; total: number };

/** With a budget: what can go out per day once bills due this period are set aside. Without one: where this pace ends up. */
export function spendOutlook(input: {
  spent: number;
  /** Budget for the period; null when there is none. */
  available: number | null;
  /** Unposted bills due before the period ends. */
  upcoming: number;
  /** Days left, counting today. */
  daysLeft: number;
  elapsedDays: number;
  totalDays: number;
}): SpendOutlook | null {
  const { spent, available, upcoming, daysLeft, elapsedDays, totalDays } = input;
  if (available === null) {
    if (spent <= 0 || elapsedDays <= 0) return null;
    return { type: "forecast", total: Math.round((spent / elapsedDays) * totalDays) };
  }
  const days = Math.max(1, daysLeft);
  const free = available - spent - upcoming;
  if (free < 0) return { type: "over", amount: -free, daysLeft: days };
  return {
    type: "safe",
    perDay: Math.floor(free / days),
    daysLeft: days,
    afterBills: upcoming > 0,
  };
}
