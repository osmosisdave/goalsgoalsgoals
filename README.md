# Goals Goals Goals

A football league management application with fixtures, standings, and user authentication. Built with TypeScript, Express, and MongoDB.

## 🚀 Quick Start (Recommended)

The easiest way to run the project locally is using the startup script:

```bash
# Start with file-based storage (default)
./start.sh

# Start with MongoDB
./start.sh --mongodb

# Custom ports
./start.sh --frontend-port 3000 --backend-port 5000

# View help
./start.sh --help
```

**What the script does:**
- ✅ Starts both frontend (port 8000) and backend (port 4000) servers
- ✅ Auto-installs dependencies if missing
- ✅ Clears ports automatically
- ✅ Creates logs in `logs/` directory
- ✅ Validates configuration before starting
- ✅ Press Ctrl+C to stop both servers

**To stop servers:**
```bash
./stop.sh
```

**View logs:**
```bash
tail -f logs/backend.log
tail -f logs/frontend.log
```

## 📦 Initial Setup

### 1. Configure Environment

Create `server/.env` (already provided):
```bash
JWT_SECRET = 'dev_secret_change_me_in_production'
# MONGODB_URI = "mongodb+srv://..."  # Uncomment to use MongoDB
INIT_ADMIN_PASS = 'admin123'
```

### 2. Seed Football Data (Optional)

Populate MongoDB with Premier League fixtures and standings:
```bash
cd server
node seed_football_data.js
```

See [server/FOOTBALL_DATA.md](server/FOOTBALL_DATA.md) for details.

### 3. Create Admin User

```bash
cd server
node create_admin.js --password=admin123
```

## 🎯 Features

- **Fixtures Management**: View upcoming and finished matches from 6 major leagues
- **Match Selection**: Users can select one upcoming match to follow
- **Match History**: Automatic archival of finished match selections with scores and rounds
- **Standings Table**: Real-time league standings
- **User Authentication**: JWT-based auth with admin/user roles
- **API Rate Limiting**: 75/100 calls per week with tracking
- **Mock API**: Test API-Football v3 integration without real API calls
- **Dual Storage**: MongoDB or file-based storage (users.json, leagues.json)

## 📁 Project Structure

```
├── assets/
│   ├── css/          # Styles
│   └── js/           # Compiled JavaScript from TypeScript
├── server/
│   ├── index.js      # Express API server
│   ├── api-rate-limiter.js
│   ├── seed_football_data.js
│   └── .env          # Environment configuration
├── src/              # TypeScript source files
├── start.sh          # Quick start script
├── stop.sh           # Stop servers script
└── *.html            # Frontend pages
```

## 🛠️ Manual Setup (Alternative)

If you prefer not to use the startup script:

### Frontend

```bash
# Install dependencies (dev only)
npm ci

# Build TypeScript

### Frontend

```bash
# Install dependencies (dev only)
npm ci

# Build TypeScript
npm run build

# Watch TypeScript during development
npm run watch

