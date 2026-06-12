// composables/useGameScores.js
//
// Handles all game score reads and writes to Firestore.
//
// Usage — standard (higher = better):
//   const { myHighScore, submitScore, fetchMyScore } = useGameScores('isolinear-cascade')
//
// Usage — time-based (lower = better), with per-difficulty gameIds:
//   const { myHighScore, submitScore, fetchMyScore } = useGameScores('minesweeper_cadet', { lowerIsBetter: true })
//
// Usage — cumulative win counter:
//   const { incrementScore } = useGameScores('chess')
//
// gameId encodes both game and difficulty when needed:
//   'minesweeper_cadet' | 'minesweeper_standard' | 'minesweeper_red-alert'

import { ref } from 'vue'
import {
	doc,
	getDoc,
	setDoc,
	updateDoc,
	collection,
	query,
	where,
	orderBy,
	limit,
	getDocs,
	serverTimestamp,
	runTransaction,
} from '@/data/db'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { useActivityLog } from '@/composables/useActivityLog.js'

export function useGameScores(gameId, { lowerIsBetter = false } = {}) {
  const { logEvent } = useActivityLog()
	if (!gameId) throw new Error('useGameScores requires a gameId string.')
	
	const { userInfo, userRole } = useAuth()
	
	/**
	 * Resolves the periodId to write on a score document.
	 * Priority:
	 *   1. Role is explicitly staff/admin/sub → 'staff'
	 *   2. User has a periodId (student) → use it
	 *   3. No periodId at all → also 'staff' (handles timing edge cases
	 *      where userRole hasn't hydrated yet — only students have periodIds)
	 */
	const resolvedPeriodId = () => {
		const role = userRole.value?.toLowerCase() ?? ''
		if (['staff', 'admin'].includes(role)) return 'staff'
		return userInfo.value?.periodId ?? 'staff'
	}
	
	// ── Reactive state ─────────────────────────────────────────────────────────
	
	const myHighScore  = ref(null)   // Current user's best score (or best time) for this gameId
	const isSubmitting = ref(false)  // True while a write is in flight
	const submitError  = ref(null)   // Last write error, if any
	const isLoading    = ref(false)  // True while fetching scores
	
	// ── Helpers ────────────────────────────────────────────────────────────────
	
	const scoreDocId = (uid) => `${uid}_${gameId}`
	
	/** Returns true if newScore beats the stored score, accounting for sort direction. */
	const isBetter = (newScore, current) => {
		if (current === null) return true
		return lowerIsBetter ? newScore < current : newScore > current
	}
	
	// ── Per-user score ─────────────────────────────────────────────────────────
	
	/**
	 * Fetches the current user's best score for this gameId.
	 * Safe to call on mount — updates the `myHighScore` ref.
	 */
	const fetchMyScore = async () => {
		const uid = userInfo.value?.uid
		if (!uid) return
		
		isLoading.value = true
		try {
			const snap = await getDoc(doc(db, 'gameScores', scoreDocId(uid)))
			myHighScore.value = snap.exists() ? snap.data().highScore : null
		} catch (e) {
			console.error('[useGameScores] fetchMyScore error:', e)
		} finally {
			isLoading.value = false
		}
	}
	
	/**
	 * Submits a score. Only writes if it beats the existing record.
	 * Returns: 'new_record' | 'no_change' | 'error'
	 */
	const submitScore = async (newScore) => {
		const uid = userInfo.value?.uid
		if (!uid) return 'error'
		
		isSubmitting.value = true
		submitError.value  = null
		
		try {
			const docRef  = doc(db, 'gameScores', scoreDocId(uid))
			const snap    = await getDoc(docRef)
			const current = snap.exists() ? snap.data().highScore : null

			// Always mark submission done regardless of whether it's a new record
			autoLogCompletion(newScore, 'win')

			if (!isBetter(newScore, current)) return 'no_change'

			await setDoc(docRef, {
				uid:           uid,
				displayName:   userInfo.value.displayName  ?? 'Unknown Cadet',
				periodId:      resolvedPeriodId(),
				schoolYearId:  userInfo.value.schoolYearId ?? '2025-2026',
				gameId:        gameId,
				lowerIsBetter: lowerIsBetter,
				highScore:     newScore,
				lastUpdated:   serverTimestamp(),
			})

			myHighScore.value = newScore
			return 'new_record'

		} catch (e) {
			console.error('[useGameScores] submitScore error:', e)
			submitError.value = e.message
			return 'error'
		} finally {
			isSubmitting.value = false
		}
	}
	
	/**
	 * Increments the user's cumulative score by a given amount (default 1).
	 * Use this for games that track totals — win counts (chess, picard maneuver,
	 * etc. → leave amount at its default of 1) or cumulative point totals
	 * (orbital bombardment's "damage dealt + win bonus", which can rack up
	 * across every match — win OR lose — rather than just counting wins).
	 *
	 * Backward compatible with the original `incrementScore(extra)` call style:
	 * if the first argument is an object, it's treated as `extra` and the
	 * amount defaults to 1 (e.g. existing `incrementScore({ variant: ... })`
	 * calls keep working unchanged).
	 *
	 * @param amountOrExtra  Number of points to add (default 1), OR an `extra`
	 *                       object using the legacy single-argument call style.
	 * @param extra          Optional extra fields forwarded to autoLogCompletion
	 *                       (e.g. { variant: 'crazyhouse' } or { result: 'loss' }).
	 * Returns: 'incremented' | 'error'
	 */
	const incrementScore = async (amountOrExtra = 1, extra = {}) => {
		const uid = userInfo.value?.uid
		if (!uid) return 'error'

		let amount = 1
		let extraFields = extra ?? {}
		if (typeof amountOrExtra === 'number' && Number.isFinite(amountOrExtra)) {
			amount = amountOrExtra
		} else if (amountOrExtra && typeof amountOrExtra === 'object') {
			// Legacy call style: incrementScore({ variant: ... })
			extraFields = amountOrExtra
		}

		isSubmitting.value = true
		submitError.value  = null

		try {
			const docRef  = doc(db, 'gameScores', scoreDocId(uid))
			const snap    = await getDoc(docRef)
			const current = snap.exists() ? (snap.data().highScore ?? 0) : 0
			const newScore = current + amount

			await setDoc(docRef, {
				uid:           uid,
				displayName:   userInfo.value.displayName  ?? 'Unknown Cadet',
				periodId:      resolvedPeriodId(),
				schoolYearId:  userInfo.value.schoolYearId ?? '2025-2026',
				gameId:        gameId,
				lowerIsBetter: lowerIsBetter,
				highScore:     newScore,
				lastUpdated:   serverTimestamp(),
			})

			myHighScore.value = newScore
			autoLogCompletion(newScore, extraFields.result ?? 'win', extraFields)
			return 'incremented'

		} catch (e) {
			console.error('[useGameScores] incrementScore error:', e)
			submitError.value = e.message
			return 'error'
		} finally {
			isSubmitting.value = false
		}
	}

	// ── Auto-submission ────────────────────────────────────────────────────────

	/**
	 * Finds submission docs for this student/gameId that are in 'started' status,
	 * records the result and best score, then auto-submits the mission.
	 * This fires for any game outcome — win, loss, or draw.
	 * @param extra  Optional extra fields included in the activity log and submission data.
	 *               For Chess: pass { variant: 'standard' | '960' | 'crazyhouse' }.
	 *               If a submission has a required gameVariant, it must match extra.variant
	 *               (or have no variant requirement) to be auto-completed.
	 */
	const autoLogCompletion = async (score, result = 'win', extra = {}) => {
		const uid          = userInfo.value?.uid
		const schoolYearId = userInfo.value?.schoolYearId ?? '2025-2026'
		if (!uid) return

		// Activity log — fire-and-forget, non-blocking
		logEvent('game_complete', { gameId, score: score ?? 0, result, ...extra })

		try {
			// Match submissions that are either 'started' (launched via dashboard) or
			// still 'assigned' (student navigated directly to the game page without
			// going through the formal mission-launch flow).
			const snap = await getDocs(query(
				collection(db, 'submissions'),
				where('studentId',    '==', uid),
				where('gameId',       '==', gameId),
				where('schoolYearId', '==', schoolYearId),
				where('status',       'in', ['assigned', 'started']),
			))
			if (snap.empty) return

			// If this completion carries a variant, only auto-submit missions that require
			// that variant OR that have no variant requirement (gameVariant absent/falsy).
			const matchingDocs = extra.variant
				? snap.docs.filter(d => {
						const gv = d.data().gameVariant
						return !gv || gv === extra.variant
					})
				: snap.docs

			if (!matchingDocs.length) return

			await Promise.all(matchingDocs.map(async d => {
				const subData     = d.data()
				const repeatCount = subData.repeatCount ?? 1

				// Build the best-score payload (same for single and multi-game)
				const currentScore = subData.data?.score ?? null
				const bestScore = result === 'win'
					? (currentScore !== null && !isBetter(score, currentScore) ? currentScore : (score ?? 0))
					: (currentScore ?? score ?? 0)
				const dataPayload = { score: bestScore, result, gameName: gameId }
				if (extra.variant) dataPayload.variant = extra.variant

				if (repeatCount <= 1) {
					// ── Single-play mission: submit immediately ──────────────────────
					return updateDoc(d.ref, {
						data:        dataPayload,
						status:      'submitted',
						submittedAt: serverTimestamp(),
					})
				}

				// ── Multi-play mission: atomic increment, submit only when done ────
				// Use a transaction so concurrent completions (e.g. two tabs) can't
				// over-count or double-submit.
				return runTransaction(db, async tx => {
					const fresh         = await tx.get(d.ref)
					const completed     = (fresh.data()?.gamesCompleted ?? 0) + 1
					const allDone       = completed >= repeatCount
					const update = {
						'data.score':    dataPayload.score,
						'data.result':   dataPayload.result,
						'data.gameName': dataPayload.gameName,
						gamesCompleted:  completed,
					}
					if (dataPayload.variant) update['data.variant'] = dataPayload.variant
					if (allDone) {
						update.status      = 'submitted'
						update.submittedAt = serverTimestamp()
					}
					tx.update(d.ref, update)
				})
			}))
		} catch (e) {
			// Non-fatal — score is already saved to gameScores; this is best-effort.
			console.warn('[useGameScores] autoLogCompletion error:', e)
		}
	}

	// ── Leaderboard queries ────────────────────────────────────────────────────
	
	/**
	 * Fetches the top N scores for a given period.
	 * Sort direction is automatic based on lowerIsBetter.
	 * Returns array of: { uid, displayName, periodId, highScore, lastUpdated }
	 */
	const fetchPeriodLeaderboard = async (periodId, topN = 5) => {
		isLoading.value = true
		try {
			const direction = lowerIsBetter ? 'asc' : 'desc'
			const q = query(
				collection(db, 'gameScores'),
				where('gameId',   '==', gameId),
				where('periodId', '==', periodId),
				orderBy('highScore', direction),
				limit(topN)
			)
			const snap = await getDocs(q)
			return snap.docs.map(d => d.data())
		} catch (e) {
			console.error('[useGameScores] fetchPeriodLeaderboard error:', e)
			return []
		} finally {
			isLoading.value = false
		}
	}
	
	/**
	 * Fetches top N scores across multiple periods.
	 * Used in the admin overview.
	 *
	 * Returns: { [periodId]: [{ uid, displayName, highScore, ... }] }
	 */
	const fetchAllPeriodLeaderboards = async (periodIds, topN = 5) => {
		const results = {}
		await Promise.all(
			periodIds.map(async (periodId) => {
				results[periodId] = await fetchPeriodLeaderboard(periodId, topN)
			})
		)
		return results
	}
	
	return {
		// State
		myHighScore,
		isSubmitting,
		isLoading,
		submitError,

		// Methods
		fetchMyScore,
		submitScore,
		incrementScore,
		autoLogCompletion,
		fetchPeriodLeaderboard,
		fetchAllPeriodLeaderboards,
	}
}