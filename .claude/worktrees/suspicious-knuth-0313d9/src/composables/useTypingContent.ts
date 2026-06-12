// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useTypingContent.ts
//
// Firestore CRUD for typing lessons.
//
// Schema:
//   typingLessons/{id} {
//     title:       string           — display name, e.g. "Left Home Row"
//     description: string           — short instructional blurb
//     focusKeys:   string[]         — keys to highlight on visual keyboard, e.g. ['a','s','d','f']
//     passage:     string           — the text students will type
//     order:       number           — sort order in the lesson list (0-based)
//     createdBy:   string           — teacherEmail of creator
//     createdAt:   Timestamp
//     archived:    boolean          — soft-delete
//   }
// ─────────────────────────────────────────────────────────────────────────────

import { ref } from 'vue'
import {
  collection, addDoc, updateDoc, getDocs,
  doc, query, orderBy, where,
  serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TypingLesson {
  id:          string
  title:       string
  description: string
  focusKeys:   string[]
  passage:     string
  order:       number
  createdBy:   string
  createdAt:   Timestamp | null
  archived:    boolean
  isTutorial:  boolean
}

export interface TypingLessonDraft {
  title:       string
  description: string
  focusKeys:   string[]
  passage:     string
  order:       number
  createdBy:   string
  isTutorial:  boolean
}

// ── Default seed lessons ───────────────────────────────────────────────────────

export const DEFAULT_LESSONS: (Omit<TypingLessonDraft, 'createdBy'> & { id?: string })[] = [
  // ── Tutorial Lessons (8) ────────────────────────────────────────────────────
  {
    id: 'tutorial-1',
    isTutorial: true,
    order: 1,
    title: 'Left Home Row',
    description: 'Focus on the home row using your left hand: A, S, D, F, G.',
    focusKeys: ['a', 's', 'd', 'f', 'g'],
    passage: 'A sad dad adds a salad.',
  },
  {
    id: 'tutorial-2',
    isTutorial: true,
    order: 2,
    title: 'Right Home Row',
    description: 'Focus on the home row using your right hand: H, J, K, L, ;',
    focusKeys: ['h', 'j', 'k', 'l', ';'],
    passage: 'Ask a lad to add a glass.',
  },
  {
    id: 'tutorial-3',
    isTutorial: true,
    order: 3,
    title: 'Home Row Mastery',
    description: 'Master all the keys on the home row.',
    focusKeys: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
    passage: 'A glad lad had a glass salad.',
  },
  {
    id: 'tutorial-4',
    isTutorial: true,
    order: 4,
    title: 'Top Row - Left Hand',
    description: 'Reach for the top row with your left hand: Q, W, E, R, T.',
    focusKeys: ['q', 'w', 'e', 'r', 't'],
    passage: 'We saw a red deer at the water.',
  },
  {
    id: 'tutorial-5',
    isTutorial: true,
    order: 5,
    title: 'Top Row - Right Hand',
    description: 'Reach for the top row with your right hand: Y, U, I, O, P.',
    focusKeys: ['y', 'u', 'i', 'o', 'p'],
    passage: 'You look up at the oily pool.',
  },
  {
    id: 'tutorial-6',
    isTutorial: true,
    order: 6,
    title: 'Top Row Mastery',
    description: 'Combine top and home rows for fluid movement.',
    focusKeys: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    passage: 'The weather today is really pretty.',
  },
  {
    id: 'tutorial-7',
    isTutorial: true,
    order: 7,
    title: 'Bottom Row - Left Hand',
    description: 'Reach for the bottom row with your left hand: Z, X, C, V, B.',
    focusKeys: ['z', 'x', 'c', 'v', 'b'],
    passage: 'Ava saw a vast cave in the valley.',
  },
  {
    id: 'tutorial-8',
    isTutorial: true,
    order: 8,
    title: 'Full Keyboard Mastery',
    description: 'The final warmup: all letters in the alphabet.',
    focusKeys: [],
    passage: 'The quick brown fox jumps over the lazy dog.',
  },

  // ── Star Trek Lessons (20) ──────────────────────────────────────────────────
  {
    id: 'builtin-0',
    isTutorial: false,
    order: 9,
    title: 'The Voyage Begins',
    description: 'Master the iconic introduction to the starship Enterprise.',
    focusKeys: [],
    passage: 'Space, the final frontier. These are the voyages of the starship Enterprise. Its continuing mission: to explore strange new worlds, to seek out new life and new civilizations, to boldly go where no one has gone before.',
  },
  {
    id: 'builtin-1',
    isTutorial: false,
    order: 10,
    title: 'Logic and Reason',
    description: 'Reflect on the nature of logic and humanity.',
    focusKeys: [],
    passage: 'Logic is the beginning of wisdom, not the end. To be human is to be complex. You can\'t cut a process out of yourself and expect to remain whole. Change is the essential process of all existence.',
  },
  {
    id: 'builtin-2',
    isTutorial: false,
    order: 11,
    title: 'The Needs of the Many',
    description: 'Explore the philosophy of self-sacrifice and friendship.',
    focusKeys: [],
    passage: 'The needs of the many outweigh the needs of the few, or the one. I have been, and ever shall be, your friend. Live long and prosper. Peace is a journey of a thousand miles and it must be taken one step at a time.',
  },
  {
    id: 'builtin-3',
    isTutorial: false,
    order: 12,
    title: 'Command Authority',
    description: 'Learn the language of bridge command and high-stakes situations.',
    focusKeys: [],
    passage: 'Make it so. Tea, Earl Grey, hot. Engage! All hands to battle stations. Red alert! Shields up, weapons hot. We have a visual on the unknown vessel. Confirm all systems are nominal.',
  },
  {
    id: 'builtin-4',
    isTutorial: false,
    order: 13,
    title: 'The Collective',
    description: 'Face the cold efficiency of the Borg Collective.',
    focusKeys: [],
    passage: 'Resistance is futile. You will be assimilated. We are the Borg. Lower your shields and surrender your ships. We will add your biological and technological distinctiveness to our own. Your culture will adapt to service us.',
  },
  {
    id: 'builtin-5',
    isTutorial: false,
    order: 14,
    title: 'Man and Machine',
    description: 'Consider the relationship between humans and their computer systems.',
    focusKeys: [],
    passage: 'Computers make excellent and efficient servants, but I have no wish to serve under them. Insufficient facts always invite danger. There is a way out of every box, a solution to every puzzle; it is just a matter of finding it.',
  },
  {
    id: 'builtin-6',
    isTutorial: false,
    order: 15,
    title: 'Human Compassion',
    description: 'The qualities that define what it means to be truly human.',
    focusKeys: [],
    passage: 'Compassion: that is the one thing no machine ever had. Maybe it is what makes me a human being and you a computer. Without freedom of choice there is no creativity. Every moment of every day, we are creating our own future.',
  },
  {
    id: 'builtin-7',
    isTutorial: false,
    order: 16,
    title: 'Dreams and Miracles',
    description: 'Harness the power of dreams to create miracles.',
    focusKeys: [],
    passage: 'Miracles are what happen when people give as much energy to their dreams as they do to their fears. The strength of a civilization is not measured by its ability to fight wars, but rather by its ability to prevent them.',
  },
  {
    id: 'builtin-8',
    isTutorial: false,
    order: 17,
    title: 'Starfleet Protocol',
    description: 'Guidelines for every officer representing the United Federation of Planets.',
    focusKeys: [],
    passage: 'As a Starfleet officer, you must be prepared to face the unknown with courage and curiosity. Our mission is one of peace and exploration. We represent the United Federation of Planets across the galaxy.',
  },
  {
    id: 'builtin-9',
    isTutorial: false,
    order: 18,
    title: 'The Prime Directive',
    description: 'The highest law of non-interference in galactic development.',
    focusKeys: [],
    passage: 'The Prime Directive is our highest law. We must not interfere with the natural development of other civilizations. It is a heavy burden, but one we must carry to ensure the balance of the universe.',
  },
  {
    id: 'builtin-10',
    isTutorial: false,
    order: 19,
    title: 'Engineering Excellence',
    description: 'The vital role of engineering in keeping the ship operational.',
    focusKeys: [],
    passage: 'I am giving it all she has got, Captain! The warp core is stable and the dilithium crystals are aligned. We are ready to jump to warp speed on your command. Engineering is the heart of the ship.',
  },
  {
    id: 'builtin-11',
    isTutorial: false,
    order: 20,
    title: 'Medical Marvels',
    description: 'The dedication and skill of the ship\'s medical staff.',
    focusKeys: [],
    passage: 'I am a doctor, not a miracle worker! But I will do everything in my power to save this crew. The sickbay is equipped with the latest medical technology. Stay calm and follow the treatment plan.',
  },
  {
    id: 'builtin-12',
    isTutorial: false,
    order: 21,
    title: 'Science and Discovery',
    description: 'Using data and sensors to unlock the mysteries of the cosmos.',
    focusKeys: [],
    passage: 'Data is key to understanding the mysteries of the cosmos. Our sensors are picking up an unusual energy signature from the nearby nebula. Launch a probe and begin a full spectral analysis of the region.',
  },
  {
    id: 'builtin-13',
    isTutorial: false,
    order: 22,
    title: 'Diplomatic Relations',
    description: 'The art of finding common ground through respect and open-mindedness.',
    focusKeys: [],
    passage: 'Diplomacy is the art of finding common ground between different worlds. We must approach every first contact with respect and an open mind. A single word can start a war or forge a lasting alliance.',
  },
  {
    id: 'builtin-14',
    isTutorial: false,
    order: 23,
    title: 'Security and Defense',
    description: 'Maintaining vigilance and protection for the ship and its crew.',
    focusKeys: [],
    passage: 'Security teams, report to the transporter room. We must protect the ship and its crew from any external threats. Always stay vigilant and keep your phasers set to stun unless ordered otherwise.',
  },
  {
    id: 'builtin-15',
    isTutorial: false,
    order: 24,
    title: 'Navigation and Helm',
    description: 'Precision control and steady hands at the helm of the ship.',
    focusKeys: [],
    passage: 'Helm, set course for Starbase 74. Maintain warp factor six. We need to navigate through the asteroid belt with precision. Keep a steady hand on the controls and watch the long-range sensors.',
  },
  {
    id: 'builtin-16',
    isTutorial: false,
    order: 25,
    title: 'Temporal Anomalies',
    description: 'The dangers and complexities of navigating the space-time continuum.',
    focusKeys: [],
    passage: 'Time is a stubborn thing. We have encountered a temporal rift in the space-time continuum. We must be careful not to alter the past, or we may inadvertently erase our own future.',
  },
  {
    id: 'builtin-17',
    isTutorial: false,
    order: 26,
    title: 'The Final Frontier',
    description: 'The infinite possibilities that await us among the stars.',
    focusKeys: [],
    passage: 'The stars are our destination. Every light in the sky is a world waiting to be discovered. We are the pioneers of a new age, pushing the boundaries of what is possible for all of humankind.',
  },
  {
    id: 'builtin-18',
    isTutorial: false,
    order: 27,
    title: 'Unity and Diversity',
    description: 'Celebrating the core values of the Federation and its people.',
    focusKeys: [],
    passage: 'Infinite diversity in infinite combinations. This is the foundation of the Federation. By working together, we can overcome any obstacle and build a better future for every sentient being.',
  },
  {
    id: 'builtin-19',
    isTutorial: false,
    order: 28,
    title: 'To the Stars',
    description: 'A look forward to the endless journey of exploration and hope.',
    focusKeys: [],
    passage: 'Our journey continues. There is always more to learn, more to see, and more to experience. Keep your eyes on the horizon and your heart full of hope. The universe is vast, and we are just getting started.',
  },
]

// ── Composable ────────────────────────────────────────────────────────────────

export function useTypingContent() {
  const { userInfo } = useAuth()
  const lessons   = ref<TypingLesson[]>([])
  const isLoading = ref(false)
  const error     = ref('')

  // Fetch all non-archived lessons, sorted by order
  const fetchLessons = async (includeArchived: boolean = false) => {
    isLoading.value = true
    error.value = ''
    try {
      // Always fetch all to correctly handle overrides and archiving
      const q = query(
        collection(db, 'typingLessons'),
        orderBy('order', 'asc'),
      )
      const snap = await getDocs(q)
      const firestoreLessons = snap.docs.map(d => ({ id: d.id, ...d.data() } as TypingLesson))

      // 1. Build initial list from DEFAULT_LESSONS
      const merged: TypingLesson[] = DEFAULT_LESSONS.map((def, idx) => ({
        id: def.id || `builtin-${idx}`,
        ...def,
        createdBy: 'system',
        createdAt: null,
        archived:  false,
        isTutorial: def.isTutorial ?? false,
      }))

      // 2. Overlay Firestore lessons (match by title)
      firestoreLessons.forEach(fl => {
        const idx = merged.findIndex(m => m.title === fl.title)
        if (idx !== -1) {
          merged[idx] = fl
        } else {
          merged.push(fl)
        }
      })

      // 3. Filter if needed
      let finalLessons = merged
      if (!includeArchived) {
        finalLessons = finalLessons.filter(l => !l.archived)
      }

      // 4. Sort by order
      lessons.value = finalLessons.sort((a, b) => a.order - b.order)
    } catch (e: any) {
      console.error('fetchLessons:', e)
      error.value = 'Failed to load lessons.'
    } finally {
      isLoading.value = false
    }
  }

  // Fetch all lessons including archived (for admin view)
  const fetchAllLessons = async () => {
    return fetchLessons(true)
  }

  // Create a new lesson
  const createLesson = async (draft: TypingLessonDraft): Promise<string | null> => {
    error.value = ''
    try {
      const ref = await addDoc(collection(db, 'typingLessons'), {
        ...draft,
        archived:  false,
        createdAt: serverTimestamp(),
      })
      return ref.id
    } catch (e: any) {
      console.error('createLesson:', e)
      error.value = 'Failed to create lesson.'
      return null
    }
  }

  // Update a lesson's fields
  const updateLesson = async (
    id: string,
    changes: Partial<Omit<TypingLesson, 'id' | 'createdAt' | 'createdBy'>>,
  ): Promise<boolean> => {
    error.value = ''
    try {
      if (id.startsWith('builtin-')) {
        // Saving a default lesson to Firestore for the first time
        const lessonToSave = lessons.value.find(l => l.id === id)
        if (!lessonToSave) return false

        const newId = await createLesson({
          ...lessonToSave,
          ...changes,
          createdBy: userInfo.value?.email ?? 'admin',
        } as TypingLessonDraft)

        if (newId) {
          // Update local ref immediately so UI reflects the change (and new ID)
          const idx = lessons.value.findIndex(l => l.id === id)
          if (idx !== -1) {
            lessons.value[idx] = { ...lessons.value[idx], ...changes, id: newId }
          }
          return true
        }
        return false
      }

      await updateDoc(doc(db, 'typingLessons', id), changes as Record<string, any>)
      const idx = lessons.value.findIndex(l => l.id === id)
      if (idx !== -1) lessons.value[idx] = { ...lessons.value[idx], ...changes }
      return true
    } catch (e: any) {
      console.error('updateLesson:', e)
      error.value = 'Failed to update lesson.'
      return false
    }
  }

  // Soft-delete a lesson
  const archiveLesson = async (id: string): Promise<boolean> => {
    return updateLesson(id, { archived: true })
  }


  return {
    lessons,
    isLoading,
    error,
    fetchLessons,
    fetchAllLessons,
    createLesson,
    updateLesson,
    archiveLesson,
  }
}
