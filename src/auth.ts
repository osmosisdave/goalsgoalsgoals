import type {
  MeResponse,
  LoginResponse,
  CreateUserResponse,
  UserRecord,
  AssignPreviousMatchResponse,
  Fixture,
  FixturesDbResponse,
} from './api-types';

/**
 * Client-side auth module (connects to a simple server-side auth API).
 * This client stores the JWT in sessionStorage for the prototype.
 */

const TOKEN_KEY = 'ggg_token';

// API origin can be set on the page via `window.GGG_API_ORIGIN` (see assets/js/config.js).
// If empty, relative paths are used (useful for local dev where server and site are same origin).
const API_ORIGIN = window.GGG_API_ORIGIN ? window.GGG_API_ORIGIN.replace(/\/$/, '') : '';
function apiUrl(path: string) { return API_ORIGIN + path; }

export async function login(username: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return false;
    const body: LoginResponse = await res.json();
    sessionStorage.setItem(TOKEN_KEY, body.token);
    return true;
  } catch (e) {
    return false;
  }
}

export function logout() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export async function currentUser(): Promise<MeResponse | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(apiUrl('/api/me'), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return await res.json() as MeResponse;
  } catch (e) {
    return null;
  }
}

export async function requireAuth(redirect = 'login.html') {
  const u = await currentUser();
  if (!u) window.location.href = redirect;
}

export async function createUser(username: string, password: string, role = 'user'): Promise<CreateUserResponse> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(apiUrl('/api/users'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ username, password, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create user');
  }
  return await res.json();
}

export async function assignPreviousMatch(username: string, fixtureId: number): Promise<AssignPreviousMatchResponse> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(apiUrl('/api/admin/assign-previous-match'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ username, fixtureId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to assign previous match');
  }
  return await res.json();
}

