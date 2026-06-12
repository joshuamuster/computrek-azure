<template>
  <div>
    <div class="champs-container" @mousemove="handleMouseMove">
      <div
        id="Champs-Title"
        class="champs-title-container"
        :class="{ 'is-teacher': isTeacher, [`flash-${titleFlash}`]: titleFlash }"
        @click="handleTitleClick"
      >
        <h3 class="champs-title">{{ titleLabel }}</h3>
      </div>
      <div id="Champs-Conversation" class="champs-card" :class="{ 'read-only': isCadet }" @click="handleCategoryClick('conversation')">
        <h3 class="color-c">
          <div class="fill-box"></div>
          <span>CONVERSATION</span>
          <div class="fill-box"></div>
        </h3>
        <div class="champs-content">
          <div class="level-boxes-container">
            <div class="level-box" :class="{
            'active-c': activeLevels.conversation >= 1,
            'zero-level': activeLevels.conversation === 0}">
              {{ activeLevels.conversation === 0 ? '0' : (activeLevels.conversation === 1 ? '1' : '') }}
            </div>
            <div class="level-box" :class="{
            'active-c': activeLevels.conversation >= 2,
            'zero-level': activeLevels.conversation === 0 }">
              {{ activeLevels.conversation === 0 ? '0' : (activeLevels.conversation === 2 ? '2' : '') }}
            </div>
            <div class="level-box" :class="{
            'active-c': activeLevels.conversation >= 3,
            'zero-level': activeLevels.conversation === 0 }">
              {{ activeLevels.conversation === 0 ? '0' : (activeLevels.conversation === 3 ? '3' : '') }}
            </div>
          </div>
          <p class="">{{ conversationDescription }}</p>
        </div>
        <div class="nav-desc">Cadets will maintain communication at teacher‑approved levels, speaking only when
          mission protocol allows so the bridge remains fully operational.</div>
      </div>
      <div id="Champs-Help" class="champs-card" :class="{ 'read-only': isCadet }" @click="handleCategoryClick('help')">
        <h3 class="color-h">
          <div class="fill-box"></div>
          <span>HELP</span>
          <div class="fill-box"></div>
        </h3>
        <div class="champs-content">
          <div class="level-boxes-container">
            <div class="level-box" :class="{
              'active-h': activeLevels.help >= 1,
            'zero-level': activeLevels.help === 0}">
              {{ activeLevels.help === 0 ? '0' : (activeLevels.help === 1 ? '1' : '') }}
            </div>
            <div class="level-box" :class="{
              'active-h': activeLevels.help >= 2,
            'zero-level': activeLevels.help === 0}">
              {{ activeLevels.help === 0 ? '0' : (activeLevels.help === 2 ? '2' : '') }}
            </div>
            <div class="level-box" :class="{
              'active-h': activeLevels.help >= 3,
            'zero-level': activeLevels.help === 0}">
              {{ activeLevels.help === 0 ? '0' : (activeLevels.help === 3 ? '3' : '') }}
            </div>
          </div>
          <p class="">{{ helpDescription }}</p>
        </div>
        <div class="nav-desc">If assistance is required, cadets will signal their Instructor or nearest crew member
          using standard request procedures.</div>
      </div>
      <div id="Champs-Activity" class="champs-card" :class="{ 'read-only': isCadet }" @click="handleCategoryClick('activity')">
        <h3 class="color-a">
          <div class="fill-box"></div>
          <span>ACTIVITY</span>
          <div class="fill-box"></div>
        </h3>
        <div class="champs-content">
          <div class="level-boxes-container">
            <div class="level-box" :class="{
            'active-a': activeLevels.activity >= 1,
            'zero-level': activeLevels.activity === 0}">
              {{ activeLevels.activity === 0 ? '0' : (activeLevels.activity === 1 ? '1' : '') }}
            </div>
            <div class="level-box" :class="{
            'active-a': activeLevels.activity >= 2,
            'zero-level': activeLevels.activity === 0}">
              {{ activeLevels.activity === 0 ? '0' : (activeLevels.activity === 2 ? '2' : '') }}
            </div>
            <div class="level-box" :class="{
            'active-a': activeLevels.activity >= 3,
            'zero-level': activeLevels.activity === 0}">
              {{ activeLevels.activity === 0 ? '0' : (activeLevels.activity === 3 ? '3' : '') }}
            </div>
          </div>
          <p class="">{{ activityDescription }}</p>
        </div>
        <div class="nav-desc">Cadets will remain focused on the assigned mission task, carrying it out with the
          precision expected aboard a Galaxy‑class starship.</div>
      </div>
      <div id="Champs-Movement" class="champs-card" :class="{ 'read-only': isCadet }" @click="handleCategoryClick('movement')">
        <h3 class="color-m">
          <div class="fill-box"></div>
          <span>MOVEMENT</span>
          <div class="fill-box"></div>
        </h3>
        <div class="champs-content">
          <div class="level-boxes-container">
            <div class="level-box" :class="{
            'active-m': activeLevels.movement >= 1,
            'zero-level': activeLevels.movement === 0}">
              {{ activeLevels.movement === 0 ? '0' : (activeLevels.movement === 1 ? '1' : '') }}
            </div>
            <div class="level-box" :class="{
            'active-m': activeLevels.movement >= 2,
            'zero-level': activeLevels.movement === 0}">
              {{ activeLevels.movement === 0 ? '0' : (activeLevels.movement === 2 ? '2' : '') }}
            </div>
            <div class="level-box" :class="{
            'active-m': activeLevels.movement >= 3,
            'zero-level': activeLevels.movement === 0}">
              {{ activeLevels.movement === 0 ? '0' : (activeLevels.movement === 3 ? '3' : '') }}
            </div>
          </div>
          <p class="">{{ movementDescription }}</p>
        </div>
        <div class="nav-desc">Cadets will move only where authorized, navigating the training deck with the
          discipline of officers serving on the Enterprise‑D.</div>
      </div>
      <div id="Champs-Participation" class="champs-card" :class="{ 'read-only': isCadet }" @click="handleCategoryClick('participation')">
        <h3 class="color-p">
          <div class="fill-box"></div>
          <span>PARTICIPATION</span>
          <div class="fill-box"></div>
        </h3>
        <div class="champs-content">
          <p class="">{{ participationDescription }}</p>
        </div>
        <div class="nav-desc">How to actively engage and contribute to the lesson.</div>
      </div>
      <div id="Champs-Success" class="champs-card" :class="{ 'read-only': isCadet }" @click="handleCategoryClick('success')">
        <h3 class="color-s">
          <div class="fill-box"></div>
          <span>SUCCESS</span>
          <div class="fill-box"></div>
        </h3>
        <div class="champs-content">
          <p class="">{{ successDescription }}</p>
        </div>
        <div class="nav-desc">Goals for successfully completing the day's objectives.</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import champsData from '@/assets/data/ChampsData.json';
