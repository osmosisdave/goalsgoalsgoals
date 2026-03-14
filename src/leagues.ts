// League management admin UI — compiled to assets/js/leagues.js by `npm run build` (root tsconfig).
// NOTE: this file is not currently loaded by any HTML page. Add
//   <script src="assets/js/leagues.js"></script>
// to league-management.html (or whichever page needs it) to activate it.

import type { UserRecord, MeResponse, CreateLeagueResponse, DeleteLeagueResponse, UpdateLeagueResponse } from './api-types';

// ----- Helpers -----

function apiUrl(path: string): string {
  const origin = (window.GGG_API_ORIGIN || '').replace(/\/$/, '');
  return origin + path;
}

function getToken(): string | null {
  return sessionStorage.getItem('ggg_token');
}

// ----- API calls -----

async function fetchUsers(): Promise<UserRecord[]> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(apiUrl('/api/admin/users'), { headers });
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
  return res.json();
}

async function fetchLeagues(): Promise<string[]> {
  const res = await fetch(apiUrl('/api/leagues'));
  if (!res.ok) throw new Error(`Failed to fetch leagues: ${res.status}`);
  return res.json();
}

async function createLeague(name: string): Promise<CreateLeagueResponse> {
  const token = getToken();
  if (!token) throw new Error('Admin token not found. Log in first.');
  const res = await fetch(apiUrl('/api/leagues'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create league: ${res.status} ${text}`);
  }
  return res.json();
}

async function deleteLeague(name: string): Promise<DeleteLeagueResponse> {
  const token = getToken();
  if (!token) throw new Error('Admin token not found. Log in first.');
  const res = await fetch(apiUrl('/api/leagues/' + encodeURIComponent(name)), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete league: ${res.status} ${text}`);
  }
  return res.json();
}

async function saveLeague(username: string, league: string | null): Promise<UpdateLeagueResponse> {
  const token = getToken();
  if (!token) throw new Error('Admin token not found. Log in first.');
  const res = await fetch(apiUrl('/api/users/' + encodeURIComponent(username) + '/league'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ league }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to save league: ${res.status} ${text}`);
  }
  return res.json();
}

async function fetchMe(): Promise<MeResponse | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(apiUrl('/api/me'), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ----- Render -----

let _isAdmin = false;

function render(leagues: string[], users: UserRecord[]): void {
  const root = document.getElementById('leagues-root');
  if (!root) return;
  root.innerHTML = '';

  leagues.forEach(league => {
    const section = document.createElement('section');

    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';

    const title = document.createElement('h2');
    title.textContent = league;
    title.style.margin = '0';
    titleWrap.appendChild(title);

    if (_isAdmin && league !== 'Unassigned') {
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.onclick = async () => {
        if (!confirm(`Delete league "${league}"? This will unassign users.`)) return;
        del.disabled = true;
        try {
          await deleteLeague(league);
          const [users2, leagues2] = await Promise.all([fetchUsers(), fetchLeagues()]);
          window._ggg_leagues = leagues2;
          render(leagues2, users2);
        } catch (err) {
          alert('Error: ' + (err as Error).message);
        } finally {
          del.disabled = false;
        }
      };
      titleWrap.appendChild(del);
    }
    section.appendChild(titleWrap);

    const table = document.createElement('table');
    table.className = 'league-table';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr class="league-header"><th>Name</th><th>League</th><th>Actions</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    users
      .filter(u => (u.league || 'Unassigned') === league)
      .forEach(u => {
        const tr = document.createElement('tr');

        const nameTd = document.createElement('td');
        nameTd.textContent = u.username;
        tr.appendChild(nameTd);

        const leagueTd = document.createElement('td');
        const select = document.createElement('select');
        const opts = ['Unassigned', ...leagues.filter(l => l !== 'Unassigned')];
        opts.forEach(o => {
          const el = document.createElement('option');
          el.value = o === 'Unassigned' ? '' : o;
          el.textContent = o;
          if ((u.league || '') === el.value) el.selected = true;
          select.appendChild(el);
        });
        leagueTd.appendChild(select);
        tr.appendChild(leagueTd);

        const actionsTd = document.createElement('td');
        const saveBtn = document.createElement('button');
        if (!_isAdmin) {
          saveBtn.textContent = 'Admin only';
          saveBtn.disabled = true;
        } else {
          saveBtn.textContent = 'Save';
          saveBtn.onclick = async () => {
            saveBtn.disabled = true;
            try {
              await saveLeague(u.username, select.value || null);
              alert('Saved');
            } catch (err) {
              alert('Error: ' + (err as Error).message);
            } finally {
              saveBtn.disabled = false;
            }
          };
        }
        actionsTd.appendChild(saveBtn);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });

    table.appendChild(tbody);
    section.appendChild(table);
    root.appendChild(section);
  });
}

// ----- Add-league button -----

document.getElementById('add-league')?.addEventListener('click', () => {
  (async () => {
    if (!_isAdmin) { alert('You must be an admin to create leagues.'); return; }
    const input = document.getElementById('new-league') as HTMLInputElement | null;
    const v = input?.value.trim() ?? '';
    if (!v) { alert('Enter a league name'); return; }
    try {
      await createLeague(v);
      const [users, leagues] = await Promise.all([fetchUsers(), fetchLeagues()]);
      window._ggg_leagues = leagues;
      render(leagues, users);
      if (input) input.value = '';
    } catch (err) {
      alert('Error: ' + (err as Error).message);
    }
  })();
});

// ----- Init -----

(async function init() {
  try {
    const me = await fetchMe();
    if (me?.role === 'admin') _isAdmin = true;

    const warn = document.getElementById('admin-warning');
    if (warn) warn.style.display = _isAdmin ? 'none' : '';

    const users = await fetchUsers();

    let leagues: string[];
    try {
      leagues = await fetchLeagues();
    } catch {
      // Fall back to inferring league names from the user list
      leagues = Array.from(new Set(users.map(u => u.league || 'Unassigned')));
    }

    window._ggg_leagues = leagues;
    render(leagues, users);
  } catch (err) {
    const root = document.getElementById('leagues-root');
    if (root) {
      root.innerHTML = `<p style="color:red">Failed to load users. Ensure you are logged in as admin. Error: ${(err as Error).message}</p>`;
    }
  }
})();
