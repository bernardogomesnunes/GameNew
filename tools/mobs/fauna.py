"""
Every animal in the game (src/config/mobs.js), plus the guardians and the
Warlord's beast, built with the kit in beasts.py (owner, 11 November:
"improve their 3d model, animations"). Their colours and painters are the
ones in animals.py and featured.py; the dinosaurs are in dinos.py.

Sizes follow mobs.js (blocks x 16).
"""
from beasts import *
from animals import *
import featured as F


def eyed(base, row, size=2, eye=None, glint=G['tealMid'], inset=1):
    """A painter, plus an eye on each side of the head towards the front."""
    def f(p, face):
        base(p, face)
        if face in ('east', 'west'):
            x = inset if face == 'west' else p.w - inset - size
            p.rect(x, row, size, size, eye or C['ink'])
            if glint:
                p.set(x if face == 'west' else x + size - 1, row, glint)
    return f


def nose(cols, tip, rows=1, mouth=None):
    """A muzzle: fur, the nose dark across the top of its front, a mouth line under."""
    def f(p, face):
        p.grain(cols)
        if face == 'north':
            p.rect(1 if p.w > 3 else 0, 0, p.w - 2 if p.w > 3 else p.w, rows, tip)
            if mouth:
                p.row(-1, mouth)
        elif face in ('east', 'west') and mouth:
            p.rect(0 if face == 'west' else p.w - 2, p.h - 1, 2, 1, mouth)
    return f


# --------------------------------------------------------------------------
# Cow, and the Moon Cow: cream with glowing teal runes, a blanket, a crystal.

def cow(moon=False):
    body = F.cow_body if moon else F.plain_body
    coat = [C['paper'], C['paper2'], C['paper3']] if moon else [F.BROWN2, F.BROWN, F.BROWN3]
    horn, tip = (F.horn, F.horn_tip) if moon else (F.plain_horn, F.plain_horn_tip)
    ear = F.ear if moon else F.plain_ear

    def features(H, B):
        y1, z1 = H['y1'], H['z1']
        out = [
            box('udder', 'body', (-2.5, 7.5, 2), (2.5, 10, 6.5), {'all': solid(C['pink']), 'down': lambda p, f: p.fill(C['pink']).set(1, 1, C['pinkDark']).set(3, 1, C['pinkDark']).set(1, 3, C['pinkDark']).set(3, 3, C['pinkDark'])}),
            box('dewlap', 'neck', (-1.5, 10.5, -12.5), (1.5, 14, -8), fur(coat)),
            box('withers', 'body', (-3.5, 20.5, -8.5), (3.5, 21.5, -3.5), body),
            box('hips', 'body', (-5, 20.5, 5), (5, 21.25, 8.5), body),
            box('poll', 'head', (-2.5, y1, z1 - 4), (2.5, y1 + 1, z1 - 0.5), fur(coat)),
            *sides(box('horn', 'head', (-7, y1 - 2.5, z1 - 3.5), (-3.5, y1 - 0.5, z1 - 1.5), horn)),
            *sides(box('horn_tip', 'head', (-8, y1 - 1.5, z1 - 3.75), (-6, y1 + (3 if moon else 2.5), z1 - 1.75), tip, (-12, 0, 0))),
            *sides(box('ear', 'ears', (-7.5, y1 - 5.25, z1 - 2.5), (-3.75, y1 - 3.25, z1 - 1.5), ear, (0, 0, 14))),
            box('tail', 'tail', (-0.5, 11.5, 9), (0.5, 20, 10), F.tail if moon else F.plain_tail),
            box('tail_tuft', 'tail', (-1, 8.5, 8.75), (1, 12, 10.5), F.tail_tuft if moon else F.plain_tuft),
        ]
        if moon:
            out += [
                box('blanket', 'body', (-7, 14, -3), (7, 20.5, 4), F.cow_blanket),
                box('crystal', 'crystal', (-1.5, y1 + 3.5, H['z0'] + 1.5), (1.5, y1 + 8, H['z0'] + 4.5), crystal, (0, 45, 0)),
                box('crystal_tip', 'crystal', (-0.75, y1 + 8, H['z0'] + 2.25), (0.75, y1 + 10, H['z0'] + 3.75), crystal, (0, 45, 0)),
                box('crystal_foot', 'crystal', (-0.75, y1 + 2, H['z0'] + 2.25), (0.75, y1 + 3.5, H['z0'] + 3.75), crystal, (0, 45, 0)),
            ]
        return out

    return beast(
        'moon_cow' if moon else 'cow', 'Moon Cow' if moon else 'Cow',
        torso=[(-9, -3, 12, 9.5, 20.5), (-3, 4, 13, 9, 20), (4, 9, 12, 10, 20.5)], leg=9.5, hide=body,
        limbs=dict(w=3.5, x=4.25, hx=4.5, fz=-6.5, hz=6.5, knee=5, upper=(4.5, 3, 5), hind=(4.5, 4, 6), hock=0.5,
                   paint=(fur(coat), F.cow_leg if moon else F.plain_leg)),
        neck=dict(at=(17, -8), to=(17.5, -12), w=7, h=8, paint=fur(coat)),
        head=dict(size=(8, 8, 6), back=0.25, up=0.55, pitch=-12, paint=eyed(F.cow_head if moon else F.plain_head, 3, glint=G['teal'] if moon else G['tealMid']),
                  muzzle=dict(size=(6.5, 4.5, 2.5), paint=F.cow_snout)),
        tail=(19.5, 9), features=features, rest={'tail': (-8, 0, 0)},
        bones=(lambda H, B: [('crystal', 'head', (0, H['y1'] + 6, H['z0'] + 3))]) if moon else None,
    )


