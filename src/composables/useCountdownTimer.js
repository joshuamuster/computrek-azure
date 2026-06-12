import { ref, computed } from 'vue';
import alarmSound from '@/assets/sounds/SFX-Computer/alarm1.wav';

// Global shared state - singleton pattern
const showCountdownPopup = ref(false);
const countdownSeconds = ref(0);
const isCountdownRunning = ref(false);
const customHours = ref(0);
const customMinutes = ref(0);
const customSeconds = ref(0);

// Global interval reference
let countdownInterval = null;

export function useCountdownTimer() {

  // localStorage functions for countdown timer persistence
  const saveCountdownState = () => {
    try {
      const state = {
        countdownSeconds: countdownSeconds.value,
        isCountdownRunning: isCountdownRunning.value,
        timestamp: Date.now()
      };
      localStorage.setItem('countdownTimerState', JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save countdown timer state:', error);
    }
  };

  const loadCountdownState = () => {
    try {
      const saved = localStorage.getItem('countdownTimerState');
      if (saved) {
        const state = JSON.parse(saved);
        const now = Date.now();
        const elapsed = Math.floor((now - state.timestamp) / 1000);

        if (state.isCountdownRunning && state.countdownSeconds > 0) {
          // Calculate remaining time after elapsed time during page refresh
          const remainingSeconds = Math.max(0, state.countdownSeconds - elapsed);
          countdownSeconds.value = remainingSeconds;

          if (remainingSeconds > 0) {
            // Resume the countdown if there's time left
            isCountdownRunning.value = true;
            startCountdownInterval();
          } else {
            // Timer finished while page was refreshed
            isCountdownRunning.value = false;
            countdownSeconds.value = 0;
          }
        } else {
          // Timer was paused or finished
          countdownSeconds.value = state.countdownSeconds;
          isCountdownRunning.value = false;
        }
      }
    } catch (error) {
      console.warn('Failed to load countdown timer state:', error);
    }
  };

  const clearCountdownState = () => {
    try {
      localStorage.removeItem('countdownTimerState');
    } catch (error) {
      console.warn('Failed to clear countdown timer state:', error);
    }
  };

  // Computed property for countdown display
  const countdownDisplay = computed(() => {
    // If countdown is running or has been set, show the countdown seconds
    if (countdownSeconds.value > 0) {
      const minutes = Math.floor(countdownSeconds.value / 60);
      const seconds = countdownSeconds.value % 60;
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // If no countdown is set but custom time values exist, show them
    const hours = customHours.value || 0;
    const minutes = customMinutes.value || 0;
    const seconds = customSeconds.value || 0;
    const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
    
    if (totalSeconds > 0) {
      const displayMinutes = Math.floor(totalSeconds / 60);
      const displaySeconds = totalSeconds % 60;
      return `${displayMinutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
    }
    
    // Default display when no time is set
    return '00:00';
  });

  // Internal helper: trigger a brief red screen flash
  const triggerScreenFlash = () => {
    try {
      const alarmLight = document.getElementById('screen-flash-overlay');
      if (!alarmLight) return;
      // Restart animation by toggling the class
	    alarmLight.classList.remove('flash-active');
      // Force reflow to allow re-adding the class to retrigger animation
      // eslint-disable-next-line no-unused-expressions
      void alarmLight.offsetWidth;
	    alarmLight.classList.add('flash-active');
    } catch (e) {
      // non-fatal; ignore if DOM not available
    }
  };

  // Function to play alarm sound when timer reaches zero
  const playAlarmSound = () => {
    try {
      const audio = new Audio(alarmSound);
      let playCount = 0;
      const maxPlays = 3;

      const playAlarm = () => {
        // Flash the screen in sync with each alarm play
        triggerScreenFlash();
        if (playCount < maxPlays) {
          audio.currentTime = 0; // Reset to beginning
          audio.play().catch(error => {
            console.warn('Failed to play alarm sound:', error);
          });
          playCount++;
        }
      };

      // Handler to schedule next play 1s after each end
      const onEnded = () => {
        if (playCount >= maxPlays) {
          audio.removeEventListener('ended', onEnded);
          return;
        }
        setTimeout(() => {
          // Only proceed if we still have plays remaining
          if (playCount < maxPlays) {
            playAlarm();
          }
          if (playCount >= maxPlays) {
            audio.removeEventListener('ended', onEnded);
          }
        }, 500);
      };

      // Play the first time
      playAlarm();

      // Set up event listener to replay when audio ends with 1s pause
      audio.addEventListener('ended', onEnded);
    } catch (error) {
      console.warn('Failed to create alarm audio:', error);
    }
  };

  // Separate function to start the countdown interval
  const startCountdownInterval = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    countdownInterval = setInterval(() => {
      countdownSeconds.value--;
      saveCountdownState();
      if (countdownSeconds.value <= 0) {
        pauseCountdown();
        playAlarmSound(); // Play alarm sound when timer reaches zero
      }
    }, 1000);
  };

  // Popup management functions
  const toggleCountdownPopup = () => {
    showCountdownPopup.value = !showCountdownPopup.value;
  };

  const closeCountdownPopup = () => {
    showCountdownPopup.value = false;
  };

  // Timer control functions
  const setCountdown = (minutes) => {
    // Adjust preset to add increments instead of replacing
    const delta = minutes * 60;
    const wasRunning = isCountdownRunning.value;
    // If timer is currently running or has a set value, add to remaining time; else add to custom selection
    if (wasRunning || countdownSeconds.value > 0) {
      countdownSeconds.value = Math.max(0, countdownSeconds.value + delta);
    } else {
      // Apply to the editable custom fields first if they have values, else to countdownSeconds
      const hours = customHours.value || 0;
      const mins = customMinutes.value || 0;
      const secs = customSeconds.value || 0;
      const total = (hours * 3600) + (mins * 60) + secs + delta;
      // Update custom fields to reflect the new total for clarity when not running
      customHours.value = Math.floor(total / 3600);
      const rem = total % 3600;
      customMinutes.value = Math.floor(rem / 60);
      customSeconds.value = rem % 60;
      // Do not start timer here; user must press Make It So
    }
    // Do not change running state when adding; only pause if previously paused
    isCountdownRunning.value = wasRunning;
    saveCountdownState();
  };

  const addCountdownSeconds = (secondsToAdd) => {
    const delta = secondsToAdd;
    const wasRunning = isCountdownRunning.value;
    if (wasRunning || countdownSeconds.value > 0) {
      countdownSeconds.value = Math.max(0, countdownSeconds.value + delta);
    } else {
      const hours = customHours.value || 0;
      const mins = customMinutes.value || 0;
      const secs = customSeconds.value || 0;
      const total = (hours * 3600) + (mins * 60) + secs + delta;
      customHours.value = Math.floor(total / 3600);
      const rem = total % 3600;
      customMinutes.value = Math.floor(rem / 60);
      customSeconds.value = rem % 60;
    }
    isCountdownRunning.value = wasRunning;
    saveCountdownState();
  };

  const startCountdown = () => {
    // If no time is set in countdownSeconds, check if custom time values exist
    if (countdownSeconds.value === 0) {
      const hours = customHours.value || 0;
      const minutes = customMinutes.value || 0;
      const seconds = customSeconds.value || 0;
      const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;

      if (totalSeconds > 0) {
        countdownSeconds.value = totalSeconds;
        // Clear custom values after setting the timer
        customHours.value = 0;
        customMinutes.value = 0;
        customSeconds.value = 0;
      }
    }

    // Start the countdown if we have time and it's not already running
    if (countdownSeconds.value > 0 && !isCountdownRunning.value) {
      isCountdownRunning.value = true;
      saveCountdownState();
      startCountdownInterval();
    }
  };

  const pauseCountdown = () => {
    isCountdownRunning.value = false;
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    saveCountdownState();
  };

  const resetCountdown = () => {
    pauseCountdown();
    countdownSeconds.value = 0;
    clearCountdownState();
  };

  // Time picker increment/decrement functions
  const incrementHours = () => {
    if (customHours.value < 23) {
      customHours.value++;
    }
  };

  const decrementHours = () => {
    if (customHours.value > 0) {
      customHours.value--;
    }
  };

  const incrementMinutes = () => {
    if (customMinutes.value < 59) {
      customMinutes.value++;
    }
  };

  const decrementMinutes = () => {
    if (customMinutes.value > 0) {
      customMinutes.value--;
    }
  };

  const incrementSeconds = () => {
    if (customSeconds.value < 59) {
      customSeconds.value++;
    }
  };

  const decrementSeconds = () => {
    if (customSeconds.value > 0) {
      customSeconds.value--;
    }
  };

  // Cleanup function
  const cleanup = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
  };

  return {
    // State
    showCountdownPopup,
    countdownSeconds,
    isCountdownRunning,
    customHours,
    customMinutes,
    customSeconds,
    countdownDisplay,
    
    // Functions
    toggleCountdownPopup,
    closeCountdownPopup,
    setCountdown,
    startCountdown,
    pauseCountdown,
    resetCountdown,
    incrementHours,
    decrementHours,
    incrementMinutes,
    decrementMinutes,
    incrementSeconds,
    decrementSeconds,
    addCountdownSeconds,
    loadCountdownState,
    cleanup
  };
}