import soundFile from '@/assets/sounds/SFX-Computer/keyok3.wav';
import { useAuth } from '@/composables/useAuth';
import { usePeriodSelector } from '@/composables/usePeriodSelector';

const { isCadet, isTeacher, userInfo } = useAuth();
const { selectedPeriodId } = usePeriodSelector();

// ─── Defaults ────────────────────────────────────────────────────────────────

const defaultActiveLevels = {
  conversation: 1,
  help: 1,
  activity: 1,
  movement: 1,
  participation: 1,
  success: 1,
};

const CATEGORIES = ['conversation', 'help', 'activity', 'movement', 'participation', 'success'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMaxLevel(category) {
  const levels = champsData.champs?.[category]?.levels || {};
  const keys = Object.keys(levels).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n));
  return keys.length ? Math.max(...keys) : 0;
}

function champsDocKey(teacherEmail, periodId) {
  return `${teacherEmail}__${periodId}`;
}

// ─── Reactive level state ─────────────────────────────────────────────────────

// Teachers: load from localStorage as scratch pad; Cadets: start with defaults (Firestore will overwrite)
const loadFromLocalStorage = () => {
  try {
    const saved = localStorage.getItem('champsActiveLevels');
    if (saved) {
      const parsed = JSON.parse(saved);
      const isValid = CATEGORIES.every(cat => {
        const max = getMaxLevel(cat);
        return (
          Object.prototype.hasOwnProperty.call(parsed, cat) &&
          typeof parsed[cat] === 'number' &&
          parsed[cat] >= 0 &&
          parsed[cat] <= max
        );
      });
      if (isValid) return parsed;
    }
  } catch (e) {
    console.warn('Failed to load CHAMPS state from localStorage:', e);
  }
  return { ...defaultActiveLevels };
};

const activeLevels = reactive(isCadet.value ? { ...defaultActiveLevels } : loadFromLocalStorage());

// Only persist to localStorage for teachers (cadets read from Firestore)
watch(activeLevels, (newState) => {
  if (isTeacher.value) {
    try { localStorage.setItem('champsActiveLevels', JSON.stringify(newState)); }
    catch (e) { console.warn('Failed to save CHAMPS state:', e); }
  }
}, { deep: true });

