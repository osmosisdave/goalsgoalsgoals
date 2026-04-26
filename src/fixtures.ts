// Matches - Fetch fixtures from database
// Compiled to assets/js/fixtures.js by `npm run build` (root tsconfig).

import type {
  Fixture,
  Gameweek,
  GameweeksResponse,
  SelectionRecord,
  SelectionsResponse,
  SelectMatchResponse,
  StealableResponse,
  StealMatchResponse,
  MeResponse,
} from './api-types';

// ----- IIFE to avoid polluting the global scope -----

(function () {
  // API_BASE_URL comes from config.js via window.GGG_API_ORIGIN (typed in globals.d.ts).
  // Trailing slash stripped to keep URL construction consistent.
  const API_BASE_URL = (window.GGG_API_ORIGIN || '').replace(/\/$/, '');

  let allGameweeks: Gameweek[] = [];
  let matchSelections: Record<number, string> = {};
  let stealableFixtureIds: Set<number> = new Set();
  let currentUser: string | null = null;
  let selectedLeague = 'all';
  let selectedTeam = 'all';
  // Football seasons run Aug–May. The season is identified by the year it starts,
  // so 2024/25 = 2024, 2025/26 = 2025. August = month index 7.
  const _now = new Date();
  const _currentSeason = String(_now.getMonth() >= 7 ? _now.getFullYear() : _now.getFullYear() - 1);
  let selectedSeason = _currentSeason;

  function getToken(): string | null {
    return sessionStorage.getItem('ggg_token');
  }

  async function fetchCurrentUser(): Promise<string | null> {
    const token = getToken();
    if (!token) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data: MeResponse = await response.json();
        return data.username || null;
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
    return null;
  }

  async function fetchSelections(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/matches/selections`);
      if (response.ok) {
        const data: SelectionsResponse = await response.json();
        matchSelections = {};
        data.selections.forEach(s => {
          matchSelections[s.fixtureId] = s.username;
        });
      }
    } catch (error) {
      console.error('Error fetching selections:', error);
    }
  }

  async function selectMatch(fixtureId: number): Promise<boolean> {
    const token = getToken();
    if (!token) {
      M.toast({ html: 'Please log in to select a match', classes: 'red' });
      return false;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/matches/${fixtureId}/select`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data: SelectMatchResponse = await response.json();
      if (response.ok) {
        const message = data.replaced ? '✓ Match selection updated!' : '✓ Match selected!';
        M.toast({ html: message, classes: 'green', displayLength: 3000 });
        await Promise.all([fetchSelections(), fetchStealable()]);
        return true;
      } else {
        M.toast({ html: data.message || 'Failed to select match', classes: 'red' });
        return false;
      }
    } catch (error) {
      console.error('Error selecting match:', error);
      M.toast({ html: 'Error selecting match', classes: 'red' });
      return false;
    }
  }

  async function unselectMatch(fixtureId: number): Promise<boolean> {
    const token = getToken();
    if (!token) return false;
    try {
      const response = await fetch(`${API_BASE_URL}/api/matches/${fixtureId}/select`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        M.toast({ html: 'Match unselected', classes: 'grey' });
        await Promise.all([fetchSelections(), fetchStealable()]);
        return true;
      }
    } catch (error) {
      console.error('Error unselecting match:', error);
    }
    return false;
  }

  async function fetchGameweeks(): Promise<Gameweek[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/football/gameweeks?season=${selectedSeason}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: GameweeksResponse = await response.json();
      return data.gameweeks || [];
    } catch (error) {
      console.error('Error fetching gameweeks:', error);
      const root = document.getElementById('matches-root');
      if (root) {
        root.innerHTML = `
          <div class="card red lighten-4">
            <div class="card-content">
              <span class="card-title red-text">Error Loading Fixtures</span>
              <p><strong>Error:</strong> ${(error as Error).message}</p>
              <p><strong>API URL:</strong> ${API_BASE_URL}/api/football/gameweeks</p>
              <p class="grey-text">Check the browser console for more details. Make sure the backend server is running on port 4000.</p>
            </div>
          </div>
        `;
      }
      return [];
    }
  }

  async function fetchStealable(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/matches/stealable?season=${selectedSeason}`);
      if (response.ok) {
        const data: StealableResponse = await response.json();
        stealableFixtureIds = new Set(data.stealableFixtureIds);
      }
    } catch (error) {
      console.error('Error fetching stealable picks:', error);
    }
  }

  async function stealMatch(fixtureId: number): Promise<boolean> {
    const token = getToken();
    if (!token) {
      M.toast({ html: 'Please log in to steal a match', classes: 'red' });
      return false;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/matches/${fixtureId}/steal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data: StealMatchResponse = await response.json();
      if (response.ok) {
        M.toast({ html: `🗡️ ${data.message}`, classes: 'red darken-2', displayLength: 4000 });
        await Promise.all([fetchSelections(), fetchStealable()]);
        return true;
      } else {
        M.toast({ html: (data as any).message || 'Failed to steal match', classes: 'red' });
        return false;
      }
    } catch (error) {
      console.error('Error stealing match:', error);
      M.toast({ html: 'Error stealing match', classes: 'red' });
      return false;
    }
  }

  const STATUS_DISPLAY: Record<string, string> = {
    'NS': 'Not Started',
    '1H': 'First Half',
    'HT': 'Half Time',
    '2H': 'Second Half',
    'ET': 'Extra Time',
    'FT': 'Full Time',
    'AET': 'After Extra Time',
    'PEN': 'Penalty',
    'CANC': 'Cancelled',
    'SUSP': 'Suspended',
    'PST': 'Postponed',
    'ABD': 'Abandoned'
  };

  function getStatusDisplay(status: string): string {
    return STATUS_DISPLAY[status] || status;
  }

  function getStatusColor(status: string): string {
    if (status === 'FT' || status === 'AET' || status === 'PEN') return '#4caf50'; // green - finished
    if (status === '1H' || status === '2H' || status === 'HT') return '#ff9800'; // orange - live
    if (status === 'NS') return '#2196f3'; // blue - not started
    return '#9e9e9e'; // grey - other
  }

  function fmtDate(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) {
      return `Today, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (d.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function renderFixture(fixture: Fixture, isLocked: boolean, unlocksAt: string | null): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'collection-item';

    const fixtureId = fixture.fixture.id;
    const status = fixture.fixture.status.short;
    const isLive = ['1H', '2H', 'HT', 'ET'].includes(status);
    const isUpcoming = status === 'NS';
    const selectedBy = matchSelections[fixtureId];
    const isSelectedByMe = selectedBy === currentUser;

    if (selectedBy) {
      item.style.backgroundColor = isSelectedByMe ? '#e8f5e9' : '#fff3e0';
      item.style.borderLeft = isSelectedByMe ? '4px solid #4caf50' : '4px solid #ff9800';
    }

    // Header: Competition + Round
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px;color:#666;';

    const comp = document.createElement('span');
    comp.textContent = `${fixture.league.name} - ${fixture.league.round}`;

    const statusBadge = document.createElement('span');
    statusBadge.textContent = getStatusDisplay(status);
    statusBadge.style.cssText = `padding:2px 8px;border-radius:4px;background-color:${getStatusColor(status)};color:white;font-size:11px;font-weight:bold;`;
    if (isLive) statusBadge.style.animation = 'pulse 2s infinite';

    header.appendChild(comp);
    header.appendChild(statusBadge);

    // Main: Teams + Score
    const main = document.createElement('div');
    main.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';

    const teams = document.createElement('div');
    teams.style.flex = '1';

    const homeLine = document.createElement('div');
    homeLine.style.cssText = 'display:flex;align-items:center;margin-bottom:4px;';
    const homeTeam = document.createElement('strong');
    homeTeam.textContent = fixture.teams.home.name;
    homeTeam.style.fontSize = '16px';
    if (fixture.teams.home.winner) homeTeam.style.color = '#4caf50';
    homeLine.appendChild(homeTeam);

    const awayLine = document.createElement('div');
    awayLine.style.cssText = 'display:flex;align-items:center;';
    const awayTeam = document.createElement('strong');
    awayTeam.textContent = fixture.teams.away.name;
    awayTeam.style.fontSize = '16px';
    if (fixture.teams.away.winner) awayTeam.style.color = '#4caf50';
    awayLine.appendChild(awayTeam);

    teams.appendChild(homeLine);
    teams.appendChild(awayLine);

    const score = document.createElement('div');
    score.style.cssText = 'text-align:center;min-width:60px;';

    if (isUpcoming) {
      score.innerHTML = `<div style="font-size:24px;color:#999;">-</div>`;
    } else {
      const homeScore = fixture.goals.home !== null ? fixture.goals.home : '-';
      const awayScore = fixture.goals.away !== null ? fixture.goals.away : '-';
      score.innerHTML = `
        <div style="font-size:24px;font-weight:bold;">${homeScore}</div>
        <div style="font-size:24px;font-weight:bold;">${awayScore}</div>
      `;
    }

    main.appendChild(teams);
    main.appendChild(score);

    // Footer: Date/Time + Venue + Selection controls
    const footer = document.createElement('div');
    footer.style.cssText = 'font-size:12px;color:#666;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;';

    const datetimeVenue = document.createElement('div');
    datetimeVenue.style.cssText = 'display:flex;gap:16px;';

    const datetime = document.createElement('span');
    datetime.innerHTML = `<i class="material-icons" style="font-size:12px;vertical-align:middle;">event</i> ${fmtDate(fixture.fixture.date)}`;

    const venue = document.createElement('span');
    if (fixture.fixture.venue?.name) {
      venue.innerHTML = `<i class="material-icons" style="font-size:12px;vertical-align:middle;">place</i> ${fixture.fixture.venue.name}`;
    }

    datetimeVenue.appendChild(datetime);
    datetimeVenue.appendChild(venue);

    const selectionArea = document.createElement('div');

    if (selectedBy) {
      const badge = document.createElement('span');
      badge.style.cssText = 'padding:6px 12px;border-radius:12px;font-size:12px;font-weight:bold;display:inline-flex;align-items:center;gap:4px;';

      if (isSelectedByMe) {
        badge.style.backgroundColor = isUpcoming ? '#4caf50' : '#81c784';
        badge.style.color = 'white';
        badge.innerHTML = `<i class="material-icons" style="font-size:16px;">check_circle</i> Your Pick`;
        selectionArea.appendChild(badge);

        if (isUpcoming) {
          const removeBtn = document.createElement('button');
          removeBtn.className = 'btn-small red lighten-1 waves-effect';
          removeBtn.style.cssText = 'margin-left:8px;padding:0 8px;height:24px;line-height:24px;';
          removeBtn.innerHTML = '<i class="material-icons" style="font-size:14px;">close</i>';
          removeBtn.onclick = async (e: MouseEvent) => {
            e.stopPropagation();
            removeBtn.disabled = true;
            if (await unselectMatch(fixtureId)) {
              if (window.renderPage) window.renderPage();
            } else {
              removeBtn.disabled = false;
            }
          };
          selectionArea.appendChild(removeBtn);
        }
      } else {
        badge.style.backgroundColor = isUpcoming ? '#ff9800' : '#ffb74d';
        badge.style.color = 'white';
        badge.innerHTML = `<i class="material-icons" style="font-size:16px;">person</i> Picked by ${selectedBy}`;
        selectionArea.appendChild(badge);

        // Show steal button only when: the gameweek is active (not locked), the
        // fixture hasn't started yet, the user is logged in, and the pick meets
        // the consecutive-team steal criterion.
        if (isUpcoming && !isLocked && currentUser && stealableFixtureIds.has(fixtureId)) {
          const stealBtn = document.createElement('button');
          stealBtn.className = 'btn-small red waves-effect';
          stealBtn.style.cssText = 'margin-left:8px;padding:0 12px;height:28px;line-height:28px;font-weight:bold;';
          stealBtn.innerHTML = '<i class="material-icons left" style="font-size:16px;line-height:28px;">flash_on</i>Steal';
          stealBtn.title = `${selectedBy} picked the same team two gameweeks in a row — you can steal this!`;
          stealBtn.onclick = async (e: MouseEvent) => {
            e.stopPropagation();
            const confirmed = confirm(
              `Steal ${fixture.teams.home.name} vs ${fixture.teams.away.name} from ${selectedBy}?\n\nTheir selection will be removed and the match will become yours.`
            );
            if (!confirmed) return;
            stealBtn.disabled = true;
            stealBtn.innerHTML = '<i class="material-icons left" style="font-size:16px;line-height:28px;">hourglass_empty</i>Stealing...';
            if (await stealMatch(fixtureId)) {
              if (window.renderPage) window.renderPage();
            } else {
              stealBtn.disabled = false;
              stealBtn.innerHTML = '<i class="material-icons left" style="font-size:16px;line-height:28px;">flash_on</i>Steal';
            }
          };
          selectionArea.appendChild(stealBtn);
        }
      }
    } else if (isUpcoming && currentUser) {
      if (isLocked) {
        const lockBadge = document.createElement('span');
        lockBadge.style.cssText = 'padding:6px 12px;border-radius:12px;font-size:12px;font-weight:bold;display:inline-flex;align-items:center;gap:4px;background:#9e9e9e;color:white;';
        const unlockLabel = unlocksAt
          ? new Date(unlocksAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
          : '';
        lockBadge.innerHTML = `<i class="material-icons" style="font-size:16px;">lock</i> Locked${unlockLabel ? ` — opens ${unlockLabel}` : ''}`;
        selectionArea.appendChild(lockBadge);
      } else {
        const selectBtn = document.createElement('button');
        selectBtn.className = 'btn-small blue waves-effect';
        selectBtn.style.cssText = 'padding:0 12px;height:28px;line-height:28px;';
        selectBtn.innerHTML = '<i class="material-icons left" style="font-size:16px;line-height:28px;">add_circle</i>Select';
        selectBtn.onclick = async (e: MouseEvent) => {
          e.stopPropagation();

          // If user already has a selection for a different fixture, confirm the swap
          const currentSelectionKey = Object.keys(matchSelections).find(
            fid => matchSelections[parseInt(fid)] === currentUser && parseInt(fid) !== fixtureId
          );
          if (currentSelectionKey) {
            const selected = allGameweeks.flatMap((gw: Gameweek) => gw.fixtures).find((f: Fixture) => f.fixture.id === parseInt(currentSelectionKey));
            if (selected) {
              const currentMatch = `${selected.teams.home.name} vs ${selected.teams.away.name}`;
              const newMatch = `${fixture.teams.home.name} vs ${fixture.teams.away.name}`;
              const confirmed = confirm(
                `You have already selected:\n${currentMatch}\n\nDo you want to change your selection to:\n${newMatch}?`
              );
              if (!confirmed) return;
            }
          }

          selectBtn.disabled = true;
          selectBtn.innerHTML = '<i class="material-icons left" style="font-size:16px;line-height:28px;">hourglass_empty</i>Selecting...';
          if (await selectMatch(fixtureId)) {
            if (window.renderPage) window.renderPage();
          } else {
            selectBtn.disabled = false;
            selectBtn.innerHTML = '<i class="material-icons left" style="font-size:16px;line-height:28px;">add_circle</i>Select';
          }
        };
        selectionArea.appendChild(selectBtn);
      }
    }

    footer.appendChild(datetimeVenue);
    footer.appendChild(selectionArea);

    item.appendChild(header);
    item.appendChild(main);
    item.appendChild(footer);

    return item;
  }

  // Pagination: group fixtures by gameweek (round number), render as tabs
  document.addEventListener('DOMContentLoaded', async function () {
    const root = document.getElementById('matches-root');
    if (!root) return;

    root.innerHTML = '<div class="progress"><div class="indeterminate"></div></div>';

    const seasonSelector = document.getElementById('season-selector') as HTMLSelectElement | null;
    if (seasonSelector) {
      // Sync the dropdown to whichever season was computed as current
      seasonSelector.value = selectedSeason;
      M.FormSelect.init(seasonSelector);
      seasonSelector.addEventListener('change', async (e: Event) => {
        selectedSeason = (e.target as HTMLSelectElement).value;
        root.innerHTML = '<div class="progress"><div class="indeterminate"></div></div>';
        allGameweeks = await fetchGameweeks();
        await fetchSelections();
        if (window.renderPage) window.renderPage();
      });
    }

    [currentUser, allGameweeks] = await Promise.all([
      fetchCurrentUser(),
      fetchGameweeks()
    ]);

    await Promise.all([fetchSelections(), fetchStealable()]);

    if (allGameweeks.length === 0) {
      root.innerHTML = '<p class="grey-text">No gameweeks available. Make sure the database is seeded and fixtures meet the qualifying criteria.</p>';
      return;
    }

    // Default to the last unlocked gameweek — that's the one currently open for
    // selection. Fall back to GW1 if everything is somehow locked.
    const lastUnlocked = allGameweeks.reduce((best, gw, i) => !gw.isLocked ? i : best, 0);
    let currentTab = lastUnlocked;

    window.renderPage = function () {
      // Build the flat fixture list for filter dropdowns (all fixtures across all gameweeks)
      const allFixtures: Fixture[] = allGameweeks.flatMap(gw => gw.fixtures);

      // Apply league/team filters to each gameweek's fixture list
      const tabs = allGameweeks.map(gw => {
        let fixtures = gw.fixtures;
        if (selectedLeague !== 'all') {
          fixtures = fixtures.filter(f => f.league.id === parseInt(selectedLeague));
        }
        if (selectedTeam !== 'all') {
          fixtures = fixtures.filter(f =>
            f.teams.home.id === parseInt(selectedTeam) || f.teams.away.id === parseInt(selectedTeam)
          );
        }
        return { label: gw.label, date: gw.date, fixtures, isLocked: gw.isLocked, unlocksAt: gw.unlocksAt };
      }).filter(gw => gw.fixtures.length > 0);

      root.innerHTML = '';

      // Filters card
      const filtersCard = document.createElement('div');
      filtersCard.className = 'card';
      filtersCard.style.marginBottom = '20px';

      const filtersContent = document.createElement('div');
      filtersContent.className = 'card-content';
      filtersContent.style.padding = '16px';

      const filtersTitle = document.createElement('span');
      filtersTitle.className = 'card-title';
      filtersTitle.style.cssText = 'font-size:18px;margin-bottom:12px;display:block;';
      filtersTitle.innerHTML = '<i class="material-icons left">filter_list</i>Filters';

      const filtersRow = document.createElement('div');
      filtersRow.className = 'row';
      filtersRow.style.marginBottom = '0';

      // League filter
      const leagueCol = document.createElement('div');
      leagueCol.className = 'col s12 m6';

      const leagueLabel = document.createElement('label');
      leagueLabel.textContent = 'League';
      leagueLabel.style.cssText = 'font-size:12px;color:#666;';

      const leagueSelect = document.createElement('select');
      leagueSelect.className = 'browser-default';
      leagueSelect.style.marginTop = '4px';

      const leagues = [...new Set(allFixtures.map(f => JSON.stringify({ id: f.league.id, name: f.league.name })))]
        .map(s => JSON.parse(s) as { id: number; name: string });

      leagueSelect.innerHTML = '<option value="all">All Leagues</option>' +
        leagues.map(l => `<option value="${l.id}" ${selectedLeague === String(l.id) ? 'selected' : ''}>${l.name}</option>`).join('');

      leagueSelect.addEventListener('change', (e: Event) => {
        selectedLeague = (e.target as HTMLSelectElement).value;
        selectedTeam = 'all'; // reset team filter when league changes
        if (window.renderPage) window.renderPage();
      });

      leagueCol.appendChild(leagueLabel);
      leagueCol.appendChild(leagueSelect);

      // Team filter
      const teamCol = document.createElement('div');
      teamCol.className = 'col s12 m6';

      const teamLabel = document.createElement('label');
      teamLabel.textContent = 'Team';
      teamLabel.style.cssText = 'font-size:12px;color:#666;';

      const teamSelect = document.createElement('select');
      teamSelect.className = 'browser-default';
      teamSelect.style.marginTop = '4px';

      let teamsForFilter = allFixtures;
      if (selectedLeague !== 'all') {
        teamsForFilter = teamsForFilter.filter(f => f.league.id === parseInt(selectedLeague));
      }
      const allTeamsSet = new Set<string>();
      teamsForFilter.forEach(f => {
        allTeamsSet.add(JSON.stringify({ id: f.teams.home.id, name: f.teams.home.name }));
        allTeamsSet.add(JSON.stringify({ id: f.teams.away.id, name: f.teams.away.name }));
      });
      const allTeams = [...allTeamsSet]
        .map(s => JSON.parse(s) as { id: number; name: string })
        .sort((a, b) => a.name.localeCompare(b.name));

      teamSelect.innerHTML = '<option value="all">All Teams</option>' +
        allTeams.map(t => `<option value="${t.id}" ${selectedTeam === String(t.id) ? 'selected' : ''}>${t.name}</option>`).join('');

      teamSelect.addEventListener('change', (e: Event) => {
        selectedTeam = (e.target as HTMLSelectElement).value;
        if (window.renderPage) window.renderPage();
      });

      teamCol.appendChild(teamLabel);
      teamCol.appendChild(teamSelect);

      filtersRow.appendChild(leagueCol);
      filtersRow.appendChild(teamCol);
      filtersContent.appendChild(filtersTitle);
      filtersContent.appendChild(filtersRow);
      filtersCard.appendChild(filtersContent);
      root.appendChild(filtersCard);

      // ── Gameweek navigator ───────────────────────────────────────────────────
      // Clamp currentTab in case the tabs array shrank (e.g. filters applied)
      if (currentTab >= tabs.length) currentTab = Math.max(0, tabs.length - 1);

      const nav = document.createElement('div');
      nav.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap;';

      // Prev button
      const prevBtn = document.createElement('button');
      prevBtn.className = 'btn waves-effect waves-light blue';
      prevBtn.style.cssText = 'padding:0 12px;min-width:40px;flex-shrink:0;';
      prevBtn.innerHTML = '<i class="material-icons">chevron_left</i>';
      prevBtn.disabled = currentTab === 0;
      prevBtn.title = currentTab > 0 ? tabs[currentTab - 1].label : '';
      prevBtn.addEventListener('click', () => {
        if (currentTab > 0) { currentTab--; if (window.renderPage) window.renderPage(); }
      });

      // Dropdown — shows all gameweeks, locks indicated
      const gwSelect = document.createElement('select');
      gwSelect.className = 'browser-default';
      gwSelect.style.cssText = 'flex:1;min-width:160px;max-width:360px;height:36px;margin:0;';
      tabs.forEach((tab, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.selected = idx === currentTab;
        const lockMark = tab.isLocked ? ' 🔒' : '';
        opt.textContent = `${tab.label} (${tab.fixtures.length} fixtures)${lockMark}`;
        gwSelect.appendChild(opt);
      });
      gwSelect.addEventListener('change', (e: Event) => {
        currentTab = parseInt((e.target as HTMLSelectElement).value, 10);
        if (window.renderPage) window.renderPage();
      });

      // Next button
      const nextBtn = document.createElement('button');
      nextBtn.className = 'btn waves-effect waves-light blue';
      nextBtn.style.cssText = 'padding:0 12px;min-width:40px;flex-shrink:0;';
      nextBtn.innerHTML = '<i class="material-icons">chevron_right</i>';
      nextBtn.disabled = currentTab === tabs.length - 1;
      nextBtn.title = currentTab < tabs.length - 1 ? tabs[currentTab + 1].label : '';
      nextBtn.addEventListener('click', () => {
        if (currentTab < tabs.length - 1) { currentTab++; if (window.renderPage) window.renderPage(); }
      });

      // Summary label
      const summarySpan = document.createElement('span');
      summarySpan.className = 'grey-text';
      summarySpan.style.cssText = 'font-size:13px;flex-shrink:0;margin-left:4px;';
      summarySpan.innerHTML = `${currentTab + 1} of ${tabs.length}`;

      nav.appendChild(prevBtn);
      nav.appendChild(gwSelect);
      nav.appendChild(nextBtn);
      nav.appendChild(summarySpan);
      root.appendChild(nav);

      // ── Current gameweek content ─────────────────────────────────────────────
      const tabContent = document.createElement('div');

      const currentTabData = tabs[currentTab];
      const currentFixtures = currentTabData?.fixtures ?? [];

      if (currentTabData) {
        // Header row: gameweek label + lock badge if locked
        const gwHeader = document.createElement('div');
        gwHeader.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;';

        const dateHeader = document.createElement('h5');
        dateHeader.className = 'grey-text text-darken-2';
        dateHeader.style.margin = '0';
        dateHeader.textContent = currentTabData.label;
        gwHeader.appendChild(dateHeader);

        if (currentTabData.isLocked && currentTabData.unlocksAt) {
          const lockLabel = new Date(currentTabData.unlocksAt).toLocaleString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
          });
          const lockBadge = document.createElement('span');
          lockBadge.style.cssText = 'padding:4px 10px;border-radius:12px;font-size:12px;font-weight:bold;background:#9e9e9e;color:white;display:inline-flex;align-items:center;gap:4px;';
          lockBadge.innerHTML = `<i class="material-icons" style="font-size:14px;">lock</i> Opens ${lockLabel} UTC`;
          gwHeader.appendChild(lockBadge);
        }

        tabContent.appendChild(gwHeader);
      }

      if (currentFixtures.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'grey-text center-align';
        empty.style.marginTop = '40px';
        empty.textContent = 'No fixtures for this gameweek';
        tabContent.appendChild(empty);
      } else {
        const collection = document.createElement('div');
        collection.className = 'collection';
        currentFixtures.forEach(fixture => collection.appendChild(renderFixture(fixture, currentTabData.isLocked, currentTabData.unlocksAt)));
        tabContent.appendChild(collection);
      }

      root.appendChild(tabContent);
    };

    window.renderPage();
  });
})();
