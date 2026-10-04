"""Build the curated UI asset set from a Witcher 3 (next-gen) install, driven by a recipe.

The recipe (tools/asset-recipe.json) maps every output file to where it comes from:
  {"from": "atlas", "movie": "<alias>", "sub": 418}           slice of a movie's texture atlas (GFX sub-image)
      optional "under": {"shape": 402, "at": [0, -6]}         a solid shape drawn behind it (see AtlasSource)
      optional "shape": 554                                    the shape that draws it; its fill matrix goes to the manifest
      optional "mask": "alpha" | [68, 216] | {"dark": 70}      keep only the glyph, white (see AtlasSource.glyph)
      optional "trim": true                                    crop to the visible pixels
      optional "canvas": 108                                   centre it on a square this size (see AtlasSource.on_canvas)
      optional "arrow": {"at": "above", "width": 48, ...}      with a 45 degree arrowhead (needs "canvas", see AtlasSource.arrow)
  {"from": "atlas", "movie": "<alias>", "image": 694}       a whole movie texture (a bitmap a shape fills with directly)
  {"from": "cache", "path": "gameplay/gui_new/icons/...png"}  texture from content0/texture.cache
  {"from": "svg", "movie": "<alias>", "shape": 603}            vector shape, exported with JPEXS FFDec
  {"from": "svg", "movie": "<alias>", "sprite": 665, "frame": "SC_Red"}   one sprite frame (number or label), via FFDec
  {"from": "skills", "exclude_trees": ["None"]}                skill icons + skills.json (output is a folder)
  {"from": "placements", "movie": "<alias>", "sprite": 710}    JSON of a sprite's named children: matrix, text style
      optional "names": {"5": "frame"}                         names for unnamed children, by depth
      optional "frame": "selected_up"                          the frame to read (number or label, default 1)
Every source may carry a "note" that is copied into the manifest. Images are written as PNG, or as JPEG
when the output name ends in .jpg (for large opaque art).

Movie aliases are defined in the recipe's "movies" map (alias -> path inside the UI bundles, see gfx_movie.GameMovies).
Writes <out_dir>/manifest.json describing every file, and lists files in <out_dir> that the
recipe does not produce (candidates for deletion).

Usage: python tools/build_ui_assets.py <game_dir> <out_dir> [--recipe tools/asset-recipe.json] [--ffdec <ffdec.jar>]
FFDec is only needed for "svg" sources (default: research/tools/ffdec/ffdec.jar).
"""
import argparse
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageChops, ImageColor, ImageDraw

from extract_skill_icons import main as extract_skills
from game_files import TextureCache, content_path
from gfx_movie import GameMovies, TWIPS

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_RECIPE = os.path.join(HERE, 'asset-recipe.json')
DEFAULT_FFDEC = os.path.join(HERE, '..', 'research', 'tools', 'ffdec', 'ffdec.jar')
MANIFEST = 'manifest.json'
JPEG_QUALITY = 88
ALIGN = {0: 'left', 1: 'right', 2: 'center', 3: 'justify'}


def save_image(image, dest):
    if dest.lower().endswith('.jpg'):
        image.convert('RGB').save(dest, quality=JPEG_QUALITY, optimize=True)
    else:
        image.save(dest, optimize=True)
    return {'size': list(image.size)}


class BuildContext:
    """Shared, lazily opened game data for the source handlers."""

    def __init__(self, game_dir, movies, ffdec):
        self.game_dir = game_dir
        self.movie_paths = movies
        self.ffdec = ffdec
        self.movies = GameMovies(game_dir)
        self._cache = None
        self._tmp = tempfile.mkdtemp(prefix='w3-ui-')
        self._svg_exports = {}

    def movie_path(self, alias):
        return self.movie_paths[alias]

    def movie(self, alias):
        return self.movies.movie(self.movie_path(alias))

    @property
    def texture_cache(self):
        if self._cache is None:
            self._cache = TextureCache(content_path(self.game_dir, 'texture.cache'))
        return self._cache

    def svg_export(self, alias, kind, ids):
        """Run FFDec once per (movie, kind) for all requested ids; return the export folder."""
        key = (alias, kind)
        if key not in self._svg_exports:
            if not os.path.isfile(self.ffdec):
                sys.exit(f'FFDec not found at {self.ffdec} (needed for svg sources, pass --ffdec)')
            swf = os.path.join(self._tmp, f'{alias}.swf')
            if not os.path.exists(swf):
                with open(swf, 'wb') as f:
                    f.write(self.movies.swf(self.movie_path(alias)))
            out = os.path.join(self._tmp, f'{alias}-{kind}')
            subprocess.run(['java', '-jar', self.ffdec, '-format', f'{kind}:svg', '-selectid',
                            ','.join(str(i) for i in sorted(ids)), '-export', kind, out, swf],
                           check=True, stdout=subprocess.DEVNULL)
            self._svg_exports[key] = out
        return self._svg_exports[key]

    def close(self):
        shutil.rmtree(self._tmp, ignore_errors=True)


