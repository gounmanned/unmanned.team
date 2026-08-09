<p align="center">
  <img src="https://cdn.unmanned.team/img/logo.png" alt="Vex" width="96" />
</p>

<h1 align="center">Vex</h1>
<p align="center"><b>Autonomous Offensive Security</b></p>

<p align="center">
  <a href="#quickstart">Quickstart</a> •
  <a href="#codebase">Codebase</a> •
  <a href="#white-labeling">White-labeling</a> •
  <a href="#philosophy">Philosophy</a>
</p>

---

## What is this?

This repo contains the **frontend client for Vex**, an autonomous offensive security product. It's the exact code that powers [vex.unmanned.team](https://vex.unmanned.team) — open-sourced so anyone can clone it, point it at their own account, restyle it, and ship it as their own white-labeled product.

There is no build step, no bundler, and no framework. You edit files, you refresh the page.

> [!IMPORTANT]
> This is a **frontend-only** repo. All authentication, scanning, data processing, and business logic live behind the production API (`static/js/api.js`). Whitelabeling changes how Vex *looks and behaves in the browser* — it does not give you your own backend.

---

## Philosophy

> ### 🦆 Light clients, heavy backends
>
> At Unmanned, we don't think every product needs React, a bundler, a state management library, and a 400MB `node_modules` folder to render a dashboard.
>
> Every dependency you add is code you didn't write, running with the same trust as code you did — and every framework abstraction is a place where a real problem can hide behind a virtual one. So Vex's frontend is built with **plain HTML, CSS, and JavaScript**, structured like a *light client*: the browser renders state and calls an API, and the backend does the compute work.
>
---

## Quickstart

Clone the repo, then run the Vex frontend against the **production backend** using your normal account:

```bash
git clone https://github.com/gounmanned/unmanned.team.git
cd unmanned.team/vex
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) and log in with your normal Vex credentials. You're now running your own local copy of the Vex client, talking to the same backend as everyone else.

---

## Codebase

This repository holds three top-level areas:

```
.
├── vex/        # Vex application code — this is what you'll clone and modify
├── website/    # unmanned.team corporate marketing site
└── cdn/        # Shared global styles used across Vex and other Unmanned apps
```

Inside `vex/`:

| Path | What it is |
|---|---|
| `index.html` | The single HTML file that defines the app's structure |
| `static/css/` | Styles for the entire app |
| `static/img/` | All image assets |
| `static/js/api.js` | The API contract with the backend — **do not modify** |
| `static/js/workspace.js` | Primary orchestration file — app state and coordination |
| `static/js/screens/*` | Individual screens/sections of the app |

> [!WARNING]
> `static/js/api.js` defines the contract between the client and the production backend. Changing it won't change how the backend behaves — it'll just break your client. Everything else is fair game.

---

## White-labeling

Vex is designed to be forked and rebranded. You can modify **any** frontend source code — logo, colors, copy, layout, screens — and deploy it to your own stack for your own customers.

A typical white-label flow:

1. Fork/clone this repo
2. Swap branding in `static/css/`
3. Deploy `vex/` as a static site on your own infrastructure

Because Vex is a light client, deployment is just serving static files — any static host works.

---

## Contributing

Issues and PRs are welcome. Since the app is intentionally dependency-light, contributions that add frameworks bundlers, or build tooling are unlikely to be accepted.

---

<p align="center">
  Built by <a href="https://unmanned.team">Unmanned</a>
</p>
