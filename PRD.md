# Product Requirements Document

## Marginal — Open-Source Financial Tools for Self-Directed High Earners

**Status:** Draft v0.1
**Last updated:** May 2026
**Owner:** Kyle McLester
**License:** MIT (free and open source)

---

## 1. Summary

Marginal is a curated, open-source repository of client-side financial planning tools targeted at analytically-minded high earners who want to self-manage their compensation, taxes, and investments. Each tool treats personal finance as a solvable optimization problem rather than a passive dashboard to observe. Tools are fully client-side (no account linking, no data retention, no auth), share a common design language, and are backed by a transparent, testable math layer.

A secondary component is an agentic tax-data pipeline that maintains accurate, location-specific tax data across all 50 US states with minimal annual human effort.

The project is built primarily as a personal tool and learning exercise, then shared publicly to help others in the same situation.

---

## 2. Problem Statement

There is a structural gap in the personal finance tooling market:

- **Consumer tools** (Mint, Personal Capital, etc.) are oversimplified, advertising-driven, and require linking sensitive financial accounts. They optimize for engagement, not user outcomes.
- **Professional planning software** (Orion, eMoney, RightCapital) is advisor-facing, expensive ($500+/mo), and not available for self-service.
- **The middle is empty:** sophisticated, private, self-directed tools for users who understand marginal tax rates, contribution limits, and present value — and who want to *tune parameters* rather than be handed a pie chart.

High earners are simultaneously the most underserved by existing tools and the most skeptical of them. They want to see the math, control the inputs, and trust that the calculations are correct.

---

## 3. Goals & Non-Goals

### Goals

- Build a suite of high-quality, single-purpose financial tools with a shared, distinctive design language.
- Treat each tool as a transparent, inspectable model — the math is the product, not a black box.
- Keep everything client-side: zero data retention is a trust *feature*, not a limitation.
- Support location-specific tax calculations across all US states.
- Serve as a learning vehicle for optimization, financial modeling, and agentic data pipelines.
- Distribute organically via open source (GitHub) to a technical, high-earner audience.

### Non-Goals

- No monetization, premium tiers, or hosted SaaS in v1.
- No account aggregation or bank linking.
- No personalized financial *advice* — tools are calculators and models, clearly disclaimed.
- No mobile-native apps (responsive web only).
- Not a replacement for a CPA or CFP for complex situations.

---

## 4. Target User

**Primary persona:** Analytically-minded professional, household income $200k+, comfortable with spreadsheets and quantitative reasoning. Engineers, PMs, finance professionals, physicians, founders. Thinks in terms of marginal rates, optimization, and tradeoffs. Values directness, transparency, and control. Privacy-conscious.

**Secondary persona:** Anyone climbing into higher tax brackets who wants to understand the levers available to them (backdoor Roth, HSA triple-advantage, employer match capture, etc.) without paying for an advisor.

---

## 5. Design Principles

1. **The math is the product.** Every calculation must be inspectable, documented, and unit-tested. A wrong number erodes trust irreversibly.
2. **Client-side only.** No data leaves the browser. No localStorage of sensitive figures unless explicitly opted into.
3. **Parameters over prescriptions.** Give users tunable inputs and show them the consequences. Don't hand down a single "answer."
4. **One tool, one job.** Each tool solves a single problem well rather than being an everything-app.
5. **Distinctive, cohesive aesthetic.** A dark, refined, terminal-inspired design language that signals analytical seriousness and is consistent across the suite.
6. **Honest about uncertainty.** Estimates are clearly labeled. Assumptions are surfaced. Disclaimers are present but not patronizing.

---

## 6. Product Scope

### 6.1 Tool Suite

**Flagship (built):**

| Tool | Description | Status |
|------|-------------|--------|
| Compensation Optimizer | Single-year take-home + utility optimization across 401k/HSA/FSA/IRA/mega-backdoor with employer match, coordinate-descent solver, sensitivity analysis, paycheck calendar, bonus modeling, lifetime projection, household/spouse joint optimization | Built |

**Planned v1 suite (3–4 genuinely excellent tools beats 10 half-finished):**

