# Football Data Setup

This guide explains how to seed mock football data (fixtures, standings, teams) into MongoDB and retrieve it via API endpoints.

## Database Collections

The seed script creates three collections in MongoDB:

### 1. `teams`
- 20 Premier League teams with IDs, names, codes, and logos
- Based on API-Football v3 team structure
- Example:
  ```json
  {
    "id": 50,
    "name": "Manchester City",
    "code": "MCI",
    "logo": "https://media.api-sports.io/football/teams/50.png"
  }
  ```

### 2. `fixtures`
- 20 fixtures with various statuses (past, live, upcoming)
- Includes full match details: teams, scores, venue, status
- Example:
  ```json
  {
    "fixture": {
      "id": 1000000,
      "date": "2026-01-24T15:00:00.000Z",
      "status": { "short": "FT", "long": "Match Finished" }
    },
    "league": { "id": 39, "name": "Premier League", "season": 2025 },
    "teams": {
      "home": { "id": 33, "name": "Manchester United" },
      "away": { "id": 40, "name": "Liverpool" }
    },
    "goals": { "home": 2, "away": 1 }
  }
  ```

### 3. `standings`
- Current Premier League table with 20 teams
- Includes points, goals, form, and position descriptions
- Example:
  ```json
  {
    "league": { "id": 39, "name": "Premier League", "season": 2025 },
    "standings": [[
      {
        "rank": 1,
        "team": { "id": 50, "name": "Manchester City" },
        "points": 60,
        "all": { "played": 23, "win": 18, "draw": 6, "lose": 1 }
      }
    ]]
  }
  ```

## Seeding the Database

### Prerequisites
1. Uncomment `MONGODB_URI` in `server/.env`
2. Ensure MongoDB connection string is correct

### Run the Seed Script
```bash
cd server
node seed_football_data.js
```

### Expected Output
```
🌱 Starting database seed...
✓ Connected to MongoDB
🗑️  Clearing existing data...
✓ Cleared existing data
📝 Inserting teams...
✓ Inserted 20 teams
📝 Inserting fixtures...
✓ Inserted 20 fixtures
📝 Inserting standings...
✓ Inserted standings for Premier League 2025
🔍 Creating indexes...
✓ Created indexes
════════════════════════════════════════
✅ Database seeded successfully!
════════════════════════════════════════
Teams:     20
Fixtures:  20
Standings: 20 teams
════════════════════════════════════════
```

## API Endpoints

Once seeded, you can retrieve the data via these endpoints:

### Get Fixtures
```
GET /api/football/fixtures
```

**Query Parameters:**
- `league` - Filter by league ID (e.g., `39` for Premier League)
- `season` - Filter by season (e.g., `2025`)
- `status` - Filter by status (`NS`, `1H`, `2H`, `FT`, etc.)
- `from` - Start date (ISO format)
- `to` - End date (ISO format)

**Examples:**
```bash
# Get all fixtures
curl http://localhost:4000/api/football/fixtures

# Get upcoming fixtures
curl http://localhost:4000/api/football/fixtures?status=NS

# Get finished fixtures
curl http://localhost:4000/api/football/fixtures?status=FT

# Get Premier League 2025 fixtures
curl http://localhost:4000/api/football/fixtures?league=39&season=2025
```

### Get Standings
```
GET /api/football/standings?league=39&season=2025
```

**Query Parameters:**
- `league` - **Required** - League ID (e.g., `39`)
- `season` - Season year (e.g., `2025`)

**Example:**
```bash
# Get Premier League standings
curl http://localhost:4000/api/football/standings?league=39&season=2025
```

### Get Teams
```
GET /api/football/teams
```

**Query Parameters:**
- `id` - Filter by team ID (e.g., `50` for Manchester City)
- `league` - Filter by league ID

**Examples:**
```bash
# Get all teams
curl http://localhost:4000/api/football/teams

# Get specific team
curl http://localhost:4000/api/football/teams?id=50
```

## Response Format

All endpoints return data in API-Football v3 format:

```json
{
  "get": "fixtures",
  "parameters": { "league": "39" },
  "errors": [],
  "results": 20,
  "response": [ /* array of data */ ]
}
```

## Integration with Frontend

Update your frontend code to call these endpoints instead of the mock API:

```javascript
// Example: Fetch upcoming fixtures
async function getUpcomingFixtures() {
  const response = await fetch(
    `${window.GGG_API_ORIGIN}/api/football/fixtures?league=39&season=2025&status=NS`
  );
  const data = await response.json();
  return data.response; // Array of fixtures
}

// Example: Fetch standings
async function getStandings() {
  const response = await fetch(
    `${window.GGG_API_ORIGIN}/api/football/standings?league=39&season=2025`
  );
  const data = await response.json();
  return data.response[0].standings[0]; // Array of team standings
}
```

## Notes

- The seed script generates realistic data with proper status distributions (past/live/upcoming matches)
- Indexes are created automatically for optimal query performance
- Re-running the seed script will clear and replace all existing data
- The data structure matches API-Football v3, making it easy to swap with real API calls later
- All dates are in ISO 8601 format with UTC timezone

## Next Steps

1. **Schedule Regular Updates**: Create a cron job to fetch fresh data from API-Football
2. **Update Logic**: Build endpoints to update specific fixtures/standings without full re-seed
3. **Caching Strategy**: Add Redis or in-memory caching for frequently accessed data
4. **Real API Integration**: Gradually replace mock data with real API-Football calls (respecting rate limits)
