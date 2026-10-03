"""Extract Geralt's skill icons from a Witcher 3 (next-gen) install, named by skill id.

Skill definitions (gameplay/abilities/geralt_skills.xml in xml.bundle) give each skill an
iconPath such as icons\\Skills\\Sword\\sword_s1.png. The cooked texture lives in
content0/texture.cache under gameplay\\gui_new\\<iconPath>.

The cache also holds ~205px "_debug" / "_notfunctional" placeholder cards; only the
64x64 entries are the real in-game glyphs, so lookups use the exact iconPath only.

Usage: python tools/extract_skill_icons.py <game_dir> <out_dir>
Writes <out_dir>/<tree>/<skill_name>.png and <out_dir>/skills.json.
"""
import json
import os
import re
import sys

from game_files import TextureCache, content_path, read_bundle_file, read_bundle_toc

SKILLS_XML = 'gameplay\\abilities\\geralt_skills.xml'
ICON_ROOT = 'gameplay\\gui_new\\'


def read_skills(game_dir):
    bundle = content_path(game_dir, 'bundles', 'xml.bundle')
    entry = next(e for e in read_bundle_toc(bundle) if e[0] == SKILLS_XML)
    xml = read_bundle_file(bundle, entry).decode('utf-8', errors='replace')
    xml = re.sub(r'<!--.*?-->', '', xml, flags=re.S)
    skills = []
    for attrs in re.findall(r'<skill\s([^>]*)>', xml, flags=re.S):
        a = dict(re.findall(r'(\w+)="([^"]*)"', attrs))
        if a.get('iconPath', 'FIXME') != 'FIXME':
            skills.append({'skill': a['skill_name'], 'tree': a.get('pathType_name') or 'None',
                           'core': a.get('isCoreSkill') == '1', 'iconPath': a['iconPath']})
    return skills


def main(game_dir, out_dir, exclude_trees=()):
    cache = TextureCache(content_path(game_dir, 'texture.cache'))
    skills = [s for s in read_skills(game_dir) if s['tree'] not in exclude_trees]
    for s in skills:
        dest = os.path.join(out_dir, s['tree'].lower(), s['skill'] + '.png')
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        cache.image(ICON_ROOT + s['iconPath']).save(dest)
        s['file'] = os.path.relpath(dest, out_dir).replace('\\', '/')
    with open(os.path.join(out_dir, 'skills.json'), 'w') as f:
        json.dump(skills, f, indent=2)
    print(f'{len(skills)} skill icons written to {out_dir}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(*sys.argv[1:])
