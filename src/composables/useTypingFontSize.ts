/**
 * useTypingFontSize.ts
 *
 * Manages the student's preferred font size for the typing lesson.
 * Three discrete steps: normal → large → xl.
 * Persists to localStorage so the preference survives page refreshes.
 *
 * Usage:
 *   const { size, setSize, cssVars } = useTypingFontSize()
 *   // Bind :style="cssVars" on the lesson root to cascade
 *   // --typing-text-size and --typing-key-size to child components.
 */

import { ref, computed } from 'vue'

// ── Types & constants ─────────────────────────────────────────────────────────

export type FontSizeOption = 'normal' | 'large' | 'xl'

export const FONT_SIZE_OPTIONS: {
  value:    FontSizeOption
  label:    string
  iconSize: string           // size of the "A" icon in the picker button
}[] = [
  { value: 'normal', label: 'Normal',      iconSize: '0.85rem' },
  { value: 'large',  label: 'Large',       iconSize: '1.1rem'  },
  { value: 'xl',     label: 'Extra Large', iconSize: '1.4rem'  },
]

const SIZE_MAP: Record<FontSizeOption, { textSize: string; keySize: string }> = {
  normal: { textSize: '1.7rem',  keySize: '0.85rem' },
  large:  { textSize: '2.1rem',  keySize: '1.05rem' },
  xl:     { textSize: '2.7rem',  keySize: '1.3rem'  },
}

const LS_KEY = 'computrek_typing_font_size'

// ── Singleton ref (shared across all composable calls in the same session) ────

function readStored(): FontSizeOption {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v === 'normal' || v === 'large' || v === 'xl') return v
  } catch { /* private browsing may throw */ }
  return 'normal'
}

const current = ref<FontSizeOption>(readStored())

// ── Composable ────────────────────────────────────────────────────────────────

export function useTypingFontSize() {
  const setSize = (size: FontSizeOption) => {
    current.value = size
    try { localStorage.setItem(LS_KEY, size) } catch { /* ignore */ }
  }

  /** Inline-style object: set this on the lesson root so CSS vars cascade down. */
  const cssVars = computed(() => ({
    '--typing-text-size': SIZE_MAP[current.value].textSize,
    '--typing-key-size':  SIZE_MAP[current.value].keySize,
  }))

  return {
    size:             current,           // reactive current selection
    setSize,                             // (size: FontSizeOption) => void
    cssVars,                             // computed style object for :style binding
    options: FONT_SIZE_OPTIONS,          // ordered list for the picker UI
  }
}
