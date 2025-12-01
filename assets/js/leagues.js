// Simple league table UI
(function () {
  function apiUrl(path) {
    const origin = (window && window.GGG_API_ORIGIN) || '';
    if (origin) return origin.replace(/\/$/, '') + path;
    return path;
  }

  function getAuthToken() {
    // try common places where token might be stored
    return sessionStorage.getItem('ggg_token') || sessionStorage.getItem('token') || localStorage.getItem('ggg_token') || localStorage.getItem('token') || null;
  }

  async function fetchUsers() {
    // Admin readonly endpoint
    const token = getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(apiUrl('/api/admin/users'), { headers });
    if (!res.ok) throw new Error('Failed to fetch users: ' + res.status);
    return res.json();
  }

  async function fetchLeagues() {
    const res = await fetch(apiUrl('/api/leagues'));
    if (!res.ok) throw new Error('Failed to fetch leagues: ' + res.status);
    return res.json();
  }

  async function createLeague(name) {
    const token = getAuthToken();
    if (!token) throw new Error('Admin token not found. Log in first.');
    const res = await fetch(apiUrl('/api/leagues'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ name })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error('Failed to create league: ' + res.status + ' ' + text);
    }
    return res.json();
  }

  async function deleteLeague(name) {
    const token = getAuthToken();
    if (!token) throw new Error('Admin token not found. Log in first.');
    const res = await fetch(apiUrl('/api/leagues/' + encodeURIComponent(name)), {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error('Failed to delete league: ' + res.status + ' ' + text);
    }
    return res.json();
  }

  async function saveLeague(username, league) {
    const token = getAuthToken();
    if (!token) throw new Error('Admin token not found. Log in first.');
    const res = await fetch(apiUrl('/api/users/' + encodeURIComponent(username) + '/league'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ league })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error('Failed to save league: ' + res.status + ' ' + text);
    }
    return res.json();
  }

  async function fetchMe() {
    const token = getAuthToken();
    if (!token) return null;
    try {
      const res = await fetch(apiUrl('/api/me'), { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      // ignore
      return null;
    }
  }

  let _isAdmin = false;

  function render(leagues, users) {
    const root = document.getElementById('leagues-root');
    root.innerHTML = '';
    // For each league, show a header and a table
    const isAdmin = _isAdmin;
    leagues.forEach((league) => {
      const container = document.createElement('section');
      const titleWrap = document.createElement('div');
      titleWrap.style.display = 'flex';
      titleWrap.style.alignItems = 'center';
      titleWrap.style.justifyContent = 'space-between';
      const title = document.createElement('h2');
      title.textContent = league;
      title.style.margin = '0';
      titleWrap.appendChild(title);

      if (isAdmin && league !== 'Unassigned') {
        const del = document.createElement('button');
        del.textContent = 'Delete';
        del.onclick = async () => {
          if (!confirm('Delete league "' + league + '"? This will unassign users.')) return;
          del.disabled = true;
          try {
            await deleteLeague(league);
            // refresh
            const users2 = await fetchUsers();
            const leagues2 = await fetchLeagues();
            window._ggg_leagues = leagues2;
            render(leagues2, users2);
          } catch (err) {
            alert('Error: ' + err.message);
          } finally { del.disabled = false; }
        };
        titleWrap.appendChild(del);
      }
      container.appendChild(titleWrap);

      const table = document.createElement('table');
      table.className = 'league-table';
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr class="league-header"><th>Name</th><th>League</th><th>Actions</th></tr>';
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      users.filter(u => (u.league || 'Unassigned') === league).forEach(u => {
        const tr = document.createElement('tr');
        const nameTd = document.createElement('td');
        nameTd.textContent = u.username;
        tr.appendChild(nameTd);

        const leagueTd = document.createElement('td');
        const select = document.createElement('select');
        const opts = ['Unassigned'].concat(leagues.filter(l => l !== 'Unassigned'));
        opts.forEach(o => {
          const el = document.createElement('option');
          el.value = o === 'Unassigned' ? '' : o;
          el.textContent = o;
          if ((u.league || '') === (o === 'Unassigned' ? '' : o)) el.selected = true;
          select.appendChild(el);
        });
        leagueTd.appendChild(select);
        tr.appendChild(leagueTd);

        const actionsTd = document.createElement('td');
        const saveBtn = document.createElement('button');
        if (!isAdmin) {
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
              alert('Error: ' + err.message);
            } finally { saveBtn.disabled = false; }
          };
        }
        actionsTd.appendChild(saveBtn);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      container.appendChild(table);
      root.appendChild(container);
    });
  }

  document.getElementById('add-league').addEventListener('click', () => {
    (async function () {
      if (!_isAdmin) return alert('You must be an admin to create leagues.');
      const v = document.getElementById('new-league').value.trim();
      if (!v) return alert('Enter a league name');
      try {
        await createLeague(v);
        const users = await fetchUsers();
        const leagues = await fetchLeagues();
        window._ggg_leagues = leagues;
        render(leagues, users);
        document.getElementById('new-league').value = '';
      } catch (err) {
        alert('Error: ' + err.message);
      }
    })();
  });

  // initial load: try to infer leagues from users
  (async function init() {
    try {
      // determine admin status first
      const me = await fetchMe();
      if (me && me.role === 'admin') _isAdmin = true;
      // hide or show the admin warning
      try {
        const warn = document.getElementById('admin-warning');
        if (warn) warn.style.display = _isAdmin ? 'none' : '';
      } catch (e) {}

      const users = await fetchUsers();
      let leagues = [];
      try {
        leagues = await fetchLeagues();
      } catch (e) {
        // fallback to inferring from users
        leagues = Array.from(new Set(users.map(u => u.league || 'Unassigned')));
      }
      window._ggg_leagues = leagues;
      render(leagues, users);
    } catch (err) {
      document.getElementById('leagues-root').innerHTML = '<p style="color:red">Failed to load users. Ensure you are logged in as admin. Error: ' + err.message + '</p>';
    }
  })();

})();
