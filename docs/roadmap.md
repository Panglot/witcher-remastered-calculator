# Roadmap

Only open work, in the order to do it. Finished work lives in the commits. Each item has what's **Left** and **To decide** (questions only the owner can answer). Recommendations are opinions, open to change.

## Overview

| # | Item | Left |
| --- | --- | --- |
| 1 | Blood and Wine mutations (later) | Everything |

## 1. Blood and Wine mutations (later)

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

**Recommendation:** build the extra sockets on the slot locks (`core/slotLocks.js`): in the game they are slots 13 to 16 of `geralt_skills.xml`, opened by mutation research instead of points (see "Slot unlocks" in [game-assets.md](game-assets.md)). The data side can reuse the skill text extraction tool.

**To decide:** does the build track which mutations are researched (and their cost in points), or only the one equipped?
