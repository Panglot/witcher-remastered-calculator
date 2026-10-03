"""Read the parts of a Scaleform (GFX) movie needed to rebuild Witcher 3 UI art.

Parses an uncompressed SWF (see gfx_to_swf) into:
  images     DefineExternalImage2 (GFX tag 1009): id -> atlas texture file and size
  subimages  DefineSubImage (GFX tag 1008): id -> rectangle on an atlas
  shapes     DefineShape1-4: bounds and every fill style (bitmap fills point at sub-images)
  sprites    DefineSprite plus the root timeline (id 0): frame labels and PlaceObject placements
  texts      DefineEditText: bounds, font height, color, initial (HTML) text
  classes    SymbolClass: character id -> ActionScript class name

Units: pixels (twips / 20). Matrices are (a, b, c, d, tx, ty) as in SVG matrix().

GameMovies(game_dir) loads movies straight from r4gui.bundle and gives each movie's atlas textures and slices.
"""
import struct
import zlib
from dataclasses import dataclass, field

from game_files import content_path, read_bundle_file, read_bundle_toc, swf_textures

TWIPS = 20.0

TAG_SHOW_FRAME, TAG_PLACE2, TAG_PLACE3, TAG_FRAME_LABEL = 1, 26, 70, 43
TAG_REMOVE, TAG_REMOVE2 = 5, 28
TAG_SPRITE, TAG_EDIT_TEXT, TAG_SYMBOL_CLASS, TAG_EXPORT_ASSETS = 39, 37, 76, 56
TAG_SHAPES = {2: 1, 22: 2, 32: 3, 83: 4}  # tag code -> DefineShape version
TAG_GFX_SUB_IMAGE, TAG_GFX_EXTERNAL_IMAGE2 = 1008, 1009
IDENTITY = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
BLEND_MODES = {0: 'normal', 1: 'normal', 2: 'layer', 3: 'multiply', 4: 'screen', 5: 'lighten', 6: 'darken',
               7: 'difference', 8: 'add', 9: 'subtract', 10: 'invert', 11: 'alpha', 12: 'erase', 13: 'overlay',
               14: 'hardlight'}


class Reader:
    """Byte and MSB-first bit reader over SWF data."""

    def __init__(self, data, pos=0, end=None):
        self.data, self.pos, self.end = data, pos, len(data) if end is None else end
        self.bit = 0

    def align(self):
        if self.bit:
            self.pos += 1
            self.bit = 0

    def ub(self, n):
        value = 0
        for _ in range(n):
            value = (value << 1) | ((self.data[self.pos] >> (7 - self.bit)) & 1)
            self.bit += 1
            if self.bit == 8:
                self.pos += 1
                self.bit = 0
        return value

    def sb(self, n):
        value = self.ub(n)
        return value - (1 << n) if n and value & (1 << (n - 1)) else value

    def unpack(self, fmt):
        self.align()
        values = struct.unpack_from('<' + fmt, self.data, self.pos)
        self.pos += struct.calcsize('<' + fmt)
        return values if len(values) > 1 else values[0]

    def u8(self):
        return self.unpack('B')

    def u16(self):
        return self.unpack('H')

    def string(self):
        self.align()
        end = self.data.index(b'\0', self.pos)
        text = self.data[self.pos:end].decode('utf-8', errors='replace')
        self.pos = end + 1
        return text

    def rect(self):
        self.align()
        n = self.ub(5)
        x1, x2, y1, y2 = (self.sb(n) / TWIPS for _ in range(4))
        self.align()
        return (x1, y1, x2, y2)

    def matrix(self):
        self.align()
        a = d = 1.0
        b = c = 0.0
        if self.ub(1):
            n = self.ub(5)
            a, d = self.sb(n) / 65536.0, self.sb(n) / 65536.0
        if self.ub(1):
            n = self.ub(5)
            b, c = self.sb(n) / 65536.0, self.sb(n) / 65536.0
        n = self.ub(5)
        tx, ty = self.sb(n) / TWIPS, self.sb(n) / TWIPS
        self.align()
        return (a, b, c, d, tx, ty)

    def cxform(self, alpha=True):
        """Return {'mult': (r, g, b, a), 'add': (r, g, b, a)}; mult is 1.0-based."""
        self.align()
        has_add, has_mult, n = self.ub(1), self.ub(1), self.ub(4)
        channels = 4 if alpha else 3
        mult = tuple(self.sb(n) / 256.0 for _ in range(channels)) if has_mult else (1.0,) * channels
        add = tuple(self.sb(n) for _ in range(channels)) if has_add else (0,) * channels
        self.align()
        return {'mult': mult, 'add': add}

    def color(self, alpha):
        r, g, b = self.unpack('BBB')
        return f'#{r:02x}{g:02x}{b:02x}' + (f'{self.u8():02x}' if alpha else '')

    def tags(self):
        """Yield (code, Reader over the tag body) until the End tag."""
        while self.pos < self.end:
            header = self.u16()
            code, length = header >> 6, header & 0x3F
            if length == 0x3F:
                length = self.unpack('I')
            body = Reader(self.data, self.pos, self.pos + length)
            self.pos += length
            if code == 0:
                return
            yield code, body


