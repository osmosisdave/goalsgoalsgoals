# Quick Start Guide: Sync Fixtures Feature

## ✅ Implementation Complete!

Your project now has a fully functional fixture sync system that can be triggered from the admin UI.

## 📋 What You Need

1. **API-Football API Key** - Get it from [RapidAPI](https://rapidapi.com/api-sports/api/api-football)
2. **MongoDB Connection** - Already configured in your .env
3. **Admin Account** - You already have this

## 🚀 Quick Setup (3 Steps)

### Step 1: Add API Key to .env

Edit `server/.env` and add:

```bash
API_FOOTBALL_KEY=your_rapidapi_key_here
API_FOOTBALL_HOST=v3.football.api-sports.io
```

### Step 2: Verify TypeScript Build

The TypeScript files are already compiled! Check:

```bash
ls server/dist/
```

You should see `fixture-fetcher.js` and related files.

If you make changes to the TypeScript source, rebuild with:

```bash
cd server
npm run build:ts
```

### Step 3: Start the Server

```bash
cd server
npm start
```

## 🎯 How to Use

### From the Admin UI

1. **Open Admin Page**: http://localhost:8000/admin.html
2. **Login** with your admin credentials
3. **Scroll down** to the "Sync Fixtures from API-Football" card
4. **Click "Sync Fixtures"** button
5. **Watch the progress** - A spinner will show while syncing
6. **View Results** - Detailed stats will appear when complete

### Expected Results

When sync completes successfully, you'll see:
- ✅ Total fixtures fetched
- ✅ Number of new fixtures added
- ✅ Number of existing fixtures updated
- ✅ Leagues successfully synced
- ✅ API calls used
- ✅ Time taken

Example:
```
✓ Sync Complete!
- Total Fixtures: 245
- New: 120
- Updated: 125
- Leagues Synced: 5
- API Calls Used: 5
- Duration: 8.43s

Details:
- Premier League: 52 fixtures (25 new, 27 updated)
- La Liga: 48 fixtures (22 new, 26 updated)
- Bundesliga: 51 fixtures (26 new, 25 updated)
- Serie A: 49 fixtures (22 new, 27 updated)
- Ligue 1: 45 fixtures (19 new, 26 updated)
```

## 🔍 Verify Data Was Saved

### Check MongoDB

```bash
# Connect to your MongoDB
mongo "your_connection_string"

# Switch to database
use goalsgoalsgoals

# Count fixtures
db.fixtures.count()

# View some fixtures
db.fixtures.find().limit(3).pretty()

# Find fixtures for a specific league
db.fixtures.find({"league.id": 39}).count()  # Premier League
```

### Check via API

```bash
curl http://localhost:4000/api/football/fixtures?league=39&season=2025
```

## ⚙️ Configuration

### Customize Date Range

By default, the system fetches fixtures from 20 days before today to 20 days after today (40 days total).

You can modify this in the admin UI by editing the JavaScript in admin.html:

```javascript
body: JSON.stringify({
  season: 2025,
  dateRange: 30  // Change to 30 days before/after
})
```

### Customize Leagues

The system currently syncs these leagues:
- Premier League (England)
- La Liga (Spain)
- Bundesliga (Germany)
- Serie A (Italy)
- Ligue 1 (France)

To add/remove leagues, edit `server/src/fixture-fetcher.ts`:

```typescript
const LEAGUES: League[] = [
  { id: 39, name: 'Premier League', country: 'England' },
  { id: 2, name: 'Champions League', country: 'World' },  // Add this
  // ... more leagues
];
```

Then rebuild:
```bash
cd server && npm run build:ts
```

Find league IDs at: https://www.api-football.com/documentation-v3#tag/Leagues

## 🔐 Rate Limiting

Your system is configured with a rate limiter that:
- Tracks API calls in a 7-day rolling window
- Soft limit: 75 calls per week
- Hard limit: 100 calls per week

### Check Current Usage

http://localhost:4000/api/rate-limit/status

### API-Football Free Tier

The free tier typically allows:
- **100 calls per day** (not per week as your rate limiter is set)
- Each league sync = 1 API call
- So you can sync all 5 leagues ~20 times per day

## 🧪 Testing

### Test Without Using API Calls

Your system has mock data for testing. You can view existing fixtures:

http://localhost:8000/matches.html

### Test the Endpoint Directly

```bash
# Get admin token
TOKEN=$(curl -X POST http://localhost:4000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}' \
  | jq -r '.token')

# Trigger sync
curl -X POST http://localhost:4000/api/admin/sync-fixtures \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"season": 2025, "dateRange": 10}' | jq
```

## ❌ Troubleshooting

### "API_FOOTBALL_KEY not configured"

**Solution**: Add your API key to `server/.env` and restart the server.

### "Cannot find module './dist/fixture-fetcher'"

**Solution**: 
```bash
cd server
npm run build:ts
```

### "Rate limit exceeded"

**Solution**: 
- Check status: http://localhost:4000/api/rate-limit/status
- Wait for old calls to expire
- Or reset (admin only): POST to /api/rate-limit/reset

### "MongoDB not connected"

**Solution**: 
- Verify MONGODB_URI in `server/.env`
- Check MongoDB Atlas whitelist includes your IP
- Test connection: `cd server && node test_mongo_connect.js`

### Sync Button Does Nothing

**Solution**:
- Open browser console (F12) to see errors
- Verify you're logged in as admin
- Check server logs for errors

## 📊 What Gets Synced

For each fixture, the system saves:
- Fixture ID, date, time, venue
- Match status (scheduled, live, finished)
- Home and away teams (names, logos)
- Current score (if available)
- League info and season
- Round/matchday info

## 🔄 Re-syncing

You can run the sync multiple times:
- **New fixtures** will be added
- **Existing fixtures** will be updated with latest data
- **No duplicates** are created (upsert by fixture ID)

This means you can:
- Re-sync to get live score updates
- Sync daily to keep fixtures current
- Run it whenever you want fresh data

## 🎉 Next Steps

1. **Add your API key** to server/.env
2. **Restart the server** if it's running
3. **Click the sync button** in the admin UI
4. **View your fixtures** at http://localhost:8000/matches.html

## 📚 More Information

- **Full Documentation**: See [SYNC_FIXTURES.md](SYNC_FIXTURES.md)
- **Implementation Details**: See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **API-Football Docs**: https://www.api-football.com/documentation-v3

## 🆘 Need Help?

If you encounter issues:
1. Check the browser console (F12)
2. Check server logs
3. Verify .env configuration
4. Check MongoDB connection
5. Review error messages in the UI

---

**Ready to go!** Just add your API key and click the sync button. 🚀
