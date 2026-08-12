# Vex automation service

`vex` is a frontend-only static site (see the repo root `README.md` — "Light clients, heavy backends"). Playwright drives a real browser process, which can't run inside static client-side JS, so it lives here as a small standalone service instead of inside `vex/`.

## What it does

The Monitors "Guided Setup" wizard in `vex` calls this service to open a visible, real browser window and navigate it to the page a setup step points to (e.g. GitHub's developer settings, the Cloudflare API token page). The user still logs in and completes the vendor's forms themselves — this service only opens windows and navigates them. It does not read page content, fill forms, or handle any credentials.

## Run it

```bash
cd automation
npm install
npm start
```

`npm install` also downloads a Chromium build for Playwright via `postinstall`. The service listens on `http://localhost:4787` by default and only accepts requests from `http://localhost:8080` (the `vex` dev server from the main README's quickstart). Override either with `PORT` / `ALLOWED_ORIGIN` env vars.

## API

- `POST /session` → `{ sessionId }` — launches a new browser window.
- `POST /session/:id/navigate` with `{ "url": "https://..." }` → navigates that window.
- `POST /session/:id/close` → closes the window and frees the session.
