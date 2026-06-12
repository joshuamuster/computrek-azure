<template>
  <section class="adventure-page">
    <div class="lcars-text-bar"><span>My Missions</span></div>

    <div class="dashboard-container">

      <!-- Header strip -->
      <div class="cadet-header">
        <div class="cadet-name">{{ userInfo?.displayName ?? 'Cadet' }}</div>
        <div class="cadet-meta">
          <span class="cadet-period">{{ periodLabel }}</span>
          <span class="cadet-quarter">{{ currentQuarterLabel }}</span>
        </div>
      </div>

      <!-- Warp Core Energy — shows live session progress for this cadet's period -->
      <WarpCorePanel
        v-if="userInfo?.periodId"
        :periodId="userInfo.periodId"
        :periodLabel="periodLabel"
      />

      <!-- Loading -->
      <div v-if="isLoading" class="status-msg">LOADING MISSION DOSSIERS...</div>
      <div v-else-if="loadError" class="status-error">{{ loadError }}</div>

      <!-- Empty state -->
      <div v-else-if="assignmentViews.length === 0" class="status-msg">
        No missions assigned yet. Stand by, Cadet.
      </div>

      <!-- Assignment list -->
      <div v-else class="mission-list">

        <!-- Upcoming / active (includes not-yet-submitted 'assigned' ones) -->
        <div class="mission-group" v-if="upcoming.length">
          <div class="group-label">Active Missions</div>
          <div
              v-for="a in upcoming"
              :key="a.submissionId"
              class="mission-card"
              :class="{
              overdue:    effectiveDueDate(a) && isOverdue(effectiveDueDate(a)!),
              'due-soon': effectiveDueDate(a) && isDueSoon(effectiveDueDate(a)!),
              submitted:  a.status === 'submitted',
              graded:     a.status === 'graded',
              returned:   a.status === 'returned',
            }"
          >
            <div class="mission-type-icon">{{ a.type === 'game' ? '🎮' : '📎' }}</div>
            <div class="mission-body">
              <div class="mission-title">{{ a.title }}</div>
              <div class="mission-desc" v-if="a.description">{{ a.description }}</div>
              <div class="mission-meta">
                <span
                    class="mission-due"
                    :class="{
                    overdue:    effectiveDueDate(a) && isOverdue(effectiveDueDate(a)!),
                    'due-soon': effectiveDueDate(a) && isDueSoon(effectiveDueDate(a)!),
                  }"
                >{{ dueDateLabel(a) }}</span>
                <span v-if="a.quarterId" class="mission-quarter">{{ a.quarterId }}</span>
                <span class="mission-type-label">{{ a.type === 'game' ? 'Game score' : 'File upload' }}</span>
              </div>

              <!-- Feedback note (prominent if returned) -->
              <div v-if="a.feedbackNote" class="feedback-note" :class="{ 'returned-feedback': a.status === 'returned' }">
                {{ a.status === 'returned' ? '↩' : '💬' }} {{ a.feedbackNote }}
              </div>
            </div>

            <!-- Action area -->
            <div class="mission-actions">

              <!-- Not yet submitted (status: 'assigned') -->
              <template v-if="a.status === 'assigned'">
                <button
                    v-if="a.type === 'file'"
                    class="submit-btn"
                    @click="openFileSubmit(a)"
                >Upload</button>
                <span v-else class="game-hint">Complete in-game</span>
              </template>

              <!-- Submitted, not graded -->
              <template v-else-if="a.status === 'submitted'">
                <div class="submission-status submitted-status">
                  <span class="status-icon">✓</span>
                  <span class="status-label">Submitted</span>
                </div>
                <a
                    v-if="a.type === 'file' && a.data?.url"
                    :href="a.data.url"
                    target="_blank"
                    class="view-link"
                >View file ↗</a>
                <button
                    v-if="a.type === 'file'"
                    class="resubmit-btn"
                    @click="openFileSubmit(a)"
                >Re-upload</button>
              </template>

              <!-- Returned — teacher kicked it back with feedback -->
              <template v-else-if="a.status === 'returned'">
                <div class="submission-status returned-status">
                  <span class="status-icon">↩</span>
                  <span class="status-label">Returned</span>
                </div>
                <div v-if="a.pointsEarned != null" class="returned-points">
                  {{ a.pointsEarned }}/{{ a.pointsPossible }} pts offered
                </div>
                <a
                    v-if="a.type === 'file' && a.data?.url"
                    :href="a.data.url"
                    target="_blank"
                    class="view-link"
                >View file ↗</a>
                <button
                    v-if="a.type === 'file'"
                    class="submit-btn"
                    @click="openFileSubmit(a)"
                >Re-submit</button>
                <button
                    class="accept-btn"
                    :disabled="isAccepting === a.submissionId"
                    @click="acceptGradeHandler(a)"
                >{{ isAccepting === a.submissionId ? '...' : 'Accept Grade' }}</button>
              </template>

              <!-- Graded -->
              <template v-else-if="a.status === 'graded'">
                <div class="submission-status graded-status">
                  <span class="status-icon">★</span>
                  <span class="status-label">Graded</span>
                </div>
                <div v-if="a.pointsEarned != null" class="graded-points">
                  {{ a.pointsEarned }}/{{ a.pointsPossible }} pts
                </div>
                <a
                    v-if="a.type === 'file' && a.data?.url"
                    :href="a.data.url"
                    target="_blank"
                    class="view-link"
                >View file ↗</a>
              </template>

            </div>
          </div>
        </div>

        <!-- Past assignments -->
        <div class="mission-group past-group" v-if="past.length">
          <div class="group-label past-label">Past Missions</div>
          <div
              v-for="a in past"
              :key="a.submissionId"
              class="mission-card past-card"
              :class="{
              submitted: a.status === 'submitted',
              graded:    a.status === 'graded',
              returned:  a.status === 'returned',
            }"
          >
            <div class="mission-type-icon dim">{{ a.type === 'game' ? '🎮' : '📎' }}</div>
            <div class="mission-body">
              <div class="mission-title dim">{{ a.title }}</div>
              <div class="mission-meta">
                <span class="mission-due past-due">Due {{ formatDate(effectiveDueDate(a)!) }}</span>
                <span v-if="a.quarterId" class="mission-quarter">{{ a.quarterId }}</span>
              </div>
              <div v-if="a.feedbackNote" class="feedback-note">
                💬 {{ a.feedbackNote }}
              </div>
            </div>
            <div class="mission-actions">
              <template v-if="a.status !== 'assigned'">
                <div
                    class="submission-status"
                    :class="a.status === 'graded' ? 'graded-status' : a.status === 'returned' ? 'returned-status' : 'submitted-status'"
                >
                  <span class="status-icon">{{ a.status === 'graded' ? '★' : a.status === 'returned' ? '↩' : '✓' }}</span>
                  <span class="status-label">{{ a.status === 'graded' ? 'Graded' : a.status === 'returned' ? 'Returned' : 'Submitted' }}</span>
                </div>
                <div v-if="a.pointsEarned != null" class="graded-points">
                  {{ a.pointsEarned }}/{{ a.pointsPossible }} pts
                </div>
                <a
                    v-if="a.type === 'file' && a.data?.url"
                    :href="a.data.url"
                    target="_blank"
                    class="view-link"
                >View ↗</a>
              </template>
              <span v-else class="missing-label">Missing</span>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- File upload modal -->
    <div v-if="submittingAssignment" class="modal-overlay" @click.self="closeUpload">
      <div class="modal">
        <div class="modal-title">UPLOAD MISSION REPORT</div>
        <p class="modal-assignment-name">{{ submittingAssignment.title }}</p>

        <div
            class="upload-area"
            :class="{ 'drag-over': isDraggingFile }"
            @dragover.prevent="isDraggingFile = true"
            @dragleave="isDraggingFile = false"
            @drop.prevent="onFileDrop"
            @click="fileInput?.click()"
        >
          <input
              ref="fileInput"
              type="file"
              accept=".pdf,image/*"
              style="display:none"
              @change="onFileChange"
          />
          <div v-if="!selectedFile">
            <div class="upload-icon">📎</div>
            <div class="upload-hint">Drop a file here or click to browse</div>
            <div class="upload-types">PDF or image (JPG, PNG, GIF)</div>
          </div>
          <div v-else class="selected-file">
            <div class="selected-file-name">{{ selectedFile.name }}</div>
            <div class="selected-file-size">{{ formatBytes(selectedFile.size) }}</div>
            <button class="clear-file" @click.stop="selectedFile = null">✕ Remove</button>
          </div>
        </div>

        <div v-if="uploadError" class="upload-error">{{ uploadError }}</div>

        <div class="modal-actions">
          <button class="lcars-btn lcars-btn--ghost" @click="closeUpload" :disabled="isUploading">CANCEL</button>
          <button
              class="lcars-btn"
              :disabled="!selectedFile || isUploading"
              @click="submitFile"
          >{{ isUploading ? 'TRANSMITTING...' : 'SUBMIT REPORT' }}</button>
        </div>
      </div>
    </div>

  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore'
