"""
Every kind of person in the game (src/config/outfits.js, plus a settler),
from one figure: legs, a body, arms, a head, and the outfit on top. Each
kind passes its own colours and pieces to person().

Ordinary folk wear plain cloth; the player's side wears teal; the Stone
Kingdom dark iron with a red glow behind the visor; the Sky Kingdom white
steel and gold; the dark god and his shades violet; the white god gold.
"""
from lib import *
from lib import _hash

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
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(v * f))) for v in (r, g, b))


def mix(a, b, t=0.5):
    ca, cb = ([int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in (a, b))
    return '#%02x%02x%02x' % tuple(int(x + (y - x) * t) for x, y in zip(ca, cb))


def cloth(p, c, face=None, fleck=0.14):
    """Cloth, leather or plate lit from above: flat colour, a few flecks, the top
    face lighter and the underside darker. Glow colours are left as they are."""
    if c in GLOW_SET:
        return p.fill(c)
    base = shade(c, 1.07) if face == 'up' else shade(c, 0.72) if face == 'down' else c
    p.fill(base)
    for y in range(p.h):
        for x in range(p.w):
            r = _hash(x, y, p.seed)
            if r < fleck:
                p.set(x, y, shade(base, 0.92))
            elif r > 1 - fleck * 0.45:
                p.set(x, y, shade(base, 1.06))
    return p


# Today's triangles per model (12 a box, before faces could be left out): the
# most each may have. A war round draws dozens of these at once.
BUDGET = {'settler': 300, 'soldier': 120, 'archer': 180, 'footman': 132, 'swordsman': 144, 'bowman': 180, 'shield_guard': 108,
          'crew': 108, 'hermit': 132, 'messenger': 120, 'bandit': 156, 'citizen': 288, 'merchant': 132, 'trader': 144, 'tribe': 180,
          'city_guard': 108, 'rival_soldier': 108, 'rival_guard': 108, 'futurian': 72, 'guard': 108, 'warrior': 108, 'stone_archer': 180,
          'king': 204, 'warlord': 144, 'sky_guard': 120, 'royal_guard': 132, 'sky_king': 216, 'seraph': 168, 'white_god': 204,
          'dark_god': 216, 'shade': 144, 'settler_1': 324, 'settler_2': 336, 'settler_3': 300, 'settler_4': 300, 'settler_5': 324,
          'citizen_1': 312, 'citizen_2': 300, 'citizen_3': 312}


def triangles(cubes):
    return sum(2 * (6 - len(c[4].get('skip', ()))) for c in cubes)


def tilt(cube, pivot, deg):
    """A box swung about x round `pivot` (what a hand holds): tip up for +deg."""
    name, bone, a, b, paint = cube[:5]
    c = [(a[i] + b[i]) / 2 for i in range(3)]
    t = math.radians(deg)
    y, z = c[1] - pivot[1], c[2] - pivot[2]
    n = (c[0], pivot[1] + y * math.cos(t) - z * math.sin(t), pivot[2] + y * math.sin(t) + z * math.cos(t))
    d = [n[i] - c[i] for i in range(3)]
    return (name, bone, tuple(a[i] + d[i] for i in range(3)), tuple(b[i] + d[i] for i in range(3)), paint, (deg, 0, 0))


def person(id, name, **kw):
    o = dict(DEFAULT, **kw)
    skin, skin2 = SKIN[o['skin']]
    coat, coat2 = o['coat'], o['coat2'] or shade(o['coat'])
    plate, plate2, plate3 = o['plate']
    void = o['skin'] == 'void'
    metal = o['trim'] or C['gold']

    # --- painters ---------------------------------------------------------
    def face_pixels(p, ox, oy, w):
        """The face itself, at (ox, oy) on a face `w` wide."""
        cx = ox + w // 2
        if o['glowEyes']:
            p.set(cx - 3, oy + 1, o['glowEyes']).set(cx - 2, oy + 1, o['glowEyes'])
            p.set(cx + 1, oy + 1, o['glowEyes']).set(cx + 2, oy + 1, o['glowEyes'])
            if not void:
                p.rect(cx - 3, oy, 2, 1, shade(skin2, 0.8)).rect(cx + 1, oy, 2, 1, shade(skin2, 0.8))
                p.rect(cx - 1, oy + 3, 2, 1, shade(skin2, 0.75))
            return
        brow = shade(o['hair'], 0.9) if o['hair'] else skin2
        p.rect(cx - 3, oy, 2, 1, brow).rect(cx + 1, oy, 2, 1, brow)
        p.set(cx - 3, oy + 1, C['white']).set(cx - 2, oy + 1, o['eye'])
        p.set(cx + 1, oy + 1, o['eye']).set(cx + 2, oy + 1, C['white'])
        if not o['goblin']:
            blush = mix(skin, C['pink'], 0.45)
            p.set(cx - 3, oy + 2, blush).set(cx + 2, oy + 2, blush)
        p.set(cx - 1, oy + 2, skin2).set(cx, oy + 2, skin2)
        p.rect(cx - 1, oy + 3, 2, 1, shade(skin2, 0.72))
        if o['beard']:
            bd = o['beard']
            p.rect(cx - 3, oy + 3, 6, 2, bd).set(cx - 1, oy + 3, shade(skin2, 0.72)).set(cx, oy + 3, shade(skin2, 0.72))
            p.rect(cx - 2, oy + 5, 4, 1, shade(bd, 0.88))

    def head(p, face):
        cloth(p, skin, face, 0.1 if not void else 0)
        hair = o['hair']
        front = (lambda i: p.w - 1 - i) if face == 'east' else (lambda i: i)   # px from the front edge
        if face == 'north':
            if hair:
                p.row(0, hair).set(0, 1, hair).set(p.w - 1, 1, hair).set(1, 1, shade(hair, 0.9)).set(p.w - 2, 1, hair)
            face_pixels(p, 0, 3, p.w)
            p.row(-1, shade(skin, 0.9))
            if o['beard']:
                p.rect(2, 7, 4, 1, shade(o['beard'], 0.88))
        elif face == 'south':
            if hair:
                cloth(p, hair, None, 0.2).row(-1, skin2)
                p.rect(2, 1, 1, 4, shade(hair, 1.12)).rect(5, 2, 1, 4, shade(hair, 0.85))
            else:
                p.row(-1, skin2)
        elif face in ('east', 'west'):
            if hair:
                p.rect(0, 0, p.w, 3, hair)
                for i in range(4, p.w):
                    p.rect(front(i), 3, 1, 3 if i > 5 else 2, hair)          # down behind the ear
                p.set(front(0), 3, hair)                                     # a sideburn
            p.set(front(3), 4, skin2).set(front(3), 5, shade(skin2, 0.85))    # the ear
            if o['beard']:
                for i in range(3):
                    p.rect(front(i), 6, 1, 2, o['beard'])
            p.row(-1, shade(skin, 0.9))
        elif face == 'up' and hair:
            cloth(p, hair, 'up', 0.2)
            p.rect(3, 1, 1, 5, shade(hair, 0.86))                            # a parting

    def shell(colour, trim=None, opening=True, visor=False, steel=False):
        """A helm or hood: the face shows through an opening, or a visor's eye slits."""
        lo, hi = shade(colour, 0.82), shade(colour, 1.14)
        def f(p, face):
            cloth(p, colour, face, 0.1)
            side = face in ('north', 'south', 'east', 'west')
            if steel and side:
                p.row(1, hi).row(-2, lo)                       # light off the dome, shade at the rim
            if face == 'north':
                if visor:
                    g = o['visorGlow'] or C['ink']
                    p.row(3, lo)
                    p.rect(1, 4, 3, 2, C['ink']).rect(p.w - 4, 4, 3, 2, C['ink'])      # two eye slits
                    p.rect(1, 4, 3, 1, g).rect(p.w - 4, 4, 3, 1, g)
                    p.rect(p.w // 2, 2, 1, 6, trim or hi)                               # the nose ridge
                    for x in (2, 6):
                        p.set(x, 7, C['ink'])                                           # breath holes
                elif opening:
                    p.rect(2, 2, p.w - 4, 6, skin if not void else C['ink'])
                    if not void:
                        p.rect(2, 2, p.w - 4, 1, shade(skin, 0.72))    # the shadow under the brim
                    face_pixels(p, 1, 3, p.w - 1)
                    if steel:
                        p.rect(p.w // 2, 0, 1, 4, hi)          # a nose guard down from the brow
                        p.rect(1, 5, 1, 3, lo).rect(p.w - 2, 5, 1, 3, lo)   # cheek plates
                    else:
                        p.rect(1, 2, 1, 6, lo).rect(p.w - 2, 2, 1, 6, lo)   # the hood's inner edge
                if trim:
                    p.row(0, trim)
            elif side:
                if trim:
                    p.row(0, trim)
                if steel:
                    p.set(1, 3, hi).set(p.w - 2, 3, hi)        # rivets
                    if face == 'south':
                        p.rect(0, p.h - 3, p.w, 1, lo)         # the neck guard
                else:
                    p.rect(p.w // 2, 1, 1, p.h - 3, lo)        # a fold
            elif face == 'up' and steel:
                p.rect(p.w // 2, 0, 1, p.h, hi)                # the ridge over the top
            if face != 'north' and face != 'up' and trim:
                p.row(-1, trim)
        return f

    def torso(p, face):
        side = face in ('north', 'south', 'east', 'west')
        if o['armour'] == 'plate':
            cloth(p, plate, face, 0.1)
            if face == 'north':
                p.rect(1, 1, 6, 1, shade(plate, 1.12))                       # light across the chest
                p.rect(1, 6, 6, 1, plate3).rect(0, 10, p.w, 1, plate2).rect(0, 11, p.w, 1, plate3)   # the plates of the belly
                p.border(metal, 'lrt')
                if o['emblem']:
                    p.stamp(['..#..', '.#.#.', '#.#.#', '.#.#.', '..#..'], {'#': o['emblem']}, None, 2)
                if o['emblemGlow']:
                    p.rect(3, 4, 2, 2, o['emblemGlow'])
            elif face == 'south':
                p.col(p.w // 2, plate3).row(0, metal).rect(0, 10, p.w, 1, plate2).rect(0, 11, p.w, 1, plate3)
            elif side:
                p.row(0, metal).rect(0, 10, p.w, 2, plate3)
        else:
            cloth(p, coat, face)
            if side:
                p.row(-1, coat2)
            if face == 'north':
                if o['shirt']:
                    sh = o['shirt']
                    p.rect(3, 0, 2, p.h, sh).set(2, 0, sh).set(5, 0, sh).set(2, 1, sh).set(5, 1, sh)   # an open collar
                    p.rect(2, 2, 1, p.h - 2, shade(coat, 0.72)).rect(5, 2, 1, p.h - 2, shade(coat, 0.72))
                    p.set(4, 3, shade(sh, 0.78)).set(4, 6, shade(sh, 0.78))                       # buttons
                else:
                    p.set(3, 0, coat2).set(4, 0, coat2).set(3, 1, coat2)                          # the neck of it
                    p.rect(1, 2, 1, 5, shade(coat, 1.08))
                if o['trim']:
                    p.row(0, o['trim'])
                    if o['robe']:
                        p.col(4, o['trim'])
                    elif o['emblem'] and not o['shirt']:
                        p.rect(2, 1, 4, 7, shade(coat, 1.1)).rect(2, 1, 1, 7, o['trim']).rect(5, 1, 1, 7, o['trim'])   # a tabard
                if o['emblem']:
                    p.stamp(['.#.', '###', '.#.'], {'#': o['emblem']}, None, 3)
            elif face == 'south':
                p.rect(p.w // 2, 1, 1, 7, coat2)                                                  # the seam down the back
            if o['trim'] and face in ('east', 'west', 'south'):
                p.row(0, o['trim'])
        if o['satchel'] and face in ('north', 'south'):
            for i in range(8):
                p.set(i if face == 'north' else 7 - i, i + 1, '#3a2414')
        if o['belt'] and side:
            p.row(8, o['belt']).row(9, shade(o['belt'], 0.82))
            if face == 'north' and o['buckle']:
                p.rect(3, 8, 2, 2, o['buckle'])

    def arm(p, face):
        side = face in ('north', 'south', 'east', 'west')
        if o['armour']:
            a1, a2 = (plate2, plate3) if o['armour'] == 'plate' else (C['steel3'], C['steel4'])
            cuff = metal if o['trim'] else plate
            cloth(p, a1, face, 0.1)
            if face == 'down':
                p.fill(a2)
            elif side:
                p.rect(0, 0, p.w, 3, plate).row(3, metal)                    # the shoulder plate
                p.row(6, a2)                                                 # the elbow
                p.rect(0, p.h - 4, p.w, 4, cuff).row(-4, shade(cuff, 0.8))   # the gauntlet
                p.row(-1, a2)
            elif face == 'up':
                p.fill(shade(plate, 1.08))
        else:
            cloth(p, coat, face)
            if face == 'down':
                p.fill(skin2)
            elif side:
                p.row(0, shade(coat, 1.08)).row(6, coat2)                    # the shoulder, the crook of the elbow
                p.row(-4, o['trim'] or coat2)                                # the cuff
                p.rect(0, p.h - 3, p.w, 3, skin).row(-1, skin2)              # the hand
                if face == 'north':
                    p.set(p.w // 2, p.h - 2, skin2)

    def leg(p, face):
        side = face in ('north', 'south', 'east', 'west')
        boots = o['boots']
        if o['armour'] == 'plate':
            cloth(p, plate, face, 0.1)
            if side:
                p.row(0, plate3).rect(0, 4, p.w, 1, metal).rect(0, 5, p.w, 1, plate2)   # the knee
                if face == 'north':
                    p.rect(1, 6, 1, 2, shade(plate, 1.12))
        else:
            tr = o['trousers']
            cloth(p, tr, face)
            if side:
                p.row(0, shade(tr, 0.86))
                if face == 'north':
                    p.rect(1, 4, 2, 1, shade(tr, 0.86))                      # the knee
        if face == 'down':
            p.fill(shade(boots, 0.6))
        elif side:
            p.rect(0, p.h - 4, p.w, 4, boots).row(-4, shade(boots, 1.25)).row(-1, shade(boots, 0.65))
            if face == 'north':
                p.set(1, p.h - 2, shade(boots, 1.2))

    # --- boxes ------------------------------------------------------------
    # Legs a little apart and arms slimmer than the body is deep: a figure,
    # where two slabs side by side read as a brick.
    cubes = [
        box('leg_l', 'leg_l', (-3.8, 0, -2), (-0.3, 12, 2), leg),
        box('leg_r', 'leg_r', (0.3, 0, -2), (3.8, 12, 2), leg),
        box('torso', 'body', (-4, 12, -2), (4, 24, 2), torso, skip=('up',)),
        box('arm_l', 'arm_l', (-7, 12, -1.75), (-4, 24, 1.75), arm),
        box('arm_r', 'arm_r', (4, 12, -1.75), (7, 24, 1.75), arm),
    ]
    extras = []          # nice to have, in order, while the model's triangles allow
    hat = o['hat']
    hc = o['hatColour'] or (C['iron'] if hat == 'helm' else coat)
    if hat == 'helm':
        cubes.append(box('helm', 'head', (-4.5, 23.5, -4.5), (4.5, 32.5, 4.5), shell(hc, o['hatTrim'], True, o['visor'], steel=True)))
    elif hat == 'hood':
        # A hood darker than the coat, with a trim at its hem: seen from behind, a
        # hood the coat's colour read as no head at all (owner, 5 November).
        cubes.append(box('hood', 'head', (-4.5, 23.5, -4.5), (4.5, 32.5, 4.5), shell(hc, o['hatTrim'], True)))
        cubes.append(box('hood_peak', 'head', (-2, 32.5, -1), (2, 34, 4.5), {'all': lambda p, f: cloth(p, hc, f)}, skip=('down',)))
        cubes.append(box('hood_drape', 'body', (-4.75, 21.5, -2.5), (4.75, 24.5, 2.75),
                         {'all': lambda p, f: cloth(p, hc, f).row(-1, shade(hc, 0.7))}, skip=('down',)))
    else:
        cubes.append(box('head', 'head', (-4, 24, -4), (4, 32, 4), head))
    if hat == 'cap':
        def cap(p, f):
            cloth(p, hc, f)
            if f in ('north', 'south', 'east', 'west'):
                p.row(-1, o['hatTrim'] or shade(hc, 0.7))
        cubes.append(box('cap', 'head', (-4.5, 30.5, -4.5), (4.5, 33, 4.5), cap, skip=('down',)))
        cubes.append(box('cap_brim', 'head', (-4.5, 30.5, -6.5), (4.5, 31.25, -4.5), lambda p, f: cloth(p, hc, f), skip=('south',)))
    elif hat == 'crown':
        gold = hc if o['hatColour'] else C['gold']
        def band(p, f):
            cloth(p, gold, f, 0.1)
            if f in ('north', 'south', 'east', 'west'):
                p.row(0, shade(gold, 1.15)).row(-1, shade(gold, 0.7))
        cubes.append(box('crown', 'head', (-4.5, 30.5, -4.5), (4.5, 33, 4.5), band, skip=('down',)))
        for i, (x, z) in enumerate(((-4.5, -4.5), (3, -4.5), (-4.5, 3), (3, 3), (-0.75, -4.5))):
            tall = 3 if i == 4 else 2
            cubes.append(box(f'crown_pt{i}', 'head', (x, 33, z), (x + 1.5, 33 + tall, z + 1.5), band, skip=('down',)))
        cubes.append(box('crown_gem', 'head', (-0.75, 31, -4.75), (0.75, 32.5, -4.5), {'all': o['crownGem']}, skip=('south',)))
    if o['plume']:
        pl = o['plume']
        feather = lambda p, f: cloth(p, pl, f, 0.2)
        cubes.append(box('plume', 'head', (-0.75, 32.5, -2), (0.75, 37, 3), feather, skip=('down',)))
        cubes.append(box('plume_tail', 'head', (-0.75, 31, 3), (0.75, 35, 5.5), feather))
    if o['goblin']:
        ear = lambda p, f: cloth(p, skin, f).set(1, 1, C['pink']) if f == 'north' else cloth(p, skin, f)
        cubes += [box('ear_l', 'head', (-8, 27, -0.5), (-4, 30, 0.5), ear, (0, 0, -15)),
                  box('ear_r', 'head', (4, 27, -0.5), (8, 30, 0.5), ear, (0, 0, 15)),
                  box('nose', 'head', (-0.75, 26.5, -7), (0.75, 28, -4), {'all': lambda p, f: cloth(p, skin2, f)}, skip=('south',))]
    if o['cape']:
        cp, ct = o['cape'], o['capeTrim']
        def cape(p, face):
            cloth(p, cp, face)
            if face in ('north', 'south'):
                for x in (2, 6):
                    p.rect(x, 2, 1, p.h - 4, shade(cp, 0.86))    # folds
            if ct:
                p.border(ct, 'lrb')
        cubes.append(box('cape', 'body', (-4.5, 4, 2), (4.5, 24, 3), cape))
    if o['skirt'] or o['robe']:
        lo = 2 if o['robe'] else 8
        def skirt(p, face):
            cloth(p, coat, face)
            if face in ('north', 'south', 'east', 'west'):
                for x in range(1, p.w, 3):
                    p.rect(x, 1, 1, p.h - 2, coat2)              # folds
                p.row(-1, o['trim'] or shade(coat, 0.7))
            if face == 'north' and o['robe'] and o['trim']:
                p.col(p.w // 2, o['trim'])
        cubes.append(box('skirt', 'body', (-4.5, lo, -2.5), (4.5, 12.5, 2.5), skirt, skip=('up',)))
    if o['scarf']:
        sc = o['scarf']
        cubes.append(box('scarf', 'body', (-4.5, 22, -2.5), (4.5, 24.5, 2.5), {'all': lambda p, f: cloth(p, sc, f)}, skip=('down',)))
        cubes.append(box('scarf_mask', 'head', (-4.25, 24, -4.25), (4.25, 27, -3.75), {'all': lambda p, f: cloth(p, sc, f)}, skip=('south',)))
    if o['apron']:
        ap = o['apron']
        cubes.append(box('apron', 'body', (-3, 6, -2.75), (3, 21, -2), {'all': lambda p, f: cloth(p, ap, f).row(4, shade(ap, 0.7))}, skip=('south',)))
    if o['satchel']:
        sa = o['satchel']
        cubes.append(box('satchel', 'body', (1.5, 9, -3.5), (4.5, 14, -2), {'all': lambda p, f: cloth(p, sa, f).row(0, shade(sa, 0.7))}, skip=('south',)))
        cubes.append(box('scroll', 'body', (2.25, 14, -3.25), (3.75, 16, -2), {'all': lambda p, f: cloth(p, C['paper'], f).row(0, C['red'])}, skip=('south', 'down')))
    if o['quiver']:
        q = o['quiver']
        cubes.append(box('quiver', 'body', (-3, 13, 2), (0, 25, 4.5), {'all': lambda p, f: cloth(p, q, f).row(0, shade(q, 0.6))}, skip=('north',)))
        for i, x in enumerate((-2.5, -1.25)):
            cubes.append(box(f'arrow{i}', 'body', (x, 25, 2.75), (x + 0.75, 27.5, 3.5), {'all': '#e8e2d6', 'up': C['red']}, skip=('down',)))
    if o['shield']:
        # Carried on the forearm, its painted face forward: what they are behind.
        s1, s2 = o['shield']
        def shield(p, face):
            if face == 'north':
                cloth(p, s1, None, 0.1).border(s2)
                p.rect(p.w // 2 - 1, 2, 2, p.h - 4, s2).rect(1, p.h // 2 - 1, p.w - 2, 2, s2)
                p.rect(p.w // 2 - 1, p.h // 2 - 1, 2, 2, o['emblemGlow'] or shade(s2, 1.2))
            elif face == 'south':
                cloth(p, C['wood'], None).border(s2)
            else:
                p.fill(s2)
        cubes.append(box('shield', 'arm_l', (-9, 10.5, -3), (-3, 21.5, -2), shield))
    if o['wings']:
        from featured import wing
        cubes += [box('wing_l', 'wing_l', (-14, 17, 2.5), (-2, 28, 3.5), wing),
                  box('wing_l_low', 'wing_l', (-10, 9, 2.5), (-2, 17, 3.5), wing),
                  box('wing_r', 'wing_r', (2, 17, 2.5), (14, 28, 3.5), wing),
                  box('wing_r_low', 'wing_r', (2, 9, 2.5), (10, 17, 3.5), wing)]
    if o['armour'] == 'plate':
        # Shoulder plates in one piece across the back of the neck: the arms swing under them.
        def yoke(p, face):
            cloth(p, plate, face, 0.1)
            if face in ('north', 'south', 'east', 'west'):
                p.row(0, shade(plate, 1.12)).row(-1, metal)
        extras.append(box('pauldrons', 'body', (-7.6, 21.5, -2.6), (7.6, 24.8, 2.6), yoke, skip=('down',)))
    if id == 'soldier':
        extras.append(box('crest', 'head', (-0.75, 32.5, -3.5), (0.75, 34.5, 4.5), lambda p, f: cloth(p, C['teal'], f).row(0, C['tealLight']), skip=('down',)))
    if id == 'warlord':
        extras.append(box('horns', 'head', (-7.5, 29.5, -1), (7.5, 31.5, 1), lambda p, f: cloth(p, '#b8b0a0', f).col(0, C['redDark']).col(-1, C['redDark'])))

    # Gear, in the right hand: a sword tipped up and ahead from the fist, a spear
    # or staff upright in front of it, a bow across it (upright once the arm is raised).
    gc, gg = o['gearColour'], o['gearGlow']
    hand = (5.5, 13.5, -1.75)
    if o['gear'] == 'sword':
        bc = gc or C['steel']
        def blade(p, f):
            cloth(p, bc, f, 0.08)
            if f in ('east', 'west'):
                p.row(0, gg or C['white']).row(-1, shade(bc, 0.8))
            elif f == 'up':
                p.fill(gg or C['white'])
        hilt = lambda p, f: cloth(p, C['gold'], f, 0.1)
        cubes += [tilt(box('guard', 'arm_r', (4.9, 11.6, -3.3), (6.1, 15.4, -2.3), hilt), hand, 38),
                  tilt(box('blade', 'arm_r', (5.1, 12.5, -15), (5.9, 14.5, -3.3), blade, skip=('south',)), hand, 38)]
        extras.append(tilt(box('pommel', 'arm_r', (4.9, 12.7, 1.75), (6.1, 14.3, 3), hilt, skip=('north',)), hand, 38))
    elif o['gear'] == 'spear':
        steel = lambda p, f: cloth(p, gc or C['steel2'], f, 0.1).row(0, gg or C['white'])
        cubes += [box('shaft', 'arm_r', (5, -2, -2.9), (6, 34, -1.9), {'all': lambda p, f: cloth(p, gc or C['wood'], f)}, skip=('up', 'down')),
                  box('spear_head', 'arm_r', (4.5, 34, -3.4), (6.5, 39.5, -1.4), {'all': gg or C['steel']} if gg else steel, skip=('down',))]
    elif o['gear'] == 'staff':
        cubes += [box('staff', 'arm_r', (5, -1, -2.9), (6, 34, -1.9), {'all': lambda p, f: cloth(p, gc or C['wood'], f)}, skip=('up', 'down')),
                  box('staff_head', 'arm_r', (4.25, 34, -3.65), (6.75, 37.5, -1.15), {'all': gg or C['paper']}, (0, 45, 0))]
    elif o['gear'] == 'bow':
        bc = gc or C['wood']
        bow = lambda p, f: cloth(p, bc, f)
        cubes += [box('bow_grip', 'arm_r', (5, 10.9, -3.5), (6, 12, 3.5), bow),
                  box('bow_top', 'arm_r', (5, 11.6, -9), (6, 12.7, -3.5), bow, (-14, 0, 0)),
                  box('bow_low', 'arm_r', (5, 11.6, 3.5), (6, 12.7, 9), bow, (14, 0, 0)),
                  box('bow_string', 'arm_r', (5.3, 13.4, -8.7), (5.7, 13.8, 8.7), {'all': '#e8e2d6'}, skip=('north', 'south'))]

    bones = [('body', None, (0, 12, 0)), ('head', 'body', (0, 24, 0)), ('arm_l', 'body', (-5.5, 22, 0)),
             ('arm_r', 'body', (5.5, 22, 0)), ('leg_l', None, (-2, 12, 0)), ('leg_r', None, (2, 12, 0))]
    anim = {'leg_l': swing(28), 'leg_r': swing(-28), 'arm_l': swing(-22),
            'arm_r': swing(8 if o['gear'] in ('spear', 'staff', 'bow') else 14),
            'head': [(1, (0, -4, 0)), (13, (0, 4, 0)), (25, (0, -4, 0))]}
    rest = {}
    if o['wings']:
        bones += [('wing_l', 'body', (-2, 22, 2)), ('wing_r', 'body', (2, 22, 2))]
        rest = {'wing_l': (0, 40, -12), 'wing_r': (0, -40, 12)}
        anim['wing_l'] = [(1, (0, 40, -12)), (13, (0, 60, -18)), (25, (0, 40, -12))]
        anim['wing_r'] = [(1, (0, -40, 12)), (13, (0, -60, 18)), (25, (0, -40, 12))]
    # Ordinary villagers get the same layered finish as the explorer, while
    # retaining their own scale, palette, bones and walk cycle.
    if id == 'settler' or id.startswith('settler_') or id == 'citizen' or id.startswith('citizen_'):
        accent = o['trim'] or o['shirt'] or C['paper']
        plain = lambda c: (lambda p, f: cloth(p, c, f, 0.08))
        hem = lambda p, f: cloth(p, coat, f).row(-1, coat2)
        leather = lambda p, f: cloth(p, o['belt'], f).row(0, shade(o['belt'], 1.2))
        cubes += [
            box('collar_l', 'body', (-3.5, 21.5, -2.7), (-0.5, 24.2, -2), plain(accent), skip=('south',)),
            box('collar_r', 'body', (0.5, 21.5, -2.7), (3.5, 24.2, -2), plain(accent), skip=('south',)),
            box('coat_hem', 'body', (-4.3, 11.5, -2.3), (4.3, 13, 2.3), hem, skip=('up',)),
            box('pocket', 'body', (-3.6, 15, -2.7), (-0.8, 18, -2), hem, skip=('south',)),
            box('pocket_flap', 'body', (-3.7, 17.6, -3), (-0.7, 18.5, -2.5), plain(coat2), skip=('south',)),
            box('belt_pouch', 'body', (1, 10.5, 2), (3.6, 13.5, 3.2), leather, skip=('north',)),
            box('pouch_clasp', 'body', (1.9, 12, 3.2), (2.7, 12.9, 3.5), o['buckle'], skip=('north',)),
            box('nose', 'head', (-0.8, 26.4, -4.8), (0.8, 28, -4), plain(skin2), skip=('south',)),
            box('ear_l', 'head', (-4.6, 26.5, -0.8), (-4, 28.5, 0.8), plain(skin), skip=('east',)),
            box('ear_r', 'head', (4, 26.5, -0.8), (4.6, 28.5, 0.8), plain(skin), skip=('west',)),
        ]
        for side, x in [('l', -7), ('r', 4)]:
            cubes.append(box(f'cuff_{side}', f'arm_{side}', (x - 0.2, 14.5, -1.95), (x + 3.2, 16, 1.95), plain(accent), skip=('up', 'down')))
        for side, x in [('l', -3.8), ('r', 0.3)]:
            cubes += [box(f'boot_toe_{side}', f'leg_{side}', (x, 0.5, -3), (x + 3.5, 3, -2), plain(o['boots']), skip=('south',)),
                      box(f'boot_sole_{side}', f'leg_{side}', (x - 0.1, 0, -3.1), (x + 3.6, 0.6, 2.1), plain(shade(o['boots'], 0.65)), skip=('up',))]
        if o['hair'] and not hat:
            hair = o['hair']
            cubes += [box('hair_top', 'head', (-4.2, 31, -4.1), (4.2, 32.6, 4.2), lambda p, f: cloth(p, hair, f, 0.2), skip=('down',)),
                      box('hair_fringe', 'head', (-4.2, 29.8, -4.3), (-0.5, 31.4, -3.6), plain(hair), skip=('south', 'up')),
                      box('hair_side', 'head', (3.5, 27.8, 1.5), (4.4, 31.2, 4.3), plain(shade(hair, 0.85)), skip=('west', 'up'))]
        if o['beard']:
            cubes.append(box('beard_tip', 'head', (-2, 23, -4.5), (2, 25.5, -3.8), plain(o['beard']), skip=('south',)))
        # Different accessories read at playing distance, beyond colour swaps.
        if id in ('settler_2', 'citizen_1'):
            cubes.append(box('apron_bib', 'body', (-2.8, 13, -3), (2.8, 21.2, -2.5), plain(C['paper2']), skip=('south',)))
            cubes.append(box('apron_skirt', 'body', (-3, 6.5, -2.9), (3, 13, -2.3), plain(C['paper2']), skip=('south', 'up')))
        if id in ('settler_4', 'citizen_2'):
            cubes.append(box('shoulder_wrap', 'body', (-4.7, 21.5, -2.6), (4.7, 23.8, 2.6), plain(accent), skip=('down',)))
        if id in ('settler_1', 'settler_5', 'citizen_3'):
            cubes.append(box('small_pack', 'body', (-3, 14, 2), (3, 21, 4), leather, skip=('north',)))
            cubes.append(box('pack_flap', 'body', (-3.2, 19.5, 2), (3.2, 21.5, 4.4), plain(coat2), skip=('north',)))
    for extra in extras:
        if triangles(cubes) + triangles([extra]) <= BUDGET.get(id, 0):
            cubes.append(extra)
    assert triangles(cubes) <= BUDGET.get(id, 10 ** 6), (id, triangles(cubes))
    return dict(id=id, name=name, bones=bones, cubes=cubes, anim=anim, rest=rest, scale=o['scale'])


IRON = ('#3a3840', '#2c2a31', '#4c4a55')
SKYP = (C['steel'], C['steel2'], C['steel3'])
GOLDP = ('#f1d070', '#e0b84a', '#c79a2a')

PEOPLE = [
    # Your own.
    person('settler', 'Settler', coat=C['teal'], shirt=C['paper'], trousers='#5a4636', hair='#6b4a2e'),
    person('soldier', 'Soldier', hat='helm', hatColour=C['steel3'], hatTrim=C['teal'], coat=C['teal'], trim=C['gold'],
           emblem=C['gold'], gear='sword', shield=(C['teal'], C['gold']), emblemGlow=G['tealMid'], trousers=C['tealDeep']),
    person('archer', 'Archer', hat='hood', hatColour=C['tealDeep'], hatTrim=C['gold'], coat=C['teal'], trousers='#5a4636', gear='bow', quiver=C['wood'], skin='light'),
    person('footman', 'Footman', hat='cap', hatColour='#7a5a3a', coat='#8a6a4a', trim='#5a4030', gear='sword', gearColour='#afafb7', trousers='#4a3a30', skin='tan'),
    person('swordsman', 'Swordsman', hat='helm', hatColour=C['steel3'], plume='#3a5aa8', coat='#3a5aa8', trim=C['gold'], gear='sword', shield=('#3a5aa8', C['gold'])),
    person('bowman', 'Bowman', hat='hood', hatColour='#24321d', hatTrim='#a8743f', coat='#5f7f4a', trousers='#3a3024', gear='bow', quiver=C['woodDark']),
    # The Garrison's spear guard (owner, 4 November: "still headless"): it had no
    # model, and the stand-in's helm box hid the whole face. An open-face helm here.
    person('shield_guard', 'Spear guard', hat='helm', hatColour=C['steel3'], hatTrim=C['gold'], coat=C['teal'], trim=C['gold'],
           gear='spear', gearColour='#afafb7', shield=(C['teal'], C['gold']), skin='light'),
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

# A town is many people: settlers and citizens come in several looks, and the
# game picks one per person (render/SettlerView.js, by a hash of their name).
SETTLER_LOOKS = [
    dict(coat='#3a6a8a', shirt=C['paper'], trousers='#4a3a30', hair='#2a1e16', skin='light'),
    dict(coat='#8a5a32', shirt=C['paper2'], trousers='#3a3024', hair='#c98a3a', skin='mid', beard='#c98a3a'),
    dict(coat='#6a7a3a', shirt=C['paper'], trousers='#4a3a30', hair='#4a2e19', skin='dark'),
    dict(coat='#9a3a3a', shirt=C['paper2'], trousers='#3a3024', hair='#1e1612', skin='tan', hat='cap', hatColour='#5a4030'),
    dict(coat='#6a4a7a', shirt=C['paper'], trousers='#3a3030', hair='#d9c08a', skin='light'),
]
CITIZEN_LOOKS = [
    dict(hatColour='#3a6a8a', coat=C['paper'], trim='#3a6a8a', hair='#4a2e19', skin='light'),
    dict(hatColour=C['grassDark'], coat='#d6bd85', trim=C['grassDark'], hair='#1e1612', skin='mid'),
    dict(hatColour='#7a2a20', coat='#e6d2a2', trim='#7a2a20', hair='#c98a3a', skin='tan'),
]
PEOPLE += [person(f'settler_{i + 1}', f'Settler {i + 2}', **look) for i, look in enumerate(SETTLER_LOOKS)]
PEOPLE += [person(f'citizen_{i + 1}', f'Citizen {i + 2}', hat='cap', trousers='#6a5a4a', **look) for i, look in enumerate(CITIZEN_LOOKS)]
