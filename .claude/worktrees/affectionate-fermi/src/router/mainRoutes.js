import Adventure from '../pages/Adventure.vue';
import Ambience from '../pages/Ambience.vue';
import Crew from '../pages/Crew.vue';
import Documents from '../pages/Documents.vue';
import Embed from '../pages/Embed.vue';
import GradingView from '../pages/GradingView.vue';
import AdminReports from '../pages/AdminReports.vue';
import HomeMain from '../pages/HomeMain.vue';
import Missions from '../pages/Missions.vue';
import Opening from '../pages/Opening.vue';
import Settings from '../pages/Settings.vue';
import StellarCartography from '../pages/StellarCartography.vue';
import Systems from '../pages/Systems.vue';
import Typing from '../pages/Typing.vue';
import TypingSpeedTest    from '../pages/typing/TypingSpeedTest.vue';
import TypingLesson       from '../pages/typing/TypingLesson.vue';
import TypingCustomText   from '../pages/typing/TypingCustomText.vue';
import TypingLessonAdmin  from '../pages/typing/TypingLessonAdmin.vue';

import AdminDashboard from '../pages/AdminDashboard.vue';
import AdminHub from '../pages/AdminHub.vue';
import AdminLayout from '../pages/AdminLayout.vue';
import AdminSeed from '../pages/AdminSeed.vue';
import MissionLibrary from '../pages/MissionLibrary.vue';
import StudentDashboard from '../pages/StudentDashboard.vue';

import Games from '../pages/Games.vue';
import BattleMutaraNebula from "@/pages/games/BattleMutaraNebula.vue";
import BattleMutaraNebulaGame from "@/pages/games/BattleMutaraNebulaGame.vue";
import Chess from '../pages/games/Chess.vue';
import ChessGame from '../pages/games/ChessGame.vue';
import IsolinearCascade from "@/pages/games/IsolinearCascade.vue";
import IsolinearCascadeGame from "@/pages/games/IsolinearCascadeGame.vue";
import Jeopardy from '../pages/games/Jeopardy.vue';
import JeopardyGame from '../pages/games/JeopardyGame.vue';
import Minesweeper from '../pages/games/Minesweeper.vue';
import MinesweeperGame from '../pages/games/MinesweeperGame.vue';
import ShuttleBay from '../pages/games/ShuttleBay.vue';
import ShuttleBayGame from '../pages/games/ShuttleBayGame.vue';
import PicardManeuver from '../pages/games/PicardManeuver.vue';
import PicardManeuverGame from '../pages/games/PicardManeuverGame.vue';
import RulesOfAcquisition from '../pages/games/RulesOfAcquisition.vue';
import RulesOfAcquisitionGame from '../pages/games/RulesOfAcquisitionGame.vue';
import WarpCoreBreach from "@/pages/games/WarpCoreBreach.vue";
import WarpCoreBreachGame from "@/pages/games/WarpCoreBreachGame.vue";

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
			{ path: 'typing',  component: TypingLessonAdmin,  beforeEnter: staffAdminGuard },
		{ path: 'seed',      component: AdminSeed },
		],
	},
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
