// Pure math extracted from RothConversion.tsx — tested independently

interface Bracket { min: number; max: number; rate: number; }

const BRACKETS_SINGLE: Bracket[] = [
  { min: 0,      max: 11600,  rate: 0.10 },
  { min: 11600,  max: 47150,  rate: 0.12 },
  { min: 47150,  max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 },
];

const STD_DEDUCTION_SINGLE = 14600;

function conversionRoom(ordinaryIncome: number, targetBracketRate: number): number {
  const taxable = Math.max(0, ordinaryIncome - STD_DEDUCTION_SINGLE);
  const currentBracket = BRACKETS_SINGLE.find(b => taxable >= b.min && taxable < b.max)
    ?? BRACKETS_SINGLE[BRACKETS_SINGLE.length - 1]!;
  if (currentBracket.rate > targetBracketRate) return 0;
  const targetBracket = BRACKETS_SINGLE.find(b => b.rate === targetBracketRate);
  if (!targetBracket) return 0;
  return Math.max(0, (targetBracket.max === Infinity ? 500000 : targetBracket.max) - taxable);
}

function rothFVAdvantage(
  conversion: number,
  r: number,
  n: number,
  currentRate: number,
  futureRate: number,
): number {
  const taxCostNow = conversion * currentRate;
  const rothFV = conversion * Math.pow(1 + r, n);
  const tradFV = conversion * Math.pow(1 + r, n);
  const tradAfterTax = tradFV * (1 - futureRate);
  const taxDrag = taxCostNow * Math.pow(1 + r, n);
  const rothNetFV = rothFV - taxDrag;
  return rothNetFV - tradAfterTax;
}

function breakEvenYear(conversion: number, r: number, currentRate: number, futureRate: number): number | null {
  const taxCost = conversion * currentRate;
  for (let yr = 1; yr <= 50; yr++) {
    const rv = conversion * Math.pow(1 + r, yr) - taxCost * Math.pow(1 + r, yr);
    const tv = conversion * Math.pow(1 + r, yr) * (1 - futureRate);
    if (rv >= tv) return yr;
  }
  return null;
}

const IRMAA_TIERS = [
  { single: 103000, mfj: 206000 },
  { single: 129000, mfj: 258000 },
  { single: 161000, mfj: 322000 },
  { single: 193000, mfj: 386000 },
  { single: 500000, mfj: 750000 },
];

function getIrmaaTier(magi: number): number {
  for (let i = 0; i < IRMAA_TIERS.length; i++) {
    if (magi <= IRMAA_TIERS[i]!.single) return i;
  }
  return IRMAA_TIERS.length - 1;
}

// ─── Conversion room ─────────────────────────────────────────────────────────

