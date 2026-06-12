// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useTypingContent.ts
//
// Firestore CRUD for typing lessons.
//
// Schema:
//   typingLessons/{id} {
//     title:          string           — display name, e.g. "Left Home Row"
//     description:    string           — short instructional blurb
//     focusKeys:      string[]         — keys to highlight on visual keyboard
//     passage:        string           — the text students will type
//     order:          number           — sort order in the lesson list (0-based)
//     createdBy:      string           — teacherEmail of creator
//     createdAt:      Timestamp
//     archived:       boolean          — soft-delete
//     lessonType:     'tutorial' | 'lesson' | 'test'
//     targetWpm:      number           — min WPM to pass (0 = no requirement)
//     targetAccuracy: number           — min accuracy % to pass (0 = no requirement)
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

export type TypingLessonType = 'tutorial' | 'lesson' | 'test'

export interface TypingLesson {
  id:             string
  title:          string
  description:    string
  focusKeys:      string[]
  passage:        string
  order:          number
  createdBy:      string
  createdAt:      Timestamp | null
  archived:       boolean
  lessonType:     TypingLessonType
  targetWpm:      number   // minimum WPM to pass; 0 = no requirement
  targetAccuracy: number   // minimum accuracy % to pass; 0 = no requirement
}

export interface TypingLessonDraft {
  title:          string
  description:    string
  focusKeys:      string[]
  passage:        string
  order:          number
  createdBy:      string
  lessonType:     TypingLessonType
  targetWpm:      number
  targetAccuracy: number
}

// ── Default seed lessons ───────────────────────────────────────────────────────

