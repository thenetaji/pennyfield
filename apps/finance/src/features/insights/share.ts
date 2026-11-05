/** Bar width (0-1) relative to the largest row, so the top row always fills the track. */
export function shareOfMax(amount: number, max: number): number {
  if (max <= 0 || amount <= 0) return 0;
  return Math.min(1, amount / max);
}
