// Pure utility functions — no window, document, or fetch dependencies.
// Compiled to assets/js/utils.js but not loaded by any HTML page directly.
// Imported by tests/utils.test.ts for unit testing.
/**
 * Best-effort username extraction from a JWT without verifying the signature.
 * Used as a fallback when the /api/me endpoint is unavailable.
 */
export function parseJwtUsername(token) {
    try {
        const parts = token.split('.');
        if (parts.length < 2)
            return null;
        const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const obj = JSON.parse(decodeURIComponent(escape(json)));
        return obj.sub || obj.username || null;
    }
    catch (_a) {
        return null;
    }
}
/**
 * Format an ISO datetime string for display relative to today.
 * Returns "Today, HH:MM", "Tomorrow, HH:MM", or a short locale string.
 */
export function fmtDate(iso) {
    const d = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === today.toDateString()) {
        return `Today, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (d.toDateString() === tomorrow.toDateString()) {
        return `Tomorrow, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}
