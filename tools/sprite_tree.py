"""Print a sprite's placement tree: frames, depths, children, matrices, fills and text styles.

Research aid for finding where a piece of the screen comes from.

Usage: python tools/sprite_tree.py <game_dir> <movie> <sprite id or class name> [depth]
<movie> is an alias from tools/asset-recipe.json ("character", "components", "common") or a path
inside r4gui.bundle. Sprite 0 is the movie's root timeline. depth defaults to 1.
Example:
  python tools/sprite_tree.py "D:/Games/Steam/steamapps/common/The Witcher 3" character SlotSkillSocketRef 1
"""
import sys

from build_ui_assets import load_recipe
from gfx_movie import GameMovies

MAX_LABELS = 14
MAX_FILLS = 5
MAX_TEXT = 90


def rounded(values):
    return tuple(round(v, 2) for v in values)


def describe(movie, character):
    """(kind, details) of a placed character."""
    if character in movie.sprites:
        return 'sprite', ''
    if character in movie.shapes:
        shape = movie.shapes[character]
        fills = [(f.kind, f.color or f.bitmap or len(f.stops or [])) for f in shape.fills][:MAX_FILLS]
        return 'shape', f'b={rounded(shape.bounds)} fills={fills}'
    if character in movie.texts:
        t = movie.texts[character]
        return 'text', f'h={t.height} color={t.color} b={rounded(t.bounds)} text={(t.text or "")[:MAX_TEXT]!r}'
    return '?', ''


def dump(movie, sprite_id, indent, depth):
    sprite = movie.sprites[sprite_id]
    print(' ' * indent + f'sprite {sprite_id} {movie.class_name(sprite_id) or ""} '
          f'frames={sprite.frame_count} labels={list(sprite.labels)[:MAX_LABELS]}')
    for p in sprite.placements:
        if p.character is None:
            continue
        kind, details = describe(movie, p.character)
        matrix = rounded(p.matrix) if p.matrix else None
        cxform = f' cx={p.cxform}' if p.cxform else ''
        print(' ' * (indent + 2) + f'f{p.frame} {p.label or ""} d{p.depth} {kind} {p.character} '
              f'{movie.class_name(p.character) or ""} .{p.name} m={matrix} {p.blend or ""}{cxform} {details}')
        if kind == 'sprite' and depth > 0:
            dump(movie, p.character, indent + 4, depth - 1)


def main(game_dir, movie, sprite, depth='1'):
    path = load_recipe()['movies'].get(movie, movie)
    m = GameMovies(game_dir).movie(path)
    by_class = {name.split('.')[-1]: cid for cid, name in m.classes.items()}
    dump(m, int(sprite) if sprite.isdigit() else by_class[sprite], 0, int(depth))


if __name__ == '__main__':
    if len(sys.argv) not in (4, 5):
        sys.exit(__doc__)
    main(*sys.argv[1:])
