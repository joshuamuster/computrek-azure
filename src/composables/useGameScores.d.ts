// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useGameScores.d.ts
//
// Type declarations for useGameScores.js.
// ─────────────────────────────────────────────────────────────────────────────

import type { Ref } from 'vue'

export type ScoreResult = 'new_record' | 'no_change' | 'error'
export type IncrementResult = 'incremented' | 'error'

export interface GameScoreEntry {
  uid:          string
  displayName:  string
  periodId:     string
  highScore:    number
  lastUpdated:  unknown
}

export interface GameScoresComposable {
  myHighScore:  Ref<number | null>
  isSubmitting: Ref<boolean>
  isLoading:    Ref<boolean>
  submitError:  Ref<string | null>

  fetchMyScore:             () => Promise<void>
  submitScore:              (score: number) => Promise<ScoreResult>
  /**
   * Increments the player's cumulative score.
   * Backward-compatible call styles:
   *   - incrementScore()                         → +1, no extra fields
   *   - incrementScore({ variant: ... })          → +1, with extra fields (legacy)
   *   - incrementScore(amount)                    → +amount, no extra fields
   *   - incrementScore(amount, { result: ... })   → +amount, with extra fields
   */
  incrementScore: (
    amountOrExtra?: number | Record<string, unknown>,
    extra?: Record<string, unknown>,
  ) => Promise<IncrementResult>
  fetchPeriodLeaderboard:   (periodId: string, topN?: number) => Promise<GameScoreEntry[]>
  fetchAllPeriodLeaderboards: (periodIds: string[], topN?: number) => Promise<Record<string, GameScoreEntry[]>>
}

declare module '@/composables/useGameScores' {
  export function useGameScores(
    gameId: string,
    options?: { lowerIsBetter?: boolean },
  ): GameScoresComposable
}
