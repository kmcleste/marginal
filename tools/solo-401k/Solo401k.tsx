"use client";

import { useState, useMemo } from "react";
import { colors as T, fonts } from "@marginal/theme";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: T.bg.base, surface: T.bg.surface, surfaceAlt: T.bg.elevated,
  border: T.bg.border,
  accent: T.mint.DEFAULT, accentDim: T.mint.bg,
  gold: T.gold.DEFAULT, goldDim: T.gold.bg,
  blue: T.blue.DEFAULT, blueDim: T.blue.bg,
  purple: T.purple.DEFAULT, purpleDim: T.purple.bg,
  red: T.red.DEFAULT, orange: T.red.orange,
  muted: "#374151", mutedMid: "#4b5563", mutedLight: T.text.secondary,
  text: T.text.primary, textDim: T.text.secondary,
} as const;

const mono = fonts.mono;
const sans = fonts.sans;
const fmt   = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const fmtK  = (n: number) => Math.abs(n) >= 1000 ? `$${((n || 0) / 1000).toFixed(Math.abs(n) >= 100000 ? 0 : 1)}k` : fmt(n);
const pct   = (n: number) => `${((n || 0) * 100).toFixed(1)}%`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ─── 2024 IRS Limits ─────────────────────────────────────────────────────────

const LIMITS_2024 = {
  solo401k: {
    employeeElective: 23000,
    catchUp: 7500,
    totalMax: 69000,
    totalMaxCatchUp: 76500,
  },
  sepIra: {
    max: 69000,
    pct: 0.25,
  },
  simpleIra: {
    employee: 16000,
    catchUp: 3500,
    matchPct: 0.03,
  },
  ira: {
    contribution: 7000,
    catchUp: 1000,
  },
  ssTaxCap: 168600, // SS wage base 2024
} as const;

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
    <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, marginTop: 4 }}>
      {children}
    </div>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8 }}>
      <span style={{ fontSize: 11, color: C.textDim, fontFamily: sans }}>{label}</span>
      <span style={{ fontSize: 12, color: color ?? C.text, fontFamily: mono, fontWeight: bold ? 700 : 500, flexShrink: 0 }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: `1px solid ${C.border}`, margin: "10px 0" }} />;
}

// ─── Core interfaces ──────────────────────────────────────────────────────────