class AtlasSource:
    """Atlas slice. An optional "under" puts a solid shape of the same movie behind it, for art that
    shows a shape through transparent holes: {"shape": 402, "at": [x, y]}. The shape is drawn as its
    bounding box in its first solid fill; "at" (default [0, 0]) is the slice's placement offset relative
    to the shape's, both placed in the same parent sprite.
    An optional "shape" (the shape that draws the slice as a bitmap fill) writes that fill's matrix to
    the manifest as "fill": where the slice lands, in px, in the shape's own units.
    "mask", "trim", "canvas" and "arrow" turn a slice into a one-colour icon the page tints itself (CSS mask-image)."""

    # Alpha at or below this counts as empty when trimming (soft edges and faint glows).
    TRIM_ALPHA = 8
    # Arrows are drawn this many times larger, then scaled down, for smooth diagonal edges.
    SUPERSAMPLE = 8

    def build(self, ctx, src, dest):
        path = ctx.movie_path(src['movie'])
        if 'image' in src:
            image = ctx.movies.textures(path)[ctx.movie(src['movie']).images[src['image']][0]]
        else:
            image = ctx.movies.subimage(path, src['sub'])
        if 'under' in src:
            image = self.over_shape(ctx.movie(src['movie']), image, src['under'])
        if 'mask' in src:
            image = self.glyph(image, src['mask'])
        if src.get('trim'):
            image = image.crop(image.getchannel('A').point(lambda v: 255 if v > self.TRIM_ALPHA else 0).getbbox())
        if 'canvas' in src:
            image = self.on_canvas(image, src['canvas'], self.arrow(image, src['arrow']) if 'arrow' in src else None)
        info = save_image(image, dest)
        if 'shape' in src:
            info['fill'] = self.fill_matrix(ctx.movie(src['movie']), src['shape'], src['sub'])
        return info

    @staticmethod
    def fill_matrix(movie, shape_id, sub):
        """SVG matrix of the shape's bitmap fill of `sub`. Bitmap fill scales are in twips per bitmap
        pixel, so they are divided by TWIPS; the translation is already in px."""
        fill = next((f for f in movie.shapes[shape_id].fills if f.kind == 'bitmap' and f.bitmap == sub), None)
        if fill is None:
            sys.exit(f'shape {shape_id} has no bitmap fill of sub-image {sub}')
        a, b, c, d, tx, ty = fill.matrix
        return [round(v / TWIPS, 5) for v in (a, b, c, d)] + [round(tx, 3), round(ty, 3)]

    @staticmethod
    def over_shape(movie, image, under):
        shape = movie.shapes[under['shape']]
        color = next(f.color for f in shape.fills if f.kind == 'solid')
        ax, ay = under.get('at', (0, 0))
        x0, y0, x1, y1 = (round(v) for v in (shape.bounds[0] - ax, shape.bounds[1] - ay,
                                             shape.bounds[2] - ax, shape.bounds[3] - ay))
        base = Image.new('RGBA', image.size, (0, 0, 0, 0))
        ImageDraw.Draw(base).rectangle((x0, y0, x1 - 1, y1 - 1), fill=ImageColor.getcolor(color, 'RGBA'))
        return Image.alpha_composite(base, image.convert('RGBA'))

    @staticmethod
    def glyph(image, mask):
        """White pixels whose alpha is the glyph. "alpha": the slice's own alpha (a glyph on transparency).
        [lo, hi]: brightness lo (the backing, transparent) to hi (the glyph, opaque), for a light glyph
        baked onto an opaque disc. {"dark": 70, "thicken": 1}: the slice's alpha with holes where it is
        darker than "dark" (lines drawn on a light card), each hole "thicken" px taller (default 0), and
        alpha from "solid" up made opaque (a card that is partly see-through in the game; default 255)."""
        image = image.convert('RGBA')
        alpha = image.getchannel('A')
        if isinstance(mask, dict):
            holes = image.convert('L').point(lambda v: 255 if v < mask['dark'] else 0)
            for _ in range(mask.get('thicken', 0)):
                lower = Image.new('L', holes.size, 0)
                lower.paste(holes, (0, 1))
                holes = ImageChops.lighter(holes, lower)
            solid = mask.get('solid', 255)
            alpha = ImageChops.subtract(alpha.point(lambda v: min(255, round(v * 255 / solid))), holes)
        elif mask != 'alpha':
            lo, hi = mask
            light = image.convert('L').point(lambda v: max(0, min(255, round((v - lo) * 255 / (hi - lo)))))
            alpha = ImageChops.multiply(alpha, light)
        out = Image.new('RGBA', image.size, (255, 255, 255, 0))
        out.putalpha(alpha)
        return out

    @staticmethod
    def arrow(image, spec):
        """An arrowhead next to the glyph, as a triangle in the glyph's px (base corners, then the tip):
        twice as wide as it is tall, so its sides run at 45 degrees like a cut corner.
          "width": the base, px; "gap": its distance from the glyph, px
          "at": "above" / "below": pointing up, centred over / under the glyph; "corner": pointing out of
                the cut corner "cut" ([x0, y0, x1, y1], the cut edge in the glyph's px, from its top-left
                end), the base along the cut."""
        w, gap = spec['width'], spec['gap']
        gw, gh = image.size
        # The triangle in the glyph's px: base corners, then the tip.
        if spec['at'] == 'above':
            triangle = [(gw / 2 - w / 2, -gap), (gw / 2 + w / 2, -gap), (gw / 2, -gap - w / 2)]
        elif spec['at'] == 'below':
            base = gh + gap + w / 2
            triangle = [(gw / 2 - w / 2, base), (gw / 2 + w / 2, base), (gw / 2, gh + gap)]
        elif spec['at'] == 'corner':
            x0, y0, x1, y1 = spec['cut']
            length = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
            t = ((x1 - x0) / length, (y1 - y0) / length)   # along the cut
            n = (t[1], -t[0])                              # out of the glyph
            mid = ((x0 + x1) / 2, (y0 + y1) / 2)

            def at(along, out):
                return (mid[0] + t[0] * along + n[0] * out, mid[1] + t[1] * along + n[1] * out)
            triangle = [at(-w / 2, gap), at(w / 2, gap), at(0, gap + w / 2)]
        else:
            sys.exit(f"unknown arrow place {spec['at']!r}; known: above, below, corner")
        return triangle

    @classmethod
    def on_canvas(cls, image, size, triangle=None):
        """The glyph, and the arrowhead `triangle` (in the glyph's px) if any, centred together on a
        size x size canvas. The glyph keeps its own pixels (placed on whole pixels); the arrowhead is
        drawn smooth. Icons of one set share a size, so their glyphs show at one scale."""
        gw, gh = image.size
        xs, ys = [0, gw] + [p[0] for p in triangle or ()], [0, gh] + [p[1] for p in triangle or ()]
        if max(xs) - min(xs) > size or max(ys) - min(ys) > size:
            sys.exit(f'canvas {size} is smaller than its content ({max(xs) - min(xs):g} x {max(ys) - min(ys):g} px)')
        ox, oy = round((size - max(xs) - min(xs)) / 2), round((size - max(ys) - min(ys)) / 2)
        alpha = Image.new('L', (size, size), 0)
        alpha.paste(image.getchannel('A'), (ox, oy))
        if triangle:
            k = cls.SUPERSAMPLE
            drawn = Image.new('L', (size * k, size * k), 0)
            ImageDraw.Draw(drawn).polygon([((x + ox) * k, (y + oy) * k) for x, y in triangle], fill=255)
            alpha = ImageChops.lighter(alpha, drawn.resize((size, size), Image.Resampling.BOX))
        out = Image.new('RGBA', (size, size), (255, 255, 255, 0))
        out.putalpha(alpha)
        return out


