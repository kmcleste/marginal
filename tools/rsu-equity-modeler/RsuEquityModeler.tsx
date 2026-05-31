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
const fmt   = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const fmtK  = (n: number) => Math.abs(n) >= 1000 ? `$${((n || 0) / 1000).toFixed(Math.abs(n) >= 100000 ? 0 : 1)}k` : fmt(n);
const pct   = (n: number) => `${((n || 0) * 100).toFixed(1)}%`;
const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ─── Types ────────────────────────────────────────────────────────────────────

type GrantType    = "rsu" | "nso";
type VestingType  = "4yr-1cliff" | "4yr-monthly" | "3yr-monthly";

interface VestYear {
  year: number;
  label: string;
  sharesVested: number;
  cumShares: number;
  fmvAtVest: number;
  grossIncome: number;
  taxAmount: number;
  netCash: number;
  sellToCoverShares: number;
  sharesKept: number;
}

// ─── UI Primitives ────────────────────────────────────────────────────────────

function Card({ children, style, glow, goldGlow }: {
  children: React.ReactNode; style?: React.CSSProperties; glow?: boolean; goldGlow?: boolean;
}) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${glow ? C.accent + "55" : goldGlow ? C.gold + "44" : C.border}`,
      borderRadius: 12,
      padding: "16px 18px",
      boxShadow: glow ? `0 0 24px ${C.accentDim}` : goldGlow ? `0 0 24px ${C.gold}11` : "none",
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
  return (
    <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 4, padding: "1px 6px", fontSize: 10, fontFamily: mono }}>
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
      {children}
    </div>
  );
}

function WarningBadge({ level, children }: { level: "warn" | "danger" | "ok"; children: React.ReactNode }) {
  const color = level === "danger" ? C.red : level === "warn" ? C.orange : C.accent;
  return (
    <div style={{ background: color + "15", border: `1px solid ${color}44`, borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
      <span style={{ fontSize: 12, color, fontFamily: mono }}>{children}</span>
    </div>
  );
}

// ─── Vesting Schedule Logic ───────────────────────────────────────────────────

function buildVestSchedule(
  grantType: GrantType,
  grantShares: number,
  strikePrice: number,
  grantDate: number,
  vestingType: VestingType,
  currentFMV: number,
  expectedAnnualGrowth: number,
  marginalFedRate: number,
  marginalStateRate: number,
  ficaRate: number,
): VestYear[] {
  const currentYear = new Date().getFullYear();
  const effectiveRate = (marginalFedRate + marginalStateRate + ficaRate) / 100;

  // Build yearly share amounts based on vesting schedule
  const yearlyShares: Record<number, number> = {};

  if (vestingType === "4yr-1cliff") {
    // Year 1: 25% cliff, Years 2-4: remaining 75% evenly over 3 years
    const cliffShares = Math.round(grantShares * 0.25);
    const remaining = grantShares - cliffShares;
    yearlyShares[grantDate + 1] = cliffShares;
    yearlyShares[grantDate + 2] = Math.round(remaining / 3);
    yearlyShares[grantDate + 3] = Math.round(remaining / 3);
    yearlyShares[grantDate + 4] = remaining - 2 * Math.round(remaining / 3);
  } else if (vestingType === "4yr-monthly") {
    const perYear = Math.round(grantShares / 4);
    for (let i = 1; i <= 4; i++) {
      yearlyShares[grantDate + i] = i < 4 ? perYear : grantShares - perYear * 3;
    }
  } else {
    // 3yr-monthly: 1/36 per month → ~1/3 per year
    const perYear = Math.round(grantShares / 3);
    for (let i = 1; i <= 3; i++) {
      yearlyShares[grantDate + i] = i < 3 ? perYear : grantShares - perYear * 2;
    }
  }

  let cumShares = 0;
  return Object.entries(yearlyShares).map(([yearStr, sharesVested]) => {
    const year = parseInt(yearStr, 10);
    cumShares += sharesVested;
    const yearsFromNow = year - currentYear;
    const fmvAtVest = currentFMV * Math.pow(1 + expectedAnnualGrowth / 100, yearsFromNow);
    const spread = Math.max(0, fmvAtVest - strikePrice);
    const grossIncome = grantType === "rsu"
      ? sharesVested * fmvAtVest
      : sharesVested * spread;
    const taxAmount = grossIncome * effectiveRate;
    const netCash = taxAmount; // sell-to-cover proceeds
    const sellToCoverShares = fmvAtVest > 0 ? Math.floor(taxAmount / fmvAtVest) : 0;
    const sharesKept = sharesVested - sellToCoverShares;

    return {
      year,
      label: `${year}`,
      sharesVested,
      cumShares,
      fmvAtVest,
      grossIncome,
      taxAmount,
      netCash,
      sellToCoverShares,
      sharesKept,
    };
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RsuEquityModeler() {
  // ── Grant Config ──
  const [grantType,    setGrantType]    = useState<GrantType>("rsu");
  const [grantShares,  setGrantShares]  = useState(10000);
  const [strikePrice,  setStrikePrice]  = useState(0);
  const [grantDate,    setGrantDate]    = useState(2023);
  const [vestingType,  setVestingType]  = useState<VestingType>("4yr-1cliff");

  // ── Market ──
  const [currentFMV,           setCurrentFMV]           = useState(50);
  const [expectedAnnualGrowth, setExpectedAnnualGrowth] = useState(8);

  // ── Tax Context ──
  const [salaryBase,        setSalaryBase]        = useState(250000);
  const [marginalFedRate,   setMarginalFedRate]   = useState(37);
  const [marginalStateRate, setMarginalStateRate] = useState(5);
  const [ficaRate,          setFicaRate]          = useState(1.45);

  // ── Concentration ──
  const [totalNetWorth,    setTotalNetWorth]    = useState(1000000);
  const [pctOutsideEmployer, setPctOutsideEmployer] = useState(60);

  // ── UI ──
  const [tab, setTab] = useState("schedule");

  const currentYear = new Date().getFullYear();

  // ─── Derived Calculations ──────────────────────────────────────────────────

  const vestSchedule = useMemo(() => buildVestSchedule(
    grantType, grantShares, strikePrice, grantDate, vestingType,
    currentFMV, expectedAnnualGrowth,
    marginalFedRate, marginalStateRate, ficaRate,
  ), [grantType, grantShares, strikePrice, grantDate, vestingType,
      currentFMV, expectedAnnualGrowth, marginalFedRate, marginalStateRate, ficaRate]);

  const effectiveRate = (marginalFedRate + marginalStateRate + ficaRate) / 100;

  const totalGrantValue = useMemo(() => grantShares * currentFMV, [grantShares, currentFMV]);

  const vestedShares = useMemo(() => {
    return vestSchedule
      .filter(v => v.year <= currentYear)
      .reduce((sum, v) => sum + v.sharesVested, 0);
  }, [vestSchedule, currentYear]);

  const unvestedShares = grantShares - vestedShares;
  const unvestedValue  = unvestedShares * currentFMV;

  const nextVest = useMemo(() => {
    return vestSchedule.find(v => v.year > currentYear) ?? vestSchedule[0] ?? null;
  }, [vestSchedule, currentYear]);

  // Sell vs hold for next vest
  const sellVsHold = useMemo(() => {
    if (!nextVest) return null;
    const { sharesVested, fmvAtVest, grossIncome, taxAmount, sellToCoverShares, sharesKept } = nextVest;
    const sellAll       = grossIncome - taxAmount;              // net after tax if sell all at vest
    const sellToCoverVal = taxAmount + sharesKept * fmvAtVest;  // cash from STC + remaining shares
    const holdAll        = grossIncome;                          // full value, owes taxes separately
    return { sharesVested, fmvAtVest, grossIncome, taxAmount, sellAll, sellToCoverVal, holdAll, sharesKept, sellToCoverShares };
  }, [nextVest]);

  // Price sensitivity table
  const priceSensitivity = useMemo(() => {
    if (!nextVest) return [];
    const deltas = [-0.30, -0.20, -0.10, 0, 0.10, 0.20, 0.30];
    return deltas.map(delta => {
      const adjFMV     = nextVest.fmvAtVest * (1 + delta);
      const spread     = Math.max(0, adjFMV - strikePrice);
      const income     = grantType === "rsu"
        ? nextVest.sharesVested * adjFMV
        : nextVest.sharesVested * spread;
      const tax        = income * effectiveRate;
      const sellAllNet = income - tax;
      const stcShares  = adjFMV > 0 ? Math.floor(tax / adjFMV) : 0;
      const keptShares = nextVest.sharesVested - stcShares;
      const holdVal    = income; // full value before tax
      return { delta, adjFMV, income, tax, sellAllNet, stcShares, keptShares, holdVal, isCurrent: delta === 0 };
    });
  }, [nextVest, grantType, strikePrice, effectiveRate]);

  // Concentration risk
  const concRisk = useMemo(() => {
    const grantValue    = grantShares * currentFMV;
    const unvestedVal   = unvestedShares * currentFMV;
    const grantPctNW    = totalNetWorth > 0 ? grantValue / totalNetWorth : 0;
    const unvestedPctNW = totalNetWorth > 0 ? unvestedVal / totalNetWorth : 0;

    // employer stock within portfolio = grantPctNW of total NW
    // existing outside = pctOutsideEmployer%  of (totalNW - grantValue)
    // approximation: employer stock concentration = grantValue / totalNetWorth
    const concentration  = grantPctNW;

    // How many shares to sell per quarter to reach <10% concentration within 2 years (8 quarters)
    const targetValue    = totalNetWorth * 0.10;
    const excessValue    = Math.max(0, grantValue - targetValue);
    const sharesPerQtr   = excessValue > 0 && currentFMV > 0
      ? Math.ceil(excessValue / currentFMV / 8)
      : 0;

    const level: "ok" | "warn" | "danger" = concentration > 0.40 ? "danger" : concentration > 0.20 ? "warn" : "ok";

    return { grantValue, unvestedVal, grantPctNW, unvestedPctNW, concentration, excessValue, sharesPerQtr, level };
  }, [grantShares, currentFMV, unvestedShares, totalNetWorth, pctOutsideEmployer]);

  // Total tax summary across all vesting years
  const taxSummary = useMemo(() => {
    const totalIncome  = vestSchedule.reduce((s, v) => s + v.grossIncome, 0);
    const totalTax     = vestSchedule.reduce((s, v) => s + v.taxAmount, 0);
    const totalShrsKept = vestSchedule.reduce((s, v) => s + v.sharesKept, 0);
    return { totalIncome, totalTax, totalShrsKept };
  }, [vestSchedule]);

  // ─── Tabs ──────────────────────────────────────────────────────────────────

  const tabs = [
    { id: "schedule",      label: "📅 Schedule" },
    { id: "tax",           label: "💸 Tax" },
    { id: "sellvshold",    label: "📊 Sell vs Hold" },
    { id: "concentration", label: "⚖ Concentration" },
  ];

  // ─── Left Config Panel ─────────────────────────────────────────────────────

  const ConfigPanel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        <SectionLabel>Grant Configuration</SectionLabel>

        {/* Grant Type Toggle */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Grant Type</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["rsu", "nso"] as GrantType[]).map(gt => (
              <button key={gt} onClick={() => setGrantType(gt)} style={{
                flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer",
                background: grantType === gt ? C.accent + "22" : C.surfaceAlt,
                border: `1px solid ${grantType === gt ? C.accent : C.border}`,
                color: grantType === gt ? C.accent : C.mutedLight,
                fontFamily: mono, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              }}>{gt}</button>
            ))}
          </div>
        </div>

        <Sl label="Grant Shares" value={grantShares} min={1000} max={100000} step={500}
          onChange={setGrantShares} color={C.blue}
          fmt={v => v.toLocaleString("en-US")}
          hint={`Total grant value at current FMV: ${fmt(grantShares * currentFMV)}`} />

        {grantType === "nso" && (
          <Sl label="Strike Price ($ / share)" value={strikePrice} min={0} max={200} step={1}
            onChange={setStrikePrice} color={C.purple}
            hint={`Spread at current FMV: ${fmt(Math.max(0, currentFMV - strikePrice))} / share`} />
        )}

        <Sl label="Grant Year" value={grantDate} min={2018} max={currentYear} step={1}
          onChange={setGrantDate} color={C.mutedMid}
          fmt={v => String(v)} hint={`Vesting starts in ${grantDate}`} />

        {/* Vesting Schedule */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Vesting Schedule</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {([
              { val: "4yr-1cliff",   label: "4yr — 1yr cliff + monthly" },
              { val: "4yr-monthly",  label: "4yr — monthly (no cliff)" },
              { val: "3yr-monthly",  label: "3yr — monthly" },
            ] as { val: VestingType; label: string }[]).map(opt => (
              <button key={opt.val} onClick={() => setVestingType(opt.val)} style={{
                padding: "7px 10px", borderRadius: 6, cursor: "pointer", textAlign: "left",
                background: vestingType === opt.val ? C.gold + "15" : C.surfaceAlt,
                border: `1px solid ${vestingType === opt.val ? C.gold + "66" : C.border}`,
                color: vestingType === opt.val ? C.gold : C.mutedLight,
                fontFamily: mono, fontSize: 10,
              }}>{opt.label}</button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <SectionLabel>Market Assumptions</SectionLabel>
        <Sl label="Current FMV ($ / share)" value={currentFMV} min={1} max={500} step={1}
          onChange={setCurrentFMV} color={C.accent}
          hint={`Total grant value: ${fmt(totalGrantValue)}`} />
        <Sl label="Expected Annual Growth (%)" value={expectedAnnualGrowth} min={-10} max={30} step={0.5}
          onChange={setExpectedAnnualGrowth} color={C.blue}
          fmt={v => fmtPct(v)} hint="Used to project FMV at each vest date" />
      </Card>

      <Card>
        <SectionLabel>Tax Context</SectionLabel>
        <Sl label="Annual Salary (for context)" value={salaryBase} min={50000} max={1000000} step={5000}
          onChange={setSalaryBase} color={C.mutedMid}
          hint="Used to contextualize total income at vest" />
        <Sl label="Federal Marginal Rate (%)" value={marginalFedRate} min={0} max={37} step={1}
          onChange={setMarginalFedRate} color={C.red}
          fmt={fmtPct} hint="Top bracket: 37% for income > $609k (single, 2024)" />
        <Sl label="State Marginal Rate (%)" value={marginalStateRate} min={0} max={14} step={0.1}
          onChange={setMarginalStateRate} color={C.orange}
          fmt={fmtPct} hint="Varies by state; 0% in TX, FL, WA, NV, etc." />
        <Sl label="FICA / Medicare (%)" value={ficaRate} min={0} max={3.8} step={0.05}
          onChange={setFicaRate} color={C.mutedMid}
          fmt={v => fmtPct(v)} hint="1.45% Medicare + 0.9% additional for high earners" />
        <div style={{ background: C.surfaceAlt, borderRadius: 6, padding: "8px 12px", marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase" }}>Combined Rate</span>
            <span style={{ fontSize: 13, color: C.red, fontFamily: mono, fontWeight: 700 }}>{fmtPct(marginalFedRate + marginalStateRate + ficaRate)}</span>
          </div>
        </div>
      </Card>
    </div>
  );

  // ─── Tab: Schedule ─────────────────────────────────────────────────────────

  const ScheduleTab = (
    <div>
      <Card style={{ marginBottom: 12 }}>
        <SectionLabel>Vesting Calendar</SectionLabel>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: mono }}>
            <thead>
              <tr>
                {["Year", "Shares Vested", "Cum. Shares", "FMV at Vest", "Gross Income", "Est. Tax", "Shares Kept (STC)"].map(h => (
                  <th key={h} style={{
                    textAlign: h === "Year" ? "left" : "right",
                    padding: "5px 10px", color: C.muted, fontWeight: 400,
                    borderBottom: `1px solid ${C.border}`, fontSize: 10,
                    textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vestSchedule.map((v, i) => {
                const isPast    = v.year < currentYear;
                const isCurrent = v.year === currentYear;
                const isNext    = v.year === nextVest?.year;
                const rowColor  = isPast ? C.muted + "88" : isCurrent ? C.text : C.text;
                return (
                  <tr key={i} style={{
                    background: isNext ? C.accent + "08" : "transparent",
                    borderBottom: `1px solid ${C.border}22`,
                  }}>
                    <td style={{ padding: "7px 10px", color: isPast ? C.muted : C.accent, fontWeight: isNext ? 700 : 400 }}>
                      {v.year}
                      {isNext && <span style={{ marginLeft: 6, fontSize: 9, color: C.accent, background: C.accent + "22", borderRadius: 3, padding: "1px 5px" }}>NEXT</span>}
                      {isPast && <span style={{ marginLeft: 6, fontSize: 9, color: C.muted }}>past</span>}
                    </td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: rowColor }}>{v.sharesVested.toLocaleString()}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: C.textDim }}>{v.cumShares.toLocaleString()}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: isPast ? C.muted : C.blue }}>
                      {fmt(v.fmvAtVest)}
                    </td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: isPast ? C.muted : C.gold, fontWeight: isNext ? 600 : 400 }}>{fmt(v.grossIncome)}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: isPast ? C.muted : C.red }}>{fmt(v.taxAmount)}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: isPast ? C.muted : C.accent }}>
                      {v.sharesKept.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: "7px 10px", color: C.mutedLight, fontFamily: mono, fontSize: 11 }}>TOTAL</td>
                <td style={{ padding: "7px 10px", textAlign: "right", color: C.text, fontWeight: 700 }}>{grantShares.toLocaleString()}</td>
                <td style={{ padding: "7px 10px" }} />
                <td style={{ padding: "7px 10px" }} />
                <td style={{ padding: "7px 10px", textAlign: "right", color: C.gold, fontWeight: 700 }}>{fmt(taxSummary.totalIncome)}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", color: C.red, fontWeight: 700 }}>{fmt(taxSummary.totalTax)}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", color: C.accent, fontWeight: 700 }}>{taxSummary.totalShrsKept.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="co-grid-3">
        {[
          { label: "Total Grant Value",  val: fmt(totalGrantValue),          color: C.text,   hint: `${grantShares.toLocaleString()} shares × ${fmt(currentFMV)}` },
          { label: "Unvested Value",     val: fmt(unvestedValue),            color: C.blue,   hint: `${unvestedShares.toLocaleString()} unvested shares` },
          { label: "Lifetime Tax Bite",  val: fmt(taxSummary.totalTax),      color: C.red,    hint: pct(effectiveRate) + " combined rate" },
          { label: "Net After All Tax",  val: fmt(taxSummary.totalIncome - taxSummary.totalTax), color: C.accent, hint: "Sell-to-cover basis" },
          { label: "Shares Kept (STC)",  val: taxSummary.totalShrsKept.toLocaleString(), color: C.gold, hint: "After sell-to-cover on all tranches" },
          { label: "Vesting Schedule",   val: vestingType, color: C.purple, hint: `Grant date: ${grantDate}` },
        ].map((k, i) => (
          <Card key={i}>
            <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: k.color, fontFamily: mono }}>{k.val}</div>
            {k.hint && <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontFamily: sans }}>{k.hint}</div>}
          </Card>
        ))}
      </div>
    </div>
  );

  // ─── Tab: Tax ──────────────────────────────────────────────────────────────

  const TaxTab = (
    <div>
      <Card style={{ marginBottom: 12 }}>
        <SectionLabel>Tax at Vest — Annual Breakdown</SectionLabel>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: mono }}>
            <thead>
              <tr>
                {["Year", "FMV at Vest", "Gross Income", "Fed Tax", "State Tax", "FICA", "Total Tax", "After-Tax Net", "Eff. Rate"].map(h => (
                  <th key={h} style={{
                    textAlign: h === "Year" ? "left" : "right",
                    padding: "5px 10px", color: C.muted, fontWeight: 400,
                    borderBottom: `1px solid ${C.border}`, fontSize: 10,
                    textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vestSchedule.map((v, i) => {
                const fedTax   = v.grossIncome * marginalFedRate / 100;
                const stateTax = v.grossIncome * marginalStateRate / 100;
                const ficaTax  = v.grossIncome * ficaRate / 100;
                const total    = fedTax + stateTax + ficaTax;
                const net      = v.grossIncome - total;
                const er       = v.grossIncome > 0 ? total / v.grossIncome : 0;
                const isPast   = v.year < currentYear;
                return (
                  <tr key={i} style={{
                    background: v.year === nextVest?.year ? C.accent + "08" : "transparent",
                    borderBottom: `1px solid ${C.border}22`,
                    opacity: isPast ? 0.55 : 1,
                  }}>
                    <td style={{ padding: "7px 10px", color: C.accent }}>{v.year}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: C.blue }}>{fmt(v.fmvAtVest)}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: C.gold, fontWeight: 600 }}>{fmt(v.grossIncome)}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: C.red }}>{fmt(fedTax)}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: C.orange }}>{fmt(stateTax)}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: C.mutedLight }}>{fmt(ficaTax)}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: C.red, fontWeight: 600 }}>{fmt(total)}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: C.accent, fontWeight: 600 }}>{fmt(net)}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: C.textDim }}>{pct(er)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="co-grid-2">
        <Card>
          <SectionLabel>Sell-to-Cover Mechanics</SectionLabel>
          <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans, lineHeight: 1.6, marginBottom: 14 }}>
            Sell-to-cover (STC) means your broker automatically sells enough shares to cover the tax
            withholding. You receive the rest. For RSUs, this is typically at the supplemental federal
            withholding rate (22%) plus state — though your actual liability may be higher.
          </div>
          {vestSchedule.map((v, i) => (
            <div key={i} style={{ marginBottom: 10, padding: "10px 12px", background: C.surfaceAlt, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.accent, fontFamily: mono }}>{v.year}</span>
                <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono }}>{v.sharesVested.toLocaleString()} shares</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase" }}>Shares Sold</div>
                  <div style={{ fontSize: 13, color: C.red, fontFamily: mono, fontWeight: 600 }}>{v.sellToCoverShares.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase" }}>Cash (Tax)</div>
                  <div style={{ fontSize: 13, color: C.orange, fontFamily: mono, fontWeight: 600 }}>{fmt(v.taxAmount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase" }}>Shares Kept</div>
                  <div style={{ fontSize: 13, color: C.accent, fontFamily: mono, fontWeight: 600 }}>{v.sharesKept.toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <SectionLabel>Total Income Context</SectionLabel>
          <div style={{ marginBottom: 12 }}>
            {vestSchedule.map((v, i) => {
              const totalIncomeAtVest = salaryBase + v.grossIncome;
              const barW = Math.min(100, (v.grossIncome / Math.max(totalIncomeAtVest, 1)) * 100);
              return (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono }}>{v.year}</span>
                    <span style={{ fontSize: 11, color: C.gold, fontFamily: mono }}>{fmt(totalIncomeAtVest)} total</span>
                  </div>
                  <div style={{ height: 6, background: C.muted + "44", borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${barW}%`, background: C.gold, borderRadius: 3 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                    <span style={{ fontSize: 9, color: C.muted, fontFamily: mono }}>Salary: {fmt(salaryBase)}</span>
                    <span style={{ fontSize: 9, color: C.gold, fontFamily: mono }}>RSU: {fmt(v.grossIncome)} ({pct(v.grossIncome / Math.max(totalIncomeAtVest, 1))})</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ background: C.surfaceAlt, borderRadius: 6, padding: "10px 12px", marginTop: 4 }}>
            <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", marginBottom: 6 }}>Lifetime Grant Tax Summary</div>
            {[
              { label: "Total Gross Income (RSU)", val: fmt(taxSummary.totalIncome), color: C.gold },
              { label: "Total Tax Owed",           val: fmt(taxSummary.totalTax),    color: C.red },
              { label: "Net After-Tax Value",      val: fmt(taxSummary.totalIncome - taxSummary.totalTax), color: C.accent },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: C.textDim, fontFamily: mono }}>{r.label}</span>
                <span style={{ fontSize: 12, color: r.color, fontFamily: mono, fontWeight: 600 }}>{r.val}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  // ─── Tab: Sell vs Hold ─────────────────────────────────────────────────────

  const SellVsHoldTab = (
    <div>
      {sellVsHold ? (
        <>
          <div className="co-grid-3" style={{ marginBottom: 12 }}>
            {[
              {
                label: "Sell All at Vest",
                val: fmt(sellVsHold.sellAll),
                color: C.accent,
                sub: "Net after tax — zero market risk",
                tag: "LOWEST RISK",
                tagColor: C.accent,
              },
              {
                label: "Sell to Cover",
                val: fmt(sellVsHold.sellToCoverVal),
                color: C.gold,
                sub: `Keep ${sellVsHold.sharesKept.toLocaleString()} shares + tax cash`,
                tag: "BALANCED",
                tagColor: C.gold,
              },
              {
                label: "Hold All",
                val: fmt(sellVsHold.holdAll),
                color: C.blue,
                sub: `Must pay ${fmt(sellVsHold.taxAmount)} tax from cash`,
                tag: "MAX UPSIDE",
                tagColor: C.blue,
              },
            ].map((opt, i) => (
              <Card key={i} style={{ textAlign: "center" }}>
                <Tag color={opt.tagColor}>{opt.tag}</Tag>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", marginTop: 10, marginBottom: 6 }}>{opt.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: opt.color, fontFamily: mono, marginBottom: 6 }}>{opt.val}</div>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: sans }}>{opt.sub}</div>
              </Card>
            ))}
          </div>

          <Card style={{ marginBottom: 12 }}>
            <SectionLabel>Next Vest Detail — {nextVest?.year}</SectionLabel>
            <div className="co-grid-2">
              <div>
                {[
                  { label: "Shares Vesting",   val: sellVsHold.sharesVested.toLocaleString(), color: C.text },
                  { label: "FMV at Vest",       val: fmt(sellVsHold.fmvAtVest),               color: C.blue },
                  { label: "Gross Income",      val: fmt(sellVsHold.grossIncome),              color: C.gold },
                  { label: "Tax Owed",          val: fmt(sellVsHold.taxAmount),                color: C.red },
                  { label: "Shares Sold (STC)", val: sellVsHold.sellToCoverShares.toLocaleString(), color: C.orange },
                  { label: "Shares Kept (STC)", val: sellVsHold.sharesKept.toLocaleString(),   color: C.accent },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: i < 5 ? `1px solid ${C.border}22` : "none" }}>
                    <span style={{ fontSize: 11, color: C.textDim, fontFamily: mono }}>{r.label}</span>
                    <span style={{ fontSize: 12, color: r.color, fontFamily: mono, fontWeight: 600 }}>{r.val}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", marginBottom: 10 }}>Post-Vest Holding (if keep shares)</div>
                {[1, 2, 3].map(yrs => {
                  const projFMV = sellVsHold.fmvAtVest * Math.pow(1 + expectedAnnualGrowth / 100, yrs);
                  const proj    = sellVsHold.sharesKept * projFMV;
                  const gain    = proj - sellVsHold.sharesKept * sellVsHold.fmvAtVest;
                  return (
                    <div key={yrs} style={{ marginBottom: 8, padding: "8px 12px", background: C.surfaceAlt, borderRadius: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono }}>+{yrs} yr{yrs > 1 ? "s" : ""} held</span>
                        <span style={{ fontSize: 12, color: C.accent, fontFamily: mono, fontWeight: 600 }}>{fmt(proj)}</span>
                      </div>
                      <div style={{ fontSize: 9, color: gain >= 0 ? C.accent : C.red, fontFamily: mono, marginTop: 2 }}>
                        {gain >= 0 ? "+" : ""}{fmt(gain)} vs vest-day value · LTCG applies if &gt;1yr
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card>
            <SectionLabel>Stock Price Sensitivity — Next Vest</SectionLabel>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: mono }}>
                <thead>
                  <tr>
                    {["Scenario", "FMV at Vest", "Gross Income", "Tax", "Sell All (Net)", "STC Shares", "Hold Value"].map(h => (
                      <th key={h} style={{
                        textAlign: h === "Scenario" ? "left" : "right",
                        padding: "5px 10px", color: C.muted, fontWeight: 400,
                        borderBottom: `1px solid ${C.border}`, fontSize: 10,
                        textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {priceSensitivity.map((row, i) => (
                    <tr key={i} style={{
                      background: row.isCurrent ? C.accent + "08" : "transparent",
                      borderBottom: `1px solid ${C.border}22`,
                    }}>
                      <td style={{ padding: "7px 10px", color: row.delta < 0 ? C.red : row.delta > 0 ? C.accent : C.gold, fontWeight: row.isCurrent ? 700 : 400 }}>
                        {row.delta > 0 ? "+" : ""}{(row.delta * 100).toFixed(0)}%
                        {row.isCurrent && <span style={{ marginLeft: 6, fontSize: 9, color: C.gold, background: C.gold + "22", borderRadius: 3, padding: "1px 5px" }}>BASE</span>}
                      </td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: C.blue }}>{fmt(row.adjFMV)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: C.gold }}>{fmt(row.income)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: C.red }}>{fmt(row.tax)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: C.accent, fontWeight: 600 }}>{fmt(row.sellAllNet)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: C.orange }}>{row.stcShares.toLocaleString()}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: C.blue }}>{fmt(row.holdVal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <div style={{ textAlign: "center", padding: "32px 0", color: C.muted, fontFamily: mono, fontSize: 13 }}>
            No upcoming vest events. Adjust grant date and vesting schedule.
          </div>
        </Card>
      )}
    </div>
  );

  // ─── Tab: Concentration ────────────────────────────────────────────────────

  const ConcentrationTab = (
    <div>
      <div className="co-grid-2" style={{ marginBottom: 12 }}>
        <Card>
          <SectionLabel>Inputs</SectionLabel>
          <Sl label="Total Net Worth ($)" value={totalNetWorth} min={100000} max={10000000} step={50000}
            onChange={setTotalNetWorth} color={C.blue} hint="Include all assets minus liabilities" />
          <Sl label="% Invested Outside Employer Stock" value={pctOutsideEmployer} min={0} max={100} step={1}
            onChange={setPctOutsideEmployer} color={C.accent}
            fmt={fmtPct} hint="How much of your non-employer-stock investments are diversified" />
        </Card>

        <Card>
          <SectionLabel>Current Concentration</SectionLabel>
          {[
            { label: "Total Grant Value",    val: fmt(concRisk.grantValue),           color: C.blue },
            { label: "Unvested Value",       val: fmt(concRisk.unvestedVal),          color: C.purple },
            { label: "Grant % of NW",        val: pct(concRisk.grantPctNW),           color: concRisk.level === "danger" ? C.red : concRisk.level === "warn" ? C.orange : C.accent },
            { label: "Unvested % of NW",     val: pct(concRisk.unvestedPctNW),        color: C.mutedLight },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: i < 3 ? `1px solid ${C.border}22` : "none" }}>
              <span style={{ fontSize: 11, color: C.textDim, fontFamily: mono }}>{r.label}</span>
              <span style={{ fontSize: 13, color: r.color, fontFamily: mono, fontWeight: 600 }}>{r.val}</span>
            </div>
          ))}

          {/* Concentration bar */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase" }}>Concentration Level</span>
              <span style={{ fontSize: 11, fontFamily: mono, color: concRisk.level === "danger" ? C.red : concRisk.level === "warn" ? C.orange : C.accent }}>
                {concRisk.level === "danger" ? "HIGH RISK" : concRisk.level === "warn" ? "ELEVATED" : "ACCEPTABLE"}
              </span>
            </div>
            <div style={{ height: 8, background: C.muted + "44", borderRadius: 4 }}>
              <div style={{
                height: "100%", borderRadius: 4,
                width: `${Math.min(100, concRisk.grantPctNW * 100)}%`,
                background: concRisk.level === "danger" ? C.red : concRisk.level === "warn" ? C.orange : C.accent,
                transition: "width 0.3s",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
              <span style={{ fontSize: 9, color: C.muted, fontFamily: mono }}>0%</span>
              <span style={{ fontSize: 9, color: C.accent, fontFamily: mono }}>10% target</span>
              <span style={{ fontSize: 9, color: C.orange, fontFamily: mono }}>20% warn</span>
              <span style={{ fontSize: 9, color: C.red, fontFamily: mono }}>40% danger</span>
              <span style={{ fontSize: 9, color: C.muted, fontFamily: mono }}>100%</span>
            </div>
          </div>
        </Card>
      </div>

      {concRisk.level !== "ok" && (
        <WarningBadge level={concRisk.level}>
          {concRisk.level === "danger"
            ? `⚠ HIGH CONCENTRATION: ${pct(concRisk.grantPctNW)} of net worth in a single stock. Significant financial risk — consider systematic diversification.`
            : `⚠ ELEVATED CONCENTRATION: ${pct(concRisk.grantPctNW)} of net worth in employer stock. >20% in a single stock is considered above-normal risk.`}
        </WarningBadge>
      )}

      {concRisk.level === "ok" && (
        <WarningBadge level="ok">
          Concentration looks reasonable at {pct(concRisk.grantPctNW)} of net worth. Continue monitoring as unvested shares vest.
        </WarningBadge>
      )}

      <div className="co-grid-2">
        <Card>
          <SectionLabel>Recommended Diversification Schedule</SectionLabel>
          {concRisk.sharesPerQtr > 0 ? (
            <>
              <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans, lineHeight: 1.6, marginBottom: 14 }}>
                To reduce employer stock from {pct(concRisk.grantPctNW)} to &lt;10% of net worth within 2 years
                (8 quarters), sell approximately{" "}
                <span style={{ color: C.gold, fontFamily: mono, fontWeight: 600 }}>
                  {concRisk.sharesPerQtr.toLocaleString()} shares / quarter
                </span>
                {" "}({fmt(concRisk.sharesPerQtr * currentFMV)} / quarter at current FMV).
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: mono }}>
                  <thead>
                    <tr>
                      {["Quarter", "Shares to Sell", "Proceeds (est.)", "Remaining Shares", "Conc. %"].map(h => (
                        <th key={h} style={{
                          textAlign: h === "Quarter" ? "left" : "right",
                          padding: "4px 8px", color: C.muted, fontWeight: 400,
                          borderBottom: `1px solid ${C.border}`, fontSize: 9,
                          textTransform: "uppercase",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 8 }, (_, qi) => {
                      const remainAfter = Math.max(0, grantShares - concRisk.sharesPerQtr * (qi + 1));
                      const concAfter   = totalNetWorth > 0 ? (remainAfter * currentFMV) / totalNetWorth : 0;
                      return (
                        <tr key={qi} style={{ borderBottom: `1px solid ${C.border}22` }}>
                          <td style={{ padding: "5px 8px", color: C.accent }}>Q{(qi % 4) + 1} {currentYear + Math.floor(qi / 4)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: C.orange }}>{concRisk.sharesPerQtr.toLocaleString()}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: C.gold }}>{fmt(concRisk.sharesPerQtr * currentFMV)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: C.text }}>{remainAfter.toLocaleString()}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: concAfter < 0.10 ? C.accent : concAfter < 0.20 ? C.orange : C.red }}>
                            {pct(concAfter)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: C.accent, fontFamily: mono, padding: "12px 0" }}>
              Grant is already below 10% of net worth. No systematic selling required.
            </div>
          )}
        </Card>

        <Card>
          <SectionLabel>Risk Commentary</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              {
                title: "Correlation Risk",
                body: "Your salary and equity are both tied to your employer's performance. A company downturn could reduce your income and your equity value simultaneously — a double-hit not present in diversified portfolios.",
                color: C.orange,
              },
              {
                title: "Vesting Cliff Timing",
                body: `You have ${fmt(unvestedValue)} in unvested equity. Leaving before vesting forfeits this value. Factor cliff dates into any job change decisions.`,
                color: C.blue,
              },
              {
                title: "Post-Vest Capital Gains",
                body: "Shares held >1 year after vest are taxed at long-term capital gains rates (0/15/20%) on appreciation, not ordinary income. Consider holding strategy for appreciated tranches.",
                color: C.accent,
              },
              {
                title: "Tax Diversification",
                body: `At ${fmtPct(marginalFedRate + marginalStateRate + ficaRate)} combined rate, the tax cost to vest and sell all is ${fmt(taxSummary.totalTax)}. Spreading sales across tax years or using sell-to-cover minimizes cash tax burden.`,
                color: C.purple,
              },
            ].map((item, i) => (
              <div key={i} style={{ padding: "10px 12px", borderLeft: `3px solid ${item.color}`, background: item.color + "08", borderRadius: "0 6px 6px 0" }}>
                <div style={{ fontSize: 11, color: item.color, fontFamily: mono, fontWeight: 600, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans, lineHeight: 1.5 }}>{item.body}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: sans }}>

      {/* ── HEADER ── */}
      <div className="co-header-pad" style={{ background: `linear-gradient(180deg, #0a0f1e 0%, ${C.bg} 100%)`, borderBottom: `1px solid ${C.border}` }}>
        <div className="co-header-row">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 17, fontWeight: 700, fontFamily: mono, color: C.accent, letterSpacing: "0.03em" }}>
                RSU / EQUITY MODELER
              </span>
              <Tag color={C.gold}>NC · 2024</Tag>
              <Tag color={grantType === "rsu" ? C.blue : C.purple}>{grantType.toUpperCase()}</Tag>
            </div>
            <div className="co-mob-hide" style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, marginTop: 3 }}>
              Objective: model vesting schedule, tax at vest, and concentration risk for equity compensation
            </div>
          </div>

          {/* KPI Row */}
          <div className="co-kpi-row">
            {[
              { label: "Grant Value",  val: fmt(totalGrantValue),                        color: C.text },
              { label: "Unvested",     val: `${unvestedShares.toLocaleString()} sh · ${fmt(unvestedValue)}`, color: C.blue },
              { label: "Next Vest",    val: nextVest ? `${nextVest.year} · ${nextVest.sharesVested.toLocaleString()} sh` : "—", color: C.gold },
              { label: "Tax Rate",     val: fmtPct(marginalFedRate + marginalStateRate + ficaRate), color: C.red },
            ].map((k, i) => (
              <div key={k.label} style={{
                textAlign: "right",
                paddingLeft: 16, paddingRight: 4, paddingTop: 4, paddingBottom: 4,
                borderLeft: i > 0 ? `1px solid ${C.border}` : "none",
                marginLeft: i > 0 ? 4 : 0,
                minWidth: 0,
              }}>
                <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{k.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: k.color, fontFamily: mono, whiteSpace: "nowrap" }}>{k.val}</div>
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

      {/* ── MAIN CONTENT ── */}
      <div className="co-content-pad">
        <div className="co-grid-lt">
          {/* Left: Config Panel */}
          {ConfigPanel}

          {/* Right: Tab Content */}
          <div>
            {tab === "schedule"      && ScheduleTab}
            {tab === "tax"           && TaxTab}
            {tab === "sellvshold"    && SellVsHoldTab}
            {tab === "concentration" && ConcentrationTab}
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="co-footer-pad">
        <div style={{ fontSize: 10, color: C.muted, fontFamily: sans, lineHeight: 1.6 }}>
          Federal supplemental withholding rate used for RSU/NSO calculations · Actual tax may vary based on total income ·
          Capital gains treatment applies to post-vest appreciation held &gt;1 year · Not financial or tax advice.
        </div>
      </div>
    </div>
  );
}
