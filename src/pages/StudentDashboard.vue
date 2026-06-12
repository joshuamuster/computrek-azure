<template>
  <section class="adventure-page">
    <div class="lcars-text-bar"><span>{{ userInfo?.displayName ? `${userInfo.displayName}'s Cadet Dashboard` : 'Cadet Dashboard' }}</span></div>

    <div class="dashboard-layout">

      <!-- ── TOP BAR: cadet-header (1/3) + hud-strip (2/3) ──────────── -->
      <div class="top-bar">

        <!-- Right 2/3: HUD cells -->
        <div class="hud-strip">

          <!-- Grade -->
          <div class="hud-cell">
            <div class="hud-cell-left">
              <div class="hud-label">CURRENT GRADE</div>
              <div class="hud-detail" v-if="quarterGrade">
                {{ quarterGrade.earned }}/{{ quarterGrade.possible }} pts
                &middot; {{ quarterGrade.gradedCount }} graded
                <span v-if="pendingGradeCount > 0" class="hud-pending"> &middot; {{ pendingGradeCount }} pending</span>
              </div>
              <div class="hud-detail" v-else>No graded missions yet</div>
            </div>
            <div v-if="quarterGrade" class="hud-value" :style="{ color: gradeColor(quarterGrade.percent) }">
              {{ letterGrade(quarterGrade.percent) }}<span class="hud-pct">{{ quarterGrade.percent }}</span>
            </div>
            <div v-else class="hud-value hud-value--dim">—</div>
          </div>

          <!-- Typing -->
          <div class="hud-cell hud-cell--col">
            <div class="hud-typing-top">
              <div class="hud-label">TYPING</div>
              <div
                v-if="typingStatsRaw.personalBestWpm"
                class="hud-value hud-value--tier"
                :style="{ color: currentTier.color }"
                title="View all tiers"
                @click="showTierModal = true"
              >⚡ {{ currentTier.label }}</div>
              <div v-else class="hud-value hud-value--dim">—</div>
            </div>
            <div class="hud-detail" v-if="typingStatsRaw.personalBestWpm">
              {{ typingAvgDisplay }} avg &middot; {{ typingBestDisplay }} best &middot; {{ typingAccyDisplay }}% acc
            </div>
            <div class="hud-detail" v-else>No sessions yet</div>
          </div>

          <!-- Conduct -->
          <div class="hud-cell">
            <div class="hud-cell-left">
              <div class="hud-label">CONDUCT</div>
              <div class="hud-detail" :style="{ color: pipColor(conductScore) }">
                {{ pipLabel(conductScore) }} <span class="hud-pip-score">({{ conductScore }}/4)</span>
              </div>
            </div>
            <div class="hud-conduct">
              <div class="hud-pips">
                <span
                  v-for="i in 4" :key="i"
                  class="hud-pip"
                  :style="pipFilled(conductScore, i) ? { background: pipColor(conductScore), boxShadow: '0 0 6px ' + pipColor(conductScore) } : {}"
                ></span>
              </div>
            </div>
          </div>

        </div><!-- /hud-strip -->

        <!-- Left 1/3: identity card -->
        <div class="cadet-header">
          <div class="cadet-meta">
            <span v-if="teacherName" class="cadet-teacher">{{ teacherName }}</span>
            <span class="cadet-breaker"> / / </span>
            <span class="cadet-period">{{ periodLabel }}</span>
            <span class="cadet-breaker"> / / </span>
            <span class="cadet-quarter">{{ currentQuarterLabel }}</span>
          </div>

        </div>

      </div><!-- /top-bar -->

      <!-- Loading / error -->
      <div v-if="isLoading" class="status-msg">LOADING MISSION DOSSIERS...</div>
      <div v-else-if="loadError" class="status-error">{{ loadError }}</div>

      <template v-else>

        <!-- ── MISSION BOARD (3 columns) ───────────────────────────── -->
        <div class="mission-board">

          <!-- ASSIGNED column (wider) -->
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
                    <span v-if="a.pointsPossible" class="mission-pts">{{ a.pointsPossible }} pts</span>
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

          <!-- AWAITING GRADE column -->
          <div class="mission-col">
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
            <div v-else class="mission-list">
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
                    <span v-if="a.pointsPossible" class="mission-pts">{{ a.pointsPossible }} pts</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- OVERDUE column -->
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
                      <span v-if="a.pointsPossible" class="mission-pts">{{ a.pointsPossible }} pts</span>
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

        </div><!-- /mission-board -->

        <!-- ── LOST IN SPACE ────────────────────────────────────────── -->
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
                  <span v-if="a.pointsPossible" class="mission-pts">{{ a.pointsPossible }} pts</span>
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

      </template>

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

        <!-- Step 1: pick file -->
        <div v-if="!uploadConfirming" class="modal-actions">
          <button class="lcars-btn lcars-btn--ghost" @click="closeUpload" :disabled="isUploading">CANCEL</button>
          <button class="lcars-btn" :disabled="!selectedFile || isUploading" @click="uploadConfirming = true">
            SUBMIT REPORT →
          </button>
        </div>

        <!-- Step 2: confirm before transmitting -->
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

    <!-- ── Generic action confirm modal ─────────────────────────────── -->
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

  <!-- ── Mission detail panel (slides in from right) ─────────────────────── -->
  <Teleport to="body">
    <Transition name="panel-backdrop">
      <div v-if="detailAssignment" class="detail-panel-backdrop" @click="detailAssignment = null" />
    </Transition>
    <Transition name="panel-slide">
      <div v-if="detailAssignment" class="detail-panel" role="dialog" aria-modal="true">

        <!-- Sticky header -->
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

        <!-- Scrollable body -->
        <div class="detail-panel-body">
          <!-- Game logo — tap to start tracking + navigate to the game -->
          <div
            v-if="detailGameInfo"
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
               : detailAssignment?.status === 'started'     ? '▶ CONTINUE PLAYING'
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

          <!-- Game result panel — shown when status is started/submitted, or whenever a result has been recorded -->
          <div
            v-if="(detailAssignment.type === 'game' || detailAssignment.deliveryItems?.some(i => i.kind === 'game')) && (detailAssignment.status === 'started' || detailAssignment.status === 'submitted' || detailAssignment.data?.score != null)"
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

        <!-- Sticky footer with action buttons -->
        <div class="detail-panel-foot">
          <button class="lcars-btn lcars-btn--ghost" @click="detailAssignment = null">CLOSE</button>
          <template v-if="detailAssignment.status === 'assigned'">
            <!-- File-upload missions still need an explicit UPLOAD button -->
            <button
              v-if="detailAssignment.deliveryItems?.some(i => i.submissionMethod === 'file-upload') || (!detailAssignment.deliveryItems?.length && detailAssignment.type === 'file')"
              class="lcars-btn"
              @click="openFileSubmit(detailAssignment); detailAssignment = null"
            >UPLOAD</button>
            <!-- Game missions: logo tap handles start + navigate; no START button needed -->
          </template>
          <template v-else-if="detailAssignment.status === 'started'">
            <!-- Game missions auto-submit on play; only show SUBMIT for non-game missions -->
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
            <!-- Game missions: logo tap handles replay; no REPLAY button needed -->
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
import { useRouter } from 'vue-router'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, onSnapshot, query, where } from '@/data/db'
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
import { pipColor, pipLabel, pipFilled } from '@/composables/useConductScore'