class CacheSource:
    def build(self, ctx, src, dest):
        return save_image(ctx.texture_cache.image(src['path'].replace('/', '\\')), dest)


class SvgSource:
    """Vector art via FFDec. prepare() batches every svg source so FFDec runs once per movie and kind."""

    def __init__(self):
        self.requests = {}

    @staticmethod
    def kind(src):
        return 'shape' if 'shape' in src else 'sprite'

    def prepare(self, src):
        self.requests.setdefault((src['movie'], self.kind(src)), set()).add(src.get('shape', src.get('sprite')))

    def build(self, ctx, src, dest):
        kind = self.kind(src)
        folder = ctx.svg_export(src['movie'], kind, self.requests[(src['movie'], kind)])
        # FFDec writes into <out>/<kind>s/ when several kinds are exported, else straight into <out>
        roots = [os.path.join(folder, kind + 's'), folder]
        if kind == 'shape':
            paths = [os.path.join(root, f"{src['shape']}.svg") for root in roots]
        else:
            frame = src.get('frame', 1)
            if isinstance(frame, str):
                frame = ctx.movie(src['movie']).sprites[src['sprite']].labels[frame]
            sprite_dirs = [d for root in roots for pattern in (f"DefineSprite_{src['sprite']}_*", f"DefineSprite_{src['sprite']}")
                           for d in glob.glob(os.path.join(root, pattern))]
            paths = [os.path.join(d, f'{frame}.svg') for d in sprite_dirs]
        path = next((p for p in paths if os.path.exists(p)), None)
        if not path:
            raise FileNotFoundError(f'FFDec produced no svg for {src}')
        shutil.copyfile(path, dest)
        return {}


