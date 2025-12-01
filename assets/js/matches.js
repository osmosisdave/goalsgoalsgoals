// Matches scaffold
(function () {
  function apiUrl(path) {
    const origin = (window && window.GGG_API_ORIGIN) || '';
    if (origin) return origin.replace(/\/$/, '') + path;
    return path;
  }

  function getAuthToken() {
    return sessionStorage.getItem('ggg_token') || sessionStorage.getItem('token') || localStorage.getItem('ggg_token') || localStorage.getItem('token') || null;
  }

  async function fetchMatches() {
    const res = await fetch(apiUrl('/api/matches'));
    if (!res.ok) throw new Error('Failed to fetch matches: ' + res.status);
    return res.json();
  }

  async function createMatch(a, b) {
    const token = getAuthToken();
    if (!token) throw new Error('Must be logged in');
    const res = await fetch(apiUrl('/api/matches'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ playerA: a, playerB: b })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error('Failed to create match: ' + res.status + ' ' + text);
    }
    return res.json();
  }

  document.getElementById('create-match').addEventListener('click', async () => {
    const a = document.getElementById('player-a').value.trim();
    const b = document.getElementById('player-b').value.trim();
    if (!a || !b) return alert('Enter both players');
    try {
      await createMatch(a, b);
      alert('Match created');
      load();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });

  async function load() {
    try {
      const matches = await fetchMatches();
      const root = document.getElementById('matches-root');
      if (!matches || matches.length === 0) {
        root.innerHTML = '<p>No matches found.</p>';
        return;
      }
      const list = document.createElement('ul');
      matches.forEach(m => {
        const li = document.createElement('li');
        li.textContent = (m.playerA || '?') + ' vs ' + (m.playerB || '?') + (m.scheduled ? ' @ ' + m.scheduled : '');
        list.appendChild(li);
      });
      root.innerHTML = '';
      root.appendChild(list);
    } catch (err) {
      document.getElementById('matches-root').innerHTML = '<p style="color:red">Failed to load matches: ' + err.message + '</p>';
    }
  }

  load();
})();
