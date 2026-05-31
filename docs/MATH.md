# Math Documentation

> This document explains the models, assumptions, and formulas behind each tool.
> The math is the product — every calculation should be traceable back to this doc.

---

## Compensation Optimizer

### Objective Function

The optimizer maximizes a utility function that combines immediate and long-term value:

```
U = netTakeHome
  + Σ growthPremiumPV(contribution_i)
  + employerMatchCaptured
  - liquidityPenalty
```

**Why not just maximize net take-home?**

Net take-home alone ignores the time value of tax-advantaged space. A dollar in a 401(k) is worth more than a dollar of take-home because it grows tax-deferred (or tax-free for Roth). The utility function prices this premium and trades it off against liquidity.

---

### Growth Premium PV

For a pre-tax contribution, the long-term benefit is:

```
taxDeferralBenefit = contribution × FV_factor × (marginalRateNow - marginalRateRetirement)
```

Where:
```
FV_factor = (1 + discountRate)^yearsToRetirement
```

This is the present value of paying taxes later at a (presumably) lower rate rather than now. The discount rate is the expected after-tax portfolio return (default 7%).

**Key assumption:** The tool does not guarantee the user will be in a lower bracket at retirement — it's a user-supplied input. If the user expects to be in the same or higher bracket, the premium approaches zero and the optimizer will naturally reduce pre-tax contributions.

**HSA premium multiplier (1.5×):** The HSA gets a higher PV multiplier because it is triple-tax-advantaged: contributions are pre-tax, growth is tax-free, and qualified withdrawals are tax-free. The 1.5× is a heuristic approximation of this compounded advantage vs. a traditional 401k.

**Roth premium multiplier:** User-configurable. Default 1.0 — the optimizer is agnostic between traditional and Roth unless the user signals a strong rate-differential belief. Set > 1.0 to weight Roth more heavily.

---

### Employer Match Capture

```
matchCaptured = min(employeeElective, gross × matchCap) × matchRate × vestingRate
```

The match is treated as equivalent to immediate cash — it is free money that the optimizer values at face value. Most plans count only the employee elective deferral toward the match (not after-tax/mega-backdoor contributions).

---

### Liquidity Penalty

```
liquidityPenalty = max(0, liquidityFloor - netTakeHome) × penaltyRate
```

If the optimizer's solution would leave the user below their stated liquidity floor (minimum desired annual take-home), a penalty is applied that makes the solution progressively less attractive. The penalty rate (default 3×) is high enough that the optimizer will only dip below the floor if the financial benefit is compelling.

---

### Coordinate Descent

The optimizer cycles through each decision variable, holding all others fixed, and finds the optimal value for that variable. This repeats until no variable changes materially (convergence).

Multiple restarts from random starting points help escape local optima. For the 5-variable single-filer case, convergence is typically fast (< 50 iterations). For 10-variable household mode, 100–200 iterations is typical.

**Limitations:** Coordinate descent can get stuck in local optima for non-convex utility landscapes. Multiple restarts mitigate this but do not guarantee global optimality. The sensitivity analysis panel lets the user explore the landscape manually.

---

### Tax Engine

See [`shared/math/tax-engine.ts`](../shared/math/tax-engine.ts) and its unit tests in `__tests__/`.

Key mechanics:

**LTCG stacking rule:** Long-term capital gains and qualified dividends are taxed at preferential rates, but the rate bracket is determined by where the gains fall when stacked *on top of* ordinary taxable income. Gains do not get a flat rate — they fill up the remaining space in LTCG brackets.

**NIIT:** The 3.8% Net Investment Income Tax applies to the lesser of net investment income or the amount by which MAGI exceeds the threshold. It is not a flat tax on all investment income.

**Additional Medicare tax (0.9%):** Applies above $200k single / $250k MFJ on wages and self-employment income. This is separate from the standard 1.45% Medicare rate.

---

## RSU / Equity Modeler *(planned)*

Will model:
- Vesting schedule (cliff + ratable)
- Federal + state tax at ordinary income rates on vest
- NQ options: spread taxed as ordinary income at exercise
- ISO options: no AMT at exercise (regular tax), but AMT preference item
- 83(b) election: pays tax on grant FMV, subsequent growth at LTCG rates
- Concentration risk: expected utility of holding vs diversifying

---

## Mortgage vs. Invest *(planned)*

Will model:
- Effective mortgage rate after mortgage interest deduction (if itemizing)
- PMI cost and elimination at 80% LTV
- Opportunity cost: extra principal vs. market investment at user-specified return
- Refi breakeven: closing costs / monthly savings
- Home equity as illiquid asset in net worth

---

## FIRE Calculator *(planned)*

Will model:
- FI number: annual spending / safe withdrawal rate (default 4%, configurable)
- Coast-FI: portfolio size at which no further contributions are needed to hit FI by target age
- Sequence-of-returns risk: Monte Carlo or historically-bootstrapped withdrawal simulations
- Social Security offset: user-specified SS income reduces required portfolio
- Roth conversion ladder for pre-59½ access

---

## Assumptions and Limitations

All tools share the following:

- **Federal tax only** for the base calculation; state tax is added via the location layer.
- **Single tax year** — no multi-year projections except in the lifetime tab.
- **Wages and salary** as primary income; complex income types (K-1, rental, etc.) are not modeled.
- **Standard deduction** is the default; itemized deductions are a user-override field.
- **Inflation** is not modeled in single-year tools. Lifetime projections use a configurable real return (nominal minus inflation).
- **Tax law stability** — brackets and limits are 2024 values. Future year projections assume current law.

---

*Not financial or tax advice. These are models and calculators for educational purposes.*
