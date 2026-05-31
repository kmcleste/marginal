// Pure math extracted from TaxLossHarvester.tsx — tested independently

function calcTaxSavings(
  stLoss: number, ltLoss: number,
  stGain: number, ltGain: number,
  stcgRate: number, ltcgRate: number, ordRate: number,
): {
  stTaxSaved: number; ltTaxSaved: number; ordTaxSaved: number;
  carryforward: number; totalSaved: number;
} {
  let stL = Math.abs(stLoss);
  let ltL = Math.abs(ltLoss);

  // ST losses offset ST gains first
  const stOffsetST = Math.min(stL, stGain);
  stL -= stOffsetST;
  // Remaining ST losses offset LT gains
  const stOffsetLT = Math.min(stL, ltGain);
  stL -= stOffsetLT;

  // LT losses offset LT gains first
  const ltOffsetLT = Math.min(ltL, ltGain - stOffsetLT);
  ltL -= ltOffsetLT;
  // Remaining LT losses offset ST gains
  const ltOffsetST = Math.min(ltL, stGain - stOffsetST);
  ltL -= ltOffsetST;

  // Remaining losses → up to $3k against ordinary income
  const remaining = stL + ltL;
  const ordOffset = Math.min(remaining, 3000);
  const carryforward = remaining - ordOffset;

  const stTaxSaved  = (stOffsetST + ltOffsetST) * (stcgRate / 100);
  const ltTaxSaved  = (stOffsetLT + ltOffsetLT) * (ltcgRate / 100);
  const ordTaxSaved = ordOffset * (ordRate / 100);

  return { stTaxSaved, ltTaxSaved, ordTaxSaved, carryforward, totalSaved: stTaxSaved + ltTaxSaved + ordTaxSaved };
}

function taxAlphaPV(taxSaved: number, annualReturn: number, yearsToExit: number): number {
  const r = annualReturn / 100;
  return taxSaved * (1 - 1 / Math.pow(1 + r, yearsToExit));
}

// ─── IRS netting: ST loss vs ST gain ─────────────────────────────────────────

describe("calcTaxSavings — ST loss vs ST gain (Rule 1)", () => {
  it("ST loss fully offsets ST gain", () => {
    const res = calcTaxSavings(5000, 0, 5000, 0, 35, 15, 37);
    expect(res.stTaxSaved).toBeCloseTo(5000 * 0.35, 2);
    expect(res.ltTaxSaved).toBe(0);
    expect(res.ordTaxSaved).toBe(0);
    expect(res.carryforward).toBe(0);
  });

  it("ST loss partially offsets ST gain — remainder goes to ordinary", () => {
    // $8k ST loss vs $5k ST gain: $5k offsets ST, $3k → ordinary income
    const res = calcTaxSavings(8000, 0, 5000, 0, 35, 15, 37);
    expect(res.stTaxSaved).toBeCloseTo(5000 * 0.35, 2);
    expect(res.ordTaxSaved).toBeCloseTo(3000 * 0.37, 2);
    expect(res.carryforward).toBe(0);
  });

  it("ST loss exceeding all gains → carryforward above $3k", () => {
    // $15k ST loss, $5k ST gain: $5k offsets ST, $3k ordinary, $7k carryforward
    const res = calcTaxSavings(15000, 0, 5000, 0, 35, 15, 37);
    expect(res.stTaxSaved).toBeCloseTo(5000 * 0.35, 2);
    expect(res.ordTaxSaved).toBeCloseTo(3000 * 0.37, 2);
    expect(res.carryforward).toBeCloseTo(7000, 0);
  });
});

// ─── IRS netting: ST loss vs LT gain (Rule 2) ────────────────────────────────

describe("calcTaxSavings — ST loss vs LT gain (Rule 2: cross-netting)", () => {
  it("ST loss remaining after ST offset nets against LT gain at LT rate", () => {
    // $10k ST loss, $3k ST gain, $7k LT gain
    // ST loss: $3k offsets ST, $7k offsets LT
    const res = calcTaxSavings(10000, 0, 3000, 7000, 35, 15, 37);
    expect(res.stTaxSaved).toBeCloseTo(3000 * 0.35, 2);
    expect(res.ltTaxSaved).toBeCloseTo(7000 * 0.15, 2);
    expect(res.carryforward).toBe(0);
  });
});

// ─── IRS netting: LT loss vs LT gain (Rule 3) ────────────────────────────────

