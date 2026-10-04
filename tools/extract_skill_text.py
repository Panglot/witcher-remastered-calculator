"""Extract skill names and per-rank tooltip text from a Witcher 3 (next-gen) install.

Runs the game's own tooltip code (GetSkillTooltipDescriptionForSkillLevel in
scripts/game/gui/menus/characterMenuDupe.ws) with wscript.py for every rank of every tree skill.
The numbers come from the skill abilities in xml.bundle (gameplay/abilities/*.xml), the text from
content0/en.w3strings. Each number the script puts into the text becomes a {placeholder}, so the
result is a template plus numbers per rank:

  sword_s23: { name: "Strength Training", maxRank: 3,
               text: "Fast attacks increase the next strong attack's damage by {damage_increase}%.",
               values: { damage_increase: [15, 30, 45] } }

`text` is an array (one template per rank) when the game uses different text per rank.
The tree passive line the game appends (e.g. "Adrenaline Point gain: +1%") is left out: the
planner shows the passive itself. Values that depend on the character (sign intensity, max
Stamina) can't be known offline; those skills get `dynamic` and the base character's values.

Usage: python tools/extract_skill_text.py <game_dir> <out.js> [--lang en]
"""
import argparse
import json
import re
import sys

from game_files import content_path, read_bundle_file, read_bundle_toc
from w3strings import W3Strings
from wscript import AttributeValue, Concat, Interpreter, Obj, ScriptError, ScriptIndex, src_of, tag

ABILITY_DIR = 'gameplay\\abilities\\'      # abilities_plus\ is an older copy the 5.0 scripts don't match
SKILLS_XML = ABILITY_DIR + 'geralt_skills.xml'
TOOLTIP_FN = 'GetSkillTooltipDescriptionForSkillLevel'
TOOLTIP_FILE = 'characterMenuDupe.ws'
VALUE_FIELD = {'add': 'valueAdditive', 'mult': 'valueMultiplicative', 'base': 'valueBase'}
# Keys of the per-tree passive line each tooltip function appends.
PASSIVE_KEYS = ('focus_gain', 'attribute_name_staminaregen', 'attribute_potion_duration_time',
                'skill_tree_buff_survival')
# The base character, for the few tooltips that read live stats. Assumption: Geralt without gear.
BASE_STATS = {'BCS_Stamina': 100}
# Numbers a rank's text states in words instead of a number, for ranks the attribute is missing
# from: written as `missing` so a view listing every rank at once can show them. Muscle Memory
# rank 1 reads "your next Fast Attack", one attack. Other missing numbers mean the effect is off (0).
MISSING_VALUES = {'sword_s22': {'trigger_at_attack_count': 1}}
# Enum members the engine declares (character stats), used by name only.
ENGINE_ENUMS = r'^BCS_\w+$'
RANK_SUFFIX = re.compile(r'_(?:lvl|level_?)\d$|_desc(?=_|$)')


class CharacterDependent(ScriptError):
    pass


def strip_comments(xml):
    return re.sub(r'<!--.*?-->', '', xml, flags=re.S)


