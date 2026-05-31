// Pure math extracted from FireCalculator.tsx — tested independently

function fvWithContribs(currentNW: number, annualSavings: number, r: number, n: number): number {
  if (r === 0) return currentNW + annualSavings * n;
  return currentNW * Math.pow(1 + r, n) + annualSavings * (Math.pow(1 + r, n) - 1) / r;
}

function yearsToFI(currentNW: number, annualSavings: number, r: number, target: number): number | null {
  if (currentNW >= target) return 0;
  if (annualSavings <= 0) return null;
  let lo = 0, hi = 200;
  if (fvWithContribs(currentNW, annualSavings, r, hi) < target) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (fvWithContribs(currentNW, annualSavings, r, mid) < target) lo = mid;
    else hi = mid;
    if (hi - lo < 0.01) break;
  }
  return (lo + hi) / 2;
}

// ─── fvWithContribs ─────────────────────────────────────────────────────────

describe("fvWithContribs", () => {
  it("zero NW + zero savings → 0 at any n", () => {
    expect(fvWithContribs(0, 0, 0.07, 10)).toBe(0);
  });

  it("0% return: FV = NW + savings × n", () => {
    expect(fvWithContribs(100000, 50000, 0, 10)).toBe(600000);
  });

  it("no contributions: FV = NW × (1+r)^n", () => {
    const expected = 500000 * Math.pow(1.07, 20);
    expect(fvWithContribs(500000, 0, 0.07, 20)).toBeCloseTo(expected, 2);
  });

  it("$0 NW, $50k/yr at 7% for 30yr → ~$4.72M", () => {
    // FV annuity = 50000 × ((1.07^30 - 1) / 0.07) ≈ 4,724,703
    const expected = 50000 * (Math.pow(1.07, 30) - 1) / 0.07;
    expect(fvWithContribs(0, 50000, 0.07, 30)).toBeCloseTo(expected, 0);
  });

  it("is monotonically increasing in n", () => {
    const fvs = [5, 10, 15, 20, 25, 30].map(n => fvWithContribs(100000, 30000, 0.07, n));
    for (let i = 1; i < fvs.length; i++) {
      expect(fvs[i]).toBeGreaterThan(fvs[i - 1]!);
    }
  });

  it("is monotonically increasing in r (given positive NW and savings)", () => {
    const fvs = [0.03, 0.05, 0.07, 0.09, 0.12].map(r => fvWithContribs(200000, 50000, r, 20));
    for (let i = 1; i < fvs.length; i++) {
      expect(fvs[i]).toBeGreaterThan(fvs[i - 1]!);
    }
  });
});

// ─── yearsToFI ───────────────────────────────────────────────────────────────

describe("yearsToFI", () => {
  it("already at FI → returns 0", () => {
    expect(yearsToFI(2000000, 50000, 0.07, 2000000)).toBe(0);
  });

  it("above FI target → returns 0", () => {
    expect(yearsToFI(3000000, 50000, 0.07, 2000000)).toBe(0);
  });

  it("no savings → returns null", () => {
    expect(yearsToFI(100000, 0, 0.07, 2000000)).toBeNull();
  });

  it("result is self-consistent: FV at returned year ≈ target", () => {
    const NW = 200000, savings = 80000, r = 0.07, target = 2500000;
    const n = yearsToFI(NW, savings, r, target);
    expect(n).not.toBeNull();
    // Binary search converges within 0.01 years — FV should be within $500 of target
    expect(fvWithContribs(NW, savings, r, n!)).toBeCloseTo(target, -3);
  });

  it("higher savings → fewer years to FI", () => {
    const n1 = yearsToFI(100000, 30000, 0.07, 1500000);
    const n2 = yearsToFI(100000, 60000, 0.07, 1500000);
    expect(n2!).toBeLessThan(n1!);
  });

  it("higher return → fewer years to FI", () => {
    const n1 = yearsToFI(0, 50000, 0.05, 2000000);
    const n2 = yearsToFI(0, 50000, 0.09, 2000000);
    expect(n2!).toBeLessThan(n1!);
  });

  it("unreachable even in 200yr → returns null", () => {
    // $1k/yr saving cannot reach $10M at 0% return in 200yr
    expect(yearsToFI(0, 1000, 0, 10_000_000)).toBeNull();
  });
});

// ─── FI number and SWR ──────────────────────────────────────────────────────

describe("FI number (spend / SWR)", () => {
  it("4% SWR: $80k spend → $2M FI number", () => {
    const fiNumber = 80000 / 0.04;
    expect(fiNumber).toBe(2000000);
  });

  it("3% SWR: $60k spend → $2M FI number", () => {
    const fiNumber = 60000 / 0.03;
    expect(fiNumber).toBe(2000000);
  });

  it("higher SWR → lower FI number", () => {
    const fi4 = 80000 / 0.04;
    const fi5 = 80000 / 0.05;
    expect(fi5).toBeLessThan(fi4);
  });
});

// ─── Coast FI ───────────────────────────────────────────────────────────────

describe("Coast FI (PV of FI number)", () => {
  it("Coast FI = FI number / (1+r)^years", () => {
    const fiNumber = 2000000;
    const r = 0.07;
    const years = 20;
    const coastFI = fiNumber / Math.pow(1 + r, years);
    expect(coastFI).toBeCloseTo(fiNumber / Math.pow(1.07, 20), 2);
  });

  it("Coast FI < FI number when years > 0", () => {
    const fiNumber = 2500000;
    const coastFI = fiNumber / Math.pow(1.07, 25);
    expect(coastFI).toBeLessThan(fiNumber);
  });

  it("higher return → lower coast FI (money grows faster)", () => {
    const fiNumber = 2000000;
    const years = 20;
    const coast7 = fiNumber / Math.pow(1.07, years);
    const coast9 = fiNumber / Math.pow(1.09, years);
    expect(coast9).toBeLessThan(coast7);
  });

  it("more years to retirement → lower coast FI", () => {
    const fiNumber = 2000000;
    const coast20 = fiNumber / Math.pow(1.07, 20);
    const coast30 = fiNumber / Math.pow(1.07, 30);
    expect(coast30).toBeLessThan(coast20);
  });
});
