import type { IconBackground } from "./types";

export type TileSpec = {
  kind: "none" | "plain";
  /** Icon size as a fraction of the tile footprint. */
  iconScale: number;
  icon: string;
  base?: string;
};

const CORNER = 0.3;
export const tileRadius = (size: number) => Math.round(size * CORNER * 10) / 10;

/** `color` is the tile fill, or the symbol's colour when there is no tile. */
export function tileSpec(background: IconBackground, color: string): TileSpec {
  if (background === "glyph-only") return { kind: "none", iconScale: 0.66, icon: color };
  return { kind: "plain", iconScale: 0.58, icon: "#FFFFFF", base: color };
}
