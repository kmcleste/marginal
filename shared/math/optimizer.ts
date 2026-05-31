/**
 * Coordinate-descent optimizer for the compensation tool.
 *
 * Maximizes the utility function:
 *   U = netTakeHome + Σ(growthPremiumPV(contribution_i)) + employerMatchCapture - liquidityPenalty
 *
 * Decision variables: [401k, HSA, FSA, traditionalIRA, megaBackdoor401k]
 * per person (10 variables total in household mode).
 *
 * Coordinate descent: cycle through each variable, optimize it holding the
 * others fixed, until convergence. Multiple restarts from random starting
 * points to avoid local optima.
 */

import { LIMITS_2024 } from "./tax-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContributionVariables {
  traditional401k: number;
  hsa: number;
  fsa: number;
  traditionalIra: number;
  megaBackdoor401k: number;
}

export interface OptimizerConstraints {
  gross: number;
  employerMatch: number;
  employerMatchVestingRate: number; // 0–1 fraction of match that's vested
  employerMatchCap: number; // e.g. 0.06 = match up to 6% of salary
  liquidityFloor: number; // minimum desired annual take-home
  hsaEligible: boolean;
  familyHsa: boolean;
  iraEligible: boolean; // false if over deductibility phaseout
  backdoorIraEligible: boolean;
  megaBackdoorAvailable: boolean;
  maxMegaBackdoor: number; // plan-specific limit
  age: number;
}

export interface OptimizerParams {
  discountRate: number; // e.g. 0.07 for 7% expected return
  yearsToRetirement: number;
  taxRateNow: number; // combined marginal rate this year
  taxRateRetirement: number; // expected marginal rate in retirement
  rothGrowthPremiumMultiplier: number; // extra value of Roth vs taxable (default 1.0)
  liquidityPenaltyRate: number; // utility penalty per $ below liquidity floor
}

export interface OptimizationResult {
  variables: ContributionVariables;
  utility: number;
  netTakeHome: number;
  employerMatchCaptured: number;
  iterations: number;
  converged: boolean;
}

// ─── Utility Function ─────────────────────────────────────────────────────────

/**
 * Present value of the tax-deferral or tax-free growth premium.
 *
 * For traditional (pre-tax): the benefit is deferral — pay taxes later at
 * (presumably) lower rates. PV of that benefit per dollar contributed today:
 *   pvBenefit = (taxRateNow - taxRateRetirement) * FV factor
 *
 * For Roth: benefit is permanent tax-free growth.
 * This function handles both via the callerʼs tax rate assumptions.
 */
export function growthPremiumPV(
  contribution: number,
  params: OptimizerParams,
): number {
  const fvFactor = Math.pow(1 + params.discountRate, params.yearsToRetirement);
  // Net benefit: difference between paying taxes now vs later, on the grown amount
  const taxDeferralBenefit =
    contribution * fvFactor * (params.taxRateNow - params.taxRateRetirement);
  return taxDeferralBenefit / Math.pow(1 + params.discountRate, params.yearsToRetirement);
}

/**
 * Employer match captured given a 401k election.
 */
export function employerMatchCaptured(
  gross: number,
  traditional401k: number,
  megaBackdoor: number,
  constraints: OptimizerConstraints,
): number {
  const employeeElective = traditional401k; // mega-backdoor is after-tax, doesn't count for match at most plans
  const matchableContribution = Math.min(
    employeeElective,
    gross * constraints.employerMatchCap,
  );
  return matchableContribution * constraints.employerMatch * constraints.employerMatchVestingRate;
}

/**
 * Core utility function. Pure — deterministic given inputs.
 */
export function computeUtility(
  vars: ContributionVariables,
  netTakeHome: number,
  constraints: OptimizerConstraints,
  params: OptimizerParams,
): number {
  // Employer match capture (treat as equivalent to cash)
  const matchCaptured = employerMatchCaptured(
    constraints.gross,
    vars.traditional401k,
    vars.megaBackdoor401k,
    constraints,
  );

  // Growth premium PV for each tax-advantaged bucket
  const pv401k = growthPremiumPV(vars.traditional401k, params);
  const pvHsa = growthPremiumPV(vars.hsa, params) * 1.5; // triple tax advantage premium
  const pvIra = growthPremiumPV(vars.traditionalIra, params);
  const pvMega = growthPremiumPV(vars.megaBackdoor401k, params) * params.rothGrowthPremiumMultiplier;

  // Liquidity penalty: utility drops sharply below the floor
  const liquidityShortfall = Math.max(0, constraints.liquidityFloor - netTakeHome);
  const liquidityPenalty = liquidityShortfall * params.liquidityPenaltyRate;

  return (
    netTakeHome +
    matchCaptured +
    pv401k +
    pvHsa +
    pvIra +
    pvMega -
    liquidityPenalty
  );
}

// ─── Variable Bounds ──────────────────────────────────────────────────────────

