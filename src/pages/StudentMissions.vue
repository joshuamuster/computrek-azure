<template>
  <section class="missions-page" :class="{ show: isVisible }">

    <div class="lcars-text-bar"><span>Mission Record</span></div>

    <!-- ── Context bar ───────────────────────────────────────────────────────── -->
    <div class="context-bar">
      <span v-if="teacherName" class="ctx-teacher">{{ teacherName }}</span>
      <span class="ctx-sep"> / / </span>
      <span class="ctx-period">{{ periodLabel }}</span>
      <span class="ctx-sep"> / / </span>
      <span class="ctx-quarter">{{ currentQuarterLabel }}</span>
      <span v-if="quarterGrade" class="ctx-grade" :style="{ color: gradeColor(quarterGrade.percent) }">
        &nbsp;· {{ letterGrade(quarterGrade.percent) }} ({{ quarterGrade.percent }}%)
        &nbsp;<span class="ctx-grade-sub">{{ quarterGrade.earned }}/{{ quarterGrade.possible }} pts · {{ quarterGrade.gradedCount }} graded</span>
        <span v-if="pendingGradeCount > 0" class="ctx-pending"> · {{ pendingGradeCount }} pending</span>
      </span>
    </div>

    <!-- ── Loading / error ──────────────────────────────────────────────────── -->
    <div v-if="isLoading" class="status-msg">LOADING MISSION DOSSIERS...</div>
    <div v-else-if="loadError" class="status-error">{{ loadError }}</div>

    <template v-else>

      <!-- ── Active mission board ──────────────────────────────────────────── -->
      <div class="mission-board">

        <!-- ASSIGNED -->
        <div class="mission-col">
          <div class="col-header">
            <span class="col-title">ASSIGNED</span>
          </div>
          <div v-if="assignedMissions.length === 0 && assignmentViews.length === 0" class="col-empty col-empty--clear">
            <div class="col-clear-icon">🖖</div>
            <div>Standing by for orders.</div>
          </div>
          <div v-else-if="assignedMissions.length === 0" class="col-empty col-empty--clear">
            <div class="col-clear-icon">✓</div>
            <div>Mission queue: clear. Outstanding work, Cadet.</div>
          </div>
          <div v-else class="mission-list">
            <div
              v-for="a in assignedMissions"
              :key="a.submissionId"
              class="mission-card"
              :class="{
                'due-soon': effectiveDueDate(a) && isDueSoon(effectiveDueDate(a)!),
                returned:   a.status === 'returned',
                started:    a.status === 'started',
              }"
              @click="detailAssignment = a"
            >
              <div class="mission-type-icon">{{ a.type === 'game' ? '🎮' : '📎' }}</div>
              <div class="mission-body">
                <div class="mission-title">{{ a.title }}</div>
                <div class="mission-meta">
                  <span class="mission-due" :class="{ 'due-soon': effectiveDueDate(a) && isDueSoon(effectiveDueDate(a)!) }">{{ dueDateLabel(a) }}</span>
                </div>
                <div v-if="a.feedbackNote" class="feedback-note returned-feedback">↩ {{ a.feedbackNote }}</div>
              </div>
              <div class="mission-status-area">
                <div v-if="a.status === 'started'" class="submission-status started-status">
                  <span class="status-icon">▶</span><span class="status-label">In Progress</span>
                </div>
                <div v-else-if="a.status === 'returned'" class="submission-status returned-status">
                  <span class="status-icon">↩</span><span class="status-label">Returned</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- OVERDUE -->
        <div class="mission-col mission-col--overdue">
          <div class="col-header" :class="{ 'col-header--danger': overdueActive.length > 0 }">
            <span class="col-title" :class="{ 'title-danger': overdueActive.length > 0 }">OVERDUE</span>
          </div>
          <div v-if="overdueActive.length === 0" class="col-empty col-empty--clear">
            <div class="col-clear-icon">★</div>
            <div>You're all caught up, Cadet!</div>
          </div>
          <div v-else class="mission-list">
            <div
              v-for="a in overdueActive"
              :key="a.submissionId"
              class="mission-card overdue"
              @click="detailAssignment = a"
            >
              <div class="overdue-card-top">
                <div class="mission-type-icon">{{ a.type === 'game' ? '🎮' : '📎' }}</div>
                <div class="mission-body">
                  <div class="mission-title">{{ a.title }}</div>
                  <div class="mission-meta">
                    <span class="mission-due overdue">{{ dueDateLabel(a) }}</span>
                  </div>
                </div>
              </div>
              <div class="mission-status-area">
                <div v-if="a.status === 'started'" class="submission-status started-status">
                  <span class="status-icon">▶</span><span class="status-label">In Progress</span>
                </div>
                <div v-else class="submission-status assigned-status">
                  <span class="status-label">Not Started</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- AWAITING GRADE -->
        <div class="mission-col mission-col--awaiting">
          <div class="col-header">
            <span class="col-title">AWAITING GRADE</span>
          </div>
          <div v-if="awaitingGrade.length === 0 && overdueActive.length === 0" class="col-empty col-empty--clear">
            <div class="col-clear-icon">★</div>
            <div>Nothing in review. Your record is spotless.</div>
          </div>
          <div v-else-if="awaitingGrade.length === 0 && overdueActive.length > 0" class="col-empty col-empty--nudge">
            <div class="col-clear-icon">👀</div>
            <div>Nothing submitted yet. Though your Overdue column has a few opinions about that.</div>
          </div>
          <div v-else class="mission-list awaiting-list">
            <div
              v-for="a in awaitingGrade"
              :key="a.submissionId"
              class="mission-card submitted"
              @click="detailAssignment = a"
            >
              <div class="mission-left-col">
                <div class="mission-type-icon">{{ a.type === 'game' ? '🎮' : '📎' }}</div>
                <span class="submitted-check">✓</span>
              </div>
              <div class="mission-body">
                <div class="mission-title">{{ a.title }}</div>
                <div class="mission-meta">
                  <span class="mission-due" :class="{ overdue: wasSubmittedLate(a) }">{{ dueDateLabel(a) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div><!-- /mission-board -->

      <!-- ── Lost in Space ──────────────────────────────────────────────────── -->
      <div v-if="lostInSpace.length > 0" class="lis-section">
        <div class="lis-toggle-row" @click="lisExpanded = !lisExpanded">
          <span class="lis-icon">🛸</span>
          <span class="lis-title">LOST IN SPACE</span>
          <span class="lis-badge">{{ lostInSpace.length }}</span>
          <span class="lis-sub">Missions past the submission window · contact your teacher for an extension</span>
          <span class="lis-chevron">{{ lisExpanded ? '▲' : '▼' }}</span>
        </div>
        <div v-if="lisExpanded" class="lis-body">
          <div
            v-for="a in lostInSpace"
            :key="a.submissionId"
            class="mission-card lis-card"
            @click="detailAssignment = a"
          >
            <div class="mission-type-icon dim">{{ a.type === 'game' ? '🎮' : '📎' }}</div>
            <div class="mission-body">
              <div class="mission-title dim">{{ a.title }}</div>
              <div class="mission-meta">
                <span class="mission-due past-due">{{ dueDateLabel(a) }}</span>
              </div>
            </div>
            <div class="mission-status-area">
              <div class="submission-status lis-status">
                <span class="status-icon">🛸</span>
                <span class="status-label">Missed</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Mission Log Archive ─────────────────────────────────────────────── -->
      <div class="log-section">
        <div class="log-section-header">
          <span class="log-section-title">MISSION LOG ARCHIVE</span>
          <span v-if="missionLog.length > 0" class="log-section-count">{{ missionLog.length }} graded this quarter</span>
        </div>
        <div v-if="missionLog.length === 0" class="log-empty">
          No graded missions yet this quarter.
        </div>
        <div v-else class="log-list">
          <div
            v-for="a in missionLog"
            :key="a.submissionId"
            class="log-row"
            :class="{ 'log-row--open': expandedLogIds.has(a.submissionId) }"
            @click="toggleLogEntry(a.submissionId)"
          >
            <div class="log-row-summary">
              <span class="log-row-icon">{{ a.type === 'game' ? '🎮' : '📎' }}</span>
              <span class="log-row-title">{{ a.title }}</span>
              <span class="log-row-points" v-if="a.pointsEarned != null">
                {{ a.pointsEarned }}<span v-if="a.pointsPossible"> / {{ a.pointsPossible }}</span> pts
              </span>
              <span class="log-row-chevron">{{ expandedLogIds.has(a.submissionId) ? '▲' : '▼' }}</span>
            </div>
            <div v-if="expandedLogIds.has(a.submissionId)" class="log-row-detail">
              <div v-if="a.feedbackNote" class="log-feedback">
                <span class="log-feedback-label">Teacher Feedback:</span> {{ a.feedbackNote }}
              </div>
              <div v-else class="log-no-feedback">No feedback note left by teacher.</div>
            </div>
          </div>
        </div>
      </div>

    </template>

    <!-- ── File upload modal ────────────────────────────────────────────────── -->
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
        <div v-if="!uploadConfirming" class="modal-actions">
          <button class="lcars-btn lcars-btn--ghost" @click="closeUpload" :disabled="isUploading">CANCEL</button>
          <button class="lcars-btn" :disabled="!selectedFile || isUploading" @click="uploadConfirming = true">SUBMIT REPORT →</button>
        </div>
        <div v-else class="upload-confirm-section">
          <div class="upload-confirm-msg">
            <span class="upload-confirm-icon">📤</span>
            <div>
              <div class="upload-confirm-title">Ready to submit?</div>
              <div class="upload-confirm-detail">
                <strong>{{ selectedFile?.name }}</strong> will be turned in for
                <strong>{{ submittingAssignment?.title }}</strong>.
                This cannot be undone without your teacher's help.
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="lcars-btn lcars-btn--ghost" @click="uploadConfirming = false" :disabled="isUploading">← BACK</button>
            <button class="lcars-btn" :disabled="isUploading" @click="submitFile">
              {{ isUploading ? 'TRANSMITTING...' : '✓ CONFIRM SUBMIT' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Generic confirm modal ────────────────────────────────────────────── -->
    <div v-if="pendingConfirm" class="modal-overlay" @click.self="pendingConfirm = null">
      <div class="modal confirm-action-modal">
        <div class="confirm-action-header">
          <span class="confirm-action-icon">{{ pendingConfirm.danger ? '⚠️' : '📋' }}</span>
          <div>
            <div class="modal-title">{{ pendingConfirm.title }}</div>
            <div class="confirm-action-body">{{ pendingConfirm.body }}</div>
          </div>
          <button class="detail-close-btn" @click="pendingConfirm = null">✕</button>
        </div>
        <div class="modal-actions">
          <button class="lcars-btn lcars-btn--ghost" @click="pendingConfirm = null">CANCEL</button>
          <button
            class="lcars-btn"
            :class="{ 'lcars-btn--danger': pendingConfirm.danger }"
            :disabled="!!pendingConfirm.busy"
            @click="pendingConfirm.action()"
          >{{ pendingConfirm.confirmLabel }}</button>
        </div>
      </div>
    </div>

  </section>

  <!-- ── Mission detail panel ─────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="panel-backdrop">
      <div v-if="detailAssignment" class="detail-panel-backdrop" @click="detailAssignment = null" />
    </Transition>
    <Transition name="panel-slide">
      <div v-if="detailAssignment" class="detail-panel" role="dialog" aria-modal="true">
        <div class="detail-panel-head">
          <div class="detail-panel-head-text">
            <div class="detail-panel-title">{{ detailAssignment.title }}</div>
            <div class="detail-meta">
              <span class="mission-due"
                :class="{
                  overdue:    effectiveDueDate(detailAssignment) && isOverdue(effectiveDueDate(detailAssignment)!),
                  'due-soon': effectiveDueDate(detailAssignment) && isDueSoon(effectiveDueDate(detailAssignment)!),
                }"
              >{{ dueDateLabel(detailAssignment) }}</span>
              <span class="detail-points">{{ detailAssignment.pointsPossible }} pts</span>
            </div>
          </div>
          <button class="detail-close-btn" @click="detailAssignment = null">✕</button>
        </div>
        <div class="detail-panel-body">
          <div
            v-if="detailGameInfo && !isLockedOut(detailAssignment) && !(isMultiGameMission && detailAssignment?.status === 'submitted')"
            class="game-logo-link game-logo-btn"
            :class="{ 'game-logo-btn--loading': isStarting === detailAssignment?.submissionId }"
            @click="launchGameMission(detailAssignment)"
            role="button"
            tabindex="0"
            @keydown.enter="launchGameMission(detailAssignment)"
          >
            <img :src="detailGameInfo.logo" class="game-logo-img" alt="Game logo" />
            <span class="game-logo-tap-hint">
              {{ isStarting === detailAssignment?.submissionId ? 'STARTING…'
               : detailAssignment?.status === 'assigned'    ? '▶ TAP TO PLAY'
               : detailAssignment?.status === 'started'     ? (isMultiGameMission ? '▶ PLAY NEXT ROUND' : '▶ CONTINUE PLAYING')
               : detailAssignment?.status === 'returned'    ? '▶ REPLAY'
               : '▶ PLAY AGAIN' }}
            </span>
          </div>
          <div v-if="detailAssignment.description" class="detail-description" v-html="detailAssignment.description"></div>
          <div v-if="detailAssignment.deliveryItems?.length" class="detail-items">
            <div class="detail-items-label">MATERIALS</div>
            <template v-for="(item, i) in detailAssignment.deliveryItems" :key="i">
              <a v-if="item.kind === 'pdf' && item.url" :href="item.url" target="_blank" class="delivery-link">📄 {{ item.name || 'Download PDF' }} ↗</a>
              <a v-if="item.kind === 'link' && item.url" :href="item.url" target="_blank" class="delivery-link">🔗 {{ item.label || 'Open Link' }} ↗</a>
              <span v-if="item.kind === 'paper'" class="game-hint">📋 Get handout from teacher</span>
            </template>
          </div>
          <div v-if="detailAssignment.feedbackNote" class="feedback-note"
            :class="{ 'returned-feedback': detailAssignment.status === 'returned' }">
            {{ detailAssignment.status === 'returned' ? '↩' : '💬' }} {{ detailAssignment.feedbackNote }}
          </div>
          <!-- ── Multi-game progress panel ──────────────────────────────── -->
          <div
            v-if="isMultiGameMission"
            class="multi-game-panel"
            :class="detailAssignment.status === 'submitted' ? 'multi-game-panel--done' : 'multi-game-panel--active'"
          >
            <div class="multi-game-header">
              <span class="multi-game-title">
                {{ detailAssignment.status === 'submitted' ? '✅ All Rounds Complete!' : '⬡ MISSION PROGRESS' }}
              </span>
              <span class="multi-game-count">
                {{ detailAssignment.gamesCompleted ?? 0 }} / {{ detailAssignment.repeatCount }} rounds
              </span>
            </div>
            <div class="multi-game-boxes">
              <span
                v-for="(done, i) in multiGameBoxes"
                :key="i"
                class="multi-game-box"
                :class="done ? 'multi-game-box--done' : 'multi-game-box--open'"
              >{{ done ? '✓' : '' }}</span>
            </div>
            <div v-if="detailAssignment.data?.score != null" class="multi-game-best">
              Best score: <strong>{{ detailAssignment.data.score }}</strong>
            </div>
          </div>

          <!-- ── Single-game result panel ────────────────────────────────── -->
          <div
            v-else-if="(detailAssignment.type === 'game' || detailAssignment.deliveryItems?.some(i => i.kind === 'game')) && (detailAssignment.status === 'started' || detailAssignment.status === 'submitted' || detailAssignment.data?.score != null)"
            class="game-result-panel"
            :class="detailAssignment.data?.score != null ? 'game-result-panel--played' : 'game-result-panel--waiting'"
          >
            <template v-if="detailAssignment.data?.score != null">
              <span class="game-result-icon">
                {{ detailAssignment.data?.result === 'win' ? '🏆' : detailAssignment.data?.result === 'draw' ? '🤝' : '🎮' }}
              </span>
              <div class="game-result-body">
                <div class="game-result-title">
                  {{ detailAssignment.data?.result === 'win' ? 'Victory Recorded'
                   : detailAssignment.data?.result === 'draw' ? 'Draw Recorded'
                   : detailAssignment.data?.result === 'loss' ? 'Session Recorded'
                   : (detailAssignment.status === 'started' ? 'Session Recorded' : 'Best Score') }}
                </div>
                <div class="game-result-score">Score: <strong>{{ detailAssignment.data.score }}</strong></div>
              </div>
            </template>
            <template v-else>
              <span class="game-result-icon">⏳</span>
              <div class="game-result-body">
                <div class="game-result-title">Not Played Yet</div>
                <div class="game-result-detail">Play the game first — your result will appear here before you submit.</div>
              </div>
            </template>
          </div>
        </div>
        <div class="detail-panel-foot">
          <button class="lcars-btn lcars-btn--ghost" @click="detailAssignment = null">CLOSE</button>
          <span v-if="isLockedOut(detailAssignment)" class="lis-locked-msg">🔒 Submission window closed — ask your teacher for an extension</span>
          <template v-else-if="detailAssignment.status === 'assigned'">
            <!-- File-upload missions still need an explicit UPLOAD button -->
            <button
              v-if="detailAssignment.deliveryItems?.some(i => i.submissionMethod === 'file-upload') || (!detailAssignment.deliveryItems?.length && detailAssignment.type === 'file')"
              class="lcars-btn"
              @click="openFileSubmit(detailAssignment); detailAssignment = null"
            >UPLOAD</button>
            <!-- Game missions: ▶ START removed — the logo tap handles it -->
          </template>
          <template v-else-if="detailAssignment.status === 'started'">
            <!-- Game missions auto-submit on play; no manual SUBMIT needed.
                 Non-game started missions (edge case) still get the button. -->
            <button
              v-if="!detailGameInfo"
              class="lcars-btn"
              :disabled="isSubmitting === detailAssignment.submissionId"
              @click="openSubmitConfirm(detailAssignment)"
            >{{ isSubmitting === detailAssignment.submissionId ? '...' : 'SUBMIT' }}</button>
          </template>
          <template v-else-if="detailAssignment.status === 'submitted'">
            <button
              v-if="detailAssignment.deliveryItems?.some(i => i.submissionMethod === 'file-upload') || (!detailAssignment.deliveryItems?.length && detailAssignment.type === 'file')"
              class="lcars-btn"
              @click="openFileSubmit(detailAssignment); detailAssignment = null"
            >RE-UPLOAD</button>
            <button
              class="lcars-btn lcars-btn--ghost"
              :disabled="isRetracting === detailAssignment.submissionId"
              @click="openRetractConfirm(detailAssignment)"
            >{{ isRetracting === detailAssignment.submissionId ? '...' : 'RETRACT' }}</button>
          </template>
          <template v-else-if="detailAssignment.status === 'returned'">
            <button
              v-if="detailAssignment.deliveryItems?.some(i => i.submissionMethod === 'file-upload') || (!detailAssignment.deliveryItems?.length && detailAssignment.type === 'file')"
              class="lcars-btn"
              @click="openFileSubmit(detailAssignment); detailAssignment = null"
            >RE-SUBMIT</button>
            <!-- Game missions: ▶ REPLAY removed — the logo tap handles it -->
            <button
              v-if="detailAssignment.pointsEarned != null"
              class="lcars-btn lcars-btn--ghost"
              :disabled="isAccepting === detailAssignment.submissionId"
              @click="acceptGradeHandler(detailAssignment)"
            >{{ isAccepting === detailAssignment.submissionId ? '...' : 'ACCEPT GRADE' }}</button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db, storage } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { useAssignments } from '@/composables/useAssignments'
import { useMissions } from '@/composables/useMissions'
import { useSubmissions } from '@/composables/useSubmissions'
import { PERIOD_IDS, QUARTERS, SCHOOL_YEAR_ID } from '@/config/schoolYear'
import type { Submission, SubmissionData, ComponentCheck } from '@/composables/useSubmissions'
import type { DeliveryItem } from '@/composables/useMissions'
import { onSubmitted } from '@/composables/useMissionStatsWriter'
import type { StatsCtx } from '@/composables/useSubmissions'

import logoChess       from '@/assets/images/games/title-chess.svg'
import logoPicard      from '@/assets/images/games/title-picardmaneuver.svg'
import logoMutara      from '@/assets/images/games/title-battlemutaranebula.svg'
import logoRules       from '@/assets/images/games/title-rulesofacquisition.svg'
import logoIsolinear   from '@/assets/images/games/title-isolinearcascade.svg'
import logoMinesweeper from '@/assets/images/games/title-minesweeper.svg'
import logoWarp        from '@/assets/images/games/title-warpcorebreach.svg'
import logoShuttle     from '@/assets/images/games/title-shuttlebay.svg'
import logoOrbital     from '@/assets/images/games/title-fracturedfrontier.svg'

const GAME_INFO: Record<string, { logo: string; route: string }> = {
  chess:                  { logo: logoChess,       route: '/games/chess' },
  picard_maneuver:        { logo: logoPicard,       route: '/games/picard-maneuver' },
  battle_mutara_nebula:   { logo: logoMutara,       route: '/games/battle-of-the-mutara-nebula' },
  rules_of_acquisition:   { logo: logoRules,        route: '/games/rules-of-acquisition' },
  fractured_frontier:     { logo: logoOrbital,      route: '/games/fractured-frontier' },
  isolinear_easy:         { logo: logoIsolinear,    route: '/games/isolinear-cascade' },
  isolinear_medium:       { logo: logoIsolinear,    route: '/games/isolinear-cascade' },
  isolinear_hard:         { logo: logoIsolinear,    route: '/games/isolinear-cascade' },
  minesweeper_cadet:      { logo: logoMinesweeper,  route: '/games/minesweeper' },
  minesweeper_standard:   { logo: logoMinesweeper,  route: '/games/minesweeper' },
  'minesweeper_red-alert':{ logo: logoMinesweeper,  route: '/games/minesweeper' },
  warp_easy:              { logo: logoWarp,          route: '/games/warp-core-breach' },
  warp_medium:            { logo: logoWarp,          route: '/games/warp-core-breach' },
  warp_hard:              { logo: logoWarp,          route: '/games/warp-core-breach' },
  shuttle_bay:            { logo: logoShuttle,       route: '/games/shuttle-bay' },
}

const router = useRouter()
const { userInfo } = useAuth()
const { fetchAssignmentsByIds } = useAssignments()
const { fetchMissionsByIds }    = useMissions()
const { acceptGrade }           = useSubmissions()

// ── Merged view type ──────────────────────────────────────────────────────────

interface AssignmentView {
  submissionId:    string
  assignmentId:    string
  missionId:       string
  status:          'assigned' | 'started' | 'submitted' | 'graded' | 'returned'
  submittedAt:     any
  feedbackNote:    string
  pointsEarned:    number | null
  data:            SubmissionData
  dueDateOverride: string | null
  componentChecks: Record<string, ComponentCheck> | null
  dueDate:         string | null
  quarterId:       string | null
  title:           string
  summary:         string
  description:     string
  type:            'file' | 'game' | 'manual'
  deliveryItems:   DeliveryItem[]
  pointsPossible:  number
  gameId:          string | null  // top-level field on the submission doc (set at fan-out or start time)
  gameVariant:     string | null  // optional variant requirement (e.g. 'horde' for Chess)
  repeatCount:     number | null  // multi-game missions: total plays required (null = single-play)
  gamesCompleted:  number | null  // multi-game missions: plays logged so far
}

// ── State ─────────────────────────────────────────────────────────────────────

const assignmentViews = ref<AssignmentView[]>([])
const isLoading       = ref(false)
const loadError       = ref('')
const isVisible       = ref(false)
const lisExpanded     = ref(false)
const teacherName     = ref<string | null>(null)

// ── Period / quarter ──────────────────────────────────────────────────────────

const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

const periodLabel = computed(() => {
  const pid = userInfo.value?.periodId
  return PERIOD_IDS.find(p => p.id === pid)?.label ?? pid ?? '—'
})

const currentQuarterLabel = computed(() =>
  QUARTERS.find(q => todayIso >= q.start && todayIso <= q.end)?.label ?? ''
)

const currentQuarterId = computed(() =>
  QUARTERS.find(q => todayIso >= q.start && todayIso <= q.end)?.id ?? null
)

// ── Grade ─────────────────────────────────────────────────────────────────────

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
  return { earned, possible, percent: Math.round((earned / possible) * 100), gradedCount: graded.length }
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

// ── Mission board computed columns ────────────────────────────────────────────

const MISSED_DAYS = 7

function effectiveDueDate(a: AssignmentView): string | null {
  return a.dueDateOverride ?? a.dueDate
}

function daysLate(iso: string): number {
  return Math.floor((new Date(todayIso).getTime() - new Date(iso).getTime()) / 86400000)
}

function isOverdue(iso: string): boolean  { return iso < todayIso }
function isDueSoon(iso: string): boolean  {
  return !isOverdue(iso) && Math.ceil((new Date(iso).getTime() - new Date(todayIso).getTime()) / 86400000) <= 3
}

const assignedMissions = computed(() =>
  assignmentViews.value.filter(a => {
    if (!['assigned', 'started', 'returned'].includes(a.status)) return false
    if (a.status === 'returned') return true
    const due = effectiveDueDate(a)
    return !due || due >= todayIso
  })
)

const awaitingGrade = computed(() =>
  assignmentViews.value.filter(a => a.status === 'submitted')
)

const overdueActive = computed(() =>
  assignmentViews.value.filter(a => {
    if (!['assigned', 'started'].includes(a.status)) return false
    const due = effectiveDueDate(a)
    if (!due || due >= todayIso) return false
    return daysLate(due) <= MISSED_DAYS
  })
)

const lostInSpace = computed(() =>
  assignmentViews.value.filter(a => {
    if (!['assigned', 'started'].includes(a.status)) return false
    const due = effectiveDueDate(a)
    if (!due || due >= todayIso) return false
    return daysLate(due) > MISSED_DAYS
  })
)

const isLockedOut = (a: AssignmentView) =>
  lostInSpace.value.some(m => m.submissionId === a.submissionId)

const missionLog = computed(() =>
  assignmentViews.value.filter(a =>
    a.status === 'graded' && a.quarterId === currentQuarterId.value
  )
)

// ── Log expand/collapse ───────────────────────────────────────────────────────

const expandedLogIds = ref(new Set<string>())

function toggleLogEntry(id: string) {
  const next = new Set(expandedLogIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedLogIds.value = next
}

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

function wasSubmittedLate(a: AssignmentView): boolean {
  const due = effectiveDueDate(a)
  if (!due || !a.submittedAt) return false
  const submittedDate = a.submittedAt.toDate ? a.submittedAt.toDate() : new Date(a.submittedAt)
  return submittedDate.toISOString().slice(0, 10) > due
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)    return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ── Data loading ──────────────────────────────────────────────────────────────

const assignmentCache = new Map<string, any>()
const missionCache    = new Map<string, any>()
let unsubscribeSubmissions: (() => void) | null = null

async function buildViewsFromSubs(subs: Submission[]) {
  if (!subs.length) { assignmentViews.value = []; return }

  const newAssignmentIds = [...new Set(subs.map(s => s.assignmentId))].filter(id => !assignmentCache.has(id))
  if (newAssignmentIds.length) {
    const docs = await fetchAssignmentsByIds(newAssignmentIds)
    docs.forEach(a => assignmentCache.set(a.id, a))
  }

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
        summary:         (mission as any).summary ?? '',
        description:     mission.description,
        type:            mission.type,
        deliveryItems:   mission.deliveryItems ?? [],
        pointsPossible:  mission.pointsPossible,
        gameId:          (sub as any).gameId          ?? null,
        gameVariant:     (sub as any).gameVariant    ?? null,
        repeatCount:     (sub as any).repeatCount    ?? null,
        gamesCompleted:  (sub as any).gamesCompleted ?? null,
      } as AssignmentView
    })
    .filter((v): v is AssignmentView => v !== null)

  if (detailAssignment.value) {
    const fresh = assignmentViews.value.find(v => v.submissionId === detailAssignment.value!.submissionId)
    if (fresh) detailAssignment.value = fresh
  }
}

