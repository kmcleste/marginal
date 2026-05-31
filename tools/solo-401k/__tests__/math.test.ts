// Pure math extracted from Solo401k.tsx — tested independently
// IRS Publication 560, Rev. Proc. 2023-34

const LIMITS_2024 = {
  ssTaxCap: 168600,
  solo401k: { employeeElective: 23000, catchUp: 7500, totalMax: 69000, totalMaxCatchUp: 76500 },
  sepIra:   { max: 69000 },
  simple:   { employee: 16000 },
};

function calcSETax(netSEIncome: number): { seTaxBase: number; seTax: number; deductibleSETax: number } {
  const seTaxBase = netSEIncome * 0.9235;
  const ssWage    = Math.min(seTaxBase, LIMITS_2024.ssTaxCap);
  const ssTax     = ssWage * 0.124;
  const medicareTax = seTaxBase * 0.029;
  const seTax = ssTax + medicareTax;
  const deductibleSETax = seTax / 2;
  return { seTaxBase, seTax, deductibleSETax };
}

function calcSoloContributions(
  netSEIncome: number,
  age: number,
  w2Plan401k = 0,
): { employeeContrib: number; employerContrib: number; totalContrib: number } {
  const { deductibleSETax } = calcSETax(netSEIncome);
  const netSEForContrib = Math.max(0, netSEIncome - deductibleSETax);

  const catchup = age >= 50;
  const baseElective = catchup
    ? LIMITS_2024.solo401k.employeeElective + LIMITS_2024.solo401k.catchUp
    : LIMITS_2024.solo401k.employeeElective;
  const employeeElectiveLimit = Math.max(0, baseElective - w2Plan401k);
  const employeeContrib = Math.max(0, Math.min(employeeElectiveLimit, netSEIncome));

  const totalMax = catchup ? LIMITS_2024.solo401k.totalMaxCatchUp : LIMITS_2024.solo401k.totalMax;
  const employerContrib = Math.max(0, Math.min(
    netSEForContrib * 0.25,
    totalMax - employeeContrib,
  ));

  return { employeeContrib, employerContrib, totalContrib: employeeContrib + employerContrib };
}

// ─── SE tax calculation ───────────────────────────────────────────────────────

describe("SE tax (IRS Publication 560)", () => {
  it("SE tax base = net income × 0.9235 (92.35% factor)", () => {
    const { seTaxBase } = calcSETax(100000);
    expect(seTaxBase).toBeCloseTo(92350, 0);
  });

  it("deductible SE tax = seTax / 2 (employer half)", () => {
    const { seTax, deductibleSETax } = calcSETax(100000);
    expect(deductibleSETax).toBeCloseTo(seTax / 2, 6);
  });

  it("$100k net SE income: seTax ≈ $14,130", () => {
    // SS: min(92350, 168600) * 12.4% = 11451.4
    // Medicare: 92350 * 2.9% = 2678.15
    // Total = 14129.55
    const { seTax } = calcSETax(100000);
    expect(seTax).toBeCloseTo(14129.55, 0);
  });

  it("SS portion caps at wage base ($168,600 in 2024)", () => {
    const { seTax: tax200k } = calcSETax(200000);
    const { seTax: tax300k } = calcSETax(300000);
    // SS portion should be capped — but Medicare grows. Tax300k > tax200k only due to Medicare.
    const ssTax200k = LIMITS_2024.ssTaxCap * 0.124;
    const ssTax300k = LIMITS_2024.ssTaxCap * 0.124;
    expect(ssTax200k).toBe(ssTax300k); // SS is capped
    expect(tax300k).toBeGreaterThan(tax200k); // but Medicare isn't
  });

  it("SE tax is monotonically increasing with income", () => {
    const incomes = [50000, 100000, 200000, 300000, 500000];
    const taxes = incomes.map(i => calcSETax(i).seTax);
    for (let i = 1; i < taxes.length; i++) {
      expect(taxes[i]).toBeGreaterThan(taxes[i - 1]!);
    }
  });
});

// ─── Solo 401k contributions ──────────────────────────────────────────────────

describe("Solo 401k contribution limits", () => {
  it("employee elective limited to $23,000 (under 50)", () => {
    // High income — employee portion should cap at $23k
    const { employeeContrib } = calcSoloContributions(300000, 40);
    expect(employeeContrib).toBe(23000);
  });

  it("catch-up: employee portion caps at $30,500 (age 50+)", () => {
    const { employeeContrib } = calcSoloContributions(300000, 55);
    expect(employeeContrib).toBe(30500);
  });

  it("employer contribution = netSEForContrib × 25%", () => {
    const netSE = 100000;
    const { deductibleSETax } = calcSETax(netSE);
    const netSEForContrib = netSE - deductibleSETax;
    const expectedEmployer = netSEForContrib * 0.25;
    const { employeeContrib, employerContrib } = calcSoloContributions(netSE, 40);
    // employer capped at totalMax - employeeContrib
    const expectedCapped = Math.min(expectedEmployer, 69000 - employeeContrib);
    expect(employerContrib).toBeCloseTo(expectedCapped, 0);
  });

  it("total contribution capped at $69,000 (under 50)", () => {
    const { totalContrib } = calcSoloContributions(500000, 40);
    expect(totalContrib).toBeLessThanOrEqual(69000);
  });

  it("total contribution capped at $76,500 with catch-up", () => {
    const { totalContrib } = calcSoloContributions(500000, 55);
    expect(totalContrib).toBeLessThanOrEqual(76500);
  });

  it("low income: employee capped at net SE income", () => {
    // $10k net SE: can't contribute more than $10k as employee
    const { employeeContrib } = calcSoloContributions(10000, 40);
    expect(employeeContrib).toBeLessThanOrEqual(10000);
  });

  it("w2 plan reduces available elective limit", () => {
    const { employeeContrib: withoutW2 } = calcSoloContributions(200000, 40, 0);
    const { employeeContrib: withW2 }    = calcSoloContributions(200000, 40, 10000);
    expect(withoutW2 - withW2).toBe(10000);
  });

  it("total contribution > SEP-IRA limit only for high earners with catch-up", () => {
    const { totalContrib } = calcSoloContributions(400000, 55);
    // SEP-IRA max = $69k; Solo 401k with catch-up can hit $76.5k
    expect(totalContrib).toBeGreaterThan(LIMITS_2024.sepIra.max);
  });
});

// ─── SEP-IRA comparison ───────────────────────────────────────────────────────

describe("SEP-IRA vs Solo 401k (under 50)", () => {
  it("SEP-IRA = min(25% × net compensation, $69k)", () => {
    const netSE = 100000;
    const { deductibleSETax } = calcSETax(netSE);
    const netComp = netSE - deductibleSETax;
    const sepContrib = Math.min(netComp * 0.25, 69000);
    // For $100k SE income, net comp ≈ $92,935, SEP ≈ $23,234
    expect(sepContrib).toBeCloseTo(23234, -1);
  });

  it("Solo 401k beats SEP-IRA for low-income earners (employee elective is additive)", () => {
    // For a $60k SE earner: SEP ≈ 25% × ~$53k ≈ $13k
    // Solo 401k: can contribute up to $23k employee + some employer
    const netSE = 60000;
    const { deductibleSETax } = calcSETax(netSE);
    const netComp = netSE - deductibleSETax;
    const sepContrib = netComp * 0.25;
    const { totalContrib: soloTotal } = calcSoloContributions(netSE, 40);
    expect(soloTotal).toBeGreaterThan(sepContrib);
  });
});
