"use client";

import { useState, useMemo } from "react";
import { colors as T, fonts } from "@marginal/theme";

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:         T.bg.base,
  surface:    T.bg.surface,
  surfaceAlt: T.bg.elevated,
  border:     T.bg.border,
  accent:     T.mint.DEFAULT,
  accentDim:  T.mint.bg,
  gold:       T.gold.DEFAULT,
  goldDim:    T.gold.bg,
  blue:       T.blue.DEFAULT,
  blueDim:    T.blue.bg,
  purple:     T.purple.DEFAULT,
  purpleDim:  T.purple.bg,
  red:        T.red.DEFAULT,
  orange:     T.red.orange,
  muted:      "#374151",
  mutedMid:   "#4b5563",
  mutedLight: T.text.secondary,
  text:       T.text.primary,
  textDim:    T.text.secondary,
} as const;

const mono = fonts.mono;
const sans = fonts.sans;

const fmt   = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const fmtK  = (n: number) => Math.abs(n) >= 1000 ? `$${((n || 0) / 1000).toFixed(Math.abs(n) >= 100000 ? 0 : 1)}k` : fmt(n);
const pct   = (n: number) => `${((n || 0) * 100).toFixed(1)}%`;
const pctN  = (n: number) => `${(n || 0).toFixed(1)}%`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ─── Tax Data ─────────────────────────────────────────────────────────────────

interface Bracket { rate: number; min: number; max: number; }

const BRACKETS_SINGLE: Bracket[] = [
  { rate: 0.10, min: 0,       max: 11600 },
  { rate: 0.12, min: 11600,   max: 47150 },
  { rate: 0.22, min: 47150,   max: 100525 },
  { rate: 0.24, min: 100525,  max: 191950 },
  { rate: 0.32, min: 191950,  max: 243725 },
  { rate: 0.35, min: 243725,  max: 609350 },
  { rate: 0.37, min: 609350,  max: Infinity },
];

const BRACKETS_MFJ: Bracket[] = [
  { rate: 0.10, min: 0,       max: 23200 },
  { rate: 0.12, min: 23200,   max: 94300 },
  { rate: 0.22, min: 94300,   max: 201050 },
  { rate: 0.24, min: 201050,  max: 383900 },
  { rate: 0.32, min: 383900,  max: 487450 },
  { rate: 0.35, min: 487450,  max: 731200 },
  { rate: 0.37, min: 731200,  max: Infinity },
];

const STD_DEDUCTION = { single: 14600, mfj: 29200 };

// IRMAA 2024 thresholds [single, mfj]
interface IrmaaTier {
  label: string;
  partBMonthly: number;
  singleMax: number;
  mfjMax: number;
}

const IRMAA_TIERS: IrmaaTier[] = [
  { label: "Base",   partBMonthly: 174.70, singleMax: 103000,  mfjMax: 206000 },
  { label: "Tier 1", partBMonthly: 244.60, singleMax: 129000,  mfjMax: 258000 },
  { label: "Tier 2", partBMonthly: 349.40, singleMax: 161000,  mfjMax: 322000 },
  { label: "Tier 3", partBMonthly: 454.20, singleMax: 193000,  mfjMax: 386000 },
  { label: "Tier 4", partBMonthly: 559.00, singleMax: 500000,  mfjMax: 750000 },
  { label: "Tier 5", partBMonthly: 594.00, singleMax: Infinity, mfjMax: Infinity },
];

// ─── Components ───────────────────────────────────────────────────────────────

function Card({
  children, style, glow, goldGlow,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  glow?: boolean;
  goldGlow?: boolean;
}) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${glow ? C.accent + "55" : goldGlow ? C.gold + "44" : C.border}`,
      borderRadius: 12,
      padding: "16px 18px",
      boxShadow: glow ? `0 0 24px ${C.accentDim}` : goldGlow ? `0 0 24px ${C.gold}11` : "none",
      ...style,
    }}>
      {children}
    </div>
  );
}

function Sl({
  label, value, min, max, step, onChange, color = C.accent,
  fmt: fmtFn = fmt, hint, disabled,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; color?: string; fmt?: (v: number) => string;
  hint?: string; disabled?: boolean;
}) {
  const fill = clamp((value - min) / (max - min || 1), 0, 1) * 100;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
        <span style={{ fontSize: 12, color: disabled ? C.muted : color, fontFamily: mono, fontWeight: 600 }}>{fmtFn(value)}</span>
      </div>
      <div style={{ position: "relative", height: 4, background: C.muted + "44", borderRadius: 2 }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${fill}%`, background: disabled ? C.muted : color, borderRadius: 2, transition: "width 0.2s" }} />
      </div>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", marginTop: 2, opacity: disabled ? 0.3 : 1, accentColor: color }} />
      {hint && <div style={{ fontSize: 9, color: C.muted, marginTop: 1, fontFamily: sans }}>{hint}</div>}
    </div>
  );
}

function Tag({ children, color = C.accent }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 4, padding: "1px 6px", fontSize: 10, fontFamily: mono }}>
      {children}
    </span>
  );
}

function KpiCard({
  label, value, sub, color = C.accent, goldGlow,
}: {
  label: string; value: string; sub?: string; color?: string; goldGlow?: boolean;
}) {
  return (
    <Card style={{ padding: "12px 14px", flex: 1, minWidth: 0 }} goldGlow={goldGlow === true}>
      <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, color, fontFamily: mono, fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, marginTop: 3 }}>{sub}</div>}
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, marginTop: 4 }}>
      {children}
    </div>
  );
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function getTaxForIncome(taxableIncome: number, brackets: Bracket[]): number {
  let tax = 0;
  for (const b of brackets) {
    if (taxableIncome <= b.min) break;
    const taxable = Math.min(taxableIncome, b.max === Infinity ? taxableIncome : b.max) - b.min;
    tax += taxable * b.rate;
  }
  return tax;
}