// ─── Firestore: cadet listener ────────────────────────────────────────────────

let unsubscribeSnapshot = null;

function applyFirestoreState(data) {
  CATEGORIES.forEach(cat => {
    if (typeof data[cat] === 'number') activeLevels[cat] = data[cat];
  });
}

function subscribeToChamps(teacherEmail, periodId) {
  if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
  if (!teacherEmail || !periodId) return;

  const docRef = doc(db, 'champsState', champsDocKey(teacherEmail, periodId));
  unsubscribeSnapshot = onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      applyFirestoreState(snap.data());
    } else {
      // No published state yet — show defaults
      Object.assign(activeLevels, { ...defaultActiveLevels });
    }
  }, (err) => {
    console.warn('CHAMPS snapshot error:', err);
  });
}

onMounted(() => {
  if (isCadet.value) {
    const teacherEmail = userInfo.value?.teacherEmail;
    const periodId     = userInfo.value?.periodId;
    subscribeToChamps(teacherEmail, periodId);
  }
});

onUnmounted(() => {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
});

// ─── Title click: teacher broadcasts to Firestore ────────────────────────────

// 'broadcast' | 'no-period' | null
const titleFlash = ref(null);
let flashTimer = null;

function flash(type) {
  titleFlash.value = type;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { titleFlash.value = null; }, 1800);
}

const titleLabel = computed(() => {
  if (titleFlash.value === 'broadcast') return '✓ BROADCAST';
  if (titleFlash.value === 'no-period') return 'SELECT A PERIOD';
  return 'CHAMPS';
});

const handleTitleClick = async () => {
  if (!isTeacher.value) return; // admins, cadets, audit → no-op

  if (!selectedPeriodId.value) {
    playSound();
    flash('no-period');
    return;
  }

  const teacherEmail = userInfo.value?.email;
  if (!teacherEmail) return;

  try {
    const docRef = doc(db, 'champsState', champsDocKey(teacherEmail, selectedPeriodId.value));
    await setDoc(docRef, {
      ...activeLevels,
      updatedAt: serverTimestamp(),
    });
    playSound();
    flash('broadcast');
  } catch (err) {
    console.error('Failed to broadcast CHAMPS:', err);
  }
};

// ─── Sound ───────────────────────────────────────────────────────────────────

const playSound = () => {
  const audio = new Audio(soundFile);
  audio.play();
};

// ─── Category card click ──────────────────────────────────────────────────────

const handleCategoryClick = (category) => {
  if (isCadet.value) return;

  playSound();

  const currentLevel = activeLevels[category];
  const max = getMaxLevel(category);
  activeLevels[category] = currentLevel >= max ? 0 : currentLevel + 1;
};

// ─── Descriptions ─────────────────────────────────────────────────────────────

const conversationDescription  = computed(() => champsData.champs.conversation.levels[activeLevels.conversation]?.description  || '');
const helpDescription           = computed(() => champsData.champs.help.levels[activeLevels.help]?.description                  || '');
const activityDescription       = computed(() => champsData.champs.activity.levels[activeLevels.activity]?.description          || '');
const movementDescription       = computed(() => champsData.champs.movement.levels[activeLevels.movement]?.description          || '');
const participationDescription  = computed(() => champsData.champs.participation.levels[activeLevels.participation]?.description || '');
const successDescription        = computed(() => champsData.champs.success.levels[activeLevels.success]?.description            || '');

// ─── Mouse glow ───────────────────────────────────────────────────────────────

const handleMouseMove = (e) => {
  const item = e.target.closest('.champs-card');
  if (item) {
    const rect = item.getBoundingClientRect();
    item.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    item.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  }
};
</script>

