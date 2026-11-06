import { tileSpec } from "./tile-styles";
import { ICON_BACKGROUNDS } from "./types";

describe("tile specs", () => {
  it("defines every treatment in both schemes", () => {
    for (const bg of ICON_BACKGROUNDS)
      for (const dark of [true, false])
        expect(tileSpec(bg, dark, "#5B86E0").icon).toBe("#5B86E0");
  });

  it("has no tile for glyph-only", () => {
    expect(tileSpec("glyph-only", true, "#5B86E0").kind).toBe("none");
  });
});
