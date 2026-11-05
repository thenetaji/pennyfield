import { rankMemos } from "./useRecentMemos";

describe("rankMemos", () => {
  const rows = [
    { title: "Swiggy", memo: "Team lunch" },
    { title: "Zomato", memo: "Late dinner" },
    { title: "Swiggy ", memo: "team  lunch" },
    { title: "Swiggy", memo: "Movie night snacks" },
  ];

  it("puts memos from the same merchant first, without repeats", () => {
    expect(rankMemos(rows, "swiggy", "", 4)).toEqual([
      "Team lunch",
      "Movie night snacks",
      "Late dinner",
    ]);
  });

  it("filters by what is typed and skips an exact match", () => {
    expect(rankMemos(rows, "", "din", 4)).toEqual(["Late dinner"]);
    expect(rankMemos(rows, "", "Late dinner", 4)).toEqual([]);
  });
});
