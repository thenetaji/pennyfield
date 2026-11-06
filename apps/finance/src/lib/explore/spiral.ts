export type SpiralDay = { dateKey: string; amount: number };
export type SpiralDot = SpiralDay & { x: number; y: number; r: number };

const MIN_DOT = 1.2;
const MAX_DOT = 7;

function dayOfYear(dateKey: string): number {
  const [year = 2000, month = 1, day = 1] = dateKey.split("-").map(Number);
  return (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86400000;
}

/** Most days fit under a high percentile, so one rent payment doesn't shrink every other dot. */
function scaleOf(days: readonly SpiralDay[]): number {
  const spends = days.map((d) => d.amount).filter((a) => a > 0).sort((a, b) => a - b);
  return spends[Math.floor(spends.length * 0.95)] ?? 1;
}

/** January sits at the top and the year runs clockwise, so a date lines up across years; oldest is at the centre. */
export function spiralDots(days: readonly SpiralDay[], size: number): SpiralDot[] {
  if (days.length === 0 || size <= 0) return [];
  const center = size / 2;
  const inner = size * 0.08;
  const outer = size / 2 - MAX_DOT - 14;
  const scale = scaleOf(days);
  return days.map((day, i) => {
    const radius = inner + ((outer - inner) * i) / Math.max(1, days.length - 1);
    const angle = (dayOfYear(day.dateKey) / 365.25) * 2 * Math.PI - Math.PI / 2;
    const level = Math.sqrt(Math.min(1, day.amount / scale));
    return {
      ...day,
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
      r: day.amount > 0 ? MIN_DOT + (MAX_DOT - MIN_DOT) * level : MIN_DOT * 0.7,
    };
  });
}

export function nearestDot(
  dots: readonly SpiralDot[],
  x: number,
  y: number,
  within = 22,
): SpiralDot | null {
  let best: SpiralDot | null = null;
  let bestDistance = within * within;
  for (const dot of dots) {
    const distance = (dot.x - x) ** 2 + (dot.y - y) ** 2;
    if (distance < bestDistance) {
      best = dot;
      bestDistance = distance;
    }
  }
  return best;
}
