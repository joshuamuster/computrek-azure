<template>
  <section class="adventure-page">
    <div class="lcars-text-bar"><span>Mission Library</span></div>

    <div class="library-container">

      <!-- ── Tab switcher ──────────────────────────────────────────────────── -->
      <div class="tab-bar">
        <button
            class="tab-btn"
            :class="{ active: activeTab === 'library' }"
            @click="activeTab = 'library'"
        >LIBRARY</button>
        <button
            class="tab-btn"
            :class="{ active: activeTab === 'deployed' }"
            @click="switchToDeployed"
        >DEPLOYED</button>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- TAB: Library                                                       -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'library'">

        <!-- ── Toolbar ────────────────────────────────────────────────────── -->
        <div class="toolbar">
          <button
              v-if="!isAudit"
              class="lcars-btn"
              :class="{ 'lcars-btn--ghost': showCreate }"
              @click="toggleCreate"
          >{{ showCreate ? 'CANCEL' : '+ NEW MISSION' }}</button>

          <input
              v-model="searchQuery"
              class="lcars-input search-input"
              placeholder="SEARCH MISSIONS..."
          />

          <select v-model="typeFilter" class="lcars-input lcars-select type-select">
            <option value="">ALL TYPES</option>
            <option value="file">📎 FILE UPLOAD</option>
          </select>

          <select v-model="unitFilter" class="lcars-input lcars-select unit-select">
            <option value="">ALL UNITS</option>
            <option v-for="u in UNITS" :key="u.id" :value="u.id">{{ u.label }}</option>
          </select>
        </div>

        <!-- ── Create form ────────────────────────────────────────────────── -->
        <div v-if="showCreate" class="form-panel">
          <div class="form-panel-title">NEW MISSION</div>

          <div class="form-grid">
            <div class="field field--full">
              <label class="field-label">MISSION TITLE *</label>
              <input v-model="createDraft.title" class="lcars-input" placeholder="e.g. Binary Basics Lab" maxlength="120" />
            </div>
            <div class="field field--full">
              <label class="field-label">DESCRIPTION</label>
              <textarea v-model="createDraft.description" class="lcars-input lcars-textarea"
                placeholder="Optional — shown to students on their assignment card." rows="2" />
            </div>
            <div class="field">
              <label class="field-label">SUBMISSION TYPE</label>
              <select v-model="createDraft.type" class="lcars-input lcars-select">
                <option value="file">📎 File Upload</option>
              </select>
            </div>
            <div class="field">
              <label class="field-label">POINTS POSSIBLE</label>
              <input v-model.number="createDraft.pointsPossible" class="lcars-input" type="number" min="0" max="1000" />
            </div>
            <div class="field field--full">
              <label class="field-label">UNIT</label>
              <select v-model="createDraft.unitId" class="lcars-input lcars-select">
                <option value="">No unit assigned</option>
                <option v-for="u in UNITS" :key="u.id" :value="u.id">{{ u.label }}</option>
              </select>
            </div>
          </div>

          <div class="rubric-section">
            <div class="rubric-heading">
              <span class="field-label">RUBRIC CRITERIA</span>
              <span class="rubric-total" v-if="createDraft.rubric.length">
                Total: {{ createDraft.rubric.reduce((s, r) => s + (Number(r.points) || 0), 0) }} pts
              </span>
            </div>
            <div class="rubric-list">
              <div class="rubric-row" v-for="(criterion, i) in createDraft.rubric" :key="i">
                <input v-model="criterion.label" class="lcars-input rubric-label-input" placeholder="e.g. Accuracy" />
                <input v-model.number="criterion.points" class="lcars-input rubric-pts-input" type="number" min="0" max="500" placeholder="pts" />
                <button class="remove-btn" @click="removeRubricRow(createDraft.rubric, i)">✕</button>
              </div>
            </div>
            <button class="add-criterion-btn" @click="addRubricRow(createDraft.rubric)">+ ADD CRITERION</button>
          </div>

          <div class="form-actions">
            <button class="lcars-btn" :disabled="!createDraft.title.trim() || saving" @click="submitCreate">
              {{ saving ? 'SAVING...' : 'SAVE MISSION' }}
            </button>
            <button class="lcars-btn lcars-btn--ghost" :disabled="saving" @click="cancelCreate">CANCEL</button>
          </div>
        </div>

        <!-- ── Status ──────────────────────────────────────────────────────── -->
        <div v-if="isLoading" class="status-msg">LOADING MISSION LIBRARY...</div>
        <div v-else-if="error" class="status-error">{{ error }}</div>
        <div v-else-if="!isLoading && filteredMissions.length === 0" class="status-msg">
          {{ missions.length === 0 ? 'No missions yet. Create your first one above.' : 'No missions match your search.' }}
        </div>

        <!-- ── Mission list ────────────────────────────────────────────────── -->
        <div v-if="filteredMissions.length > 0" class="mission-list">

          <div class="list-header">
            <span>MISSION</span>
            <span>TYPE</span>
            <span>POINTS</span>
            <span>RUBRIC</span>
            <span></span>
          </div>

          <!-- Assign panel (slides in above list when active) -->
          <div v-if="assigningMissionId" class="assign-panel">
            <div class="form-panel-title">
              DEPLOY: {{ missions.find(m => m.id === assigningMissionId)?.title }}
            </div>
            <div class="form-grid assign-grid">
              <div class="field">
                <label class="field-label">PERIOD *</label>
                <select v-model="deployPeriodId" class="lcars-input lcars-select">
                  <option value="">Select period...</option>
                  <option v-for="p in PERIOD_IDS" :key="p.id" :value="p.id">{{ p.label }}</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">DUE DATE <span class="dim-label">(optional — can be set later)</span></label>
                <input v-model="deployDueDate" class="lcars-input" type="date" />
              </div>
              <div class="field field--full">
                <label class="field-label">
                  WARP CORE PHASE
                  <span class="dim-label"> — tag this assignment to track live session energy</span>
                </label>
                <div class="phase-selector">
                  <button
                    class="phase-btn"
                    :class="{ 'phase-btn--active': deployCategory === '', 'phase-btn--none': true }"
                    @click="deployCategory = ''"
                  >None</button>
                  <button
                    class="phase-btn phase-btn--warmup"
                    :class="{ 'phase-btn--active': deployCategory === 'warmUp' }"
                    @click="deployCategory = 'warmUp'"
                  >Warm-Up <span class="phase-weight">20%</span></button>
                  <button
                    class="phase-btn phase-btn--lesson"
                    :class="{ 'phase-btn--active': deployCategory === 'lesson' }"
                    @click="deployCategory = 'lesson'"
                  >Lesson <span class="phase-weight">60%</span></button>
                  <button
                    class="phase-btn phase-btn--extension"
                    :class="{ 'phase-btn--active': deployCategory === 'extension' }"
                    @click="deployCategory = 'extension'"
                  >Extension <span class="phase-weight">20%</span></button>
                </div>
              </div>
            </div>
            <div class="form-actions">
              <button
                  class="lcars-btn lcars-btn--deploy"
                  :disabled="!deployPeriodId || isDeploying"
                  @click="submitDeploy"
              >{{ isDeploying ? 'DEPLOYING...' : 'DEPLOY TO PERIOD' }}</button>
              <button class="lcars-btn lcars-btn--ghost" :disabled="isDeploying" @click="cancelAssign">CANCEL</button>
              <span v-if="deployStatus" class="deploy-status" :class="deployStatus">
                {{ deployStatus === 'ok' ? '✓ Deployed!' : '✗ Deploy failed' }}
              </span>
            </div>
          </div>

          <template v-for="group in groupedMissions" :key="group.unitId || '__ungrouped__'">
          <div class="unit-group-header">
            <span class="unit-group-label">{{ group.label }}</span>
            <span class="unit-group-count">{{ group.missions.length }} {{ group.missions.length === 1 ? 'mission' : 'missions' }}</span>
          </div>
          <div v-for="m in group.missions" :key="m.id" class="mission-row-wrap">

            <!-- View row -->
            <div v-if="editingId !== m.id" class="mission-row">
              <div class="col-mission">
                <span class="mission-title">{{ m.title }}</span>
                <span v-if="m.description" class="mission-desc">{{ m.description }}</span>
              </div>
              <div class="col-type">
                <span class="type-badge" :class="m.type">
                  {{ m.type === 'file' ? '📎 File' : '🎮 Game' }}
                </span>
              </div>
              <div class="col-pts">
                <span class="pts-chip">{{ m.pointsPossible }} pts</span>
              </div>
              <div class="col-rubric">
                <span v-if="m.rubric?.length" class="rubric-count">
                  {{ m.rubric.length }} {{ m.rubric.length === 1 ? 'criterion' : 'criteria' }}
                </span>
                <span v-else class="dim">—</span>
              </div>
              <div class="col-actions" v-if="!isAudit">
                <button class="action-btn assign-btn" @click="openAssign(m)">ASSIGN</button>
                <button class="action-btn edit-btn" @click="openEdit(m)">EDIT</button>
                <button class="action-btn archive-btn" @click="confirmArchive(m)">ARCHIVE</button>
              </div>
              <div class="col-actions" v-else>
                <span class="dim" style="font-size:0.7rem">READ ONLY</span>
              </div>
            </div>

            <!-- Edit row (expanded) -->
            <div v-else class="edit-panel">
              <div class="form-panel-title">EDITING: {{ m.title }}</div>

              <div class="form-grid">
                <div class="field field--full">
                  <label class="field-label">MISSION TITLE *</label>
                  <input v-model="editDraft.title" class="lcars-input" maxlength="120" />
                </div>
                <div class="field field--full">
                  <label class="field-label">DESCRIPTION</label>
                  <textarea v-model="editDraft.description" class="lcars-input lcars-textarea" rows="2" />
                </div>
                <div class="field">
                  <label class="field-label">SUBMISSION TYPE</label>
                  <select v-model="editDraft.type" class="lcars-input lcars-select">
                    <option value="file">📎 File Upload</option>
                  </select>
                </div>
                <div class="field">
                  <label class="field-label">POINTS POSSIBLE</label>
                  <input v-model.number="editDraft.pointsPossible" class="lcars-input" type="number" min="0" max="1000" />
                </div>
                <div class="field field--full">
                  <label class="field-label">UNIT</label>
                  <select v-model="editDraft.unitId" class="lcars-input lcars-select">
                    <option value="">No unit assigned</option>
                    <option v-for="u in UNITS" :key="u.id" :value="u.id">{{ u.label }}</option>
                  </select>
                </div>
              </div>

              <div class="rubric-section">
                <div class="rubric-heading">
                  <span class="field-label">RUBRIC CRITERIA</span>
                  <span class="rubric-total" v-if="editDraft.rubric.length">
                    Total: {{ editDraft.rubric.reduce((s, r) => s + (Number(r.points) || 0), 0) }} pts
                  </span>
                </div>
                <div class="rubric-list">
                  <div class="rubric-row" v-for="(criterion, i) in editDraft.rubric" :key="i">
                    <input v-model="criterion.label" class="lcars-input rubric-label-input" placeholder="e.g. Accuracy" />
                    <input v-model.number="criterion.points" class="lcars-input rubric-pts-input" type="number" min="0" max="500" placeholder="pts" />
                    <button class="remove-btn" @click="removeRubricRow(editDraft.rubric, i)">✕</button>
                  </div>
                </div>
                <button class="add-criterion-btn" @click="addRubricRow(editDraft.rubric)">+ ADD CRITERION</button>
              </div>

              <div class="form-actions">
                <button class="lcars-btn" :disabled="!editDraft.title.trim() || saving" @click="submitEdit">
                  {{ saving ? 'SAVING...' : 'SAVE CHANGES' }}
                </button>
                <button class="lcars-btn lcars-btn--ghost" :disabled="saving" @click="cancelEdit">CANCEL</button>
              </div>
            </div>

          </div>
          </template>
        </div>

      </div><!-- end library tab -->

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- TAB: Deployed                                                      -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <div v-else-if="activeTab === 'deployed'">

        <div v-if="deployedLoading" class="status-msg">LOADING DEPLOYMENTS...</div>
        <div v-else-if="deployedAssignments.length === 0" class="status-msg">
          No missions have been deployed yet. Go to the Library tab and hit ASSIGN.
        </div>

        <div v-else class="deployed-list">
          <div class="deployed-header">
            <span>MISSION</span>
            <span>PERIOD</span>
            <span>PHASE</span>
            <span>DUE DATE</span>
            <span>DEPLOYED</span>
          </div>

          <div
              v-for="a in deployedAssignments"
              :key="a.id"
              class="deployed-row"
              :class="{ editing: editingDueDateId === a.id }"
          >
            <!-- Mission title (joined) -->
            <div class="dep-col-mission">
              <span class="dep-title">{{ deployedMissionMap.get(a.missionId)?.title ?? a.missionId }}</span>
              <span class="dep-type-badge" :class="deployedMissionMap.get(a.missionId)?.type">
                {{ deployedMissionMap.get(a.missionId)?.type === 'game' ? '🎮' : '📎' }}
              </span>
            </div>

            <!-- Period -->
            <div class="dep-col-period">
              <span class="period-chip">{{ periodLabel(a.periodId) }}</span>
            </div>

            <!-- Warp Core phase -->
            <div class="dep-col-phase">
              <span v-if="a.category" :class="['phase-chip', `phase-chip--${a.category}`]">
                {{ a.category === 'warmUp' ? 'Warm-Up' : a.category === 'lesson' ? 'Lesson' : 'Extension' }}
              </span>
              <span v-else class="dim">—</span>
            </div>

            <!-- Due date — display or inline editor -->
            <div class="dep-col-date">
              <template v-if="editingDueDateId === a.id">
                <input
                    v-model="dueDateDraft"
                    class="lcars-input date-input-inline"
                    type="date"
                    autofocus
                />
                <button
                    class="action-btn save-btn-sm"
                    :disabled="dueDateSaving"
                    @click="saveDueDate(a)"
                >{{ dueDateSaving ? '...' : 'SAVE' }}</button>
                <button
                    v-if="a.dueDate"
                    class="action-btn clear-btn-sm"
                    :disabled="dueDateSaving"
                    @click="clearDueDate(a)"
                >CLEAR</button>
                <button
                    class="action-btn cancel-btn-sm"
                    :disabled="dueDateSaving"
                    @click="cancelDateEdit"
                >✕</button>
              </template>
              <template v-else>
                <span
                    class="date-display"
                    :class="{ 'no-date': !a.dueDate }"
                    @click="!isAudit && startDateEdit(a)"
                    :title="!isAudit ? 'Click to set due date' : ''"
                >{{ a.dueDate ? formatDate(a.dueDate) : 'No date set' }}</span>
                <button
                    v-if="!isAudit"
                    class="edit-date-btn"
                    @click="startDateEdit(a)"
                    title="Edit due date"
                >✎</button>
              </template>
            </div>

            <!-- Assigned date -->
            <div class="dep-col-assigned">
              <span class="assigned-date dim">{{ formatTimestamp(a.assignedAt) }}</span>
            </div>
          </div>
        </div>

      </div><!-- end deployed tab -->

    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth.js'
