const HOURS_IN_WORKDAY = 8;

/** A cost as time at work: "45 min", "3.5 hours", "6 work days". */
export function workTimeLabel(amount: number, hourlyPay: number): string {
  const hours = Math.abs(amount) / hourlyPay;
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < HOURS_IN_WORKDAY) {
    const rounded = Math.round(hours * 2) / 2;
    return `${rounded} ${rounded === 1 ? "hour" : "hours"}`;
  }
  const days = Math.round((hours / HOURS_IN_WORKDAY) * 2) / 2;
  return `${days} work ${days === 1 ? "day" : "days"}`;
}
