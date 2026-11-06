import { diffDays, monthShort, parseKey } from "@studio/dates";

export type ParticleInput = {
  /** 0 is the oldest, 1 is today. */
  time: number;
  amount: number;
  group: string;
};

export type ParticleLayouts = {
  timeX: number[];
  timeY: number[];
  groupX: number[];
  groupY: number[];
  scale: number[];
  /** Middle and reach of each category's cluster, biggest first. */
  centers: { group: string; x: number; y: number; radius: number }[];
};

const MIN_SCALE = 0.1;
const MAX_SCALE = 0.42;
const CLUSTER_SPACING = 5.2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** A repeatable 0-1 scatter, so particles don't jump when the data reloads. */
const scatter = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Up to `max` month starts between two dates, as 0-1 positions on the time axis. */
export function monthTicks(
  from: string,
  to: string,
  max = 6,
): { label: string; time: number }[] {
  const span = Math.max(1, diffDays(from, to));
  const start = parseKey(from);
  const months: { key: string; month: number }[] = [];
  for (let i = 0; ; i += 1) {
    const zero = start.month - 1 + i;
    const month = (zero % 12) + 1;
    const year = start.year + Math.floor(zero / 12);
    const key = `${year}-${String(month).padStart(2, "0")}-01`;
    if (key > to) break;
    if (key >= from) months.push({ key, month });
  }
  const step = Math.max(1, Math.ceil(months.length / max));
  return months
    .filter((_, i) => i % step === 0)
    .map(({ key, month }) => ({ label: monthShort(month), time: diffDays(from, key) / span }));
}

/** Where each particle sits along the year, and where it sits in its category's cluster. */
export function particleLayouts(
  items: readonly ParticleInput[],
  width: number,
  height: number,
): ParticleLayouts {
  const amounts = items.map((p) => p.amount).sort((a, b) => a - b);
  const top = amounts[Math.floor(amounts.length * 0.97)] ?? 1;
  const groups = [...new Set(items.map((p) => p.group))];
  const counts = new Map<string, number>();
  for (const p of items) counts.set(p.group, (counts.get(p.group) ?? 0) + 1);
  const ordered = [...groups].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length * (width / Math.max(1, height)))));
  const rows = Math.max(1, Math.ceil(ordered.length / columns));
  const centers = new Map(
    ordered.map((group, i) => [
      group,
      {
        x: ((i % columns) + 0.5) * (width / columns),
        y: (Math.floor(i / columns) + 0.5) * (height / rows),
      },
    ]),
  );
  const seen = new Map<string, number>();
  const out: ParticleLayouts = {
    timeX: [],
    timeY: [],
    groupX: [],
    groupY: [],
    scale: [],
    centers: ordered.map((group) => ({
      group,
      ...centers.get(group)!,
      radius: CLUSTER_SPACING * Math.sqrt(Math.max(0, (counts.get(group) ?? 1) - 1)),
    })),
  };
  items.forEach((p, i) => {
    const size = Math.sqrt(Math.min(1, p.amount / Math.max(1, top)));
    out.scale.push(MIN_SCALE + (MAX_SCALE - MIN_SCALE) * size);
    out.timeX.push(12 + p.time * (width - 24));
    out.timeY.push(16 + scatter(i) * (height - 32));
    const index = seen.get(p.group) ?? 0;
    seen.set(p.group, index + 1);
    const center = centers.get(p.group) ?? { x: width / 2, y: height / 2 };
    const radius = CLUSTER_SPACING * Math.sqrt(index);
    const angle = index * GOLDEN_ANGLE;
    out.groupX.push(center.x + Math.cos(angle) * radius);
    out.groupY.push(center.y + Math.sin(angle) * radius);
  });
  return out;
}