@dataclass
class Fill:
    kind: str                      # solid, linear, radial, focal, bitmap
    color: str = None              # solid
    bitmap: int = None             # bitmap: sub-image or image id
    matrix: tuple = None           # gradient / bitmap matrix
    stops: list = None             # gradient: [(ratio 0-255, color)]


@dataclass
class Shape:
    id: int
    bounds: tuple
    fills: list = field(default_factory=list)

    @property
    def bitmaps(self):
        return sorted({f.bitmap for f in self.fills if f.kind == 'bitmap' and f.bitmap != 0xFFFF})


@dataclass
class Placement:
    frame: int                     # 1-based frame where the tag occurs
    label: str                     # frame label in effect (None before the first label)
    depth: int
    character: int = None          # None when the tag only moves/modifies an existing object
    name: str = None               # instance name
    matrix: tuple = None
    cxform: dict = None
    blend: str = None
    class_name: str = None
    removed: bool = False          # RemoveObject: the object at this depth is taken off the display list


@dataclass
class Sprite:
    id: int
    frame_count: int
    labels: dict = field(default_factory=dict)       # label -> first frame (1-based)
    placements: list = field(default_factory=list)


@dataclass
class EditText:
    id: int
    bounds: tuple
    font: int = None
    height: float = None
    color: str = None
    align: int = None
    variable: str = ''
    text: str = None
    html: bool = False


