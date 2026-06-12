export type SystemInfo = {
  name:        string
  icon:        string
  color:       string
  status:      string
  description: string

  // ── Live health data (populated at modal-open time from useShipStatus) ────
  /** 0–100. undefined means no graded work exists yet for this period. */
  health?:       number
  gradedCount?:  number
  overdueCount?: number
  totalEarned?:  number
  totalPossible?: number

  // ── Configuration ─────────────────────────────────────────────────────────
  /** Bonus this system provides to other classes when health is high. */
  bonus?:    string
  /** The period that owns this system (null = collective infrastructure). */
  periodId?: string | null
}
