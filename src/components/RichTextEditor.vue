<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const props = defineProps<{ modelValue: string }>()
const emit  = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const editorEl = ref<HTMLDivElement | null>(null)

onMounted(() => {
  if (editorEl.value) editorEl.value.innerHTML = props.modelValue ?? ''
})

// Only update DOM when the value changes externally (avoids cursor-jump on every keystroke)
watch(() => props.modelValue, (val) => {
  if (editorEl.value && editorEl.value.innerHTML !== val) {
    editorEl.value.innerHTML = val ?? ''
  }
})

function onInput() {
  emit('update:modelValue', editorEl.value?.innerHTML ?? '')
}

// @mousedown.prevent keeps focus in the editor so execCommand sees the selection
function exec(cmd: string) {
  editorEl.value?.focus()
  document.execCommand(cmd, false, undefined)
  emit('update:modelValue', editorEl.value?.innerHTML ?? '')
}
</script>

<template>
  <div class="rte-wrap">
    <div class="rte-toolbar">
      <button type="button" class="rte-btn" @mousedown.prevent="exec('bold')"                 title="Bold (Ctrl+B)"><strong>B</strong></button>
      <button type="button" class="rte-btn rte-btn--italic" @mousedown.prevent="exec('italic')" title="Italic (Ctrl+I)"><em>I</em></button>
      <div class="rte-divider"></div>
      <button type="button" class="rte-btn" @mousedown.prevent="exec('insertUnorderedList')"  title="Bullet list">• List</button>
      <button type="button" class="rte-btn" @mousedown.prevent="exec('insertOrderedList')"    title="Numbered list">1. List</button>
    </div>
    <div
      ref="editorEl"
      contenteditable="true"
      class="lcars-input rte-editor"
      @input="onInput"
    ></div>
  </div>
</template>

<style scoped>
.rte-wrap {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
}

.rte-toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.5rem;
  background: rgba(51, 102, 255, 0.08);
  border: 1px solid rgba(51, 102, 255, 0.25);
  border-bottom: none;
  border-radius: 0.3rem 0.3rem 0 0;
}

.rte-btn {
  background: none;
  border: 1px solid rgba(51, 102, 255, 0.2);
  border-radius: 0.2rem;
  color: #99ccff;
  cursor: pointer;
  font-family: 'Roboto', sans-serif;
  font-size: 0.8rem;
  line-height: 1;
  padding: 0.2rem 0.5rem;
  transition: background 0.15s, border-color 0.15s;
  min-width: 2rem;
}

.rte-btn:hover {
  background: rgba(51, 102, 255, 0.2);
  border-color: rgba(51, 102, 255, 0.5);
  color: #cce0ff;
}

.rte-btn--italic em { font-style: italic; }

.rte-divider {
  width: 1px;
  height: 1.1rem;
  background: rgba(51, 102, 255, 0.2);
  margin: 0 0.15rem;
}

.rte-editor {
  border-radius: 0 0 0.3rem 0.3rem !important;
  font-family: Roboto, Helvetica, Arial, sans-serif;
  font-size: 1rem;
  line-height: 1.5;
  min-height: 10rem;
  min-width: 100%;
  outline: none;
  overflow: hidden;
  text-align: left;
  text-transform: none;
  white-space: pre-wrap;
}

.rte-editor:focus {
  border-color: rgba(51, 102, 255, 0.6) !important;
}

/* Style lists inside the editor */
.rte-editor :deep(ul),
.rte-editor :deep(ol) {
  margin: 0.25rem 0 0.25rem 1.25rem;
  padding: 0;
}

.rte-editor :deep(li) { margin: 0.1rem 0; }
</style>