import { db, storage } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { useAssignments } from '@/composables/useAssignments'
import { useMissions } from '@/composables/useMissions'
import { useSubmissions } from '@/composables/useSubmissions'
import { PERIOD_IDS, QUARTERS, SCHOOL_YEAR_ID } from '@/config/schoolYear'
import type { Submission, SubmissionData } from '@/composables/useSubmissions'
import WarpCorePanel from '@/components/WarpCorePanel.vue'
import { onSubmitted } from '@/composables/useMissionStatsWriter'
import type { StatsCtx } from '@/composables/useSubmissions'

const { userInfo } = useAuth()
const { fetchAssignmentsByIds } = useAssignments()
const { fetchMissionsByIds }    = useMissions()
const { acceptGrade }           = useSubmissions()

// ── Merged view type ──────────────────────────────────────────────────────────
// Combines submission + assignment + mission into a single flat object
// for the template to consume without nesting.

interface AssignmentView {
  // Submission
  submissionId:    string
  assignmentId:    string
  missionId:       string
  status:          'assigned' | 'submitted' | 'graded' | 'returned'
  submittedAt:     any  // Timestamp | null
  feedbackNote:    string
  pointsEarned:    number | null
  data:            SubmissionData
  dueDateOverride: string | null
  // Assignment
  dueDate:         string | null
  quarterId:       string | null
  // Mission
  title:           string
  description:     string
  type:            'file' | 'game'
  pointsPossible:  number
}

