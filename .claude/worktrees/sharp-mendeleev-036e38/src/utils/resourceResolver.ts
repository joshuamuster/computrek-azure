
// src/utils/resourceResolver.ts
import type { LessonResourceInput, ResolvedResource } from '@/types/resources';

// Thumbnails (reuse your existing imports)
import thumbnailActivityGuideImg from '@/assets/images/Thumbnail-ActivityGuide.png';
import thumbnailSlideshowImg from '@/assets/images/Thumbnail-Slideshow.png';
import thumbnailChecklistImg from '@/assets/images/Thumbnail-Checklist.png';
import thumbnailRubricImg from '@/assets/images/Thumbnail-Handout-Rubric.png';
import thumbnailSupportingImg from '@/assets/images/Thumbnail-Resource.png';
import thumbnailExemplarImg from '@/assets/images/Thumbnail-ActivityGuide-Exemplar.png';
import thumbnailHandoutImg from '@/assets/images/Thumbnail-Handout.png';
import thumbnailHandoutWordSearchImg from '@/assets/images/Thumbnail-Handout-WordSearch.png';
import thumbnailHandoutDefinitionsImg from '@/assets/images/Thumbnail-Handout-Definitions.png';
import thumbnailHandoutRubricImg from '@/assets/images/Thumbnail-Handout-Rubric.png';
import thumbnailHandoutRubricExemplarImg from '@/assets/images/Thumbnail-Handout-Rubric-Exemplar.png';
import thumbnailResourceExemplarImg from '@/assets/images/Thumbnail-Resource-Exemplar.png';
// thumbnailResourceImg and thumbnailExemplarActivityGuideImg are aliases of the above
const thumbnailResourceImg           = thumbnailSupportingImg;
const thumbnailExemplarActivityGuideImg = thumbnailExemplarImg;
import thumbnailExemplarChecklistImg from '@/assets/images/Thumbnail-Checklist-Exemplar.png';
import thumbnailExemplarHandoutImg from '@/assets/images/Thumbnail-Handout-Exemplar.png';
import thumbnailExemplarHandoutWordSearchImg from '@/assets/images/Thumbnail-Handout-WordSearch-Exemplar.png';
import thumbnailExemplarHandoutDefinitionsImg from '@/assets/images/Thumbnail-Handout-Definitions-Exemplar.png';
import thumbnailExemplarHandoutPeerReviewImg from '@/assets/images/Thumbnail-Handout-PeerReview-Exemplar.png';
import thumbnailTeacherGuideImg from '@/assets/images/Thumbnail-TeacherGuide.png';
import thumbnailActivityGuideNoImg from '@/assets/images/Thumbnail-ActivityGuide-No.png';
import thumbnailSlideshowNoImg from '@/assets/images/Thumbnail-Slideshow-No.png';

// ---------- Filename helpers ----------

function baseName(unitKey: string, lessonId: string): string {
	const unitNum = (unitKey || '').replace('unit','');      // '01'|'02'|'03'
	const lessonNum = (lessonId || '').replace('Lesson',''); // '03'
	const unitDisplay = String(Number(unitNum));             // '1'|'2'|'3'
	if (unitNum === '03') return `U3L${lessonNum}`;          // Unit 3b special
	return `U${unitDisplay}L${lessonNum}`;
}

