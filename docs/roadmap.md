# Roadmap: what comes after the planner core

Status (2026-10-04): the Character screen works (trees, slots, mutagens, apply mode, share codes, saved state). The skill data is incomplete and everything around the screen (points bar, archetypes, share card, header, page tabs) is still placeholder layout. This file collects what's next, with a recommendation and the open questions for each item.

Each item has a **Recommendation** (an opinion, open to change) and **To decide** (questions only the owner can answer).

## 1. Skill data: real effects for every rank

**Now:** each skill has one `text` (rank 1 only). 7 of 80 skills are `verified`. The tooltip writes "Rank N text isn't published yet" for higher ranks.

**Goal:** the exact text and numbers for ranks 1 to 3 of every skill, checked against the game.

**Recommendation:**
- Store a template plus numbers per rank, not three strings:
  ```js
  { id: "c_mm", text: "After a successful dodge or roll, your next Fast Attack deals {dmg} additional damage.",
    values: { dmg: ["30%", "60%", "90%"] } }
  ```
  The tooltip fills the template for the current and next rank. The stats modal (item 3) can read the same numbers to add things up. Three strings would make that impossible.
- Get the numbers from the game files rather than wikis, the same way the icons and positions were extracted: a `tools/extract_skill_text.py` that reads the localized descriptions and the skill ability values and writes them out for the data files. Assumption, not checked yet: the descriptions are in the `.w3strings` localization files and the per-rank values in the skill ability XML. Confirm where they live before writing the tool.
- Keep `verified` and the `note` field for anything that still needs an in-game check.

**To decide:**
- Mutagen bonuses (the stat each color gives and how slotted skills multiply it) need the same treatment. Same tool or separate?
- Do we show raw numbers anywhere other than the tooltip (only the stats modal, or also in the tree)?

## 2. Design language for cards, screens and modals

**Goal:** a small set of game-styled building blocks that every new screen uses, so nothing looks like a generic web card.

**Recommendation:** define four building blocks, all drawn from art already in `public/assets/ui/`:

| Building block | Game reference | Used for |
| --- | --- | --- |
| **Popup** | Reset abilities popup (`docs/reference/reset_modal_fullscreen.png`) | Confirmations, Load build, small forms |
| **Sheet** | Esc menu: dark semi-transparent layer over the whole screen | The main menu (item 8), settings |
| **Side panel** | Tree panel frame and background | Stats modal (item 3), covers one region of the screen |
| **Key hint** | Key legend at the bottom (`legend.js`) | Every action that has a hotkey, inside and outside modals |

Under these goes one shared **layer manager** (a stack of open layers):
- Esc closes the top layer.
- Focus stays inside the top layer.
- The mask (the one apply mode already uses) sits under the top layer.
- The key legend shows the top layer's keys.

Apply mode becomes one layer type in that stack. This keeps the modals from each handling Esc, focus and the mask their own way.

**To decide:**
- Should all new text use D-DIN like the game, or keep Barlow/Alegreya for longer prose (About, help)?
- Build mockups first (static HTML in a scratch page or the asset demo) or go straight to the real components? See item 9.

## 3. Stats modal (C)

**Goal:** press C to open a panel that covers the skill tree but leaves the slotted skills visible. It shows everything active in the current build.

**Possible content:**
- **Points:** total (editable), spent, left, spent per tree, and each tree's passive bonus (adrenaline gain etc.).
- **Active effects:** each slotted skill with its effect at its current rank (needs item 1).
- **Mutagens:** each group's mutagen, how many slotted skills match its color, and the total bonus per stat.
- **Summed stats:** bonuses added up across skills, passives and mutagens (e.g. total sign intensity, total adrenaline gain). Only possible once item 1 is stored as numbers.
- **Unslotted skills with points:** points spent on skills that aren't slotted (allowed, but often a mistake).
- **Archetype coverage:** e.g. "Crossbow 4/6".
- **Clear tree / Clear all.**

**Recommendation:** yes, move the whole points bar into this modal. In-game, the screen itself only shows POINTS AVAILABLE, and the app already shows that, editable. Clearing the build is already on R (Reset abilities) in the legend. Nothing in the bar has to stay on the main screen.

**To decide:**
- Is the budget field in the modal the same as the POINTS AVAILABLE field on the screen, or does only one of them stay editable?
- C toggles (press again to close) or C opens and Esc closes? Recommendation: both.

## 4. Archetype highlight

**Problem:** the highlight shows up in the tree. A picker inside the C modal would cover the tree it's highlighting, so the archetype picker can't go there.

**Options:**
1. **A key plus a small list:** a key (e.g. H, shown in the legend) opens a small list of archetypes on the tree's side, colored by tree. Picking one closes the list and leaves the highlight on, with its name shown by the tree title (e.g. "Highlight: Crossbow ×").
2. **A dropdown in the tree panel header**, next to the tree tabs.
3. **Cycle keys:** keys step through the archetypes with no list. Fast, but hard to discover with 16 archetypes.

**Recommendation:** option 1. It needs no permanent screen space, it matches how the game uses key hints, and the active highlight is still visible after the list closes. The C modal can still show coverage numbers (item 3).

**To decide:** one archetype at a time or several (currently chips toggle)? Does picking an archetype switch to its tree?

## 5. Share build

**Now:** a card with build name, Copy code, Export file, a paste box, Load code, Import file.

**Recommendation:**
- Replace the card with three actions, each with a key hint (bottom corner, or in the legend row):
  - **Copy:** copies the code straight away, with a short toast ("Code copied").
  - **Save:** downloads the build file.
  - **Load:** a popup (item 2) with a paste box that accepts a code or a link, and a "Choose file" button. Dropping a file on the popup works too.
