export const colors = {
  // Backgrounds
  bg: {
    base: "#0a0a0f",
    surface: "#111118",
    elevated: "#1a1a24",
    border: "#2a2a38",
    borderSubtle: "#1e1e2a",
  },

  // Text
  text: {
    primary: "#e8e8f0",
    secondary: "#9090a8",
    muted: "#5a5a72",
    inverse: "#0a0a0f",
  },

  // Semantic — matches the design language described in PRD §14
  mint: {
    // electric mint: positive values, net take-home, gains
    DEFAULT: "#00e5a0",
    dim: "#00b87d",
    bg: "rgba(0, 229, 160, 0.08)",
  },
  gold: {
    // gold: employer match, bonus, free money
    DEFAULT: "#f0c040",
    dim: "#c09820",
    bg: "rgba(240, 192, 64, 0.08)",
  },
  blue: {
    // blue: tax-deferred (401k, HSA, traditional IRA)
    DEFAULT: "#4a9eff",
    dim: "#2878cc",
    bg: "rgba(74, 158, 255, 0.08)",
  },
  purple: {
    // purple: Roth / tax-free growth
    DEFAULT: "#a855f7",
    dim: "#8030d0",
    bg: "rgba(168, 85, 247, 0.08)",
  },
  red: {
    // red/orange: taxes, penalties, warnings
    DEFAULT: "#ff4a4a",
    orange: "#ff8c3a",
    dim: "#cc2020",
    bg: "rgba(255, 74, 74, 0.08)",
  },
  slate: {
    // neutral: FSA, general accounts
    DEFAULT: "#8888a8",
    bg: "rgba(136, 136, 168, 0.08)",
  },
} as const;

export const fonts = {
  // Figures, data, numbers — monospace
  mono: '"JetBrains Mono", "Cascadia Code", "Fira Code", "Consolas", monospace',
  // Labels, UI chrome — sans
  sans: '"Inter", "SF Pro Display", system-ui, -apple-system, sans-serif',
} as const;

export const fontSizes = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
} as const;

export const spacing = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
} as const;

export const radii = {
  sm: "4px",
  md: "6px",
  lg: "10px",
  full: "9999px",
} as const;

export const shadows = {
  card: "0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
  elevated: "0 4px 16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
} as const;
