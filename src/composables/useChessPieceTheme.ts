/**
 * useChessPieceTheme
 *
 * Manages the student's preferred chess piece set.
 * Preference is stored in localStorage (same pattern as zoom / graphics mode).
 *
 * How CSS loading works:
 *  - ChessGame.vue statically imports chessground.cburnett.css as the base layer.
 *  - When any non-cburnett theme is active, we inject a <link id="chess-piece-theme">
 *    into <head> that points to /chess-themes/{theme}.css.  Because that stylesheet
 *    lands after the Vite-bundled CSS in source order, its !important rules win.
 *  - Switching back to cburnett simply removes the injected <link>.
 */

import { ref } from 'vue'

const STORAGE_KEY = 'chessPieceTheme'
const DEFAULT_THEME = 'cburnett'
const LINK_ID = 'chess-piece-theme'

export interface ChessTheme {
  id: string
  label: string
  /** Path to the white queen preview SVG shown in the picker modal. */
  previewSrc: string
  description: string
}

export const CHESS_THEMES: ChessTheme[] = [
  {
    id: 'cburnett',
    label: 'Classic',
    previewSrc: '/chess-themes/cburnett/wQ.svg',
    description: 'The original internet chess look',
  },
  {
    id: 'merida',
    label: 'Merida',
    previewSrc: '/chess-themes/merida/wQ.svg',
    description: 'Traditional tournament Staunton style',
  },
  {
    id: 'california',
    label: 'California',
    previewSrc: '/chess-themes/california/wQ.svg',
    description: 'Hand-drawn feel with subtle shading',
  },
  {
    id: 'spatial',
    label: 'Spatial',
    previewSrc: '/chess-themes/spatial/wQ.svg',
    description: 'Gradient depth — the most realistic look',
  },
  {
    id: 'maestro',
    label: 'Maestro',
    previewSrc: '/chess-themes/maestro/wQ.svg',
    description: 'Elegant and detailed',
  },
]

// Module-level so the applied theme survives component remounts
const currentTheme = ref<string>(
  localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME
)

function getOrCreateLink(): HTMLLinkElement {
  let el = document.getElementById(LINK_ID) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.id = LINK_ID
    el.rel = 'stylesheet'
    document.head.appendChild(el)
  }
  return el
}

function applyTheme(themeId: string): void {
  if (themeId === DEFAULT_THEME) {
    // cburnett is the static base — just remove any override link
    document.getElementById(LINK_ID)?.remove()
  } else {
    const link = getOrCreateLink()
    const target = `/chess-themes/${themeId}.css`
    if (link.getAttribute('href') !== target) {
      link.href = target
    }
  }
}

export function useChessPieceTheme() {
  function setTheme(themeId: string): void {
    currentTheme.value = themeId
    localStorage.setItem(STORAGE_KEY, themeId)
    applyTheme(themeId)
  }

  /** Call once when the chess board mounts to restore the saved preference. */
  function initTheme(): void {
    const saved = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME
    currentTheme.value = saved
    applyTheme(saved)
  }

  return { currentTheme, setTheme, initTheme, CHESS_THEMES }
}
