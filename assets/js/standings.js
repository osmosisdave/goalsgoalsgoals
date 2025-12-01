// Standings renderer (mock data)
(function () {
  function elt(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    Object.keys(attrs).forEach(k => {
      if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(c => e.appendChild(c));
    return e;
  }

  // Colors for form badges
  const FORM_COLOR = {
    'GGG': '#4caf50', // green
    'G-0': '#ffeb3b', // yellow
    '0-0': '#f44336'  // red
  };

  // Mock dataset
  const mockUsers = [
    { group: 'A', username: 'Dave', PL: 28, GGG: 21, G0: 7, Z0: 0, GF: 98, form: ['GGG','G-0','GGG','GGG','G-0'] },
    { group: 'A', username: 'Wilson', PL: 28, GGG: 20, G0: 8, Z0: 0, GF: 85, form: ['G-0','GGG','GGG','G-0','GGG'] },
    { group: 'A', username: 'Stevo', PL: 28, GGG: 19, G0: 8, Z0: 1, GF: 89, form: ['G-0','GGG','GGG','GGG','GGG'] },
    { group: 'A', username: 'Mint', PL: 28, GGG: 17, G0: 10, Z0: 1, GF: 80, form: ['G-0','GGG','GGG','G-0','0-0'] },

    { group: 'B', username: 'Daryl', PL: 28, GGG: 17, G0: 9, Z0: 2, GF: 77, form: ['0-0','G-0','G-0','GGG','0-0'] },
    { group: 'B', username: 'Smallz', PL: 28, GGG: 16, G0: 11, Z0: 1, GF: 75, form: ['G-0','GGG','G-0','GGG','GGG'] },
    { group: 'B', username: 'Dunn', PL: 28, GGG: 14, G0: 12, Z0: 2, GF: 87, form: ['GGG','GGG','GGG','G-0','0-0'] },
    { group: 'B', username: 'Danner', PL: 28, GGG: 11, G0: 16, Z0: 1, GF: 70, form: ['G-0','G-0','GGG','G-0','GGG'] }
  ];

  function computeStats(u) {
    const PL = u.PL || (u.form ? u.form.length : 0);
    const GGG = u.GGG || (u.form ? u.form.filter(s => s === 'GGG').length : 0);
    const G0 = u.G0 || (u.form ? u.form.filter(s => s === 'G-0').length : 0);
    const Z0 = u.Z0 || (u.form ? u.form.filter(s => s === '0-0').length : 0);
    const GF = u.GF || 0;
    const points = (3 * GGG) + (1 * G0) + (-1 * Z0);
    const ppg = PL > 0 ? (points / PL) : 0;
    return { PL, GGG, G0, Z0, GF, points, ppg };
  }

  function formatPPG(n) {
    return n.toFixed(2);
  }

  function createFormCell(form) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '6px';
    container.style.alignItems = 'center';
    (form || []).slice(0,5).forEach(s => {
      const dot = document.createElement('div');
      dot.style.width = '22px';
      dot.style.height = '22px';
      dot.style.borderRadius = '50%';
      dot.style.background = FORM_COLOR[s] || '#ccc';
      dot.style.display = 'inline-block';
      dot.title = s;
      container.appendChild(dot);
    });
    return container;
  }

  function renderGroup(container, groupName, users) {
    const title = elt('h5', { text: groupName });
    container.appendChild(title);

    const table = document.createElement('table');
    table.className = 'striped responsive-table';
    table.style.marginBottom = '1rem';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th></th><th>Name</th><th>PL</th><th>GGG</th><th>G-0</th><th>0-0</th><th>GF</th><th>Pts</th><th>PPG</th><th>Form</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');

    users.forEach((u, idx) => {
      const s = computeStats(u);
      const tr = document.createElement('tr');
      const rankTd = elt('td', { text: String(idx + 1) });
      tr.appendChild(rankTd);
      tr.appendChild(elt('td', { text: u.username }));
      tr.appendChild(elt('td', { text: String(s.PL) }));
      tr.appendChild(elt('td', { text: String(s.GGG) }));
      tr.appendChild(elt('td', { text: String(s.G0) }));
      tr.appendChild(elt('td', { text: String(s.Z0) }));
      tr.appendChild(elt('td', { text: String(s.GF) }));
      tr.appendChild(elt('td', { text: String(s.points) }));
      tr.appendChild(elt('td', { text: formatPPG(s.ppg) }));
      const formTd = document.createElement('td');
      formTd.appendChild(createFormCell(u.form));
      tr.appendChild(formTd);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
  }

  function renderTotals(container, allUsers) {
    const totals = allUsers.reduce((acc, u) => {
      const s = computeStats(u);
      acc.PL += s.PL;
      acc.GGG += s.GGG;
      acc.G0 += s.G0;
      acc.Z0 += s.Z0;
      acc.GF += s.GF;
      acc.points += s.points;
      return acc;
    }, { PL:0, GGG:0, G0:0, Z0:0, GF:0, points:0 });

    const ppg = totals.PL > 0 ? (totals.points / totals.PL) : 0;

    const containerDiv = document.createElement('div');
    containerDiv.style.marginTop = '0.5rem';
    const table = document.createElement('table');
    table.className = 'striped';
    table.innerHTML = `<thead><tr><th></th><th>Totals</th><th>PL</th><th>GGG</th><th>G-0</th><th>0-0</th><th>GF</th><th>Pts</th><th>PPG</th><th></th></tr></thead>`;
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    tr.appendChild(elt('td', { text: '' }));
    tr.appendChild(elt('td', { text: '' }));
    tr.appendChild(elt('td', { text: String(totals.PL) }));
    tr.appendChild(elt('td', { text: String(totals.GGG) }));
    tr.appendChild(elt('td', { text: String(totals.G0) }));
    tr.appendChild(elt('td', { text: String(totals.Z0) }));
    tr.appendChild(elt('td', { text: String(totals.GF) }));
    tr.appendChild(elt('td', { text: String(totals.points) }));
    tr.appendChild(elt('td', { text: formatPPG(ppg) }));
    tr.appendChild(elt('td', { text: '' }));
    tbody.appendChild(tr);
    table.appendChild(tbody);
    containerDiv.appendChild(table);
    container.appendChild(containerDiv);
  }

  function init() {
    const root = document.getElementById('leagues-root');
    if (!root) return;
    root.innerHTML = '';

    // Group users
    const groups = {};
    mockUsers.forEach(u => {
      groups[u.group] = groups[u.group] || [];
      groups[u.group].push(u);
    });

    // For each group sort by points desc
    Object.keys(groups).forEach(g => {
      groups[g].sort((a,b) => computeStats(b).points - computeStats(a).points);
    });

    // Render groups in order A..Z
    const groupNames = Object.keys(groups).sort();
    groupNames.forEach(g => {
      renderGroup(root, g, groups[g]);
      // dashed separator
      const hr = document.createElement('hr');
      hr.style.border = 'none';
      hr.style.borderTop = '1px dashed #999';
      hr.style.margin = '8px 0 16px 0';
      root.appendChild(hr);
    });

    // Totals below
    renderTotals(root, mockUsers);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