/** Return url + format for a resource from Google Drive. */
function resolveLocalUrl(
	section: string,
	unitKey: string,
	lessonId: string,
	fileSegment: string,
	type: string,
	driveFiles?: Map<string, string>
): { url: string; format: 'pdf' | 'pptx' } | null {
	const base = baseName(unitKey, lessonId);
	const isSlides = type === 'slides';

	// Build the candidate filenames to try (preferred extension first).
	// For slides, we also check for a no-extension name which indicates a
	// native Google Slides file (converted from PPTX via File → Save as Google Slides).
	const candidates: Array<{ name: string; format: 'pdf' | 'pptx'; isGSlides?: boolean }> =
		unitKey === 'unit03'
			? [{ name: `${base}-${fileSegment}.pdf`, format: 'pdf' }]
			: isSlides
				? [
					{ name: `${base}-${fileSegment}`,      format: 'pptx', isGSlides: true }, // Google Slides (no ext)
					{ name: `${base}-${fileSegment}.pptx`, format: 'pptx' },
					{ name: `${base}-${fileSegment}.pdf`,  format: 'pdf'  },
				  ]
				: [
					{ name: `${base}-${fileSegment}.pdf`,  format: 'pdf'  },
					{ name: `${base}-${fileSegment}.pptx`, format: 'pptx' },
				  ];

	// ── 1. Google Drive lookup ───────────────────────────────────────────────
	if (driveFiles && driveFiles.size > 0) {
		for (const candidate of candidates) {
			const fileId = driveFiles.get(candidate.name);
			if (fileId) {
				// Native Google Slides files get the proper embed URL for presentation mode.
				// PPTX and PDF files use the Drive preview URL.
				const url = candidate.isGSlides
					? `https://docs.google.com/presentation/d/${fileId}/embed?start=false&loop=false&delayms=3000`
					: `https://drive.google.com/file/d/${fileId}/preview`;
				return { url, format: candidate.format };
			}
		}
	}

	return null;
}

// ---------- Labels & thumbnails ----------
function labelFor(type: string, variant?: string): string {
	const v = variant ? ` — ${titleCase(variant)}` : '';
	switch (type) {
		case 'activityGuide':         return `Activity Guide${v}`;
		case 'activityGuideExemplar': return `Activity Guide — Exemplar`;
		case 'slides':                return `Slides${v}`;
		case 'handout':               return `Handout${v}`;
		case 'handoutExemplar':       return `Handout — Exemplar`;
		case 'handoutDefinitions':    return `Handout — Definitions`;
		case 'handoutDefinitionsExemplar': return `Handout — Definitions Exemplar`;
		case 'handoutPeerReview':     return `Handout — Peer Review`;
		case 'handoutPeerReviewExemplar': return `Handout — Peer Review Exemplar`;
		case 'handoutRubric':         return `Handout — Rubric`;
		case 'handoutRubricExemplar': return `Handout — Rubric Exemplar`;
		case 'handoutWordSearch':     return `Handout — Word Search`;
		case 'handoutWordSearchExemplar': return `Handout — Word Search Exemplar`;
		case 'checklist':             return `Checklist${v}`;
		case 'checklistExemplar':     return `Checklist — Exemplar`;
		case 'rubric':                return `Rubric${v}`;
		case 'resource':              return `Resource${v}`;
		case 'resourceExemplar':      return `Resource — Exemplar`;
		case 'teacherGuide':          return `Teacher Guide${v}`;
		// Back-compat
		case 'peerReview':            return `Peer Review${v}`;
		case 'exemplar':              return `Exemplar${v}`;
		default:                      return titleCase(type.replace(/([A-Z])/g, ' $1').trim()) + (v ? v : '');
	}
}