# Serve the site locally
npm start
# then open http://localhost:8000
```

### Backend

```bash
cd server
npm ci
node index.js
# Server runs on port 4000
```

## 🌐 Deployment

## 🌐 Deployment

### GitHub Pages (Frontend)

- This repository contains a GitHub Actions workflow that builds the site and publishes it to the `gh-pages` branch automatically whenever you push to `main`.
- The workflow uses the `publish_dir` setting to choose which folder to publish.

### Backend (Render/Heroku)

**Recommended: Render**
1. Create an account at https://render.com
2. Create a new Web Service from your GitHub repo
3. Set Build Command: `cd server && npm ci`
4. Set Start Command: `cd server && npm start`
5. Add environment variables:
   - `MONGODB_URI` → your Atlas connection string
   - `JWT_SECRET` → strong random value
   - `PORT` → 4000 (optional)

## 📚 Additional Documentation

- [FOOTBALL_DATA.md](server/FOOTBALL_DATA.md) - Database setup and API endpoints
- [MOCK_API.md](MOCK_API.md) - Mock API-Football testing
- [RATE_LIMITER.md](RATE_LIMITER.md) - API rate limiting system

## 🔧 Storage Options

### File-Based Storage (Default)
- Uses `server/users.json`, `server/leagues.json`, `server/api-calls.json`
- Good for development and small deployments
- No external dependencies

### MongoDB Storage
- Uncomment `MONGODB_URI` in `server/.env`
- Supports MongoDB Atlas (free tier available)
- Better for production and scaling

## 🔐 Security Notes

## 🔐 Security Notes

- Do not commit `server/.env` or credentials to git
- Use environment variables or secret stores for production
- Rotate `JWT_SECRET` and database passwords regularly
- Default admin credentials: `admin` / `admin123` (change immediately!)

## 🗄️ MongoDB Atlas Setup (Optional)

1. Sign in to https://cloud.mongodb.com
2. Create a new Cluster → Shared → Free (M0)
3. Network Access: Add your IP or `0.0.0.0/0` for testing
4. Database Access: Create a user with read/write permissions
5. Clusters → Connect → Copy connection string
6. Paste into `server/.env` as `MONGODB_URI`

Example connection string:
```
mongodb+srv://username:password@cluster0.abcd.mongodb.net/goalsdb?retryWrites=true&w=majority
```

## 🐛 Troubleshooting

**Port already in use:**
```bash
./stop.sh  # Clean up existing processes
```

**MongoDB connection errors:**
- Check IP whitelist in Atlas
- Verify credentials are URL-encoded
- Use file storage as fallback (comment out MONGODB_URI)

**Frontend can't reach backend:**
- Ensure backend is running on port 4000
- Check CORS settings in `server/index.js`
- Verify `assets/js/config.js` has correct API_ORIGIN

**Logs not showing:**
```bash
cat logs/backend.log
cat logs/frontend.log
```

## 📝 API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - Login and get JWT
- `GET /api/me` - Get current user info

### Football Data
- `GET /api/football/fixtures` - Get fixtures (query: league, season, status)
- `GET /api/football/standings` - Get standings (query: league, season)
- `GET /api/football/teams` - Get teams

### Match Selections
- `POST /api/matches/:fixtureId/select` - Select a match (authenticated)
- `DELETE /api/matches/:fixtureId/select` - Unselect a match (authenticated)
- `GET /api/matches/selections` - Get all current selections
- `GET /api/matches/history` - Get archived match selections (query: username)
- `POST /api/matches/archive-finished` - Manually trigger archival of finished matches (admin)

### Rate Limiting
- `GET /api/rate-limit/status` - Get API usage stats
- `GET /api/rate-limit/analytics` - Get detailed analytics (admin)
- `POST /api/rate-limit/reset` - Reset rate limiter (admin)

### Match Selection Archival

The system automatically archives match selections when fixtures move from "upcoming" (NS) to "finished" (FT):

- **Automatic**: Runs every 15 minutes after server startup
- **Manual**: Admin can trigger via dashboard button or `POST /api/matches/archive-finished`
- **Data Stored**: Username, teams, final score, round/gameweek, league info, dates
- **Collection**: `match_selection_history` in MongoDB

Archived records include:
```javascript
{
  username: "user123",
  fixtureId: 12345,
  homeTeam: "Arsenal",
  awayTeam: "Chelsea",
  finalScore: { home: 2, away: 1 },
  round: "Regular Season - 23",
  leagueName: "Premier League",
  season: 2024,
  selectedAt: "2026-01-15T10:00:00Z",
  archivedAt: "2026-01-16T18:00:00Z"
}
```

---

## 📜 Legacy Documentation

<details>
<summary>Click to expand detailed manual setup instructions</summary>

### Manual Backend Deployment

**Deploying the API and connecting the frontend**

Deploy the `server/` Express API to a hosting provider (Render, Heroku, or similar) and point the frontend (GitHub Pages) to the deployed API origin.

Recommended quick deploy (Render)
- Create an account at https://render.com and connect your GitHub repo.
- Create a new **Web Service** and select the `server/` folder (or the repository root if `server/` is a top-level folder).
- Set the Build Command: `npm ci`
- Set the Start Command: `npm start` (server uses `PORT` env var). Choose the Node runtime (16/18+).
- In Environment -> Add the following environment variables (Render Dashboard -> Environment):
	- `MONGODB_URI` → your Atlas connection string
	- `JWT_SECRET` → a strong random value
	- `PORT` → `4000` (optional — Render will provide its own port)
- Deploy. Confirm logs show `Connected to MongoDB` and `Using MongoDB for user store`.

Alternative: Heroku
- Create an app with `heroku create`, add the remote, and push: `git push heroku main`.
- Set config vars with `heroku config:set JWT_SECRET=... MONGODB_URI='...'`.
- Start the dyno with `heroku ps:scale web=1`.

Notes on hosting
- Ensure Atlas Network Access allows the host's egress IPs (or use VPC peering if needed). For quick tests you can use `0.0.0.0/0` then tighten later.
- Use a separate least-privilege DB user for the app (ReadWrite access to your app DB) rather than the Atlas project owner account.
- Always store `JWT_SECRET` and `MONGODB_URI` in the host's secret/config store — do not commit them.

Creating an admin on the deployed server
- After deployment, use the `create_admin.js` utility on the host or run it locally against your `MONGODB_URI` (set `MONGODB_URI` + pass `--password=...`). Example locally:

```powershell
$env:MONGODB_URI = 'mongodb+srv://...'
node server/create_admin.js --password='YourNewAdminPassword'
```

Updating the frontend to call the deployed API
- The static site currently calls relative endpoints like `/api/login`. When the frontend is served from GitHub Pages (`https://username.github.io/repo`) it will not be able to reach your API unless the API is on the same origin or the frontend uses the full API origin.
- Option A (recommended): Configurable API origin. Add a short `assets/js/config.js` (or edit `index.html` to set `window.GGG_API_ORIGIN`) and change client fetch calls to use `const base = window.GGG_API_ORIGIN || ''` then `fetch(base + '/api/login', ...)`.

