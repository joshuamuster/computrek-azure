<template>
  <div class="videos-page">

    <!-- ── Embed at the top (16:9) ────────────────────────────────────────── -->
    <section class="embed-area">
      <!-- YT IFrame API targets this div -->
      <div id="yt-player" class="yt-player-target"></div>

      <!-- Shown before the player is ready -->
      <div v-if="!playerReady" class="embed-placeholder">
        <div class="placeholder-icon">▶</div>
        <p class="placeholder-text">Paste a YouTube playlist URL below to get started.</p>
      </div>
    </section>

    <!-- ── Playlist section below ─────────────────────────────────────────── -->
    <div class="playlist-section">

      <div class="playlist-header">
        <div class="playlist-header-left">
          <span class="playlist-title">PLAYLIST</span>
          <span v-if="!loadingVideos" class="playlist-count">
            {{ videos.length }} video{{ videos.length !== 1 ? 's' : '' }}
          </span>
          <span v-if="loadingVideos" class="playlist-loading">Loading…</span>
        </div>
      </div>

      <!-- Video list -->
      <div v-if="loadingVideos" class="playlist-empty">
        Fetching playlist…
      </div>
      <div v-else-if="!loadingVideos && videos.length === 0" class="playlist-empty">
        Playlist is empty or could not be loaded.
      </div>

      <ul v-else class="playlist-list">
        <li
          v-for="(video, i) in videos"
          :key="video.id"
          class="playlist-item"
          :class="{ 'playlist-item--active': activeIndex === i }"
          @click="playAt(i)"
        >
          <div class="playlist-thumb-wrap">
            <img class="playlist-thumb" :src="thumbUrl(video.id)" :alt="video.title" />
            <span v-if="activeIndex === i" class="now-playing-badge">▶</span>
          </div>
          <div class="playlist-info">
            <span class="playlist-name">{{ video.title }}</span>
          </div>
        </li>
      </ul>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

// ── Types ──────────────────────────────────────────────────────────────────────

interface VideoEntry { id: string; title: string }

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: (() => void) | undefined
  }
}

// ── State ──────────────────────────────────────────────────────────────────────

const PLAYLISTS = {
  lunch:        'PLIVDUK2xuXZuN3TVkmK127g9d3ACb8ioP',
  afterschool:  'PLIVDUK2xuXZu8d0YRUEhAxPJ6K8d75wBX',
}

const route = useRoute()
const PLAYLIST_ID = computed(() =>
  PLAYLISTS[(route.query.mode as keyof typeof PLAYLISTS)] ?? PLAYLISTS.lunch
)

const playerReady   = ref(false)
const videos        = ref<VideoEntry[]>([])
const activeIndex   = ref<number | null>(null)
const loadingVideos = ref(false)

let player: any = null
let fetchRetryTimer: ReturnType<typeof setTimeout> | null = null

// ── YouTube IFrame API ────────────────────────────────────────────────────────

function loadYTApi(): Promise<void> {
  return new Promise(resolve => {
    if (window.YT?.Player) { resolve(); return }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve() }
    if (!document.getElementById('yt-api-script')) {
      const tag = document.createElement('script')
      tag.id  = 'yt-api-script'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  })
}

onMounted(async () => {
  await loadYTApi()

  player = new window.YT.Player('yt-player', {
    width:  '100%',
    height: '100%',
    playerVars: { rel: 0, modestbranding: 1 },
    events: {
      onReady() {
        playerReady.value = true
        player.loadPlaylist({ list: PLAYLIST_ID.value, listType: 'playlist', index: 0 })
        scheduleVideoFetch()
      },
      onStateChange(e: any) {
        // Keep sidebar highlight in sync with whatever YouTube is playing
        if (player) activeIndex.value = player.getPlaylistIndex() ?? null
        // State -1 (cued) fires when a new playlist finishes loading
        if (e.data === -1 && videos.value.length === 0) scheduleVideoFetch()
      },
    },
  })
})

onUnmounted(() => {
  if (fetchRetryTimer) clearTimeout(fetchRetryTimer)
  player?.destroy()
})