function getIrmaaTier(magi: number, filing: "single" | "mfj"): IrmaaTier {
  for (const tier of IRMAA_TIERS) {
    const max = filing === "single" ? tier.singleMax : tier.mfjMax;
    if (magi <= max) return tier;
  }
  return IRMAA_TIERS[IRMAA_TIERS.length - 1]!;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RothConversion() {
  const [filingStatus, setFilingStatus] = useState<"single" | "mfj">("single");
  const [age, setAge] = useState(52);
  const [ordinaryIncome, setOrdinaryIncome] = useState(45000);
  const [itemizedDeductions, setItemizedDeductions] = useState(0);
  const [stateRate, setStateRate] = useState(5);
  const [tradIRABalance, setTradIRABalance] = useState(850000);
  const [rothIRABalance, setRothIRABalance] = useState(120000);
  const [expectedReturn, setExpectedReturn] = useState(7);
  const [yearsInvested, setYearsInvested] = useState(20);
  const [futureOrdinaryRate, setFutureOrdinaryRate] = useState(32);
  const [targetBracket, setTargetBracket] = useState<number>(0.22);
  const [tab, setTab] = useState("optimizer");
  const [yearsToConvert, setYearsToConvert] = useState(5);

  // ─── Core Math ──────────────────────────────────────────────────────────────

  const calc = useMemo(() => {
    const brackets = filingStatus === "mfj" ? BRACKETS_MFJ : BRACKETS_SINGLE;
    const standardDed = filingStatus === "mfj" ? STD_DEDUCTION.mfj : STD_DEDUCTION.single;
    const deduction = Math.max(standardDed, itemizedDeductions);

    // Current taxable income (before conversion)
    const currentTaxableIncome = Math.max(0, ordinaryIncome - deduction);

    // Current marginal bracket
    const currentBracket = brackets.find(b => currentTaxableIncome >= b.min && currentTaxableIncome < b.max)
      ?? brackets[brackets.length - 1]!;
    const currentMarginalRate = currentBracket.rate;

    // Target bracket: find room
    const targetBracketObj = brackets.find(b => b.rate === targetBracket);
    const conversionRoom = targetBracketObj && currentMarginalRate <= targetBracket
      ? Math.max(0, targetBracketObj.max === Infinity ? 500000 : targetBracketObj.max - currentTaxableIncome)
      : 0;

    // Optimal conversion = fill the target bracket exactly
    const optimalConversionAmount = Math.min(conversionRoom, tradIRABalance);

    // Tax cost on the conversion portion (marginal rate on that slice)
    const taxCostOfConversion = optimalConversionAmount * (targetBracket + stateRate / 100);

    // Future value comparison (assuming tax paid from outside funds)
    const r = expectedReturn / 100;
    const n = yearsInvested;

    const convertedRothFV = optimalConversionAmount * Math.pow(1 + r, n);
    const tradFV = optimalConversionAmount * Math.pow(1 + r, n);
    const tradAfterTax = tradFV * (1 - (futureOrdinaryRate + stateRate) / 100);
    const taxDrag = taxCostOfConversion * Math.pow(1 + r, n); // opportunity cost of taxes paid now
    const rothNetFV = convertedRothFV - taxDrag;
    const conversionBenefit = rothNetFV - tradAfterTax;

    // Break-even year (when roth net crosses trad after-tax)
    let breakEvenYear = null;
    for (let yr = 1; yr <= 50; yr++) {
      const rv = optimalConversionAmount * Math.pow(1 + r, yr) - taxCostOfConversion * Math.pow(1 + r, yr);
      const tv = optimalConversionAmount * Math.pow(1 + r, yr) * (1 - (futureOrdinaryRate + stateRate) / 100);
      if (rv >= tv) { breakEvenYear = yr; break; }
    }

    // RMD at age 73
    const yearsToRMD = Math.max(0, 73 - age);
    const tradAtRMD = tradIRABalance * Math.pow(1 + r, yearsToRMD);
    const rmdAmount = tradAtRMD / 26.5;

    // Combined marginal rate at target
    const combinedMarginalRate = targetBracket + stateRate / 100;

    // Current tax on income (no conversion)
    const currentTaxLiability = getTaxForIncome(currentTaxableIncome, brackets);
    const effectiveRate = ordinaryIncome > 0 ? currentTaxLiability / ordinaryIncome : 0;

    // MAGI for IRMAA (before deductions — use ordinaryIncome + conversion as proxy)
    const magiWithConversion = ordinaryIncome + optimalConversionAmount;
    const magiWithout = ordinaryIncome;

    return {
      brackets,
      standardDed,
      deduction,
      currentTaxableIncome,
      currentMarginalRate,
      targetBracketObj,
      conversionRoom,
      optimalConversionAmount,
      taxCostOfConversion,
      combinedMarginalRate,
      convertedRothFV,
      tradAfterTax,
      taxDrag,
      rothNetFV,
      conversionBenefit,
      breakEvenYear,
      rmdAmount,
      tradAtRMD,
      yearsToRMD,
      currentTaxLiability,
      effectiveRate,
      magiWithConversion,
      magiWithout,
    };
  }, [
    filingStatus, age, ordinaryIncome, itemizedDeductions, stateRate,
    tradIRABalance, rothIRABalance, expectedReturn, yearsInvested,
    futureOrdinaryRate, targetBracket,
  ]);

  // ─── Year-by-year plan ──────────────────────────────────────────────────────

  const yearPlan = useMemo(() => {
    const r = expectedReturn / 100;
    // annualConversion based on conversionRoom, but use actual tradIRABalance state
    const roomPerYear = Math.min(calc.conversionRoom, tradIRABalance / Math.max(1, yearsToConvert));

    let trad = tradIRABalance;
    let roth = rothIRABalance;
    let totalConverted = 0;
    let totalTax = 0;

    const rows = [];
    for (let yr = 1; yr <= Math.min(yearsToConvert, 15); yr++) {
      // Grow balances by return first
      trad = trad * (1 + r);
      roth = roth * (1 + r);
      const convert = Math.min(roomPerYear, trad);
      const taxCost = convert * calc.combinedMarginalRate;
      trad -= convert;
      roth += convert;
      totalConverted += convert;
      totalTax += taxCost;
      rows.push({ year: yr, age: age + yr, convert, taxCost, trad, roth, totalConverted, totalTax });
    }
    return { rows, totalConverted, totalTax, finalRoth: rows[rows.length - 1]?.roth ?? roth };
  }, [
    tradIRABalance, rothIRABalance, expectedReturn, yearsToConvert,
    calc.conversionRoom, calc.combinedMarginalRate, age,
  ]);

  // ─── Projection chart data ──────────────────────────────────────────────────

  const projData = useMemo(() => {
    const r = expectedReturn / 100;
    const amt = calc.optimalConversionAmount;
    const points: { yr: number; rothFV: number; tradFV: number }[] = [];
    for (let yr = 0; yr <= yearsInvested; yr++) {
      const fv = amt * Math.pow(1 + r, yr);
      const rothFV = fv - calc.taxCostOfConversion * Math.pow(1 + r, yr);
      const tradFV = fv * (1 - (futureOrdinaryRate + stateRate) / 100);
      points.push({ yr, rothFV, tradFV });
    }
    return points;
  }, [calc.optimalConversionAmount, calc.taxCostOfConversion, expectedReturn, yearsInvested, futureOrdinaryRate, stateRate]);

  // ─── Bracket bar viz ────────────────────────────────────────────────────────

  const bracketBar = useMemo(() => {
    const brackets = calc.brackets;
    const targetBracketObj = calc.targetBracketObj;
    if (!targetBracketObj) return null;

    // We'll display from 0 to end of target bracket
    const displayMax = targetBracketObj.max === Infinity ? calc.currentTaxableIncome + 200000 : targetBracketObj.max;
    if (displayMax <= 0) return null;

    const segments: { min: number; max: number; rate: number; type: "used" | "available" | "above" }[] = [];

    for (const b of brackets) {
      if (b.min >= displayMax) break;
      const segMax = Math.min(b.max === Infinity ? displayMax : b.max, displayMax);
      if (b.rate > targetBracket) break;

      const usedEnd = Math.min(calc.currentTaxableIncome, segMax);
      if (usedEnd > b.min) {
        segments.push({ min: b.min, max: usedEnd, rate: b.rate, type: "used" });
      }
      if (segMax > Math.max(b.min, calc.currentTaxableIncome)) {
        segments.push({ min: Math.max(b.min, calc.currentTaxableIncome), max: segMax, rate: b.rate, type: "available" });
      }
    }

    // Bracket boundaries for tick marks
    const ticks: { pos: number; rate: number; val: number }[] = [];
    for (const b of brackets) {
      if (b.min > 0 && b.min < displayMax) {
        ticks.push({ pos: b.min / displayMax, rate: b.rate, val: b.min });
      }
      if (b.rate >= targetBracket) break;
    }

    return { segments, ticks, displayMax };
  }, [calc, targetBracket]);

  // ─── IRMAA calc ─────────────────────────────────────────────────────────────

  const irmaaCalc = useMemo(() => {
    const tierWithout = getIrmaaTier(calc.magiWithout, filingStatus);
    const tierWith = getIrmaaTier(calc.magiWithConversion, filingStatus);
    const annualWithout = tierWithout.partBMonthly * 12;
    const annualWith = tierWith.partBMonthly * 12;
    const annualIncrease = annualWith - annualWithout;
    const tierCrossed = tierWith.label !== tierWithout.label;

    return { tierWithout, tierWith, annualWithout, annualWith, annualIncrease, tierCrossed };
  }, [calc.magiWithout, calc.magiWithConversion, filingStatus]);

  // ─── Tab bar ────────────────────────────────────────────────────────────────

  const TABS = [
    { id: "optimizer",   label: "Optimizer" },
    { id: "plan",        label: "Year-by-Year Plan" },
    { id: "projection",  label: "Trad vs Roth" },
    { id: "irmaa",       label: "IRMAA & Medicare" },
  ];

  const targetBracketOptions: { label: string; value: number }[] = [
    { label: "10%", value: 0.10 },
    { label: "12%", value: 0.12 },
    { label: "22%", value: 0.22 },
    { label: "24%", value: 0.24 },
    { label: "32%", value: 0.32 },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: sans }}>

      {/* Header */}
      <div className="co-header-pad" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="co-header-row">
          <div>
            <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>
              Marginal
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: mono, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>
              Roth Conversion Optimizer
            </h1>
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <Tag color={C.gold}>Age {age}</Tag>
              <Tag color={C.blue}>{filingStatus === "mfj" ? "Married / MFJ" : "Single"}</Tag>
              <Tag color={C.accent}>{pct(targetBracket)} Target</Tag>
              {calc.conversionBenefit > 0
                ? <Tag color={C.accent}>Convert wins +{fmtK(calc.conversionBenefit)}</Tag>
                : <Tag color={C.muted}>Hold Traditional</Tag>}
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans, maxWidth: 340, lineHeight: 1.5 }}>
            Fill tax brackets during low-income years — pay tax now at a known rate, not later at an uncertain higher rate.
          </div>
        </div>

        {/* KPI Row */}
        <div className="co-kpi-row" style={{ gap: 8, marginTop: 14 }}>
          <KpiCard label="Current Bracket" value={pct(calc.currentMarginalRate)} sub={`${pct(calc.effectiveRate)} effective`} color={C.blue} />
          <KpiCard label="Room at Target" value={fmtK(calc.conversionRoom)} sub={`at ${pct(targetBracket)} marginal`} color={C.accent} />
          <KpiCard label="Optimal Conversion" value={fmtK(calc.optimalConversionAmount)} sub="fill bracket" color={C.gold} goldGlow />
          <KpiCard label="Tax Cost Now" value={fmtK(calc.taxCostOfConversion)} sub={`${pctN(targetBracket * 100 + stateRate)} combined rate`} color={C.red} />
          <div className="co-mob-hide" style={{ flex: 1, minWidth: 0 }}>
            <KpiCard label="Future Benefit" value={fmtK(calc.conversionBenefit)} sub={`vs trad at yr ${yearsInvested}`} color={calc.conversionBenefit >= 0 ? C.accent : C.red} />
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, paddingLeft: 24, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? C.accent : "transparent"}`,
              color: tab === t.id ? C.accent : C.mutedLight, fontFamily: mono, fontSize: 11,
              padding: "10px 16px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em",
              whiteSpace: "nowrap", transition: "color 0.15s",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Optimizer ── */}
      {tab === "optimizer" && (
        <div className="co-content-pad">
          <div className="co-grid-lt" style={{ alignItems: "start" }}>

            {/* Left: Config */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Card>
                <SectionLabel>Filing Status</SectionLabel>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {(["single", "mfj"] as const).map(fs => (
                    <button key={fs} onClick={() => setFilingStatus(fs)}
                      style={{
                        flex: 1, padding: "7px 0", borderRadius: 6, border: `1px solid ${filingStatus === fs ? C.accent + "88" : C.border}`,
                        background: filingStatus === fs ? C.accent + "18" : "none",
                        color: filingStatus === fs ? C.accent : C.mutedLight,
                        fontFamily: mono, fontSize: 11, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>
                      {fs === "mfj" ? "Married / MFJ" : "Single"}
                    </button>
                  ))}
                </div>

                <Sl label="Age" value={age} min={30} max={72} step={1} onChange={setAge}
                  color={C.blue} fmt={v => `${v}`} hint="Age 73+ RMDs begin — convert before then" />
                <Sl label="Ordinary Income This Year" value={ordinaryIncome} min={0} max={300000} step={1000} onChange={setOrdinaryIncome}
                  color={C.blue} hint="Wages, SS, pension, 1099 — before deductions" />
                <Sl label="Itemized Deductions" value={itemizedDeductions} min={0} max={100000} step={500} onChange={setItemizedDeductions}
                  color={C.gold} hint={`Standard deduction: ${fmt(filingStatus === "mfj" ? STD_DEDUCTION.mfj : STD_DEDUCTION.single)} (auto-applied if higher)`} />
                <Sl label="State Income Tax Rate" value={stateRate} min={0} max={15} step={0.5} onChange={setStateRate}
                  color={C.orange} fmt={v => `${v.toFixed(1)}%`} hint="Combined state + local marginal rate" />
              </Card>

              <Card>
                <SectionLabel>IRA Balances</SectionLabel>
                <Sl label="Traditional IRA Balance" value={tradIRABalance} min={0} max={3000000} step={10000} onChange={setTradIRABalance}
                  color={C.blue} hint="Pre-tax IRA + rollover 401(k)" />
                <Sl label="Roth IRA Balance" value={rothIRABalance} min={0} max={1000000} step={5000} onChange={setRothIRABalance}
                  color={C.purple} hint="Existing Roth — grows tax-free" />
              </Card>

              <Card>
                <SectionLabel>Target Bracket</SectionLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {targetBracketOptions.map(opt => (
                    <button key={opt.value} onClick={() => setTargetBracket(opt.value)}
                      style={{
                        padding: "5px 12px", borderRadius: 5, border: `1px solid ${targetBracket === opt.value ? C.accent + "88" : C.border}`,
                        background: targetBracket === opt.value ? C.accent + "18" : "none",
                        color: targetBracket === opt.value ? C.accent : C.mutedLight,
                        fontFamily: mono, fontSize: 11, cursor: "pointer",
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: sans, lineHeight: 1.5 }}>
                  Convert up to the top of this bracket. {calc.currentMarginalRate > targetBracket
                    ? <span style={{ color: C.orange }}>Already above {pct(targetBracket)} — no room to fill.</span>
                    : <span style={{ color: C.accent }}>Room: {fmt(calc.conversionRoom)} available.</span>}
                </div>
              </Card>
            </div>

            {/* Right: Visualization + Results */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Bracket Fill Bar */}
              <Card glow={calc.optimalConversionAmount > 0}>
                <SectionLabel>Bracket Fill Visualization — 2024 Federal Brackets</SectionLabel>
                {bracketBar ? (
                  <div>
                    <svg width="100%" viewBox="0 0 600 80" style={{ display: "block", overflow: "visible" }}>
                      {/* Background track */}
                      <rect x="0" y="20" width="600" height="28" rx="3" fill={C.muted + "22"} />

                      {/* Segments */}
                      {bracketBar.segments.map((seg, i) => {
                        const x = (seg.min / bracketBar.displayMax) * 600;
                        const w = ((seg.max - seg.min) / bracketBar.displayMax) * 600;
                        const color = seg.type === "used" ? C.blue : C.accent;
                        return (
                          <g key={i}>
                            <rect x={x} y="20" width={Math.max(0, w)} height="28" fill={color + (seg.type === "used" ? "cc" : "88")} />
                          </g>
                        );
                      })}

                      {/* Bracket boundary ticks */}
                      {bracketBar.ticks.map((tick, i) => {
                        const x = tick.pos * 600;
                        return (
                          <g key={i}>
                            <line x1={x} y1="14" x2={x} y2="54" stroke={C.border} strokeWidth="1.5" strokeDasharray="3,3" />
                            <text x={x} y="10" textAnchor="middle" fill={C.mutedLight} fontSize="8" fontFamily={mono}>
                              {pct(tick.rate)}
                            </text>
                            <text x={x} y="64" textAnchor="middle" fill={C.muted} fontSize="7" fontFamily={mono}>
                              {fmtK(tick.val)}
                            </text>
                          </g>
                        );
                      })}

                      {/* Labels inside bar */}
                      {calc.currentTaxableIncome > 0 && (() => {
                        const usedW = (calc.currentTaxableIncome / bracketBar.displayMax) * 600;
                        return usedW > 40 ? (
                          <text x={usedW / 2} y="37" textAnchor="middle" fill="white" fontSize="9" fontFamily={mono} fontWeight="600">
                            {fmtK(calc.currentTaxableIncome)}
                          </text>
                        ) : null;
                      })()}

                      {calc.optimalConversionAmount > 0 && (() => {
                        const usedW = (calc.currentTaxableIncome / bracketBar.displayMax) * 600;
                        const convW = (calc.optimalConversionAmount / bracketBar.displayMax) * 600;
                        const cx = usedW + convW / 2;
                        return convW > 40 ? (
                          <text x={cx} y="37" textAnchor="middle" fill={C.bg} fontSize="9" fontFamily={mono} fontWeight="700">
                            {fmtK(calc.optimalConversionAmount)}
                          </text>
                        ) : null;
                      })()}

                      {/* Current income marker */}
                      {calc.currentTaxableIncome > 0 && (
                        <line
                          x1={(calc.currentTaxableIncome / bracketBar.displayMax) * 600}
                          y1="14" x2={(calc.currentTaxableIncome / bracketBar.displayMax) * 600} y2="54"
                          stroke={C.blue} strokeWidth="2" />
                      )}
                    </svg>

                    {/* Legend */}
                    <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 10, height: 10, background: C.blue + "cc", borderRadius: 2 }} />
                        <span style={{ fontSize: 9, color: C.textDim, fontFamily: mono }}>Taxable income ({fmt(calc.currentTaxableIncome)})</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 10, height: 10, background: C.accent + "88", borderRadius: 2 }} />
                        <span style={{ fontSize: 9, color: C.textDim, fontFamily: mono }}>Conversion room ({fmt(calc.conversionRoom)})</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: C.mutedLight, fontSize: 11, fontFamily: sans }}>
                    Current income exceeds target bracket — no room to fill.
                  </div>
                )}
              </Card>

              {/* Optimal Conversion Card */}
              <Card goldGlow={calc.optimalConversionAmount > 0}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                      Optimal Conversion Amount
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 700, fontFamily: mono, color: C.gold, lineHeight: 1 }}>
                      {fmt(calc.optimalConversionAmount)}
                    </div>
                    <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans, marginTop: 6 }}>
                      Fill {pct(targetBracket)} bracket top — taxable income goes from {fmt(calc.currentTaxableIncome)} → {fmt(calc.currentTaxableIncome + calc.optimalConversionAmount)}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                    <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono }}>
                      Tax cost (pay now): <span style={{ color: C.red }}>{fmt(calc.taxCostOfConversion)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono }}>
                      Combined rate: <span style={{ color: C.orange }}>{pctN(targetBracket * 100 + stateRate)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono }}>
                      Deduction used: <span style={{ color: C.blue }}>{fmt(calc.deduction)}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Future Value Comparison */}
              <div className="co-grid-2b" style={{ gap: 12 }}>
                <Card style={{ borderColor: C.purple + "44" }}>
                  <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    Roth (Convert Now)
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: mono, color: C.purple }}>
                    {fmt(calc.rothNetFV)}
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, marginTop: 4 }}>
                    After {yearsInvested} yrs · tax-free · pays {fmt(calc.taxCostOfConversion)} now
                  </div>
                </Card>
                <Card style={{ borderColor: C.blue + "44" }}>
                  <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    Traditional (Hold)
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: mono, color: C.blue }}>
                    {fmt(calc.tradAfterTax)}
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, marginTop: 4 }}>
                    After {yearsInvested} yrs · taxed at {futureOrdinaryRate + stateRate}% on withdrawal
                  </div>
                </Card>
              </div>

              {/* Summary */}
              <Card style={{ borderColor: calc.conversionBenefit >= 0 ? C.accent + "44" : C.red + "44" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {calc.conversionBenefit >= 0 ? "Conversion Advantage" : "Hold Traditional"}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, fontFamily: mono, color: calc.conversionBenefit >= 0 ? C.accent : C.red }}>
                      {calc.conversionBenefit >= 0 ? "+" : ""}{fmt(calc.conversionBenefit)}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {calc.breakEvenYear !== null && (
                      <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans }}>
                        Break-even: <span style={{ color: C.gold, fontFamily: mono }}>year {calc.breakEvenYear}</span>
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans }}>
                      Est. RMD at 73: <span style={{ color: C.orange, fontFamily: mono }}>{fmt(calc.rmdAmount)}/yr</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans }}>
                      Trad bal at 73: <span style={{ color: C.blue, fontFamily: mono }}>{fmtK(calc.tradAtRMD)}</span>
                    </div>
                  </div>
                </div>
              </Card>

            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Year-by-Year Plan ── */}
      {tab === "plan" && (
        <div className="co-content-pad">
          <div className="co-grid-2" style={{ alignItems: "start" }}>

            {/* Left: Config */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Card>
                <SectionLabel>Conversion Plan Settings</SectionLabel>
                <Sl label="Years to Convert" value={yearsToConvert} min={1} max={15} step={1} onChange={setYearsToConvert}
                  color={C.gold} fmt={v => `${v} yrs`} hint="Spread conversions to control annual tax impact" />
                <Sl label="Expected Return" value={expectedReturn} min={1} max={15} step={0.5} onChange={setExpectedReturn}
                  color={C.accent} fmt={v => `${v.toFixed(1)}%`} />
                <div style={{ marginTop: 8 }}>
                  <SectionLabel>Target Bracket Per Year</SectionLabel>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {targetBracketOptions.map(opt => (
                      <button key={opt.value} onClick={() => setTargetBracket(opt.value)}
                        style={{
                          padding: "5px 12px", borderRadius: 5, border: `1px solid ${targetBracket === opt.value ? C.accent + "88" : C.border}`,
                          background: targetBracket === opt.value ? C.accent + "18" : "none",
                          color: targetBracket === opt.value ? C.accent : C.mutedLight,
                          fontFamily: mono, fontSize: 11, cursor: "pointer",
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: sans, marginTop: 6, lineHeight: 1.5 }}>
                    Converting over {yearsToConvert} years at ~{fmt(calc.conversionRoom / yearsToConvert)}/year keeps each conversion within the {pct(targetBracket)} bracket.
                  </div>
                </div>
              </Card>

              {/* Plan Summary Cards */}
              <Card goldGlow>
                <SectionLabel>Multi-Year Summary</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>Total Converted</span>
                    <span style={{ fontSize: 13, fontFamily: mono, color: C.gold }}>{fmt(yearPlan.totalConverted)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>Total Tax Paid</span>
                    <span style={{ fontSize: 13, fontFamily: mono, color: C.red }}>{fmt(yearPlan.totalTax)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>Effective Tax on Conversions</span>
                    <span style={{ fontSize: 13, fontFamily: mono, color: C.orange }}>
                      {yearPlan.totalConverted > 0 ? pctN((yearPlan.totalTax / yearPlan.totalConverted) * 100) : "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>Final Roth Balance</span>
                    <span style={{ fontSize: 13, fontFamily: mono, color: C.purple }}>{fmt(yearPlan.finalRoth)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>Final Trad Balance</span>
                    <span style={{ fontSize: 13, fontFamily: mono, color: C.blue }}>{fmt(yearPlan.rows[yearPlan.rows.length - 1]?.trad ?? tradIRABalance)}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right: Table */}
            <Card>
              <SectionLabel>Year-by-Year Conversion Table</SectionLabel>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["Year", "Age", "Convert", "Tax Cost", "Trad Balance", "Roth Balance"].map(h => (
                        <th key={h} style={{ padding: "6px 8px", textAlign: "right", color: C.mutedLight, fontWeight: 500, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearPlan.rows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}22`, background: i % 2 === 0 ? "transparent" : C.surfaceAlt + "44" }}>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: C.mutedLight }}>{row.year}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: C.blue }}>{row.age}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: C.gold }}>{fmtK(row.convert)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: C.red }}>{fmtK(row.taxCost)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: C.blue }}>{fmtK(row.trad)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: C.purple }}>{fmtK(row.roth)}</td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr style={{ borderTop: `1px solid ${C.border}`, background: C.surfaceAlt }}>
                      <td colSpan={2} style={{ padding: "7px 8px", textAlign: "right", color: C.mutedLight, fontSize: 9, textTransform: "uppercase" }}>Totals</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: C.gold, fontWeight: 700 }}>{fmtK(yearPlan.totalConverted)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: C.red, fontWeight: 700 }}>{fmtK(yearPlan.totalTax)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: C.blue, fontWeight: 700 }}>{fmtK(yearPlan.rows[yearPlan.rows.length - 1]?.trad ?? 0)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: C.purple, fontWeight: 700 }}>{fmtK(yearPlan.finalRoth)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

          </div>
        </div>
      )}

      {/* ── Tab: Trad vs Roth Projection ── */}
      {tab === "projection" && (
        <div className="co-content-pad">
          <div className="co-grid-2" style={{ alignItems: "start" }}>

            {/* Left: Config */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Card>
                <SectionLabel>Projection Parameters</SectionLabel>
                <Sl label="Expected Annual Return" value={expectedReturn} min={1} max={15} step={0.5} onChange={setExpectedReturn}
                  color={C.accent} fmt={v => `${v.toFixed(1)}%`} />
                <Sl label="Years Invested" value={yearsInvested} min={5} max={40} step={1} onChange={setYearsInvested}
                  color={C.gold} fmt={v => `${v} yrs`} hint="How long will the converted amount compound?" />
                <Sl label="Future Ordinary Income Rate" value={futureOrdinaryRate} min={10} max={40} step={1} onChange={setFutureOrdinaryRate}
                  color={C.red} fmt={v => `${v}%`} hint="Rate you'll be in when taking Traditional withdrawals (RMDs)" />
              </Card>

              <Card>
                <SectionLabel>Break-Even & RMD Analysis</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>Break-even year</span>
                    <span style={{ fontSize: 16, fontFamily: mono, color: C.gold }}>
                      {calc.breakEvenYear !== null ? `Year ${calc.breakEvenYear}` : "Never"}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: sans, lineHeight: 1.5 }}>
                    After year {calc.breakEvenYear ?? "—"}, converting is strictly better than leaving funds in Traditional.
                  </div>
                  <div style={{ height: 1, background: C.border, margin: "4px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>Projected RMD at age 73</span>
                    <span style={{ fontSize: 16, fontFamily: mono, color: C.orange }}>{fmt(calc.rmdAmount)}/yr</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: sans, lineHeight: 1.5 }}>
                    Traditional balance projected to {fmtK(calc.tradAtRMD)} at age 73 ({calc.yearsToRMD} yrs). IRS factor 26.5.
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>RMD tax impact (combined)</span>
                    <span style={{ fontSize: 16, fontFamily: mono, color: C.red }}>
                      {fmt(calc.rmdAmount * (futureOrdinaryRate + stateRate) / 100)}/yr
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>Conversion advantage at yr {yearsInvested}</span>
                    <span style={{ fontSize: 16, fontFamily: mono, color: calc.conversionBenefit >= 0 ? C.accent : C.red }}>
                      {calc.conversionBenefit >= 0 ? "+" : ""}{fmt(calc.conversionBenefit)}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Verdict */}
              <Card glow={calc.conversionBenefit > 0} style={{ borderColor: calc.conversionBenefit > 0 ? C.accent + "55" : C.red + "44" }}>
                <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Verdict
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: mono, color: calc.conversionBenefit > 0 ? C.accent : C.red, marginBottom: 6 }}>
                  {calc.conversionBenefit > 0
                    ? `Convert wins by ${fmt(calc.conversionBenefit)}`
                    : `Hold Traditional — saves ${fmt(Math.abs(calc.conversionBenefit))}`}
                </div>
                <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans, lineHeight: 1.6 }}>
                  {calc.conversionBenefit > 0
                    ? `Converting ${fmt(calc.optimalConversionAmount)} at ${pctN(targetBracket * 100 + stateRate)} now beats the ${futureOrdinaryRate + stateRate}% rate at withdrawal over ${yearsInvested} years.`
                    : `Your future tax rate (${futureOrdinaryRate + stateRate}%) is low enough that deferring taxes beats converting at ${pctN(targetBracket * 100 + stateRate)} today.`}
                </div>
              </Card>
            </div>

            {/* Right: SVG Chart */}
            <Card>
              <SectionLabel>Future Value Over Time — Roth vs Traditional After Tax</SectionLabel>
              {calc.optimalConversionAmount > 0 ? (() => {
                const maxFV = Math.max(...projData.map(p => Math.max(p.rothFV, p.tradFV)));
                const minFV = Math.min(...projData.map(p => Math.min(p.rothFV, p.tradFV)));
                const range = maxFV - minFV || 1;
                const W = 540;
                const H = 220;
                const PAD = { t: 10, r: 20, b: 30, l: 60 };
                const plotW = W - PAD.l - PAD.r;
                const plotH = H - PAD.t - PAD.b;

                const xScale = (yr: number) => PAD.l + (yr / yearsInvested) * plotW;
                const yScale = (v: number) => PAD.t + plotH - ((v - minFV) / range) * plotH;

                const rothPath = projData.map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.yr).toFixed(1)},${yScale(p.rothFV).toFixed(1)}`).join(" ");
                const tradPath = projData.map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.yr).toFixed(1)},${yScale(p.tradFV).toFixed(1)}`).join(" ");

                // Y-axis ticks
                const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ val: minFV + t * range, y: PAD.t + plotH - t * plotH }));
                const xTicks = Array.from({ length: Math.min(yearsInvested + 1, 9) }, (_, i) =>
                  Math.round(i * yearsInvested / Math.min(yearsInvested, 8)));

                return (
                  <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
                    {/* Grid lines */}
                    {yTicks.map((t, i) => (
                      <g key={i}>
                        <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y} stroke={C.border} strokeWidth="0.5" />
                        <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fill={C.muted} fontSize="8" fontFamily={mono}>
                          {fmtK(t.val)}
                        </text>
                      </g>
                    ))}
                    {xTicks.map((yr, i) => (
                      <text key={i} x={xScale(yr)} y={H - 4} textAnchor="middle" fill={C.muted} fontSize="8" fontFamily={mono}>
                        {yr}y
                      </text>
                    ))}

                    {/* Break-even marker */}
                    {calc.breakEvenYear !== null && calc.breakEvenYear <= yearsInvested && (
                      <g>
                        <line x1={xScale(calc.breakEvenYear)} y1={PAD.t} x2={xScale(calc.breakEvenYear)} y2={H - PAD.b}
                          stroke={C.gold} strokeWidth="1" strokeDasharray="4,3" />
                        <text x={xScale(calc.breakEvenYear)} y={PAD.t - 2} textAnchor="middle" fill={C.gold} fontSize="8" fontFamily={mono}>
                          break-even yr {calc.breakEvenYear}
                        </text>
                      </g>
                    )}

                    {/* Lines */}
                    <path d={tradPath} fill="none" stroke={C.blue} strokeWidth="2" />
                    <path d={rothPath} fill="none" stroke={C.purple} strokeWidth="2.5" />

                    {/* End labels */}
                    {projData[projData.length - 1] && (() => {
                      const last = projData[projData.length - 1]!;
                      return (
                        <g>
                          <text x={xScale(last.yr) + 4} y={yScale(last.rothFV) + 4} fill={C.purple} fontSize="8" fontFamily={mono}>
                            {fmtK(last.rothFV)}
                          </text>
                          <text x={xScale(last.yr) + 4} y={yScale(last.tradFV) + 4} fill={C.blue} fontSize="8" fontFamily={mono}>
                            {fmtK(last.tradFV)}
                          </text>
                        </g>
                      );
                    })()}
                  </svg>
                );
              })() : (
                <div style={{ color: C.mutedLight, fontSize: 11, fontFamily: sans, padding: "20px 0" }}>
                  Set an optimal conversion amount on the Optimizer tab to see the projection.
                </div>
              )}

              {/* Legend */}
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 20, height: 3, background: C.purple, borderRadius: 2 }} />
                  <span style={{ fontSize: 9, color: C.textDim, fontFamily: mono }}>Roth (after tax cost)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 20, height: 3, background: C.blue, borderRadius: 2 }} />
                  <span style={{ fontSize: 9, color: C.textDim, fontFamily: mono }}>Traditional (after {futureOrdinaryRate + stateRate}% tax)</span>
                </div>
              </div>
            </Card>

          </div>
        </div>
      )}

      {/* ── Tab: IRMAA & Medicare ── */}
      {tab === "irmaa" && (
        <div className="co-content-pad">
          <div className="co-grid-2" style={{ alignItems: "start" }}>

            {/* Left: Summary */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Card>
                <SectionLabel>IRMAA Impact of Conversion</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>MAGI without conversion</span>
                    <span style={{ fontSize: 14, fontFamily: mono, color: C.blue }}>{fmt(calc.magiWithout)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>MAGI with conversion</span>
                    <span style={{ fontSize: 14, fontFamily: mono, color: C.gold }}>{fmt(calc.magiWithConversion)}</span>
                  </div>
                  <div style={{ height: 1, background: C.border }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>IRMAA tier (without)</span>
                    <Tag color={C.blue}>{irmaaCalc.tierWithout.label}</Tag>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>IRMAA tier (with)</span>
                    <Tag color={irmaaCalc.tierCrossed ? C.red : C.accent}>{irmaaCalc.tierWith.label}</Tag>
                  </div>
                  <div style={{ height: 1, background: C.border }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>Part B premium (without)</span>
                    <span style={{ fontSize: 14, fontFamily: mono, color: C.blue }}>{fmt(irmaaCalc.annualWithout)}/yr</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>Part B premium (with)</span>
                    <span style={{ fontSize: 14, fontFamily: mono, color: irmaaCalc.tierCrossed ? C.red : C.blue }}>{fmt(irmaaCalc.annualWith)}/yr</span>
                  </div>
                  {irmaaCalc.annualIncrease > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans }}>Annual Medicare surcharge</span>
                      <span style={{ fontSize: 16, fontFamily: mono, color: C.red }}>+{fmt(irmaaCalc.annualIncrease)}/yr</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Warning / Recommendation */}
              {irmaaCalc.tierCrossed && (
                <Card style={{ borderColor: C.red + "55", background: C.red + "08" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.red, fontFamily: mono, marginBottom: 6 }}>
                    IRMAA Tier Crossed
                  </div>
                  <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans, lineHeight: 1.6 }}>
                    This conversion pushes MAGI from <strong>{irmaaCalc.tierWithout.label}</strong> to <strong>{irmaaCalc.tierWith.label}</strong>,
                    adding <strong style={{ color: C.red }}>{fmt(irmaaCalc.annualIncrease)}/year</strong> in Medicare Part B premiums.
                    <br /><br />
                    Consider reducing the conversion by {fmt(calc.magiWithConversion - (filingStatus === "single" ? IRMAA_TIERS.find(t => t.label === irmaaCalc.tierWithout.label)!.singleMax : IRMAA_TIERS.find(t => t.label === irmaaCalc.tierWithout.label)!.mfjMax))} to stay in {irmaaCalc.tierWithout.label}.
                  </div>
                </Card>
              )}

              {!irmaaCalc.tierCrossed && (
                <Card style={{ borderColor: C.accent + "44" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, fontFamily: mono, marginBottom: 6 }}>
                    No IRMAA Impact
                  </div>
                  <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans, lineHeight: 1.6 }}>
                    This conversion stays within the {irmaaCalc.tierWithout.label} IRMAA tier.
                    {filingStatus === "single"
                      ? ` You have ${fmt(IRMAA_TIERS.find(t => t.label === irmaaCalc.tierWithout.label)!.singleMax - calc.magiWithConversion)} of headroom before the next tier.`
                      : ` You have ${fmt(IRMAA_TIERS.find(t => t.label === irmaaCalc.tierWithout.label)!.mfjMax - calc.magiWithConversion)} of headroom before the next tier.`}
                  </div>
                </Card>
              )}

              <Card>
                <div style={{ fontSize: 10, color: C.orange, fontFamily: sans, lineHeight: 1.6 }}>
                  <strong>Note:</strong> IRMAA uses MAGI from 2 years prior. A 2024 conversion affects 2026 Medicare premiums. Roth conversions also affect ACA premium subsidies — model carefully if you rely on marketplace coverage.
                </div>
              </Card>
            </div>

            {/* Right: IRMAA Tier Table */}
            <Card>
              <SectionLabel>2024 IRMAA Tiers — Part B Monthly Premium</SectionLabel>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["Tier", "Single MAGI", "MFJ MAGI", "Part B/mo", "Annual", "Status"].map(h => (
                        <th key={h} style={{ padding: "6px 8px", textAlign: "right", color: C.mutedLight, fontWeight: 500, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {IRMAA_TIERS.map((tier, i) => {
                      const isCurrentWithout = tier.label === irmaaCalc.tierWithout.label;
                      const isCurrentWith = tier.label === irmaaCalc.tierWith.label;
                      const rowColor = isCurrentWith
                        ? (irmaaCalc.tierCrossed ? C.red + "18" : C.accent + "18")
                        : isCurrentWithout && irmaaCalc.tierCrossed
                          ? C.blue + "0a"
                          : i % 2 === 0 ? "transparent" : C.surfaceAlt + "44";
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}22`, background: rowColor }}>
                          <td style={{ padding: "8px 8px", textAlign: "right", color: C.text, fontWeight: isCurrentWith ? 700 : 400 }}>{tier.label}</td>
                          <td style={{ padding: "8px 8px", textAlign: "right", color: C.mutedLight }}>
                            {tier.singleMax === Infinity ? `>${fmt(IRMAA_TIERS[IRMAA_TIERS.length - 2]!.singleMax)}` : `≤${fmt(tier.singleMax)}`}
                          </td>
                          <td style={{ padding: "8px 8px", textAlign: "right", color: C.mutedLight }}>
                            {tier.mfjMax === Infinity ? `>${fmt(IRMAA_TIERS[IRMAA_TIERS.length - 2]!.mfjMax)}` : `≤${fmt(tier.mfjMax)}`}
                          </td>
                          <td style={{ padding: "8px 8px", textAlign: "right", color: C.gold }}>${tier.partBMonthly.toFixed(2)}</td>
                          <td style={{ padding: "8px 8px", textAlign: "right", color: C.gold }}>{fmt(tier.partBMonthly * 12)}</td>
                          <td style={{ padding: "8px 8px", textAlign: "right" }}>
                            {isCurrentWith && isCurrentWithout && <Tag color={C.accent}>You (both)</Tag>}
                            {isCurrentWith && !isCurrentWithout && <Tag color={irmaaCalc.tierCrossed ? C.red : C.accent}>With convert</Tag>}
                            {isCurrentWithout && !isCurrentWith && <Tag color={C.blue}>Without</Tag>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {irmaaCalc.tierCrossed && (
                <div style={{ marginTop: 12, padding: "10px 12px", background: C.red + "12", borderRadius: 8, border: `1px solid ${C.red}33` }}>
                  <div style={{ fontSize: 10, color: C.red, fontFamily: mono, fontWeight: 700, marginBottom: 4 }}>
                    Recommendation
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, lineHeight: 1.6 }}>
                    Stay below {filingStatus === "single"
                      ? fmt(IRMAA_TIERS.find(t => t.label === irmaaCalc.tierWithout.label)!.singleMax)
                      : fmt(IRMAA_TIERS.find(t => t.label === irmaaCalc.tierWithout.label)!.mfjMax)} MAGI to avoid{" "}
                    <strong style={{ color: C.red }}>{fmt(irmaaCalc.annualIncrease)}/year</strong> in additional Medicare Part B premiums.
                    Reduce your conversion to {fmt(
                      (filingStatus === "single"
                        ? IRMAA_TIERS.find(t => t.label === irmaaCalc.tierWithout.label)!.singleMax
                        : IRMAA_TIERS.find(t => t.label === irmaaCalc.tierWithout.label)!.mfjMax)
                      - calc.magiWithout
                    )} or less.
                  </div>
                </div>
              )}
            </Card>

          </div>
        </div>
      )}

      {/* Footer */}
      <div className="co-footer-pad" style={{ borderTop: `1px solid ${C.border}`, marginTop: 8 }}>
        <div style={{ fontSize: 9, color: C.muted, fontFamily: sans, lineHeight: 1.8 }}>
          2024 federal tax brackets (IRS Rev. Proc. 2023-34) · IRMAA thresholds from CMS 2024 ·{" "}
          Roth conversions increase MAGI — model IRMAA and ACA premium subsidy impact before converting ·{" "}
          Not financial or tax advice. Consult a CPA or CFP.
        </div>
      </div>

    </div>
  );
}