<style scoped>

  @import '../assets/styles/classic.css';

  .champs-container {
    border-width: 0.375rem;
    border-style: solid;
    border-color: var(--champsdefault);
    border-radius: 0.5rem;
  }

  .champs-title-container {
    background: linear-gradient(to right, rgba(100, 100, 100, 0.5), rgba(0, 0, 0, 0.5), rgba(100, 100, 100, 0.5));
    padding: 0.9375rem;
    transition: background 0.3s ease;
  }

  .champs-title-container.is-teacher {
    cursor: pointer;
  }

  .champs-title-container.flash-broadcast {
    background: linear-gradient(to right, rgba(0, 180, 80, 0.4), rgba(0, 100, 40, 0.6), rgba(0, 180, 80, 0.4));
  }

  .champs-title-container.flash-no-period {
    background: linear-gradient(to right, rgba(200, 120, 0, 0.4), rgba(120, 60, 0, 0.6), rgba(200, 120, 0, 0.4));
  }

  .champs-title {
    color: gray;
    font-family: 'Roboto', 'Arial Narrow', 'Avenir Next Condensed', sans-serif;
    font-size: 1.25rem;
    font-weight: bolder;
    letter-spacing: 0.75em;
    margin: 0 -0.75em 0 0;
    text-align: center;
    transition: color 0.3s ease;
  }

  .flash-broadcast .champs-title {
    color: #00e676;
    letter-spacing: 0.4em;
    margin: 0 -0.4em 0 0;
  }

  .flash-no-period .champs-title {
    color: #ffaa00;
    letter-spacing: 0.3em;
    margin: 0 -0.3em 0 0;
  }

  .champs-card {
    color: inherit;
    cursor: pointer;
    display: block;
    padding: 0 0 1rem;
    text-decoration: none;
    transition: transform 0.3s ease;
    position: relative;
    overflow: visible;
  }

  .champs-card.read-only {
    cursor: default;
  }

  .nav-desc {
    position: absolute;
    left: var(--mouse-x, 100%);
    top: var(--mouse-y, 50%);
    transform: translate(0.9375rem, -50%);
    padding: 0.5rem 1rem;
    background: rgba(0, 0, 0, 0.7);
    border: 0.0625rem solid #3366ff;
    border-left: 0.375rem solid #3366ff;
    color: white;
    width: 12.5rem;
    font-size: 0.9rem;
    line-height: 1.3;
    font-family: 'Roboto', sans-serif;
    text-transform: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s ease, visibility 0.2s ease;
    transition-delay: 0s;
    z-index: 1000;
    pointer-events: none;
    border-radius: 0 0.5rem 0.5rem 0;
    box-shadow: 0 0.25rem 0.9375rem rgba(0, 0, 0, 0.5);
    text-align: left;
    font-style: normal;
    font-weight: normal;
  }

  @media (hover: hover) {
    .champs-card:hover .nav-desc {
      opacity: 1;
      visibility: visible;
      transition-delay: 0.5s;
    }
  }

  .nav-desc::before {
    content: '';
    position: absolute;
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-width: 0.5rem;
    border-style: solid;
    border-color: transparent #3366ff transparent transparent;
  }

  .champs-card h3 {
    align-items: center;
    display: flex;
    margin: 0 auto;
    font-family: 'Antonio', sans-serif;
    span {
      font-size: 1.5rem;
      font-weight: 900;
      line-height: 0;
    }
  }

  .champs-card h3 span {
    margin: 0 0.5rem;
  }

  .champs-card p {
    color: rgba(255,255,255,0.35);
    font-size: 1em;
    font-style: italic;
    line-height: 1.4;
    margin: 0.625rem 0 0;
  }

  .fill-box {
    flex: 1;
    height: 1.25rem;
    background-color: var(--champsdefault);
    border-radius: 0.0625rem;
  }

  .zero-level {
    color: #555 !important;
  }

  .champs-content {
    margin: 0.625rem 0 0;
    padding: 0 0.9375rem;
  }

  .level-boxes-container {
    display: flex;
    gap: 0.3125rem;
    margin-top: 0.625rem;
  }

  .level-box {
    background-color: black;
    border-color: gray;
    border-radius: 0.25rem;
    border-style: dashed;
    border-width: 0.0625rem;
    flex: 1;
    height: 1.875rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bolder;
    font-size: 1.1em;
  }

  .color-c {color: var(--champsred);}
  .color-h {color: var(--champsgold);}
  .color-a {color: var(--champsyellow);}
  .color-m {color: var(--champsgreen);}
  .color-p {color: var(--champsblue);}
  .color-s {color: var(--champspurple);}
  .color-w {color: var(--space-white);}

  .active-c {background-color: var(--champsred);}
  .active-h {background-color: var(--champsgold);}
  .active-a {background-color: var(--champsyellow);}
  .active-m {background-color: var(--champsgreen);}
  .active-p {background-color: var(--champsblue);}
  .active-s {background-color: var(--champspurple);}

  .border-c {border-color: var(--champsred);}
  .border-h {border-color: var(--champsgold);}
  .border-a {border-color: var(--champsyellow);}
  .border-m {border-color: var(--champsgreen);}
  .border-p {border-color: var(--champsblue);}
  .border-s {border-color: var(--champspurple);}

</style>
