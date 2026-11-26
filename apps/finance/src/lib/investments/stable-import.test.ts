import { parseStableReports, toInvestmentPlan } from "./stable-import";

const investment = [
  ["Stable Bonds"],
  ["CONSOLIDATED INVESTMENT REPORT"],
  ["Date", "ISIN", "Bond Name", "Demat Account No", "Transaction Type", "Quantity (Units)", "YTM (%)", "Invested Amount (INR)", "Accrued at Buy (INR)", "Total Value (INR)", "Price / Unit (INR)", "Face Value (INR)", "Acquisition Cost (INR)"],
  ["Nov 25, 2026", "INE14H407165", "Finnable Credit Private Limited", "1210100001893208", "Buy", "3.0", "10.75", "30020.15", "-9.04", "30029.19", "10009.73", "10000.0", "29.19"],
];
const holdings = [
  ["Stable Bonds"],
  ["HOLDINGS REPORT"],
  ["ISIN", "Security Name", "Maturity", "Current Balance (Units)", "Total Invested (INR)"],
  ["INE14H407165", "Finnable Credit Private Limited Apr'29", "Apr 29, 2029", "3.0", "30020.15"],
];
const cashflow = [
  ["Stable Bonds"],
  ["UPCOMING CASHFLOW"],
  ["Date", "Bond Name", "ISIN", "Units", "Principal (INR)", "Interest before TDS (INR)", "Interest after TDS (INR)", "TDS (INR)", "Amount in Bank (INR)", "Payout Type"],
  ["Dec 26, 2026", "Finnable Credit Private Limited", "INE14H407165", "3.0", "0.0", "271.23", "244.11", "27.12", "244.11", "Interest"],
  ["Jan 26, 2027", "Finnable Credit Private Limited", "INE14H407165", "3.0", "0.0", "271.23", "244.11", "27.12", "244.11", "Interest"],
  ["May 06, 2027", "Finnable Credit Private Limited", "INE14H407165", "3.0", "30020.26", "0.0", "0.0", "0.0", "30020.26", "Auto-sell"],
  ["MONTHLY CASHFLOW SUMMARY"],
];

describe("parseStableReports", () => {
  const [bond] = parseStableReports([[investment, holdings, cashflow]]);

  it("merges the three reports per ISIN", () => {
    expect(bond).toMatchObject({
      isin: "INE14H407165",
      name: "Finnable Credit Private Limited",
      buyDate: "2026-11-25",
      invested: 30020.15,
      maturityDate: "2029-04-29",
      sellDate: "2027-05-06",
    });
    expect(bond.payouts).toHaveLength(3);
  });

  it("plans a monthly bond sold before maturity", () => {
    const plan = toInvestmentPlan(bond, { digits: 2 });
    if ("skipped" in plan) throw new Error("unexpected skip");
    expect(plan.input).toMatchObject({
      amount: 3002015,
      payout: "monthly",
      maturityDate: "2027-05-06",
      firstPayoutDate: "2026-12-26",
      redemptionAmount: 3002026,
      note: "Matures 2029-04-29",
    });
  });

  it("skips a bond known only from the cashflow report", () => {
    const [only] = parseStableReports([[cashflow]]);
    expect(toInvestmentPlan(only, { digits: 2 })).toEqual({ skipped: "missing_amount" });
  });
});