// ── State ─────────────────────────────────────────────────────────────────────

const assignmentViews = ref<AssignmentView[]>([])
const isLoading       = ref(false)
const loadError       = ref('')

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadDashboard() {
  const uid = userInfo.value?.uid
  if (!uid) return

  isLoading.value = true
  loadError.value = ''
  try {
    // 1. Fetch all submissions for this student this school year
    const subSnap = await getDocs(query(
      collection(db, 'submissions'),
      where('studentId',    '==', uid),
      where('schoolYearId', '==', SCHOOL_YEAR_ID),
    ))
    const subs: Submission[] = subSnap.docs.map(d => ({
      id: d.id, feedbackNote: '', dueDateOverride: null, ...d.data(),
    } as Submission))

    if (!subs.length) {
      assignmentViews.value = []
      return
    }

    // 2. Batch-fetch referenced assignment docs
    const assignmentIds   = [...new Set(subs.map(s => s.assignmentId))]
    const assignmentDocs  = await fetchAssignmentsByIds(assignmentIds)
    const assignmentMap   = new Map(assignmentDocs.map(a => [a.id, a]))

    // 3. Batch-fetch referenced mission docs
    const missionIds  = [...new Set(assignmentDocs.map(a => a.missionId))]
    const missionDocs = await fetchMissionsByIds(missionIds)
    const missionMap  = new Map(missionDocs.map(m => [m.id, m]))

    // 4. Merge into flat AssignmentView objects
    assignmentViews.value = subs
      .map(sub => {
        const assignment = assignmentMap.get(sub.assignmentId)
        const mission    = assignment ? missionMap.get(assignment.missionId) : undefined
        if (!assignment || !mission) return null

        return {
          submissionId:    sub.id,
          assignmentId:    sub.assignmentId,
          missionId:       sub.missionId,
          status:          sub.status,
          submittedAt:     sub.submittedAt,
          feedbackNote:    sub.feedbackNote ?? '',
          pointsEarned:    sub.pointsEarned ?? null,
          data:            sub.data ?? {},
          dueDateOverride: sub.dueDateOverride ?? null,
          dueDate:         assignment.dueDate,
          quarterId:       assignment.quarterId,
          title:           mission.title,
          description:     mission.description,
          type:            mission.type,
          pointsPossible:  mission.pointsPossible,
        } as AssignmentView
      })
      .filter((v): v is AssignmentView => v !== null)
  } catch (e: any) {
    console.error('loadDashboard:', e)
    loadError.value = 'Failed to load missions.'
  } finally {
    isLoading.value = false
  }
}

