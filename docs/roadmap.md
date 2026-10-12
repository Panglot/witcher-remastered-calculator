# Roadmap

Only open work, in the order to do it. Finished work lives in the commits. Each item has what's **Left** and **To decide** (questions only the owner can answer). Recommendations are opinions, open to change.

## Overview

| # | Item | Left |
| --- | --- | --- |
| 1 | Full asset rebuild fails | Find the cause |
| 2 | Revise mutations design | Check in game once mutations unlock |

## 1. Full asset rebuild fails

**Goal:** `python tools/build_ui_assets.py "<game folder>" public/assets/ui` rebuilds the whole set again.

**Found while adding the mutation art (2026-10-11):**

- A full run stops with `KeyError: 694` in `AtlasSource.build`: an `"image": 694` entry in `tools/asset-recipe.json` names a movie texture the current game files don't have under that id (likely a game patch renumbered it).
- In the same run, `tree/separator.png` came out different from the committed file.
- The mutation art was built with a recipe holding only its own entries, so nothing committed changed.

**Left:**

- Find the current texture id for `menu/sheet.png` (`"image": 694`, the Esc menu's torn sheet in `panel_ingamemenu.redswf`), e.g. with `tools/map_ui_atlas.py`.
- Compare the new `tree/separator.png` with the committed one, and keep whichever matches the game.

## 2. Revise mutations design

**Goal:** the mutations UI matches how the game presents and behaves for mutations.

**Blocked on:** reaching the point in the game where mutations unlock. They can't be checked in game yet, so the current design was built without an in-game reference.

**Left:**

- Once mutations are unlocked, compare the game's mutations screen with ours (layout, art, unlock flow, extra slots, tooltips) and revise the design to match.
