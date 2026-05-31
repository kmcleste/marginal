import {
  applyBrackets,
  marginalRate,
  federalOrdinaryTax,
  federalLtcgTax,
  niit,
  socialSecurityTax,
  medicareTax,
  computeFederalTax,
  FEDERAL_2024,
  LIMITS_2024,
} from "../tax-engine";

// ─── applyBrackets ────────────────────────────────────────────────────────────

describe("applyBrackets", () => {
  const brackets = [
    { min: 0, max: 10000, rate: 0.10 },
    { min: 10000, max: 40000, rate: 0.20 },
    { min: 40000, max: null, rate: 0.30 },
  ];

  it("returns 0 for zero income", () => {
    expect(applyBrackets(0, brackets)).toBe(0);
  });

  it("returns 0 for negative income", () => {
    expect(applyBrackets(-100, brackets)).toBe(0);
  });

  it("applies single bracket correctly", () => {
    // $5,000 at 10% = $500
    expect(applyBrackets(5000, brackets)).toBe(500);
  });

  it("applies two brackets correctly", () => {
    // $10,000 at 10% + $10,000 at 20% = $1,000 + $2,000 = $3,000
    expect(applyBrackets(20000, brackets)).toBe(3000);
  });

  it("applies all brackets correctly", () => {
    // $10,000 * 10% + $30,000 * 20% + $10,000 * 30% = $1,000 + $6,000 + $3,000 = $10,000
    expect(applyBrackets(50000, brackets)).toBe(10000);
  });

  it("handles bracket boundary precisely", () => {
    // exactly at $10,000 threshold — all in first bracket
    expect(applyBrackets(10000, brackets)).toBe(1000);
  });
});

// ─── marginalRate ─────────────────────────────────────────────────────────────

describe("marginalRate", () => {
  const brackets = FEDERAL_2024.ordinaryBrackets.single;

  it("returns lowest rate for income in first bracket", () => {
    expect(marginalRate(10000, brackets)).toBe(0.10);
  });

  it("returns 22% for income in 22% bracket", () => {
    expect(marginalRate(80000, brackets)).toBe(0.22);
  });

  it("returns 37% for top bracket", () => {
    expect(marginalRate(700000, brackets)).toBe(0.37);
  });
});

// ─── Federal Ordinary Tax — spot checks against IRS tables ───────────────────

describe("federalOrdinaryTax", () => {
  it("single filer $50,000 taxable income", () => {
    // 10% on $11,600 = $1,160
    // 12% on $47,150 - $11,600 = $35,550 → $4,266
    // 22% on $50,000 - $47,150 = $2,850 → $627
    // Total ≈ $6,053
    const tax = federalOrdinaryTax(50000, "single");
    expect(tax).toBeCloseTo(6053, -1); // within $10
  });

  it("MFJ filer $200,000 taxable income", () => {
    // 10% on $23,200 = $2,320
    // 12% on $94,300 - $23,200 = $71,100 → $8,532
    // 22% on $200,000 - $94,300 = $105,700 → $23,254
    // Total ≈ $34,106
    const tax = federalOrdinaryTax(200000, "mfj");
    expect(tax).toBeCloseTo(34106, -1);
  });

  it("is monotonically increasing", () => {
    const incomes = [10000, 50000, 100000, 200000, 500000, 1000000];
    const taxes = incomes.map((i) => federalOrdinaryTax(i, "single"));
    for (let i = 1; i < taxes.length; i++) {
      expect(taxes[i]).toBeGreaterThan(taxes[i - 1]!);
    }
  });
});

// ─── LTCG Tax ─────────────────────────────────────────────────────────────────

describe("federalLtcgTax", () => {
  it("returns 0% on LTCG when total income below 0% threshold (single)", () => {
    // 0% bracket for single goes up to $47,025
    const tax = federalLtcgTax(20000, 15000, "single"); // total $35,000 < $47,025
    expect(tax).toBe(0);
  });

  it("applies 15% when LTCG stacks above 0% threshold", () => {
    // Ordinary income $40,000, LTCG $20,000
    // 0% threshold: $47,025. First $7,025 of LTCG at 0%, remaining $12,975 at 15%
    const tax = federalLtcgTax(40000, 20000, "single");
    expect(tax).toBeCloseTo(12975 * 0.15, 0);
  });

  it("returns 0 for zero LTCG", () => {
    expect(federalLtcgTax(100000, 0, "single")).toBe(0);
  });
});

