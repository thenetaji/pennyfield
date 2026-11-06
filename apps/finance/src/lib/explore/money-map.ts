import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";

export type MapItem = { key: string; name: string; amount: number; color: string; icon?: string };
export type MapTile = MapItem & { x: number; y: number; width: number; height: number };

const GAP = 3;
const MAX_TILES = 14;

/** Keeps a map readable: everything past the biggest few folds into one "Other" tile. */
function foldSmall(items: readonly MapItem[]): MapItem[] {
  const sorted = items.filter((i) => i.amount > 0).sort((a, b) => b.amount - a.amount);
  if (sorted.length <= MAX_TILES) return sorted;
  const rest = sorted.slice(MAX_TILES - 1);
  return [
    ...sorted.slice(0, MAX_TILES - 1),
    {
      key: "other",
      name: `${rest.length} more`,
      amount: rest.reduce((sum, i) => sum + i.amount, 0),
      color: "gray",
    },
  ];
}

/** Squarified layout: each tile's area is its share of the total. */
export function moneyMapTiles(
  items: readonly MapItem[],
  width: number,
  height: number,
): MapTile[] {
  if (width <= 0 || height <= 0) return [];
  const leaves = foldSmall(items);
  if (leaves.length === 0) return [];
  const root = hierarchy<{ children?: MapItem[]; amount?: number }>({ children: leaves })
    .sum((d) => d.amount ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  treemap<{ children?: MapItem[]; amount?: number }>()
    .tile(treemapSquarify.ratio(1.2))
    .size([width, height])
    .paddingInner(GAP)
    .round(true)(root);
  return root.leaves().map((leaf) => {
    const node = leaf as unknown as { x0: number; y0: number; x1: number; y1: number };
    return {
      ...(leaf.data as MapItem),
      x: node.x0,
      y: node.y0,
      width: node.x1 - node.x0,
      height: node.y1 - node.y0,
    };
  });
}

/** Sums lines into one map item per key. */
export function groupInto<T extends { amount: number }>(
  lines: readonly T[],
  describe: (line: T) => { key: string; name: string; color: string; icon?: string },
): MapItem[] {
  const groups = new Map<string, MapItem>();
  for (const line of lines) {
    const { key, name, color, icon } = describe(line);
    const group = groups.get(key);
    if (group) group.amount += line.amount;
    else groups.set(key, { key, name, color, icon, amount: line.amount });
  }
  return [...groups.values()];
}
