import type { IconBackground } from "./types";

/** `#RRGGBB` at `alpha`. */
const tint = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${alpha})`;
};

export type TileSpec = {
  kind: "none" | "plain";
  /** Icon size as a fraction of the tile footprint. */
  iconScale: number;
  icon: string;
  base?: string;
};

const CORNER = 0.3;
export const tileRadius = (size: number) => Math.round(size * CORNER * 10) / 10;

/** `color` is the category colour for the current scheme (from tokens), so theme changes flow through. */
export function tileSpec(
  background: IconBackground,
  dark: boolean,
  color: string,
): TileSpec {
  if (background === "glyph-only") return { kind: "none", iconScale: 0.66, icon: color };
  return {
    kind: "plain",
    iconScale: 0.54,
    icon: color,
    base: tint(color, dark ? 0.2 : 0.13),
  };
}
