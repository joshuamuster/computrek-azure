<template>
  <section class="adventure-page">
    <div class="lcars-text-bar"><span>Mission Control</span></div>

    <div class="dashboard-layout">

      <!-- ── FULL-WIDTH HEADER ─────────────────────────────────────────── -->
      <div class="cadet-header full-width">
        <div class="cadet-name">{{ userInfo?.displayName ?? 'Cadet' }}</div>
        <div class="cadet-meta">
          <span class="cadet-period">{{ periodLabel }}</span>
          <span v-if="teacherName" class="cadet-teacher">{{ teacherName }}</span>
          <span class="cadet-quarter">{{ currentQuarterLabel }}</span>
        </div>
      </div>

      <!-- ── LEFT COLUMN ──────────────────────────────────────────────── -->
      <div class="col-main">

        <!-- Grade + Typing side by side -->
        <div class="top-panels">

        <!-- Grade panel -->
        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="panel-title">CURRENT GRADE</div>
              <div class="panel-sub">{{ currentQuarterLabel }} · graded missions only</div>
            </div>
            <div v-if="quarterGrade" class="grade-letter" :style="{ color: gradeColor(quarterGrade.percent) }">
              {{ letterGrade(quarterGrade.percent) }}
            </div>
          </div>

          <div v-if="isLoading" class="queue-empty">Scanning mission logs…</div>
          <div v-else-if="!quarterGrade" class="queue-empty">No graded missions this quarter yet.</div>
          <div v-else class="grade-body">
            <div class="grade-row">
              <div class="grade-percent" :style="{ color: gradeColor(quarterGrade.percent) }">
                {{ quarterGrade.percent }}%
              </div>
              <div class="grade-pts">{{ quarterGrade.earned }} / {{ quarterGrade.possible }} pts</div>
            </div>
            <div class="grade-bar-track">
              <div class="grade-bar-fill" :style="{ width: quarterGrade.percent + '%', background: gradeColor(quarterGrade.percent) }"></div>
            </div>
            <div class="grade-footer">
              <span>{{ quarterGrade.gradedCount }} mission{{ quarterGrade.gradedCount !== 1 ? 's' : '' }} graded</span>
              <span v-if="pendingGradeCount > 0" class="grade-pending">{{ pendingGradeCount }} awaiting grade</span>
            </div>
          </div>
        </div>

        <!-- Typing panel -->
        <div class="panel typing-panel">
          <div class="panel-header">
            <div>
              <div class="panel-title">TYPING STATUS</div>
              <div class="panel-sub">Personal performance metrics</div>
            </div>
          </div>

          <div v-if="typingLoading" class="queue-empty">Scanning logs…</div>
          <div v-else-if="!typingStatsRaw.personalBestWpm" class="queue-empty">
            No typing sessions yet.<br>Head to the Typing Lab!
          </div>
          <div v-else class="typing-body">
            <div
              class="tier-badge tier-badge--clickable"
              :style="{
                color:       currentTier.color,
                borderColor: currentTier.color,
                boxShadow:   '0 0 14px ' + currentTier.glow,
              }"
              title="View all tiers"
              @click="showTierModal = true"
            >
              ⚡ {{ currentTier.label }}
            </div>

            <div class="typing-stats-row">
              <div class="typing-stat">
                <div class="typing-stat-val">{{ typingAvgDisplay }}</div>
                <div class="typing-stat-label">avg WPM</div>
              </div>
              <div class="typing-stat">
                <div class="typing-stat-val">{{ typingBestDisplay }}</div>
                <div class="typing-stat-label">best WPM</div>
              </div>
              <div class="typing-stat">
                <div class="typing-stat-val">{{ typingAccyDisplay }}%</div>
                <div class="typing-stat-label">accuracy</div>
              </div>
            </div>

          </div>
        </div>

        </div><!-- /top-panels -->

        <!-- Loading / error state -->
        <div v-if="isLoading" class="status-msg">LOADING MISSION DOSSIERS...</div>
        <div v-else-if="loadError" class="status-error">{{ loadError }}</div>

        <template v-else>

          <!-- Active missions panel -->
          <div class="panel">
            <div class="panel-header">
              <div>
                <div class="panel-title">ACTIVE MISSIONS</div>
                <div class="panel-sub">Current assignments and submissions</div>
              </div>
              <div v-if="upcoming.length > 0" class="panel-badge">{{ upcoming.length }}</div>
            </div>

            <div v-if="upcoming.length === 0 && assignmentViews.length === 0" class="queue-empty">
              No missions assigned yet. Stand by, Cadet.
            </div>
            <div v-else-if="upcoming.length === 0" class="queue-empty">
              <span class="queue-clear-icon">✓</span>
              All current missions complete.
            </div>

            <div v-else class="mission-list">
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
                  <div v-if="a.feedbackNote" class="feedback-note" :class="{ 'returned-feedback': a.status === 'returned' }">
                    {{ a.status === 'returned' ? '↩' : '💬' }} {{ a.feedbackNote }}
                  </div>
                </div>

                <div class="mission-actions">
                  <!-- Not yet submitted -->
                  <template v-if="a.status === 'assigned'">
                    <template v-if="a.deliveryItems?.length">
                      <template v-for="(item, i) in a.deliveryItems" :key="i">
                        <a v-if="item.kind === 'pdf' && item.url" :href="item.url" target="_blank" class="delivery-link">📄 {{ item.name || 'Download PDF' }} ↗</a>
                        <a v-if="item.kind === 'link' && item.url" :href="item.url" target="_blank" class="delivery-link">🔗 {{ item.label || 'Open Link' }} ↗</a>
                        <span v-if="item.kind === 'paper'" class="game-hint">📋 Get handout from teacher</span>
                      </template>
                      <button v-if="a.deliveryItems.some(i => i.submissionMethod === 'file-upload')" class="submit-btn" @click="openFileSubmit(a)">Upload</button>
                      <span v-else-if="a.deliveryItems.some(i => i.submissionMethod === 'manual')" class="game-hint pending-hint">Waiting for teacher confirmation</span>
                      <span v-else class="game-hint">Complete in-game</span>
                    </template>
                    <template v-else>
                      <button v-if="a.type === 'file'" class="submit-btn" @click="openFileSubmit(a)">Upload</button>
                      <span v-else class="game-hint">Complete in-game</span>
                    </template>
                  </template>

                  <!-- Submitted -->
                  <template v-else-if="a.status === 'submitted'">
                    <div class="submission-status submitted-status">
                      <span class="status-icon">✓</span>
                      <span class="status-label">Submitted</span>
                    </div>
                    <template v-for="(item, i) in (a.deliveryItems ?? [])" :key="i">
                      <a v-if="(item.kind === 'pdf' || item.kind === 'link') && item.url" :href="item.url" target="_blank" class="view-link">
                        {{ item.kind === 'pdf' ? (item.name || 'PDF') : (item.label || 'Link') }} ↗
                      </a>
                    </template>
                    <a v-if="(!a.deliveryItems?.length) && a.type === 'file' && a.data?.url" :href="a.data.url" target="_blank" class="view-link">View file ↗</a>
                    <button v-if="a.deliveryItems?.some(i => i.submissionMethod === 'file-upload') || (!a.deliveryItems?.length && a.type === 'file')" class="resubmit-btn" @click="openFileSubmit(a)">Re-upload</button>
                  </template>

                  <!-- Returned -->
                  <template v-else-if="a.status === 'returned'">
                    <div class="submission-status returned-status">
                      <span class="status-icon">↩</span>
                      <span class="status-label">Returned</span>
                    </div>
                    <div v-if="a.pointsEarned != null" class="returned-points">{{ a.pointsEarned }}/{{ a.pointsPossible }} pts offered</div>
                    <a v-if="a.type === 'file' && a.data?.url" :href="a.data.url" target="_blank" class="view-link">View file ↗</a>
                    <button v-if="a.type === 'file'" class="submit-btn" @click="openFileSubmit(a)">Re-submit</button>
                    <button class="accept-btn" :disabled="isAccepting === a.submissionId" @click="acceptGradeHandler(a)">
                      {{ isAccepting === a.submissionId ? '...' : 'Accept Grade' }}
                    </button>
                  </template>

                  <!-- Graded -->
                  <template v-else-if="a.status === 'graded'">
                    <div class="submission-status graded-status">
                      <span class="status-icon">★</span>
                      <span class="status-label">Graded</span>
                    </div>
                    <div v-if="a.pointsEarned != null" class="graded-points">{{ a.pointsEarned }}/{{ a.pointsPossible }} pts</div>
                    <a v-if="a.type === 'file' && a.data?.url" :href="a.data.url" target="_blank" class="view-link">View file ↗</a>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- Past missions archive -->
          <div v-if="pastSubmitted.length > 0" class="panel past-panel">
            <div class="panel-header">
              <div>
                <div class="panel-title">MISSION ARCHIVE</div>
                <div class="panel-sub">Completed past-due assignments</div>
              </div>
            </div>
            <div class="mission-list">
              <div
                v-for="a in pastSubmitted"
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
                  <div v-if="a.feedbackNote" class="feedback-note">💬 {{ a.feedbackNote }}</div>
                </div>
                <div class="mission-actions">
                  <div class="submission-status" :class="a.status === 'graded' ? 'graded-status' : a.status === 'returned' ? 'returned-status' : 'submitted-status'">
                    <span class="status-icon">{{ a.status === 'graded' ? '★' : a.status === 'returned' ? '↩' : '✓' }}</span>
                    <span class="status-label">{{ a.status === 'graded' ? 'Graded' : a.status === 'returned' ? 'Returned' : 'Submitted' }}</span>
                  </div>
                  <div v-if="a.pointsEarned != null" class="graded-points">{{ a.pointsEarned }}/{{ a.pointsPossible }} pts</div>
                  <a v-if="a.type === 'file' && a.data?.url" :href="a.data.url" target="_blank" class="view-link">View ↗</a>
                </div>
              </div>
            </div>
          </div>

        </template>
      </div><!-- /col-main -->

      <!-- ── RIGHT SIDEBAR ──────────────────────────────────────────── -->
      <div class="col-sidebar">

        <!-- Overdue panel -->
        <div class="panel overdue-panel">
          <div class="panel-header">
            <div>
              <div class="panel-title" :class="{ 'title-danger': overdueItems.length > 0 }">OVERDUE MISSIONS</div>
              <div class="panel-sub">Assignments needing immediate attention</div>
            </div>
            <div v-if="overdueItems.length > 0" class="panel-badge panel-badge--danger">{{ overdueItems.length }}</div>
          </div>

          <div v-if="overdueItems.length === 0" class="queue-empty">
            <span class="queue-clear-icon">✓</span>
            No overdue missions.
          </div>
          <div v-else class="overdue-list">
            <div v-for="a in overdueItems" :key="a.submissionId" class="overdue-row">
              <div class="overdue-icon">{{ a.type === 'game' ? '🎮' : '📎' }}</div>
              <div class="overdue-body">
                <div class="overdue-title">{{ a.title }}</div>
                <div class="overdue-due">{{ dueDateLabel(a) }}</div>
              </div>
              <button
                v-if="a.type === 'file' || a.deliveryItems?.some(i => i.submissionMethod === 'file-upload')"
                class="submit-btn submit-btn--sm"
                @click="openFileSubmit(a)"
              >Upload</button>
              <span v-else class="game-hint game-hint--sm">In-game</span>
            </div>
          </div>
        </div>

      </div><!-- /col-sidebar -->

    </div><!-- /dashboard-layout -->

    <!-- ── File upload modal ──────────────────────────────────────── -->
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
          <input ref="fileInput" type="file" accept=".pdf,image/*" style="display:none" @change="onFileChange" />
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
          <button class="lcars-btn" :disabled="!selectedFile || isUploading" @click="submitFile">
            {{ isUploading ? 'TRANSMITTING...' : 'SUBMIT REPORT' }}
          </button>
        </div>
      </div>
    </div>

  </section>

  <!-- ── Tier ladder modal ──────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="showTierModal" class="tier-modal-overlay" @click.self="showTierModal = false">
        <div class="tier-modal-content" role="dialog" aria-modal="true" @click.stop>
          <div class="tier-modal-header">
            <div class="tier-header-deco"></div>
            <h2>WPM Tiers</h2>
            <button class="tier-close-btn" @click="showTierModal = false" aria-label="Close">
              <img src="@/assets/icons/do-not-enter6.svg" alt="Close" class="tier-close-icon" />
            </button>
          </div>

          <div class="tier-modal-body">
            <div
              v-for="tier in WPM_TIERS"
              :key="tier.label"
              class="tier-row"
              :class="{ 'tier-row--active': currentTier.label === tier.label }"
            >
              <span class="tier-dot" :style="{ background: currentTier.label === tier.label ? tier.color : 'rgba(255,255,255,0.1)' }"></span>
              <span class="tier-row-label" :style="currentTier.label === tier.label ? { color: tier.color, fontWeight: '700' } : {}">
                {{ tier.label }}
              </span>
              <span v-if="currentTier.label === tier.label" class="tier-row-you">← YOU</span>
              <span class="tier-row-wpm">{{ tier.min }}+ WPM</span>
            </div>
          </div>

          <div class="tier-modal-footer">
            <div class="tier-footer-bar"></div>
            <div class="tier-footer-id">TIER-RANK-001</div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db, storage } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { useAssignments } from '@/composables/useAssignments'