def read_abilities(game_dir):
    """{ability: {attribute: (min, max)}} as AttributeValues, from every gameplay/abilities XML."""
    bundle = content_path(game_dir, 'bundles', 'xml.bundle')
    abilities, untyped, skills_xml, bad = {}, set(), None, []
    for entry in read_bundle_toc(bundle):
        if not (entry[0].startswith(ABILITY_DIR) and entry[0].endswith('.xml')):
            continue
        xml = strip_comments(read_bundle_file(bundle, entry).decode('utf-8', errors='replace'))
        if entry[0] == SKILLS_XML:
            skills_xml = xml
        for name, body in re.findall(r'<ability\s+name="([^"]+)"[^>]*>(.*?)</ability>', xml, flags=re.S):
            attrs = abilities.setdefault(name, {})
            for attr, props in re.findall(r'<(\w+)\s+([^>]*?)/>', body):
                p = dict(re.findall(r'(\w+)="([^"]*)"', props))
                if 'min' not in p and 'max' not in p:
                    continue
                if 'type' not in p:
                    untyped.add('%s.%s' % (name, attr))
                field = VALUE_FIELD.get(p.get('type', 'base'), 'valueBase')
                try:
                    lo = float(p.get('min', p.get('max')))
                    hi = float(p.get('max', lo))
                except ValueError:
                    bad.append('%s.%s has an unreadable number (%s)' % (name, attr, props.strip()))
                    continue
                # One attribute can be listed once per type (add, mult, base): they combine.
                pair = attrs.setdefault(attr, (AttributeValue(src=(attr,)), AttributeValue(src=(attr,))))
                for av, v in zip(pair, (lo, hi)):
                    setattr(av, field, getattr(av, field) + v)
    return abilities, skills_xml, untyped, bad


def read_tree_skills(skills_xml):
    """Tree skills (those with a grid position) in file order: the <skill> attributes."""
    skills = []
    for attrs in re.findall(r'<skill\s([^>]*?)/?>', skills_xml, flags=re.S):
        a = dict(re.findall(r'(\w+)="([^"]*)"', attrs))
        if 'gridRow' in a and 'skill_name' in a:
            skills.append(a)
    return skills