// ── Period / quarter display ──────────────────────────────────────────────────

const periodLabel = computed(() => {
  const pid = userInfo.value?.periodId
  return PERIOD_IDS.find(p => p.id === pid)?.label ?? pid ?? '—'
})

const todayIso = new Date().toISOString().slice(0, 10)

const currentQuarterLabel = computed(() => {
  return QUARTERS.find(q => todayIso >= q.start && todayIso <= q.end)?.label ?? ''
})

// ── Effective due date (override takes precedence) ────────────────────────────

function effectiveDueDate(a: AssignmentView): string | null {
  return a.dueDateOverride ?? a.dueDate
}

// ── Split into upcoming vs past ───────────────────────────────────────────────

const upcoming = computed(() =>
  assignmentViews.value.filter(a => {
    const due = effectiveDueDate(a)
    return !due || due >= todayIso  // no due date → treat as active
  })
)

const past = computed(() =>
  assignmentViews.value.filter(a => {
    const due = effectiveDueDate(a)
    return due && due < todayIso
  })
)

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dueDateLabel(a: AssignmentView): string {
  const iso = effectiveDueDate(a)
  if (!iso) return 'No due date set'
  if (iso === todayIso) return 'Due today'
  if (iso < todayIso)   return `Overdue — was due ${formatDate(iso)}`
  const diff = Math.ceil((new Date(iso).getTime() - new Date(todayIso).getTime()) / 86400000)
  if (diff === 1)  return 'Due tomorrow'
  if (diff <= 5)   return `Due in ${diff} days — ${formatDate(iso)}`
  return `Due ${formatDate(iso)}`
}

function isOverdue(iso: string):  boolean { return iso < todayIso }
function isDueSoon(iso: string):  boolean {
  return !isOverdue(iso) && Math.ceil((new Date(iso).getTime() - new Date(todayIso).getTime()) / 86400000) <= 3
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)    return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ── Accept grade ──────────────────────────────────────────────────────────────

const isAccepting = ref<string | null>(null)

async function acceptGradeHandler(a: AssignmentView) {
  isAccepting.value = a.submissionId
  const ctx: StatsCtx = {
    teacherEmail: userInfo.value?.teacherEmail ?? '',
    periodId:     userInfo.value?.periodId     ?? '',
    schoolYearId: userInfo.value?.schoolYearId ?? SCHOOL_YEAR_ID,
  }
  const ok = await acceptGrade(a.submissionId, ctx)
  if (ok) {
    const idx = assignmentViews.value.findIndex(v => v.submissionId === a.submissionId)
    if (idx !== -1) {
      assignmentViews.value[idx] = { ...assignmentViews.value[idx], status: 'graded' }
      assignmentViews.value = [...assignmentViews.value]
    }
  }
  isAccepting.value = null
}

// ── File upload ───────────────────────────────────────────────────────────────

const submittingAssignment = ref<AssignmentView | null>(null)
const selectedFile         = ref<File | null>(null)
const isDraggingFile       = ref(false)
const isUploading          = ref(false)
const uploadError          = ref('')
const fileInput            = ref<HTMLInputElement | null>(null)

const MAX_FILE_SIZE = 10 * 1024 * 1024

function openFileSubmit(a: AssignmentView) {
  submittingAssignment.value = a
  selectedFile.value         = null
  uploadError.value          = ''
}

