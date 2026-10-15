"""
Every kind of person in the game (src/config/outfits.js, plus a settler),
from one figure: legs, a body, arms, a head, and the outfit on top. Each
kind passes its own colours and pieces to person().

Ordinary folk wear plain cloth; the player's side wears teal; the Stone
Kingdom dark iron with a red glow behind the visor; the Sky Kingdom white
steel and gold; the dark god and his shades violet; the white god gold.
"""
from lib import *

SKIN = dict(
    light=('#e8b98a', '#c99668'), mid=('#d9a066', '#b97f4a'), tan=('#b97a4a', '#9a6238'),
    dark=('#7a4e30', '#5e3a22'), goblin=('#6f9a3a', '#557a2a'), pale=('#e8e4ec', '#c8c2d0'),
    void=('#0e0c12', '#0e0c12'),
)

DEFAULT = dict(
    skin='mid', eye=C['ink'], hair='#4a2e19', beard=None, hat=None, hatColour=None, hatTrim=None,
    visor=False, visorGlow=None, plume=None, crownGem=G['teal'],
    coat='#5a7a8a', coat2=None, shirt=None, trim=None, belt='#4a2e19', buckle=C['gold'],
    trousers='#4a3a30', boots='#2b1d12', skirt=False, robe=False,
    armour=None, plate=(C['steel'], C['steel2'], C['steel3']), emblem=None, emblemGlow=None,
    cape=None, capeTrim=None, gear=None, gearColour=None, gearGlow=None,
    goblin=False, wings=False, quiver=False, shield=None, pack=False, scarf=None, glowEyes=None,
    satchel=None, apron=None, scale=1,
)


def shade(hexc, f=0.78):
    r, g, b = (int(hexc[i:i + 2], 16) for i in (1, 3, 5))
    return '#%02x%02x%02x' % tuple(min(255, int(v * f)) for v in (r, g, b))


