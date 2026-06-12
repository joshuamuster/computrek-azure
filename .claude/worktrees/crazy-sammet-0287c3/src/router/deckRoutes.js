// Route-level code splitting — deck pages lazy-loaded on demand.

const Decks  = () => import('../pages/Decks.vue');
const Deck01 = () => import('../pages/decks/Deck01.vue');
const Deck02 = () => import('../pages/decks/Deck02.vue');
const Deck03 = () => import('../pages/decks/Deck03.vue');
const Deck04 = () => import('../pages/decks/Deck04.vue');
const Deck05 = () => import('../pages/decks/Deck05.vue');
const Deck06 = () => import('../pages/decks/Deck06.vue');
const Deck07 = () => import('../pages/decks/Deck07.vue');
const Deck08 = () => import('../pages/decks/Deck08.vue');

export const deckRoutes = {
	path: '/decks',
	component: Decks,
	children: [
		{ path: 'deck01', component: Deck01 },
		{ path: 'deck02', component: Deck02 },
		{ path: 'deck03', component: Deck03 },
		{ path: 'deck04', component: Deck04 },
		{ path: 'deck05', component: Deck05 },
		{ path: 'deck06', component: Deck06 },
		{ path: 'deck07', component: Deck07 },
		{ path: 'deck08', component: Deck08 },
	]
};

export default deckRoutes;
