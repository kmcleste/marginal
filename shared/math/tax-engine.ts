/**
 * Core tax calculation engine.
 *
 * All functions are pure — no side effects, no I/O. Pass in the data you
 * want computed, get back a number or structured result. This makes the
 * entire module independently unit-testable without a browser or React.
 *
 * References:
 *   Federal: IRS Publication 505, Rev. Proc. 2023-34 (2024 parameters)
 *   State:   shared/tax-data/{year}/states.json
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TaxBracket {
  min: number;
  max: number | null; // null = no upper bound
  rate: number; // decimal, e.g. 0.22 for 22%
}

export interface BracketSet {
  brackets: TaxBracket[];
  standardDeduction: number;
  personalExemption?: number;
}

export type FilingStatus = "single" | "mfj" | "mfs" | "hoh";

export interface FederalTaxParams2024 {
  ordinaryBrackets: Record<FilingStatus, TaxBracket[]>;
  standardDeductions: Record<FilingStatus, number>;
  ltcgBrackets: Record<FilingStatus, TaxBracket[]>;
  niitThreshold: Record<FilingStatus, number>;
  amtExemption: Record<FilingStatus, number>;
  amtPhaseout: Record<FilingStatus, number>;
  socialSecurity: {
    wageBase: number;
    employeeRate: number;
    additionalMedicareThreshold: Record<FilingStatus, number>;
    additionalMedicareRate: number;
  };
}

export interface TaxResult {
  grossIncome: number;
  agi: number;
  taxableIncome: number;
  federalIncomeTax: number;
  stateIncomeTax: number;
  socialSecurityTax: number;
  medicareTax: number;
  niit: number;
  totalTax: number;
  effectiveRate: number;
  marginalFederalRate: number;
  marginalStateRate: number;
  marginalCombinedRate: number;
  netTakeHome: number;
}

export interface IncomeSources {
  wages: number;
  selfEmployment?: number;
  longTermCapitalGains?: number;
  shortTermCapitalGains?: number;
  qualifiedDividends?: number;
  ordinaryDividends?: number;
  interest?: number;
  otherOrdinary?: number;
}

export interface PreTaxDeductions {
  traditional401k?: number;
  hsa?: number;
  fsa?: number;
  traditionalIra?: number; // deductible portion
  other?: number;
}

// ─── 2024 Federal Parameters ─────────────────────────────────────────────────

export const FEDERAL_2024: FederalTaxParams2024 = {
  ordinaryBrackets: {
    single: [
      { min: 0, max: 11600, rate: 0.10 },
      { min: 11600, max: 47150, rate: 0.12 },
      { min: 47150, max: 100525, rate: 0.22 },
      { min: 100525, max: 191950, rate: 0.24 },
      { min: 191950, max: 243725, rate: 0.32 },
      { min: 243725, max: 609350, rate: 0.35 },
      { min: 609350, max: null, rate: 0.37 },
    ],
    mfj: [
      { min: 0, max: 23200, rate: 0.10 },
      { min: 23200, max: 94300, rate: 0.12 },
      { min: 94300, max: 201050, rate: 0.22 },
      { min: 201050, max: 383900, rate: 0.24 },
      { min: 383900, max: 487450, rate: 0.32 },
      { min: 487450, max: 731200, rate: 0.35 },
      { min: 731200, max: null, rate: 0.37 },
    ],
    mfs: [
      { min: 0, max: 11600, rate: 0.10 },
      { min: 11600, max: 47150, rate: 0.12 },
      { min: 47150, max: 100525, rate: 0.22 },
      { min: 100525, max: 191950, rate: 0.24 },
      { min: 191950, max: 243725, rate: 0.32 },
      { min: 243725, max: 365600, rate: 0.35 },
      { min: 365600, max: null, rate: 0.37 },
    ],
    hoh: [
      { min: 0, max: 16550, rate: 0.10 },
      { min: 16550, max: 63100, rate: 0.12 },
      { min: 63100, max: 100500, rate: 0.22 },
      { min: 100500, max: 191950, rate: 0.24 },
      { min: 191950, max: 243700, rate: 0.32 },
      { min: 243700, max: 609350, rate: 0.35 },
      { min: 609350, max: null, rate: 0.37 },
    ],
  },
  standardDeductions: {
    single: 14600,
    mfj: 29200,
    mfs: 14600,
    hoh: 21900,
  },
  ltcgBrackets: {
    single: [
      { min: 0, max: 47025, rate: 0.00 },
      { min: 47025, max: 518900, rate: 0.15 },
      { min: 518900, max: null, rate: 0.20 },
    ],
    mfj: [
      { min: 0, max: 94050, rate: 0.00 },
      { min: 94050, max: 583750, rate: 0.15 },
      { min: 583750, max: null, rate: 0.20 },
    ],
    mfs: [
      { min: 0, max: 47025, rate: 0.00 },
      { min: 47025, max: 291850, rate: 0.15 },
      { min: 291850, max: null, rate: 0.20 },
    ],
    hoh: [
      { min: 0, max: 63000, rate: 0.00 },
      { min: 63000, max: 551350, rate: 0.15 },
      { min: 551350, max: null, rate: 0.20 },
    ],
  },
  niitThreshold: {
    single: 200000,
    mfj: 250000,
    mfs: 125000,
    hoh: 200000,
  },
  amtExemption: {
    single: 85700,
    mfj: 133300,
    mfs: 66650,
    hoh: 85700,
  },
  amtPhaseout: {
    single: 609350,
    mfj: 1218700,
    mfs: 609350,
    hoh: 609350,
  },
  socialSecurity: {
    wageBase: 168600,
    employeeRate: 0.062,
    additionalMedicareThreshold: {
      single: 200000,
      mfj: 250000,
      mfs: 125000,
      hoh: 200000,
    },
    additionalMedicareRate: 0.009,
  },
};

export const MEDICARE_RATE = 0.0145;

// ─── Core Calculation Functions ───────────────────────────────────────────────

/**
 * Apply a bracket schedule to a taxable amount.
 * Returns the total tax owed.
 */
