// Standings renderer — compiled to assets/js/standings.js by `npm run build` (root tsconfig).

import type { StandingEntry, AppStandingsResponse } from './api-types';

// ----- Constants -----

const FORM_COLOR: Record<string, string> = {
  'GGG': '#4caf50', // green
  'G-0': '#ffeb3b', // yellow
  '0-0': '#f44336', // red
};

// ----- Helpers -----

// Typed wrapper for elt — used to create simple text-content cells quickly.
function elt(tag: string, attrs: Record<string, string> = {}, children: HTMLElement[] = []): HTMLElement {
  const e = document.createElement(tag);
  Object.keys(attrs).forEach(k => {
    if (k === 'text') e.textContent = attrs[k];
    else e.setAttribute(k, attrs[k]);
  });
  children.forEach(c => e.appendChild(c));
  return e;
}

// ----- API -----

async function fetchStandings(season?: number): Promise<AppStandingsResponse | null> {
  const apiBase = (window.GGG_API_ORIGIN || '').replace(/\/$/, '');
  const url = season != null ? `${apiBase}/api/standings?season=${season}` : `${apiBase}/api/standings`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch standings:', response.statusText);
      return null;
    }
    return await response.json() as AppStandingsResponse;
  } catch (error) {
    console.error('Error fetching standings:', error);
    return null;
  }
}

// ----- Render helpers -----

function computeStats(u: StandingEntry) {
  return {
    PL: u.PL ?? 0,
    GGG: u.GGG ?? 0,
    G0: u.G0 ?? 0,
    Z0: u.Z0 ?? 0,
    GF: u.GF ?? 0,
    points: u.points ?? 0,
    ppg: u.ppg ?? 0,
  };
}

function formatPPG(n: number): string {
  return n.toFixed(2);
}

function createFormCell(form: string[] | undefined): HTMLDivElement {
  const container = document.createElement('div');
  container.style.cssText = 'display:flex;gap:6px;align-items:center;';
  (form || []).slice(0, 5).forEach(s => {
    const dot = document.createElement('div');
    dot.style.cssText = `width:22px;height:22px;border-radius:50%;background:${FORM_COLOR[s] || '#ccc'};display:inline-block;`;
    dot.title = s;
    container.appendChild(dot);
  });
  return container;
}

function renderGroup(container: HTMLElement, groupName: string, users: StandingEntry[]): void {
  container.appendChild(elt('h5', { text: groupName }));

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
    tr.appendChild(elt('td', { text: String(idx + 1) }));
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

function renderTotals(container: HTMLElement, allUsers: StandingEntry[]): void {
  const totals = allUsers.reduce(
    (acc, u) => {
      const s = computeStats(u);
      acc.PL += s.PL;
      acc.GGG += s.GGG;
      acc.G0 += s.G0;
      acc.Z0 += s.Z0;
      acc.GF += s.GF;
      acc.points += s.points;
      return acc;
    },
    { PL: 0, GGG: 0, G0: 0, Z0: 0, GF: 0, points: 0 }
  );

  const ppg = totals.PL > 0 ? totals.points / totals.PL : 0;

  const wrapper = document.createElement('div');
  wrapper.style.marginTop = '0.5rem';

  const table = document.createElement('table');
  table.className = 'striped';
  table.innerHTML = `<thead><tr><th></th><th>Totals</th><th>PL</th><th>GGG</th><th>G-0</th><th>0-0</th><th>GF</th><th>Pts</th><th>PPG</th><th></th></tr></thead>`;

  const tbody = document.createElement('tbody');
  const tr = document.createElement('tr');
  [
    '', '',
    String(totals.PL), String(totals.GGG), String(totals.G0),
    String(totals.Z0), String(totals.GF), String(totals.points),
    formatPPG(ppg), '',
  ].forEach(text => tr.appendChild(elt('td', { text })));
  tbody.appendChild(tr);
  table.appendChild(tbody);
  wrapper.appendChild(table);
  container.appendChild(wrapper);
}

function buildSeasonOptions(select: HTMLSelectElement, availableSeasons: number[], activeSeason: number | null): void {
  const seen = new Set<string>();
  const options = Array.from(select.options);
  options.forEach(option => seen.add(option.value));

  const seasonCandidates = [...availableSeasons];
  if (activeSeason != null && !seen.has(String(activeSeason))) {
    seasonCandidates.unshift(activeSeason);
  }

  seasonCandidates.forEach(year => {
    const value = String(year);
    if (seen.has(value)) return;
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = seasonLabel(year);
    if (activeSeason != null && year === activeSeason) opt.selected = true;
    select.appendChild(opt);
    seen.add(value);
  });

  if (activeSeason != null) {
    const selected = Array.from(select.options).find(option => option.value === String(activeSeason));
    if (selected) selected.selected = true;
  }
}

function renderSeasonSelector(container: HTMLElement, availableSeasons: number[], activeSeason: number | null): HTMLSelectElement | null {
  if (availableSeasons.length === 0 && activeSeason == null) return null;

  const select = document.createElement('select');
  select.id = 'standings-season-select';

  buildSeasonOptions(select, availableSeasons, activeSeason);

  const label = document.createElement('label');
  label.htmlFor = 'standings-season-select';
  label.textContent = 'Season';

  container.appendChild(select);
  container.appendChild(label);

  if (typeof M !== 'undefined') M.FormSelect.init(select);
  return select;
}

// ----- Entry point -----

function seasonLabel(year: number): string {
  return `${year}/${String(year + 1).slice(2)} Season`;
}

function renderStandingsTable(container: HTMLElement, standings: StandingEntry[]): void {
  container.innerHTML = '';
  if (standings.length === 0) {
      const opt = document.createElement('option');
      opt.value = String(yr);
      opt.textContent = seasonLabel(yr);
      if (yr === activeSeason) opt.selected = true;
      select.appendChild(opt);
    });
    const label = document.createElement('label');
    label.htmlFor = 'standings-season-select';
    label.textContent = 'Season';
    selectorContainer.appendChild(select);
    selectorContainer.appendChild(label);
    // Initialise Materialize select
    if (typeof M !== 'undefined') M.FormSelect.init(select);
    selectorEl = select;
  }

  const tableContainer = document.createElement('div');
  root.appendChild(tableContainer);
  renderStandingsTable(tableContainer, initialData.standings || []);

  if (selectorEl) {
    selectorEl.addEventListener('change', async (e: Event) => {
      activeSeason = parseInt((e.target as HTMLSelectElement).value);
      tableContainer.innerHTML = '<div class="progress"><div class="indeterminate"></div></div>';
      const data = await fetchStandings(activeSeason);
      renderStandingsTable(tableContainer, data?.standings || []);
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
