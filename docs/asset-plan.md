# Asset plan: replicating the in-game Character screen

Goal: collect exactly the game art needed to rebuild the Character screen (skill trees, mutagen slots, tooltip, key legend, points counter, locked slots, mutagens), cut to individual files with clear names, and drop everything else. Implementation in the app is a later step; this plan covers assets only.

How the game draws each part, and the tools: [game-assets.md](game-assets.md).

## Status and handoff (2026-10-03)

| Step | State |
| --- | --- |
| 1. Slicer as a real tool | **Done.** `tools/build_ui_assets.py` + `tools/asset-recipe.json` rebuild the set from the game install in ~8 s. `tools/gfx_movie.py` parses the movies directly; FFDec is only used for SVGs. |
| 2. Fill the gaps | **Done.** Tooltip, points diamond, mouse icons, stat glyphs, root timeline positions and backdrop stacking are resolved. Every slice in the three movies is named. |
| 3. Vectors | **Done** through the recipe: node lock, slot lock, slot frame, diamond frame, divider, key cap, connectors. Diamond fills are plain colors, documented as CSS values. |
| 4. Font | **Done.** D-DIN Condensed (SIL OFL), Regular and Bold in `public/assets/fonts/d-din/`. Chosen by the user; checked against the screenshots. |
| 5. Generate and compare | **Done.** The set (131 recipe entries, 274 files, 12 MB) was reviewed by the user and compared with [reference screenshots](reference/). Positions and colors match; the legend turned out to be centered. Details in [game-assets.md](game-assets.md#checked-against-the-reference-screenshots). |
| 6. Delete what isn't used | **Done.** The interim hand-cut files were deleted after the user reviewed the new set. `research/` was trimmed to what the implementation still needs (see [Research folder](game-assets.md#research-folder)). |
| 7. Move to `public/assets/` | **Done.** The set is in `public/assets/ui/` (rebuilt there, byte-identical to the reviewed set, no stale files) and the fonts in `public/assets/fonts/`. All docs point at the new paths. The user commits it themselves. |

**Next:** the asset phase is finished. App implementation (a separate session) starts from [game-assets.md](game-assets.md). Never commit `research/`.

To regenerate or change the set, edit the recipe and run:

```sh
python tools/build_ui_assets.py "<game dir>" public/assets/ui
```

## Corrections found while executing the plan

These change what the first research pass assumed:

1. **Backdrop.** The "silhouette" and "vignette" textures belong to the Mutations panel. Behind the Character screen, `panel_common` draws:
   - `#040404`
   - a location panorama at alpha 0.22 (10 regions, from `texture.cache`)
   - two fog layers
   - the DNA image on top
2. **Tree header bars.** `mcTabBackgrounds` (the old `label-bar-*` files) is used only by the old `CharacterTabbedListModuleRef`, which the live screen never places. The live tree panel is background, frame, tabs and title text. The header bars are dropped.
3. **Mutagen orbs.** `mc_background_color` (the big colored orbs) is the equipped Mutation display in the screen center, which is out of scope. The diamond shows a color fill plus the mutagen's **inventory icon** (`SlotSkillMutagen.loadIcon`), so the `item-*` icons are the right art.
4. **Tooltip.** `SkillTooltipRef` is in `componentslib`, not `panel_common`. It always uses the gray header with a frame overlay; the panel itself is a CSS color.
5. **Stat glyphs and shield** are in `panel_character_dupe` (`mc_bonus_bkg_new`). The shield shows for every color.
6. **Points diamond** is sub 230 (`root.mcPointIcon`).
7. **Node pieces** were misnamed in the plan. `SkillsSlots_ActiveBackground` is a colored *border* (`node/border-*`), and `mc_core_frame` is the core-skill border (`node/core-border-*`).
8. **Key legend** comes from `panel_common`: a vector key cap and four mouse-button bitmaps.

## What the set contains

The full list is in [public/assets/ui/manifest.json](../public/assets/ui/manifest.json). Folders are described in [game-assets.md](game-assets.md#the-asset-set).

```text
public/assets/ui/
  manifest.json    generated: every file, its source, size and notes
  backdrop/        dna, fog, panorama-<region>.jpg (10)
  tree/            bg-<tree> (5), frame, separator
  tabs/            <tree>, <tree>-hover, <tree>-selected, <tree>-bar (x5)
  node/            border-<color>, core-border-<color>, equipped-<color>, equipped-overlay, pip-<color>, pip-off,
                   selected, tooltip-hint, lock.svg
  skills/          <tree>/<skill id>.png (137), skills.json
  slots/           fill-<color>, glow-<colors>, frame.svg, lock.svg, divider.svg, divider-ornament
  mutagens/        item-<color>-<size> (9), diamond-frame.svg, connectors/ (15 svg)
  bonus/           bar-<color>, shield, glyph-<stat>
  tooltip/         header, header-frame
  legend/          mouse-<button>, key.svg
  points/          diamond
  layout/          positions, scales, color transforms and text styles per sprite (JSON)
```

## Dropped on purpose

- Controller button glyphs (Xbox/PS/Switch/Steam): keyboard and mouse only. Easy to add later from the same atlases.
- Mutation art (Mutations panel background and silhouette, mutation orbs, research progress, `MutationTooltip*`): mutations are out of scope for now.
- `panel_character` and `panel_character_perks`, and the old `CharacterTabbedListModuleRef` inside `_dupe`: older versions of the same screen.
- Mutagen decoction potion icons (`mutagen_potions/`) and the `unique` / base mutagen icons: not used by skill mutagens.
- The hidden `perk_8` skill icon.

## Possible follow-ups

- Tree backgrounds are 1212x1406 PNGs with alpha (0.8 to 2 MB each, 7 MB total). WebP would cut that a lot. The builder can write another format by output extension, as it already does for `.jpg`.
- `research/` must stay out of the repo (decompiled CDPR code, raw game data) after everything else is committed.