COW, MOON_COW = cow(), cow(True)

# --------------------------------------------------------------------------
# Deer: slender, a white rump, antlers with tines.

DEER_LEG = ['#a87c56', '#9a7050']


def deer_features(H, B):
    y1, z1 = H['y1'], H['z1']
    return [
        box('rump', 'body', (-3, 13, 9), (3, 18.5, 9.5), C['paper']),
        box('throat', 'neck', (-1.25, 16, -9.5), (1.25, 21, -8), C['paper2'], (33, 0, 0)),
        *sides(box('ear', 'ears', (-4.75, y1 - 1.5, z1 - 2), (-2.5, y1 + 1.75, z1 - 1), {'all': fur(DEER), 'north': lambda p, f: p.fill(C['pink']).border(DEER[0])}, (0, 0, 35))),
        *sides(tube('antler', 'head', (y1 - 0.5, z1 - 1.5), (y1 + 5, z1 + 0.5), 1, 1, antler_paint, x=-2)),
        *sides(tube('antler_hi', 'head', (y1 + 4.5, z1 + 0.5), (y1 + 9.5, z1 - 1.5), 1, 1, antler_paint, x=-3)),
        *sides(tube('tine_brow', 'head', (y1 + 1, z1 - 1.5), (y1 + 3, z1 - 4.5), 1, 1, antler_paint, x=-2)),
        *sides(tube('tine_back', 'head', (y1 + 5, z1 + 0.5), (y1 + 7.5, z1 + 3), 1, 1, antler_paint, x=-3)),
        box('tail', 'tail', (-1.5, 15.5, 9), (1.5, 19, 10.5), {'all': C['paper'], 'up': DEER[0], 'north': DEER[0]}),
    ]


DEER_M = beast(
    'deer', 'Deer', torso=[(-9, -3.5, 7.5, 10.5, 19.5), (-3.5, 3.5, 7, 11.5, 19), (3.5, 9, 8, 10.5, 19.5)], leg=10.5, hide=deer_body,
    limbs=dict(w=2, x=2.75, fz=-7, hz=6.5, knee=5.5, upper=(3, 3, 3.5), hind=(3.5, 4, 5), hock=1,
               paint=(fur(DEER), legs_paint(DEER_LEG, '#3a2a1e', 1))),
    neck=dict(at=(17.5, -7.5), to=(25, -11.5), w=3.5, h=4, paint=fur(DEER)),
    head=dict(size=(5, 5, 5.5), pitch=-20, paint=skull(DEER, row=1),
              muzzle=dict(size=(3.5, 3, 3), lift=0.5, paint=nose([DEER[2], C['paper2']], C['ink'], mouth=C['paper2']))),
    tail=(18.5, 9), features=deer_features,
)

