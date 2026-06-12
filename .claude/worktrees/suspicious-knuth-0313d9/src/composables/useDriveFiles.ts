
// src/composables/useDriveFiles.ts
//
// Fetches file listings from all configured Google Drive unit folders via a
// Google Apps Script web app (which runs with your credentials and bypasses
// the Drive API public-access restriction on personal accounts).
//
// Usage:
//   const { driveFileMap, isLoaded, loadDriveFiles } = useDriveFiles();
//   onMounted(() => loadDriveFiles());
//
// The map is shared across all component instances, so files are only
// fetched once per page load regardless of how many components use this.

import { ref } from 'vue';
import { driveUnitConfigs } from '@/config/driveConfig';

const SCRIPT_URL: string = import.meta.env.VITE_DRIVE_SCRIPT_URL ?? '';

// ── Singleton state ──────────────────────────────────────────────────────────
const driveFileMap = ref(new Map<string, string>()); // filename → fileId
const isLoading    = ref(false);
const isLoaded     = ref(false);
const loadError    = ref<string | null>(null);

// ── Apps Script fetch ────────────────────────────────────────────────────────
async function fetchAllFiles(): Promise<{ id: string; name: string }[]> {
	const folderIds = driveUnitConfigs.map(c => c.folderId).join(',');
	const url = `${SCRIPT_URL}?folderIds=${encodeURIComponent(folderIds)}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Apps Script error ${res.status}: ${res.statusText}`);
	const json = await res.json();
	return json.files ?? [];
}

// ── Composable ───────────────────────────────────────────────────────────────
export function useDriveFiles() {
	async function loadDriveFiles() {
		// Only fetch once; skip if already loaded or in progress.
		if (isLoaded.value || isLoading.value) return;

		if (!SCRIPT_URL) {
			loadError.value = 'Missing VITE_DRIVE_SCRIPT_URL — Drive file lookup disabled.';
			console.warn('[useDriveFiles]', loadError.value);
			return;
		}
		if (driveUnitConfigs.length === 0) {
			loadError.value = 'No Drive folder IDs configured. Add VITE_DRIVE_UNIT##_FOLDER_ID vars to .env.';
			console.warn('[useDriveFiles]', loadError.value);
			return;
		}

		isLoading.value = true;
		try {
			const files = await fetchAllFiles();
			const map = new Map<string, string>();
			for (const file of files) {
				map.set(file.name, file.id);
			}
			driveFileMap.value = map;
			isLoaded.value     = true;
			console.info(`[useDriveFiles] Loaded ${map.size} files from Google Drive.`);
		} catch (err) {
			loadError.value = String(err);
			console.error('[useDriveFiles]', err);
		} finally {
			isLoading.value = false;
		}
	}

	return { driveFileMap, isLoading, isLoaded, loadError, loadDriveFiles };
}

// ── URL helpers (exported for use outside the composable) ────────────────────

/** Returns an embeddable Google Drive preview URL for any file type. */
export function drivePreviewUrl(fileId: string): string {
	return `https://drive.google.com/file/d/${fileId}/preview`;
}

/** Returns a direct-download URL for a Drive file. */
export function driveDownloadUrl(fileId: string): string {
	return `https://drive.google.com/uc?export=download&id=${fileId}`;
}