CI-based configuration (recommended)
- This repo's GitHub Actions workflow injects the production API origin from a repository Actions secret named `API_ORIGIN` into `assets/js/config.js` at deploy time.
- Set the secret under GitHub repo Settings -> Secrets and variables -> Actions -> New repository secret:
	- Name: `API_ORIGIN`
	- Value: `https://your-api-host.example.com`
- On push to `main`, CI will build TypeScript and publish to GitHub Pages with `window.GGG_API_ORIGIN` set to your secret value.

Manual `index.html` snippet (alternative; insert in `<head>` before app scripts):

```html
<script>
	// Set this to your deployed API origin in production (leave blank for local proxied dev)
	window.GGG_API_ORIGIN = 'https://api.your-domain.com';
	// For local development, leave empty so relative paths work with `npm start` that serves both.
</script>
```

Example client change (TypeScript/JS):

```js
const API_ORIGIN = (window.GGG_API_ORIGIN || '').replace(/\/$/, '');
function apiUrl(path) { return (API_ORIGIN ? API_ORIGIN : '') + path; }
// then replace fetch('/api/login'...) with fetch(apiUrl('/api/login'), ...)
```

Additional production considerations
- CORS: tighten CORS to allow only your frontend origin (update `app.use(cors())` to configure `origin`).
- HTTPS: host the API over HTTPS and ensure the frontend uses `https://` origin.
- Cookies: consider switching to httpOnly secure cookies for tokens (server + client change) to reduce XSS risk.
- Env management: add `JWT_SECRET`, `MONGODB_URI` and other secrets as environment variables in your host's dashboard; rotate as needed.

</details>

---

**Made with ⚽ for football fans**
 If you'd like, I can push these files to your remote repository (I need the remote URL or git access), or guide you through the `git` commands to push from your machine.