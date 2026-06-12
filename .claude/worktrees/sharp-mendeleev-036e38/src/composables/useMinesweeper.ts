import { ref } from 'vue';

export type DifficultyKey = 'cadet' | 'standard' | 'red-alert';

const VALID_DIFFICULTIES: DifficultyKey[] = ['cadet', 'standard', 'red-alert'];
const storedDifficulty = localStorage.getItem('minesweeper_difficulty') as DifficultyKey;
const selectedDifficulty = ref<DifficultyKey>(
  VALID_DIFFICULTIES.includes(storedDifficulty) ? storedDifficulty : 'cadet'
);

export function useMinesweeper() {
  const setDifficulty = (diff: DifficultyKey) => {
    selectedDifficulty.value = diff;
    localStorage.setItem('minesweeper_difficulty', diff);
  };
  
  return {
    selectedDifficulty,
    setDifficulty
  };
}