import { useMissions, type Mission, type MissionDraft } from '@/composables/useMissions'
import { useAssignments, type Assignment, type WarpPhase } from '@/composables/useAssignments'
import { PERIOD_IDS, UNITS } from '@/config/schoolYear'

const { isAudit, isAdmin, userInfo, effectiveTeacherEmail } = useAuth()

const {
  missions, isLoading, error,
  fetchMissions, fetchMissionsByIds, createMission, updateMission, archiveMission,
} = useMissions()

const {
  assignments: deployedAssignments,
  isLoading:   deployedLoading,
  deployMission, fetchAssignments, updateAssignment,
} = useAssignments()

// ── Tabs ──────────────────────────────────────────────────────────────────────

const activeTab     = ref<'library' | 'deployed'>('library')
const deployedLoaded = ref(false)

// Deployed mission map for title/type lookups
const deployedMissionMap = ref(new Map<string, Mission>())

async function switchToDeployed() {
  activeTab.value = 'deployed'
  if (deployedLoaded.value) return
  deployedLoaded.value = true
  await fetchAssignments(undefined, teacherScope())
  const ids = [...new Set(deployedAssignments.value.map(a => a.missionId).filter(Boolean))]
  if (ids.length) {
    const ms = await fetchMissionsByIds(ids)
    deployedMissionMap.value = new Map(ms.map(m => [m.id, m]))
  }
}

