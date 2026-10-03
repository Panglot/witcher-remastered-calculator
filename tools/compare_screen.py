"""Render the Character screen's bitmaps at their layout positions and compare with docs/reference/fullscreen.png.

Draws the panel_common backdrop (panorama + fog) and the Character screen root on the Signs tab,
bitmaps only (see render_movie.py). Writes to <out_dir>:
  render.png  the render
  side.png    render | screenshot
  blend.png   50/50 overlay, for checking positions

Usage: python tools/compare_screen.py <game_dir> <out_dir>
The output contains game art: keep it out of the repo (e.g. under research/).
"""
import os
import sys

from PIL import Image

from build_ui_assets import load_recipe
from game_files import TextureCache, content_path
from gfx_movie import IDENTITY, GameMovies
from render_movie import draw_bitmap, render_sprite

HERE = os.path.dirname(os.path.abspath(__file__))
SCREENSHOT = os.path.join(HERE, '..', 'docs', 'reference', 'fullscreen.png')
SCREEN_SIZE = (1920, 1080)
BACKGROUND = (4, 4, 4, 255)
# The screenshot was taken in Novigrad. Position: mcMenuBackgroundContainer (-23, -77.5) + mcImageLoader (0, 75.5).
PANORAMA = r'gameplay\gui_new\icons\menubackground\panorama_novigrad.png'
PANORAMA_MATRIX = (1.0, 0.0, 0.0, 1.0, -23.0, -2.0)
PANORAMA_ALPHA = 0.21875
TREE_PANEL_FRAMES = {734: 2}  # tree panel sprite on its Signs frame, as in the screenshot
# Code-driven or hidden in the screenshot's state
SKIP = ('mcMasterMutation', 'mcSlotChangeHighlight', 'applyMode', 'mcRunewordIcon', 'tooltipAnchor',
        'mcCollapsedTooltipIcon')


def render(game_dir):
    movies = GameMovies(game_dir)
    paths = load_recipe()['movies']
    canvas = Image.new('RGBA', SCREEN_SIZE, BACKGROUND)

    panorama = TextureCache(content_path(game_dir, 'texture.cache')).image(PANORAMA)
    draw_bitmap(canvas, panorama, PANORAMA_MATRIX, PANORAMA_ALPHA)
    common_root = {p.name: p for p in movies.movie(paths['common']).display_list(0, 1).values() if p.name}
    fog = common_root['mcBlackBackground']
    render_sprite(movies, paths['common'], fog.character, canvas, fog.matrix)

    render_sprite(movies, paths['character'], 0, canvas, IDENTITY, frames=TREE_PANEL_FRAMES, skip=SKIP)
    return canvas


def main(game_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    canvas = render(game_dir)
    shot = Image.open(SCREENSHOT).convert('RGBA')
    side = Image.new('RGBA', (SCREEN_SIZE[0] * 2, SCREEN_SIZE[1]))
    side.paste(canvas, (0, 0))
    side.paste(shot, (SCREEN_SIZE[0], 0))
    canvas.save(os.path.join(out_dir, 'render.png'))
    side.save(os.path.join(out_dir, 'side.png'))
    Image.blend(canvas, shot, 0.5).save(os.path.join(out_dir, 'blend.png'))
    print('written to', out_dir)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(*sys.argv[1:])
