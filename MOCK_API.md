# Mock Football API Documentation

A realistic mock implementation of the API-Football v3 API for local testing and development.

## Overview

The Mock Football API provides a browser-based simulation of the API-Football endpoints with realistic data, statuses, and response formats. Perfect for testing your football application without consuming your real API quota.

## Features

- ✅ Realistic fixture data (finished, live, upcoming)
- ✅ Premier League standings
- ✅ Team and league information
- ✅ Proper API-Football v3 response format
- ✅ Randomized scores and match statuses
- ✅ Session-based data persistence
- ✅ No external dependencies

## Installation

Include the mock API script in your HTML:

```html
<script src="assets/js/mock-api.js"></script>
```

## Available Methods

### 1. `getFixtures(params)`

Get football fixtures with various filters.

**Parameters:**
- `league` (number): League ID (default: 39 - Premier League)
- `season` (number): Season year (default: 2025)
- `date` (string): Filter by date (YYYY-MM-DD)
- `live` (string): Get live matches (use 'all')
- `last` (number): Get last N finished matches
- `next` (number): Get next N upcoming matches
- `team` (number): Filter by team ID
- `status` (string): Filter by status (NS, 1H, 2H, FT)

**Example:**
```javascript
// Get all fixtures
const response = await window.MockFootballAPI.getFixtures({
  league: 39,
  season: 2025
});

// Get live matches
const liveMatches = await window.MockFootballAPI.getFixtures({
  live: 'all'
});

// Get next 10 upcoming matches
const upcoming = await window.MockFootballAPI.getFixtures({
  next: 10,
  league: 39
});

// Get fixtures for a specific team
const teamFixtures = await window.MockFootballAPI.getFixtures({
  team: 33, // Manchester United
  league: 39
});
```

### 2. `getStandings(params)`

Get league standings/table.

**Parameters:**
- `league` (number): League ID (default: 39)
- `season` (number): Season year (default: 2025)

**Example:**
```javascript
const response = await window.MockFootballAPI.getStandings({
  league: 39,
  season: 2025
});

const standings = response.response[0].league.standings[0];
standings.forEach(team => {
  console.log(`${team.rank}. ${team.team.name} - ${team.points} pts`);
});
```

### 3. `getTeams(params)`

Get list of teams.

**Example:**
```javascript
const response = await window.MockFootballAPI.getTeams();
console.log(`Found ${response.results} teams`);
```

### 4. `getLeagues(params)`

Get list of leagues.

**Example:**
```javascript
const response = await window.MockFootballAPI.getLeagues();
console.log('Available leagues:', response.response);
```

## Response Format

All methods return a Promise that resolves to an API-Football v3 compatible response:

```javascript
{
  get: "fixtures",
  parameters: { league: 39, season: 2025 },
  errors: [],
  results: 20,
  paging: {
    current: 1,
    total: 1
  },
  response: [
    // Array of fixture/standing/team objects
  ]
}
```

## Fixture Object Structure

```javascript
{
  fixture: {
    id: 900001,
    referee: "M. Oliver",
    timezone: "UTC",
    date: "2026-01-29T15:00:00.000Z",
    timestamp: 1738166400,
    periods: {
      first: 1738166400,
      second: null
    },
    venue: {
      id: 556,
      name: "Old Trafford",
      city: "Manchester"
    },
    status: {
      long: "First Half",
      short: "1H",
      elapsed: 23
    }
  },
  league: {
    id: 39,
    name: "Premier League",
    country: "England",
    logo: "https://media.api-sports.io/football/leagues/39.png",
    flag: "https://media.api-sports.io/flags/england.svg",
    season: 2025,
    round: "Regular Season - 1"
  },
  teams: {
    home: {
      id: 33,
      name: "Manchester United",
      logo: "https://media.api-sports.io/football/teams/33.png",
      winner: null
    },
    away: {
      id: 40,
      name: "Liverpool",
      logo: "https://media.api-sports.io/football/teams/40.png",
      winner: null
    }
  },
  goals: {
    home: 1,
    away: 1
  },
  score: {
    halftime: { home: null, away: null },
    fulltime: { home: null, away: null },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null }
  }
}
```

## Match Statuses

The mock API generates fixtures with the following statuses:

- **NS** (Not Started): ~50% of fixtures - Upcoming matches
- **1H** (First Half): ~5% of fixtures - Live, first half
- **2H** (Second Half): ~5% of fixtures - Live, second half
- **FT** (Full Time): ~40% of fixtures - Finished matches

## Data Persistence

Fixture data is stored in `sessionStorage` to maintain consistency across page loads within the same session. Clear your browser's session storage to generate new random fixtures.

## Testing Page

Visit [mock-api-test.html](mock-api-test.html) to see the Mock API in action with:
- Live fixtures with auto-refresh
- Upcoming fixtures
- Finished fixtures
- League standings table

## Example Usage

See [mock-api-example.js](assets/js/mock-api-example.js) for comprehensive usage examples including:
- Filtering by date, team, status
- Getting live matches
- Fetching standings
- Working with fixture data

## Teams Included

The mock includes 20 Premier League teams:
- Manchester United, Manchester City
- Liverpool, Arsenal, Chelsea, Tottenham
- Newcastle, Brighton, Aston Villa
- And more...

## Leagues Included

- **39**: Premier League (England)
- **2**: UEFA Champions League
- **48**: FA Cup (England)

## Tips

1. **Check if API is loaded:**
   ```javascript
   if (window.MockFootballAPI) {
     // API is ready
   }
   ```

2. **Use with config.js:**
   ```javascript
   if (window.GGG_USE_MOCK_API) {
     // Use MockFootballAPI
   } else {
     // Use real API
   }
   ```

3. **Error handling:**
   ```javascript
   try {
     const data = await window.MockFootballAPI.getFixtures({ live: 'all' });
   } catch (error) {
     console.error('API Error:', error);
   }
   ```

## Differences from Real API

- Simplified pagination (always returns page 1/1)
- Limited team/league selection
- Randomized scores and statuses
- No historical data beyond 7 days
- No detailed player statistics
- No odds or predictions

## Future Enhancements

Potential additions:
- Player statistics per match
- Match events (goals, cards, subs)
- Team lineups
- H2H data
- More leagues and teams
- Configurable data generation

## License

Part of the Goals Goals Goals project.
