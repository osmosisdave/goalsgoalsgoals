// Ambient declarations for globals injected by assets/js/config.js at runtime.
// These extend the built-in Window interface so all frontend TS files can use
// window.GGG_API_ORIGIN and window.GGG_USE_MOCK_API without (window as any) casts.
interface Window {
  GGG_API_ORIGIN?: string;
  GGG_USE_MOCK_API?: boolean;
  /** Set by src/matches.ts to allow the season-selector and tab handlers to trigger a re-render. */
  renderPage?: () => void;
  /** Cached league name list set by src/leagues.ts after load so inline scripts can read it. */
  _ggg_leagues?: string[];
  /** Rate limit widget class exposed for manual initialisation from inline scripts. */
  RateLimitWidget?: new (containerId: string) => unknown;
}
