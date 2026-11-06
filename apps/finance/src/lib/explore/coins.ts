const MAX_COINS = 90;

/** A round value per coin that keeps the jar between about 1 and 90 coins, whatever the currency. */
export function coinValue(total: number): number {
  if (total <= 0) return 1;
  const smallest = Math.max(1, total / MAX_COINS);
  const power = 10 ** Math.floor(Math.log10(smallest));
  for (const step of [1, 2, 5, 10]) {
    if (power * step >= smallest) return power * step;
  }
  return power * 10;
}

export function coinCount(amount: number, value: number): number {
  return amount <= 0 ? 0 : Math.max(1, Math.round(amount / value));
}
