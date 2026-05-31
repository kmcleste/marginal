"use client";
import { useState, useMemo } from "react";
import { colors as T, fonts } from "@marginal/theme";

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:           T.bg.base,
  surface:      T.bg.surface,
  surfaceAlt:   T.bg.elevated,
  border:       T.bg.border,
  borderBright: T.bg.borderSubtle,
  accent:       T.mint.DEFAULT,
  accentDim:    T.mint.bg,
  gold:         T.gold.DEFAULT,
  goldDim:      T.gold.bg,
  blue:         T.blue.DEFAULT,
  blueDim:      T.blue.bg,
  purple:       T.purple.DEFAULT,
  purpleDim:    T.purple.bg,
  red:          T.red.DEFAULT,
  orange:       T.red.orange,
  muted:        "#374151",
  mutedMid:     "#4b5563",
  mutedLight:   T.text.secondary,
  text:         T.text.primary,
  textDim:      T.text.secondary,
} as const;

const mono = fonts.mono;
const sans = fonts.sans;

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt  = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const fmtK = (n: number) =>
  Math.abs(n) >= 1000 ? `$${((n || 0) / 1000).toFixed(Math.abs(n) >= 100000 ? 0 : 1)}k` : fmt(n);
const pct  = (n: number) => `${((n || 0) * 100).toFixed(1)}%`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ─── Core Components ──────────────────────────────────────────────────────────