def person(id, name, **kw):
    o = dict(DEFAULT, **kw)
    skin, skin2 = SKIN[o['skin']]
    coat, coat2 = o['coat'], o['coat2'] or shade(o['coat'])
    plate, plate2, plate3 = o['plate']

    # --- painters ---------------------------------------------------------
    def face_pixels(p, ox, oy, w):
        """The face itself, at (ox, oy) on a face `w` wide."""
        cx = ox + w // 2
        if o['glowEyes']:
            p.set(cx - 3, oy + 1, o['glowEyes']).set(cx - 2, oy + 1, o['glowEyes'])
            p.set(cx + 1, oy + 1, o['glowEyes']).set(cx + 2, oy + 1, o['glowEyes'])
            return
        p.rect(cx - 3, oy, 2, 1, shade(o['hair'], 0.9) if o['hair'] else skin2)
        p.rect(cx + 1, oy, 2, 1, shade(o['hair'], 0.9) if o['hair'] else skin2)
        p.set(cx - 3, oy + 1, C['white']).set(cx - 2, oy + 1, o['eye'])
        p.set(cx + 1, oy + 1, o['eye']).set(cx + 2, oy + 1, C['white'])
        p.set(cx - 1, oy + 2, skin2).set(cx, oy + 2, skin2)
        p.rect(cx - 1, oy + 3, 2, 1, shade(skin2, 0.8))
        if o['beard']:
            p.rect(cx - 3, oy + 3, 6, 2, o['beard']).set(cx - 1, oy + 3, shade(skin2, 0.8)).set(cx, oy + 3, shade(skin2, 0.8))
            p.rect(cx - 2, oy + 5, 4, 1, o['beard'])

    def head(p, face):
        p.grain([skin, skin2] if o['skin'] != 'void' else [skin])
        hair = o['hair']
        if face == 'north':
            if hair:
                p.row(0, hair).set(0, 1, hair).set(p.w - 1, 1, hair)
            face_pixels(p, 0, 3, p.w)
        elif face == 'south':
            if hair:
                p.grain([hair, shade(hair, 0.85)]).row(-1, skin2)
        elif face in ('east', 'west'):
            if hair:
                p.rect(0, 0, p.w, 3, hair)
                p.rect(p.w - 3 if face == 'east' else 0, 3, 3, 3, hair)
            p.set(p.w // 2, 4, skin2)
            if o['beard']:
                p.rect(0 if face == 'west' else p.w - 3, 6, 3, 2, o['beard'])
        elif face == 'up' and hair:
            p.grain([hair, shade(hair, 0.85)])

    def shell(colour, trim=None, opening=True, visor=False):
        """A helm or hood: the face shows through an opening, or a visor slit."""
        def f(p, face):
            p.grain([colour, shade(colour, 0.9), shade(colour, 1.1) if colour != '#000000' else colour])
            if face == 'north':
                if visor:
                    p.rect(1, 4, p.w - 2, 2, C['ink'])
                    g = o['visorGlow']
                    if g:
                        p.set(2, 4, g).set(3, 4, g).set(p.w - 4, 4, g).set(p.w - 3, 4, g)
                    p.rect(p.w // 2, 1, 1, 6, trim or shade(colour, 0.7))
                elif opening:
                    p.rect(2, 2, p.w - 4, 6, skin if o['skin'] != 'void' else C['ink'])
                    if o['skin'] != 'void':
                        p.row(2, shade(skin, 0.75))   # the shadow under the brim
                    face_pixels(p, 1, 3, p.w - 1)
                if trim:
                    p.row(0, trim)
            elif face in ('east', 'west', 'south') and trim:
                p.row(0, trim)
            if face != 'north' and face != 'up' and trim:
                p.row(-1, trim)
        return f

    def torso(p, face):
        if o['armour'] == 'plate':
            p.grain([plate, plate2])
            if face == 'north':
                p.border(o['trim'] or C['gold'], 'lrt')
                if o['emblem']:
                    p.stamp(['..#..', '.#.#.', '#.#.#', '.#.#.', '..#..'], {'#': o['emblem']}, None, 2)
                if o['emblemGlow']:
                    p.rect(3, 4, 2, 2, o['emblemGlow'])
            elif face == 'south':
                p.col(p.w // 2, plate3)
        else:
            p.grain([coat, coat2])
            if face == 'north':
                if o['shirt']:
                    p.rect(2, 0, 4, p.h, o['shirt']).col(2, shade(coat, 0.7)).col(5, shade(coat, 0.7))
                    p.set(4, 3, shade(o['shirt'], 0.8)).set(4, 6, shade(o['shirt'], 0.8))
                if o['trim']:
                    p.row(0, o['trim'])
                    if o['robe']:
                        p.col(4, o['trim'])
                if o['emblem']:
                    p.stamp(['.#.', '###', '.#.'], {'#': o['emblem']}, None, 3)
            if o['trim'] and face in ('east', 'west', 'south'):
                p.row(0, o['trim'])
        if o['satchel'] and face in ('north', 'south'):
            for i in range(8):
                p.set(i if face == 'north' else 7 - i, i + 1, '#3a2414')
        if o['belt'] and face != 'up' and face != 'down':
            p.row(8, o['belt']).row(9, o['belt'])
            if face == 'north' and o['buckle']:
                p.rect(3, 8, 2, 2, o['buckle'])

    def arm(p, face):
        if o['armour']:
            p.grain([plate2, plate3] if o['armour'] == 'plate' else [C['steel3'], C['steel4']])
        else:
            p.grain([coat, coat2])
        if face == 'down':
            p.fill(skin if not o['armour'] else plate3)
        elif face != 'up':
            if o['armour']:
                p.rect(0, p.h - 4, p.w, 4, o['trim'] or plate).row(-4, shade(o['trim'] or plate, 0.8))
            else:
                if o['trim']:
                    p.row(-4, o['trim'])
                p.rect(0, p.h - 3, p.w, 3, skin).set(1, p.h - 1, skin2)

    def leg(p, face):
        if o['armour'] == 'plate':
            p.grain([plate, plate2])
            if face not in ('up', 'down'):
                p.row(4, o['trim'] or C['gold'])
        else:
            p.grain([o['trousers'], shade(o['trousers'], 0.88)])
        if face == 'down':
            p.fill(o['boots'])
        elif face != 'up':
            p.rect(0, p.h - 4, p.w, 4, o['boots']).row(-1, shade(o['boots'], 0.7))
            if not o['armour']:
                p.row(-5, shade(o['trousers'], 0.7))

    # --- boxes ------------------------------------------------------------
    cubes = [
        box('leg_l', 'leg_l', (-4, 0, -2), (0, 12, 2), leg),
        box('leg_r', 'leg_r', (0, 0, -2), (4, 12, 2), leg),
        box('torso', 'body', (-4, 12, -2), (4, 24, 2), torso),
        box('arm_l', 'arm_l', (-8, 12, -2), (-4, 24, 2), arm),
        box('arm_r', 'arm_r', (4, 12, -2), (8, 24, 2), arm),
    ]
    hat = o['hat']
    hc = o['hatColour'] or (C['iron'] if hat == 'helm' else coat)
    if hat == 'helm':
        cubes.append(box('helm', 'head', (-4.5, 23.5, -4.5), (4.5, 32.5, 4.5), shell(hc, o['hatTrim'], True, o['visor'])))
    elif hat == 'hood':
        cubes.append(box('hood', 'head', (-4.5, 23.5, -4.5), (4.5, 32.5, 4.5), shell(hc, o['hatTrim'], True)))
        cubes.append(box('hood_peak', 'head', (-2, 32.5, -1), (2, 34, 4.5), {'all': lambda p, f: p.grain([hc, shade(hc, 0.9)])}))
        cubes.append(box('hood_drape', 'body', (-4.75, 21.5, -2.5), (4.75, 24.5, 2.75), {'all': lambda p, f: p.grain([hc, shade(hc, 0.85)]).row(-1, shade(hc, 0.7))}))
    else:
        cubes.append(box('head', 'head', (-4, 24, -4), (4, 32, 4), head))
    if hat == 'cap':
        cap = lambda p, f: p.grain([hc, shade(hc, 0.88)]).row(-1, o['hatTrim'] or shade(hc, 0.7))
        cubes.append(box('cap', 'head', (-4.5, 30.5, -4.5), (4.5, 33, 4.5), cap))
        cubes.append(box('cap_brim', 'head', (-4.5, 30.5, -6.5), (4.5, 31.25, -4.5), cap))
    elif hat == 'crown':
        gold = hc if o['hatColour'] else C['gold']
        band = lambda p, f: p.grain([gold, shade(gold, 0.85)]).row(-1, shade(gold, 0.7))
        cubes.append(box('crown', 'head', (-4.5, 30.5, -4.5), (4.5, 33, 4.5), band))
        for i, (x, z) in enumerate(((-4.5, -4.5), (3, -4.5), (-4.5, 3), (3, 3), (-0.75, -4.5))):
            tall = 3 if i == 4 else 2
            cubes.append(box(f'crown_pt{i}', 'head', (x, 33, z), (x + 1.5, 33 + tall, z + 1.5), band))
        cubes.append(box('crown_gem', 'head', (-0.75, 31, -4.75), (0.75, 32.5, -4.5), {'all': o['crownGem']}))
    if o['plume']:
        pl = o['plume']
        cubes.append(box('plume', 'head', (-0.75, 32.5, -2), (0.75, 37, 3), {'all': lambda p, f: p.grain([pl, shade(pl, 0.9)])}))
        cubes.append(box('plume_tail', 'head', (-0.75, 31, 3), (0.75, 35, 5.5), {'all': lambda p, f: p.grain([pl, shade(pl, 0.85)])}))
    if o['goblin']:
        ear = lambda p, f: p.grain([skin, skin2]).set(1, 1, C['pink']) if f == 'north' else p.grain([skin, skin2])
        cubes += [box('ear_l', 'head', (-8, 27, -0.5), (-4, 30, 0.5), ear, (0, 0, -15)),
                  box('ear_r', 'head', (4, 27, -0.5), (8, 30, 0.5), ear, (0, 0, 15)),
                  box('nose', 'head', (-0.75, 26.5, -7), (0.75, 28, -4), {'all': lambda p, f: p.grain([skin2, skin])})]
    if o['cape']:
        cp, ct = o['cape'], o['capeTrim']
        def cape(p, face):
            p.grain([cp, shade(cp, 0.88)])
            if ct:
                p.border(ct, 'lrb')
        cubes.append(box('cape', 'body', (-4.5, 4, 2), (4.5, 24, 3), cape))
    if o['skirt'] or o['robe']:
        lo = 2 if o['robe'] else 8
        def skirt(p, face):
            p.grain([coat, coat2]).row(-1, o['trim'] or shade(coat, 0.7))
            if face == 'north' and o['robe'] and o['trim']:
                p.col(p.w // 2, o['trim'])
        cubes.append(box('skirt', 'body', (-4.5, lo, -2.5), (4.5, 12.5, 2.5), skirt))
    if o['scarf']:
        sc = o['scarf']
        cubes.append(box('scarf', 'body', (-4.5, 22, -2.5), (4.5, 24.5, 2.5), {'all': lambda p, f: p.grain([sc, shade(sc, 0.85)])}))
        cubes.append(box('scarf_mask', 'head', (-4.25, 24, -4.25), (4.25, 27, -3.75), {'all': lambda p, f: p.grain([sc, shade(sc, 0.85)])}))
    if o['apron']:
        ap = o['apron']
        cubes.append(box('apron', 'body', (-3, 6, -2.75), (3, 21, -2), {'all': lambda p, f: p.grain([ap, shade(ap, 0.9)]).row(4, shade(ap, 0.7))}))
    if o['satchel']:
        sa = o['satchel']
        cubes.append(box('satchel', 'body', (4, 9, -2), (6.5, 14, 2.5), {'all': lambda p, f: p.grain([sa, shade(sa, 0.85)]).row(0, shade(sa, 0.7))}))
        cubes.append(box('scroll', 'body', (4.5, 14, 0), (6, 16.5, 1.5), {'all': lambda p, f: p.grain([C['paper'], C['paper2']]).row(0, C['red'])}))
    if o['quiver']:
        q = o['quiver']
        cubes.append(box('quiver', 'body', (-3, 13, 2), (0, 25, 4.5), {'all': lambda p, f: p.grain([q, shade(q, 0.85)]).row(0, shade(q, 0.6))}))
        for i, x in enumerate((-2.5, -1.25)):
            cubes.append(box(f'arrow{i}', 'body', (x, 25, 2.75), (x + 0.75, 27.5, 3.5), {'all': '#e8e2d6', 'up': C['red']}))
    if o['shield']:
        s1, s2 = o['shield']
        def shield(p, face):
            if face == 'west':
                p.grain([s1, shade(s1, 0.9)]).border(s2)
                p.stamp(['.#.', '###', '.#.'], {'#': s2})
                if o['emblemGlow']:
                    p.set(p.w // 2, p.h // 2, o['emblemGlow'])
            else:
                p.fill(s2)
        cubes.append(box('shield', 'arm_l', (-9.5, 10, -5), (-8.5, 22, 5), shield))
    if o['wings']:
        from featured import wing
        cubes += [box('wing_l', 'wing_l', (-14, 17, 2.5), (-2, 28, 3.5), wing),
                  box('wing_l_low', 'wing_l', (-10, 9, 2.5), (-2, 17, 3.5), wing),
                  box('wing_r', 'wing_r', (2, 17, 2.5), (14, 28, 3.5), wing),
                  box('wing_r_low', 'wing_r', (2, 9, 2.5), (10, 17, 3.5), wing)]

    # Gear, in the right hand.
    gc, gg = o['gearColour'], o['gearGlow']
    steel = lambda p, f: p.grain([gc or C['steel2'], shade(gc or C['steel2'], 0.85)]).row(0, gg or C['white'])
    wood = lambda p, f: p.grain([C['wood'], C['woodDark']])
    if o['gear'] == 'sword':
        cubes += [box('grip', 'arm_r', (5.5, 12, -1.5), (6.5, 14, 1.5), wood),
                  box('guard', 'arm_r', (4.5, 12, -3), (7.5, 14, -2), {'all': lambda p, f: p.grain([C['gold'], C['goldDark']])}),
                  box('blade', 'arm_r', (5.5, 12.25, -12), (6.5, 13.75, -3),
                      {'all': lambda p, f: p.grain([gc or C['steel'], shade(gc or C['steel'], 0.88)]).col(0, gg or C['white'])})]
    elif o['gear'] == 'spear':
        cubes += [box('shaft', 'arm_r', (5.5, -2, -1.5), (6.5, 34, -0.5), {'all': lambda p, f: p.grain([gc or C['wood'], shade(gc or C['wood'], 0.8)])}),
                  box('spear_head', 'arm_r', (5, 34, -2), (7, 39, 0), {'all': gg or C['steel']} if gg else steel)]
    elif o['gear'] == 'staff':
        cubes += [box('staff', 'arm_r', (5.5, -1, -1.5), (6.5, 34, -0.5), {'all': lambda p, f: p.grain([gc or C['wood'], C['woodDark']])}),
                  box('staff_head', 'arm_r', (4.75, 34, -2.25), (7.25, 37.5, 0.25), {'all': gg or C['paper']}, (0, 45, 0))]
    elif o['gear'] == 'bow':
        bc = gc or C['wood']
        bow = lambda p, f: p.grain([bc, shade(bc, 0.8)])
        cubes += [box('bow_grip', 'arm_r', (5.5, 11, -3), (6.5, 16, -2), bow),
                  box('bow_top', 'arm_r', (5.5, 16, -2.5), (6.5, 22, -1.5), bow),
                  box('bow_low', 'arm_r', (5.5, 5, -2.5), (6.5, 11, -1.5), bow),
                  box('bow_string', 'arm_r', (5.75, 5.5, -0.75), (6.25, 21.5, -0.25), {'all': '#e8e2d6'})]

    bones = [('body', None, (0, 12, 0)), ('head', 'body', (0, 24, 0)), ('arm_l', 'body', (-6, 22, 0)),
             ('arm_r', 'body', (6, 22, 0)), ('leg_l', None, (-2, 12, 0)), ('leg_r', None, (2, 12, 0))]
    anim = {'leg_l': swing(28), 'leg_r': swing(-28), 'arm_l': swing(-22),
            'arm_r': swing(8 if o['gear'] in ('spear', 'staff', 'bow') else 14),
            'head': [(1, (0, -4, 0)), (13, (0, 4, 0)), (25, (0, -4, 0))]}
    rest = {}
    if o['wings']:
        bones += [('wing_l', 'body', (-2, 22, 2)), ('wing_r', 'body', (2, 22, 2))]
        rest = {'wing_l': (0, 40, -12), 'wing_r': (0, -40, 12)}
        anim['wing_l'] = [(1, (0, 40, -12)), (13, (0, 60, -18)), (25, (0, 40, -12))]
        anim['wing_r'] = [(1, (0, -40, 12)), (13, (0, -60, 18)), (25, (0, -40, 12))]
    return dict(id=id, name=name, bones=bones, cubes=cubes, anim=anim, rest=rest, scale=o['scale'])


IRON = ('#3a3840', '#2c2a31', '#4c4a55')
SKYP = (C['steel'], C['steel2'], C['steel3'])
GOLDP = ('#f1d070', '#e0b84a', '#c79a2a')

PEOPLE = [
    # Your own.
    person('settler', 'Settler', coat=C['teal'], shirt=C['paper'], trousers='#5a4636', hair='#6b4a2e'),
    person('soldier', 'Soldier', hat='helm', hatColour=C['steel3'], hatTrim=C['teal'], coat=C['teal'], trim=C['gold'],
           emblem=C['gold'], gear='sword', shield=(C['teal'], C['gold']), emblemGlow=G['tealMid'], trousers=C['tealDeep']),
    person('archer', 'Archer', hat='hood', hatColour=C['tealDark'], coat=C['teal'], trousers='#5a4636', gear='bow', quiver=C['wood'], skin='light'),
    person('footman', 'Footman', hat='cap', hatColour='#7a5a3a', coat='#8a6a4a', trim='#5a4030', gear='sword', gearColour='#afafb7', trousers='#4a3a30', skin='tan'),
    person('swordsman', 'Swordsman', hat='helm', hatColour=C['steel3'], plume='#3a5aa8', coat='#3a5aa8', trim=C['gold'], gear='sword', shield=('#3a5aa8', C['gold'])),
    person('bowman', 'Bowman', hat='hood', hatColour='#3f5a34', coat='#4f6a40', trousers='#3a3024', gear='bow', quiver=C['woodDark']),
    person('crew', 'Siege crew', hat='cap', hatColour='#5a4030', coat='#7a6a52', apron='#5a4030', trousers='#4a3a30', skin='dark', hair='#2a1e16'),
    # Out in the world.
    person('hermit', 'Hermit', hat='hood', hatColour='#6b6355', beard='#d9d4c8', hair='#d9d4c8', coat='#7a7062', robe=True, belt='#4a3a2a',
           buckle=None, gear='staff', gearGlow=G['tealMid'], skin='light'),
    person('messenger', 'Messenger', hat='cap', hatColour='#2f4f7a', hatTrim=C['gold'], coat='#3a5a8a', shirt=C['paper'], trousers='#3a3024',
           satchel=C['wood'], skin='light', hair='#c98a3a'),
    person('bandit', 'Bandit', hat='hood', hatColour='#2f2925', coat='#4a3a30', trousers='#2f2925', scarf=C['redDark'], gear='sword', gearColour='#9a9aa6', skin='tan'),
    person('citizen', 'Citizen', hat='cap', hatColour='#c47a3a', coat=C['paper2'], trim='#c47a3a', trousers='#6a5a4a', hair='#3a2414', skin='dark'),
    person('merchant', 'Merchant', hat='cap', hatColour='#6b1f24', hatTrim=C['gold'], coat='#8a5a32', trim=C['gold'], beard='#5a3f2a', hair='#5a3f2a',
           satchel=C['goldDark'], skirt=True, buckle=G['gold']),
    person('trader', 'Goblin trader', hat='cap', hatColour=C['gold'], goblin=True, skin='goblin', hair=None, eye='#c79a2a',
           coat='#7a5a3a', apron=C['paper2'], trousers='#4a3a30'),
    person('tribe', 'Tree person', hat='hood', hatColour='#3c7a2c', hatTrim='#5aa53a', coat='#4f8a3a', trousers='#3a5a2a', gear='bow', gearColour='#6b4a2e',
           quiver='#6b4a2e', skin='tan', emblem=G['gold']),
    # Living cities and rivals.
    person('city_guard', 'City guard', hat='helm', hatColour=C['steel3'], coat=C['tealDark'], trim=C['gold'], gear='spear', gearColour='#afafb7', shield=(C['tealDark'], C['gold'])),
    person('rival_soldier', 'Rival soldier', hat='helm', hatColour='#6a6a72', coat=C['red'], trim=C['redDark'], gear='sword', gearColour='#afafb7'),
    person('rival_guard', 'Rival guard', hat='helm', hatColour='#6a6a72', coat=C['red'], trim=C['paper2'], gear='spear', gearColour='#afafb7', shield=(C['red'], C['paper2'])),
    person('futurian', 'Futurian', hat='helm', hatColour='#e8eef4', visor=True, visorGlow=G['teal'], hatTrim=G['tealMid'],
           armour='plate', plate=('#e8eef4', '#d0dae2', '#aab8c4'), trim=G['tealMid'], emblemGlow=G['teal'], belt=None),
    # The Stone Kingdom.
    person('guard', 'Stone guard', hat='helm', hatColour='#2c2a31', visor=True, visorGlow=G['red'], armour='plate', plate=IRON, trim='#55525e',
           gear='spear', shield=('#2c2a31', '#55525e'), emblemGlow=G['red']),
    person('warrior', 'Stone warrior', hat='helm', hatColour='#2c2a31', visor=True, visorGlow=G['red'], armour='plate', plate=IRON, trim=C['redDark'],
           emblem=C['redDark'], gear='sword', gearColour='#9a9aa6'),
    person('stone_archer', 'Stone archer', hat='hood', hatColour='#2c2a31', coat='#3a3840', trim=C['redDark'], trousers='#2c2a31', gear='bow', quiver='#2c2a31',
           skin='light', hair='#2a2228'),
    person('king', 'Stone King', hat='crown', hatColour='#b08a3a', crownGem=G['red'], cape='#6b1f24', capeTrim=C['gold'], beard='#2a2228', hair='#2a2228',
           armour='plate', plate=IRON, trim='#b08a3a', emblem=C['red'], emblemGlow=G['red'], gear='sword', skin='light'),
    person('warlord', 'Vorhak the Warlord', hat='helm', hatColour='#1d1a22', visor=True, visorGlow=G['red'], plume='#9a2c2c', cape='#1d1a22', capeTrim=C['redDark'],
           armour='plate', plate=('#2c2a31', '#1d1a22', '#3a3840'), trim=C['redDark'], emblem=C['red'], emblemGlow=G['red'],
           gear='sword', gearColour='#55525e', gearGlow=G['red'], scale=1.15),
    # The Sky Kingdom.
    person('sky_guard', 'Sky guard', hat='helm', hatColour=C['steel'], hatTrim=C['gold'], plume=C['white'], armour='plate', plate=SKYP, trim=C['gold'],
           emblem=C['gold'], emblemGlow=G['teal'], gear='spear', gearColour=C['steel3'], gearGlow=G['teal']),
    person('royal_guard', 'Royal guard', hat='helm', hatColour=C['steel'], hatTrim=C['gold'], plume='#c0392b', armour='plate', plate=SKYP, trim=C['gold'],
           emblem=C['red'], emblemGlow=G['gold'], gear='spear', gearColour='#e8c04f', gearGlow=G['gold'], cape='#c0392b', capeTrim=C['gold']),
    person('sky_king', 'Sky King', hat='crown', crownGem=G['teal'], cape='#3a5aa8', capeTrim=C['gold'], beard='#ece6d8', hair='#ece6d8',
           coat=C['steel'], trim=C['gold'], robe=True, emblem=C['gold'], gear='sword', gearColour='#e8c04f', gearGlow=G['gold'], skin='light'),
    person('seraph', 'Seraph', hat='helm', hatColour=C['steel'], hatTrim=C['gold'], plume=C['white'], visor=True, visorGlow=G['teal'], armour='plate', plate=SKYP,
           trim=C['gold'], emblem=C['gold'], emblemGlow=G['teal'], gear='spear', gearColour='#e8c04f', gearGlow=G['teal'], wings=True),
    # The gods and their creatures.
    person('white_god', 'The white god', hat='crown', crownGem=G['gold'], cape=C['white'], capeTrim=C['gold'], beard='#ece6d8', hair='#ece6d8',
           coat=C['white'], trim=G['gold'], robe=True, emblem=G['gold'], gear='staff', gearColour=C['gold'], gearGlow=G['gold'],
           glowEyes=G['gold'], skin='light', scale=1.6, belt=C['gold']),
    person('dark_god', 'The dark god', hat='crown', hatColour='#4a3a5a', crownGem=G['violet'], cape='#1d1a22', capeTrim='#4a3a5a', beard='#2a2228', hair='#2a2228',
           coat='#2c2433', trim='#4a3a5a', robe=True, emblem=G['violet'], gear='sword', gearColour='#6a4a8a', gearGlow=G['violet'],
           glowEyes=G['violet'], skin='pale', scale=1.6, belt='#1d1a22', buckle=G['violet']),
    person('shade', 'Shade', hat='hood', hatColour='#16131a', skin='void', glowEyes=G['violet'], hair=None, coat='#1d1a22', trim='#2e2838', robe=True,
           belt=None, gear='sword', gearColour='#4a3a5a', gearGlow=G['violet']),
]
