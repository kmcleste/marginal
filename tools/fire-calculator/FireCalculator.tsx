"use client";

import { useState, useMemo } from "react";
import { colors as T, fonts } from "@marginal/theme";

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:          T.bg.base,
  surface:     T.bg.surface,
  surfaceAlt:  T.bg.elevated,
  border:      T.bg.border,
  borderBright:T.bg.borderSubtle,
  accent:      T.mint.DEFAULT,
  accentDim:   T.mint.bg,
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

const fmt  = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const fmtK = (n: number) => Math.abs(n) >= 1000 ? `$${((n || 0) / 1000).toFixed(Math.abs(n) >= 100000 ? 0 : 1)}k` : fmt(n);
const pct  = (n: number) => `${((n || 0) * 100).toFixed(1)}%`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjYear {
  age: number;
  portfolio: number;
  fiProgress: number;
  contributions: number;
  growth: number;
  isCoastFI: boolean;
  isFI: boolean;
}

interface RetirYear {
  age: number;
  portfolio: number;
  withdrawal: number;
  ssIncome: number;
  depleted: boolean;
}

interface SwrRow {
  swr: number;
  fiNumber: number;
  monthlyIncome: number;
  yearsSustainable: number | null; // null = survives to lifeExp
}

interface SeqScenario {
  label: string;
  color: string;
  years: RetirYear[];
  depletedAge: number | null;
}

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
    <Card style={{ padding: "12px 14px" }} goldGlow={goldGlow === true}>
      <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, color, fontFamily: mono, fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, marginTop: 3 }}>{sub}</div>}
    </Card>
  );
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function fvWithContribs(currentNW: number, annualSavings: number, r: number, n: number): number {
  if (r === 0) return currentNW + annualSavings * n;
  return currentNW * Math.pow(1 + r, n) + annualSavings * (Math.pow(1 + r, n) - 1) / r;
}

function yearsToFI(
  currentNW: number,
  annualSavings: number,
  r: number,
  target: number,
): number | null {
  if (currentNW >= target) return 0;
  if (annualSavings <= 0) return null;
  // Binary search: find n such that FV(n) >= target
  let lo = 0, hi = 200;
  // Check if achievable in range
  if (fvWithContribs(currentNW, annualSavings, r, hi) < target) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (fvWithContribs(currentNW, annualSavings, r, mid) < target) lo = mid;
    else hi = mid;
    if (hi - lo < 0.01) break;
  }
  return (lo + hi) / 2;
}

function simulateRetirement(
  startPortfolio: number,
  annualSpend: number,
  ssAnnual: number,
  ssClaimAge: number,
  startAge: number,
  endAge: number,
  inflationRate: number,
  yearlyReturns: (age: number, idx: number) => number,
): RetirYear[] {
  const result: RetirYear[] = [];
  let portfolio = startPortfolio;
  let depleted = false;

  for (let age = startAge; age <= endAge; age++) {
    const idx = age - startAge;
    const inflFactor = Math.pow(1 + inflationRate / 100, idx);
    const targetSpend = annualSpend * inflFactor;
    const ssIncome = age >= ssClaimAge ? ssAnnual * inflFactor : 0;
    const withdrawal = Math.max(0, targetSpend - ssIncome);

    if (depleted) {
      result.push({ age, portfolio: 0, withdrawal, ssIncome, depleted: true });
      continue;
    }

    const r = yearlyReturns(age, idx);
    portfolio = portfolio * (1 + r / 100) - withdrawal;

    if (portfolio <= 0) {
      depleted = true;
      portfolio = 0;
    }

    result.push({ age, portfolio, withdrawal, ssIncome, depleted });
  }

  return result;
}

// ─── SVG chart helpers ────────────────────────────────────────────────────────

function toSvgX(val: number, min: number, max: number, w: number, pad: number): number {
  return pad + ((val - min) / (max - min || 1)) * (w - pad * 2);
}

function toSvgY(val: number, min: number, max: number, h: number, padTop: number, padBot: number): number {
  return h - padBot - ((val - min) / (max - min || 1)) * (h - padTop - padBot);
}

// ─── Tab components ───────────────────────────────────────────────────────────

interface SharedCalcResults {
  fiNumber: number;
  fiProgress: number;
  coastFiAmount: number;
  coastProgress: number;
  yearsToFIVal: number | null;
  yearsToCoastVal: number | null;
  fiAge: number;
  coastFiAge: number;
  accumProjYears: ProjYear[];
  swrRows: SwrRow[];
  retirYears: RetirYear[];
  seqScenarios: SeqScenario[];
}

// ─── Accumulation Chart ───────────────────────────────────────────────────────

