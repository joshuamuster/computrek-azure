// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useAcademicCalendar.ts
//
// Utilities for the 2025-2026 academic calendar.
//
// The calendar JSON encodes every day of the school year with a Parity field
// ('odd' | 'even' | 'neutral'). On a rolling block schedule each class period
// meets every other school day, alternating odd/even. Weekends, holidays, and
// other non-school days have 'neutral' parity and a null Day of School.
//
// Core export:
//   getNextClassDay(fromDate, parity) → YYYY-MM-DD
//     Walks forward from `fromDate` (exclusive) and returns the first school
//     day whose parity matches. This is exactly "one extension" on a rolling
//     block — the next time the teacher will see students from that block.
// ─────────────────────────────────────────────────────────────────────────────

import calendarRaw from '@/assets/data/2526-AcademicCalendar.json'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DayParity = 'odd' | 'even' | 'neutral'

export interface CalendarDay {
  'Day of School': number | null
  Month:           string
  Date:            string   // ISO datetime string, e.g. "2025-08-18T00:00:00.000"
  'Schedule Type': number
  Parity:          DayParity
  Day:             string
}

// ── Build lookup map ──────────────────────────────────────────────────────────

// The first two entries in the JSON are the Day Types and Day Colors key maps.
// Everything after index 1 is an actual calendar day.
const calendarDays: CalendarDay[] = (calendarRaw as any[])
  .slice(2)
  .filter((d): d is CalendarDay => typeof d.Parity === 'string')

// Map from YYYY-MM-DD → CalendarDay for O(1) lookup
const dayMap = new Map<string, CalendarDay>()
calendarDays.forEach(d => {
  const key = d.Date.slice(0, 10)   // "2025-08-18T..." → "2025-08-18"
  dayMap.set(key, d)
})

// ── Public helpers ────────────────────────────────────────────────────────────

/** Look up a single day by YYYY-MM-DD date string. */
export function getCalendarDay(date: string): CalendarDay | undefined {
  return dayMap.get(date)
}

/**
 * Returns true if the given YYYY-MM-DD date is a real school day
 * (i.e. has a non-null Day of School number).
 */
export function isSchoolDay(date: string): boolean {
  const entry = dayMap.get(date)
  return !!entry && entry['Day of School'] !== null
}

/**
 * Given a starting date and a block parity, returns the YYYY-MM-DD of the
 * next school day that has matching parity.
 *
 * This is the core extension calculation: "the next class meeting" for a
 * period that runs on odd-parity (or even-parity) days.
 *
 * Searches up to 90 calendar days forward; throws if not found (end of year).
 */
export function getNextClassDay(fromDate: string, parity: 'odd' | 'even'): string {
  // Advance one day past fromDate to start looking
  const cursor = new Date(fromDate + 'T12:00:00Z')
  cursor.setUTCDate(cursor.getUTCDate() + 1)

  for (let i = 0; i < 90; i++) {
    const dateStr = cursor.toISOString().slice(0, 10)
    const entry   = dayMap.get(dateStr)

    if (entry && entry['Day of School'] !== null && entry.Parity === parity) {
      return dateStr
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  throw new Error(
    `[useAcademicCalendar] Could not find a ${parity} school day within 90 days of ${fromDate}. ` +
    'This may mean the school year has ended.'
  )
}

/**
 * Format a YYYY-MM-DD string for display, e.g. "Mon May 11".
 */
export function formatClassDate(date: string): string {
  const entry = dayMap.get(date)
  const d     = new Date(date + 'T12:00:00Z')
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const day   = d.getUTCDate()
  const dow   = entry?.Day ?? d.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' })
  return `${dow} ${month} ${day}`
}
