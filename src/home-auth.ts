// Home page auth helper — compiled to assets/js/home-auth.js by `npm run build`.
// Runs on index.html: redirects unauthenticated users to login, then replaces
// the Login nav link with the username and shows admin-only tiles.

import type { MeResponse } from './api-types';

const USE_MOCK = !!window.GGG_USE_MOCK_API;

function apiUrl(path: string): string {
  const origin = (window.GGG_API_ORIGIN || '').replace(/\/$/, '');
  return origin + path;
}

function getToken(): string | null {
  return sessionStorage.getItem('ggg_token');
}

/** Best-effort username extraction from a JWT without verifying the signature. */
function parseJwtUsername(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const obj = JSON.parse(decodeURIComponent(escape(json)));
    return obj.sub || obj.username || null;
  } catch {
    return null;
  }
}

async function fetchMe(token: string): Promise<MeResponse | null> {
  // Mock mode: decode a locally-minted mock token without hitting the network.
  if (USE_MOCK && token.startsWith('mock.')) {
    try {
      const payload = JSON.parse(atob(token.slice(5)));
      return { username: payload.sub, role: payload.role };
    } catch {
      return { username: 'admin', role: 'admin' };
    }
  }
  try {
    const res = await fetch(apiUrl('/api/me'), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return await res.json() as MeResponse;
  } catch {
    return null;
  }
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, s =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s] ?? s
  );
}

function setNavToUsername(username: string): void {
  const desktop = document.getElementById('nav-login-link');
  const mobile = document.getElementById('nav-login-link-mobile');
  const safe = escapeHtml(username);
  if (desktop) desktop.innerHTML = `<a href="#" id="nav-username">${safe}</a>`;
  if (mobile) mobile.innerHTML = `<a href="#" id="nav-username-mobile">${safe}</a>`;

  function logoutHandler(e: Event): void {
    e.preventDefault();
    if (!confirm(`Log out ${username}?`)) return;
    sessionStorage.removeItem('ggg_token');
    location.reload();
  }
  document.getElementById('nav-username')?.addEventListener('click', logoutHandler);
  document.getElementById('nav-username-mobile')?.addEventListener('click', logoutHandler);
}

(async function init() {
  const token = getToken();
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const me = await fetchMe(token);
  // Fall back to JWT decode if the /api/me call fails (e.g. expired token)
  const username = me?.username ?? parseJwtUsername(token);
  const role = me?.role ?? null;

  if (!username) {
    window.location.href = 'login.html';
    return;
  }

  setNavToUsername(username);

  if (role === 'admin') {
    ['admin-tile', 'league-mgmt-tile', 'rate-limiter-tile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
  }
})();
