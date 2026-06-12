// ── Shared HUD constants and utilities ───────────────────────────────────────
// Used by TypingReport.vue and MissionReports.vue.
// When real Firestore data lands, targets can be driven from admin config.

export const WPM_TARGET = 30
export const ACC_TARGET = 95
export const SEGS       = 16   // segments per bar

/**
 * Returns the CSS class for a single bar segment.
 * @param {number} i      — 1-based segment index
 * @param {number} value  — current value
 * @param {number} target — value that fills the bar completely
 * @param {string} color  — 'green' | 'orange' | 'cyan'
 */
export const segClass = (i, value, target, color = 'green') => {
  const filled = Math.min(Math.round((value / target) * SEGS), SEGS)
  if (i > filled) return 'seg-empty'
  return `seg-${color}`
}