// Game title logos — one SVG per game family, keyed by delivery-item gameId prefix
import logoChess         from '@/assets/images/games/title-chess.svg'
import logoPicard        from '@/assets/images/games/title-picardmaneuver.svg'
import logoMutara        from '@/assets/images/games/title-battlemutaranebula.svg'
import logoRules         from '@/assets/images/games/title-rulesofacquisition.svg'
import logoIsolinear     from '@/assets/images/games/title-isolinearcascade.svg'
import logoMinesweeper   from '@/assets/images/games/title-minesweeper.svg'
import logoWarp          from '@/assets/images/games/title-warpcorebreach.svg'
import logoShuttle       from '@/assets/images/games/title-shuttlebay.svg'
import logoOrbital       from '@/assets/images/games/title-fracturedfrontier.svg'

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

const { userInfo } = useAuth()
const router = useRouter()
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

const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

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

// ── Mission board column filters ──────────────────────────────────────────────
//
// ASSIGNED      — needs student action; not yet past the missed cutoff
// AWAITING GRADE — submitted; ball is in teacher's court
// OVERDUE       — past due but within 7 days; still actionable
// LOST IN SPACE — past due by more than 7 days; no longer submittable
//
// "returned" missions always stay in ASSIGNED regardless of due date — the
// teacher explicitly sent it back, so the student must always be able to act.

const MISSED_DAYS = 7

function daysLate(iso: string): number {
  return Math.floor((new Date(todayIso).getTime() - new Date(iso).getTime()) / 86400000)
}

