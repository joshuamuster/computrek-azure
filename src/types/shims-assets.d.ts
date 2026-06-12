// Asset type shims for non-standard file imports.
// SVG, PNG, JPG, WAV, MP3, PDF, CSS etc. are already covered by vite/client
// (declared in tsconfig.json via "types": ["vite/client"]).
// Only declare formats Vite's client types don't include.

declare module '*.pptx' {
	const src: string;
	export default src;
}