class GfxMovie:
    def __init__(self, swf):
        if swf[:3] != b'FWS':
            raise ValueError('expected an uncompressed FWS movie (use gfx_to_swf)')
        r = Reader(swf, 8)
        self.size = r.rect()
        self.frame_rate = r.u16() / 256.0
        r.u16()  # frame count
        self.images, self.subimages, self.shapes, self.sprites = {}, {}, {}, {}
        self.texts, self.classes = {}, {}
        self.sprites[0] = self._timeline(0, 0, r)

    def _timeline(self, sprite_id, frame_count, r):
        sprite = Sprite(sprite_id, frame_count)
        frame, label = 1, None
        for code, body in r.tags():
            if code == TAG_SHOW_FRAME:
                frame += 1
            elif code == TAG_FRAME_LABEL:
                label = body.string()
                sprite.labels.setdefault(label, frame)
            elif code in (TAG_PLACE2, TAG_PLACE3):
                sprite.placements.append(self._place(body, code == TAG_PLACE3, frame, label))
            elif code in (TAG_REMOVE, TAG_REMOVE2):
                if code == TAG_REMOVE:
                    body.u16()  # character id
                sprite.placements.append(Placement(frame, label, body.u16(), removed=True))
            elif code == TAG_SPRITE:
                sid, count = body.unpack('HH')
                self.sprites[sid] = self._timeline(sid, count, body)
            elif code in TAG_SHAPES:
                shape = self._shape(body, TAG_SHAPES[code])
                self.shapes[shape.id] = shape
            elif code == TAG_EDIT_TEXT:
                text = self._edit_text(body)
                self.texts[text.id] = text
            elif code in (TAG_SYMBOL_CLASS, TAG_EXPORT_ASSETS):
                for _ in range(body.u16()):
                    cid = body.u16()
                    self.classes[cid] = body.string()
            elif code == TAG_GFX_SUB_IMAGE:
                sid, image, x1, y1, x2, y2 = body.unpack('HHHHHH')
                self.subimages[sid] = (image, (x1, y1, x2, y2))
            elif code == TAG_GFX_EXTERNAL_IMAGE2:
                iid, _fmt, _unk, width, height = body.unpack('HHHHH')
                export_name = body.data[body.pos + 1:body.pos + 1 + body.data[body.pos]]
                body.pos += 1 + len(export_name)
                file_name = body.data[body.pos + 1:body.pos + 1 + body.data[body.pos]].decode('latin1')
                self.images[iid] = (file_name, width, height)
        return sprite

    @staticmethod
    def _place(r, version3, frame, label):
        flags = r.u8()
        flags2 = r.u8() if version3 else 0
        p = Placement(frame, label, r.u16())
        # The spec also implies a class name for HasImage + HasCharacter; these movies (and FFDec) disagree.
        if version3 and flags2 & 0x08:
            p.class_name = r.string()
        if flags & 0x02:
            p.character = r.u16()
        if flags & 0x04:
            p.matrix = r.matrix()
        if flags & 0x08:
            p.cxform = r.cxform()
        if flags & 0x10:
            r.u16()  # ratio
        if flags & 0x20:
            p.name = r.string()
        if flags & 0x40:
            r.u16()  # clip depth
        if version3 and flags2 & 0x02:
            if flags2 & 0x01:
                _skip_filters(r)
            p.blend = BLEND_MODES.get(r.u8(), 'normal')
        return p

    def _shape(self, r, version):
        shape = Shape(r.u16(), r.rect())
        if version == 4:
            r.rect()
            r.u8()
        alpha = version >= 3
        fill_bits, line_bits = self._styles(r, shape, version, alpha)
        while True:  # shape records; StyleChange records may add new style arrays
            if r.ub(1) == 0:
                new_styles, line, fill1, fill0, move = (r.ub(1) for _ in range(5))
                if not (new_styles or line or fill1 or fill0 or move):
                    return shape
                if move:
                    n = r.ub(5)
                    r.sb(n), r.sb(n)
                if fill0:
                    r.ub(fill_bits)
                if fill1:
                    r.ub(fill_bits)
                if line:
                    r.ub(line_bits)
                if new_styles:
                    fill_bits, line_bits = self._styles(r, shape, version, alpha)
            else:
                straight, n = r.ub(1), r.ub(4) + 2
                if straight:
                    if r.ub(1):
                        r.sb(n), r.sb(n)
                    else:
                        r.ub(1)
                        r.sb(n)
                else:
                    for _ in range(4):
                        r.sb(n)

    def _styles(self, r, shape, version, alpha):
        count = r.u8()
        if count == 0xFF and version >= 2:
            count = r.u16()
        shape.fills += [_fill(r, alpha) for _ in range(count)]
        count = r.u8()
        if count == 0xFF and version >= 2:
            count = r.u16()
        for _ in range(count):
            r.u16()  # width
            if version == 4:
                r.ub(2)
                join = r.ub(2)
                has_fill = r.ub(1)
                r.ub(11)
                if join == 2:
                    r.u16()
                if has_fill:
                    _fill(r, True)
                else:
                    r.color(True)
            else:
                r.color(alpha)
        r.align()
        return r.ub(4), r.ub(4)

    @staticmethod
    def _edit_text(r):
        t = EditText(r.u16(), r.rect())
        f1, f2 = r.u8(), r.u8()
        if f1 & 0x01:
            t.font = r.u16()
        if f2 & 0x80:
            r.string()  # font class
        if f1 & 0x01 or f2 & 0x80:
            t.height = r.u16() / TWIPS
        if f1 & 0x04:
            t.color = r.color(True)
        if f1 & 0x02:
            r.u16()  # max length
        if f2 & 0x20:
            t.align = r.u8()
            r.unpack('HHHh')
        t.variable = r.string()
        if f1 & 0x80:
            t.text = r.string()
        t.html = bool(f2 & 0x02)
        return t

    # Queries

    def subimage_rect(self, sub_id):
        """Return (atlas texture file name, (x1, y1, x2, y2)) of a sub-image."""
        image, rect = self.subimages[sub_id]
        return self.images[image][0], rect

    def class_name(self, character):
        """Short ActionScript class name of a character, or None."""
        name = self.classes.get(character)
        return name.split('.')[-1] if name else None

    def display_list(self, sprite_id, frame):
        """Objects visible on a frame (1-based number or label), as {depth: Placement} with merged moves."""
        sprite = self.sprites[sprite_id]
        frame = sprite.labels[frame] if isinstance(frame, str) else frame
        objects = {}
        for p in sprite.placements:
            if p.frame > frame:
                break
            if p.removed:
                objects.pop(p.depth, None)
            elif p.character is not None:
                objects[p.depth] = p
            elif p.depth in objects:  # move/modify: keep the character, take the new properties
                old = objects[p.depth]
                objects[p.depth] = Placement(p.frame, p.label, p.depth, old.character, p.name or old.name,
                                             p.matrix or old.matrix, p.cxform or old.cxform,
                                             p.blend or old.blend, old.class_name)
        return dict(sorted(objects.items()))

    def parents(self):
        """character id -> [(sprite id, Placement)] for every placement that creates it."""
        result = {}
        for sprite in self.sprites.values():
            for p in sprite.placements:
                if p.character is not None:
                    result.setdefault(p.character, []).append((sprite.id, p))
        return result


