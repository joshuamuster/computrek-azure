import Decks from '../pages/Decks.vue';
import Deck01 from '../pages/decks/Deck01.vue';
import Deck02 from '../pages/decks/Deck02.vue';
import Deck03 from "../pages/decks/Deck03.vue";
import Deck04 from "../pages/decks/Deck04.vue";
import Deck05 from "../pages/decks/Deck05.vue";
import Deck06 from "../pages/decks/Deck06.vue";
import Deck07 from "../pages/decks/Deck07.vue";
import Deck08 from "../pages/decks/Deck08.vue";

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