interface CalcResult {
  netSEIncome: number;
  seTax: number;
  deductibleSETax: number;
  qbiDeduction: number;
  netSEForContrib: number;
  catchup: boolean;
  employeeElectiveLimit: number;
  employeeContrib: number;
  employerContribSolo401k: number;
  solo401kTotal: number;
  sepIraTotal: number;
  simpleIraEmployee: number;
  simpleIraMatch: number;
  simpleIraTotal: number;
  iraContrib: number;
  taxSavingsSolo401k: number;
  taxSavingsSep: number;
  taxSavingsSimple: number;
  taxSavingsIra: number;
  solo401kAdvantage: number;
  ssOnSEIncome: number;
  medicareOnSEIncome: number;
  filingStatus: "single" | "mfj";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Solo401k() {
  const [seIncome,        setSeIncome]        = useState(200000);
  const [businessExpenses, setBusinessExp]    = useState(20000);
  const [w2Income,        setW2Income]        = useState(0);
  const [w2Plan401k,      setW2Plan401k]      = useState(0);
  const [filingStatus,    setFilingStatus]    = useState<"single" | "mfj">("single");
  const [age,             setAge]             = useState(42);
  const [marginalRate,    setMarginalRate]    = useState(32);
  const [expectedReturn,  setExpectedReturn]  = useState(8);
  const [yearsToRetire,   setYearsToRetire]   = useState(20);
  const [rothOrTrad,      setRothOrTrad]      = useState<"traditional" | "roth">("traditional");
  const [tab,             setTab]             = useState<"calculator" | "sematch" | "optimizer" | "setup">("calculator");

  const calc = useMemo<CalcResult>(() => {
    const netSEIncome = Math.max(0, seIncome - businessExpenses);

    // SE tax calculation (both halves of SS + Medicare)
    const seTaxBase = netSEIncome * 0.9235;
    const ssWage = Math.min(seTaxBase, LIMITS_2024.ssTaxCap);
    const ssOnSEIncome = ssWage * 0.124;  // 12.4% for SS (both halves)
    const medicareOnSEIncome = seTaxBase * 0.029; // 2.9% for Medicare (both halves)
    const seTax = ssOnSEIncome + medicareOnSEIncome;
    const deductibleSETax = seTax / 2;

    // QBI deduction (simplified 20% of net SE income)
    const qbiDeduction = Math.max(0, netSEIncome * 0.20);

    const netSEForContrib = Math.max(0, netSEIncome - deductibleSETax);

    const catchup = age >= 50;
    const baseElective = catchup
      ? LIMITS_2024.solo401k.employeeElective + LIMITS_2024.solo401k.catchUp
      : LIMITS_2024.solo401k.employeeElective;
    const employeeElectiveLimit = Math.max(0, baseElective - w2Plan401k);
    const employeeContrib = Math.max(0, Math.min(employeeElectiveLimit, netSEIncome));

    const totalMax = catchup ? LIMITS_2024.solo401k.totalMaxCatchUp : LIMITS_2024.solo401k.totalMax;
    const employerContribSolo401k = Math.max(0, Math.min(
      netSEForContrib * 0.25,
      totalMax - employeeContrib,
    ));
    const solo401kTotal = Math.min(
      employeeContrib + employerContribSolo401k,
      totalMax,
    );

    const sepIraTotal = Math.min(netSEForContrib * 0.25, LIMITS_2024.sepIra.max);

    const simpleIraEmployee = Math.min(
      netSEIncome,
      catchup ? LIMITS_2024.simpleIra.employee + LIMITS_2024.simpleIra.catchUp : LIMITS_2024.simpleIra.employee,
    );
    const simpleIraMatch = netSEIncome * LIMITS_2024.simpleIra.matchPct;
    const simpleIraTotal = simpleIraEmployee + simpleIraMatch;

    const iraContrib = catchup
      ? LIMITS_2024.ira.contribution + LIMITS_2024.ira.catchUp
      : LIMITS_2024.ira.contribution;

    const taxRate = marginalRate / 100;
    const taxSavingsSolo401k = solo401kTotal * taxRate;
    const taxSavingsSep = sepIraTotal * taxRate;
    const taxSavingsSimple = simpleIraTotal * taxRate;
    const taxSavingsIra = iraContrib * taxRate;

    // How much MORE can be sheltered vs W-2 max ($23k) + IRA ($7k)
    const w2MaxTotal = (catchup ? 30500 : 23000) + iraContrib;
    const solo401kAdvantage = Math.max(0, solo401kTotal - w2MaxTotal);

    return {
      netSEIncome, seTax, deductibleSETax, qbiDeduction, netSEForContrib,
      catchup, employeeElectiveLimit, employeeContrib, employerContribSolo401k,
      solo401kTotal, sepIraTotal, simpleIraEmployee, simpleIraMatch, simpleIraTotal,
      iraContrib, taxSavingsSolo401k, taxSavingsSep, taxSavingsSimple, taxSavingsIra,
      solo401kAdvantage, ssOnSEIncome, medicareOnSEIncome, filingStatus,
    };
  }, [seIncome, businessExpenses, w2Plan401k, age, marginalRate, filingStatus]);

  // ── Future value comparison (Tab 3) ────────────────────────────────────────
  const growthCalc = useMemo(() => {
    const r = expectedReturn / 100;
    const n = yearsToRetire;

    // W-2 scenario: employee elective only (no SE)
    const w2Annual = calc.catchup ? 30500 : 23000;
    const soloAnnual = calc.solo401kTotal;
    const iraAnnual = calc.iraContrib;
    const w2PlusIra = w2Annual + iraAnnual;

    // Future values using FV of annuity formula: PMT × ((1+r)^n - 1) / r
    const fvW2 = r === 0 ? w2PlusIra * n : w2PlusIra * (Math.pow(1 + r, n) - 1) / r;
    const fvSolo = r === 0 ? soloAnnual * n : soloAnnual * (Math.pow(1 + r, n) - 1) / r;
    const fvDiff = fvSolo - fvW2;

    // Roth: no deduction now, but tax-free growth
    // Taxable: same dollars but returns taxed annually (approximate with after-tax return)
    const taxRate = marginalRate / 100;
    const afterTaxReturn = expectedReturn * (1 - taxRate * 0.5) / 100; // rough after-tax return
    const fvTaxable = r === 0 ? soloAnnual * n : soloAnnual * (Math.pow(1 + afterTaxReturn, n) - 1) / afterTaxReturn;

    // Build chart data points
    const chartPoints: { year: number; w2: number; solo: number }[] = [];
    let w2Acc = 0, soloAcc = 0;
    for (let y = 1; y <= n; y++) {
      w2Acc = w2Acc * (1 + r) + w2PlusIra;
      soloAcc = soloAcc * (1 + r) + soloAnnual;
      chartPoints.push({ year: y, w2: w2Acc, solo: soloAcc });
    }

    return { fvW2, fvSolo, fvDiff, fvTaxable, chartPoints, soloAnnual, w2PlusIra };
  }, [expectedReturn, yearsToRetire, calc.solo401kTotal, calc.catchup, calc.iraContrib, marginalRate]);

  // ── Tabs ───────────────────────────────────────────────────────────────────

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "calculator", label: "Calculator" },
    { id: "sematch",    label: "SE Tax Math" },
    { id: "optimizer",  label: "Optimizer" },
    { id: "setup",      label: "Setup Guide" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: sans }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="co-header-pad" style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div className="co-header-row">
          <div>
            <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
              Solo 401k Calculator
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <Tag color={C.gold}>1099 INCOME: {fmtK(seIncome)}</Tag>
              <Tag color={calc.catchup ? C.orange : C.accent}>MAX CONTRIBUTION: {fmtK(calc.solo401kTotal)}</Tag>
              {calc.catchup && <Tag color={C.orange}>CATCH-UP AGE 50+</Tag>}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans, maxWidth: 600, lineHeight: 1.5 }}>
              Maximize tax-sheltered contributions from self-employment income — up to {fmt(calc.catchup ? LIMITS_2024.solo401k.totalMaxCatchUp : LIMITS_2024.solo401k.totalMax)} vs {fmt(calc.catchup ? 30500 : 23000)} for W-2 employees.
            </div>
          </div>
          <div className="co-mob-hide" style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, marginBottom: 4 }}>SHELTER ADVANTAGE</div>
            <div style={{ fontSize: 32, color: C.gold, fontFamily: mono, fontWeight: 700 }}>{fmtK(calc.solo401kAdvantage)}</div>
            <div style={{ fontSize: 10, color: C.textDim }}>more than W-2 + IRA</div>
          </div>
        </div>

        {/* KPI Row */}
        <div className="co-kpi-row" style={{ gap: 8, marginTop: 12 }}>
          <KpiCard label="Net SE Income" value={fmtK(calc.netSEIncome)} sub="after expenses" color={C.accent} />
          <KpiCard label="Solo 401k Max" value={fmtK(calc.solo401kTotal)} sub={`employee + profit-sharing`} color={C.gold} goldGlow />
          <KpiCard label="vs W-2 Limit" value={fmt(calc.catchup ? 30500 : 23000)} sub="employee elective only" color={C.muted} />
          <KpiCard label="Tax Savings" value={fmtK(calc.taxSavingsSolo401k)} sub={`@ ${marginalRate}% marginal rate`} color={C.accent} />
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 2, padding: "10px 24px 0", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              background: tab === t.id ? C.accentDim : "transparent",
              border: tab === t.id ? `1px solid ${C.accent}44` : "1px solid transparent",
              borderRadius: "6px 6px 0 0",
              color: tab === t.id ? C.accent : C.mutedLight,
              cursor: "pointer",
              fontFamily: mono,
              fontSize: 11,
              padding: "6px 14px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              transition: "all 0.15s",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="co-content-pad">

        {/* ════════════════════════════════════════════════════════════════════
            TAB 1 — Calculator
        ════════════════════════════════════════════════════════════════════ */}
        {tab === "calculator" && (
          <div className="co-grid-lt">

            {/* Left: Income Config */}
            <div>
              <SectionLabel>Income &amp; Profile</SectionLabel>
              <Card>
                <Sl label="Gross SE / 1099 Income" value={seIncome} min={10000} max={600000} step={5000}
                  onChange={setSeIncome} color={C.gold}
                  hint="Gross self-employment, freelance, or business income before expenses" />
                <Sl label="Business Expenses" value={businessExpenses} min={0} max={200000} step={1000}
                  onChange={setBusinessExp} color={C.orange}
                  hint="Deductible business expenses reduce net SE income and SE tax" />
                <Sl label="W-2 Income (if any)" value={w2Income} min={0} max={400000} step={5000}
                  onChange={setW2Income} color={C.blue}
                  hint="Regular W-2 employment income this year" />
                <Sl label="Already Contributed to W-2 401k" value={w2Plan401k} min={0} max={23000} step={500}
                  onChange={setW2Plan401k} color={C.blue}
                  disabled={w2Income === 0}
                  hint="Reduces your remaining employee elective deferral room for Solo 401k" />
              </Card>

              <div style={{ marginTop: 12 }} />
              <SectionLabel>Tax &amp; Demographics</SectionLabel>
              <Card>
                <Sl label="Age" value={age} min={18} max={75} step={1}
                  onChange={setAge} color={C.purple}
                  fmt={v => `${v} yrs`}
                  hint={age >= 50 ? "Catch-up contributions active (+$7,500 elective, +$3,500 SIMPLE)" : "Turn 50 to unlock $7,500 catch-up contribution"} />
                <Sl label="Marginal Tax Rate (Fed + State)" value={marginalRate} min={10} max={60} step={1}
                  onChange={setMarginalRate} color={C.red}
                  fmt={v => `${v}%`}
                  hint="Combined federal + state marginal income tax rate" />
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Filing Status</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["single", "mfj"] as const).map(s => (
                      <button key={s} onClick={() => setFilingStatus(s)}
                        style={{
                          background: filingStatus === s ? C.accentDim : C.surfaceAlt,
                          border: `1px solid ${filingStatus === s ? C.accent + "66" : C.border}`,
                          borderRadius: 6, color: filingStatus === s ? C.accent : C.textDim,
                          cursor: "pointer", fontFamily: mono, fontSize: 11, padding: "5px 14px",
                        }}>
                        {s === "single" ? "Single" : "Married Filing Jointly"}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* Right: Plan Comparison */}
            <div>
              <SectionLabel>Plan Comparison — 2024 Limits</SectionLabel>

              {/* Solo 401k — RECOMMENDED */}
              <Card goldGlow style={{ marginBottom: 12, border: `1px solid ${C.gold}55` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, color: C.gold, fontFamily: mono, fontWeight: 700 }}>Solo 401k</span>
                    <Tag color={C.gold}>RECOMMENDED</Tag>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 28, color: C.gold, fontFamily: mono, fontWeight: 700 }}>{fmt(calc.solo401kTotal)}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>total annual contribution</div>
                  </div>
                </div>
                <div style={{ background: C.goldDim, borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
                  <Row label="Employee elective deferral" value={fmt(calc.employeeContrib)} color={C.gold} />
                  <Row label="Employer profit-sharing (25%)" value={fmt(calc.employerContribSolo401k)} color={C.gold} />
                  {calc.catchup && <Row label="Catch-up bonus (+50)" value={fmt(LIMITS_2024.solo401k.catchUp)} color={C.orange} />}
                  <Divider />
                  <Row label="Total contribution" value={fmt(calc.solo401kTotal)} color={C.gold} bold />
                  <Row label="Tax savings @ {marginalRate}%" value={fmt(calc.taxSavingsSolo401k)} color={C.accent} bold />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Tag color={C.gold}>Roth option available</Tag>
                  <Tag color={C.gold}>Loan option</Tag>
                  <Tag color={C.gold}>Must establish by Dec 31</Tag>
                </div>
              </Card>

              {/* SEP-IRA */}
              <Card style={{ marginBottom: 12, border: `1px solid ${C.blue}44` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, color: C.blue, fontFamily: mono, fontWeight: 700 }}>SEP-IRA</span>
                    <Tag color={C.blue}>SIMPLEST</Tag>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, color: C.blue, fontFamily: mono, fontWeight: 700 }}>{fmt(calc.sepIraTotal)}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>employer contribution only</div>
                  </div>
                </div>
                <Row label="25% of net SE income" value={fmt(calc.netSEForContrib * 0.25)} />
                <Row label="Cap: $69,000" value={calc.sepIraTotal < LIMITS_2024.sepIra.max ? "—" : fmt(LIMITS_2024.sepIra.max)} />
                <Row label="Tax savings" value={fmt(calc.taxSavingsSep)} color={C.accent} />
                {calc.sepIraTotal < calc.solo401kTotal && (
                  <div style={{ marginTop: 8, fontSize: 10, color: C.textDim, fontFamily: sans }}>
                    ↓ {fmt(calc.solo401kTotal - calc.sepIraTotal)} less than Solo 401k — employee elective makes the difference at lower SE incomes.
                  </div>
                )}
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Tag color={C.blue}>Fund by tax deadline</Tag>
                  <Tag color={C.blue}>No Roth option</Tag>
                </div>
              </Card>

              {/* SIMPLE IRA */}
              <Card style={{ marginBottom: 12, border: `1px solid ${C.purple}44` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, color: C.purple, fontFamily: mono, fontWeight: 700 }}>SIMPLE IRA</span>
                    <Tag color={C.purple}>≤100 EMPLOYEES</Tag>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, color: C.purple, fontFamily: mono, fontWeight: 700 }}>{fmt(calc.simpleIraTotal)}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>employee + 3% match</div>
                  </div>
                </div>
                <Row label={`Employee (${calc.catchup ? "$19,500" : "$16,000"} limit)`} value={fmt(calc.simpleIraEmployee)} />
                <Row label="Employer match (3%)" value={fmt(calc.simpleIraMatch)} />
                <Row label="Tax savings" value={fmt(calc.taxSavingsSimple)} color={C.accent} />
                <div style={{ marginTop: 8, fontSize: 10, color: C.textDim, fontFamily: sans }}>
                  Limited usefulness for high SE earners — cap is much lower than Solo 401k.
                </div>
              </Card>

              {/* Standard IRA */}
              <Card style={{ border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, color: C.textDim, fontFamily: mono, fontWeight: 700 }}>Traditional / Roth IRA</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, color: C.textDim, fontFamily: mono, fontWeight: 700 }}>{fmt(calc.iraContrib)}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>add-on to any plan</div>
                  </div>
                </div>
                <Row label={`Contribution limit (${calc.catchup ? "50+" : "under 50"})`} value={fmt(calc.iraContrib)} />
                <Row label="Tax savings (if deductible)" value={fmt(calc.taxSavingsIra)} color={C.accent} />
                <div style={{ marginTop: 8, fontSize: 10, color: C.textDim, fontFamily: sans }}>
                  At high SE income: deductibility phases out. Consider Backdoor Roth IRA strategy.
                </div>
              </Card>

              {/* Solo 401k Advantage callout */}
              {calc.solo401kAdvantage > 0 && (
                <div style={{ marginTop: 14, background: C.goldDim, border: `1px solid ${C.gold}44`, borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                    Solo 401k Advantage
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 28, color: C.gold, fontFamily: mono, fontWeight: 700 }}>{fmt(calc.solo401kAdvantage)}</span>
                    <span style={{ fontSize: 11, color: C.textDim }}>more tax-sheltered than W-2 employee + IRA</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: C.textDim }}>
                    That&apos;s {fmt(calc.solo401kAdvantage * marginalRate / 100)} in additional tax savings and {fmt(calc.solo401kAdvantage * Math.pow(1 + expectedReturn / 100, yearsToRetire))} in additional retirement wealth (in {yearsToRetire} yrs).
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 2 — SE Tax Math
        ════════════════════════════════════════════════════════════════════ */}
        {tab === "sematch" && (
          <div className="co-grid-2">

            {/* Left: Breakdown */}
            <div>
              <SectionLabel>SE Tax Breakdown</SectionLabel>
              <Card style={{ marginBottom: 12 }}>
                <Row label="Gross SE / 1099 Income" value={fmt(seIncome)} color={C.gold} bold />
                <Row label="Business Expenses" value={`− ${fmt(businessExpenses)}`} color={C.orange} />
                <Divider />
                <Row label="Net SE Income" value={fmt(calc.netSEIncome)} color={C.text} bold />
                <div style={{ height: 8 }} />
                <Row label="SE Tax Base (× 92.35%)" value={fmt(calc.netSEIncome * 0.9235)} />
                <Row label="  Social Security (12.4%, capped at $168,600)" value={fmt(calc.ssOnSEIncome)} color={C.red} />
                <Row label="  Medicare (2.9%, no cap)" value={fmt(calc.medicareOnSEIncome)} color={C.red} />
                <Divider />
                <Row label="Total SE Tax" value={fmt(calc.seTax)} color={C.red} bold />
                <Row label="Deductible SE Tax (employer half)" value={`− ${fmt(calc.deductibleSETax)}`} color={C.accent} />
                <Row label="QBI Deduction (20% pass-through)" value={`− ${fmt(calc.qbiDeduction)}`} color={C.accent} />
                <Divider />
                <Row label="Net SE Income for Contributions" value={fmt(calc.netSEForContrib)} color={C.gold} bold />
                <div style={{ height: 6 }} />
                <div style={{ background: C.accentDim, borderRadius: 6, padding: "8px 12px" }}>
                  <div style={{ fontSize: 10, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                    AGI Impact
                  </div>
                  <Row label="SE tax deduction" value={fmt(calc.deductibleSETax)} color={C.accent} />
                  <Row label="QBI deduction" value={fmt(calc.qbiDeduction)} color={C.accent} />
                  <Row label="Solo 401k contribution" value={fmt(calc.solo401kTotal)} color={C.accent} />
                  <Divider />
                  <Row label="Total AGI Reduction" value={fmt(calc.deductibleSETax + calc.qbiDeduction + calc.solo401kTotal)} color={C.accent} bold />
                  <Row label="Tax saved @ {marginalRate}%" value={fmt((calc.deductibleSETax + calc.qbiDeduction + calc.solo401kTotal) * marginalRate / 100)} color={C.gold} bold />
                </div>
              </Card>

              <SectionLabel>FICA Phase-Out</SectionLabel>
              <Card>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6, marginBottom: 10 }}>
                  Social Security tax (12.4%) only applies to the first <strong style={{ color: C.text }}>{fmt(LIMITS_2024.ssTaxCap)}</strong> of SE income (wage base). Medicare (2.9%) has no cap — and the Additional Medicare Tax adds 0.9% on income over $200k.
                </div>
                <Row label="SS Wage Base 2024" value={fmt(LIMITS_2024.ssTaxCap)} />
                <Row label="Your SE Tax Base" value={fmt(calc.netSEIncome * 0.9235)} />
                {calc.netSEIncome * 0.9235 > LIMITS_2024.ssTaxCap && (
                  <Row label="SS Tax Capped (saves)" value={fmt((calc.netSEIncome * 0.9235 - LIMITS_2024.ssTaxCap) * 0.124)} color={C.accent} />
                )}
                <Row label="Effective SE Tax Rate" value={pct(calc.netSEIncome > 0 ? calc.seTax / calc.netSEIncome : 0)} />
                <Row label="Effective SE Tax Rate (after deduction)" value={pct(calc.netSEIncome > 0 ? calc.deductibleSETax / calc.netSEIncome : 0)} />
              </Card>
            </div>

            {/* Right: Concepts */}
            <div>
              <SectionLabel>The Employer Half Concept</SectionLabel>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.7, marginBottom: 12 }}>
                  As a W-2 employee, your employer pays half of Social Security and Medicare taxes on your behalf — you never see it. As self-employed, you pay <em>both halves</em>. The IRS recognizes this is unfair and allows you to deduct the &ldquo;employer half&rdquo; from your adjusted gross income.
                </div>
                <div className="co-grid-2b">
                  <Card style={{ background: C.surfaceAlt, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: C.blue, fontFamily: mono, marginBottom: 4 }}>W-2 EMPLOYEE</div>
                    <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
                      Pays: 7.65% FICA<br />
                      Employer pays: 7.65%<br />
                      Total: 15.3%<br />
                      <strong style={{ color: C.text }}>You see: 7.65%</strong>
                    </div>
                  </Card>
                  <Card style={{ background: C.surfaceAlt, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, marginBottom: 4 }}>SELF-EMPLOYED</div>
                    <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
                      Pays: 15.3% SE tax<br />
                      Deducts: 7.65% (employer half)<br />
                      <strong style={{ color: C.text }}>Net cost: ~{pct(calc.netSEIncome > 0 ? calc.deductibleSETax / calc.netSEIncome : 0)}</strong>
                    </div>
                  </Card>
                </div>
              </Card>

              <SectionLabel>Federal Tax Impact Comparison</SectionLabel>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 8, fontSize: 11, color: C.mutedLight, fontFamily: mono }}>With Solo 401k + SE deductions</div>
                <Row label="Gross SE Income" value={fmt(seIncome)} color={C.gold} />
                <Row label="− Business Expenses" value={fmt(businessExpenses)} color={C.orange} />
                <Row label="− SE Tax Deduction" value={fmt(calc.deductibleSETax)} color={C.accent} />
                <Row label="− QBI Deduction" value={fmt(calc.qbiDeduction)} color={C.accent} />
                <Row label="− Solo 401k Contribution" value={fmt(calc.solo401kTotal)} color={C.accent} />
                <Divider />
                <Row label="Taxable Income (approx)" value={fmt(Math.max(0, seIncome - businessExpenses - calc.deductibleSETax - calc.qbiDeduction - calc.solo401kTotal))} bold />
                <Row label="Federal Income Tax @ {marginalRate}% (est)" value={fmt(Math.max(0, seIncome - businessExpenses - calc.deductibleSETax - calc.qbiDeduction - calc.solo401kTotal) * marginalRate / 100)} color={C.red} />
                <Row label="SE Tax" value={fmt(calc.seTax)} color={C.red} />
                <Divider />
                <Row label="Total Tax Burden (est)" value={fmt(Math.max(0, seIncome - businessExpenses - calc.deductibleSETax - calc.qbiDeduction - calc.solo401kTotal) * marginalRate / 100 + calc.seTax)} color={C.red} bold />
                <div style={{ height: 6 }} />
                <div style={{ fontSize: 10, color: C.muted, fontFamily: sans, lineHeight: 1.5 }}>
                  Simplified estimate — consult a CPA for exact figures. QBI phase-outs apply at higher incomes. State taxes not included.
                </div>
              </Card>

              <SectionLabel>Contribution Formula</SectionLabel>
              <Card>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.7 }}>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ color: C.gold, fontFamily: mono }}>Net SE Income</span> = Gross Income − Business Expenses
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ color: C.red, fontFamily: mono }}>SE Tax</span> = Net SE × 92.35% × 15.3%
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ color: C.accent, fontFamily: mono }}>Employer Profit-Sharing</span> = (Net SE − SE Tax ÷ 2) × 25%
                  </div>
                  <div>
                    The &ldquo;25% of compensation&rdquo; rule effectively yields ~20% of net SE income for the self-employed, because the SE tax deduction reduces the base.
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 3 — Contribution Optimizer
        ════════════════════════════════════════════════════════════════════ */}
        {tab === "optimizer" && (
          <div className="co-grid-2">

            {/* Left: Config */}
            <div>
              <SectionLabel>Growth Assumptions</SectionLabel>
              <Card style={{ marginBottom: 12 }}>
                <Sl label="Expected Annual Return" value={expectedReturn} min={2} max={15} step={0.5}
                  onChange={setExpectedReturn} color={C.accent}
                  fmt={v => `${v}%`}
                  hint="Historical stock market average ~10%, after inflation ~7%" />
                <Sl label="Years to Retirement" value={yearsToRetire} min={1} max={40} step={1}
                  onChange={setYearsToRetire} color={C.blue}
                  fmt={v => `${v} yrs`} />
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    Contribution Type
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["traditional", "roth"] as const).map(t => (
                      <button key={t} onClick={() => setRothOrTrad(t)}
                        style={{
                          background: rothOrTrad === t ? (t === "roth" ? C.purpleDim : C.blueDim) : C.surfaceAlt,
                          border: `1px solid ${rothOrTrad === t ? (t === "roth" ? C.purple + "66" : C.blue + "66") : C.border}`,
                          borderRadius: 6,
                          color: rothOrTrad === t ? (t === "roth" ? C.purple : C.blue) : C.textDim,
                          cursor: "pointer", fontFamily: mono, fontSize: 11, padding: "5px 18px",
                          transition: "all 0.15s",
                        }}>
                        {t === "traditional" ? "Traditional" : "Roth"}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: C.textDim, lineHeight: 1.5 }}>
                    {rothOrTrad === "traditional"
                      ? "Deduct contributions now, pay taxes at withdrawal. Best when marginal rate will drop in retirement."
                      : "No deduction now, but all growth and withdrawals are tax-free forever. Best when marginal rate stays high or increases."}
                  </div>
                </div>
              </Card>

              <SectionLabel>Projected Comparison</SectionLabel>
              <Card style={{ marginBottom: 12 }}>
                <Row label="Solo 401k annual contribution" value={fmt(growthCalc.soloAnnual)} color={C.gold} bold />
                <Row label="W-2 max + IRA annual" value={fmt(growthCalc.w2PlusIra)} color={C.blue} />
                <Row label="Extra sheltered per year" value={fmt(growthCalc.soloAnnual - growthCalc.w2PlusIra)} color={C.accent} bold />
                <Divider />
                <Row label={`FV Solo 401k (${yearsToRetire} yrs @ ${expectedReturn}%)`} value={fmtK(growthCalc.fvSolo)} color={C.gold} bold />
                <Row label={`FV W-2 + IRA scenario`} value={fmtK(growthCalc.fvW2)} color={C.blue} />
                <Divider />
                <Row label="Retirement Wealth Advantage" value={fmtK(growthCalc.fvDiff)} color={C.accent} bold />
                {rothOrTrad === "traditional" && (
                  <Row label={`Today's tax savings`} value={fmt(calc.taxSavingsSolo401k)} color={C.accent} />
                )}
                {rothOrTrad === "roth" && (
                  <div style={{ marginTop: 8, fontSize: 10, color: C.purple, background: C.purpleDim, padding: "6px 10px", borderRadius: 6 }}>
                    Roth: no deduction today, but {fmtK(growthCalc.fvSolo)} is completely tax-free at withdrawal.
                  </div>
                )}
              </Card>

              <SectionLabel>Taxable vs Tax-Sheltered</SectionLabel>
              <Card>
                <Row label="FV Solo 401k (tax-sheltered)" value={fmtK(growthCalc.fvSolo)} color={C.gold} />
                <Row label="FV same $ in taxable account" value={fmtK(growthCalc.fvTaxable)} color={C.muted} />
                <Row label="Tax-shelter advantage" value={fmtK(growthCalc.fvSolo - growthCalc.fvTaxable)} color={C.accent} bold />
                <div style={{ marginTop: 8, fontSize: 10, color: C.textDim }}>
                  Taxable assumes returns taxed annually at half marginal rate (capital gains). Does not include tax drag from dividends.
                </div>
              </Card>
            </div>

            {/* Right: SVG Chart */}
            <div>
              <SectionLabel>Retirement Wealth Accumulation</SectionLabel>
              <Card style={{ padding: "16px 12px" }}>
                <GrowthChart
                  chartPoints={growthCalc.chartPoints}
                  yearsToRetire={yearsToRetire}
                  expectedReturn={expectedReturn}
                />
                <div style={{ display: "flex", gap: 16, marginTop: 10, justifyContent: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 12, height: 3, background: C.gold, borderRadius: 2 }} />
                    <span style={{ fontSize: 10, color: C.textDim, fontFamily: sans }}>Solo 401k</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 12, height: 3, background: C.blue, borderRadius: 2, opacity: 0.7 }} />
                    <span style={{ fontSize: 10, color: C.textDim, fontFamily: sans }}>W-2 + IRA</span>
                  </div>
                </div>
              </Card>

              <div style={{ marginTop: 12 }} />
              <SectionLabel>Annual Contribution Breakdown</SectionLabel>
              <Card>
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, marginBottom: 4 }}>SOLO 401K</div>
                    <ContribBar
                      segments={[
                        { label: "Employee", value: calc.employeeContrib, color: C.gold },
                        { label: "Employer", value: calc.employerContribSolo401k, color: C.orange },
                      ]}
                      total={calc.catchup ? LIMITS_2024.solo401k.totalMaxCatchUp : LIMITS_2024.solo401k.totalMax}
                    />
                    <div style={{ marginTop: 6 }}>
                      <Row label="Employee" value={fmt(calc.employeeContrib)} color={C.gold} />
                      <Row label="Employer (profit-sharing)" value={fmt(calc.employerContribSolo401k)} color={C.orange} />
                      <Row label="Total" value={fmt(calc.solo401kTotal)} color={C.gold} bold />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.blue, fontFamily: mono, marginBottom: 4 }}>W-2 MAX + IRA</div>
                    <ContribBar
                      segments={[
                        { label: "401k", value: calc.catchup ? 30500 : 23000, color: C.blue },
                        { label: "IRA", value: calc.iraContrib, color: C.purple },
                      ]}
                      total={calc.catchup ? LIMITS_2024.solo401k.totalMaxCatchUp : LIMITS_2024.solo401k.totalMax}
                    />
                    <div style={{ marginTop: 6 }}>
                      <Row label="W-2 401k max" value={fmt(calc.catchup ? 30500 : 23000)} color={C.blue} />
                      <Row label="IRA" value={fmt(calc.iraContrib)} color={C.purple} />
                      <Row label="Total" value={fmt((calc.catchup ? 30500 : 23000) + calc.iraContrib)} color={C.blue} bold />
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 4 — Setup Guide
        ════════════════════════════════════════════════════════════════════ */}
        {tab === "setup" && (
          <div className="co-grid-2">

            {/* Left: Guide */}
            <div>
              <SectionLabel>When to Use Each Plan</SectionLabel>
              <Card style={{ marginBottom: 12 }}>
                {[
                  {
                    plan: "Solo 401k",
                    color: C.gold,
                    use: "Best for most solo operators. Highest limits, employee deferral gives big advantage at lower SE income, Roth option available, loan option.",
                    conditions: ["SE income any level", "Want Roth option", "No full-time employees", "Want loan feature"],
                  },
                  {
                    plan: "SEP-IRA",
                    color: C.blue,
                    use: "Simplest to set up. Best when SE income > $230k (approaches Solo 401k max). No Roth, employer-only contributions.",
                    conditions: ["Want simplicity", "SE income > $230k", "No Roth needed", "Fund by April 15"],
                  },
                  {
                    plan: "SIMPLE IRA",
                    color: C.purple,
                    use: "Designed for small businesses with up to 100 employees. Lower limits make it less attractive for solo high-earners.",
                    conditions: ["Have employees", "Lower contribution is OK", "Want easy admin"],
                  },
                ].map(item => (
                  <div key={item.plan} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <Tag color={item.color}>{item.plan}</Tag>
                    </div>
                    <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6, marginBottom: 6 }}>{item.use}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {item.conditions.map(c => (
                        <span key={c} style={{ fontSize: 9, color: item.color, background: item.color + "15", border: `1px solid ${item.color}33`, borderRadius: 4, padding: "2px 6px", fontFamily: mono }}>
                          {c}
                        </span>
                      ))}
                    </div>
                    <Divider />
                  </div>
                ))}
              </Card>

              <SectionLabel>Key Deadlines</SectionLabel>
              <Card>
                {[
                  { plan: "Solo 401k", deadline: "Must establish plan by Dec 31", sub: "Of the tax year. Can fund until tax return due date.", color: C.gold },
                  { plan: "SEP-IRA", deadline: "Open & fund by April 15", sub: "Or Oct 15 with extension. Easiest deadline.", color: C.blue },
                  { plan: "SIMPLE IRA", deadline: "Establish by Oct 1", sub: "Of the year you want contributions. Longer lead time.", color: C.purple },
                  { plan: "IRA", deadline: "Fund by April 15", sub: "Tax return due date. No extension.", color: C.textDim },
                ].map(item => (
                  <div key={item.plan} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                    <Tag color={item.color}>{item.plan}</Tag>
                    <div>
                      <div style={{ fontSize: 11, color: item.color, fontFamily: mono, marginBottom: 2 }}>{item.deadline}</div>
                      <div style={{ fontSize: 10, color: C.textDim }}>{item.sub}</div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>

            {/* Right: Decision tree + Provider table */}
            <div>
              <SectionLabel>Decision Tree</SectionLabel>
              <Card style={{ marginBottom: 12 }}>
                <DecisionTree seIncome={calc.netSEIncome} />
              </Card>

              <SectionLabel>Provider Comparison</SectionLabel>
              <Card>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr>
                        {["Provider", "Solo 401k", "Roth", "Fees", "Notes"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: C.mutedLight, fontFamily: mono, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${C.border}` }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { provider: "Fidelity",     solo: true,  roth: true,  fees: "$0", notes: "Full-featured, best option" },
                        { provider: "Schwab",        solo: true,  roth: true,  fees: "$0", notes: "Great for existing Schwab users" },
                        { provider: "E*TRADE",       solo: true,  roth: true,  fees: "$0", notes: "Good Roth Solo 401k" },
                        { provider: "Vanguard",      solo: true,  roth: false, fees: "$0", notes: "No Roth option" },
                        { provider: "Vanguard SEP",  solo: false, roth: false, fees: "$0", notes: "SEP-IRA only — very easy" },
                        { provider: "TD Ameritrade", solo: true,  roth: true,  fees: "$0", notes: "Now part of Schwab" },
                      ].map((row, i) => (
                        <tr key={row.provider} style={{ background: i % 2 === 0 ? "transparent" : C.surfaceAlt + "55" }}>
                          <td style={{ padding: "7px 8px", color: C.text, fontFamily: sans }}>{row.provider}</td>
                          <td style={{ padding: "7px 8px", color: row.solo ? C.accent : C.muted, fontFamily: mono, textAlign: "center" }}>{row.solo ? "✓" : "—"}</td>
                          <td style={{ padding: "7px 8px", color: row.roth ? C.purple : C.muted, fontFamily: mono, textAlign: "center" }}>{row.roth ? "✓" : "✗"}</td>
                          <td style={{ padding: "7px 8px", color: C.accent, fontFamily: mono }}>{row.fees}</td>
                          <td style={{ padding: "7px 8px", color: C.textDim, fontFamily: sans, fontSize: 10 }}>{row.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 10, fontSize: 10, color: C.muted }}>
                  All major brokerages offer $0-fee Solo 401k plans. Choose based on existing relationships and Roth preference.
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="co-footer-pad" style={{ borderTop: `1px solid ${C.border}`, marginTop: 16 }}>
        <div style={{ fontSize: 9, color: C.muted, fontFamily: sans, lineHeight: 1.7 }}>
          2024 IRS limits: Solo 401k $69,000 / $76,500 catch-up · SEP-IRA 25% of comp up to $69,000 · SE tax = net SE income × 92.35% × 15.3% · Half of SE tax deductible from income · QBI deduction: 20% of qualified business income for pass-through entities (simplified — consult CPA for phase-outs) · Not financial or tax advice.
        </div>
      </div>
    </div>
  );
}

// ─── Growth Chart ─────────────────────────────────────────────────────────────

function GrowthChart({
  chartPoints, yearsToRetire, expectedReturn,
}: {
  chartPoints: { year: number; w2: number; solo: number }[];
  yearsToRetire: number;
  expectedReturn: number;
}) {
  const W = 480, H = 220, PL = 60, PR = 16, PT = 16, PB = 32;
  if (chartPoints.length === 0) return null;

  const maxVal = Math.max(...chartPoints.map(p => p.solo)) * 1.05;
  const minVal = 0;

  const px = (year: number) => PL + ((year - 1) / (Math.max(yearsToRetire - 1, 1))) * (W - PL - PR);
  const py = (val: number) => H - PB - ((val - minVal) / (maxVal - minVal || 1)) * (H - PT - PB);

  const soloPath = chartPoints.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.year).toFixed(1)},${py(p.solo).toFixed(1)}`).join(" ");
  const w2Path   = chartPoints.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.year).toFixed(1)},${py(p.w2).toFixed(1)}`).join(" ");

  const soloFill = soloPath + ` L${px(yearsToRetire).toFixed(1)},${py(0).toFixed(1)} L${px(1).toFixed(1)},${py(0).toFixed(1)} Z`;
  const w2Fill   = w2Path   + ` L${px(yearsToRetire).toFixed(1)},${py(0).toFixed(1)} L${px(1).toFixed(1)},${py(0).toFixed(1)} Z`;

  // Y axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map(f => ({ val: maxVal * f, y: py(maxVal * f) }));
  // X axis ticks
  const xStep = Math.max(1, Math.floor(yearsToRetire / 5));
  const xTicks: number[] = [];
  for (let y = xStep; y <= yearsToRetire; y += xStep) xTicks.push(y);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* Grid */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke={C.border} strokeWidth={0.5} />
          <text x={PL - 4} y={t.y + 3.5} textAnchor="end" fill={C.muted} fontSize={8} fontFamily="monospace">
            {fmtK(t.val)}
          </text>
        </g>
      ))}
      {xTicks.map(y => (
        <g key={y}>
          <line x1={px(y)} y1={PT} x2={px(y)} y2={H - PB} stroke={C.border} strokeWidth={0.5} />
          <text x={px(y)} y={H - PB + 12} textAnchor="middle" fill={C.muted} fontSize={8} fontFamily="monospace">
            Yr {y}
          </text>
        </g>
      ))}
      {/* Fill areas */}
      <path d={soloFill} fill={C.gold} fillOpacity={0.08} />
      <path d={w2Fill} fill={C.blue} fillOpacity={0.08} />
      {/* Lines */}
      <path d={w2Path} fill="none" stroke={C.blue} strokeWidth={1.5} strokeOpacity={0.7} />
      <path d={soloPath} fill="none" stroke={C.gold} strokeWidth={2} />
      {/* Labels at end */}
      {chartPoints.length > 0 && (() => { const last = chartPoints[chartPoints.length - 1]!; return (
        <>
          <text x={px(yearsToRetire) - 4} y={py(last.solo) - 6}
            fill={C.gold} fontSize={9} fontFamily="monospace" textAnchor="end">
            {fmtK(last.solo)}
          </text>
          <text x={px(yearsToRetire) - 4} y={py(last.w2) + 12}
            fill={C.blue} fontSize={9} fontFamily="monospace" textAnchor="end" opacity={0.8}>
            {fmtK(last.w2)}
          </text>
        </>
      ); })()}
      {/* Axis labels */}
      <text x={W / 2} y={H - 2} textAnchor="middle" fill={C.muted} fontSize={8} fontFamily="monospace">
        YEARS (@ {expectedReturn}% return)
      </text>
    </svg>
  );
}

// ─── Contribution Bar ─────────────────────────────────────────────────────────

function ContribBar({
  segments, total,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  const sum = segments.reduce((s, seg) => s + seg.value, 0);
  return (
    <div style={{ height: 8, background: C.muted + "44", borderRadius: 4, overflow: "hidden", display: "flex" }}>
      {segments.map(seg => {
        const w = clamp(seg.value / (total || 1) * 100, 0, 100);
        return (
          <div key={seg.label} style={{ width: `${w}%`, background: seg.color, height: "100%", transition: "width 0.3s" }} />
        );
      })}
      <div style={{ flex: 1, opacity: 0 }} />
    </div>
  );
}

// ─── Decision Tree ────────────────────────────────────────────────────────────

function DecisionTree({ seIncome }: { seIncome: number }) {
  const nodes: { q: string; yes: string; no: string; yesColor: string }[] = [
    {
      q: "Do you have full-time employees (other than yourself/spouse)?",
      yes: "Not eligible for Solo 401k. Consider SEP-IRA or SIMPLE IRA.",
      no: "Continue →",
      yesColor: C.red,
    },
    {
      q: "Do you want a Roth option for tax-free growth?",
      yes: "Solo 401k with Roth (Fidelity, Schwab, E*TRADE)",
      no: "Continue →",
      yesColor: C.purple,
    },
    {
      q: `Is your net SE income > $230k? (yours: ${fmtK(seIncome)})`,
      yes: "SEP-IRA may reach same max ($69k) with simpler setup",
      no: "Solo 401k — employee elective gives major advantage",
      yesColor: C.blue,
    },
  ];

  return (
    <div>
      {nodes.map((node, i) => (
        <div key={i} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, marginBottom: 4 }}>
            STEP {i + 1}
          </div>
          <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px", marginBottom: 6, fontSize: 11, color: C.text, lineHeight: 1.5 }}>
            {node.q}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, background: node.yesColor + "15", border: `1px solid ${node.yesColor}33`, borderRadius: 6, padding: "6px 10px" }}>
              <div style={{ fontSize: 9, color: node.yesColor, fontFamily: mono, marginBottom: 2 }}>YES</div>
              <div style={{ fontSize: 10, color: C.textDim }}>{node.yes}</div>
            </div>
            <div style={{ flex: 1, background: C.accentDim, border: `1px solid ${C.accent}33`, borderRadius: 6, padding: "6px 10px" }}>
              <div style={{ fontSize: 9, color: C.accent, fontFamily: mono, marginBottom: 2 }}>NO</div>
              <div style={{ fontSize: 10, color: C.textDim }}>{node.no}</div>
            </div>
          </div>
          {i < nodes.length - 1 && (
            <div style={{ textAlign: "center", color: C.muted, fontSize: 14, marginTop: 6 }}>↓</div>
          )}
        </div>
      ))}
      <div style={{ background: C.goldDim, border: `1px solid ${C.gold}44`, borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, marginBottom: 2 }}>DEFAULT RECOMMENDATION</div>
        <div style={{ fontSize: 11, color: C.text }}>
          Solo 401k at Fidelity or Schwab — maximum flexibility, Roth option, $0 fees. Establish by December 31.
        </div>
      </div>
    </div>
  );
}
