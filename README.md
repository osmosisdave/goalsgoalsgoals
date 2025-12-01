# Prototype Website

This is a minimal static prototype site using Materialize CSS and TypeScript. It is configured to build locally and to deploy automatically to GitHub Pages via GitHub Actions.

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
- The workflow uses the `publish_dir` setting to choose which folder to publish. By default it publishes the repository root. If your site files are located in a `docs/` subfolder, update the `publish_dir` in `.github/workflows/deploy.yml` to `./docs`.

Notes

- The site uses Materialize via CDN for styling. JavaScript is authored in TypeScript in `src/` and compiled to `assets/js/`.
- If you don't have `npm` or Node installed on your machine, you can still serve the site using Python's `http.server` as shown below:

```powershell
# from this folder
python -m http.server 8000
# open http://localhost:8000
```

If you'd like, I can push these files to your remote repository (I need the remote URL or git access), or guide you through the `git` commands to push from your machine.