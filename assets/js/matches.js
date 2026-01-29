// Matches - Fetch fixtures from database
(function () {
  const API_BASE_URL = (window && window.GGG_API_ORIGIN) || 'http://localhost:4000';
  let allFixtures = [];
  let matchSelections = {};
  let currentUser = null;
  let selectedLeague = 'all';
  let selectedTeam = 'all';

  function getAuthToken() {
    return sessionStorage.getItem('ggg_token') || sessionStorage.getItem('token') || 
           localStorage.getItem('ggg_token') || localStorage.getItem('token') || null;
  }

  async function fetchCurrentUser() {
    const token = getAuthToken();
    if (!token) return null;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        return data.username || data.sub || null;
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
    return null;
  }

  async function fetchSelections() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/matches/selections`);
      if (response.ok) {
        const data = await response.json();
        matchSelections = {};
        data.selections.forEach(s => {
          matchSelections[s.fixtureId] = s.username;
        });
      }
    } catch (error) {
      console.error('Error fetching selections:', error);
    }
  }

  async function selectMatch(fixtureId) {
    const token = getAuthToken();
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
      
      const data = await response.json();
      
      if (response.ok) {
        const message = data.replaced 
          ? '✓ Match selection updated!' 
          : '✓ Match selected!';
        M.toast({ html: message, classes: 'green', displayLength: 3000 });
        await fetchSelections();
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

  async function unselectMatch(fixtureId) {
    const token = getAuthToken();
    if (!token) return false;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/matches/${fixtureId}/select`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        M.toast({ html: 'Match unselected', classes: 'grey' });
        await fetchSelections();
        return true;
      }
    } catch (error) {
      console.error('Error unselecting match:', error);
    }
    return false;
  }

  async function fetchFixtures() {
    try {
      console.log('Fetching fixtures from:', `${API_BASE_URL}/api/football/fixtures?league=39&season=2025`);
      const response = await fetch(`${API_BASE_URL}/api/football/fixtures?league=39&season=2025`);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Received fixtures:', data.results);
      return data.response || [];
    } catch (error) {
      console.error('Error fetching fixtures:', error);
      // Show error in UI
      const root = document.getElementById('matches-root');
      if (root) {
        root.innerHTML = `
          <div class="card red lighten-4">
            <div class="card-content">
              <span class="card-title red-text">Error Loading Fixtures</span>
              <p><strong>Error:</strong> ${error.message}</p>
              <p><strong>API URL:</strong> ${API_BASE_URL}/api/football/fixtures</p>
              <p class="grey-text">Check the browser console for more details. Make sure the backend server is running on port 4000.</p>
            </div>
          </div>
        `;
      }
      return [];
    }
  }

  function getStatusDisplay(status) {
    const statusMap = {
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
    return statusMap[status] || status;
  }

  function getStatusColor(status) {
    if (status === 'FT' || status === 'AET' || status === 'PEN') return '#4caf50'; // green
    if (status === '1H' || status === '2H' || status === 'HT') return '#ff9800'; // orange (live)
    if (status === 'NS') return '#2196f3'; // blue
    return '#9e9e9e'; // grey
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = d.toDateString() === today.toDateString();
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    
    if (isToday) {
      return `Today, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (isTomorrow) {
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

  function renderFixture(fixture) {
    const item = document.createElement('div');
    item.className = 'collection-item';
    
    const fixtureId = fixture.fixture.id;
    const status = fixture.fixture.status.short;
    const isLive = ['1H', '2H', 'HT', 'ET'].includes(status);
    const isFinished = ['FT', 'AET', 'PEN'].includes(status);
    const isUpcoming = status === 'NS';
    const selectedBy = matchSelections[fixtureId];
    const isSelectedByMe = selectedBy === currentUser;
    
    // Add styling for selected matches
    if (selectedBy) {
      item.style.backgroundColor = isSelectedByMe ? '#e8f5e9' : '#fff3e0';
      item.style.borderLeft = isSelectedByMe ? '4px solid #4caf50' : '4px solid #ff9800';
    }
    
    // Header: Competition + Round
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '8px';
    header.style.fontSize = '12px';
    header.style.color = '#666';
    
    const comp = document.createElement('span');
    comp.textContent = `${fixture.league.name} - ${fixture.league.round}`;
    
    const statusBadge = document.createElement('span');
    statusBadge.textContent = getStatusDisplay(status);
    statusBadge.style.padding = '2px 8px';
    statusBadge.style.borderRadius = '4px';
    statusBadge.style.backgroundColor = getStatusColor(status);
    statusBadge.style.color = 'white';
    statusBadge.style.fontSize = '11px';
    statusBadge.style.fontWeight = 'bold';
    if (isLive) {
      statusBadge.style.animation = 'pulse 2s infinite';
    }
    
    header.appendChild(comp);
    header.appendChild(statusBadge);
    
    // Main: Teams + Score
    const main = document.createElement('div');
    main.style.display = 'flex';
    main.style.justifyContent = 'space-between';
    main.style.alignItems = 'center';
    main.style.marginBottom = '8px';
    
    const teams = document.createElement('div');
    teams.style.flex = '1';
    
    const homeLine = document.createElement('div');
    homeLine.style.display = 'flex';
    homeLine.style.alignItems = 'center';
    homeLine.style.marginBottom = '4px';
    const homeTeam = document.createElement('strong');
    homeTeam.textContent = fixture.teams.home.name;
    homeTeam.style.fontSize = '16px';
    if (fixture.teams.home.winner) homeTeam.style.color = '#4caf50';
    homeLine.appendChild(homeTeam);
    
    const awayLine = document.createElement('div');
    awayLine.style.display = 'flex';
    awayLine.style.alignItems = 'center';
    const awayTeam = document.createElement('strong');
    awayTeam.textContent = fixture.teams.away.name;
    awayTeam.style.fontSize = '16px';
    if (fixture.teams.away.winner) awayTeam.style.color = '#4caf50';
    awayLine.appendChild(awayTeam);
    
    teams.appendChild(homeLine);
    teams.appendChild(awayLine);
    
    const score = document.createElement('div');
    score.style.textAlign = 'center';
    score.style.minWidth = '60px';
    
    if (isUpcoming) {
      score.innerHTML = `<div style="font-size: 24px; color: #999;">-</div>`;
    } else {
      const homeScore = fixture.goals.home !== null ? fixture.goals.home : '-';
      const awayScore = fixture.goals.away !== null ? fixture.goals.away : '-';
      score.innerHTML = `
        <div style="font-size: 24px; font-weight: bold;">${homeScore}</div>
        <div style="font-size: 24px; font-weight: bold;">${awayScore}</div>
      `;
    }
    
    main.appendChild(teams);
    main.appendChild(score);
    
    // Footer: Date/Time + Venue + Selection Info
    const footer = document.createElement('div');
    footer.style.fontSize = '12px';
    footer.style.color = '#666';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.alignItems = 'center';
    footer.style.flexWrap = 'wrap';
    footer.style.gap = '8px';
    
    const datetimeVenue = document.createElement('div');
    datetimeVenue.style.display = 'flex';
    datetimeVenue.style.gap = '16px';
    
    const datetime = document.createElement('span');
    datetime.innerHTML = `<i class="material-icons" style="font-size: 12px; vertical-align: middle;">event</i> ${fmtDate(fixture.fixture.date)}`;
    
    const venue = document.createElement('span');
    if (fixture.fixture.venue && fixture.fixture.venue.name) {
      venue.innerHTML = `<i class="material-icons" style="font-size: 12px; vertical-align: middle;">place</i> ${fixture.fixture.venue.name}`;
    }
    
    datetimeVenue.appendChild(datetime);
    datetimeVenue.appendChild(venue);
    
    // Selection button/info for upcoming matches
    const selectionArea = document.createElement('div');
    if (isUpcoming) {
      if (selectedBy) {
        // Show who selected it
        const badge = document.createElement('span');
        badge.style.padding = '4px 12px';
        badge.style.borderRadius = '12px';
        badge.style.fontSize = '11px';
        badge.style.fontWeight = 'bold';
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '4px';
        
        if (isSelectedByMe) {
          badge.style.backgroundColor = '#4caf50';
          badge.style.color = 'white';
          badge.innerHTML = `<i class="material-icons" style="font-size: 14px;">check_circle</i> Your Pick`;
          
          // Add remove button
          const removeBtn = document.createElement('button');
          removeBtn.className = 'btn-small red lighten-1 waves-effect';
          removeBtn.style.marginLeft = '8px';
          removeBtn.style.padding = '0 8px';
          removeBtn.style.height = '24px';
          removeBtn.style.lineHeight = '24px';
          removeBtn.innerHTML = '<i class="material-icons" style="font-size: 14px;">close</i>';
          removeBtn.onclick = async (e) => {
            e.stopPropagation();
            removeBtn.disabled = true;
            if (await unselectMatch(fixtureId)) {
              window.renderPage();
            } else {
              removeBtn.disabled = false;
            }
          };
          selectionArea.appendChild(badge);
          selectionArea.appendChild(removeBtn);
        } else {
          badge.style.backgroundColor = '#ff9800';
          badge.style.color = 'white';
          badge.innerHTML = `<i class="material-icons" style="font-size: 14px;">person</i> ${selectedBy}`;
          selectionArea.appendChild(badge);
        }
      } else if (currentUser) {
        // Show select button
        const selectBtn = document.createElement('button');
        selectBtn.className = 'btn-small blue waves-effect';
        selectBtn.style.padding = '0 12px';
        selectBtn.style.height = '28px';
        selectBtn.style.lineHeight = '28px';
        selectBtn.innerHTML = '<i class="material-icons left" style="font-size: 16px; line-height: 28px;">add_circle</i>Select';
        selectBtn.onclick = async (e) => {
          e.stopPropagation();
          
          // Check if user already has a selection
          const currentSelection = Object.keys(matchSelections).find(
            fid => matchSelections[fid] === currentUser && parseInt(fid) !== fixtureId
          );
          
          if (currentSelection) {
            // Find the currently selected fixture details
            const selectedFixture = allFixtures.find(f => f.fixture.id === parseInt(currentSelection));
            if (selectedFixture) {
              const currentMatch = `${selectedFixture.teams.home.name} vs ${selectedFixture.teams.away.name}`;
              const newMatch = `${fixture.teams.home.name} vs ${fixture.teams.away.name}`;
              
              const confirmed = confirm(
                `You have already selected:\n${currentMatch}\n\n` +
                `Do you want to change your selection to:\n${newMatch}?`
              );
              
              if (!confirmed) {
                return; // User cancelled
              }
            }
          }
          
          selectBtn.disabled = true;
          selectBtn.innerHTML = '<i class="material-icons left" style="font-size: 16px; line-height: 28px;">hourglass_empty</i>Selecting...';
          if (await selectMatch(fixtureId)) {
            window.renderPage();
          } else {
            selectBtn.disabled = false;
            selectBtn.innerHTML = '<i class="material-icons left" style="font-size: 16px; line-height: 28px;">add_circle</i>Select';
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

  // Pagination: group fixtures by status (Upcoming, Finished)
  document.addEventListener('DOMContentLoaded', async function () {
    const root = document.getElementById('matches-root');
    if (!root) return;

    // Show loading state
    root.innerHTML = '<div class="progress"><div class="indeterminate"></div></div>';

    // Fetch current user and selections in parallel
    [currentUser, allFixtures] = await Promise.all([
      fetchCurrentUser(),
      fetchFixtures()
    ]);
    
    await fetchSelections();

    if (allFixtures.length === 0) {
      root.innerHTML = '<p class="grey-text">No fixtures available. Make sure the database is seeded.</p>';
      return;
    }

    let currentTab = 0; // Default to upcoming

    window.renderPage = function() {
      // Apply filters
      let filteredFixtures = allFixtures;
      
      if (selectedLeague !== 'all') {
        filteredFixtures = filteredFixtures.filter(f => f.league.id === parseInt(selectedLeague));
      }
      
      if (selectedTeam !== 'all') {
        filteredFixtures = filteredFixtures.filter(f => 
          f.teams.home.id === parseInt(selectedTeam) || f.teams.away.id === parseInt(selectedTeam)
        );
      }
      
      // Re-group fixtures by status each time we render (in case selections changed)
      const upcomingFixtures = filteredFixtures.filter(f => f.fixture.status.short === 'NS');
      const finishedFixtures = filteredFixtures.filter(f => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short));

      const tabs = [
        { label: 'Upcoming', fixtures: upcomingFixtures, icon: 'schedule' },
        { label: 'Finished', fixtures: finishedFixtures, icon: 'check_circle' }
      ];

      root.innerHTML = '';
      
      // Filters section
      const filtersCard = document.createElement('div');
      filtersCard.className = 'card';
      filtersCard.style.marginBottom = '20px';
      
      const filtersContent = document.createElement('div');
      filtersContent.className = 'card-content';
      filtersContent.style.padding = '16px';
      
      const filtersTitle = document.createElement('span');
      filtersTitle.className = 'card-title';
      filtersTitle.style.fontSize = '18px';
      filtersTitle.style.marginBottom = '12px';
      filtersTitle.style.display = 'block';
      filtersTitle.innerHTML = '<i class="material-icons left">filter_list</i>Filters';
      
      const filtersRow = document.createElement('div');
      filtersRow.className = 'row';
      filtersRow.style.marginBottom = '0';
      
      // League filter
      const leagueCol = document.createElement('div');
      leagueCol.className = 'col s12 m6';
      
      const leagueLabel = document.createElement('label');
      leagueLabel.textContent = 'League';
      leagueLabel.style.fontSize = '12px';
      leagueLabel.style.color = '#666';
      
      const leagueSelect = document.createElement('select');
      leagueSelect.className = 'browser-default';
      leagueSelect.style.marginTop = '4px';
      
      const leagues = [...new Set(allFixtures.map(f => JSON.stringify({ id: f.league.id, name: f.league.name })))].map(s => JSON.parse(s));
      
      leagueSelect.innerHTML = '<option value="all">All Leagues</option>' +
        leagues.map(l => `<option value="${l.id}" ${selectedLeague == l.id ? 'selected' : ''}>${l.name}</option>`).join('');
      
      leagueSelect.addEventListener('change', (e) => {
        selectedLeague = e.target.value;
        selectedTeam = 'all'; // Reset team filter when league changes
        window.renderPage();
      });
      
      leagueCol.appendChild(leagueLabel);
      leagueCol.appendChild(leagueSelect);
      
      // Team filter
      const teamCol = document.createElement('div');
      teamCol.className = 'col s12 m6';
      
      const teamLabel = document.createElement('label');
      teamLabel.textContent = 'Team';
      teamLabel.style.fontSize = '12px';
      teamLabel.style.color = '#666';
      
      const teamSelect = document.createElement('select');
      teamSelect.className = 'browser-default';
      teamSelect.style.marginTop = '4px';
      
      // Get teams from filtered fixtures
      let teamsForFilter = allFixtures;
      if (selectedLeague !== 'all') {
        teamsForFilter = teamsForFilter.filter(f => f.league.id === parseInt(selectedLeague));
      }
      
      const allTeamsSet = new Set();
      teamsForFilter.forEach(f => {
        allTeamsSet.add(JSON.stringify({ id: f.teams.home.id, name: f.teams.home.name }));
        allTeamsSet.add(JSON.stringify({ id: f.teams.away.id, name: f.teams.away.name }));
      });
      const teams = [...allTeamsSet].map(s => JSON.parse(s)).sort((a, b) => a.name.localeCompare(b.name));
      
      teamSelect.innerHTML = '<option value="all">All Teams</option>' +
        teams.map(t => `<option value="${t.id}" ${selectedTeam == t.id ? 'selected' : ''}>${t.name}</option>`).join('');
      
      teamSelect.addEventListener('change', (e) => {
        selectedTeam = e.target.value;
        window.renderPage();
      });
      
      teamCol.appendChild(teamLabel);
      teamCol.appendChild(teamSelect);
      
      filtersRow.appendChild(leagueCol);
      filtersRow.appendChild(teamCol);
      
      filtersContent.appendChild(filtersTitle);
      filtersContent.appendChild(filtersRow);
      filtersCard.appendChild(filtersContent);
      root.appendChild(filtersCard);

      // Tab navigation
      const tabNav = document.createElement('ul');
      tabNav.className = 'tabs';
      tabs.forEach((tab, idx) => {
        const li = document.createElement('li');
        li.className = 'tab';
        const a = document.createElement('a');
        a.href = '#';
        a.className = idx === currentTab ? 'active' : '';
        a.innerHTML = `<i class="material-icons left" style="font-size: 18px;">${tab.icon}</i>${tab.label} (${tab.fixtures.length})`;
        a.addEventListener('click', (e) => {
          e.preventDefault();
          currentTab = idx;
          window.renderPage();
        });
        li.appendChild(a);
        tabNav.appendChild(li);
      });
      root.appendChild(tabNav);

      // Tab content
      const tabContent = document.createElement('div');
      tabContent.style.marginTop = '20px';

      const currentFixtures = tabs[currentTab].fixtures;

      if (currentFixtures.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'grey-text center-align';
        empty.style.marginTop = '40px';
        empty.textContent = `No ${tabs[currentTab].label.toLowerCase()} fixtures`;
        tabContent.appendChild(empty);
      } else {
        const collection = document.createElement('div');
        collection.className = 'collection';
        
        currentFixtures.forEach(fixture => {
          collection.appendChild(renderFixture(fixture));
        });

        tabContent.appendChild(collection);
      }

      root.appendChild(tabContent);

      // Initialize Materialize tabs
      M.Tabs.init(tabNav);
    };

    window.renderPage();
  });
})();
