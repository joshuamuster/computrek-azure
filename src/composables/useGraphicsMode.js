// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useGraphicsMode.js
//
// Singleton composable — all callers share the same reactive ref.
// Persists the user's choice to localStorage under 'graphicsMode'.
// Stamps a `data-graphics` attribute on <html> so CSS can react without
// prop-drilling. Also keeps the legacy `low-graphics` class in sync so
// CompuTrekAnimated's existing scoped CSS still works.
//
// Valid modes:  'standard' | 'medium' | 'low'
// ─────────────────────────────────────────────────────────────────────────────

import { ref, watch } from 'vue'

const VALID = new Set(['standard', 'medium', 'low'])

function getInitialMode() {
  const stored = localStorage.getItem('graphicsMode')
  if (VALID.has(stored)) return stored
  // Migrate from the old boolean lowGraphics key
  if (localStorage.getItem('lowGraphics') === 'true') return 'low'
  return 'standard'
}

const graphicsMode = ref(getInitialMode())

function applyToDOM(mode) {
  document.documentElement.dataset.graphics = mode
  // Legacy class kept for CompuTrekAnimated's :global(.low-graphics) selector
  document.documentElement.classList.toggle('low-graphics', mode === 'low')
}

// Apply immediately on module load (before any component mounts)
applyToDOM(graphicsMode.value)

// Keep DOM in sync with future changes
watch(graphicsMode, applyToDOM)

export function useGraphicsMode() {
  function set(mode) {
    if (!VALID.has(mode)) return
    graphicsMode.value = mode
    localStorage.setItem('graphicsMode', mode)
  }

  return { graphicsMode, set }
}
