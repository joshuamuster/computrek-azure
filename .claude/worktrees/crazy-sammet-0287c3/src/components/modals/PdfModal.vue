<template>
  <Teleport to="main">
  <div v-if="showModal" class="pdf-modal-overlay" @click="closeModal">
    <div class="pdf-modal-content" @click.stop>

      <!-- ── Toolbar ──────────────────────────────────────────────────────── -->
      <div class="pdf-toolbar">
        <div class="toolbar-title">{{ title || 'Document' }}</div>
        <div class="tool-group">
          <a
            :href="downloadUrl"
            target="_blank"
            rel="noopener"
            class="tool-btn download-btn"
            title="Download PDF"
          >⬇ Download PDF</a>
          <a
            :href="fullViewUrl"
            target="_blank"
            rel="noopener"
            class="tool-btn tab-btn"
            title="Open in new tab"
          >↗ Open in New Tab</a>
          <button class="tool-btn close-btn" @click="closeModal" title="Close (Esc)">✕</button>
        </div>
      </div>

      <!-- ── PDF iframe ───────────────────────────────────────────────────── -->
      <iframe
        :src="pdfUrl"
        class="pdf-iframe"
        allow="autoplay"
      />

    </div>
  </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'

interface Props {
  showModal: boolean
  pdfUrl:    string
  title?:    string
}
const props = defineProps<Props>()
const emit  = defineEmits<{ (e: 'close'): void }>()

// Swap /preview → /view so the "open in new tab" link shows the full Google viewer
const fullViewUrl = computed(() =>
  props.pdfUrl.replace(/\/preview(\?.*)?$/, '/view$1')
)

// Build a direct download URL from the Google Drive file ID
const downloadUrl = computed(() => {
  const match = props.pdfUrl.match(/\/file\/d\/([^/]+)/)
  if (!match) return props.pdfUrl
  return `https://drive.google.com/uc?export=download&id=${match[1]}`
})

const closeModal = () => emit('close')

const handleKeydown = (e: KeyboardEvent) => {
  if (props.showModal && e.key === 'Escape') closeModal()
}

onMounted(()  => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>

<style scoped>
/* ── Overlay ─────────────────────────────────────────────────────────────── */
.pdf-modal-overlay {
  position:   absolute;
  inset:      0;
  background: rgba(0, 0, 0, 0.65);
  display:    flex;
  align-items: center;
  justify-content: center;
  z-index:    1000;
  width: 98%;
  margin: 2rem auto;
}

.pdf-modal-content {
  display:        flex;
  flex-direction: column;
  width:          92vw;
  height:         stretch;
  background:     #1a1a2e;
  border:         0.125rem solid #3366ff;
  border-radius:  2rem 2rem 0 0;
  overflow:       hidden;
  box-shadow:     0 1.5rem 4rem rgba(0, 0, 0, 0.6);
}

/* ── Toolbar ─────────────────────────────────────────────────────────────── */
.pdf-toolbar {
  display:        flex;
  align-items:    center;
  justify-content: space-between;
  padding:        0.5rem 1.75rem;
  background:     rgba(0, 0, 0, 0.4);
  border-bottom:  1px solid rgba(255, 255, 255, 0.08);
  flex-shrink:    0;
  gap:            0.5rem;
}

.toolbar-title {
  font-family:    'Antonio', sans-serif;
  font-size:      1rem;
  font-weight:    700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color:          #99ccff;
  white-space:    nowrap;
  overflow:       hidden;
  text-overflow:  ellipsis;
}

.tool-group {
  display:     flex;
  align-items: center;
  gap:         0.4rem;
  flex-shrink: 0;
}

.tool-btn {
  font-family:    'Antonio', sans-serif;
  font-size:      0.8rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color:          rgba(200, 215, 240, 0.75);
  background:     rgba(255, 255, 255, 0.06);
  border:         1px solid rgba(255, 255, 255, 0.1);
  border-radius:  0.375rem;
  padding:        0.35rem 0.75rem;
  cursor:         pointer;
  transition:     background 0.15s, color 0.15s, border-color 0.15s;
  text-decoration: none;
  white-space:    nowrap;
}

.tool-btn:hover {
  background:   rgba(255, 255, 255, 0.12);
  color:        #fff;
  border-color: rgba(255, 255, 255, 0.25);
}

.download-btn { color: rgba(100, 220, 140, 0.85); border-color: rgba(100, 220, 140, 0.3); }
.download-btn:hover { background: rgba(100, 220, 140, 0.15); color: #64dc8c; border-color: rgba(100, 220, 140, 0.6); }

.tab-btn { color: #99ccff; border-color: rgba(153, 204, 255, 0.3); }
.tab-btn:hover { background: rgba(153, 204, 255, 0.15); border-color: rgba(153, 204, 255, 0.6); }

.close-btn { font-size: 1rem; padding: 0.2rem 0.6rem; }

/* ── PDF iframe ──────────────────────────────────────────────────────────── */
.pdf-iframe {
  flex:   1;
  width:  100%;
  border: none;
}
</style>
