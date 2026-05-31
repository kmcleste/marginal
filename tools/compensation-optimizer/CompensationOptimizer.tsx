"use client";

import { useState, useMemo, useCallback } from "react";
import { applyBrackets, marginalRate, FEDERAL_2024, LIMITS_2024 } from "@marginal/math";
import { colors as T, fonts } from "@marginal/theme";
import statesRaw from "../../shared/tax-data/2024/states.json";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilingStatus = "single" | "mfj";

interface BracketEntry { min: number; max: number | null; rate: number }
interface BracketSet { brackets?: BracketEntry[]; standardDeduction: number; personalExemption?: number }
interface StateEntry {
  name: string;
  type: "none" | "flat" | "bracketed";
  flatRate?: number;
  single?: BracketSet;
  mfj?: BracketSet;
  surtax?: { threshold: number; rate: number; description: string };
}

const statesData = statesRaw as unknown as Record<string, StateEntry>;

const STATE_OPTIONS = Object.entries(statesData)
  .filter(([k]) => k !== "_meta")
  .map(([code, d]) => ({ code, name: d.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ─── Theme (mapped to shared tokens) ─────────────────────────────────────────

const C = {
  bg:          T.bg.base,
  surface:     T.bg.surface,
  surfaceAlt:  T.bg.elevated,
  border:      T.bg.border,
  borderBright:T.bg.borderSubtle,
  accent:      T.mint.DEFAULT,
  accentDim:   T.mint.bg,
  accentGlow:  T.mint.bg,
  gold:        T.gold.DEFAULT,
  goldDim:     T.gold.bg,
  blue:        T.blue.DEFAULT,
  blueDim:     T.blue.bg,
  purple:      T.purple.DEFAULT,
  purpleDim:   T.purple.bg,
  red:         T.red.DEFAULT,
  orange:      T.red.orange,
  muted:       "#374151",
  mutedMid:    "#4b5563",
  mutedLight:  T.text.secondary,
  text:        T.text.primary,
  textDim:     T.text.secondary,
} as const;

const mono = fonts.mono;
const sans = fonts.sans;

// ─── IRS Limits (from shared constants) ──────────────────────────────────────

const LIM = {
  k401:      LIMITS_2024.k401.employeeElective,
  k401catch: LIMITS_2024.k401.employeeElective + LIMITS_2024.k401.catchUp,
  hsaSingle: LIMITS_2024.hsa.individual,
  hsaFamily: LIMITS_2024.hsa.family,
  ira:       LIMITS_2024.ira.contribution,
  iraCatch:  LIMITS_2024.ira.contribution + LIMITS_2024.ira.catchUp,
  fsa:       LIMITS_2024.fsa.health,
  megaBack:  43500, // §415 total additions limit minus employee elective
};

const SUPP_RATE = 0.22; // federal supplemental withholding rate

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── State Tax Engine ─────────────────────────────────────────────────────────

function calcStateTax(agi: number, stateCode: string, status: FilingStatus): number {
  const state = statesData[stateCode];
  if (!state || state.type === "none") return 0;

  const bracketSet = status === "mfj" ? state.mfj : state.single;
  const stdDed = bracketSet?.standardDeduction ?? 0;
  const personalExemption = bracketSet?.personalExemption ?? 0;
  const taxable = Math.max(0, agi - stdDed - personalExemption);

  let baseTax = 0;
  if (state.type === "flat") {
    baseTax = taxable * (state.flatRate ?? 0);
  } else if (state.type === "bracketed" && bracketSet?.brackets) {
    baseTax = applyBrackets(taxable, bracketSet.brackets as BracketEntry[]);
  }

  if (state.surtax && agi > state.surtax.threshold) {
    baseTax += (agi - state.surtax.threshold) * state.surtax.rate;
  }

  return baseTax;
}

// ─── Core Tax Engine ──────────────────────────────────────────────────────────

function calcTaxFull(
  gross: number,
  p: { k401?: number; hsa?: number; fsa?: number; otherPretax?: number },
  status: FilingStatus,
  stateCode: string,
) {
  const pretax = (p.k401 ?? 0) + (p.hsa ?? 0) + (p.fsa ?? 0) + (p.otherPretax ?? 0);
  const agi = gross - pretax;
  const fedStdDed = FEDERAL_2024.standardDeductions[status];
  const fedTaxable = Math.max(0, agi - fedStdDed);
  const fTax = applyBrackets(fedTaxable, FEDERAL_2024.ordinaryBrackets[status]);
  const marg = marginalRate(fedTaxable, FEDERAL_2024.ordinaryBrackets[status]);
  const nTax = calcStateTax(agi, stateCode, status);
  const ss   = Math.min(gross, FEDERAL_2024.socialSecurity.wageBase) * FEDERAL_2024.socialSecurity.employeeRate;
  const med  = gross * 0.0145 + Math.max(0, gross - FEDERAL_2024.socialSecurity.additionalMedicareThreshold[status]) * 0.009;
  const total = fTax + nTax + ss + med;
  return { fTax, nTax, ss, med, total, marginal: marg, agi, fedTaxable, pretax };
}

// ─── Utility Function ─────────────────────────────────────────────────────────

interface UtilParams {
  k401: number; hsa: number; fsa: number; ira: number; megaBack: number; otherPretax: number;
  liquidityFloor: number; retireHorizon: number; expectedReturn: number; discountRate: number;
}

interface UtilCfg {
  gross: number; bonusGross: number; status: FilingStatus;
  matchPct: number; matchCap: number; matchVestingFactor: number;
  periodsPerYear: number; stateCode: string;
}

function computeUtility(params: UtilParams, cfg: UtilCfg) {
  const { k401, hsa, fsa, ira, megaBack, otherPretax, liquidityFloor, retireHorizon, expectedReturn, discountRate } = params;
  const { gross, bonusGross, status, matchPct, matchCap, matchVestingFactor, stateCode } = cfg;

  const matchableContrib = Math.min(k401, gross * (matchCap / 100));
  const employerMatch = matchableContrib * (matchPct / 100) * matchVestingFactor;

  const t = calcTaxFull(gross + bonusGross, { k401, hsa, fsa, otherPretax }, status, stateCode);

  const postTaxIRA = ira;
  const net = (gross + bonusGross) - t.total - t.pretax - postTaxIRA;

  const liquidityPenalty = net < liquidityFloor ? (liquidityFloor - net) * 5 : 0;

  // Lump-sum growth premium: amount × ((1+r)^n / (1+d)^n − 1)
  // Extra PV created by investing this year's contribution at r vs consuming at discount rate d.
  const G = (amount: number) =>
    amount * (Math.pow(1 + expectedReturn, retireHorizon) / Math.pow(1 + discountRate, retireHorizon) - 1);

  const k401Fv = G(k401 + employerMatch);
  const megaFv = G(megaBack) * 1.15;
  const hsaFv  = G(hsa) * 1.3;
  const iraFv  = G(ira) * 1.1;

  const utility = net + k401Fv + megaFv + hsaFv + iraFv + employerMatch - liquidityPenalty;

  return {
    utility, net, employerMatch, k401Fv, megaFv, hsaFv, iraFv, liquidityPenalty,
    taxTotal: t.total, marginal: t.marginal,
    effectiveRate: t.total / (gross + bonusGross),
    taxSavings: calcTaxFull(gross + bonusGross, { k401: 0, hsa: 0, fsa: 0, otherPretax }, status, stateCode).total - t.total,
    pretax: t.pretax,
    breakdown: t,
  };
}

// ─── Optimizer ────────────────────────────────────────────────────────────────

interface OptConstraints {
  hsaFamily: boolean; catchup: boolean; megaBackdoor: boolean;
  liquidityFloor: number; retireHorizon: number;
  expectedReturn: number; discountRate: number; otherPretax: number;
}

function optimize(cfg: UtilCfg, constraints: OptConstraints) {
  const hsaMax  = constraints.hsaFamily ? LIM.hsaFamily : LIM.hsaSingle;
  const k401Max = constraints.catchup   ? LIM.k401catch : LIM.k401;
  const iraMax  = constraints.catchup   ? LIM.iraCatch  : LIM.ira;
  const megaMax = constraints.megaBackdoor ? LIM.megaBack : 0;

  const baseParams = {
    liquidityFloor: constraints.liquidityFloor,
    retireHorizon: constraints.retireHorizon,
    expectedReturn: constraints.expectedReturn / 100,
    discountRate: constraints.discountRate / 100,
  };

  const PARAMS = [
    { key: "k401" as const,    min: cfg.gross * (cfg.matchCap / 100), max: k401Max, step: 500 },
    { key: "hsa" as const,     min: 0, max: hsaMax,  step: 100 },
    { key: "fsa" as const,     min: 0, max: LIM.fsa, step: 100 },
    { key: "ira" as const,     min: 0, max: iraMax,  step: 500 },
    { key: "megaBack" as const,min: 0, max: megaMax, step: 500 },
    { key: "otherPretax" as const, min: constraints.otherPretax, max: constraints.otherPretax, step: 1 },
  ];

  const starts = [
    { k401: k401Max, hsa: hsaMax, fsa: LIM.fsa, ira: iraMax, megaBack: megaMax, otherPretax: constraints.otherPretax },
    { k401: cfg.gross * cfg.matchCap / 100, hsa: hsaMax, fsa: 0, ira: iraMax, megaBack: 0, otherPretax: constraints.otherPretax },
    { k401: k401Max, hsa: 0, fsa: 0, ira: 0, megaBack: 0, otherPretax: constraints.otherPretax },
    { k401: k401Max / 2, hsa: hsaMax / 2, fsa: LIM.fsa / 2, ira: iraMax, megaBack: megaMax / 2, otherPretax: constraints.otherPretax },
  ];

  let globalBest: typeof starts[0] | null = null;
  let globalBestU = -Infinity;

  for (const start of starts) {
    let current = { ...start };
    let improved = true;
    for (let iter = 0; iter < 30 && improved; iter++) {
      improved = false;
      for (const param of PARAMS) {
        if (param.min === param.max) continue;
        let bestVal = current[param.key];
        let bestU = computeUtility({ ...current, ...baseParams }, cfg).utility;
        for (let v = param.min; v <= param.max; v += param.step) {
          const u = computeUtility({ ...current, [param.key]: v, ...baseParams }, cfg).utility;
          if (u > bestU) { bestU = u; bestVal = v; improved = true; }
        }
        current = { ...current, [param.key]: bestVal };
      }
    }
    const finalU = computeUtility({ ...current, ...baseParams }, cfg).utility;
    if (finalU > globalBestU) { globalBestU = finalU; globalBest = { ...current }; }
  }

  return { params: globalBest!, utility: globalBestU, result: computeUtility({ ...globalBest!, ...baseParams }, cfg) };
}

// ─── Sensitivity ──────────────────────────────────────────────────────────────

type SweepKey = "k401" | "hsa" | "fsa" | "ira" | "megaBack";

function sensitivitySweep(key: SweepKey, cfg: UtilCfg, baseParams: UtilParams, constraints: OptConstraints, steps = 40) {
  const hsaMax  = constraints.hsaFamily ? LIM.hsaFamily : LIM.hsaSingle;
  const k401Max = constraints.catchup   ? LIM.k401catch : LIM.k401;
  const ranges: Record<SweepKey, [number, number]> = {
    k401:     [0, k401Max],
    hsa:      [0, hsaMax],
    fsa:      [0, LIM.fsa],
    ira:      [0, constraints.catchup ? LIM.iraCatch : LIM.ira],
    megaBack: [0, LIM.megaBack],
  };
  const [lo, hi] = ranges[key];
  return Array.from({ length: steps + 1 }, (_, i) => {
    const v = lo + (hi - lo) * (i / steps);
    const r = computeUtility({ ...baseParams, [key]: v }, cfg);
    return { x: v, utility: r.utility, net: r.net, taxSavings: r.taxSavings };
  });
}

// ─── Lifetime Simulation Engine ──────────────────────────────────────────────

interface SimYear {
  age: number;
  bal401k: number;
  balRoth: number;
  balHsa: number;
  balTaxable: number;
  total: number;
  salary: number;
  ssIncome: number;
  withdrawal: number;
  rmd: number;
  isRetired: boolean;
}

interface LifetimeInput {
  currentAge: number;
  retireAge: number;
  lifeExpectancy: number;
  init401k: number;
  initRoth: number;
  initHsa: number;
  initTaxable: number;
  contrib401k: number;
  contribMatch: number;
  contribRoth: number;
  contribHsa: number;
  currentNet: number;
  currentSalary: number;
  annualSpend: number;
  salaryGrowthRate: number;
  inflationRate: number;
  returnRate: number;
  ssClaimAge: number;
  ssAnnual: number;
  ltcgRate: number;
}

const RMD_DIVISORS: Record<number, number> = {
  73:26.5,74:25.5,75:24.6,76:23.7,77:22.9,78:22.0,79:21.1,80:20.2,
  81:19.4,82:18.5,83:17.7,84:16.8,85:16.0,86:15.2,87:14.4,88:13.7,
  89:12.9,90:12.2,91:11.5,92:10.8,93:10.1,94:9.5,95:8.9,96:8.4,
};

function runLifetimeSim(inp: LifetimeInput): SimYear[] {
  const years: SimYear[] = [];
  let bal401k = inp.init401k;
  let balRoth  = inp.initRoth;
  let balHsa   = inp.initHsa;
  let balTax   = inp.initTaxable;
  const r = inp.returnRate;

  for (let i = 0; i <= inp.lifeExpectancy - inp.currentAge; i++) {
    const age      = inp.currentAge + i;
    const isRetired = age >= inp.retireAge;
    const inflFactor  = Math.pow(1 + inp.inflationRate, i);
    const salaryScale = Math.pow(1 + inp.salaryGrowthRate, i);
    const salary   = isRetired ? 0 : inp.currentSalary * salaryScale;
    const ssIncome = age >= inp.ssClaimAge ? inp.ssAnnual * inflFactor : 0;

    // Grow all balances before contributions/withdrawals
    bal401k *= (1 + r);
    balRoth  *= (1 + r);
    balHsa   *= (1 + r);
    balTax   *= (1 + r * (1 - inp.ltcgRate)); // approximate after-tax LTCG drag on annual gains

    if (!isRetired) {
      // Contributions scale with salary; HSA stays flat (IRS limits don't auto-grow)
      bal401k += (inp.contrib401k + inp.contribMatch) * salaryScale;
      balRoth  += inp.contribRoth * salaryScale;
      balHsa   += inp.contribHsa;
      // Net surplus above annual spend flows to taxable brokerage
      const surplus = Math.max(0, inp.currentNet * inflFactor - inp.annualSpend * inflFactor);
      balTax += surplus;
      years.push({
        age, bal401k, balRoth, balHsa, balTaxable: balTax,
        total: bal401k + balRoth + balHsa + balTax,
        salary, ssIncome, withdrawal: 0, rmd: 0, isRetired: false,
      });
    } else {
      // Optimal withdrawal order: HSA (tax-free medical) → Roth → Taxable (LTCG) → 401k (ordinary income)
      const target  = Math.max(0, inp.annualSpend * inflFactor - ssIncome);
      const rmdDiv  = RMD_DIVISORS[age];
      const rmd     = age >= 73 && bal401k > 0 && rmdDiv !== undefined ? bal401k / rmdDiv : 0;

      let need = target;
      // HSA: assume ~30% of retirement spend is qualified medical (tax-free)
      const wHsa  = Math.min(balHsa,  Math.min(need * 0.3, need));
      need -= wHsa;  balHsa  = Math.max(0, balHsa  - wHsa);
      const wRoth = Math.min(balRoth, need);
      need -= wRoth; balRoth = Math.max(0, balRoth - wRoth);
      const wTax  = Math.min(balTax,  need);
      need -= wTax;  balTax  = Math.max(0, balTax  - wTax);
      // 401k: satisfy remaining need or forced RMD, whichever is larger
      const w401k = Math.min(bal401k, Math.max(rmd, need));
      bal401k = Math.max(0, bal401k - w401k);

      years.push({
        age, bal401k, balRoth, balHsa, balTaxable: balTax,
        total: Math.max(0, bal401k + balRoth + balHsa + balTax),
        salary: 0, ssIncome,
        withdrawal: wHsa + wRoth + wTax + w401k,
        rmd, isRetired: true,
      });
    }
  }
  return years;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const fmt  = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const fmtK = (n: number) => Math.abs(n) >= 1000 ? `$${((n || 0) / 1000).toFixed(Math.abs(n) >= 100000 ? 0 : 1)}k` : fmt(n);
const pct  = (n: number) => `${((n || 0) * 100).toFixed(1)}%`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ─── UI Primitives ────────────────────────────────────────────────────────────

function Sparkline({ data, width = 120, height = 32, color = C.accent, valueKey = "utility" }: {
  data?: Array<Record<string, number>>; width?: number; height?: number; color?: string; valueKey?: string;
}) {
  if (!data?.length) return null;
  const vals = data.map(d => d[valueKey] ?? 0);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const range = hi - lo || 1;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * width;
    const y = height - ((v - lo) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <polyline points={`0,${height} ${pts} ${width},${height}`} fill={color + "15"} strokeWidth={0} />
    </svg>
  );
}

function Card({ children, style, glow, goldGlow }: {
  children: React.ReactNode; style?: React.CSSProperties; glow?: boolean; goldGlow?: boolean;
}) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${glow ? C.accent + "55" : goldGlow ? C.gold + "44" : C.border}`,
      borderRadius: 12, padding: "16px 18px",
      boxShadow: glow ? `0 0 24px ${C.accentGlow}` : goldGlow ? `0 0 24px ${C.gold}11` : "none",
      ...style,
    }}>{children}</div>
  );
}

function Sl({ label, value, min, max, step, onChange, color = C.accent, fmt: fmtFn = fmt, hint, disabled }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; color?: string; fmt?: (v: number) => string;
  hint?: string; disabled?: boolean;
}) {
  const pctFill = clamp((value - min) / (max - min || 1), 0, 1) * 100;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
        <span style={{ fontSize: 12, color: disabled ? C.muted : color, fontFamily: mono, fontWeight: 600 }}>{fmtFn(value)}</span>
      </div>
      <div style={{ position: "relative", height: 4, background: C.muted + "44", borderRadius: 2 }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pctFill}%`, background: disabled ? C.muted : color, borderRadius: 2, transition: "width 0.2s" }} />
      </div>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", marginTop: 2, opacity: disabled ? 0.3 : 1, accentColor: color }} />
      {hint && <div style={{ fontSize: 9, color: C.muted, marginTop: 1, fontFamily: sans }}>{hint}</div>}
    </div>
  );
}

