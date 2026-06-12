// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useTypingCustomText.ts
//
// Firestore CRUD for teacher-authored custom typing passages.
//
// Schema:
//   typingCustomTexts/{id} {
//     title:       string       — display name, e.g. "Star Trek Quote #1"
//     passage:     string       — the text students will type
//     category:    string       — optional grouping label, e.g. "Trek Quotes", "Vocab"
//     createdBy:   string       — teacherEmail of creator
//     createdAt:   Timestamp
//     archived:    boolean      — soft-delete
//   }
// ─────────────────────────────────────────────────────────────────────────────

import { ref } from 'vue'
import {
  collection, addDoc, updateDoc, getDocs,
  doc, query, orderBy, where, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomText {
  id:          string
  title:       string
  passage:     string
  category:    string
  createdBy:   string
  createdAt:   Timestamp | null
  archived:    boolean
}

export interface CustomTextDraft {
  title:     string
  passage:   string
  category:  string
  createdBy: string
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useTypingCustomText() {
  const texts     = ref<CustomText[]>([])
  const isLoading = ref(false)
  const error     = ref('')

  // Fetch active (non-archived) texts, newest first
  const fetchTexts = async () => {
    isLoading.value = true
    error.value = ''
    try {
      const q = query(
        collection(db, 'typingCustomTexts'),
        where('archived', '==', false),
        orderBy('createdAt', 'desc'),
      )
      const snap = await getDocs(q)
      texts.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomText))
    } catch (e: any) {
      console.error('fetchTexts:', e)
      error.value = 'Failed to load custom texts.'
    } finally {
      isLoading.value = false
    }
  }

  // Fetch all texts including archived (admin view)
  const fetchAllTexts = async () => {
    isLoading.value = true
    error.value = ''
    try {
      const q = query(
        collection(db, 'typingCustomTexts'),
        orderBy('createdAt', 'desc'),
      )
      const snap = await getDocs(q)
      texts.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomText))
    } catch (e: any) {
      console.error('fetchAllTexts:', e)
      error.value = 'Failed to load custom texts.'
    } finally {
      isLoading.value = false
    }
  }

  const createText = async (draft: CustomTextDraft): Promise<string | null> => {
    error.value = ''
    try {
      const ref = await addDoc(collection(db, 'typingCustomTexts'), {
        ...draft,
        archived:  false,
        createdAt: serverTimestamp(),
      })
      return ref.id
    } catch (e: any) {
      console.error('createText:', e)
      error.value = 'Failed to create passage.'
      return null
    }
  }

  const updateText = async (
    id: string,
    changes: Partial<Omit<CustomText, 'id' | 'createdAt' | 'createdBy'>>,
  ): Promise<boolean> => {
    error.value = ''
    try {
      await updateDoc(doc(db, 'typingCustomTexts', id), changes as Record<string, any>)
      const idx = texts.value.findIndex(t => t.id === id)
      if (idx !== -1) texts.value[idx] = { ...texts.value[idx], ...changes }
      return true
    } catch (e: any) {
      console.error('updateText:', e)
      error.value = 'Failed to update passage.'
      return false
    }
  }

  const archiveText = async (id: string) => updateText(id, { archived: true })
  const restoreText = async (id: string) => updateText(id, { archived: false })

  return {
    texts,
    isLoading,
    error,
    fetchTexts,
    fetchAllTexts,
    createText,
    updateText,
    archiveText,
    restoreText,
  }
}
