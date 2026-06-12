
// src/config/driveConfig.ts
// Maps each unit to its Google Drive folder ID.
// Set the corresponding env vars in your .env file.

export interface DriveUnitConfig {
	unitKey: string;
	folderId: string;
}

export const driveUnitConfigs: DriveUnitConfig[] = [
	{ unitKey: 'unit00', folderId: import.meta.env.VITE_DRIVE_UNIT00_FOLDER_ID ?? '' },
	{ unitKey: 'unit01', folderId: import.meta.env.VITE_DRIVE_UNIT01_FOLDER_ID ?? '' },
	{ unitKey: 'unit02', folderId: import.meta.env.VITE_DRIVE_UNIT02_FOLDER_ID ?? '' },
	{ unitKey: 'unit03', folderId: import.meta.env.VITE_DRIVE_UNIT03B_FOLDER_ID ?? '' },
	{ unitKey: 'unit05', folderId: import.meta.env.VITE_DRIVE_UNIT05_FOLDER_ID ?? '' },
	{ unitKey: 'unit07', folderId: import.meta.env.VITE_DRIVE_UNIT07_FOLDER_ID ?? '' },
].filter(c => c.folderId !== '');

// Reuses the same Google API key already configured for Jeopardy (Sheets).
// Make sure the Drive API is enabled on the same Google Cloud project.
export const DRIVE_API_KEY: string = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY ?? '';
