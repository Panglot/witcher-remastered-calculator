"""Extract the Blood and Wine mutations from a Witcher 3 (next-gen) install.

Everything comes from the game files:
- costs, prerequisites, names and icons: the <mutations> definition in
  dlc/bob/data/gameplay/abilities/geralt_mutations.xml (bob.bundle), read the way
  PlayerAbilityManager.ws (LoadMutationDataFromXML) reads it;
- a mutation's colours: the mutagen colours in its research cost (GetMutationColors), which decide
  the skills its extra slots take;
- the Strengthened Synapses stages: mutationsRequiredForSlot1..4 on the `Mutation Master` ability;
- the description text: the game's own GetMutationLocalizedDescription (playerWitcher.ws), run with
  wscript.py like the skill text (tools/extract_skill_text.py). Each number becomes a {placeholder}.

A few numbers depend on the character (Sign intensity, Toxicity, the crossbow used). Those use the
base character (BASE_STATS) and are listed in `dynamic`; the crossbow damage can't be known at all,
so its numbers are null.

Usage: python tools/extract_mutations.py <game_dir> <out.js> [--lang en]
"""
import argparse
import json
import re
import sys

from extract_skill_text import (ABILITY_DIR, CharacterDependent, SkillTooltips, as_number, build_template,
                                clean, strip_comments)
from game_files import content_path, read_bundle_file, read_bundle_toc
from wscript import AttributeValue, Concat, Num, Obj, ScriptError

BOB_BUNDLE = 'bob.bundle'
BOB_ABILITIES = 'dlc\\bob\\data\\gameplay\\abilities\\'
MUTATIONS_XML = BOB_ABILITIES + 'geralt_mutations.xml'
DESC_FN = 'GetMutationLocalizedDescription'
DESC_FILE = 'playerWitcher.ws'
MASTER = 'mutationMaster'
MASTER_ABILITY = 'Mutation Master'
STAGES = 4
COLORS = ('red', 'green', 'blue')
# The base character, for the numbers that read live stats. Assumption: Geralt without gear or
# potions: max Toxicity is ConGeralt's toxicity base (gameplay/abilities/geralt_stats.xml), current
# Toxicity 0, Sign intensity 100%.
BASE_TOXICITY_MAX = 100
BASE_SIGN_INTENSITY = 1.0
# Numbers that depend on the equipped crossbow and bolts: null in the data.
UNKNOWN = 'crossbow_damage'
# The Mutations panel's own text (MutationTooltip.as, characterMenuDupe.ws), by planner name.
# $I$ is a number the panel fills in.
LABELS = {
    'title': 'mutation_title_mutations',
    'allows': 'mutation_allow_equip_of',
    'requirements': 'mutation_tooltip_requirements',
    'research': 'mutation_input_research_mutation',
    'activate': 'mutation_input_activate_mutation',
    'deactivate': 'mutation_input_deactivate_mutation',
    'masterImprove': 'mutation_master_mutation_description',
    'masterLocked': 'mutation_master_mutation_requires_unlock',
    'masterSlots': 'mutation_master_mutation_tooltip_unlocks',
    'masterNext': 'mutation_master_mutation_requires',
}


def read_mutations(game_dir):
    """The <mutation> entries in file order, and the Strengthened Synapses ability text."""
    bundle = content_path(game_dir, 'bundles', BOB_BUNDLE)
    entry = next(e for e in read_bundle_toc(bundle) if e[0] == MUTATIONS_XML)
    xml = strip_comments(read_bundle_file(bundle, entry).decode('utf-8-sig', errors='replace'))
    custom = re.search(r'<mutations>(.*?)</mutations>', xml, re.S).group(1)
    mutations = []
    for attrs, body in re.findall(r'<mutation\s([^>]*?)(?:/>|>(.*?)</mutation>)', custom, re.S):
        a = dict(re.findall(r'(\w+)="([^"]*)"', attrs))
        req = re.search(r'<required_mutations>(.*?)</required_mutations>', body or '', re.S)
        a['required'] = [r.strip() for r in req.group(1).split(',')] if req else []
        mutations.append(a)
    return mutations


