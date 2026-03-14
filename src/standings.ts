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

async function fetchStandings(): Promise<StandingEntry[] | null> {
  const apiBase = (window.GGG_API_ORIGIN || '').replace(/\/$/, '');
  try {
    const response = await fetch(`${apiBase}/api/standings`);
    if (!response.ok) {
      console.error('Failed to fetch standings:', response.statusText);
      return null;
    }
    const data: AppStandingsResponse = await response.json();
    return data.standings || [];
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

// ----- Entry point -----

async function init(): Promise<void> {
  const root = document.getElementById('leagues-root');
  if (!root) return;

  root.innerHTML = '<div class="progress"><div class="indeterminate"></div></div>';

  const standings = await fetchStandings();

  if (!standings || standings.length === 0) {
    root.innerHTML = '<p class="grey-text">No standings data available yet. Match selections need to be completed.</p>';
    return;
  }

  root.innerHTML = '';

  // Group users by their assigned league
  const groups: Record<string, StandingEntry[]> = {};
  standings.forEach(u => {
    const groupName = u.league || 'Unassigned';
    groups[groupName] = groups[groupName] || [];
    groups[groupName].push(u);
  });

  Object.keys(groups).sort().forEach(g => {
    renderGroup(root, g, groups[g]);
    const hr = document.createElement('hr');
    hr.style.cssText = 'border:none;border-top:1px dashed #999;margin:8px 0 16px 0;';
    root.appendChild(hr);
  });

  renderTotals(root, standings);
}

document.addEventListener('DOMContentLoaded', init);
