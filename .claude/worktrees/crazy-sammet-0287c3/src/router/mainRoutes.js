// Route-level code splitting — all page components lazy-loaded so they only
// download when the user actually navigates to that route.

const Adventure         = () => import('../pages/Adventure.vue');
const Ambience          = () => import('../pages/Ambience.vue');
const Crew              = () => import('../pages/Crew.vue');
const Documents         = () => import('../pages/Documents.vue');
const Embed             = () => import('../pages/Embed.vue');
const GradingView       = () => import('../pages/GradingView.vue');
const AdminReports      = () => import('../pages/AdminReports.vue');
const HomeMain          = () => import('../pages/HomeMain.vue');
const Missions          = () => import('../pages/Missions.vue');
const Opening           = () => import('../pages/Opening.vue');
const Settings          = () => import('../pages/Settings.vue');
const StellarCartography = () => import('../pages/StellarCartography.vue');
const Systems           = () => import('../pages/Systems.vue');
const Typing            = () => import('../pages/Typing.vue');
const TypingSpeedTest   = () => import('../pages/typing/TypingSpeedTest.vue');
const TypingLesson      = () => import('../pages/typing/TypingLesson.vue');
const TypingCustomText  = () => import('../pages/typing/TypingCustomText.vue');
const TypingLessonAdmin = () => import('../pages/typing/TypingLessonAdmin.vue');

const AdminDashboard    = () => import('../pages/AdminDashboard.vue');
const BroadcastPage     = () => import('../pages/BroadcastPage.vue');
const VideosPage        = () => import('../pages/VideosPage.vue');
const AdminHub          = () => import('../pages/AdminHub.vue');
const AdminLayout       = () => import('../pages/AdminLayout.vue');
const AdminSeed         = () => import('../pages/AdminSeed.vue');
const AdminCadetDetail  = () => import('../pages/AdminCadetDetail.vue');
const AdminSeatingChart = () => import('../pages/AdminSeatingChart.vue');
const MissionLibrary    = () => import('../pages/MissionLibrary.vue');
const SeatingChart      = () => import('../pages/SeatingChart.vue');
const StudentDashboard  = () => import('../pages/StudentDashboard.vue');

const Games                  = () => import('../pages/Games.vue');
const BattleMutaraNebula     = () => import('@/pages/games/BattleMutaraNebula.vue');
const BattleMutaraNebulaGame = () => import('@/pages/games/BattleMutaraNebulaGame.vue');
const Chess                  = () => import('../pages/games/Chess.vue');
const ChessGame              = () => import('../pages/games/ChessGame.vue');
const IsolinearCascade       = () => import('@/pages/games/IsolinearCascade.vue');
const IsolinearCascadeGame   = () => import('@/pages/games/IsolinearCascadeGame.vue');
const Jeopardy               = () => import('../pages/games/Jeopardy.vue');
const JeopardyGame           = () => import('../pages/games/JeopardyGame.vue');
const Minesweeper            = () => import('../pages/games/Minesweeper.vue');
const MinesweeperGame        = () => import('../pages/games/MinesweeperGame.vue');
const ShuttleBay             = () => import('../pages/games/ShuttleBay.vue');
const ShuttleBayGame         = () => import('../pages/games/ShuttleBayGame.vue');
const PicardManeuver         = () => import('../pages/games/PicardManeuver.vue');
const PicardManeuverGame     = () => import('../pages/games/PicardManeuverGame.vue');
const RulesOfAcquisition     = () => import('../pages/games/RulesOfAcquisition.vue');
const RulesOfAcquisitionGame = () => import('../pages/games/RulesOfAcquisitionGame.vue');
const WarpCoreBreach         = () => import('@/pages/games/WarpCoreBreach.vue');
const WarpCoreBreachGame     = () => import('@/pages/games/WarpCoreBreachGame.vue');

const staffAdminGuard = (to, from, next) => {
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  if (['staff','admin'].includes(role)) { next(); } else { next('/'); }
};

const adminGuard = (to, from, next) => {
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  if (role === 'admin') { next(); } else { next('/'); }
};

const staffAdminAuditGuard = (to, from, next) => {
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  if (['staff', 'admin', 'audit'].includes(role)) { next(); } else { next('/'); }
};

export const mainRoutes = [
	{ path: '/', component: HomeMain },
	{
		path: '/admin',
		component: AdminLayout,
		beforeEnter: staffAdminAuditGuard,
		children: [
			{ path: '',          component: AdminHub },
			{ path: 'dashboard', component: AdminDashboard },
			{ path: 'missions',  component: MissionLibrary },
			{ path: 'reports',   component: AdminReports },
			{ path: 'grading',   component: GradingView,       beforeEnter: staffAdminGuard },
			{ path: 'users',   component: Settings,           beforeEnter: adminGuard },
			{ path: 'typing',   component: TypingLessonAdmin,    beforeEnter: staffAdminGuard },
		{ path: 'seating',       component: AdminSeatingChart,  beforeEnter: staffAdminGuard },
		{ path: 'cadet/:uid',    component: AdminCadetDetail,   beforeEnter: staffAdminGuard },
		{ path: 'seed',     component: AdminSeed },
		],
	},
	{ path: '/broadcast', component: BroadcastPage, beforeEnter: staffAdminGuard },
	{ path: '/videos',    component: VideosPage },
	{ path: '/seating', component: SeatingChart },
	{ path: '/adventure', component: Adventure },
	{ path: '/ambience', component: Ambience },
	{ path: '/crew', component: Crew },
	{ path: '/dashboard', component: StudentDashboard },
	{ path: '/embed', component: Embed },
	{ path: '/opening', component: Opening },
	{ path: '/documents', component: Documents },
	{ path: '/missions', component: Missions },
	{ path: '/settings', redirect: '/admin/users' },
	{ path: '/stellar-cartography', component: StellarCartography },
	{ path: '/systems', component: Systems },
	{ path: '/typing',                   component: Typing },
	{ path: '/typing/speed-test',        component: TypingSpeedTest },
	{ path: '/typing/lesson/:lessonId',  component: TypingLesson },
	{ path: '/typing/custom/:textId',    component: TypingCustomText },

	{ path: '/games/jeopardy', component: Jeopardy, beforeEnter: staffAdminGuard },
	{ path: '/games/jeopardy/play', component: JeopardyGame, beforeEnter: staffAdminGuard },
	{ path: '/games/minesweeper', component: Minesweeper },
	{ path: '/games/minesweeper/play', component: MinesweeperGame },
	{ path: '/games/chess', component: Chess },
	{ path: '/games/chess/play', component: ChessGame },
	{ path: '/games/shuttle-bay', component: ShuttleBay },
	{ path: '/games/shuttle-bay/play', component: ShuttleBayGame },
	{ path: '/games/picard-maneuver', component: PicardManeuver },
	{ path: '/games/picard-maneuver/play', component: PicardManeuverGame },
	{ path: '/games/rules-of-acquisition', component: RulesOfAcquisition },
	{ path: '/games/rules-of-acquisition/play', component: RulesOfAcquisitionGame },
	{ path: '/games/battle-of-the-mutara-nebula', component: BattleMutaraNebula },
	{ path: '/games/battle-of-the-mutara-nebula/play', component: BattleMutaraNebulaGame },
	{ path: '/games/isolinear-cascade', component: IsolinearCascade },
	{ path: '/games/isolinear-cascade/play', component: IsolinearCascadeGame },
	{ path: '/games/warp-core-breach', component: WarpCoreBreach},
	{ path: '/games/warp-core-breach/play', component: WarpCoreBreachGame },
	{ path: '/games', component: Games }
];

export default mainRoutes;
