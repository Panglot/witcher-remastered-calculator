# Roadmap: what comes after the planner core

Status (2026-10-04): the Character screen works (trees, slots, mutagens, apply mode, share codes, saved state). The layer manager and a first pass of the Esc menu (Settings with Reset saved data, About) are in; the visible title, page tabs and asset demo are gone. Still open: the skill data is incomplete, and the points bar, archetype chips, share card and footer still sit under the screen as placeholder layout. This file collects what's next, with a recommendation and the open questions for each item.

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
  The tooltip fills the template for the current and next rank. The Statistics panel (item 3) can read the same numbers to add things up. Three strings would make that impossible.
- Get the numbers from the game files rather than wikis, the same way the icons and positions were extracted: a `tools/extract_skill_text.py` that reads the localized descriptions and the skill ability values and writes them out for the data files. Assumption, not checked yet: the descriptions are in the `.w3strings` localization files and the per-rank values in the skill ability XML. Confirm where they live before writing the tool.
- Keep `verified` and the `note` field for anything that still needs an in-game check.

**To decide:**
- Mutagen bonuses (the stat each color gives and how slotted skills multiply it) need the same treatment. Same tool or separate?
- Do we show raw numbers anywhere other than the tooltip (only the Statistics panel, or also in the tree)?

## 2. Design language for popups, panels and the menu

**Goal:** a small set of game-styled building blocks that every new screen uses, so nothing looks like a generic web card.

**Decided (2026-10-04):** three kinds of overlay plus key hints, all drawn from art already in `public/assets/ui/`:

| Building block | Game reference | Modal | Used for |
| --- | --- | --- | --- |
| **Popup** | Reset abilities popup (`docs/reference/reset_modal_fullscreen.png`) | Yes: mask, focus held, page inert | Confirmations and other small questions |
| **Side panel** | Tree panel frame and background | No | Left: Statistics (item 3). Right: Archetypes (item 4) |
| **Escape menu** | The game's Esc menu, but centered | Yes: mask over everything | Everything else (item 8) |
| **Key hint** | Key legend at the bottom (`legend.js`) | - | Every action that has a hotkey, inside and outside overlays |

**Popups:**
- Reset abilities (exists, `confirmPopup` in `ui/popup.js`).
- Apply mode "Select slot" (exists, `ui/applyMode.js`): a popup with the slots lifted above the mask.
- Reset saved data: confirm (exists, Esc menu > Settings).
- Load over a non-empty build: confirm that the current build will be lost (to do, with item 5).

**Side panels:**
- Not modal and not absolutely positioned over the page. Each one is a sheet that slides over one concrete element of the screen: Statistics over the tree panel, Archetypes over the slots. The rest of the screen stays usable.
- Both can be open at once.
- **Look: to design later.** Make them work first with a plain frame, then redesign.

**Escape menu:** centered, with its own mask, above everything that was open before it. Submenus (Build, Settings, About) switch the content inside the menu, they are not new layers. Esc in a submenu goes back to the menu's main list; Esc there closes the menu. The only popups that open over the menu are confirmations (load over a non-empty build, reset saved data).

**Escape menu look (as in-game):**
- A black sheet behind the options. Not a plain black band: it has an asymmetric texture, like a torn piece of black cloth.
- The options are text only. Hovering one shows the Witcher's distinctive border around it.
- The mask behind the sheet is a fainter black than the sheet itself.
- **Assets (done 2026-10-04):** `menu/sheet.png`, `menu/frame.png`, `menu/title-underline.png` and `menu/logo.png`, extracted from `panel_ingamemenu.redswf` in `r4gui.bundle` by the asset recipe.

**Fonts (decided):** D-DIN everywhere, like the game, long text (About) included.

**Mockups (decided):** none. Build the real components directly and adjust them in place.

