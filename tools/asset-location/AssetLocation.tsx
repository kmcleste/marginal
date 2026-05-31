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

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetClass {
  id: string;
  name: string;
  expectedReturn: number;
  ordinaryIncomeYield: number;
  qualifiedDivYield: number;
  turnoverRate: number;
  foreignTaxCredit: boolean;
  preferredLocation: "taxable" | "traditional" | "roth";
  reason: string;
}

type AccountType = "taxable" | "traditional" | "roth";

// ─── Asset class data ─────────────────────────────────────────────────────────

const ASSET_CLASSES: AssetClass[] = [
  { id: "us_bonds",    name: "US Bonds / Bond Funds",        expectedReturn: 5.0, ordinaryIncomeYield: 4.5, qualifiedDivYield: 0,   turnoverRate: 0.20, foreignTaxCredit: false, preferredLocation: "traditional", reason: "Interest taxed as ordinary income — high drag in taxable" },
  { id: "tips",        name: "TIPS / Inflation-Linked Bonds", expectedReturn: 4.5, ordinaryIncomeYield: 4.0, qualifiedDivYield: 0,   turnoverRate: 0.10, foreignTaxCredit: false, preferredLocation: "traditional", reason: "Phantom income (inflation adjustments taxed yearly) — must shelter" },
  { id: "reits",       name: "REITs",                         expectedReturn: 8.0, ordinaryIncomeYield: 3.5, qualifiedDivYield: 0.5, turnoverRate: 0.15, foreignTaxCredit: false, preferredLocation: "roth",        reason: "Non-qualified dividends taxed as ordinary income; high yield → Roth" },
  { id: "us_growth",   name: "US Growth Stocks / Index",      expectedReturn: 9.0, ordinaryIncomeYield: 0.2, qualifiedDivYield: 1.3, turnoverRate: 0.03, foreignTaxCredit: false, preferredLocation: "taxable",     reason: "Low turnover, qualified dividends — very tax-efficient in taxable" },
  { id: "intl_stocks", name: "International Stocks",          expectedReturn: 7.5, ordinaryIncomeYield: 0.5, qualifiedDivYield: 2.5, turnoverRate: 0.05, foreignTaxCredit: true,  preferredLocation: "taxable",     reason: "Foreign tax credit only available in taxable accounts — place here" },
  { id: "small_value", name: "Small Cap Value",               expectedReturn: 9.5, ordinaryIncomeYield: 1.0, qualifiedDivYield: 1.5, turnoverRate: 0.08, foreignTaxCredit: false, preferredLocation: "roth",        reason: "Higher expected return — maximize tax-free compounding in Roth" },
  { id: "high_yield",  name: "High-Yield / Corporate Bonds",  expectedReturn: 6.5, ordinaryIncomeYield: 5.5, qualifiedDivYield: 0,   turnoverRate: 0.25, foreignTaxCredit: false, preferredLocation: "traditional", reason: "High yield taxed as ordinary income — highest tax drag in taxable" },
  { id: "commodities", name: "Commodities / Gold ETFs",       expectedReturn: 5.0, ordinaryIncomeYield: 0,   qualifiedDivYield: 0,   turnoverRate: 0.30, foreignTaxCredit: false, preferredLocation: "traditional", reason: "Collectibles rate (28%) applies to gold ETFs — shelter if possible" },
];

const ASSET_COLORS: Record<string, string> = {
  us_bonds:    "#4a9eff",
  tips:        "#00b8d9",
  reits:       "#a855f7",
  us_growth:   "#00e5a0",
  intl_stocks: "#f0c040",
  small_value: "#ff8c3a",
  high_yield:  "#ff4a4a",
  commodities: "#8888a8",
};

const LOC_COLOR: Record<AccountType, string> = {
  taxable: C.accent,
  traditional: C.blue,
  roth: C.purple,
};

const LOC_LABEL: Record<AccountType, string> = {
  taxable: "Taxable",
  traditional: "Traditional",
  roth: "Roth",
};

// ─── Math ─────────────────────────────────────────────────────────────────────

function taxDragRate(asset: AssetClass, location: AccountType, ordRate: number, ltcgRate: number): number {
  if (location === "roth") return 0;
  if (location === "traditional") return 0;
  const ordDrag      = asset.ordinaryIncomeYield / 100 * ordRate / 100;
  const divDrag      = asset.qualifiedDivYield   / 100 * ltcgRate / 100;
  const turnoverDrag = asset.expectedReturn / 100 * asset.turnoverRate * ltcgRate / 100;
  return ordDrag + divDrag + turnoverDrag;
}

function afterTaxReturn(asset: AssetClass, location: AccountType, ordRate: number, ltcgRate: number): number {
  return asset.expectedReturn / 100 - taxDragRate(asset, location, ordRate, ltcgRate);
}

// ─── UI components ────────────────────────────────────────────────────────────

function Card({ children, style, glow, goldGlow }: {
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
    }}>{children}</div>
  );
}