function Tag({ children, color = C.accent }: { children: React.ReactNode; color?: string }) {
  return <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 4, padding: "1px 6px", fontSize: 10, fontFamily: mono }}>{children}</span>;
}

function Delta({ val }: { val: number }) {
  return <span style={{ color: val > 0 ? C.accent : C.red, fontFamily: mono, fontSize: 11 }}>{val > 0 ? "+" : ""}{fmt(val)}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CompensationOptimizer() {
  // ── Compensation ──
  const [base,      setBase]      = useState(265000);
  const [aipPct,    setAipPct]    = useState(45);
  const [status,    setStatus]    = useState<FilingStatus>("single");
  const [frequency, setFrequency] = useState("biweekly");
  const [age,       setAge]       = useState(35);
  const [stateCode, setStateCode] = useState("NC");

  // ── 401k Match ──
  const [matchPct,     setMatchPct]     = useState(100);
  const [matchCap,     setMatchCap]     = useState(6);
  const [matchVesting, setMatchVesting] = useState(100);

  // ── Contributions ──
  const [k401,        setK401]     = useState(23000);
  const [hsa,         setHsa]      = useState(4150);
  const [fsa,         setFsa]      = useState(0);
  const [ira,         setIra]      = useState(7000);
  const [megaBack,    setMegaBack] = useState(0);
  const [otherPretax, setOther]    = useState(4800);

  // ── Constraints ──
  const [liqFloor,       setLiqFloor]  = useState(8000);
  const [retireHorizon,  setRetireH]   = useState(30);
  const [expectedReturn, setExpReturn] = useState(7);
  const [discountRate,   setDiscRate]  = useState(4);
  const [hsaFamily,      setHsaFamily] = useState(false);
  const [catchup,        setCatchup]   = useState(false);
  const [megaEnabled,    setMegaEnabled] = useState(false);

  // ── Lifetime Simulation ──
  const [lifeExpectancy, setLifeExpect]   = useState(90);
  const [salaryGrowth,   setSalaryGrowth] = useState(3);
  const [annualSpend,    setAnnualSpend]  = useState(120000);
  const [inflationRate,  setInflation]    = useState(2.5);
  const [ssClaimAge,     setSsClaimAge]   = useState(67);
  const [ssBenefit,      setSsBenefit]    = useState(28800);
  const [bearReturn,     setBearReturn]   = useState(4);
  const [bullReturn,     setBullReturn]   = useState(10);
  const [init401k,       setInit401k]     = useState(150000);
  const [initRoth,       setInitRoth]     = useState(50000);
  const [initHsa,        setInitHsa]      = useState(15000);
  const [initTaxable,    setInitTaxable]  = useState(50000);
  const [ltView,         setLtView]       = useState<"chart" | "table">("chart");

  // ── UI ──
  const [tab,        setTab]        = useState("optimizer");
  const [sweepParam, setSweepParam] = useState<SweepKey>("k401");
  const [optimized,  setOptimized]  = useState<ReturnType<typeof optimize> | null>(null);
  const [isRunning,  setIsRunning]  = useState(false);

  const gross          = base + base * (aipPct / 100);
  const bonusGross     = base * (aipPct / 100);
  const periodsPerYear = ({ biweekly: 26, semimonthly: 24, weekly: 52, monthly: 12 } as Record<string, number>)[frequency] ?? 26;
  const hsaMax         = hsaFamily ? LIM.hsaFamily : LIM.hsaSingle;
  const k401Max        = catchup   ? LIM.k401catch : LIM.k401;
  const iraMax         = catchup   ? LIM.iraCatch  : LIM.ira;

  const cfg = useMemo<UtilCfg>(() => ({
    gross: base, bonusGross, status, matchPct, matchCap,
    matchVestingFactor: matchVesting / 100, periodsPerYear, stateCode,
  }), [base, bonusGross, status, matchPct, matchCap, matchVesting, periodsPerYear, stateCode]);

  const baseUtilParams = useMemo<UtilParams>(() => ({
    k401, hsa, fsa, ira, megaBack, otherPretax,
    liquidityFloor: liqFloor * periodsPerYear,
    retireHorizon, expectedReturn: expectedReturn / 100, discountRate: discountRate / 100,
  }), [k401, hsa, fsa, ira, megaBack, otherPretax, liqFloor, periodsPerYear, retireHorizon, expectedReturn, discountRate]);

  const constraints = useMemo<OptConstraints>(() => ({
    hsaFamily, catchup, megaBackdoor: megaEnabled,
    liquidityFloor: liqFloor * periodsPerYear,
    retireHorizon, expectedReturn, discountRate, otherPretax,
  }), [hsaFamily, catchup, megaEnabled, liqFloor, periodsPerYear, retireHorizon, expectedReturn, discountRate, otherPretax]);

  const current  = useMemo(() => computeUtility(baseUtilParams, cfg), [baseUtilParams, cfg]);
  const annTax   = useMemo(() => calcTaxFull(gross, { k401, hsa, fsa, otherPretax }, status, stateCode), [gross, k401, hsa, fsa, otherPretax, status, stateCode]);
  const matchAmt = useMemo(() => Math.min(k401, base * (matchCap / 100)) * (matchPct / 100) * (matchVesting / 100), [k401, base, matchCap, matchPct, matchVesting]);

  const runOptimizer = useCallback(() => {
    setIsRunning(true);
    setTimeout(() => { setOptimized(optimize(cfg, constraints)); setIsRunning(false); }, 60);
  }, [cfg, constraints]);

  const applyOptimal = () => {
    if (!optimized) return;
    const p = optimized.params;
    setK401(Math.round(p.k401 / 500) * 500);
    setHsa(Math.round(p.hsa / 100) * 100);
    setFsa(Math.round(p.fsa / 100) * 100);
    setIra(Math.round(p.ira / 500) * 500);
    setMegaBack(Math.round(p.megaBack / 500) * 500);
  };

  const sweepData = useMemo(() => sensitivitySweep(sweepParam, cfg, baseUtilParams, constraints), [sweepParam, cfg, baseUtilParams, constraints]);

  const utilityGain = optimized ? optimized.utility - current.utility : 0;
  const netGain     = optimized ? optimized.result.net - current.net : 0;

  const paychecks = useMemo(() => {
    const n         = periodsPerYear;
    const regGross  = base / n;
    const per401k   = k401 / n;
    const perHsa    = hsa / n;
    const perFsa    = fsa / n;
    const perOther  = otherPretax / n;
    const pretaxPer = per401k + perHsa + perFsa + perOther;
    const ann       = calcTaxFull(base, { k401, hsa, fsa, otherPretax }, status, stateCode);
    const fedPer    = ann.fTax / n;
    const ncPer     = ann.nTax / n;
    const ssPer     = Math.min(regGross, FEDERAL_2024.socialSecurity.wageBase / n) * FEDERAL_2024.socialSecurity.employeeRate;
    const medPer    = regGross * 0.0145;
    const totalTaxPer = fedPer + ncPer + ssPer + medPer;
    const netPer    = regGross - pretaxPer - totalTaxPer;
    const matchPer  = matchAmt / n;
    const bonusFed  = bonusGross * SUPP_RATE;
    const bonusNc   = bonusGross * (annTax.nTax / Math.max(1, gross - (k401 + hsa + fsa + otherPretax)));
    const bonusSs   = Math.max(0, Math.min(bonusGross, FEDERAL_2024.socialSecurity.wageBase - base * 0.5)) * FEDERAL_2024.socialSecurity.employeeRate;
    const bonusMed  = bonusGross * 0.0145;
    const bonusTax  = bonusFed + bonusNc + bonusSs + bonusMed;
    const bonusNet  = bonusGross - bonusTax;
    return { gross: regGross, pretax: pretaxPer, per401k, perHsa, perFsa, perOther, fedPer, ncPer, ssPer, medPer, totalTaxPer, netPer, matchPer, bonusGross, bonusFed, bonusNc, bonusSs, bonusMed, bonusTax, bonusNet };
  }, [base, k401, hsa, fsa, otherPretax, status, periodsPerYear, matchAmt, bonusGross, stateCode, annTax, gross]);

  const comparison = useMemo(() => {
    if (!optimized) return [];
    const rows = [
      { label: "401(k) Contribution", cur: k401,               opt: optimized.params.k401,             color: C.blue },
      { label: "HSA Contribution",    cur: hsa,                opt: optimized.params.hsa,              color: C.blue },
      { label: "FSA Contribution",    cur: fsa,                opt: optimized.params.fsa,              color: C.blue },
      { label: "IRA Contribution",    cur: ira,                opt: optimized.params.ira,              color: C.purple },
      { label: "Mega Backdoor Roth",  cur: megaBack,           opt: optimized.params.megaBack,         color: C.purple },
      { label: "Total Taxes",         cur: current.taxTotal,   opt: optimized.result.taxTotal,         color: (d: number) => d <= 0 ? C.accent : C.red },
      { label: "Employer Match",      cur: current.employerMatch, opt: optimized.result.employerMatch, color: C.gold },
      { label: "Net Take-Home",       cur: current.net,        opt: optimized.result.net,              color: (d: number) => d >= 0 ? C.accent : C.orange },
      { label: "Utility Score",       cur: current.utility,    opt: optimized.utility,                 color: (d: number) => d >= 0 ? C.accent : C.red },
    ];
    return rows.map(r => {
      const delta = r.opt - r.cur;
      const color = typeof r.color === "function" ? r.color(delta) : r.color;
      return { ...r, delta, color };
    });
  }, [optimized, k401, hsa, fsa, ira, megaBack, current]);

  const lifetimeSims = useMemo(() => {
    const baseInput: LifetimeInput = {
      currentAge: age, retireAge: age + retireHorizon, lifeExpectancy,
      init401k, initRoth, initHsa, initTaxable,
      contrib401k: k401, contribMatch: matchAmt,
      contribRoth: ira + megaBack, contribHsa: hsa,
      currentNet: current.net, currentSalary: base,
      annualSpend, salaryGrowthRate: salaryGrowth / 100,
      inflationRate: inflationRate / 100,
      ssClaimAge, ssAnnual: ssBenefit, ltcgRate: 0.15,
      returnRate: 0,
    };
    return {
      bear: runLifetimeSim({ ...baseInput, returnRate: bearReturn / 100 }),
      base: runLifetimeSim({ ...baseInput, returnRate: expectedReturn / 100 }),
      bull: runLifetimeSim({ ...baseInput, returnRate: bullReturn / 100 }),
    };
  }, [age, retireHorizon, lifeExpectancy, init401k, initRoth, initHsa, initTaxable,
      k401, matchAmt, ira, megaBack, hsa, current.net, base, annualSpend,
      salaryGrowth, inflationRate, ssClaimAge, ssBenefit, bearReturn, expectedReturn, bullReturn]);

  const stateName = statesData[stateCode]?.name ?? stateCode;

  const tabs = [
    { id: "optimizer",   label: "⚡ Optimizer" },
    { id: "sensitivity", label: "∂ Sensitivity" },
    { id: "paycheck",    label: "⬇ Paychecks" },
    { id: "match",       label: "🏦 401k Match" },
    { id: "lifetime",    label: "📈 Lifetime" },
    { id: "config",      label: "⚙ Config" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: sans }}>

      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(180deg, #0a0f1e 0%, ${C.bg} 100%)`, borderBottom: `1px solid ${C.border}`, padding: "18px 24px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 17, fontWeight: 700, fontFamily: mono, color: C.accent, letterSpacing: "0.03em" }}>
                COMPENSATION OPTIMIZER
              </span>
              <Tag color={C.gold}>{stateName.toUpperCase()} · 2024</Tag>
              <Tag color={C.blue}>COORDINATE DESCENT</Tag>
            </div>
            <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, marginTop: 3 }}>
              Objective: maximize utility(net_pay, match_capture, tax_alpha, retirement_PV) subject to IRS + liquidity constraints
            </div>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            {([
              { label: "Gross",    val: fmt(gross),              c: C.text },
              { label: "Net/yr",   val: fmt(current.net),        c: C.accent },
              { label: "Match/yr", val: fmt(matchAmt),           c: C.gold },
              { label: "Utility",  val: fmtK(current.utility),   c: C.blue },
            ] as const).map(x => (
              <div key={x.label} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase" }}>{x.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: x.c, fontFamily: mono }}>{x.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: C.bg, overflowX: "auto", padding: "0 24px" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: mono, fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase",
            padding: "11px 14px", color: tab === t.id ? C.accent : C.mutedLight,
            borderBottom: `2px solid ${tab === t.id ? C.accent : "transparent"}`,
            whiteSpace: "nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "20px 24px" }}>

        {/* ══ OPTIMIZER ══ */}
        {tab === "optimizer" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>Decision Variables</div>
                  <Tag>You control these</Tag>
                </div>
                <Sl label={`401(k) — max ${fmt(k401Max)}`} value={k401} min={0} max={k401Max} step={500}
                  onChange={setK401} color={C.blue}
                  hint={`Employer match: ${fmt(matchAmt)} · Per period: ${fmt(k401 / periodsPerYear)}`} />
                <Sl label={`HSA — max ${fmt(hsaMax)}`} value={hsa} min={0} max={hsaMax} step={100}
                  onChange={setHsa} color={C.blue}
                  hint={`Triple tax-free · Per period: ${fmt(hsa / periodsPerYear)}`} />
                <Sl label={`FSA — max ${fmt(LIM.fsa)}`} value={fsa} min={0} max={LIM.fsa} step={100}
                  onChange={setFsa} color={C.blue} hint="Use-it-or-lose-it medical/dependent care" />
                <Sl label={`Backdoor Roth IRA — max ${fmt(iraMax)}`} value={ira} min={0} max={iraMax} step={500}
                  onChange={setIra} color={C.purple}
                  hint="Post-tax, tax-free growth — backdoor at your income level" />
                <Sl label={`Mega Backdoor — max ${fmt(megaEnabled ? LIM.megaBack : 0)}`}
                  value={megaBack} min={0} max={megaEnabled ? LIM.megaBack : 0} step={500}
                  onChange={setMegaBack} color={C.purple} disabled={!megaEnabled}
                  hint={megaEnabled ? "After-tax 401k → Roth conversion" : "Enable in Config"} />
                <Sl label="Other Pre-tax (insurance, etc.)" value={otherPretax} min={0} max={20000} step={100}
                  onChange={setOther} color={C.mutedMid} />
              </Card>
              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Optimization Constraints</div>
                <Sl label="Min Monthly Net (liquidity floor)" value={liqFloor} min={2000} max={30000} step={500}
                  onChange={setLiqFloor} color={C.orange}
                  hint="Optimizer will not suggest allocations that drop net below this"
                  fmt={v => fmt(v) + "/mo"} />
                <Sl label="Retirement Horizon (years)" value={retireHorizon} min={5} max={45} step={1}
                  onChange={setRetireH} color={C.textDim} fmt={v => `${v} yrs`}
                  hint="Used to compute PV of all retirement contributions" />
                <Sl label="Expected Market Return" value={expectedReturn} min={3} max={12} step={0.5}
                  onChange={setExpReturn} color={C.textDim} fmt={v => `${v}%`}
                  hint="Historical S&P 500 avg ~10%; use 7% real after inflation" />
                <Sl label="Personal Discount Rate" value={discountRate} min={1} max={10} step={0.5}
                  onChange={setDiscRate} color={C.textDim} fmt={v => `${v}%`}
                  hint="How much you value $1 today vs future — HYSA rate is a reasonable floor" />
              </Card>
            </div>

            <div>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Utility Function Decomposition
                </div>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: mono, marginBottom: 12, lineHeight: 1.8, background: C.surfaceAlt, padding: "8px 12px", borderRadius: 6 }}>
                  U = net_takehome<br />
                  &nbsp;&nbsp;+ (k401+match) × G  [lump-sum growth premium]<br />
                  &nbsp;&nbsp;+ hsa × 1.3 × G    [triple tax advantage]<br />
                  &nbsp;&nbsp;+ ira × 1.1 × G    [Roth tax-free growth]<br />
                  &nbsp;&nbsp;+ mega × 1.15 × G<br />
                  &nbsp;&nbsp;where G = (1+r)ⁿ/(1+d)ⁿ − 1<br />
                  &nbsp;&nbsp;− penalty(net &lt; floor)
                </div>
                {[
                  { label: "Net Take-Home",      val: current.net,             color: C.accent },
                  { label: "PV 401(k) + Match",  val: current.k401Fv + current.employerMatch, color: C.blue },
                  { label: "PV HSA (×1.3)",      val: current.hsaFv,           color: C.blue },
                  { label: "PV Roth IRA (×1.1)", val: current.iraFv,           color: C.purple },
                  { label: "PV Mega Backdoor",   val: current.megaFv,          color: C.purple },
                  { label: "Employer Match",     val: current.employerMatch,   color: C.gold },
                  { label: "Liquidity Penalty",  val: -current.liquidityPenalty, color: current.liquidityPenalty > 0 ? C.red : C.mutedLight },
                ].map((r, i) => {
                  const barW = Math.max(0, Math.abs(r.val) / Math.abs(current.utility) * 100);
                  return (
                    <div key={i} style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: C.textDim, fontFamily: mono }}>{r.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: r.color, fontFamily: mono }}>{fmt(r.val)}</span>
                      </div>
                      <div style={{ height: 3, background: C.muted + "33", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, barW)}%`, background: r.color, borderRadius: 2 }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono }}>TOTAL UTILITY</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.accent, fontFamily: mono }}>{fmtK(current.utility)}</span>
                </div>
              </Card>

              <button onClick={runOptimizer} disabled={isRunning}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 10, marginBottom: 12,
                  background: isRunning ? C.muted : `linear-gradient(135deg, ${C.accent}22, ${C.accentDim})`,
                  border: `1px solid ${isRunning ? C.muted : C.accent}`,
                  color: isRunning ? C.mutedLight : C.accent, fontFamily: mono, fontSize: 13,
                  letterSpacing: "0.12em", textTransform: "uppercase", cursor: isRunning ? "not-allowed" : "pointer",
                }}>
                {isRunning ? "⟳  RUNNING COORDINATE DESCENT..." : "⚡  RUN OPTIMIZER"}
              </button>

              {optimized && (
                <Card glow>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>Optimal Solution Found</div>
                    <button onClick={applyOptimal}
                      style={{ background: C.accent + "22", border: `1px solid ${C.accent}`, color: C.accent, fontFamily: mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 4, cursor: "pointer" }}>
                      Apply →
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                    {[
                      { label: "Utility Gain", val: fmtK(utilityGain), color: utilityGain >= 0 ? C.accent : C.red },
                      { label: "Net Δ", val: fmt(netGain), color: netGain >= 0 ? C.accent : C.orange },
                      { label: "Tax Savings Δ", val: fmt((optimized.result.taxSavings ?? 0) - (current.taxSavings ?? 0)), color: C.gold },
                    ].map(x => (
                      <div key={x.label} style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase" }}>{x.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: x.color, fontFamily: mono }}>{x.val}</div>
                      </div>
                    ))}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: mono }}>
                    <thead>
                      <tr>{["Parameter","Current","Optimal","Δ"].map(h => (
                        <th key={h} style={{ textAlign: h === "Parameter" ? "left" : "right", padding: "3px 6px", color: C.muted, fontWeight: 400, borderBottom: `1px solid ${C.border}`, fontSize: 10 }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {comparison.map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}22` }}>
                          <td style={{ padding: "4px 6px", color: C.textDim }}>{r.label}</td>
                          <td style={{ padding: "4px 6px", textAlign: "right", color: C.mutedLight }}>{fmt(r.cur)}</td>
                          <td style={{ padding: "4px 6px", textAlign: "right", color: r.color, fontWeight: 600 }}>{fmt(r.opt)}</td>
                          <td style={{ padding: "4px 6px", textAlign: "right" }}><Delta val={r.delta} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ══ SENSITIVITY ══ */}
        {tab === "sensitivity" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {([
                { key: "k401" as SweepKey,    label: "401(k)", color: C.blue },
                { key: "hsa" as SweepKey,     label: "HSA",    color: C.blue },
                { key: "fsa" as SweepKey,     label: "FSA",    color: C.gold },
                { key: "ira" as SweepKey,     label: "IRA",    color: C.purple },
                { key: "megaBack" as SweepKey,label: "Mega",   color: C.purple },
              ]).map(p => (
                <button key={p.key} onClick={() => setSweepParam(p.key)}
                  style={{ background: sweepParam === p.key ? p.color + "22" : C.surface, border: `1px solid ${sweepParam === p.key ? p.color : C.border}`, color: sweepParam === p.key ? p.color : C.mutedLight, fontFamily: mono, fontSize: 11, padding: "6px 14px", borderRadius: 6, cursor: "pointer" }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { title: `∂U/∂${sweepParam} — Utility vs. ${sweepParam}`, subtitle: "Shape reveals marginal return to each dollar contributed", valueKey: "utility", color: C.accent, label: "utility curve" },
                { title: `Net Take-Home vs. ${sweepParam}`, subtitle: "Tradeoff: more contributions = less immediate cash", valueKey: "net", color: C.blue, label: "net pay" },
              ].map(({ title, subtitle, valueKey, color, label }) => {
                const vals = sweepData.map(d => (d as any)[valueKey] as number);
                const xs = sweepData.map(d => d.x);
                const lo = Math.min(...vals), hi = Math.max(...vals);
                const range = hi - lo || 1;
                const W = 400, H = 160;
                const toX = (v: number) => ((v - xs[0]!) / (xs[xs.length - 1]! - xs[0]!)) * W;
                const toY = (v: number) => H - ((v - lo) / range) * (H - 20) - 10;
                const pts = sweepData.map(d => `${toX(d.x).toFixed(1)},${toY((d as any)[valueKey]).toFixed(1)}`).join(" ");
                const curVal = ({ k401, hsa, fsa, ira, megaBack } as Record<string, number>)[sweepParam] ?? 0;
                const curX = toX(curVal);
                const floorY = valueKey === "net" ? toY(liqFloor * periodsPerYear) : -1;
                return (
                  <Card key={valueKey}>
                    <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 12 }}>{subtitle}</div>
                    <svg width={W} height={H + 20} style={{ display: "block", overflowX: "auto" }}>
                      {[0.25, 0.5, 0.75, 1].map(p => (
                        <line key={p} x1={0} x2={W} y1={toY(lo + range * p)} y2={toY(lo + range * p)} stroke={C.border} strokeWidth={1} />
                      ))}
                      <polygon points={`0,${H} ${pts} ${W},${H}`} fill={color + "15"} />
                      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
                      {floorY > 0 && floorY < H && (
                        <>
                          <line x1={0} x2={W} y1={floorY} y2={floorY} stroke={C.orange} strokeWidth={1.5} strokeDasharray="6,3" />
                          <text x={W - 60} y={floorY - 4} fill={C.orange} fontSize={8} fontFamily={mono}>floor</text>
                        </>
                      )}
                      <line x1={curX} x2={curX} y1={0} y2={H} stroke={C.gold} strokeWidth={1.5} strokeDasharray="4,3" />
                      {[lo, hi].map((v, i) => (
                        <text key={i} x={4} y={toY(v)} fill={C.muted} fontSize={8} fontFamily={mono} dominantBaseline="middle">{fmtK(v)}</text>
                      ))}
                      <text x={0} y={H + 14} fill={C.muted} fontSize={8} fontFamily={mono}>$0</text>
                      <text x={W - 30} y={H + 14} fill={C.muted} fontSize={8} fontFamily={mono}>{fmt(xs[xs.length - 1]!)}</text>
                    </svg>
                    <div style={{ marginTop: 8, fontSize: 10, color: C.muted, fontFamily: mono }}>
                      <span style={{ color: C.gold }}>──</span> current &nbsp;
                      <span style={{ color }}> ──</span> {label}
                    </div>
                  </Card>
                );
              })}
            </div>

            <Card style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                Marginal Utility — Next $500 into Each Account
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                {([
                  { key: "k401" as SweepKey,    label: "401(k)",        color: C.blue,   cur: k401 },
                  { key: "hsa" as SweepKey,     label: "HSA",           color: C.blue,   cur: hsa },
                  { key: "ira" as SweepKey,     label: "Roth IRA",      color: C.purple, cur: ira },
                  { key: "megaBack" as SweepKey,label: "Mega Backdoor", color: C.purple, cur: megaBack },
                ]).map(p => {
                  const uCur  = computeUtility(baseUtilParams, cfg).utility;
                  const uNext = computeUtility({ ...baseUtilParams, [p.key]: p.cur + 500 }, cfg).utility;
                  const margU = uNext - uCur;
                  return (
                    <div key={p.key} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontSize: 10, color: p.color, fontFamily: mono, textTransform: "uppercase", marginBottom: 4 }}>{p.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: margU > 0 ? C.accent : C.red, fontFamily: mono }}>{fmtK(margU)}</div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>per $500 → {(margU / 500).toFixed(2)}× ROI</div>
                      <Sparkline data={sensitivitySweep(p.key, cfg, baseUtilParams, constraints, 20)} width={130} height={28} color={p.color} />
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ══ PAYCHECKS ══ */}
        {tab === "paycheck" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Card>
              <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                Regular {frequency} Paycheck
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 12 }}>
                <tbody>
                  {[
                    { l: "Regular Gross",        v: paychecks.gross,       c: C.text,     b: true },
                    { l: "─ 401(k)",             v: -paychecks.per401k,    c: C.blue },
                    { l: "─ HSA",                v: -paychecks.perHsa,     c: C.blue },
                    { l: "─ FSA",                v: -paychecks.perFsa,     c: C.blue },
                    { l: "─ Other Pre-tax",      v: -paychecks.perOther,   c: C.mutedMid },
                    { l: "Federal Withholding",  v: -paychecks.fedPer,     c: C.red },
                    { l: `${stateName} State Tax`, v: -paychecks.ncPer,    c: C.orange },
                    { l: "Social Security",      v: -paychecks.ssPer,      c: C.purple },
                    { l: "Medicare",             v: -paychecks.medPer,     c: C.purple },
                    { l: "NET DEPOSIT",          v: paychecks.netPer,      c: C.accent,   b: true, div: true },
                    { l: "+ Employer Match",     v: paychecks.matchPer,    c: C.gold },
                    { l: "TOTAL COMP VALUE",     v: paychecks.netPer + paychecks.matchPer, c: C.gold, b: true },
                  ].map((r, i) => (
                    <tr key={i} style={{ borderTop: r.div ? `1px solid ${C.border}` : "none" }}>
                      <td style={{ padding: "4px 0", color: C.textDim, fontWeight: r.b ? 600 : 400 }}>{r.l}</td>
                      <td style={{ textAlign: "right", color: r.c, fontWeight: r.b ? 700 : 400, fontSize: r.b ? 13 : 11 }}>
                        {r.v < 0 ? `−${fmt(Math.abs(r.v))}` : fmt(r.v)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, background: C.surfaceAlt, borderRadius: 8, padding: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { l: "Monthly",   v: paychecks.netPer * periodsPerYear / 12 },
                    { l: "Quarterly", v: paychecks.netPer * periodsPerYear / 4 },
                    { l: "Annual",    v: paychecks.netPer * periodsPerYear },
                  ].map(x => (
                    <div key={x.l}>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase" }}>{x.l}</div>
                      <div style={{ fontSize: 13, color: C.accent, fontFamily: mono, fontWeight: 700 }}>{fmt(x.v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <div>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                  AIP Bonus Paycheck
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 12 }}>
                  <tbody>
                    {[
                      { l: "Gross Bonus (AIP)",          v: bonusGross,              c: C.gold, b: true },
                      { l: "Fed (22% supplemental)",     v: -paychecks.bonusFed,     c: C.red },
                      { l: `${stateName} State Tax`,     v: -paychecks.bonusNc,      c: C.orange },
                      { l: "Social Security",            v: -paychecks.bonusSs,      c: C.purple },
                      { l: "Medicare",                   v: -paychecks.bonusMed,     c: C.purple },
                      { l: "BONUS NET",                  v: paychecks.bonusNet,      c: C.gold, b: true, div: true },
                      { l: "Bonus Eff. Rate",            v: paychecks.bonusTax / Math.max(1, bonusGross), c: C.orange, isPct: true },
                    ].map((r, i) => (
                      <tr key={i} style={{ borderTop: r.div ? `1px solid ${C.border}` : "none" }}>
                        <td style={{ padding: "4px 0", color: C.textDim, fontWeight: r.b ? 600 : 400 }}>{r.l}</td>
                        <td style={{ textAlign: "right", color: r.c, fontWeight: r.b ? 700 : 400, fontSize: r.b ? 13 : 11 }}>
                          {r.isPct ? pct(r.v) : r.v < 0 ? `−${fmt(Math.abs(r.v))}` : fmt(r.v)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                  Social Security Wage Base
                </div>
                {(() => {
                  const period = base / periodsPerYear;
                  const wageBase = FEDERAL_2024.socialSecurity.wageBase;
                  const crossPeriod = Math.ceil(wageBase / period);
                  const crossMonth = MONTHS[Math.min(11, Math.floor(crossPeriod / periodsPerYear * 12))] ?? "Dec";
                  const perPeriodSS = period * FEDERAL_2024.socialSecurity.employeeRate;
                  const periodsRemaining = periodsPerYear - crossPeriod;
                  const bonusFromSSStop = Math.max(0, periodsRemaining) * perPeriodSS;
                  return (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                        <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px" }}>
                          <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase" }}>SS Stops at Period</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: C.blue, fontFamily: mono }}>#{crossPeriod}</div>
                          <div style={{ fontSize: 10, color: C.mutedLight }}>{crossMonth}</div>
                        </div>
                        <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px" }}>
                          <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase" }}>Net Boost/period</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: C.accent, fontFamily: mono }}>{fmt(perPeriodSS)}</div>
                          <div style={{ fontSize: 10, color: C.mutedLight }}>{fmt(bonusFromSSStop)} total</div>
                        </div>
                      </div>
                      <div style={{ height: 6, background: C.muted + "33", borderRadius: 3 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, (crossPeriod / periodsPerYear) * 100)}%`, background: C.blue, borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontFamily: mono }}>
                        {Math.round((crossPeriod / periodsPerYear) * 100)}% through year before SS stops
                      </div>
                    </div>
                  );
                })()}
              </Card>
            </div>
          </div>
        )}

        {/* ══ 401K MATCH ══ */}
        {tab === "match" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                  401(k) Match Configuration
                </div>
                <Sl label="Employer Match %" value={matchPct} min={0} max={200} step={5} onChange={setMatchPct} color={C.gold}
                  fmt={v => `${v}%`} hint={`Employer contributes ${matchPct}% of whatever you put in, up to cap`} />
                <Sl label="Match Cap (% of salary)" value={matchCap} min={0} max={20} step={0.5} onChange={setMatchCap} color={C.gold}
                  fmt={v => `${v}%`} hint={`Cap = ${fmt(base * matchCap / 100)} · Must contribute at least this to capture full match`} />
                <Sl label="Vesting %" value={matchVesting} min={0} max={100} step={5} onChange={setMatchVesting} color={C.orange}
                  fmt={v => `${v}%`} hint="Cliff or graded vesting — what % of match you currently own" />
                <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: 14, marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, textTransform: "uppercase", marginBottom: 8 }}>Match Formula</div>
                  <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.8, fontFamily: mono }}>
                    You contribute: <span style={{ color: C.text }}>{fmt(k401)}</span><br />
                    Match eligible: <span style={{ color: C.text }}>{fmt(Math.min(k401, base * matchCap / 100))}</span> ({matchCap}% salary cap)<br />
                    Employer match: <span style={{ color: C.gold, fontWeight: 700 }}>{fmt(Math.min(k401, base * matchCap / 100) * matchPct / 100)}</span> ({matchPct}%)<br />
                    Vested portion: <span style={{ color: C.accent, fontWeight: 700 }}>{fmt(matchAmt)}</span> ({matchVesting}% vested)
                  </div>
                </div>
              </Card>

              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Common Match Structures</div>
                {[
                  { name: "50% up to 6%",  mp: 50,  mc: 6,  desc: "Most common — match $0.50 per $1 up to 6% of salary" },
                  { name: "100% up to 3%", mp: 100, mc: 3,  desc: "Dollar-for-dollar on first 3%" },
                  { name: "100% up to 6%", mp: 100, mc: 6,  desc: "Premium match — full dollar-for-dollar" },
                  { name: "25% up to 10%", mp: 25,  mc: 10, desc: "Stretch match — incentivize higher contribution" },
                  { name: "No match",      mp: 0,   mc: 0,  desc: "No employer contribution" },
                ].map((s, i) => {
                  const matchVal = base * (s.mc / 100) * (s.mp / 100) * (matchVesting / 100);
                  return (
                    <div key={i} onClick={() => { setMatchPct(s.mp); setMatchCap(s.mc); }}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", marginBottom: 6, borderRadius: 6, cursor: "pointer", background: matchPct === s.mp && matchCap === s.mc ? C.goldDim + "44" : C.surfaceAlt, border: `1px solid ${matchPct === s.mp && matchCap === s.mc ? C.gold : C.border}` }}>
                      <div>
                        <div style={{ fontSize: 12, fontFamily: mono, color: C.text, fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{s.desc}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontFamily: mono, color: C.gold, fontWeight: 700 }}>{fmt(matchVal)}</div>
                        <div style={{ fontSize: 9, color: C.muted, fontFamily: mono }}>vested/yr</div>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>

            <div>
              <Card glow style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Match Capture Analysis</div>
                {(() => {
                  const minToCapture = base * (matchCap / 100);
                  const maxMatchAmt  = minToCapture * (matchPct / 100);
                  const vestedMatch  = maxMatchAmt * (matchVesting / 100);
                  const captured     = Math.min(k401, minToCapture);
                  const capturePct   = minToCapture > 0 ? captured / minToCapture : 0;
                  const forfeited    = vestedMatch * (1 - capturePct);
                  const costToCapture = Math.max(0, minToCapture - k401);
                  const taxSavedOnCost = costToCapture * annTax.marginal;
                  const netCostToCapture = costToCapture - taxSavedOnCost;
                  const roi = netCostToCapture > 0 ? vestedMatch / netCostToCapture : Infinity;
                  return (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                        <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px" }}>
                          <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase" }}>Match Captured</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: C.gold, fontFamily: mono }}>{fmt(matchAmt)}</div>
                          <div style={{ fontSize: 10, color: C.mutedLight }}>{pct(capturePct)} of max</div>
                        </div>
                        <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px" }}>
                          <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase" }}>Forfeited</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: forfeited > 0 ? C.red : C.accent, fontFamily: mono }}>{fmt(forfeited)}</div>
                          <div style={{ fontSize: 10, color: C.mutedLight }}>left on table</div>
                        </div>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ height: 8, background: C.muted + "33", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${capturePct * 100}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.accent})`, borderRadius: 4, transition: "width 0.4s" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                          <span style={{ fontSize: 9, color: C.muted, fontFamily: mono }}>$0</span>
                          <span style={{ fontSize: 9, color: C.gold, fontFamily: mono }}>{pct(capturePct)} captured</span>
                          <span style={{ fontSize: 9, color: C.muted, fontFamily: mono }}>{fmt(minToCapture)}</span>
                        </div>
                      </div>
                      {costToCapture > 0 ? (
                        <div style={{ background: C.accentGlow, border: `1px solid ${C.accentDim}`, borderRadius: 8, padding: 12 }}>
                          <div style={{ fontSize: 10, color: C.accent, fontFamily: mono, textTransform: "uppercase", marginBottom: 6 }}>Capture the Remaining Match</div>
                          <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.8 }}>
                            Contribute <strong style={{ color: C.text }}>{fmt(costToCapture)}</strong> more to capture full match.<br />
                            After-tax cost (saving {pct(annTax.marginal)} marginal rate): <strong style={{ color: C.accent }}>{fmt(netCostToCapture)}</strong><br />
                            Match gain: <strong style={{ color: C.gold }}>{fmt(vestedMatch)}</strong><br />
                            <strong style={{ color: C.accent }}>ROI: {roi === Infinity ? "∞" : `${roi.toFixed(1)}×`}</strong> — this is always the first move.
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: C.accentGlow, border: `1px solid ${C.accentDim}`, borderRadius: 8, padding: 12 }}>
                          <div style={{ fontSize: 12, color: C.accent }}>✓ You are capturing 100% of available employer match.</div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </Card>

              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                  Match Value Over Time
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>FV of match compounded at {expectedReturn}% for {retireHorizon} years</div>
                {(() => {
                  const fv = (pv: number, r: number, n: number) => pv * Math.pow(1 + r, n);
                  const r = expectedReturn / 100;
                  const rows = [5, 10, 15, 20, 30].filter(n => n <= retireHorizon + 5);
                  const maxFv = fv(matchAmt, r, rows[rows.length - 1] ?? 30);
                  return rows.map(n => {
                    const val = fv(matchAmt, r, n);
                    return (
                      <div key={n} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: C.textDim, fontFamily: mono }}>{n} years</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.gold, fontFamily: mono }}>{fmtK(val)}</span>
                        </div>
                        <div style={{ height: 4, background: C.muted + "33", borderRadius: 2 }}>
                          <div style={{ height: "100%", width: `${(val / maxFv) * 100}%`, background: `linear-gradient(90deg, ${C.goldDim}, ${C.gold})`, borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </Card>
            </div>
          </div>
        )}

        {/* ══ LIFETIME ══ */}
        {tab === "lifetime" && (() => {
          const retireAge = age + retireHorizon;
          const scenarios = [
            { key: "bear" as const, label: `Bear ${bearReturn}%`,     color: C.orange, sim: lifetimeSims.bear },
            { key: "base" as const, label: `Base ${expectedReturn}%`, color: C.blue,   sim: lifetimeSims.base },
            { key: "bull" as const, label: `Bull ${bullReturn}%`,     color: C.accent, sim: lifetimeSims.bull },
          ];
          const portfolioAt = (sim: SimYear[]) => sim.find(y => y.age === retireAge)?.total ?? 0;
          const depleteAt   = (sim: SimYear[]) => sim.find(y => y.isRetired && y.total <= 0)?.age ?? null;
          const fiCrossover = (sim: SimYear[], r: number) =>
            sim.find(y => !y.isRetired && y.salary > 0 && y.total * r >= y.salary)?.age ?? null;

          const fiAge = fiCrossover(lifetimeSims.base, expectedReturn / 100);
          const basePortfolio = portfolioAt(lifetimeSims.base);
          const ssAtClaim = ssBenefit * (ssClaimAge === 62 ? 0.70 : ssClaimAge === 70 ? 1.24 : 1.0);

          const W = 520, H = 190;
          const allTotals = [...lifetimeSims.bear, ...lifetimeSims.base, ...lifetimeSims.bull].map(y => y.total);
          const maxT = Math.max(...allTotals, 1);
          const toX = (a: number) => ((a - age) / Math.max(1, lifeExpectancy - age)) * W;
          const toY = (v: number) => H - (Math.min(v, maxT) / maxT) * (H - 14) - 4;
          const pts  = (sim: SimYear[]) => sim.map(y => `${toX(y.age).toFixed(1)},${toY(y.total).toFixed(1)}`).join(" ");
          const retireX = toX(retireAge);
          const ssX     = toX(ssClaimAge);
          const fiX     = fiAge !== null ? toX(fiAge) : null;
          const gridVals = [0.25, 0.5, 0.75, 1.0].map(p => maxT * p);

          return (
            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
              {/* ── LEFT: Controls ── */}
              <div>
                <Card style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Current Balances</div>
                  <Sl label="401(k) / Traditional"   value={init401k}    min={0} max={2000000} step={5000}  onChange={setInit401k}     color={C.blue} />
                  <Sl label="Roth IRA + Mega"         value={initRoth}    min={0} max={1000000} step={5000}  onChange={setInitRoth}     color={C.purple} />
                  <Sl label="HSA"                     value={initHsa}     min={0} max={200000}  step={1000}  onChange={setInitHsa}      color={C.blue} />
                  <Sl label="Taxable Brokerage"       value={initTaxable} min={0} max={2000000} step={5000}  onChange={setInitTaxable}  color={C.accent} />
                </Card>
                <Card style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Life Parameters</div>
                  <Sl label="Life Expectancy"           value={lifeExpectancy} min={70} max={100} step={1}   onChange={setLifeExpect}    color={C.textDim} fmt={v => `age ${v}`} />
                  <Sl label="Annual Salary Raises"      value={salaryGrowth}   min={0}  max={10}  step={0.5} onChange={setSalaryGrowth} color={C.textDim} fmt={v => `${v}%`} hint="Nominal raises per year" />
                  <Sl label="Annual Retirement Spend"   value={annualSpend}    min={30000} max={500000} step={5000} onChange={setAnnualSpend} color={C.accent} hint="Today's dollars — inflation-adjusted" />
                  <Sl label="Inflation Rate"            value={inflationRate}  min={1} max={6} step={0.5}    onChange={setInflation}    color={C.textDim} fmt={v => `${v}%`} />
                </Card>
                <Card style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Social Security</div>
                  <Sl label="SS Annual Benefit at 67" value={ssBenefit} min={0} max={60000} step={1200} onChange={setSsBenefit} color={C.purple} hint="From SSA.gov your statement" />
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Claim Age</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {([62, 67, 70] as const).map(a => (
                        <button key={a} onClick={() => setSsClaimAge(a)} style={{
                          flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer", fontFamily: mono, fontSize: 11,
                          background: ssClaimAge === a ? C.purple + "22" : C.surfaceAlt,
                          border: `1px solid ${ssClaimAge === a ? C.purple : C.border}`,
                          color: ssClaimAge === a ? C.purple : C.mutedLight,
                        }}>Age {a}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, fontFamily: mono, lineHeight: 1.8, background: C.surfaceAlt, padding: "8px 10px", borderRadius: 6 }}>
                    <span style={{ color: C.orange }}>62:</span> {fmt(ssBenefit * 0.70)}/yr &nbsp;
                    <span style={{ color: C.blue }}>67:</span> {fmt(ssBenefit)}/yr &nbsp;
                    <span style={{ color: C.accent }}>70:</span> {fmt(ssBenefit * 1.24)}/yr
                  </div>
                </Card>
                <Card>
                  <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Scenario Returns</div>
                  <Sl label="Bear Return" value={bearReturn} min={0} max={8}  step={0.5} onChange={setBearReturn} fmt={v => `${v}%`} color={C.orange} />
                  <Sl label="Bull Return" value={bullReturn} min={6} max={15} step={0.5} onChange={setBullReturn} fmt={v => `${v}%`} color={C.accent} />
                  <div style={{ fontSize: 10, color: C.muted, fontFamily: mono }}>Base uses optimizer's {expectedReturn}% expected return</div>
                </Card>
              </div>

              {/* ── RIGHT: Chart + Metrics ── */}
              <div>
                <Card style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>Portfolio · Age {age}–{lifeExpectancy}</div>
                    <div style={{ display: "flex", gap: 12 }}>
                      {scenarios.map(s => <span key={s.key} style={{ fontSize: 10, color: s.color, fontFamily: mono }}>── {s.label}</span>)}
                    </div>
                  </div>
                  <svg width={W} height={H + 28} viewBox={`0 0 ${W} ${H + 28}`} style={{ display: "block", width: "100%", overflow: "visible" }}>
                    {/* Grid lines */}
                    {gridVals.map(v => (
                      <g key={v}>
                        <line x1={0} x2={W} y1={toY(v)} y2={toY(v)} stroke={C.border} strokeWidth={0.5} />
                        <text x={3} y={toY(v) - 3} fill={C.muted} fontSize={7} fontFamily={mono}>{fmtK(v)}</text>
                      </g>
                    ))}
                    {/* Bull-bear outcome envelope */}
                    <polygon fill={C.blue + "0e"} points={[
                      ...lifetimeSims.bull.map(y => `${toX(y.age).toFixed(1)},${toY(y.total).toFixed(1)}`),
                      ...lifetimeSims.bear.slice().reverse().map(y => `${toX(y.age).toFixed(1)},${toY(y.total).toFixed(1)}`),
                    ].join(" ")} />
                    {/* Scenario lines */}
                    <polyline points={pts(lifetimeSims.bear)} fill="none" stroke={C.orange} strokeWidth={1.5} strokeLinejoin="round" />
                    <polyline points={pts(lifetimeSims.base)} fill="none" stroke={C.blue}   strokeWidth={2}   strokeLinejoin="round" />
                    <polyline points={pts(lifetimeSims.bull)} fill="none" stroke={C.accent} strokeWidth={1.5} strokeLinejoin="round" />
                    {/* Retire marker */}
                    <line x1={retireX} x2={retireX} y1={0} y2={H} stroke={C.gold} strokeWidth={1} strokeDasharray="5,3" />
                    <text x={retireX + 3} y={11} fill={C.gold} fontSize={8} fontFamily={mono}>retire {retireAge}</text>
                    {/* SS marker */}
                    {ssX >= 0 && ssX <= W && (
                      <g>
                        <line x1={ssX} x2={ssX} y1={0} y2={H} stroke={C.purple} strokeWidth={1} strokeDasharray="5,3" />
                        <text x={ssX + 3} y={24} fill={C.purple} fontSize={8} fontFamily={mono}>SS {ssClaimAge}</text>
                      </g>
                    )}
                    {/* FI crossover marker */}
                    {fiX !== null && fiX > 0 && fiX < W && (
                      <g>
                        <line x1={fiX} x2={fiX} y1={0} y2={H} stroke={C.accent} strokeWidth={1} strokeDasharray="3,3" opacity={0.55} />
                        <text x={fiX + 3} y={H - 8} fill={C.accent} fontSize={8} fontFamily={mono}>FI {fiAge}</text>
                      </g>
                    )}
                    {/* Zero / baseline */}
                    <line x1={0} x2={W} y1={H} y2={H} stroke={C.border} strokeWidth={1} />
                    {/* Age axis labels */}
                    {Array.from(new Set([age, retireAge, ssClaimAge, lifeExpectancy]))
                      .filter(a => a >= age && a <= lifeExpectancy)
                      .map(a => (
                        <text key={a} x={toX(a)} y={H + 16} fill={C.muted} fontSize={8} fontFamily={mono} textAnchor="middle">{a}</text>
                      ))}
                  </svg>
                </Card>

                {/* Metrics grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                  <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", marginBottom: 6 }}>Portfolio at {retireAge}</div>
                    {scenarios.map(s => (
                      <div key={s.key} style={{ fontSize: 11, color: s.color, fontFamily: mono }}>{s.label.split(" ")[0]}: {fmtK(portfolioAt(s.sim))}</div>
                    ))}
                  </div>
                  <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", marginBottom: 4 }}>FI Crossover (Base)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: fiAge ? C.accent : C.muted, fontFamily: mono }}>
                      {fiAge ? `Age ${fiAge}` : "—"}
                    </div>
                    <div style={{ fontSize: 10, color: C.mutedLight }}>
                      {fiAge ? `${fiAge - age} yrs from now` : "Investment income never exceeds salary in range"}
                    </div>
                  </div>
                  <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", marginBottom: 6 }}>Survivability to {lifeExpectancy}</div>
                    {scenarios.map(s => {
                      const dep = depleteAt(s.sim);
                      return (
                        <div key={s.key} style={{ fontSize: 11, color: dep ? C.red : s.color, fontFamily: mono }}>
                          {s.label.split(" ")[0]}: {dep ? `depletes age ${dep}` : `✓ survives`}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", marginBottom: 4 }}>Sustainable Income (Base, 4% SWR)</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.accent, fontFamily: mono }}>{fmt(basePortfolio * 0.04)}</div>
                    <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono }}>
                      + {fmt(ssAtClaim)} SS (age {ssClaimAge}) = <span style={{ color: C.accent }}>{fmt(basePortfolio * 0.04 + ssAtClaim)}</span> total
                    </div>
                  </div>
                  <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", marginBottom: 4 }}>Annual Contributions (current)</div>
                    <div style={{ fontSize: 11, color: C.blue,   fontFamily: mono }}>401k+match: {fmt(k401 + matchAmt)}</div>
                    <div style={{ fontSize: 11, color: C.purple, fontFamily: mono }}>Roth+Mega: {fmt(ira + megaBack)}</div>
                    <div style={{ fontSize: 11, color: C.blue,   fontFamily: mono }}>HSA: {fmt(hsa)}</div>
                    <div style={{ fontSize: 11, color: C.accent, fontFamily: mono }}>Taxable surplus: {fmt(Math.max(0, current.net - annualSpend))}</div>
                  </div>
                </div>

                {/* Year-by-year table */}
                <Card>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>Year-by-Year (Base Scenario)</div>
                    <button onClick={() => setLtView(ltView === "chart" ? "table" : "chart")}
                      style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.mutedLight, fontFamily: mono, fontSize: 10, padding: "3px 10px", borderRadius: 4, cursor: "pointer" }}>
                      {ltView === "chart" ? "Show Table ↓" : "Hide Table ↑"}
                    </button>
                  </div>
                  {ltView === "table" && (
                    <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 10 }}>
                        <thead style={{ position: "sticky", top: 0, background: C.surface }}>
                          <tr>
                            {["Age","Total","401k","Roth","HSA","Taxable","SS Income","Withdrawal"].map(h => (
                              <th key={h} style={{ textAlign: "right", padding: "4px 8px", color: C.muted, fontWeight: 400, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", fontSize: 9 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {lifetimeSims.base.map((y, i) => (
                            <tr key={y.age} style={{ background: y.age === retireAge ? C.goldDim + "22" : y.age === ssClaimAge ? C.purpleDim + "22" : i % 2 === 0 ? "transparent" : C.surfaceAlt + "44" }}>
                              <td style={{ padding: "3px 8px", color: y.isRetired ? C.gold : y.age === fiAge ? C.accent : C.textDim, fontWeight: y.age === retireAge ? 700 : 400 }}>
                                {y.age}{y.age === retireAge ? " ★" : y.age === ssClaimAge ? " $" : ""}
                              </td>
                              <td style={{ padding: "3px 8px", textAlign: "right", color: y.total > 0 ? C.text : C.red, fontWeight: 600 }}>{fmtK(y.total)}</td>
                              <td style={{ padding: "3px 8px", textAlign: "right", color: C.blue   }}>{fmtK(y.bal401k)}</td>
                              <td style={{ padding: "3px 8px", textAlign: "right", color: C.purple }}>{fmtK(y.balRoth)}</td>
                              <td style={{ padding: "3px 8px", textAlign: "right", color: C.blue   }}>{fmtK(y.balHsa)}</td>
                              <td style={{ padding: "3px 8px", textAlign: "right", color: C.accent }}>{fmtK(y.balTaxable)}</td>
                              <td style={{ padding: "3px 8px", textAlign: "right", color: C.purple }}>{y.ssIncome > 0 ? fmtK(y.ssIncome) : "—"}</td>
                              <td style={{ padding: "3px 8px", textAlign: "right", color: y.withdrawal > 0 ? C.orange : C.muted }}>{y.withdrawal > 0 ? fmtK(y.withdrawal) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          );
        })()}

        {/* ══ CONFIG ══ */}
        {tab === "config" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Compensation</div>
                <Sl label="Base Salary" value={base} min={50000} max={800000} step={5000} onChange={setBase} fmt={fmt} />
                <Sl label="AIP % of Base" value={aipPct} min={0} max={150} step={1} onChange={setAipPct}
                  fmt={v => `${v}%`} hint={`AIP = ${fmt(base * aipPct / 100)} · Gross = ${fmt(gross)}`} />
                {[
                  { l: "Filing Status",  v: status,    opts: [["single","Single"],["mfj","Married Filing Jointly"]] as const, fn: (v: string) => setStatus(v as FilingStatus) },
                  { l: "Pay Frequency",  v: frequency, opts: [["biweekly","Bi-weekly (26)"],["semimonthly","Semi-monthly (24)"],["weekly","Weekly (52)"],["monthly","Monthly (12)"]] as const, fn: setFrequency },
                ].map(s => (
                  <div key={s.l} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{s.l}</div>
                    <select value={s.v} onChange={e => s.fn(e.target.value)}
                      style={{ width: "100%", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontFamily: mono, fontSize: 12, padding: "7px 10px", outline: "none" }}>
                      {s.opts.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                    </select>
                  </div>
                ))}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>State</div>
                  <select value={stateCode} onChange={e => setStateCode(e.target.value)}
                    style={{ width: "100%", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontFamily: mono, fontSize: 12, padding: "7px 10px", outline: "none" }}>
                    {STATE_OPTIONS.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                  </select>
                </div>
                <Sl label="Your Age" value={age} min={22} max={70} step={1}
                  onChange={v => { setAge(v); setRetireH(Math.max(5, 65 - v)); }}
                  fmt={v => `${v} yrs`} hint={`Retirement horizon auto-set to ${Math.max(5, 65 - age)} years`} />
              </Card>

              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Account Flags</div>
                {[
                  { label: "Age 50+ catch-up contributions", checked: catchup,    set: setCatchup,    desc: `401k → ${fmt(LIM.k401catch)}, IRA → ${fmt(LIM.iraCatch)}` },
                  { label: "HSA Family Coverage",            checked: hsaFamily,  set: setHsaFamily,  desc: `Max ${fmt(LIM.hsaFamily)} vs ${fmt(LIM.hsaSingle)} single` },
                  { label: "Mega Backdoor Roth enabled",     checked: megaEnabled,set: setMegaEnabled,desc: `Plan allows after-tax 401k → in-service Roth rollover, up to ${fmt(LIM.megaBack)}` },
                ].map((f, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                      <input type="checkbox" checked={f.checked} onChange={e => f.set(e.target.checked)} style={{ marginTop: 2, accentColor: C.accent }} />
                      <div>
                        <div style={{ fontSize: 12, color: C.text, fontFamily: mono }}>{f.label}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{f.desc}</div>
                      </div>
                    </label>
                  </div>
                ))}
              </Card>
            </div>

            <div>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Tax Summary</div>
                {[
                  { l: "Gross Income",     v: gross,                    c: C.text },
                  { l: "AGI",              v: annTax.agi,               c: C.textDim },
                  { l: "Fed Taxable",      v: annTax.fedTaxable,        c: C.textDim },
                  { l: "Federal Tax",      v: annTax.fTax,              c: C.red },
                  { l: `${stateName} State Tax`, v: annTax.nTax,        c: C.orange },
                  { l: "Social Security",  v: annTax.ss,                c: C.purple },
                  { l: "Medicare",         v: annTax.med,               c: C.purple },
                  { l: "Total Tax",        v: annTax.total,             c: C.red, b: true },
                  { l: "Effective Rate",   v: annTax.total / gross,     c: C.orange, isPct: true },
                  { l: "Marginal Fed Rate",v: annTax.marginal,          c: C.red, isPct: true },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.border}22`, fontFamily: mono, fontSize: 11 }}>
                    <span style={{ color: C.textDim, fontWeight: r.b ? 600 : 400 }}>{r.l}</span>
                    <span style={{ color: r.c, fontWeight: r.b ? 700 : 400 }}>{r.isPct ? pct(r.v) : fmt(r.v)}</span>
                  </div>
                ))}
              </Card>

              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Annual Contribution Summary</div>
                {[
                  { l: "401(k) Employee",         v: k401,                    c: C.blue },
                  { l: "401(k) Employer (vested)", v: matchAmt,               c: C.gold },
                  { l: "401(k) Total",             v: k401 + matchAmt,        c: C.blue, b: true },
                  { l: "HSA",                      v: hsa,                    c: C.blue },
                  { l: "FSA",                      v: fsa,                    c: C.gold },
                  { l: "Backdoor Roth IRA",        v: ira,                    c: C.purple },
                  { l: "Mega Backdoor",            v: megaBack,               c: C.purple },
                  { l: "Other Pre-tax",            v: otherPretax,            c: C.mutedMid },
                  { l: "Total Pre-tax",            v: k401 + hsa + fsa + otherPretax, c: C.accent, b: true },
                  { l: "Net Take-Home",            v: current.net,            c: C.accent, b: true },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.border}22`, fontFamily: mono, fontSize: 11 }}>
                    <span style={{ color: C.textDim, fontWeight: r.b ? 600 : 400 }}>{r.l}</span>
                    <span style={{ color: r.c, fontWeight: r.b ? 700 : 400 }}>{fmt(r.v)}</span>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "0 24px 16px", fontSize: 10, color: C.muted, fontFamily: mono, lineHeight: 1.7 }}>
        2024 federal brackets (IRS Rev. Proc. 2023-34) · {stateName} state tax · SS wage base {fmt(FEDERAL_2024.socialSecurity.wageBase)} ·
        Utility function uses coordinate descent over 401k/HSA/FSA/IRA/MegaBack parameters with PV of retirement contributions. ·
        Not financial or tax advice. Consult a CPA/CFP.
      </div>
    </div>
  );
}