// ── Inline due date editing ───────────────────────────────────────────────────

const editingDueDateId = ref<string | null>(null)
const dueDateDraft     = ref('')
const dueDateSaving    = ref(false)

function startDateEdit(a: Assignment) {
  editingDueDateId.value = a.id
  dueDateDraft.value     = a.dueDate ?? ''
}

function cancelDateEdit() {
  editingDueDateId.value = null
  dueDateDraft.value     = ''
}

async function saveDueDate(a: Assignment) {
  if (!editingDueDateId.value) return
  dueDateSaving.value = true
  const ok = await updateAssignment(a.id, { dueDate: dueDateDraft.value || null })
  dueDateSaving.value = false
  if (ok) cancelDateEdit()
}

async function clearDueDate(a: Assignment) {
  dueDateSaving.value = true
  const ok = await updateAssignment(a.id, { dueDate: null })
  dueDateSaving.value = false
  if (ok) cancelDateEdit()
}

// ── Library tab: UI state ─────────────────────────────────────────────────────

const showCreate  = ref(false)
const editingId   = ref<string | null>(null)
const saving      = ref(false)
const searchQuery = ref('')
const typeFilter  = ref('')
const unitFilter  = ref('')

const filteredMissions = computed(() => {
  let list = missions.value
  if (unitFilter.value) list = list.filter(m => m.unitId === unitFilter.value)
  if (typeFilter.value) list = list.filter(m => m.type === typeFilter.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) list = list.filter(m =>
    m.title.toLowerCase().includes(q) ||
    m.description?.toLowerCase().includes(q)
  )
  return list
})

