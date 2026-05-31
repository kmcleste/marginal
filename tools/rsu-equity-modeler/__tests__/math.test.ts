// Pure math extracted from RsuEquityModeler.tsx — tested independently

type GrantType = "rsu" | "nso";

function projectedFMV(currentFMV: number, annualGrowthPct: number, yearsFromNow: number): number {
  return currentFMV * Math.pow(1 + annualGrowthPct / 100, yearsFromNow);
}

function grossIncomeAtVest(grantType: GrantType, shares: number, fmvAtVest: number, strikePrice: number): number {
  if (grantType === "rsu") return shares * fmvAtVest;
  const spread = Math.max(0, fmvAtVest - strikePrice);
  return shares * spread;
}

function taxAtVest(grossIncome: number, marginalFedRate: number, marginalStateRate: number, ficaRate: number): number {
  return grossIncome * (marginalFedRate + marginalStateRate + ficaRate) / 100;
}

function sellToCoverShares(taxAmount: number, fmvAtVest: number): number {
  return fmvAtVest > 0 ? Math.floor(taxAmount / fmvAtVest) : 0;
}

function vestSharesBySchedule(
  grantShares: number,
  schedule: "4yr-1cliff" | "4yr-monthly" | "3yr-monthly",
): Record<number, number> {
  const yearlyShares: Record<number, number> = {};
  if (schedule === "4yr-1cliff") {
    const cliff = Math.round(grantShares * 0.25);
    const remaining = grantShares - cliff;
    yearlyShares[1] = cliff;
    yearlyShares[2] = Math.round(remaining / 3);
    yearlyShares[3] = Math.round(remaining / 3);
    yearlyShares[4] = remaining - 2 * Math.round(remaining / 3);
  } else if (schedule === "4yr-monthly") {
    const perYear = Math.round(grantShares / 4);
    for (let i = 1; i <= 4; i++) {
      yearlyShares[i] = i < 4 ? perYear : grantShares - perYear * 3;
    }
  } else {
    const perYear = Math.round(grantShares / 3);
    for (let i = 1; i <= 3; i++) {
      yearlyShares[i] = i < 3 ? perYear : grantShares - perYear * 2;
    }
  }
  return yearlyShares;
}

// ─── Projected FMV ─────────────────────────────────────────────────────────────

describe("projectedFMV", () => {
  it("0% growth: FMV unchanged", () => {
    expect(projectedFMV(100, 0, 5)).toBe(100);
  });

  it("0 years: FMV unchanged", () => {
    expect(projectedFMV(150, 10, 0)).toBe(150);
  });

  it("compound growth: $100 at 7% for 10yr → $196.72", () => {
    expect(projectedFMV(100, 7, 10)).toBeCloseTo(196.72, 1);
  });

  it("is monotonically increasing with years for positive growth", () => {
    const fmvs = [0, 1, 2, 3, 4].map(n => projectedFMV(100, 10, n));
    for (let i = 1; i < fmvs.length; i++) {
      expect(fmvs[i]).toBeGreaterThan(fmvs[i - 1]!);
    }
  });

  it("negative growth: FMV declines", () => {
    expect(projectedFMV(100, -10, 3)).toBeLessThan(100);
  });
});

// ─── RSU gross income at vest ────────────────────────────────────────────────

describe("RSU gross income at vest", () => {
  it("RSU: grossIncome = shares × FMV (no strike)", () => {
    expect(grossIncomeAtVest("rsu", 1000, 50, 0)).toBe(50000);
  });

  it("RSU: strike price is irrelevant", () => {
    const income1 = grossIncomeAtVest("rsu", 1000, 50, 0);
    const income2 = grossIncomeAtVest("rsu", 1000, 50, 100);
    expect(income1).toBe(income2);
  });

  it("NSO: grossIncome = shares × (FMV - strike)", () => {
    expect(grossIncomeAtVest("nso", 1000, 80, 20)).toBe(60000);
  });

  it("NSO: FMV below strike → $0 income (no exercise)", () => {
    expect(grossIncomeAtVest("nso", 1000, 15, 20)).toBe(0);
  });

  it("NSO: FMV equals strike → $0 income", () => {
    expect(grossIncomeAtVest("nso", 500, 30, 30)).toBe(0);
  });
});

// ─── Tax at vest ─────────────────────────────────────────────────────────────

