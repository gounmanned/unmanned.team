<p align="center">
  <img src="https://cdn.unmanned.team/img/logo.png" alt="Vex" width="96" />
</p>

<h1 align="center">Vex</h1>
<p align="center"><b>Autonomous Offensive Security</b></p>

<p align="center">
  <a href="#quickstart">Quickstart</a> •
  <a href="#codebase">Codebase</a> •
  <a href="#white-labeling">White Label</a> •
  <a href="#philosophy">Philosophy</a>
</p>

---

## About Vex

Vex is an always-on red team that collects and analyzes security signals to prevent, detect and respond to cyberattacks.

## What is this?

This is the exact code that powers [vex.unmanned.team](https://vex.unmanned.team) — open-sourced so anyone can clone it, point it at their own account, restyle it, and ship it as their own white-labeled product.

There is no build step, no bundler, and no framework. You edit files, you refresh the page.

---

## Philosophy

> ### Light clients
>
> At Unmanned, we don't think every product needs React, a bundler, a state management library, and a 400MB `node_modules` folder to render a dashboard. Every dependency you add is code you didn't write, running with the same trust as code you did. So Vex's frontend is built with **plain HTML, CSS, and JavaScript**, structured like a *light client*: the browser renders state and calls an API.
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
├── website/    # unmanned.team corporate website
└── cdn/        # Shared global styles used across Vex and other Unmanned apps
```

The primary structure in `vex/`:

| Path | What it is |
|---|---|
| `index.html` | The single HTML file that defines the app's structure |
| `static/css/` | Styles for the entire app |
| `static/js/api.js` | The API contract with the back end — **do not modify** |
| `static/js/workspace.js` | Primary orchestration file — app state and coordination |
| `static/js/tenant.js` | The main screen you see showing the signal table |
| `static/js/rollups/*` | Individual full-screen rollup sections in the app |
| `static/js/sidebars/*` | Individual half-screen sidebars in the app |

---

## White Label

Vex is designed to be forked and rebranded. You can modify **any** front end source code — logo, colors, copy, layout, screens — and deploy it to your own stack for your own customers.

A typical white-label flow:

1. Fork/clone this repo
2. Swap branding in `static/css/`
3. Deploy `vex/` as a static site on your own infrastructure

---

## Contributing

Issues and PRs are welcome. Since the app is intentionally dependency-light, contributions that add frameworks bundlers, or build tooling are unlikely to be accepted.

---

<p align="center">
  Built by <a href="https://unmanned.team">Unmanned</a>
</p>
