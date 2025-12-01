// Matches mock list (50 matches) and basic renderer
(function () {
  function randPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  const teams = [
    'Aldershot', 'Bayside', 'Campbell', 'Dartford', 'Eagles', 'Falcons', 'Greenford', 'Harrow', 'Ivy Town', 'Jasper',
    'Kingsley', 'Lakeside', 'Millton', 'Northvale', 'Oakham', 'Parkview', 'Quincy', 'Riverside', 'Sutton', 'Tiverton',
    'Upton', 'Valley', 'Westford', 'Xford', 'Yewside', 'Zennor'
  ];

  const comps = ['Premier Cup', 'Championship', 'FA Cup', 'League One', 'League Two'];

  // generate 50 mock matches
  const mockMatches = [];
  const start = Date.now();
  for (let i = 0; i < 50; i++) {
    let a = randPick(teams);
    let b = randPick(teams);
    while (b === a) b = randPick(teams);
    const kickOff = new Date(start + (i * 1000 * 60 * 60 * 6)); // every 6 hours
    const competition = randPick(comps);
    const gameweek = (Math.floor(i / 5) % 38) + 1; // group into weeks of 5 matches
    mockMatches.push({ id: i + 1, teamA: a, teamB: b, kickOff: kickOff.toISOString(), competition, gameweek });
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

  document.addEventListener('DOMContentLoaded', function () {
    renderList(mockMatches);
  });
})();