// ASSIGNED: needs student action and is not in the overdue/missed window
// (returned missions are always here regardless of due date)
const assignedMissions = computed(() =>
  assignmentViews.value.filter(a => {
    if (!['assigned', 'started', 'returned'].includes(a.status)) return false
    if (a.status === 'returned') return true   // teacher sent it back — always actionable
    const due = effectiveDueDate(a)
    return !due || due >= todayIso             // future or no due date
  })
)

// AWAITING GRADE: submitted — ball is in teacher's court
const awaitingGrade = computed(() =>
  assignmentViews.value.filter(a => a.status === 'submitted')
)

// OVERDUE: past due, still actionable, within the 7-day grace window
const overdueActive = computed(() =>
  assignmentViews.value.filter(a => {
    if (!['assigned', 'started'].includes(a.status)) return false
    const due = effectiveDueDate(a)
    if (!due || due >= todayIso) return false
    return daysLate(due) <= MISSED_DAYS
  })
)

// LOST IN SPACE: past the 7-day window — no longer submittable
const lostInSpace = computed(() =>
  assignmentViews.value.filter(a => {
    if (!['assigned', 'started'].includes(a.status)) return false
    const due = effectiveDueDate(a)
    if (!due || due >= todayIso) return false
    return daysLate(due) > MISSED_DAYS
  })
)

// Legacy aliases kept for any remaining template references
const upcoming     = computed(() => assignedMissions.value)
const overdueItems = computed(() => overdueActive.value)

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
function wasSubmittedLate(a: AssignmentView): boolean {
  const due = effectiveDueDate(a)
  if (!due || !a.submittedAt) return false
  const submittedDate = a.submittedAt.toDate ? a.submittedAt.toDate() : new Date(a.submittedAt)
  const submittedIso = submittedDate.toISOString().slice(0, 10)
  return submittedIso > due
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)    return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ── Teacher name ──────────────────────────────────────────────────────────────

const teacherName   = ref<string | null>(null)
const showTierModal = ref(false)
const conductScore  = ref<number>(4)
const lisExpanded   = ref(false)

async function fetchTeacherName() {
  const email = userInfo.value?.teacherEmail
  if (!email) return
  const snap = await getDoc(doc(db, 'approvedUsers', email))
  if (snap.exists()) teacherName.value = snap.data().displayName ?? null
}

async function fetchConductScore() {
  const uid = userInfo.value?.uid
  if (!uid) return
  const snap = await getDocs(query(collection(db, 'approvedUsers'), where('uid', '==', uid)))
  if (!snap.empty) conductScore.value = snap.docs[0].data().conductScore ?? 4
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
        summary:         (mission as any).summary ?? '',
        description:     mission.description,
        type:            mission.type,
        deliveryItems:   mission.deliveryItems ?? [],
        pointsPossible:  mission.pointsPossible,
        gameId:          (sub as any).gameId      ?? null,
        gameVariant:     (sub as any).gameVariant ?? null,
      } as AssignmentView
    })
    .filter((v): v is AssignmentView => v !== null)

  // Keep the open detail panel fresh — if the snapshot brought in new data
  // (e.g. autoLogCompletion wrote a game score), reflect it immediately.
  if (detailAssignment.value) {
    const fresh = assignmentViews.value.find(v => v.submissionId === detailAssignment.value!.submissionId)
    if (fresh) detailAssignment.value = fresh
  }
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

// ── Generic action confirm modal ──────────────────────────────────────────────

interface PendingConfirm {
  title:        string
  body:         string
  confirmLabel: string
  danger:       boolean
  busy?:        boolean
  action:       () => void
}
const pendingConfirm = ref<PendingConfirm | null>(null)

// ── Game mission: start / submit ──────────────────────────────────────────────

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
  } catch (e) {
    console.error('startGameMission error:', e)
  } finally {
    isStarting.value = null
  }
}

/**
 * Called when the student taps the game logo in the detail panel.
 * - assigned  → starts tracking (sets status → started) then navigates
 * - started   → navigates immediately (tracking already active)
 * - returned  → resets submission to started so autoLogCompletion can re-submit, then navigates
 * - submitted → navigates (lets them play again; teacher can return for re-submission)
 */