export function applyBrackets(taxableAmount: number, brackets: TaxBracket[]): number {
  if (taxableAmount <= 0) return 0;

  let tax = 0;
  for (const bracket of brackets) {
    if (taxableAmount <= bracket.min) break;
    const upper = bracket.max ?? Infinity;
    const taxable = Math.min(taxableAmount, upper) - bracket.min;
    tax += taxable * bracket.rate;
  }
  return tax;
}

/**
 * Find the marginal rate that applies to a given income level.
 */
export function marginalRate(income: number, brackets: TaxBracket[]): number {
  for (let i = brackets.length - 1; i >= 0; i--) {
    const bracket = brackets[i];
    if (bracket && income > bracket.min) {
      return bracket.rate;
    }
  }
  return brackets[0]?.rate ?? 0;
}

/**
 * Calculate federal income tax on ordinary income.
 * taxableIncome = AGI - deductions (already computed by caller)
 */
export function federalOrdinaryTax(
  taxableIncome: number,
  filingStatus: FilingStatus,
  params: FederalTaxParams2024 = FEDERAL_2024,
): number {
  return applyBrackets(taxableIncome, params.ordinaryBrackets[filingStatus]);
}

/**
 * Calculate the LTCG / qualified dividend tax.
 *
 * The "stacking" rule: LTCGs are taxed at preferential rates, but those rates
 * are determined by where the gains fall when stacked on top of ordinary income.
 */
export function federalLtcgTax(
  ordinaryTaxableIncome: number,
  ltcgAndQualDividends: number,
  filingStatus: FilingStatus,
  params: FederalTaxParams2024 = FEDERAL_2024,
): number {
  if (ltcgAndQualDividends <= 0) return 0;

  const brackets = params.ltcgBrackets[filingStatus];
  const totalIncome = ordinaryTaxableIncome + ltcgAndQualDividends;

  // Tax on (ordinary + LTCG) at preferential rates, minus tax on ordinary alone
  const taxOnTotal = applyBrackets(totalIncome, brackets);
  const taxOnOrdinary = applyBrackets(ordinaryTaxableIncome, brackets);
  return Math.max(0, taxOnTotal - taxOnOrdinary);
}

/**
 * Net Investment Income Tax (3.8%) on the lesser of NII or the amount
 * by which MAGI exceeds the threshold.
 */
export function niit(
  magi: number,
  netInvestmentIncome: number,
  filingStatus: FilingStatus,
  params: FederalTaxParams2024 = FEDERAL_2024,
): number {
  const threshold = params.niitThreshold[filingStatus];
  const excessMagi = Math.max(0, magi - threshold);
  const niitBase = Math.min(excessMagi, netInvestmentIncome);
  return niitBase * 0.038;
}

/**
 * Employee-side Social Security tax (6.2% up to wage base).
 */
export function socialSecurityTax(
  wages: number,
  params: FederalTaxParams2024 = FEDERAL_2024,
): number {
  return Math.min(wages, params.socialSecurity.wageBase) * params.socialSecurity.employeeRate;
}

