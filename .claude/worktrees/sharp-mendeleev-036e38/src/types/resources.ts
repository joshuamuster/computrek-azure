
// src/types/resources.ts
export type ResourceType =
	| 'activityGuide'
	| 'activityGuideExemplar'
	| 'checklist'
	| 'checklistExemplar'
	| 'handout'
	| 'handoutExemplar'
	| 'handoutDefinitions'
	| 'handoutDefinitionsExemplar'
	| 'handoutPeerReview'
	| 'handoutPeerReviewExemplar'
	| 'handoutRubric'
	| 'handoutRubricExemplar'
	| 'handoutWordSearch'
	| 'handoutWordSearchExemplar'
	| 'resource'
	| 'resourceExemplar'
	| 'rubric'
	| 'slides'
	| 'teacherGuide';

export type ResourceVisibility = 'all' | 'staff';

export interface LessonResourceInput {
	/** What kind of thing is this? */
	type: ResourceType;
	
	/** Optional subtype to control label/thumb (e.g., 'student', 'exemplar', 'definitions', 'wordsearch') */
	variant?: string;
	
	/** Where does it live? Defaults to 'local' */
	source?: 'local' | 'external';
	
	/**
	 * For local files: logical file segment (e.g., 'ActivityGuide', 'Slides', 'Handout-Definitions', 'Exemplar-Checklist').
	 * For external: ignore and use `url`.
	 */
	file?: string;
	
	/** For external links (e.g., Google Slides). */
	url?: string;
	
	/** Optional explicit label; otherwise we'll auto-generate one. */
	label?: string;
	
	/** Who can see this (default 'all') */
	visibility?: ResourceVisibility;
}

export interface ResolvedResource {
	type: ResourceType;
	variant?: string;
	url: string;
	label: string;
	thumb: string;
	format: 'pdf' | 'pptx' | 'link';  // drives which modal/action to use
	visibility: ResourceVisibility;
}