// ─── NIIT ─────────────────────────────────────────────────────────────────────

describe("niit", () => {
  it("returns 0 below threshold (single $200k)", () => {
    expect(niit(190000, 50000, "single")).toBe(0);
  });

  it("taxes lesser of NII or excess MAGI", () => {
    // MAGI $250,000, threshold $200,000 → excess $50,000
    // NII $30,000 → NIIT base = min($50,000, $30,000) = $30,000
    // NIIT = $30,000 * 3.8% = $1,140
    expect(niit(250000, 30000, "single")).toBeCloseTo(1140, 0);
  });

  it("caps at NII when NII < excess MAGI", () => {
    // MAGI $300,000, excess $100,000; NII $40,000 → base = $40,000
    expect(niit(300000, 40000, "single")).toBeCloseTo(1520, 0);
  });
});

// ─── FICA ─────────────────────────────────────────────────────────────────────

describe("socialSecurityTax", () => {
  it("caps at wage base ($168,600 in 2024)", () => {
    const atCap = socialSecurityTax(168600);
    const above = socialSecurityTax(300000);
    expect(atCap).toBeCloseTo(168600 * 0.062, 2);
    expect(above).toBe(atCap);
  });

  it("is proportional below wage base", () => {
    expect(socialSecurityTax(50000)).toBeCloseTo(50000 * 0.062, 2);
  });
});

describe("medicareTax", () => {
  it("applies 1.45% flat below additional threshold", () => {
    // Single additional threshold: $200,000
    expect(medicareTax(100000, "single")).toBeCloseTo(100000 * 0.0145, 2);
  });

  it("applies additional 0.9% above threshold", () => {
    // $50,000 above $200,000 threshold: $50,000 * 0.9% extra
    const total = medicareTax(250000, "single");
    const expected = 250000 * 0.0145 + 50000 * 0.009;
    expect(total).toBeCloseTo(expected, 2);
  });
});

// ─── Full Federal Tax Integration ─────────────────────────────────────────────

describe("computeFederalTax — integration", () => {
  it("high-earning single filer, full picture", () => {
    // qualifiedDividends must also be reflected in ordinaryDividends (qualified is a subset of ordinary)
    const result = computeFederalTax(
      { wages: 300000, longTermCapitalGains: 50000, ordinaryDividends: 10000, qualifiedDividends: 10000 },
      { traditional401k: 23000, hsa: 4150 },
      "single",
    );

    expect(result.agi).toBe(300000 + 50000 + 10000 - 23000 - 4150);
    expect(result.taxableIncome).toBeGreaterThan(0);
    expect(result.totalFederalTax).toBeGreaterThan(0);
    expect(result.marginalOrdinaryRate).toBe(0.35); // $300k - $27k pre-tax puts us in 35%
    expect(result.ltcgTax).toBeGreaterThan(0);
    expect(result.ssTax).toBeCloseTo(168600 * 0.062, 0); // capped
  });

  it("MFJ couple in 22% bracket pays no NIIT", () => {
    const result = computeFederalTax(
      { wages: 150000 },
      {},
      "mfj",
    );
    expect(result.niitAmount).toBe(0);
    expect(result.marginalOrdinaryRate).toBe(0.22);
  });
});

// ─── 2024 Limits sanity ───────────────────────────────────────────────────────

describe("LIMITS_2024 sanity checks", () => {
  it("401k employee elective is $23,000", () => {
    expect(LIMITS_2024.k401.employeeElective).toBe(23000);
  });

  it("HSA family limit exceeds individual limit", () => {
    expect(LIMITS_2024.hsa.family).toBeGreaterThan(LIMITS_2024.hsa.individual);
  });

  it("IRA limit is $7,000", () => {
    expect(LIMITS_2024.ira.contribution).toBe(7000);
  });

  it("Roth MFJ phaseout is higher than single", () => {
    expect(LIMITS_2024.ira.rothPhaseoutMfj.start).toBeGreaterThan(
      LIMITS_2024.ira.rothPhaseoutSingle.start,
    );
  });
});