import { useMissions } from '@/composables/useMissions'
import { useSubmissions } from '@/composables/useSubmissions'
import { useTypingStats } from '@/composables/useTypingStats'
import { PERIOD_IDS, QUARTERS, SCHOOL_YEAR_ID } from '@/config/schoolYear'
import type { Submission, SubmissionData, ComponentCheck } from '@/composables/useSubmissions'
import type { DeliveryItem } from '@/composables/useMissions'
import { onSubmitted } from '@/composables/useMissionStatsWriter'
import type { StatsCtx } from '@/composables/useSubmissions'

const { userInfo } = useAuth()
const { fetchAssignmentsByIds } = useAssignments()
const { fetchMissionsByIds }    = useMissions()
const { acceptGrade }           = useSubmissions()

// ── Typing stats ──────────────────────────────────────────────────────────────

const {
  fetchStats,
  isLoading: typingLoading,
  stats: typingStatsRaw,
  personalBestWpm: typingBestDisplay,
  rollingAvgWpm:   typingAvgDisplay,
  rollingAvgAccy:  typingAccyDisplay,
} = useTypingStats()

// ── WPM tier definitions (highest → lowest) ───────────────────────────────────

const WPM_TIERS = [
  { min: 75, label: 'Fleet Admiral',  color: '#ff9900', glow: 'rgba(255,153,0,0.45)' },
  { min: 65, label: 'Admiral',        color: '#ffcc44', glow: 'rgba(255,204,68,0.4)' },
  { min: 55, label: 'Captain',        color: '#69f0ae', glow: 'rgba(105,240,174,0.4)' },
  { min: 45, label: 'Commander',      color: '#4d99ee', glow: 'rgba(77,153,238,0.35)' },
  { min: 35, label: 'Lt. Commander',  color: '#99ccff', glow: 'rgba(153,204,255,0.3)' },
  { min: 25, label: 'Lieutenant',     color: '#aabbcc', glow: 'rgba(153,187,204,0.2)' },
  { min: 15, label: 'Ensign',         color: '#7799aa', glow: 'rgba(119,153,170,0.15)' },
  { min: 0,  label: 'Cadet',          color: '#556677', glow: 'rgba(85,102,119,0.1)' },
] as const