describe("calcTaxSavings — LT loss vs LT gain (Rule 3)", () => {
  it("LT loss fully offsets LT gain at LTCG rate", () => {
    const res = calcTaxSavings(0, 10000, 0, 10000, 35, 15, 37);
    expect(res.ltTaxSaved).toBeCloseTo(10000 * 0.15, 2);
    expect(res.stTaxSaved).toBe(0);
    expect(res.carryforward).toBe(0);
  });
});

// ─── IRS netting: LT loss vs ST gain (Rule 4: cross-netting) ─────────────────

describe("calcTaxSavings — LT loss vs ST gain (Rule 4: cross-netting)", () => {
  it("LT loss remaining after LT offset nets against ST gain — saves at ST rate", () => {
    // $12k LT loss, $5k LT gain: $5k offsets LT, $7k remaining nets against ST
    // $7k ST gain → $7k offset at ST rate
    const res = calcTaxSavings(0, 12000, 7000, 5000, 35, 15, 37);
    expect(res.ltTaxSaved).toBeCloseTo(5000 * 0.15, 2);
    expect(res.stTaxSaved).toBeCloseTo(7000 * 0.35, 2);
    expect(res.carryforward).toBe(0);
  });
});

// ─── Ordinary income offset (Rule 5: $3k cap) ────────────────────────────────

describe("calcTaxSavings — ordinary income offset", () => {
  it("net loss up to $3k offsets ordinary income", () => {
    const res = calcTaxSavings(2000, 0, 0, 0, 35, 15, 37);
    expect(res.ordTaxSaved).toBeCloseTo(2000 * 0.37, 2);
    expect(res.carryforward).toBe(0);
  });

  it("net loss above $3k: $3k offsets ordinary, rest carryforward", () => {
    const res = calcTaxSavings(10000, 0, 0, 0, 35, 15, 37);
    expect(res.ordTaxSaved).toBeCloseTo(3000 * 0.37, 2);
    expect(res.carryforward).toBe(7000);
  });

  it("no gains — full loss against ordinary then carryforward", () => {
    const res = calcTaxSavings(0, 5000, 0, 0, 35, 15, 37);
    expect(res.ordTaxSaved).toBeCloseTo(3000 * 0.37, 2);
    expect(res.carryforward).toBe(2000);
  });
});

// ─── totalSaved consistency ───────────────────────────────────────────────────

describe("calcTaxSavings — totalSaved", () => {
  it("totalSaved = stTaxSaved + ltTaxSaved + ordTaxSaved", () => {
    const res = calcTaxSavings(8000, 4000, 5000, 3000, 35, 15, 37);
    expect(res.totalSaved).toBeCloseTo(res.stTaxSaved + res.ltTaxSaved + res.ordTaxSaved, 10);
  });

  it("no losses → all zeros", () => {
    const res = calcTaxSavings(0, 0, 5000, 5000, 35, 15, 37);
    expect(res.totalSaved).toBe(0);
    expect(res.carryforward).toBe(0);
  });
});

// ─── taxAlphaPV (NPV of tax deferral) ─────────────────────────────────────────

describe("taxAlphaPV", () => {
  it("0 years → 0 PV benefit (haven't deferred anything yet)", () => {
    expect(taxAlphaPV(5000, 7, 0)).toBe(0);
  });

  it("positive years → positive PV", () => {
    expect(taxAlphaPV(5000, 7, 10)).toBeGreaterThan(0);
  });

  it("PV approaches taxSaved as years → ∞ (deferred forever = never pay)", () => {
    const pv50 = taxAlphaPV(10000, 7, 50);
    const pv100 = taxAlphaPV(10000, 7, 100);
    expect(pv100).toBeGreaterThan(pv50);
    expect(pv100).toBeLessThan(10000);
    expect(pv100).toBeCloseTo(10000 * (1 - 1 / Math.pow(1.07, 100)), 2);
  });

  it("formula: T × (1 − 1/(1+r)^n)", () => {
    const taxSaved = 8000, r = 0.07, n = 15;
    const expected = taxSaved * (1 - 1 / Math.pow(1 + r, n));
    expect(taxAlphaPV(taxSaved, 7, n)).toBeCloseTo(expected, 6);
  });

  it("longer hold → higher PV benefit (more deferral value)", () => {
    const pv5  = taxAlphaPV(5000, 7, 5);
    const pv20 = taxAlphaPV(5000, 7, 20);
    expect(pv20).toBeGreaterThan(pv5);
  });
});