function titleCase(s: string) {
	return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function thumbnailFor(type: string, variant: string | undefined, unitKey: string): string {
	const isU3 = unitKey === 'unit03';
	switch (type) {
		case 'activityGuide':         return thumbnailActivityGuideImg;
		case 'activityGuideExemplar': return thumbnailExemplarActivityGuideImg;
		case 'slides':                return thumbnailSlideshowImg;
		case 'checklist':             return variant === 'exemplar' ? thumbnailExemplarChecklistImg : thumbnailChecklistImg;
		case 'checklistExemplar':     return thumbnailExemplarChecklistImg;
		case 'rubric':                return isU3 ? thumbnailHandoutRubricImg : thumbnailRubricImg;
		case 'handout':               return isU3 ? thumbnailHandoutWordSearchImg : thumbnailHandoutImg;
		case 'handoutExemplar':       return thumbnailExemplarHandoutImg;
		case 'handoutDefinitions':    return thumbnailHandoutDefinitionsImg;
		case 'handoutDefinitionsExemplar': return thumbnailExemplarHandoutDefinitionsImg;
		case 'handoutPeerReview':     return isU3 ? thumbnailExemplarHandoutPeerReviewImg : thumbnailSupportingImg;
		case 'handoutPeerReviewExemplar': return thumbnailExemplarHandoutPeerReviewImg;
		case 'handoutRubric':         return thumbnailHandoutRubricImg;
		case 'handoutRubricExemplar': return thumbnailHandoutRubricExemplarImg;
		case 'handoutWordSearch':     return thumbnailHandoutWordSearchImg;
		case 'handoutWordSearchExemplar': return thumbnailExemplarHandoutWordSearchImg;
		case 'resource':              return thumbnailResourceImg;
		case 'resourceExemplar':      return thumbnailResourceExemplarImg;
		case 'teacherGuide':          return thumbnailTeacherGuideImg;

		// Back-compat
		case 'peerReview':    return isU3 ? thumbnailExemplarHandoutPeerReviewImg : thumbnailSupportingImg;
		case 'exemplar':
			if (variant === 'activityGuide') return thumbnailExemplarActivityGuideImg;
			if (variant === 'handout')       return isU3 ? thumbnailExemplarHandoutWordSearchImg : thumbnailExemplarHandoutImg;
			if (variant === 'definitions')   return thumbnailExemplarHandoutDefinitionsImg;
			if (variant === 'checklist')     return thumbnailExemplarChecklistImg;
			if (variant === 'peerReview')    return thumbnailExemplarHandoutPeerReviewImg;
			return thumbnailExemplarImg;
		default:              return thumbnailSupportingImg;
	}
}

/** Defaults: exemplar/teacher → staff; otherwise all */
function defaultVisibility(type: string, variant?: string): 'all' | 'staff' {
	if (type === 'teacherGuide') return 'staff';
	if (type.toLowerCase().includes('exemplar')) return 'staff';
	if (variant === 'exemplar')  return 'staff';
	return 'all';
}

/**
 * Resolve a list of resource inputs into display-ready resources.
 * - Adds fallback for slidesUrl/googleSlidesUrl if not declared.
 */
export function resolveResources(
	section: string,
	unitKey: string,
	lessonId: string,
	lesson: Record<string, any>,                       // raw lesson JSON object
	inputs: LessonResourceInput[] | undefined,
	driveFiles?: Map<string, string>                   // filename → Drive file ID (from useDriveFiles)
): ResolvedResource[] {
	const declared = [...(inputs ?? [])];
	
	// Back-compat: pull in slidesUrl/googleSlidesUrl if present but not declared
	const slideLink = lesson?.slidesUrl || lesson?.googleSlidesUrl || '';
	if (slideLink && !declared.some(r => r.type === 'slides')) {
		declared.push({ type: 'slides', source: 'external', url: slideLink });
	}
	
	const resolved = declared.map((r) => {
		const visibility = r.visibility ?? defaultVisibility(r.type, r.variant);
		
		// EXTERNAL
		if (r.source === 'external') {
			const label = r.label ?? labelFor(r.type, r.variant);
			const thumb = thumbnailFor(r.type, r.variant, unitKey);
			const url = r.url || '';
			if (!url) return null;

			// Determine format: slides go to PowerPointModal, .pdf to PdfModal, else link
			let format: 'pdf' | 'pptx' | 'link' = 'link';
			if (r.type === 'slides') {
				format = 'pptx';
			} else if (url.toLowerCase().endsWith('.pdf')) {
				format = 'pdf';
			} else if (url.toLowerCase().endsWith('.pptx')) {
				format = 'pptx';
			}

			return { type: r.type, variant: r.variant, url, label, thumb, format, visibility };
		}
		
		// LOCAL (or Drive — resolveLocalUrl checks Drive first, then local)
		const fileSeg = r.file || fileSegmentDefault(r.type, r.variant, unitKey);
		const resolvedLocal = resolveLocalUrl(section, unitKey, lessonId, fileSeg, r.type, driveFiles);
		
		if (!resolvedLocal) {
			// Back-compat: pull in slidesUrl if local not found but link is present
			if (r.type === 'slides' && slideLink) {
				const label = r.label ?? labelFor(r.type, r.variant);
				const thumb = thumbnailFor(r.type, r.variant, unitKey);
				return { type: r.type, variant: r.variant, url: slideLink, label, thumb, format: 'pptx', visibility };
			}
			return null;
		}
		
		const label = r.label ?? labelFor(r.type, r.variant);
		const thumb = thumbnailFor(r.type, r.variant, unitKey);
		return { type: r.type, variant: r.variant, url: resolvedLocal.url, label, thumb, format: resolvedLocal.format, visibility };
	}).filter(Boolean) as ResolvedResource[];

	// Add placeholders if missing
	if (!resolved.some(r => r.type === 'slides')) {
		resolved.unshift({
			type: 'slides',
			url: '',
			label: 'No Slideshow',
			thumb: thumbnailSlideshowNoImg,
			format: 'link',
			visibility: 'all'
		});
	}
	if (!resolved.some(r => r.type === 'activityGuide' || r.type === 'activityGuideExemplar')) {
		resolved.unshift({
			type: 'activityGuide',
			url: '',
			label: 'No Activity Guide',
			thumb: thumbnailActivityGuideNoImg,
			format: 'link',
			visibility: 'all'
		});
	}

	return resolved;
}

/** Sensible defaults so JSON can be terse. */
function fileSegmentDefault(type: string, variant?: string, unitKey?: string): string {
	const isU3 = unitKey === 'unit03';
	const isU5 = unitKey === 'unit05';
	switch (type) {
		case 'activityGuide':          return (isU3 || isU5) ? 'Handout-ActivityGuide' : 'ActivityGuide';
		case 'activityGuideExemplar':  return (isU3 || isU5) ? 'Exemplar-ActivityGuide' : 'Exemplar';
		case 'slides':                 return 'Slides';
		case 'checklist':              return 'Checklist';
		case 'checklistExemplar':      return 'Exemplar-Checklist';
		case 'rubric':                 return 'Rubric';
		case 'handout':                return isU3 ? 'Handout-WordSearch' : 'Handout';
		case 'handoutExemplar':        return isU3 ? 'Exemplar-WordSearch' : 'Exemplar-Handout';
		case 'handoutDefinitions':     return 'Handout-Definitions';
		case 'handoutDefinitionsExemplar': return 'Exemplar-Definitions';
		case 'handoutPeerReview':      return 'PeerReview';
		case 'handoutPeerReviewExemplar': return 'Exemplar-PeerReview';
		case 'handoutRubric':          return 'Handout-Rubric';
		case 'handoutRubricExemplar':  return 'Exemplar-Rubric';
		case 'handoutWordSearch':      return 'Handout-WordSearch';
		case 'handoutWordSearchExemplar': return 'Exemplar-WordSearch';
		case 'resource':               return 'Resource';
		case 'resourceExemplar':       return 'Exemplar';
		case 'teacherGuide':           return 'TeacherGuide';

		// Back-compat
		case 'peerReview':             return 'PeerReview';
		case 'exemplar':               return exemplarDefaultSegment(variant, isU3);
		default:                       return type; // fallback
	}
}

function exemplarDefaultSegment(variant?: string, isU3?: boolean): string {
	if (variant === 'activityGuide') return 'Exemplar-ActivityGuide';
	if (variant === 'checklist')     return 'Exemplar-Checklist';
	if (variant === 'handout')       return isU3 ? 'Exemplar-WordSearch' : 'Exemplar-Handout';
	if (variant === 'definitions')   return 'Exemplar-Definitions';
	return 'Exemplar';
}
