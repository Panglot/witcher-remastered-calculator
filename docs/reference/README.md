# In-game reference screenshots

Screenshots of the real Character screen (next-gen build), used to check the rebuilt UI against the game. See [game-assets.md](../game-assets.md) for how each part is drawn.

`fullscreen.png` and `reset_modal_fullscreen.png` are full 1920x1080 captures, in the same coordinate space as the layout files in `public/assets/ui/layout/`. Use them for measuring positions and sampling colors. The others are cropped to leave out the top menu bar (not part of the rebuild), so their coordinates are offset.

| File | Size | What it shows |
| --- | --- | --- |
| `fullscreen.png` | 1920x1080 | Whole screen, uncropped. Reference for positions and color sampling. |
| `alchemy.png` | 1920x984 | Alchemy tree. Tooltip on a skill at level 2/3, so it shows both the current and the next level text. Blue mutagen with all 3 connections lit, green mutagen with 1. |
| `combat.png` | 1906x975 | Combat tree, nothing hovered. The rank pips (small diamonds along the bottom of each skill) are clearly visible. |
| `general.png` | 1915x968 | General tree, no points allocated. Red mutagen with 2 connections, green with 1. Key legend at the bottom: mouse and keyboard keys, and the upgrade action's "[Hold]" prefix in a different color. |
| `signs.png` | 1920x969 | Signs tree after a points reset (a clean tree). Hover on Delusion. Note the extra border around the selected skill: in game it pulses, its opacity cycling 100% to 0% and back. |
| `mutagens.png` | 1915x952 | Mutagens tab. Only partly relevant, see below. |
| `reset_modal_fullscreen.png` | 1920x1080 | The Reset abilities confirmation popup over the masked screen. Reference for the message popup. |

## Notes on the mutagens tab

- In game this tab lists specific monster mutagens, several of them multicolored. The app only uses the **pure single-color mutagens**: red, green and blue in lesser, normal and greater sizes, 9 in total, each usable without limit.
- The multicolored attack mutagen slotted in this screenshot is there only because no pure one was available. It is not the target look.
- Those 9 icons are in the asset set as `mutagens/item-<color>-<size>.png`. How the tab works in the app is decided during implementation.
