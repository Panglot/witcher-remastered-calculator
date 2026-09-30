# Wild Hunt Skill Planner

Skill planner for The Witcher 3 Remastered (5.0): the four skill trees with the in-game layout, three ranks per skill, and slot groups with mutagens.

**Live:** <https://panglot.github.io/witcher-remastered-calculator/> (updates automatically on every push to `main`).

Builds are shared as codes (`W3R1.…`) or exported as small `.txt` files that contain the code. The build you're working on is kept in the browser between visits.

## Develop

No packages to install. Needs Node.js 20 or newer.

| Command | What it does |
| --- | --- |
| `npm run dev` | Serves `public/` locally and opens it, with live reload: CSS swaps in place, other changes reload the tab. |
| `npm start` | Same, without live reload. |
| `npm test` | Runs the unit tests (`node --test`). |

The local server exists only because browsers won't load ES modules from `file://`. The live site is plain static files.

## Deploy

[.github/workflows/pages.yml](.github/workflows/pages.yml) runs the tests and publishes `public/` to GitHub Pages on every push to `main`. If the tests fail, nothing is published. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

## Layout

```text
public/                  The whole site. GitHub Pages publishes exactly this folder.
  index.html, styles.css
  data/                  Game data. No logic.
    index.js             Registers the trees, rules and archetypes.
    rules.js             Max rank, slot groups, tree order, mutagen colours.
    archetypes.js        Archetype highlight chips.
    trees/*.js           One file per tree: skills (grid position, text) and links.
  src/
    main.js              Entry point. Creates the app context and mounts the panels.
    state.js             Page state and its localStorage copy.
    core/                Pure logic, no DOM. Covered by tests.
      catalog.js         Turns data/ into lookups (nodes, edges) and lists data mistakes.
      planner.js         Rules: unlocking, ranks, slots, mutagen bonus, passives.
      build.js           Build codes and export files.
    ui/                  One module per panel: mountX(app) wires events and returns { render }.
server/                  Local dev server only (static files + live reload). Not deployed.
test/                    node:test suites for core/ and the real game data.
```

## How things fit together

- **Data → catalog → planner.** `data/` is plain objects. `core/catalog.js` validates it and builds lookups; `core/planner.js` applies the rules to a build `{ pts, slots, mut }`. Planner actions mutate the build and return `{ ok, msg }`, where `msg` explains a refusal.
- **UI panels** get one shared `app` object: `{ catalog, planner, state, msg, views, render(), save(), select(id) }`. A panel changes `app.state`, then calls `app.render()`, which redraws every panel and saves to localStorage.
- **Build codes** are `W3R1.` + base64 of the build as UTF-8 JSON `{ p, s, m, b, n }` (points, slots, mutagens, budget, name). Import finds the code anywhere in pasted text or a file, so a code in a chat message or any text file loads too.

## Common changes

- **Fix skill text or links:** edit `public/data/trees/<tree>.js`. `npm test` catches unknown ids, duplicate ids, overlapping grid cells and unreachable skills.
- **Add a tree:** add `public/data/trees/<id>.js`, import it in `public/data/index.js`, and add the id to `rules.treeOrder`. Add a `--<id>` colour in `styles.css`.
- **Add an archetype:** append to `public/data/archetypes.js`.
- **Change a game rule** (unlocking, slots, bonuses): `public/src/core/planner.js`, with a test in `test/planner.test.js`.
- **Add a panel:** create `public/src/ui/<name>.js` exporting `mount<Name>(app)` that returns `{ render }`, add its markup to `index.html`, and register it in `app.views` in `main.js`.
- **Change the build code format:** `public/src/core/build.js`. Shared codes live on in people's chats and files, so keep old codes loading (there's a test for that), or bump the prefix to `W3R2.` and keep reading `W3R1.`.
