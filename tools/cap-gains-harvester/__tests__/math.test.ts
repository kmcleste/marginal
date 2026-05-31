// Pure math extracted from CapGainsHarvester.tsx — tested independently
// 2024 LTCG brackets (single filer)

type FilingStatus = "single" | "mfj";

const LTCG_BRACKETS: Record<FilingStatus, Array<{ min: number; max: number; rate: number }>> = {
  single: [
    { min: 0,      max: 47025,  rate: 0 },
    { min: 47025,  max: 518900, rate: 0.15 },
    { min: 518900, max: Infinity, rate: 0.20 },
  ],
  mfj: [
    { min: 0,      max: 94050,  rate: 0 },
    { min: 94050,  max: 583750, rate: 0.15 },
    { min: 583750, max: Infinity, rate: 0.20 },
  ],
};

const STD_DEDUCTION: Record<FilingStatus, number> = { single: 14600, mfj: 29200 };
const NIIT_THRESHOLD: Record<FilingStatus, number> = { single: 200000, mfj: 250000 };

function calcHarvest(
  grossIncome: number,
  preTaxDeductions: number,
  otherDeductions: number,
  unrealizedLTCG: number,
  stateRate: number,
  filingStatus: FilingStatus,
) {
  const deduction = Math.max(STD_DEDUCTION[filingStatus], otherDeductions);
  const agi = Math.max(0, grossIncome - preTaxDeductions);
  const ordinaryTaxableIncome = Math.max(0, agi - deduction);

  const zeroRateThreshold    = LTCG_BRACKETS[filingStatus][0]!.max;
  const fifteenRateThreshold = LTCG_BRACKETS[filingStatus][1]!.max;

  const zeroRateRoom = Math.max(0, zeroRateThreshold - ordinaryTaxableIncome);
  const harvestableAtZero = Math.min(zeroRateRoom, unrealizedLTCG);

  const fifteenRateRoom = Math.max(0, fifteenRateThreshold - Math.max(ordinaryTaxableIncome, zeroRateThreshold));
  const harvestableAtFifteen = Math.min(fifteenRateRoom, Math.max(0, unrealizedLTCG - harvestableAtZero));

  const niitSurtax = agi > NIIT_THRESHOLD[filingStatus] ? 0.038 : 0;
  const effectiveFifteenRate = 0.15 + niitSurtax + stateRate / 100;

  const taxOnZeroHarvest    = harvestableAtZero * stateRate / 100;
  const taxOnFifteenHarvest = harvestableAtFifteen * effectiveFifteenRate;
  const exceeded = ordinaryTaxableIncome >= zeroRateThreshold;

  return { ordinaryTaxableIncome, zeroRateRoom, harvestableAtZero, harvestableAtFifteen, niitSurtax, exceeded, taxOnZeroHarvest, taxOnFifteenHarvest };
}

function pvFutureSavings(gainAmount: number, futureRate: number, returnRate: number, years: number): number {
  if (years <= 0 || returnRate <= 0) return gainAmount * futureRate;
  return (gainAmount * futureRate) / Math.pow(1 + returnRate, years);
}

// ─── Zero-rate harvest room ────────────────────────────────────────────────────

