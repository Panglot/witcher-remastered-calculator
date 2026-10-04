"""Readers for Witcher 3 (next-gen) game files. Library only, used by the other tools.

  read_bundle_toc / read_bundle_file   POTATO70 .bundle archives (content/content0/bundles/*.bundle)
  CR2W                                 CR2W resources: name table, exports and their properties
  swf_textures                         atlas textures (CSwfTexture, DXT5) embedded in a .redswf
  TextureCache                         content/content0/texture.cache (footer magic HCXT, version 7)

UI panels are Scaleform movies stored as .redswf (CR2W) files inside r4gui.bundle; gfx_movie.py
parses the movie itself. Icons loaded by name at runtime live in texture.cache.
"""
import io
import os
import struct
import zlib

from PIL import Image

BUNDLE_ENTRY_SIZE = 0x130
COMPRESSION_NONE, COMPRESSION_ZLIB = 0, 1
PAGE_SIZE = 4096
FORMAT_DXT5, FORMAT_RGBA8 = 8, 253


def content_path(game_dir, *parts):
    """Path inside <game_dir>/content/content0."""
    return os.path.join(game_dir, 'content', 'content0', *parts)


def read_bundle_toc(path):
    """Return [(name, offset, size, zsize, compression)] for a POTATO70 bundle."""
    with open(path, 'rb') as f:
        header = f.read(32)
        if header[:8] != b'POTATO70':
            raise ValueError(f'{path} is not a POTATO70 bundle')
        toc_size = struct.unpack_from('<I', header, 16)[0]
        toc = f.read(toc_size)
    entries = []
    for i in range(toc_size // BUNDLE_ENTRY_SIZE):
        e = toc[i * BUNDLE_ENTRY_SIZE:(i + 1) * BUNDLE_ENTRY_SIZE]
        name = e[:0x100].split(b'\0')[0].decode('latin1')
        offset, _, size, zsize, _crc, comp = struct.unpack_from('<IIIIII', e, 0x110)
        entries.append((name, offset, size, zsize, comp))
    return entries


def read_bundle_file(path, entry):
    name, offset, _size, zsize, comp = entry
    with open(path, 'rb') as f:
        f.seek(offset)
        data = f.read(zsize)
    if comp == COMPRESSION_ZLIB:
        return zlib.decompress(data)
    if comp == COMPRESSION_NONE:
        return data
    raise NotImplementedError(f'compression {comp} not supported ({name})')


class CR2W:
    """Minimal CR2W reader: string/name tables, exports and their properties."""

    def __init__(self, data):
        self.data = data
        tables = [struct.unpack_from('<III', data, 0x28 + i * 12) for i in range(10)]
        str_off, str_size, _ = tables[0]
        self.strings = data[str_off:str_off + str_size]
        name_off, name_count, _ = tables[1]
        self.names = [self._string(struct.unpack_from('<I', data, name_off + i * 8)[0]) for i in range(name_count)]
        exp_off, exp_count, _ = tables[4]
        self.exports = []
        for i in range(exp_count):
            cls, _flags, _parent, size, offset, _tmpl, _crc = struct.unpack_from('<HHIIIII', data, exp_off + i * 24)
            self.exports.append({'cls': self.names[cls], 'size': size, 'offset': offset})

    def _string(self, offset):
        return self.strings[offset:self.strings.index(b'\0', offset)].decode('latin1')

    def properties(self, export):
        """Return ({name: (type, raw_bytes)}, offset right after the property block)."""
        p = export['offset'] + 1
        props = {}
        while True:
            name_idx = struct.unpack_from('<H', self.data, p)[0]
            if name_idx == 0:
                return props, p + 2
            type_idx, size = struct.unpack_from('<HI', self.data, p + 2)
            props[self.names[name_idx]] = (self.names[type_idx], self.data[p + 8:p + 4 + size])
            p += 4 + size


def dxt5_dds(width, height, blocks, fourcc=b'DXT5'):
    header = struct.pack('<4sIIIIIII44xII4sIIIIIIIIII', b'DDS ', 124, 0x81007, height, width, len(blocks), 0, 1,
                         32, 4, fourcc, 0, 0, 0, 0, 0, 0x1000, 0, 0, 0, 0)
    return header + blocks


# CSwfTexture compression -> DDS FourCC.
SWF_TEXTURE_FOURCC = {'TCM_DXTAlpha': b'DXT5', 'TCM_DXTNoAlpha': b'DXT1'}


def swf_textures(redswf_bytes):
    """Yield (linkage_name, PIL.Image) for each CSwfTexture in a .redswf file."""
    cr2w = CR2W(redswf_bytes)
    for export in cr2w.exports:
        if export['cls'] != 'CSwfTexture':
            continue
        props, p = cr2w.properties(export)
        compression = cr2w.names[struct.unpack('<H', props['compression'][1])[0]]
        if compression not in SWF_TEXTURE_FOURCC:
            raise NotImplementedError(f'texture compression {compression}')
        name = props['linkageName'][1][1:].decode('latin1').rstrip('\0')
        # after properties: unk u32, mip count u32, then per mip: width, height, pitch, size, block size, data
        p += 8
        width, height, _pitch, size, _block = struct.unpack_from('<IIIII', cr2w.data, p)
        p += 20
        dds = dxt5_dds(width, height, cr2w.data[p:p + size], SWF_TEXTURE_FOURCC[compression])
        yield name, Image.open(io.BytesIO(dds))


class TextureCache:
    """Reader for content0/texture.cache (footer magic HCXT, version 7)."""

    ENTRY = struct.Struct('<IiiiiIHHHHiiqBBBB')

    def __init__(self, path):
        self.file = open(path, 'rb')
        self.file.seek(-32, os.SEEK_END)
        _crc, _pages, count, str_size, mip_count, magic, _ver = struct.unpack('<QIIIIII', self.file.read(32))
        if magic != 0x54584348:  # 'HCXT'
            raise ValueError(f'{path} is not a texture.cache')
        self.file.seek(-(32 + count * self.ENTRY.size + str_size + mip_count * 4), os.SEEK_END)
        self.file.seek(mip_count * 4, os.SEEK_CUR)
        strings = self.file.read(str_size)
        table = self.file.read(count * self.ENTRY.size)
        self.entries = {}
        for i in range(count):
            e = self.ENTRY.unpack_from(table, i * self.ENTRY.size)
            name_off, page, width, height, fmt = e[1], e[2], e[6], e[7], e[13]
            name = strings[name_off:strings.index(b'\0', name_off)].decode('latin1').lower()
            self.entries[name] = (page, width, height, fmt)

    def image(self, name):
        page, width, height, fmt = self.entries[name.lower()]
        self.file.seek(page * PAGE_SIZE)
        zsize, size, _part = struct.unpack('<IIB', self.file.read(9))
        data = zlib.decompressobj().decompress(self.file.read(zsize))
        if fmt == FORMAT_RGBA8:
            return Image.frombytes('RGBA', (width, height), data[:width * height * 4])
        if fmt == FORMAT_DXT5:
            return Image.open(io.BytesIO(dxt5_dds(width, height, data[:size])))
        raise NotImplementedError(f'texture format {fmt} ({name})')