function closeUpload() {
  submittingAssignment.value = null
  selectedFile.value         = null
  uploadError.value          = ''
}

function onFileDrop(e: DragEvent) {
  isDraggingFile.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) validateAndSetFile(file)
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) validateAndSetFile(file)
}

function validateAndSetFile(file: File) {
  uploadError.value = ''
  if (file.size > MAX_FILE_SIZE) {
    uploadError.value = 'File is too large. Maximum size is 10 MB.'
    return
  }
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowed.includes(file.type)) {
    uploadError.value = 'Please upload a PDF or image file.'
    return
  }
  selectedFile.value = file
}

async function submitFile() {
  if (!selectedFile.value || !submittingAssignment.value || !userInfo.value) return

  isUploading.value = true
  uploadError.value = ''

  const a   = submittingAssignment.value
  const uid = userInfo.value.uid
  const ext = selectedFile.value.name.split('.').pop()
  const path = `submissions/${SCHOOL_YEAR_ID}/${uid}/${a.assignmentId}.${ext}`

  try {
    // Upload file to Firebase Storage
    const fileRef = storageRef(storage, path)
    await uploadBytes(fileRef, selectedFile.value)
    const downloadURL = await getDownloadURL(fileRef)

    // The submission doc always exists (created at fan-out). Always update.
    await updateDoc(doc(db, 'submissions', a.submissionId), {
      data:        { url: downloadURL, fileName: selectedFile.value.name },
      status:      'submitted',
      submittedAt: serverTimestamp(),
    })

    // Increment the period stats counter (fire-and-forget)
    const teacherEmail = userInfo.value?.teacherEmail
    const periodId     = userInfo.value?.periodId
    const schoolYearId = userInfo.value?.schoolYearId ?? SCHOOL_YEAR_ID
    if (teacherEmail && periodId) {
      onSubmitted(teacherEmail, periodId, schoolYearId)
        .catch(e => console.warn('[submitFile] periodStats update failed:', e))
    }

    // Update the local merged view immediately
    const idx = assignmentViews.value.findIndex(v => v.submissionId === a.submissionId)
    if (idx !== -1) {
      assignmentViews.value[idx] = {
        ...assignmentViews.value[idx],
        data:   { url: downloadURL, fileName: selectedFile.value.name },
        status: 'submitted',
      }
    }

    // Force reactivity
    assignmentViews.value = [...assignmentViews.value]
    closeUpload()
  } catch (e: any) {
    console.error('submitFile error:', e)
    uploadError.value = 'Upload failed. Please try again.'
  } finally {
    isUploading.value = false
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  if (userInfo.value?.uid) {
    await loadDashboard()
  }
})
</script>

<style scoped>
@import '../assets/styles/classic.css';