def _fill(r, alpha):
    kind = r.u8()
    if kind == 0x00:
        return Fill('solid', color=r.color(alpha))
    if kind in (0x10, 0x12, 0x13):
        matrix = r.matrix()
        info = r.u8()
        stops = [(r.u8(), r.color(alpha)) for _ in range(info & 0x0F)]
        if kind == 0x13:
            r.u16()  # focal point
        return Fill({0x10: 'linear', 0x12: 'radial', 0x13: 'focal'}[kind], matrix=matrix, stops=stops)
    if 0x40 <= kind <= 0x43:
        bitmap = r.u16()
        return Fill('bitmap', bitmap=bitmap, matrix=r.matrix())
    raise ValueError(f'unknown fill style type {kind:#x}')


def _skip_filters(r):
    fixed_sizes = {0: 23, 1: 9, 2: 15, 3: 27, 6: 80}
    for _ in range(r.u8()):
        kind = r.u8()
        if kind in fixed_sizes:
            r.pos += fixed_sizes[kind]
        elif kind in (4, 7):  # gradient glow / gradient bevel
            r.pos += r.u8() * 5 + 19
        elif kind == 5:  # convolution
            mx, my = r.u8(), r.u8()
            r.pos += 8 + mx * my * 4 + 5
        else:
            raise ValueError(f'unknown filter type {kind}')


def gfx_to_swf(redswf_bytes):
    """Return the movie embedded in a .redswf as an uncompressed 'FWS' SWF."""
    start = redswf_bytes.find(b'CFX')
    if start < 0:
        raise ValueError('no CFX movie in file')
    version = redswf_bytes[start + 3]
    body = zlib.decompressobj().decompress(redswf_bytes[start + 8:])
    return b'FWS' + bytes([version]) + struct.pack('<I', 8 + len(body)) + body


class GameMovies:
    """Loads .redswf movies from r4gui.bundle once and caches the parsed movie and its textures."""

    def __init__(self, game_dir):
        self.bundle = content_path(game_dir, 'bundles', 'r4gui.bundle')
        self.entries = {e[0].replace('\\', '/').lower(): e for e in read_bundle_toc(self.bundle)}
        self._raw, self._movies, self._textures = {}, {}, {}

    def redswf(self, path):
        if path not in self._raw:
            self._raw[path] = read_bundle_file(self.bundle, self.entries[path.lower()])
        return self._raw[path]

    def swf(self, path):
        return gfx_to_swf(self.redswf(path))

    def movie(self, path):
        if path not in self._movies:
            self._movies[path] = GfxMovie(self.swf(path))
        return self._movies[path]

    def textures(self, path):
        """Atlas file name (as in DefineExternalImage2, '.dds') -> PIL image."""
        if path not in self._textures:
            self._textures[path] = {name: image for name, image in swf_textures(self.redswf(path))}
        return self._textures[path]

    def subimage(self, path, sub_id):
        atlas, rect = self.movie(path).subimage_rect(sub_id)
        return self.textures(path)[atlas].crop(rect)
