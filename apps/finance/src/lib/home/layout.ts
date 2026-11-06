/** Home sections the owner can reorder and hide. The hero (greeting, amount, chart) always stays on top. */
export const HOME_SECTION_IDS = [
  "budgets",
  "bills",
  "top_categories",
  "week",
  "quick_add",
  "recent",
  "accounts",
  "pockets",
] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

export interface HomeSectionPref {
  id: HomeSectionId;
  visible: boolean;
}

export const HOME_SECTION_LABELS: Record<HomeSectionId, string> = {
  accounts: "Accounts",
  quick_add: "Quick add",
  pockets: "Pocket money",
  budgets: "Budgets",
  bills: "Upcoming bills",
  top_categories: "Top categories",
  week: "Last 7 days",
  recent: "Recent",
};

/** The question each section answers; Home prints it when the question changes on the way down. */
export const HOME_CHAPTERS: Record<HomeSectionId, string> = {
  budgets: "What's ahead",
  bills: "What's ahead",
  top_categories: "Where it went",
  week: "What just happened",
  quick_add: "What just happened",
  recent: "What just happened",
  accounts: "What you have",
  pockets: "What you have",
};

/** The default before the sections followed that story; a layout still in this order moves to the new one. */
const PREVIOUS_DEFAULT_ORDER: readonly string[] = [
  "accounts",
  "quick_add",
  "pockets",
  "budgets",
  "bills",
  "top_categories",
  "recent",
];

export const DEFAULT_HOME_LAYOUT: readonly HomeSectionPref[] =
  HOME_SECTION_IDS.map((id) => ({ id, visible: true }));

const isSectionId = (value: unknown): value is HomeSectionId =>
  typeof value === "string" &&
  (HOME_SECTION_IDS as readonly string[]).includes(value);

/** Sections added in a later build that should land after a given section instead of at the end. */
const INSERT_AFTER: Partial<Record<HomeSectionId, HomeSectionId>> = {
  pockets: "quick_add",
  week: "top_categories",
};

/** Sections added in a later build that belong at the top, under the hero. */
const INSERT_FIRST: ReadonlySet<HomeSectionId> = new Set(["accounts"]);

/**
 * Stored ids from earlier builds and what replaced them, in place and with the same visibility: "Coming up" (next
 * bill and overall budget) became the Budgets and Upcoming bills cards. "Summary" (Earned, Daily avg, Balance) moved
 * into the hero, so it maps to nothing.
 */
const RENAMED: Record<string, readonly HomeSectionId[]> = {
  coming_up: ["budgets", "bills"],
  stats: [],
};

/**
 * Repairs a stored layout: drops unknown and duplicate ids, coerces `visible` to a boolean and adds any
 * section the stored value does not mention, visible, at the end (or after its `INSERT_AFTER` anchor).
 */
export function normalizeHomeLayout(value: unknown): HomeSectionPref[] {
  if (
    Array.isArray(value) &&
    value.length === PREVIOUS_DEFAULT_ORDER.length &&
    value.every((s, i) => (s as { id?: unknown } | null)?.id === PREVIOUS_DEFAULT_ORDER[i])
  ) {
    const hidden = new Set(
      value.flatMap((s: { id: string; visible?: unknown }) =>
        s.visible === false ? [s.id] : [],
      ),
    );
    return HOME_SECTION_IDS.map((id) => ({ id, visible: !hidden.has(id) }));
  }
  const out: HomeSectionPref[] = [];
  const seen = new Set<HomeSectionId>();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const raw = (entry as { id?: unknown } | null)?.id;
      const visible =
        (entry as { visible?: unknown } | null)?.visible !== false;
      const ids =
        typeof raw === "string" && raw in RENAMED
          ? (RENAMED[raw] ?? [])
          : [raw];
      for (const id of ids) {
        if (!isSectionId(id) || seen.has(id)) continue;
        seen.add(id);
        out.push({ id, visible });
      }
    }
  }
  if (out.length === 0) return DEFAULT_HOME_LAYOUT.map((s) => ({ ...s }));
  for (const id of HOME_SECTION_IDS) {
    if (seen.has(id)) continue;
    if (INSERT_FIRST.has(id)) {
      out.unshift({ id, visible: true });
      continue;
    }
    const anchor = INSERT_AFTER[id];
    const at = anchor ? out.findIndex((s) => s.id === anchor) : -1;
    if (at >= 0) out.splice(at + 1, 0, { id, visible: true });
    else out.push({ id, visible: true });
  }
  return out;
}

/** Moves the section at `index` by `delta` places; out-of-range moves return the layout unchanged. */
export function moveHomeSection(
  layout: readonly HomeSectionPref[],
  index: number,
  delta: -1 | 1,
): HomeSectionPref[] {
  const target = index + delta;
  if (
    index < 0 ||
    index >= layout.length ||
    target < 0 ||
    target >= layout.length
  )
    return [...layout];
  const next = [...layout];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item as HomeSectionPref);
  return next;
}

export function setHomeSectionVisible(
  layout: readonly HomeSectionPref[],
  id: HomeSectionId,
  visible: boolean,
): HomeSectionPref[] {
  return layout.map((s) => (s.id === id ? { ...s, visible } : s));
}

export function isDefaultHomeLayout(
  layout: readonly HomeSectionPref[],
): boolean {
  return (
    layout.length === DEFAULT_HOME_LAYOUT.length &&
    layout.every((s, i) => s.id === DEFAULT_HOME_LAYOUT[i]?.id && s.visible)
  );
}
