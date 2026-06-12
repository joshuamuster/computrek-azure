// ─────────────────────────────────────────────────────────────────────────────
// src/config/schoolYear.ts
//
// School year and quarter configuration for CompuTrek LMS.
// Update QUARTERS dates each year — everything else derives from them.
// ─────────────────────────────────────────────────────────────────────────────

export const SCHOOL_YEAR_ID = '2025-2026'

// Set your actual FUSD quarter start/end dates here.
// Dates are inclusive on both ends.
export const QUARTERS = [
  { id: '2025-Q1', label: 'Quarter 1', start: '2025-08-07', end: '2025-10-17' },
  { id: '2025-Q2', label: 'Quarter 2', start: '2025-10-20', end: '2026-01-16' },
  { id: '2026-Q3', label: 'Quarter 3', start: '2026-01-20', end: '2026-03-20' },
  { id: '2026-Q4', label: 'Quarter 4', start: '2026-03-23', end: '2026-06-05' },
] as const

export type QuarterId = typeof QUARTERS[number]['id']

// Derive quarterId from a due date string (YYYY-MM-DD).
// Returns the matching quarter ID, or 'unknown' if outside all ranges.
export function getQuarterIdForDate(dateStr: string): QuarterId | 'unknown' {
  const d = new Date(dateStr)
  for (const q of QUARTERS) {
    if (d >= new Date(q.start) && d <= new Date(q.end)) return q.id
  }
  return 'unknown'
}

// Curriculum units for the school year.
// Update the labels here to match your actual unit names — IDs must stay stable.
export const UNITS = [
  { id: 'unit-1', label: 'Unit 1' },
  { id: 'unit-2', label: 'Unit 2' },
  { id: 'unit-3', label: 'Unit 3' },
  { id: 'unit-4', label: 'Unit 4' },
  { id: 'unit-5', label: 'Unit 5' },
  { id: 'unit-6', label: 'Unit 6' },
  { id: 'unit-7', label: 'Unit 7' },
] as const

export type UnitId = typeof UNITS[number]['id']

// All period IDs available this year
export const PERIOD_IDS = [
  { id: 'period-1', label: 'Period 1' },
  { id: 'period-2', label: 'Period 2 (Demo)' },
  { id: 'period-3', label: 'Period 3' },
  { id: 'period-4', label: 'Period 4' },
  { id: 'period-5', label: 'Period 5' },
  { id: 'period-6', label: 'Period 6' },
  { id: 'period-7', label: 'Period 7' },
  { id: 'period-8', label: 'Period 8' },
] as const

export type PeriodId = typeof PERIOD_IDS[number]['id']
