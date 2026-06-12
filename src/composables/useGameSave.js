/**
 * useGameSave — generic localStorage save/restore for single-player games.
 *
 * Key format: ct_save_{gameId}_{uid}
 * This scopes saves per student so shared browsers don't cross-pollute.
 *
 * Usage:
 *   const gameSave = useGameSave('minesweeper')
 *   gameSave.saveGame({ board, timer, ... })   // serialise to localStorage
 *   const state = gameSave.loadSave()          // null if nothing saved
 *   gameSave.clearSave()                       // after game ends or user discards
 *   gameSave.hasSavedGame                      // ref<boolean>
 *   gameSave.savedAt                           // ref<number|null> (unix ms)
 */

import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

export function useGameSave(gameId) {
  const { userInfo } = useAuth()

  const hasSavedGame = ref(false)
  const savedAt = ref(null)

  function _key() {
    const uid = userInfo.value?.uid ?? 'anonymous'
    return `ct_save_${gameId}_${uid}`
  }

  /** Read localStorage and populate hasSavedGame / savedAt. Returns parsed data or null. */
  function loadSave() {
    try {
      const raw = localStorage.getItem(_key())
      if (raw) {
        const data = JSON.parse(raw)
        hasSavedGame.value = true
        savedAt.value = data.savedAt ?? null
        return data
      }
    } catch (e) {
      console.warn('[useGameSave] loadSave parse error:', e)
    }
    hasSavedGame.value = false
    savedAt.value = null
    return null
  }

  /** Persist current game state. Stamps savedAt automatically. */
  function saveGame(state) {
    try {
      const data = { ...state, savedAt: Date.now() }
      localStorage.setItem(_key(), JSON.stringify(data))
      hasSavedGame.value = true
      savedAt.value = data.savedAt
    } catch (e) {
      console.warn('[useGameSave] saveGame error:', e)
    }
  }

  /** Remove the save entry and reset reactive flags. */
  function clearSave() {
    try {
      localStorage.removeItem(_key())
    } catch (e) {}
    hasSavedGame.value = false
    savedAt.value = null
  }

  return { saveGame, loadSave, clearSave, hasSavedGame, savedAt }
}
