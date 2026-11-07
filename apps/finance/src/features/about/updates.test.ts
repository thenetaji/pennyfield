import { newestRelease } from "./updates";

const release = (tag_name: string, extra = {}) => ({
  tag_name,
  draft: false,
  prerelease: false,
  html_url: `https://example.com/${tag_name}`,
  ...extra,
});

describe("newestRelease", () => {
  it("picks the highest version above the current one", () => {
    expect(
      newestRelease(
        [
          release("finance-v0.5.2"),
          release("finance-v0.10.0"),
          release("finance-v0.7.0"),
        ],
        "0.6.0",
      ),
    ).toEqual({
      version: "0.10.0",
      url: "https://example.com/finance-v0.10.0",
    });
  });

  it("ignores drafts, pre-releases and other tags", () => {
    expect(
      newestRelease(
        [
          release("finance-v0.9.0", { draft: true }),
          release("finance-v0.8.0", { prerelease: true }),
          release("v9.0.0"),
        ],
        "0.6.0",
      ),
    ).toBeNull();
  });

  it("finds nothing when already on the latest version", () => {
    expect(newestRelease([release("finance-v0.6.0")], "0.6.0")).toBeNull();
  });
});