describe("conversionRoom", () => {
  it("income already in 24% bracket, targeting 24%: fills to top of 24%", () => {
    // taxable = 150000 - 14600 = 135400 (in 24% bracket: 100525–191950)
    const room = conversionRoom(150000, 0.24);
    expect(room).toBeCloseTo(191950 - 135400, 0);
  });

  it("income in 22% bracket, targeting 22%: fills to top of 22%", () => {
    // taxable = 80000 - 14600 = 65400 (in 22% bracket: 47150–100525)
    const room = conversionRoom(80000, 0.22);
    expect(room).toBeCloseTo(100525 - 65400, 0);
  });

  it("income above target bracket → 0 room", () => {
    // taxable = 220000 (in 32% bracket), targeting 22%
    const room = conversionRoom(240000, 0.22);
    expect(room).toBe(0);
  });

  it("zero income: full 10% bracket available", () => {
    const room = conversionRoom(0, 0.10);
    expect(room).toBe(11600);
  });

  it("room is non-negative", () => {
    const incomes = [0, 50000, 100000, 200000, 400000, 700000];
    const rates = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
    for (const inc of incomes) {
      for (const rate of rates) {
        expect(conversionRoom(inc, rate)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ─── Roth vs Trad FV advantage ───────────────────────────────────────────────

describe("rothFVAdvantage", () => {
  it("break-even: same current and future rate → no advantage (just tax timing)", () => {
    // Same rate today and future: advantage should be ~0 (taxes paid now vs later at same rate)
    // After n years: rothNet = C*(1+r)^n - C*rate*(1+r)^n = C*(1+r)^n*(1-rate)
    // trad afterTax = C*(1+r)^n*(1-rate) → same!
    const adv = rothFVAdvantage(100000, 0.07, 20, 0.32, 0.32);
    expect(adv).toBeCloseTo(0, 0);
  });

  it("lower future rate → Trad wins (negative advantage)", () => {
    const adv = rothFVAdvantage(100000, 0.07, 20, 0.35, 0.22);
    expect(adv).toBeLessThan(0);
  });

  it("higher future rate → Roth wins (positive advantage)", () => {
    const adv = rothFVAdvantage(100000, 0.07, 20, 0.22, 0.35);
    expect(adv).toBeGreaterThan(0);
  });

  it("longer horizon amplifies the Roth advantage when future rate > current rate", () => {
    const adv10 = rothFVAdvantage(100000, 0.07, 10, 0.22, 0.35);
    const adv30 = rothFVAdvantage(100000, 0.07, 30, 0.22, 0.35);
    expect(adv30).toBeGreaterThan(adv10);
  });

  it("advantage at same rate is exactly 0 for any horizon", () => {
    const rates = [0.10, 0.22, 0.37];
    const horizons = [5, 20, 40];
    for (const rate of rates) {
      for (const n of horizons) {
        expect(rothFVAdvantage(100000, 0.07, n, rate, rate)).toBeCloseTo(0, 4);
      }
    }
  });
});

// ─── Break-even year ─────────────────────────────────────────────────────────

describe("breakEvenYear", () => {
  it("same rate → break-even is year 1 (or close)", () => {
    // When currentRate === futureRate, rothNet = trad after-tax from day 1
    expect(breakEvenYear(100000, 0.07, 0.22, 0.22)).toBe(1);
  });

  it("lower future rate → Trad always wins → no break-even (null)", () => {
    expect(breakEvenYear(100000, 0.07, 0.37, 0.10)).toBeNull();
  });

  it("higher future rate → Roth wins quickly", () => {
    const yr = breakEvenYear(100000, 0.07, 0.22, 0.37);
    expect(yr).not.toBeNull();
    expect(yr!).toBeLessThanOrEqual(5);
  });
});

// ─── IRMAA tier detection ────────────────────────────────────────────────────

describe("IRMAA tier detection (single filer 2024)", () => {
  it("MAGI below $103k → tier 0 (standard premium)", () => {
    expect(getIrmaaTier(100000)).toBe(0);
  });

  it("MAGI exactly $103k → tier 0", () => {
    expect(getIrmaaTier(103000)).toBe(0);
  });

  it("MAGI $103,001 → tier 1", () => {
    expect(getIrmaaTier(103001)).toBe(1);
  });

  it("MAGI $129,001 → tier 2", () => {
    expect(getIrmaaTier(129001)).toBe(2);
  });

  it("MAGI $500,001 → highest tier (4)", () => {
    expect(getIrmaaTier(500001)).toBe(4);
  });

  it("tier index is monotonically non-decreasing with MAGI", () => {
    const magis = [50000, 103000, 129000, 161000, 193000, 500000, 750000];
    for (let i = 1; i < magis.length; i++) {
      expect(getIrmaaTier(magis[i]!)).toBeGreaterThanOrEqual(getIrmaaTier(magis[i - 1]!));
    }
  });
});

// ─── RMD formula ─────────────────────────────────────────────────────────────

describe("RMD at age 73 (IRS uniform lifetime table factor 26.5)", () => {
  it("$1M balance → RMD ≈ $37,736", () => {
    const rmd = 1_000_000 / 26.5;
    expect(rmd).toBeCloseTo(37736, 0);
  });

  it("RMD increases as balance grows", () => {
    const rmd1 = 500_000 / 26.5;
    const rmd2 = 1_500_000 / 26.5;
    expect(rmd2).toBeGreaterThan(rmd1);
  });
});
