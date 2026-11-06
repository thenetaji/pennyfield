import { conceptMeta, sfAliases, type ConceptMeta } from "./generated/concepts";
import type { IconStyle } from "./types";

type Pack = { viewBox: number; bodies: Record<string, string> };

/** Pick the pack lazily: with inline requires the unused styles are never evaluated at runtime. */
function loadPack(style: IconStyle): Pack {
  /* eslint-disable @typescript-eslint/no-require-imports */
  switch (style) {
    case "phosphor-fill":
      return require("./generated/phosphorFill") as Pack;
    case "lucide":
      return require("./generated/lucide") as Pack;
  }
  /* eslint-enable @typescript-eslint/no-require-imports */
}

export const FALLBACK_CONCEPT = "tag";

const metaById = new Map<string, ConceptMeta>(
  conceptMeta.map((c) => [c.id, c]),
);

/** Resolve a stored name (concept id, SF Symbol name or old fallback name) to a concept id. */
export function conceptFor(name: string | null | undefined): string {
  if (!name) return FALLBACK_CONCEPT;
  if (metaById.has(name)) return name;
  const alias = sfAliases[name];
  if (alias) return alias;
  const bare = name.replace(/\.fill$/, "");
  return sfAliases[bare] ?? sfAliases[`${bare}.fill`] ?? FALLBACK_CONCEPT;
}

/** True when the name maps to a known concept (not the fallback). */
export function isKnownIcon(name: string): boolean {
  return metaById.has(name) || name in sfAliases;
}

export function conceptLabel(id: string): string {
  return metaById.get(conceptFor(id))?.label ?? "Icon";
}

const cache = new Map<string, string>();

/** SVG markup for a concept in a style. Cached: tiles repeat across lists. */
export function iconXml(style: IconStyle, id: string): string {
  const key = `${style}|${id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pack = loadPack(style);
  const body = pack.bodies[id] ?? pack.bodies[FALLBACK_CONCEPT] ?? "";
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pack.viewBox} ${pack.viewBox}">${body}</svg>`;
  if (cache.size > 2000) cache.clear();
  cache.set(key, xml);
  return xml;
}

export { conceptMeta };
export type { ConceptMeta };