class SkillTooltips:
    def __init__(self, game_dir, lang):
        self.strings = W3Strings(content_path(game_dir, '%s.w3strings' % lang))
        self.abilities, skills_xml, self.untyped, self.bad_numbers = read_abilities(game_dir)
        self.skills = read_tree_skills(skills_xml)
        self.index = ScriptIndex(content_path(game_dir, 'scripts'))
        self.warnings = []
        self.rank = 1
        self.used_stats = set()
        self.player = Obj('W3PlayerWitcher')
        dm = Obj('CDefinitionsManagerAccessor')
        game = Obj('CR4Game')
        self.menu = Obj('CR4CharacterMenu')

        def ability_value(ability, attr):
            if '%s.%s' % (ability, attr) in self.untyped:
                self.warnings.append('%s.%s has no type in the XML; read as base' % (ability, attr))
            pair = self.abilities.get(ability, {}).get(attr)
            if pair is None:
                return AttributeValue(src=(attr,)), AttributeValue(src=(attr,))
            return pair[0].copy(), pair[1].copy()

        def get_ability_attribute(_, args, outs):
            lo, hi = ability_value(args[0], args[1])
            outs[2](lo)
            outs[3](hi)
        get_ability_attribute.wants_outs = True

        def skill_attribute(_, skill, attr, *rest):
            lo, hi = ability_value(self.interp.call('SkillEnumToName', [skill]), attr)
            return randomized(lo, hi)

        def randomized(lo, hi):
            if (lo.valueBase, lo.valueAdditive, lo.valueMultiplicative) != (
                    hi.valueBase, hi.valueAdditive, hi.valueMultiplicative):
                self.warnings.append('%s has a min-max range; using min' % '/'.join(lo.src))
            return lo.copy()

        def live_stat(what):
            def f(_, *args):
                stat = str(args[0]) if args else ''
                if stat in BASE_STATS:
                    self.used_stats.add('%s(%s) = %s' % (what, stat, BASE_STATS[stat]))
                    return BASE_STATS[stat]
                raise CharacterDependent('%s(%s)' % (what, stat))
            return f

        def loc(key):
            text = self.strings.get(str(key))
            if text is None:
                self.warnings.append('missing string "%s"' % key)
                return ''
            return text

        def loc_params(key, ints=None, floats=None, strs=None, nbsp=None):
            text = Concat(loc(key))
            for marker, values in (('$I$', ints), ('$F$', floats), ('$S$', strs)):
                for v in values or []:
                    text = text.replace_first(marker, v)
            return text

        def no_trail_zeros(f):
            return tag(float(f), src_of(f))

        natives = {
            'GetLocStringByKeyExt': loc,
            'GetLocStringByKeyExtWithParams': loc_params,
            'GetWitcherPlayer': lambda: self.player,
            'CalculateAttributeValue': lambda a, *_: tag(a.valueBase * a.valueMultiplicative + a.valueAdditive, a.src),
            'GetAttributeRandomizedValue': randomized,
            'RoundMath': lambda f: tag(round_half_away(f), src_of(f)),
            'RoundF': lambda f: tag(round_half_away(f), src_of(f)),
            'FloorF': lambda f: tag(int(f // 1), src_of(f)),
            'CeilF': lambda f: tag(-int(-f // 1), src_of(f)),
            'Min': lambda a, b: a if a <= b else b, 'Max': lambda a, b: a if a >= b else b,
            'MinF': lambda a, b: a if a <= b else b, 'MaxF': lambda a, b: a if a >= b else b,
            'NoTrailZeros': no_trail_zeros,
            'FloatToString': no_trail_zeros,
            'IntToString': lambda i: i,
            'LogAssert': lambda *a: None,
        }
        methods = {
            ('W3PlayerWitcher', 'GetSkillAttributeValue'): skill_attribute,
            ('W3PlayerWitcher', 'GetSkillLevel'): lambda _, skill: self.rank,
            ('W3PlayerWitcher', 'GetBoughtSkillLevel'): lambda _, skill: self.rank,
            ('W3PlayerWitcher', 'GetStatMax'): live_stat('GetStatMax'),
            ('W3PlayerWitcher', 'GetStat'): live_stat('GetStat'),
            ('W3PlayerWitcher', 'GetTotalSignSpellPower'): live_stat('GetTotalSignSpellPower'),
            ('CR4Game', 'GetDefinitionsManager'): lambda _: dm,
            ('CDefinitionsManagerAccessor', 'GetAbilityAttributeValue'): get_ability_attribute,
        }
        self.interp = Interpreter(self.index, natives, methods,
                                  {'theGame': game, 'thePlayer': self.player}, engine_enums=ENGINE_ENUMS)

    def target_skill(self, a):
        return Obj('SSkill',
                   skillType=self.interp.call('SkillNameToEnum', [a['skill_name']]),
                   localisationNameKey=a.get('localisationName', ''),
                   localisationDescriptionKey=a.get('localisationDescription', ''),
                   localisationDescriptionLevel2Key=a.get('localisationDescriptionLevel2', ''),
                   localisationDescriptionLevel3Key=a.get('localisationDescriptionLevel3', ''),
                   maxLevel=int(a.get('maxLevel', 1)))

    def rank_text(self, skill, rank):
        """(text with \\x00n\\x00 markers, [numbers]) for one rank, passive line removed."""
        self.rank = rank
        fn = self.index.function(TOOLTIP_FN)
        path = next(f.path for f in self.index.functions[TOOLTIP_FN] if f.path.endswith(TOOLTIP_FILE))
        result = self.interp.call(TOOLTIP_FN, [skill, rank], self.menu, path)
        if fn is None or result is None:
            raise ScriptError('tooltip function returned nothing')
        text = result if isinstance(result, Concat) else Concat(result)
        return clean(text, text.parts, [self.strings.get(k) or '\x01' for k in PASSIVE_KEYS])

    def extract(self, a):
        skill = self.target_skill(a)
        out = {'name': self.strings.get(skill['localisationNameKey']) or a['skill_name'],
               'maxRank': skill['maxLevel']}
        ranks, dynamic = [], set()
        for rank in range(1, skill['maxLevel'] + 1):
            self.used_stats = set()
            try:
                ranks.append(self.rank_text(skill, rank))
            except CharacterDependent as e:
                dynamic.add(str(e))
                ranks.append(None)
            dynamic.update(self.used_stats)
        if dynamic:
            out['dynamic'] = sorted(dynamic)
        out.update(build_template([r for r in ranks if r is not None]) if any(ranks) else {})
        if a['skill_name'] in MISSING_VALUES:
            out['missing'] = MISSING_VALUES[a['skill_name']]
        return out


def round_half_away(f):
    return int(f + 0.5) if f >= 0 else -int(-f + 0.5)


def clean(text, parts, passive_labels):
    lines = re.split(r'<br\s*/?>', str(text))
    keep = [l for l in lines if not any(l.strip().startswith(p) for p in passive_labels)]
    joined = '\n'.join(keep).strip()
    joined = re.sub(r'</?font[^>]*>', '', joined)
    used = [int(m) for m in re.findall(r'\x00(\d+)\x00', joined)]
    return joined, [parts[i] for i in used], used


def placeholder_name(number):
    names = [RANK_SUFFIX.sub('', s) for s in src_of(number)]
    return names[0] if names else 'value'


def as_number(v):
    if isinstance(v, int):
        return int(v)
    r = round(float(v), 4)
    return int(r) if r == int(r) else r


def build_template(ranks):
    """Turn per-rank (text, numbers, marker ids) into {text, values}."""
    # Name each number after its XML attribute. A number without one (a literal in the script)
    # takes the name used at the same position by a rank with as many numbers.
    raw = [[placeholder_name(n) for n in numbers] for _, numbers, _ in ranks]
    for names in raw:
        for k, name in enumerate(names):
            if name == 'value':
                names[k] = next((o[k] for o in raw if len(o) == len(names) and o[k] != 'value'), name)
    per_rank = []
    for (text, numbers, ids), bases in zip(ranks, raw):
        names, seen = [], {}
        for base in bases:
            seen[base] = seen.get(base, 0) + 1
            names.append(base if seen[base] == 1 else '%s_%d' % (base, seen[base]))
        tpl = text
        for marker, name in zip(ids, names):
            tpl = tpl.replace('\x00%d\x00' % marker, '{%s}' % name, 1)
        per_rank.append((tpl, dict(zip(names, numbers))))
    keys = []
    for _, vals in per_rank:
        keys += [k for k in vals if k not in keys]
    out = {}
    templates = [t for t, _ in per_rank]
    out['text'] = templates[0] if len(set(templates)) == 1 else templates
    if keys:
        out['values'] = {k: [as_number(v[k]) if k in v else None for _, v in per_rank] for k in keys}
    return out


def to_js(data):
    body = ',\n'.join('  %s: %s' % (k, json.dumps(v, ensure_ascii=False)) for k, v in data.items())
    return ('// Generated by tools/extract_skill_text.py from the game files. Do not edit by hand.\n'
            '// Per game skill id: name, maxRank, text template(s) and the numbers for each rank.\n'
            '// text is one template, or one per rank when the game words ranks differently.\n'
            '// dynamic: values that depend on the character; the base character is used.\n'
            '// missing: the number for ranks whose text says it in words (values has null there).\n'
            'export default {\n%s\n};\n' % body)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('game_dir')
    ap.add_argument('out')
    ap.add_argument('--lang', default='en')
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')

    tips = SkillTooltips(args.game_dir, args.lang)
    data, failed = {}, []
    for a in tips.skills:
        try:
            data[a['skill_name']] = tips.extract(a)
        except ScriptError as e:
            failed.append('%s: %s' % (a['skill_name'], e))
    with open(args.out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(to_js(data))
    print('%d skills written to %s' % (len(data), args.out))
    for w in sorted(set(tips.warnings + tips.bad_numbers)):
        print('warning:', w)
    for k, v in data.items():
        if 'dynamic' in v:
            print('dynamic: %s (%s)' % (k, ', '.join(v['dynamic'])))
    for f in failed:
        print('FAILED:', f)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
