"""Render the bitmap parts of a movie sprite (no vectors, no text) to check layout against screenshots.

Library only: render_sprite(movies, movie_path, sprite_id, canvas, matrix, frames={sprite_id: frame})
Bitmap fills are drawn as full bitmaps transformed by placement and fill matrices; shape geometry,
vector fills and text are ignored. Alpha from color transforms is applied, color offsets are not.
"""
from PIL import Image

from gfx_movie import IDENTITY, TWIPS


def compose(m, n):
    """m after n (both SVG-style a, b, c, d, tx, ty)."""
    a, b, c, d, e, f = m
    a2, b2, c2, d2, e2, f2 = n
    return (a * a2 + c * b2, b * a2 + d * b2, a * c2 + c * d2, b * c2 + d * d2,
            a * e2 + c * f2 + e, b * e2 + d * f2 + f)


def invert(m):
    a, b, c, d, e, f = m
    det = a * d - b * c
    ia, ib, ic, id_ = d / det, -b / det, -c / det, a / det
    return (ia, ib, ic, id_, -(ia * e + ic * f), -(ib * e + id_ * f))


def draw_bitmap(canvas, image, m, alpha=1.0):
    """Composite image onto canvas through matrix m, with an extra alpha multiplier."""
    ia, ib, ic, id_, ie, if_ = invert(m)
    layer = image.convert('RGBA').transform(canvas.size, Image.AFFINE, (ia, ic, ie, ib, id_, if_),
                                            resample=Image.BILINEAR)
    if alpha < 1:
        layer.putalpha(layer.getchannel('A').point(lambda v: int(v * alpha)))
    canvas.alpha_composite(layer)


def render_sprite(movies, path, sprite_id, canvas, matrix=IDENTITY, frames=None, alpha=1.0, skip=()):
    """Draw sprite_id of movie path (root = 0) and its children; skip lists instance names to leave out."""
    movie = movies.movie(path)
    frames = frames or {}
    for p in movie.display_list(sprite_id, frames.get(sprite_id, 1)).values():
        if p.name in skip:
            continue
        m = compose(matrix, p.matrix or IDENTITY)
        a = alpha * (p.cxform['mult'][3] if p.cxform else 1.0)
        if p.character in movie.shapes:
            for fill in movie.shapes[p.character].fills:
                if fill.kind == 'bitmap' and fill.bitmap in movie.subimages:
                    fill_matrix = tuple(v / TWIPS for v in fill.matrix[:4]) + tuple(fill.matrix[4:])
                    draw_bitmap(canvas, movies.subimage(path, fill.bitmap), compose(m, fill_matrix), a)
        elif p.character in movie.sprites:
            render_sprite(movies, path, p.character, canvas, m, frames, a, skip)
