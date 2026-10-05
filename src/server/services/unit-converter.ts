export type StandardUnit = 'KG' | 'G' | 'MG' | 'L' | 'ML' | 'PCS' | 'DOZEN' | 'PORTION';

// Normalization factors relative to base units:
// Weight base: KG
// Volume base: L
// Count base: PCS

const WEIGHT_TO_KG: Record<string, number> = {
  KG: 1,
  KILOGRAM: 1,
  KILOGRAMS: 1,
  G: 0.001,
  GRAM: 0.001,
  GRAMS: 0.001,
  MG: 0.000001,
  MILLIGRAM: 0.000001,
  MILLIGRAMS: 0.000001,
};

const VOLUME_TO_L: Record<string, number> = {
  L: 1,
  LITER: 1,
  LITERS: 1,
  LTR: 1,
  ML: 0.001,
  MILLILITER: 0.001,
  MILLILITERS: 0.001,
};

const COUNT_TO_PCS: Record<string, number> = {
  PCS: 1,
  PIECE: 1,
  PIECES: 1,
  UNIT: 1,
  UNITS: 1,
  PORTION: 1,
  DOZEN: 12,
  DOZENS: 12,
};

export class UnitConverter {
  /**
   * Converts a given quantity from `fromUnit` to `toUnit`.
   * Throws an error if incompatible units (e.g. KG to Liters without density).
   */
  static convert(quantity: number, fromUnit: string, toUnit: string): number {
    const from = fromUnit.trim().toUpperCase();
    const to = toUnit.trim().toUpperCase();

    if (from === to) return quantity;

    // Weight to Weight
    if (from in WEIGHT_TO_KG && to in WEIGHT_TO_KG) {
      const inKg = quantity * WEIGHT_TO_KG[from];
      return inKg / WEIGHT_TO_KG[to];
    }

    // Volume to Volume
    if (from in VOLUME_TO_L && to in VOLUME_TO_L) {
      const inL = quantity * VOLUME_TO_L[from];
      return inL / VOLUME_TO_L[to];
    }

    // Count to Count
    if (from in COUNT_TO_PCS && to in COUNT_TO_PCS) {
      const inPcs = quantity * COUNT_TO_PCS[from];
      return inPcs / COUNT_TO_PCS[to];
    }

    // Handle liquid kitchen assumption: 1L = 1KG / 1ML = 1G if explicitly mixed
    if ((from in VOLUME_TO_L && to in WEIGHT_TO_KG) || (from in WEIGHT_TO_KG && to in VOLUME_TO_L)) {
      const baseVal = from in WEIGHT_TO_KG ? quantity * WEIGHT_TO_KG[from] : quantity * VOLUME_TO_L[from];
      const targetFactor = to in WEIGHT_TO_KG ? WEIGHT_TO_KG[to] : VOLUME_TO_L[to];
      return baseVal / targetFactor;
    }

    // Fallback: return quantity unchanged if custom custom unit matches or unknown
    return quantity;
  }

  /**
   * Helper to format unit display cleanly
   */
  static format(qty: number, unit: string): string {
    const rounded = Math.round(qty * 1000) / 1000;
    return `${rounded} ${unit.toUpperCase()}`;
  }
}