function getWpmTier(wpm: number | null) {
  if (wpm === null) return WPM_TIERS[WPM_TIERS.length - 1]
  return WPM_TIERS.find(t => wpm >= t.min) ?? WPM_TIERS[WPM_TIERS.length - 1]
}

const currentTier = computed(() => getWpmTier(typingStatsRaw.value.rollingAvgWpm))

// ── Merged view type ──────────────────────────────────────────────────────────

interface AssignmentView {
  submissionId:    string
  assignmentId:    string
  missionId:       string
  status:          'assigned' | 'submitted' | 'graded' | 'returned'
  submittedAt:     any
  feedbackNote:    string
  pointsEarned:    number | null
  data:            SubmissionData
  dueDateOverride: string | null
  componentChecks: Record<string, ComponentCheck> | null
  dueDate:         string | null
  quarterId:       string | null
  title:           string
  description:     string
  type:            'file' | 'game' | 'manual'
  deliveryItems:   DeliveryItem[]
  pointsPossible:  number
}

// ── Missions state ────────────────────────────────────────────────────────────

const assignmentViews = ref<AssignmentView[]>([])
const isLoading       = ref(false)
const loadError       = ref('')

// ── Period / quarter display ──────────────────────────────────────────────────

const periodLabel = computed(() => {
  const pid = userInfo.value?.periodId
  return PERIOD_IDS.find(p => p.id === pid)?.label ?? pid ?? '—'
})