# --------------------------------------------------------------------------
# Rabbit: a loaf with big haunches, long feet and ears.

def rabbit_foot(bname, x, z):
    if bname in ('leg_fl', 'leg_fr'):
        return []
    return [box(bname + '_foot', bname, (x - 1, 0, z - 3.5), (x + 1, 1, z + 0.75), fur(RAB, bottom=C['paper2']))]


def rabbit_features(H, B):
    y1, z1 = H['y1'], H['z1']
    inner = {'all': fur(RAB), 'north': lambda p, f: p.fill(C['pink']).border(RAB[0], 'lrt')}
    return [
        box('chest', 'body', (-1.75, 1.5, -4), (1.75, 4.5, -3.5), C['paper']),
        *sides(box('cheek', 'head', (-2.75, H['y0'], H['z0'] + 0.5), (-2.25, H['y0'] + 2, H['z0'] + 3), fur(RAB))),
        *sides(box('ear', 'ears', (-2, y1 - 0.5, z1 - 2), (-0.5, y1 + 5.5, z1 - 1), inner, (14, 0, 7))),
        box('tail', 'tail', (-1.25, 3, 3.25), (1.25, 5.5, 5), C['white']),
    ]


RABBIT = beast(
    'rabbit', 'Rabbit', torso=[(-3.5, -0.5, 4.5, 1.5, 6), (-0.5, 3.5, 5.5, 1, 7)], leg=1.5, hide=fur(RAB, C['paper']),
    limbs=dict(w=1.5, x=1.5, hx=2.25, fz=-2.5, hz=1.75, knee=1, upper=(1.5, 1, 1.5), hind=(2, 3, 3.5), foot=rabbit_foot,
               paint=(fur(RAB), fur(RAB, bottom=C['paper2']))),
    head=dict(at=(6.5, -3), size=(4.5, 4.5, 4.5), back=0.35, paint=skull(RAB, row=1, size=1, inset=1),
              muzzle=dict(size=(2.5, 2, 1), lift=0.5, paint={'all': fur([C['paper'], RAB[2]]), 'north': lambda p, f: p.fill(C['paper']).set(p.w // 2, 0, C['pink'])})),
    tail=(4.5, 3.5), features=rabbit_features,
)

# --------------------------------------------------------------------------
# Boar: high shoulders sloping to a small rump, a long snout, tusks, a mane.

BOAR_DARK = ['#3e3028', '#2f241e']


def boar_features(H, B):
    y1, z1, M = H['y1'], H['z1'], H['m']
    return [
        box('mane', 'body', (-1.25, 15.5, -8), (1.25, 17.5, -0.5), fur(BOAR_DARK)),
        box('mane_back', 'body', (-1, 14.5, -0.5), (1, 16, 4.5), fur(BOAR_DARK)),
        box('disc', 'head', (-2.5, M['y0'] + 0.25, M['z0'] - 0.5), (2.5, M['y1'] - 0.25, M['z0']), boar_snout),
        *sides(box('tusk', 'head', (-3.25, M['y0'] + 0.5, M['z0'] + 0.75), (-2.25, M['y0'] + 3.75, M['z0'] + 1.75), {'all': '#f2ede4', 'up': C['white']}, (-15, 0, 18))),
        *sides(box('ear', 'ears', (-3.75, y1 - 0.75, z1 - 2.5), (-1.75, y1 + 2, z1 - 1.5), fur(BOAR_DARK), (0, 0, 18))),
        box('tail', 'tail', (-0.5, 8.5, 8), (0.5, 12.5, 9), fur(BOAR)),
        box('tail_tuft', 'tail', (-1, 7, 7.75), (1, 8.5, 9.25), fur(BOAR_DARK)),
    ]


BOAR_M = beast(
    'boar', 'Boar', torso=[(-8, -1.5, 10, 5, 15.5), (-1.5, 4, 9.5, 5.5, 14.5), (4, 8, 8.5, 6, 13.5)], leg=5, hide=boar_body,
    limbs=dict(w=2.5, x=3.75, hx=3.25, fz=-5.5, hz=6, knee=3, upper=(3.5, 3, 4), hind=(3.5, 3.5, 4.5),
               paint=(fur(BOAR), legs_paint(['#4d3c31', '#5a463a'], C['ink'], 1))),
    head=dict(at=(11.5, -8), size=(7.5, 7.5, 5.5), back=0.2, pitch=-12, paint=skull(BOAR, row=2, north=lambda p: p.row(0, '#4d3c31')),
              muzzle=dict(size=(4.5, 4, 4.5), lift=0.5, paint=fur(['#5a473b', '#4a3a30']))),
    tail=(12.5, 8), features=boar_features, rest={'tail': (-18, 0, 0)},
)

# --------------------------------------------------------------------------
# Goat: a round belly on thin legs, horns swept back, a beard.

def goat_features(H, B):
    y1, z1, M = H['y1'], H['z1'], H['m']
    return [
        box('beard', 'head', (-1, M['y0'] - 3, M['z0'] + 0.75), (1, M['y0'], M['z0'] + 2), fur(['#cfc8ba', '#bdb6a8'])),
        *sides(tube('horn', 'head', (y1 - 0.5, z1 - 2), (y1 + 3.5, z1 + 0.5), 1.5, 1.5, goat_horn, x=-1.4)),
        *sides(tube('horn_back', 'head', (y1 + 3.25, z1 + 0.25), (y1 + 4.5, z1 + 3.75), 1.25, 1.25, goat_horn, x=-1.9)),
        *sides(box('ear', 'ears', (-4.5, y1 - 2.5, z1 - 2), (-2, y1 - 1.25, z1 - 1), fur(GOAT), (0, 0, 22))),
        box('tail', 'tail', (-1, 14.5, 6.25), (1, 17.5, 7.5), fur(GOAT)),
    ]


GOAT_M = beast(
    'goat', 'Goat', torso=[(-6.5, -2, 7.5, 7, 15.5), (-2, 3, 8, 6.5, 15), (3, 6.5, 7, 7.5, 15.5)], leg=7, hide=fur(GOAT, '#cfc8ba'),
    limbs=dict(w=2, x=2.75, hx=2.75, fz=-4.75, hz=4.75, knee=3.75, upper=(3, 2.5, 3), hind=(3, 3, 4), hock=0.5,
               paint=(fur(GOAT), legs_paint(['#9c958a', '#b0a99e'], '#3a3530', 1))),
    neck=dict(at=(13.5, -5.5), to=(19, -8.5), w=3.5, h=4),
    head=dict(size=(4.5, 5, 5), pitch=-15, paint=skull(GOAT, row=1, north=lambda p: p.row(0, '#b8b0a2')),
              muzzle=dict(size=(3, 3, 2.5), paint=nose([GOAT[1], '#c4bcae'], '#8a8276', mouth='#b0a898'))),
    tail=(15, 6.5), features=goat_features, rest={'tail': (25, 0, 0)},
)

# --------------------------------------------------------------------------
# Sheep: wool in lumps over a dark face and dark legs.

def sheep_features(H, B):
    y1, z1 = H['y1'], H['z1']
    return [
        box('fleece_top', 'body', (-4.5, 16, -5.5), (4.5, 17.5, 5.5), wool),
        box('fleece_l', 'body', (-6.25, 8.5, -5), (-5.5, 14.5, 5), wool),
        box('fleece_r', 'body', (5.5, 8.5, -5), (6.25, 14.5, 5), wool),
        box('wool_cap', 'head', (-2.75, y1 - 0.5, z1 - 3.5), (2.75, y1 + 1.5, z1 + 0.5), wool),
        *sides(box('ear', 'ears', (-5, y1 - 2.5, z1 - 2.5), (-2.25, y1 - 1.25, z1 - 1.25), fur(SHEEP_FACE), (0, 0, 16))),
        box('tail', 'tail', (-1, 11, 8.5), (1, 14.5, 10), wool),
    ]


SHEEP = beast(
    'sheep', 'Sheep', torso=[(-8.5, -7, 9, 8, 16.5), (-7, 7, 11, 6.5, 16), (7, 8.5, 9, 7.5, 15.5)], leg=6, hide=wool,
    limbs=dict(w=2.25, x=3.5, fz=-5, hz=5, knee=4, upper=(3.5, 1, 3.5), hind=(3.5, 1, 3.5),
               paint=(wool, legs_paint(SHEEP_FACE, '#2f2824', 1))),
    neck=dict(at=(14, -7.5), to=(16, -10), w=5.5, h=5.5, grow=1),
    head=dict(size=(4.5, 5, 5), pitch=-10, paint=skull(SHEEP_FACE, row=1),
              muzzle=dict(size=(3.5, 3, 2), paint=nose(SHEEP_FACE, '#3a302a', mouth='#3a302a'))),
    tail=(14.5, 8.5), features=sheep_features,
)

# --------------------------------------------------------------------------
# Pig: a barrel, a flat snout, ears that flop forward, a curl of a tail.

def pig_features(H, B):
    y1, z1 = H['y1'], H['z1']
    pk = fur(PIG)
    return [
        *sides(box('ear', 'ears', (-3.75, y1 - 1, z1 - 3.5), (-1.25, y1 + 1.75, z1 - 2.5), fur(['#dea49a', '#d4968c']), (-32, 0, 14))),
        *sides(box('jowl', 'head', (-3.75, H['y0'] - 0.5, H['z0'] + 1), (-1, H['y0'] + 1.5, H['z1'] - 0.5), pk)),
        box('tail', 'tail', (-0.5, 10, 7), (0.5, 11, 8.5), pk),
        box('tail_curl', 'tail', (-0.5, 11, 8), (0.5, 12.5, 9), pk),
        box('tail_tip', 'tail', (0.5, 11.75, 7.5), (1.5, 12.75, 8.5), pk),
    ]


PIG_M = beast(
    'pig', 'Pig', torso=[(-7, -2.5, 9, 4.5, 12.5), (-2.5, 3.5, 10, 4, 13), (3.5, 7, 9, 4.5, 12.5)], leg=4, hide=fur(PIG, '#f2c4bc'),
    limbs=dict(w=2.5, x=3.25, hx=3.5, fz=-4.75, hz=4.75, knee=2.5, upper=(3.5, 2, 3.5), hind=(3.5, 3, 4.5),
               paint=(fur(PIG), legs_paint(PIG, '#c98a80', 1))),
    head=dict(at=(9, -7), size=(7, 6.5, 5), back=0.2, pitch=-8, paint=skull(PIG, row=2),
              muzzle=dict(size=(4, 3, 2), lift=1, paint=pig_snout)),
    tail=(11, 7), features=pig_features,
)

# --------------------------------------------------------------------------
# Chicken: a round breast, a neck that bobs, wings that flap, a fan of a tail.

ORANGE = '#e0a64a'


def hen_foot(bname, x, z):
    return [box(bname + '_foot', bname, (x - 1.25, 0, z - 2), (x + 1.25, 0.5, z + 0.75), {'all': ORANGE, 'down': '#c98a2a'})]


def hen_features(H, B):
    y1 = H['y1']
    return [
        box('comb', 'head', (-0.5, y1, H['z0'] + 0.25), (0.5, y1 + 1.5, H['z1'] - 0.5), '#d23a2a'),
        box('comb_front', 'head', (-0.5, y1, H['z0'] - 0.5), (0.5, y1 + 0.75, H['z0'] + 0.25), '#d23a2a'),
        box('wattle', 'head', (-0.5, H['y0'] - 1.25, H['z0'] - 0.5), (0.5, H['y0'] + 0.5, H['z0'] + 0.5), '#d23a2a'),
        box('wing_l', 'wing_l', (-3.25, 3.75, -2.5), (-2.5, 7, 2), hen_wing),
        box('wing_r', 'wing_r', (2.5, 3.75, -2.5), (3.25, 7, 2), hen_wing),
        tube('tail', 'tail', (6.5, 2.5), (9.75, 4.5), 3, 1.5, fur(HEN)),
        tube('tail_low', 'tail', (5.5, 2.5), (7.5, 5), 2, 1, fur(['#e8e2d6', '#ddd6c8'])),
    ]


CHICKEN = beast(
    'chicken', 'Chicken', torso=[(-4, -3, 3.5, 3.5, 7), (-3, 2, 5, 3, 7.5), (2, 3, 4, 4, 7.5)], leg=3, hide=fur(HEN),
    limbs=dict(two=True, w=0.75, x=1.25, z=0, knee=2, upper=(1.75, 0.5, 1.75), foot=hen_foot, paint=(fur(HEN), solid(ORANGE))),
    neck=dict(at=(6.5, -2.5), to=(9.5, -3.5), w=2.5, h=2.5, grow=1.5),
    head=dict(size=(3, 3, 3), back=0.4, up=0.4, paint=skull(HEN, row=1, size=1, glint=None),
              muzzle=dict(size=(1.5, 1, 1.5), lift=1, paint={'all': ORANGE, 'down': '#c98a2a'})),
    tail=(7, 2.5), features=hen_features,
    bones=lambda H, B: [('wing_l', 'body', (-2.5, 7, -1.5)), ('wing_r', 'body', (2.5, 7, -1.5))],
)

# --------------------------------------------------------------------------
# Horse: withers and a croup, an arched neck with a mane, a long head.

def horse_head(p, face):
    if face == 'north':
        p.rect(p.w // 2 - 1, 0, 2, p.h, C['paper'])
    elif face == 'up':
        p.rect(p.w // 2 - 1, 0, 2, p.h, C['paper'])


def horse_muzzle(p, face):
    p.grain(['#7a4e2e', '#84553a'])
    if face == 'north':
        p.fill('#4a3020').set(1, 1, C['ink']).set(p.w - 2, 1, C['ink']).row(-1, '#3a2418')
    elif face == 'up':
        p.rect(p.w // 2 - 1, 0, 2, p.h, C['paper'])
    elif face in ('east', 'west'):
        p.rect(0 if face == 'west' else p.w - 2, 0, 2, p.h, '#4a3020')


def horse_features(H, B):
    y1, z1 = H['y1'], H['z1']
    return [
        tube('mane', 'neck', (24.25, -7), (36.5, -14), 1.5, 2.5, fur(MANE), grow=1),
        box('forelock', 'head', (-1, y1 - 0.5, H['z0'] + 1.5), (1, y1 + 1, z1), fur(MANE)),
        *sides(box('ear', 'ears', (-2.5, y1 - 0.5, z1 - 2), (-1, y1 + 2.5, z1 - 1), fur(HORSE), (0, 0, 8))),
        tube('dock', 'tail', (25, 12), (22.5, 14.5), 2.5, 2.5, fur(MANE), grow=1),
        box('tail_fall', 'tail', (-1.5, 9.5, 13.5), (1.5, 22.5, 16), fur(MANE)),
    ]


HORSE_M = beast(
    'horse', 'Horse', torso=[(-12, -5, 10, 14, 26.5), (-5, 4, 9.5, 14.5, 25.5), (4, 12, 10.5, 15, 26.5)], leg=14, hide=fur(HORSE, '#7a4e2e'),
    limbs=dict(w=3, x=3.5, fz=-9.5, hz=9, knee=7.5, upper=(4, 3, 4.5), hind=(4.5, 5, 6.5), hock=1,
               paint=(fur(HORSE), legs_paint(['#4a3020', '#5a3a28'], '#1e1610', 2, band=C['paper']))),
    neck=dict(at=(22.5, -10), to=(35, -17), w=4.5, h=6.5, grow=3, paint=fur(HORSE)),
    head=dict(size=(5.5, 6, 6), back=0.35, up=0.55, pitch=-38, paint=skull(['#7a4e2e', '#84553a'], row=1, extra=horse_head),
              muzzle=dict(size=(4.5, 4.5, 5.5), paint=horse_muzzle)),
    tail=(25, 12), features=horse_features,
)

from dinos import RAPTOR, TRIKE, LONGNECK  # noqa: E402
ANIMALS = [DEER_M, RABBIT, BOAR_M, GOAT_M, SHEEP, PIG_M, CHICKEN, HORSE_M, RAPTOR, TRIKE, LONGNECK]
CREATURES = []