async function launchGameMission(a: AssignmentView | null) {
  if (!a || !detailGameInfo.value || isStarting.value === a.submissionId) return

  if (a.status === 'assigned') {
    await startGameMission(a)
  } else if (a.status === 'returned') {
    isStarting.value = a.submissionId
    try {
      const resolvedGameId = a.deliveryItems?.find(i => i.kind === 'game' && i.gameId)?.gameId
                          ?? a.gameId
                          ?? null
      const patch: Record<string, any> = { status: 'started', data: {} }
      if (resolvedGameId) patch.gameId = resolvedGameId
      await updateDoc(doc(db, 'submissions', a.submissionId), patch)
      const idx = assignmentViews.value.findIndex(v => v.submissionId === a.submissionId)
      if (idx !== -1) {
        assignmentViews.value[idx] = { ...assignmentViews.value[idx], status: 'started', data: {} as any }
        assignmentViews.value = [...assignmentViews.value]
      }
    } catch (e) { console.error('launchGameMission error:', e) }
    finally { isStarting.value = null }
  }

  // If the mission requires a specific game variant (e.g. Horde for Chess), pass it
  // as a query param so the game landing page can pre-select and lock that variant.
  const destination = a.gameVariant
    ? `${detailGameInfo.value.route}?missionVariant=${encodeURIComponent(a.gameVariant)}`
    : detailGameInfo.value.route
  router.push(destination)
}

async function replayGameMission(a: AssignmentView) {
  isStarting.value = a.submissionId
  try {
    await updateDoc(doc(db, 'submissions', a.submissionId), {
      status: 'assigned',
      data:   {},
    })
    const idx = assignmentViews.value.findIndex(v => v.submissionId === a.submissionId)
    if (idx !== -1) {
      assignmentViews.value[idx] = { ...assignmentViews.value[idx], status: 'assigned', data: {} as any }
      assignmentViews.value = [...assignmentViews.value]
    }
    if (detailAssignment.value?.submissionId === a.submissionId) {
      detailAssignment.value = { ...detailAssignment.value, status: 'assigned' }
    }
  } catch (e) {
    console.error('replayGameMission error:', e)
  } finally {
    isStarting.value = null
  }
}

