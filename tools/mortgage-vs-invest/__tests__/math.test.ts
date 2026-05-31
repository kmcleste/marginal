// Pure math extracted from MortgageVsInvest.tsx — tested independently

function monthlyPayment(principal: number, annualRate: number, termYears: number): number {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function futureValue(monthly: number, annualReturn: number, months: number): number {
  const r = annualReturn / 100 / 12;
  if (r === 0) return monthly * months;
  return monthly * ((Math.pow(1 + r, months) - 1) / r);
}

interface AmortRow { month: number; balance: number; interest: number; principal: number; cumInterest: number; ltv: number; }

function buildAmortSchedule(principal: number, annualRate: number, termYears: number, homeVal: number, extraMonthly = 0): AmortRow[] {
  const r = annualRate / 100 / 12;
  const payment = monthlyPayment(principal, annualRate, termYears);
  const rows: AmortRow[] = [];
  let bal = principal;
  let cumInterest = 0;
  for (let m = 1; m <= termYears * 12 && bal > 0.01; m++) {
    const interestAmt = bal * r;
    const principalAmt = Math.min(payment - interestAmt + extraMonthly, bal);
    bal -= principalAmt;
    cumInterest += interestAmt;
    rows.push({ month: m, balance: Math.max(0, bal), interest: interestAmt, principal: principalAmt, cumInterest, ltv: Math.max(0, bal) / homeVal });
    if (bal <= 0.01) break;
  }
  return rows;
}

// ─── monthlyPayment ────────────────────────────────────────────────────────────

describe("monthlyPayment", () => {
  it("$400k at 7% over 30yr → ~$2,661", () => {
    expect(monthlyPayment(400000, 7, 30)).toBeCloseTo(2661.21, 0);
  });

  it("$300k at 0% over 30yr → $833.33 (principal only)", () => {
    expect(monthlyPayment(300000, 0, 30)).toBeCloseTo(833.33, 1);
  });

  it("$500k at 6% over 15yr → ~$4,219", () => {
    expect(monthlyPayment(500000, 6, 15)).toBeCloseTo(4219.28, 0);
  });

  it("is monotonically increasing with rate", () => {
    const payments = [3, 4, 5, 6, 7, 8].map(r => monthlyPayment(300000, r, 30));
    for (let i = 1; i < payments.length; i++) {
      expect(payments[i]).toBeGreaterThan(payments[i - 1]!);
    }
  });

  it("is monotonically decreasing with term length", () => {
    const payments = [10, 15, 20, 30].map(t => monthlyPayment(300000, 6, t));
    for (let i = 1; i < payments.length; i++) {
      expect(payments[i]).toBeLessThan(payments[i - 1]!);
    }
  });

  it("total payments ≥ principal (lender always gets paid interest)", () => {
    const p = monthlyPayment(300000, 5, 30);
    expect(p * 360).toBeGreaterThan(300000);
  });
});

// ─── buildAmortSchedule ─────────────────────────────────────────────────────────

describe("buildAmortSchedule", () => {
  it("first month interest = principal × monthly rate", () => {
    const rows = buildAmortSchedule(300000, 6, 30, 400000);
    const expectedInterest = 300000 * (6 / 100 / 12);
    expect(rows[0]!.interest).toBeCloseTo(expectedInterest, 2);
  });

  it("balance is monotonically decreasing", () => {
    const rows = buildAmortSchedule(300000, 6, 30, 400000);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.balance).toBeLessThan(rows[i - 1]!.balance);
    }
  });

  it("final balance is ~0 at natural term end", () => {
    const rows = buildAmortSchedule(300000, 6, 30, 400000);
    expect(rows[rows.length - 1]!.balance).toBeCloseTo(0, 0);
  });

  it("extra payments shorten the schedule", () => {
    const base  = buildAmortSchedule(300000, 6, 30, 400000);
    const extra = buildAmortSchedule(300000, 6, 30, 400000, 500);
    expect(extra.length).toBeLessThan(base.length);
  });

  it("LTV drops below 0.80 (PMI threshold) at some point for 90% LTV loan", () => {
    const homeVal = 400000;
    const principal = 360000; // 90% LTV
    const rows = buildAmortSchedule(principal, 6, 30, homeVal);
    const pmiElimMonth = rows.findIndex(r => r.ltv < 0.80);
    expect(pmiElimMonth).toBeGreaterThan(0);
  });

  it("cumulative interest grows monotonically", () => {
    const rows = buildAmortSchedule(300000, 6, 30, 400000);
    for (let i = 1; i < Math.min(rows.length, 24); i++) {
      expect(rows[i]!.cumInterest).toBeGreaterThan(rows[i - 1]!.cumInterest);
    }
  });
});

// ─── futureValue (annuity) ───────────────────────────────────────────────────

describe("futureValue", () => {
  it("$0 contribution → $0", () => {
    expect(futureValue(0, 7, 360)).toBe(0);
  });

  it("0% return: FV = monthly × months", () => {
    expect(futureValue(1000, 0, 60)).toBe(60000);
  });

  it("$1,000/mo at 7%/yr for 30yr → ~$1,219,971", () => {
    expect(futureValue(1000, 7, 360)).toBeCloseTo(1219971, -2);
  });

  it("higher return → higher FV", () => {
    const fv5  = futureValue(1000, 5, 240);
    const fv10 = futureValue(1000, 10, 240);
    expect(fv10).toBeGreaterThan(fv5);
  });
});

// ─── Refi breakeven ────────────────────────────────────────────────────────────

describe("refi breakeven", () => {
  it("breakeven = refiCosts / monthlySavings", () => {
    const oldPayment = monthlyPayment(300000, 7, 30);
    const newPayment = monthlyPayment(300000, 6, 30);
    const savings    = oldPayment - newPayment;
    const costs      = 6000;
    const breakeven  = costs / savings;
    // $300k: 7% → $1,995.91, 6% → $1,798.65, savings ≈ $197/mo, breakeven ≈ 30mo
    expect(breakeven).toBeCloseTo(30, 0);
  });

  it("no savings if new rate ≥ old rate → Infinity", () => {
    const savings = monthlyPayment(300000, 5, 30) - monthlyPayment(300000, 7, 30);
    expect(savings).toBeLessThan(0);
    const breakeven = savings <= 0 ? Infinity : 6000 / savings;
    expect(breakeven).toBe(Infinity);
  });
});