function currentSeasonYear(): number {
  const now = new Date();
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

function fixtureOptionLabel(f: Fixture): string {
  const date = new Date(f.fixture.date).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  const home = f.teams?.home?.name || 'Home';
  const away = f.teams?.away?.name || 'Away';
  const league = f.league?.name || 'League';
  const round = f.league?.round ? ` — ${f.league.round}` : '';
  const score = (f.goals?.home != null && f.goals?.away != null)
    ? ` (${f.goals.home}-${f.goals.away})`
    : '';
  return `${home} vs ${away}${score} • ${league}${round} • ${date}`;
}

async function fetchFinishedFixtures(season: number): Promise<Fixture[]> {
  const res = await fetch(apiUrl(`/api/football/fixtures?season=${season}&status=FT`));
  if (!res.ok) throw new Error('Failed to load finished fixtures');
  const data: FixturesDbResponse = await res.json();
  return (data.response || []) as Fixture[];
}

// UI wiring for login.html and admin.html (calls server endpoints)
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm') as HTMLFormElement | null;
  if (loginForm) {
    loginForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const username = (document.getElementById('username') as HTMLInputElement).value.trim();
      const password = (document.getElementById('password') as HTMLInputElement).value;
      const ok = await login(username, password);
      const err = document.getElementById('loginError');
      if (ok) {
        window.location.href = 'index.html';
      } else {
        if (err) err.textContent = 'Invalid username or password';
      }
    });
  }

  if (window.location.pathname.endsWith('admin.html')) {
    requireAuth();
    currentUser().then((user) => {
      const welcome = document.getElementById('adminWelcome');
      if (welcome && user) welcome.textContent = `Signed in as ${user.username} (${user.role || 'user'})`;
    });

    // Fetch users from API
    const list = document.getElementById('userList');
    if (list) {
      const token = getToken();
      fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((users: UserRecord[]) => {
          users.forEach((u) => {
            const li = document.createElement('li');
            li.className = 'collection-item';
            li.textContent = `${u.username} — ${u.role || 'user'}`;
            list.appendChild(li);
          });
        })
        .catch(() => {
          const li = document.createElement('li');
          li.className = 'collection-item red-text';
          li.textContent = 'Failed to load users (are you authenticated?)';
          list.appendChild(li);
        });
    }
    // Create user form handling
    const createForm = document.getElementById('createUserForm') as HTMLFormElement | null;
    if (createForm) {
      createForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const u = (document.getElementById('newUsername') as HTMLInputElement).value.trim();
        const p = (document.getElementById('newPassword') as HTMLInputElement).value;
        const r = (document.getElementById('newRole') as HTMLInputElement).value || 'user';
        const msg = document.getElementById('createUserMsg');
        try {
            await createUser(u, p, r);
            if (msg) { msg.textContent = 'Created.'; msg.className = 'green-text'; }
            // refresh list
            if (!list) return;
            list.innerHTML = '';
            const token = getToken();
                    fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } })
              .then((r) => r.json())
              .then((users: UserRecord[]) => {
                users.forEach((u) => {
                  const li = document.createElement('li');
                  li.className = 'collection-item';
                  li.textContent = `${u.username} — ${u.role || 'user'}`;
                  list.appendChild(li);
                });
              });
        } catch (e: any) {
          if (msg) { msg.textContent = e.message || 'Error'; msg.className = 'red-text'; }
        }
      });
    }

    const assignForm = document.getElementById('assignPreviousMatchForm') as HTMLFormElement | null;
    if (assignForm) {
      const assignSeasonInput = document.getElementById('assignSeason') as HTMLInputElement | null;
      const assignTeamSearch = document.getElementById('assignTeamSearch') as HTMLInputElement | null;
      const assignFixtureSelect = document.getElementById('assignFixtureSelect') as HTMLInputElement | null;
      const assignFixtureResults = document.getElementById('assignFixtureResults') as HTMLDivElement | null;
      const assignFixtureList = document.getElementById('assignFixtureList') as HTMLDivElement | null;
      const assignFixtureInfo = document.getElementById('assignFixtureInfo') as HTMLDivElement | null;
      const msg = document.getElementById('assignPreviousMatchMsg');

      let allFixtures: any[] = [];

      const loadAssignableFixtures = async (): Promise<void> => {
        if (!assignSeasonInput) return;
        const season = parseInt(assignSeasonInput.value, 10);
        if (Number.isNaN(season)) {
          if (assignFixtureResults) assignFixtureResults.style.display = 'none';
          if (assignFixtureInfo) assignFixtureInfo.textContent = 'Enter a valid season first';
          return;
        }

        if (assignTeamSearch) assignTeamSearch.value = '';
        if (assignFixtureSelect) assignFixtureSelect.value = '';
        if (assignFixtureInfo) assignFixtureInfo.textContent = 'Loading finished fixtures…';

        try {
          allFixtures = await fetchFinishedFixtures(season);
          if (allFixtures.length === 0) {
            if (assignFixtureResults) assignFixtureResults.style.display = 'none';
            if (assignFixtureInfo) assignFixtureInfo.textContent = 'No finished fixtures found for this season.';
            if (msg) { msg.textContent = ''; msg.className = ''; }
          } else {
            if (assignFixtureInfo) assignFixtureInfo.textContent = `${allFixtures.length} finished fixtures loaded. Search by team name.`;
          }
        } catch (e: any) {
          allFixtures = [];
          if (assignFixtureResults) assignFixtureResults.style.display = 'none';
          if (assignFixtureInfo) assignFixtureInfo.textContent = e.message || 'Failed to load fixtures';
          if (msg) { msg.textContent = e.message || 'Failed to load fixtures'; msg.className = 'red-text'; }
        }
      };

      const filterAndShowFixtures = (): void => {
        if (!assignTeamSearch || !assignFixtureList || !assignFixtureResults || !assignFixtureInfo) return;
        
        const searchTerm = assignTeamSearch.value.toLowerCase().trim();
        
        if (!searchTerm) {
          assignFixtureResults.style.display = 'none';
          assignFixtureInfo.textContent = allFixtures.length > 0 
            ? `${allFixtures.length} finished fixtures loaded. Search by team name.`
            : 'No finished fixtures loaded.';
          return;
        }

        const filtered = allFixtures.filter(f => 
          f.teams.home.name.toLowerCase().includes(searchTerm) ||
          f.teams.away.name.toLowerCase().includes(searchTerm)
        );

        if (filtered.length === 0) {
          assignFixtureList.innerHTML = '<div style="padding: 12px; text-align: center; color: #999;">No matches found for "' + searchTerm + '"</div>';
          assignFixtureResults.style.display = 'block';
          return;
        }

        assignFixtureList.innerHTML = filtered.slice(0, 50).map(f => {
          const label = fixtureOptionLabel(f);
          return `<div style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; hover: background #f5f5f5;" data-fixture-id="${f.fixture.id}" data-fixture-label="${label}">
            ${label}
          </div>`;
        }).join('');

        assignFixtureResults.style.display = 'block';

        // Add click handlers to results
        const resultItems = assignFixtureList.querySelectorAll('[data-fixture-id]');
        resultItems.forEach(item => {
          item.addEventListener('click', () => {
            const fixtureId = item.getAttribute('data-fixture-id');
            const fixtureLabel = item.getAttribute('data-fixture-label');
            if (assignFixtureSelect && fixtureId) {
              assignFixtureSelect.value = fixtureId;
            }
            if (assignFixtureInfo && fixtureLabel) {
              assignFixtureInfo.textContent = 'Selected: ' + fixtureLabel;
            }
            assignFixtureResults.style.display = 'none';
            if (assignTeamSearch) assignTeamSearch.value = '';
          });
        });
      };

      if (assignSeasonInput) {
        assignSeasonInput.value = String(currentSeasonYear());
      }
      void loadAssignableFixtures();

      if (assignSeasonInput) {
        assignSeasonInput.addEventListener('change', () => {
          void loadAssignableFixtures();
        });
      }

      if (assignTeamSearch) {
        assignTeamSearch.addEventListener('input', filterAndShowFixtures);
        assignTeamSearch.addEventListener('focus', () => {
          if (assignTeamSearch.value.length > 0) {
            filterAndShowFixtures();
          }
        });
      }

      assignForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const username = (document.getElementById('assignUsername') as HTMLInputElement).value.trim();
        const fixtureId = parseInt((assignFixtureSelect as HTMLInputElement).value, 10);

        if (!username || Number.isNaN(fixtureId)) {
          if (msg) { msg.textContent = 'Please provide valid username and select a finished fixture.'; msg.className = 'red-text'; }
          return;
        }

        try {
          const result = await assignPreviousMatch(username, fixtureId);
          if (msg) { msg.textContent = result.message || 'Assigned.'; msg.className = 'green-text'; }
        } catch (e: any) {
          if (msg) { msg.textContent = e.message || 'Error assigning previous match'; msg.className = 'red-text'; }
        }
      });
    }
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      logout();
      window.location.href = 'index.html';
    });
  }
});
