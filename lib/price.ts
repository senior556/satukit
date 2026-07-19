/**
 * Minimum viable sale price (in minor units / tiyn) so that after taking
 * `marginPercent` margin the seller still recovers `costMinor`.
 *
 *   floor = cost / (1 - margin/100)
 *
 * Rounded UP to a whole tenge (nearest 100 minor units).
 * Returns null when the inputs are out of bounds:
 *   - costMinor <= 0
 *   - !(0 < marginPercent < 95)
 */
export function priceFloorMinor(costMinor: number, marginPercent: number): number | null {
  if (!Number.isFinite(costMinor) || costMinor <= 0) return null;
  if (!Number.isFinite(marginPercent) || !(marginPercent > 0 && marginPercent < 95)) return null;

  const raw = costMinor / (1 - marginPercent / 100);
  return Math.ceil(raw / 100) * 100;
}