class SkillsSource:
    def build(self, ctx, src, dest):
        extract_skills(ctx.game_dir, dest, src.get('exclude_trees', ()))
        return {}


class PlacementsSource:
    """Named children of a sprite (or the root timeline, sprite 0): where the game places each piece.
    Unnamed children are left out unless the recipe's "names" gives their depth a name."""

    def build(self, ctx, src, dest):
        movie = ctx.movie(src['movie'])
        names = {int(depth): name for depth, name in src.get('names', {}).items()}
        children = {}
        for p in movie.display_list(src['sprite'], src.get('frame', 1)).values():
            name = p.name or names.get(p.depth)
            if not name:
                continue
            child = {'character': p.character, 'class': movie.class_name(p.character),
                     'matrix': [round(v, 5) for v in (p.matrix or (1, 0, 0, 1, 0, 0))]}
            if p.blend and p.blend != 'normal':
                child['blend'] = p.blend
            if p.cxform:
                child['cxform'] = p.cxform
            text = movie.texts.get(p.character)
            if text:
                child['text'] = {'box': [round(v, 2) for v in text.bounds], 'size': text.height,
                                 'color': text.color, 'align': ALIGN.get(text.align)}
            children[name] = child
        with open(dest, 'w') as f:
            json.dump({'_about': 'Units: px. matrix = SVG matrix(a, b, c, d, tx, ty) of the child in its parent. '
                                 'cxform: color = color * mult + add (alpha mult 0-1). '
                                 'text.size: font size in px, text.color: #rrggbbaa.',
                       'sprite': movie.class_name(src['sprite']) or src['sprite'],
                       'children': children}, f, indent=1)
        return {'children': len(children)}


HANDLERS = {
    'atlas': AtlasSource,
    'cache': CacheSource,
    'svg': SvgSource,
    'skills': SkillsSource,
    'placements': PlacementsSource,
}


def describe(ctx, src):
    """Human readable origin of a source, for the manifest."""
    keys = {k: v for k, v in src.items() if k not in ('from', 'note')}
    if 'movie' in keys:
        keys['movie'] = os.path.basename(ctx.movie_path(keys['movie']))
    return {'from': src['from'], **keys}


def load_recipe(path=DEFAULT_RECIPE):
    with open(path) as f:
        return json.load(f)


def build(game_dir, out_dir, recipe_path, ffdec):
    recipe = load_recipe(recipe_path)
    handlers = {name: cls() for name, cls in HANDLERS.items()}
    for src in recipe['assets'].values():
        if src['from'] not in handlers:
            sys.exit(f"unknown source type {src['from']!r}; known: {', '.join(HANDLERS)}")
        if hasattr(handlers[src['from']], 'prepare'):
            handlers[src['from']].prepare(src)

    ctx = BuildContext(game_dir, recipe['movies'], ffdec)
    manifest, produced = {}, set()
    try:
        for out, src in recipe['assets'].items():
            dest = os.path.join(out_dir, out)
            os.makedirs(os.path.dirname(dest.rstrip('/\\')) or '.', exist_ok=True)
            info = handlers[src['from']].build(ctx, src, dest)
            manifest[out] = {**describe(ctx, src), **info, **({'note': src['note']} if 'note' in src else {})}
            if os.path.isdir(dest):
                produced |= {os.path.normpath(os.path.join(r, n)) for r, _, ns in os.walk(dest) for n in ns}
            else:
                produced.add(os.path.normpath(dest))
    finally:
        ctx.close()

    with open(os.path.join(out_dir, MANIFEST), 'w') as f:
        json.dump({'_about': 'Generated by tools/build_ui_assets.py from tools/asset-recipe.json. Do not edit.',
                   'files': manifest}, f, indent=1)
    produced.add(os.path.normpath(os.path.join(out_dir, MANIFEST)))
    stale = sorted(os.path.relpath(os.path.join(r, n), out_dir).replace('\\', '/')
                   for r, _, ns in os.walk(out_dir) for n in ns
                   if os.path.normpath(os.path.join(r, n)) not in produced)
    print(f'{len(manifest)} recipe entries built into {out_dir}')
    if stale:
        print(f'{len(stale)} files not produced by the recipe:')
        for path in stale:
            print('  ' + path)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('game_dir')
    parser.add_argument('out_dir')
    parser.add_argument('--recipe', default=DEFAULT_RECIPE)
    parser.add_argument('--ffdec', default=DEFAULT_FFDEC)
    args = parser.parse_args()
    build(args.game_dir, args.out_dir, args.recipe, args.ffdec)


if __name__ == '__main__':
    main()
