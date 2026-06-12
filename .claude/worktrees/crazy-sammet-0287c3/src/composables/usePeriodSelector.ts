import { ref, computed, watch } from 'vue'
import { useAuth } from '@/composables/useAuth.js'

// Global state for the selected period ID
const selectedPeriodId = ref<string | null>(localStorage.getItem('selectedPeriodId'))

export function usePeriodSelector() {
  const { userInfo, isTeacher, isAdmin, emulatingEmail } = useAuth()

  // Admins only count as "teachers" for period selection if they are emulating one
  const isActingAsTeacher = computed(() => isTeacher.value || (isAdmin.value && emulatingEmail.value))

  const setPeriod = (id: string | null) => {
    selectedPeriodId.value = id
    if (id) {
      localStorage.setItem('selectedPeriodId', id)
    } else {
      localStorage.removeItem('selectedPeriodId')
    }
  }

  // The period to use for data fetching
  const effectivePeriodId = computed(() => {
    if (isActingAsTeacher.value) {
      return selectedPeriodId.value
    }
    return userInfo.value?.periodId || null
  })

  // Watch for userInfo changes (like login) to ensure a valid period is selected for teachers
  watch(userInfo, (newInfo) => {
    if (isActingAsTeacher.value && newInfo?.periodIds?.length) {
      if (!selectedPeriodId.value || !newInfo.periodIds.includes(selectedPeriodId.value)) {
        // Auto-select the first period if none selected or if previously selected is no longer valid
        setPeriod(newInfo.periodIds[0])
      }
    }
  }, { immediate: true })

  return {
    selectedPeriodId,
    effectivePeriodId,
    setPeriod,
    isActingAsTeacher,
  }
}
