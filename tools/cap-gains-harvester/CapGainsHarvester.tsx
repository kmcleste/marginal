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

type FilingStatus = "single" | "mfj";

// ─── Tax data ─────────────────────────────────────────────────────────────────

const LTCG_BRACKETS: Record<FilingStatus, Array<{ rate: number; max: number }>> = {
  single: [
    { rate: 0.00, max: 47025 },
    { rate: 0.15, max: 518900 },
    { rate: 0.20, max: Infinity },
  ],
  mfj: [
    { rate: 0.00, max: 94050 },
    { rate: 0.15, max: 583750 },
    { rate: 0.20, max: Infinity },
  ],
};

const ORDINARY_BRACKETS: Record<FilingStatus, Array<{ rate: number; min: number; max: number }>> = {
  single: [
    { rate: 0.10, min: 0,      max: 11600 },
    { rate: 0.12, min: 11600,  max: 47150 },
    { rate: 0.22, min: 47150,  max: 100525 },
    { rate: 0.24, min: 100525, max: 191950 },
    { rate: 0.32, min: 191950, max: 243725 },
    { rate: 0.35, min: 243725, max: 609350 },
    { rate: 0.37, min: 609350, max: Infinity },
  ],
  mfj: [
    { rate: 0.10, min: 0,      max: 23200 },
    { rate: 0.12, min: 23200,  max: 94300 },
    { rate: 0.22, min: 94300,  max: 201050 },
    { rate: 0.24, min: 201050, max: 383900 },
    { rate: 0.32, min: 383900, max: 487450 },
    { rate: 0.35, min: 487450, max: 731200 },
    { rate: 0.37, min: 731200, max: Infinity },
  ],
};

const STD_DEDUCTIONS: Record<FilingStatus, number> = { single: 14600, mfj: 29200 };
const NIIT_THRESHOLD: Record<FilingStatus, number> = { single: 200000, mfj: 250000 };

// ─── Math helpers ─────────────────────────────────────────────────────────────

function calcOrdinaryTax(taxableIncome: number, status: FilingStatus): number {
  let tax = 0;
  for (const bracket of ORDINARY_BRACKETS[status]) {
    if (taxableIncome <= bracket.min) break;
    const taxable = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxable * bracket.rate;
  }
  return tax;
}

function pvFutureSavings(gainAmount: number, futureRate: number, returnRate: number, years: number): number {
  // Harvest at 0% now → basis stepped up by gainAmount → save gainAmount * futureRate when sold later
  // PV of that future savings discounted at returnRate
  if (years <= 0 || returnRate <= 0) return gainAmount * futureRate;
  return (gainAmount * futureRate) / Math.pow(1 + returnRate, years);
}

// ─── UI primitives ────────────────────────────────────────────────────────────

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

