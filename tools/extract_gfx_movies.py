"""Extract the Scaleform movies from Witcher 3 .redswf files as plain .swf for JPEXS FFDec.

A .redswf is a CR2W file whose CSwfResource holds a compressed Scaleform movie
("CFX" header + zlib). Rewriting the header to "FWS" with the body inflated gives a
regular uncompressed SWF that FFDec can decompile (ActionScript, shapes, sprites).

Usage: python tools/extract_gfx_movies.py <bundle> <path_regex> <out_dir>
Example:
  python tools/extract_gfx_movies.py "D:/.../content/content0/bundles/r4gui.bundle" "swf/character/" research/swf

<path_regex> is matched against the bundle path with forward slashes.
"""
import os
import re
import sys

from game_files import read_bundle_file, read_bundle_toc
from gfx_movie import gfx_to_swf


def main(bundle, pattern, out_dir):
    regex = re.compile(pattern, re.I)
    os.makedirs(out_dir, exist_ok=True)
    for entry in read_bundle_toc(bundle):
        path = entry[0].replace('\\', '/')
        if not path.endswith('.redswf') or not regex.search(path):
            continue
        name = os.path.splitext(os.path.basename(path))[0] + '.swf'
        swf = gfx_to_swf(read_bundle_file(bundle, entry))
        with open(os.path.join(out_dir, name), 'wb') as f:
            f.write(swf)
        print(f'{name} ({len(swf)} bytes)')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
