// Matches mock list (50 matches) and basic renderer
(function () {
  function randPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  const teams = [
    'Aldershot', 'Bayside', 'Campbell', 'Dartford', 'Eagles', 'Falcons', 'Greenford', 'Harrow', 'Ivy Town', 'Jasper',
    'Kingsley', 'Lakeside', 'Millton', 'Northvale', 'Oakham', 'Parkview', 'Quincy', 'Riverside', 'Sutton', 'Tiverton',
    'Upton', 'Valley', 'Westford', 'Xford', 'Yewside', 'Zennor'
  ];

  // Allowed competitions per requirements
  const comps = [
    'Premier League', 'Championship', 'League One', 'League Two', 'National League', // English tiers 1-5
    'Scottish Premiership', 'Scottish Championship', 'Scottish League One', 'Scottish League Two', // Scottish tiers 1-4
    'FA Cup', 'League Cup', 'EFL Trophy', 'Scottish Cup', 'Scottish League Cup', 'Scottish Challenge Cup',
    'Champions League', 'Europa League', 'Europa Conference League'
  ];

  // generate 50 mock matches
  const mockMatches = [];
  const now = new Date();
  // generate 50 matches on sequential days, all with kickoff at 15:00:00
  for (let i = 0; i < 50; i++) {
    let a = randPick(teams);
    let b = randPick(teams);
    while (b === a) b = randPick(teams);
    const d = new Date(now);
    d.setDate(d.getDate() + i); // spread across upcoming days
    d.setHours(15, 0, 0, 0); // kickoff at 15:00:00
    const competition = randPick(comps);
    const gameweek = (Math.floor(i / 5) % 38) + 1; // group into weeks of 5 matches
    mockMatches.push({ id: i + 1, teamA: a, teamB: b, kickOff: d.toISOString(), competition, gameweek });
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString();
  }

  function renderList(matches) {
    const root = document.getElementById('matches-root');
    if (!root) return;
    root.innerHTML = '';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '8px';
    header.appendChild(document.createElement('h5')).textContent = `Upcoming Matches (${matches.length})`;
    root.appendChild(header);

    const list = document.createElement('div');
    list.className = 'collection';

    matches.forEach(m => {
      const item = document.createElement('a');
      item.className = 'collection-item';
      item.href = '#';
      const line1 = document.createElement('div');
      line1.style.display = 'flex';
      line1.style.justifyContent = 'space-between';
      const teams = document.createElement('strong');
      teams.textContent = `${m.teamA} vs ${m.teamB}`;
      const meta = document.createElement('span');
      meta.textContent = `GW ${m.gameweek} · ${m.competition}`;
      line1.appendChild(teams);
      line1.appendChild(meta);

      const line2 = document.createElement('div');
      line2.style.color = '#666';
      line2.textContent = `Kick-off: ${fmtDate(m.kickOff)}`;

      item.appendChild(line1);
      item.appendChild(line2);
      list.appendChild(item);
    });

    root.appendChild(list);
  }

  // Pagination by gameweek: group matches by gameweek and present one GW per page.
  document.addEventListener('DOMContentLoaded', function () {
    const root = document.getElementById('matches-root');
    if (!root) return;

    // compute sorted unique gameweeks
    const gws = Array.from(new Set(mockMatches.map(m => m.gameweek))).sort((a,b) => a - b);
    if (gws.length === 0) {
      renderList([]);
      return;
    }
    let current = 0;

    function renderPage(idx) {
      const gw = gws[idx];
      const pageMatches = mockMatches.filter(m => m.gameweek === gw);

      // header with pager
      root.innerHTML = '';
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.marginBottom = '8px';

      const title = document.createElement('h5');
      title.textContent = `Gameweek ${gw} — ${pageMatches.length} matches`;
      header.appendChild(title);

      const pager = document.createElement('div');
      pager.style.display = 'flex';
      pager.style.gap = '8px';
      const prev = document.createElement('button'); prev.className = 'btn'; prev.textContent = 'Prev';
      const indicator = document.createElement('span'); indicator.style.alignSelf = 'center'; indicator.textContent = ` ${idx + 1} / ${gws.length} `;
      const next = document.createElement('button'); next.className = 'btn'; next.textContent = 'Next';
      if (idx === 0) prev.disabled = true;
      if (idx === gws.length - 1) next.disabled = true;
      prev.addEventListener('click', () => { if (current > 0) { current -= 1; renderPage(current); } });
      next.addEventListener('click', () => { if (current < gws.length - 1) { current += 1; renderPage(current); } });
      pager.appendChild(prev); pager.appendChild(indicator); pager.appendChild(next);

      header.appendChild(pager);
      root.appendChild(header);

      // render matches for this gameweek
      const list = document.createElement('div');
      list.className = 'collection';
      pageMatches.forEach(m => {
        const item = document.createElement('a');
        item.className = 'collection-item';
        item.href = '#';
        const line1 = document.createElement('div');
        line1.style.display = 'flex';
        line1.style.justifyContent = 'space-between';
        const teams = document.createElement('strong');
        teams.textContent = `${m.teamA} vs ${m.teamB}`;
        const meta = document.createElement('span');
        meta.textContent = `${m.competition}`;
        line1.appendChild(teams);
        line1.appendChild(meta);

        const line2 = document.createElement('div');
        line2.style.color = '#666';
        line2.textContent = `Kick-off: ${fmtDate(m.kickOff)}`;

        item.appendChild(line1);
        item.appendChild(line2);
        list.appendChild(item);
      });

      root.appendChild(list);
    }

    // initial page
    renderPage(current);
  });
})();
