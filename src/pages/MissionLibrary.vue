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
              @click="toggleCreate"
          >+ NEW MISSION</button>

          <input
              v-model="searchQuery"
              class="lcars-input search-input"
              placeholder="SEARCH MISSIONS..."
          />

          <select v-model="typeFilter" class="lcars-input lcars-select type-select">
            <option value="">ALL TYPES</option>
            <option value="file">📎 FILE UPLOAD</option>
            <option value="manual">📋 MANUAL</option>
            <option value="game">🎮 SIMULATION</option>
          </select>

          <select v-model="unitFilter" class="lcars-input lcars-select unit-select">
            <option value="">ALL UNITS</option>
            <option v-for="u in UNITS" :key="u.id" :value="u.id">{{ u.label }}</option>
          </select>
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
            <span>PERIODS</span>
            <span></span>
          </div>

          <template v-for="group in groupedMissions" :key="group.unitId || '__ungrouped__'">
          <div class="unit-group-header">
            <span class="unit-group-label">{{ group.label }}</span>
            <span class="unit-group-count">{{ group.missions.length }} {{ group.missions.length === 1 ? 'mission' : 'missions' }}</span>
          </div>
          <div v-for="m in group.missions" :key="m.id" class="mission-row-wrap">

            <!-- View row -->
            <div
              v-if="editingId !== m.id"
              class="mission-row"
              :class="{ 'mission-row--selected': selectedMissionId === m.id, 'mission-row--clickable': !isAudit }"
              @click="!isAudit && toggleSelect(m.id)"
            >
              <div class="col-mission">
                <span class="mission-title">{{ m.title }}</span>
                <span v-if="m.summary" class="mission-summary">{{ m.summary }}</span>
              </div>
              <div class="col-type">
                <template v-if="m.deliveryItems?.length">
                  <span v-for="(item, i) in m.deliveryItems" :key="i" class="type-badge delivery-badge">
                    {{ item.kind === 'pdf' ? '📄' : item.kind === 'link' ? '🔗' : item.kind === 'game' ? '🎮' : '📋' }}
                    {{ item.kind === 'pdf' ? 'PDF' : item.kind === 'link' ? 'Link' : item.kind === 'game' ? 'Simulation' : 'Paper' }}
                  </span>
                </template>
                <template v-else>
                  <span class="type-badge" :class="m.type">
                    {{ m.type === 'file' ? '📎 File' : m.type === 'manual' ? '📋 Manual' : '🎮 Simulation' }}
                  </span>
                </template>
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
              <div class="col-periods">
                <template v-if="missionPeriodsMap.get(m.id)?.length">
                  <span v-for="n in missionPeriodsMap.get(m.id)" :key="n" class="period-num-chip">{{ n }}</span>
                </template>
                <span v-else class="dim">—</span>
              </div>
              <div class="col-chevron">
                <span v-if="!isAudit" class="chevron" :class="{ 'chevron--open': selectedMissionId === m.id }">›</span>
              </div>
            </div>

            <!-- Mission preview panel (visible when mission is loaded) -->
            <div v-if="selectedMissionId === m.id && editingId !== m.id && !isAudit" class="mission-preview-panel">

              <div class="preview-watermark">STUDENT VIEW</div>

              <!-- Title + points -->
              <div class="preview-header">
                <span class="preview-title">{{ m.title }}</span>
                <span class="preview-pts">{{ m.pointsPossible }} pts</span>
              </div>

              <!-- Summary -->
              <div v-if="m.summary" class="preview-summary">{{ m.summary }}</div>

              <!-- Description -->
              <div v-if="hasContent(m.description)" class="preview-description" v-html="m.description"></div>

              <!-- Delivery items -->
              <div v-if="m.deliveryItems?.length" class="preview-materials">
                <div class="preview-block-label">MATERIALS &amp; SUBMISSION</div>
                <div class="preview-item-list">
                  <div v-for="(item, idx) in m.deliveryItems" :key="idx" class="preview-delivery-item">
                    <span class="preview-item-icon">
                      {{ item.kind === 'pdf' ? '📄' : item.kind === 'link' ? '🔗' : item.kind === 'game' ? '🎮' : '📋' }}
                    </span>
                    <div class="preview-item-body">
                      <span class="preview-item-name">
                        <template v-if="item.kind === 'pdf'">{{ item.name || 'PDF Document' }}</template>
                        <template v-else-if="item.kind === 'link'">{{ item.label || 'Link' }}</template>
                        <template v-else-if="item.kind === 'paper'">Printed Handout (from teacher)</template>
                        <template v-else-if="item.kind === 'game'">{{ gameLabel(item) }}</template>
                      </span>
                      <a v-if="(item.kind === 'pdf' || item.kind === 'link') && item.url"
                         :href="item.url" target="_blank" class="preview-item-url">↗ Open</a>
                    </div>
                    <span class="preview-item-method">
                      {{ submissionMethodLabel(item.submissionMethod || (item.kind === 'game' ? 'auto' : 'manual')) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Rubric -->
              <div v-if="m.rubric?.length" class="preview-rubric">
                <div class="preview-block-label">RUBRIC</div>
                <div class="preview-rubric-list">
                  <div v-for="(criterion, ci) in m.rubric" :key="ci" class="preview-rubric-row">
                    <span class="preview-rubric-label">{{ criterion.label }}</span>
                    <span class="preview-rubric-pts">{{ criterion.points }} pts</span>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="preview-actions">
                <button class="action-btn edit-btn"    @click.stop="openEdit(m)">EDIT</button>
                <button class="action-btn assign-btn"  @click.stop="openAssign(m)">ASSIGN</button>
                <button class="action-btn dupe-btn"    @click.stop="duplicateMission(m)">DUPLICATE</button>
                <button class="action-btn archive-btn" @click.stop="confirmArchive(m)">ARCHIVE</button>
                <button
                  v-if="missionPeriodsMap.get(m.id)?.length"
                  class="action-btn recall-btn"
                  @click.stop="confirmRecall(m)"
                  title="Remove this mission from all deployed periods"
                >RECALL</button>
              </div>

            </div>

            <!-- Edit panel (expanded inline) -->
            <div v-if="editingId === m.id" class="edit-panel">
              <div class="form-panel-title">EDITING: {{ m.title }}</div>

              <div class="form-grid">
                <div class="field field--full">
                  <label class="field-label">MISSION TITLE *</label>
                  <input v-model="editDraft.title" class="lcars-input" maxlength="120" />
                </div>
                <div class="field field--full">
                  <label class="field-label">SUMMARY *</label>
                  <input v-model="editDraft.summary" class="lcars-input" placeholder="One-line summary shown in the mission list" maxlength="200" />
                </div>
                <div class="field field--full">
                  <label class="field-label">DESCRIPTION *</label>
                  <RichTextEditor v-model="editDraft.description" />
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
                <div class="field field--full">
                  <label class="field-label">DELIVERY ITEMS</label>
                  <div class="delivery-items-list" v-if="editDraft.deliveryItems.length">
                    <div class="delivery-item-row" v-for="(item, i) in editDraft.deliveryItems" :key="i">
                      <!-- Kind selector: hidden for game items — a static badge replaces it -->
                      <select v-if="item.kind !== 'game'" v-model="item.kind" class="lcars-input lcars-select di-kind-select">
                        <option value="pdf">📄 PDF</option>
                        <option value="link">🔗 Link</option>
                        <option value="paper">📋 Paper</option>
                        <option value="game">🎮 Simulation</option>
                      </select>
                      <span v-else class="di-sim-badge">🎮 Simulation</span>
                      <select v-if="item.kind !== 'game'" v-model="item.submissionMethod" class="lcars-input lcars-select di-method-select">
                        <option value="file-upload">Student Uploads</option>
                        <option value="manual">Teacher Marks Done</option>
                        <option value="auto">Auto-logged</option>
                      </select>
                      <input v-if="item.kind === 'pdf'" v-model="item.name" class="lcars-input di-field" placeholder="Display name (e.g. Worksheet.pdf)" />
                      <input v-if="item.kind === 'pdf'" v-model="item.url" class="lcars-input di-field di-url" placeholder="URL or Google Drive link" />
                      <input v-if="item.kind === 'link'" v-model="item.label" class="lcars-input di-field" placeholder="Label (e.g. Quizlet Set)" />
                      <input v-if="item.kind === 'link'" v-model="item.url" class="lcars-input di-field di-url" placeholder="https://..." />
                      <span v-if="item.kind === 'paper'" class="di-paper-hint">Handed out in class</span>
                      <!-- Game items: family picker → optional difficulty → optional chess variant -->
                      <select
                        v-if="item.kind === 'game'"
                        :value="getGameFamily(item.gameId)"
                        class="lcars-input lcars-select di-game-select"
                        @change="setGameFamily(item, ($event.target as HTMLSelectElement).value)"
                      >
                        <option value="">— Select simulation —</option>
                        <option v-for="g in GAME_OPTIONS_GROUPED" :key="g.id" :value="g.id">{{ g.label }}</option>
                      </select>
                      <select
                        v-if="item.kind === 'game' && getGameDifficulties(getGameFamily(item.gameId)).length"
                        v-model="item.gameId"
                        class="lcars-input lcars-select di-variant-select"
                      >
                        <option v-for="d in getGameDifficulties(getGameFamily(item.gameId))" :key="d.id" :value="d.id">{{ d.label }}</option>
                      </select>
                      <select v-if="item.kind === 'game' && item.gameId === 'chess'" v-model="item.variant" class="lcars-input lcars-select di-variant-select">
                        <option value="">Any variant</option>
                        <option value="standard">Standard</option>
                        <option value="960">Chess 960</option>
                        <option value="crazyhouse">Crazyhouse</option>
                        <option value="koth">King of the Hill</option>
                        <option value="threecheck">Three-Check</option>
                        <option value="antichess">Antichess</option>
                        <option value="horde">Horde</option>
                        <option value="racingkings">Racing Kings</option>
                      </select>
                      <div v-if="item.kind === 'game' && item.gameId" class="di-repeat-row">
                        <span class="di-repeat-label">Play</span>
                        <input
                          type="number" min="1" max="20"
                          :value="item.repeatCount ?? 1"
                          @change="item.repeatCount = Math.max(1, Math.min(20, parseInt(($event.target as HTMLInputElement).value) || 1))"
                          class="lcars-input di-repeat-input"
                        />
                        <span class="di-repeat-label">time{{ (item.repeatCount ?? 1) !== 1 ? 's' : '' }}</span>
                      </div>
                      <button class="remove-btn" @click="editDraft.deliveryItems.splice(i, 1)">✕</button>
                    </div>
                  </div>
                  <div class="delivery-add-row">
                    <button class="add-item-btn" @click="addDeliveryItem(editDraft, { kind: 'pdf',   submissionMethod: 'file-upload' })">+ PDF</button>
                    <button class="add-item-btn" @click="addDeliveryItem(editDraft, { kind: 'link',  submissionMethod: 'manual' })">+ Link</button>
                    <button class="add-item-btn" @click="addDeliveryItem(editDraft, { kind: 'paper', submissionMethod: 'manual' })">+ Paper</button>
                    <button class="add-item-btn" @click="addDeliveryItem(editDraft, { kind: 'game',  submissionMethod: 'auto', gameId: '' })">+ Simulation</button>
                  </div>
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
                <button class="lcars-btn" :disabled="!editDraft.title.trim() || !editDraft.summary.trim() || saving" @click="submitEdit">
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
            <button class="sort-col" :class="{ active: sortCol === 'mission' }" @click="toggleSort('mission')">
              MISSION <span class="sort-arrow">{{ sortCol === 'mission' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span>
            </button>
            <button class="sort-col" :class="{ active: sortCol === 'period' }" @click="toggleSort('period')">
              PERIOD <span class="sort-arrow">{{ sortCol === 'period' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span>
            </button>
            <button class="sort-col" :class="{ active: sortCol === 'phase' }" @click="toggleSort('phase')">
              PHASE <span class="sort-arrow">{{ sortCol === 'phase' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span>
            </button>
            <button class="sort-col" :class="{ active: sortCol === 'dueDate' }" @click="toggleSort('dueDate')">
              DUE DATE <span class="sort-arrow">{{ sortCol === 'dueDate' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span>
            </button>
            <button class="sort-col" :class="{ active: sortCol === 'assignedAt' }" @click="toggleSort('assignedAt')">
              DEPLOYED <span class="sort-arrow">{{ sortCol === 'assignedAt' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span>
            </button>
            <span></span>
          </div>

          <div
              v-for="a in sortedDeployments"
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

            <!-- Delete + Add student -->
            <div class="dep-col-delete">
              <button
                v-if="!isAudit"
                class="action-btn add-student-btn"
                @click="openAddStudentModal(a)"
                title="Add a single student to this deployment"
              >＋ CADET</button>
              <button
                v-if="!isAudit"
                class="action-btn delete-deploy-btn"
                :disabled="deletingAssignmentId === a.id"
                @click="confirmDeleteAssignment(a)"
                title="Delete this deployment and all student submissions"
              >{{ deletingAssignmentId === a.id ? '...' : 'DELETE' }}</button>
            </div>
          </div>
        </div>

      </div><!-- end deployed tab -->

    </div>
  </section>

  <!-- ── Assign / Deploy slideout panel ───────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="backdrop-fade">
      <div v-if="assigningMissionId" class="slideout-backdrop" @click.self="cancelAssign" />
    </Transition>
    <Transition name="cp-slide">
      <div v-if="assigningMissionId" class="slideout-panel" role="dialog" aria-modal="true" aria-label="Deploy Mission">

        <div class="slideout-header">
          <div class="slideout-header-left">
            <span class="slideout-title">DEPLOY MISSION</span>
            <span class="slideout-deploy-subtitle">{{ missions.find(m => m.id === assigningMissionId)?.title }}</span>
          </div>
          <button class="del-modal-close" @click="cancelAssign" title="Close">✕</button>
        </div>

        <div class="slideout-body">
          <div class="slideout-cols">

            <!-- Left: period selection -->
            <div class="slideout-col">
              <div class="field">
                <label class="field-label">PERIODS *</label>
                <div class="period-checkbox-grid">
                  <div class="period-checkbox-col">
                    <label v-for="p in oddPeriods" :key="p.id" class="period-checkbox-label" :class="{ 'already-deployed': alreadyDeployedIds.has(p.id) }">
                      <input type="checkbox" :value="p.id" v-model="deployPeriodIds" class="period-checkbox" :disabled="alreadyDeployedIds.has(p.id)" />
                      {{ p.label }}
                      <span v-if="alreadyDeployedIds.has(p.id)" class="already-tag">deployed</span>
                    </label>
                  </div>
                  <div class="period-checkbox-col">
                    <label v-for="p in evenPeriods" :key="p.id" class="period-checkbox-label" :class="{ 'already-deployed': alreadyDeployedIds.has(p.id) }">
                      <input type="checkbox" :value="p.id" v-model="deployPeriodIds" class="period-checkbox" :disabled="alreadyDeployedIds.has(p.id)" />
                      {{ p.label }}
                      <span v-if="alreadyDeployedIds.has(p.id)" class="already-tag">deployed</span>
                    </label>
                  </div>
                </div>
                <p v-if="!oddPeriods.length && !evenPeriods.length" class="deploy-no-periods">
                  No periods are configured for your account. Contact your administrator.
                </p>
              </div>
            </div>

            <!-- Right: simulation (if applicable), due date + warp phase -->
            <div class="slideout-col">

              <!-- Simulation selector — only shown for missions with a simulation delivery item -->
              <div v-if="deployingIsSimulation" class="field">
                <label class="field-label">SIMULATION *</label>
                <!-- Step 1: pick the game family -->
                <select
                  :value="deployGameFamily"
                  class="lcars-input lcars-select"
                  @change="setDeployGameFamily(($event.target as HTMLSelectElement).value)"
                >
                  <option value="">— Select simulation —</option>
                  <option v-for="g in GAME_OPTIONS_GROUPED" :key="g.id" :value="g.id">{{ g.label }}</option>
                </select>
                <!-- Step 2a: difficulty (Minesweeper / Isolinear / Warp) -->
                <select
                  v-if="getGameDifficulties(deployGameFamily).length"
                  v-model="deployGameId"
                  class="lcars-input lcars-select"
                  style="margin-top:0.5rem"
                >
                  <option v-for="d in getGameDifficulties(deployGameFamily)" :key="d.id" :value="d.id">{{ d.label }}</option>
                </select>
                <!-- Step 2b: Chess variant (optional) -->
                <div v-if="deployGameId === 'chess'" style="margin-top:0.5rem">
                  <select v-model="deployGameVariant" class="lcars-input lcars-select">
                    <option value="">Any variant</option>
                    <option value="standard">Standard</option>
                    <option value="960">Chess 960</option>
                    <option value="crazyhouse">Crazyhouse</option>
                    <option value="koth">King of the Hill</option>
                    <option value="threecheck">Three-Check</option>
                    <option value="antichess">Antichess</option>
                    <option value="horde">Horde</option>
                    <option value="racingkings">Racing Kings</option>
                  </select>
                </div>
                <p v-if="!deployGameId" class="penalty-hint" style="color:#c0392b">Choose which simulation cadets will play for this assignment.</p>
              </div>

              <div class="field">
                <label class="field-label">DUE DATE <span class="dim-label">(optional — can be set later)</span></label>
                <input v-model="deployDueDate" class="lcars-input" type="date" />
              </div>

              <div class="field">
                <label class="field-label">
                  WARP CORE PHASE
                  <span class="dim-label"> — tag this assignment to track live session energy</span>
                </label>
                <div class="phase-selector">
                  <button class="phase-btn" :class="{ 'phase-btn--active': deployCategory === '', 'phase-btn--none': true }" @click="deployCategory = ''">None</button>
                  <button class="phase-btn phase-btn--warmup"    :class="{ 'phase-btn--active': deployCategory === 'warmUp' }"    @click="deployCategory = 'warmUp'">Warm-Up <span class="phase-weight">20%</span></button>
                  <button class="phase-btn phase-btn--lesson"    :class="{ 'phase-btn--active': deployCategory === 'lesson' }"    @click="deployCategory = 'lesson'">Lesson <span class="phase-weight">60%</span></button>
                  <button class="phase-btn phase-btn--extension" :class="{ 'phase-btn--active': deployCategory === 'extension' }" @click="deployCategory = 'extension'">Extension <span class="phase-weight">20%</span></button>
                </div>
              </div>

              <div class="field">
                <label class="field-label">LATE PENALTY <span class="dim-label">(optional)</span></label>
                <div class="penalty-row">
                  <div class="penalty-field">
                    <label class="penalty-sub-label">% per day late</label>
                    <input
                      v-model.number="deployPenaltyPct"
                      class="lcars-input penalty-input"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                    />
                  </div>
                  <div class="penalty-field">
                    <label class="penalty-sub-label">Max penalty %</label>
                    <input
                      v-model.number="deployMaxPenaltyPct"
                      class="lcars-input penalty-input"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                    />
                  </div>
                </div>
                <p class="penalty-hint">
                  e.g. 10% / day capped at 30% = 3 days late → −30 pts on a 100-pt assignment
                </p>
              </div>
            </div>

          </div>
        </div>

        <div class="slideout-footer">
          <button class="lcars-btn lcars-btn--ghost" :disabled="isDeploying" @click="cancelAssign">CANCEL</button>
          <div class="slideout-footer-right">
            <span v-if="deployStatus" class="deploy-status" :class="deployStatus">
              {{ deployStatus === 'ok' ? '✓ Deployed!' : '✗ Deploy failed' }}
            </span>
            <button
              class="lcars-btn lcars-btn--deploy"
              :disabled="!deployPeriodIds.length || isDeploying"
              @click="submitDeploy"
            >{{ isDeploying ? 'DEPLOYING...' : deployPeriodIds.length > 1 ? `DEPLOY TO ${deployPeriodIds.length} PERIODS` : 'DEPLOY TO PERIOD' }}</button>
          </div>
        </div>

      </div>
    </Transition>
  </Teleport>

  <!-- ── Add single student modal ─────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="addStudentModal"
        class="del-modal-overlay"
        @click.self="closeAddStudentModal"
      >
        <div class="del-modal" role="dialog" aria-modal="true">
          <div class="del-modal-header">
            <span class="del-modal-icon">➕</span>
            <div class="del-modal-title-block">
              <h2 class="del-modal-title">ADD CADET TO MISSION</h2>
              <span class="del-modal-subtitle">
                {{ deployedMissionMap.get(addStudentModal.missionId)?.title ?? '—' }}
                · {{ periodLabel(addStudentModal.periodId) }}
              </span>
            </div>
            <button class="del-modal-close" @click="closeAddStudentModal">✕</button>
          </div>
          <div class="del-modal-body">
            <p class="del-modal-desc">
              Select a cadet from {{ periodLabel(addStudentModal.periodId) }} to receive this mission.
              Cadets who already have it are marked <em>assigned</em>.
            </p>
            <div v-if="addStudentLoading" class="add-student-loading">Loading cadets…</div>
            <div v-else class="add-student-picker">
              <input
                v-model="addStudentSearch"
                class="lcars-input add-student-search"
                placeholder="Search by name…"
                autofocus
              />
              <div class="add-student-list">
                <label
                  v-for="s in filteredAddStudents"
                  :key="s.uid"
                  class="add-student-row"
                  :class="{ 'already-has': s.alreadyAssigned }"
                >
                  <input
                    type="radio"
                    :value="s.uid"
                    v-model="addStudentSelectedUid"
                    :disabled="s.alreadyAssigned"
                    class="add-student-radio"
                  />
                  <span class="add-student-name">{{ s.displayName }}</span>
                  <span v-if="s.alreadyAssigned" class="already-tag">assigned</span>
                </label>
                <div v-if="filteredAddStudents.length === 0" class="add-student-empty">
                  No matching cadets found.
                </div>
              </div>
            </div>
          </div>
          <div class="del-modal-actions">
            <button
              class="lcars-btn"
              :disabled="!addStudentSelectedUid || isAddingStudent"
              @click="submitAddStudent"
            >{{ isAddingStudent ? 'ADDING…' : 'ADD CADET' }}</button>
            <button class="lcars-btn lcars-btn--ghost" @click="closeAddStudentModal">CANCEL</button>
            <span v-if="addStudentStatus === 'ok'" class="deploy-status ok">✓ Added!</span>
            <span v-else-if="addStudentStatus === 'error'" class="deploy-status error">✗ Failed</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ── New Mission slideout panel ───────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="backdrop-fade">
      <div v-if="showCreate" class="slideout-backdrop" @click.self="cancelCreate" />
    </Transition>
    <Transition name="cp-slide">
      <div v-if="showCreate" class="slideout-panel" role="dialog" aria-modal="true" aria-label="New Mission">

        <!-- Header -->
        <div class="slideout-header">
          <div class="slideout-header-left">
            <span class="slideout-title">NEW MISSION</span>
            <Transition name="flash-fade">
              <span v-if="saveAndAddFlash" class="save-add-flash">✓ Mission saved!</span>
            </Transition>
          </div>
          <button class="del-modal-close" @click="cancelCreate" title="Close">✕</button>
        </div>

        <!-- Scrollable body -->
        <div class="slideout-body">

          <!-- Two-column section -->
          <div class="slideout-cols">

            <!-- Left column: metadata fields -->
            <div class="slideout-col">
              <div class="field">
                <label class="field-label">MISSION TYPE</label>
                <select
                  v-model="createMissionKind"
                  class="lcars-input lcars-select"
                  @change="applyMissionTypePreset(createMissionKind)"
                >
                  <option value="">— Select a type to apply defaults —</option>
                  <option value="lesson">📚 Lesson (10 pts)</option>
                  <option value="project">📐 Project (50 pts)</option>
                  <option value="game">🎮 Simulation (5 pts)</option>
                  <option value="custom">⚙️ Custom</option>
                </select>
              </div>

              <div class="field">
                <label class="field-label">MISSION TITLE *</label>
                <input
                  ref="titleInputRef"
                  v-model="createDraft.title"
                  class="lcars-input"
                  placeholder="e.g. Binary Basics Lab"
                  maxlength="120"
                />
              </div>

              <div class="field">
                <label class="field-label">SUMMARY *</label>
                <input
                  v-model="createDraft.summary"
                  class="lcars-input"
                  placeholder="One-line summary shown in the mission list"
                  maxlength="200"
                />
              </div>

              <div class="field">
                <label class="field-label">UNIT</label>
                <select v-model="createDraft.unitId" class="lcars-input lcars-select">
                  <option value="">No unit assigned</option>
                  <option v-for="u in UNITS" :key="u.id" :value="u.id">{{ u.label }}</option>
                </select>
              </div>

              <div class="field">
                <label class="field-label">POINTS POSSIBLE</label>
                <input v-model.number="createDraft.pointsPossible" class="lcars-input" type="number" min="0" max="1000" />
              </div>
            </div>

            <!-- Right column: delivery + rubric -->
            <div class="slideout-col">
              <div class="field">
                <label class="field-label">DELIVERY ITEMS</label>
                <div class="delivery-items-list" v-if="createDraft.deliveryItems.length">
                  <div class="delivery-item-row" v-for="(item, i) in createDraft.deliveryItems" :key="i">
                    <!-- Kind selector: hidden for game items — a static badge replaces it -->
                    <select v-if="item.kind !== 'game'" v-model="item.kind" class="lcars-input lcars-select di-kind-select">
                      <option value="pdf">📄 PDF</option>
                      <option value="link">🔗 Link</option>
                      <option value="paper">📋 Paper</option>
                      <option value="game">🎮 Simulation</option>
                    </select>
                    <span v-else class="di-sim-badge">🎮 Simulation</span>
                    <select v-if="item.kind !== 'game'" v-model="item.submissionMethod" class="lcars-input lcars-select di-method-select">
                      <option value="file-upload">Student Uploads</option>
                      <option value="manual">Teacher Marks Done</option>
                      <option value="auto">Auto-logged</option>
                    </select>
                    <input v-if="item.kind === 'pdf'" v-model="item.name" class="lcars-input di-field" placeholder="Display name (e.g. Worksheet.pdf)" />
                    <input v-if="item.kind === 'pdf'" v-model="item.url" class="lcars-input di-field di-url" placeholder="URL or Google Drive link" />
                    <input v-if="item.kind === 'link'" v-model="item.label" class="lcars-input di-field" placeholder="Label (e.g. Quizlet Set)" />
                    <input v-if="item.kind === 'link'" v-model="item.url" class="lcars-input di-field di-url" placeholder="https://..." />
                    <span v-if="item.kind === 'paper'" class="di-paper-hint">Handed out in class</span>
                    <!-- Game items: family picker → optional difficulty → optional chess variant -->
                    <select
                      v-if="item.kind === 'game'"
                      :value="getGameFamily(item.gameId)"
                      class="lcars-input lcars-select di-game-select"
                      @change="setGameFamily(item, ($event.target as HTMLSelectElement).value)"
                    >
                      <option value="">— Select simulation —</option>
                      <option v-for="g in GAME_OPTIONS_GROUPED" :key="g.id" :value="g.id">{{ g.label }}</option>
                    </select>
                    <select
                      v-if="item.kind === 'game' && getGameDifficulties(getGameFamily(item.gameId)).length"
                      v-model="item.gameId"
                      class="lcars-input lcars-select di-variant-select"
                    >
                      <option v-for="d in getGameDifficulties(getGameFamily(item.gameId))" :key="d.id" :value="d.id">{{ d.label }}</option>
                    </select>
                    <select v-if="item.kind === 'game' && item.gameId === 'chess'" v-model="item.variant" class="lcars-input lcars-select di-variant-select">
                      <option value="">Any variant</option>
                      <option value="standard">Standard</option>
                      <option value="960">Chess 960</option>
                      <option value="crazyhouse">Crazyhouse</option>
                      <option value="koth">King of the Hill</option>
                      <option value="threecheck">Three-Check</option>
                      <option value="antichess">Antichess</option>
                      <option value="horde">Horde</option>
                      <option value="racingkings">Racing Kings</option>
                    </select>
                    <div v-if="item.kind === 'game' && item.gameId" class="di-repeat-row">
                      <span class="di-repeat-label">Play</span>
                      <input
                        type="number" min="1" max="20"
                        :value="item.repeatCount ?? 1"
                        @change="item.repeatCount = Math.max(1, Math.min(20, parseInt(($event.target as HTMLInputElement).value) || 1))"
                        class="lcars-input di-repeat-input"
                      />
                      <span class="di-repeat-label">time{{ (item.repeatCount ?? 1) !== 1 ? 's' : '' }}</span>
                    </div>
                    <button class="remove-btn" @click="createDraft.deliveryItems.splice(i, 1)">✕</button>
                  </div>
                </div>
                <div class="delivery-add-row">
                  <button class="add-item-btn" @click="addDeliveryItem(createDraft, { kind: 'pdf',   submissionMethod: 'file-upload' })">+ PDF</button>
                  <button class="add-item-btn" @click="addDeliveryItem(createDraft, { kind: 'link',  submissionMethod: 'manual' })">+ Link</button>
                  <button class="add-item-btn" @click="addDeliveryItem(createDraft, { kind: 'paper', submissionMethod: 'manual' })">+ Paper</button>
                  <button class="add-item-btn" @click="addDeliveryItem(createDraft, { kind: 'game',  submissionMethod: 'auto', gameId: '' })">+ Simulation</button>
                </div>
              </div>

              <!-- Rubric builder -->
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
            </div>

          </div><!-- end slideout-cols -->

          <!-- Full-width description strip -->
          <div class="slideout-description-strip">
            <label class="field-label">DESCRIPTION</label>
            <RichTextEditor v-model="createDraft.description" />
          </div>

        </div><!-- end slideout-body -->

        <!-- Sticky footer -->
        <div class="slideout-footer">
          <button class="lcars-btn lcars-btn--ghost" :disabled="saving" @click="cancelCreate">CANCEL</button>
          <div class="slideout-footer-right">
            <button class="lcars-btn lcars-btn--ghost" :disabled="!canSave" @click="submitSaveAndAdd">
              {{ saving ? 'SAVING...' : 'SAVE &amp; ADD ANOTHER' }}
            </button>
            <button class="lcars-btn" :disabled="!canSave" @click="submitCreate">
              {{ saving ? 'SAVING...' : 'SAVE MISSION' }}
            </button>
          </div>
        </div>

      </div>
    </Transition>
  </Teleport>

  <!-- ── Delete deployment confirm modal ───────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="deleteModalAssignment"
        class="del-modal-overlay"
        @click.self="deleteModalAssignment = null"
      >
        <div class="del-modal" role="dialog" aria-modal="true">
          <div class="del-modal-header">
            <span class="del-modal-icon">⚠️</span>
            <div class="del-modal-title-block">
              <h2 class="del-modal-title">DELETE DEPLOYMENT</h2>
              <span class="del-modal-subtitle">This action cannot be undone</span>
            </div>
            <button class="del-modal-close" @click="deleteModalAssignment = null">✕</button>
          </div>
          <div class="del-modal-body">
            <p class="del-modal-desc">
              You are about to delete the deployment of
              <strong>{{ deployedMissionMap.get(deleteModalAssignment.missionId)?.title ?? deleteModalAssignment.missionId }}</strong>
              for <strong>{{ periodLabel(deleteModalAssignment.periodId) }}</strong>.
            </p>
            <div class="del-modal-warning">
              This will permanently remove the assignment and <strong>all student submissions</strong> for it.
            </div>
          </div>
          <div class="del-modal-actions">
            <button
              class="lcars-btn lcars-btn--danger"
              :disabled="deletingAssignmentId === deleteModalAssignment.id"
              @click="doDeleteAssignment"
            >{{ deletingAssignmentId ? 'DELETING...' : 'DELETE DEPLOYMENT' }}</button>
            <button
              class="lcars-btn lcars-btn--ghost"
              :disabled="!!deletingAssignmentId"
              @click="deleteModalAssignment = null"
            >CANCEL</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ── Archive mission modal ─────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="archiveModalMission"
        class="del-modal-overlay"
        @click.self="archiveModalMission = null"
      >
        <div class="del-modal" role="dialog" aria-modal="true">
          <div class="del-modal-header">
            <span class="del-modal-icon">🗄️</span>
            <div class="del-modal-title-block">
              <h2 class="del-modal-title">ARCHIVE MISSION</h2>
              <span class="del-modal-subtitle">Hide from the library</span>
            </div>
            <button class="del-modal-close" @click="archiveModalMission = null">✕</button>
          </div>
          <div class="del-modal-body">
            <p class="del-modal-desc">
              You are about to archive
              <strong>{{ archiveModalMission.title }}</strong>.
            </p>
            <div class="del-modal-warning">
              It will no longer appear in the Mission Library.
              Existing student submissions are preserved and grades are unaffected.
            </div>
          </div>
          <div class="del-modal-actions">
            <button
              class="lcars-btn lcars-btn--danger"
              :disabled="isArchiving"
              @click="doArchive"
            >{{ isArchiving ? 'ARCHIVING…' : 'ARCHIVE MISSION' }}</button>
            <button
              class="lcars-btn lcars-btn--ghost"
              :disabled="isArchiving"
              @click="archiveModalMission = null"
            >CANCEL</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ── Recall mission modal ──────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="recallModalMission"
        class="del-modal-overlay"
        @click.self="recallModalMission = null"
      >
        <div class="del-modal" role="dialog" aria-modal="true">
          <div class="del-modal-header">
            <span class="del-modal-icon">📡</span>
            <div class="del-modal-title-block">
              <h2 class="del-modal-title">RECALL MISSION</h2>
              <span class="del-modal-subtitle">Remove from all deployed periods</span>
            </div>
            <button class="del-modal-close" @click="recallModalMission = null">✕</button>
          </div>
          <div class="del-modal-body">
            <p class="del-modal-desc">
              You are about to recall
              <strong>{{ recallModalMission.title }}</strong>
              from
              <strong>
                {{ recallAffectedPeriods.map(id => periodLabel(id)).join(', ') }}
              </strong>.
            </p>
            <div class="del-modal-warning">
              This will permanently remove the assignment and
              <strong>all student submissions</strong> for each of those periods.
              This cannot be undone.
            </div>
          </div>
          <div class="del-modal-actions">
            <button
              class="lcars-btn lcars-btn--danger"
              :disabled="isRecalling"
              @click="doRecall"
            >{{ isRecalling ? 'RECALLING…' : `RECALL FROM ${recallAffectedPeriods.length} PERIOD${recallAffectedPeriods.length !== 1 ? 'S' : ''}` }}</button>
            <button
              class="lcars-btn lcars-btn--ghost"
              :disabled="isRecalling"
              @click="recallModalMission = null"
            >CANCEL</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useAuth } from '@/composables/useAuth.js'
import { useMissions, type Mission, type MissionDraft, type DeliveryItem } from '@/composables/useMissions'
import RichTextEditor from '@/components/RichTextEditor.vue'
import { useAssignments, type Assignment, type WarpPhase } from '@/composables/useAssignments'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { PERIOD_IDS, UNITS } from '@/config/schoolYear'

// All games that support auto-logged submissions via useGameScores.
// The id must match the gameId string passed to useGameScores() in the game.
// ── Game options — grouped structure ────────────────────────────────────────
// Single-option games have no `difficulties` array.
// Multi-difficulty games have a `difficulties` array; the game picker shows the
// family name first, then a second dropdown for the specific difficulty.

interface GameDifficulty { id: string; label: string }
interface GameOption     { id: string; label: string; difficulties?: GameDifficulty[] }

const GAME_OPTIONS_GROUPED: GameOption[] = [
  { id: 'chess',                label: 'Chess' },
  { id: 'picard_maneuver',      label: 'Picard Maneuver' },
  { id: 'battle_mutara_nebula', label: 'Battle of Mutara Nebula' },
  { id: 'rules_of_acquisition', label: 'Rules of Acquisition' },
  { id: 'fractured_frontier',   label: 'Fractured Frontier' },
  {
    id: 'minesweeper',
    label: 'Minesweeper',
    difficulties: [
      { id: 'minesweeper_cadet',     label: 'Cadet'     },
      { id: 'minesweeper_standard',  label: 'Standard'  },
      { id: 'minesweeper_red-alert', label: 'Red Alert' },
    ],
  },
  {
    id: 'isolinear',
    label: 'Isolinear Cascade',
    difficulties: [
      { id: 'isolinear_easy',   label: 'Easy'   },
      { id: 'isolinear_medium', label: 'Medium' },
      { id: 'isolinear_hard',   label: 'Hard'   },
    ],
  },
  {
    id: 'warp',
    label: 'Warp Core Breach',
    difficulties: [
      { id: 'warp_easy',   label: 'Easy'   },
      { id: 'warp_medium', label: 'Medium' },
      { id: 'warp_hard',   label: 'Hard'   },
    ],
  },
]

// Flat list derived from grouped — used for GAME_OPTIONS_MAP (backward compat)
const GAME_OPTIONS = GAME_OPTIONS_GROUPED.flatMap(g =>
  g.difficulties
    ? g.difficulties.map(d => ({ id: d.id, label: `${g.label} — ${d.label}` }))
    : [{ id: g.id, label: g.label }]
)

// ── Game label helpers ────────────────────────────────────────────────────────

const GAME_OPTIONS_MAP: Record<string, string> = Object.fromEntries(GAME_OPTIONS.map(g => [g.id, g.label]))

/** Given a full gameId (e.g. 'minesweeper_cadet'), return the family id (e.g. 'minesweeper'). */
function getGameFamily(gameId: string): string {
  if (!gameId) return ''
  for (const g of GAME_OPTIONS_GROUPED) {
    if (g.difficulties) {
      if (g.difficulties.some(d => d.id === gameId)) return g.id
    } else if (g.id === gameId) {
      return g.id
    }
  }
  return gameId
}

/** Return the difficulty options for a given family, or [] if it has none. */
function getGameDifficulties(family: string): GameDifficulty[] {
  return GAME_OPTIONS_GROUPED.find(g => g.id === family)?.difficulties ?? []
}

/**
 * Called when the family dropdown changes on a delivery item.
 * Defaults to the first difficulty (if the game has any) and clears variant.
 */
function setGameFamily(item: any, family: string): void {
  const group = GAME_OPTIONS_GROUPED.find(g => g.id === family)
  item.gameId  = group?.difficulties ? group.difficulties[0].id : (family || '')
  if (family !== 'chess') item.variant = ''
}

const CHESS_VARIANT_LABELS: Record<string, string> = {
  standard: 'Standard', '960': 'Chess 960', crazyhouse: 'Crazyhouse',
  koth: 'King of the Hill', threecheck: 'Three-Check',
  antichess: 'Antichess', horde: 'Horde', racingkings: 'Racing Kings',
}

function gameLabel(item: any): string {
  if (!item.gameId) return 'Simulation'
  const base = GAME_OPTIONS_MAP[item.gameId] ?? item.gameId ?? 'Simulation'
  if (item.gameId === 'chess' && item.variant) {
    return `${base} — ${CHESS_VARIANT_LABELS[item.variant] ?? item.variant}`
  }
  return base
}

function submissionMethodLabel(method: string): string {
  if (method === 'file-upload') return 'Student uploads file'
  if (method === 'manual')      return 'Teacher marks done'
  if (method === 'auto')        return 'Auto-logged'
  return method
}

const { isAudit, isAdmin, userInfo, effectiveTeacherEmail } = useAuth()

const {
  missions, isLoading, error,
  fetchMissions, fetchMissionsByIds, createMission, updateMission, archiveMission,
} = useMissions()

const {
  assignments: deployedAssignments,
  isLoading:   deployedLoading,
  deployMission, fetchAssignments, updateAssignment, deleteAssignment,
  fetchPeriodStudents, addStudentToAssignment,
} = useAssignments()

// ── Tabs ──────────────────────────────────────────────────────────────────────

const activeTab     = ref<'library' | 'deployed'>('library')
const deployedLoaded = ref(false)

// Deployed mission map for title/type lookups
const deployedMissionMap = ref(new Map<string, Mission>())

// ── Deployed tab sort ─────────────────────────────────────────────────────────

type SortCol = 'mission' | 'period' | 'phase' | 'dueDate' | 'assignedAt'
const sortCol = ref<SortCol>('assignedAt')
const sortDir = ref<'asc' | 'desc'>('desc')

function toggleSort(col: SortCol) {
  if (sortCol.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortCol.value = col
    sortDir.value = col === 'assignedAt' ? 'desc' : 'asc'
  }
}

// missionId → sorted period numbers (e.g. [1, 3, 5])
const missionPeriodsMap = computed(() => {
  const map = new Map<string, number[]>()
  for (const a of deployedAssignments.value) {
    if (!a.missionId || !a.periodId) continue
    const num = parseInt(a.periodId.replace('period-', ''), 10)
    if (isNaN(num)) continue
    const existing = map.get(a.missionId) ?? []
    if (!existing.includes(num)) map.set(a.missionId, [...existing, num].sort((x, y) => x - y))
  }
  return map
})

const sortedDeployments = computed(() => {
  const list = [...deployedAssignments.value]
  const dir  = sortDir.value === 'asc' ? 1 : -1

  return list.sort((a, b) => {
    let av: string | number | null
    let bv: string | number | null

    switch (sortCol.value) {
      case 'mission':
        av = deployedMissionMap.value.get(a.missionId)?.title?.toLowerCase() ?? ''
        bv = deployedMissionMap.value.get(b.missionId)?.title?.toLowerCase() ?? ''
        break
      case 'period':
        av = periodLabel(a.periodId).toLowerCase()
        bv = periodLabel(b.periodId).toLowerCase()
        break
      case 'phase':
        av = a.category ?? ''
        bv = b.category ?? ''
        break
      case 'dueDate':
        // nulls sort last regardless of direction
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        av = a.dueDate
        bv = b.dueDate
        break
      case 'assignedAt':
        av = a.assignedAt?.toMillis?.() ?? 0
        bv = b.assignedAt?.toMillis?.() ?? 0
        break
    }

    if (av! < bv!) return -1 * dir
    if (av! > bv!) return  1 * dir
    return 0
  })
})

async function refreshDeployed() {
  await fetchAssignments(undefined, teacherScope())
  const ids = [...new Set(deployedAssignments.value.map(a => a.missionId).filter(Boolean))]
  if (ids.length) {
    const ms = await fetchMissionsByIds(ids)
    deployedMissionMap.value = new Map(ms.map(m => [m.id, m]))
  }
  deployedLoaded.value = true
}

async function switchToDeployed() {
  activeTab.value = 'deployed'
  if (deployedLoaded.value) return
  await refreshDeployed()
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

const showCreate        = ref(false)
const editingId         = ref<string | null>(null)
const selectedMissionId = ref<string | null>(null)
const saving            = ref(false)
const titleInputRef     = ref<HTMLInputElement | null>(null)
const saveAndAddFlash   = ref(false)

const canSave = computed(() =>
  createDraft.value.title.trim().length > 0 &&
  createDraft.value.summary.trim().length > 0 &&
  !saving.value
)
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the string (or HTML) contains visible text content. */
function hasContent(html: string | null | undefined): boolean {
  if (!html) return false
  return html.replace(/<[^>]*>/g, '').trim().length > 0
}

// ── Draft factories ───────────────────────────────────────────────────────────

function blankDraft(): MissionDraft {
  return { title: '', summary: '', description: '', type: 'file', deliveryItems: [], pointsPossible: 100, rubric: [], attachments: [], unitId: null }
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

// ── Default rubric auto-fill ──────────────────────────────────────────────────

/**
 * Fills the rubric with sensible defaults the first time a delivery item is
 * added. Does nothing if the rubric already has criteria (teacher override).
 *
 * Game missions: single binary criterion — "Mission Completed" (all points).
 * Everything else: three-tier 20/30/50 split — Submitted, Completeness,
 * Accuracy / Quality — with remainder going to quality so totals always match.
 */
function autoFillRubric(draft: MissionDraft, kind: string) {
  if (draft.rubric.length > 0) return   // already has criteria — don't overwrite
  const total = Number(draft.pointsPossible) || 10
  if (kind === 'game') {
    draft.rubric = [{ label: 'Mission Completed', points: total }]
  } else {
    const submitted    = Math.round(total * 0.2)
    const completeness = Math.round(total * 0.3)
    const quality      = total - submitted - completeness
    draft.rubric = [
      { label: 'Submitted',           points: submitted },
      { label: 'Completeness',        points: completeness },
      { label: 'Accuracy / Quality',  points: quality },
    ]
  }
}

const GAME_DEFAULT_DESCRIPTION =
  '<p>Tap the game image above to start recording your session and launch the game. ' +
  'Your result will be captured automatically when you finish — no manual submit needed.</p>'

function addDeliveryItem(draft: MissionDraft, item: Partial<DeliveryItem>) {
  draft.deliveryItems.push(item as DeliveryItem)
  autoFillRubric(draft, item.kind ?? 'other')
  // Auto-fill a student-facing description the first time a game item is added,
  // so students know to tap the logo. Only fills if the field is currently empty.
  if (item.kind === 'game' && !draft.description) {
    draft.description = GAME_DEFAULT_DESCRIPTION
  }
}

// ── Mission type presets ──────────────────────────────────────────────────────

const createMissionKind = ref('')

const MISSION_TYPE_PRESETS: Record<string, { points: number; isGame: boolean }> = {
  lesson:  { points: 10, isGame: false },
  project: { points: 50, isGame: false },
  game:    { points:  5, isGame: true  },
}

function applyMissionTypePreset(kind: string) {
  const preset = MISSION_TYPE_PRESETS[kind]
  if (!preset) return  // 'custom' or blank — do nothing

  createDraft.value.pointsPossible = preset.points
  // Always reset the rubric so switching types always applies fresh defaults,
  // even if criteria were already populated by a previous type selection.
  createDraft.value.rubric = []

  if (preset.isGame) {
    if (createDraft.value.deliveryItems.length === 0) {
      // addDeliveryItem calls autoFillRubric(draft, 'game') internally
      addDeliveryItem(createDraft.value, { kind: 'game', submissionMethod: 'auto', gameId: '' })
    } else {
      // Delivery items already exist — re-fill the rubric directly
      autoFillRubric(createDraft.value, 'game')
    }
  } else {
    autoFillRubric(createDraft.value, 'other')
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

function toggleCreate() {
  if (showCreate.value) { cancelCreate() }
  else {
    editingId.value = null
    selectedMissionId.value = null
    createDraft.value = blankDraft()
    createMissionKind.value = ''
    showCreate.value = true
    nextTick(() => titleInputRef.value?.focus())
  }
}
function cancelCreate() {
  showCreate.value = false
  createDraft.value = blankDraft()
  createMissionKind.value = ''
  saveAndAddFlash.value = false
}

function toggleSelect(id: string) {
  if (selectedMissionId.value === id) {
    selectedMissionId.value = null
    return
  }
  selectedMissionId.value = id
  // Close any edit or create panel that belongs to a different mission
  if (editingId.value && editingId.value !== id) cancelEdit()
  if (assigningMissionId.value) cancelAssign()
  showCreate.value = false
}

async function submitCreate() {
  if (!createDraft.value.title.trim() || !createDraft.value.summary.trim()) return
  saving.value = true
  const id = await createMission({ ...createDraft.value, teacherEmail: effectiveTeacherEmail.value ?? userInfo.value?.email ?? '' })
  saving.value = false
  if (id) { await fetchMissions(teacherScope()); cancelCreate() }
}

/** Save mission, keep the panel open, reset the draft, and focus the title field. */
async function submitSaveAndAdd() {
  if (!createDraft.value.title.trim() || !createDraft.value.summary.trim()) return
  saving.value = true
  const id = await createMission({ ...createDraft.value, teacherEmail: effectiveTeacherEmail.value ?? userInfo.value?.email ?? '' })
  saving.value = false
  if (id) {
    await fetchMissions(teacherScope())
    createDraft.value = blankDraft()
    createMissionKind.value = ''
    saveAndAddFlash.value = true
    setTimeout(() => { saveAndAddFlash.value = false }, 2000)
    await nextTick()
    titleInputRef.value?.focus()
  }
}

/** Duplicate a mission — creates a copy with "Copy of" prefix and opens to it. */
async function duplicateMission(m: Mission) {
  const draft: MissionDraft = {
    title:          `Copy of ${m.title}`,
    summary:        m.summary ?? '',
    description:    m.description,
    type:           m.type,
    deliveryItems:  m.deliveryItems ? m.deliveryItems.map(i => ({ ...i })) : [],
    pointsPossible: m.pointsPossible,
    rubric:         m.rubric.map(r => ({ ...r })),
    attachments:    m.attachments ? [...m.attachments] : [],
    unitId:         m.unitId ?? null,
  }
  const id = await createMission({ ...draft, teacherEmail: effectiveTeacherEmail.value ?? userInfo.value?.email ?? '' })
  if (id) await fetchMissions(teacherScope())
}

// ── Edit ──────────────────────────────────────────────────────────────────────

function openEdit(m: Mission) {
  showCreate.value = false
  editingId.value  = m.id
  editDraft.value  = {
    title: m.title, summary: m.summary ?? '', description: m.description, type: m.type,
    deliveryItems:  m.deliveryItems ? m.deliveryItems.map(i => ({ ...i })) : [],
    pointsPossible: m.pointsPossible,
    rubric:         m.rubric.map(r => ({ ...r })),
    attachments:    m.attachments ? [...m.attachments] : [],
    unitId:         m.unitId ?? null,
  }
}
function cancelEdit() { editingId.value = null; editDraft.value = blankDraft(); /* selectedMissionId preserved — action bar reappears */ }

async function submitEdit() {
  if (!editingId.value || !editDraft.value.title.trim() || !editDraft.value.summary.trim()) return
  saving.value = true
  const ok = await updateMission(editingId.value, editDraft.value)
  saving.value = false
  if (ok) cancelEdit()
}

// ── Archive ───────────────────────────────────────────────────────────────────

const archiveModalMission = ref<Mission | null>(null)
const isArchiving         = ref(false)

function confirmArchive(m: Mission) {
  archiveModalMission.value = m
}

async function doArchive() {
  if (!archiveModalMission.value) return
  isArchiving.value = true
  try {
    await archiveMission(archiveModalMission.value.id)
    if (selectedMissionId.value === archiveModalMission.value.id) selectedMissionId.value = null
  } finally {
    isArchiving.value        = false
    archiveModalMission.value = null
  }
}

// ── Assign (deploy) ───────────────────────────────────────────────────────────

const assigningMissionId  = ref<string | null>(null)
const deployPeriodIds     = ref<string[]>([])
const deployDueDate       = ref('')
const deployCategory      = ref<WarpPhase | ''>('')
const deployPenaltyPct    = ref<number | null>(null)
const deployMaxPenaltyPct = ref<number | null>(null)
const deployGameFamily    = ref('')   // family selection in deploy panel (e.g. 'minesweeper')
const deployGameId        = ref('')   // resolved gameId stamped on submissions
const deployGameVariant   = ref('')

function setDeployGameFamily(family: string): void {
  deployGameFamily.value = family
  const group = GAME_OPTIONS_GROUPED.find(g => g.id === family)
  deployGameId.value      = group?.difficulties ? group.difficulties[0].id : (family || '')
  deployGameVariant.value = ''
}
const isDeploying         = ref(false)
const deployStatus        = ref<'ok' | 'error' | null>(null)

// True only when the mission has a simulation delivery item WITHOUT a gameId already set.
// If gameId was chosen during mission creation, deployMission uses it automatically —
// no need to ask again at deploy time.
const deployingIsSimulation = computed(() => {
  if (!assigningMissionId.value) return false
  const m = missions.value.find(m => m.id === assigningMissionId.value)
  return m?.deliveryItems?.some((i: any) => i.kind === 'game' && !i.gameId) ?? false
})

// Teacher's own periods split into odd and even columns
const teacherPeriodIds = computed<string[]>(() =>
  (userInfo.value as any)?.periodIds ?? []
)
const oddPeriods  = computed(() =>
  PERIOD_IDS.filter(p => teacherPeriodIds.value.includes(p.id) && parseInt(p.id.replace('period-', '')) % 2 === 1)
)
const evenPeriods = computed(() =>
  PERIOD_IDS.filter(p => teacherPeriodIds.value.includes(p.id) && parseInt(p.id.replace('period-', '')) % 2 === 0)
)

const alreadyDeployedIds = computed<Set<string>>(() => {
  if (!assigningMissionId.value) return new Set()
  const nums = missionPeriodsMap.value.get(assigningMissionId.value) ?? []
  return new Set(nums.map(n => `period-${n}`))
})

function openAssign(m: Mission) {
  assigningMissionId.value = m.id
  // Pre-check already-deployed periods so they appear locked
  const nums = missionPeriodsMap.value.get(m.id) ?? []
  deployPeriodIds.value     = nums.map(n => `period-${n}`)
  deployDueDate.value       = ''
  deployCategory.value      = ''
  deployPenaltyPct.value    = null
  deployMaxPenaltyPct.value = null
  deployGameFamily.value    = ''
  deployGameId.value        = ''
  deployGameVariant.value   = ''
  deployStatus.value        = null
  showCreate.value          = false
  editingId.value           = null
}
function cancelAssign() {
  assigningMissionId.value  = null
  deployCategory.value      = ''
  deployPenaltyPct.value    = null
  deployMaxPenaltyPct.value = null
  deployGameFamily.value    = ''
  deployGameId.value        = ''
  deployGameVariant.value   = ''
  deployStatus.value        = null
}

async function submitDeploy() {
  if (!assigningMissionId.value || !deployPeriodIds.value.length) return
  const mission = missions.value.find(m => m.id === assigningMissionId.value)
  if (!mission) return
  isDeploying.value  = true
  deployStatus.value = null
  const teacherEmail = effectiveTeacherEmail.value ?? userInfo.value?.email ?? ''
  const newPeriods = deployPeriodIds.value.filter(id => !alreadyDeployedIds.value.has(id))
  if (!newPeriods.length) { isDeploying.value = false; cancelAssign(); return }
  const results = await Promise.all(
    newPeriods.map(periodId => deployMission({
      missionId:        mission.id,
      missionType:      mission.type,
      deliveryItems:    mission.deliveryItems ?? [],
      periodId,
      dueDate:          deployDueDate.value || null,
      teacherEmail,
      category:         deployCategory.value    || undefined,
      penaltyPctPerDay: deployPenaltyPct.value   ?? undefined,
      maxPenaltyPct:    deployMaxPenaltyPct.value ?? undefined,
      deployGameId:     deployGameId.value        || undefined,
      deployGameVariant:deployGameVariant.value   || undefined,
    }))
  )
  isDeploying.value  = false
  deployStatus.value = results.every(Boolean) ? 'ok' : 'error'
  if (results.some(Boolean)) {
    setTimeout(cancelAssign, 1800)
    refreshDeployed()
  }
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

// ── Delete assignment ─────────────────────────────────────────────────────────

const deletingAssignmentId  = ref<string | null>(null)
const deleteModalAssignment = ref<Assignment | null>(null)

function confirmDeleteAssignment(a: Assignment) {
  deleteModalAssignment.value = a
}

async function doDeleteAssignment() {
  if (!deleteModalAssignment.value) return
  deletingAssignmentId.value = deleteModalAssignment.value.id
  await deleteAssignment(deleteModalAssignment.value.id)
  deletingAssignmentId.value  = null
  deleteModalAssignment.value = null
}

function handleDeleteModalKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    deleteModalAssignment.value = null
    closeAddStudentModal()
  }
}

onMounted(()    => window.addEventListener('keydown', handleDeleteModalKey))
onUnmounted(()  => window.removeEventListener('keydown', handleDeleteModalKey))

// ── Recall mission (remove from all deployed periods) ─────────────────────────

const recallModalMission = ref<Mission | null>(null)
const isRecalling        = ref(false)

/** Sorted list of periodIds that currently have this mission deployed. */
const recallAffectedPeriods = computed(() => {
  if (!recallModalMission.value) return []
  return deployedAssignments.value
    .filter(a => a.missionId === recallModalMission.value!.id)
    .map(a => a.periodId)
    .sort((a, b) => a.localeCompare(b))
})

function confirmRecall(m: Mission) {
  recallModalMission.value = m
}

async function doRecall() {
  if (!recallModalMission.value) return
  const missionId = recallModalMission.value.id
  const toDelete  = deployedAssignments.value.filter(a => a.missionId === missionId)
  isRecalling.value = true
  try {
    for (const a of toDelete) {
      await deleteAssignment(a.id)
    }
  } finally {
    isRecalling.value        = false
    recallModalMission.value = null
  }
}

// ── Add single student ────────────────────────────────────────────────────────

type StudentRow = { uid: string; displayName: string; alreadyAssigned: boolean }

const addStudentModal       = ref<Assignment | null>(null)
const addStudentLoading     = ref(false)
const addStudentAllStudents = ref<StudentRow[]>([])
const addStudentSearch      = ref('')
const addStudentSelectedUid = ref<string | null>(null)
const isAddingStudent       = ref(false)
const addStudentStatus      = ref<'ok' | 'error' | null>(null)

const filteredAddStudents = computed(() => {
  const q = addStudentSearch.value.trim().toLowerCase()
  return q
    ? addStudentAllStudents.value.filter(s => s.displayName.toLowerCase().includes(q))
    : addStudentAllStudents.value
})

async function openAddStudentModal(a: Assignment) {
  addStudentModal.value       = a
  addStudentLoading.value     = true
  addStudentSearch.value      = ''
  addStudentSelectedUid.value = null
  addStudentStatus.value      = null

  // Fetch period students + already-assigned student IDs in parallel
  const [students, existingSnap] = await Promise.all([
    fetchPeriodStudents(a.periodId),
    getDocs(query(collection(db, 'submissions'), where('assignmentId', '==', a.id))),
  ])
  const assignedIds = new Set(existingSnap.docs.map(d => d.data().studentId as string))

  addStudentAllStudents.value = students.map(s => ({
    ...s,
    alreadyAssigned: assignedIds.has(s.uid),
  }))
  addStudentLoading.value = false
}

function closeAddStudentModal() {
  addStudentModal.value       = null
  addStudentAllStudents.value = []
  addStudentSearch.value      = ''
  addStudentSelectedUid.value = null
  addStudentStatus.value      = null
}

async function submitAddStudent() {
  const a = addStudentModal.value
  if (!a || !addStudentSelectedUid.value) return
  const mission = deployedMissionMap.value.get(a.missionId)
  if (!mission) return

  isAddingStudent.value  = true
  addStudentStatus.value = null
  const ok = await addStudentToAssignment(
    a,
    addStudentSelectedUid.value,
    mission.deliveryItems ?? [],
    mission.type,
  )
  addStudentStatus.value = ok ? 'ok' : 'error'
  isAddingStudent.value  = false

  if (ok) {
    // Mark the student as assigned in the list so the tag shows immediately
    addStudentAllStudents.value = addStudentAllStudents.value.map(s =>
      s.uid === addStudentSelectedUid.value ? { ...s, alreadyAssigned: true } : s,
    )
    addStudentSelectedUid.value = null
    setTimeout(closeAddStudentModal, 1500)
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(() => {
  fetchMissions(teacherScope())
  fetchAssignments(undefined, teacherScope())  // background — powers Periods column in library
})
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
  background: rgba(0,0,0,0.35);
  border: 0.125rem solid #99ccff;
  border-radius: 0.4rem;
  box-sizing: border-box;
  color: #e6f0ff;
  font-family: Roboto, Helvetica, Arial, sans-serif;
  font-size: 1rem;
  padding: 0.5rem 0.75rem;
  text-align: left;
  text-transform: none;
  transition: border-color 0.2s;
  width: 100%;
}
.lcars-input:focus    { outline: none; border-color: #f96; }
.lcars-input:disabled { opacity: 0.5; cursor: not-allowed; }
.lcars-select option  { background: #16213e; }
.lcars-textarea       { resize: none; min-height: 3.5rem; overflow: hidden; }

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
.lcars-btn--danger { background: #c0392b; color: #fff; }
.lcars-btn--danger:hover:not(:disabled) { background: #e74c3c; }

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
  display: grid; grid-template-columns: 1fr 110px 80px 110px 90px 30px;
  padding: 0.35rem 0.75rem; color: #445; font-size: 0.72rem; letter-spacing: 0.12em;
  border-bottom: 0.0625rem solid rgba(153,204,255,0.1);
}
.mission-row-wrap { border-radius: 0.4rem; overflow: hidden; }
.mission-row {
  display: grid; grid-template-columns: 1fr 110px 80px 110px 90px 30px;
  align-items: center; gap: 0.5rem; padding: 0.7rem 0.75rem;
  background: rgba(0,30,60,0.35); border: 0.0625rem solid rgba(153,204,255,0.08);
  border-radius: 0.4rem; transition: background 0.15s, border-color 0.15s;
}
.mission-row--clickable { cursor: pointer; }
.mission-row--clickable:hover { background: rgba(0,40,80,0.5); }
.mission-row--selected {
  background: rgba(0,40,90,0.6);
  border-color: rgba(153,204,255,0.25);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.col-chevron { display: flex; align-items: center; justify-content: center; }
.chevron {
  color: #445; font-size: 1.4rem; line-height: 1;
  display: inline-block; transition: transform 0.2s ease, color 0.15s;
  transform: rotate(0deg);
}
.chevron--open { transform: rotate(90deg); color: #99ccff; }

/* ── Mission preview panel ── */
.mission-preview-panel {
  background: rgba(0, 15, 40, 0.75);
  border: 0.0625rem solid rgba(153,204,255,0.22);
  border-top: none;
  border-bottom-left-radius: 0.4rem;
  border-bottom-right-radius: 0.4rem;
  padding: 1rem 1.25rem 0.9rem;
  display: flex; flex-direction: column; gap: 0.8rem;
  position: relative;
}

.preview-watermark {
  position: absolute; top: 0.55rem; right: 0.9rem;
  font-size: 0.6rem; letter-spacing: 0.2em; color: rgba(153,204,255,0.18);
  font-weight: bold; text-transform: uppercase;
}

.preview-header {
  display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem;
}
.preview-title { color: #ff9900; font-size: 1.15rem; font-weight: bold; letter-spacing: 0.06em; }
.preview-pts   { color: #fa0; font-size: 0.85rem; font-weight: bold; flex-shrink: 0; }
.preview-summary { color: #6677; font-size: 0.84rem; font-style: italic; margin-top: -0.4rem; }

.preview-description {
  font-family: 'Roboto', sans-serif; font-size: 0.88rem; color: #aabbcc; line-height: 1.55;
  padding: 0.65rem 0.9rem;
  background: rgba(51,102,255,0.04); border: 1px solid rgba(51,102,255,0.12); border-radius: 0.35rem;
}
.preview-description :deep(ul),
.preview-description :deep(ol) { margin: 0.25rem 0 0.25rem 1.25rem; padding: 0; }
.preview-description :deep(li) { margin: 0.15rem 0; }
.preview-description :deep(strong) { color: #cce0ff; }

.preview-block-label {
  font-size: 0.63rem; letter-spacing: 0.18em; color: #445566;
  text-transform: uppercase; font-weight: bold; margin-bottom: 0.35rem;
}

.preview-item-list { display: flex; flex-direction: column; gap: 0.3rem; }

.preview-delivery-item {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.4rem 0.7rem;
  background: rgba(0,10,30,0.45); border: 1px solid rgba(153,204,255,0.1); border-radius: 0.3rem;
}
.preview-item-icon { font-size: 1rem; flex-shrink: 0; }
.preview-item-body { flex: 1; display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.preview-item-name {
  color: #cce0ff; font-size: 0.88rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.preview-item-url {
  font-size: 0.75rem; color: #99ccff; text-decoration: none; flex-shrink: 0;
  border-bottom: 1px solid rgba(153,204,255,0.3); transition: color 0.15s;
}
.preview-item-url:hover { color: #ff9900; border-bottom-color: rgba(255,153,0,0.4); }
.preview-item-method {
  font-size: 0.68rem; color: #445566; letter-spacing: 0.03em; flex-shrink: 0;
  background: rgba(153,204,255,0.06); border: 1px solid rgba(153,204,255,0.1);
  border-radius: 0.2rem; padding: 0.1rem 0.4rem;
}

.preview-rubric-list { display: flex; flex-direction: column; gap: 0.2rem; }
.preview-rubric-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.3rem 0.7rem;
  background: rgba(0,10,30,0.35); border: 1px solid rgba(153,204,255,0.08); border-radius: 0.25rem;
  font-size: 0.85rem;
}
.preview-rubric-label { color: #99aacc; }
.preview-rubric-pts   { color: #fa0; font-weight: bold; font-size: 0.8rem; flex-shrink: 0; }

.preview-actions {
  display: flex; gap: 0.75rem;
  padding-top: 0.5rem; border-top: 1px solid rgba(153,204,255,0.1);
}

.col-mission { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.mission-title {
  color: #e6f0ff;
  font-size: 1.125rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mission-summary { color: #667788; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.type-badge {
  display: inline-block; font-size: 0.75rem; letter-spacing: 0.04em;
  padding: 0.15rem 0.5rem; border-radius: 3px; font-weight: bold;
}
.type-badge.file { background: rgba(137,153,255,0.15); color: #89f; }
.type-badge.game { background: rgba(249,102,0,0.15);   color: #f96; }

.pts-chip     { color: #fa0; font-size: 0.85rem; font-weight: bold; }
.rubric-count { color: #556; font-size: 0.82rem; }

.col-periods  { display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }
.period-num-chip {
  background: rgba(51, 102, 255, 0.15);
  border: 1px solid rgba(51, 102, 255, 0.3);
  border-radius: 0.25rem;
  color: #99ccff;
  font-family: 'Antonio', sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.05em;
  padding: 0.1rem 0.35rem;
}
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
.recall-btn        { border-color: rgba(255, 100, 80, 0.45); color: rgba(255, 130, 110, 0.8); }
.recall-btn:hover  { background: rgba(255, 80, 60, 0.12); border-color: #ff6450; color: #ff8878; }

/* .assign-panel removed — replaced by Teleport slideout */

.period-checkbox-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.25rem 2rem;
}

.period-checkbox-col {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.period-checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: 'Antonio', sans-serif;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
  color: #99ccff;
  cursor: pointer;
  user-select: none;
}

.period-checkbox-label:hover { color: #cce0ff; }

.period-checkbox {
  appearance: none;
  width: 1rem;
  height: 1rem;
  border: 1px solid rgba(51, 102, 255, 0.5);
  border-radius: 0.2rem;
  background: rgba(51, 102, 255, 0.08);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
}

.period-checkbox-label.already-deployed {
  color: #445566;
  cursor: default;
}

.period-checkbox:disabled {
  border-color: rgba(51, 102, 255, 0.2);
  cursor: default;
}

.already-tag {
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: #334455;
  background: rgba(51, 102, 255, 0.08);
  border: 1px solid rgba(51, 102, 255, 0.15);
  border-radius: 0.2rem;
  padding: 0.05rem 0.3rem;
  margin-left: 0.1rem;
}

.period-checkbox:checked {
  background: #3366ff;
  border-color: #99ccff;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 10 8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 4l3 3 5-6' stroke='white' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-size: 70%;
  background-repeat: no-repeat;
  background-position: center;
}
.dim-label        { color: #445; font-size: 0.7rem; letter-spacing: 0; text-transform: none; }

.deploy-status       { font-size: 0.85rem; font-weight: bold; }
.deploy-status.ok    { color: #69f0ae; }
.deploy-status.error { color: #f55; }

/* ── Deployed tab ── */
.deployed-list { display: flex; flex-direction: column; gap: 0.35rem; }

.deployed-header {
  display: grid; grid-template-columns: 1fr 100px 85px 115px 130px 130px;
  padding: 0.35rem 0.75rem;
  border-bottom: 0.0625rem solid rgba(153,204,255,0.1);
}
.sort-col {
  background: none; border: none; padding: 0; margin: 0;
  color: #445; font-family: inherit; font-size: 0.72rem; font-weight: bold;
  letter-spacing: 0.12em; text-align: left; cursor: pointer;
  display: flex; align-items: center; gap: 0.3rem;
  transition: color 0.15s;
}
.sort-col:hover       { color: #99ccff; }
.sort-col.active      { color: #f96; }
.sort-arrow           { font-size: 0.65rem; opacity: 0.5; }
.sort-col.active .sort-arrow { opacity: 1; }

.deployed-row {
  display: grid; grid-template-columns: 1fr 100px 85px 115px 130px 130px;
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

.dep-col-delete { display: flex; align-items: center; justify-content: flex-end; gap: 0.4rem; }
.delete-deploy-btn {
  font-size: 0.7rem; padding: 0.2rem 0.5rem;
  border-color: rgba(255, 60, 60, 0.5); color: rgba(255, 100, 100, 0.7);
}
.delete-deploy-btn:hover:not(:disabled) { border-color: #f55; color: #f55; }
.add-student-btn {
  font-size: 0.7rem; padding: 0.2rem 0.5rem;
  border-color: rgba(153, 204, 255, 0.4); color: rgba(153, 204, 255, 0.7);
}
.add-student-btn:hover { border-color: #99ccff; color: #99ccff; }

/* ── Add student modal ── */
.add-student-loading { color: rgba(255,255,255,0.5); font-size: 0.85rem; padding: 1rem 0; }
.add-student-picker  { display: flex; flex-direction: column; gap: 0.5rem; }
.add-student-search  { width: 100%; }
.add-student-list    { max-height: 14rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.1rem; }
.add-student-row {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.3rem 0.5rem; border-radius: 0.25rem; cursor: pointer;
  transition: background 0.15s;
}
.add-student-row:hover:not(.already-has) { background: rgba(153,204,255,0.08); }
.add-student-row.already-has             { opacity: 0.45; cursor: not-allowed; }
.add-student-radio { accent-color: #99ccff; flex-shrink: 0; }
.add-student-name  { flex: 1; font-size: 0.9rem; }
.add-student-empty { color: rgba(255,255,255,0.4); font-size: 0.85rem; padding: 0.5rem; }

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

/* ── Delivery items builder ── */
.delivery-items-list {
  display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem;
}
.delivery-item-row {
  display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;
  background: rgba(0,10,30,0.3); border: 0.0625rem solid rgba(153,204,255,0.12);
  border-radius: 0.35rem; padding: 0.4rem 0.6rem;
}
.di-kind-select    { flex: 0 0 110px; font-size: 0.82rem; padding: 0.3rem 0.5rem; }
.di-method-select  { flex: 0 0 160px; font-size: 0.82rem; padding: 0.3rem 0.5rem; }
.di-game-select    { flex: 0 0 150px; font-size: 0.82rem; padding: 0.3rem 0.5rem; }
.di-field          { flex: 1 1 140px; font-size: 0.82rem; padding: 0.3rem 0.5rem; min-width: 100px; }
.di-url            { flex: 2 1 200px; }
.di-paper-hint     { flex: 1; color: #445; font-size: 0.8rem; padding: 0 0.4rem; font-style: italic; }
.di-sim-badge      { flex: 0 0 auto; font-size: 0.82rem; color: #89a; padding: 0.3rem 0.5rem; white-space: nowrap; }
.di-variant-select { flex: 0 0 155px; font-size: 0.82rem; padding: 0.3rem 0.5rem; border-color: rgba(153,204,255,0.3); }
.di-repeat-row    { display: flex; align-items: center; gap: 0.35rem; flex: 0 0 auto; }
.di-repeat-label  { font-family: 'Tiny5', monospace; font-size: 0.7rem; color: #99ccff; white-space: nowrap; }
.di-repeat-input  { flex: 0 0 52px; font-size: 0.82rem; padding: 0.3rem 0.4rem; text-align: center; border-color: rgba(153,204,255,0.3); }

.delivery-add-row {
  display: flex; gap: 0.4rem; flex-wrap: wrap;
}
.add-item-btn {
  background: none; border: 0.0625rem dashed #334; border-radius: 0.35rem;
  color: #445; cursor: pointer; font-family: inherit; font-size: 0.75rem;
  font-weight: bold; letter-spacing: 0.08em; padding: 0.3rem 0.8rem;
  transition: all 0.15s;
}
.add-item-btn:hover { border-color: #69f0ae; color: #69f0ae; }

.delivery-badge {
  display: inline-block; font-size: 0.7rem; letter-spacing: 0.03em;
  padding: 0.12rem 0.4rem; border-radius: 3px; margin-right: 0.2rem;
  background: rgba(153,204,255,0.1); color: #99ccff;
  border: 0.0625rem solid rgba(153,204,255,0.2);
}

/* ── Status / shared ── */
.status-msg   { color: #99ccff; font-size: 1rem; text-align: center; padding: 3rem 0; opacity: 0.7; }
.status-error { color: #f55;    font-size: 1rem; text-align: center; padding: 2rem 0; }
.dim { color: #445; }

/* ── Delete deployment modal ── */
.del-modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
}
.del-modal {
  background: #1a1a2e; border: 1px solid #553333;
  border-radius: 0.5rem; width: min(90vw, 460px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.6); overflow: hidden;
}
.del-modal-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 1rem 1rem 1rem 1.25rem;
  background: #1a0f0f; border-left: 4px solid #c0392b;
}
.del-modal-icon { font-size: 1.5rem; flex-shrink: 0; }
.del-modal-title-block { flex: 1; display: flex; flex-direction: column; gap: 0.2rem; }
.del-modal-title {
  margin: 0; font-size: 1rem; font-weight: 700;
  color: #e8e8ff; letter-spacing: 0.06em; text-transform: uppercase;
}
.del-modal-subtitle { font-size: 0.7rem; color: #c07070; letter-spacing: 0.06em; text-transform: uppercase; }
.del-modal-close {
  background: transparent; border: none; color: #888;
  font-size: 1.1rem; cursor: pointer; padding: 0.25rem 0.5rem;
  border-radius: 0.25rem; transition: color 0.15s; flex-shrink: 0;
}
.del-modal-close:hover { color: #fff; }
.del-modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.85rem; }
.del-modal-desc { margin: 0; color: #b0b8d4; font-size: 0.95rem; line-height: 1.6; }
.del-modal-desc strong { color: #e6f0ff; }
.del-modal-warning {
  background: rgba(192,57,43,0.12); border: 1px solid rgba(192,57,43,0.35);
  border-radius: 0.35rem; padding: 0.75rem 1rem;
  color: #e8a0a0; font-size: 0.85rem; line-height: 1.5;
}
.del-modal-warning strong { color: #f5c0c0; }
.del-modal-actions {
  display: flex; gap: 0.75rem; padding: 0 1.5rem 1.25rem;
  flex-wrap: wrap;
}

.modal-fade-enter-active,
.modal-fade-leave-active  { transition: opacity 0.2s ease; }
.modal-fade-enter-from,
.modal-fade-leave-to      { opacity: 0; }

/* ── New Mission slideout panel ── */
.slideout-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 990;
}

.slideout-panel {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: min(720px, 95vw);
  background: #0a1628;
  border-left: 1px solid rgba(153, 204, 255, 0.18);
  z-index: 995;
  display: flex; flex-direction: column;
  box-shadow: -10px 0 40px rgba(0, 0, 0, 0.6);
}

.slideout-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem;
  background: rgba(0, 10, 25, 0.95);
  border-bottom: 1px solid rgba(153, 204, 255, 0.15);
  flex-shrink: 0;
}
.slideout-header-left { display: flex; align-items: center; gap: 1.25rem; }
.slideout-title {
  color: #f96; font-size: 0.85rem; font-weight: bold; letter-spacing: 0.2em;
}

.slideout-body {
  flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem;
  display: flex; flex-direction: column; gap: 1.25rem;
}

.slideout-cols {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 0.75rem 1.5rem; align-items: start;
}

.slideout-col {
  display: flex; flex-direction: column; gap: 0.85rem;
}

.slideout-description-strip {
  display: flex; flex-direction: column; gap: 0.4rem;
  border-top: 1px solid rgba(153, 204, 255, 0.1);
  padding-top: 1.1rem;
}

.slideout-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.9rem 1.5rem;
  background: rgba(0, 8, 20, 0.95);
  border-top: 1px solid rgba(153, 204, 255, 0.15);
  flex-shrink: 0;
  gap: 0.75rem;
}
.slideout-footer-right { display: flex; gap: 0.75rem; align-items: center; }

/* Flash confirmation after Save & Add Another */
.save-add-flash {
  font-size: 0.78rem; color: #69f0ae; font-weight: bold;
  letter-spacing: 0.05em; white-space: nowrap;
}

.flash-fade-enter-active { transition: opacity 0.25s ease; }
.flash-fade-leave-active { transition: opacity 0.4s ease; }
.flash-fade-enter-from,
.flash-fade-leave-to     { opacity: 0; }

/* Slideout slide-in / slide-out animation */
.cp-slide-enter-active,
.cp-slide-leave-active  { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.cp-slide-enter-from,
.cp-slide-leave-to      { transform: translateX(100%); }

/* Backdrop fade */
.backdrop-fade-enter-active,
.backdrop-fade-leave-active { transition: opacity 0.25s ease; }
.backdrop-fade-enter-from,
.backdrop-fade-leave-to     { opacity: 0; }

/* Duplicate button */
.dupe-btn       { border-color: rgba(204, 153, 255, 0.5); color: #cc99ff; }
.dupe-btn:hover { background: rgba(204, 153, 255, 0.1); border-color: #cc99ff; }

/* Deploy slideout extras */
.slideout-deploy-subtitle {
  color: #99ccff; font-size: 0.82rem; letter-spacing: 0.04em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 380px;
}
.deploy-no-periods {
  color: #556; font-size: 0.82rem; font-style: italic; margin-top: 0.4rem;
}

/* ── Late penalty inputs ──────────────────────────────────────────────────── */
.penalty-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.penalty-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
  min-width: 6rem;
}
.penalty-sub-label {
  font-size: 0.64rem;
  color: #557;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.penalty-input {
  width: 100%;
  min-width: 0;
}
.penalty-hint {
  font-size: 0.68rem;
  color: #446;
  margin-top: 0.35rem;
  font-style: italic;
  line-height: 1.4;
}
</style>
