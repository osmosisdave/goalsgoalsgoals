// Ambient declarations for globals injected by assets/js/config.js at runtime.
// These extend the built-in Window interface so all frontend TS files can use
// window.GGG_API_ORIGIN and window.GGG_USE_MOCK_API without (window as any) casts.
interface Window {
  GGG_API_ORIGIN?: string;
  GGG_USE_MOCK_API?: boolean;
  /** Set by src/matches.ts to allow the season-selector and tab handlers to trigger a re-render. */
  renderPage?: () => void;
}
