# Roadmap

Only open work, in the order to do it. Finished work lives in the commits. Each item has what's **Left** and **To decide** (questions only the owner can answer). Recommendations are opinions, open to change.

## Overview

| # | Item | Left |
| --- | --- | --- |
| 1 | Level and slot unlocks (optional) | Everything |
| 2 | Blood and Wine mutations (later) | Everything |
| 3 | Builds (optional) | Everything |

## 1. Character level and slot unlocks (optional)

**Now:** every socket and diamond is open. The lock art (`slots/lock.svg`) and the apply-mode rule that locked holders can't be picked are documented in [game-assets.md](game-assets.md) but not used.

**Goal:** slots open at character levels, as in-game. It works both ways:
- **Level first:** pick a level. Slots above it show locked and can't take anything.
- **Build first:** every slot stays usable. The build shows a **required level**: the lowest level that has every used slot open.

**Recommendation:**
- One data table, slot index to unlock level, e.g. `rules.slotLevels`. Both modes read it. Only the "is this slot locked" check differs:
  - level mode: `slotLevel > level`,
  - build mode: never locked, and required level = highest `slotLevel` among the used slots.
- Put that check in the planner core (`slotKinds.js`), which already decides where an item can go. Apply mode, drag and drop targets then respect locks with no changes of their own.
- The level is stored in the build already (progress `g.l`, core/build.js); build-first or level-first would be one more optional field. Old codes load in build-first mode.
- Show it in the Statistics panel's Points section, or next to POINTS AVAILABLE if it needs to be on screen.
- Take the unlock levels from the game files, not wikis. The Remastered patch may have changed them.

**To decide:**
- The Statistics panel's Level field (progress, part of the build) already exists: decide whether level mode reads it, or gets its own.
- Where the mode switch and the level field go: Statistics panel or main screen.

## 2. Blood and Wine mutations (later)

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

**Recommendation:** don't start this before Level and slot unlocks. It reuses the skill text extraction tool, and it needs the variable slot count, so build that slot model (slots that can be locked) with Level and slot unlocks in a way mutations can extend.

**To decide:** does the build track which mutations are researched (and their cost in points), or only the one equipped?

## 3. Builds (optional)

**Goal:** ready-made builds (presets) like Spellsword: a named build that loads its skills, slots and mutagens. Unlike skill sets, a build is a combination of themes, not one theme.

**To decide:** where the presets come from (hand-picked, or community builds), and where they are picked (Esc menu, or the Skill sets panel).
