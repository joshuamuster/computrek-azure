import { reactive, onBeforeUnmount } from 'vue';

export interface UseAccordionOptions {
	/** Unique keys for the accordion panels */
	keys: string[];
	/** If true, opening one panel closes others (default: false) */
	singleOpen?: boolean;
	/** Duration of height transition in ms (default: 400) */
	durationMs?: number;
	/** CSS easing for transition (default: 'ease') */
	easing?: string;
	/** Panels that should start open */
	initiallyOpen?: string[];
}

export function useAccordion(options: UseAccordionOptions) {
	const {
		keys,
		singleOpen = false,
		durationMs = 400,
		easing = 'ease',
		initiallyOpen = [],
	} = options;
	
	// Reactive open state: use open[key] in templates
	const open = reactive<Record<string, boolean>>({});
	// Map keys -> actual DOM elements (accordion bodies)
	const bodies = new Map<string, HTMLElement | null>();
	// Track transitionend listeners to avoid duplicates
	const listeners = new Map<string, (e: TransitionEvent) => void>();
	
	// Initialize state
	keys.forEach((k) => {
		open[k] = initiallyOpen.includes(k);
		bodies.set(k, null);
	});
	
	/**
	 * Attach or replace the ref for a panel body.
	 * Use in template as: :ref="el => setBody('myKey', el as HTMLElement)"
	 */
	function setBody(key: string, el: HTMLElement | null) {
		bodies.set(key, el);
		if (!el) return;
		
		// Ensure base styles for animation
		el.style.overflow = 'hidden';
		
		if (open[key]) {
			// If starting open, let height be auto so content wraps responsively
			el.style.height = 'auto';
		} else {
			el.style.height = '0px';
		}
	}
	
	/**
	 * Internal: perform the height animation and clean up
	 */
	function animate(el: HTMLElement, opening: boolean, key: string) {
		// Remove any previous transitionend listener for this key
		const prev = listeners.get(key);
		if (prev) {
			el.removeEventListener('transitionend', prev);
			listeners.delete(key);
		}
		
		// 1) Normalize current height to a pixel value
		el.style.transition = 'none';
		const currentHeight = el.offsetHeight; // Forces reflow
		el.style.height = currentHeight + 'px';
		
		// 2) Enable transition
		void el.offsetHeight; // force reflow again before changing transition
		el.style.transition = `height ${durationMs}ms ${easing}`;
		
		// 3) Animate to target
		if (opening) {
			const target = el.scrollHeight;
			el.style.height = target + 'px';
			const onEnd = (ev: TransitionEvent) => {
				if (ev.propertyName !== 'height') return;
				el.removeEventListener('transitionend', onEnd);
				listeners.delete(key);
				// Release to 'auto' so content changes don't break layout
				el.style.transition = '';
				el.style.height = 'auto';
			};
			el.addEventListener('transitionend', onEnd);
			listeners.set(key, onEnd);
		} else {
			// If height is 'auto', capture the current scrollHeight as the 'from' px
			const from = el.scrollHeight;
			el.style.height = from + 'px';
			requestAnimationFrame(() => {
				el.style.height = '0px';
			});
			const onEnd = (ev: TransitionEvent) => {
				if (ev.propertyName !== 'height') return;
				el.removeEventListener('transitionend', onEnd);
				listeners.delete(key);
				el.style.transition = '';
				el.style.height = '0px';
			};
			el.addEventListener('transitionend', onEnd);
			listeners.set(key, onEnd);
		}
	}
	
	/**
	 * Open one panel (and optionally close others if singleOpen)
	 */
	function openOne(key: string) {
		if (!keys.includes(key)) return;
		const el = bodies.get(key);
		if (!el) {
			open[key] = true;
			return;
		}
		
		if (singleOpen) {
			keys.forEach((k) => {
				if (k !== key && open[k]) {
					const other = bodies.get(k);
					if (other) animate(other, false, k);
					open[k] = false;
				}
			});
		}
		
		animate(el, true, key);
		open[key] = true;
	}
	
	/**
	 * Close a panel
	 */
	function close(key: string) {
		const el = bodies.get(key);
		if (!el) {
			open[key] = false;
			return;
		}
		animate(el, false, key);
		open[key] = false;
	}
	
	/**
	 * Toggle a panel
	 */
	function toggle(key: string) {
		if (open[key]) {
			close(key);
		} else {
			openOne(key);
		}
	}
	
	/**
	 * (Optional) A11y helper for header buttons
	 * Use with v-bind: v-bind="getAriaAttrs('key','optional-panel-id')"
	 */
	function getAriaAttrs(key: string, panelId?: string) {
		const id = panelId ?? `${key}-panel`;
		return {
			role: 'button',
			'aria-controls': id,
			'aria-expanded': String(!!open[key]),
			tabindex: 0,
			onKeydown: (e: KeyboardEvent) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					toggle(key);
				} else if (e.key === 'ArrowDown') {
					e.preventDefault();
					openOne(key);
				} else if (e.key === 'ArrowUp') {
					e.preventDefault();
					close(key);
				}
			},
		} as const;
	}
	
	onBeforeUnmount(() => {
		listeners.forEach((fn, key) => {
			const el = bodies.get(key);
			if (el) el.removeEventListener('transitionend', fn);
		});
		listeners.clear();
	});
	
	return {
		/** Reactive state — use as `open[key]` in templates */
		open,
		/** Attach body DOM element */
		setBody,
		/** Toggle a panel by key */
		toggle,
		/** Explicit open/close */
		openOne,
		close,
		/** Accessibility helper for headers */
		getAriaAttrs,
		/** Echoed options (useful for debugging) */
		options: { singleOpen, durationMs, easing },
	};
}