export const DEFAULT_LESSONS: (Omit<TypingLessonDraft, 'createdBy'> & { id?: string })[] = [

  // ══════════════════════════════════════════════════════════════════════════
  //  TUTORIAL SECTION  (lessonType: 'tutorial', orders 1–10)
  //  Two-key drills — one key per hand, same row position.
  //  These introduce finger placement before combining into full rows.
  //  Bar: 10 WPM / 80% accuracy
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'tut-fj',
    lessonType: 'tutorial',
    order: 1,
    targetWpm: 10,
    targetAccuracy: 80,
    title: 'F and J — Anchor Keys',
    description: 'Place your index fingers on F (left hand) and J (right hand). These anchor keys have small ridges you can feel — find them without looking.',
    focusKeys: ['f', 'j'],
    passage: 'fj jf fjfj jfjf ff jj jjff ffjj jf fj jfjf fjfj jf jj ff jf fj fjfj jfjf ff jj jf',
  },
  {
    id: 'tut-dk',
    lessonType: 'tutorial',
    order: 2,
    targetWpm: 10,
    targetAccuracy: 80,
    title: 'D and K — Middle Fingers',
    description: 'Your middle fingers rest on D (left) and K (right). Keep your index fingers anchored on F and J as you practice.',
    focusKeys: ['d', 'k'],
    passage: 'dk kd dkdk kdkd dd kk kkdd ddkk dk kd dkdk kdkd dd kk dk kd dkdk kdkd dk kd dd kk',
  },
  {
    id: 'tut-sl',
    lessonType: 'tutorial',
    order: 3,
    targetWpm: 10,
    targetAccuracy: 80,
    title: 'S and L — Ring Fingers',
    description: 'Your ring fingers press S (left) and L (right). All four finger pairs now have a home row key.',
    focusKeys: ['s', 'l'],
    passage: 'sl ls slsl lsls ss ll llss ssll sl ls slsl lsls sl ls ss ll sl ls slsl lsls sl ls ss',
  },
  {
    id: 'tut-ap',
    lessonType: 'tutorial',
    order: 4,
    targetWpm: 10,
    targetAccuracy: 80,
    title: 'A and ; — Pinkies',
    description: 'Stretch your pinkies to reach A (left) and semicolon ; (right). These are the outermost home row keys.',
    focusKeys: ['a', ';'],
    passage: 'a; ;a a;a; ;a;a aa ;; ;;aa aa;; a; ;a a;a; ;a;a a; ;a aa ;; a; ;a a;a; ;a;a aa ;;',
  },
  {
    id: 'tut-gh',
    lessonType: 'tutorial',
    order: 5,
    targetWpm: 10,
    targetAccuracy: 80,
    title: 'G and H — Bridge Keys',
    description: 'G is reached by the left index finger stretching one key to the right, and H by the right index stretching left. They meet in the middle.',
    focusKeys: ['g', 'h'],
    passage: 'gh hg ghgh hghg gg hh hhgg gghh gh hg ghgh hghg gh hg gg hh gh hg ghgh hghg gh hg gg',
  },
  {
    id: 'tutorial-1',
    lessonType: 'tutorial',
    order: 6,
    targetWpm: 10,
    targetAccuracy: 80,
    title: 'Left Home Row',
    description: 'Combine all five left-hand home row keys: A, S, D, F, G. Use only your left hand and return fingers to rest position between keystrokes.',
    focusKeys: ['a', 's', 'd', 'f', 'g'],
    passage: 'A sad dad adds a salad.',
  },
  {
    id: 'tutorial-2',
    lessonType: 'tutorial',
    order: 7,
    targetWpm: 10,
    targetAccuracy: 80,
    title: 'Right Home Row',
    description: 'Combine all five right-hand home row keys: H, J, K, L, ;. Focus on keeping your wrist relaxed and fingers curved.',
    focusKeys: ['h', 'j', 'k', 'l', ';'],
    passage: 'Ask a lad to add a glass.',
  },
  {
    id: 'tut-ei',
    lessonType: 'tutorial',
    order: 8,
    targetWpm: 10,
    targetAccuracy: 80,
    title: 'E and I — Top Row Middle',
    description: 'Reach your middle fingers up from D→E (left) and K→I (right). Return to home position after each press.',
    focusKeys: ['e', 'i'],
    passage: 'ei ie eiei ieie ee ii iiee eeii ei ie eiei ieie ei ie ee ii ei ie eiei ieie ee ii ei',
  },
  {
    id: 'tut-ru',
    lessonType: 'tutorial',
    order: 9,
    targetWpm: 10,
    targetAccuracy: 80,
    title: 'R and U — Top Row Index',
    description: 'Reach your index fingers up from F→R (left) and J→U (right). These are the most frequently used top-row keys.',
    focusKeys: ['r', 'u'],
    passage: 'ru ur ruru urur rr uu uurr rruu ru ur ruru urur ru ur rr uu ru ur ruru urur ru ur rr',
  },
  {
    id: 'tut-wo',
    lessonType: 'tutorial',
    order: 10,
    targetWpm: 10,
    targetAccuracy: 80,
    title: 'W and O — Top Row Ring',
    description: 'Stretch your ring fingers up from S→W (left) and L→O (right). Keep your other fingers hovering over home position.',
    focusKeys: ['w', 'o'],
    passage: 'wo ow wowo owow ww oo ooww wwoo wo ow wowo owow wo ow ww oo wo ow wowo owow ww oo wo',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  TEST 1 — Easy checkpoint after Tutorial section  (order: 20)
  //  Home-row-only passage. Very low bar — this is a "you made it" moment,
  //  not a gate. Best attempt is recorded; unlimited retries during class.
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'test-1',
    lessonType: 'test',
    order: 20,
    targetWpm: 0,
    targetAccuracy: 0,
    title: 'Keyboard Foundations Test',
    description: 'A gentle checkpoint after completing the tutorial drills. This passage uses only home row keys you have already practiced. Type calmly and accurately — there is no rush. Your best attempt will be recorded.',
    focusKeys: [],
    passage: 'Add a flask. Glad lads had a salad. Sasha held a glass and a half. Dad shall fall. All lads ask Josh. A glad half-full flask falls and fades.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  STANDARD LESSONS  (lessonType: 'lesson', orders 21–28)
  //  The old single-hand row drills, now promoted from Tutorial to Lesson,
  //  plus the combined Mastery lessons and the new Bottom Row Mastery.
  //  Bar: 15 WPM / 85% accuracy
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'tutorial-4',
    lessonType: 'lesson',
    order: 21,
    targetWpm: 15,
    targetAccuracy: 85,
    title: 'Top Row - Left Hand',
    description: 'Reach for the top row with your left hand: Q, W, E, R, T.',
    focusKeys: ['q', 'w', 'e', 'r', 't'],
    passage: 'We saw a red deer at the water.',
  },
  {
    id: 'tutorial-5',
    lessonType: 'lesson',
    order: 22,
    targetWpm: 15,
    targetAccuracy: 85,
    title: 'Top Row - Right Hand',
    description: 'Reach for the top row with your right hand: Y, U, I, O, P.',
    focusKeys: ['y', 'u', 'i', 'o', 'p'],
    passage: 'You look up at the oily pool.',
  },
  {
    id: 'tutorial-3',
    lessonType: 'lesson',
    order: 23,
    targetWpm: 15,
    targetAccuracy: 85,
    title: 'Home Row Mastery',
    description: 'Combine both hands across the full home row: A through ; with G and H in the middle.',
    focusKeys: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
    passage: 'A glad lad had a glass salad.',
  },
  {
    id: 'tutorial-6',
    lessonType: 'lesson',
    order: 24,
    targetWpm: 15,
    targetAccuracy: 85,
    title: 'Top Row Mastery',
    description: 'Combine the full top row from both hands: Q, W, E, R, T, Y, U, I, O, P.',
    focusKeys: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    passage: 'The weather today is really pretty.',
  },
  {
    id: 'tutorial-7',
    lessonType: 'lesson',
    order: 25,
    targetWpm: 15,
    targetAccuracy: 85,
    title: 'Bottom Row - Left Hand',
    description: 'Reach for the bottom row with your left hand: Z, X, C, V, B.',
    focusKeys: ['z', 'x', 'c', 'v', 'b'],
    passage: 'Ava saw a vast cave in the valley.',
  },
  {
    id: 'tutorial-9',
    lessonType: 'lesson',
    order: 26,
    targetWpm: 15,
    targetAccuracy: 85,
    title: 'Bottom Row - Right Hand',
    description: 'Reach for the bottom row with your right hand: N, M, comma, and period.',
    focusKeys: ['n', 'm', ',', '.'],
    passage: 'Minnie met Norm near the noon moon.',
  },
  {
    // NEW — Item 1: Bottom Row Mastery (completes the row-by-row progression)
    id: 'tutorial-10',
    lessonType: 'lesson',
    order: 27,
    targetWpm: 15,
    targetAccuracy: 85,
    title: 'Bottom Row Mastery',
    description: 'Combine both hands across the full bottom row: Z through B on the left, N through period on the right.',
    focusKeys: ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.'],
    passage: 'Zack boxed nine cans of zinc. Vince mixed cobalt and barium. Max can be calm, brave, and nimble. Ben may come back soon.',
  },
  {
    id: 'tutorial-8',
    lessonType: 'lesson',
    order: 28,
    targetWpm: 15,
    targetAccuracy: 85,
    title: 'Full Keyboard Mastery',
    description: 'All 26 letters of the alphabet appear in this classic pangram — the ultimate full-keyboard challenge.',
    focusKeys: [],
    passage: 'The quick brown fox jumps over the lazy dog.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  TEST 2 — After Standard / Mastery section  (order: 50)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'test-2',
    lessonType: 'test',
    order: 50,
    targetWpm: 0,
    targetAccuracy: 0,
    title: 'Full Keyboard Mastery Test',
    description: 'Covers the Mastery section — all rows of the keyboard combined. The passage uses a wide variety of letters. Focus on smooth, steady keystrokes rather than rushing.',
    focusKeys: [],
    passage: 'The quick brown fox jumps over the lazy dog. Every brave pilot explored new zones beyond the vast frontier. We questioned what lay out there in the dark and decided to go find out for ourselves.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  STAR TREK LESSONS  (lessonType: 'lesson', orders 51–70)
  //  Full-keyboard passages at Starfleet reading level.
  //  Bar: 20 WPM / 90% accuracy
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'builtin-0',
    lessonType: 'lesson',
    order: 51,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'The Voyage Begins',
    description: 'Master the iconic introduction to the starship Enterprise.',
    focusKeys: [],
    passage: 'Space, the final frontier. These are the voyages of the starship Enterprise. Its continuing mission: to explore strange new worlds, to seek out new life and new civilizations, to boldly go where no one has gone before.',
  },
  {
    id: 'builtin-1',
    lessonType: 'lesson',
    order: 52,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'Logic and Reason',
    description: 'Reflect on the nature of logic and humanity.',
    focusKeys: [],
    passage: 'Logic is the beginning of wisdom, not the end. To be human is to be complex. You can\'t cut a process out of yourself and expect to remain whole. Change is the essential process of all existence.',
  },
  {
    id: 'builtin-2',
    lessonType: 'lesson',
    order: 53,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'The Needs of the Many',
    description: 'Explore the philosophy of self-sacrifice and friendship.',
    focusKeys: [],
    passage: 'The needs of the many outweigh the needs of the few, or the one. I have been, and ever shall be, your friend. Live long and prosper. Peace is a journey of a thousand miles and it must be taken one step at a time.',
  },
  {
    id: 'builtin-3',
    lessonType: 'lesson',
    order: 54,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'Command Authority',
    description: 'Learn the language of bridge command and high-stakes situations.',
    focusKeys: [],
    passage: 'Make it so. Tea, Earl Grey, hot. Engage! All hands to battle stations. Red alert! Shields up, weapons hot. We have a visual on the unknown vessel. Confirm all systems are nominal.',
  },
  {
    id: 'builtin-4',
    lessonType: 'lesson',
    order: 55,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'The Collective',
    description: 'Face the cold efficiency of the Borg Collective.',
    focusKeys: [],
    passage: 'Resistance is futile. You will be assimilated. We are the Borg. Lower your shields and surrender your ships. We will add your biological and technological distinctiveness to our own. Your culture will adapt to service us.',
  },
  {
    id: 'builtin-5',
    lessonType: 'lesson',
    order: 56,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'Man and Machine',
    description: 'Consider the relationship between humans and their computer systems.',
    focusKeys: [],
    passage: 'Computers make excellent and efficient servants, but I have no wish to serve under them. Insufficient facts always invite danger. There is a way out of every box, a solution to every puzzle; it is just a matter of finding it.',
  },
  {
    id: 'builtin-6',
    lessonType: 'lesson',
    order: 57,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'Human Compassion',
    description: 'The qualities that define what it means to be truly human.',
    focusKeys: [],
    passage: 'Compassion: that is the one thing no machine ever had. Maybe it is what makes me a human being and you a computer. Without freedom of choice there is no creativity. Every moment of every day, we are creating our own future.',
  },
  {
    id: 'builtin-7',
    lessonType: 'lesson',
    order: 58,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'Dreams and Miracles',
    description: 'Harness the power of dreams to create miracles.',
    focusKeys: [],
    passage: 'Miracles are what happen when people give as much energy to their dreams as they do to their fears. The strength of a civilization is not measured by its ability to fight wars, but rather by its ability to prevent them.',
  },
  {
    id: 'builtin-8',
    lessonType: 'lesson',
    order: 59,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'Starfleet Protocol',
    description: 'Guidelines for every officer representing the United Federation of Planets.',
    focusKeys: [],
    passage: 'As a Starfleet officer, you must be prepared to face the unknown with courage and curiosity. Our mission is one of peace and exploration. We represent the United Federation of Planets across the galaxy.',
  },
  {
    id: 'builtin-9',
    lessonType: 'lesson',
    order: 60,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'The Prime Directive',
    description: 'The highest law of non-interference in galactic development.',
    focusKeys: [],
    passage: 'The Prime Directive is our highest law. We must not interfere with the natural development of other civilizations. It is a heavy burden, but one we must carry to ensure the balance of the universe.',
  },
  {
    id: 'builtin-10',
    lessonType: 'lesson',
    order: 61,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'Engineering Excellence',
    description: 'The vital role of engineering in keeping the ship operational.',
    focusKeys: [],
    passage: 'I am giving it all she has got, Captain! The warp core is stable and the dilithium crystals are aligned. We are ready to jump to warp speed on your command. Engineering is the heart of the ship.',
  },
  {
    id: 'builtin-11',
    lessonType: 'lesson',
    order: 62,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'Medical Marvels',
    description: 'The dedication and skill of the ship\'s medical staff.',
    focusKeys: [],
    passage: 'I am a doctor, not a miracle worker! But I will do everything in my power to save this crew. The sickbay is equipped with the latest medical technology. Stay calm and follow the treatment plan.',
  },
  {
    id: 'builtin-12',
    lessonType: 'lesson',
    order: 63,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'Science and Discovery',
    description: 'Using data and sensors to unlock the mysteries of the cosmos.',
    focusKeys: [],
    passage: 'Data is key to understanding the mysteries of the cosmos. Our sensors are picking up an unusual energy signature from the nearby nebula. Launch a probe and begin a full spectral analysis of the region.',
  },
  {
    id: 'builtin-13',
    lessonType: 'lesson',
    order: 64,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'Diplomatic Relations',
    description: 'The art of finding common ground through respect and open-mindedness.',
    focusKeys: [],
    passage: 'Diplomacy is the art of finding common ground between different worlds. We must approach every first contact with respect and an open mind. A single word can start a war or forge a lasting alliance.',
  },
  {
    id: 'builtin-14',
    lessonType: 'lesson',
    order: 65,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'Security and Defense',
    description: 'Maintaining vigilance and protection for the ship and its crew.',
    focusKeys: [],
    passage: 'Security teams, report to the transporter room. We must protect the ship and its crew from any external threats. Always stay vigilant and keep your phasers set to stun unless ordered otherwise.',
  },
  {
    id: 'builtin-15',
    lessonType: 'lesson',
    order: 66,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'Navigation and Helm',
    description: 'Precision control and steady hands at the helm of the ship.',
    focusKeys: [],
    passage: 'Helm, set course for Starbase 74. Maintain warp factor six. We need to navigate through the asteroid belt with precision. Keep a steady hand on the controls and watch the long-range sensors.',
  },
  {
    id: 'builtin-16',
    lessonType: 'lesson',
    order: 67,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'Temporal Anomalies',
    description: 'The dangers and complexities of navigating the space-time continuum.',
    focusKeys: [],
    passage: 'Time is a stubborn thing. We have encountered a temporal rift in the space-time continuum. We must be careful not to alter the past, or we may inadvertently erase our own future.',
  },
  {
    id: 'builtin-17',
    lessonType: 'lesson',
    order: 68,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'The Final Frontier',
    description: 'The infinite possibilities that await us among the stars.',
    focusKeys: [],
    passage: 'The stars are our destination. Every light in the sky is a world waiting to be discovered. We are the pioneers of a new age, pushing the boundaries of what is possible for all of humankind.',
  },
  {
    id: 'builtin-18',
    lessonType: 'lesson',
    order: 69,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'Unity and Diversity',
    description: 'Celebrating the core values of the Federation and its people.',
    focusKeys: [],
    passage: 'Infinite diversity in infinite combinations. This is the foundation of the Federation. By working together, we can overcome any obstacle and build a better future for every sentient being.',
  },
  {
    id: 'builtin-19',
    lessonType: 'lesson',
    order: 70,
    targetWpm: 20,
    targetAccuracy: 90,
    title: 'To the Stars',
    description: 'A look forward to the endless journey of exploration and hope.',
    focusKeys: [],
    passage: 'Our journey continues. There is always more to learn, more to see, and more to experience. Keep your eyes on the horizon and your heart full of hope. The universe is vast, and we are just getting started.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  TEST 3 — Final Exam, end of Star Trek section  (order: 75)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'test-3',
    lessonType: 'test',
    order: 75,
    targetWpm: 0,
    targetAccuracy: 0,
    title: 'Starfleet Final Exam',
    description: 'The semester capstone. A full Star Trek passage covering everything you have practiced — all keys, punctuation, and sustained focus. Your best attempt across the class period counts.',
    focusKeys: [],
    passage: 'Space is our final frontier. We are the crew of the starship Enterprise, sent to explore new worlds and seek out new life. Our mission requires courage, logic, and a deep respect for all civilizations we encounter. Together, we will boldly go where no one has gone before.',
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
        createdBy:      'system',
        createdAt:      null,
        archived:       false,
        lessonType:     def.lessonType ?? 'lesson',
        targetWpm:      def.targetWpm ?? 0,
        targetAccuracy: def.targetAccuracy ?? 0,
      }))

      // 2. Overlay Firestore lessons (match by title).
      // For built-in defaults, preserve lessonType and order from the source
      // of truth in code — a stale Firestore edit can't change lesson structure.
      firestoreLessons.forEach(fl => {
        const idx = merged.findIndex(m => m.title === fl.title)
        if (idx !== -1) {
          const def = merged[idx]
          merged[idx] = {
            ...fl,
            lessonType: def.lessonType,
            order:      def.order,
          }
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
