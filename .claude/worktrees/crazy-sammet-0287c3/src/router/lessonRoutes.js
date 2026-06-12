// src/router/lessonRoutes.js

// Route-level code-splitting (lazy-load pages)
const Lessons = () => import('../pages/Lessons.vue')
const CoursesMain = () => import('../pages/CoursesMain.vue')
const CoursesUnitMain = () => import('../components/courses/CoursesUnitMain.vue')
const CoursesLessonMain = () => import('../components/courses/CoursesLessonMain.vue')

// Optional: import data to validate unit existence (lightweight check)
// If you'd rather not import data here, remove the unitKey check below.
import lessonsData from '@/assets/data/CourseData.json'

// Allowed sections
const SECTION_NAMES = ['CompSci', 'MultiMedia']

/** Guard to validate :section and (optionally) :unitKey */
function validateSectionAndUnit(to) {
	const { section, unitKey } = to.params
	
	// validate section
	if (!SECTION_NAMES.includes(String(section))) {
		return { path: '/not-found' }
	}
	
	// (Optional) validate unit exists in data
	if (unitKey) {
		const exists =
			lessonsData?.[section] &&
			Object.prototype.hasOwnProperty.call(lessonsData[section], unitKey)
		if (!exists) {
			return { path: '/not-found' }
		}
	}
	return true
}

	export const lessonRoutes = {
	path: '/courses',
	component: Lessons,
	children: [
		// Default to CompSci when hitting /courses
		{ path: '', redirect: { path: '/courses/CompSci' } },

		// Section landing page: /courses/CompSci or /courses/MultiMedia
		{
			path: ':section',
			name: 'CoursesSection',
			component: CoursesMain,
			props: true,
			beforeEnter: (to) => validateSectionAndUnit(to),
		},
		
		// Sectioned Unit page: /courses/CompSci/unit01  or  /courses/MultiMedia/unitMM01
		{
			path: ':section/:unitKey',
			name: 'CourseUnit',
			component: CoursesUnitMain,
			props: true,
			beforeEnter: (to) => validateSectionAndUnit(to),
		},
		
		// Sectioned Lesson page: /courses/CompSci/unit01/Lesson03 (or any lesson id you use)
		{
			path: ':section/:unitKey/:lessonId',
			name: 'CourseLesson',
			component: CoursesLessonMain,
			props: true,
			beforeEnter: (to) => validateSectionAndUnit(to),
		},
	],
}

export default lessonRoutes
