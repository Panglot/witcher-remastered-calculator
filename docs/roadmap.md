# Roadmap

Only open work, in the order to do it. Finished work lives in the commits. Each item has what's **Left** and **To decide** (questions only the owner can answer). Recommendations are opinions, open to change. Code comments point at items by name, not number.

## Overview

| # | Item | Left |
| --- | --- | --- |
| 1 | Touch screens | Point removal, legend glyphs |
| 2 | Small polish | Small and portrait screens, About data sources |
| 3 | Statistics, second pass | Total points research, effects and summed stats |
| 4 | Archetypes, second pass | Recap and research, name, toggle tooltip, panel text |
| 5 | Level and slot unlocks (optional) | Everything |
| 6 | Blood and Wine mutations (later) | Everything |

## 1. Touch screens

### Removing a skill point

**Problem:** on mobile everything works except taking a point off a skill. Desktop uses right-click (or `-` / Delete with focus). On touch, holding a skill adds a point (`ui/hold.js`), so a long-press can't also mean "remove".

**Now (from the code, not tested on a device):** `tree.js` removes a point on `contextmenu` unless a hold is running, and a hold only starts on a skill that can take a point. So on Android Chrome a long-press on a maxed or blocked skill probably removes a point; iOS Safari doesn't fire `contextmenu` on long-press, so nothing happens there. That's accidental behavior.

**Recommendation:** a **"−" control on the selected skill**. A tap already selects a skill; when the selected skill has points, draw a small "−" badge on its corner (or a "− rank +" bar under the tree). Tapping it runs the same `planner.removePoint` action as right-click.
- Discoverable, one extra tap, no clash with hold-to-add, double-tap-to-equip or drag.
- Fits the existing model (tap selects, actions act on the selection).
- Make it part of the selected node's view in `gamePanels.js` rather than a touch-only overlay, so the slots can reuse the pattern later (e.g. an "×" on a selected socket to unequip, as an alternative to double-tap).
- Drop the touch long-press `contextmenu` removal at the same time, so touch has one way to remove and Android and iOS behave the same.

Rejected: a "Remove points" mode toggle (easy to forget it's on), long-press removes when the skill can't take more (same gesture, hidden state), swipe or two-finger gestures (undiscoverable, clash with drag and scroll).

**To decide:** show the "−" on every device, or only on touch (`pointer: coarse`)? Showing it everywhere also helps desktop users who never find right-click.

### Legend glyphs

**Problem:** the legend (`ui/legend.js`) shows mouse and keyboard glyphs: left / right mouse button, double-click, E, Space, R, C, A, Esc. On touch there's no mouse or keyboard, so the glyphs describe controls the user doesn't have. The general items (Statistics, Archetypes, Menu, Reset abilities) are clickable, so they still work as buttons; the skill items (Acquire, Remove point, Equip, Unequip) are only hints.

**To decide:**
- What replaces the glyphs on touch (`pointer: coarse`): touch gesture glyphs (tap, hold, double-tap, drag), text only, or no glyphs?
- Do the skill hints stay at all on touch, or does the legend keep only the tappable general items? Ties in with the "−" control above: if it lands, "Remove point" becomes a visible control rather than a hint.
- Does the game have touch or gamepad glyph art worth extracting for this (gamepad glyphs are in the game files; touch glyphs probably not)?

## 2. Small polish

- **Small and portrait screens:** the screen can't fit. To decide: scale down, or scroll?
- **About:** list the data sources in more detail (skill text comes from the game files, see "Skill text" in [game-assets.md](game-assets.md)).

## 3. Statistics panel, second pass

**Left:**
- Research how many skill points the game gives in total, with a breakdown: points from levels and points from places of power. Show it in the no-header section.
- Active effects (each slotted skill at its rank) and summed stats (e.g. total sign intensity), from `values` in `data/skillText.js` (`core/skillText.js`, `rankValues`). Skill numbers show only here and in the tooltip, nowhere else.
- Mutagen bonuses stay hand-written data, not extracted.

## 4. Archetypes panel, second pass

**Now:** `data/archetypes.js` has 16 hand-picked archetypes (combat 4, signs 5, alchemy 5, general 2), each a name, a tree for the chip color and a list of skill ids. The panel (`ui/archetypes.js`) lists them per tree; pressing one frames its skills in the tree. The toggle hint is "Highlight the skills of a play style in the tree." The intro note reads "Pick an archetype to frame its skills in the tree. The count shows its skills with points." and, once any are picked, "N highlighted. Their skills are framed in the tree." with a "Clear highlight" link.

**Left:**
- **Recap and research:** check that the current archetypes are all we need. Compare against the play styles the community actually builds (and the Remastered patch changes), look for missing ones, overlaps (e.g. Evasion and Adrenaline economy share skills) and wrong skill picks. Confirm each skill list against the skill text (`data/skillText.js`), not wikis.
- **Name:** is "Archetypes" the right word, or does something like "Play styles" or "Builds" read better? The name shows in the panel title, the legend (`ui/legend.js`) and code comments.
- **Toggle tooltip:** rewrite the hint on the toggle so it says what the panel does in plain words.
- **Panel text:** rewrite the intro note for both states (nothing picked, some picked), and decide how it changes when an archetype is selected: a plain count as now, the picked names, or a short description of the selected archetype (would need a description field in `data/archetypes.js`).

**To decide:** the name, and whether archetypes get a one-line description each.

## 5. Character level and slot unlocks (optional)

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
- Show it in the Statistics panel's no-header section, or next to POINTS AVAILABLE if it needs to be on screen.
- Take the unlock levels from the game files, not wikis. The Remastered patch may have changed them.

**To decide:**
- Should the level also set the point budget? Points come from levels and from places of power, so the level only gives a starting point (ties in with item 3's points research).
- Where the mode switch and the level field go: Statistics panel or main screen.

## 6. Blood and Wine mutations (later)

**Goal:** the Mutations system from the Blood and Wine expansion: research mutations, equip one, and get the extra skill slots that researched mutations unlock.

**What's already there:**
- The Mutations tree background (`tree/bg-mutations.png`, the 5th frame of the tree panel) is in the asset set.
- The rest of the Mutations panel art was left out on purpose: silhouette, vignette, mutation orbs, research progress, `MutationTooltip*`. See "Out of scope" in [game-assets.md](game-assets.md).

**Needed:**
- **Data:** each mutation's effect, research cost (skill points and mutagens) and which mutations it needs first. Also how many researched mutations open each extra slot. Take all of it from the game files, like the skill text (`tools/extract_skill_text.py`).
- **Assets:** a recipe pass for the Mutations panel art and the mutation icons in `tools/build_ui_assets.py`.
- **Rules:**
  - Research spends skill points, so it shares the budget with the trees.
  - The extra slots are more sockets, so the planner needs a variable slot count (now a fixed `slotGroups × slotsPerGroup`).
  - Only skills matching the equipped mutation's color can go in the extra slots (to confirm in-game).
- **UI:** in-game it's a separate panel, so it fits as its own screen or a 5th tree tab, on the layer manager (`ui/layers.js`).
- **Build data:** researched and equipped mutations as new optional fields, so old codes still load.

**Recommendation:** don't start this before item 5. It reuses the skill text extraction tool, and it needs the variable slot count, so build that slot model (slots that can be locked) with item 5 in a way mutations can extend.

**To decide:** does the build track which mutations are researched (and their cost in points), or only the one equipped?