class MutationTexts(SkillTooltips):
    """The skill text machinery with the mutation abilities, and the player's mutation lookups."""

    def __init__(self, game_dir, lang):
        super().__init__(game_dir, lang, (('xml.bundle', ABILITY_DIR), (BOB_BUNDLE, BOB_ABILITIES)))
        self.mutations = read_mutations(game_dir)
        by_type = {m['type_name']: m for m in self.mutations}
        manager = Obj('W3PlayerAbilityManager')
        self.player['abilityManager'] = manager
        self.unknown = False

        def mutation_of(t):
            name = next((n for n in by_type if self.interp.call('MutationNameToType', [n]) == t), None)
            if name is None:
                raise ScriptError('unknown mutation %s' % t)
            return by_type[name]

        def stat(what, stat_name, value):
            self.used_stats.add('%s(%s) = %s' % (what, stat_name, value))
            return value

        def toxicity(what):
            def f(_, which, *rest):
                if str(which) != 'BCS_Toxicity':
                    raise CharacterDependent('%s(%s)' % (what, which))
                return stat(what, which, BASE_TOXICITY_MAX if what == 'GetStatMax' else 0)
            return f

        def sign_intensity(what):
            def f(_, *args):
                stat(what, ', '.join(map(str, args)), '%d%%' % (BASE_SIGN_INTENSITY * 100))
                return AttributeValue(mult=BASE_SIGN_INTENSITY)
            return f

        def offense_stats(_, *args):
            self.unknown = True
            return Obj('SPlayerOffenseStats', crossbowSteelDmg=Num(0, (UNKNOWN,)))

        self.interp.methods.update({
            ('W3PlayerAbilityManager', 'GetMutationDescriptionLocalizationKey'):
                lambda _, t: mutation_of(t)['localizationDescriptionKey_name'],
            ('W3PlayerWitcher', 'GetStat'): toxicity('GetStat'),
            ('W3PlayerWitcher', 'GetStatMax'): toxicity('GetStatMax'),
            ('W3PlayerWitcher', 'GetPowerStatValue'): sign_intensity('GetPowerStatValue'),
            ('W3PlayerWitcher', 'GetTotalSignSpellPower'): sign_intensity('GetTotalSignSpellPower'),
            ('W3PlayerWitcher', 'GetOffenseStatsList'): offense_stats,
        })

    def description(self, type_name):
        """{text, values, dynamic?} of one mutation's description."""
        self.used_stats, self.unknown = set(), False
        mutation_type = self.interp.call('MutationNameToType', [type_name])
        path = next(f.path for f in self.index.functions[DESC_FN] if f.path.endswith(DESC_FILE))
        result = self.interp.call(DESC_FN, [mutation_type], self.player, path)
        if result is None:
            raise ScriptError('%s returned nothing for %s' % (DESC_FN, type_name))
        text = result if isinstance(result, Concat) else Concat(result)
        out = build_template([clean(text, text.parts, [])])
        if self.unknown:
            for k in out.get('values', {}):
                if k.startswith(UNKNOWN):
                    out['values'][k] = [None]
        dynamic = sorted(self.used_stats) + (['equipped crossbow and bolts'] if self.unknown else [])
        if dynamic:
            out['dynamic'] = dynamic
        # One description per mutation: plain numbers, not one per rank.
        out['values'] = {k: v[0] for k, v in out.get('values', {}).items()}
        return out

    def master_stages(self):
        """Researched mutations each Strengthened Synapses stage needs."""
        attrs = self.abilities.get(MASTER_ABILITY, {})
        return [as_number(attrs['mutationsRequiredForSlot%d' % i][0].valueAdditive) for i in range(1, STAGES + 1)]

    def extract(self):
        items, master = [], None
        for m in self.mutations:
            name = self.strings.get(m['localizationNameKey_name']) or m['type_name']
            if m['type_name'] == MASTER:
                master = {'name': name, **self.description(MASTER)}
                continue
            cost = {'points': int(m['skillPoints'])}
            cost.update({c: int(m['%sMutagenPoints' % c]) for c in COLORS})
            items.append({
                'id': m['type_name'], 'name': name,
                'colors': [c for c in COLORS if cost[c] > 0],
                'cost': cost,
                'requires': m['required'],
                'icon': re.sub(r'^.*\\', '', m['iconPath_name']).replace('.png', ''),
                **self.description(m['type_name'])
            })
        labels = {k: self.strings.get(key) for k, key in LABELS.items()}
        missing = [key for k, key in LABELS.items() if not labels[k]]
        if missing:
            raise ScriptError('missing strings: %s' % ', '.join(missing))
        return {'stages': self.master_stages(), 'labels': labels, 'master': master, 'items': items}


def to_js(data):
    items = ',\n'.join('    %s' % json.dumps(i, ensure_ascii=False) for i in data['items'])
    return ('// Generated by tools/extract_mutations.py from the game files. Do not edit by hand.\n'
            '// stages: researched mutations each Strengthened Synapses stage needs; a stage opens one mutation slot.\n'
            '// master: Strengthened Synapses. items: the mutations in the game\'s order, each with\n'
            '//   colors: the skill colours its mutation slots take (the mutagen colours of its cost),\n'
            '//   cost: skill points and greater mutagens per colour to research it,\n'
            '//   requires: the mutations to research first, icon: icons/mutations/<icon>.png,\n'
            '//   text: the description with {placeholders}, values: their numbers,\n'
            '//   dynamic: the character stats it reads; the base character is used, null when unknown.\n'
            '// labels: the Mutations panel\'s own text; $I$ is a number filled in.\n'
            'export default {\n'
            '  stages: %s,\n'
            '  labels: %s,\n'
            '  master: %s,\n'
            '  items: [\n%s\n  ]\n};\n') % (json.dumps(data['stages']), json.dumps(data['labels'], ensure_ascii=False),
                                         json.dumps(data['master'], ensure_ascii=False), items)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('game_dir')
    ap.add_argument('out')
    ap.add_argument('--lang', default='en')
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')

    texts = MutationTexts(args.game_dir, args.lang)
    data = texts.extract()
    with open(args.out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(to_js(data))
    print('%d mutations written to %s' % (len(data['items']), args.out))
    for w in sorted(set(texts.warnings)):
        print('warning:', w)
    for m in data['items']:
        if 'dynamic' in m:
            print('dynamic: %s (%s)' % (m['id'], ', '.join(m['dynamic'])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
