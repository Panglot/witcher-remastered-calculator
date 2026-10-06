# Game assets: where they are and how the game uses them

Research notes from the installed game (next-gen / "Remastered" build, Steam, checked 2026-10-03). Everything here was read from the game files unless marked **unverified** or **likely**. Use it as the reference when rebuilding the Character screen.

- Generated asset set: [public/assets/ui/](../public/assets/ui/), with [manifest.json](../public/assets/ui/manifest.json) describing every file
- Tools: [tools/](../tools/)
- In-game screenshots to compare against: [reference/](reference/)
- Local-only research material: `research/` (gitignored, see [Research folder](#research-folder))

## Regenerating everything

Needs Python 3 with Pillow, and Java (8+) for the vector exports. `G` is the game folder.

```sh
G="D:/Games/Steam/steamapps/common/The Witcher 3"

# The whole asset set + manifest.json, from tools/asset-recipe.json (~8 s)
python tools/build_ui_assets.py "$G" public/assets/ui [--ffdec research/tools/ffdec/ffdec.jar]

# Research: crop every atlas slice of a movie and name it by its users -> catalog.json
python tools/map_ui_atlas.py "$G" gameplay/gui_new/swf/character/panel_character_dupe.redswf research/atlas-map/panel_character_dupe

# Research: movies as plain .swf for JPEXS FFDec
python tools/extract_gfx_movies.py "$G/content/content0/bundles/r4gui.bundle" "swf/character/|swf/common/" research/swf

# Research: print a sprite's placement tree (movie alias from the recipe, sprite id or class, depth)
python tools/sprite_tree.py "$G" character SlotSkillSocketRef 1

# Check: render the screen's bitmaps and compare with docs/reference/fullscreen.png
python tools/compare_screen.py "$G" research/compare
```

Research and check outputs contain game art, so they go under `research/` (gitignored).

To add or change an asset, edit [tools/asset-recipe.json](../tools/asset-recipe.json) and rebuild. The builder lists files in the output folder that the recipe no longer produces.

### Tools

| Script | What it does |
| --- | --- |
| `build_ui_assets.py` | Recipe-driven builder. Source types: `atlas` (movie sub-image, optionally over a solid shape with `"under"`), `cache` (`texture.cache` path), `cursor` (`RT_CURSOR` resource of the game executable), `svg` (FFDec shape or sprite frame, by number or label), `skills` (all skill icons), `placements` (layout JSON of a sprite's named children). New source types are one class each in `HANDLERS`. |
| `game_files.py` | Library: `.bundle` and CR2W readers, `CSwfTexture` atlas textures (DXT5), `texture.cache` reader, Win32 resources of the executable (`exe_cursor`). |
| `gfx_movie.py` | Library: SWF/GFX parser. Atlas images and sub-images, shapes with all fill styles, sprites with frame labels, PlaceObject/RemoveObject, text fields, symbol classes. `display_list(sprite, frame)` gives what is visible on a frame. `GameMovies` loads movies and textures straight from `r4gui.bundle`. Checked against FFDec's dump: all 203 sprites match. |
| `extract_skill_icons.py` | Skill icon export by skill id, plus `skills.json`. Used by the builder; as a CLI it also writes the hidden `perk_8` icon. |
| `render_movie.py` | Library: draws a sprite's bitmaps at their placement matrices (no vectors or text). |
| `compare_screen.py` | Check: renders the Character screen (Signs tab, Novigrad backdrop) and writes it side by side and blended with `docs/reference/fullscreen.png`. |
| `sprite_tree.py` | Research aid: prints a sprite's placement tree with matrices, fills and text styles. |
| `extract_skill_text.py` | Skill names and per-rank tooltip templates with their numbers, to `public/data/skillText.js`. See [Skill text](#skill-text). |
| `w3strings.py` | Library and CLI: reads `<lang>.w3strings` string tables (both the classic and the 5.0 format) by key. |
| `wscript.py` | Library: a small WitcherScript interpreter that runs the game's own UI text functions. |
| `map_ui_atlas.py` | Research aid: crops every slice and writes `catalog.json` (slice, atlas rect, export name, users such as `SlotSkillSocketRef[SC_Red].mcEdgeGlow`). |
| `extract_gfx_movies.py` | Research aid: `.redswf` to plain `.swf` for FFDec. |
| `build_social_card.py` | The link preview image (`social-card.png`) and `favicon.png`, from the committed art in `public/assets/`. No game install needed. |

### Decompiling with JPEXS FFDec

[JPEXS FFDec](https://github.com/jindrapetrik/jpexs-decompiler/releases) v26.3.0 portable, kept at `research/tools/ffdec/ffdec.jar`:

```sh
java -jar ffdec.jar -export script research/decompiled/<movie> research/swf/<movie>.swf
java -jar ffdec.jar -selectclass red.game.witcher3.tooltips.TooltipSkill -export script out research/swf/componentslib.swf
java -jar ffdec.jar -format shape:svg -selectid 254,603 -export shape out research/swf/panel_character_dupe.swf
java -jar ffdec.jar -format sprite:png -zoom 2 -export sprite out research/swf/panel_character_dupe.swf   # all sprites (~4 min)
```

- `-selectid` works for shape and sprite exports. `-selectclass` works for script export.
- With one export kind, files go straight into the output folder; with several, into `shapes/`, `sprites/`.
- Sprites with text fields can crash the SVG export (fonts are imported from `fonts_en`). Export their shapes instead.

## Where things live in the game files

| What | Location | Format |
| --- | --- | --- |
| Character screen (layout, code, textures) | `r4gui.bundle`: `gameplay\gui_new\swf\character\panel_character_dupe.redswf` | CR2W: Scaleform movie + `CSwfTexture` objects |
| Skill tooltip, other shared components | `r4gui.bundle`: `gameplay\gui_new\swf\common\componentslib.redswf` | same |
| Menu frame: background, key legend, top bar | `r4gui.bundle`: `gameplay\gui_new\swf\common\panel_common.redswf` | same |
| In-game Esc menu | `r4gui.bundle`: `gameplay\gui_new\swf\mainmenu\panel_ingamemenu.redswf` | same |
| Skill definitions and their numbers | `xml.bundle`: `gameplay\abilities\geralt_skills.xml` (other abilities: `gameplay\abilities\*.xml`) | XML |
| Skill tooltip text logic | `scripts/game/gui/menus/characterMenuDupe.ws`: `GetSkillTooltipDescriptionForSkillLevel` | Plain text |
| Localized text | `content/content0/<lang>.w3strings` (one file per language, no DLC string files) | Encrypted string table |
| Skill icons, mutagen icons, menu panoramas | `content/content0/texture.cache` (31 GB) | Paged zlib blobs |
| Game logic | `content/content0/scripts/**/*.ws` | Plain text |
| Mouse cursor | `bin/x64_dx12/witcher3.exe`: `RT_CURSOR` 12 (group 102) | 32x32 32-bit DIB with AND mask, hotspot 0 0 |

All bundles are in `content/content0/bundles/`.

Useful scripts: `game/gameplay/ability/PlayerAbilityManager.ws` (skills, mutagen color bonuses, grid loading), `game/gameplay/ability/abilityManagerTypes.ws` (`ESkillColor`), `game/gui/menus/commonMenu.ws` (menu background per world).

**`panel_character_dupe` is the live Character screen.** Its root (`MenuCharacterDupe`) places `CharacterTabbedListModuleDupe`. `panel_character` and `panel_character_perks` are older versions. Inside `_dupe`, `CharacterTabbedListModuleRef` (with the `mcTabBackgrounds` header bars) is also a leftover: nothing on the live screen places it.

### Mouse cursor

The cursor is not in the GUI bundles. Every menu movie has a `MouseCursorRef` (in `componentslib.redswf`, sprite 247), but it is only a transparent 25x39 hit box; on PC the movies call `checkHardwareCursor` and the engine shows an OS cursor. That cursor is the only `RT_CURSOR` resource in `witcher3.exe`: a 32x32 pale gold arrow with a small medallion ring, hotspot at the tip (0, 0). The game has no hand or text variant: it shows the same arrow over buttons. The planner uses it through `--cursor` and `--cursor-pointer` in `styles.css` and keeps the I-beam in text fields.

### Atlas slices (sub-images)

Scaleform movies reference rectangles of atlas textures through two GFX-only tags (FFDec renders them as red squares):

- **`DefineExternalImage2` (tag 1009):** `id u16, format u16, u16, width u16, height u16`, then a length-prefixed export name and a length-prefixed file name (`..._i13.dds`).
- **`DefineSubImage` (tag 1008):** `id u16, atlasId u16, x1, y1, x2, y2` (u16 each).

A slice is used in one of two ways:

- **By a shape fill** (`bitmapId` = sub-image id). Follow shape, sprite and frame label to name it.
- **By name from code** (export name such as `Mouse_LeftBtn.png`, `ICO_PlayS_Share.png`).

Every slice in `panel_character_dupe` (265), `componentslib` (136) and `panel_common` (181) is named one of these ways.

Many slices are 2x assets drawn at 0.5 scale (tree backgrounds, frame, separator, bonus bars). The layout files hold the scale.

## File formats (what the tools implement)

- **Bundle** (`POTATO70`): header 32 bytes, TOC size at offset 16. TOC entries are 0x130 bytes: name (0x100), hash (16), then `offset, 0, size, zsize, crc, compression` as u32. Compression 1 = zlib.
- **`.redswf` (CR2W v164)**: table headers at 0x28 (12 bytes each: offset, count, crc). Table 0 = strings, 1 = names (8 bytes each), 4 = exports (24 bytes: class u16, flags u16, parent, size, offset, template, crc). Properties: one zero byte, then `name u16, type u16, size u32 (includes itself), value` until name 0. Enum and CName values are name-table indices.
  - `CSwfResource` holds the movie: `CFX` + version + length + zlib body. Rewriting it to `FWS` gives a normal SWF (version 15).
  - `CSwfTexture` (`TCM_DXTAlpha` = DXT5): after the properties come `unk u32, mipCount u32`, then per mip `width, height, pitch, dataSize, 16` and raw DXT5 blocks.
- **SWF quirk:** in `PlaceObject3`, a class name string is present only when `HasClassName` is set, not for `HasImage` + `HasCharacter` as the spec suggests.
- **`texture.cache`**: last 32 bytes = `crc u64, usedPages, entryCount, stringTableSize, mipEntryCount, 'HCXT', version 7`. Before that: mip offsets (u32 each), string table, entries (52 bytes: `hash, nameOffset, page, zsize, size, align, width u16, height u16, mips u16, slices u16, mipOffsetIdx, mipCount, timestamp u64, format u8, ...`). Data at `page * 4096`: `zsize u32, size u32, u8`, then a zlib stream. Format 8 = DXT5, 253 = raw RGBA8.

## The asset set

[manifest.json](../public/assets/ui/manifest.json) lists every file with its source and size. Folders:

| Folder | Contents |
| --- | --- |
| `backdrop/` | `dna.png`, `fog.png`, `panorama-<region>.jpg` (10 regions) |
| `tree/` | `bg-<tree>.png` (combat, signs, alchemy, general, mutations), `frame.png`, `separator.png` |
| `tabs/` | `<tree>.png`, `<tree>-hover.png`, `<tree>-selected.png`, `<tree>-bar.png` |
| `node/` | `border-<color>`, `core-border-<color>`, `equipped-<color>`, `equipped-overlay`, `pip-<color>`, `pip-fill`, `selected`, `tooltip-hint` (PNG), `lock.svg` |
| `skills/` | `<tree>/<skill id>.png` (137) + `skills.json` (`skill`, `tree`, `core`, `iconPath`, `file`) |
| `slots/` | `fill-<color>`, `glow-<colors>`, `divider-ornament` (PNG), `frame.svg`, `lock.svg`, `divider.svg` |
| `mutagens/` | `item-<color>-<lesser/normal/greater>.png`, `diamond-frame.svg`, `connectors/corner-<color>.svg`, `connectors/line-<colors>.svg` |
| `bonus/` | `bar-<color>.png`, `shield.png`, `glyph-<sword/sign/plus/person>.png` |
| `stats/` | `shield.png`, `icon-<attack-steel/spell-power/toxicity/additional>.png` (from `panel_inventory`, in `startup.bundle`) |
| `tooltip/` | `header.png`, `header-frame.png` |
| `legend/` | `mouse-<left/right/middle/scroll>.png`, `key.svg` |
| `cursor/` | `arrow.png`: the game's mouse cursor (see [Mouse cursor](#mouse-cursor)) |
| `points/` | `diamond.png` |
| `popup/` | `frame.svg`, `buttons-frame.svg` (message popup, `popup_message.redswf`) |
| `menu/` | `sheet.png`, `frame.png`, `title-underline.png`, `logo.png`, `slider-track.svg`, `option-edge.png` (Esc menu and options list, `panel_ingamemenu.redswf`) |
| `icons/` | `copy`, `export`, `load`, `import`, `share` (PNG): white one-colour glyphs for the Build menu's tools, tinted by the page (see [Icons for the Build menu](#icons-for-the-build-menu)); `dropdown-arrow` (PNG): the side panel sections' arrow |
| `layout/` | Where the game places things: one JSON per sprite with each named child's matrix, color transform and text style |

Colors: `red` combat, `blue` signs, `green` alchemy, `yellow` general, `grey` locked or not learned.

Skill icons are 64x64 glyphs on transparency, no frame. The cache also holds ~205px `_debug` / `_notfunctional` cards under `skills_rework/`; those are placeholders and are skipped. `perk_8` (no tree, hidden core skill, same icon as `perk_6`) is excluded.

### Left out on purpose

- Controller button glyphs (Xbox/PS/Switch/Steam): keyboard and mouse only. Easy to add later from the same atlases.
- Mutation art (Mutations panel background and silhouette, mutation orbs, research progress, `MutationTooltip*`): mutations are out of scope for now.
- `panel_character` and `panel_character_perks`, and the old `CharacterTabbedListModuleRef` inside `_dupe`: older versions of the same screen. Its tree header bars (`mcTabBackgrounds`) are never placed by the live screen.
- `mc_background_color` (the big coloured orbs): the equipped Mutation display in the screen centre. The diamond shows the mutagen's inventory icon instead (`SlotSkillMutagen.loadIcon`).
- Mutagen decoction potion icons (`mutagen_potions/`) and the `unique` / base mutagen icons: not used by skill mutagens.

Possible follow-up: the tree backgrounds are 1212x1406 PNGs with alpha (0.8 to 2 MB each, 7 MB total). WebP would cut that a lot; the builder already picks the format from the output extension, as it does for `.jpg`.

## How the Character screen is composed

Screen size 1920x1080. Positions are in `layout/screen.json` and the other layout files.

### Backdrop (back to front)

1. `#040404` fill (`panel_common`, `MC_IMG_Background_Assets`).
2. Location panorama at native size (3072x1024), top-left at (-23, -2), alpha 0.22 (`mcMenuBackgroundContainer`). `commonMenu.ws` picks it by world: Novigrad, Skellige, Kaer Morhen, White Orchard (summer or winter), Vizima, Isle of Mists, Spiral, Toussaint. `no_mans_land` (Velen) has no case in the script. **Likely** it's the default the container starts with.
3. Fog: `fog.png` stretched to 1500x778, twice, at alpha 0.70 and 0.60. **Unverified:** it may be animated by code.
4. Character screen: `backdrop/dna.png` at (614.9, 130.95).

Checked against `reference/fullscreen.png` by rendering these layers (`tools/compare_screen.py`): the Novigrad panorama at exactly this size, position and alpha, and the DNA image, match the screenshot. The mean brightness is 9.8 rendered vs 9.0 in the screenshot.

The silhouette (1920x1000) and vignette (1920x1080) textures cut earlier belong to the Mutations panel (`MutationPanelRef.mcMutationBackground`), not this screen.

### Tree panel (`layout/tree-panel.json`, module at (83.65, 114.95))

- Background `tree/bg-<tree>.png` at 0.5 scale at (20, 81). The symbol, texture and fade are baked in. Frame order: Combat, Signs, Alchemy, General, Mutations.
- `tree/frame.png` over it at 0.5 scale, same origin.
- Title text (`txtTitle`, 34px white, right-aligned) at (411, 38).
- Five tabs (`layout/tab.json`) at x = 51, 131, 211, 291, 371, y = 34. A tab is `<tree>.png` with `<tree>-bar.png` under it (one shape draws both slices; bounds about (-30, -5) to (36, 47) around the tab origin).
  - Each slice is a bitmap fill with its own matrix (manifest `fill`): the bar at 0.5 scale from (-30, 36), the icon at 0.83 scale from its own corner (Combat: (-18, -5)), so its bottom sits about 12px above the bar.
  - On hover the icon switches to `<tree>-hover.png` (sprite `mcIcon_Over`, its own shape and fill matrix, 0.83 scale).
  - On the open tab, `<tree>-selected.png` (`mcOpened`, 0.83 scale) is shown above the icon. `layout/tab.json` is read from frame `selected_up`, where `mcOpened` is moved to (1, 11) and made opaque; on frame 1 it is hidden at (1, 1). `mcSelectedHighlight` shows only on a selected tab that is not open (`AdvancedTabListItem.setIsOpen`).
  - The count text (`2/22`) is 21px `#aa9578`.
- Skill grid (`mcSkillModule`) at (69.25, 111.6). Node layout and lines: [How the game draws the skill tree](#how-the-game-draws-the-skill-tree).
- Below the panel (screen coordinates): `tree/separator.png` at (138, 905), the label (movie text "AVAILABLE POINTS:", localized at runtime) 32px `#95866e` right-aligned at (167, 917), the value 32px white at (397, 916), and `points/diamond.png` centered at (561.7, 935).

### Tree node (`layout/tree-node.json`, 64x64 socket)

Children, back to front:

1. `colorBorder`: `node/border-<color>`, or `grey` when not learned.
2. `iconLock`: `node/lock.svg` at 0.5 scale.
3. `equipedIcon`: `node/equipped-<color>` full-color square when the skill is equipped. **Unverified** whether `equipped-overlay` is also visible.
4. `coreFrame`: `node/core-border-<color>` (core skills only).
5. `mcColorBackground`: `slots/fill-<color>`.
6. `mcSkillPoints`: rank pips centered at (32, 62). `SlotPointIndicator.setCount` adds one `SkillPointIndicatorSingle` (`layout/pip.json`, sprite 31) per rank, spaced by its width: the 40px `node/pip-<color>` turned 45° at 0.249 scale (about 10px a side, 14.1px corner to corner), so neighbouring pips touch. Frame `on` adds `node/pip-fill` on top.
7. `mcStateSelectedActive`: the frame around the focused piece. A tree node places sprite 465: `node/selected.png` (sub 462) filling a 76 px square at (-38, -38). Sockets and diamonds place sprite 513: shape 511, a white vector double frame with notched corners (`slots/selected.svg`, 73.4 x 69.15), which the socket layout scales (1.199, 1.273) to 88 x 88, about 12 px around the 64 px skill (matches the in-game screenshot). Both sprites are 35-frame loops; in game the border pulses, opacity 100% to 0% and back (seen in `reference/signs.png`; the exact curve has not been read from the frames).
8. `mcCollapsedTooltipIcon`: `node/tooltip-hint.png`.

The skill icon is loaded by code into the slot. The unlock flash is a white fade.

Hold to acquire (`SlotSkillGrid.as`, `startPurchaseAnimation`): E held, or the **right** mouse button held, on a skill that can take a point (`hasRequiredSkillDependency`, level below 3). `HOLD_TIME` is 1 s. Over it, `equipedIcon.mcFullColor` alpha tweens to 1 (linear, 0.95 s), then the purchase fires. `mcHoldAnimBlock` (sprite 448: a 64x64 `#ffffff` square at 50% alpha) grows from y 64, height 0 to y 2, height 62 (linear), and its alpha follows `splitEase(0.75, 0.25)`: 0.5 to 0.375 over the first 75% and to 0 over the rest, each leg smoothstepped. Releasing the button or key, the pointer leaving the skill, or a change of selection cancels it, and `mcFullColor` returns to its alpha in 0.2 s. A double-click equips. The planner uses the left button for the mouse hold. Sockets are `SlotSkillGrid`s too (`SlotSkillSocket`, with its own `mcHoldAnimBlock`), so the hold works on an equipped skill.

### Apply mode (equipping)

Source: `MenuCharacterDupe` (`handleSkillAction`, `startApplyMode`, `endApplyMode`, `handleApplyModeAccept`), `CharacterModeBackground` (sprite 720 `SelectionMode`, root instance `applyMode`), `SlotsListBase.ReselectIndexIfInvalid`.

- Starts from a tree skill with at least one point, or from an inventory mutagen, on Space or a double-click. It needs an unlocked socket or diamond.
- `applyMode` sits at root depth 81, under `moduleSkillSlot` (depth 227), so the slot groups stay bright. Its `mcBackground` is a 1920x1080 `#000000` fill at alpha 0xd9 with a color transform alpha of 0.789, about 0.67 in all. It fades in over 1 s (`Exponential.easeOut`).
- `createSlotAvatar` copies the slot being equipped over the mask, with a `GlowFilter` (`#FFFFB8`, alpha 0.5, blur 8, strength 1), and tweens it to scale 1.1 and alpha 1 over 1 s (`Exponential.easeOut`).
- Equipping a skill makes the diamonds and locked sockets unselectable; equipping a mutagen makes every socket and locked diamonds unselectable. The tab module is disabled and the key legend is hidden.
- The game's own popup: sprite 716 (shape 715, `#0e0d0c` at alpha 0.95 with a `#635449` frame) at (703.7, 933.9) scaled (0.98, 0.32), title `SELECT SLOT` (24 px, `#888478`), and `[E] Accept` / `[ESCAPE] Cancel`. The planner draws the message popup instead (below), by the owner's choice.
- Accept (E or the button, or Space or a double-click on a socket) equips into the selected socket; Escape cancels. Equipping into a full socket replaces its skill; equipping an equipped skill moves it.
- Outside apply mode, Space or a double-click on an equipped socket unequips it (`SlotSkillSocket.handleMouseDoubleClick`).
- The planner preselects the first empty holder (else the item's own, else the first). The game keeps the socket list's current selection when it is selectable, else the nearest selectable one.

### Hover glow

Source: `SlotBase.updateImageLoaderStates`, `SlotBase.handleMouseOver`, `SlotsListBase.handleItemMouseOver`.

- Hovering a slot with the mouse never selects it (the list only fires `ITEM_ROLL_OVER`). It puts a `GlowFilter` on the slot's image loader: `OVER_GLOW_COLOR` 15990722 (`#F3FFC2`), alpha 1, blur 15 x 15, strength 0.75, `BitmapFilterQuality.HIGH`.
- Only when the slot is not empty, not drag-selected, and shows no indicator (selection frame, drop target, drop ready). Nothing glows while dragging.
- The filter sits on the loader, around its content's alpha, so a faded (locked) skill icon glows faintly.
- The planner draws it from a copy of the icon under the icon, through a glow-only SVG filter (`OVER_GLOW` in `gameArt.js`, `glowFilters` in `gamePieces.js`), in the piece's own units. Filtering the icon itself re-rasterized it and blurred icons at fractional positions. Inventory mutagens use a smaller blur (by eye): at the game's value the glow spread far past their cell. **Unverified:** whether the game's glow shrinks with the diamond's 0.61 scale; the planner's does.

### Drop targets (hovering an item)

Source: `SlotsTransferManager` (`handleMouseOver`, `showDropTargets`, `highlightDropTargets`), `SlotBase.getTargetIndicator`, `SlotSkillSocket.canDrop`, `SlotSkillMutagen.canDrop`, `SlotsListBase.applySelectionContext`.

- With the mouse, hovering anything that `canDrag` (a tree skill with a point that is not a core skill, an equipped socket, an equipped diamond, an inventory mutagen) sets `dropSelection` on every drop target whose `canDrop` passes, except the hovered slot itself. With a gamepad the selected item does the same. Leaving the item clears them.
- Those slots show `mcStateDropTarget` (sprite 509): sprite 508 at (-32, -32) with alpha 0.6, holding shape 507, a 1 px `#ffcc00` 64x64 square outline. The planner draws it as a vector rect (`gameArt.js`, `DROP_TARGET`) with a 1 px non-scaling stroke: as an image it blurred and lost an edge on the turned, scaled-down diamond. Full and empty slots both show it (seen in game: a full diamond shows it inside its frame, around the mutagen).
- Indicators fade in and out over `INDICATE_ANIM_DURATION` (1.5 s, `Strong.easeOut`). The selection frame takes priority over it; `mcStateDropReady` (sprite 506, a `#ff9900` fill at alpha 0x1e) shows only while dragging over a slot.
- Sockets light for skills only (`canDrop` needs a `skillType`, and checks `colorBorder` colours). By the code, `SlotSkillMutagen.canDrop` would accept a hovered skill too, but in game the diamonds stay dark then; the planner lights only the holders of the hovered item's kind.

### Message popup (`popup_message.redswf`, `SystemMessageModuleRef`, `layout/popup.json`)

The "Are you sure you want to quit?" popup. The Reset abilities mod (`modResetAbilities`) opens it through `ConfirmationPopupData`, and the planner uses its look for every popup.

- Page mask: `#000000` at alpha 0.6 (`mcBackground`, shape 182).
- Module centred at (958.6, 264.1). Panel `popup/frame.svg` (shape 174: `#0e0d0c` at 0.95 with a `#423831` double frame), placed at (-280.45, 3.6) and scaled (1.097, 0.656), so about 564 x 265.
- `tfTitle` at y 24.15: 24 px, `#888478`, centred. `tfMessage` at y 67.4: 24 px, `#eddec1`, centred, 501 px wide.
- `mcInputBackground` (`popup/buttons-frame.svg`, shape 176: `#0e0d0c` with a `#241d17` frame, 341 x 49) at (-168.8, 242.15), across the panel's bottom edge.
- Button label colors (`ModuleInputFeedback.getColorByNavCode`): accept (A) `#1C971C`, back (B) `#9E2828`. Button background: `InputFeedbackButton_kb_background`, `#b4a17c` through a color transform (mult 0.1, add 23/22/22), about `#292623`.
- Measured from an in-game "Load saved game" screenshot (scale about 0.91), which the planner follows over the values above: the button fill is `#161515` (the transform's add alone) inside a 1 px `#0c0b0a` ring and a faint `#141313` outline, 36 px tall, 16 px apart, with the key text grey (`#cecece`). The button strip shrinks around its buttons (about 12 px from its outer edge) and is 55 px tall, centred on the panel's bottom edge. Under the title is a 63 px header band: a faint warm glow brightest at the centre (`#463a28` at 0.035 to 0.1 over the panel) ending in a 3 px line (same colour, 0.05 to 0.19). Text starts 20 px under the band and ends 21 px above the strip.

### Esc menu (`panel_ingamemenu.redswf`, `MenuListModule`, `layout/menu.json`)

The in-game menu (`IngameMenu`) is a list module at (333, 370) on the screen, left of centre. The planner centres it.

- Sheet: `menu/sheet.png` (texture 694, 400 x 1080, a whole texture rather than an atlas slice), a black strip with torn left and right edges that fades to brown at the bottom. Shape 695 stretches it to 369 x 1920 centred at y 162.85, at alpha 0.95, so it runs past the top and bottom of the screen. The planner widens the column from 340 to 390 for its longer text, and the sheet with it (419 x 1920).
- Title `txtMenuListTitle` at y -75.95: 26 px, `#72635b`, centred, 341 wide. Under it `mcMenuTitleUnderline` (`menu/title-underline.png`, sub 449, 8 x 3 of `#4a3429`) stretched to 203 x 3, alpha 0.39.
- Items `MenuListItemCommon` at y 0, 42, 84, ...: text 24 px `#979797`, centred, 284 wide at x -141, in capitals (`_CapitalizeAll`). Code colours: unavailable `#555555`, a Back item white while not selected (`W3MenuListItemRenderer.updateText`).
- Selection `mcFrame` (sprite 692, states `selected_*`): a plain white box (shape 690, 339.7 x 61.35 at (-169.9, -15.3)), height set to the text height + 33, its alpha pulsing 1 > 0.4 > 1 over 26 frames at 30 fps. No filters or blend mode, so in the movie data it really is a white box. In game (`docs/reference/escape_menu.png`, 1080p) the frame is 340 x 59 centred on the item text, two 1 px light gray (about `#c5c5c5`) lines 3 px apart with notched corners: `SelectedFrameRef` (`menu/frame.png`, sub 389, 286 x 286, 2 px `#5d4d42` lines in 14 px corners) at half scale, tinted. Items are 43 px apart, so the frame overlaps the rows next to it and ends about 7 px above the next item's letters. The planner draws `menu/frame.png` 9-sliced (14 px slice at 7 px) at 59 px with `filter: grayscale(1) brightness(2.6)` and the movie's pulse.
- Description `txtMenuListDescripion` at y 325.8: 24 px `#979797`, centred.
- Logo `mcGameLogo` (`mcGameLogoRE_28`, one frame per language, 1024 x 501 slices) at (-1, -227), scale 0.22855. Frame EN is `menu/logo.png` (sub 697, drawn by shape 698 at 2.05x from (-1034, -491)), so on screen it is 480 x 235 with its top left at (-237, -339) from the first item and its bottom 28 px above the title. It is wider than the sheet; its transparent margins hide that.
- Key hints: `mcInputFeedbackModule` at (1735, 1023), bottom right.
- `mcBlackBackground` (`MC_IMG_Background_Assets`) is a full black backdrop with fog, shown behind submenus that hide the game. The planner uses the popup's 0.6 mask instead, fainter than the sheet.

### Options list and sliders (`panel_ingamemenu.redswf`, `OptionListModuleRef`, `W3SubMenuListItemRenderer`)

The game's options screens (Video, Gameplay, ...) put the menu list on the left and the option rows on its right. In `docs/reference` terms: rows from (562, 172) on the 1080p screen, 1167 x 77, 78.5 apart (`mcOptionListItem1..9` at y -68, 10.5, 89, ...). The planner uses this layout for menu pages with options (`ui/options.js`, `ui/menu.js`).

- Row background `ListItemBG_189` (shape 341) at (-150, -7) of the item: a white linear gradient across 1167 px (alpha 0x0a to ratio 55, 0x08 at 146, 0 at 255) and the brown bar `menu/option-edge.png` (sub 340, 8 x 77) at its left end, 1:1.
- Text, in row-background coordinates: name `textField` at x 31, 24 px `#adadad`, white on the `selected_*` frames. Current value `tfCurrentValue` 26 px white, right-aligned in a box ending at x 829. A toggle shows "off" in `#808080` (`OnSliderValueChanged`, 8421504).
- Slider at (870, 42) (`initSlider` / `initToggleSlider`: x 720, y 35 on the item). The option type picks the art: `Toggle` uses `SubMenuSliderToggle`, 140 wide, offsets 35 / 45; `List` and `Slider` use `SubMenuSlider`, 296 wide, offsets 32 / 35 (200 / 100 inside dropdowns). A `List` slider has one step per choice (`maximum` = choices - 1, `snapInterval` 1).
- Track (`sliderTrackToggle` shape 15, `sliderTrack_options` shape 21): the same notched double outline, `#45362d` at alpha 0.45, bounds x -8.1..368, at y -0.9 in the slider. Both sprites have a 9-slice grid at x 4 / 356 (`DefineScalingGrid`), so stretched to the slider width the corners keep their size. `menu/slider-track.svg` is shape 15 (30 tall, no invisible hit strip).
- Thumb: a rounded bar (radius 4), `#a8a5a3`, `over` frame `#b7b5b3` (toggle `#bdbbb9`); 51.3 x 15.05 (`sliderThumb`, inside a 68.1 wide invisible hit shape) or 68.3 x 15.05 (`sliderThumbToggle`), from y -7.9. CLIK's `Slider.updateThumb` puts its left at `(value - min) / (max - min) * (width - offsetLeft - offsetRight) - thumb.width / 2 + offsetLeft`, `thumb.width` being the hit shape's width; the bar starts 0.6 into it. Checked against a 1080p screenshot of the Interface options: list thumb at 0 from x 1430 to 1480, toggle thumb 1433..1500 off and 1493..1560 on.
- Input (`W3Slider`, CLIK `Slider`): left / right step by one and stop at the ends, the A button steps up and wraps to the first value, pressing the track jumps to the nearest value, the thumb drags. Clicking a toggle row flips it (`activate`).

### Icons for the Build menu

Searched 2026-10-04: every named image in the 125 UI movies of `r4gui.bundle` and `startup.bundle`, every class name matching save / load / copy / share / download / upload, and contact sheets of every atlas slice in `panel_ingamemenu`, `photomode`, `panel_startup`, `panel_modmenu`, `popup_overlay` and `panel_overlay`.

- **No copy, paste, upload or share icons by name.** `ICO_PlayS_Share.png` and `ICO_Switch_Share.png` are controller button glyphs.
- **Save:** the save indicator (`IndicatorSave_3` in `popup_overlay`, `OverlayPopupMenu.mcIndicatorLoad`; the same in `panel_mainmenu_autosavewarning`): a parchment save card (sub 173, 45 x 54) inside a turning ouroboros ring (sub 169, 111 x 111), both drawn at 0.6. `photomode` also has a flat floppy disk (sub 66, a photo mode tab icon).
- The next-gen menus have flat white icons (Material-like, not the Witcher style):
  - `panel_ingamemenu`: download arrow into a tray on a grey disc (sub 55, `DownloadButtonRef`; frame `down` is sub 57, light disc), a box with an arrow out of its corner (sub 470, `MarketingConsentPopupRef`), plus, gamepad, cloud with devices, overlapping squares, eye and "..." (subs 82 to 96, the patch notes popup `nge_update_icon_125`)
  - `photomode`: overlapping squares (sub 62), floppy (66), crop, aperture, contrast, weather, person (tab icons)
  - `photomode` sub 281: an upload arrow out of a tray in a dark circle, but it is the Xbox Share button glyph (`HintButtonRef.mcIconXbox`) and the glyph is only about 36 x 21.

What the planner uses (`icons/`, cut by the recipe's `mask` / `trim` / `canvas` / `arrow` options into white glyphs on transparency). The arrowhead is drawn, not game art: the side panel toggle's triangle made exactly twice as wide as tall, so its sides run at 45 degrees like the floppy's cut corner. Every icon sits on a square canvas sized so the glyphs show at one scale (the floppy is 80 of 108 px).

| Tool | File | Source |
| --- | --- | --- |
| Copy code | `icons/copy.png` | `photomode` sub 62 |
| Export file | `icons/export.png` | `photomode` sub 66 (floppy), the arrowhead above it pointing up |
| Load code | `icons/load.png` | `popup_overlay` sub 173 (the save card), filled solid (the game draws it partly see-through), its two lines cut out a pixel thicker |
| Import file | `icons/import.png` | `photomode` sub 66, the arrowhead below it pointing up |
| Copy share link | `icons/share.png` | `photomode` sub 66, the arrowhead pointing out of its cut corner |

The side panel sections' arrow, `icons/dropdown-arrow.png`, is the dropdown lists' own: `panel_alchemy` sub 73, 18 x 14, `#4a3829` in the game. `DropDownArrows_76` (placed as `IconDropDownListItem.mcOpenedState`) draws it pointing down on frame `closed` (shape 74) and flipped on `opened` (shape 75). The crafting, glossary, journal, world map and mod menu panels have a `DropDownArrows` sprite too (not compared).

### Tooltip (`componentslib`, `SkillTooltipRef`, `layout/tooltip.json`)

- Panel: `#0e0e0f` at alpha 0xdd (87%), plus a black shadow behind it. The height grows with the text. CSS is enough.
- Header: `tooltip/header.png` (frame "gray") with `tooltip/header-frame.png` on top. `TooltipSkill.as` never changes the header frame, so every skill tooltip uses the gray header. The other header colors belong to item rarity.

Text fields:

| Field | Position | Size | Color | Align | Content |
| --- | --- | --- | --- | --- | --- |
| `tfSkillName` | (10, 11) | 24px | white | left | Upper case |
| `tfType` | (10.65, 11.85) | 24px | `#999999` | right | Skill type |
| `tfSkillLevel` | (10, 45.7) | 25px | `#a09588` | left | "LEVEL", value in white |
| `txfRequiredPoints` | (10.35, 47.2) | 23px | `#bf0000` | right | "Required points spent N" |
| `tfCurrentLevelDescription` | (11, 87) | 24px | white | | |
| `tfNextLevelDescription` | (11, 145) | 23px | `#c6bc9d` | | |

Mutagen tooltips follow the item tooltip (`panel_character`, `TooltipInventory.as`) instead: the name, then the item type in upper case (`0xC8C8C7` in code), the stat list, the description and the rarity line. The planner leaves out the weight and price row. The other colours were sampled from an in-game Greater blue mutagen tooltip (name `#b9924d`, stat value `#fbeccc`, stat label `#d6d0b9`, rarity `#767372`). **Unverified:** the item header's text positions; the planner reuses the skill tooltip's.

### Key legend (`panel_common`, `InputFeedbackButtonRef`, `layout/legend-button.json`)

- The buttons are **centered** horizontally at y ≈ 1023: `MenuCommon` sets `mcInpuFeedback.buttonAlign = "center"`. They are 15px apart (`BUTTONS_PADDING`), and the first button in the list is the rightmost.
- Key cap: `legend/key.svg` (a rounded square) at 0.75 x 0.83 scale. Authored `#675943`, shown as `#191919` through a color transform.
- Key letter: 28px `#c0ae8c`, centered.
- **Drawn smaller in game than authored.** An in-game screenshot, measured against the label's cap height, shows the key cap about 32px tall (not 42) and the key letter about as tall as the label's letters (about 20px, not 28). The planner uses the measured sizes (`.gkey` in `styles.css`). The mouse icons match their 40px bitmaps.
- Label: 22px `#c68e5b`.
- Hold actions: the label is `"[Hold] " + label` in the same field, with the prefix wrapped in `<font color="#CD7D03">` by `GetHoldLabel()` (`localizedContent.ws`). Example: "[Hold] Acquire Ability".
- Mouse actions use `legend/mouse-*.png` in place of the key cap (`InputFeedbackButton_mouseIcon`, frames `left`/`right`/`middle`/`scroll_up` = subs 401/400/399/398). The pressed button is a transparent hole in the bitmap; a white square (shape 402) behind every frame shows through it. The recipe bakes that square in with `"under"`.

### Mutagen area (`layout/mutagen-panel.json`, module at (617.95, 158))

- `mcSlotsNormal` (`layout/mutagen-slots.json`) at (253.8, 58.25) holds 12 sockets, 4 diamonds, 16 connectors, 4 bonus sockets, 4 divider lines (`slots/divider.svg`, unnamed in the game: named `divider{Top,Bottom,Left,Right}` by the recipe, scaled 1.375 to 275 px) and the center ornament (`slots/divider-ornament.png`).
- **Socket** (`layout/mutagen-socket.json`), back to front:
  - colored border
  - `slots/frame.svg` (border `#45362d` on `#212121`), unnamed sprite 615 at (-6, -6) scaled (0.937, 0.976): about 76 x 76, a 6px gap around the 64px skill. The recipe names it `frame` in the layout.
  - `mcColorBorder`: edge glow `slots/glow-<colors>`, centered. Shown only for a slot whose data has `colorBorder` (the skill colours it accepts, `SlotSkillSocket.updateData` / `canDrop`), not when a skill matches its group's mutagen
  - `iconLock`: `slots/lock.svg`, gray `#777776`
  - `mcStateDropTarget` (see Drop targets below), scaled 1.188 on the socket centre: about 76 x 76, on the frame's edge
  - `equipedIcon`
  - rank pips
- **Mutagen diamond** (`layout/mutagen-diamond.json`), placed rotated 45° at 0.61 scale:
  - `mutagens/diamond-frame.svg` (`#45362d`)
  - the color fill
  - `mcStateDropTarget` (see Drop targets below), scaled (1.071, 1.043) on the centre: inside the frame, on the fill's edge
  - the mutagen's inventory icon `mutagens/item-<color>-<size>.png`, loaded by `SlotSkillMutagen.loadIcon`. **Likely** tilted with the diamond, since no code counter-rotates it.
  - `slots/lock.svg` when locked

  Fill colors (`SlotSkillMutagen_background`, all at alpha 0.4):

  | Label | Fill |
  | --- | --- |
  | `SC_None` | black at alpha 0.064 |
  | `SC_Blue` | `rgb(0, 61, 153)` |
  | `SC_Red` | `rgb(153, 0, 0)` |
  | `SC_Green` | `rgb(0, 122, 0)` |
  | `SC_Yellow` | `rgb(184, 184, 184)` |
  | `SC_RedBlue`, `SC_RedGreen`, `SC_BlueGreen`, `SC_RedWhite`, `SC_GreenWhite`, `SC_BlueWhite` | Linear gradient between the two colors (`#ff0000`, `#0066ff`, green, `#ffffff`) |

- **Bonus label** (`mc_bonus_bkg_new`, 8 placements in `layout/mutagen-panel.json`):
  - `bonus/bar-<color>.png` at 280x64, alpha 0.8, offset (-4, 4). Mirrored (`scaleX(-1)`) on the right side.
  - `bonus/shield.png` at (5, 8) with `bonus/glyph-<stat>.png` on top, each at its own offset: sword (6, 5), sign (4.75, 1.45), plus and person (4.95, 4.85). The shield stays visible for every color.
  - Stat name and value: the layout text fields, but centred on the bar by cap height (the fields hang the text from the font ascent, which reads low).
  - Glyphs: sword = red (attack power), sign = blue (sign intensity), plus = green (vitality), person = yellow.
  - Text 23px white.

- **Stat category icon** (character stats popup, `panel_inventory` `FullStatsItemRef`; the movie ships in `startup.bundle`, not `r4gui.bundle`, and uses DXT1 atlases): `stats/shield.png` (64x64) at (16.5, 3.25), the `mcStatIcons` glyph sprite at (49.25, 33.5) with alpha 0.6, each frame drawing its file at its own offset (attack_steel (-32, -31.95), spell_power (-33.15, -36.55), toxicity (-33.2, -34.15), additional (-32.1, -17), 64x32). `CharacterStatsPopup.ws` colours the categories: steel/silver/armor/crossbow red, vitality/toxicity green, signs/stamina blue, additional brown. Stat names are `#c0b49d` 23px, values `#f0e3cc` 29px. The planner uses one icon per tree on the side panels' section bars (`gameArt.js`, `TREE_ART.stat`).

### Font

The game uses PF DIN Text Cond Pro (from `fonts_en`), which is commercial. The app uses **D-DIN Condensed** (Datto, SIL OFL 1.1, from [Font Library](https://fontlibrary.org/en/font/d-din)). Regular and Bold are in `public/assets/fonts/d-din/` with `OFL.txt`; keep the files unmodified (the OFL reserves the name "D-DIN Condensed" for unmodified fonts).

Rendered at the movie's sizes next to the screenshot, label text ("Reset abilities", 22px) matches the game's width and height almost exactly. The 34px title ("SIGNS") is slightly heavier and wider in game, so Bold may suit headings.

URLs below are relative to `public/styles.css`:

```css
@font-face { font-family: "D-DIN Condensed"; src: url("assets/fonts/d-din/D-DINCondensed.woff2") format("woff2"); font-weight: 400; }
@font-face { font-family: "D-DIN Condensed"; src: url("assets/fonts/d-din/D-DINCondensed-Bold.woff2") format("woff2"); font-weight: 700; }
```

### Checked against the reference screenshots

`tools/compare_screen.py` renders the movie's bitmaps at their layout positions over the backdrop and puts the result side by side with `reference/fullscreen.png`.

- **Matching position:** backdrop, tree background and frame, tab icons and bars, title, separator, points diamond, the points text and value (right edges at 497 and 533), mutagen sockets and diamonds, the center ornament.
- **Text colors** sampled from the screenshot match the movie values within anti-aliasing:
  - points label `#95866e`
  - title and value white
  - tab count `#aa9578`
  - legend label `#c68e5b`
  - key letter `#c0ae8c`
  - hold prefix `#CD7D03`
- **Corrected:** the legend is centered, not anchored at the bottom right.
- **Code-driven, so not in the render:** tab icons per tab, skill nodes, tree lines and tooltip hints.

## How the game draws the skill tree

Source: `red.game.witcher3.menus.character_menu.CharacterSkillsGridModule` (decompiled, `research/decompiled/panel_character_dupe/scripts/red/game/witcher3/menus/character_menu/`).

### Node positions

- Tree skills in `geralt_skills.xml` have `gridRow` and `gridColumn` (82 skills). Reworked ones are also flagged `isReworked="1"`.
- Socket reference size is 64x64. Spacing constants: `m_gapX = 46`, `m_gapY = 8`, grid divisor 3:
  - `x = (64 + 46) * gridColumn / 3`
  - `y = (64 + 8) * gridRow / 3`
- Row overrides hard-coded in the movie (`createDefaultPositionOverrideArray`), applied before layout. The game can replace this list through the `skill.tree.pos.override` event:

| Skill | Row |
| --- | --- |
| `perk_31`, `perk_38` | 7.5 |
| `perk_41`, `perk_34` | 12.5 |
| `perk_44`, `perk_33` | 17.5 |

### Connections

- Dependencies come from `<required_skills>a,b,c</required_skills>` inside each `<skill>`. The UI receives them as `skillDependencyRequirements`.
- For every skill (`main`) and each required skill (`dep`), one connection is drawn. When two skills require each other, the connection is drawn twice on top of itself.

### Line shape

- Each connection is **two parallel 1px lines, 3px apart** (offset ±1.5px along the perpendicular), solid color, no texture.
- Lines sit in a container below the sockets (`addChildAt(lineContainer, 0)`).

### Line endpoints

All coordinates are socket centers (`x + 32`, `y + 32`) before adjustment. `diffX = main.x - dep.x`, `diffY = main.y - dep.y`, and `s(v)` is the sign of `v`.

- **Default (`"0"`):** move both ends to the facing edges on each axis that differs.
  - If `diffX != 0`: `aX = mainMidX - 32*s(diffX)`, `bX = depMidX + 32*s(diffX)`.
  - If `diffY != 0`: `aY = mainMidY - 32*s(diffY)`, `bY = depMidY + 32*s(diffY)`.
  - On a diagonal this joins corner to corner.
- **`corMidHor`:** x like the default. Only `main`'s y moves to its edge; `dep` keeps its vertical middle.
- **`midCorHor`:** x like the default. Only `dep`'s y moves to its edge; `main` keeps its vertical middle.

Line overrides (`createDefaultLineOverrideArray`, General tree only, replaceable through `skill.tree.line.override`), `main -> dep`:

- `corMidHor`: 30->38, 30->34, 43->34, 43->33, 35->31, 35->41, 37->41, 37->44
- `midCorHor`: 38->30, 34->30, 34->43, 33->43, 31->35, 41->35, 41->37, 44->37, 31->26, 31->25, 41->25, 41->24, 44->24, 44->27, 38->26, 38->25, 34->25, 34->24, 33->24, 33->27

All ids are `perk_<n>`.

### Line colors

| State | Color |
| --- | --- |
| `dep` available (default; or `dep.level > 0` when `dep.isUsingSkillDependency`) | `#FFFFFF` |
| Otherwise | `#333333` |
| Both `main` and `dep` learned (level > 0), by `main`'s color: `SC_Red` | `#C60000` |
| `SC_Green` | `#4A9000` |
| `SC_Blue` | `#0049C6` |
| `SC_Yellow` | `#B27100` |

Checked against an in-game screenshot: lines are one-way. With Muscle Memory and Three Strikes learned and Strength Training not, the Strength Training to Three Strikes line stays `#333333`. Lines are drawn opaque.

## How the game draws mutagen connectors

Source: `ModuleSkillsSocketsDupe`, `SkillSlotConnector` and `mc_slotContainer_1` (sprite 710, `layout/mutagen-slots.json`).

### Layout

There are four groups. Each group has three skill sockets in a column and a mutagen diamond beside it, with a bonus label further out. Groups 1 and 3 are on the left with the diamond to the left of the sockets; groups 2 and 4 are mirrored on the right.

In `layout/mutagen-slots.json`:

- `grN_socketM`: top-left of each socket
- `grN_mutagen`: matrix of each diamond
- `connector_gN_sM`, `groupConnectorN`: matrix of each of the 16 connector instances
- `bonusSocketN`: the four extra sockets

### Connector pieces

Connectors are predrawn vector shapes, not textures:

- **Corner** (`ConnectorCorner_sprite`, inside `SkillSlotConnectorRef`): an L with a small step. Used for the top and bottom socket of each group (`connector_gN_s1`, `connector_gN_s3`).
- **Line** (`ConnectorLine_sprite`, inside `ConnectorLineRef`): short straight piece. Used for the middle socket (`connector_gN_s2`) and for the group-to-mutagen link (`groupConnectorN`).
- Each piece is a double line (two filled strips), like the tree lines.
- Every instance is placed with its own matrix: 90° rotation, mirroring for top vs bottom and left vs right, slight stretch. Apply the matrix as an SVG `transform="matrix(a,b,c,d,e,f)"`.
- Each piece SVG wraps its shape in `<g transform="matrix(1,0,0,1,ox,oy)">`, where `(ox, oy)` is where the piece origin sits inside the file: corner `(2.5, 10.5)`, line `(5.65, 6.1)`. Place the shape so that origin lands on the instance matrix.
- The exported shapes are not what shows. `ConnectorLineRef` and `SkillSlotConnectorRef` mask `lineStatic` (depth 1, clip to 5) and `lineAnim` (depth 7, clip to 11) with sprite 646, a 14.5x13.75 rectangle. On the `complete` frame the static mask is collapsed and the anim mask is, in piece units: line x -3 to 3, y -4 to 26.5 (cuts the T-cap wings); corner x -3 to 94.3, y -1 to 24 (cuts the end that would enter the socket frame). `connector()` in `ui/gamePieces.js` clips to these rectangles. `gfx_movie.py` skips clip depth; it was read with a patched copy.

### Colors

Frame labels on the pieces, saved as `mutagens/connectors/{corner,line}-<color>.svg`:

| Label | Corner | Line | Fill |
| --- | --- | --- | --- |
| `SC_None` | yes | yes | Nothing drawn (inactive) |
| `SC_Blue` | yes | yes | `#0066ff` |
| `SC_Red` | yes | yes | `#9c0000` |
| `SC_Green` | yes | yes | `#059a27` |
| `SC_Yellow` | yes | yes | `#ffffff` |
| `SC_Mix`, `SC_RedBlue`, `SC_RedGreen`, `SC_BlueGreen`, `SC_RedWhite`, `SC_GreenWhite`, `SC_BlueWhite` | no | yes | Split two-color strips |

### State and animation

- `SkillSlotConnector.currentColor = "SC_..."` switches the frame. A change plays a draw-in: the previous color stays on `lineStatic`, and the new color on `lineAnim` is revealed by a growing clip mask.
- Timing at 40 fps: corner frames `start` 2 to `complete` 15 (~0.33s), line frames 2 to 6 (~0.1s).
- Which connectors light up was checked against an in-game screenshot only (the logic in `ModuleSkillsSocketsDupe` and `PlayerAbilityManager.ws` was not read). A socket's connector takes the group color when the equipped skill's color matches the mutagen. The group connector is colored when at least one socket in the group matches. For example, a blue mutagen with three blue skills lights all four pieces; a green mutagen with one green skill in the bottom slot lights that corner and the group line.

## Skill text

Regenerate with `python tools/extract_skill_text.py "$G" public/data/skillText.js` (~5 s). It prints warnings, the skills with character-dependent values, and fails on any skill it can't run.

How the game builds a skill tooltip (checked in the 5.0 files, 2026-10-05):

- Each `<skill>` names a description key per rank (`localisationDescription`, `...Level2`, `...Level3`). Many skills reuse one key; some word ranks differently (Muscle Memory, Undying, Whirl).
- `GetSkillTooltipDescriptionForSkillLevel` picks the key for the rank and calls the tree's function (`GetSwordSkillsTooltipDescription` and so on). Each has a hand-written `case` per skill: which ability attributes it reads, how it scales them (`* skillLevel`, `* (skillLevel - 1)`, a separate attribute per rank such as `focus_gain_lvl2`, or a literal like `5 * skillLevel`), and how it rounds (`RoundMath(x * 100)`).
- The numbers fill `$I$` (ints), `$F$` (floats, trailing zeros cut) and `$S$` (strings) in the string, first occurrence each (`GetLocStringByKeyExtWithParams`, `localizedContent.ws`).
- Each tree function appends its passive line ("Adrenaline Point gain: +1%", Stamina regeneration, potion duration, Vitality). The extractor drops it: the planner shows the tree passive itself.
- Attribute values: `type="add"` / `"mult"` / `"base"` set `valueAdditive` / `valueMultiplicative` / `valueBase`. One attribute can be listed once per type and the entries combine (`magic_s11.direct_damage_per_sec` is add 10 and mult 0.001). `CalculateAttributeValue` is `base * mult + add`.
- Rather than copying 127 cases, `extract_skill_text.py` runs that script code with `wscript.py`, so a game update only needs a rerun. Numbers keep the name of the XML attribute they came from, which becomes the template placeholder (`{damage_increase}`); literals in the script become `{value}`.
- Per-rank wording: a number one rank's text leaves out is `null` at that rank in `values`. The planner's "Modern" descriptions (all ranks in one text, `allRanksParts` in `core/skillText.js`) use the template with the most numbers and show such a rank as 0, which matches the text in 8 of the 9 skills (e.g. Active Shield "does not drain Stamina" at rank 3). The exception is Muscle Memory, whose rank 1 reads "your next Fast Attack": `MISSING_VALUES` in the extractor writes `missing: { trigger_at_attack_count: 1 }` for it.
- Character-dependent values: Sun and Stars multiplies by max Stamina, read as 100. It is listed under `dynamic`. None of the planner's other skills read live stats. Geralt's max Stamina is `ConGeralt` base 100 (`geralt_stats.xml`) and nothing in normal play raises it. Checked in-game: the tooltip shows the flat value the extractor gives, and the planner keeps it flat.
- `gameplay\abilities_plus\` (and `items_plus\`, and the same pair in the `ep1`/`bob`/`dlc12` DLC folders) is **likely the New Game+ set**: the executable names both folders side by side, `abilities_plus\geralt_stats.xml` adds levels 51 to 100 (the NG+ level cap), and only `items_plus\` has `_ng_plus_item_extensions.xml`. The engine picks the set natively (`IsNewGamePlusEnabled` is an import), so the scripts don't confirm it. The extractor uses `gameplay\abilities\`. Run against `_plus`, only 2 of the 80 skills change: Pyrotechnics 100/200/300 instead of 50/100/150, and Delayed Recovery 0% (the set lacks `toxicity_threshold_lvl1..3`, so an NG+ tooltip would likely read 0%). **Unverified** in an NG+ save.
- The game's tooltips show odd values that the extractor copies as they are: Griffin School Techniques shows Stamina regeneration +0/s, +0/s, +1/s (0.002 * 100 * rank, rounded). Checked in-game, as are Supercharged Glyphs at 10/20/30 Vitality per second.

### w3strings format

`"RTSW"`, u32 version, u16 key1; three blocks, each starting with a variable-length count: string entries (id ^ magic, offset, length), key hashes (hash, id ^ magic) and the encrypted text; u16 key2 at the end. `key1 << 16 | key2` picks the language and its magic. Each text unit is XORed with `(length + 1) * key`, where the key starts at `(magic >> 8) & 0xFFFF` and rotates left one bit per unit. Keys exist only as a hash (`h = h * 31 + c` over the lower-cased UTF-16 key), so strings are looked up by key name.

- Version 162 (classic, documented by the modding tools) stores UTF-16 and counts offsets and lengths in 16-bit units.
- Version 164 (5.0) stores **UTF-8** and counts in bytes. Found by testing; the public decoders (w3strings encoder, WolvenKit, the `w3strings` Rust crate) only read 162 as of this writing.

## Open questions

- Exact rule for connector colors and dual-color skills (`ModuleSkillsSocketsDupe`, `PlayerAbilityManager.ws` around `GetSkillGroupColorCount` / `LINK_BONUS_*`).
- Default panorama (Velen is the likely one, and what the app shows; the reference screenshots use Novigrad) and how the panorama is scaled to the screen (`MenuCommon.setBackgroundPosition`).
- Node state details: matched by eye only (no fill when unavailable, a darkened fill when available, see `treeNode` in `ui/gamePieces.js`).

## Research folder

`research/` is gitignored because it contains CDPR code and data that must not be published. What is kept:

| Path | Contents |
| --- | --- |
| `research/tools/ffdec/` | JPEXS FFDec 26.3.0 portable. Needed by `build_ui_assets.py` for the SVGs. |
| `research/decompiled/<movie>/scripts/` | FFDec ActionScript export (`panel_character`, `panel_character_dupe`, `panel_common`, `panel_ingamemenu`, `popup_message`, `componentslib` `TooltipSkill` only). The reference for node states, tooltip, menu, popup and animation logic. |
| `research/menu/` | FFDec sprite exports of the Esc menu (list module, items, selection frame) and its sheet, used while rebuilding the menu. |
| `research/xml/` | `geralt_skills.xml`, `geralt_skills_plus.xml`, `def_item_alchemy_mutagens.xml` |

Generated on demand with the commands above, not kept: `research/swf/` (plain `.swf` movies, needed before running the FFDec commands), `research/atlas-map/<movie>/` (atlas slice crops and `catalog.json`) and `research/compare/`. All scripts live in `tools/`, which is committed: they contain no game data.

## Legal

Game assets are used under the [CD PROJEKT RED Fan Content Guidelines](https://www.cdprojektred.com/en/fan-content): free and non-commercial, with the "unofficial fan work, not approved/endorsed by CD PROJEKT RED" notice visible (already in the README and page footer). Ship extracted images and the skill text and numbers in `data/skillText.js` (the same content as the in-game tooltips), not decompiled code, game scripts or raw game data files. The tools in `tools/` are shipped: they only read a local install and contain no game data.
