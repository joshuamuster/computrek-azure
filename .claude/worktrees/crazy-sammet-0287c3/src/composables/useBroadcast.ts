/**
 * useBroadcast — singleton flag that tells MainFrame to render the student layout
 * even when the logged-in user is staff/admin.
 *
 * When isBroadcasting is true:
 *  - MainNav (left-frame) is shown
 *  - AdminNav is hidden
 *  - LCARS bar-panel decorations are shown
 *  - ChampsPanel is still interactive (isTeacher is still true)
 *  - Timer still writes to Firestore (useTimerState still uses teacher's email)
 */

import { ref } from 'vue'
import { usePeriodSelector } from '@/composables/usePeriodSelector'

const BCAST_KEY = 'isBroadcasting'

// Module-level singleton — shared across all components, persisted across refreshes
const isBroadcasting = ref(localStorage.getItem(BCAST_KEY) === 'true')

export function useBroadcast() {
  const { selectedPeriodId, setPeriod } = usePeriodSelector()

  function startBroadcast(periodId: string) {
    setPeriod(periodId)
    isBroadcasting.value = true
    localStorage.setItem(BCAST_KEY, 'true')
  }

  function stopBroadcast() {
    isBroadcasting.value = false
    localStorage.removeItem(BCAST_KEY)
  }

  return {
    isBroadcasting,
    selectedPeriodId,
    startBroadcast,
    stopBroadcast,
  }
}
