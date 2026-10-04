"""Reader for Witcher 3 localization tables (content/content0/<lang>.w3strings). Library and CLI.

Layout (little-endian), as documented by the modding community (rmemr's w3strings encoder, WolvenKit):
  "RTSW", u32 version, u16 key1
  block 1: count (bit6), then per string: u32 id ^ magic, u32 offset, u32 length
  block 2: count (bit6), then per key:    u32 hash(key), u32 id ^ magic
  block 3: count (bit6), then the encrypted text
  u16 key2 at the very end
key1 << 16 | key2 picks the language, and the language gives the magic.
Version 162 (classic) stores UTF-16 and counts offsets and lengths in 16-bit units. Version 164 (5.0,
"Remastered", found by testing, not documented anywhere) stores UTF-8 and counts in bytes. Both
encrypt each unit the same way: XOR with ((length + 1) * key), key starting at (magic >> 8) & 0xFFFF
and rotating left by one bit per unit. Keys are stored only as a hash (Java-style *31 over the
lower-cased UTF-16 key), so look strings up by key name, not by listing.

Usage: python tools/w3strings.py <file.w3strings> <key> [<key> ...]
"""
import struct
import sys

# key1 << 16 | key2  ->  (language, magic). ar, br, esMX, kr and tr share key 0 and magic 0.
LANGUAGES = {
    0x00000000: ('ar/br/esMX/kr/tr', 0x00000000),
    0x43975139: ('en', 0x79321793), 0x83496237: ('pl', 0x73946816), 0x75886138: ('de', 0x42791159),
    0x45931894: ('it', 0x12375973), 0x23863176: ('fr', 0x75921975), 0x24987354: ('cz', 0x21793217),
    0x18796651: ('es', 0x42387566), 0x18632176: ('zh', 0x16875467), 0x63481486: ('ru', 0x42386347),
    0x42378932: ('hu', 0x67823218), 0x54834893: ('jp', 0x59825646),
}


def key_hash(key):
    raw = key.lower().encode('utf-16-le')
    h = 0
    for unit in struct.unpack('<%dH' % (len(raw) // 2), raw):
        h = (h * 31 + unit) & 0xFFFFFFFF
    return h


def _read_bit6(data, pos):
    """Variable-length count: 6 bits in the first byte, then 7 bits per byte."""
    result, shift, i = 0, 0, 1
    while True:
        b = data[pos]
        pos += 1
        if b > 127:
            mask, bits = 127, 7
        else:
            mask, bits = (63 if b > 63 and i == 1 else 255), 6
        result |= (b & mask) << shift
        shift += bits
        if b < 64 or (i >= 3 and b < 128):
            return result, pos
        i += 1


class W3Strings:
    """One .w3strings file: get(key) or by_id(id) return the decoded text."""

    def __init__(self, path):
        with open(path, 'rb') as f:
            data = f.read()
        if data[:4] != b'RTSW':
            raise ValueError('%s: not a w3strings file' % path)
        version, key1 = struct.unpack_from('<IH', data, 4)
        self._utf8 = version >= 164
        key2, = struct.unpack_from('<H', data, len(data) - 2)
        self.language, magic = LANGUAGES[(key1 << 16) | key2]

        pos = 10
        count, pos = _read_bit6(data, pos)
        entries = {}
        for _ in range(count):
            sid, offset, length = struct.unpack_from('<3I', data, pos)
            entries[sid ^ magic] = (offset, length)
            pos += 12
        count, pos = _read_bit6(data, pos)
        self._ids = {}
        for _ in range(count):
            khash, sid = struct.unpack_from('<2I', data, pos)
            self._ids[khash] = sid ^ magic
            pos += 8
        _, pos = _read_bit6(data, pos)
        self._data, self._text_start, self._entries = data, pos, entries
        self._seed = (magic >> 8) & 0xFFFF

    def by_id(self, sid):
        if sid not in self._entries:
            return None
        offset, length = self._entries[sid]
        fmt, size, mask, codec = ('B', 1, 0xFF, 'utf-8') if self._utf8 else ('H', 2, 0xFFFF, 'utf-16-le')
        units = struct.unpack_from('<%d%s' % (length, fmt), self._data, self._text_start + offset * size)
        key, out = self._seed, []
        for unit in units:
            out.append(unit ^ (((length + 1) * key) & mask))
            key = ((key << 1) | (key >> 15)) & 0xFFFF
        return struct.pack('<%d%s' % (length, fmt), *out).decode(codec, errors='replace')

    def id_of(self, key):
        return self._ids.get(key_hash(key))

    def get(self, key):
        sid = self.id_of(key)
        return None if sid is None else self.by_id(sid)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    sys.stdout.reconfigure(encoding='utf-8')
    table = W3Strings(sys.argv[1])
    for k in sys.argv[2:]:
        print('%s = %r' % (k, table.get(k)))
