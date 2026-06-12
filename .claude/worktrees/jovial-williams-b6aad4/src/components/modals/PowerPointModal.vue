<template>
  <div v-if="showModal" class="modal-overlay" @click="closeModal">
    <div class="modal-content">
      <button @click="closeModal" class="close-button">&times;</button>
      <a
        v-if="presentUrl"
        :href="presentUrl"
        target="_blank"
        rel="noopener"
        class="present-button"
        @click.stop
        title="Open in Presentation Mode"
      >&#9654; Present</a>
      <iframe :src="viewerUrl" class="powerpoint-frame" @click.stop></iframe>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';

interface Props {
  showModal: boolean;
  pptxUrl: string;
}

interface Emits {
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Extract the Google Slides presentation ID from any supported URL format.
function extractSlidesId(src: string): string | null {
  if (!src.includes('docs.google.com/presentation')) return null;
  try {
    const url = new URL(src, window.location.origin);
    const match = url.pathname.match(/\/d\/([^/]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

// The /present URL — used for the "Present" button (opens in new tab).
// Google blocks /present inside iframes, so we can't embed it directly.
const presentUrl = computed(() => {
  const src = props.pptxUrl || '';
  const id = extractSlidesId(src);
  return id ? `https://docs.google.com/presentation/d/${id}/present?slide=id.p` : null;
});

// Create the viewer URL: support Google Drive previews, Google Slides, Google Docs (published), and .pptx via Office Online viewer
const viewerUrl = computed(() => {
  const src = props.pptxUrl || '';
  if (!src) return '';

  // Google Drive file preview URL — pass through as-is (used for PDFs and
  // any PPTX files not yet converted to Google Slides format).
  if (src.includes('drive.google.com/file/d/')) {
    return src;
  }

  // If it's a Google Slides link, transform to embed URL.
  // Note: /present cannot be iframed (Google sets X-Frame-Options: sameorigin),
  // so we always embed with /embed and expose /present via the "Present" button.
  if (src.includes('docs.google.com/presentation')) {
    const id = extractSlidesId(src);
    if (id) {
      return `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false&delayms=3000`;
    }
    // Fallback
    const fallback = src.replace('/edit', '/embed').replace('/present', '/embed');
    return fallback.includes('embed') ? fallback : src;
  }

  // If it's a Google Doc (published), pass through; ensure embed param when using /pub
  if (src.includes('docs.google.com/document')) {
    try {
      const url = new URL(src, window.location.origin);
      if (url.pathname.includes('/pub') && !url.searchParams.has('embedded')) {
        url.searchParams.set('embedded', 'true');
        return url.toString();
      }
      return src;
    } catch {
      return src;
    }
  }

  // SharePoint sharing link — use action=embedview so the file renders in
  // SharePoint's own viewer using the user's existing browser session.
  if (src.includes('sharepoint.com')) {
    try {
      const url = new URL(src);
      url.searchParams.set('action', 'embedview');
      // Remove the CID param which is only needed for direct-link tracking
      url.searchParams.delete('CID');
      return url.toString();
    } catch {
      return src;
    }
  }

  // Default: use Microsoft's Office Online viewer for PPTX URLs
  const fullUrl = new URL(src, window.location.origin).href;
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullUrl)}`;
});

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.showModal) {
    closeModal();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

const closeModal = () => {
  emit('close');
};
</script>

<style scoped>
.modal-overlay {
  position: absolute;
  top: 1.25rem;
  left: 1.25rem;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  padding: 1.25rem;
  border-radius: 2.5rem 0 0 0;
  width: 100%;
  height: 100%;
  position: relative;
}

.close-button {
  position: absolute;
  top: 0.125rem;
  right: 0.3125rem;
  background-color: transparent;
  border: none;
  font-size: 3rem;
  cursor: pointer;
  color: #333;
  line-height: 0;
}

.present-button {
  position: absolute;
  top: 0.625rem;
  left: 2rem;
  background-color: #1a73e8;
  color: white;
  border: none;
  border-radius: 1rem;
  padding: 0.35rem 0.9rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  z-index: 10;
  transition: background-color 0.2s;
}

.present-button:hover {
  background-color: #1557b0;
}

.powerpoint-frame {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 1.5625rem 0 0 0;
}
</style>
