# Sync Fixtures from API-Football

This feature allows admin users to fetch real fixture data from API-Football and sync it to the MongoDB database.

## Setup

### 1. Get API-Football Credentials

1. Sign up at [API-Football on RapidAPI](https://rapidapi.com/api-sports/api/api-football)
2. Subscribe to a plan (free tier available)
3. Get your API key from the RapidAPI dashboard

### 2. Configure Environment Variables

Add these variables to your `server/.env` file:

```bash
API_FOOTBALL_KEY=your_rapidapi_key_here
API_FOOTBALL_HOST=v3.football.api-sports.io
```

### 3. Build TypeScript Code

The fixture syncing functionality is written in TypeScript and needs to be compiled:

```bash
cd server
npm run build:ts
```

This will compile the TypeScript files from `src/` to `dist/`.

### 4. Start the Server

```bash
npm start
```

## Usage

### From Admin UI

1. Navigate to the admin page: http://localhost:8000/admin.html
2. Login with admin credentials
3. Scroll to the "Sync Fixtures from API-Football" card
4. Click the **"Sync Fixtures"** button

The UI will show:
- Progress indicator while syncing
- Detailed results when complete:
  - Total fixtures fetched
  - New fixtures added
  - Existing fixtures updated
  - Number of leagues synced
  - API calls used
  - Sync duration

### Programmatically

You can also trigger the sync via API:

```bash
curl -X POST http://localhost:4000/api/admin/sync-fixtures \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "season": 2025,
    "dateRange": 20
  }'
```

**Parameters:**
- `season` (number): The football season year (e.g., 2025)
- `dateRange` (number): Number of days before/after today to fetch fixtures for

## Configuration

### Leagues

By default, the system syncs fixtures for these leagues:
- Premier League (England)
- La Liga (Spain)
- Bundesliga (Germany)
- Serie A (Italy)
- Ligue 1 (France)

To modify the leagues, edit `server/src/fixture-fetcher.ts` and update the `LEAGUES` array.

### Date Range

The default date range is 20 days before and after today (40 days total). You can adjust this in the UI or via API parameter.

## Rate Limiting

The system integrates with your existing API rate limiter:
- Checks rate limits before making API calls
- Records each API call
- Prevents exceeding your quota
- Shows clear error messages if limit is reached

**Free tier limits:** 100 calls per day

Each league fetched = 1 API call, so syncing 5 leagues = 5 API calls.

## How It Works

1. **Admin clicks Sync button** → Frontend sends POST to `/api/admin/sync-fixtures`
2. **Server validates** → Checks admin authentication and MongoDB connection
3. **FixtureFetcher initializes** → Loads TypeScript class with API credentials
4. **For each league:**
   - Check rate limiter
   - Fetch fixtures from API-Football
   - Record API call
   - Save/update fixtures in MongoDB (upsert by fixture ID)
5. **Return summary** → Total counts, details per league, duration

## Database Structure

Fixtures are stored in the `fixtures` collection with this structure:

```javascript
{
  fixture: {
    id: number,
    date: string,
    status: { short: string, long: string },
    venue: { name: string, city: string },
    // ... more fields
  },
  league: {
    id: number,
    name: string,
    season: number,
    round: string
  },
  teams: {
    home: { id: number, name: string, logo: string },
    away: { id: number, name: string, logo: string }
  },
  goals: {
    home: number,
    away: number
  },
  // ... more fields
}
```

## Troubleshooting

### "API_FOOTBALL_KEY not configured"
- Ensure you've added `API_FOOTBALL_KEY` to `server/.env`
- Restart the server after adding environment variables

### "Cannot find module './dist/fixture-fetcher'"
- Run `npm run build:ts` in the server directory
- Check that `server/dist/fixture-fetcher.js` exists

### "Rate limit exceeded"
- Check current usage: http://localhost:4000/api/rate-limit/status
- Wait for old API calls to expire (7-day rolling window)
- Or reset for testing: POST to `/api/rate-limit/reset` (admin only)

### "MongoDB not connected"
- Verify `MONGODB_URI` is set in `server/.env`
- Check MongoDB Atlas connection string is valid
- Ensure IP whitelist includes your current IP

## Development

### Watch Mode

For active development, use TypeScript watch mode:

```bash
cd server
npm run watch:ts
```

This automatically recompiles TypeScript files when they change.

### Adding More Leagues

Edit `server/src/fixture-fetcher.ts`:

```typescript
const LEAGUES: League[] = [
  { id: 39, name: 'Premier League', country: 'England' },
  { id: 2, name: 'Champions League', country: 'World' },
  // Add more...
];
```

Find league IDs at: https://www.api-football.com/documentation-v3#tag/Leagues

## API Response Format

Successful sync response:

```json
{
  "success": true,
  "summary": {
    "totalFixtures": 245,
    "newFixtures": 120,
    "updatedFixtures": 125,
    "leaguesSynced": 5,
    "apiCallsUsed": 5,
    "duration": 8432
  },
  "details": [
    "Premier League: 52 fixtures (25 new, 27 updated)",
    "La Liga: 48 fixtures (22 new, 26 updated)",
    ...
  ]
}
```

Error response:

```json
{
  "error": "Rate limit exceeded",
  "details": "Rate limit exceeded. 75/75 calls used. Next available: 2026-02-10T15:30:00Z"
}
```