const todayIso = new Date().toISOString().slice(0, 10)

const currentQuarterLabel = computed(() =>
  QUARTERS.find(q => todayIso >= q.start && todayIso <= q.end)?.label ?? ''
)

const currentQuarterId = computed(() =>
  QUARTERS.find(q => todayIso >= q.start && todayIso <= q.end)?.id ?? null
)

// ── Grade calculation (current quarter, graded/returned only) ─────────────────

const quarterGrade = computed(() => {
  if (!currentQuarterId.value) return null
  const graded = assignmentViews.value.filter(a =>
    a.quarterId === currentQuarterId.value &&
    (a.status === 'graded' || a.status === 'returned') &&
    a.pointsEarned != null &&
    a.pointsPossible > 0
  )
  if (!graded.length) return null
  const earned   = graded.reduce((s, a) => s + (a.pointsEarned ?? 0), 0)
  const possible = graded.reduce((s, a) => s + a.pointsPossible, 0)
  return {
    earned,
    possible,
    percent:      Math.round((earned / possible) * 100),
    gradedCount:  graded.length,
  }
})

const pendingGradeCount = computed(() =>
  assignmentViews.value.filter(a =>
    a.quarterId === currentQuarterId.value && a.status === 'submitted'
  ).length
)

function letterGrade(pct: number): string {
  if (pct >= 90) return 'A'
  if (pct >= 80) return 'B'
  if (pct >= 70) return 'C'
  if (pct >= 60) return 'D'
  return 'F'
}