function Sl({ label, value, min, max, step, onChange, color = C.accent, fmt: fmtFn = fmt, hint }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; color?: string; fmt?: (v: number) => string; hint?: string;
}) {
  const fill = clamp((value - min) / (max - min || 1), 0, 1) * 100;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
        <span style={{ fontSize: 12, color, fontFamily: mono, fontWeight: 600 }}>{fmtFn(value)}</span>
      </div>
      <div style={{ position: "relative", height: 4, background: C.muted + "44", borderRadius: 2 }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${fill}%`, background: color, borderRadius: 2, transition: "width 0.2s" }} />
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", marginTop: 2, accentColor: color }} />
      {hint && <div style={{ fontSize: 9, color: C.muted, marginTop: 1, fontFamily: sans }}>{hint}</div>}
    </div>
  );
}

function Tag({ children, color = C.accent }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}44`,
      borderRadius: 4, padding: "1px 6px", fontSize: 10, fontFamily: mono,
    }}>{children}</span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, marginTop: 4 }}>
      {children}
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({
  taxableBalance, setTaxableBalance,
  traditionalBal, setTraditionalBal,
  rothBalance, setRothBalance,
  ordinaryRate, setOrdinaryRate,
  ltcgRate, setLtcgRate,
  alloc,
  currentLoc,
  calc,
}: {
  taxableBalance: number; setTaxableBalance: (v: number) => void;
  traditionalBal: number; setTraditionalBal: (v: number) => void;
  rothBalance: number; setRothBalance: (v: number) => void;
  ordinaryRate: number; setOrdinaryRate: (v: number) => void;
  ltcgRate: number; setLtcgRate: (v: number) => void;
  alloc: Record<string, number>;
  currentLoc: Record<string, AccountType>;
  calc: {
    totalPortfolio: number;
    currentAnnualDrag: number;
    optimalAnnualDrag: number;
    annualSavings: number;
  };
}) {
  const PRIORITY_MATRIX = [
    {
      account: "Taxable",
      color: C.accent,
      best: "US growth stocks, international stocks, broad index ETFs",
      why: "Low dividend yield, qualifies for LTCG rates, foreign tax credit available",
    },
    {
      account: "Traditional / 401k",
      color: C.blue,
      best: "Bonds, TIPS, high-yield bonds, commodities",
      why: "High ordinary income yield — shelter from annual taxation; defer until distribution",
    },
    {
      account: "Roth IRA",
      color: C.purple,
      best: "REITs, small cap value, highest-return / highest-yield assets",
      why: "Tax-free forever — maximize by holding assets with highest expected return or yield",
    },
  ];

  return (
    <div className="co-grid-lt" style={{ gap: 20 }}>
      {/* Left: config */}
      <div>
        <Card>
          <SectionLabel>Account Balances</SectionLabel>
          <Sl label="Taxable Brokerage" value={taxableBalance} min={0} max={2000000} step={10000}
            onChange={setTaxableBalance} color={C.accent} />
          <Sl label="Traditional IRA / 401k" value={traditionalBal} min={0} max={2000000} step={10000}
            onChange={setTraditionalBal} color={C.blue} />
          <Sl label="Roth IRA / Roth 401k" value={rothBalance} min={0} max={2000000} step={10000}
            onChange={setRothBalance} color={C.purple} />
        </Card>
        <div style={{ height: 12 }} />
        <Card>
          <SectionLabel>Tax Rates</SectionLabel>
          <Sl label="Ordinary Income Rate (Fed + State)" value={ordinaryRate} min={10} max={60} step={1}
            onChange={setOrdinaryRate} color={C.red}
            fmt={v => `${v}%`}
            hint="Combined federal + state marginal rate on interest, non-qualified dividends" />
          <Sl label="Long-Term Capital Gains Rate" value={ltcgRate} min={0} max={40} step={1}
            onChange={setLtcgRate} color={C.orange}
            fmt={v => `${v}%`}
            hint="Federal 0/15/20% + net investment income tax 3.8% + state rate" />
        </Card>
      </div>

      {/* Right: results */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Summary card */}
        <Card glow>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Portfolio Summary
          </div>
          <div className="co-grid-2b">
            {[
              { label: "Total Portfolio", value: fmtK(calc.totalPortfolio), color: C.text },
              { label: "Taxable Allocation", value: pct(taxableBalance / (calc.totalPortfolio || 1)), color: C.accent },
              { label: "Current Annual Tax Drag", value: fmt(calc.currentAnnualDrag), color: C.red },
              { label: "Optimal Annual Drag", value: fmt(calc.optimalAnnualDrag), color: C.orange },
              { label: "Potential Annual Savings", value: fmt(calc.annualSavings), color: C.gold },
              { label: "Drag Reduction", value: calc.currentAnnualDrag > 0 ? pct(calc.annualSavings / calc.currentAnnualDrag) : "—", color: C.accent },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: "8px 10px", background: C.surfaceAlt, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 14, color, fontFamily: mono, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Asset allocation visual */}
        <Card>
          <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Account Mix
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {(["taxable", "traditional", "roth"] as AccountType[]).map(acct => {
              const bal = acct === "taxable" ? taxableBalance : acct === "traditional" ? traditionalBal : rothBalance;
              const pctVal = calc.totalPortfolio > 0 ? (bal / calc.totalPortfolio) * 100 : 0;
              return (
                <div key={acct} style={{ flex: pctVal, minWidth: 0, background: LOC_COLOR[acct] + "33", border: `1px solid ${LOC_COLOR[acct]}44`, borderRadius: 6, padding: "6px 8px" }}>
                  <div style={{ fontSize: 9, color: LOC_COLOR[acct], fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.07em" }}>{LOC_LABEL[acct]}</div>
                  <div style={{ fontSize: 12, color: C.text, fontFamily: mono, fontWeight: 700 }}>{fmtK(bal)}</div>
                  <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono }}>{pctVal.toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Location priority matrix */}
        <Card goldGlow>
          <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Location Priority Matrix
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PRIORITY_MATRIX.map(row => (
              <div key={row.account} style={{
                display: "grid", gridTemplateColumns: "120px 1fr 1fr",
                gap: 10, padding: "10px 12px",
                background: row.color + "0d", border: `1px solid ${row.color}33`, borderRadius: 8,
              }}>
                <div>
                  <div style={{ fontSize: 10, color: row.color, fontFamily: mono, fontWeight: 700 }}>{row.account}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: sans, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Best for</div>
                  <div style={{ fontSize: 10, color: C.text, fontFamily: sans, lineHeight: 1.4 }}>{row.best}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: sans, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Why</div>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, lineHeight: 1.4 }}>{row.why}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Tab: Allocation ──────────────────────────────────────────────────────────

function AllocationTab({
  alloc, setAlloc,
  currentLoc, setCurrentLoc,
  ordinaryRate, ltcgRate,
  totalPortfolio,
}: {
  alloc: Record<string, number>;
  setAlloc: (a: Record<string, number>) => void;
  currentLoc: Record<string, AccountType>;
  setCurrentLoc: (l: Record<string, AccountType>) => void;
  ordinaryRate: number; ltcgRate: number;
  totalPortfolio: number;
}) {
  const allocTotal = useMemo(() => ASSET_CLASSES.reduce((s, a) => s + (alloc[a.id] ?? 0), 0), [alloc]);
  const isValid = Math.abs(allocTotal - 100) < 0.01;

  function normalize() {
    const total = allocTotal;
    if (total === 0) return;
    const next: Record<string, number> = {};
    for (const a of ASSET_CLASSES) next[a.id] = Math.round(((alloc[a.id] ?? 0) / total) * 1000) / 10;
    setAlloc(next);
  }

  function setLoc(id: string, loc: AccountType) {
    setCurrentLoc({ ...currentLoc, [id]: loc });
  }

  function fixAll() {
    const next: Record<string, AccountType> = {};
    for (const a of ASSET_CLASSES) next[a.id] = a.preferredLocation;
    setCurrentLoc(next);
  }

  return (
    <div className="co-grid-lt" style={{ gap: 20 }}>
      {/* Left: sliders */}
      <div>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <SectionLabel>Target Allocation</SectionLabel>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Tag color={isValid ? C.accent : C.red}>{allocTotal.toFixed(1)}%</Tag>
              {!isValid && (
                <button onClick={normalize} style={{
                  background: C.gold + "22", border: `1px solid ${C.gold}44`, color: C.gold,
                  borderRadius: 4, padding: "2px 8px", fontSize: 10, fontFamily: mono, cursor: "pointer",
                }}>Normalize</button>
              )}
            </div>
          </div>
          {!isValid && (
            <div style={{ fontSize: 10, color: C.orange, fontFamily: sans, marginBottom: 10, padding: "6px 8px", background: C.orange + "11", borderRadius: 6, border: `1px solid ${C.orange}33` }}>
              Allocation sums to {allocTotal.toFixed(1)}% — must equal 100%. Click Normalize to fix.
            </div>
          )}
          {ASSET_CLASSES.map(a => (
            <Sl key={a.id} label={a.name} value={alloc[a.id] ?? 0} min={0} max={60} step={1}
              onChange={v => setAlloc({ ...alloc, [a.id]: v })}
              color={ASSET_COLORS[a.id] ?? C.accent}
              fmt={v => `${v}%`} />
          ))}
        </Card>
      </div>

      {/* Right: stacked bar + per-asset controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Stacked composition bar */}
        <Card>
          <SectionLabel>Portfolio Composition</SectionLabel>
          <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
            {ASSET_CLASSES.filter(a => (alloc[a.id] ?? 0) > 0).map(a => (
              <div key={a.id} style={{
                flex: alloc[a.id] ?? 0,
                background: ASSET_COLORS[a.id] ?? C.accent,
                position: "relative",
                transition: "flex 0.2s",
              }}
                title={`${a.name}: ${alloc[a.id] ?? 0}%`}
              />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 8 }}>
            {ASSET_CLASSES.filter(a => (alloc[a.id] ?? 0) > 0).map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: ASSET_COLORS[a.id] ?? C.accent }} />
                <span style={{ fontSize: 9, color: C.textDim, fontFamily: sans }}>{a.name} ({alloc[a.id] ?? 0}%)</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Per-asset location controls */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <SectionLabel>Asset Location Assignment</SectionLabel>
            <button onClick={fixAll} style={{
              background: C.accent + "22", border: `1px solid ${C.accent}44`, color: C.accent,
              borderRadius: 4, padding: "2px 10px", fontSize: 10, fontFamily: mono, cursor: "pointer",
            }}>Fix All</button>
          </div>
          {ASSET_CLASSES.map(a => {
            const loc = currentLoc[a.id] ?? "taxable";
            const drag = taxDragRate(a, loc, ordinaryRate, ltcgRate);
            const optDrag = taxDragRate(a, a.preferredLocation, ordinaryRate, ltcgRate);
            const allocPct = (alloc[a.id] ?? 0) / 100;
            const annualDragDollars = drag * allocPct * totalPortfolio;
            const optDragDollars = optDrag * allocPct * totalPortfolio;
            const isOptimal = loc === a.preferredLocation;
            return (
              <div key={a.id} style={{
                padding: "10px 12px", marginBottom: 8,
                background: isOptimal ? C.accent + "08" : C.red + "08",
                border: `1px solid ${isOptimal ? C.accent + "22" : C.red + "22"}`,
                borderRadius: 8,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: ASSET_COLORS[a.id] ?? C.accent, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: C.text, fontFamily: sans, fontWeight: 600 }}>{a.name}</span>
                    <Tag color={LOC_COLOR[a.preferredLocation]}>Optimal: {LOC_LABEL[a.preferredLocation]}</Tag>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <select value={loc} onChange={e => setLoc(a.id, e.target.value as AccountType)}
                      style={{
                        background: C.surfaceAlt, border: `1px solid ${LOC_COLOR[loc]}44`,
                        color: LOC_COLOR[loc], borderRadius: 4, padding: "2px 6px",
                        fontSize: 10, fontFamily: mono, cursor: "pointer",
                      }}>
                      <option value="taxable">Taxable</option>
                      <option value="traditional">Traditional</option>
                      <option value="roth">Roth</option>
                    </select>
                    {!isOptimal && (
                      <button onClick={() => setLoc(a.id, a.preferredLocation)} style={{
                        background: C.accent + "22", border: `1px solid ${C.accent}44`, color: C.accent,
                        borderRadius: 4, padding: "2px 8px", fontSize: 10, fontFamily: mono, cursor: "pointer",
                      }}>Fix</button>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono }}>
                    Drag: <span style={{ color: drag > 0 ? C.red : C.accent }}>{(drag * 100).toFixed(3)}%</span> = <span style={{ color: drag > 0 ? C.red : C.accent }}>{fmt(annualDragDollars)}/yr</span>
                  </span>
                  <span style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono }}>
                    Optimal drag: <span style={{ color: optDrag > 0 ? C.orange : C.accent }}>{fmt(optDragDollars)}/yr</span>
                  </span>
                  {!isOptimal && annualDragDollars - optDragDollars > 0 && (
                    <span style={{ fontSize: 9, color: C.gold, fontFamily: mono }}>
                      Save {fmt(annualDragDollars - optDragDollars)}/yr
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 9, color: C.muted, fontFamily: sans, marginTop: 4, lineHeight: 1.4 }}>{a.reason}</div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ─── Tab: Drag Analysis ───────────────────────────────────────────────────────

function DragAnalysisTab({
  alloc, currentLoc, ordinaryRate, ltcgRate, totalPortfolio,
}: {
  alloc: Record<string, number>;
  currentLoc: Record<string, AccountType>;
  ordinaryRate: number; ltcgRate: number;
  totalPortfolio: number;
}) {
  const rows = useMemo(() => ASSET_CLASSES.map(a => {
    const loc = currentLoc[a.id] ?? "taxable";
    const allocPct = (alloc[a.id] ?? 0) / 100;
    const currDrag = taxDragRate(a, loc, ordinaryRate, ltcgRate);
    const optDrag  = taxDragRate(a, a.preferredLocation, ordinaryRate, ltcgRate);
    const currDollars = currDrag * allocPct * totalPortfolio;
    const optDollars  = optDrag  * allocPct * totalPortfolio;
    const savings = currDollars - optDollars;
    return { asset: a, loc, allocPct, currDrag, optDrag, currDollars, optDollars, savings };
  }), [alloc, currentLoc, ordinaryRate, ltcgRate, totalPortfolio]);

  const totalCurrDrag = rows.reduce((s, r) => s + r.currDollars, 0);
  const totalOptDrag  = rows.reduce((s, r) => s + r.optDollars, 0);
  const totalSavings  = totalCurrDrag - totalOptDrag;
  const maxDrag = Math.max(...rows.map(r => r.currDollars), 1);

  // Compounding impact
  const avgReturn = ASSET_CLASSES.reduce((s, a) => s + (alloc[a.id] ?? 0) / 100 * a.expectedReturn / 100, 0);
  const dragRate  = totalPortfolio > 0 ? totalCurrDrag / totalPortfolio : 0;
  const optDragRate = totalPortfolio > 0 ? totalOptDrag / totalPortfolio : 0;
  const compoundRows = [10, 20, 30].map(years => {
    const fvCurr = totalPortfolio * Math.pow(1 + avgReturn - dragRate, years);
    const fvOpt  = totalPortfolio * Math.pow(1 + avgReturn - optDragRate, years);
    return { years, fvCurr, fvOpt, gain: fvOpt - fvCurr };
  });

  const barH = 140;
  const barW = 32;
  const chartItems = rows.filter(r => r.currDollars > 0 || r.optDollars > 0);

  return (
    <div className="co-grid-2" style={{ gap: 20 }}>
      {/* Left: table */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card>
          <SectionLabel>Per-Asset Tax Drag</SectionLabel>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: mono }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Asset", "Alloc", "Location", "Drag $/yr", "Optimal", "Opt $/yr", "Savings"].map(h => (
                    <th key={h} style={{ padding: "4px 8px", textAlign: "right", color: C.mutedLight, fontSize: 9, fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.asset.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                    <td style={{ padding: "6px 8px", color: ASSET_COLORS[r.asset.id] ?? C.text, textAlign: "right", whiteSpace: "nowrap", fontSize: 9 }}>
                      {r.asset.name.length > 18 ? r.asset.name.slice(0, 16) + "…" : r.asset.name}
                    </td>
                    <td style={{ padding: "6px 8px", color: C.textDim, textAlign: "right" }}>{((r.allocPct) * 100).toFixed(0)}%</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      <Tag color={LOC_COLOR[r.loc]}>{LOC_LABEL[r.loc]}</Tag>
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        <div style={{ width: Math.round((r.currDollars / maxDrag) * 40), height: 4, background: C.red + "88", borderRadius: 2 }} />
                        <span style={{ color: r.currDollars > 0 ? C.red : C.mutedLight }}>{fmt(r.currDollars)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      <Tag color={LOC_COLOR[r.asset.preferredLocation]}>{LOC_LABEL[r.asset.preferredLocation]}</Tag>
                    </td>
                    <td style={{ padding: "6px 8px", color: r.optDollars > 0 ? C.orange : C.accent, textAlign: "right" }}>{fmt(r.optDollars)}</td>
                    <td style={{ padding: "6px 8px", color: r.savings > 1 ? C.gold : C.mutedLight, textAlign: "right", fontWeight: 700 }}>
                      {r.savings > 0 ? fmt(r.savings) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `1px solid ${C.border}` }}>
                  <td colSpan={3} style={{ padding: "6px 8px", color: C.mutedLight, textAlign: "right", fontSize: 9 }}>Total</td>
                  <td style={{ padding: "6px 8px", color: C.red, textAlign: "right", fontWeight: 700 }}>{fmt(totalCurrDrag)}</td>
                  <td />
                  <td style={{ padding: "6px 8px", color: C.orange, textAlign: "right", fontWeight: 700 }}>{fmt(totalOptDrag)}</td>
                  <td style={{ padding: "6px 8px", color: C.gold, textAlign: "right", fontWeight: 700 }}>{fmt(totalSavings)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Compounding impact */}
        <Card goldGlow>
          <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Compounding Impact of Removing Drag
          </div>
          <div style={{ fontSize: 9, color: C.muted, fontFamily: sans, marginBottom: 10 }}>
            FV = Portfolio × (1 + return − drag)^years · assumes returns stay constant · drag compounds silently
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {compoundRows.map(row => (
              <div key={row.years} style={{
                padding: "10px 12px", background: C.surfaceAlt, borderRadius: 8, border: `1px solid ${C.border}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.text, fontFamily: mono, fontWeight: 700 }}>{row.years}-Year Horizon</span>
                  <Tag color={C.gold}>+{fmtK(row.gain)} additional</Tag>
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: sans }}>Current (with drag)</div>
                    <div style={{ fontSize: 12, color: C.red, fontFamily: mono, fontWeight: 700 }}>{fmtK(row.fvCurr)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: sans }}>Optimized (no drag)</div>
                    <div style={{ fontSize: 12, color: C.accent, fontFamily: mono, fontWeight: 700 }}>{fmtK(row.fvOpt)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Right: chart */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card>
          <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Current vs Optimal Drag by Asset
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, overflowX: "auto", paddingBottom: 4, minHeight: barH + 40 }}>
            {chartItems.map(r => {
              const cH = totalCurrDrag > 0 ? Math.round((r.currDollars / totalCurrDrag) * barH) : 0;
              const oH = totalCurrDrag > 0 ? Math.round((r.optDollars  / totalCurrDrag) * barH) : 0;
              return (
                <div key={r.asset.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0, width: barW * 2 + 4 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: barH }}>
                    <div style={{ width: barW, height: Math.max(cH, 2), background: C.red + "cc", borderRadius: "3px 3px 0 0" }}
                      title={`Current: ${fmt(r.currDollars)}`} />
                    <div style={{ width: barW, height: Math.max(oH, 2), background: C.accent + "cc", borderRadius: "3px 3px 0 0" }}
                      title={`Optimal: ${fmt(r.optDollars)}`} />
                  </div>
                  <div style={{ fontSize: 7, color: C.mutedLight, fontFamily: sans, textAlign: "center", lineHeight: 1.2, width: barW * 2 + 4 }}>
                    {r.asset.name.split(/[\s/]/)[0]}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, background: C.red + "cc", borderRadius: 2 }} />
              <span style={{ fontSize: 9, color: C.mutedLight, fontFamily: sans }}>Current drag</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, background: C.accent + "cc", borderRadius: 2 }} />
              <span style={{ fontSize: 9, color: C.mutedLight, fontFamily: sans }}>Optimal drag</span>
            </div>
          </div>
        </Card>

        <Card glow>
          <SectionLabel>Total Annual Savings</SectionLabel>
          <div style={{ fontSize: 40, color: C.gold, fontFamily: mono, fontWeight: 800, marginBottom: 4 }}>{fmtK(totalSavings)}</div>
          <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: sans, lineHeight: 1.6 }}>
            Annual tax drag eliminated by moving each asset to its optimal account type.
            This compounds every year — small annual improvements grow dramatically over time.
          </div>
          <div style={{ marginTop: 12, padding: "8px 10px", background: C.gold + "11", border: `1px solid ${C.gold}33`, borderRadius: 6 }}>
            <div style={{ fontSize: 9, color: C.gold, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.07em" }}>Effective Portfolio Drag Rate</div>
            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              <div>
                <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: sans }}>Current</div>
                <div style={{ fontSize: 13, color: C.red, fontFamily: mono, fontWeight: 700 }}>{(dragRate * 100).toFixed(3)}%</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: sans }}>Optimized</div>
                <div style={{ fontSize: 13, color: C.accent, fontFamily: mono, fontWeight: 700 }}>{(optDragRate * 100).toFixed(3)}%</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Tab: Rebalancing Plan ────────────────────────────────────────────────────

function RebalancingTab({
  alloc, currentLoc, setCurrentLoc, ordinaryRate, ltcgRate, totalPortfolio,
  taxableBalance, traditionalBal, rothBalance,
}: {
  alloc: Record<string, number>;
  currentLoc: Record<string, AccountType>;
  setCurrentLoc: (l: Record<string, AccountType>) => void;
  ordinaryRate: number; ltcgRate: number;
  totalPortfolio: number;
  taxableBalance: number; traditionalBal: number; rothBalance: number;
}) {
  const moves = useMemo(() => {
    return ASSET_CLASSES.filter(a => {
      const loc = currentLoc[a.id] ?? "taxable";
      return loc !== a.preferredLocation && (alloc[a.id] ?? 0) > 0;
    }).map(a => {
      const allocDollars = (alloc[a.id] ?? 0) / 100 * totalPortfolio;
      const fromLoc = currentLoc[a.id] ?? "taxable";
      const toLoc = a.preferredLocation;
      const taxCost = fromLoc === "taxable" ? allocDollars * 0.20 * ltcgRate / 100 : null;
      const isFree = fromLoc !== "taxable";
      const drag = taxDragRate(a, fromLoc, ordinaryRate, ltcgRate);
      const optDrag = taxDragRate(a, toLoc, ordinaryRate, ltcgRate);
      const annualSavings = (drag - optDrag) * (alloc[a.id] ?? 0) / 100 * totalPortfolio;
      return { asset: a, fromLoc, toLoc, allocDollars, taxCost, isFree, annualSavings };
    }).sort((a, b) => (a.isFree ? 0 : 1) - (b.isFree ? 0 : 1) || b.annualSavings - a.annualSavings);
  }, [alloc, currentLoc, ordinaryRate, ltcgRate, totalPortfolio]);

  const freeMoves  = moves.filter(m => m.isFree);
  const taxedMoves = moves.filter(m => !m.isFree);

  const accountCapacity: Record<AccountType, number> = {
    taxable: taxableBalance,
    traditional: traditionalBal,
    roth: rothBalance,
  };

  if (moves.length === 0) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
        <div style={{ fontSize: 16, color: C.accent, fontFamily: mono, fontWeight: 700, marginBottom: 4 }}>All assets optimally located!</div>
        <div style={{ fontSize: 12, color: C.mutedLight, fontFamily: sans }}>Your current asset locations match the optimal placement for all asset classes.</div>
      </div>
    );
  }

  function applyAll() {
    const next: Record<string, AccountType> = { ...currentLoc };
    for (const m of moves) next[m.asset.id] = m.toLoc;
    setCurrentLoc(next);
  }

  return (
    <div className="co-grid-2" style={{ gap: 20 }}>
      {/* Left: moves */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {freeMoves.length > 0 && (
          <Card glow>
            <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Priority 1 — No Tax Cost (Do These First)
            </div>
            <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, marginBottom: 10, lineHeight: 1.5 }}>
              These assets are currently in tax-sheltered accounts. Moving them between tax-sheltered accounts has no immediate tax consequence.
            </div>
            {freeMoves.map(m => (
              <div key={m.asset.id} style={{
                padding: "10px 12px", marginBottom: 8, borderRadius: 8,
                background: C.accent + "08", border: `1px solid ${C.accent}22`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <span style={{ fontSize: 11, color: C.text, fontFamily: sans, fontWeight: 600 }}>{m.asset.name}</span>
                  <Tag color={C.accent}>No Tax Cost</Tag>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <Tag color={LOC_COLOR[m.fromLoc]}>{LOC_LABEL[m.fromLoc]}</Tag>
                  <span style={{ color: C.mutedLight, fontSize: 10, fontFamily: mono }}>→</span>
                  <Tag color={LOC_COLOR[m.toLoc]}>{LOC_LABEL[m.toLoc]}</Tag>
                  <span style={{ fontSize: 9, color: C.mutedLight, fontFamily: sans }}>({fmtK(m.allocDollars)})</span>
                  {m.annualSavings > 0 && <span style={{ fontSize: 9, color: C.gold, fontFamily: mono }}>saves {fmt(m.annualSavings)}/yr</span>}
                </div>
                <div style={{ fontSize: 9, color: C.muted, fontFamily: sans, marginTop: 4 }}>{m.asset.reason}</div>
              </div>
            ))}
          </Card>
        )}

        {taxedMoves.length > 0 && (
          <Card>
            <div style={{ fontSize: 11, color: C.orange, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Priority 2 — Taxable Sales (Do Gradually)
            </div>
            <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, marginBottom: 10, lineHeight: 1.5 }}>
              These moves require selling in a taxable brokerage, triggering capital gains tax. Estimated tax cost shown assumes a 20% embedded gain.
            </div>
            {taxedMoves.map(m => (
              <div key={m.asset.id} style={{
                padding: "10px 12px", marginBottom: 8, borderRadius: 8,
                background: C.orange + "08", border: `1px solid ${C.orange}22`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <span style={{ fontSize: 11, color: C.text, fontFamily: sans, fontWeight: 600 }}>{m.asset.name}</span>
                  {m.taxCost !== null && m.taxCost > 0 && (
                    <Tag color={C.orange}>Est. tax cost: {fmt(m.taxCost)}</Tag>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <Tag color={LOC_COLOR[m.fromLoc]}>{LOC_LABEL[m.fromLoc]}</Tag>
                  <span style={{ color: C.mutedLight, fontSize: 10, fontFamily: mono }}>→</span>
                  <Tag color={LOC_COLOR[m.toLoc]}>{LOC_LABEL[m.toLoc]}</Tag>
                  <span style={{ fontSize: 9, color: C.mutedLight, fontFamily: sans }}>({fmtK(m.allocDollars)})</span>
                  {m.annualSavings > 0 && <span style={{ fontSize: 9, color: C.gold, fontFamily: mono }}>saves {fmt(m.annualSavings)}/yr</span>}
                </div>
                <div style={{ fontSize: 9, color: C.muted, fontFamily: sans, marginTop: 4 }}>{m.asset.reason}</div>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Right: strategy guidance */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card goldGlow>
          <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Rebalancing Strategy
          </div>
          {[
            {
              title: "Use new contributions first",
              body: "Direct new 401k, IRA, and taxable contributions to buy the optimal asset class for each account. This improves location over time with zero tax cost.",
              color: C.accent,
            },
            {
              title: "Move tax-sheltered assets freely",
              body: "Selling and buying within Traditional or Roth accounts triggers no capital gains tax. Prioritize these moves immediately.",
              color: C.blue,
            },
            {
              title: "Harvest losses in taxable",
              body: "If taxable positions have unrealized losses, selling them to relocate is tax-free (or tax-beneficial). Pair with the Tax-Loss Harvester tool.",
              color: C.purple,
            },
            {
              title: "Gradual rebalancing for taxable gains",
              body: "For positions with embedded gains in taxable accounts, spread the sale over multiple years to manage the tax hit. Capital gains harvesting at 0% rate in low-income years is ideal.",
              color: C.orange,
            },
          ].map(item => (
            <div key={item.title} style={{
              padding: "10px 12px", marginBottom: 8, borderRadius: 8,
              background: item.color + "0d", border: `1px solid ${item.color}2a`,
            }}>
              <div style={{ fontSize: 10, color: item.color, fontFamily: mono, fontWeight: 700, marginBottom: 3 }}>{item.title}</div>
              <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, lineHeight: 1.5 }}>{item.body}</div>
            </div>
          ))}
        </Card>

        <Card>
          <SectionLabel>Account Capacity</SectionLabel>
          {(["taxable", "traditional", "roth"] as AccountType[]).map(acct => {
            const cap = accountCapacity[acct];
            const needsAssets = moves.filter(m => m.toLoc === acct);
            const neededDollars = needsAssets.reduce((s, m) => s + m.allocDollars, 0);
            return (
              <div key={acct} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: LOC_COLOR[acct], fontFamily: mono }}>{LOC_LABEL[acct]}</span>
                  <span style={{ fontSize: 10, color: C.textDim, fontFamily: mono }}>{fmtK(cap)} available</span>
                </div>
                {neededDollars > 0 && (
                  <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: sans }}>
                    {fmtK(neededDollars)} of assets moving here
                    {neededDollars > cap && (
                      <span style={{ color: C.orange }}> — may exceed capacity; use new contributions over time</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={applyAll} style={{
            width: "100%", marginTop: 8,
            background: C.accent + "22", border: `1px solid ${C.accent}44`, color: C.accent,
            borderRadius: 6, padding: "8px 0", fontSize: 11, fontFamily: mono, cursor: "pointer",
            letterSpacing: "0.07em", textTransform: "uppercase",
          }}>Apply All Moves (Simulation)</button>
        </Card>
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function AssetLocation() {
  // Account balances
  const [taxableBalance,  setTaxableBalance]  = useState(300000);
  const [traditionalBal,  setTraditionalBal]  = useState(500000);
  const [rothBalance,     setRothBalance]     = useState(150000);

  // Tax rates
  const [ordinaryRate,    setOrdinaryRate]    = useState(37);
  const [ltcgRate,        setLtcgRate]        = useState(23);

  // Allocation targets
  const [alloc, setAlloc] = useState<Record<string, number>>({
    us_bonds: 20, tips: 5, reits: 5, us_growth: 35,
    intl_stocks: 15, small_value: 10, high_yield: 5, commodities: 5,
  });

  // Current location choices
  const [currentLoc, setCurrentLoc] = useState<Record<string, AccountType>>({
    us_bonds: "taxable", tips: "taxable", reits: "taxable", us_growth: "taxable",
    intl_stocks: "taxable", small_value: "roth", high_yield: "taxable", commodities: "taxable",
  });

  const [tab, setTab] = useState("overview");

  // Computed values
  const calc = useMemo(() => {
    const totalPortfolio = taxableBalance + traditionalBal + rothBalance;
    let currentAnnualDrag = 0;
    let optimalAnnualDrag = 0;
    for (const a of ASSET_CLASSES) {
      const allocPct = (alloc[a.id] ?? 0) / 100;
      const loc = currentLoc[a.id] ?? "taxable";
      currentAnnualDrag += taxDragRate(a, loc, ordinaryRate, ltcgRate) * allocPct * totalPortfolio;
      optimalAnnualDrag += taxDragRate(a, a.preferredLocation, ordinaryRate, ltcgRate) * allocPct * totalPortfolio;
    }
    const annualSavings = currentAnnualDrag - optimalAnnualDrag;
    return { totalPortfolio, currentAnnualDrag, optimalAnnualDrag, annualSavings };
  }, [taxableBalance, traditionalBal, rothBalance, ordinaryRate, ltcgRate, alloc, currentLoc]);

  const tabs = [
    { id: "overview",    label: "Overview" },
    { id: "allocation",  label: "Allocation" },
    { id: "drag",        label: "Drag Analysis" },
    { id: "rebalancing", label: "Rebalancing Plan" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: sans }}>
      {/* ── Header ── */}
      <div className="co-header-pad" style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div className="co-header-row">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 18, color: C.text, fontFamily: mono, fontWeight: 700, letterSpacing: "0.04em" }}>
                ASSET LOCATION OPTIMIZER
              </span>
              <Tag color={C.accent}>TAXABLE {fmtK(taxableBalance)}</Tag>
              <Tag color={C.blue}>TRADITIONAL {fmtK(traditionalBal)}</Tag>
              <Tag color={C.purple}>ROTH {fmtK(rothBalance)}</Tag>
            </div>
            <div style={{ fontSize: 11, color: C.textDim, fontFamily: sans }}>
              Objective: minimize annual tax drag by placing high-tax assets in sheltered accounts and high-return assets in Roth.
            </div>
          </div>
          <div className="co-kpi-row" style={{ gap: 20 }}>
            {[
              { label: "Total Portfolio",   value: fmtK(calc.totalPortfolio),       color: C.text },
              { label: "Current Drag/yr",   value: fmt(calc.currentAnnualDrag),     color: C.red },
              { label: "Optimal Drag/yr",   value: fmt(calc.optimalAnnualDrag),     color: C.orange },
              { label: "Annual Savings",    value: fmtK(calc.annualSavings),        color: C.gold },
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
        {tab === "overview" && (
          <OverviewTab
            taxableBalance={taxableBalance} setTaxableBalance={setTaxableBalance}
            traditionalBal={traditionalBal} setTraditionalBal={setTraditionalBal}
            rothBalance={rothBalance} setRothBalance={setRothBalance}
            ordinaryRate={ordinaryRate} setOrdinaryRate={setOrdinaryRate}
            ltcgRate={ltcgRate} setLtcgRate={setLtcgRate}
            alloc={alloc} currentLoc={currentLoc} calc={calc}
          />
        )}
        {tab === "allocation" && (
          <AllocationTab
            alloc={alloc} setAlloc={setAlloc}
            currentLoc={currentLoc} setCurrentLoc={setCurrentLoc}
            ordinaryRate={ordinaryRate} ltcgRate={ltcgRate}
            totalPortfolio={calc.totalPortfolio}
          />
        )}
        {tab === "drag" && (
          <DragAnalysisTab
            alloc={alloc} currentLoc={currentLoc}
            ordinaryRate={ordinaryRate} ltcgRate={ltcgRate}
            totalPortfolio={calc.totalPortfolio}
          />
        )}
        {tab === "rebalancing" && (
          <RebalancingTab
            alloc={alloc} currentLoc={currentLoc} setCurrentLoc={setCurrentLoc}
            ordinaryRate={ordinaryRate} ltcgRate={ltcgRate}
            totalPortfolio={calc.totalPortfolio}
            taxableBalance={taxableBalance} traditionalBal={traditionalBal} rothBalance={rothBalance}
          />
        )}
      </div>

      {/* ── Footer ── */}
      <div className="co-footer-pad" style={{ borderTop: `1px solid ${C.border}`, marginTop: 32, maxWidth: 1200, margin: "32px auto 0" }}>
        <div style={{ padding: "14px 0", fontSize: 10, color: C.muted, fontFamily: sans, lineHeight: 1.7 }}>
          Tax drag modeled as: ordinary yield × ordinary rate + qualified div yield × LTCG rate + turnover × embedded gains × LTCG rate ·{" "}
          Traditional IRA tax modeled as deferred (paid at distribution) not annual drag ·{" "}
          Foreign tax credit only available in taxable brokerage accounts ·{" "}
          Not financial or tax advice.
        </div>
      </div>
    </div>
  );
}
