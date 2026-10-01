/** Public end-user guide (Chinese-only static page; no login).
 *  English hosts should pass `userGuideUrl` until a locale-aware page exists.
 *  GitCode blob pages rate-limit guests, so Help does not open them.
 *  When `profiling-report.md` is on plugin_release `main` and readable
 *  without a session, point this at that blob URL. */
export const DEFAULT_USER_GUIDE_URL = 'https://profiling-report.vercel.app/guide/' as const;
