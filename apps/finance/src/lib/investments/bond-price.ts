import type { InvestmentRow } from "@/db/schema";

export interface BondPricing {
  units: number;
  faceValue: number;
  cleanPrice: number;
  /** Per unit, with the accrued interest folded in. */
  dirtyPrice: number;
  faceTotal: number;
  cleanTotal: number;
  accrued: number;
  /** Clean total minus face total: positive was paid above face, negative bought at a discount. */
  premium: number;
}

export function bondPricing(
  inv: Pick<InvestmentRow, "units" | "faceValue" | "cleanPrice" | "accruedAtBuy" | "amount">,
): BondPricing | null {
  const { units, faceValue, cleanPrice } = inv;
  if (units == null || faceValue == null || cleanPrice == null) return null;
  const accrued = inv.accruedAtBuy ?? 0;
  const faceTotal = Math.round(faceValue * units);
  const cleanTotal = Math.round(cleanPrice * units);
  return {
    units,
    faceValue,
    cleanPrice,
    dirtyPrice: Math.round(cleanPrice + accrued / units),
    faceTotal,
    cleanTotal,
    accrued,
    premium: cleanTotal - faceTotal,
  };
}
