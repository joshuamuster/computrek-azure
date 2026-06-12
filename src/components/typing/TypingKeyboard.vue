<template>
  <div class="typing-keyboard" aria-hidden="true">
    <div v-for="(row, ri) in rows" :key="ri" class="key-row">
      <div
        v-for="key in row"
        :key="key.value"
        class="key"
        :class="keyClass(key.value)"
        :style="key.width ? { flex: key.width } : {}"
      >
        <span class="key-label">{{ key.label ?? key.value.toUpperCase() }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * TypingKeyboard.vue
 *
 * Visual QWERTY keyboard with three highlight states:
 *   - focus (gold)  — keys the current lesson focuses on
 *   - active (cyan) — the key being pressed right now (via lastKey prop)
 *   - error (red)   — keys the student is currently missing most
 *
 * Props:
 *   focusKeys  — string[] of keys to highlight as lesson targets
 *   activeKey  — the single key currently held/just pressed
 *   errorKeys  — string[] of keys with the most errors in this session
 */

import { computed } from 'vue'

interface KeyDef {
  value:  string
  label?: string
  width?: number   // flex value; 1 = standard key width
}

const props = withDefaults(defineProps<{
  focusKeys?: string[]
  activeKey?: string | null
  errorKeys?: string[]
}>(), {
  focusKeys: () => [],
  activeKey: null,
  errorKeys: () => [],
})

// ── Layout ─────────────────────────────────────────────────────────────────

const rows: KeyDef[][] = [
  // Row 1 — number row
  [
    { value: '`' },
    { value: '1' }, { value: '2' }, { value: '3' }, { value: '4' },
    { value: '5' }, { value: '6' }, { value: '7' }, { value: '8' },
    { value: '9' }, { value: '0' }, { value: '-' }, { value: '=' },
    { value: 'backspace', label: '⌫', width: 2 },
  ],
  // Row 2 — top letter row
  [
    { value: 'tab', label: 'Tab', width: 1.5 },
    { value: 'q' }, { value: 'w' }, { value: 'e' }, { value: 'r' },
    { value: 't' }, { value: 'y' }, { value: 'u' }, { value: 'i' },
    { value: 'o' }, { value: 'p' },
    { value: '[' }, { value: ']' }, { value: '\\', width: 1.5 },
  ],
  // Row 3 — home row
  [
    { value: 'caps', label: 'Caps', width: 1.75 },
    { value: 'a' }, { value: 's' }, { value: 'd' }, { value: 'f' },
    { value: 'g' }, { value: 'h' }, { value: 'j' }, { value: 'k' },
    { value: 'l' }, { value: ';' }, { value: '\'' },
    { value: 'enter', label: 'Enter', width: 2.25 },
  ],
  // Row 4 — bottom letter row
  [
    { value: 'shift-l', label: 'Shift', width: 2.25 },
    { value: 'z' }, { value: 'x' }, { value: 'c' }, { value: 'v' },
    { value: 'b' }, { value: 'n' }, { value: 'm' },
    { value: ',' }, { value: '.' }, { value: '/' },
    { value: 'shift-r', label: 'Shift', width: 2.75 },
  ],
  // Row 5 — space bar
  [
    { value: 'ctrl-l', label: 'Ctrl', width: 1.25 },
    { value: 'alt-l',  label: 'Alt',  width: 1.25 },
    { value: ' ',      label: '',     width: 6.5  },
    { value: 'alt-r',  label: 'Alt',  width: 1.25 },
    { value: 'ctrl-r', label: 'Ctrl', width: 1.25 },
  ],
]

// ── Helpers ────────────────────────────────────────────────────────────────

const focusSet  = computed(() => new Set(props.focusKeys.map(k => k.toLowerCase())))
const errorSet  = computed(() => new Set(props.errorKeys.map(k => k.toLowerCase())))
const activeVal = computed(() => props.activeKey?.toLowerCase() ?? null)

function keyClass(value: string): string[] {
  const v = value.toLowerCase()
  const classes: string[] = []
  if (focusSet.value.has(v))         classes.push('focus')
  if (errorSet.value.has(v))         classes.push('error')
  if (activeVal.value !== null && activeVal.value === v) classes.push('active')
  if (['tab','caps','enter','backspace','shift-l','shift-r',
       'ctrl-l','ctrl-r','alt-l','alt-r'].includes(v))   classes.push('modifier')
  if (v === ' ')                     classes.push('spacebar')
  return classes
}
</script>

<style scoped>
/* ── Wrapper ────────────────────────────────────────────────────────────── */
.typing-keyboard {
  display:        flex;
  flex-direction: column;
  gap:            0.3rem;
  padding:        0.75rem;
  background:     rgba(0, 10, 25, 0.6);
  border:         0.0625rem solid rgba(153, 204, 255, 0.15);
  border-radius:  0.75rem;
  backdrop-filter: blur(0.5rem);
  user-select:    none;
  width:          100%;
  max-width:      48rem;
  margin:         0 auto;
}

/* ── Row ────────────────────────────────────────────────────────────────── */
.key-row {
  display: flex;
  gap:     0.25rem;
}

/* ── Key ────────────────────────────────────────────────────────────────── */
.key {
  flex:            1;
  height:          2.5rem;
  display:         flex;
  align-items:     center;
  justify-content: center;
  background:      rgba(20, 35, 60, 0.7);
  border:          0.0625rem solid rgba(153, 204, 255, 0.2);
  border-radius:   0.375rem;
  transition:      background 0.12s ease, border-color 0.12s ease, transform 0.06s ease;
  min-width:       0;
}

/* Only the label scales — key boxes stay the same size */
.key-label {
  font-family:  'Antonio', monospace, sans-serif;
  font-size:    var(--typing-key-size, 0.7rem);
  color:        rgba(180, 200, 230, 0.6);
  letter-spacing: 0.03em;
  pointer-events: none;
  text-transform: uppercase;
  transition:   font-size 0.2s ease;
}

/* ── Modifier keys ────────────────────────────────────────────────────── */
.key.modifier {
  background: rgba(10, 20, 45, 0.7);
}
.key.modifier .key-label {
  /* keeps the ~0.857 ratio of original (0.6rem / 0.7rem) at all sizes */
  font-size: calc(var(--typing-key-size, 0.7rem) * 0.857);
  color: rgba(153, 204, 255, 0.35);
}

/* ── Space bar ────────────────────────────────────────────────────────── */
.key.spacebar {
  background: rgba(20, 35, 60, 0.5);
}

/* ── Focus keys (gold — lesson targets) ──────────────────────────────── */
.key.focus {
  background:   rgba(255, 196, 0, 0.18);
  border-color: rgba(255, 196, 0, 0.55);
}
.key.focus .key-label {
  color:       rgba(255, 210, 60, 0.95);
  font-weight: 700;
}

/* ── Error keys (red — most missed) ──────────────────────────────────── */
.key.error {
  background:   rgba(255, 80, 80, 0.18);
  border-color: rgba(255, 80, 80, 0.5);
}
.key.error .key-label {
  color: rgba(255, 130, 130, 0.95);
}

/* ── Active key (cyan — currently pressed) ───────────────────────────── */
.key.active {
  background:  rgba(100, 210, 255, 0.25);
  border-color: rgba(100, 210, 255, 0.7);
  transform:   scale(0.93);
}
.key.active .key-label {
  color: rgba(140, 230, 255, 1);
}

/* ── Focus + active combo ─────────────────────────────────────────────── */
.key.focus.active {
  background:  rgba(255, 196, 0, 0.35);
  border-color: rgba(255, 220, 80, 0.9);
}

/* ── Error + active combo ─────────────────────────────────────────────── */
.key.error.active {
  background:   rgba(255, 80, 80, 0.35);
  border-color: rgba(255, 120, 120, 0.9);
}
</style>