// Group filtered missions by unit, in UNITS order, with ungrouped at the end
const groupedMissions = computed(() => {
  const map = new Map<string, typeof missions.value>()
  const ungrouped: typeof missions.value = []
  for (const m of filteredMissions.value) {
    if (m.unitId) {
      if (!map.has(m.unitId)) map.set(m.unitId, [])
      map.get(m.unitId)!.push(m)
    } else {
      ungrouped.push(m)
    }
  }
  const groups: { unitId: string; label: string; missions: typeof missions.value }[] = []
  for (const u of UNITS) {
    if (map.has(u.id)) groups.push({ unitId: u.id, label: u.label, missions: map.get(u.id)! })
  }
  if (ungrouped.length) groups.push({ unitId: '', label: 'No Unit Assigned', missions: ungrouped })
  return groups
})

// ── Draft factories ───────────────────────────────────────────────────────────

function blankDraft(): MissionDraft {
  return { title: '', description: '', type: 'file', pointsPossible: 100, rubric: [], attachments: [], unitId: null }
}

const createDraft = ref<MissionDraft>(blankDraft())
const editDraft   = ref<MissionDraft>(blankDraft())

// ── Rubric helpers ────────────────────────────────────────────────────────────

function addRubricRow(rubric: { label: string; points: number }[]) {
  rubric.push({ label: '', points: 0 })
}
function removeRubricRow(rubric: { label: string; points: number }[], i: number) {
  rubric.splice(i, 1)
}