| Tool | Description | Priority |
|------|-------------|----------|
| RSU / Equity Modeler | Vesting schedules, AMT on ISOs, 83(b) modeling, concentration risk, sell-to-cover vs cash | High |
| Mortgage vs. Invest | Extra principal vs. market investment, PMI elimination, refi breakeven, opportunity cost | High |
| FIRE Calculator | FI number, coast-FI, safe withdrawal rate stress testing, sequence-of-returns risk | Medium |
| Backdoor / Mega-Backdoor Roth Walkthrough | Step-by-step with pro-rata rule modeling and form references | Medium |
| Tax-Loss Harvesting Simulator | Wash-sale-aware harvest modeling, tax alpha quantification | Low |
| I-Bond / HYSA / Treasury Allocation | Cash allocation optimizer across instruments, after-tax yield comparison | Low |

### 6.2 Shared Infrastructure

- **Design system:** Shared component library and design tokens (dark mono/terminal aesthetic).
- **Tax data layer:** Versioned, location-aware tax data (`tax-data/2024/`, `tax-data/2025/`, etc.).
- **Math layer:** Pure, framework-agnostic functions, independently unit-testable.
- **Location selector:** State + city dropdowns, browser geolocation auto-detect.

### 6.3 Tax Data Pipeline (separate concern)

An agentic, tiered extraction pipeline that maintains tax data across all 50 states with annual automation and minimal human review burden.

---

## 7. Functional Requirements

### 7.1 Tools (general)

- **FR-1:** All tools run entirely client-side in the browser. No server round-trips for calculations.
- **FR-2:** Each tool exposes all model assumptions and allows the user to override them.
- **FR-3:** Each tool displays a clear, non-patronizing "not financial advice" disclaimer.
- **FR-4:** Each tool is responsive and usable on mobile (≈6–8 sentences of screen height).
- **FR-5:** Tools must not use browser storage for sensitive financial data unless the user explicitly opts in.

### 7.2 Location Support

- **FR-6:** User can select state via dropdown (all 50 + DC).
- **FR-7:** User can select city when a local income tax applies (~15–20 relevant jurisdictions: NYC, Yonkers, Philadelphia, Detroit, Columbus, Portland, etc.).
- **FR-8:** Optional one-click geolocation auto-detect to pre-fill location.
- **FR-9:** Tax calculations reflect the selected location's state income tax, brackets, standard deduction, local tax, SS/pension exemptions, and capital-gains treatment.
- **FR-10:** Tools clearly indicate the tax year and data source for the figures in use.

### 7.3 Compensation Optimizer (reference implementation)

- **FR-11:** Objective function maximizes utility = net take-home + growth-premium PV of tax-advantaged contributions + employer match capture − liquidity penalty.
- **FR-12:** Decision variables: 401k, HSA, FSA, IRA, mega-backdoor (per person).
- **FR-13:** Constraints: IRS limits, employer match cap, configurable liquidity floor.
- **FR-14:** Coordinate-descent solver with multiple restarts.
- **FR-15:** Sensitivity analysis showing utility/net curves per parameter sweep.
- **FR-16:** Paycheck calendar anchored to a configurable pay schedule, with bonus modeling.
- **FR-17:** Household mode: full spouse config, MFJ vs MFS comparison, joint optimization over 10 variables, line-item fixed costs, stress testing.
- **FR-18:** Lifetime projection as a separate accumulation + withdrawal simulation with bull/base/bear scenarios.

---

## 8. Tax Data Pipeline — Detailed Requirements

### 8.1 Architecture: Tiered Extraction

A classifier routes each source to the cheapest sufficient extraction tier, escalating on failure:

| Tier | Method | Use Case |
|------|--------|----------|
| 1 | Structured API / clean scrape | Tax Foundation, flat-rate states |
| 2 | DOM scrape + regex normalize | Clean HTML tables on state .gov sites |
| 3 | OCR + structured extraction | PDF bracket tables, scanned documents |
| 4 | Multimodal LLM + Playwright | Dynamic JS sites, complex layouts, navigation required |

### 8.2 LLM as Deterministic Formatter

- **PR-1:** The LLM is constrained to a structured tool-call schema (JSON Schema / Pydantic). It fills slots; it never decides output shape.
- **PR-2:** Rates are normalized at the schema level (e.g., `0.0475`, not `4.75`).
- **PR-3:** The schema includes a self-reported `confidence` enum (high/medium/low) and a free-text `notes` field as a sanctioned escape hatch for ambiguity.
- **PR-4:** If the model cannot confidently fill a slot, it returns `null` rather than hallucinating; the validator catches nulls.

### 8.3 Ensemble Validation

