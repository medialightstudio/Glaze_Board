// Task colors — one meaning each, used on cards, calendar lanes, and map pins. DEC-11

export const taskColors = {
  measure: "#2563EB",
  install: "#16A34A",
  service: "#EA580C",
  urgentRing: "#DC2626",
} as const;

export type TaskColorKey = keyof typeof taskColors;

/** CSS variable names mirrored in globals.css */
export const designTokens = {
  ink: "var(--gb-ink)",
  muted: "var(--gb-muted)",
  rail: "var(--gb-rail)",
  measure: "var(--gb-measure)",
  install: "var(--gb-install)",
  service: "var(--gb-service)",
  urgent: "var(--gb-urgent)",
} as const;
