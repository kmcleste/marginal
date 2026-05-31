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

interface Position {
  id: string;
  ticker: string;
  shares: number;
  costPerShare: number;
  currentPrice: number;
  holdingDays: number;
  selected: boolean;
}

interface PositionMetrics {
  costBasis: number;
  currentValue: number;
  unrealizedGain: number;
  isLoss: boolean;
  holdingType: "ST" | "LT";
  pctChange: number;
}

// ─── Replacement ETF suggestions ─────────────────────────────────────────────

const REPLACEMENTS: Record<string, string[]> = {
  VTI:  ["SCHB", "ITOT"],     SCHB:  ["VTI",  "ITOT"],    ITOT:  ["VTI",  "SCHB"],
  SPY:  ["VOO",  "IVV"],      VOO:   ["SPY",  "IVV"],     IVV:   ["SPY",  "VOO"],
  QQQ:  ["VGT",  "FTEC"],     VGT:   ["QQQ",  "FTEC"],
  BND:  ["AGG",  "SCHZ"],     AGG:   ["BND",  "SCHZ"],
  GLD:  ["IAU",  "SGOL"],     IAU:   ["GLD",  "SGOL"],
  VEA:  ["SCHF", "EFA"],      EFA:   ["VEA",  "SCHF"],
  VWO:  ["SCHE", "EEM"],      EEM:   ["VWO",  "SCHE"],
  VNQ:  ["SCHH", "IYR"],
};

// ─── Core math ────────────────────────────────────────────────────────────────

function metrics(p: Position): PositionMetrics {
  const costBasis    = p.costPerShare * p.shares;
  const currentValue = p.currentPrice  * p.shares;
  const unrealizedGain = currentValue - costBasis;
  return {
    costBasis, currentValue, unrealizedGain,
    isLoss:      unrealizedGain < 0,
    holdingType: p.holdingDays >= 365 ? "LT" : "ST",
    pctChange:   (unrealizedGain / costBasis),
  };
}

// IRS netting rules: ST losses → ST gains first, then LT gains; LT losses → LT gains first, then ST gains
function calcTaxSavings(
  stLoss: number, ltLoss: number,
  stGain: number, ltGain: number,
  stcgRate: number, ltcgRate: number, ordRate: number,
): {
  stTaxSaved: number; ltTaxSaved: number; ordTaxSaved: number;
  carryforward: number; totalSaved: number;
} {
  let stL = Math.abs(stLoss);
  let ltL = Math.abs(ltLoss);

  // ST losses offset ST gains first
  const stOffsetST = Math.min(stL, stGain);
  stL -= stOffsetST;
  // Remaining ST losses offset LT gains
  const stOffsetLT = Math.min(stL, ltGain);
  stL -= stOffsetLT;

  // LT losses offset LT gains first
  const ltOffsetLT = Math.min(ltL, ltGain - stOffsetLT);
  ltL -= ltOffsetLT;
  // Remaining LT losses offset ST gains
  const ltOffsetST = Math.min(ltL, stGain - stOffsetST);
  ltL -= ltOffsetST;

  // Remaining losses → up to $3k against ordinary income
  const remaining = stL + ltL;
  const ordOffset = Math.min(remaining, 3000);
  const carryforward = remaining - ordOffset;

  const stTaxSaved  = (stOffsetST + ltOffsetST) * (stcgRate / 100);
  const ltTaxSaved  = (stOffsetLT + ltOffsetLT) * (ltcgRate / 100);
  const ordTaxSaved = ordOffset * (ordRate / 100);

  return { stTaxSaved, ltTaxSaved, ordTaxSaved, carryforward, totalSaved: stTaxSaved + ltTaxSaved + ordTaxSaved };
}

// NPV of tax deferral: paying T in taxes today vs. paying T + growth in the future
// Benefit = T × ((1+r)^n - 1) in future dollars, or T × (1 - 1/(1+r)^n) in PV terms
function taxAlphaPV(taxSaved: number, annualReturn: number, yearsToExit: number): number {
  const r = annualReturn / 100;
  return taxSaved * (1 - 1 / Math.pow(1 + r, yearsToExit));
}

// ─── UI Primitives ────────────────────────────────────────────────────────────

function Card({ children, style, glow }: { children: React.ReactNode; style?: React.CSSProperties; glow?: boolean }) {
  return (
    <div style={{
      background: C.surface, borderRadius: 12, padding: "16px 18px",
      border: `1px solid ${glow ? C.accent + "55" : C.border}`,
      boxShadow: glow ? `0 0 24px ${C.accentDim}` : "none", ...style,
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
        onChange={e => onChange(+e.target.value)} style={{ width: "100%", marginTop: 2, accentColor: color }} />
      {hint && <div style={{ fontSize: 9, color: C.muted, marginTop: 1, fontFamily: sans }}>{hint}</div>}
    </div>
  );
}

function Tag({ children, color = C.accent }: { children: React.ReactNode; color?: string }) {
  return <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 4, padding: "1px 6px", fontSize: 10, fontFamily: mono }}>{children}</span>;
}

