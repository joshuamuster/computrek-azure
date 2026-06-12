import { ref, watch } from 'vue';

export interface Question {
  points: number;
  question: string;
  answer: string;
  answered: boolean;
}

export interface Category {
  title: string;
  questions: Question[];
}

export function useJeopardy() {
  const categories = ref<Category[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const spreadsheetId = import.meta.env.VITE_JEOPARDY_SPREADSHEET_ID;
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
  const availableSheets = ref<string[]>([]);
  const selectedSheet = ref(localStorage.getItem('jeopardy_selected_sheet') || '');
  const selectedPeriod = ref(parseInt(localStorage.getItem('jeopardy_selected_period') || '0'));
  const periods = [1, 2, 3, 4, 5, 6, 7, 8];
  
  const periodScores = ref<Record<number, Record<string, number[]>>>({
    1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {}, 8: {}
  });
  const teamNames = ref<Record<number, string[]>>({
    1: ['Team 1', 'Team 2', 'Team 3', 'Team 4'],
    2: ['Team 1', 'Team 2', 'Team 3', 'Team 4'],
    3: ['Team 1', 'Team 2', 'Team 3', 'Team 4'],
    4: ['Team 1', 'Team 2', 'Team 3', 'Team 4'],
    5: ['Team 1', 'Team 2', 'Team 3', 'Team 4'],
    6: ['Team 1', 'Team 2', 'Team 3', 'Team 4'],
    7: ['Team 1', 'Team 2', 'Team 3', 'Team 4'],
    8: ['Team 1', 'Team 2', 'Team 3', 'Team 4']
  });
  const answeredQuestions = ref<Record<number, Record<string, string[]>>>({
    1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {}, 8: {}
  });

  const initializeData = () => {
    const savedScores = localStorage.getItem('jeopardy_period_scores');
    if (savedScores) {
      try {
        const parsed = JSON.parse(savedScores);
        const firstKey = Object.keys(parsed)[0];
        if (firstKey && Array.isArray(parsed[firstKey])) {
          const lastSheet = localStorage.getItem('jeopardy_selected_sheet') || 'Challenge 1';
          Object.keys(parsed).forEach(p => {
            const pNum = parseInt(p);
            periodScores.value[pNum] = { [lastSheet]: parsed[p] };
          });
        } else {
          periodScores.value = parsed;
        }
      } catch (e) {
        console.error('Error parsing saved scores', e);
      }
    }
    const savedNames = localStorage.getItem('jeopardy_team_names');
    if (savedNames) {
      try {
        teamNames.value = JSON.parse(savedNames);
      } catch (e) {
        console.error('Error parsing saved team names', e);
      }
    }
    const savedAnswered = localStorage.getItem('jeopardy_answered_questions');
    if (savedAnswered) {
      try {
        answeredQuestions.value = JSON.parse(savedAnswered);
      } catch (e) {
        console.error('Error parsing saved answered questions', e);
      }
    }
  };

  const fetchSheets = async () => {
    if (!spreadsheetId || !apiKey) return;
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.sheets) {
          availableSheets.value = data.sheets.map((s: any) => s.properties.title);
        }
      }
    } catch (err) {
      console.error('Error fetching spreadsheet metadata:', err);
    }
  };

  const applyAnsweredState = () => {
    if (!categories.value.length) return;
    const period = selectedPeriod.value;
    const sheet = selectedSheet.value;
    const sheetAnswered = answeredQuestions.value[period]?.[sheet] || [];
    
    categories.value.forEach((category, catIdx) => {
      category.questions.forEach((question, qIdx) => {
        const key = `${catIdx}-${qIdx}`;
        question.answered = sheetAnswered.includes(key);
      });
    });
  };

  const fetchJeopardyData = async () => {
    if (!selectedSheet.value || !spreadsheetId || !apiKey) return;
    try {
      loading.value = true;
      error.value = null;
      const range = `${selectedSheet.value}!A1:M6`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch data from Google Sheets');
      }
      const data = await response.json();
      
      if (data.values && data.values.length > 0) {
        const headers = data.values[0];
        const rows = data.values.slice(1);
        
        const mappedCategories: Category[] = [];
        // Each category has two columns: Question and Answer, except the first column which is Points
        for (let i = 1; i < headers.length; i += 2) {
          const categoryTitle = headers[i];
          if (!categoryTitle || categoryTitle.toLowerCase() === 'answers') continue;

          const questions: Question[] = rows.map((row: string[], rowIndex: number) => {
            const pointsValue = parseInt(row[0]) || (rowIndex + 1) * 100;
            const questionText = row[i]?.trim() || 'No Question';
            const answerText = row[i + 1]?.trim() || 'No Answer';
            
            return {
              points: pointsValue,
              question: questionText,
              answer: answerText,
              answered: false
            };
          });
          
          mappedCategories.push({
            title: categoryTitle,
            questions
          });
        }
        
        categories.value = mappedCategories;
        applyAnsweredState();
      } else {
        error.value = 'No data found in the spreadsheet range.';
      }
    } catch (err: any) {
      console.error('Error fetching Jeopardy data:', err);
      error.value = err.message || 'Failed to load Jeopardy data.';
    } finally {
      loading.value = false;
    }
  };

  watch([periodScores, teamNames, selectedPeriod, selectedSheet, answeredQuestions], () => {
    localStorage.setItem('jeopardy_period_scores', JSON.stringify(periodScores.value));
    localStorage.setItem('jeopardy_team_names', JSON.stringify(teamNames.value));
    localStorage.setItem('jeopardy_answered_questions', JSON.stringify(answeredQuestions.value));
    localStorage.setItem('jeopardy_selected_period', selectedPeriod.value.toString());
    localStorage.setItem('jeopardy_selected_sheet', selectedSheet.value);
  }, { deep: true });

  return {
    categories,
    loading,
    error,
    availableSheets,
    selectedSheet,
    selectedPeriod,
    periods,
    periodScores,
    teamNames,
    answeredQuestions,
    initializeData,
    fetchSheets,
    fetchJeopardyData,
    applyAnsweredState
  };
}