- **Build name:** it's already saved in the code and the file, so loading restores it. Show it in the browser tab title, the Esc menu and the C modal (item 7). Rename it from the menu or the Save popup.
- **Share links:** "paste a url" implies links that load a build. That's new. Use a query parameter (`?b=W3R1…`), not the hash, because the hash already picks the page. On load, apply the build, then remove the parameter so a refresh doesn't overwrite later changes.

**To decide:**
- Is Copy a code or a link? Recommendation: a link, since a link also works as a code when pasted.
- Floating buttons on screen, or only in the menu (item 8) with hotkeys? See item 8 for the "too much" concern.

## 6. Settings and info

**Possible content:**
- **Background:** pick a region (10 exist, `backdrop.setRegion`) or auto-cycle through them, with a cycle interval.
- **Hold speed:** the time to level a skill up by holding (now fixed at `HOLD_MS` = 1000 ms, as in-game). Include an "instant" option.
- **Asset demo** link (moves out of the top right).
- **About:** what the app is, data sources and how complete they are, the fan content notice (now in the footer), link to the repo.
- Possibly later: reduce motion (pulsing borders), reset saved data.

**Settings storage:** a separate `localStorage` key from the build, so loading a build never changes settings.

**Back from the demo:** with the top nav gone, the demo page needs a way back. Recommendation: a key hint "Esc Back" in the demo's corner, plus Esc itself. The `#demo` link keeps working.

**To decide:** is About its own page or a section of the settings sheet?

## 7. Full-screen layout

**Observation:** without the title and the page tabs, the planner fits the window top to bottom, legend included, like the game screen. The browser's own tabs, address bar and bookmarks take the place of the game's top menu bar, so it looks full screen in a normal window. There is no free strip for a title.

**Recommendation:** go full screen.
- Keep the `<title>` (browser tab, bookmarks, link previews) and keep an `<h1>` for screen readers, visually hidden. The browser tab is the page title.
- **Build name:** no spare strip on the main screen, so it lives elsewhere:
  - in the browser tab: `<title>` becomes "Crossbow and bombs - Witcher 3 Remastered Build planner" when the build has a name,
  - in the Esc menu under the logo, where it can also be renamed (item 8),
  - at the top of the C modal (item 3).
- **Fan content notice:** it may move out of the footer, but it has to stay easy to see (see "Fan content rules" below). Plan:
  - a short line in the Esc menu (on screen every time it opens),
  - the full text in About,
  - a faint one-line notice in a free corner of the main screen (bottom left, beside the legend), so it's there even for people who never open the menu.

**To decide:** what happens on small and portrait screens, where the screen can't fit? Scale down, or scroll?

### Fan content rules (checked 2026-10-04)

From the [CD PROJEKT RED Fan Content Guidelines](https://www.cdprojektred.com/en/fan-content):
- The notice must show "This is an unofficial fan work and is not approved/endorsed by CD PROJEKT RED" (or similar wording) "in a sensible and obvious location". The guidelines don't require a footer or say which page it goes on.
- No game or company names or trademarks in the domain. No video games or mobile apps based on their games. Nothing commercial.
- The guidelines say nothing about using official logos inside fan content. The only rule that touches it is not to make anyone think CDPR endorses the work.

Opinion, not legal advice: a notice that only appears in a menu or the About page is arguably not "obvious". That's why the main screen keeps the faint notice.

## 8. Navigation: menu versus separate buttons

**The worry:** C for stats, H for archetypes, settings, share buttons and a demo link could add up to a cluttered screen.

**Recommendation:** an **Esc menu** like the game's: the Sheet from item 2, the Witcher Remastered logo on top, a vertical list below:

- Resume
- Build: Copy link, Save file, Load, Rename
- Statistics (C)
- Settings
- About
- Asset demo

Esc order with the layer manager (item 2): Esc closes the top layer if one is open (apply mode, popup, C modal). With nothing open, Esc opens the menu.

That makes the menu the one place that lists everything, so nothing else has to be on screen. The main screen keeps only what the game has (trees, slots, points, legend) plus the faint fan content notice. The build name is shown in the menu under the logo. The legend shows `Esc Menu` and `C Statistics`, so people can find both.

The floating share buttons then become optional. Suggestion: keep only **Copy** on screen (it's the one action people repeat), and leave Save and Load in the menu. Decide after seeing it (item 9).

**To decide:**
- **Logo:** The Witcher 3 Remastered is CDPR's official release, so its logo is their trademark. The fan content rules don't forbid it (see item 7). The risk is that an official logo at the top of the menu makes the site look official. If it's used, put the notice right under it in the same menu. A safer option is a text title in the game's font ("Build planner"), with the logo left out or kept small. Opinion, not legal advice.
- Menu items as plain text rows like the game, or with icons?

## 9. Trying it out before building it

Several items are "decide after seeing it". Cheap ways to see them:
- Static mockups as extra sections on the asset demo page, using the real art and fonts. They can show the menu sheet, the C panel and the Load popup without any logic.
- Screenshot comparisons against `docs/reference/` with `tools/compare_screen.py` for anything that copies a game screen.
- Build the full-screen layout (item 7) first on a branch. Most of the other placement questions get easier once that's in place.

## Suggested order

1. Layer manager and the Popup/Sheet blocks (item 2). Everything else depends on them. Port apply mode onto it.
2. Full-screen layout with the notice moved (item 7), and the Esc menu (item 8) holding Share, Settings and the demo link as plain lists. This removes the cards below the screen.
3. Load popup, Copy toast, share links (item 5).
4. Settings: background, auto-cycle, hold speed (item 6).
5. Archetype picker (item 4).
6. Skill data extraction tool and data (item 1). Can run alongside 1 to 5, it's independent.
7. C modal (item 3). Last, because its best parts (active effects, summed stats) need item 1.