- **PR-5:** Each state is extracted N times (default N=3), varying inputs where possible (different prompts, different sources, different tiers) rather than just re-sampling the same prompt.
- **PR-6:** Comparison is purely programmatic — normalize then check structural equality. No LLM in the comparison step.
- **PR-7:** Acceptance policy is confidence-weighted:
  - Multi-source unanimous → auto-merge (confidence 1.0)
  - Multi-tier unanimous → auto-merge (0.95)
  - Single-source unanimous → auto-merge + spot-check flag (0.85)
  - Majority (not unanimous) → human review required
  - No consensus → reject, escalate
- **PR-8:** Divergent fields are pinpointed and surfaced to the human reviewer (which specific field disagreed, and the candidate values).
- **PR-9:** An optional "judge" agent receives all extractions + reasoning traces to adjudicate near-misses (e.g., 3 agree exactly, 1 differs by a formatting artifact).

### 8.4 Cross-Validation & Sanity Checks

- **PR-10:** Year-over-year delta check — flag changes above a threshold (e.g., >2% rate change) as likely extraction errors unless confirmed as genuine law changes.
- **PR-11:** Structural sanity checks — monotonic brackets, rates within [0, 0.15], positive standard deductions, reasonable ranges.
- **PR-12:** Independent cross-reference against a second source (e.g., Tax Foundation) where available.

### 8.5 Failure Taxonomy

The pipeline classifies failures to drive appropriate remediation:

- Hallucination → retry with improved prompt
- Parse error → retry / escalate tier
- Stale source → flag URL, find updated source
- Ambiguous source → human review
- Site changed → update registry tier hint
- CAPTCHA blocked → escalate to Tier 4
- Genuine change → fast-track human confirmation + notify

### 8.6 State Registry (config layer)

- **PR-13:** `state_registry.json` is the human-maintained source of truth for per-state config: primary URL, backup URL, tier hint, flat-rate flag, local-tax flag, last validated date, confidence.
- **PR-14:** The registry guides initial tier selection; the pipeline falls back up the tier stack on failure.

### 8.7 Replay Harness

- **PR-15:** Raw source content (HTML snapshot, PDF bytes, screenshot) is cached at extraction time.
- **PR-16:** Flagged items can be re-extracted against cached sources without re-scraping.
- **PR-17:** Prompt/schema changes can be regression-tested against the full history of cached sources.

### 8.8 Automation

- **PR-18:** A GitHub Action runs annually (mid-January) and on demand.
- **PR-19:** The Action produces a pull request with a human-readable diff of all changes, highlighting flagged items.
- **PR-20:** Auto-mergeable items are marked; human-review items block the merge until resolved.
- **PR-21:** Target: annual maintenance burden ≈ 20–30 minutes of PR review.

---

## 9. Technical Architecture

### 9.1 Repository Structure

```
marginal/
├── README.md                  # philosophy + tool index
├── PRD.md                     # this document
├── LICENSE                    # MIT
├── next.config.ts             # Next.js static export config
├── app/                       # Next.js App Router
│   ├── page.tsx               # tool directory / landing
│   └── tools/
│       ├── compensation-optimizer/page.tsx
│       └── ...
├── tools/                     # React tool components
│   ├── compensation-optimizer/
│   ├── rsu-equity-modeler/
│   ├── mortgage-vs-invest/
│   └── fire-calculator/
├── shared/
│   ├── components/            # shared UI primitives
│   ├── theme/                 # design tokens (dark mono aesthetic)
│   ├── tax-data/
│   │   ├── 2024/
│   │   │   ├── states.json
│   │   │   └── cities.json
│   │   └── 2025/              # populated by pipeline
│   └── math/                  # pure functions, independently testable
│       ├── tax-engine.ts
│       ├── optimizer.ts
│       └── __tests__/
├── pipeline/                  # tax-data extraction pipeline
│   ├── agents/
│   │   ├── classifier.py
│   │   ├── scraper.py         # tier 1–2
│   │   ├── ocr_extractor.py   # tier 3
│   │   └── llm_extractor.py   # tier 4, playwright + LLM
│   ├── validators/
│   │   ├── sanity_checks.py
│   │   ├── ensemble.py
│   │   └── diff_reporter.py
│   ├── models/
│   │   └── tax_schema.py      # pydantic, source of truth
│   ├── sources/
│   │   └── state_registry.json
│   └── cache/                 # replay harness source snapshots
└── docs/
    └── MATH.md                # per-tool model documentation
```

### 9.2 Key Decisions