// ── Fetch sidebar from playlist ────────────────────────────────────────────────

// Retries until the player returns a non-empty playlist array (may take a moment
// for YouTube to load the remote playlist after loadPlaylist() is called).
function scheduleVideoFetch(attempt = 0) {
  if (fetchRetryTimer) clearTimeout(fetchRetryTimer)
  const delay = attempt === 0 ? 800 : 1200
  fetchRetryTimer = setTimeout(() => fetchVideos(attempt), delay)
}

async function fetchVideos(attempt = 0) {
  if (!player) return
  const ids: string[] = player.getPlaylist() ?? []
  if (ids.length === 0 && attempt < 5) {
    scheduleVideoFetch(attempt + 1)
    return
  }
  loadingVideos.value = true
  // Fetch titles via YouTube oEmbed (no API key needed, CORS-friendly)
  const results = await Promise.all(
    ids.map(async (id): Promise<VideoEntry> => {
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`
        )
        if (res.ok) {
          const data = await res.json()
          return { id, title: data.title ?? id }
        }
      } catch { /* fall through */ }
      return { id, title: id }
    })
  )
  videos.value        = results
  loadingVideos.value = false
}

// ── Playback ───────────────────────────────────────────────────────────────────

function playAt(index: number) {
  if (!player) return
  player.playVideoAt(index)
  activeIndex.value = index
}

function thumbUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
}
</script>

<style scoped>
.videos-page {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* ── Embed: 16:9, does not stretch tall ───────────────────────────────────── */
.embed-area {
  width: 100%;
  aspect-ratio: 16 / 9;
  flex-shrink: 0;
  background: #020408;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.yt-player-target {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.embed-placeholder {
  text-align: center;
  pointer-events: none;
}
.placeholder-icon {
  font-size: 4rem;
  opacity: 0.12;
  margin-bottom: 0.75rem;
}
.placeholder-text {
  font-family: 'Antonio', sans-serif;
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  color: #2a3a4a;
}

/* ── Playlist section ─────────────────────────────────────────────────────── */
.playlist-section {
  flex-shrink: 0;
  border-top: 1px solid rgba(51, 102, 255, 0.18);
  background: rgba(8, 14, 28, 0.97);
}

.playlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid rgba(51, 102, 255, 0.12);
  position: sticky;
  top: 0;
  background: rgba(8, 14, 28, 0.97);
  z-index: 1;
}

.playlist-header-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.playlist-title {
  font-family: 'Antonio', sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  color: #3366aa;
}

.playlist-count {
  font-family: 'Antonio', sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  color: #2a3a55;
}

.playlist-loading {
  font-family: 'Antonio', sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  color: #2a4466;
  animation: pulse 1.2s ease-in-out infinite alternate;
}
@keyframes pulse { from { opacity: 0.4 } to { opacity: 1 } }

.playlist-empty {
  color: #2a3a4a;
  font-family: 'Antonio', sans-serif;
  font-size: 0.78rem;
  font-style: italic;
  padding: 1.25rem 1rem;
  text-align: center;
}

/* Video list */
.playlist-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.playlist-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.45rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: background 0.15s;
}
.playlist-item:hover { background: rgba(51, 102, 255, 0.08); }
.playlist-item--active {
  background: rgba(51, 102, 255, 0.14);
  border-left: 3px solid #3366ff;
}

.playlist-thumb-wrap {
  position: relative;
  flex-shrink: 0;
}

.playlist-thumb {
  width: 5.5rem;
  height: 3.1rem;
  object-fit: cover;
  border-radius: 0.2rem;
  display: block;
  background: #111;
}

.now-playing-badge {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 0.2rem;
  color: #fff;
  font-size: 1.1rem;
}

.playlist-info {
  flex: 1;
  min-width: 0;
}

.playlist-name {
  display: block;
  font-family: 'Antonio', sans-serif;
  font-size: 0.8rem;
  letter-spacing: 0.03em;
  color: #7799bb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.playlist-item--active .playlist-name { color: #cce0ff; }

</style>