function AccumulationChart({
  projYears,
  fiNumber,
  coastFiAmount,
  retireAge,
  lifeExp,
  retirYears,
  postRetireReturn,
  annualSpend,
  ssAnnual,
  ssClaimAge,
  inflationRate,
}: {
  projYears: ProjYear[];
  fiNumber: number;
  coastFiAmount: number;
  retireAge: number;
  lifeExp: number;
  retirYears: RetirYear[];
  postRetireReturn: number;
  annualSpend: number;
  ssAnnual: number;
  ssClaimAge: number;
  inflationRate: number;
}) {
  const W = 520, H = 220, PL = 54, PR = 16, PT = 18, PB = 30;

  const allPortfolios = [
    ...projYears.map(y => y.portfolio),
    ...retirYears.map(y => y.portfolio),
    fiNumber,
    coastFiAmount,
  ];
  const maxP = Math.max(...allPortfolios) * 1.08;
  const minAge = projYears[0]?.age ?? retireAge;
  const maxAge = lifeExp;

  const px = (age: number) => toSvgX(age, minAge, maxAge, W, PL);
  const py = (val: number) => toSvgY(val, 0, maxP, H, PT, PB);

  // Build accumulation path
  const accumPath = projYears
    .map((y, i) => `${i === 0 ? "M" : "L"}${px(y.age).toFixed(1)},${py(y.portfolio).toFixed(1)}`)
    .join(" ");

  // Build retirement path
  const retirPath = retirYears
    .map((y, i) => `${i === 0 ? "M" : "L"}${px(y.age).toFixed(1)},${py(y.portfolio).toFixed(1)}`)
    .join(" ");

  // FI crossover
  const fiCrossYear = projYears.find(y => y.isFI);
  const coastCrossYear = projYears.find(y => y.isCoastFI);

  // Y-axis ticks
  const yTicks = Array.from({ length: 5 }, (_, i) => (maxP / 4) * i);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
      {/* Grid lines */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PL} y1={py(v)} x2={W - PR} y2={py(v)} stroke={C.border} strokeWidth={0.5} />
          <text x={PL - 4} y={py(v) + 4} fill={C.mutedLight} fontSize={8} textAnchor="end" fontFamily={mono}>
            {fmtK(v)}
          </text>
        </g>
      ))}

      {/* FI target line */}
      <line x1={PL} y1={py(fiNumber)} x2={W - PR} y2={py(fiNumber)}
        stroke={C.accent} strokeWidth={1} strokeDasharray="5 3" opacity={0.7} />
      <text x={W - PR + 2} y={py(fiNumber) + 4} fill={C.accent} fontSize={8} fontFamily={mono}>FI</text>

      {/* Coast FI line */}
      {coastFiAmount > 0 && coastFiAmount < fiNumber && (
        <>
          <line x1={PL} y1={py(coastFiAmount)} x2={W - PR} y2={py(coastFiAmount)}
            stroke={C.blue} strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
          <text x={W - PR + 2} y={py(coastFiAmount) + 4} fill={C.blue} fontSize={8} fontFamily={mono}>Coast</text>
        </>
      )}

      {/* Retire age vertical line */}
      <line x1={px(retireAge)} y1={PT} x2={px(retireAge)} y2={H - PB}
        stroke={C.gold} strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
      <text x={px(retireAge)} y={H - PB + 14} fill={C.gold} fontSize={8} textAnchor="middle" fontFamily={mono}>Age {retireAge}</text>

      {/* Accumulation curve */}
      {accumPath && (
        <path d={accumPath} fill="none" stroke={C.accent} strokeWidth={2} />
      )}

      {/* Retirement curve */}
      {retirPath && (
        <path d={retirPath} fill="none" stroke={C.gold} strokeWidth={2} />
      )}

      {/* FI crossover dot */}
      {fiCrossYear && (
        <circle cx={px(fiCrossYear.age)} cy={py(fiCrossYear.portfolio)} r={4}
          fill={C.accent} stroke={C.bg} strokeWidth={2} />
      )}

      {/* Coast FI crossover dot */}
      {coastCrossYear && (
        <circle cx={px(coastCrossYear.age)} cy={py(coastCrossYear.portfolio)} r={3}
          fill={C.blue} stroke={C.bg} strokeWidth={2} />
      )}

      {/* X-axis age labels */}
      {Array.from({ length: Math.floor((maxAge - minAge) / 5) + 1 }, (_, i) => minAge + i * 5)
        .filter(age => age <= maxAge)
        .map(age => (
          <text key={age} x={px(age)} y={H - PB + 14} fill={C.mutedLight} fontSize={8}
            textAnchor="middle" fontFamily={mono}>{age}</text>
        ))}
    </svg>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({
  currentAge, setCurrentAge, retireAge, setRetireAge, lifeExp, setLifeExp,
  currentNW, setCurrentNW, annualSavings, setAnnualSavings, annualSpend, setAnnualSpend,
  preRetireReturn, setPreRetireReturn, postRetireReturn, setPostRetireReturn,
  inflationRate, setInflationRate, swr, setSwr,
  ssAnnual, setSsAnnual, ssClaimAge, setSsClaimAge,
  calc,
}: {
  currentAge: number; setCurrentAge: (v: number) => void;
  retireAge: number; setRetireAge: (v: number) => void;
  lifeExp: number; setLifeExp: (v: number) => void;
  currentNW: number; setCurrentNW: (v: number) => void;
  annualSavings: number; setAnnualSavings: (v: number) => void;
  annualSpend: number; setAnnualSpend: (v: number) => void;
  preRetireReturn: number; setPreRetireReturn: (v: number) => void;
  postRetireReturn: number; setPostRetireReturn: (v: number) => void;
  inflationRate: number; setInflationRate: (v: number) => void;
  swr: number; setSwr: (v: number) => void;
  ssAnnual: number; setSsAnnual: (v: number) => void;
  ssClaimAge: number; setSsClaimAge: (v: number) => void;
  calc: SharedCalcResults;
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <div className="co-grid-lt" style={{ gap: 20 }}>
      {/* ── Left: Controls ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: 600 }}>Your Profile</div>
          <Sl label="Current Age" value={currentAge} min={18} max={70} step={1}
            onChange={v => setCurrentAge(Math.min(v, retireAge - 1))} color={C.blue}
            fmt={v => `${v}`} />
          <Sl label="Target Retire Age" value={retireAge} min={currentAge + 1} max={80} step={1}
            onChange={v => setRetireAge(Math.max(v, currentAge + 1))} color={C.gold}
            fmt={v => `${v}`} hint={`${retireAge - currentAge} years to retirement`} />
          <Sl label="Life Expectancy" value={lifeExp} min={retireAge + 5} max={110} step={1}
            onChange={setLifeExp} color={C.purple} fmt={v => `${v}`}
            hint={`${lifeExp - retireAge} retirement years to fund`} />
        </Card>

        <Card>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: 600 }}>Wealth</div>
          <Sl label="Current Portfolio" value={currentNW} min={0} max={5000000} step={10000}
            onChange={setCurrentNW} color={C.accent} />
          <Sl label="Annual Savings" value={annualSavings} min={0} max={500000} step={5000}
            onChange={setAnnualSavings} color={C.accent}
            hint={`${fmt(annualSavings / 12)}/mo`} />
          <Sl label="Retirement Annual Spend" value={annualSpend} min={20000} max={500000} step={5000}
            onChange={setAnnualSpend} color={C.gold} hint={`${fmt(annualSpend / 12)}/mo`} />
        </Card>

        <Card>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: 600 }}>Returns</div>
          <Sl label="Pre-Retirement Return" value={preRetireReturn} min={1} max={15} step={0.5}
            onChange={setPreRetireReturn} color={C.blue} fmt={v => `${v}%`}
            hint="Annual nominal return during accumulation" />
          <Sl label="Post-Retirement Return" value={postRetireReturn} min={1} max={12} step={0.5}
            onChange={setPostRetireReturn} color={C.purple} fmt={v => `${v}%`}
            hint="Conservative return during withdrawal" />
          <Sl label="Inflation Rate" value={inflationRate} min={0} max={8} step={0.25}
            onChange={setInflationRate} color={C.orange} fmt={v => `${v}%`} />
          <Sl label="Safe Withdrawal Rate" value={swr} min={2} max={6} step={0.25}
            onChange={setSwr} color={C.gold} fmt={v => `${v}%`}
            hint="Trinity Study: 4% for 30-yr horizons" />
        </Card>

        <Card>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: 600 }}>Social Security</div>
          <Sl label="Annual SS Benefit" value={ssAnnual} min={0} max={60000} step={1000}
            onChange={setSsAnnual} color={C.blue} hint="Estimated annual benefit at claim age" />
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Claim Age</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[62, 67, 70].map(age => (
                <button key={age} onClick={() => setSsClaimAge(age)} style={{
                  flex: 1, padding: "6px 0", background: ssClaimAge === age ? C.blue + "22" : "transparent",
                  border: `1px solid ${ssClaimAge === age ? C.blue : C.border}`,
                  borderRadius: 6, color: ssClaimAge === age ? C.blue : C.mutedLight,
                  fontFamily: mono, fontSize: 12, cursor: "pointer",
                }}>
                  {age}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Right: Results ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* FI Number hero */}
        <Card glow>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em" }}>FI Number (4% Rule)</div>
              <div style={{ fontSize: 36, color: C.accent, fontFamily: mono, fontWeight: 700, lineHeight: 1 }}>{fmt(calc.fiNumber)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <Tag color={C.accent}>{pct(calc.fiProgress)} there</Tag>
              <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, marginTop: 4 }}>
                {fmt(currentNW)} / {fmt(calc.fiNumber)}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 12, background: C.muted + "33", borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
            <div style={{
              height: "100%", width: `${calc.fiProgress * 100}%`,
              background: `linear-gradient(90deg, ${C.blue}, ${C.accent})`,
              borderRadius: 6, transition: "width 0.4s",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted, fontFamily: mono }}>
            <span>$0</span>
            <span style={{ color: C.accent }}>{pct(calc.fiProgress)} there</span>
            <span>{fmtK(calc.fiNumber)} FI</span>
          </div>
        </Card>

        {/* KPI grid row 1 */}
        <div className="co-grid-3">
          <KpiCard label="FI Number" value={fmtK(calc.fiNumber)} sub={`${swr}% SWR`} color={C.accent} />
          <KpiCard label="Current Portfolio" value={fmtK(currentNW)} sub="Net worth" color={C.blue} />
          <KpiCard label="Gap to FI" value={fmtK(Math.max(0, calc.fiNumber - currentNW))}
            sub={currentNW >= calc.fiNumber ? "Already FI!" : "remaining"} color={C.orange} />
        </div>

        {/* KPI grid row 2 */}
        <div className="co-grid-3">
          <KpiCard label="FI Age"
            value={calc.yearsToFIVal === null ? "Never" : `${Math.min(calc.fiAge, 99)}`}
            sub={calc.yearsToFIVal === null ? "Increase savings" : `at ${swr}% SWR`}
            color={calc.yearsToFIVal === null ? C.red : C.gold} goldGlow={calc.yearsToFIVal !== null && calc.fiAge <= retireAge} />
          <KpiCard label="Years Away"
            value={calc.yearsToFIVal === null ? "∞" : `${Math.ceil(calc.yearsToFIVal)}`}
            sub={calc.yearsToFIVal === null ? "Adjust inputs" : "to financial independence"}
            color={C.purple} />
          <KpiCard label="Monthly Spend"
            value={fmtK(annualSpend / 12)}
            sub={`${fmtK(ssAnnual / 12)} SS offset`}
            color={C.textDim} />
        </div>

        {/* Chart */}
        <Card style={{ padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: C.textDim, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em" }}>Portfolio Projection</span>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ fontSize: 9, color: C.accent, fontFamily: mono }}>── Accumulation</span>
              <span style={{ fontSize: 9, color: C.gold, fontFamily: mono }}>── Retirement</span>
              <span style={{ fontSize: 9, color: C.accent, fontFamily: mono, opacity: 0.6 }}>- - FI Target</span>
              <span style={{ fontSize: 9, color: C.blue, fontFamily: mono, opacity: 0.6 }}>- - Coast FI</span>
            </div>
          </div>
          <AccumulationChart
            projYears={calc.accumProjYears}
            fiNumber={calc.fiNumber}
            coastFiAmount={calc.coastFiAmount}
            retireAge={retireAge}
            lifeExp={lifeExp}
            retirYears={calc.retirYears}
            postRetireReturn={postRetireReturn}
            annualSpend={annualSpend}
            ssAnnual={ssAnnual}
            ssClaimAge={ssClaimAge}
            inflationRate={inflationRate}
          />
        </Card>

        {/* Year-by-year table toggle */}
        <div>
          <button onClick={() => setShowTable(t => !t)} style={{
            background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6,
            color: C.mutedLight, fontFamily: mono, fontSize: 10, padding: "6px 12px",
            cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            {showTable ? "Hide" : "Show"} Year-by-Year Table
          </button>

          {showTable && (
            <Card style={{ marginTop: 12, padding: 0 }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["Age", "Portfolio", "Progress", "Contributions", "Growth", "Status"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "right", color: C.mutedLight, fontWeight: 400, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calc.accumProjYears.map((y, i) => (
                      <tr key={i} style={{
                        borderBottom: `1px solid ${C.border}22`,
                        background: y.isFI ? C.accent + "08" : y.isCoastFI ? C.blue + "08" : "transparent",
                      }}>
                        <td style={{ padding: "6px 12px", textAlign: "right", color: C.text }}>{y.age}</td>
                        <td style={{ padding: "6px 12px", textAlign: "right", color: C.accent }}>{fmtK(y.portfolio)}</td>
                        <td style={{ padding: "6px 12px", textAlign: "right", color: C.textDim }}>{pct(y.fiProgress)}</td>
                        <td style={{ padding: "6px 12px", textAlign: "right", color: C.blue }}>{fmtK(y.contributions)}</td>
                        <td style={{ padding: "6px 12px", textAlign: "right", color: C.gold }}>{fmtK(y.growth)}</td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {y.isFI ? <Tag color={C.accent}>FI</Tag>
                            : y.isCoastFI ? <Tag color={C.blue}>Coast</Tag>
                              : <span style={{ color: C.muted }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Coast FI Tab ─────────────────────────────────────────────────────────────

function CoastFITab({
  currentAge, retireAge, lifeExp, currentNW, annualSavings,
  annualSpend, preRetireReturn, postRetireReturn, inflationRate,
  ssAnnual, ssClaimAge, calc,
}: {
  currentAge: number; retireAge: number; lifeExp: number;
  currentNW: number; annualSavings: number; annualSpend: number;
  preRetireReturn: number; postRetireReturn: number; inflationRate: number;
  ssAnnual: number; ssClaimAge: number; calc: SharedCalcResults;
}) {
  const r = preRetireReturn / 100;

  // Coast FI at different retire ages
  const coastAtRetireAges = useMemo(() => {
    return [45, 50, 55, 60, 65].map(age => {
      if (age <= currentAge) return null;
      const yrs = age - currentAge;
      const coastAmt = calc.fiNumber / Math.pow(1 + r, yrs);
      const yrsToCoast = yearsToFI(currentNW, annualSavings, r, coastAmt);
      const coastAge = yrsToCoast === null ? null : Math.round(currentAge + yrsToCoast);
      return { age, coastAmt, coastAge, yrsToCoast };
    });
  }, [calc.fiNumber, r, currentAge, currentNW, annualSavings]);

  const alreadyCoastFI = currentNW >= calc.coastFiAmount;

  // Full lifecycle projection for chart
  const fullProjection = useMemo(() => {
    const result: { age: number; portfolio: number; phase: "accum" | "coast" | "retire" }[] = [];
    let portfolio = currentNW;
    let coastHit = alreadyCoastFI;

    for (let age = currentAge; age <= lifeExp; age++) {
      const isRetire = age >= retireAge;
      if (!coastHit && portfolio >= calc.coastFiAmount) coastHit = true;

      if (isRetire) {
        const idx = age - retireAge;
        const inflFactor = Math.pow(1 + inflationRate / 100, idx);
        const ssIncome = age >= ssClaimAge ? ssAnnual * inflFactor : 0;
        const withdrawal = Math.max(0, annualSpend * inflFactor - ssIncome);
        portfolio = Math.max(0, portfolio * (1 + postRetireReturn / 100) - withdrawal);
        result.push({ age, portfolio, phase: "retire" });
      } else if (coastHit) {
        portfolio = portfolio * (1 + r);
        result.push({ age, portfolio, phase: "coast" });
      } else {
        const growth = portfolio * r;
        portfolio = portfolio + growth + annualSavings;
        result.push({ age, portfolio, phase: "accum" });
      }
    }
    return result;
  }, [currentAge, currentNW, retireAge, lifeExp, calc.coastFiAmount, calc.fiNumber, r, postRetireReturn, inflationRate, annualSpend, ssAnnual, ssClaimAge, alreadyCoastFI, annualSavings]);

  // Chart
  const W = 460, H = 200, PL = 54, PR = 20, PT = 14, PB = 28;
  const maxP = Math.max(...fullProjection.map(y => y.portfolio), calc.fiNumber) * 1.08;
  const minAge = currentAge, maxAge = lifeExp;
  const px = (age: number) => toSvgX(age, minAge, maxAge, W, PL);
  const py = (val: number) => toSvgY(val, 0, maxP, H, PT, PB);

  const accumPts = fullProjection.filter(y => y.phase === "accum");
  const coastPts = fullProjection.filter(y => y.phase === "coast");
  const retirePts = fullProjection.filter(y => y.phase === "retire");
  const toPath = (pts: typeof fullProjection) =>
    pts.map((y, i) => `${i === 0 ? "M" : "L"}${px(y.age).toFixed(1)},${py(y.portfolio).toFixed(1)}`).join(" ");

  // Connect coast to accum
  const lastAccum = accumPts[accumPts.length - 1];
  const firstCoast = coastPts[0];
  const lastCoast = coastPts[coastPts.length - 1];
  const firstRetire = retirePts[0];

  const accumPath2 = toPath(accumPts);
  const coastPath = firstCoast && lastAccum
    ? `M${px(lastAccum.age).toFixed(1)},${py(lastAccum.portfolio).toFixed(1)} ` + toPath(coastPts).replace("M", "L")
    : toPath(coastPts);
  const retirPath2 = lastCoast && firstRetire
    ? `M${px(lastCoast.age).toFixed(1)},${py(lastCoast.portfolio).toFixed(1)} ` + toPath(retirePts).replace("M", "L")
    : toPath(retirePts);

  const yTicks = Array.from({ length: 5 }, (_, i) => (maxP / 4) * i);

  return (
    <div className="co-grid-2" style={{ gap: 20 }}>
      {/* Left */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card>
          <div style={{ fontSize: 11, color: C.blue, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>What is Coast FI?</div>
          <p style={{ fontSize: 12, color: C.textDim, fontFamily: sans, lineHeight: 1.6, marginBottom: 10 }}>
            Coast FI is the point where your portfolio is large enough that — even with zero additional contributions —
            it will compound to your full FI number by retirement age. Once you hit Coast FI, you only need to cover
            living expenses; you can stop saving.
          </p>
          <div style={{ background: C.blueDim, borderRadius: 8, padding: "10px 12px", fontFamily: mono, fontSize: 11, color: C.blue }}>
            <div style={{ marginBottom: 4 }}>Coast FI = FI Number ÷ (1 + r)^years</div>
            <div style={{ fontSize: 10, color: C.textDim }}>
              = {fmt(calc.fiNumber)} ÷ (1 + {preRetireReturn}%)^{retireAge - currentAge}
            </div>
          </div>
        </Card>

        {alreadyCoastFI ? (
          <Card glow>
            <div style={{ fontSize: 14, color: C.accent, fontFamily: mono, fontWeight: 700, marginBottom: 6 }}>
              You&apos;ve Hit Coast FI!
            </div>
            <p style={{ fontSize: 12, color: C.textDim, fontFamily: sans, lineHeight: 1.5 }}>
              Your current portfolio of {fmt(currentNW)} exceeds the Coast FI amount of {fmt(calc.coastFiAmount)}.
              Your money will grow to your FI number by age {retireAge} without any additional contributions.
            </p>
          </Card>
        ) : (
          <Card>
            <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Coast FI Amount</div>
            <div style={{ fontSize: 28, color: C.blue, fontFamily: mono, fontWeight: 700, marginBottom: 10 }}>{fmt(calc.coastFiAmount)}</div>

            {/* Coast FI progress bar */}
            <div style={{ height: 8, background: C.muted + "33", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
              <div style={{
                height: "100%", width: `${calc.coastProgress * 100}%`,
                background: `linear-gradient(90deg, ${C.blue}88, ${C.blue})`,
                borderRadius: 4, transition: "width 0.4s",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted, fontFamily: mono, marginBottom: 12 }}>
              <span>$0</span>
              <span style={{ color: C.blue }}>{pct(calc.coastProgress)} there</span>
              <span>{fmtK(calc.coastFiAmount)}</span>
            </div>

            <div style={{ display: "flex", gap: 16 }}>
              <div>
                <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase" }}>Time to Coast FI</div>
                <div style={{ fontSize: 16, color: C.blue, fontFamily: mono, fontWeight: 600 }}>
                  {calc.yearsToCoastVal === null ? "∞" : `${Math.ceil(calc.yearsToCoastVal)} yrs`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase" }}>Coast FI Age</div>
                <div style={{ fontSize: 16, color: C.blue, fontFamily: mono, fontWeight: 600 }}>
                  {calc.yearsToCoastVal === null ? "—" : `${Math.round(calc.coastFiAge)}`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase" }}>Gap</div>
                <div style={{ fontSize: 16, color: C.orange, fontFamily: mono, fontWeight: 600 }}>
                  {fmtK(Math.max(0, calc.coastFiAmount - currentNW))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Coast FI at different retire ages */}
        <Card>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>Coast FI by Retire Age</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Retire", "Coast FI Amount", "Coast Age"].map(h => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "right", color: C.mutedLight, fontWeight: 400, fontSize: 9, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coastAtRetireAges.map((row, i) => {
                if (!row) return null;
                const isCurrent = row.age === retireAge;
                return (
                  <tr key={i} style={{
                    borderBottom: `1px solid ${C.border}22`,
                    background: isCurrent ? C.blue + "0d" : "transparent",
                  }}>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: isCurrent ? C.blue : C.text }}>
                      {row.age} {isCurrent && <Tag color={C.blue}>current</Tag>}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: C.blue }}>{fmt(row.coastAmt)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: row.yrsToCoast === null ? C.red : C.accent }}>
                      {row.coastAge === null ? "Never" : row.coastAge <= currentAge ? "Now!" : `${row.coastAge}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Right: chart */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card style={{ padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: C.textDim, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em" }}>Full Lifecycle Projection</span>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, color: C.accent, fontFamily: mono }}>── Accumulating</span>
              <span style={{ fontSize: 9, color: C.blue, fontFamily: mono }}>── Coasting</span>
              <span style={{ fontSize: 9, color: C.gold, fontFamily: mono }}>── Retirement</span>
            </div>
          </div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
            {yTicks.map((v, i) => (
              <g key={i}>
                <line x1={PL} y1={py(v)} x2={W - PR} y2={py(v)} stroke={C.border} strokeWidth={0.5} />
                <text x={PL - 4} y={py(v) + 4} fill={C.mutedLight} fontSize={8} textAnchor="end" fontFamily={mono}>{fmtK(v)}</text>
              </g>
            ))}
            {/* FI line */}
            <line x1={PL} y1={py(calc.fiNumber)} x2={W - PR} y2={py(calc.fiNumber)}
              stroke={C.accent} strokeWidth={1} strokeDasharray="5 3" opacity={0.6} />
            <text x={W - PR + 2} y={py(calc.fiNumber) + 4} fill={C.accent} fontSize={8} fontFamily={mono}>FI</text>
            {/* Coast FI line */}
            {!alreadyCoastFI && (
              <>
                <line x1={PL} y1={py(calc.coastFiAmount)} x2={W - PR} y2={py(calc.coastFiAmount)}
                  stroke={C.blue} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
                <text x={W - PR + 2} y={py(calc.coastFiAmount) + 4} fill={C.blue} fontSize={8} fontFamily={mono}>Coast</text>
              </>
            )}
            {/* Retire vertical */}
            <line x1={px(retireAge)} y1={PT} x2={px(retireAge)} y2={H - PB}
              stroke={C.gold} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
            {/* Paths */}
            {accumPath2 && <path d={accumPath2} fill="none" stroke={C.accent} strokeWidth={2} />}
            {coastPath && coastPts.length > 0 && <path d={coastPath} fill="none" stroke={C.blue} strokeWidth={2} />}
            {retirPath2 && retirePts.length > 0 && <path d={retirPath2} fill="none" stroke={C.gold} strokeWidth={2} />}
            {/* X-axis */}
            {Array.from({ length: Math.floor((maxAge - minAge) / 5) + 1 }, (_, i) => minAge + i * 5)
              .filter(age => age <= maxAge)
              .map(age => (
                <text key={age} x={px(age)} y={H - PB + 14} fill={C.mutedLight} fontSize={8}
                  textAnchor="middle" fontFamily={mono}>{age}</text>
              ))}
          </svg>
        </Card>

        <Card>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>Three Phases of Coast FI</div>
          {[
            { phase: "Phase 1: Accumulation", color: C.accent, desc: "Saving aggressively — portfolio grows from contributions + compound growth." },
            { phase: "Phase 2: Coasting", color: C.blue, desc: "Zero new contributions needed — compound interest alone carries you to FI number." },
            { phase: "Phase 3: Retirement", color: C.gold, desc: "Withdrawing from portfolio, offset by Social Security income." },
          ].map(({ phase, color, desc }) => (
            <div key={phase} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 3, flexShrink: 0, background: color, borderRadius: 2 }} />
              <div>
                <div style={{ fontSize: 11, color, fontFamily: mono, fontWeight: 600, marginBottom: 2 }}>{phase}</div>
                <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans }}>{desc}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── SWR Analysis Tab ─────────────────────────────────────────────────────────

function SWRTab({
  swr, setSwr, postRetireReturn, setPostRetireReturn,
  inflationRate, setInflationRate, annualSpend, retireAge, lifeExp,
  currentNW, currentAge, ssAnnual, ssClaimAge, calc,
}: {
  swr: number; setSwr: (v: number) => void;
  postRetireReturn: number; setPostRetireReturn: (v: number) => void;
  inflationRate: number; setInflationRate: (v: number) => void;
  annualSpend: number; retireAge: number; lifeExp: number;
  currentNW: number; currentAge: number;
  ssAnnual: number; ssClaimAge: number;
  calc: SharedCalcResults;
}) {
  const W = 460, H = 200, PL = 54, PR = 20, PT = 14, PB = 28;

  // Simulate retirement at 3%, 4%, 5% SWRs
  const swrCurves = useMemo(() => {
    return [3, 4, 5].map(s => {
      const fiN = annualSpend / (s / 100);
      const startPortfolio = fiN;
      const years: { age: number; portfolio: number }[] = [];
      let p = startPortfolio;
      let depleted = false;
      for (let age = retireAge; age <= lifeExp; age++) {
        const idx = age - retireAge;
        const inflFactor = Math.pow(1 + inflationRate / 100, idx);
        const ssInc = age >= ssClaimAge ? ssAnnual * inflFactor : 0;
        const w = Math.max(0, annualSpend * inflFactor - ssInc);
        if (!depleted) {
          p = p * (1 + postRetireReturn / 100) - w;
          if (p <= 0) { p = 0; depleted = true; }
        }
        years.push({ age, portfolio: p });
      }
      return { swr: s, years, depleted };
    });
  }, [annualSpend, retireAge, lifeExp, inflationRate, ssAnnual, ssClaimAge, postRetireReturn]);

  const maxP = Math.max(...swrCurves.flatMap(c => c.years.map(y => y.portfolio))) * 1.08;
  const minAge = retireAge, maxAge = lifeExp;
  const px = (age: number) => toSvgX(age, minAge, maxAge, W, PL);
  const py = (val: number) => toSvgY(val, 0, maxP, H, PT, PB);
  const swrColors = [C.accent, C.gold, C.orange];
  const yTicks = Array.from({ length: 5 }, (_, i) => (maxP / 4) * i);

  // Real vs nominal spending
  const nominalSpend = annualSpend;
  const realSpend20 = annualSpend * Math.pow(1 + inflationRate / 100, 20);
  const realSpend30 = annualSpend * Math.pow(1 + inflationRate / 100, 30);

  return (
    <div className="co-grid-2" style={{ gap: 20 }}>
      {/* Left */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: 600 }}>SWR Inputs</div>
          <Sl label="Safe Withdrawal Rate" value={swr} min={2.5} max={6} step={0.25}
            onChange={setSwr} color={C.gold} fmt={v => `${v}%`} />
          <Sl label="Post-Retirement Return" value={postRetireReturn} min={1} max={12} step={0.5}
            onChange={setPostRetireReturn} color={C.blue} fmt={v => `${v}%`} />
          <Sl label="Inflation Rate" value={inflationRate} min={0} max={8} step={0.25}
            onChange={setInflationRate} color={C.orange} fmt={v => `${v}%`} />

          <div style={{ background: C.accentDim, borderRadius: 8, padding: "10px 12px", marginTop: 4 }}>
            <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", marginBottom: 4 }}>At {swr}% SWR</div>
            <div style={{ fontSize: 22, color: C.accent, fontFamily: mono, fontWeight: 700 }}>{fmt(calc.fiNumber)}</div>
            <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, marginTop: 2 }}>
              {fmt(annualSpend / 12)}/mo spending power
            </div>
          </div>
        </Card>

        {/* SWR sensitivity table */}
        <Card>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>SWR Sensitivity</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["SWR", "FI Number", "Monthly Income", "Years Sustainable"].map(h => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "right", color: C.mutedLight, fontWeight: 400, fontSize: 9, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calc.swrRows.map((row, i) => {
                const isCurrent = Math.abs(row.swr - swr) < 0.01;
                return (
                  <tr key={i} style={{
                    borderBottom: `1px solid ${C.border}22`,
                    background: isCurrent ? C.gold + "0d" : "transparent",
                  }}>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: isCurrent ? C.gold : C.text }}>
                      {row.swr}% {isCurrent && <Tag color={C.gold}>you</Tag>}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: C.accent }}>{fmt(row.fiNumber)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: C.blue }}>{fmt(row.monthlyIncome)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: row.yearsSustainable === null ? C.accent : C.orange }}>
                      {row.yearsSustainable === null ? "∞ survives" : `${row.yearsSustainable} yrs`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* Inflation impact */}
        <Card>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>Inflation Impact on Spending</div>
          {[
            { label: "Today (Year 0)", value: nominalSpend, note: "nominal" },
            { label: `Year 20 (+${inflationRate}%/yr)`, value: realSpend20, note: "inflation-adjusted" },
            { label: `Year 30 (+${inflationRate}%/yr)`, value: realSpend30, note: "inflation-adjusted" },
          ].map(({ label, value, note }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}22` }}>
              <div>
                <div style={{ fontSize: 11, color: C.text, fontFamily: mono }}>{label}</div>
                <div style={{ fontSize: 9, color: C.muted, fontFamily: sans }}>{note}</div>
              </div>
              <div style={{ fontSize: 14, color: C.gold, fontFamily: mono, fontWeight: 600 }}>{fmt(value)}</div>
            </div>
          ))}
        </Card>
      </div>

      {/* Right */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card style={{ padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: C.textDim, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em" }}>Withdrawal Sustainability</span>
            <div style={{ display: "flex", gap: 10 }}>
              {swrCurves.map((c, i) => (
                <span key={c.swr} style={{ fontSize: 9, color: swrColors[i], fontFamily: mono }}>── {c.swr}% SWR</span>
              ))}
            </div>
          </div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
            {yTicks.map((v, i) => (
              <g key={i}>
                <line x1={PL} y1={py(v)} x2={W - PR} y2={py(v)} stroke={C.border} strokeWidth={0.5} />
                <text x={PL - 4} y={py(v) + 4} fill={C.mutedLight} fontSize={8} textAnchor="end" fontFamily={mono}>{fmtK(v)}</text>
              </g>
            ))}
            {swrCurves.map((curve, ci) => {
              const path = curve.years
                .map((y, i) => `${i === 0 ? "M" : "L"}${px(y.age).toFixed(1)},${py(y.portfolio).toFixed(1)}`)
                .join(" ");
              return path ? (
                <path key={curve.swr} d={path} fill="none" stroke={swrColors[ci]} strokeWidth={2} />
              ) : null;
            })}
            {Array.from({ length: Math.floor((maxAge - minAge) / 5) + 1 }, (_, i) => minAge + i * 5)
              .filter(age => age <= maxAge)
              .map(age => (
                <text key={age} x={px(age)} y={H - PB + 14} fill={C.mutedLight} fontSize={8}
                  textAnchor="middle" fontFamily={mono}>{age}</text>
              ))}
          </svg>
        </Card>

        <Card>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>Dynamic Withdrawal Guardrails</div>
          <p style={{ fontSize: 12, color: C.textDim, fontFamily: sans, lineHeight: 1.6, marginBottom: 10 }}>
            Rather than a fixed SWR, guardrail strategies adjust spending based on portfolio performance:
          </p>
          {[
            { rule: "Guyton-Klinger Rule", desc: "Reduce withdrawals 10% if portfolio drops >20% below initial value." },
            { rule: "Floor & Upside", desc: "Set a floor (essential expenses) covered by bonds; withdraw from growth assets above floor." },
            { rule: "RMD Method", desc: "Withdraw portfolio ÷ remaining life expectancy each year — naturally adjusts." },
            { rule: "VPW (Variable Pct)", desc: "Withdraw a percentage that rises with age, ensuring portfolio lasts exactly to plan date." },
          ].map(({ rule, desc }) => (
            <div key={rule} style={{ marginBottom: 10, paddingLeft: 12, borderLeft: `2px solid ${C.gold}44` }}>
              <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, fontWeight: 600, marginBottom: 2 }}>{rule}</div>
              <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans }}>{desc}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── Sequence Risk Tab ────────────────────────────────────────────────────────

function SeqRiskTab({
  currentAge, retireAge, lifeExp, annualSpend, ssAnnual, ssClaimAge,
  postRetireReturn, inflationRate, calc,
}: {
  currentAge: number; retireAge: number; lifeExp: number;
  annualSpend: number; ssAnnual: number; ssClaimAge: number;
  postRetireReturn: number; inflationRate: number;
  calc: SharedCalcResults;
}) {
  const [bearMag, setBearMag] = useState(20);
  const [badYears, setBadYears] = useState(3);
  const [showBase, setShowBase] = useState(true);
  const [showBad, setShowBad] = useState(true);
  const [showGood, setShowGood] = useState(true);

  const scenarios = useMemo((): SeqScenario[] => {
    const startPortfolio = calc.fiNumber;

    const makeScenario = (
      label: string,
      color: string,
      yearlyReturn: (idx: number) => number,
    ): SeqScenario => {
      const years = simulateRetirement(
        startPortfolio, annualSpend, ssAnnual, ssClaimAge, retireAge, lifeExp,
        inflationRate, (_age, idx) => yearlyReturn(idx),
      );
      const depletedYear = years.find(y => y.depleted);
      return {
        label, color, years,
        depletedAge: depletedYear ? depletedYear.age : null,
      };
    };

    const base = makeScenario("Base (steady)", C.accent, () => postRetireReturn);

    const bad = makeScenario("Bad Sequence", C.red, (idx) => {
      if (idx < badYears) {
        // Gradually worsening then recovering
        const severity = [1.0, 0.8, 0.6, 0.4, 0.3];
        return -bearMag * (severity[idx] ?? 0.3);
      }
      return postRetireReturn;
    });

    const good = makeScenario("Good Sequence", C.blue, (idx) => {
      if (idx < badYears) {
        const boosts = [1.0, 0.8, 0.6, 0.4, 0.3];
        return postRetireReturn + bearMag * (boosts[idx] ?? 0.3);
      }
      return postRetireReturn;
    });

    return [base, bad, good];
  }, [calc.fiNumber, annualSpend, ssAnnual, ssClaimAge, retireAge, lifeExp, inflationRate, postRetireReturn, bearMag, badYears]);

  const W = 500, H = 220, PL = 54, PR = 20, PT = 14, PB = 28;
  const visibleScenarios = scenarios.filter((s, i) => [showBase, showBad, showGood][i]);
  const maxP = Math.max(
    ...scenarios.flatMap(s => s.years.map(y => y.portfolio)),
    calc.fiNumber
  ) * 1.08;
  const minAge = retireAge, maxAge = lifeExp;
  const px = (age: number) => toSvgX(age, minAge, maxAge, W, PL);
  const py = (val: number) => toSvgY(val, 0, maxP, H, PT, PB);
  const yTicks = Array.from({ length: 5 }, (_, i) => (maxP / 4) * i);

  // Impact calculation: drop in year 1 vs year 20
  const impactYear1 = useMemo(() => {
    const s1 = simulateRetirement(
      calc.fiNumber, annualSpend, ssAnnual, ssClaimAge, retireAge, lifeExp,
      inflationRate, (_age, idx) => idx === 0 ? -bearMag : postRetireReturn,
    );
    const s20 = simulateRetirement(
      calc.fiNumber, annualSpend, ssAnnual, ssClaimAge, retireAge, lifeExp,
      inflationRate, (_age, idx) => idx === 19 ? -bearMag : postRetireReturn,
    );
    const base = scenarios[0];
    const finalBase = base?.years[base.years.length - 1]?.portfolio ?? 1;
    const final1 = s1[s1.length - 1]?.portfolio ?? 0;
    const final20 = s20[s20.length - 1]?.portfolio ?? 0;
    const impact1 = finalBase - final1;
    const impact20 = finalBase - final20;
    const ratio = impact20 > 0 ? (impact1 / impact20).toFixed(1) : "—";
    return { impact1, impact20, ratio };
  }, [calc.fiNumber, annualSpend, ssAnnual, ssClaimAge, retireAge, lifeExp, inflationRate, bearMag, postRetireReturn, scenarios]);

  return (
    <div className="co-grid-lt" style={{ gap: 20 }}>
      {/* Left: controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card>
          <div style={{ fontSize: 11, color: C.red, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>Sequence of Returns Risk</div>
          <p style={{ fontSize: 12, color: C.textDim, fontFamily: sans, lineHeight: 1.6, marginBottom: 10 }}>
            The order of investment returns — not just the average — profoundly affects retirement outcomes.
            A market crash in early retirement forces you to sell more shares at depressed prices, permanently
            reducing your portfolio&apos;s ability to recover.
          </p>
          <div style={{ background: C.red + "11", borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.red}22` }}>
            <div style={{ fontSize: 11, color: C.red, fontFamily: mono, fontWeight: 600, marginBottom: 4 }}>Key Insight</div>
            <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans }}>
              A {bearMag}% crash in year 1 reduces final portfolio by {impactYear1.ratio}× more than the same crash in year 20.
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: 600 }}>Scenario Settings</div>
          <Sl label="Bear Market Magnitude" value={bearMag} min={5} max={40} step={5}
            onChange={setBearMag} color={C.red} fmt={v => `-${v}%`} />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Years of Bad Returns</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 5].map(y => (
                <button key={y} onClick={() => setBadYears(y)} style={{
                  flex: 1, padding: "6px 0", background: badYears === y ? C.red + "22" : "transparent",
                  border: `1px solid ${badYears === y ? C.red : C.border}`,
                  borderRadius: 6, color: badYears === y ? C.red : C.mutedLight,
                  fontFamily: mono, fontSize: 12, cursor: "pointer",
                }}>
                  {y}yr{y > 1 ? "s" : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Show Scenarios</div>
          {[
            { label: "Base (steady)", color: C.accent, show: showBase, toggle: () => setShowBase(v => !v) },
            { label: "Bad Sequence", color: C.red, show: showBad, toggle: () => setShowBad(v => !v) },
            { label: "Good Sequence", color: C.blue, show: showGood, toggle: () => setShowGood(v => !v) },
          ].map(({ label, color, show, toggle }) => (
            <button key={label} onClick={toggle} style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              background: "transparent", border: "none", cursor: "pointer", padding: "4px 0",
            }}>
              <div style={{ width: 14, height: 3, background: show ? color : C.muted, borderRadius: 2 }} />
              <span style={{ fontSize: 11, color: show ? color : C.muted, fontFamily: mono }}>{label}</span>
              {!scenarios.find(s => s.label === label)?.depletedAge
                ? <Tag color={show ? color : C.muted}>survives</Tag>
                : <Tag color={C.orange}>depletes</Tag>}
            </button>
          ))}
        </Card>

        {/* Depletion summary */}
        <Card>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>Outcomes</div>
          {scenarios.map(s => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}22` }}>
              <span style={{ fontSize: 11, color: s.color, fontFamily: mono }}>{s.label}</span>
              <div style={{ textAlign: "right" }}>
                {s.depletedAge ? (
                  <span style={{ fontSize: 11, color: C.orange, fontFamily: mono }}>Depletes age {s.depletedAge}</span>
                ) : (
                  <span style={{ fontSize: 11, color: C.accent, fontFamily: mono }}>
                    {fmt(s.years[s.years.length - 1]?.portfolio ?? 0)} at {lifeExp}
                  </span>
                )}
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>Mitigation Strategies</div>
          {[
            { title: "Cash Buffer (1–2 yrs)", desc: "Maintain 1–2 years of expenses in cash/short bonds. Avoid selling equities in down years." },
            { title: "Dynamic Withdrawal", desc: "Reduce spending 10–15% when portfolio is down. Resume normal spending when recovered." },
            { title: "Bond Tent Strategy", desc: "Hold 40–50% bonds at retirement, gradually shift to equities over 10 years as market risk passes." },
            { title: "Delay Social Security", desc: "Each year you delay past 62 increases benefit ~8%. Maximizing SS reduces portfolio dependence." },
            { title: "Part-Time Income", desc: "Even modest earned income in early retirement dramatically reduces sequence risk exposure." },
          ].map(({ title, desc }) => (
            <div key={title} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `2px solid ${C.gold}44` }}>
              <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, fontWeight: 600, marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans }}>{desc}</div>
            </div>
          ))}
        </Card>
      </div>

      {/* Right: chart */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card style={{ padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: C.textDim, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em" }}>Portfolio Under Different Return Sequences</span>
          </div>
          <div style={{ display: "flex", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
            {scenarios.map(s => (
              <span key={s.label} style={{ fontSize: 9, color: s.color, fontFamily: mono }}>── {s.label}</span>
            ))}
          </div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
            {yTicks.map((v, i) => (
              <g key={i}>
                <line x1={PL} y1={py(v)} x2={W - PR} y2={py(v)} stroke={C.border} strokeWidth={0.5} />
                <text x={PL - 4} y={py(v) + 4} fill={C.mutedLight} fontSize={8} textAnchor="end" fontFamily={mono}>{fmtK(v)}</text>
              </g>
            ))}
            {visibleScenarios.map(s => {
              const path = s.years
                .map((y, i) => `${i === 0 ? "M" : "L"}${px(y.age).toFixed(1)},${py(y.portfolio).toFixed(1)}`)
                .join(" ");
              return path ? (
                <path key={s.label} d={path} fill="none" stroke={s.color} strokeWidth={2} />
              ) : null;
            })}
            {/* Depletion markers */}
            {visibleScenarios.filter(s => s.depletedAge).map(s => (
              <g key={s.label + "dep"}>
                <line x1={px(s.depletedAge!)} y1={PT} x2={px(s.depletedAge!)} y2={H - PB}
                  stroke={s.color} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
                <text x={px(s.depletedAge!)} y={PT - 2} fill={s.color} fontSize={7}
                  textAnchor="middle" fontFamily={mono}>Depletes {s.depletedAge}</text>
              </g>
            ))}
            {Array.from({ length: Math.floor((maxAge - minAge) / 5) + 1 }, (_, i) => minAge + i * 5)
              .filter(age => age <= maxAge)
              .map(age => (
                <text key={age} x={px(age)} y={H - PB + 14} fill={C.mutedLight} fontSize={8}
                  textAnchor="middle" fontFamily={mono}>{age}</text>
              ))}
          </svg>
        </Card>

        <Card>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>Why Sequence Matters</div>
          <div className="co-grid-2b">
            <div style={{ background: C.red + "11", borderRadius: 8, padding: "12px", border: `1px solid ${C.red}22` }}>
              <div style={{ fontSize: 10, color: C.red, fontFamily: mono, textTransform: "uppercase", marginBottom: 4 }}>{bearMag}% Crash Year 1</div>
              <div style={{ fontSize: 20, color: C.red, fontFamily: mono, fontWeight: 700 }}>{fmtK(impactYear1.impact1)}</div>
              <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, marginTop: 3 }}>lost from final balance</div>
            </div>
            <div style={{ background: C.gold + "0d", borderRadius: 8, padding: "12px", border: `1px solid ${C.gold}22` }}>
              <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, textTransform: "uppercase", marginBottom: 4 }}>{bearMag}% Crash Year 20</div>
              <div style={{ fontSize: 20, color: C.gold, fontFamily: mono, fontWeight: 700 }}>{fmtK(impactYear1.impact20)}</div>
              <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, marginTop: 3 }}>lost from final balance</div>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", background: C.purple + "11", borderRadius: 8, border: `1px solid ${C.purple}22` }}>
            <span style={{ fontSize: 12, color: C.purple, fontFamily: mono }}>
              Year 1 crash is {impactYear1.ratio}× more damaging than a year 20 crash at the same magnitude.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FireCalculator() {
  // ── Personal ──
  const [currentAge,     setCurrentAge]     = useState(35);
  const [retireAge,      setRetireAge]      = useState(50);
  const [lifeExp,        setLifeExp]        = useState(90);

  // ── Wealth ──
  const [currentNW,      setCurrentNW]      = useState(500000);
  const [annualSavings,  setAnnualSavings]  = useState(80000);
  const [annualSpend,    setAnnualSpend]    = useState(120000);

  // ── Returns ──
  const [preRetireReturn,  setPreRetireReturn]  = useState(8);
  const [postRetireReturn, setPostRetireReturn] = useState(6);
  const [inflationRate,    setInflationRate]    = useState(2.5);
  const [swr,              setSwr]              = useState(4);

  // ── Social Security ──
  const [ssAnnual,    setSsAnnual]    = useState(30000);
  const [ssClaimAge,  setSsClaimAge]  = useState(67);

  // ── Tab ──
  const [tab, setTab] = useState("dashboard");

  const tabs = [
    { id: "dashboard",  label: "Dashboard" },
    { id: "coast",      label: "Coast FI" },
    { id: "swr",        label: "SWR Analysis" },
    { id: "seqrisk",    label: "Sequence Risk" },
  ];

  // ── Core calculations ──
  const calc = useMemo((): SharedCalcResults => {
    const r = preRetireReturn / 100;
    const fiNumber = annualSpend / (swr / 100);
    const fiProgress = Math.min(1, currentNW / fiNumber);

    const yearsToRetirement = Math.max(1, retireAge - currentAge);
    const coastFiAmount = fiNumber / Math.pow(1 + r, yearsToRetirement);
    const coastProgress = Math.min(1, currentNW / coastFiAmount);

    const yearsToFIVal = yearsToFI(currentNW, annualSavings, r, fiNumber);
    const yearsToCoastVal = yearsToFI(currentNW, annualSavings, r, coastFiAmount);

    const fiAge = currentAge + (yearsToFIVal ?? Infinity);
    const coastFiAge = currentAge + (yearsToCoastVal ?? Infinity);

    // Accumulation projection (currentAge → retireAge+20, capped at lifeExp)
    const accumProjYears: ProjYear[] = [];
    let portfolio = currentNW;
    let coastHit = currentNW >= coastFiAmount;
    let fiHit = currentNW >= fiNumber;
    const endAccumAge = Math.min(retireAge + 20, lifeExp, currentAge + 80);

    for (let age = currentAge; age <= endAccumAge; age++) {
      const growth = portfolio * r;
      const contributions = age < retireAge ? annualSavings : 0;
      if (!coastHit && portfolio + growth + contributions >= coastFiAmount) coastHit = true;
      if (!fiHit && portfolio + growth + contributions >= fiNumber) fiHit = true;
      portfolio = portfolio + growth + contributions;
      accumProjYears.push({
        age,
        portfolio,
        fiProgress: Math.min(1, portfolio / fiNumber),
        contributions,
        growth,
        isCoastFI: !coastHit && portfolio >= coastFiAmount,
        isFI: !fiHit && portfolio >= fiNumber,
      });
      // Mark crossover once
      if (!coastHit && portfolio >= coastFiAmount) coastHit = true;
      if (!fiHit && portfolio >= fiNumber) fiHit = true;
    }

    // Recalculate crossovers cleanly
    let crossCoast = false, crossFI = false;
    const accumProjFinal = accumProjYears.map(y => {
      const isCoastFI = !crossCoast && y.portfolio >= coastFiAmount;
      const isFI = !crossFI && y.portfolio >= fiNumber;
      if (isCoastFI) crossCoast = true;
      if (isFI) crossFI = true;
      return { ...y, isCoastFI, isFI };
    });

    // Retirement simulation
    const retirePortfolio = accumProjFinal.find(y => y.age === retireAge)?.portfolio
      ?? accumProjFinal[accumProjFinal.length - 1]?.portfolio ?? currentNW;

    const retirYears = simulateRetirement(
      retirePortfolio, annualSpend, ssAnnual, ssClaimAge, retireAge, lifeExp,
      inflationRate, () => postRetireReturn,
    );

    // SWR rows
    const swrRows: SwrRow[] = [3, 3.5, 4, 4.5, 5].map(s => {
      const fiN = annualSpend / (s / 100);
      const monthlyIncome = fiN * (s / 100) / 12;
      // Simulate from fiN to see if it survives
      let p = fiN;
      let depleted = false;
      let depletedAt: number | null = null;
      for (let age = retireAge; age <= lifeExp; age++) {
        const idx = age - retireAge;
        const inflFactor = Math.pow(1 + inflationRate / 100, idx);
        const ssInc = age >= ssClaimAge ? ssAnnual * inflFactor : 0;
        const w = Math.max(0, annualSpend * inflFactor - ssInc);
        p = p * (1 + postRetireReturn / 100) - w;
        if (!depleted && p <= 0) {
          depleted = true;
          depletedAt = idx; // years into retirement
        }
      }
      return {
        swr: s,
        fiNumber: fiN,
        monthlyIncome,
        yearsSustainable: depleted && depletedAt !== null ? depletedAt : null,
      };
    });

    // Sequence scenarios (pre-computed for header KPIs)
    const seqScenarios: SeqScenario[] = [
      {
        label: "Base", color: C.accent,
        years: simulateRetirement(fiNumber, annualSpend, ssAnnual, ssClaimAge, retireAge, lifeExp, inflationRate, () => postRetireReturn),
        depletedAge: null,
      },
    ];

    return {
      fiNumber, fiProgress, coastFiAmount, coastProgress,
      yearsToFIVal, yearsToCoastVal, fiAge, coastFiAge,
      accumProjYears: accumProjFinal, swrRows, retirYears, seqScenarios,
    };
  }, [
    currentAge, retireAge, lifeExp, currentNW, annualSavings, annualSpend,
    preRetireReturn, postRetireReturn, inflationRate, swr, ssAnnual, ssClaimAge,
  ]);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: sans }}>
      {/* ── Header ── */}
      <div className="co-header-pad" style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div className="co-header-row">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 18, color: C.text, fontFamily: mono, fontWeight: 700, letterSpacing: "0.04em" }}>
                FIRE CALCULATOR
              </span>
              <Tag color={C.blue}>AGE {currentAge}</Tag>
              <Tag color={C.gold}>{swr}% SWR</Tag>
            </div>
            <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans }}>
              Compute FI number, time to financial independence, coast-FI, and retirement portfolio sustainability under sequence-of-returns risk.
            </div>
          </div>
          <div className="co-kpi-row" style={{ gap: 20 }}>
            {[
              { label: "FI Number", value: fmtK(calc.fiNumber), color: C.accent },
              { label: "Progress", value: pct(calc.fiProgress), color: C.blue },
              { label: "FI Age", value: calc.yearsToFIVal === null ? "—" : `${Math.round(calc.fiAge)}`, color: C.gold },
              { label: "Years Away", value: calc.yearsToFIVal === null ? "∞" : `${Math.ceil(calc.yearsToFIVal)}`, color: C.purple },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                <div style={{ fontSize: 15, color, fontFamily: mono, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: C.bg, overflowX: "auto", padding: "0 24px" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none", cursor: "pointer", fontFamily: mono, fontSize: 11,
            letterSpacing: "0.07em", textTransform: "uppercase", padding: "11px 14px",
            color: tab === t.id ? C.accent : C.mutedLight,
            borderBottom: `2px solid ${tab === t.id ? C.accent : "transparent"}`,
            whiteSpace: "nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="co-content-pad" style={{ maxWidth: 1200, margin: "0 auto" }}>
        {tab === "dashboard" && (
          <DashboardTab
            currentAge={currentAge} setCurrentAge={setCurrentAge}
            retireAge={retireAge} setRetireAge={setRetireAge}
            lifeExp={lifeExp} setLifeExp={setLifeExp}
            currentNW={currentNW} setCurrentNW={setCurrentNW}
            annualSavings={annualSavings} setAnnualSavings={setAnnualSavings}
            annualSpend={annualSpend} setAnnualSpend={setAnnualSpend}
            preRetireReturn={preRetireReturn} setPreRetireReturn={setPreRetireReturn}
            postRetireReturn={postRetireReturn} setPostRetireReturn={setPostRetireReturn}
            inflationRate={inflationRate} setInflationRate={setInflationRate}
            swr={swr} setSwr={setSwr}
            ssAnnual={ssAnnual} setSsAnnual={setSsAnnual}
            ssClaimAge={ssClaimAge} setSsClaimAge={setSsClaimAge}
            calc={calc}
          />
        )}
        {tab === "coast" && (
          <CoastFITab
            currentAge={currentAge} retireAge={retireAge} lifeExp={lifeExp}
            currentNW={currentNW} annualSavings={annualSavings} annualSpend={annualSpend}
            preRetireReturn={preRetireReturn} postRetireReturn={postRetireReturn}
            inflationRate={inflationRate} ssAnnual={ssAnnual} ssClaimAge={ssClaimAge}
            calc={calc}
          />
        )}
        {tab === "swr" && (
          <SWRTab
            swr={swr} setSwr={setSwr}
            postRetireReturn={postRetireReturn} setPostRetireReturn={setPostRetireReturn}
            inflationRate={inflationRate} setInflationRate={setInflationRate}
            annualSpend={annualSpend} retireAge={retireAge} lifeExp={lifeExp}
            currentNW={currentNW} currentAge={currentAge}
            ssAnnual={ssAnnual} ssClaimAge={ssClaimAge}
            calc={calc}
          />
        )}
        {tab === "seqrisk" && (
          <SeqRiskTab
            currentAge={currentAge} retireAge={retireAge} lifeExp={lifeExp}
            annualSpend={annualSpend} ssAnnual={ssAnnual} ssClaimAge={ssClaimAge}
            postRetireReturn={postRetireReturn} inflationRate={inflationRate}
            calc={calc}
          />
        )}
      </div>

      {/* ── Footer ── */}
      <div className="co-footer-pad" style={{ borderTop: `1px solid ${C.border}`, marginTop: 32, maxWidth: 1200, margin: "32px auto 0" }}>
        <div style={{ padding: "14px 0", fontSize: 10, color: C.muted, fontFamily: sans, lineHeight: 1.7 }}>
          4% SWR based on Trinity Study (Bengen 1994) — historically sustainable for 30-yr retirements ·{" "}
          Actual returns vary; this is a planning model, not a guarantee · Social Security projections are estimates ·{" "}
          Not financial or tax advice. Consult a CFP.
        </div>
      </div>
    </div>
  );
}