function startListener() {
  const uid = userInfo.value?.uid
  if (!uid) return
  isLoading.value = true
  loadError.value = ''
  unsubscribeSubmissions = onSnapshot(
    query(collection(db, 'submissions'), where('studentId', '==', uid), where('schoolYearId', '==', SCHOOL_YEAR_ID)),
    async snap => {
      try {
        const subs: Submission[] = snap.docs.map(d => ({ id: d.id, feedbackNote: '', dueDateOverride: null, ...d.data() } as Submission))
        await buildViewsFromSubs(subs)
      } catch (e: any) {
        console.error('loadMissions:', e)
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

async function fetchTeacherName() {
  const email = userInfo.value?.teacherEmail
  if (!email) return
  const snap = await getDoc(doc(db, 'approvedUsers', email))
  if (snap.exists()) teacherName.value = snap.data().displayName ?? null
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

// ── Confirm modal ─────────────────────────────────────────────────────────────

interface PendingConfirm {
  title: string; body: string; confirmLabel: string; danger: boolean; busy?: boolean; action: () => void
}
const pendingConfirm = ref<PendingConfirm | null>(null)

// ── Game mission actions ───────────────────────────────────────────────────────

const isStarting   = ref<string | null>(null)
const isSubmitting = ref<string | null>(null)
const isRetracting = ref<string | null>(null)

async function startGameMission(a: AssignmentView) {
  isStarting.value = a.submissionId
  try {
    // Resolve gameId: prefer the delivery item, fall back to the field already on the
    // submission doc (a.gameId), which covers old-format missions and re-launches.
    const resolvedGameId = a.deliveryItems?.find(i => i.kind === 'game' && i.gameId)?.gameId
                        ?? a.gameId
                        ?? null
    const patch: Record<string, any> = { status: 'started' }
    if (resolvedGameId) patch.gameId = resolvedGameId
    await updateDoc(doc(db, 'submissions', a.submissionId), patch)
    const idx = assignmentViews.value.findIndex(v => v.submissionId === a.submissionId)
    if (idx !== -1) {
      assignmentViews.value[idx] = { ...assignmentViews.value[idx], status: 'started' }
      assignmentViews.value = [...assignmentViews.value]
    }
    if (detailAssignment.value?.submissionId === a.submissionId) {
      detailAssignment.value = { ...detailAssignment.value, status: 'started' }
    }
  } catch (e) { console.error('startGameMission error:', e) }
  finally { isStarting.value = null }
}

async function replayGameMission(a: AssignmentView) {
  isStarting.value = a.submissionId
  try {
    await updateDoc(doc(db, 'submissions', a.submissionId), { status: 'assigned', data: {} })
    const idx = assignmentViews.value.findIndex(v => v.submissionId === a.submissionId)
    if (idx !== -1) {
      assignmentViews.value[idx] = { ...assignmentViews.value[idx], status: 'assigned', data: {} as any }
      assignmentViews.value = [...assignmentViews.value]
    }
    if (detailAssignment.value?.submissionId === a.submissionId) {
      detailAssignment.value = { ...detailAssignment.value, status: 'assigned' }
    }
  } catch (e) { console.error('replayGameMission error:', e) }
  finally { isStarting.value = null }
}

/**
 * Called when the student taps the game logo in the detail panel.
 * - assigned  → starts tracking (sets status → started) then navigates
 * - started   → navigates immediately (tracking already active)
 * - returned  → resets submission (and gamesCompleted for multi-game) then navigates
 * - submitted → navigates for single-game; blocked for multi-game (all done)
 */
async function launchGameMission(a: AssignmentView | null) {
  if (!a || !detailGameInfo.value || isStarting.value === a.submissionId) return

  const isMultiGame = (a.repeatCount ?? 1) > 1

  if (a.status === 'assigned') {
    await startGameMission(a)
  } else if (a.status === 'returned') {
    // Reset submission to started. For multi-game also reset the play counter.
    isStarting.value = a.submissionId
    try {
      const resolvedGameId = a.deliveryItems?.find(i => i.kind === 'game' && i.gameId)?.gameId
                          ?? a.gameId
                          ?? null
      const patch: Record<string, any> = { status: 'started', data: {} }
      if (resolvedGameId) patch.gameId = resolvedGameId
      if (isMultiGame) patch.gamesCompleted = 0
      await updateDoc(doc(db, 'submissions', a.submissionId), patch)
      const idx = assignmentViews.value.findIndex(v => v.submissionId === a.submissionId)
      if (idx !== -1) {
        assignmentViews.value[idx] = {
          ...assignmentViews.value[idx],
          status: 'started', data: {} as any,
          ...(isMultiGame ? { gamesCompleted: 0 } : {}),
        }
        assignmentViews.value = [...assignmentViews.value]
      }
    } catch (e) { console.error('launchGameMission error:', e) }
    finally { isStarting.value = null }
  } else if (a.status === 'submitted' && isMultiGame) {
    // Multi-game mission fully complete — don't navigate, the UI shows it as done.
    return
  }

  // If the mission requires a specific game variant (e.g. Horde for Chess), pass it
  // as a query param so the game landing page can pre-select and lock that variant.
  const destination = a.gameVariant
    ? `${detailGameInfo.value.route}?missionVariant=${encodeURIComponent(a.gameVariant)}`
    : detailGameInfo.value.route
  router.push(destination)
}

async function submitGameMission(a: AssignmentView) {
  if (!userInfo.value) return
  isSubmitting.value = a.submissionId
  try {
    await updateDoc(doc(db, 'submissions', a.submissionId), { status: 'submitted', submittedAt: serverTimestamp() })
    const effectiveDue = a.dueDateOverride ?? a.dueDate
    const isOnTime = effectiveDue ? todayIso <= effectiveDue : false
    const { teacherEmail, periodId, schoolYearId } = userInfo.value as any
    if (teacherEmail && periodId) {
      onSubmitted(teacherEmail, periodId, schoolYearId ?? SCHOOL_YEAR_ID, isOnTime)
        .catch(e => console.warn('[submitGameMission] periodStats update failed:', e))
    }
    const idx = assignmentViews.value.findIndex(v => v.submissionId === a.submissionId)
    if (idx !== -1) {
      assignmentViews.value[idx] = { ...assignmentViews.value[idx], status: 'submitted' }
      assignmentViews.value = [...assignmentViews.value]
    }
    if (detailAssignment.value?.submissionId === a.submissionId) {
      detailAssignment.value = { ...detailAssignment.value, status: 'submitted' }
    }
  } catch (e) { console.error('submitGameMission error:', e) }
  finally { isSubmitting.value = null }
}

function openSubmitConfirm(a: AssignmentView) {
  detailAssignment.value = null
  pendingConfirm.value = {
    title: 'SUBMIT MISSION', body: `Submit "${a.title}"? Your teacher will be notified.`,
    confirmLabel: '✓ SUBMIT', danger: false,
    action() { pendingConfirm.value = null; submitGameMission(a) },
  }
}

function openRetractConfirm(a: AssignmentView) {
  detailAssignment.value = null
  pendingConfirm.value = {
    title: 'RETRACT SUBMISSION',
    body: `Take back your submission for "${a.title}"? It will return to your active missions so you can edit and resubmit.`,
    confirmLabel: 'RETRACT', danger: true,
    action() { pendingConfirm.value = null; retractSubmission(a) },
  }
}

async function retractSubmission(a: AssignmentView) {
  isRetracting.value = a.submissionId
  try {
    await updateDoc(doc(db, 'submissions', a.submissionId), { status: 'assigned', submittedAt: null })
    const idx = assignmentViews.value.findIndex(v => v.submissionId === a.submissionId)
    if (idx !== -1) {
      assignmentViews.value[idx] = { ...assignmentViews.value[idx], status: 'assigned', submittedAt: null }
      assignmentViews.value = [...assignmentViews.value]
    }
    if (detailAssignment.value?.submissionId === a.submissionId) detailAssignment.value = null
  } catch (e) { console.error('retractSubmission error:', e) }
  finally { isRetracting.value = null }
}

// ── Detail panel ──────────────────────────────────────────────────────────────

const detailAssignment = ref<AssignmentView | null>(null)

const detailGameInfo = computed(() => {
  const a = detailAssignment.value
  if (!a) return null
  // Prefer the deliveryItems game entry (new Mission Library format).
  // Fall back to the gameId stamped directly on the submission doc (old-style missions
  // where deliveryItems is empty but gameId was set at fan-out or start time).
  const gameId = a.deliveryItems?.find(i => i.kind === 'game' && i.gameId)?.gameId
               ?? a.gameId
               ?? null
  return gameId ? (GAME_INFO[gameId] ?? null) : null
})

// ── Multi-game progress helpers ───────────────────────────────────────────────

/** True when the detail assignment is a multi-game mission (repeatCount > 1). */
const isMultiGameMission = computed(() => (detailAssignment.value?.repeatCount ?? 1) > 1)

/**
 * Array of booleans for the checkbox row: index < gamesCompleted = true (done).
 * E.g. repeatCount=5, gamesCompleted=2 → [true, true, false, false, false]
 */
const multiGameBoxes = computed((): boolean[] => {
  const a = detailAssignment.value
  if (!a || !isMultiGameMission.value) return []
  const total     = a.repeatCount    ?? 1
  const completed = a.gamesCompleted ?? 0
  return Array.from({ length: total }, (_, i) => i < completed)
})

// ── File upload ───────────────────────────────────────────────────────────────

const submittingAssignment = ref<AssignmentView | null>(null)
const selectedFile         = ref<File | null>(null)
const isDraggingFile       = ref(false)
const isUploading          = ref(false)
const uploadConfirming     = ref(false)
const uploadError          = ref('')
const fileInput            = ref<HTMLInputElement | null>(null)
const MAX_FILE_SIZE        = 10 * 1024 * 1024

function openFileSubmit(a: AssignmentView) {
  submittingAssignment.value = a; selectedFile.value = null; uploadError.value = ''
}
function closeUpload() {
  submittingAssignment.value = null; selectedFile.value = null
  uploadError.value = ''; uploadConfirming.value = false
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
  uploadError.value = ''; uploadConfirming.value = false
  if (file.size > MAX_FILE_SIZE) { uploadError.value = 'File is too large. Maximum size is 10 MB.'; return }
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowed.includes(file.type)) { uploadError.value = 'Please upload a PDF or image file.'; return }
  selectedFile.value = file
}

async function submitFile() {
  if (!selectedFile.value || !submittingAssignment.value || !userInfo.value) return
  isUploading.value = true; uploadError.value = ''
  const a   = submittingAssignment.value
  const uid = userInfo.value.uid
  const ext = selectedFile.value.name.split('.').pop()
  const path = `submissions/${SCHOOL_YEAR_ID}/${uid}/${a.assignmentId}.${ext}`
  try {
    const fileRef = storageRef(storage, path)
    await uploadBytes(fileRef, selectedFile.value)
    const downloadURL = await getDownloadURL(fileRef)
    await updateDoc(doc(db, 'submissions', a.submissionId), {
      data: { url: downloadURL, fileName: selectedFile.value.name },
      status: 'submitted', submittedAt: serverTimestamp(),
    })
    const effectiveDue  = a.dueDateOverride ?? a.dueDate
    const isOnTime      = effectiveDue ? todayIso <= effectiveDue : false
    const { teacherEmail, periodId, schoolYearId } = userInfo.value as any
    if (teacherEmail && periodId) {
      onSubmitted(teacherEmail, periodId, schoolYearId ?? SCHOOL_YEAR_ID, isOnTime)
        .catch(e => console.warn('[submitFile] periodStats update failed:', e))
    }
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
  requestAnimationFrame(() => { isVisible.value = true })
  if (userInfo.value?.uid) {
    startListener()
    fetchTeacherName()
  }
})

onUnmounted(() => { unsubscribeSubmissions?.() })
</script>

<style scoped>
@import '../assets/styles/classic.css';

.missions-page {
  opacity: 0; transition: opacity 0.3s ease;
  padding: 0 1.5rem 3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}
.missions-page.show { opacity: 1; }

/* ── Context bar ── */
.context-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem;
  font-size: 1rem; padding: 0 0.25rem;
}
.ctx-teacher { color: #ff9900; letter-spacing: 0.06em; }
.ctx-period  { color: #99ccff; letter-spacing: 0.08em; }
.ctx-quarter { color: #777;    letter-spacing: 0.06em; }
.ctx-sep     { color: #444;    letter-spacing: 0.06em; }
.ctx-grade   { letter-spacing: 0.04em; font-weight: 600; }
.ctx-grade-sub { font-size: 0.78rem; opacity: 0.65; font-weight: 400; }
.ctx-pending { color: #ffb300; }

/* ── Status ── */
.status-msg   { color: #99ccff; font-size: 1rem; text-align: center; padding: 2rem 0; opacity: 0.7; }
.status-error { color: #ff6e6e; font-size: 1rem; text-align: center; padding: 2rem 0; }

/* ── Mission board ── */
.mission-board {
  display: grid;
  grid-template-columns: 5fr 3fr;
  gap: 1rem;
  align-items: start;
}

.mission-col--awaiting {
  grid-column: 1 / -1;
}

.awaiting-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
}

.mission-col {
  background: rgba(0, 20, 45, 0.45);
  border: 1px solid rgba(153, 204, 255, 0.12);
  border-radius: 0.65rem;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.col-header {
  align-items: center;
  background: rgba(77,153,238,0.5);
  border-bottom: 1px solid rgba(153, 204, 255, 0.1);
  border-radius: 0.65rem 0.65rem 0 0;
  display: flex;
  gap: 0.5rem;
  padding: 0.7rem 1rem 0.6rem;
}
.col-header--danger { border-bottom-color: rgba(255, 100, 100, 0.25); }

.col-title {
  color: #4d99ee; font-size: 1.55rem; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase; flex: 1;
}
.title-danger { color: #ff6e6e !important; }

.col-empty {
  padding: 1.5rem 1rem; font-size: 0.82rem; color: #556;
  letter-spacing: 0.04em; text-align: center;
}
.col-empty--clear { color: #69f0ae; display: flex; flex-direction: column; align-items: center; gap: 0.35rem; }
.col-empty--nudge { color: #ffb300; display: flex; flex-direction: column; align-items: center; gap: 0.35rem; }
.col-clear-icon { font-size: 1.3rem; }

.mission-col .mission-list { padding: 0.5rem 0.6rem; display: flex; flex-direction: column; gap: 0.5rem; }
.mission-col .mission-card { padding: 0.65rem 0.75rem; }

/* ── Mission cards ── */
.mission-list  { display: flex; flex-direction: column; gap: 0.6rem; }
.mission-card {
  display: flex; align-items: flex-start; gap: 1rem;
  background: rgba(0,30,60,0.5); border: 0.125rem solid rgba(153,204,255,0.15);
  border-radius: 0.5rem; padding: 0.85rem 1rem; transition: border-color 0.15s; cursor: pointer;
}
.mission-card:hover           { border-color: rgba(153,204,255,0.3); }
.mission-card.overdue         { border-color: rgba(255,100,100,0.4); background: rgba(80,0,0,0.3); flex-direction: column; gap: 0.5rem; }
.overdue-card-top             { display: flex; align-items: flex-start; gap: 1rem; width: 100%; }
.mission-card.due-soon        { border-color: rgba(255,200,0,0.4); }
.mission-card.started         { border-color: rgba(105,240,174,0.3); }
.mission-card.submitted       { border-color: rgba(153,204,255,0.35); }
.mission-card.returned        { border-color: rgba(255,180,0,0.5); background: rgba(60,40,0,0.35); }

.mission-type-icon   { font-size: 1.5rem; line-height: 1; flex-shrink: 0; margin-top: 0.1rem; }
.mission-type-icon.dim { opacity: 0.4; }
.mission-left-col    { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; gap: 0.2rem; }
.submitted-check     { font-size: 0.8rem; font-weight: bold; color: #99ccff; line-height: 1; }
.mission-body        { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; }
.mission-title       { font-size: 1.1rem; color: #e6f0ff; font-weight: 500; }
.mission-title.dim   { color: #556; }
.mission-card:hover .mission-title { color: #cce0ff; }

.mission-meta  { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.2rem; }
.mission-due   { font-size: 0.8rem; font-weight: bold; color: #69f0ae; letter-spacing: 0.04em; }
.mission-due.overdue  { color: #ff6e6e; }
.mission-due.due-soon { color: #ffd740; }
.past-due { color: #445 !important; }

.feedback-note {
  font-size: 0.82rem; color: #99ccff;
  background: rgba(153,204,255,0.07);
  border-left: 0.2rem solid rgba(153,204,255,0.3);
  border-radius: 0 0.25rem 0.25rem 0;
  padding: 0.35rem 0.6rem; margin-top: 0.35rem; line-height: 1.4;
}
.returned-feedback { color: #ffe082; background: rgba(255,180,0,0.08); border-left-color: rgba(255,180,0,0.5); font-weight: 500; }

.mission-status-area { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 0.35rem; }
.mission-card.overdue .mission-status-area { align-items: flex-start; }

.submission-status {
  display: flex; align-items: center; gap: 0.3rem;
  font-size: 0.8rem; font-weight: bold; letter-spacing: 0.06em;
  padding: 0.25rem 0.6rem; border-radius: 0.3rem;
  text-transform: uppercase; white-space: nowrap;
}
.assigned-status { background: rgba(153,204,255,0.04); border: 0.0625rem solid rgba(153,204,255,0.15); color: #556; }
.started-status  { background: rgba(105,240,174,0.08); border: 0.0625rem solid rgba(105,240,174,0.3); color: #69f0ae; }
.returned-status { background: rgba(255,180,0,0.1);   border: 0.0625rem solid rgba(255,180,0,0.4);   color: #ffb300; }
.lis-status      { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); color: #445; }
.status-icon  { font-size: 0.9rem; }
.status-label { font-size: 0.75rem; }

/* ── Lost in Space ── */
.lis-section {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 0.65rem; overflow: hidden;
}
.lis-toggle-row {
  display: flex; align-items: center; gap: 0.65rem;
  padding: 0.75rem 1.1rem; cursor: pointer; user-select: none; transition: background 0.15s;
}
.lis-toggle-row:hover { background: rgba(255,255,255,0.03); }
.lis-icon  { font-size: 1.1rem; flex-shrink: 0; }
.lis-title { font-size: 0.8rem; font-weight: 700; color: #445; letter-spacing: 0.14em; text-transform: uppercase; }
.lis-badge {
  background: rgba(255,255,255,0.1); color: #556;
  font-size: 0.7rem; font-weight: 800;
  border-radius: 999px; min-width: 1.4rem; height: 1.4rem;
  display: flex; align-items: center; justify-content: center; padding: 0 0.3rem;
}
.lis-sub { font-size: 0.68rem; color: #334; letter-spacing: 0.03em; flex: 1; }
.lis-chevron { font-size: 0.65rem; color: #334; margin-left: auto; }
.lis-body { padding: 0.5rem 0.75rem 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.lis-card { opacity: 0.45; }
.lis-card:hover { opacity: 0.65; }
.lis-locked-msg { font-size: 0.75rem; color: #667; letter-spacing: 0.04em; display: flex; align-items: center; gap: 0.35rem; }

/* ── Mission Log Archive ── */
.log-section {
  background: rgba(0, 20, 45, 0.45);
  border: 1px solid rgba(153, 204, 255, 0.12);
  border-radius: 0.65rem;
  overflow: hidden;
}
.log-section-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem 1.1rem;
  background: rgba(0, 30, 60, 0.5);
  border-bottom: 1px solid rgba(153, 204, 255, 0.1);
}
.log-section-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.6rem; color: #99ccff; letter-spacing: 0.12em; text-transform: uppercase;
}
.log-section-count {
  font-size: 0.72rem; color: #556; letter-spacing: 0.04em; margin-left: auto;
}
.log-empty { padding: 1.1rem 1.1rem; font-size: 0.8rem; color: #556; letter-spacing: 0.04em; }
.log-list  { display: flex; flex-direction: column; }
.log-row {
  border-top: 0.0625rem solid rgba(153,204,255,0.1);
  cursor: pointer; transition: background 0.12s;
}
.log-row:first-child { border-top: none; }
.log-row:hover       { background: rgba(153,204,255,0.05); }
.log-row--open       { background: rgba(153,204,255,0.06); }
.log-row-summary {
  display: flex; align-items: center; gap: 0.65rem; padding: 0.55rem 1.1rem;
}
.log-row-icon   { font-size: 1rem; flex-shrink: 0; }
.log-row-title  { flex: 1; font-size: 0.9rem; color: #cce0ff; }
.log-row-points { font-size: 0.78rem; font-weight: bold; color: #69f0ae; white-space: nowrap; flex-shrink: 0; }
.log-row-chevron { font-size: 0.6rem; color: rgba(153,204,255,0.4); flex-shrink: 0; margin-left: 0.25rem; }
.log-row-detail { padding: 0 1.1rem 0.65rem 2.8rem; }
.log-feedback {
  font-size: 0.82rem; color: #99ccff; line-height: 1.45;
  background: rgba(153,204,255,0.06);
  border-left: 0.2rem solid rgba(153,204,255,0.3);
  border-radius: 0 0.25rem 0.25rem 0; padding: 0.35rem 0.6rem;
}
.log-feedback-label { font-weight: bold; opacity: 0.7; }
.log-no-feedback    { font-size: 0.82rem; color: #445; font-style: italic; }

/* ── Detail panel ── */
.panel-backdrop-enter-active, .panel-backdrop-leave-active { transition: opacity 0.25s ease; }
.panel-backdrop-enter-from, .panel-backdrop-leave-to { opacity: 0; }
.detail-panel-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200; }

.panel-slide-enter-active { transition: transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94); }
.panel-slide-leave-active  { transition: transform 0.22s ease-in; }
.panel-slide-enter-from, .panel-slide-leave-to { transform: translateX(100%); }

.detail-panel {
  position: fixed; right: 0; top: 0; bottom: 0;
  width: 440px; max-width: 100vw;
  background: linear-gradient(180deg, #101828 0%, #0c1622 100%);
  border-left: 1px solid rgba(51,102,255,0.25);
  box-shadow: -6px 0 32px rgba(0,0,0,0.55);
  z-index: 201; display: flex; flex-direction: column; overflow: hidden;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}
.detail-panel-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 1rem; padding: 1.25rem 1.25rem 1rem;
  border-bottom: 1px solid rgba(51,102,255,0.15); flex-shrink: 0;
}
.detail-panel-head-text { min-width: 0; }
.detail-panel-title { color: #ff9900; font-size: 1.2rem; font-weight: bold; letter-spacing: 0.08em; line-height: 1.25; }
.detail-panel-body  { flex: 1; overflow-y: auto; padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
.detail-panel-foot  {
  flex-shrink: 0; padding: 0.9rem 1.25rem;
  border-top: 1px solid rgba(51,102,255,0.15);
  display: flex; gap: 0.6rem; justify-content: flex-end; flex-wrap: wrap;
  background: rgba(10,18,32,0.8);
}
.detail-meta   { display: flex; gap: 1rem; margin-top: 0.4rem; font-size: 0.8rem; align-items: center; }
.detail-points { color: #667788; font-family: 'Antonio', sans-serif; letter-spacing: 0.05em; }
.detail-close-btn { background: none; border: none; color: #6688aa; cursor: pointer; font-size: 1.1rem; padding: 0.1rem 0.3rem; flex-shrink: 0; }
.detail-close-btn:hover { color: #99ccff; }
.detail-description {
  font-family: 'Roboto', sans-serif; font-size: 0.9rem; color: #aabbcc; line-height: 1.6;
  padding: 0.75rem 1rem; background: rgba(51,102,255,0.04);
  border: 1px solid rgba(51,102,255,0.12); border-radius: 0.4rem;
}
.detail-description :deep(ul), .detail-description :deep(ol) { margin: 0.25rem 0 0.25rem 1.25rem; padding: 0; }
.detail-description :deep(li) { margin: 0.15rem 0; }
.detail-description :deep(strong) { color: #cce0ff; }
.detail-items       { display: flex; flex-direction: column; gap: 0.4rem; }
.detail-items-label { font-family: 'Antonio', sans-serif; font-size: 0.7rem; letter-spacing: 0.15em; color: #445566; }
.delivery-link {
  display: block; font-size: 0.8rem; color: #99ccff;
  text-decoration: none; white-space: nowrap;
  border-bottom: 0.0625rem solid rgba(153,204,255,0.3); transition: color 0.15s; text-align: right;
}
.delivery-link:hover { color: #ff9900; border-bottom-color: rgba(255,153,0,0.4); }
.game-hint { font-size: 0.75rem; color: #445; letter-spacing: 0.05em; }
.game-logo-link {
  display: block; border-radius: 0.5rem; overflow: hidden;
  background: rgba(0,10,25,0.6); border: 0.0625rem solid rgba(153,204,255,0.12);
  transition: border-color 0.2s, box-shadow 0.2s; text-decoration: none;
}
.game-logo-link:hover { border-color: rgba(153,204,255,0.35); box-shadow: 0 0 14px rgba(100,160,255,0.15); }
.game-logo-img { display: block; width: 100%; max-height: 90px; object-fit: contain; padding: 0.75rem 1.25rem; }

/* Clickable logo affordance */
.game-logo-btn {
  cursor: pointer; user-select: none;
  border-color: rgba(153, 204, 255, 0.2);
}
.game-logo-btn:hover {
  border-color: rgba(153, 204, 255, 0.5);
  box-shadow: 0 0 18px rgba(100, 160, 255, 0.22);
}
.game-logo-btn:active { transform: scale(0.985); }
.game-logo-btn--loading { opacity: 0.65; pointer-events: none; }
.game-logo-tap-hint {
  display: block; text-align: center;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.72rem; font-weight: bold; letter-spacing: 0.18em;
  color: rgba(153, 204, 255, 0.55);
  padding: 0.3rem 0 0.55rem;
  transition: color 0.15s;
}
.game-logo-btn:hover .game-logo-tap-hint { color: rgba(153, 204, 255, 0.9); }
.game-result-panel {
  display: flex; align-items: flex-start; gap: 0.75rem;
  border-radius: 0.4rem; padding: 0.75rem 0.9rem; margin-top: 0.25rem;
}
.game-result-panel--played  { background: rgba(105,240,174,0.08); border: 1px solid rgba(105,240,174,0.25); }
.game-result-panel--waiting { background: rgba(153,204,255,0.05); border: 1px solid rgba(153,204,255,0.15); }
.game-result-icon  { font-size: 1.4rem; flex-shrink: 0; line-height: 1.2; }
.game-result-body  {}
.game-result-title { font-family: 'Antonio', sans-serif; font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 0.2rem; }
.game-result-panel--played  .game-result-title { color: #69f0ae; }
.game-result-panel--waiting .game-result-title { color: #778899; }
.game-result-score  { font-size: 0.95rem; color: #cce0ff; }
.game-result-score strong { color: #69f0ae; font-size: 1.1rem; }
.game-result-detail { font-size: 0.82rem; color: #667788; line-height: 1.45; }

/* ── Multi-game progress panel ── */
.multi-game-panel {
  border-radius: 0.4rem; padding: 0.75rem 0.9rem; margin-top: 0.25rem;
  display: flex; flex-direction: column; gap: 0.55rem;
}
.multi-game-panel--active { background: rgba(153,204,255,0.05); border: 1px solid rgba(153,204,255,0.2); }
.multi-game-panel--done   { background: rgba(105,240,174,0.08); border: 1px solid rgba(105,240,174,0.3); }
.multi-game-header {
  display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem;
}
.multi-game-title {
  font-family: 'Antonio', sans-serif; font-size: 0.72rem;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: #99ccff;
}
.multi-game-panel--done .multi-game-title { color: #69f0ae; }
.multi-game-count {
  font-family: 'Tiny5', monospace; font-size: 0.72rem; color: #556677; white-space: nowrap;
}
.multi-game-panel--done .multi-game-count { color: #69f0ae; }
.multi-game-boxes {
  display: flex; flex-wrap: wrap; gap: 0.3rem;
}
.multi-game-box {
  width: 1.45rem; height: 1.45rem;
  border-radius: 0.2rem;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.85rem; font-weight: bold; line-height: 1;
  transition: background 0.2s, border-color 0.2s;
}
.multi-game-box--done {
  background: rgba(105,240,174,0.2);
  border: 1px solid rgba(105,240,174,0.55);
  color: #69f0ae;
}
.multi-game-box--open {
  background: rgba(153,204,255,0.05);
  border: 1px solid rgba(153,204,255,0.18);
  color: transparent;
}
.multi-game-best {
  font-size: 0.82rem; color: #778899;
}
.multi-game-best strong { color: #99ccff; }

/* ── Modals ── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; }
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
.clear-file { background: transparent; border: 0.0625rem solid rgba(255,110,110,0.4); border-radius: 0.25rem; color: #ff6e6e; cursor: pointer; font-size: 0.75rem; padding: 0.2rem 0.6rem; }
.upload-error { color: #ff6e6e; font-size: 0.9rem; text-align: center; }
.upload-confirm-section { display: flex; flex-direction: column; gap: 0.75rem; border-top: 1px solid rgba(105,240,174,0.2); padding-top: 0.75rem; margin-top: 0.25rem; }
.upload-confirm-msg   { display: flex; align-items: flex-start; gap: 0.75rem; }
.upload-confirm-icon  { font-size: 1.4rem; flex-shrink: 0; line-height: 1.3; }
.upload-confirm-title { font-size: 0.85rem; font-weight: bold; letter-spacing: 0.08em; color: #69f0ae; margin-bottom: 0.25rem; }
.upload-confirm-detail { font-size: 0.82rem; color: #aabbcc; line-height: 1.45; }
.upload-confirm-detail strong { color: #cce0ff; }
.confirm-action-modal  { max-width: 26rem; }
.confirm-action-header { display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 1rem; }
.confirm-action-icon   { font-size: 1.5rem; flex-shrink: 0; line-height: 1; margin-top: 0.15rem; }
.confirm-action-body   { font-size: 0.88rem; color: #aabbcc; margin-top: 0.35rem; line-height: 1.5; }
.modal-actions         { display: flex; gap: 0.75rem; justify-content: flex-end; }
.lcars-btn {
  background: linear-gradient(90deg, #cc6600, #ff9900);
  border: none; border-radius: 0.4rem; color: black;
  cursor: pointer; font-family: inherit; font-size: 0.95rem;
  font-weight: bold; letter-spacing: 0.08em; padding: 0.6rem 1.4rem; transition: opacity 0.2s;
}
.lcars-btn:hover:not(:disabled) { opacity: 0.85; }
.lcars-btn:disabled              { opacity: 0.5; cursor: not-allowed; }
.lcars-btn--ghost  { background: transparent; border: 0.125rem solid #99ccff; color: #99ccff; }
.lcars-btn--danger { background: #c0392b; color: #fff; border: none; }
.lcars-btn--danger:hover:not(:disabled) { background: #e74c3c; }

@media (max-width: 900px) {
  .mission-board { grid-template-columns: 1fr; }
  .awaiting-list { grid-template-columns: 1fr; }
}
</style>
