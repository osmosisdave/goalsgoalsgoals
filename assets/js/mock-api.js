// Mock API-Football Fixtures API for testing
// Provides realistic fixture data matching the API-Football v3 structure

(function() {
  'use strict';

  // Team data
  const teams = [
    { id: 33, name: 'Manchester United', logo: 'https://media.api-sports.io/football/teams/33.png', code: 'MUN' },
    { id: 34, name: 'Newcastle United', logo: 'https://media.api-sports.io/football/teams/34.png', code: 'NEW' },
    { id: 40, name: 'Liverpool', logo: 'https://media.api-sports.io/football/teams/40.png', code: 'LIV' },
    { id: 42, name: 'Arsenal', logo: 'https://media.api-sports.io/football/teams/42.png', code: 'ARS' },
    { id: 47, name: 'Tottenham', logo: 'https://media.api-sports.io/football/teams/47.png', code: 'TOT' },
    { id: 49, name: 'Chelsea', logo: 'https://media.api-sports.io/football/teams/49.png', code: 'CHE' },
    { id: 50, name: 'Manchester City', logo: 'https://media.api-sports.io/football/teams/50.png', code: 'MCI' },
    { id: 51, name: 'Brighton', logo: 'https://media.api-sports.io/football/teams/51.png', code: 'BHA' },
    { id: 55, name: 'Brentford', logo: 'https://media.api-sports.io/football/teams/55.png', code: 'BRE' },
    { id: 65, name: 'Nottingham Forest', logo: 'https://media.api-sports.io/football/teams/65.png', code: 'NFO' },
    { id: 35, name: 'Bournemouth', logo: 'https://media.api-sports.io/football/teams/35.png', code: 'BOU' },
    { id: 45, name: 'Everton', logo: 'https://media.api-sports.io/football/teams/45.png', code: 'EVE' },
    { id: 39, name: 'Wolves', logo: 'https://media.api-sports.io/football/teams/39.png', code: 'WOL' },
    { id: 48, name: 'West Ham', logo: 'https://media.api-sports.io/football/teams/48.png', code: 'WHU' },
    { id: 52, name: 'Crystal Palace', logo: 'https://media.api-sports.io/football/teams/52.png', code: 'CRY' },
    { id: 36, name: 'Fulham', logo: 'https://media.api-sports.io/football/teams/36.png', code: 'FUL' },
    { id: 66, name: 'Aston Villa', logo: 'https://media.api-sports.io/football/teams/66.png', code: 'AVL' },
    { id: 41, name: 'Southampton', logo: 'https://media.api-sports.io/football/teams/41.png', code: 'SOU' },
    { id: 46, name: 'Leicester', logo: 'https://media.api-sports.io/football/teams/46.png', code: 'LEI' },
    { id: 56, name: 'Ipswich Town', logo: 'https://media.api-sports.io/football/teams/56.png', code: 'IPS' }
  ];

  // League data
  const leagues = {
    39: { id: 39, name: 'Premier League', country: 'England', logo: 'https://media.api-sports.io/football/leagues/39.png' },
    2: { id: 2, name: 'UEFA Champions League', country: 'World', logo: 'https://media.api-sports.io/football/leagues/2.png' },
    48: { id: 48, name: 'FA Cup', country: 'England', logo: 'https://media.api-sports.io/football/leagues/48.png' }
  };

  // Venue data
  const venues = {
    556: { id: 556, name: 'Old Trafford', city: 'Manchester' },
    504: { id: 504, name: 'Anfield', city: 'Liverpool' },
    494: { id: 494, name: 'Emirates Stadium', city: 'London' },
    550: { id: 550, name: 'Etihad Stadium', city: 'Manchester' },
    492: { id: 492, name: 'Stamford Bridge', city: 'London' }
  };

  // Helper to generate random score
  function randomScore() {
    const scores = [[0,0], [1,0], [0,1], [1,1], [2,0], [0,2], [2,1], [1,2], [2,2], [3,0], [0,3], [3,1], [1,3], [3,2], [2,3], [4,0], [4,1], [3,3]];
    return scores[Math.floor(Math.random() * scores.length)];
  }

  // Helper to get random team
  function randomTeam(exclude = null) {
    let team;
    do {
      team = teams[Math.floor(Math.random() * teams.length)];
    } while (exclude && team.id === exclude.id);
    return team;
  }

  // Generate mock fixtures
  function generateFixtures(options = {}) {
    const {
      count = 20,
      league = 39,
      season = 2025,
      includeFinished = true,
      includeLive = true,
      includeUpcoming = true
    } = options;

    const fixtures = [];
    const now = new Date();
    const leagueData = leagues[league] || leagues[39];

    for (let i = 0; i < count; i++) {
      const homeTeam = randomTeam();
      const awayTeam = randomTeam(homeTeam);
      const venue = venues[Object.keys(venues)[Math.floor(Math.random() * Object.keys(venues).length)]];
      
      // Distribute fixtures across different statuses
      let status, date, elapsed, score;
      const rand = Math.random();
      
      if (includeFinished && rand < 0.4) {
        // Finished match (40%)
        status = { long: 'Match Finished', short: 'FT', elapsed: 90 };
        date = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Last 7 days
        score = randomScore();
        elapsed = 90;
      } else if (includeLive && rand < 0.5) {
        // Live match (10%)
        const half = Math.random() < 0.5 ? '1H' : '2H';
        elapsed = half === '1H' ? Math.floor(Math.random() * 45) : 45 + Math.floor(Math.random() * 45);
        status = { 
          long: half === '1H' ? 'First Half' : 'Second Half', 
          short: half, 
          elapsed 
        };
        date = new Date(now.getTime() - elapsed * 60 * 1000);
        score = randomScore();
      } else if (includeUpcoming) {
        // Upcoming match (50%)
        status = { long: 'Not Started', short: 'NS', elapsed: null };
        date = new Date(now.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000); // Next 14 days
        score = [null, null];
        elapsed = null;
      }

      const fixture = {
        fixture: {
          id: 900000 + i,
          referee: randomReferee(),
          timezone: 'UTC',
          date: date.toISOString(),
          timestamp: Math.floor(date.getTime() / 1000),
          periods: {
            first: elapsed !== null && elapsed > 0 ? Math.floor(date.getTime() / 1000) : null,
            second: elapsed !== null && elapsed > 45 ? Math.floor(date.getTime() / 1000) + 2700 : null
          },
          venue: venue,
          status: status
        },
        league: {
          id: leagueData.id,
          name: leagueData.name,
          country: leagueData.country,
          logo: leagueData.logo,
          flag: `https://media.api-sports.io/flags/${leagueData.country.toLowerCase().replace(' ', '-')}.svg`,
          season: season,
          round: `Regular Season - ${Math.floor(i / 10) + 1}`
        },
        teams: {
          home: {
            id: homeTeam.id,
            name: homeTeam.name,
            logo: homeTeam.logo,
            winner: score[0] !== null && score[0] > score[1] ? true : (score[0] === score[1] ? null : false)
          },
          away: {
            id: awayTeam.id,
            name: awayTeam.name,
            logo: awayTeam.logo,
            winner: score[1] !== null && score[1] > score[0] ? true : (score[0] === score[1] ? null : false)
          }
        },
        goals: {
          home: score[0],
          away: score[1]
        },
        score: {
          halftime: {
            home: elapsed > 45 && score[0] !== null ? Math.floor(score[0] * 0.6) : null,
            away: elapsed > 45 && score[1] !== null ? Math.floor(score[1] * 0.6) : null
          },
          fulltime: {
            home: status.short === 'FT' ? score[0] : null,
            away: status.short === 'FT' ? score[1] : null
          },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null }
        }
      };

      fixtures.push(fixture);
    }

    return fixtures;
  }

  function randomReferee() {
    const referees = ['M. Oliver', 'A. Taylor', 'P. Tierney', 'S. Attwell', 'C. Kavanagh', 'D. Coote', 'J. Brooks'];
    return referees[Math.floor(Math.random() * referees.length)];
  }

  // Mock API response wrapper
  function createApiResponse(data, params = {}) {
    return {
      get: 'fixtures',
      parameters: params,
      errors: [],
      results: data.length,
      paging: {
        current: 1,
        total: 1
      },
      response: data
    };
  }

  // Mock API endpoints
  window.MockFootballAPI = {
    // Get fixtures with filters
    getFixtures: function(params = {}) {
      const {
        league = 39,
        season = 2025,
        date = null,
        live = null,
        last = null,
        next = null,
        team = null,
        status = null
      } = params;

      let fixtures = generateFixtures({ 
        count: 50, 
        league, 
        season,
        includeFinished: !status || status.includes('FT'),
        includeLive: !status || status.includes('1H') || status.includes('2H'),
        includeUpcoming: !status || status.includes('NS')
      });

      // Filter by live
      if (live === 'all') {
        fixtures = fixtures.filter(f => ['1H', '2H'].includes(f.fixture.status.short));
      }

      // Filter by date
      if (date) {
        const filterDate = new Date(date);
        fixtures = fixtures.filter(f => {
          const fixtureDate = new Date(f.fixture.date);
          return fixtureDate.toDateString() === filterDate.toDateString();
        });
      }

      // Filter by team
      if (team) {
        fixtures = fixtures.filter(f => 
          f.teams.home.id === parseInt(team) || f.teams.away.id === parseInt(team)
        );
      }

      // Filter by status
      if (status) {
        const statuses = status.split('-');
        fixtures = fixtures.filter(f => statuses.includes(f.fixture.status.short));
      }

      // Sort by date
      fixtures.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

      // Handle last/next
      if (last) {
        const now = new Date();
        fixtures = fixtures
          .filter(f => new Date(f.fixture.date) < now)
          .slice(-parseInt(last));
      } else if (next) {
        const now = new Date();
        fixtures = fixtures
          .filter(f => new Date(f.fixture.date) > now)
          .slice(0, parseInt(next));
      }

      return Promise.resolve(createApiResponse(fixtures, params));
    },

    // Get standings
    getStandings: function(params = {}) {
      const { league = 39, season = 2025 } = params;
      const leagueData = leagues[league] || leagues[39];
      
      // Generate mock standings
      const standings = teams.slice(0, 20).map((team, idx) => ({
        rank: idx + 1,
        team: {
          id: team.id,
          name: team.name,
          logo: team.logo
        },
        points: 90 - (idx * 4) - Math.floor(Math.random() * 5),
        goalsDiff: 40 - (idx * 3) - Math.floor(Math.random() * 5),
        group: 'Premier League',
        form: 'WWDLW',
        status: idx < 4 ? 'Champions League' : (idx < 6 ? 'Europa League' : (idx > 17 ? 'Relegation' : null)),
        description: idx < 4 ? 'Promotion - Champions League (Group Stage)' : null,
        all: {
          played: 38,
          win: 25 - idx,
          draw: 8,
          lose: 5 + idx,
          goals: { for: 80 - (idx * 2), against: 40 + idx }
        },
        home: {
          played: 19,
          win: 13 - Math.floor(idx / 2),
          draw: 4,
          lose: 2 + Math.floor(idx / 3),
          goals: { for: 45 - idx, against: 20 + Math.floor(idx / 2) }
        },
        away: {
          played: 19,
          win: 12 - Math.floor(idx / 2),
          draw: 4,
          lose: 3 + Math.floor(idx / 3),
          goals: { for: 35 - idx, against: 20 + Math.floor(idx / 2) }
        },
        update: new Date().toISOString()
      }));

      return Promise.resolve({
        get: 'standings',
        parameters: params,
        errors: [],
        results: 1,
        paging: { current: 1, total: 1 },
        response: [{
          league: {
            id: leagueData.id,
            name: leagueData.name,
            country: leagueData.country,
            logo: leagueData.logo,
            flag: null,
            season: season,
            standings: [standings]
          }
        }]
      });
    },

    // Get teams
    getTeams: function(params = {}) {
      return Promise.resolve({
        get: 'teams',
        parameters: params,
        errors: [],
        results: teams.length,
        paging: { current: 1, total: 1 },
        response: teams.map(t => ({
          team: { id: t.id, name: t.name, code: t.code, logo: t.logo, country: 'England', founded: 1878, national: false },
          venue: { id: 556, name: 'Stadium', address: 'Address', city: 'City', capacity: 75000, surface: 'grass', image: null }
        }))
      });
    },

    // Get leagues
    getLeagues: function(params = {}) {
      return Promise.resolve({
        get: 'leagues',
        parameters: params,
        errors: [],
        results: Object.keys(leagues).length,
        paging: { current: 1, total: 1 },
        response: Object.values(leagues).map(l => ({
          league: l,
          country: { name: l.country, code: l.country === 'England' ? 'GB' : null, flag: null },
          seasons: [{ year: 2025, start: '2025-08-01', end: '2026-05-31', current: true }]
        }))
      });
    }
  };

  // Store fixtures for consistent data across page loads
  if (!window.sessionStorage.getItem('mockFixtures')) {
    const initialFixtures = generateFixtures({ count: 50 });
    window.sessionStorage.setItem('mockFixtures', JSON.stringify(initialFixtures));
  }

  console.log('Mock Football API initialized');
  console.log('Available methods:', Object.keys(window.MockFootballAPI));
})();