function gradeColor(pct: number): string {
  if (pct >= 90) return '#69f0ae'
  if (pct >= 80) return '#ff9900'
  if (pct >= 70) return '#4d99ee'
  if (pct >= 60) return '#ffd740'
  return '#ff6e6e'
}

// ── Effective due date ────────────────────────────────────────────────────────

function effectiveDueDate(a: AssignmentView): string | null {
  return a.dueDateOverride ?? a.dueDate
}

// ── Active vs past splits ─────────────────────────────────────────────────────

const upcoming = computed(() =>
  assignmentViews.value.filter(a => {
    const due = effectiveDueDate(a)
    return !due || due >= todayIso
  })
)

const past = computed(() =>
  assignmentViews.value.filter(a => {
    const due = effectiveDueDate(a)
    return due && due < todayIso
  })
)

// Overdue = past-due AND never submitted (status 'assigned')
const overdueItems = computed(() =>
  past.value.filter(a => a.status === 'assigned')
)

// Archive = past-due but at least submitted
const pastSubmitted = computed(() =>
  past.value.filter(a => a.status !== 'assigned')
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

// ── Teacher name ──────────────────────────────────────────────────────────────

const teacherName   = ref<string | null>(null)
const showTierModal = ref(false)

async function fetchTeacherName() {
  const email = userInfo.value?.teacherEmail
  if (!email) return
  const snap = await getDoc(doc(db, 'approvedUsers', email))
  if (snap.exists()) teacherName.value = snap.data().displayName ?? null
}

// ── Data loading (real-time) ──────────────────────────────────────────────────

// Caches so we only fetch assignments/missions we haven't seen yet
const assignmentCache = new Map<string, any>()
const missionCache    = new Map<string, any>()

let unsubscribeSubmissions: (() => void) | null = null

async function buildViewsFromSubs(subs: Submission[]) {
  if (!subs.length) {
    assignmentViews.value = []
    return
  }

  // Only fetch assignment IDs not already cached
  const newAssignmentIds = [...new Set(subs.map(s => s.assignmentId))]
    .filter(id => !assignmentCache.has(id))
  if (newAssignmentIds.length) {
    const docs = await fetchAssignmentsByIds(newAssignmentIds)
    docs.forEach(a => assignmentCache.set(a.id, a))
  }

  // Only fetch mission IDs not already cached
  const newMissionIds = [...new Set(
    subs.map(s => assignmentCache.get(s.assignmentId)?.missionId).filter(Boolean)
  )].filter(id => !missionCache.has(id))
  if (newMissionIds.length) {
    const docs = await fetchMissionsByIds(newMissionIds)
    docs.forEach(m => missionCache.set(m.id, m))
  }

  assignmentViews.value = subs
    .map(sub => {
      const assignment = assignmentCache.get(sub.assignmentId)
      const mission    = assignment ? missionCache.get(assignment.missionId) : undefined
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
        componentChecks: (sub as any).componentChecks ?? null,
        dueDate:         assignment.dueDate,
        quarterId:       assignment.quarterId,
        title:           mission.title,
        description:     mission.description,
        type:            mission.type,
        deliveryItems:   mission.deliveryItems ?? [],
        pointsPossible:  mission.pointsPossible,
      } as AssignmentView
    })
    .filter((v): v is AssignmentView => v !== null)
}

function startDashboardListener() {
  const uid = userInfo.value?.uid
  if (!uid) return

  isLoading.value = true
  loadError.value = ''

  unsubscribeSubmissions = onSnapshot(
    query(
      collection(db, 'submissions'),
      where('studentId',    '==', uid),
      where('schoolYearId', '==', SCHOOL_YEAR_ID),
    ),
    async snap => {
      try {
        const subs: Submission[] = snap.docs.map(d => ({
          id: d.id, feedbackNote: '', dueDateOverride: null, ...d.data(),
        } as Submission))
        await buildViewsFromSubs(subs)
      } catch (e: any) {
        console.error('loadDashboard:', e)
        loadError.value = 'Failed to load missions.'
      } finally {
        isLoading.value = false
      }
    },
    err => {
      console.error('submissions listener:', err)
      loadError.value = 'Failed to load missions.'
      isLoading.value = false
    }
  )
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
    const fileRef = storageRef(storage, path)
    await uploadBytes(fileRef, selectedFile.value)
    const downloadURL = await getDownloadURL(fileRef)

    await updateDoc(doc(db, 'submissions', a.submissionId), {
      data:        { url: downloadURL, fileName: selectedFile.value.name },
      status:      'submitted',
      submittedAt: serverTimestamp(),
    })

    const teacherEmail = userInfo.value?.teacherEmail
    const periodId     = userInfo.value?.periodId
    const schoolYearId = userInfo.value?.schoolYearId ?? SCHOOL_YEAR_ID
    if (teacherEmail && periodId) {
      onSubmitted(teacherEmail, periodId, schoolYearId)
        .catch(e => console.warn('[submitFile] periodStats update failed:', e))
    }

    const idx = assignmentViews.value.findIndex(v => v.submissionId === a.submissionId)
    if (idx !== -1) {
      assignmentViews.value[idx] = {
        ...assignmentViews.value[idx],
        data:   { url: downloadURL, fileName: selectedFile.value.name },
        status: 'submitted',
      }
    }
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
    startDashboardListener()
    fetchStats()
    fetchTeacherName()
  }
})