function Card({
  children,
  style,
  glow,
  goldGlow,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  glow?: boolean;
  goldGlow?: boolean;
}) {
  return (
    <div
      style={{
        background:   C.surface,
        border:       `1px solid ${glow ? C.accent + "55" : goldGlow ? C.gold + "44" : C.border}`,
        borderRadius: 12,
        padding:      "16px 18px",
        boxShadow:    glow
          ? `0 0 24px ${C.accentDim}`
          : goldGlow
          ? `0 0 24px ${C.gold}11`
          : "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Sl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  color = C.accent,
  fmt: fmtFn = fmt,
  hint,
  disabled,
}: {
  label:    string;
  value:    number;
  min:      number;
  max:      number;
  step:     number;
  onChange: (v: number) => void;
  color?:   string;
  fmt?:     (v: number) => string;
  hint?:    string | undefined;
  disabled?: boolean;
}) {
  const pctFill = clamp((value - min) / (max - min || 1), 0, 1) * 100;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span
          style={{
            fontSize:      10,
            color:         C.mutedLight,
            fontFamily:    mono,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize:   12,
            color:      disabled ? C.muted : color,
            fontFamily: mono,
            fontWeight: 600,
          }}
        >
          {fmtFn(value)}
        </span>
      </div>
      <div style={{ position: "relative", height: 4, background: C.muted + "44", borderRadius: 2 }}>
        <div
          style={{
            position:   "absolute",
            left:       0,
            top:        0,
            height:     "100%",
            width:      `${pctFill}%`,
            background: disabled ? C.muted : color,
            borderRadius: 2,
            transition: "width 0.2s",
          }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(+e.target.value)}
        style={{ width: "100%", marginTop: 2, opacity: disabled ? 0.3 : 1, accentColor: color }}
      />
      {hint && (
        <div style={{ fontSize: 9, color: C.muted, marginTop: 1, fontFamily: sans }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Tag({
  children,
  color = C.accent,
}: {
  children: React.ReactNode;
  color?:   string;
}) {
  return (
    <span
      style={{
        background:   color + "22",
        color,
        border:       `1px solid ${color}44`,
        borderRadius: 4,
        padding:      "1px 6px",
        fontSize:     10,
        fontFamily:   mono,
      }}
    >
      {children}
    </span>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AmortRow {
  month:       number;
  year:        number;
  payment:     number;
  principal:   number;
  interest:    number;
  balance:     number;
  equity:      number;
  cumInterest: number;
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function monthlyPayment(principal: number, annualRate: number, termYears: number): number {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function buildAmortSchedule(
  principal: number,
  annualRate: number,
  termYears:  number,
  homeVal:    number,
  extraMonthly = 0,
): AmortRow[] {
  const r       = annualRate / 100 / 12;
  const payment = monthlyPayment(principal, annualRate, termYears);
  const rows: AmortRow[] = [];
  let   bal         = principal;
  let   cumInterest = 0;
  const startYear   = new Date().getFullYear();

  for (let m = 1; m <= termYears * 12 && bal > 0; m++) {
    const interestAmt  = bal * r;
    const principalAmt = Math.min(payment - interestAmt + extraMonthly, bal);
    bal               -= principalAmt;
    cumInterest       += interestAmt;
    rows.push({
      month:       m,
      year:        startYear + Math.floor((m - 1) / 12),
      payment:     payment + extraMonthly,
      principal:   principalAmt,
      interest:    interestAmt,
      balance:     Math.max(0, bal),
      equity:      homeVal - Math.max(0, bal),
      cumInterest,
    });
    if (bal <= 0.01) break;
  }
  return rows;
}

function futureValue(monthly: number, annualReturn: number, months: number): number {
  const r = annualReturn / 100 / 12;
  if (r === 0) return monthly * months;
  return monthly * ((Math.pow(1 + r, months) - 1) / r);
}

// ─── KPI Box ──────────────────────────────────────────────────────────────────

function KpiBox({
  label,
  value,
  color = C.text,
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  sub?:  string | undefined;
}) {
  return (
    <div
      style={{
        flex:        "1 1 0",
        padding:     "10px 14px",
        borderRight: `1px solid ${C.border}`,
        minWidth:    0,
      }}
    >
      <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, color, fontFamily: mono, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: C.muted, fontFamily: sans, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize:      9,
        color:         C.mutedLight,
        fontFamily:    mono,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        marginBottom:  8,
        marginTop:     4,
      }}
    >
      {children}
    </div>
  );
}

// ─── Term Buttons ─────────────────────────────────────────────────────────────

function TermButtons({
  value,
  options,
  onChange,
}: {
  value:    number;
  options:  number[];
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {options.map((yr) => (
        <button
          key={yr}
          onClick={() => onChange(yr)}
          style={{
            flex:         1,
            padding:      "6px 0",
            background:   value === yr ? C.accent + "22" : C.surfaceAlt,
            border:       `1px solid ${value === yr ? C.accent + "88" : C.border}`,
            borderRadius: 6,
            color:        value === yr ? C.accent : C.mutedLight,
            fontFamily:   mono,
            fontSize:     11,
            cursor:       "pointer",
          }}
        >
          {yr}yr
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MortgageVsInvest() {
  // Loan details
  const [homeValue,      setHomeValue]      = useState(750000);
  const [downPayment,    setDownPayment]    = useState(150000);
  const [loanRate,       setLoanRate]       = useState(7.0);
  const [loanTermYrs,    setLoanTermYrs]    = useState(30);
  const [loanStartYear,  setLoanStartYear]  = useState(2024);
  const [currentBalance, setCurrentBalance] = useState(600000);

  // Extra payment
  const [extraMonthly, setExtraMonthly] = useState(0);

  // PMI
  const [pmiRate, setPmiRate] = useState(0.5);

  // Refinance
  const [refiRate,    setRefiRate]    = useState(6.0);
  const [refiCosts,   setRefiCosts]   = useState(6000);
  const [refiTermYrs, setRefiTermYrs] = useState(30);

  // Investment
  const [investReturn, setInvestReturn] = useState(8);
  const [marginalTax,  setMarginalTax]  = useState(32);
  const [itemizing,    setItemizing]    = useState(false);

  // UI
  const [tab,       setTab]       = useState("loan");
  const [showAmort, setShowAmort] = useState(false);

  // ── Derived base values ──────────────────────────────────────────────────

  const loanAmount = useMemo(() => Math.max(0, homeValue - downPayment), [homeValue, downPayment]);
  const ltv        = useMemo(() => (loanAmount / (homeValue || 1)), [loanAmount, homeValue]);
  const pmiMonthly = useMemo(
    () => (ltv > 0.80 ? (loanAmount * pmiRate) / 100 / 12 : 0),
    [ltv, loanAmount, pmiRate],
  );
  const basePayment = useMemo(
    () => monthlyPayment(loanAmount, loanRate, loanTermYrs),
    [loanAmount, loanRate, loanTermYrs],
  );

  // ── Full amortization (no extra) ─────────────────────────────────────────

  const amortBase = useMemo(
    () => buildAmortSchedule(loanAmount, loanRate, loanTermYrs, homeValue, 0),
    [loanAmount, loanRate, loanTermYrs, homeValue],
  );

  // ── Full amortization (with extra) ──────────────────────────────────────

  const amortExtra = useMemo(
    () =>
      extraMonthly > 0
        ? buildAmortSchedule(loanAmount, loanRate, loanTermYrs, homeValue, extraMonthly)
        : amortBase,
    [loanAmount, loanRate, loanTermYrs, homeValue, extraMonthly, amortBase],
  );

  // ── Key amortization metrics ─────────────────────────────────────────────

  const metrics = useMemo(() => {
    const lastBase  = amortBase[amortBase.length - 1];
    const lastExtra = amortExtra[amortExtra.length - 1];

    const interestBase  = lastBase?.cumInterest  ?? 0;
    const interestExtra = lastExtra?.cumInterest ?? 0;
    const interestSaved = interestBase - interestExtra;

    const payoffMonthBase  = lastBase?.month  ?? loanTermYrs * 12;
    const payoffMonthExtra = lastExtra?.month ?? loanTermYrs * 12;
    const monthsSaved      = payoffMonthBase - payoffMonthExtra;

    // PMI cutoff: first month LTV < 80%
    const pmiCutoffBase = amortBase.findIndex((r) => r.balance / homeValue < 0.80);
    const pmiCutoffExtra = amortExtra.findIndex((r) => r.balance / homeValue < 0.80);

    return {
      interestBase,
      interestExtra,
      interestSaved,
      payoffMonthBase,
      payoffMonthExtra,
      monthsSaved,
      pmiCutoffBase:  pmiCutoffBase === -1 ? 0 : pmiCutoffBase + 1,
      pmiCutoffExtra: pmiCutoffExtra === -1 ? 0 : pmiCutoffExtra + 1,
    };
  }, [amortBase, amortExtra, loanTermYrs, homeValue]);

  // ── Refi analysis ────────────────────────────────────────────────────────

  const refiMetrics = useMemo(() => {
    const yearsElapsed      = new Date().getFullYear() - loanStartYear;
    const remainingTermBase = Math.max(1, loanTermYrs - yearsElapsed);

    const oldPayment       = monthlyPayment(currentBalance, loanRate, remainingTermBase);
    const newPayment       = monthlyPayment(currentBalance, refiRate, refiTermYrs);
    const monthlySavings   = oldPayment - newPayment;
    const breakevenMonths  = monthlySavings > 0 ? refiCosts / monthlySavings : Infinity;

    // Total remaining interest
    const oldAmort = buildAmortSchedule(currentBalance, loanRate, remainingTermBase, homeValue, 0);
    const newAmort = buildAmortSchedule(currentBalance, refiRate, refiTermYrs, homeValue, 0);

    const totalInterestOld = oldAmort[oldAmort.length - 1]?.cumInterest ?? 0;
    const totalInterestNew = newAmort[newAmort.length - 1]?.cumInterest ?? 0;

    return {
      oldPayment,
      newPayment,
      monthlySavings,
      breakevenMonths,
      totalInterestOld,
      totalInterestNew,
      interestSavedRefi: totalInterestOld - totalInterestNew,
    };
  }, [currentBalance, loanRate, refiRate, refiTermYrs, refiCosts, loanStartYear, loanTermYrs, homeValue]);

  // ── Invest vs. paydown ───────────────────────────────────────────────────

  const investMetrics = useMemo(() => {
    const effectiveRate = itemizing ? loanRate * (1 - marginalTax / 100) : loanRate;
    const n             = metrics.payoffMonthBase;

    const fvInvest   = futureValue(extraMonthly, investReturn, n);
    const interestSaved = metrics.interestSaved;

    // Net advantage of investing vs. paydown
    const investAdvantage = fvInvest - interestSaved;

    // Sensitivity rows: market returns 4%, 6%, 8%, 10%, 12%
    const sensitivityRates = [4, 6, 8, 10, 12];
    const sensitivity = sensitivityRates.map((r) => ({
      rate:     r,
      fv:       futureValue(extraMonthly, r, n),
      winInvest: futureValue(extraMonthly, r, n) > interestSaved,
    }));

    return {
      effectiveRate,
      fvInvest,
      interestSaved,
      investAdvantage,
      sensitivity,
    };
  }, [extraMonthly, investReturn, marginalTax, itemizing, loanRate, metrics]);

  // ── Tab config ───────────────────────────────────────────────────────────

  const tabs = [
    { id: "loan",    label: "Loan" },
    { id: "extra",   label: "Extra Paydown" },
    { id: "refi",    label: "Refi" },
    { id: "invest",  label: "Invest" },
  ];

  // ── Amortization yearly summary ──────────────────────────────────────────

  const amortYearly = useMemo(() => {
    const years: { year: number; balance: number; cumInterest: number; equity: number; pctPaid: number }[] = [];
    const targetYears = [1, 5, 10, 15, 20, 25, 30].filter((y) => y <= loanTermYrs);
    for (const yr of targetYears) {
      const idx = amortBase.findIndex((r) => r.month === yr * 12);
      const row = idx !== -1 ? amortBase[idx] : amortBase[amortBase.length - 1];
      if (!row) continue;
      years.push({
        year:       yr,
        balance:    row.balance,
        cumInterest: row.cumInterest,
        equity:     row.equity,
        pctPaid:    (loanAmount - row.balance) / (loanAmount || 1),
      });
    }
    return years;
  }, [amortBase, loanTermYrs, loanAmount]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: sans, color: C.text }}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="co-header-pad">
          <div className="co-header-row">
            <div>
              <h1
                style={{
                  fontFamily:    mono,
                  fontSize:      15,
                  fontWeight:    700,
                  letterSpacing: "0.06em",
                  color:         C.text,
                  marginBottom:  4,
                }}
              >
                MORTGAGE VS. INVEST
              </h1>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                <Tag color={C.accent}>{loanTermYrs}-YR FIXED</Tag>
                <Tag color={C.blue}>{loanRate.toFixed(3)}%</Tag>
                {ltv > 0.80 && <Tag color={C.orange}>PMI</Tag>}
              </div>
              <p style={{ fontSize: 11, color: C.textDim, fontFamily: sans, maxWidth: 540 }}>
                Objective: compare extra principal paydown vs. market investment, quantify the opportunity cost and guaranteed return of debt elimination.
              </p>
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div className="co-kpi-row" style={{ borderTop: `1px solid ${C.border}` }}>
          <KpiBox
            label="Monthly P&I"
            value={fmtK(basePayment)}
            color={C.accent}
            sub={ltv > 0.80 ? `+${fmtK(pmiMonthly)} PMI` : undefined}
          />
          <KpiBox label="Loan Amount" value={fmtK(loanAmount)} color={C.text} />
          <KpiBox
            label="LTV"
            value={pct(ltv)}
            color={ltv > 0.80 ? C.orange : ltv > 0.90 ? C.red : C.accent}
          />
          <KpiBox
            label="Total Interest"
            value={fmtK(metrics.interestBase)}
            color={C.red}
            sub={`over ${loanTermYrs} years`}
          />
        </div>
      </div>

      {/* ── Tab nav ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display:      "flex",
          borderBottom: `1px solid ${C.border}`,
          background:   C.bg,
          overflowX:    "auto",
          padding:      "0 24px",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background:    "none",
              border:        "none",
              cursor:        "pointer",
              fontFamily:    mono,
              fontSize:      11,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              padding:       "11px 14px",
              color:         tab === t.id ? C.accent : C.mutedLight,
              borderBottom:  `2px solid ${tab === t.id ? C.accent : "transparent"}`,
              whiteSpace:    "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: LOAN                                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === "loan" && (
        <div className="co-content-pad">
          <div className="co-grid-lt">
            {/* Left: Config */}
            <div>
              <Card>
                <SectionLabel>Property</SectionLabel>
                <Sl
                  label="Home Value"
                  value={homeValue}
                  min={100000}
                  max={3000000}
                  step={10000}
                  onChange={setHomeValue}
                  color={C.gold}
                />
                <Sl
                  label={`Down Payment · LTV ${pct(ltv)}`}
                  value={downPayment}
                  min={0}
                  max={Math.min(1500000, homeValue)}
                  step={5000}
                  onChange={(v) => {
                    setDownPayment(v);
                    // Also keep currentBalance in sync if user hasn't touched it
                    setCurrentBalance(Math.min(currentBalance, homeValue - v));
                  }}
                  color={ltv > 0.80 ? C.orange : C.accent}
                  hint={ltv > 0.80 ? "LTV > 80% — PMI will apply" : "LTV ≤ 80% — No PMI required"}
                />

                <SectionLabel>Loan Terms</SectionLabel>
                <Sl
                  label="Interest Rate"
                  value={loanRate}
                  min={2}
                  max={10}
                  step={0.125}
                  onChange={setLoanRate}
                  color={C.blue}
                  fmt={(v) => `${v.toFixed(3)}%`}
                />
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    Loan Term
                  </div>
                  <TermButtons value={loanTermYrs} options={[15, 20, 30]} onChange={setLoanTermYrs} />
                </div>

                <SectionLabel>PMI</SectionLabel>
                <Sl
                  label={`PMI Rate (annual · ${ltv <= 0.80 ? "not applicable" : "applies"})`}
                  value={pmiRate}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={setPmiRate}
                  color={C.orange}
                  fmt={(v) => `${v.toFixed(1)}%`}
                  disabled={ltv <= 0.80}
                  hint="PMI is removed once LTV ≤ 80%"
                />
              </Card>
            </div>

            {/* Right: Results */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Payment breakdown */}
              <Card>
                <SectionLabel>Monthly Payment Breakdown</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: "Principal & Interest", val: basePayment,  color: C.accent },
                    { label: "PMI",                  val: pmiMonthly,   color: C.orange, hide: ltv <= 0.80 },
                    { label: "Total",                val: basePayment + pmiMonthly, color: C.text, bold: true },
                  ]
                    .filter((r) => !r.hide)
                    .map((row) => (
                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: C.textDim, fontFamily: sans }}>{row.label}</span>
                        <span style={{ fontSize: 14, color: row.color, fontFamily: mono, fontWeight: row.bold ? 700 : 500 }}>
                          {fmt(row.val)}
                        </span>
                      </div>
                    ))}
                </div>

                <div style={{ height: 1, background: C.border, margin: "12px 0" }} />

                <div className="co-grid-2b">
                  {[
                    { label: "Loan Amount",     val: fmt(loanAmount),                color: C.text },
                    { label: "Down Payment %",  val: pct(downPayment / homeValue),   color: C.gold },
                    { label: "LTV Ratio",       val: pct(ltv),                       color: ltv > 0.80 ? C.orange : C.accent },
                    { label: "PMI Monthly",     val: ltv > 0.80 ? fmt(pmiMonthly) : "—", color: C.orange },
                  ].map((item) => (
                    <div key={item.label} style={{ background: C.surfaceAlt, borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 14, color: item.color, fontFamily: mono, fontWeight: 600 }}>
                        {item.val}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Amortization progress */}
              <Card>
                <SectionLabel>Principal Paid Over Time</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {amortYearly.map((row) => (
                    <div key={row.year} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 36, fontSize: 10, color: C.muted, fontFamily: mono, textAlign: "right", flexShrink: 0 }}>
                        Yr {row.year}
                      </span>
                      <div style={{ flex: 1, height: 6, background: C.muted + "33", borderRadius: 3, overflow: "hidden" }}>
                        <div
                          style={{
                            height:     "100%",
                            width:      `${clamp(row.pctPaid * 100, 0, 100)}%`,
                            background: C.accent,
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span style={{ width: 36, fontSize: 10, color: C.accent, fontFamily: mono, textAlign: "right", flexShrink: 0 }}>
                        {(row.pctPaid * 100).toFixed(0)}%
                      </span>
                      <span style={{ width: 72, fontSize: 10, color: C.textDim, fontFamily: mono, textAlign: "right", flexShrink: 0 }}>
                        {fmtK(row.balance)}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={() => setShowAmort(!showAmort)}
                    style={{
                      background:   "none",
                      border:       `1px solid ${C.border}`,
                      borderRadius: 6,
                      color:        C.mutedLight,
                      fontFamily:   mono,
                      fontSize:     10,
                      cursor:       "pointer",
                      padding:      "5px 10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}
                  >
                    {showAmort ? "Hide" : "Show"} Full Amortization Table
                  </button>
                </div>

                {showAmort && (
                  <div
                    style={{
                      marginTop:  12,
                      maxHeight:  320,
                      overflowY:  "auto",
                      borderRadius: 6,
                      border:     `1px solid ${C.border}`,
                    }}
                  >
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: mono }}>
                      <thead>
                        <tr style={{ background: C.surfaceAlt, position: "sticky", top: 0 }}>
                          {["Year", "Month", "Payment", "Principal", "Interest", "Balance", "Cum. Interest"].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding:   "6px 8px",
                                textAlign: "right",
                                color:     C.mutedLight,
                                fontWeight: 600,
                                borderBottom: `1px solid ${C.border}`,
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {amortBase.map((r) => (
                          <tr key={r.month} style={{ borderBottom: `1px solid ${C.border}22` }}>
                            <td style={{ padding: "4px 8px", textAlign: "right", color: C.muted }}>{r.year}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right", color: C.textDim }}>{r.month}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right", color: C.text }}>{fmt(r.payment)}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right", color: C.accent }}>{fmt(r.principal)}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right", color: C.red }}>{fmt(r.interest)}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right", color: C.textDim }}>{fmt(r.balance)}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right", color: C.orange }}>{fmt(r.cumInterest)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* Total interest */}
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                      Total Interest Over Loan Life
                    </div>
                    <div style={{ fontSize: 24, color: C.red, fontFamily: mono, fontWeight: 700 }}>
                      {fmt(metrics.interestBase)}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontFamily: sans }}>
                      {((metrics.interestBase / (loanAmount || 1)) * 100).toFixed(0)}% of loan amount ·{" "}
                      {fmt(loanAmount + metrics.interestBase)} total cost
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: C.muted, fontFamily: mono, textTransform: "uppercase", marginBottom: 4 }}>
                      Effective Cost
                    </div>
                    <div style={{ fontSize: 14, color: C.orange, fontFamily: mono }}>
                      {pct((loanAmount + metrics.interestBase) / (loanAmount || 1) - 1)}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: EXTRA PAYDOWN                                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === "extra" && (
        <div className="co-content-pad">
          <div className="co-grid-lt">
            {/* Left: Config */}
            <div>
              <Card>
                <SectionLabel>Extra Payment</SectionLabel>
                <Sl
                  label="Extra Monthly Payment"
                  value={extraMonthly}
                  min={0}
                  max={5000}
                  step={50}
                  onChange={setExtraMonthly}
                  color={C.accent}
                  hint="Applied directly to principal each month"
                />
                <Sl
                  label="Current Loan Balance"
                  value={currentBalance}
                  min={0}
                  max={homeValue}
                  step={5000}
                  onChange={setCurrentBalance}
                  color={C.blue}
                  hint="Your existing mortgage balance (for refi & invest tabs)"
                />
                <Sl
                  label="PMI Rate (annual)"
                  value={pmiRate}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={setPmiRate}
                  color={C.orange}
                  fmt={(v) => `${v.toFixed(1)}%`}
                  disabled={ltv <= 0.80}
                />
              </Card>
            </div>

            {/* Right: Results */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Card glow={extraMonthly > 0}>
                <SectionLabel>Payoff Acceleration</SectionLabel>
                <div className="co-grid-2b">
                  {[
                    {
                      label: "Normal Payoff",
                      val:   `Month ${metrics.payoffMonthBase}`,
                      sub:   `Year ${loanStartYear + Math.floor(metrics.payoffMonthBase / 12)}`,
                      color: C.muted,
                    },
                    {
                      label: "Accelerated Payoff",
                      val:   `Month ${metrics.payoffMonthExtra}`,
                      sub:   `Year ${loanStartYear + Math.floor(metrics.payoffMonthExtra / 12)}`,
                      color: extraMonthly > 0 ? C.accent : C.muted,
                    },
                  ].map((item) => (
                    <div key={item.label} style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 16, color: item.color, fontFamily: mono, fontWeight: 700 }}>
                        {item.val}
                      </div>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: sans, marginTop: 2 }}>
                        {item.sub}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ height: 1, background: C.border, margin: "12px 0" }} />

                <div className="co-grid-2b">
                  {[
                    { label: "Months Saved",    val: metrics.monthsSaved.toString(),    color: C.accent },
                    { label: "Interest Saved",  val: fmt(metrics.interestSaved),        color: C.accent },
                    { label: "Normal Interest", val: fmt(metrics.interestBase),         color: C.red },
                    { label: "With Extra",      val: fmt(metrics.interestExtra),        color: C.textDim },
                  ].map((item) => (
                    <div key={item.label} style={{ background: C.surfaceAlt, borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 14, color: item.color, fontFamily: mono, fontWeight: 600 }}>
                        {item.val}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* PMI elimination */}
              {ltv > 0.80 && (
                <Card>
                  <SectionLabel>PMI Elimination</SectionLabel>
                  <div className="co-grid-2b">
                    {[
                      {
                        label: "Without Extra",
                        val:   metrics.pmiCutoffBase > 0 ? `Month ${metrics.pmiCutoffBase}` : "At origination",
                        sub:   metrics.pmiCutoffBase > 0
                          ? `~${fmt((metrics.pmiCutoffBase * pmiMonthly))} PMI paid`
                          : "No PMI",
                        color: C.muted,
                      },
                      {
                        label: "With Extra",
                        val:   metrics.pmiCutoffExtra > 0 ? `Month ${metrics.pmiCutoffExtra}` : "At origination",
                        sub:   metrics.pmiCutoffExtra > 0
                          ? `~${fmt((metrics.pmiCutoffExtra * pmiMonthly))} PMI paid`
                          : "No PMI",
                        color: extraMonthly > 0 ? C.accent : C.muted,
                      },
                    ].map((item) => (
                      <div key={item.label} style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 14, color: item.color, fontFamily: mono, fontWeight: 700 }}>
                          {item.val}
                        </div>
                        <div style={{ fontSize: 9, color: C.muted, fontFamily: sans, marginTop: 2 }}>{item.sub}</div>
                      </div>
                    ))}
                  </div>
                  {metrics.pmiCutoffBase > metrics.pmiCutoffExtra && extraMonthly > 0 && (
                    <div style={{ marginTop: 8, fontSize: 10, color: C.accent, fontFamily: sans }}>
                      Extra payments eliminate PMI{" "}
                      {metrics.pmiCutoffBase - metrics.pmiCutoffExtra} months earlier, saving{" "}
                      ~{fmt((metrics.pmiCutoffBase - metrics.pmiCutoffExtra) * pmiMonthly)} in PMI premiums.
                    </div>
                  )}
                </Card>
              )}

              {/* Timeline SVG */}
              <Card>
                <SectionLabel>Payoff Timeline</SectionLabel>
                <PayoffTimeline
                  payoffMonthBase={metrics.payoffMonthBase}
                  payoffMonthExtra={metrics.payoffMonthExtra}
                  pmiCutoffBase={metrics.pmiCutoffBase}
                  pmiCutoffExtra={metrics.pmiCutoffExtra}
                  hasExtra={extraMonthly > 0}
                  hasPmi={ltv > 0.80}
                />
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: REFI                                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === "refi" && (
        <div className="co-content-pad">
          <div className="co-grid-lt">
            {/* Left: Config */}
            <div>
              <Card>
                <SectionLabel>Refinance Parameters</SectionLabel>
                <Sl
                  label="Current Rate"
                  value={loanRate}
                  min={2}
                  max={10}
                  step={0.125}
                  onChange={setLoanRate}
                  color={C.muted}
                  fmt={(v) => `${v.toFixed(3)}%`}
                  hint="Your existing loan rate"
                />
                <Sl
                  label="New Rate"
                  value={refiRate}
                  min={2}
                  max={9}
                  step={0.125}
                  onChange={setRefiRate}
                  color={refiRate < loanRate ? C.accent : C.red}
                  fmt={(v) => `${v.toFixed(3)}%`}
                  hint={refiRate > loanRate ? "Higher than current rate — refinancing increases cost" : undefined}
                />
                <Sl
                  label="Closing Costs"
                  value={refiCosts}
                  min={0}
                  max={20000}
                  step={500}
                  onChange={setRefiCosts}
                  color={C.orange}
                />
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    New Term
                  </div>
                  <TermButtons value={refiTermYrs} options={[15, 20, 30]} onChange={setRefiTermYrs} />
                </div>
                <Sl
                  label="Current Balance"
                  value={currentBalance}
                  min={0}
                  max={homeValue}
                  step={5000}
                  onChange={setCurrentBalance}
                  color={C.blue}
                />
                <Sl
                  label="Loan Origination Year"
                  value={loanStartYear}
                  min={2010}
                  max={2025}
                  step={1}
                  onChange={setLoanStartYear}
                  color={C.purple}
                  fmt={(v) => `${v}`}
                />
              </Card>
            </div>

            {/* Right: Results */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {refiRate > loanRate && (
                <div
                  style={{
                    background:   C.red + "15",
                    border:       `1px solid ${C.red}44`,
                    borderRadius: 8,
                    padding:      "10px 14px",
                    fontSize:     11,
                    color:        C.red,
                    fontFamily:   sans,
                  }}
                >
                  Warning: Refinancing at a higher rate ({refiRate.toFixed(3)}%) than your current rate ({loanRate.toFixed(3)}%) increases your total interest cost.
                </div>
              )}

              <Card goldGlow={refiMetrics.monthlySavings > 0}>
                <SectionLabel>Payment Comparison</SectionLabel>
                <div className="co-grid-2b">
                  {[
                    { label: "Current Payment", val: fmt(refiMetrics.oldPayment), color: C.textDim },
                    { label: "New Payment",      val: fmt(refiMetrics.newPayment), color: refiMetrics.newPayment < refiMetrics.oldPayment ? C.accent : C.red },
                    {
                      label: "Monthly Savings",
                      val:   refiMetrics.monthlySavings >= 0
                        ? `+${fmt(refiMetrics.monthlySavings)}`
                        : fmt(refiMetrics.monthlySavings),
                      color: refiMetrics.monthlySavings > 0 ? C.accent : C.red,
                    },
                    {
                      label: "Breakeven",
                      val:   isFinite(refiMetrics.breakevenMonths)
                        ? `${Math.ceil(refiMetrics.breakevenMonths)} mo`
                        : "Never",
                      color: isFinite(refiMetrics.breakevenMonths) ? C.gold : C.red,
                    },
                  ].map((item) => (
                    <div key={item.label} style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 16, color: item.color, fontFamily: mono, fontWeight: 700 }}>
                        {item.val}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <SectionLabel>Total Interest: Old vs. New Loan</SectionLabel>
                <div className="co-grid-2b">
                  {[
                    { label: "Remaining Interest (old)", val: fmt(refiMetrics.totalInterestOld), color: C.red },
                    { label: "Total Interest (new)",     val: fmt(refiMetrics.totalInterestNew), color: refiMetrics.totalInterestNew < refiMetrics.totalInterestOld ? C.accent : C.red },
                    { label: "Closing Costs",            val: fmt(refiCosts),                    color: C.orange },
                    {
                      label: "Net Savings",
                      val:   fmt(refiMetrics.interestSavedRefi - refiCosts),
                      color: refiMetrics.interestSavedRefi - refiCosts > 0 ? C.accent : C.red,
                    },
                  ].map((item) => (
                    <div key={item.label} style={{ background: C.surfaceAlt, borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 14, color: item.color, fontFamily: mono, fontWeight: 600 }}>
                        {item.val}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Breakeven SVG chart */}
              <Card>
                <SectionLabel>Cumulative Savings vs. Closing Costs</SectionLabel>
                <RefiBreakevenChart
                  monthlySavings={refiMetrics.monthlySavings}
                  refiCosts={refiCosts}
                  breakevenMonths={refiMetrics.breakevenMonths}
                />
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: INVEST                                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === "invest" && (
        <div className="co-content-pad">
          <div className="co-grid-lt">
            {/* Left: Config */}
            <div>
              <Card>
                <SectionLabel>Investment Parameters</SectionLabel>
                <Sl
                  label="Market Return"
                  value={investReturn}
                  min={3}
                  max={15}
                  step={0.5}
                  onChange={setInvestReturn}
                  color={C.accent}
                  fmt={(v) => `${v.toFixed(1)}%`}
                  hint="Expected annual return (uncertain)"
                />
                <Sl
                  label="Marginal Tax Rate (fed + state)"
                  value={marginalTax}
                  min={10}
                  max={50}
                  step={1}
                  onChange={setMarginalTax}
                  color={C.red}
                  fmt={(v) => `${v}%`}
                  hint="Combined federal + state marginal rate for mortgage deduction"
                />
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setItemizing(!itemizing)}>
                    <div
                      style={{
                        width:        16,
                        height:       16,
                        borderRadius: 3,
                        border:       `1px solid ${itemizing ? C.accent : C.border}`,
                        background:   itemizing ? C.accent + "33" : "transparent",
                        display:      "flex",
                        alignItems:   "center",
                        justifyContent: "center",
                        flexShrink:   0,
                      }}
                    >
                      {itemizing && <div style={{ width: 8, height: 8, borderRadius: 1, background: C.accent }} />}
                    </div>
                    <span style={{ fontSize: 11, color: C.textDim, fontFamily: sans }}>
                      Itemizing deductions (mortgage interest deductible)
                    </span>
                  </div>
                  {itemizing && (
                    <div style={{ marginTop: 6, fontSize: 9, color: C.muted, fontFamily: sans, paddingLeft: 24 }}>
                      Effective rate: {(loanRate * (1 - marginalTax / 100)).toFixed(2)}% after tax deduction
                    </div>
                  )}
                </div>
                <Sl
                  label="Extra Monthly (to invest or prepay)"
                  value={extraMonthly}
                  min={0}
                  max={5000}
                  step={50}
                  onChange={setExtraMonthly}
                  color={C.gold}
                />
              </Card>
            </div>

            {/* Right: Results */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Decision summary */}
              <Card glow={investMetrics.investAdvantage > 0} goldGlow={investMetrics.investAdvantage <= 0}>
                <SectionLabel>The Decision</SectionLabel>
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: C.textDim, fontFamily: sans }}>
                    At your effective mortgage rate of{" "}
                  </span>
                  <span style={{ fontSize: 14, color: C.orange, fontFamily: mono, fontWeight: 700 }}>
                    {investMetrics.effectiveRate.toFixed(2)}%
                  </span>
                  <span style={{ fontSize: 12, color: C.textDim, fontFamily: sans }}>
                    , investing at{" "}
                  </span>
                  <span style={{ fontSize: 14, color: C.accent, fontFamily: mono, fontWeight: 700 }}>
                    {investReturn}%
                  </span>
                  <span style={{ fontSize: 12, color: C.textDim, fontFamily: sans }}>
                    {" "}
                    {investReturn > investMetrics.effectiveRate
                      ? "exceeds your guaranteed return from paydown."
                      : "underperforms the guaranteed return from paydown."}
                  </span>
                </div>

                {/* Verdict banner */}
                {extraMonthly > 0 ? (
                  <div
                    style={{
                      background:   (investMetrics.investAdvantage > 0 ? C.accent : C.gold) + "15",
                      border:       `1px solid ${(investMetrics.investAdvantage > 0 ? C.accent : C.gold)}44`,
                      borderRadius: 8,
                      padding:      "10px 14px",
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ fontSize: 11, color: investMetrics.investAdvantage > 0 ? C.accent : C.gold, fontFamily: mono, fontWeight: 700 }}>
                      {investMetrics.investAdvantage > 0
                        ? `INVEST WINS by ${fmt(investMetrics.investAdvantage)}`
                        : `PAYDOWN WINS by ${fmt(-investMetrics.investAdvantage)}`}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, fontFamily: sans, marginTop: 3 }}>
                      Over {metrics.payoffMonthBase} months ({(metrics.payoffMonthBase / 12).toFixed(1)} years) with {fmt(extraMonthly)}/mo extra
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: C.muted, fontFamily: sans, marginBottom: 12 }}>
                    Set an extra monthly amount to see the comparison.
                  </div>
                )}
              </Card>

              {/* Comparison table */}
              <Card>
                <SectionLabel>Strategy Comparison</SectionLabel>
                <div
                  style={{
                    border:       `1px solid ${C.border}`,
                    borderRadius: 8,
                    overflow:     "hidden",
                    fontSize:     11,
                    fontFamily:   mono,
                  }}
                >
                  {[
                    { label: "Monthly Allocation",      paydown: fmt(extraMonthly),                              invest: fmt(extraMonthly) },
                    { label: "Return Type",              paydown: `Guaranteed ${loanRate.toFixed(2)}%`,          invest: `Market ${investReturn}% (uncertain)` },
                    { label: "After-tax Effective",      paydown: `${investMetrics.effectiveRate.toFixed(2)}%`,  invest: `${investReturn}% (LTCG applies)` },
                    {
                      label:   `${Math.round(metrics.payoffMonthBase / 12 / 10) * 10}-yr Outcome`,
                      paydown: fmt(metrics.interestSaved),
                      invest:  fmt(investMetrics.fvInvest),
                    },
                  ].map((row, i) => (
                    <div
                      key={row.label}
                      style={{
                        display:         "grid",
                        gridTemplateColumns: "160px 1fr 1fr",
                        borderBottom:    i < 3 ? `1px solid ${C.border}` : "none",
                      }}
                    >
                      <div style={{ padding: "8px 10px", fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", borderRight: `1px solid ${C.border}` }}>
                        {row.label}
                      </div>
                      <div style={{ padding: "8px 10px", color: C.gold, borderRight: `1px solid ${C.border}` }}>
                        {row.paydown}
                      </div>
                      <div style={{ padding: "8px 10px", color: C.accent }}>
                        {row.invest}
                      </div>
                    </div>
                  ))}

                  {/* Header row at bottom showing which won */}
                  <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr", background: C.surfaceAlt }}>
                    <div style={{ padding: "8px 10px", fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", borderRight: `1px solid ${C.border}` }}>
                      Verdict
                    </div>
                    <div
                      style={{
                        padding:      "8px 10px",
                        color:        investMetrics.investAdvantage <= 0 ? C.gold : C.muted,
                        fontWeight:   investMetrics.investAdvantage <= 0 ? 700 : 400,
                        borderRight:  `1px solid ${C.border}`,
                        fontSize:     11,
                      }}
                    >
                      {investMetrics.investAdvantage <= 0 ? "WINNER" : "—"}
                    </div>
                    <div
                      style={{
                        padding:    "8px 10px",
                        color:      investMetrics.investAdvantage > 0 ? C.accent : C.muted,
                        fontWeight: investMetrics.investAdvantage > 0 ? 700 : 400,
                        fontSize:   11,
                      }}
                    >
                      {investMetrics.investAdvantage > 0 ? "WINNER" : "—"}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Sensitivity table */}
              <Card>
                <SectionLabel>Sensitivity: Market Return vs. Paydown</SectionLabel>
                <div
                  style={{
                    border:       `1px solid ${C.border}`,
                    borderRadius: 8,
                    overflow:     "hidden",
                    fontSize:     11,
                    fontFamily:   mono,
                  }}
                >
                  <div
                    style={{
                      display:             "grid",
                      gridTemplateColumns: "80px 1fr 1fr 80px",
                      background:          C.surfaceAlt,
                      borderBottom:        `1px solid ${C.border}`,
                    }}
                  >
                    {["Return", "Invest FV", "Paydown Saves", "Winner"].map((h) => (
                      <div key={h} style={{ padding: "6px 10px", fontSize: 9, color: C.mutedLight, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        {h}
                      </div>
                    ))}
                  </div>
                  {investMetrics.sensitivity.map((row) => (
                    <div
                      key={row.rate}
                      style={{
                        display:             "grid",
                        gridTemplateColumns: "80px 1fr 1fr 80px",
                        borderBottom:        `1px solid ${C.border}22`,
                        background:          row.rate === investReturn ? C.accent + "08" : "transparent",
                      }}
                    >
                      <div style={{ padding: "7px 10px", color: row.rate === investReturn ? C.accent : C.textDim }}>
                        {row.rate}%{row.rate === investReturn ? " ←" : ""}
                      </div>
                      <div style={{ padding: "7px 10px", color: row.winInvest ? C.accent : C.textDim }}>
                        {extraMonthly > 0 ? fmt(row.fv) : "—"}
                      </div>
                      <div style={{ padding: "7px 10px", color: !row.winInvest ? C.gold : C.textDim }}>
                        {extraMonthly > 0 ? fmt(metrics.interestSaved) : "—"}
                      </div>
                      <div style={{ padding: "7px 10px", color: row.winInvest ? C.accent : C.gold, fontWeight: 700 }}>
                        {row.winInvest ? "Invest" : "Paydown"}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div
        className="co-footer-pad"
        style={{
          borderTop:  `1px solid ${C.border}`,
          marginTop:  8,
        }}
      >
        <p style={{ fontSize: 9, color: C.muted, fontFamily: sans, lineHeight: 1.6 }}>
          Standard amortization formula · After-tax effective rate assumes mortgage interest deduction (verify with CPA) ·{" "}
          Investment returns are not guaranteed; mortgage paydown is a risk-free return equal to your interest rate · Not financial or tax advice.
        </p>
      </div>
    </div>
  );
}

// ─── Payoff Timeline SVG ─────────────────────────────────────────────────────

function PayoffTimeline({
  payoffMonthBase,
  payoffMonthExtra,
  pmiCutoffBase,
  pmiCutoffExtra,
  hasExtra,
  hasPmi,
}: {
  payoffMonthBase:  number;
  payoffMonthExtra: number;
  pmiCutoffBase:    number;
  pmiCutoffExtra:   number;
  hasExtra:         boolean;
  hasPmi:           boolean;
}) {
  const W     = 520;
  const H     = 80;
  const PAD   = 32;
  const barY  = 40;
  const barH  = 8;
  const total = payoffMonthBase;

  const xOf = (m: number) => PAD + ((m / total) * (W - PAD * 2));

  const todayMonth = Math.min(
    (new Date().getFullYear() - 2024) * 12 + new Date().getMonth(),
    total,
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {/* Background track */}
      <rect x={PAD} y={barY} width={W - PAD * 2} height={barH} rx={4} fill={C.muted + "44"} />

      {/* Elapsed progress */}
      <rect
        x={PAD}
        y={barY}
        width={Math.max(0, xOf(todayMonth) - PAD)}
        height={barH}
        rx={4}
        fill={C.blue + "66"}
      />

      {/* Extra payoff fill */}
      {hasExtra && (
        <rect
          x={xOf(payoffMonthExtra)}
          y={barY - 2}
          width={xOf(payoffMonthBase) - xOf(payoffMonthExtra)}
          height={barH + 4}
          rx={3}
          fill={C.accent + "22"}
        />
      )}

      {/* PMI cutoff markers */}
      {hasPmi && pmiCutoffBase > 0 && (
        <>
          <line
            x1={xOf(pmiCutoffBase)}
            y1={barY - 6}
            x2={xOf(pmiCutoffBase)}
            y2={barY + barH + 6}
            stroke={C.orange}
            strokeWidth={1.5}
            strokeDasharray="3,2"
          />
          <text x={xOf(pmiCutoffBase)} y={barY - 9} textAnchor="middle" fill={C.orange} fontSize={7} fontFamily={mono}>
            PMI off
          </text>
        </>
      )}

      {hasPmi && hasExtra && pmiCutoffExtra > 0 && pmiCutoffExtra !== pmiCutoffBase && (
        <>
          <line
            x1={xOf(pmiCutoffExtra)}
            y1={barY - 6}
            x2={xOf(pmiCutoffExtra)}
            y2={barY + barH + 6}
            stroke={C.accent}
            strokeWidth={1.5}
            strokeDasharray="3,2"
          />
          <text x={xOf(pmiCutoffExtra)} y={barY - 9} textAnchor="middle" fill={C.accent} fontSize={7} fontFamily={mono}>
            PMI+X
          </text>
        </>
      )}

      {/* Today marker */}
      {todayMonth > 0 && (
        <>
          <line
            x1={xOf(todayMonth)}
            y1={barY - 4}
            x2={xOf(todayMonth)}
            y2={barY + barH + 16}
            stroke={C.blue}
            strokeWidth={1.5}
          />
          <text x={xOf(todayMonth)} y={barY + barH + 24} textAnchor="middle" fill={C.blue} fontSize={7} fontFamily={mono}>
            Today
          </text>
        </>
      )}

      {/* Normal payoff end */}
      <circle cx={xOf(payoffMonthBase)} cy={barY + barH / 2} r={5} fill={C.muted} />
      <text x={xOf(payoffMonthBase)} y={barY + barH + 24} textAnchor="end" fill={C.muted} fontSize={7} fontFamily={mono}>
        Mo {payoffMonthBase}
      </text>

      {/* Accelerated payoff end */}
      {hasExtra && payoffMonthExtra < payoffMonthBase && (
        <>
          <circle cx={xOf(payoffMonthExtra)} cy={barY + barH / 2} r={5} fill={C.accent} />
          <text x={xOf(payoffMonthExtra)} y={barY + barH + 24} textAnchor="middle" fill={C.accent} fontSize={7} fontFamily={mono}>
            Mo {payoffMonthExtra}
          </text>
        </>
      )}

      {/* Start label */}
      <text x={PAD} y={barY + barH + 24} textAnchor="start" fill={C.muted} fontSize={7} fontFamily={mono}>
        Start
      </text>
    </svg>
  );
}

// ─── Refi Breakeven SVG Chart ─────────────────────────────────────────────────

function RefiBreakevenChart({
  monthlySavings,
  refiCosts,
  breakevenMonths,
}: {
  monthlySavings:  number;
  refiCosts:       number;
  breakevenMonths: number;
}) {
  const W   = 520;
  const H   = 120;
  const PAD = { top: 16, right: 24, bottom: 28, left: 52 };

  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  if (monthlySavings <= 0 || !isFinite(breakevenMonths)) {
    return (
      <div style={{ padding: "16px 0", textAlign: "center", fontSize: 11, color: C.muted, fontFamily: sans }}>
        {monthlySavings <= 0
          ? "No monthly savings — breakeven chart not applicable."
          : "Breakeven period is infinite — refinancing does not recoup closing costs."}
      </div>
    );
  }

  const maxMonths = Math.ceil(breakevenMonths * 2);
  const maxSavings = monthlySavings * maxMonths;

  const xOf = (m: number) => PAD.left + (m / maxMonths) * chartW;
  const yOf = (v: number) => PAD.top + chartH - (v / (maxSavings || 1)) * chartH;

  // Build cumulative savings polyline points
  const points: string[] = [];
  for (let m = 0; m <= maxMonths; m += Math.max(1, Math.floor(maxMonths / 60))) {
    points.push(`${xOf(m).toFixed(1)},${yOf(monthlySavings * m).toFixed(1)}`);
  }
  // Ensure last point is included
  points.push(`${xOf(maxMonths).toFixed(1)},${yOf(maxSavings).toFixed(1)}`);

  const breakevenY = yOf(refiCosts);
  const breakevenX = xOf(breakevenMonths);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* Axes */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH} stroke={C.border} strokeWidth={1} />
      <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH} stroke={C.border} strokeWidth={1} />

      {/* Closing cost horizontal line */}
      <line
        x1={PAD.left}
        y1={breakevenY}
        x2={PAD.left + chartW}
        y2={breakevenY}
        stroke={C.orange}
        strokeWidth={1}
        strokeDasharray="4,3"
      />
      <text x={PAD.left - 4} y={breakevenY + 3} textAnchor="end" fill={C.orange} fontSize={7} fontFamily={mono}>
        {fmtK(refiCosts)}
      </text>

      {/* Cumulative savings line */}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={C.accent}
        strokeWidth={2}
      />

      {/* Area fill under curve */}
      <polygon
        points={`${xOf(0)},${yOf(0)} ${points.join(" ")} ${xOf(maxMonths)},${PAD.top + chartH}`}
        fill={C.accent + "18"}
      />

      {/* Breakeven marker */}
      <circle cx={breakevenX} cy={breakevenY} r={4} fill={C.gold} />
      <line
        x1={breakevenX}
        y1={PAD.top}
        x2={breakevenX}
        y2={PAD.top + chartH}
        stroke={C.gold}
        strokeWidth={1}
        strokeDasharray="3,2"
      />

      {/* Breakeven label */}
      <text
        x={Math.min(breakevenX + 4, PAD.left + chartW - 40)}
        y={PAD.top + 10}
        fill={C.gold}
        fontSize={8}
        fontFamily={mono}
      >
        {Math.ceil(breakevenMonths)} mo
      </text>

      {/* X-axis labels */}
      {[0, Math.floor(maxMonths / 2), maxMonths].map((m) => (
        <text key={m} x={xOf(m)} y={H - 6} textAnchor="middle" fill={C.muted} fontSize={7} fontFamily={mono}>
          {m}mo
        </text>
      ))}

      {/* Y-axis label */}
      <text
        x={8}
        y={PAD.top + chartH / 2}
        fill={C.muted}
        fontSize={7}
        fontFamily={mono}
        transform={`rotate(-90, 8, ${PAD.top + chartH / 2})`}
        textAnchor="middle"
      >
        Savings
      </text>
    </svg>
  );
}