Under these goes one shared **layer manager** (a stack of open layers):
- The newest layer is on top, whatever its kind (a confirm popup opened from the menu sits above the menu).
- Esc closes the top layer. With side panels, that's the one opened last.
- Modal layers (popups, the menu) put the mask under themselves, hold focus and make everything below inert. Side panels do none of that, they only take part in the Esc order.
- The key legend shows the top layer's keys.
- With nothing open, Esc opens the menu.

Apply mode becomes one layer in that stack. This keeps the overlays from each handling Esc, focus and the mask their own way.

**Done (2026-10-04):** the layer manager is `ui/layers.js` (tests in `test/layers.test.js`). The Reset popup, apply mode and drag-to-equip run on it.

**Esc menu, first pass (2026-10-04):** `ui/menu.js`, art and measurements in [game-assets.md](game-assets.md#esc-menu-panel_ingamemenuredswf-menulistmodule-layoutmenujson). Esc with nothing open opens it (in a text field, the first Esc only leaves the field); the legend has an `Esc Menu` button. Items: Resume, Build (greyed out, TODO in item 5), Settings (Reset saved data, with a confirm), About. The asset demo page was removed (2026-10-04), along with the visible title and page tabs. The menu draws its own key hints (E Select, Esc Back / Close) bottom right, like the game's menu; a general "legend shows the top layer's keys" isn't needed yet.
- Hover frame: checked against `docs/reference/escape_menu.png`. In game it is the notched double frame (`SelectedFrameRef`) at half scale, light gray, 59 px tall over 43 px rows (docs/game-assets.md).
- Logo (2026-10-04): the game's logo (`menu/logo.png`) above the title on every page, placed from the game data; the main page's title is "Build planner". The fan content notice is at the bottom of every page (About has it in its text).
- Decided (2026-10-04): the build name stays under the menu title, and Reset saved data closes the menu.
- Left for item 2: the side panel block (no side panel exists yet; it comes with items 3 and 4).

## 3. Statistics panel (C)

**Goal:** press C to slide the left side panel (item 2) over the skill tree, leaving the slotted skills visible and usable. It shows everything active in the current build.

**Possible content:**
- **Points:** total (editable), spent, left, spent per tree, and each tree's passive bonus (adrenaline gain etc.).
- **Active effects:** each slotted skill with its effect at its current rank (needs item 1).
- **Mutagens:** each group's mutagen, how many slotted skills match its color, and the total bonus per stat.
- **Summed stats:** bonuses added up across skills, passives and mutagens (e.g. total sign intensity, total adrenaline gain). Only possible once item 1 is stored as numbers.
- **Unslotted skills with points:** points spent on skills that aren't slotted (allowed, but often a mistake).
- **Archetype coverage:** e.g. "Crossbow 4/6".

No Clear tree / Clear all: Reset abilities (R) already covers it.

**Recommendation:** yes, move the whole points bar into this panel. In-game, the screen itself only shows POINTS AVAILABLE, and the app already shows that, editable. Clearing the build is already on R (Reset abilities) in the legend. Nothing in the bar has to stay on the main screen.

**To decide:**
- Is the budget field in the panel the same as the POINTS AVAILABLE field on the screen, or does only one of them stay editable?
- C toggles (press again to close) or C opens and Esc closes? Recommendation: both.

## 4. Archetype highlight

**Problem:** the highlight shows up in the tree. A picker inside the Statistics panel would cover the tree it's highlighting, so the archetype picker can't go there.

**Options:**
1. **A key plus a small list:** a key (e.g. H, shown in the legend) opens a small list of archetypes on the tree's side, colored by tree. Picking one closes the list and leaves the highlight on, with its name shown by the tree title (e.g. "Highlight: Crossbow ×").
2. **A dropdown in the tree panel header**, next to the tree tabs.
3. **Cycle keys:** keys step through the archetypes with no list. Fast, but hard to discover with 16 archetypes.

**Decided (2026-10-04):** a variant of option 1: H slides the right side panel (item 2) over the slots with the archetype list. The tree stays visible and usable, so the highlight can be checked while the list is open. The Statistics panel can still show coverage numbers (item 3).

**To decide:** one archetype at a time or several (currently chips toggle)? Does picking an archetype switch to its tree?

## 5. Share build

**Now:** a card under the screen with build name, Copy code, Export file, a paste box, Load code, Import file (`ui/share.js`). The Esc menu has a Build item, greyed out until this item is designed.

**Recommendation:**
- Replace the card with three actions, each with a key hint (bottom corner, or in the legend row):
  - **Copy:** copies the code straight away, with a short toast ("Code copied").
  - **Save:** downloads the build file.
  - **Load:** a paste box that accepts a code or a link, and a "Choose file" button. Dropping a file works too. Loading over a non-empty build asks for confirmation (popup, item 2).
- **TODO:** the concrete form of the Build submenu in the Esc menu (load, save from file or link, rename) is still open. The owner has an idea; settle it when we get there.
- **Build name:** it's already saved in the code and the file, so loading restores it. Show it in the browser tab title, the Esc menu and the Statistics panel (item 7). Rename it from the Build submenu.
- **Share links:** "paste a url" implies links that load a build. That's new. Use a query parameter (`?b=W3R1…`). The hash used to pick the page; with the page tabs removed (`pages.js` is gone) it's free too, so either works. On load, apply the build, then remove the parameter so a refresh doesn't overwrite later changes.

**Quick-access buttons (decided: they exist, design open):** besides the Build submenu, a few buttons sit on the main screen for quick access.
- Style: like the legend's key buttons.
- Icons: the game's save icon could be used for Save. Nothing in the game art matches Copy or Paste.
- **To design:** where they sit, which buttons (Copy, Paste/Load, Save?), and the icons for Copy and Paste.

**To decide:**
- Is Copy a code or a link? Recommendation: a link, since a link also works as a code when pasted.

## 6. Settings and info

All of this lives in the Esc menu (item 8): Settings and About are submenus there. Picking About switches the menu content to the About text.

**Done (2026-10-04):**
- **Reset saved data**, with a confirm popup (Settings).
- **About:** what the app is, that the skill text isn't in yet, the fan content notice.

**Left:**
- **Background:** pick a region (10 exist, `backdrop.setRegion`) or auto-cycle through them, with a cycle interval.
- **Hold speed:** the time to level a skill up by holding (now fixed at `HOLD_MS` = 1000 ms, as in-game). Include an "instant" option.
- **About:** a link to the repo, and the data sources in more detail once item 1 is in.
- Possibly later: reduce motion (pulsing borders).

**Settings storage:** a separate `localStorage` key from the build, so loading a build never changes settings.

## 7. Full-screen layout

**Observation:** without the title and the page tabs, the planner fits the window top to bottom, legend included, like the game screen. The browser's own tabs, address bar and bookmarks take the place of the game's top menu bar, so it looks full screen in a normal window. There is no free strip for a title.

**Done (2026-10-04):** the visible title and page tabs are gone; the `<h1>` is visually hidden. The Esc menu shows the build name under its title, a short notice on every page, and the full text in About.

**Left:** move the points bar (item 3), archetype chips (item 4) and share card (item 5) off the area under the screen, set the browser tab title from the build name, and replace the footer with the faint corner notice.

**Recommendation:** go full screen.
- Keep the `<title>` (browser tab, bookmarks, link previews) and keep an `<h1>` for screen readers, visually hidden. The browser tab is the page title.
- **Build name:** no spare strip on the main screen, so it lives elsewhere:
  - in the browser tab: `<title>` becomes "Crossbow and bombs - Witcher 3 Remastered Build planner" when the build has a name,
  - in the Esc menu under the logo, where it can also be renamed (item 8),
  - at the top of the Statistics panel (item 3).
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

Opinion, not legal advice: a notice that only appears in a menu or the About page is arguably not "obvious". Decided (2026-10-04): the main screen footer was removed anyway; the notice lives in the Esc menu, which the legend points to (`Esc Menu`).

## 8. Navigation: menu versus separate buttons

**The worry:** C for stats, H for archetypes, settings and share buttons could add up to a cluttered screen.

**Decided (2026-10-04):** an **Esc menu** that looks like the game's, but centered (item 2), with buttons that open submenus inside the menu:

- Resume
- Build: a second way to copy, paste, save and load the build, and rename it (concrete form is a TODO, see item 5)
- Settings (item 6), including Reset saved data
- About: the menu content switches to the About text
- Any leftover buttons and links that come up later

Esc order with the layer manager (item 2): Esc closes the top layer if one is open (apply mode, popup, side panel). With nothing open, Esc opens the menu.

That makes the menu the one place that lists everything, so nothing else has to be on screen. The main screen keeps only what the game has (trees, slots, points, legend). The fan content notice is in the menu. The build name is shown in the menu under the logo. The legend shows `Esc Menu` (done) and `C Statistics` (with item 3), so people can find both.

The main screen also keeps the quick-access build buttons (item 5); their design is still open.

**Logo (decided 2026-10-04):** used in the Esc menu only, as in game. It is CDPR's trademark; the fan content rules don't forbid it (see item 7), but an official logo can make the site look official. So the menu shows the notice on the same page, keeps its own "Build planner" title, and the logo stays out of the main screen, favicon, link previews and README. Opinion, not legal advice.

**Menu items (done in the first pass):** plain text rows like the game, no icons.

## 9. Trying it out before building it

Several items are "decide after seeing it". Cheap ways to see them:
- No static mockups (decided in item 2): build the real components and adjust them in place.
- Screenshot comparisons against `docs/reference/` with `tools/compare_screen.py` for anything that copies a game screen.
- Build the full-screen layout (item 7) first on a branch. Most of the other placement questions get easier once that's in place.

## 10. Character level and slot unlocks (optional)

**Now:** every socket and diamond is open. The lock art (`slots/lock.svg`) and the apply-mode rule that locked holders can't be picked are documented in [game-assets.md](game-assets.md) but not used.

**Goal:** slots open at character levels, as in-game. It works both ways:
- **Level first:** pick a level. Slots above it show locked and can't take anything.
- **Build first:** every slot stays usable. The build shows a **required level**: the lowest level that has every used slot open.

**Recommendation:**
- One data table, slot index to unlock level, e.g. `rules.slotLevels`. Both modes read it. Only the "is this slot locked" check differs:
  - level mode: `slotLevel > level`,
  - build mode: never locked, and required level = highest `slotLevel` among the used slots.
- Put that check in the planner core (`slotKinds.js`), which already decides where an item can go. Apply mode, drag and drop targets then respect locks with no changes of their own.
- Store the level (or "no level") in the build, as a new optional field in the build data (`l`). Old codes without it load in build-first mode.
- Show it next to POINTS AVAILABLE or in the Statistics panel, depending on space.
- Take the unlock levels from the game files, not wikis. The Remastered patch may have changed them.

**To decide:**
- Should the level also set the point budget? Points come from levels and from places of power, so the level only gives a starting point.
- Where the mode switch and the level field go: Statistics panel or main screen.

## 11. Blood and Wine mutations (later)

**Goal:** the Mutations system from the Blood and Wine expansion: research mutations, equip one, and get the extra skill slots that researched mutations unlock.

**What's already there:**
- The Mutations tree background (`tree/bg-mutations.png`, the 5th frame of the tree panel) is in the asset set.
- The rest of the Mutations panel art was left out on purpose: silhouette, vignette, mutation orbs, research progress, `MutationTooltip*`. See "Out of scope" in [game-assets.md](game-assets.md).

**Needed:**
- **Data:** each mutation's effect, research cost (skill points and mutagens) and which mutations it needs first. Also how many researched mutations open each extra slot. Take all of it from the game files, like item 1.
- **Assets:** a recipe pass for the Mutations panel art and the mutation icons in `tools/build_ui_assets.py`.
- **Rules:**
  - Research spends skill points, so it shares the budget with the trees.
  - The extra slots are more sockets, so the planner needs a variable slot count (now a fixed `slotGroups × slotsPerGroup`).
  - Only skills matching the equipped mutation's color can go in the extra slots (to confirm in-game).
- **UI:** in-game it's a separate panel, so it fits as its own screen or a 5th tab using the existing tab and layer system (item 2).
- **Build data:** researched and equipped mutations as new optional fields, so old codes still load.

**Recommendation:** don't start this before items 1 and 10. It reuses the extraction tool from item 1, and it needs the variable slot count, so build that slot model (slots that can be locked) with item 10 in a way mutations can extend. It can also wait for the asset recipe and the layer manager.

**To decide:** does the build track which mutations are researched (and their cost in points), or only the one equipped?

## 12. Removing a skill point on touch screens

**Problem:** on mobile everything works except taking a point off a skill. Desktop uses right-click (or `-` / Delete with focus). On touch, holding a skill adds a point (`ui/hold.js`), so a long-press can't also mean "remove".

**Now (from the code, not tested on a device):** `tree.js` removes a point on `contextmenu` unless a hold is running, and a hold only starts on a skill that can take a point. So on Android Chrome a long-press on a maxed or blocked skill probably removes a point; iOS Safari doesn't fire `contextmenu` on long-press, so nothing happens there. That's accidental behavior.

**Recommendation:** a **"−" control on the selected skill**. A tap already selects a skill; when the selected skill has points, draw a small "−" badge on its corner (or a "− rank +" bar under the tree). Tapping it runs the same `planner.removePoint` action as right-click.

- Discoverable, one extra tap, no clash with hold-to-add, double-tap-to-equip or drag.
- Fits the existing model (tap selects, actions act on the selection).
- Make it part of the selected node's view in `gamePanels.js` rather than a touch-only overlay, so the slots can reuse the pattern later (e.g. an "×" on a selected socket to unequip, as an alternative to double-tap).
- Drop the touch long-press `contextmenu` removal at the same time, so touch has one way to remove and Android and iOS behave the same.

Rejected: a "Remove points" mode toggle (easy to forget it's on), long-press removes when the skill can't take more (same gesture, hidden state), swipe or two-finger gestures (undiscoverable, clash with drag and scroll).

**To decide:** show the "−" on every device, or only on touch (`pointer: coarse`)? Showing it everywhere also helps desktop users who never find right-click.

## Suggested order

1. ~~Layer manager (item 2) on its own, with tests. Port the Reset popup and apply mode onto it, with no visible change.~~ Done 2026-10-04.
2. Then the screens one at a time, each on the finished layer manager:
   1. ~~Escape menu (items 2 and 8), including the asset pass for the torn sheet and hover border.~~ First pass done 2026-10-04; the open points are in item 2.
   2. Full-screen layout with the notice moved (item 7). The Esc menu takes over Share and Settings, which removes the cards below the screen.
   3. Build submenu, quick-access buttons, Copy toast, share links (item 5). Needs the TODO design first.
   4. Settings and About submenus (item 6).
   5. Archetype side panel (item 4), plain frame first.
3. Skill data extraction tool and data (item 1). Can run alongside 1 and 2, it's independent.
4. Statistics panel (item 3). Needs item 1 for its best parts (active effects, summed stats).
5. Level and slot unlocks (item 10). Optional. Design the slot model so mutations can extend it.
6. Blood and Wine mutations (item 11). Last: needs items 1, 2 and 10 and a new asset pass.

Item 12 (touch point removal) is small and independent; it can go in at any point.