describe("zero-rate harvest room", () => {
  it("single filer with $30k ordinary income: ~$17k room at 0%", () => {
    // taxable = 30000 - 14600 = 15400; zeroThreshold = 47025; room = 31625
    const { zeroRateRoom } = calcHarvest(30000, 0, 0, 100000, 0, "single");
    expect(zeroRateRoom).toBeCloseTo(47025 - 15400, 0);
  });

  it("income already at/above zero threshold → 0 room", () => {
    const { zeroRateRoom, exceeded } = calcHarvest(70000, 0, 0, 50000, 0, "single");
    // taxable = 70000 - 14600 = 55400 > 47025
    expect(zeroRateRoom).toBe(0);
    expect(exceeded).toBe(true);
  });

  it("harvestable capped at unrealized gains", () => {
    // Lots of room but only $5k unrealized gains
    const { harvestableAtZero } = calcHarvest(20000, 0, 0, 5000, 0, "single");
    expect(harvestableAtZero).toBe(5000);
  });

  it("harvestableAtZero is non-negative in all cases", () => {
    const incomes = [0, 30000, 50000, 100000, 200000];
    for (const inc of incomes) {
      const { harvestableAtZero } = calcHarvest(inc, 0, 0, 100000, 0, "single");
      expect(harvestableAtZero).toBeGreaterThanOrEqual(0);
    }
  });

  it("MFJ: zero threshold is $94,050 (double single)", () => {
    // MFJ with $0 income: full zero bracket available
    const { zeroRateRoom } = calcHarvest(0, 0, 0, 200000, 0, "mfj");
    expect(zeroRateRoom).toBe(94050); // no deduction needed at $0 income
  });

  it("pre-tax deductions increase harvest room (lower taxable income)", () => {
    // At $60k gross: taxable without 401k = 60000 - 14600 = 45400 → room = 47025 - 45400 = 1625
    // With $23k 401k: taxable = 37000 - 14600 = 22400 → room = 47025 - 22400 = 24625
    const { zeroRateRoom: without401k } = calcHarvest(60000, 0,     0, 50000, 0, "single");
    const { zeroRateRoom: with401k   } = calcHarvest(60000, 23000, 0, 50000, 0, "single");
    expect(with401k).toBeGreaterThan(without401k);
  });
});

// ─── Fifteen-rate harvest room ────────────────────────────────────────────────

describe("fifteen-rate harvest room", () => {
  it("income well above 0% threshold: gains go to 15% zone", () => {
    // taxable = 200000 - 14600 = 185400; above 47025; room in 15% zone = 518900 - 185400
    const { harvestableAtFifteen } = calcHarvest(200000, 0, 0, 200000, 0, "single");
    expect(harvestableAtFifteen).toBeGreaterThan(0);
  });

  it("15% room = fifteenThreshold - max(ordIncome, zeroThreshold)", () => {
    // taxable = 100000; above zero threshold (47025), in 15% zone
    // 15% room = 518900 - 100000 = 418900
    const { harvestableAtFifteen } = calcHarvest(114600, 0, 0, 500000, 0, "single");
    const taxable = 114600 - 14600;
    const expected15Room = 518900 - Math.max(taxable, 47025);
    expect(harvestableAtFifteen).toBeCloseTo(Math.min(expected15Room, 500000), 0);
  });
});

// ─── NIIT surtax at high income ───────────────────────────────────────────────

describe("NIIT surtax (single: $200k threshold)", () => {
  it("AGI below $200k → no NIIT", () => {
    const { niitSurtax } = calcHarvest(190000, 0, 0, 50000, 0, "single");
    expect(niitSurtax).toBe(0);
  });

  it("AGI above $200k → 3.8% NIIT surtax on LTCG", () => {
    const { niitSurtax } = calcHarvest(250000, 0, 0, 50000, 0, "single");
    expect(niitSurtax).toBe(0.038);
  });
});

// ─── pvFutureSavings (basis step-up PV) ──────────────────────────────────────

describe("pvFutureSavings", () => {
  it("harvest at 0% now → future savings = gain × futureRate", () => {
    // Harvesting $50k at 0%, future rate 15%, held 10yr at 7%
    const pv = pvFutureSavings(50000, 0.15, 0.07, 10);
    const expected = (50000 * 0.15) / Math.pow(1.07, 10);
    expect(pv).toBeCloseTo(expected, 2);
  });

  it("0 years: PV = gain × futureRate (no discounting)", () => {
    expect(pvFutureSavings(50000, 0.15, 0.07, 0)).toBeCloseTo(50000 * 0.15, 2);
  });

  it("PV decreases as hold period increases (discounting)", () => {
    const pv5  = pvFutureSavings(50000, 0.15, 0.07, 5);
    const pv20 = pvFutureSavings(50000, 0.15, 0.07, 20);
    expect(pv20).toBeLessThan(pv5);
  });

  it("PV increases with higher future tax rate", () => {
    const pv15 = pvFutureSavings(50000, 0.15, 0.07, 10);
    const pv20 = pvFutureSavings(50000, 0.20, 0.07, 10);
    expect(pv20).toBeGreaterThan(pv15);
  });

  it("step-up at death: effective futureRate → 0, so PV = 0", () => {
    expect(pvFutureSavings(50000, 0, 0.07, 20)).toBe(0);
  });
});
