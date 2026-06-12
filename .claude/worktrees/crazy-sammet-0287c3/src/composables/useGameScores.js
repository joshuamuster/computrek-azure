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
	collection,
	query,
	where,
	orderBy,
	limit,
	getDocs,
	serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'

export function useGameScores(gameId, { lowerIsBetter = false } = {}) {
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
	 * Increments the user's cumulative win count by 1.
	 * Use this for games that track total wins (chess, picard maneuver, etc.)
	 * instead of submitScore(1), which would only ever save once.
	 * Returns: 'incremented' | 'error'
	 */
	const incrementScore = async () => {
		const uid = userInfo.value?.uid
		if (!uid) return 'error'

		isSubmitting.value = true
		submitError.value  = null

		try {
			const docRef  = doc(db, 'gameScores', scoreDocId(uid))
			const snap    = await getDoc(docRef)
			const current = snap.exists() ? (snap.data().highScore ?? 0) : 0
			const newScore = current + 1

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
			return 'incremented'

		} catch (e) {
			console.error('[useGameScores] incrementScore error:', e)
			submitError.value = e.message
			return 'error'
		} finally {
			isSubmitting.value = false
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
		fetchPeriodLeaderboard,
		fetchAllPeriodLeaderboards,
	}
}