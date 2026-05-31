# marginal

> Open-source financial tools for self-directed high earners.

marginal is a curated suite of client-side financial planning tools built for analytically-minded professionals who want to *tune parameters* rather than be handed a pie chart. Every tool is a transparent, inspectable model — the math is the product.

**Zero data retention. No account linking. No auth. No backend.**

---

## Philosophy

There is a structural gap in personal finance tooling:

- **Consumer tools** (Mint, YNAB, Personal Capital) are oversimplified, ad-driven, and require linking sensitive accounts.
- **Professional tools** (eMoney, RightCapital) are advisor-facing, expensive, and unavailable for self-service.
- **The middle is empty** — sophisticated, private, self-directed tools for people who understand marginal rates, contribution limits, and present value.

High earners are simultaneously the most underserved by existing tools and the most skeptical of them. They want to see the math, control the inputs, and trust that the calculations are correct.

marginal is built on six principles:

1. **The math is the product.** Every calculation is inspectable, documented, and unit-tested.
2. **Client-side only.** No data leaves the browser.
3. **Parameters over prescriptions.** Show the user the consequences of each lever. Don't hand down a single "answer."
4. **One tool, one job.** Each tool solves a single problem well.
5. **Distinctive, cohesive aesthetic.** Dark, terminal-inspired design language consistent across the suite.
6. **Honest about uncertainty.** Estimates are labeled. Assumptions are surfaced.

---

## Tool Suite

| Tool | Description | Status |
|------|-------------|--------|
| **Compensation Optimizer** | Single-year take-home + utility optimization across 401k/HSA/FSA/IRA/mega-backdoor. Coordinate-descent solver, sensitivity analysis, household mode, lifetime projection. | Built |
| RSU / Equity Modeler | Vesting schedules, AMT on ISOs, 83(b) modeling, concentration risk, sell-to-cover vs cash | Planned |
| Mortgage vs. Invest | Extra principal vs. market investment, PMI elimination, refi breakeven, opportunity cost | Planned |
| FIRE Calculator | FI number, coast-FI, safe withdrawal rate stress testing, sequence-of-returns risk | Planned |
| Backdoor / Mega-Backdoor Roth | Step-by-step with pro-rata rule modeling and form references | Planned |
| Tax-Loss Harvesting Simulator | Wash-sale-aware harvest modeling, tax alpha quantification | Planned |

---

## Repository Structure

```
marginal/
├── tools/                     # React frontend tools
│   ├── compensation-optimizer/
│   ├── rsu-equity-modeler/
│   ├── mortgage-vs-invest/
│   └── fire-calculator/
├── shared/
│   ├── components/            # shared UI primitives
│   ├── theme/                 # design tokens (dark mono aesthetic)
│   ├── tax-data/
│   │   ├── 2024/
│   │   │   ├── states.json    # 50-state income tax data
│   │   │   └── cities.json    # local income tax jurisdictions
│   │   └── 2025/              # populated by pipeline
│   └── math/                  # pure functions, independently testable
│       ├── tax-engine.ts
│       ├── optimizer.ts
│       └── __tests__/
├── pipeline/                  # agentic tax-data extraction pipeline
│   ├── agents/
│   ├── validators/
│   ├── models/tax_schema.py   # Pydantic schema (source of truth)
│   └── sources/state_registry.json
└── docs/
    └── MATH.md                # per-tool model documentation
```

### Key structural decisions

**`/math` is separate from `/tools`.** Pure functions enable proper unit testing of the tax engine and optimizers independent of the UI. This is how calculation errors get caught in CI rather than after shipping.

**Tax data is versioned by year.** Updating brackets is a one-file/one-folder change, not a grep-and-replace.

**Static seed data first.** A manually curated 50-state dataset covers 95% of users and is the seed the automated pipeline eventually maintains.

---

## Tax Data Pipeline

An agentic, tiered extraction pipeline maintains tax data across all 50 states with annual automation:

| Tier | Method | Use Case |
|------|--------|----------|
| 1 | Structured API / clean scrape | Tax Foundation, flat-rate states |
| 2 | DOM scrape + regex normalize | Clean HTML tables on state .gov sites |
| 3 | OCR + structured extraction | PDF bracket tables, scanned docs |
| 4 | Multimodal LLM + Playwright | Dynamic JS sites, complex navigation |

A GitHub Action runs each January, produces a PR with a human-readable diff of all changes, and targets < 30 minutes of annual human review.

---

## Stack

- **Frontend:** React (client-side only), shared component library + design tokens
- **Math:** TypeScript pure functions with unit tests
- **Pipeline:** Python — Pydantic, Playwright, pdfplumber, LLM API
- **CI/CD:** GitHub Actions

---

## License

MIT — free to use, modify, and distribute.

---

*Not financial or tax advice. Tools are calculators and models for educational and personal-planning purposes only. Consult a qualified CPA or CFP for decisions specific to your situation.*