/**
 * Employee-side Medicare tax (1.45% on all wages + 0.9% above threshold).
 */
export function medicareTax(
  wages: number,
  filingStatus: FilingStatus,
  params: FederalTaxParams2024 = FEDERAL_2024,
): number {
  const baseTax = wages * MEDICARE_RATE;
  const additionalThreshold = params.socialSecurity.additionalMedicareThreshold[filingStatus];
  const additionalTax =
    Math.max(0, wages - additionalThreshold) * params.socialSecurity.additionalMedicareRate;
  return baseTax + additionalTax;
}

/**
 * Full federal tax computation — returns a structured breakdown.
 */
export function computeFederalTax(
  income: IncomeSources,
  preTax: PreTaxDeductions,
  filingStatus: FilingStatus,
  itemizedDeductions?: number,
  params: FederalTaxParams2024 = FEDERAL_2024,
): {
  agi: number;
  taxableIncome: number;
  ordinaryTax: number;
  ltcgTax: number;
  niitAmount: number;
  ssTax: number;
  medicareTaxAmount: number;
  totalFederalTax: number;
  marginalOrdinaryRate: number;
  marginalLtcgRate: number;
} {
  const totalWages = (income.wages ?? 0) + (income.selfEmployment ?? 0);
  const ordinaryNonWage =
    (income.shortTermCapitalGains ?? 0) +
    (income.ordinaryDividends ?? 0) -
    (income.qualifiedDividends ?? 0) + // qualified divs excluded from ordinary
    (income.interest ?? 0) +
    (income.otherOrdinary ?? 0);

  const preTaxTotal =
    (preTax.traditional401k ?? 0) +
    (preTax.hsa ?? 0) +
    (preTax.fsa ?? 0) +
    (preTax.traditionalIra ?? 0) +
    (preTax.other ?? 0);

  const agi = totalWages + ordinaryNonWage + (income.longTermCapitalGains ?? 0) + (income.qualifiedDividends ?? 0) - preTaxTotal;

  const stdDed = params.standardDeductions[filingStatus];
  const deduction = itemizedDeductions ? Math.max(itemizedDeductions, stdDed) : stdDed;
  const taxableIncome = Math.max(0, agi - deduction);

  const ltcgIncome = (income.longTermCapitalGains ?? 0) + (income.qualifiedDividends ?? 0);
  const ordinaryTaxableIncome = Math.max(0, taxableIncome - ltcgIncome);

  const ordinaryTax = federalOrdinaryTax(ordinaryTaxableIncome, filingStatus, params);
  const ltcgTax = federalLtcgTax(ordinaryTaxableIncome, ltcgIncome, filingStatus, params);

  const netInvestmentIncome =
    ltcgIncome + (income.interest ?? 0) + (income.ordinaryDividends ?? 0) - (income.qualifiedDividends ?? 0);
  const niitAmount = niit(agi, netInvestmentIncome, filingStatus, params);

  const ssTax = socialSecurityTax(totalWages, params);
  const medicareTaxAmount = medicareTax(totalWages, filingStatus, params);

  const totalFederalTax = ordinaryTax + ltcgTax + niitAmount + ssTax + medicareTaxAmount;

  return {
    agi,
    taxableIncome,
    ordinaryTax,
    ltcgTax,
    niitAmount,
    ssTax,
    medicareTaxAmount,
    totalFederalTax,
    marginalOrdinaryRate: marginalRate(ordinaryTaxableIncome, params.ordinaryBrackets[filingStatus]),
    marginalLtcgRate: marginalRate(ordinaryTaxableIncome + ltcgIncome, params.ltcgBrackets[filingStatus]),
  };
}

// ─── IRS Limits 2024 ──────────────────────────────────────────────────────────

export const LIMITS_2024 = {
  k401: {
    employeeElective: 23000,
    catchUp: 7500, // age 50+
    totalAnnualAdditions: 69000, // §415 limit (employee + employer)
    totalWithCatchUp: 76500,
  },
  hsa: {
    individual: 4150,
    family: 8300,
    catchUp: 1000, // age 55+
  },
  fsa: {
    health: 3200,
    dependent: 5000,
  },
  ira: {
    contribution: 7000,
    catchUp: 1000, // age 50+
    rothPhaseoutSingle: { start: 146000, end: 161000 },
    rothPhaseoutMfj: { start: 230000, end: 240000 },
    traditionalDeductiblePhaseoutSingle: { start: 77000, end: 87000 },
    traditionalDeductiblePhaseoutMfj: { start: 123000, end: 143000 },
  },
} as const;