.dashboard-container {
  display: flex; flex-direction: column; gap: 1.5rem;
  padding: 1.5rem 2rem 3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

/* ── Cadet header ── */
.cadet-header {
  display: flex; align-items: baseline; justify-content: space-between;
  border-bottom: 0.125rem solid rgba(255,153,0,0.3); padding-bottom: 0.75rem;
  flex-wrap: wrap; gap: 0.5rem;
}
.cadet-name   { font-size: 1.8rem; font-weight: bold; color: #ff9900; letter-spacing: 0.05em; }
.cadet-meta   { display: flex; gap: 1rem; align-items: center; }
.cadet-period { color: #99ccff; font-size: 1rem; letter-spacing: 0.08em; }
.cadet-quarter { color: #556; font-size: 0.85rem; letter-spacing: 0.06em; }

/* ── Status messages ── */
.status-msg   { color: #99ccff; font-size: 1rem; text-align: center; padding: 3rem 0; opacity: 0.7; }
.status-error { color: #ff6e6e; font-size: 1rem; text-align: center; padding: 2rem 0; }

/* ── Mission list ── */
.mission-list  { display: flex; flex-direction: column; gap: 2rem; }
.mission-group { display: flex; flex-direction: column; gap: 0.6rem; }
.past-group    { opacity: 0.6; }

.group-label {
  font-size: 0.8rem; font-weight: bold; letter-spacing: 0.12em;
  color: #ff9900; text-transform: uppercase; margin-bottom: 0.25rem;
}
.past-label { color: #556; }

/* ── Mission card ── */
.mission-card {
  display: flex; align-items: flex-start; gap: 1rem;
  background: rgba(0,30,60,0.5); border: 0.125rem solid rgba(153,204,255,0.15);
  border-radius: 0.5rem; padding: 0.85rem 1rem; transition: border-color 0.15s;
}
.mission-card:hover           { border-color: rgba(153,204,255,0.3); }
.mission-card.overdue         { border-color: rgba(255,100,100,0.4); background: rgba(80,0,0,0.3); }
.mission-card.due-soon        { border-color: rgba(255,200,0,0.4); }
.mission-card.submitted       { border-color: rgba(153,204,255,0.35); }
.mission-card.graded          { border-color: rgba(105,240,174,0.4); background: rgba(0,40,20,0.3); }
.mission-card.returned        { border-color: rgba(255,180,0,0.5); background: rgba(60,40,0,0.35); }
.past-card                    { background: rgba(0,0,0,0.2); border-color: rgba(255,255,255,0.05); }

.mission-type-icon { font-size: 1.5rem; line-height: 1; flex-shrink: 0; margin-top: 0.1rem; }
.mission-type-icon.dim { opacity: 0.4; }

.mission-body  { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; }
.mission-title { font-size: 1.1rem; color: #e6f0ff; font-weight: 500; }
.mission-title.dim { color: #556; }
.mission-desc  { font-size: 0.85rem; color: #99ccff; opacity: 0.8; line-height: 1.4; }

.mission-meta {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.2rem;
}
.mission-due         { font-size: 0.8rem; font-weight: bold; color: #69f0ae; letter-spacing: 0.04em; }
.mission-due.overdue  { color: #ff6e6e; }
.mission-due.due-soon { color: #ffd740; }
.past-due            { color: #445 !important; }
.mission-quarter     { font-size: 0.75rem; color: #445; letter-spacing: 0.06em; }
.mission-type-label  { font-size: 0.75rem; color: #556; letter-spacing: 0.04em; }

/* Feedback note */
.feedback-note {
  font-size: 0.82rem; color: #99ccff;
  background: rgba(153,204,255,0.07);
  border-left: 0.2rem solid rgba(153,204,255,0.3);
  border-radius: 0 0.25rem 0.25rem 0;
  padding: 0.35rem 0.6rem; margin-top: 0.35rem;
  line-height: 1.4;
}
.returned-feedback {
  color: #ffe082;
  background: rgba(255,180,0,0.08);
  border-left-color: rgba(255,180,0,0.5);
  font-weight: 500;
}

/* ── Action area ── */
.mission-actions {
  flex-shrink: 0; display: flex; flex-direction: column;
  align-items: flex-end; gap: 0.4rem; min-width: 90px;
}

.submit-btn {
  background: linear-gradient(90deg, #cc6600, #ff9900);
  border: none; border-radius: 0.4rem; color: black;
  cursor: pointer; font-family: inherit; font-size: 0.85rem;
  font-weight: bold; letter-spacing: 0.06em; padding: 0.4rem 0.9rem;
  transition: opacity 0.2s; white-space: nowrap;
}
.submit-btn:hover { opacity: 0.85; }

.resubmit-btn {
  background: transparent;
  border: 0.0625rem solid rgba(255,153,0,0.35);
  border-radius: 0.4rem; color: rgba(255,153,0,0.7);
  cursor: pointer; font-family: inherit; font-size: 0.75rem;
  font-weight: bold; letter-spacing: 0.05em; padding: 0.25rem 0.6rem;
  transition: all 0.2s; white-space: nowrap;
}
.resubmit-btn:hover { border-color: #ff9900; color: #ff9900; background: rgba(255,153,0,0.08); }

/* Submission status badge */
.submission-status {
  display: flex; align-items: center; gap: 0.3rem;
  font-size: 0.8rem; font-weight: bold; letter-spacing: 0.06em;
  padding: 0.25rem 0.6rem; border-radius: 0.3rem;
  text-transform: uppercase; white-space: nowrap;
}
.submitted-status {
  background: rgba(153,204,255,0.1);
  border: 0.0625rem solid rgba(153,204,255,0.3);
  color: #99ccff;
}
.graded-status {
  background: rgba(105,240,174,0.1);
  border: 0.0625rem solid rgba(105,240,174,0.3);
  color: #69f0ae;
}
.returned-status {
  background: rgba(255,180,0,0.1);
  border: 0.0625rem solid rgba(255,180,0,0.4);
  color: #ffb300;
}
.status-icon  { font-size: 0.9rem; }
.status-label { font-size: 0.75rem; }

.returned-points, .graded-points {
  font-size: 0.78rem; font-weight: bold;
  color: #ffd740; letter-spacing: 0.03em;
}

.accept-btn {
  background: transparent;
  border: 0.0625rem solid rgba(255,180,0,0.45);
  border-radius: 0.4rem; color: #ffb300;
  cursor: pointer; font-family: inherit; font-size: 0.78rem;
  font-weight: bold; letter-spacing: 0.05em; padding: 0.3rem 0.7rem;
  transition: all 0.2s; white-space: nowrap;
}
.accept-btn:hover:not(:disabled) { border-color: #ffb300; background: rgba(255,180,0,0.1); }
.accept-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.view-link {
  color: #99ccff; font-size: 0.8rem; text-decoration: none;
  border-bottom: 0.0625rem solid rgba(153,204,255,0.3);
  transition: color 0.15s; white-space: nowrap;
}
.view-link:hover { color: #ff9900; border-bottom-color: rgba(255,153,0,0.5); }

.game-hint    { font-size: 0.75rem; color: #445; letter-spacing: 0.05em; }
.missing-label { font-size: 0.75rem; color: #ff6e6e; letter-spacing: 0.05em; font-weight: bold; }

/* ── File upload modal ── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.75);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  border: 0.125rem solid #ff9900; border-radius: 0.75rem;
  padding: 2rem; max-width: 26rem; width: 90%;
  display: flex; flex-direction: column; gap: 1rem;
}
.modal-title           { color: #ff9900; font-size: 1.4rem; font-weight: bold; letter-spacing: 0.15em; }
.modal-assignment-name { color: #99ccff; font-size: 1rem; margin: 0; }

.upload-area {
  border: 0.125rem dashed rgba(153,204,255,0.3); border-radius: 0.5rem;
  padding: 2rem 1rem; text-align: center; cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
}
.upload-area:hover    { border-color: rgba(153,204,255,0.6); background: rgba(153,204,255,0.04); }
.upload-area.drag-over { border-color: #ff9900; background: rgba(255,153,0,0.06); }
.upload-icon  { font-size: 2.5rem; }
.upload-hint  { color: #99ccff; font-size: 0.9rem; }
.upload-types { color: #556; font-size: 0.75rem; }

.selected-file      { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
.selected-file-name { color: #e6f0ff; font-size: 0.95rem; word-break: break-all; }
.selected-file-size { color: #556; font-size: 0.8rem; }
.clear-file {
  background: transparent; border: 0.0625rem solid rgba(255,110,110,0.4);
  border-radius: 0.25rem; color: #ff6e6e; cursor: pointer;
  font-size: 0.75rem; padding: 0.2rem 0.6rem;
}

.upload-error { color: #ff6e6e; font-size: 0.9rem; text-align: center; }

.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
.lcars-btn {
  background: linear-gradient(90deg, #cc6600, #ff9900);
  border: none; border-radius: 0.4rem; color: black;
  cursor: pointer; font-family: inherit; font-size: 0.95rem;
  font-weight: bold; letter-spacing: 0.08em; padding: 0.6rem 1.4rem;
  transition: opacity 0.2s;
}
.lcars-btn:hover:not(:disabled) { opacity: 0.85; }
.lcars-btn:disabled              { opacity: 0.5; cursor: not-allowed; }
.lcars-btn--ghost {
  background: transparent; border: 0.125rem solid #99ccff; color: #99ccff;
}
</style>