- **Separate `/math` from `/tools`:** The single most important structural decision. Pure functions enable proper unit testing of the tax engine and optimizers independent of the UI.
- **Versioned tax data by year:** `tax-data/2024/`, `tax-data/2025/`. Updating brackets is a one-file/one-folder change.
- **Pipeline is a separate repo concern:** Tool quality is orthogonal to pipeline automation. Ship tools with static seed data; the pipeline maintains it over time.
- **Static seed data first:** A manually curated 50-state dataset (~500 lines JSON) covers 95% of users and is the seed the pipeline eventually maintains.

### 9.3 Stack

- **Frontend:** Next.js (static export), React, shared component library + design tokens.
- **Math:** TypeScript pure functions with unit tests.
- **Pipeline:** Python — Pydantic (schema), Playwright (browser automation), pytesseract/pdfplumber (OCR), Anthropic API (structured extraction).
- **CI/CD:** GitHub Actions (tests on PR; annual pipeline run).
- **Hosting:** Vercel (static export, root directory `/`).

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tax data goes stale and silently breaks calculations | High — wrong numbers destroy trust | Versioned data layer; automated pipeline with YoY sanity checks; visible "tax year / source" labels |
| Trust gap — high earners are skeptical of finance tools | High | Inspectable math, open source, unit-tested calculations, transparent assumptions |
| Scope creep — 10 half-finished tools | Medium | Ship a tight v1 of 3–4 excellent tools; validate traction before expanding |
| Pipeline brittleness (Tier 4 dynamic sites, CAPTCHAs) | Medium | Build Tier 1–3 first; treat Tier 4 as fallback; replay harness for debugging |
| Finish rate (built alongside day job + other projects) | Medium | Flagship-first; each tool independently shippable; no interdependencies blocking release |
| Calculation errors | High | `/math` unit tests, ensemble validation for data, multiple-source cross-reference |

---

## 11. Success Metrics

- **Correctness:** Tax engine and optimizer pass a comprehensive unit-test suite; calculations match hand-computed references.
- **Personal utility:** The flagship tool is genuinely used for the author's own planning decisions.
- **Maintainability:** Annual tax-data update takes < 30 minutes of human effort.
- **Organic traction (bonus):** GitHub stars / forks / issues indicating others find it useful.
- **Learning outcomes:** Working implementations of constrained optimization, financial modeling, and an agentic extraction pipeline.

---

## 12. Phased Roadmap

### Phase 0 — Foundation (current)
- Flagship Compensation Optimizer built and iterated.
- Utility math corrected (lump-sum growth premium, not annuity FV).
- Household/spouse + lifetime tabs complete.

### Phase 1 — Repo & Shared Layer
- Scaffold repo structure. ✓
- Extract shared design system (theme + components) from the flagship. ✓ (tokens)
- Build static 50-state `tax-data/2024/states.json` + relevant `cities.json`. ✓
- Wire location selector into the flagship.
- Write README articulating the philosophy. ✓
- Stand up `/math` with unit tests. ✓

### Phase 2 — Suite Expansion
- Build 2–3 additional high-priority tools (RSU Modeler, Mortgage vs. Invest, FIRE).
- Reuse shared components and tax/math layers.
- Per-tool `MATH.md` documentation.

### Phase 3 — Pipeline
- Build `state_registry.json` with tier hints + backup URLs for all 50 states. ✓
- Implement Tier 1–3 extraction + Pydantic schema. ✓
- Implement ensemble validation + programmatic comparison. ✓
- Implement YoY + sanity + cross-reference validators. ✓
- Wire GitHub Action with diff-PR output. ✓

### Phase 4 — Pipeline Hardening
- Add Tier 4 agentic Playwright extraction for hard cases.
- Add replay harness + source caching.
- Add judge agent for near-miss adjudication.

---

## 13. Open Questions

- Repo name: `marginal` ✓
- Should tools share a single deployed site (e.g., GitHub Pages / Vercel) or remain standalone artifacts?
- How much (if any) opt-in local persistence is worth supporting?
- Is the agentic pipeline better as part of this repo or a standalone library?

---

## 14. Appendix — Design Language Notes

Dark background, monospace typography for figures (JetBrains Mono / Cascadia Code), refined accent palette: electric mint for positive/net values, gold for bonus/match, blue for tax-deferred, purple for Roth/tax-free, red/orange for taxes and warnings. Terminal/instrument aesthetic. Codified in `shared/theme/tokens.ts`.

*Not financial or tax advice. Tools are calculators and models for educational and personal-planning purposes. Consult a qualified CPA or CFP for decisions specific to your situation.*