describe("taxAtVest", () => {
  it("combined effective rate applied to gross income", () => {
    const gross = 100000;
    // 37% fed + 9.3% state + 1.45% FICA (Medicare only)
    const tax = taxAtVest(gross, 37, 9.3, 1.45);
    expect(tax).toBeCloseTo(gross * 0.4775, 2);
  });

  it("tax is proportional to gross income", () => {
    const tax1 = taxAtVest(50000, 35, 9, 1.45);
    const tax2 = taxAtVest(100000, 35, 9, 1.45);
    expect(tax2).toBeCloseTo(tax1 * 2, 6);
  });

  it("tax < gross income for realistic rates (< 60% combined)", () => {
    const gross = 200000;
    expect(taxAtVest(gross, 37, 13.3, 1.45)).toBeLessThan(gross);
  });
});

// ─── Sell-to-cover shares ────────────────────────────────────────────────────

describe("sellToCoverShares", () => {
  it("floors to whole shares (can't sell fractional)", () => {
    // $37,000 tax at $100 FMV → floor(370) = 370 shares
    expect(sellToCoverShares(37000, 100)).toBe(370);
  });

  it("tax $10,500 at $100 → 105 shares (not 105.5)", () => {
    expect(sellToCoverShares(10500, 100)).toBe(105);
  });

  it("returns 0 when FMV is 0", () => {
    expect(sellToCoverShares(50000, 0)).toBe(0);
  });

  it("sell-to-cover shares is always ≤ shares vested (sanity bound)", () => {
    const gross = grossIncomeAtVest("rsu", 1000, 50, 0);
    const tax = taxAtVest(gross, 37, 9, 1.45);
    const stc = sellToCoverShares(tax, 50);
    expect(stc).toBeLessThanOrEqual(1000);
  });
});

// ─── Vesting schedules ────────────────────────────────────────────────────────

describe("vestSharesBySchedule", () => {
  it("4yr-1cliff: year 1 = 25%", () => {
    const sched = vestSharesBySchedule(1000, "4yr-1cliff");
    expect(sched[1]).toBe(250);
  });

  it("4yr-1cliff: total = 100% of grant", () => {
    const sched = vestSharesBySchedule(1000, "4yr-1cliff");
    const total = Object.values(sched).reduce((a, b) => a + b, 0);
    expect(total).toBe(1000);
  });

  it("4yr-monthly: roughly equal each year", () => {
    const sched = vestSharesBySchedule(1200, "4yr-monthly");
    expect(sched[1]).toBe(300);
    expect(sched[2]).toBe(300);
    expect(sched[3]).toBe(300);
  });

  it("4yr-monthly: total = 100% of grant", () => {
    const sched = vestSharesBySchedule(1000, "4yr-monthly");
    const total = Object.values(sched).reduce((a, b) => a + b, 0);
    expect(total).toBe(1000);
  });

  it("3yr-monthly: vests over 3 years, total = grant", () => {
    const sched = vestSharesBySchedule(900, "3yr-monthly");
    expect(Object.keys(sched).length).toBe(3);
    const total = Object.values(sched).reduce((a, b) => a + b, 0);
    expect(total).toBe(900);
  });

  it("4yr-1cliff with odd share count: no shares lost", () => {
    const sched = vestSharesBySchedule(1001, "4yr-1cliff");
    const total = Object.values(sched).reduce((a, b) => a + b, 0);
    expect(total).toBe(1001);
  });
});

// ─── Concentration risk ───────────────────────────────────────────────────────

describe("concentration risk thresholds", () => {
  it("concentration < 20% → OK level", () => {
    const concentration = 0.15;
    const level = concentration > 0.40 ? "danger" : concentration > 0.20 ? "warn" : "ok";
    expect(level).toBe("ok");
  });

  it("concentration 20–40% → warn", () => {
    const concentration = 0.30;
    const level = concentration > 0.40 ? "danger" : concentration > 0.20 ? "warn" : "ok";
    expect(level).toBe("warn");
  });

  it("concentration > 40% → danger", () => {
    const concentration = 0.50;
    const level = concentration > 0.40 ? "danger" : concentration > 0.20 ? "warn" : "ok";
    expect(level).toBe("danger");
  });

  it("diversification schedule: shares per quarter to reach < 10% in 8 quarters", () => {
    const grantValue = 400000;
    const totalNW = 800000; // 50% concentration
    const targetValue = totalNW * 0.10;
    const excessValue = grantValue - targetValue;
    const sharesPerQtr = Math.ceil(excessValue / (8 * (grantValue / 1000))); // 1000 shares
    expect(sharesPerQtr).toBeGreaterThan(0);
  });
});
