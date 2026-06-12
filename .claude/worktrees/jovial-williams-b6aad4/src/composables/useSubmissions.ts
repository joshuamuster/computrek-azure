// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useSubmissions.ts
//
// Firestore operations for submissions.
// Used by GradingView.vue (staff) and StudentDashboard.vue (students).
//
// Multi-teacher support:
//   - fetchStudents(teacherEmail?) scopes the roster to a teacher when provided.
//     Admin passes no teacherEmail to see all students.
//   - Legacy students without teacherEmail are only visible to admin.
// ─────────────────────────────────────────────────────────────────────────────

import { ref } from 'vue'
import {
	collection, getDocs, doc, updateDoc, deleteDoc,
	query, where, orderBy, Timestamp, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { SCHOOL_YEAR_ID } from '@/config/schoolYear'
import { onGraded } from '@/composables/useMissionStatsWriter'
import type { DeliveryItem } from '@/composables/useMissions'

// Context needed to update period stats — passed by callers that have it loaded.
export interface StatsCtx {
	teacherEmail: string
	periodId:     string
	schoolYearId: string
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ComponentCheck {
	done:   boolean
	doneAt: Timestamp | null
}

export interface Submission {
	id:              string
	studentId:       string
	assignmentId:    string
	missionId:       string        // denormalized at fan-out for quick joins
	periodId:        string
	quarterId:       string | null // null when assignment has no due date yet
	schoolYearId:    string
	type:            'game' | 'file' | 'manual'
	data:            SubmissionData
	status:          'assigned' | 'submitted' | 'graded' | 'returned'
	submittedAt:     Timestamp | null
	feedbackNote:    string
	pointsEarned:    number | null  // set when graded or returned
	dueDateOverride: string | null  // per-student extension date (YYYY-MM-DD)
	/**
	 * Per-component completion tracking for missions with manual delivery items.
	 * Keyed by delivery item index (as string). Only manual items have entries here.
	 */
	componentChecks?: Record<string, ComponentCheck>
	// Joined client-side
	studentName?: string
	assignmentTitle?: string
}

export interface SubmissionData {
	// file submissions
	url?:      string
	fileName?: string
	// game submissions
	score?:    number
	gameName?: string
	// link submissions
	link?:     string
}

export interface StudentRecord {
	uid:          string
	docId:        string  // approvedUsers document ID (= the student's auth email); treat as
	                      // an opaque key — do NOT render in UI or expose to students
	displayName:  string
	periodId:     string
	studentId:    string
	teacherEmail: string  // email of the teacher who owns this student
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useSubmissions() {
	const submissions = ref<Submission[]>([])
	const students    = ref<StudentRecord[]>([])
	const isLoading   = ref(false)
	const error       = ref('')
	
	// Fetch all submissions for a specific assignment + period
	const fetchByAssignment = async (assignmentId: string, periodId: string) => {
		isLoading.value = true
		error.value     = ''
		try {
			const q = query(
				collection(db, 'submissions'),
				where('assignmentId', '==', assignmentId),
				where('periodId',     '==', periodId),
				orderBy('submittedAt', 'asc'),
			)
			const snap      = await getDocs(q)
			submissions.value = snap.docs.map(d => ({
				id: d.id,
				feedbackNote: '',
				...d.data(),
			} as Submission))
		} catch (e: any) {
			console.error('fetchByAssignment:', e)
			error.value = 'Failed to load submissions.'
		} finally {
			isLoading.value = false
		}
	}
	
	// Fetch all submissions for a specific student this quarter
	const fetchByStudent = async (studentId: string, quarterId: string) => {
		isLoading.value = true
		error.value     = ''
		try {
			const q = query(
				collection(db, 'submissions'),
				where('studentId',    '==', studentId),
				where('quarterId',    '==', quarterId),
				where('schoolYearId', '==', SCHOOL_YEAR_ID),
				orderBy('submittedAt', 'asc'),
			)
			const snap      = await getDocs(q)
			submissions.value = snap.docs.map(d => ({
				id: d.id,
				feedbackNote: '',
				...d.data(),
			} as Submission))
		} catch (e: any) {
			console.error('fetchByStudent:', e)
			error.value = 'Failed to load submissions.'
		} finally {
			isLoading.value = false
		}
	}

	// Fetch ALL submissions for a student in the current school year (all quarters, all statuses).
	// Used by the BY STUDENT grading tab to show complete student history.
	const fetchAllByStudent = async (studentId: string) => {
		isLoading.value = true
		error.value     = ''
		try {
			const q = query(
				collection(db, 'submissions'),
				where('studentId',    '==', studentId),
				where('schoolYearId', '==', SCHOOL_YEAR_ID),
			)
			const snap = await getDocs(q)
			submissions.value = snap.docs.map(d => ({
				id: d.id,
				feedbackNote: '',
				...d.data(),
			} as Submission))
		} catch (e: any) {
			console.error('fetchAllByStudent:', e)
			error.value = 'Failed to load submissions.'
		} finally {
			isLoading.value = false
		}
	}

	// Fetch submissions needing grading (status 'submitted' or 'returned') for a period.
	// Filters client-side to avoid needing a composite index on status.
	const fetchNeedingGradingByPeriod = async (periodId: string) => {
		isLoading.value = true
		error.value     = ''
		try {
			const q = query(
				collection(db, 'submissions'),
				where('periodId',     '==', periodId),
				where('schoolYearId', '==', SCHOOL_YEAR_ID),
			)
			const snap = await getDocs(q)
			submissions.value = snap.docs
				.map(d => ({ id: d.id, feedbackNote: '', ...d.data() } as Submission))
				.filter(s => s.status === 'submitted' || s.status === 'returned')
		} catch (e: any) {
			console.error('fetchNeedingGradingByPeriod:', e)
			error.value = 'Failed to load submissions.'
		} finally {
			isLoading.value = false
		}
	}
	
	// Fetch students from approvedUsers (for building the student picker).
	// teacherEmail — when provided, limits results to that teacher's roster.
	//                Admin passes nothing to see all students.
	const fetchStudents = async (teacherEmail?: string) => {
		try {
			const constraints: any[] = [
				where('role',         '==', 'cadet'),
				where('schoolYearId', '==', SCHOOL_YEAR_ID),
			]
			if (teacherEmail) {
				constraints.push(where('teacherEmail', '==', teacherEmail))
			}
			constraints.push(orderBy('displayName', 'asc'))

			const q    = query(collection(db, 'approvedUsers'), ...constraints)
			const snap = await getDocs(q)
			students.value = snap.docs.map(d => ({
				uid:          d.data().uid         ?? '',
				docId:        d.id,
				displayName:  d.data().displayName ?? d.id,
				periodId:     d.data().periodId    ?? '',
				studentId:    d.data().studentId   ?? '',
				teacherEmail: d.data().teacherEmail ?? '',
			} as StudentRecord))
		} catch (e: any) {
			console.error('fetchStudents:', e)
		}
	}
	
	// Finalize a submission with full (or specified) points — sets status to 'graded'
	const gradeSubmission = async (
		submissionId: string,
		pointsEarned: number,
		feedbackNote: string,
		ctx?: StatsCtx,              // pass to update period stats counter
	): Promise<boolean> => {
		error.value = ''
		try {
			await updateDoc(doc(db, 'submissions', submissionId), {
				status:       'graded',
				pointsEarned,
				feedbackNote: feedbackNote.trim(),
				gradedAt:     serverTimestamp(),
			})
			const s = submissions.value.find(s => s.id === submissionId)
			if (s) {
				s.status       = 'graded'
				s.pointsEarned = pointsEarned
				s.feedbackNote = feedbackNote.trim()
			}
			if (ctx) {
				onGraded(ctx.teacherEmail, ctx.periodId, ctx.schoolYearId, 1)
					.catch(e => console.warn('[gradeSubmission] periodStats:', e))
			}
			return true
		} catch (e: any) {
			console.error('gradeSubmission:', e)
			error.value = 'Failed to save grade.'
			return false
		}
	}

	// Return a submission to the student with partial points and feedback
	// prevStatus: pass 'graded' if the submission was already graded so we can decrement gradedCount
	const returnSubmission = async (
		submissionId: string,
		pointsEarned: number,
		feedbackNote: string,
		prevStatus?: string,
		ctx?: StatsCtx,
	): Promise<boolean> => {
		error.value = ''
		try {
			await updateDoc(doc(db, 'submissions', submissionId), {
				status:       'returned',
				pointsEarned,
				feedbackNote: feedbackNote.trim(),
			})
			const s = submissions.value.find(s => s.id === submissionId)
			if (s) {
				s.status       = 'returned'
				s.pointsEarned = pointsEarned
				s.feedbackNote = feedbackNote.trim()
			}
			// Only decrement if it was graded before — returning a submitted item doesn't change gradedCount
			if (ctx && prevStatus === 'graded') {
				onGraded(ctx.teacherEmail, ctx.periodId, ctx.schoolYearId, -1)
					.catch(e => console.warn('[returnSubmission] periodStats:', e))
			}
			return true
		} catch (e: any) {
			console.error('returnSubmission:', e)
			error.value = 'Failed to return submission.'
			return false
		}
	}

	// Student accepts a returned grade — finalizes as 'graded' without re-submitting
	const acceptGrade = async (submissionId: string, ctx?: StatsCtx): Promise<boolean> => {
		error.value = ''
		try {
			await updateDoc(doc(db, 'submissions', submissionId), {
				status:   'graded',
				gradedAt: serverTimestamp(),
			})
			const s = submissions.value.find(s => s.id === submissionId)
			if (s) s.status = 'graded'
			if (ctx) {
				onGraded(ctx.teacherEmail, ctx.periodId, ctx.schoolYearId, 1)
					.catch(e => console.warn('[acceptGrade] periodStats:', e))
			}
			return true
		} catch (e: any) {
			console.error('acceptGrade:', e)
			error.value = 'Failed to accept grade.'
			return false
		}
	}
	
	// Set or clear a per-student due date extension (dueDateOverride)
	const setDueDateOverride = async (
		submissionId: string,
		date: string | null,
	): Promise<boolean> => {
		error.value = ''
		try {
			await updateDoc(doc(db, 'submissions', submissionId), { dueDateOverride: date })
			const s = submissions.value.find(s => s.id === submissionId)
			if (s) s.dueDateOverride = date
			return true
		} catch (e: any) {
			console.error('setDueDateOverride:', e)
			error.value = 'Failed to save extension.'
			return false
		}
	}

	// Mark one delivery item component as done (or un-done) for a manual submission.
	// When the last required manual item is checked, status flips to 'submitted'.
	// When any manual item is un-checked while status is 'submitted', reverts to 'assigned'.
	const markComponentDone = async (
		submissionId:  string,
		itemIndex:     number,
		done:          boolean,
		deliveryItems: DeliveryItem[],
	): Promise<boolean> => {
		error.value = ''
		try {
			const payload: Record<string, any> = {
				[`componentChecks.${itemIndex}`]: {
					done,
					doneAt: done ? serverTimestamp() : null,
				},
			}

			// Determine if ALL manual items will be done after this write.
			// Build the projected state optimistically from local + this change.
			const sub = submissions.value.find(s => s.id === submissionId)
			const currentChecks = { ...(sub?.componentChecks ?? {}) }
			currentChecks[String(itemIndex)] = { done, doneAt: null }

			const manualIndices = deliveryItems
				.map((item, i) => item.submissionMethod === 'manual' ? i : -1)
				.filter(i => i !== -1)

			const allDone = manualIndices.length > 0 &&
				manualIndices.every(i => currentChecks[String(i)]?.done === true)

			if (allDone && sub?.status === 'assigned') {
				payload.status      = 'submitted'
				payload.submittedAt = serverTimestamp()
			} else if (!done && sub?.status === 'submitted') {
				// Un-checking a box that caused submission → revert
				payload.status      = 'assigned'
				payload.submittedAt = null
			}

			await updateDoc(doc(db, 'submissions', submissionId), payload)

			// Reflect changes in local state
			if (sub) {
				if (!sub.componentChecks) sub.componentChecks = {}
				sub.componentChecks[String(itemIndex)] = { done, doneAt: null }
				if (payload.status) sub.status = payload.status
				if ('submittedAt' in payload) sub.submittedAt = payload.submittedAt
			}

			return true
		} catch (e: any) {
			console.error('markComponentDone:', e)
			error.value = 'Failed to update component.'
			return false
		}
	}

	// Fetch ALL submissions for a given period in the current school year (all statuses).
	// Used by GradingView to populate both the grade queue and the confirmation queue.
	const fetchAllByPeriod = async (periodId: string) => {
		isLoading.value = true
		error.value     = ''
		try {
			const q = query(
				collection(db, 'submissions'),
				where('periodId',    '==', periodId),
				where('schoolYearId','==', SCHOOL_YEAR_ID),
			)
			const snap = await getDocs(q)
			submissions.value = snap.docs.map(d => ({
				id: d.id, feedbackNote: '', ...d.data(),
			} as Submission))
		} catch (e: any) {
			console.error('fetchAllByPeriod:', e)
			error.value = 'Failed to load submissions.'
		} finally {
			isLoading.value = false
		}
	}

	// Revert a submission back to submitted (undo grading)
	const ungradeSubmission = async (submissionId: string, ctx?: StatsCtx): Promise<boolean> => {
		error.value = ''
		try {
			await updateDoc(doc(db, 'submissions', submissionId), {
				status: 'submitted',
			})
			const s = submissions.value.find(s => s.id === submissionId)
			if (s) s.status = 'submitted'
			if (ctx) {
				onGraded(ctx.teacherEmail, ctx.periodId, ctx.schoolYearId, -1)
					.catch(e => console.warn('[ungradeSubmission] periodStats:', e))
			}
			return true
		} catch (e: any) {
			console.error('ungradeSubmission:', e)
			error.value = 'Failed to revert submission.'
			return false
		}
	}
	
	const deleteSubmission = async (submissionId: string): Promise<boolean> => {
		error.value = ''
		try {
			await deleteDoc(doc(db, 'submissions', submissionId))
			submissions.value = submissions.value.filter(s => s.id !== submissionId)
			return true
		} catch (e: any) {
			console.error('deleteSubmission:', e)
			error.value = 'Failed to delete submission.'
			return false
		}
	}

	return {
		submissions,
		students,
		isLoading,
		error,
		fetchByAssignment,
		fetchByStudent,
		fetchAllByStudent,
		fetchAllByPeriod,
		fetchNeedingGradingByPeriod,
		fetchStudents,
		gradeSubmission,
		returnSubmission,
		acceptGrade,
		ungradeSubmission,
		setDueDateOverride,
		markComponentDone,
		deleteSubmission,
	}
}