export function getBounds(
  constraints: OptimizerConstraints,
  catchUp: boolean,
): Record<keyof ContributionVariables, [number, number]> {
  const k401Max = catchUp
    ? LIMITS_2024.k401.employeeElective + LIMITS_2024.k401.catchUp
    : LIMITS_2024.k401.employeeElective;

  const hsaMax = constraints.hsaEligible
    ? (constraints.familyHsa ? LIMITS_2024.hsa.family : LIMITS_2024.hsa.individual) +
      (catchUp ? LIMITS_2024.hsa.catchUp : 0)
    : 0;

  const megaMax = constraints.megaBackdoorAvailable
    ? Math.min(
        constraints.maxMegaBackdoor,
        LIMITS_2024.k401.totalAnnualAdditions - k401Max,
      )
    : 0;

  return {
    traditional401k: [0, k401Max],
    hsa: [0, hsaMax],
    fsa: [0, LIMITS_2024.fsa.health],
    traditionalIra: [0, constraints.iraEligible ? LIMITS_2024.ira.contribution : 0],
    megaBackdoor401k: [0, megaMax],
  };
}

// ─── Coordinate Descent ───────────────────────────────────────────────────────

export interface CoordinateDescentOptions {
  maxIterations?: number;
  tolerance?: number;
  stepSize?: number;
  restarts?: number;
}

/**
 * Optimize a single variable holding all others fixed.
 * Uses golden-section search over the variable's feasible range.
 */
function optimizeVariable(
  varKey: keyof ContributionVariables,
  current: ContributionVariables,
  bounds: Record<keyof ContributionVariables, [number, number]>,
  utilityFn: (vars: ContributionVariables) => number,
  steps: number = 100,
): number {
  const [lo, hi] = bounds[varKey];
  if (lo >= hi) return lo;

  let bestVal = current[varKey];
  let bestU = utilityFn(current);
  const stepSize = (hi - lo) / steps;

  for (let x = lo; x <= hi; x += stepSize) {
    const candidate = { ...current, [varKey]: x };
    const u = utilityFn(candidate);
    if (u > bestU) {
      bestU = u;
      bestVal = x;
    }
  }

  return bestVal;
}

/**
 * One pass of coordinate descent over all variables.
 * Returns the updated variables and whether they changed materially.
 */
function coordinateDescentPass(
  vars: ContributionVariables,
  bounds: Record<keyof ContributionVariables, [number, number]>,
  utilityFn: (vars: ContributionVariables) => number,
  tolerance: number,
): { vars: ContributionVariables; changed: boolean } {
  const keys = Object.keys(vars) as Array<keyof ContributionVariables>;
  let current = { ...vars };
  let changed = false;

  for (const key of keys) {
    const next = optimizeVariable(key, current, bounds, utilityFn);
    if (Math.abs(next - current[key]) > tolerance) changed = true;
    current = { ...current, [key]: next };
  }

  return { vars: current, changed };
}

/**
 * Main optimizer. Runs coordinate descent from multiple starting points,
 * returns the best result found.
 *
 * The caller is responsible for wiring the utility function — this module
 * handles the search strategy only.
 */
export function optimize(
  initialVars: ContributionVariables,
  bounds: Record<keyof ContributionVariables, [number, number]>,
  utilityFn: (vars: ContributionVariables) => number,
  options: CoordinateDescentOptions = {},
): { vars: ContributionVariables; utility: number; iterations: number; converged: boolean } {
  const {
    maxIterations = 200,
    tolerance = 1,
    restarts = 5,
  } = options;

  let bestVars = initialVars;
  let bestUtility = utilityFn(initialVars);
  let totalIterations = 0;
  let converged = false;

  // Multiple restarts to escape local optima
  const startingPoints: ContributionVariables[] = [initialVars];
  for (let r = 1; r < restarts; r++) {
    const randomStart: ContributionVariables = {
      traditional401k: bounds.traditional401k[0] + Math.random() * (bounds.traditional401k[1] - bounds.traditional401k[0]),
      hsa: bounds.hsa[0] + Math.random() * (bounds.hsa[1] - bounds.hsa[0]),
      fsa: bounds.fsa[0] + Math.random() * (bounds.fsa[1] - bounds.fsa[0]),
      traditionalIra: bounds.traditionalIra[0] + Math.random() * (bounds.traditionalIra[1] - bounds.traditionalIra[0]),
      megaBackdoor401k: bounds.megaBackdoor401k[0] + Math.random() * (bounds.megaBackdoor401k[1] - bounds.megaBackdoor401k[0]),
    };
    startingPoints.push(randomStart);
  }

  for (const start of startingPoints) {
    let current = { ...start };
    let localConverged = false;

    for (let iter = 0; iter < maxIterations; iter++) {
      totalIterations++;
      const { vars: next, changed } = coordinateDescentPass(current, bounds, utilityFn, tolerance);
      current = next;

      if (!changed) {
        localConverged = true;
        break;
      }
    }

    const u = utilityFn(current);
    if (u > bestUtility) {
      bestUtility = u;
      bestVars = current;
      converged = localConverged;
    }
  }

  return { vars: bestVars, utility: bestUtility, iterations: totalIterations, converged };
}
