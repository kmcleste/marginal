import React from "react";

interface DisclaimerProps {
  compact?: boolean;
}

export function Disclaimer({ compact = false }: DisclaimerProps) {
  const text =
    "Not financial or tax advice. Tools are calculators and models for educational and personal-planning purposes only. Consult a qualified CPA or CFP for decisions specific to your situation.";

  if (compact) {
    return (
      <p style={{ fontSize: "0.75rem", color: "#5a5a72", marginTop: "1.5rem" }}>
        {text}
      </p>
    );
  }

  return (
    <aside
      style={{
        fontSize: "0.8rem",
        color: "#5a5a72",
        borderTop: "1px solid #2a2a38",
        paddingTop: "1rem",
        marginTop: "2rem",
        lineHeight: 1.6,
      }}
    >
      {text}
    </aside>
  );
}
