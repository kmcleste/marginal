import Link from "next/link";

const tools = [
  {
    slug: "compensation-optimizer",
    name: "Compensation Optimizer",
    description:
      "Maximize take-home + utility across 401k, HSA, FSA, IRA, and mega-backdoor. Coordinate-descent solver with sensitivity analysis, paycheck calendar, and household mode.",
    status: "built" as const,
  },
  {
    slug: "rsu-equity-modeler",
    name: "RSU / Equity Modeler",
    description:
      "Vesting schedules, AMT on ISOs, 83(b) election modeling, concentration risk, and sell-to-cover vs. cash analysis.",
    status: "planned" as const,
  },
  {
    slug: "mortgage-vs-invest",
    name: "Mortgage vs. Invest",
    description:
      "Extra principal paydown vs. market investment, PMI elimination, refi breakeven, and opportunity cost.",
    status: "planned" as const,
  },
  {
    slug: "fire-calculator",
    name: "FIRE Calculator",
    description:
      "FI number, coast-FI, safe withdrawal rate stress testing, and sequence-of-returns risk.",
    status: "planned" as const,
  },
];

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#0a0a0f",
        color: "#e8e8f0",
        fontFamily: '"Inter", system-ui, sans-serif',
        padding: "3rem 2rem",
        maxWidth: "860px",
        margin: "0 auto",
      }}
    >
      <header style={{ marginBottom: "3rem" }}>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            marginBottom: "0.75rem",
            color: "#e8e8f0",
          }}
        >
          Marginal
        </h1>
        <p style={{ color: "#9090a8", lineHeight: 1.6, maxWidth: "600px" }}>
          Open-source financial tools for self-directed high earners. The math
          is the product — every calculation is inspectable and unit-tested.
          Client-side only. No data leaves your browser.
        </p>
      </header>

      <section>
        {tools.map((tool) => (
          <div
            key={tool.slug}
            style={{
              borderTop: "1px solid #2a2a38",
              padding: "1.5rem 0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "2rem",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  marginBottom: "0.4rem",
                }}
              >
                <h2
                  style={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: tool.status === "built" ? "#e8e8f0" : "#5a5a72",
                  }}
                >
                  {tool.name}
                </h2>
                {tool.status === "planned" && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "#5a5a72",
                      border: "1px solid #2a2a38",
                      borderRadius: "4px",
                      padding: "1px 6px",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    planned
                  </span>
                )}
              </div>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "#9090a8",
                  lineHeight: 1.6,
                  maxWidth: "520px",
                }}
              >
                {tool.description}
              </p>
            </div>
            {tool.status === "built" && (
              <Link
                href={`/tools/${tool.slug}/`}
                style={{
                  flexShrink: 0,
                  fontSize: "0.875rem",
                  color: "#00e5a0",
                  textDecoration: "none",
                  border: "1px solid rgba(0,229,160,0.3)",
                  borderRadius: "6px",
                  padding: "0.4rem 1rem",
                  whiteSpace: "nowrap",
                }}
              >
                Open →
              </Link>
            )}
          </div>
        ))}
        <div style={{ borderTop: "1px solid #2a2a38" }} />
      </section>

      <footer
        style={{
          marginTop: "3rem",
          fontSize: "0.75rem",
          color: "#5a5a72",
          lineHeight: 1.6,
        }}
      >
        MIT License · Not financial or tax advice · Tools are calculators and
        models for educational purposes only
      </footer>
    </main>
  );
}
