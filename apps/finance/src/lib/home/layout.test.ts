import {
  DEFAULT_HOME_LAYOUT,
  HOME_SECTION_IDS,
  isDefaultHomeLayout,
  moveHomeSection,
  normalizeHomeLayout,
  setHomeSectionVisible,
} from "./layout";

describe("normalizeHomeLayout", () => {
  it("moves a layout still in the old default order to the new one, keeping what was hidden", () => {
    const old = ["accounts", "quick_add", "pockets", "budgets", "bills", "top_categories", "recent"];
    const layout = normalizeHomeLayout(
      old.map((id) => ({ id, visible: id !== "bills" })),
    );
    expect(layout.map((s) => s.id)).toEqual([...HOME_SECTION_IDS]);
    expect(layout.find((s) => s.id === "bills")?.visible).toBe(false);
    expect(layout.find((s) => s.id === "week")?.visible).toBe(true);
  });

  it("returns the default for missing or malformed values", () => {
    expect(normalizeHomeLayout(undefined)).toEqual(DEFAULT_HOME_LAYOUT);
    expect(normalizeHomeLayout("nope")).toEqual(DEFAULT_HOME_LAYOUT);
    expect(normalizeHomeLayout([null, 3, {}])).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it("keeps the stored order, drops unknown and duplicate ids, and appends missing sections", () => {
    const layout = normalizeHomeLayout([
      { id: "recent", visible: false },
      { id: "widgets", visible: true },
      { id: "quick_add", visible: true },
      { id: "recent", visible: true },
    ]);
    expect(layout.map((s) => s.id)).toEqual([
      "accounts",
      "recent",
      "quick_add",
      "pockets",
      ...HOME_SECTION_IDS.filter(
        (id) =>
          id !== "accounts" &&
          id !== "recent" &&
          id !== "quick_add" &&
          id !== "pockets",
      ),
    ]);
    expect(layout[1]).toEqual({ id: "recent", visible: false });
    expect(
      layout.filter((s) => s.id !== "recent").every((s) => s.visible),
    ).toBe(true);
  });

  it("replaces Coming up with Budgets and Upcoming bills in place, and drops Summary and the heatmap", () => {
    const layout = normalizeHomeLayout([
      { id: "quick_add", visible: true },
      { id: "stats", visible: true },
      { id: "pockets", visible: true },
      { id: "coming_up", visible: false },
      { id: "heatmap", visible: true },
      { id: "top_categories", visible: true },
      { id: "recent", visible: true },
    ]);
    expect(layout).toEqual([
      { id: "accounts", visible: true },
      { id: "quick_add", visible: true },
      { id: "pockets", visible: true },
      { id: "budgets", visible: false },
      { id: "bills", visible: false },
      { id: "top_categories", visible: true },
      { id: "week", visible: true },
      { id: "recent", visible: true },
    ]);
  });

  it("treats anything but an explicit false as visible", () => {
    expect(normalizeHomeLayout([{ id: "recent" }])[1]).toEqual({
      id: "recent",
      visible: true,
    });
  });
});

describe("moveHomeSection", () => {
  it("swaps neighbours and ignores moves past either end", () => {
    const moved = moveHomeSection(DEFAULT_HOME_LAYOUT, 2, -1);
    expect(moved.slice(1, 3).map((s) => s.id)).toEqual([
      "top_categories",
      "bills",
    ]);
    expect(moveHomeSection(DEFAULT_HOME_LAYOUT, 0, -1)).toEqual(
      DEFAULT_HOME_LAYOUT,
    );
    expect(
      moveHomeSection(DEFAULT_HOME_LAYOUT, DEFAULT_HOME_LAYOUT.length - 1, 1),
    ).toEqual(DEFAULT_HOME_LAYOUT);
  });
});

describe("isDefaultHomeLayout", () => {
  it("is false once a section is hidden or moved", () => {
    expect(isDefaultHomeLayout(DEFAULT_HOME_LAYOUT)).toBe(true);
    expect(
      isDefaultHomeLayout(
        setHomeSectionVisible(DEFAULT_HOME_LAYOUT, "recent", false),
      ),
    ).toBe(false);
    expect(
      isDefaultHomeLayout(moveHomeSection(DEFAULT_HOME_LAYOUT, 2, 1)),
    ).toBe(false);
  });
});