// ── Create ────────────────────────────────────────────────────────────────────

function toggleCreate() {
  if (showCreate.value) { cancelCreate() }
  else { editingId.value = null; createDraft.value = blankDraft(); showCreate.value = true }
}
function cancelCreate() { showCreate.value = false; createDraft.value = blankDraft() }

async function submitCreate() {
  if (!createDraft.value.title.trim()) return
  saving.value = true
  const id = await createMission({ ...createDraft.value, teacherEmail: effectiveTeacherEmail.value ?? userInfo.value?.email ?? '' })
  saving.value = false
  if (id) { await fetchMissions(teacherScope()); cancelCreate() }
}

// ── Edit ──────────────────────────────────────────────────────────────────────

function openEdit(m: Mission) {
  showCreate.value = false
  editingId.value  = m.id
  editDraft.value  = {
    title: m.title, description: m.description, type: m.type,
    pointsPossible: m.pointsPossible,
    rubric: m.rubric.map(r => ({ ...r })),
    attachments: m.attachments ? [...m.attachments] : [],
    unitId: m.unitId ?? null,
  }
}
function cancelEdit() { editingId.value = null; editDraft.value = blankDraft() }

async function submitEdit() {
  if (!editingId.value || !editDraft.value.title.trim()) return
  saving.value = true
  const ok = await updateMission(editingId.value, editDraft.value)
  saving.value = false
  if (ok) cancelEdit()
}

// ── Archive ───────────────────────────────────────────────────────────────────

async function confirmArchive(m: Mission) {
  if (!confirm(`Archive "${m.title}"?\n\nIt will no longer appear in the library. Existing student submissions are preserved.`)) return
  await archiveMission(m.id)
}

// ── Assign (deploy) ───────────────────────────────────────────────────────────

const assigningMissionId = ref<string | null>(null)
const deployPeriodId     = ref('')
const deployDueDate      = ref('')
const deployCategory     = ref<WarpPhase | ''>('')
const isDeploying        = ref(false)
const deployStatus       = ref<'ok' | 'error' | null>(null)

function openAssign(m: Mission) {
  assigningMissionId.value = m.id
  deployPeriodId.value     = ''
  deployDueDate.value      = ''
  deployCategory.value     = ''
  deployStatus.value       = null
  showCreate.value         = false
  editingId.value          = null
}
function cancelAssign() {
  assigningMissionId.value = null
  deployCategory.value     = ''
  deployStatus.value       = null
}

