import { createRouter, createWebHistory } from 'vue-router';
import deckRoutes from './deckRoutes';
import lessonRoutes from './lessonRoutes';
import mainRoutes from './mainRoutes';
import Grawlix from '../pages/Grawlix.vue';
// import staticImages from './staticImages';

const routes = [
  ...mainRoutes,
  deckRoutes,
  lessonRoutes,
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: Grawlix },
  // staticImages,
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router