// ─── Default positions ────────────────────────────────────────────────────────

const DEFAULT_POSITIONS: Position[] = [
  { id: "1", ticker: "VTI",  shares: 120, costPerShare: 222, currentPrice: 186, holdingDays: 210, selected: false },
  { id: "2", ticker: "AMZN", shares:  40, costPerShare: 195, currentPrice: 178, holdingDays: 320, selected: false },
  { id: "3", ticker: "BND",  shares: 200, costPerShare:  77, currentPrice:  71, holdingDays: 480, selected: false },
  { id: "4", ticker: "GOOGL",shares:  25, costPerShare: 138, currentPrice: 157, holdingDays: 720, selected: false },
  { id: "5", ticker: "NVDA", shares:  15, costPerShare: 290, currentPrice: 475, holdingDays: 540, selected: false },
  { id: "6", ticker: "MSFT", shares:  30, costPerShare: 335, currentPrice: 298, holdingDays:  85, selected: false },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TaxLossHarvester() {
  const [positions,    setPositions]   = useState<Position[]>(DEFAULT_POSITIONS);
  const [tab,          setTab]         = useState("portfolio");

  // Tax rates
  const [stcgRate,     setStcgRate]    = useState(37);   // % combined ST capital gains (ordinary income rate)
  const [ltcgRate,     setLtcgRate]    = useState(23);   // % combined LT capital gains (20% + 3.8% NIIT)
  const [ordRate,      setOrdRate]     = useState(37);   // % ordinary income marginal rate
  const [stateRate,    setStateRate]   = useState(5);    // % state rate (additive)

  // Alpha calc
  const [investReturn, setInvestReturn] = useState(8);   // % annual expected return
  const [yearsToExit,  setYearsToExit]  = useState(15);  // years until final sale/exit

  // Add position form
  const [showAddForm,  setShowAddForm]  = useState(false);
  const [newTicker,    setNewTicker]    = useState("");
  const [newShares,    setNewShares]    = useState(100);
  const [newCost,      setNewCost]      = useState(100);
  const [newPrice,     setNewPrice]     = useState(85);
  const [newDays,      setNewDays]      = useState(200);

  // Effective combined rates (fed + state)
  const effectiveStcg = stcgRate + stateRate;
  const effectiveLtcg = ltcgRate + stateRate;
  const effectiveOrd  = ordRate  + stateRate;

  const posMetrics = useMemo(() => positions.map(p => ({ ...p, ...metrics(p) })), [positions]);

  const losses = useMemo(() => posMetrics.filter(p => p.isLoss), [posMetrics]);
  const gains  = useMemo(() => posMetrics.filter(p => !p.isLoss), [posMetrics]);
  const selected = useMemo(() => posMetrics.filter(p => p.selected && p.isLoss), [posMetrics]);

  const totalSTLoss = useMemo(() =>
    selected.filter(p => p.holdingType === "ST").reduce((s, p) => s + p.unrealizedGain, 0), [selected]);
  const totalLTLoss = useMemo(() =>
    selected.filter(p => p.holdingType === "LT").reduce((s, p) => s + p.unrealizedGain, 0), [selected]);
  const totalSTGain = useMemo(() =>
    gains.filter(p => p.holdingType === "ST").reduce((s, p) => s + p.unrealizedGain, 0), [gains]);
  const totalLTGain = useMemo(() =>
    gains.filter(p => p.holdingType === "LT").reduce((s, p) => s + p.unrealizedGain, 0), [gains]);

  const harvest = useMemo(() => calcTaxSavings(
    totalSTLoss, totalLTLoss, totalSTGain, totalLTGain,
    effectiveStcg, effectiveLtcg, effectiveOrd,
  ), [totalSTLoss, totalLTLoss, totalSTGain, totalLTGain, effectiveStcg, effectiveLtcg, effectiveOrd]);

  const alpha = useMemo(() =>
    taxAlphaPV(harvest.totalSaved, investReturn, yearsToExit), [harvest.totalSaved, investReturn, yearsToExit]);

  const totalHarvestable = useMemo(() =>
    losses.reduce((s, p) => s + Math.abs(p.unrealizedGain), 0), [losses]);

  const toggleSelect = (id: string) =>
    setPositions(ps => ps.map(p => p.id === id && metrics(p).isLoss ? { ...p, selected: !p.selected } : p));

  const addPosition = () => {
    if (!newTicker.trim()) return;
    const id = Date.now().toString();
    setPositions(ps => [...ps, {
      id, ticker: newTicker.trim().toUpperCase(), shares: newShares,
      costPerShare: newCost, currentPrice: newPrice, holdingDays: newDays, selected: false,
    }]);
    setNewTicker(""); setNewShares(100); setNewCost(100); setNewPrice(85); setNewDays(200);
    setShowAddForm(false);
  };

  const removePosition = (id: string) => setPositions(ps => ps.filter(p => p.id !== id));

  const tabs = [
    { id: "portfolio", label: "📋 Portfolio" },
    { id: "harvest",   label: "⚡ Harvest" },
    { id: "washsale",  label: "🚫 Wash Sale" },
    { id: "alpha",     label: "∂ Tax Alpha" },
  ];

  const totalLossesSelected = Math.abs(totalSTLoss) + Math.abs(totalLTLoss);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: sans }}>

      {/* ── HEADER ── */}
      <div className="co-header-pad" style={{ background: `linear-gradient(180deg, #0a0f1e 0%, ${C.bg} 100%)`, borderBottom: `1px solid ${C.border}` }}>
        <div className="co-header-row">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 17, fontWeight: 700, fontFamily: mono, color: C.accent, letterSpacing: "0.03em" }}>
                TAX-LOSS HARVESTER
              </span>
              <Tag color={C.gold}>2024</Tag>
              <span className="co-mob-hide"><Tag color={C.blue}>WASH-SALE AWARE</Tag></span>
            </div>
            <div className="co-mob-hide" style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, marginTop: 3 }}>
              Realize losses to offset gains · preserve market exposure · quantify tax alpha from deferral
            </div>
          </div>
          <div className="co-kpi-row">
            {[
              { label: "Harvestable",  val: fmtK(totalHarvestable),            c: C.accent },
              { label: "Selected",     val: fmtK(totalLossesSelected),          c: totalLossesSelected > 0 ? C.gold : C.mutedLight },
              { label: "Tax Saved",    val: fmtK(harvest.totalSaved),           c: harvest.totalSaved > 0 ? C.accent : C.mutedLight },
              { label: "Carryforward", val: fmtK(harvest.carryforward),         c: harvest.carryforward > 0 ? C.purple : C.mutedLight },
            ].map((x, i) => (
              <div key={x.label} style={{
                textAlign: "right", paddingLeft: 16, paddingRight: 4, paddingTop: 4, paddingBottom: 4,
                borderLeft: i > 0 ? `1px solid ${C.border}` : "none", marginLeft: i > 0 ? 4 : 0, minWidth: 0,
              }}>
                <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{x.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: x.c, fontFamily: mono, whiteSpace: "nowrap" }}>{x.val}</div>
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

      <div className="co-content-pad">

        {/* ══ PORTFOLIO ══ */}
        {tab === "portfolio" && (
          <div className="co-grid-lt">

            {/* Left: tax profile */}
            <div>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Tax Profile</div>
                <Sl label="ST Capital Gains Rate (federal)" value={stcgRate} min={10} max={45} step={1}
                  onChange={setStcgRate} color={C.red} fmt={v => `${v}%`}
                  hint="Ordinary income rate — short-term gains are taxed as income" />
                <Sl label="LT Capital Gains Rate (federal)" value={ltcgRate} min={0} max={24} step={1}
                  onChange={setLtcgRate} color={C.orange} fmt={v => `${v}%`}
                  hint="0% / 15% / 20% federal + 3.8% NIIT at high income" />
                <Sl label="State Income Tax Rate" value={stateRate} min={0} max={14} step={0.5}
                  onChange={setStateRate} color={C.orange} fmt={v => `${v}%`}
                  hint="Applied to both ST and LT gains in most states" />
                <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "12px 14px", marginTop: 4 }}>
                  {[
                    { l: "Effective ST rate", v: effectiveStcg, c: C.red },
                    { l: "Effective LT rate", v: effectiveLtcg, c: C.orange },
                    { l: "Ordinary income rate", v: effectiveOrd, c: C.mutedLight },
                  ].map(r => (
                    <div key={r.l} style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 11, padding: "3px 0" }}>
                      <span style={{ color: C.textDim }}>{r.l}</span>
                      <span style={{ color: r.c, fontWeight: 600 }}>{r.v}%</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Portfolio Summary</div>
                {[
                  { l: "Total positions",  v: `${positions.length}`,            c: C.text },
                  { l: "Loss positions",   v: `${losses.length}`,               c: losses.length > 0 ? C.accent : C.mutedLight },
                  { l: "Harvestable loss", v: fmtK(totalHarvestable),           c: C.accent },
                  { l: "ST losses",        v: fmtK(losses.filter(p=>p.holdingType==="ST").reduce((s,p)=>s+p.unrealizedGain,0)), c: C.red },
                  { l: "LT losses",        v: fmtK(losses.filter(p=>p.holdingType==="LT").reduce((s,p)=>s+p.unrealizedGain,0)), c: C.orange },
                  { l: "Unrealized gains", v: fmtK(gains.reduce((s,p)=>s+p.unrealizedGain,0)), c: C.gold },
                ].map(r => (
                  <div key={r.l} style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 11, padding: "4px 0", borderBottom: `1px solid ${C.border}22` }}>
                    <span style={{ color: C.textDim }}>{r.l}</span>
                    <span style={{ color: r.c, fontWeight: 600 }}>{r.v}</span>
                  </div>
                ))}
              </Card>
            </div>

            {/* Right: positions table */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Positions — click a loss to select for harvest
                </div>
                <button onClick={() => setShowAddForm(v => !v)} style={{
                  background: C.accent + "22", border: `1px solid ${C.accent}44`, color: C.accent,
                  fontFamily: mono, fontSize: 10, padding: "4px 12px", borderRadius: 4, cursor: "pointer",
                }}>+ Add</button>
              </div>

              {showAddForm && (
                <Card style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Add Position</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                    {[
                      { label: "Ticker", value: newTicker, onChange: (v: string) => setNewTicker(v.toUpperCase()), type: "text" as const },
                    ].map(f => (
                      <div key={f.label}>
                        <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", marginBottom: 3 }}>{f.label}</div>
                        <input value={f.value} onChange={e => f.onChange(e.target.value)} type={f.type}
                          style={{ width: "100%", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontFamily: mono, fontSize: 12, padding: "5px 8px", boxSizing: "border-box" }} />
                      </div>
                    ))}
                    {([
                      { label: "Shares",         val: newShares, set: setNewShares },
                      { label: "Cost/Share ($)",  val: newCost,   set: setNewCost },
                      { label: "Price ($)",       val: newPrice,  set: setNewPrice },
                      { label: "Days Held",       val: newDays,   set: setNewDays },
                    ] as const).map(f => (
                      <div key={f.label}>
                        <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", marginBottom: 3 }}>{f.label}</div>
                        <input type="number" value={f.val} onChange={e => f.set(+e.target.value)}
                          style={{ width: "100%", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontFamily: mono, fontSize: 12, padding: "5px 8px", boxSizing: "border-box" }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={addPosition} style={{ background: C.accent + "22", border: `1px solid ${C.accent}`, color: C.accent, fontFamily: mono, fontSize: 11, padding: "6px 16px", borderRadius: 4, cursor: "pointer" }}>Add</button>
                    <button onClick={() => setShowAddForm(false)} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.mutedLight, fontFamily: mono, fontSize: 11, padding: "6px 16px", borderRadius: 4, cursor: "pointer" }}>Cancel</button>
                  </div>
                </Card>
              )}

              <Card>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 11 }}>
                    <thead>
                      <tr>
                        {["", "Ticker", "Shares", "Cost Basis", "Current", "Gain/Loss", "%", "Type", "Tax If Sold", ""].map(h => (
                          <th key={h} style={{ textAlign: h === "Ticker" || h === "" ? "left" : "right", padding: "4px 8px", color: C.muted, fontWeight: 400, borderBottom: `1px solid ${C.border}`, fontSize: 9, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {posMetrics.map(p => {
                        const selected = p.selected && p.isLoss;
                        const taxIfSold = p.isLoss
                          ? Math.abs(p.unrealizedGain) * (p.holdingType === "ST" ? effectiveStcg : effectiveLtcg) / 100
                          : p.unrealizedGain * (p.holdingType === "ST" ? effectiveStcg : effectiveLtcg) / 100;
                        return (
                          <tr key={p.id}
                            onClick={() => p.isLoss && toggleSelect(p.id)}
                            style={{
                              cursor: p.isLoss ? "pointer" : "default",
                              background: selected ? C.accent + "11" : "transparent",
                              borderBottom: `1px solid ${C.border}22`,
                            }}>
                            <td style={{ padding: "6px 8px" }}>
                              {p.isLoss && (
                                <div style={{
                                  width: 14, height: 14, borderRadius: 3,
                                  border: `1px solid ${selected ? C.accent : C.muted}`,
                                  background: selected ? C.accent : "transparent",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                  {selected && <span style={{ fontSize: 9, color: C.bg }}>✓</span>}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "6px 8px", color: p.isLoss ? C.text : C.mutedLight, fontWeight: 600 }}>
                              {p.ticker}
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right", color: C.textDim }}>{p.shares}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", color: C.textDim }}>{fmt(p.costBasis)}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", color: C.textDim }}>{fmt(p.currentValue)}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", color: p.isLoss ? C.accent : C.gold, fontWeight: 600 }}>
                              {p.isLoss ? "" : "+"}{fmt(p.unrealizedGain)}
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right", color: p.isLoss ? C.accent : C.gold }}>
                              {p.pctChange >= 0 ? "+" : ""}{pct(p.pctChange)}
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right" }}>
                              <Tag color={p.holdingType === "ST" ? C.red : C.blue}>{p.holdingType}</Tag>
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right", color: p.isLoss ? C.accent : C.orange }}>
                              {p.isLoss ? `save ${fmtK(taxIfSold)}` : `owe ${fmtK(taxIfSold)}`}
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <button onClick={e => { e.stopPropagation(); removePosition(p.id); }}
                                style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, padding: "0 4px" }}>×</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 10, fontSize: 10, color: C.muted, fontFamily: mono }}>
                  <span style={{ color: C.accent }}>Green</span> = loss · harvestable.{" "}
                  <span style={{ color: C.gold }}>Gold</span> = gain · hold or sell separately.{" "}
                  Click a loss row to select for harvest.
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ══ HARVEST ══ */}
        {tab === "harvest" && (
          <div className="co-grid-2">
            {/* Left: selected positions */}
            <div>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Selected for Harvest ({selected.length})
                </div>
                {selected.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.muted, fontFamily: mono, padding: "12px 0" }}>
                    No positions selected. Go to Portfolio tab and click loss positions (green rows) to select them.
                  </div>
                ) : (
                  <>
                    {selected.map(p => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: C.surfaceAlt, borderRadius: 6, marginBottom: 6 }}>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: mono }}>{p.ticker}</span>
                          <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>{p.shares} shares · {p.holdingType}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, color: C.accent, fontFamily: mono, fontWeight: 600 }}>{fmt(p.unrealizedGain)}</div>
                          <div style={{ fontSize: 9, color: C.muted, fontFamily: mono }}>{pct(p.pctChange)}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 12 }}>
                      <span style={{ color: C.textDim }}>Total loss to book</span>
                      <span style={{ color: C.accent, fontWeight: 700 }}>{fmt(-(Math.abs(totalSTLoss) + Math.abs(totalLTLoss)))}</span>
                    </div>
                  </>
                )}
              </Card>

              {/* Capital gains offset breakdown */}
              {selected.length > 0 && (
                <Card>
                  <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                    IRS Netting Order
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 12, lineHeight: 1.6, fontFamily: sans }}>
                    ST losses offset ST gains first, then LT gains. LT losses offset LT gains first, then ST gains. Up to $3,000 of remaining losses offsets ordinary income. The rest carries forward.
                  </div>
                  {[
                    { l: "ST losses available",   v: fmt(totalSTLoss),              c: C.red },
                    { l: "LT losses available",   v: fmt(totalLTLoss),              c: C.orange },
                    { l: "ST gains in portfolio", v: fmt(totalSTGain),              c: C.gold },
                    { l: "LT gains in portfolio", v: fmt(totalLTGain),              c: C.gold },
                    { l: "Ordinary income offset (max $3k)", v: fmt(Math.min(harvest.carryforward + (harvest.ordTaxSaved > 0 ? 3000 : 0), 3000)), c: C.purple },
                    { l: "Carryforward to next year",   v: fmt(harvest.carryforward), c: harvest.carryforward > 0 ? C.blue : C.muted },
                  ].map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 11, padding: "4px 0", borderBottom: `1px solid ${C.border}22` }}>
                      <span style={{ color: C.textDim }}>{r.l}</span>
                      <span style={{ color: r.c, fontWeight: 600 }}>{r.v}</span>
                    </div>
                  ))}
                </Card>
              )}
            </div>

            {/* Right: tax impact */}
            <div>
              <Card glow={harvest.totalSaved > 0} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                  Tax Impact This Year
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[
                    { l: "Total Tax Saved",  v: fmtK(harvest.totalSaved),  c: C.accent,  big: true },
                    { l: "Carryforward",     v: fmtK(harvest.carryforward), c: harvest.carryforward > 0 ? C.blue : C.muted, big: true },
                  ].map(x => (
                    <div key={x.l} style={{ background: C.surfaceAlt, borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", marginBottom: 4 }}>{x.l}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: x.c, fontFamily: mono }}>{x.v}</div>
                    </div>
                  ))}
                </div>
                {[
                  { l: "ST gain offset savings",  v: harvest.stTaxSaved,  c: C.red },
                  { l: "LT gain offset savings",  v: harvest.ltTaxSaved,  c: C.orange },
                  { l: "Ordinary income savings",  v: harvest.ordTaxSaved, c: C.purple },
                ].map((r, i) => {
                  const barW = harvest.totalSaved > 0 ? (r.v / harvest.totalSaved) * 100 : 0;
                  return (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono }}>{r.l}</span>
                        <span style={{ fontSize: 12, color: r.v > 0 ? r.c : C.muted, fontWeight: 600, fontFamily: mono }}>{fmt(r.v)}</span>
                      </div>
                      <div style={{ height: 4, background: C.muted + "33", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, barW)}%`, background: r.c, borderRadius: 2 }} />
                      </div>
                    </div>
                  );
                })}
              </Card>

              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  What Actually Happens
                </div>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.8, fontFamily: sans }}>
                  <div style={{ marginBottom: 8, padding: "8px 12px", background: C.surfaceAlt, borderRadius: 6, borderLeft: `2px solid ${C.accent}` }}>
                    <strong style={{ color: C.text }}>Step 1:</strong> Sell selected positions. Book the losses. Receive tax refund / reduced liability of <strong style={{ color: C.accent }}>{fmt(harvest.totalSaved)}</strong>.
                  </div>
                  <div style={{ marginBottom: 8, padding: "8px 12px", background: C.surfaceAlt, borderRadius: 6, borderLeft: `2px solid ${C.blue}` }}>
                    <strong style={{ color: C.text }}>Step 2:</strong> Immediately buy replacement securities (similar, not identical — see Wash Sale tab). Maintain your market exposure.
                  </div>
                  <div style={{ padding: "8px 12px", background: C.surfaceAlt, borderRadius: 6, borderLeft: `2px solid ${C.orange}` }}>
                    <strong style={{ color: C.text }}>Step 3:</strong> Your new cost basis is lower. When you eventually sell, you'll owe the deferred tax. The benefit is the <em>time value</em> of deferral — see Tax Alpha tab.
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ══ WASH SALE ══ */}
        {tab === "washsale" && (
          <div className="co-grid-2">
            <div>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  The 30-Day Rule
                </div>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.8, fontFamily: sans, marginBottom: 14 }}>
                  IRS § 1091: A loss is <strong style={{ color: C.red }}>disallowed</strong> if you buy a "substantially identical" security within <strong style={{ color: C.red }}>30 days before or after</strong> the sale date. The loss is not permanently lost — it's added to the cost basis of the replacement shares — but the timing benefit is destroyed.
                </div>

                {/* Timeline visualization */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", marginBottom: 8 }}>
                    Wash Sale Window — centered on harvest date
                  </div>
                  <div style={{ position: "relative", height: 40 }}>
                    {/* Timeline bar */}
                    <div style={{ position: "absolute", top: 17, left: 0, right: 0, height: 6, background: C.surfaceAlt, borderRadius: 3 }} />
                    {/* Red zones */}
                    <div style={{ position: "absolute", top: 17, left: 0, width: "43%", height: 6, background: C.red + "44", borderRadius: "3px 0 0 3px" }} />
                    <div style={{ position: "absolute", top: 17, left: "57%", right: 0, height: 6, background: C.red + "44", borderRadius: "0 3px 3px 0" }} />
                    {/* Green center */}
                    <div style={{ position: "absolute", top: 14, left: "43%", width: "14%", height: 12, background: C.accent + "55", borderRadius: 3 }} />
                    {/* Center marker */}
                    <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 2, height: 20, background: C.accent }} />
                    {/* Labels */}
                    <div style={{ position: "absolute", top: 26, left: "2%", fontSize: 8, color: C.red, fontFamily: mono }}>−30 days</div>
                    <div style={{ position: "absolute", top: 26, left: "50%", transform: "translateX(-50%)", fontSize: 8, color: C.accent, fontFamily: mono }}>SELL</div>
                    <div style={{ position: "absolute", top: 26, right: "2%", fontSize: 8, color: C.red, fontFamily: mono, textAlign: "right" }}>+30 days</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 9, color: C.red, fontFamily: mono }}>🚫 Danger: Don't buy same security</span>
                    <span style={{ fontSize: 9, color: C.red, fontFamily: mono }}>🚫 Danger: Don't buy same security</span>
                  </div>
                </div>

                <div style={{ background: C.red + "11", border: `1px solid ${C.red}33`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: C.red, fontFamily: mono, textTransform: "uppercase", marginBottom: 6 }}>What triggers a wash sale</div>
                  {[
                    "Selling VTI and buying VTI again within 30 days",
                    "Selling SPY and buying SPY in an IRA within 30 days",
                    "Selling AMZN shares and buying AMZN call options",
                    "Your spouse buying the same security in their account",
                  ].map((s, i) => (
                    <div key={i} style={{ fontSize: 10, color: C.textDim, padding: "3px 0", fontFamily: sans }}>✗ {s}</div>
                  ))}
                </div>
              </Card>

              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  What does NOT trigger a wash sale
                </div>
                <div style={{ background: C.accent + "0a", border: `1px solid ${C.accent}22`, borderRadius: 8, padding: "12px 14px" }}>
                  {[
                    "Selling VTI and immediately buying SCHB or ITOT",
                    "Selling SPY and buying VOO (different fund, same index — gray area; most practitioners treat as safe)",
                    "Selling at a loss in taxable and NOT repurchasing within 30 days",
                    "Selling at a GAIN (no wash sale concern — only losses are at risk)",
                  ].map((s, i) => (
                    <div key={i} style={{ fontSize: 10, color: C.textDim, padding: "3px 0", fontFamily: sans }}>✓ {s}</div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right: replacement suggestions */}
            <div>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Replacement Suggestions for Selected Positions
                </div>
                {selected.length === 0 ? (
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: mono }}>Select harvest positions on the Portfolio tab to see replacement suggestions.</div>
                ) : (
                  selected.map(p => {
                    const replacements = REPLACEMENTS[p.ticker] ?? null;
                    return (
                      <div key={p.id} style={{ marginBottom: 14, padding: "12px 14px", background: C.surfaceAlt, borderRadius: 8, border: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: mono }}>{p.ticker}</span>
                          <span style={{ fontSize: 10, color: C.accent, fontFamily: mono }}>harvest {fmt(p.unrealizedGain)}</span>
                        </div>
                        {replacements ? (
                          <>
                            <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", marginBottom: 6 }}>Suggested replacements (buy immediately after selling):</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {replacements.map(r => (
                                <div key={r} style={{ background: C.accent + "15", border: `1px solid ${C.accent}44`, borderRadius: 6, padding: "6px 12px" }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, fontFamily: mono }}>{r}</div>
                                  <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>Similar exposure</div>
                                </div>
                              ))}
                            </div>
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 8, fontFamily: sans }}>
                              After 31 days, you may swap back to {p.ticker} if desired.
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: 10, color: C.orange, fontFamily: sans }}>
                            Individual stock — no direct equivalent. Consider a broad sector ETF as a temporary replacement, or wait 31 days before rebuying {p.ticker}.
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </Card>

              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                  Accounts Matter Too
                </div>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.8, fontFamily: sans }}>
                  Wash sales apply <strong style={{ color: C.red }}>across all accounts you control</strong> — including IRAs and your spouse's accounts. Selling VTI at a loss in your taxable brokerage and buying VTI in your IRA within 30 days disallows the loss.
                </div>
                <div style={{ marginTop: 10, background: C.surfaceAlt, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, marginBottom: 4 }}>Pro tip</div>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, lineHeight: 1.6 }}>
                    If you contribute to a 401k with automatic monthly investments in index funds, check that those scheduled purchases don't overlap with your harvest window.
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ══ TAX ALPHA ══ */}
        {tab === "alpha" && (
          <div className="co-grid-lt">
            {/* Left: controls */}
            <div>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                  Alpha Parameters
                </div>
                <Sl label="Expected Annual Return" value={investReturn} min={2} max={15} step={0.5}
                  onChange={setInvestReturn} color={C.blue} fmt={v => `${v}%`}
                  hint="Return on the reinvested tax savings — drives the compounding benefit" />
                <Sl label="Years to Final Exit" value={yearsToExit} min={1} max={40} step={1}
                  onChange={setYearsToExit} color={C.purple} fmt={v => `${v} yrs`}
                  hint="When you'll eventually sell the replacement position and owe deferred tax" />
              </Card>

              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  How Tax Alpha Works
                </div>
                <div style={{ fontSize: 10, fontFamily: mono, background: C.surfaceAlt, borderRadius: 6, overflow: "hidden" }}>
                  {[
                    { lhs: "Step 1", rhs: "Harvest loss → save T in taxes today" },
                    { lhs: "Step 2", rhs: "Reinvest T at rate r for n years" },
                    { lhs: "Step 3", rhs: "Pay T back when exiting (deferred, not forgiven)" },
                    { lhs: "Net gain", rhs: "T × r × n ≈ T × ((1+r)ⁿ − 1)" },
                    { lhs: "PV gain", rhs: "T × (1 − 1/(1+r)ⁿ)" },
                  ].map((row, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, padding: "5px 12px", borderBottom: i < 4 ? `1px solid ${C.border}22` : "none" }}>
                      <span style={{ color: C.accent, minWidth: 60, flexShrink: 0, fontSize: 10 }}>{row.lhs}</span>
                      <span style={{ color: C.textDim, fontSize: 10 }}>{row.rhs}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 10, color: C.muted, fontFamily: sans, lineHeight: 1.6 }}>
                  This alpha is <strong style={{ color: C.text }}>real</strong> — it comes from compounding the tax refund instead of giving it to the government now. The longer you hold, and the higher the return, the more valuable the deferral.
                </div>
              </Card>
            </div>

            {/* Right: results */}
            <div>
              <Card glow={harvest.totalSaved > 0} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                  Tax Alpha — Selected Harvest
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                  {[
                    { l: "Tax Saved Now",  v: fmtK(harvest.totalSaved), c: C.accent },
                    { l: "Alpha (PV)",     v: fmtK(alpha),              c: C.gold },
                    { l: "Deferred Cost",  v: fmtK(harvest.totalSaved - alpha), c: C.mutedLight },
                  ].map(x => (
                    <div key={x.l} style={{ background: C.surfaceAlt, borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", marginBottom: 4 }}>{x.l}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: x.c, fontFamily: mono }}>{x.v}</div>
                    </div>
                  ))}
                </div>

                {/* SVG: tax alpha grows over time */}
                {(() => {
                  const W = 480, H = 140;
                  const maxYears = Math.max(yearsToExit, 20);
                  const points = Array.from({ length: maxYears + 1 }, (_, y) => ({
                    y, alpha: taxAlphaPV(harvest.totalSaved, investReturn, y),
                  }));
                  const maxAlpha = Math.max(...points.map(p => p.alpha), 1);
                  const toX = (y: number) => (y / maxYears) * W;
                  const toY = (v: number) => H - (v / maxAlpha) * (H - 16) - 8;
                  const pts = points.map(p => `${toX(p.y).toFixed(1)},${toY(p.alpha).toFixed(1)}`).join(" ");
                  const exitX = toX(yearsToExit);
                  const exitAlpha = taxAlphaPV(harvest.totalSaved, investReturn, yearsToExit);
                  return (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, color: C.muted, fontFamily: mono, marginBottom: 6 }}>Tax alpha (PV) vs. hold duration</div>
                      <svg width={W} height={H + 20} viewBox={`0 0 ${W} ${H + 20}`} style={{ display: "block", width: "100%", overflow: "visible" }}>
                        <polygon points={`0,${H} ${pts} ${W},${H}`} fill={C.accent + "10"} />
                        <polyline points={pts} fill="none" stroke={C.accent} strokeWidth={2} strokeLinejoin="round" />
                        <line x1={exitX} x2={exitX} y1={0} y2={H} stroke={C.gold} strokeWidth={1.5} strokeDasharray="4,3" />
                        <circle cx={exitX} cy={toY(exitAlpha)} r={4} fill={C.gold} />
                        <text x={exitX + 5} y={toY(exitAlpha) - 5} fill={C.gold} fontSize={9} fontFamily={mono}>{fmtK(exitAlpha)}</text>
                        <text x={4} y={H + 14} fill={C.muted} fontSize={8} fontFamily={mono}>yr 0</text>
                        <text x={W - 20} y={H + 14} fill={C.muted} fontSize={8} fontFamily={mono}>yr {maxYears}</text>
                        {[0.25, 0.5, 0.75, 1].map(p => (
                          <g key={p}>
                            <line x1={0} x2={W} y1={toY(maxAlpha * p)} y2={toY(maxAlpha * p)} stroke={C.border} strokeWidth={0.5} />
                            <text x={4} y={toY(maxAlpha * p) - 2} fill={C.muted} fontSize={7} fontFamily={mono}>{fmtK(maxAlpha * p)}</text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  );
                })()}
              </Card>

              {/* Alpha sensitivity table */}
              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Alpha Sensitivity — Tax Saved: {fmtK(harvest.totalSaved)}
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 10 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "4px 8px", color: C.muted, fontWeight: 400, borderBottom: `1px solid ${C.border}`, fontSize: 9 }}>Years held</th>
                        {[4, 6, 8, 10, 12].map(r => (
                          <th key={r} style={{ textAlign: "right", padding: "4px 8px", color: r === investReturn ? C.accent : C.muted, fontWeight: r === investReturn ? 700 : 400, borderBottom: `1px solid ${C.border}`, fontSize: 9 }}>{r}% return</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[5, 10, 15, 20, 30].map(y => (
                        <tr key={y} style={{ background: y === yearsToExit ? C.accent + "08" : "transparent", borderBottom: `1px solid ${C.border}22` }}>
                          <td style={{ padding: "5px 8px", color: y === yearsToExit ? C.accent : C.textDim, fontWeight: y === yearsToExit ? 700 : 400 }}>{y} yrs</td>
                          {[4, 6, 8, 10, 12].map(r => (
                            <td key={r} style={{ padding: "5px 8px", textAlign: "right", color: r === investReturn ? C.gold : C.mutedLight, fontWeight: r === investReturn ? 600 : 400 }}>
                              {fmtK(taxAlphaPV(harvest.totalSaved, r, y))}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 8, fontSize: 9, color: C.muted, fontFamily: mono }}>
                  Highlighted column = current return assumption · Highlighted row = current exit year · All values are PV of tax deferral benefit
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      <div className="co-footer-pad" style={{ fontSize: 10, color: C.muted, fontFamily: mono, lineHeight: 1.7 }}>
        IRS § 1091 wash-sale rules · ST capital gains taxed as ordinary income · LT gains at 0/15/20% federal + 3.8% NIIT at high income ·
        Up to $3,000 of net capital losses deductible against ordinary income annually · Tax alpha = PV of tax deferral, not a permanent savings ·
        Not financial or tax advice. Consult a CPA.
      </div>
    </div>
  );
}
