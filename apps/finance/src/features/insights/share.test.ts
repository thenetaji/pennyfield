import { shareOfMax } from "./share";

describe("shareOfMax", () => {
  it("fills the largest row and scales the rest to it", () => {
    expect(shareOfMax(500, 500)).toBe(1);
    expect(shareOfMax(250, 500)).toBe(0.5);
  });
  it("is empty without a positive max or amount", () => {
    expect(shareOfMax(10, 0)).toBe(0);
    expect(shareOfMax(-5, 100)).toBe(0);
  });
});
