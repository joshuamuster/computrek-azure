// ─────────────────────────────────────────────────────────────────────────────
// src/config/shipSystems.ts
//
// Maps each ship system (sector key) to the period that owns it, and describes
// what bonus that period provides when its health is high.
//
// ⚠️  UPDATE THIS before the new school year:
//     Replace the period IDs below with the actual IDs for each class.
//     CompSci periods each own one sector; GD periods each own one sector.
//     Set any unassigned systems to null.
// ─────────────────────────────────────────────────────────────────────────────

/** Maps every system key → the periodId that owns it (null = collective/unowned). */
export const SYSTEM_PERIOD_MAP: Record<string, string | null> = {
  // ── CompSci periods (one system each) ────────────────────────────────────
  sectorN:    'period-1',   // CS Period 1  → Power Core
  sectorNE:   'period-2',   // CS Period 2  → Propulsion
  sectorE:    'period-3',   // CS Period 3  → Navigation
  sectorSE:   'period-4',   // CS Period 4  → Weapons

  // ── Graphic Design periods (one system each) ──────────────────────────────
  sectorS:    'period-5',   // GD Period 1  → Communications
  sectorSW:   'period-6',   // GD Period 2  → Life Support

  // ── Collective infrastructure (not tied to a single class) ────────────────
  topWing:    null,
  bottomWing: null,
  cockpit:    null,
}

/** Describes the bonus each system provides when its owning period is doing well. */
export const SYSTEM_BONUS: Record<string, string> = {
  sectorN:   'Powers up all other systems — the whole ship gets a small XP boost when the core is running hot.',
  sectorNE:  'Unlocks an XP boost for Navigation (CS P3). Propulsion and Navigation push each other forward.',
  sectorE:   'Sends a course preview to all CS classes — a sneak peek at the next unit\'s topic.',
  sectorSE:  'Spawns optional challenge missions for all classes with bonus XP for completion.',
  sectorS:   'Opens a resource exchange — Communications students can publish tips all classes can access.',
  sectorSW:  'Provides a sustained XP multiplier for all classes over the following week.',
}

/**
 * Returns the periodId that owns a given system key, or null if unowned.
 */
export function getPeriodForSystem(systemKey: string): string | null {
  return SYSTEM_PERIOD_MAP[systemKey] ?? null
}

/**
 * Returns all system keys owned by a given period.
 */
export function getSystemsForPeriod(periodId: string): string[] {
  return Object.entries(SYSTEM_PERIOD_MAP)
    .filter(([, pid]) => pid === periodId)
    .map(([key]) => key)
}
