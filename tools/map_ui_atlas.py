"""Map every atlas slice (GFX sub-image) of a UI movie to the sprites and frames that use it.

Research aid for writing tools/asset-recipe.json: crops every slice to sub<id>.png and
writes catalog.json with, per slice, its atlas rectangle and who uses it, e.g.
  "SlotSkillSocketRef[SC_Red].mcEdgeGlow"
A slice is used either by a shape fill (followed up the sprite tree to the nearest
sprites with an ActionScript class) or by name from code (export name, e.g. Mouse_LeftBtn.png).

Usage: python tools/map_ui_atlas.py <game_dir> <movie path in r4gui.bundle> <out_dir>
Example:
  python tools/map_ui_atlas.py "D:/Games/Steam/steamapps/common/The Witcher 3" \
      gameplay/gui_new/swf/character/panel_character_dupe.redswf research/atlas-map/panel_character_dupe

Output contains game art: keep it under research/ (gitignored).
"""
import json
import os
import sys

from gfx_movie import GameMovies

MAX_DEPTH = 6


def usages(movie, character, parents, depth=0, seen=None):
    """Paths from a character up to the nearest sprites that have a class name."""
    seen = seen if seen is not None else set()
    result = []
    for sprite_id, p in parents.get(character, []):
        if (sprite_id, character) in seen:
            continue
        seen.add((sprite_id, character))
        owner = 'root' if sprite_id == 0 else movie.class_name(sprite_id) or str(sprite_id)
        here = f'{owner}[{p.label or p.frame}]' + (f'.{p.name}' if p.name else '')
        if sprite_id == 0 or movie.class_name(sprite_id) or depth >= MAX_DEPTH:
            result.append(here)
        else:
            result += [f'{here} < {up}' for up in usages(movie, sprite_id, parents, depth + 1, seen)] or [here]
    return result


def catalog(movie):
    parents = movie.parents()
    shapes_by_bitmap = {}
    for shape in movie.shapes.values():
        for bitmap in shape.bitmaps:
            shapes_by_bitmap.setdefault(bitmap, []).append(shape.id)
    entries = []
    for sub_id in sorted(movie.subimages):
        atlas, rect = movie.subimage_rect(sub_id)
        shapes = shapes_by_bitmap.get(sub_id, [])
        used_by = sorted({u for s in shapes for u in usages(movie, s, parents)})
        entries.append({'sub': sub_id, 'atlas': atlas, 'rect': list(rect),
                        'size': [rect[2] - rect[0], rect[3] - rect[1]],
                        'export': movie.classes.get(sub_id), 'shapes': shapes, 'used_by': used_by})
    return entries


def main(game_dir, movie_path, out_dir):
    movies = GameMovies(game_dir)
    movie = movies.movie(movie_path)
    os.makedirs(out_dir, exist_ok=True)
    entries = catalog(movie)
    for e in entries:
        movies.subimage(movie_path, e['sub']).save(os.path.join(out_dir, f"sub{e['sub']:04d}.png"))
    with open(os.path.join(out_dir, 'catalog.json'), 'w') as f:
        json.dump({'movie': movie_path, 'images': movie.images, 'subs': entries}, f, indent=1)
    named = sum(1 for e in entries if e['used_by'] or e['export'])
    print(f'{len(entries)} slices on {len(movie.images)} atlases, {named} with a user or export name -> {out_dir}')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