function Sl({ label, value, min, max, step, onChange, color = C.accent, fmt: fmtFn = fmt, hint, disabled }: {
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

function Row({ label, value, color = C.textDim, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 11, padding: "4px 0", borderBottom: `1px solid ${C.border}22` }}>
      <span style={{ color: C.textDim }}>{label}</span>
      <span style={{ color, fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}

// ─── Income Stacking Visualization ───────────────────────────────────────────

interface StackVizProps {
  pretaxDed: number;
  deduction: number;
  ordinaryTaxableIncome: number;
  zeroRateThreshold: number;
  harvestableAtZero: number;
  harvestableAtFifteen: number;
  fifteenRateThreshold: number;
  exceeded: boolean;
}

function IncomeStackViz({
  pretaxDed, deduction, ordinaryTaxableIncome,
  zeroRateThreshold, harvestableAtZero,
  harvestableAtFifteen, fifteenRateThreshold, exceeded,
}: StackVizProps) {
  const VIZ_H = 220;
  const BAR_W = 120;
  const PAD_L = 90;  // left padding for labels
  const PAD_R = 16;
  const totalW = PAD_L + BAR_W + PAD_R + 140; // right-side annotation space

  // Total scale: show up to 15% above the 15% threshold or current stack whichever larger
  const totalStack = pretaxDed + deduction + ordinaryTaxableIncome + Math.max(harvestableAtZero, fifteenRateThreshold - zeroRateThreshold + 20000);
  const scaleMax = Math.max(fifteenRateThreshold * 0.25, totalStack * 1.08);

  const toY = (v: number) => VIZ_H - (v / scaleMax) * VIZ_H;
  const toH = (v: number) => (v / scaleMax) * VIZ_H;

  const bottom = 0;
  const pretaxTop  = bottom + pretaxDed;
  const dedTop     = pretaxTop + deduction;
  const ordTop     = dedTop + ordinaryTaxableIncome;
  const harv0Top   = ordTop + harvestableAtZero;

  const layers = [
    { label: "Pre-tax contribs", from: bottom,    to: pretaxTop,  color: C.muted,  bgColor: C.muted + "33" },
    { label: "Deduction",        from: pretaxTop,  to: dedTop,     color: C.blue,   bgColor: C.blue + "22" },
    { label: "Ordinary income",  from: dedTop,     to: ordTop,     color: C.gold,   bgColor: C.gold + "22" },
  ];

  const zeroY   = toY(zeroRateThreshold);
  const ordTopY = toY(ordTop);
  const harv0TopY = toY(harv0Top);

  // 0% harvest zone: space between ordTop and zeroRateThreshold (if any)
  const zeroZoneH  = toH(Math.max(0, zeroRateThreshold - ordTop));
  const zeroZoneY  = toY(zeroRateThreshold);

  // Harvested at 0% portion (limited by unrealized LTCG)
  const harvested0H = toH(harvestableAtZero);

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width={totalW}
        height={VIZ_H + 28}
        viewBox={`0 0 ${totalW} ${VIZ_H + 28}`}
        style={{ display: "block", minWidth: totalW, maxWidth: "100%" }}
      >
        {/* ── Stacked income bars ── */}
        {layers.map((layer, i) => {
          const h = toH(layer.to - layer.from);
          const y = toY(layer.to);
          if (h < 1) return null;
          return (
            <g key={i}>
              <rect
                x={PAD_L} y={y}
                width={BAR_W} height={h}
                fill={layer.bgColor}
                stroke={layer.color + "55"}
                strokeWidth={1}
              />
              {h > 14 && (
                <text
                  x={PAD_L + BAR_W / 2} y={y + Math.min(h / 2, 10) + 3}
                  textAnchor="middle" fill={layer.color}
                  fontSize={9} fontFamily={mono}
                >
                  {fmtK(layer.to - layer.from)}
                </text>
              )}
            </g>
          );
        })}

        {/* ── 0% zone: room between ordTop and threshold ── */}
        {!exceeded && zeroZoneH > 1 && (
          <rect
            x={PAD_L} y={zeroZoneY}
            width={BAR_W} height={zeroZoneH}
            fill={C.accent + "15"}
            stroke={C.accent + "33"}
            strokeWidth={1}
            strokeDasharray="3,2"
          />
        )}

        {/* ── Harvested-at-0% overlay ── */}
        {harvestableAtZero > 0 && !exceeded && (
          <rect
            x={PAD_L} y={toY(ordTop + harvestableAtZero)}
            width={BAR_W} height={harvested0H}
            fill={C.accent + "33"}
            stroke={C.accent + "77"}
            strokeWidth={1.5}
          />
        )}

        {/* ── 0% threshold line ── */}
        <line x1={PAD_L - 6} x2={PAD_L + BAR_W + 6} y1={zeroY} y2={zeroY}
          stroke={exceeded ? C.orange : C.accent} strokeWidth={1.5} strokeDasharray="5,3" />
        <text x={PAD_L - 8} y={zeroY + 4} textAnchor="end" fill={exceeded ? C.orange : C.accent}
          fontSize={8} fontFamily={mono}>
          {fmtK(zeroRateThreshold)}
        </text>

        {/* ── ordTop line ── */}
        {ordTop > 0 && (
          <line x1={PAD_L - 4} x2={PAD_L + BAR_W + 4} y1={ordTopY} y2={ordTopY}
            stroke={C.gold + "66"} strokeWidth={1} />
        )}

        {/* ── Right-side annotations ── */}
        {/* ordinary income label */}
        {toH(ordinaryTaxableIncome) > 8 && (
          <text
            x={PAD_L + BAR_W + 8}
            y={toY(dedTop + ordinaryTaxableIncome / 2) + 4}
            fill={C.gold} fontSize={9} fontFamily={mono}
          >
            Ordinary
          </text>
        )}

        {/* 0% room annotation */}
        {!exceeded && zeroZoneH > 4 && (
          <>
            <line x1={PAD_L + BAR_W + 4} x2={PAD_L + BAR_W + 14}
              y1={zeroZoneY + zeroZoneH} y2={zeroZoneY + zeroZoneH}
              stroke={C.accent + "66"} strokeWidth={1} />
            <line x1={PAD_L + BAR_W + 4} x2={PAD_L + BAR_W + 14}
              y1={zeroZoneY} y2={zeroZoneY}
              stroke={C.accent + "66"} strokeWidth={1} />
            <line x1={PAD_L + BAR_W + 14} x2={PAD_L + BAR_W + 14}
              y1={zeroZoneY} y2={zeroZoneY + zeroZoneH}
              stroke={C.accent + "66"} strokeWidth={1} />
            <text
              x={PAD_L + BAR_W + 20}
              y={zeroZoneY + zeroZoneH / 2 + 4}
              fill={C.accent} fontSize={9} fontFamily={mono}
            >
              0% room
            </text>
            <text
              x={PAD_L + BAR_W + 20}
              y={zeroZoneY + zeroZoneH / 2 + 15}
              fill={C.accent + "bb"} fontSize={8} fontFamily={mono}
            >
              {fmtK(Math.max(0, zeroRateThreshold - ordTop))}
            </text>
          </>
        )}

        {/* exceeded label */}
        {exceeded && (
          <text x={PAD_L + BAR_W + 12} y={zeroY + 4} fill={C.orange} fontSize={9} fontFamily={mono}>
            Over limit
          </text>
        )}

        {/* 0% harvest band label */}
        {harvestableAtZero > 0 && !exceeded && harvested0H > 8 && (
          <text
            x={PAD_L + BAR_W / 2}
            y={toY(ordTop + harvestableAtZero / 2) + 4}
            textAnchor="middle" fill={C.accent} fontSize={8} fontFamily={mono}
            fontWeight="bold"
          >
            0% LTCG
          </text>
        )}

        {/* ── Layer labels on left ── */}
        {layers.map((layer, i) => {
          const h = toH(layer.to - layer.from);
          const y = toY(layer.to);
          if (h < 6) return null;
          return (
            <text
              key={i}
              x={PAD_L - 10}
              y={y + Math.min(h / 2, 9) + 3}
              textAnchor="end"
              fill={layer.color}
              fontSize={8}
              fontFamily={mono}
            >
              {layer.label}
            </text>
          );
        })}

        {/* ── X-axis baseline ── */}
        <line x1={PAD_L} x2={PAD_L + BAR_W} y1={VIZ_H} y2={VIZ_H} stroke={C.border} strokeWidth={1} />

        {/* ── Bottom labels ── */}
        <text x={PAD_L + BAR_W / 2} y={VIZ_H + 14} textAnchor="middle" fill={C.muted} fontSize={8} fontFamily={mono}>
          Taxable income stack
        </text>
        <text x={PAD_L + BAR_W / 2} y={VIZ_H + 24} textAnchor="middle" fill={C.textDim} fontSize={9} fontFamily={mono} fontWeight="bold">
          {exceeded ? "⚠ Exceeds 0% threshold" : `Room: ${fmtK(Math.max(0, zeroRateThreshold - ordTop))}`}
        </text>

        {/* ── Legend dots ── */}
        {[
          { color: C.gold, label: "Ordinary income" },
          { color: C.accent, label: "0% LTCG zone" },
        ].map((item, i) => (
          <g key={i}>
            <rect x={PAD_L + i * 130} y={VIZ_H - 8} width={6} height={6} fill={item.color + "44"} stroke={item.color} strokeWidth={1} rx={1} />
            <text x={PAD_L + i * 130 + 10} y={VIZ_H - 2} fill={C.mutedLight} fontSize={7} fontFamily={sans}>{item.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CapGainsHarvester() {
  const [filingStatus,    setFilingStatus]    = useState<FilingStatus>("single");
  const [wages,           setWages]           = useState(40000);
  const [otherOrdinary,   setOtherOrdinary]   = useState(0);
  const [itemizedDed,     setItemizedDed]     = useState(0);
  const [pretaxDed,       setPretaxDed]       = useState(0);
  const [stateRate,       setStateRate]       = useState(0);
  const [unrealizedLTCG,  setUnrealizedLTCG]  = useState(150000);
  const [tab,             setTab]             = useState("harvest");

  // Basis step-up tab
  const [futureRate,      setFutureRate]      = useState(15);
  const [yearsToSell,     setYearsToSell]     = useState(15);
  const [returnRate,      setReturnRate]      = useState(7);

  // Multi-year plan tab
  const [gapYears,        setGapYears]        = useState(10);
  const [gapWages,        setGapWages]        = useState(20000);
  const [gapAnnualLTCG,   setGapAnnualLTCG]   = useState(80000);

  // Interaction tab — additional income types
  const [rothConversion,  setRothConversion]  = useState(0);
  const [ssIncome,        setSsIncome]        = useState(0);
  const [rentalIncome,    setRentalIncome]    = useState(0);
  const [sideIncome,      setSideIncome]      = useState(0);

  // ── Core computed values ──
  const calc = useMemo(() => {
    const totalOrdinaryGross = wages + otherOrdinary;
    const agi = Math.max(0, totalOrdinaryGross - pretaxDed);
    const stdDed = STD_DEDUCTIONS[filingStatus];
    const deduction = Math.max(stdDed, itemizedDed);
    const ordinaryTaxableIncome = Math.max(0, agi - deduction);

    const zeroRateThreshold    = LTCG_BRACKETS[filingStatus][0]?.max ?? 47025;
    const fifteenRateThreshold = LTCG_BRACKETS[filingStatus][1]?.max ?? 518900;

    const zeroRateRoom = Math.max(0, zeroRateThreshold - ordinaryTaxableIncome);
    const harvestableAtZero = Math.min(zeroRateRoom, unrealizedLTCG);

    const fifteenRateRoom = Math.max(0, fifteenRateThreshold - Math.max(ordinaryTaxableIncome, zeroRateThreshold));
    const harvestableAtFifteen = Math.min(fifteenRateRoom, Math.max(0, unrealizedLTCG - harvestableAtZero));

    const niitSurtax = agi > NIIT_THRESHOLD[filingStatus] ? 0.038 : 0;

    const taxOnZeroHarvest    = harvestableAtZero * stateRate / 100;
    const effectiveFifteenRate = 0.15 + niitSurtax + stateRate / 100;
    const taxOnFifteenHarvest  = harvestableAtFifteen * effectiveFifteenRate;

    const exceeded = ordinaryTaxableIncome >= zeroRateThreshold;

    // Next marginal $ LTCG rate
    let nextRate: string;
    if (exceeded) {
      nextRate = `${(15 + niitSurtax * 100 + stateRate).toFixed(1)}%`;
    } else {
      nextRate = `${stateRate.toFixed(1)}% (state only)`;
    }

    // Ordinary tax (just for reference)
    const ordinaryTax = calcOrdinaryTax(ordinaryTaxableIncome, filingStatus);

    return {
      agi, deduction, ordinaryTaxableIncome,
      zeroRateThreshold, fifteenRateThreshold,
      zeroRateRoom, harvestableAtZero,
      fifteenRateRoom, harvestableAtFifteen,
      niitSurtax, taxOnZeroHarvest,
      effectiveFifteenRate, taxOnFifteenHarvest,
      exceeded, nextRate, ordinaryTax,
      stdDed,
    };
  }, [wages, otherOrdinary, pretaxDed, itemizedDed, filingStatus, stateRate, unrealizedLTCG]);

  // ── Multi-year plan ──
  const gapPlan = useMemo(() => {
    const rows = [];
    let cumStep = 0;
    let cumTaxSaved = 0;

    for (let yr = 1; yr <= gapYears; yr++) {
      const agi = Math.max(0, gapWages - pretaxDed);
      const deduction = STD_DEDUCTIONS[filingStatus];
      const ordTaxable = Math.max(0, agi - deduction);
      const zeroThresh = LTCG_BRACKETS[filingStatus][0]?.max ?? 47025;
      const room = Math.max(0, zeroThresh - ordTaxable);
      const harvested = Math.min(room, gapAnnualLTCG);
      const stepUp = harvested; // basis stepped up by this amount
      cumStep += stepUp;

      // Tax saved vs paying 15% later (simplified)
      const savedVs15 = harvested * 0.15;
      cumTaxSaved += savedVs15;

      rows.push({
        yr, ordTaxable, room, harvested,
        stepUp, cumStep, savedVs15, cumTaxSaved,
      });
    }
    return rows;
  }, [gapYears, gapWages, pretaxDed, filingStatus, gapAnnualLTCG]);

  // ── Interaction tab ──
  const interactionCalc = useMemo(() => {
    const ssTaxable = Math.min(ssIncome * 0.85, ssIncome);
    const baseExtra = ssTaxable + rentalIncome + sideIncome;

    // Without Roth conversion
    const agiNoRoth = Math.max(0, wages + otherOrdinary + baseExtra - pretaxDed);
    const dedNoRoth = Math.max(STD_DEDUCTIONS[filingStatus], itemizedDed);
    const ordNoRoth = Math.max(0, agiNoRoth - dedNoRoth);
    const zeroThresh = LTCG_BRACKETS[filingStatus][0]?.max ?? 47025;
    const roomNoRoth = Math.max(0, zeroThresh - ordNoRoth);

    // With Roth conversion
    const agiRoth = Math.max(0, wages + otherOrdinary + baseExtra + rothConversion - pretaxDed);
    const ordRoth = Math.max(0, agiRoth - dedNoRoth);
    const roomRoth = Math.max(0, zeroThresh - ordRoth);

    // ACA cliff: 400% FPL
    const acaCliff = filingStatus === "single" ? 58320 : 120000; // approx 2024
    const acaWarning = (agiRoth > acaCliff * 0.95 && agiRoth < acaCliff * 1.05);

    // IRMAA threshold (Medicare, 2024): > $103k single / $206k MFJ
    const irmaaThreshold = filingStatus === "single" ? 103000 : 206000;
    const irmaaWarning = (agiRoth > irmaaThreshold * 0.95 && agiRoth < irmaaThreshold * 1.05);

    return {
      ordNoRoth, roomNoRoth, ordRoth, roomRoth,
      acaWarning, irmaaWarning, acaCliff, irmaaThreshold,
    };
  }, [wages, otherOrdinary, pretaxDed, itemizedDed, filingStatus, rothConversion, ssIncome, rentalIncome, sideIncome]);

  const tabs = [
    { id: "harvest",    label: "Harvest" },
    { id: "stepup",     label: "Basis Step-Up" },
    { id: "multiyear",  label: "Multi-Year Plan" },
    { id: "interact",   label: "Income Interactions" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: sans }}>

      {/* ── HEADER ── */}
      <div className="co-header-pad" style={{ background: `linear-gradient(180deg, #0a0f1e 0%, ${C.bg} 100%)`, borderBottom: `1px solid ${C.border}` }}>
        <div className="co-header-row">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 17, fontWeight: 700, fontFamily: mono, color: C.accent, letterSpacing: "0.03em" }}>
                CAPITAL GAINS BRACKET HARVESTER
              </span>
              <Tag color={C.gold}>2024</Tag>
              <Tag color={filingStatus === "single" ? C.blue : C.purple}>
                {filingStatus === "single" ? "SINGLE" : "MFJ"}
              </Tag>
              <span className="co-mob-hide">
                <Tag color={calc.exceeded ? C.orange : C.accent}>
                  0% LTCG ROOM: {fmtK(calc.zeroRateRoom)}
                </Tag>
              </span>
            </div>
            <div className="co-mob-hide" style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, marginTop: 3 }}>
              Realize long-term capital gains in the 0% bracket — get a free cost-basis step-up, pay zero federal tax.
            </div>
          </div>
          <div className="co-kpi-row">
            {[
              { label: "0% Bracket Room",    val: fmtK(calc.zeroRateRoom),       c: calc.exceeded ? C.orange : C.accent },
              { label: "Harvestable @ 0%",   val: fmtK(calc.harvestableAtZero),  c: calc.harvestableAtZero > 0 ? C.accent : C.mutedLight },
              { label: "Tax @ 0% Harvest",   val: stateRate > 0 ? fmt(calc.taxOnZeroHarvest) : "$0", c: calc.harvestableAtZero > 0 ? C.gold : C.mutedLight },
              { label: "Next $ Rate",        val: calc.nextRate,                  c: C.textDim },
            ].map((x, i) => (
              <div key={x.label} style={{
                textAlign: "right", paddingLeft: 16, paddingRight: 4, paddingTop: 4, paddingBottom: 4,
                borderLeft: i > 0 ? `1px solid ${C.border}` : "none",
                marginLeft: i > 0 ? 4 : 0, minWidth: 0,
              }}>
                <div style={{ fontSize: 9, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{x.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: x.c, fontFamily: mono, whiteSpace: "nowrap" }}>{x.val}</div>
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

        {/* ══ HARVEST TAB ══ */}
        {tab === "harvest" && (
          <div className="co-grid-lt">

            {/* Left: config sliders */}
            <div>
              {/* Filing status selector */}
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Filing Status</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["single", "mfj"] as const).map(s => (
                    <button key={s} onClick={() => setFilingStatus(s)} style={{
                      flex: 1, padding: "8px 0", borderRadius: 6, cursor: "pointer",
                      fontFamily: mono, fontSize: 11, textTransform: "uppercase",
                      background: filingStatus === s ? C.accent + "22" : C.surfaceAlt,
                      border: `1px solid ${filingStatus === s ? C.accent : C.border}`,
                      color: filingStatus === s ? C.accent : C.mutedLight,
                    }}>
                      {s === "single" ? "Single" : "Married Filing Jointly"}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 10, color: C.muted, fontFamily: mono }}>
                  0% threshold: {filingStatus === "single" ? "$47,025" : "$94,050"} taxable income
                </div>
              </Card>

              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Income</div>
                <Sl label="W-2 Wages" value={wages} min={0} max={500000} step={1000}
                  onChange={setWages} color={C.gold}
                  hint="Salary, hourly wages — counts as ordinary income" />
                <Sl label="Other Ordinary Income" value={otherOrdinary} min={0} max={200000} step={1000}
                  onChange={setOtherOrdinary} color={C.gold}
                  hint="1099 income, taxable Social Security, pension distributions, etc." />
                <Sl label="Pre-Tax Deductions (401k, HSA…)" value={pretaxDed} min={0} max={70000} step={500}
                  onChange={setPretaxDed} color={C.blue}
                  hint="401(k), HSA, SEP-IRA — reduce AGI and push more income into 0% LTCG range" />
              </Card>

              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Deductions</div>
                <Sl label="Itemized Deductions (0 = use standard)" value={itemizedDed} min={0} max={200000} step={1000}
                  onChange={setItemizedDed} color={C.purple}
                  hint={`Standard deduction: ${fmt(STD_DEDUCTIONS[filingStatus])} — the larger of these is used`} />
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 11, padding: "4px 0" }}>
                  <span style={{ color: C.textDim }}>Deduction used</span>
                  <span style={{ color: C.purple, fontWeight: 600 }}>
                    {fmt(calc.deduction)} {itemizedDed > calc.stdDed ? "(itemized)" : "(standard)"}
                  </span>
                </div>
              </Card>

              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Positions</div>
                <Sl label="Unrealized LTCG Available to Harvest" value={unrealizedLTCG} min={0} max={2000000} step={5000}
                  onChange={setUnrealizedLTCG} color={C.accent}
                  hint="Total long-term (>1 year) unrealized gains in your taxable brokerage accounts" />
                <Sl label="State LTCG Rate" value={stateRate} min={0} max={14} step={0.25}
                  onChange={setStateRate} color={C.orange}
                  fmt={v => `${v.toFixed(2)}%`}
                  hint="State taxes may apply even when federal rate is 0% — CA ≈9.3%, NY ≈8.8%, TX/FL = 0%" />
              </Card>
            </div>

            {/* Right: visualization + results */}
            <div>

              {/* Income stacking viz */}
              <Card glow={calc.harvestableAtZero > 0 && !calc.exceeded} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Income Stacking — 2024 LTCG Bracket View
                </div>

                <IncomeStackViz
                  pretaxDed={pretaxDed}
                  deduction={calc.deduction}
                  ordinaryTaxableIncome={calc.ordinaryTaxableIncome}
                  zeroRateThreshold={calc.zeroRateThreshold}
                  harvestableAtZero={calc.harvestableAtZero}
                  harvestableAtFifteen={calc.harvestableAtFifteen}
                  fifteenRateThreshold={calc.fifteenRateThreshold}
                  exceeded={calc.exceeded}
                />

                {/* Summary below viz */}
                <div style={{ marginTop: 14 }}>
                  <div className="co-grid-3">
                    {[
                      { label: "AGI",               val: fmt(calc.agi),                     c: C.textDim },
                      { label: "Taxable Income",     val: fmt(calc.ordinaryTaxableIncome),   c: C.gold },
                      { label: "0% LTCG Room",       val: fmt(calc.zeroRateRoom),            c: calc.exceeded ? C.orange : C.accent },
                    ].map(x => (
                      <div key={x.label} style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", marginBottom: 3 }}>{x.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: x.c, fontFamily: mono }}>{x.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Results card */}
              <Card glow={calc.harvestableAtZero > 0} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                  Harvest Opportunity
                </div>

                {/* Big harvest number */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, padding: "14px 16px", background: C.accentDim, borderRadius: 10, border: `1px solid ${C.accent}33` }}>
                  <div>
                    <div style={{ fontSize: 9, color: C.accent, fontFamily: mono, textTransform: "uppercase", marginBottom: 2 }}>Harvestable at 0% Federal</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: C.accent, fontFamily: mono, lineHeight: 1 }}>
                      {fmt(calc.harvestableAtZero)}
                    </div>
                  </div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: C.accent, fontFamily: mono }}>Federal tax: $0</div>
                    <div style={{ fontSize: 11, color: stateRate > 0 ? C.orange : C.muted, fontFamily: mono }}>
                      State tax: {fmt(calc.taxOnZeroHarvest)}
                    </div>
                  </div>
                </div>

                {[
                  { label: "0% bracket room (total)",        val: fmt(calc.zeroRateRoom),         c: calc.exceeded ? C.orange : C.accent },
                  { label: "Your unrealized LTCG",           val: fmt(unrealizedLTCG),             c: C.text },
                  { label: "Harvestable at 0% (limited)",    val: fmt(calc.harvestableAtZero),     c: C.accent, bold: true },
                  { label: "Federal tax on 0% harvest",      val: calc.harvestableAtZero > 0 ? "$0  (0% bracket)" : "—", c: calc.harvestableAtZero > 0 ? C.accent : C.muted },
                  { label: `State tax (${stateRate}%)`,      val: fmt(calc.taxOnZeroHarvest),      c: stateRate > 0 ? C.orange : C.muted },
                  { label: "Room in 15% bracket",            val: fmt(calc.fifteenRateRoom),       c: C.blue },
                  { label: "Harvestable at 15%+",            val: fmt(calc.harvestableAtFifteen),  c: C.blue },
                  { label: `Effective 15% zone rate`,        val: pct(calc.effectiveFifteenRate),  c: C.orange },
                  { label: "Tax on 15% zone harvest",        val: fmt(calc.taxOnFifteenHarvest),   c: C.orange },
                ].map(r => (
                  <Row key={r.label} label={r.label} value={r.val} color={r.c} bold={r.bold === true} />
                ))}

                {calc.niitSurtax > 0 && (
                  <div style={{ marginTop: 10, padding: "8px 12px", background: C.red + "11", border: `1px solid ${C.red}33`, borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: C.red, fontFamily: mono }}>
                      NIIT 3.8% surtax applies — AGI exceeds NIIT threshold ({fmt(NIIT_THRESHOLD[filingStatus])})
                    </div>
                  </div>
                )}

                {calc.exceeded && (
                  <div style={{ marginTop: 10, padding: "8px 12px", background: C.orange + "11", border: `1px solid ${C.orange}33`, borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: C.orange, fontFamily: mono }}>
                      Ordinary income exceeds the 0% LTCG threshold. All LTCG will be taxed at 15%+ this year.
                      Consider increasing pre-tax deductions (401k, HSA) to reclaim the 0% bracket.
                    </div>
                  </div>
                )}
              </Card>

              {/* What to do */}
              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  How to Execute
                </div>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.8, fontFamily: sans }}>
                  {[
                    { step: "Step 1", color: C.accent, text: `Sell ${fmt(calc.harvestableAtZero)} of appreciated long-term positions in your taxable brokerage account.` },
                    { step: "Step 2", color: C.blue,   text: "Immediately rebuy the same (or similar) securities. No wash-sale concern — you're selling gains, not losses." },
                    { step: "Step 3", color: C.gold,   text: `Your cost basis is now stepped up by ${fmt(calc.harvestableAtZero)}. Future sales of this amount will owe $0 federal (at 0% rate).` },
                    { step: "Result", color: C.accent, text: `You paid $0 federal tax and got a free basis step-up worth ${fmt(calc.harvestableAtZero * 0.15)} in future 15% savings (at minimum).` },
                  ].map(item => (
                    <div key={item.step} style={{ marginBottom: 8, padding: "8px 12px", background: C.surfaceAlt, borderRadius: 6, borderLeft: `2px solid ${item.color}` }}>
                      <strong style={{ color: item.color }}>{item.step}:</strong> {item.text}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ══ BASIS STEP-UP TAB ══ */}
        {tab === "stepup" && (
          <div className="co-grid-2">

            {/* Left */}
            <div>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Why Harvest at 0%? (Even if you don&apos;t need cash)
                </div>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.8, fontFamily: sans, marginBottom: 14 }}>
                  When you sell at 0% and immediately rebuy, you step up your cost basis at zero tax cost.
                  Every dollar of basis you step up today is a dollar you won&apos;t owe tax on later — when rates might be higher.
                </div>

                <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                  {[
                    { label: "Available to harvest at 0%", val: fmt(calc.harvestableAtZero), c: C.accent },
                    { label: "Old cost basis",             val: fmt(unrealizedLTCG > 0 ? unrealizedLTCG * 0.4 : 0), c: C.muted },
                    { label: "Basis step-up",              val: fmt(calc.harvestableAtZero), c: C.accent },
                    { label: "New cost basis",             val: fmt((unrealizedLTCG > 0 ? unrealizedLTCG * 0.4 : 0) + calc.harvestableAtZero), c: C.gold },
                  ].map(r => (
                    <Row key={r.label} label={r.label} value={r.val} color={r.c} />
                  ))}
                </div>

                <Sl label="Future LTCG Rate When You Sell" value={futureRate} min={0} max={24} step={0.5}
                  onChange={setFutureRate} color={C.red} fmt={v => `${v}%`}
                  hint="If rates increase or your income is higher later, this could be 18.8% (15%+NIIT) or 23.8%" />
                <Sl label="Years Until Final Sale" value={yearsToSell} min={1} max={40} step={1}
                  onChange={setYearsToSell} color={C.purple} fmt={v => `${v} yrs`}
                  hint="When you expect to ultimately sell these positions" />
                <Sl label="Expected Annual Return" value={returnRate} min={2} max={14} step={0.5}
                  onChange={setReturnRate} color={C.blue} fmt={v => `${v}%`}
                  hint="Used to discount future tax savings to today's present value" />
              </Card>

              <Card goldGlow={calc.harvestableAtZero > 0}>
                <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Basis Step-Up Value
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[
                    { l: "Future tax savings",   v: fmt(calc.harvestableAtZero * futureRate / 100),                                               c: C.gold },
                    { l: "PV of savings",        v: fmt(pvFutureSavings(calc.harvestableAtZero, futureRate / 100, returnRate / 100, yearsToSell)), c: C.accent },
                  ].map(x => (
                    <div key={x.l} style={{ background: C.surfaceAlt, borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", marginBottom: 4 }}>{x.l}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: x.c, fontFamily: mono }}>{x.v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: "10px 14px", background: C.accentDim, borderRadius: 8, border: `1px solid ${C.accent}33` }}>
                  <div style={{ fontSize: 11, color: C.accent, fontFamily: mono, marginBottom: 4 }}>
                    Always harvest at 0%
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, lineHeight: 1.6 }}>
                    Harvesting at 0% is a dominant strategy: you pay $0 federal today, step up your basis,
                    and reduce future tax liability. There is no downside — unless you trigger state taxes
                    large enough to outweigh the future savings (check your state rate carefully).
                  </div>
                </div>
              </Card>
            </div>

            {/* Right: PV table */}
            <div>
              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  PV of Future Tax Savings — Harvest Amount: {fmtK(calc.harvestableAtZero)}
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: C.muted, fontWeight: 400, borderBottom: `1px solid ${C.border}`, fontSize: 9 }}>Years</th>
                        {[15, 18.8, 20, 23.8].map(r => (
                          <th key={r} style={{
                            textAlign: "right", padding: "6px 8px", fontSize: 9, fontWeight: r === futureRate ? 700 : 400,
                            color: r === futureRate ? C.accent : C.muted, borderBottom: `1px solid ${C.border}`,
                          }}>{r}% rate</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[5, 10, 15, 20, 25, 30].map(y => (
                        <tr key={y} style={{ background: y === yearsToSell ? C.accent + "08" : "transparent", borderBottom: `1px solid ${C.border}22` }}>
                          <td style={{ padding: "5px 8px", color: y === yearsToSell ? C.accent : C.textDim, fontWeight: y === yearsToSell ? 700 : 400 }}>{y} yr</td>
                          {[15, 18.8, 20, 23.8].map(r => (
                            <td key={r} style={{
                              padding: "5px 8px", textAlign: "right",
                              color: (r === futureRate && y === yearsToSell) ? C.gold : r === futureRate ? C.accent : C.mutedLight,
                              fontWeight: (r === futureRate && y === yearsToSell) ? 700 : 400,
                            }}>
                              {fmtK(pvFutureSavings(calc.harvestableAtZero, r / 100, returnRate / 100, y))}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 8, fontSize: 9, color: C.muted, fontFamily: mono }}>
                  Bold column = current future rate · Bold row = current years · Discounted at {returnRate}% annual return
                </div>
              </Card>

              <Card style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  The Step-Up Logic
                </div>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.8, fontFamily: sans }}>
                  {[
                    { lhs: "Today (0% bracket)", rhs: "Sell $X of gains. Pay $0 federal tax. Immediately rebuy." },
                    { lhs: "New cost basis",      rhs: "Now set at current market value — $X higher than before." },
                    { lhs: "Future sale",         rhs: "That $X of gain no longer exists. It was recognized at 0% and reset." },
                    { lhs: "Net benefit",         rhs: `$X × future_rate = ${fmt(calc.harvestableAtZero * futureRate / 100)} at ${futureRate}% future rate.` },
                  ].map((row, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: `1px solid ${C.border}22` }}>
                      <span style={{ color: C.accent, minWidth: 120, flexShrink: 0, fontSize: 10, fontFamily: mono }}>{row.lhs}</span>
                      <span style={{ color: C.textDim, fontSize: 11 }}>{row.rhs}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ══ MULTI-YEAR PLAN TAB ══ */}
        {tab === "multiyear" && (
          <div className="co-grid-2">

            {/* Left */}
            <div>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Gap Year Planning
                </div>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.8, fontFamily: sans, marginBottom: 14 }}>
                  Early retirees often have a &ldquo;gap&rdquo; between retirement and Social Security / RMDs kicking in.
                  These low-income years are a prime window for systematic 0% LTCG harvesting.
                </div>

                <Sl label="Years of Low Income (Gap Years)" value={gapYears} min={1} max={20} step={1}
                  onChange={setGapYears} color={C.blue} fmt={v => `${v} yrs`}
                  hint="How many years before SS, pensions, or RMDs push income up" />
                <Sl label="Annual Income During Gap" value={gapWages} min={0} max={200000} step={1000}
                  onChange={setGapWages} color={C.gold}
                  hint="Wages, part-time income, or other ordinary income in retirement" />
                <Sl label="Annual LTCG Available to Harvest" value={gapAnnualLTCG} min={0} max={500000} step={5000}
                  onChange={setGapAnnualLTCG} color={C.accent}
                  hint="Long-term unrealized gains in taxable brokerage per year" />
              </Card>

              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Cumulative Opportunity
                </div>
                {(() => {
                  const totalStep = gapPlan.reduce((s, r) => s + r.stepUp, 0);
                  const totalSaved = gapPlan.reduce((s, r) => s + r.savedVs15, 0);
                  const lastRow = gapPlan[gapPlan.length - 1];
                  const room = lastRow?.room ?? 0;
                  return (
                    <div className="co-grid-2b">
                      {[
                        { l: "Total basis stepped up", v: fmt(totalStep),  c: C.accent },
                        { l: "Tax saved vs 15% later", v: fmt(totalSaved), c: C.gold },
                        { l: "Annual 0% room",          v: fmt(room),       c: C.blue },
                        { l: "Gap years",               v: `${gapYears}`,   c: C.textDim },
                      ].map(x => (
                        <div key={x.l} style={{ background: C.surfaceAlt, borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, textTransform: "uppercase", marginBottom: 3 }}>{x.l}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: x.c, fontFamily: mono }}>{x.v}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <div style={{ marginTop: 12, padding: "10px 14px", background: C.goldDim, borderRadius: 8, border: `1px solid ${C.gold}33` }}>
                  <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, marginBottom: 4 }}>Gap Year Insight</div>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, lineHeight: 1.6 }}>
                    If you retire at 55 and SS starts at 67 — that&apos;s 12 years of potential 0% harvesting.
                    Each year you can step up {fmt(Math.max(0, (LTCG_BRACKETS[filingStatus][0]?.max ?? 47025) - Math.max(0, gapWages - STD_DEDUCTIONS[filingStatus])))} of basis tax-free.
                    Use these years aggressively before RMDs and SS push you into higher brackets.
                  </div>
                </div>
              </Card>
            </div>

            {/* Right: year-by-year table */}
            <div>
              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Year-by-Year Harvest Plan
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 10 }}>
                    <thead>
                      <tr>
                        {["Year", "Ordinary Tax Inc.", "0% Room", "Harvested", "Cum. Step-Up", "vs 15% Later"].map(h => (
                          <th key={h} style={{ textAlign: h === "Year" ? "left" : "right", padding: "5px 7px", color: C.muted, fontWeight: 400, borderBottom: `1px solid ${C.border}`, fontSize: 9, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gapPlan.map(row => (
                        <tr key={row.yr} style={{ borderBottom: `1px solid ${C.border}22` }}>
                          <td style={{ padding: "5px 7px", color: C.blue, fontWeight: 600 }}>Yr {row.yr}</td>
                          <td style={{ padding: "5px 7px", textAlign: "right", color: C.gold }}>{fmtK(row.ordTaxable)}</td>
                          <td style={{ padding: "5px 7px", textAlign: "right", color: C.accent }}>{fmtK(row.room)}</td>
                          <td style={{ padding: "5px 7px", textAlign: "right", color: row.harvested > 0 ? C.accent : C.muted, fontWeight: row.harvested > 0 ? 600 : 400 }}>{fmtK(row.harvested)}</td>
                          <td style={{ padding: "5px 7px", textAlign: "right", color: C.textDim }}>{fmtK(row.cumStep)}</td>
                          <td style={{ padding: "5px 7px", textAlign: "right", color: C.gold, fontWeight: 600 }}>{fmtK(row.cumTaxSaved)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: `1px solid ${C.border}` }}>
                        <td colSpan={3} style={{ padding: "5px 7px", color: C.muted, fontSize: 9 }}>Totals</td>
                        <td style={{ padding: "5px 7px", textAlign: "right", color: C.accent, fontWeight: 700 }}>{fmtK(gapPlan.reduce((s, r) => s + r.harvested, 0))}</td>
                        <td style={{ padding: "5px 7px", textAlign: "right", color: C.accent, fontWeight: 700 }}>{fmtK(gapPlan.reduce((s, r) => s + r.stepUp, 0))}</td>
                        <td style={{ padding: "5px 7px", textAlign: "right", color: C.gold, fontWeight: 700 }}>{fmtK(gapPlan.reduce((s, r) => s + r.savedVs15, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div style={{ marginTop: 8, fontSize: 9, color: C.muted, fontFamily: mono }}>
                  &ldquo;vs 15% later&rdquo; = tax avoided if those gains had been sold later at 15% federal. Assumes consistent income each year.
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ══ INCOME INTERACTIONS TAB ══ */}
        {tab === "interact" && (
          <div className="co-grid-2">

            {/* Left */}
            <div>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Competing Income Sources
                </div>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6, fontFamily: sans, marginBottom: 14 }}>
                  Every dollar of ordinary income reduces your 0% LTCG room by $1.
                  Roth conversions and LTCG harvesting compete for the same low-bracket space.
                </div>

                <Sl label="Roth Conversion Amount" value={rothConversion} min={0} max={200000} step={1000}
                  onChange={setRothConversion} color={C.purple}
                  hint="Each $1 of Roth conversion counts as ordinary income — trades off against LTCG room" />
                <Sl label="Social Security Income" value={ssIncome} min={0} max={80000} step={1000}
                  onChange={setSsIncome} color={C.blue}
                  hint="Up to 85% of SS is taxable — increases ordinary income and reduces LTCG room" />
                <Sl label="Rental Income (net)" value={rentalIncome} min={0} max={100000} step={1000}
                  onChange={setRentalIncome} color={C.gold}
                  hint="Net rental income after deductions — taxed as ordinary income" />
                <Sl label="Side Business / 1099 Income" value={sideIncome} min={0} max={100000} step={1000}
                  onChange={setSideIncome} color={C.orange}
                  hint="Self-employment income — taxed as ordinary (also subject to SE tax)" />
              </Card>

              <Card>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Roth vs. LTCG Harvest Trade-off
                </div>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.8, fontFamily: sans, marginBottom: 12 }}>
                  In a low-income year, you can use your bracket for Roth conversions OR for LTCG harvesting — but not always both.
                  Here&apos;s the trade-off:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    {
                      title: "Roth Conversion",
                      color: C.purple,
                      pros: ["Tax-free growth forever", "No future RMDs", "Estate planning benefit"],
                      cons: ["Pays tax now (even at 12%)", "Reduces LTCG room"],
                    },
                    {
                      title: "LTCG Harvest",
                      color: C.accent,
                      pros: ["$0 federal tax", "Free basis step-up", "Keep market exposure"],
                      cons: ["Deferred, not tax-free", "State taxes may apply"],
                    },
                  ].map(item => (
                    <div key={item.title} style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px", border: `1px solid ${item.color}33` }}>
                      <div style={{ fontSize: 10, color: item.color, fontFamily: mono, fontWeight: 700, marginBottom: 6 }}>{item.title}</div>
                      {item.pros.map(p => <div key={p} style={{ fontSize: 9, color: C.accent, fontFamily: sans, padding: "1px 0" }}>+ {p}</div>)}
                      {item.cons.map(c => <div key={c} style={{ fontSize: 9, color: C.orange, fontFamily: sans, padding: "1px 0" }}>− {c}</div>)}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right */}
            <div>
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                  Impact on 0% LTCG Room
                </div>

                {/* Side-by-side comparison */}
                <div className="co-grid-2b">
                  {[
                    { label: "Without Roth Conversion", ord: interactionCalc.ordNoRoth, room: interactionCalc.roomNoRoth, color: C.accent },
                    { label: "With Roth Conversion", ord: interactionCalc.ordRoth, room: interactionCalc.roomRoth, color: C.purple },
                  ].map(col => (
                    <div key={col.label} style={{ background: C.surfaceAlt, borderRadius: 8, padding: "12px 14px", border: `1px solid ${col.color}33` }}>
                      <div style={{ fontSize: 9, color: col.color, fontFamily: mono, textTransform: "uppercase", marginBottom: 8 }}>{col.label}</div>
                      <div style={{ fontSize: 11, color: C.textDim, fontFamily: mono, marginBottom: 4 }}>
                        Ordinary taxable: <span style={{ color: C.gold, fontWeight: 600 }}>{fmt(col.ord)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.textDim, fontFamily: mono }}>
                        0% LTCG room: <span style={{ color: col.room > 0 ? col.color : C.orange, fontWeight: 700, fontSize: 14 }}>{fmt(col.room)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Roth conversion cost vs. LTCG room lost */}
                {rothConversion > 0 && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: C.purple + "11", border: `1px solid ${C.purple}33`, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: C.purple, fontFamily: mono, marginBottom: 4 }}>
                      Cost of Roth Conversion: {fmt(rothConversion)} converted
                    </div>
                    <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, lineHeight: 1.6 }}>
                      Converting {fmt(rothConversion)} as Roth reduces your 0% LTCG room by {fmt(Math.min(rothConversion, interactionCalc.roomNoRoth))}.
                      You can do one or the other — or split the space between them.
                    </div>
                  </div>
                )}
              </Card>

              {/* Income sources breakdown */}
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.mutedLight, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Income Sources &amp; LTCG Room Impact
                </div>
                {[
                  { label: "W-2 wages",           val: wages,           note: "100% ordinary", color: C.gold },
                  { label: "Other ordinary",       val: otherOrdinary,   note: "100% ordinary", color: C.gold },
                  { label: "Pre-tax deductions",   val: -pretaxDed,      note: "reduces AGI",   color: C.blue },
                  { label: "SS income (85% rule)", val: Math.min(ssIncome * 0.85, ssIncome), note: "up to 85% taxable", color: C.blue },
                  { label: "Rental income",        val: rentalIncome,    note: "ordinary income", color: C.gold },
                  { label: "Side income",          val: sideIncome,      note: "ordinary income", color: C.orange },
                  { label: "Roth conversion",      val: rothConversion,  note: "ordinary income", color: C.purple },
                ].filter(item => item.val !== 0).map(item => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: mono, fontSize: 11, padding: "5px 0", borderBottom: `1px solid ${C.border}22` }}>
                    <div>
                      <span style={{ color: C.textDim }}>{item.label}</span>
                      <span style={{ fontSize: 9, color: C.muted, marginLeft: 6 }}>({item.note})</span>
                    </div>
                    <span style={{ color: item.val < 0 ? C.accent : item.color, fontWeight: 600 }}>
                      {item.val < 0 ? "−" : "+"}{fmt(Math.abs(item.val))}
                    </span>
                  </div>
                ))}

                <div style={{ marginTop: 10, padding: "8px 12px", background: C.surfaceAlt, borderRadius: 6, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: C.text, fontFamily: mono }}>0% LTCG Room</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: interactionCalc.roomRoth > 0 ? C.accent : C.orange, fontFamily: mono }}>
                    {fmt(interactionCalc.roomRoth)}
                  </span>
                </div>
              </Card>

              {/* Warnings */}
              {(interactionCalc.acaWarning || interactionCalc.irmaaWarning) && (
                <Card>
                  <div style={{ fontSize: 11, color: C.orange, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                    Threshold Warnings
                  </div>
                  {interactionCalc.acaWarning && (
                    <div style={{ padding: "8px 12px", background: C.orange + "11", border: `1px solid ${C.orange}33`, borderRadius: 6, marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: C.orange, fontFamily: mono, fontWeight: 600, marginBottom: 3 }}>ACA Premium Cliff</div>
                      <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, lineHeight: 1.5 }}>
                        Your MAGI ({fmt(Math.max(0, wages + otherOrdinary + rothConversion + Math.min(ssIncome * 0.85, ssIncome) + rentalIncome + sideIncome - pretaxDed))}) is near the ACA 400% FPL cliff ({fmt(interactionCalc.acaCliff)}).
                        Crossing this threshold could cost thousands in lost premium subsidies.
                      </div>
                    </div>
                  )}
                  {interactionCalc.irmaaWarning && (
                    <div style={{ padding: "8px 12px", background: C.red + "11", border: `1px solid ${C.red}33`, borderRadius: 6 }}>
                      <div style={{ fontSize: 10, color: C.red, fontFamily: mono, fontWeight: 600, marginBottom: 3 }}>IRMAA Threshold (Medicare)</div>
                      <div style={{ fontSize: 10, color: C.textDim, fontFamily: sans, lineHeight: 1.5 }}>
                        Near IRMAA surcharge threshold ({fmt(interactionCalc.irmaaThreshold)}).
                        Crossing this causes a step-up in Medicare Part B &amp; D premiums.
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div className="co-footer-pad" style={{ fontSize: 10, color: C.muted, fontFamily: mono, lineHeight: 1.7 }}>
        2024 0% LTCG threshold: $47,025 single / $94,050 MFJ (taxable income) ·
        LTCG stacks on top of ordinary income for rate determination ·
        NIIT 3.8% surtax applies when MAGI exceeds $200k single / $250k MFJ ·
        State taxes may apply even when federal rate is 0% · Not financial or tax advice.
      </div>
    </div>
  );
}