async function submitGameMission(a: AssignmentView) {
  if (!userInfo.value) return
  isSubmitting.value = a.submissionId
  try {
    await updateDoc(doc(db, 'submissions', a.submissionId), {
      status:      'submitted',
      submittedAt: serverTimestamp(),
    })
    const teacherEmail  = userInfo.value?.teacherEmail
    const periodId      = userInfo.value?.periodId
    const schoolYearId  = userInfo.value?.schoolYearId ?? SCHOOL_YEAR_ID
    const effectiveDue  = a.dueDateOverride ?? a.dueDate
    const todayIso      = new Date().toISOString().slice(0, 10)
    const isOnTime      = effectiveDue ? todayIso <= effectiveDue : false
    if (teacherEmail && periodId) {
      onSubmitted(teacherEmail, periodId, schoolYearId, isOnTime)
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
  } catch (e) {
    console.error('submitGameMission error:', e)
  } finally {
    isSubmitting.value = null
  }
}

function openSubmitConfirm(a: AssignmentView) {
  detailAssignment.value = null
  pendingConfirm.value = {
    title:        'SUBMIT MISSION',
    body:         `Submit "${a.title}"? Your teacher will be notified.`,
    confirmLabel: '✓ SUBMIT',
    danger:       false,
    action() {
      pendingConfirm.value = null
      submitGameMission(a)
    },
  }
}

function openRetractConfirm(a: AssignmentView) {
  detailAssignment.value = null
  pendingConfirm.value = {
    title:        'RETRACT SUBMISSION',
    body:         `Take back your submission for "${a.title}"? It will return to your active missions so you can edit and resubmit.`,
    confirmLabel: 'RETRACT',
    danger:       true,
    action() {
      pendingConfirm.value = null
      retractSubmission(a)
    },
  }
}

async function retractSubmission(a: AssignmentView) {
  isRetracting.value = a.submissionId
  try {
    await updateDoc(doc(db, 'submissions', a.submissionId), {
      status:      'assigned',
      submittedAt: null,
    })
    const idx = assignmentViews.value.findIndex(v => v.submissionId === a.submissionId)
    if (idx !== -1) {
      assignmentViews.value[idx] = { ...assignmentViews.value[idx], status: 'assigned', submittedAt: null }
      assignmentViews.value = [...assignmentViews.value]
    }
    if (detailAssignment.value?.submissionId === a.submissionId) {
      detailAssignment.value = null
    }
  } catch (e) {
    console.error('retractSubmission error:', e)
  } finally {
    isRetracting.value = null
  }
}

// ── Mission detail modal ──────────────────────────────────────────────────────

const detailAssignment = ref<AssignmentView | null>(null)

/** Resolves the game logo + route for the currently open detail panel, if it's a game mission. */
const detailGameInfo = computed(() => {
  const a = detailAssignment.value
  if (!a) return null
  const gameId = a.deliveryItems?.find(i => i.kind === 'game' && i.gameId)?.gameId
               ?? a.gameId
               ?? null
  return gameId ? (GAME_INFO[gameId] ?? null) : null
})

// ── File upload ───────────────────────────────────────────────────────────────

const submittingAssignment = ref<AssignmentView | null>(null)
const selectedFile         = ref<File | null>(null)
const isDraggingFile       = ref(false)
const isUploading          = ref(false)
const uploadConfirming     = ref(false)
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
  uploadConfirming.value     = false
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
  uploadError.value      = ''
  uploadConfirming.value = false
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
    const effectiveDue = a.dueDateOverride ?? a.dueDate
    const todayIso     = new Date().toISOString().slice(0, 10)
    const isOnTime     = effectiveDue ? todayIso <= effectiveDue : false
    if (teacherEmail && periodId) {
      onSubmitted(teacherEmail, periodId, schoolYearId, isOnTime)
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
    fetchConductScore()
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
  display: flex;
  flex-direction: column;
  gap: 2.75rem;
  padding: 0 1.5rem 3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  max-width: 1400px;
  margin: 0 auto;
}

/* ── Top bar (cadet-header + hud-strip side by side) ── */
.top-bar {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 0.75rem;
  align-items: stretch;
  padding-bottom: .75rem;
  border-bottom: 2px solid var(--champsyellow);
}

/* ── HUD strip ── */
.hud-strip {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.6rem;
}

.hud-cell {
  background: rgba(51, 122, 191, 0.18);
  border: 1px solid rgba(255, 153, 0, 0.25);
  backdrop-filter: blur(12px) saturate(160%);
  border-radius: 0.5rem;
  padding: 0.55rem 0.75rem;
  align-items: center;
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
}

.hud-cell-left { flex: 1; min-width: 0; }
.hud-cell--col { flex-direction: column; align-items: stretch; justify-content: center; }
.hud-typing-top { display: flex; align-items: center; justify-content: space-between; }
.hud-label {
  color: rgba(77,153,255,1);
  font-size: 1.25rem;
  letter-spacing: 0.1em;
  margin-bottom: 0.15rem;
  text-transform: uppercase;
}
.hud-detail {
  font-size: 0.68rem; color: #6688aa; letter-spacing: 0.03em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hud-pending { color: #ffb300; }

.hud-value {
  font-size: 2rem; font-weight: 700;
  letter-spacing: 0.04em; white-space: nowrap; text-align: right; flex-shrink: 0;
}
.hud-pct     { font-size: 1.25rem; margin-left: 0.15rem; opacity: 0.8; }
.hud-value--dim   { color: #334; }
.hud-value--tier  { cursor: pointer; font-size: 0.95rem; }
.hud-value--tier:hover { opacity: 0.8; }

.hud-conduct { display: flex; align-items: center; flex-shrink: 0; }
.hud-pips    { display: flex; gap: 0.3rem; }
.hud-pip {
  width: 1.25rem; height: 1.25rem; border-radius: 50%;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  transition: background 0.2s;
}
.hud-pip-score { font-size: 0.68rem; opacity: 0.7; letter-spacing: 0.03em; margin-left: 0.2rem; }

/* ── Mission board ── */
.mission-board {
  display: grid;
  grid-template-columns: 5fr 3fr 3fr;
  gap: 1rem;
  align-items: start;
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
  color: #4d99ee;
  font-size: 1.55rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  flex: 1;
}
.col-badge {
  background: #4d99ee; color: #fff;
  font-size: 0.7rem; font-weight: 800;
  border-radius: 999px; min-width: 1.4rem; height: 1.4rem;
  display: flex; align-items: center; justify-content: center; padding: 0 0.3rem;
}
.col-badge--danger { background: #c0392b; }

.col-empty {
  padding: 1.5rem 1rem;
  font-size: 0.82rem; color: #556; letter-spacing: 0.04em;
  text-align: center;
}
.col-empty--clear {
  color: #69f0ae; display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
}
.col-empty--nudge {
  color: #ffb300; display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
}
.col-clear-icon { font-size: 1.3rem; }

.mission-col .mission-list { padding: 0.5rem 0.6rem; display: flex; flex-direction: column; gap: 0.5rem; }
.mission-col .mission-card { padding: 0.65rem 0.75rem; }

/* ── Lost in Space ── */
.lis-section {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 0.65rem;
  overflow: hidden;
}

.lis-toggle-row {
  display: flex; align-items: center; gap: 0.65rem;
  padding: 0.75rem 1.1rem;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
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
.lis-status { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); color: #445; }


@media (max-width: 900px) {
  .top-bar       { grid-template-columns: 1fr; }
  .hud-strip     { grid-template-columns: 1fr; }
  .mission-board { grid-template-columns: 1fr; }
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

/* ── Cadet header (left card in top-bar) ── */
.cadet-header {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.5rem;
  //background: rgba(51, 122, 191, 0.18);
  //border: 1px solid rgba(255, 153, 0, 0.25);
  border-radius: 0.5rem;
  padding: 0.6rem 1rem 0 0;
  font-size: 0.9rem;
}
.cadet-name    { font-size: 1.6rem; font-weight: bold; color: #ff9900; letter-spacing: 0.05em; }
.cadet-meta {
  align-items: center;
  justify-content: flex-end;
  display: flex;
  flex-wrap: wrap;
  font-size: 1rem;
  gap: 0.5rem;
}
.cadet-period  { color: #99ccff; letter-spacing: 0.08em; }
.cadet-teacher { color: #ff9900; letter-spacing: 0.06em; }
.cadet-quarter { color: #777; letter-spacing: 0.06em; }
.cadet-breaker { color: #444; letter-spacing: 0.06em; }

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
  cursor: pointer;
}
.mission-card:hover           { border-color: rgba(153,204,255,0.3); }
.mission-card.overdue         { border-color: rgba(255,100,100,0.4); background: rgba(80,0,0,0.3); flex-direction: column; gap: 0.5rem; }
.overdue-card-top             { display: flex; align-items: flex-start; gap: 1rem; width: 100%; }
.mission-card.due-soon        { border-color: rgba(255,200,0,0.4); }
.mission-card.started         { border-color: rgba(105,240,174,0.3); }
.mission-card.submitted       { border-color: rgba(153,204,255,0.35); }
.mission-card.graded          { border-color: rgba(105,240,174,0.4); background: rgba(0,40,20,0.3); }
.mission-card.returned        { border-color: rgba(255,180,0,0.5); background: rgba(60,40,0,0.35); }
.past-card                    { background: rgba(0,0,0,0.2); border-color: rgba(255,255,255,0.05); }

.mission-type-icon            { font-size: 1.5rem; line-height: 1; flex-shrink: 0; margin-top: 0.1rem; }
.mission-type-icon.dim        { opacity: 0.4; }
.mission-left-col             { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; gap: 0.2rem; }
.submitted-check              { font-size: 0.8rem; font-weight: bold; color: #99ccff; line-height: 1; }
.mission-body                 { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; }
.mission-title                { font-size: 1.1rem; color: #e6f0ff; font-weight: 500; }
.mission-title.dim            { color: #556; }
.mission-desc                 { font-size: 0.85rem; color: #99ccff; opacity: 0.8; line-height: 1.4; }

.mission-meta { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.2rem; }
.mission-due          { font-size: 0.8rem; font-weight: bold; color: #69f0ae; letter-spacing: 0.04em; }
.mission-due.overdue  { color: #ff6e6e; }
.mission-due.due-soon { color: #ffd740; }
.mission-pts          { font-size: 0.75rem; color: #888; letter-spacing: 0.03em; }
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

.mission-status-area {
  flex-shrink: 0; display: flex; flex-direction: column;
  align-items: flex-end; gap: 0.35rem;
}
.mission-card.overdue .mission-status-area {
  align-items: flex-start;
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

.start-btn {
  background: #69f0ae; border: none; border-radius: 0.4rem; color: black;
  cursor: pointer; font-family: inherit; font-size: 0.85rem;
  font-weight: bold; letter-spacing: 0.06em; padding: 0.4rem 0.9rem;
  transition: opacity 0.2s; white-space: nowrap;
}
.start-btn:hover    { opacity: 0.85; }
.start-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.start-btn--sm      { font-size: 0.75rem; padding: 0.3rem 0.65rem; }

.resubmit-btn {
  background: transparent; border: 0.0625rem solid rgba(255,153,0,0.35);
  border-radius: 0.4rem; color: rgba(255,153,0,0.7);
  cursor: pointer; font-family: inherit; font-size: 0.75rem;
  font-weight: bold; letter-spacing: 0.05em; padding: 0.25rem 0.6rem;
  transition: all 0.2s; white-space: nowrap;
}
.resubmit-btn:hover { border-color: #ff9900; color: #ff9900; background: rgba(255,153,0,0.08); }

.retract-btn {
  background: transparent; border: 0.0625rem solid rgba(255,110,110,0.3);
  border-radius: 0.4rem; color: rgba(255,110,110,0.6);
  cursor: pointer; font-family: inherit; font-size: 0.75rem;
  font-weight: bold; letter-spacing: 0.05em; padding: 0.25rem 0.6rem;
  transition: all 0.2s; white-space: nowrap;
}
.retract-btn:hover:not(:disabled) { border-color: #ff6e6e; color: #ff6e6e; background: rgba(255,110,110,0.06); }
.retract-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.submission-status {
  display: flex; align-items: center; gap: 0.3rem;
  font-size: 0.8rem; font-weight: bold; letter-spacing: 0.06em;
  padding: 0.25rem 0.6rem; border-radius: 0.3rem;
  text-transform: uppercase; white-space: nowrap;
}
.assigned-status  { background: rgba(153,204,255,0.04); border: 0.0625rem solid rgba(153,204,255,0.15); color: #556; }
.submitted-status { background: rgba(153,204,255,0.1); border: 0.0625rem solid rgba(153,204,255,0.3); color: #99ccff; }
.started-status   { background: rgba(105,240,174,0.08); border: 0.0625rem solid rgba(105,240,174,0.3); color: #69f0ae; }
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

.overdue-row { cursor: pointer; }
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

/* Upload inline confirm step */
.upload-confirm-section {
  display: flex; flex-direction: column; gap: 0.75rem;
  border-top: 1px solid rgba(105,240,174,0.2);
  padding-top: 0.75rem; margin-top: 0.25rem;
}
.upload-confirm-msg {
  display: flex; align-items: flex-start; gap: 0.75rem;
}
.upload-confirm-icon { font-size: 1.4rem; flex-shrink: 0; line-height: 1.3; }
.upload-confirm-title {
  font-size: 0.85rem; font-weight: bold; letter-spacing: 0.08em;
  color: #69f0ae; margin-bottom: 0.25rem;
}
.upload-confirm-detail {
  font-size: 0.82rem; color: #aabbcc; line-height: 1.45;
}
.upload-confirm-detail strong { color: #cce0ff; }

/* Generic action confirm modal */
.confirm-action-modal { max-width: 26rem; }
.confirm-action-header {
  display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 1rem;
}
.confirm-action-icon { font-size: 1.5rem; flex-shrink: 0; line-height: 1; margin-top: 0.15rem; }
.confirm-action-body { font-size: 0.88rem; color: #aabbcc; margin-top: 0.35rem; line-height: 1.5; }

.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }

/* ── Mission detail panel (slide-in from right) ──────────────────────────── */

/* Backdrop */
.panel-backdrop-enter-active, .panel-backdrop-leave-active { transition: opacity 0.25s ease; }
.panel-backdrop-enter-from,   .panel-backdrop-leave-to     { opacity: 0; }
.detail-panel-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 200;
}

/* Panel */
.panel-slide-enter-active { transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
.panel-slide-leave-active  { transition: transform 0.22s ease-in; }
.panel-slide-enter-from, .panel-slide-leave-to { transform: translateX(100%); }

.detail-panel {
  position: fixed; right: 0; top: 0; bottom: 0;
  width: 440px; max-width: 100vw;
  background: linear-gradient(180deg, #101828 0%, #0c1622 100%);
  border-left: 1px solid rgba(51, 102, 255, 0.25);
  box-shadow: -6px 0 32px rgba(0, 0, 0, 0.55);
  z-index: 201;
  display: flex; flex-direction: column;
  overflow: hidden;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

.detail-panel-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 1rem; padding: 1.25rem 1.25rem 1rem;
  border-bottom: 1px solid rgba(51, 102, 255, 0.15);
  flex-shrink: 0;
}
.detail-panel-head-text { min-width: 0; }
.detail-panel-title {
  color: #ff9900; font-size: 1.2rem; font-weight: bold;
  letter-spacing: 0.08em; line-height: 1.25;
}

.detail-panel-body {
  flex: 1; overflow-y: auto; padding: 1rem 1.25rem;
  display: flex; flex-direction: column; gap: 1rem;
}

.game-logo-link {
  display: block;
  border-radius: 0.5rem;
  overflow: hidden;
  background: rgba(0, 10, 25, 0.6);
  border: 0.0625rem solid rgba(153, 204, 255, 0.12);
  transition: border-color 0.2s, box-shadow 0.2s;
  text-decoration: none;
}
.game-logo-link:hover {
  border-color: rgba(153, 204, 255, 0.35);
  box-shadow: 0 0 14px rgba(100, 160, 255, 0.15);
}
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
.game-logo-img {
  display: block;
  width: 100%;
  max-height: 90px;
  object-fit: contain;
  padding: 0.75rem 1.25rem;
}

.detail-panel-foot {
  flex-shrink: 0; padding: 0.9rem 1.25rem;
  border-top: 1px solid rgba(51, 102, 255, 0.15);
  display: flex; gap: 0.6rem; justify-content: flex-end; flex-wrap: wrap;
  background: rgba(10, 18, 32, 0.8);
}

.detail-meta {
  display: flex; gap: 1rem; margin-top: 0.4rem;
  font-size: 0.8rem; align-items: center;
}
.detail-points { color: #667788; font-family: 'Antonio', sans-serif; letter-spacing: 0.05em; }

.detail-close-btn {
  background: none; border: none; color: #6688aa;
  cursor: pointer; font-size: 1.1rem; padding: 0.1rem 0.3rem; flex-shrink: 0;
}
.detail-close-btn:hover { color: #99ccff; }

.detail-description {
  font-family: 'Roboto', sans-serif;
  font-size: 0.9rem;
  color: #aabbcc;
  line-height: 1.6;
  padding: 0.75rem 1rem;
  background: rgba(51, 102, 255, 0.04);
  border: 1px solid rgba(51, 102, 255, 0.12);
  border-radius: 0.4rem;
}

.detail-description :deep(ul),
.detail-description :deep(ol) { margin: 0.25rem 0 0.25rem 1.25rem; padding: 0; }
.detail-description :deep(li) { margin: 0.15rem 0; }
.detail-description :deep(strong) { color: #cce0ff; }

.detail-items { display: flex; flex-direction: column; gap: 0.4rem; }

/* Game result panel inside detail modal */
.game-result-panel {
  display: flex; align-items: flex-start; gap: 0.75rem;
  border-radius: 0.4rem; padding: 0.75rem 0.9rem;
  margin-top: 0.25rem;
}
.game-result-panel--played {
  background: rgba(105,240,174,0.08);
  border: 1px solid rgba(105,240,174,0.25);
}
.game-result-panel--waiting {
  background: rgba(153,204,255,0.05);
  border: 1px solid rgba(153,204,255,0.15);
}
.game-result-icon { font-size: 1.4rem; flex-shrink: 0; line-height: 1.2; }
.game-result-title {
  font-family: 'Antonio', sans-serif; font-size: 0.75rem;
  letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 0.2rem;
}
.game-result-panel--played  .game-result-title { color: #69f0ae; }
.game-result-panel--waiting .game-result-title { color: #778899; }
.game-result-score {
  font-size: 0.95rem; color: #cce0ff;
}
.game-result-score strong { color: #69f0ae; font-size: 1.1rem; }
.game-result-detail { font-size: 0.82rem; color: #667788; line-height: 1.45; }

.detail-items-label {
  font-family: 'Antonio', sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  color: #445566;
}

.mission-card:hover .mission-title { color: #cce0ff; }

.mission-summary {
  font-size: 0.78rem;
  color: #667788;
  margin-top: 0.15rem;
  line-height: 1.3;
}

.lcars-btn {
  background: linear-gradient(90deg, #cc6600, #ff9900);
  border: none; border-radius: 0.4rem; color: black;
  cursor: pointer; font-family: inherit; font-size: 0.95rem;
  font-weight: bold; letter-spacing: 0.08em; padding: 0.6rem 1.4rem;
  transition: opacity 0.2s;
}
.lcars-btn:hover:not(:disabled) { opacity: 0.85; }
.lcars-btn:disabled              { opacity: 0.5; cursor: not-allowed; }
.lcars-btn--ghost  { background: transparent; border: 0.125rem solid #99ccff; color: #99ccff; }
.lcars-btn--danger { background: #c0392b; color: #fff; border: none; }
.lcars-btn--danger:hover:not(:disabled) { background: #e74c3c; }

.log-no-feedback    { font-size: 0.78rem; color: #445; font-style: italic; }
</style>