async function submitDeploy() {
  if (!assigningMissionId.value || !deployPeriodId.value) return
  const mission = missions.value.find(m => m.id === assigningMissionId.value)
  if (!mission) return
  isDeploying.value  = true
  deployStatus.value = null
  const id = await deployMission({
    missionId:    mission.id,
    missionType:  mission.type,
    periodId:     deployPeriodId.value,
    dueDate:      deployDueDate.value || null,
    teacherEmail: effectiveTeacherEmail.value ?? userInfo.value?.email ?? '',
    category:     deployCategory.value || undefined,
  })
  isDeploying.value  = false
  deployStatus.value = id ? 'ok' : 'error'
  if (id) setTimeout(cancelAssign, 1800)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// teacherScope replaced by effectiveTeacherEmail from useAuth
function teacherScope(): string | undefined {
  return effectiveTeacherEmail.value
}

function periodLabel(id: string): string {
  return PERIOD_IDS.find(p => p.id === id)?.label ?? id
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTimestamp(ts: any): string {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(() => fetchMissions(teacherScope()))
</script>

<style scoped>
@import '../assets/styles/classic.css';

.library-container {
  display: flex; flex-direction: column; gap: 1.25rem;
  padding: 1.5rem 2rem 3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

/* ── Tabs ── */
.tab-bar {
  display: flex; gap: 0.25rem;
  border-bottom: 0.125rem solid rgba(255,153,0,0.3);
  padding-bottom: 0;
}
.tab-btn {
  background: transparent; border: none;
  border-bottom: 0.2rem solid transparent;
  color: #556; cursor: pointer; font-family: inherit;
  font-size: 0.85rem; font-weight: bold; letter-spacing: 0.1em;
  padding: 0.5rem 1.25rem; transition: all 0.15s;
  margin-bottom: -0.125rem;
}
.tab-btn:hover { color: #99ccff; }
.tab-btn.active { color: #f96; border-bottom-color: #f96; }

/* ── Toolbar ── */
.toolbar { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
.search-input { flex: 1 1 220px; min-width: 160px; }
.type-select  { flex: 0 1 180px; }
.unit-select  { flex: 0 1 160px; }

/* ── Form panels ── */
.form-panel {
  background: rgba(0,20,50,0.5); border: 0.0625rem solid rgba(153,204,255,0.2);
  border-radius: 0.5rem; padding: 1.25rem 1.5rem;
}
.edit-panel {
  background: rgba(0,20,50,0.6); border: 0.0625rem solid rgba(249,102,0,0.3);
  border-radius: 0.4rem; padding: 1.25rem 1.5rem;
}
.form-panel-title {
  color: #f96; font-size: 0.78rem; font-weight: bold;
  letter-spacing: 0.15em; margin-bottom: 1rem;
}

/* ── Form fields ── */
.form-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 0.75rem 1rem; margin-bottom: 1.25rem;
}
.field       { display: flex; flex-direction: column; gap: 0.3rem; }
.field--full { grid-column: 1 / -1; }
.field-label { color: #99ccff; font-size: 0.75rem; letter-spacing: 0.1em; }

.lcars-input {
  background: rgba(0,0,0,0.35); border: 0.125rem solid #99ccff;
  border-radius: 0.4rem; color: #e6f0ff; font-family: inherit;
  font-size: 1rem; padding: 0.5rem 0.75rem; transition: border-color 0.2s;
}
.lcars-input:focus    { outline: none; border-color: #f96; }
.lcars-input:disabled { opacity: 0.5; cursor: not-allowed; }
.lcars-select option  { background: #16213e; }
.lcars-textarea       { resize: vertical; min-height: 4rem; }

/* ── Rubric builder ── */
.rubric-section    { margin-bottom: 1.25rem; }
.rubric-heading    { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; }
.rubric-total      { color: #f96; font-size: 0.8rem; letter-spacing: 0.06em; }
.rubric-list       { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.5rem; }
.rubric-row        { display: flex; gap: 0.5rem; align-items: center; }
.rubric-label-input { flex: 1; }
.rubric-pts-input  { width: 5rem; text-align: right; flex-shrink: 0; }
.remove-btn {
  background: none; border: none; color: #556; cursor: pointer;
  font-size: 0.9rem; padding: 0.3rem 0.4rem; border-radius: 3px; transition: color 0.15s;
}
.remove-btn:hover { color: #f55; }
.add-criterion-btn {
  background: none; border: 0.0625rem dashed #445; border-radius: 0.4rem;
  color: #556; cursor: pointer; font-family: inherit; font-size: 0.78rem;
  font-weight: bold; letter-spacing: 0.1em; padding: 0.4rem 1rem;
  transition: all 0.15s; width: 100%;
}
.add-criterion-btn:hover { border-color: #89f; color: #89f; }

/* ── Form actions ── */
.form-actions { display: flex; gap: 0.75rem; padding-top: 0.5rem; align-items: center; }

.lcars-btn {
  background: #f96; border: none; border-radius: 0.25rem; color: #000;
  cursor: pointer; font-family: inherit; font-size: 0.85rem; font-weight: bold;
  letter-spacing: 0.1em; padding: 0.5rem 1.25rem; transition: opacity 0.15s;
}
.lcars-btn:hover:not(:disabled) { opacity: 0.85; }
.lcars-btn:disabled              { opacity: 0.5; cursor: not-allowed; }
.lcars-btn--ghost  { background: transparent; border: 0.0625rem solid #445; color: #99ccff; }
.lcars-btn--deploy { background: #69f0ae; color: #000; }
.lcars-btn--deploy:hover:not(:disabled) { opacity: 0.85; }

/* ── Mission list ── */
.mission-list { display: flex; flex-direction: column; gap: 0.35rem; }

/* ── Unit group headers ── */
.unit-group-header {
  display: flex; align-items: baseline; gap: 0.75rem;
  padding: 0.65rem 0.75rem 0.3rem;
  margin-top: 0.5rem;
  border-bottom: 0.0625rem solid rgba(249,102,0,0.25);
}
.unit-group-header:first-of-type { margin-top: 0; }
.unit-group-label {
  color: #f96; font-size: 0.78rem; font-weight: bold; letter-spacing: 0.14em;
  text-transform: uppercase;
}
.unit-group-count { color: #445; font-size: 0.72rem; letter-spacing: 0.06em; }

.list-header {
  display: grid; grid-template-columns: 1fr 110px 80px 110px 220px;
  padding: 0.35rem 0.75rem; color: #445; font-size: 0.72rem; letter-spacing: 0.12em;
  border-bottom: 0.0625rem solid rgba(153,204,255,0.1);
}
.mission-row-wrap { border-radius: 0.4rem; overflow: hidden; }
.mission-row {
  display: grid; grid-template-columns: 1fr 110px 80px 110px 220px;
  align-items: center; gap: 0.5rem; padding: 0.7rem 0.75rem;
  background: rgba(0,30,60,0.35); border: 0.0625rem solid rgba(153,204,255,0.08);
  border-radius: 0.4rem; transition: background 0.15s;
}
.mission-row:hover { background: rgba(0,40,80,0.5); }

.col-mission { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.mission-title {
  color: #e6f0ff; font-size: 0.95rem; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mission-desc { color: #445; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.type-badge {
  display: inline-block; font-size: 0.75rem; letter-spacing: 0.04em;
  padding: 0.15rem 0.5rem; border-radius: 3px; font-weight: bold;
}
.type-badge.file { background: rgba(137,153,255,0.15); color: #89f; }
.type-badge.game { background: rgba(249,102,0,0.15);   color: #f96; }

.pts-chip     { color: #fa0; font-size: 0.85rem; font-weight: bold; }
.rubric-count { color: #556; font-size: 0.82rem; }

.col-actions  { display: flex; gap: 0.4rem; justify-content: flex-end; }

.action-btn {
  border: 0.0625rem solid; border-radius: 0.25rem; cursor: pointer;
  font-family: inherit; font-size: 0.72rem; font-weight: bold;
  letter-spacing: 0.08em; padding: 0.25rem 0.6rem;
  transition: all 0.15s; background: transparent;
}
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.assign-btn        { border-color: #69f0ae; color: #69f0ae; }
.assign-btn:hover  { background: rgba(105,240,174,0.12); }
.edit-btn          { border-color: #89f; color: #89f; }
.edit-btn:hover    { background: rgba(137,153,255,0.15); }
.archive-btn       { border-color: #445; color: #556; }
.archive-btn:hover { border-color: #f55; color: #f55; }

/* ── Assign panel ── */
.assign-panel {
  background: rgba(0,30,20,0.6); border: 0.0625rem solid rgba(105,240,174,0.3);
  border-radius: 0.5rem; padding: 1.25rem 1.5rem; margin-bottom: 0.35rem;
}
.assign-grid { margin-bottom: 1rem; }
.dim-label   { color: #445; font-size: 0.7rem; letter-spacing: 0; text-transform: none; }

.deploy-status       { font-size: 0.85rem; font-weight: bold; }
.deploy-status.ok    { color: #69f0ae; }
.deploy-status.error { color: #f55; }

/* ── Deployed tab ── */
.deployed-list { display: flex; flex-direction: column; gap: 0.35rem; }

.deployed-header {
  display: grid; grid-template-columns: 1fr 120px 90px 200px 120px;
  padding: 0.35rem 0.75rem; color: #445; font-size: 0.72rem; letter-spacing: 0.12em;
  border-bottom: 0.0625rem solid rgba(153,204,255,0.1);
}

.deployed-row {
  display: grid; grid-template-columns: 1fr 120px 90px 200px 120px;
  align-items: center; gap: 0.5rem; padding: 0.6rem 0.75rem;
  background: rgba(0,30,60,0.35); border: 0.0625rem solid rgba(153,204,255,0.08);
  border-radius: 0.4rem; transition: background 0.15s;
}
.deployed-row:hover     { background: rgba(0,40,80,0.5); }
.deployed-row.editing   { border-color: rgba(255,153,0,0.3); background: rgba(20,15,0,0.4); }

.dep-col-mission { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.dep-title {
  color: #e6f0ff; font-size: 0.92rem; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dep-type-badge { font-size: 1rem; flex-shrink: 0; }

.dep-col-period { }
.period-chip    { color: #99ccff; font-size: 0.82rem; letter-spacing: 0.05em; }

/* Due date cell */
.dep-col-date { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.date-display {
  color: #69f0ae; font-size: 0.85rem; font-weight: bold;
  cursor: pointer; transition: color 0.15s;
}
.date-display:hover  { color: #ff9900; }
.date-display.no-date { color: #445; font-style: italic; font-weight: normal; }
.edit-date-btn {
  background: none; border: none; color: #445; cursor: pointer;
  font-size: 0.85rem; padding: 0 0.15rem; transition: color 0.15s; line-height: 1;
}
.edit-date-btn:hover { color: #ff9900; }
.date-input-inline {
  font-size: 0.82rem; padding: 0.2rem 0.5rem; max-width: 130px;
}
.save-btn-sm   { border-color: #69f0ae; color: #69f0ae; }
.save-btn-sm:hover { background: rgba(105,240,174,0.12); }
.clear-btn-sm  { border-color: #445; color: #556; }
.clear-btn-sm:hover { border-color: #f55; color: #f55; }
.cancel-btn-sm { border-color: #334; color: #445; }
.cancel-btn-sm:hover { color: #99ccff; border-color: #99ccff; }

.dep-col-assigned { }
.assigned-date    { font-size: 0.78rem; }

/* ── Warp Core phase selector (deploy panel) ── */
.phase-selector {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.phase-btn {
  padding: 0.35rem 0.85rem;
  border-radius: 4px;
  border: 1px solid rgba(153, 204, 255, 0.2);
  background: rgba(0, 20, 45, 0.5);
  color: #6688aa;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.phase-weight {
  opacity: 0.6;
  font-weight: 400;
  margin-left: 0.3em;
}

.phase-btn--none.phase-btn--active {
  background: rgba(153, 204, 255, 0.1);
  border-color: rgba(153, 204, 255, 0.35);
  color: #99ccff;
}

.phase-btn--warmup         { border-color: rgba(77, 200, 216, 0.25); }
.phase-btn--warmup:hover   { background: rgba(77, 200, 216, 0.1); color: #4dc8d8; border-color: #4dc8d8; }
.phase-btn--warmup.phase-btn--active {
  background: rgba(77, 200, 216, 0.15);
  border-color: #4dc8d8;
  color: #4dc8d8;
}

.phase-btn--lesson         { border-color: rgba(77, 136, 238, 0.25); }
.phase-btn--lesson:hover   { background: rgba(77, 136, 238, 0.1); color: #4d88ee; border-color: #4d88ee; }
.phase-btn--lesson.phase-btn--active {
  background: rgba(77, 136, 238, 0.15);
  border-color: #4d88ee;
  color: #4d88ee;
}

.phase-btn--extension         { border-color: rgba(136, 85, 204, 0.25); }
.phase-btn--extension:hover   { background: rgba(136, 85, 204, 0.1); color: #8855cc; border-color: #8855cc; }
.phase-btn--extension.phase-btn--active {
  background: rgba(136, 85, 204, 0.15);
  border-color: #8855cc;
  color: #8855cc;
}

/* ── Warp Core phase badge (deployed list) ── */
.dep-col-phase { display: flex; align-items: center; }

.phase-chip {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.15rem 0.45rem;
  border-radius: 3px;
  border: 1px solid currentColor;
}

.phase-chip--warmup    { color: #4dc8d8; background: rgba(77,200,216,0.1); }
.phase-chip--lesson    { color: #4d88ee; background: rgba(77,136,238,0.1); }
.phase-chip--extension { color: #8855cc; background: rgba(136,85,204,0.1); }

/* ── Status / shared ── */
.status-msg   { color: #99ccff; font-size: 1rem; text-align: center; padding: 3rem 0; opacity: 0.7; }
.status-error { color: #f55;    font-size: 1rem; text-align: center; padding: 2rem 0; }
.dim { color: #445; }
</style>
