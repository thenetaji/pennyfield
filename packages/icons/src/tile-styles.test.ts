import { tileSpec } from "./tile-styles";

describe("tile specs", () => {
  it("draws a white symbol on a solid tile", () => {
    expect(tileSpec("solid", "#2F5FD0")).toMatchObject({ kind: "plain", icon: "#FFFFFF", base: "#2F5FD0" });
  });

  it("has no tile for glyph-only", () => {
    expect(tileSpec("glyph-only", "#2F5FD0")).toMatchObject({ kind: "none", icon: "#2F5FD0" });
  });
});
