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
  if (background === "soft") {
    const tint = softTint(color);
    if (tint) return { kind: "plain", iconScale: 0.58, icon: color, base: tint };
  }
  return { kind: "plain", iconScale: 0.58, icon: "#FFFFFF", base: color };
}

/** The colour at low opacity, for a light tile under a coloured symbol; null when it isn't a #RRGGBB hex. */
function softTint(color: string): string | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return null;
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
  return `rgba(${r},${g},${b},0.16)`;
}
