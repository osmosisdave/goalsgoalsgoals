# Prototype Website

This is a minimal static prototype site using Materialize CSS and TypeScript. It is configured to build locally and to deploy to GitHub Pages via GitHub Actions.

Quick start

- Install dependencies (dev only):

```powershell
npm ci
```

- Build TypeScript once:

```powershell
npm run build
```

- Watch TypeScript during development:

```powershell
npm run watch
```

- Serve the site locally (from this folder):

```powershell
npm run start
# then open http://localhost:8000
```

Deployment

- This repository contains a GitHub Actions workflow that builds the site and publishes it to the `gh-pages` branch automatically whenever you push to `main`.
- The workflow uses the `publish_dir` setting to choose which folder to publish. If your site files are located in a `docs/` subfolder, update the `publish_dir` in `.github/workflows/deploy.yml` to `./docs`.

Notes

- The site uses Materialize via CDN for styling. JavaScript is authored in TypeScript in `src/` and compiled to `assets/js/`.

If you don't have `npm` or Node installed on your machine, you can still serve the site using Python's `http.server` as shown below:

```powershell
# from this folder
python -m http.server 8000
# open http://localhost:8000
```

Local auth server (prototype)

This repository includes a small Express-based auth server under `server/` for local development. The server supports two storage modes:

- File-backed (default) — stores users in `server/users.json` with bcrypt-hashed passwords.
- MongoDB (optional) — if you provide a `MONGODB_URI` environment variable the server will use MongoDB for the `users` collection.

Setup for local development

1) Create a local `.env` file inside the `server/` folder (do NOT commit it):

```text
# server/.env
JWT_SECRET=change_this_to_a_strong_random_value
MONGODB_URI=
PORT=4000
```

Note: admin users are now created explicitly using the `create_admin.js` helper (see `server/create_admin.js`). Do not keep initial admin passwords in `.env` long-term.

2) If you want to use Atlas MongoDB, follow provisioning steps below and paste your connection string into `MONGODB_URI`.

3) Install server dependencies (already included in this repo):

```powershell
# from project root
npm --prefix .\\server ci
# (or inside server/)
cd server
npm ci
```

4) Start the server (it will load `server/.env` automatically when present):

```powershell
# from project root
npm --prefix .\\server start
# or
cd server
npm start
```

MongoDB Atlas provisioning (free tier)

1) Sign in to https://cloud.mongodb.com and create a Project.
2) Create a new Cluster -> Shared -> Free (M0). Choose region and click Create.
3) In "Network Access" add your current IP (or `0.0.0.0/0` for testing only).
4) In "Database Access" add a database user and password (save these credentials).
5) Under Clusters -> Connect -> "Connect your application" choose Driver: Node.js and copy the SRV connection string.
6) Replace placeholders and URL-encode the password if it contains special characters. Example:

```text
mongodb+srv://ggg_admin:MyP%40ssw0rd@cluster0.abcd3.mongodb.net/goalsdb?retryWrites=true&w=majority
```

Running the server with Atlas

Paste the Atlas URI into `server/.env` as the value for `MONGODB_URI` (do NOT commit this file). Then start the server as above. On startup you should see either:

- `Connected to MongoDB` — the server successfully connected to Atlas and will use the `users` collection there.
- or `Failed to connect to MongoDB` (followed by an error) — the server will fall back to the local `server/users.json` file.

Troubleshooting

- If you see connection errors, confirm your IP is whitelisted in Atlas and your username/password are correct and URL-encoded.
- Ensure outbound traffic to Atlas is allowed by your network/firewall.
- If you want to test quickly without Atlas, leave `MONGODB_URI` blank — the server will create `server/users.json` and use that.

Security notes

- Do not commit `server/.env` or any credentials to git. Use environment variables or your host's secret store for production.
- Rotate `JWT_SECRET` and database passwords in production.

If you'd like, I can add a short example `server/.env.example` and a one-line PowerShell snippet for URL-encoding passwords.

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

If you want I can implement the client change (add `assets/js/config.js` and update `src/auth.ts` to use `API_ORIGIN`) and then build the site so your GitHub Pages site calls the deployed API directly. Let me know and I will patch the client and run a build.
```

 If you'd like, I can push these files to your remote repository (I need the remote URL or git access), or guide you through the `git` commands to push from your machine.