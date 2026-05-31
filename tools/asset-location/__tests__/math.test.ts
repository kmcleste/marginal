// Pure math extracted from AssetLocation.tsx — tested independently

type AccountType = "taxable" | "traditional" | "roth";

interface AssetClass {
  ordinaryIncomeYield: number; // % of expected return that's ordinary income (interest, non-qual div)
  qualifiedDivYield:   number; // % that's qualified dividends
  expectedReturn:      number; // annual % gross return
  turnoverRate:        number; // annual turnover (0–1)
}

function taxDragRate(asset: AssetClass, location: AccountType, ordRate: number, ltcgRate: number): number {
  if (location === "roth")        return 0;
  if (location === "traditional") return 0;
  const ordDrag      = asset.ordinaryIncomeYield / 100 * ordRate / 100;
  const divDrag      = asset.qualifiedDivYield   / 100 * ltcgRate / 100;
  const turnoverDrag = asset.expectedReturn / 100 * asset.turnoverRate * ltcgRate / 100;
  return ordDrag + divDrag + turnoverDrag;
}

function afterTaxReturn(asset: AssetClass, location: AccountType, ordRate: number, ltcgRate: number): number {
  return asset.expectedReturn / 100 - taxDragRate(asset, location, ordRate, ltcgRate);
}

// Typical asset profiles
const USBonds: AssetClass = { ordinaryIncomeYield: 4.5, qualifiedDivYield: 0, expectedReturn: 4.5, turnoverRate: 0.05 };
const USStocks: AssetClass = { ordinaryIncomeYield: 0.3, qualifiedDivYield: 1.5, expectedReturn: 10, turnoverRate: 0.03 };
const REITs: AssetClass = { ordinaryIncomeYield: 4.0, qualifiedDivYield: 0, expectedReturn: 8, turnoverRate: 0.10 };

// ─── taxDragRate ──────────────────────────────────────────────────────────────

describe("taxDragRate", () => {
  it("Roth: always 0 drag regardless of asset", () => {
    expect(taxDragRate(USBonds, "roth", 37, 23.8)).toBe(0);
    expect(taxDragRate(REITs, "roth", 37, 23.8)).toBe(0);
    expect(taxDragRate(USStocks, "roth", 37, 23.8)).toBe(0);
  });

  it("Traditional: always 0 drag (deferred until withdrawal)", () => {
    expect(taxDragRate(USBonds, "traditional", 37, 23.8)).toBe(0);
    expect(taxDragRate(REITs, "traditional", 37, 23.8)).toBe(0);
  });

  it("Taxable bonds: drag = ordinaryYield × ordRate", () => {
    // USBonds: ordinaryIncomeYield 4.5%, ordRate 37%
    // drag = 0.045 * 0.37 = 0.01665 (1.665%)
    const drag = taxDragRate(USBonds, "taxable", 37, 23.8);
    const expected = (4.5 / 100) * (37 / 100) + 0 + (4.5 / 100) * 0.05 * (23.8 / 100);
    expect(drag).toBeCloseTo(expected, 6);
  });

  it("Taxable US stocks: drag = qualDivYield × ltcgRate + turnover drag", () => {
    const drag = taxDragRate(USStocks, "taxable", 37, 15);
    const ordDrag      = (0.3 / 100) * (37 / 100);
    const divDrag      = (1.5 / 100) * (15 / 100);
    const turnoverDrag = (10 / 100) * 0.03 * (15 / 100);
    expect(drag).toBeCloseTo(ordDrag + divDrag + turnoverDrag, 6);
  });

  it("Taxable REITs: high ordinary yield → high drag", () => {
    const drag = taxDragRate(REITs, "taxable", 37, 23.8);
    expect(drag).toBeGreaterThan(taxDragRate(USStocks, "taxable", 37, 23.8));
  });

  it("drag is monotonically increasing with ordRate (for assets with ordinary yield)", () => {
    const rates = [0.10, 0.22, 0.32, 0.37];
    const drags = rates.map(r => taxDragRate(USBonds, "taxable", r * 100, 15));
    for (let i = 1; i < drags.length; i++) {
      expect(drags[i]).toBeGreaterThan(drags[i - 1]!);
    }
  });

  it("drag is monotonically increasing with ltcgRate (for assets with qualified div yield)", () => {
    const rates = [0, 15, 20, 23.8];
    const drags = rates.map(r => taxDragRate(USStocks, "taxable", 37, r));
    for (let i = 1; i < drags.length; i++) {
      expect(drags[i]).toBeGreaterThanOrEqual(drags[i - 1]!);
    }
  });
});

// ─── afterTaxReturn ───────────────────────────────────────────────────────────

describe("afterTaxReturn", () => {
  it("Roth: afterTax = gross return (no drag)", () => {
    const atr = afterTaxReturn(USBonds, "roth", 37, 23.8);
    expect(atr).toBeCloseTo(USBonds.expectedReturn / 100, 6);
  });

  it("Traditional: afterTax = gross return (drag is 0, taxed at withdrawal)", () => {
    const atr = afterTaxReturn(USBonds, "traditional", 37, 23.8);
    expect(atr).toBeCloseTo(USBonds.expectedReturn / 100, 6);
  });

  it("Taxable: afterTax < gross return", () => {
    const atr = afterTaxReturn(USStocks, "taxable", 37, 15);
    expect(atr).toBeLessThan(USStocks.expectedReturn / 100);
  });

  it("Roth ≥ Taxable after-tax return for same asset (Roth is always at least as good)", () => {
    const assets = [USBonds, USStocks, REITs];
    for (const asset of assets) {
      expect(afterTaxReturn(asset, "roth", 37, 23.8))
        .toBeGreaterThanOrEqual(afterTaxReturn(asset, "taxable", 37, 23.8));
    }
  });
});

// ─── Compounding impact of drag ───────────────────────────────────────────────

describe("compounding drag impact", () => {
  it("20yr compounding: FV difference is meaningful for high-drag assets", () => {
    const years = 20;
    const initial = 100000;
    const grossReturn = USBonds.expectedReturn / 100;
    const drag = taxDragRate(USBonds, "taxable", 37, 23.8);
    const fvWithDrag = initial * Math.pow(1 + grossReturn - drag, years);
    const fvNoDrag   = initial * Math.pow(1 + grossReturn, years);
    // Drag should reduce FV by a meaningful amount (> $5k on $100k over 20yr)
    expect(fvNoDrag - fvWithDrag).toBeGreaterThan(5000);
  });
});
