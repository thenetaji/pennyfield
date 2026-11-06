export type WhatIfInput = {
  balance: number;
  monthlyIncome: number;
  monthlySpend: number;
  /** Month-to-month spread of what was left over; sets how wide the forecast band grows. */
  spread: number;
  spendChangePercent: number;
  extraIncome: number;
  oneOff: number;
  months: number;
};

export type WhatIfPoint = { month: number; mid: number; low: number; high: number };

/** Balance month by month. The band widens with the square root of time, as independent monthly swings do. */
export function whatIfForecast(input: WhatIfInput): WhatIfPoint[] {
  const spend = input.monthlySpend * (1 + input.spendChangePercent / 100);
  const net = input.monthlyIncome + input.extraIncome - spend;
  const start = input.balance - input.oneOff;
  return Array.from({ length: input.months + 1 }, (_, month) => {
    const mid = start + net * month;
    const swing = input.spread * Math.sqrt(month);
    return { month, mid, low: mid - swing, high: mid + swing };
  });
}

export function spreadOf(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.sqrt(
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1),
  );
}

/** First month the middle line goes below zero, or null when it never does. */
export function monthMoneyRunsOut(points: readonly WhatIfPoint[]): number | null {
  return points.find((p) => p.mid < 0)?.month ?? null;
}