onUnmounted(() => {
  unsubscribeSubmissions?.()
})
</script>

<style scoped>
@import '../assets/styles/classic.css';

/* ── Page layout ── */
.dashboard-layout {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 1.25rem;
  padding: 1.25rem 1.5rem 3rem;
  align-items: start;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

/* Header spans across both columns */
.full-width { grid-column: 1 / -1; }

.col-main    { display: flex; flex-direction: column; gap: 1.25rem; min-width: 0; }
.col-sidebar { display: flex; flex-direction: column; gap: 1.25rem; min-width: 0; }

/* Grade + Typing panels sit side by side */
.top-panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

@media (max-width: 860px) {
  .dashboard-layout { grid-template-columns: 1fr; }
  .top-panels       { grid-template-columns: 1fr; }
}

/* ── Panel shell ── */
.panel {
  background: rgba(0, 20, 45, 0.55);
  border: 1px solid rgba(153, 204, 255, 0.15);
  border-radius: 0.75rem;
  padding: 1.1rem 1.35rem 1.35rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.panel-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #4d99ee;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.panel-sub {
  font-size: 0.72rem;
  color: #6688aa;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-top: 0.2rem;
}

.panel-badge {
  background: #4d99ee;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
  border-radius: 999px;
  min-width: 1.65rem;
  height: 1.65rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.35rem;
  flex-shrink: 0;
}

.panel-badge--danger {
  background: rgba(255, 80, 80, 0.85);
}

.title-danger { color: #ff6e6e !important; }

.queue-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6688aa;
  font-size: 0.88rem;
  letter-spacing: 0.05em;
  padding: 0.25rem 0;
  line-height: 1.5;
}

.queue-clear-icon { color: #69f0ae; font-size: 1rem; font-weight: 700; }

/* ── Cadet header ── */
.cadet-header {
  display: flex; align-items: baseline; justify-content: space-between;
  border-bottom: 0.125rem solid rgba(255,153,0,0.3); padding-bottom: 0.75rem;
  flex-wrap: wrap; gap: 0.5rem;
  /* When full-width, add a little horizontal breathing room to match panel padding */
  padding-left: 0.15rem;
}
.cadet-name    { font-size: 1.8rem; font-weight: bold; color: #ff9900; letter-spacing: 0.05em; }
.cadet-meta    { display: flex; gap: 1rem; align-items: center; }
.cadet-period  { color: #99ccff; font-size: 1rem; letter-spacing: 0.08em; }
.cadet-teacher { color: #69c; font-size: 0.9rem; letter-spacing: 0.06em; }
.cadet-quarter { color: #556; font-size: 0.85rem; letter-spacing: 0.06em; }

/* ── Grade panel ── */
.grade-letter {
  font-size: 2.2rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1;
}

.grade-body { display: flex; flex-direction: column; gap: 0.6rem; }

.grade-row {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.grade-percent {
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.01em;
}

.grade-pts {
  font-size: 0.9rem;
  color: #6688aa;
  letter-spacing: 0.06em;
}

.grade-bar-track {
  width: 100%;
  height: 6px;
  background: rgba(255,255,255,0.07);
  border-radius: 3px;
  overflow: hidden;
}

.grade-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.grade-footer {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.78rem;
  color: #6688aa;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.grade-pending {
  color: #4d99ee;
  background: rgba(77,153,238,0.1);
  border-radius: 3px;
  padding: 0.1rem 0.4rem;
}

/* ── Status messages ── */
.status-msg   { color: #99ccff; font-size: 1rem; text-align: center; padding: 2rem 0; opacity: 0.7; }
.status-error { color: #ff6e6e; font-size: 1rem; text-align: center; padding: 2rem 0; }

/* ── Mission list ── */
.mission-list  { display: flex; flex-direction: column; gap: 0.6rem; }
.past-panel    { opacity: 0.6; }

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

.mission-type-icon            { font-size: 1.5rem; line-height: 1; flex-shrink: 0; margin-top: 0.1rem; }
.mission-type-icon.dim        { opacity: 0.4; }
.mission-body                 { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; }
.mission-title                { font-size: 1.1rem; color: #e6f0ff; font-weight: 500; }
.mission-title.dim            { color: #556; }
.mission-desc                 { font-size: 0.85rem; color: #99ccff; opacity: 0.8; line-height: 1.4; }

.mission-meta { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.2rem; }
.mission-due          { font-size: 0.8rem; font-weight: bold; color: #69f0ae; letter-spacing: 0.04em; }
.mission-due.overdue  { color: #ff6e6e; }
.mission-due.due-soon { color: #ffd740; }
.past-due             { color: #445 !important; }
.mission-quarter      { font-size: 0.75rem; color: #445; letter-spacing: 0.06em; }
.mission-type-label   { font-size: 0.75rem; color: #556; letter-spacing: 0.04em; }

.feedback-note {
  font-size: 0.82rem; color: #99ccff;
  background: rgba(153,204,255,0.07);
  border-left: 0.2rem solid rgba(153,204,255,0.3);
  border-radius: 0 0.25rem 0.25rem 0;
  padding: 0.35rem 0.6rem; margin-top: 0.35rem; line-height: 1.4;
}
.returned-feedback {
  color: #ffe082; background: rgba(255,180,0,0.08);
  border-left-color: rgba(255,180,0,0.5); font-weight: 500;
}

.delivery-link {
  display: block; font-size: 0.8rem; color: #99ccff;
  text-decoration: none; white-space: nowrap;
  border-bottom: 0.0625rem solid rgba(153,204,255,0.3); transition: color 0.15s; text-align: right;
}
.delivery-link:hover { color: #ff9900; border-bottom-color: rgba(255,153,0,0.4); }
.pending-hint { color: #ffb300; font-size: 0.78rem; }

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
.submit-btn:hover    { opacity: 0.85; }
.submit-btn--sm      { font-size: 0.75rem; padding: 0.3rem 0.65rem; }

.resubmit-btn {
  background: transparent; border: 0.0625rem solid rgba(255,153,0,0.35);
  border-radius: 0.4rem; color: rgba(255,153,0,0.7);
  cursor: pointer; font-family: inherit; font-size: 0.75rem;
  font-weight: bold; letter-spacing: 0.05em; padding: 0.25rem 0.6rem;
  transition: all 0.2s; white-space: nowrap;
}
.resubmit-btn:hover { border-color: #ff9900; color: #ff9900; background: rgba(255,153,0,0.08); }

.submission-status {
  display: flex; align-items: center; gap: 0.3rem;
  font-size: 0.8rem; font-weight: bold; letter-spacing: 0.06em;
  padding: 0.25rem 0.6rem; border-radius: 0.3rem;
  text-transform: uppercase; white-space: nowrap;
}
.submitted-status { background: rgba(153,204,255,0.1); border: 0.0625rem solid rgba(153,204,255,0.3); color: #99ccff; }
.graded-status    { background: rgba(105,240,174,0.1); border: 0.0625rem solid rgba(105,240,174,0.3); color: #69f0ae; }
.returned-status  { background: rgba(255,180,0,0.1);   border: 0.0625rem solid rgba(255,180,0,0.4);   color: #ffb300; }

.status-icon  { font-size: 0.9rem; }
.status-label { font-size: 0.75rem; }

.returned-points, .graded-points { font-size: 0.78rem; font-weight: bold; color: #ffd740; letter-spacing: 0.03em; }

.accept-btn {
  background: transparent; border: 0.0625rem solid rgba(255,180,0,0.45);
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

.game-hint      { font-size: 0.75rem; color: #445; letter-spacing: 0.05em; }
.game-hint--sm  { font-size: 0.72rem; }
.missing-label  { font-size: 0.75rem; color: #ff6e6e; letter-spacing: 0.05em; font-weight: bold; }

/* ── Typing panel ── */
.typing-body { display: flex; flex-direction: column; gap: 1rem; }

.tier-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0.45rem 1rem;
  border-radius: 0.4rem;
  border: 1.5px solid;
  align-self: flex-start;
  transition: all 0.3s ease;
}

.typing-stats-row {
  display: flex;
  gap: 0;
  border: 1px solid rgba(153,204,255,0.1);
  border-radius: 0.5rem;
  overflow: hidden;
}

.typing-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.6rem 0.25rem;
  border-right: 1px solid rgba(153,204,255,0.1);
}
.typing-stat:last-child { border-right: none; }

.typing-stat-val {
  font-size: 1.3rem;
  font-weight: 800;
  color: #e6f0ff;
  letter-spacing: 0.02em;
  line-height: 1;
}
.typing-stat-label {
  font-size: 0.62rem;
  color: #6688aa;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.tier-ladder {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tier-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.3rem 0.5rem;
  border-radius: 0.3rem;
  transition: background 0.15s;
}

.tier-row--active {
  background: rgba(255,255,255,0.04);
}

.tier-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background 0.2s;
}

.tier-row-label {
  flex: 1;
  font-size: 0.78rem;
  color: #6688aa;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transition: color 0.2s;
}

.tier-row-wpm {
  font-size: 0.7rem;
  color: #445;
  letter-spacing: 0.04em;
}

/* ── Tier badge clickable state ── */
.tier-badge--clickable {
  cursor: pointer;
  transition: opacity 0.15s;
}
.tier-badge--clickable:hover { opacity: 0.8; }

/* ── Tier modal — mirrors SettingsModal style ── */
.tier-modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.tier-modal-content {
  background: #000;
  border: 0.125rem solid #3366ff;
  border-radius: 2.5rem;
  width: 90%;
  max-width: 28rem;
  overflow: hidden;
  box-shadow: 0 0 2.5rem rgba(51, 102, 255, 0.3);
  font-family: 'Roboto', sans-serif;
}

.tier-modal-header {
  background: #3366ff;
  font-family: 'Antonio', sans-serif;
  display: flex;
  align-items: center;
  height: 3.75rem;
}

.tier-header-deco {
  width: 5rem;
  height: 100%;
  background: #99ccff;
  border-radius: 0 0 2.5rem 0;
  flex-shrink: 0;
}

.tier-modal-header h2 {
  flex: 1;
  margin: 0;
  color: #000;
  font-size: 1.5rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.125rem;
  text-align: center;
}

.tier-close-btn {
  background: #ff9900;
  border: none;
  width: 5rem;
  height: 100%;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 0 0 0 2.5rem;
  flex-shrink: 0;
  transition: background 0.2s;
}
.tier-close-btn:hover { background: #ffcc00; }
.tier-close-btn:hover .tier-close-icon { transform: scale(1.1); }

.tier-close-icon {
  width: 1.875rem;
  height: 1.875rem;
  filter: brightness(0);
  transition: transform 0.2s ease;
}

.tier-modal-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.tier-row-you {
  font-family: 'Antonio', sans-serif;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  color: #99ccff;
  margin-right: auto;
}

.tier-modal-footer {
  display: flex;
  align-items: flex-end;
}

.tier-footer-bar {
  flex: 1;
  height: 1.25rem;
  background: #3366ff;
}

.tier-footer-id {
  background: #3366ff;
  color: #000;
  padding: 0 1.25rem;
  font-size: 0.75rem;
  font-weight: bold;
  height: 1.25rem;
  display: flex;
  align-items: center;
}

/* modal fade transition */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.18s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

/* ── Overdue panel ── */
.overdue-list { display: flex; flex-direction: column; gap: 0.5rem; }

.overdue-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.75rem;
  background: rgba(255, 60, 60, 0.06);
  border: 1px solid rgba(255, 100, 100, 0.2);
  border-radius: 0.4rem;
}

.overdue-icon { font-size: 1.1rem; flex-shrink: 0; }

.overdue-body { flex: 1; min-width: 0; }

.overdue-title {
  font-size: 0.85rem;
  color: #e6f0ff;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.overdue-due {
  font-size: 0.72rem;
  color: #ff6e6e;
  letter-spacing: 0.04em;
  margin-top: 0.1rem;
}

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
.upload-area:hover     { border-color: rgba(153,204,255,0.6); background: rgba(153,204,255,0.04); }
.upload-area.drag-over { border-color: #ff9900; background: rgba(255,153,0,0.06); }
.upload-icon  { font-size: 2.5rem; }
.upload-hint  { color: #99ccff; font-size: 0.9rem; }
.upload-types { color: #556; font-size: 0.75rem; }

.selected-file      { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
.selected-file-name { color: #e6f0ff; font-size: 0.95rem; word-break: break-all; }
.selected-file-size { color: #556; font-size: 0.8rem; }
.clear-file {
  background: transparent; border: 0.0625rem solid rgba(255,110,110,0.4);
  border-radius: 0.25rem; color: #ff6e6e; cursor: pointer; font-size: 0.75rem; padding: 0.2rem 0.6rem;
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
.lcars-btn--ghost { background: transparent; border: 0.125rem solid #99ccff; color: #99ccff; }
</style>
