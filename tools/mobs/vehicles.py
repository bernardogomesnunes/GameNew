"""
The vehicles and siege engines: the horse cart, the flying machine, the
Helix, the steam engine and its rail car, the Future's flying car and
maglev tram, and the Stone Kingdom's battering ram and catapult.

Sizes follow the game (docs/wiki/vehicles.md: a train part is 8 blocks long,
3 wide, 4 high) and colours follow their views in src/render/, warmed toward
the game's palette. Wheels and rotors are bones, so they turn in the cycle.
"""
from lib import *


def sh(hexc, f):
    r, g, b = (int(hexc[i:i + 2], 16) for i in (1, 3, 5))
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(v * f))) for v in (r, g, b))


def planks(col, seam=None, every=4, vertical=False):
    def f(p, face):
        p.grain([col, sh(col, 0.92), sh(col, 1.06)])
        s = seam or sh(col, 0.72)
        if vertical:
            for x in range(every - 1, p.w, every):
                p.col(x, s)
        else:
            for y in range(every - 1, p.h, every):
                p.row(y, s)
            for y in range(0, p.h, every):
                p.set((y * 7) % max(1, p.w), y, s)
    return f


def metal(col, rivet=None, edge=None):
    def f(p, face):
        p.grain([col, sh(col, 0.92), sh(col, 1.08)])
        if edge:
            p.border(edge)
        if rivet and face not in ('up', 'down'):
            for x in range(1, p.w, 4):
                p.set(x, 1, rivet).set(x, p.h - 2, rivet)
    return f


def wheel_paint(rim, hub, spoke):
    def f(p, face):
        if face in ('east', 'west'):
            p.fill(rim).border(sh(rim, 0.7))
            c = p.w // 2
            p.rect(1, c - 1 if p.h > 6 else c, p.w - 2, 1, spoke).rect(c, 1, 1, p.h - 2, spoke)
            p.rect(c - 1, c - 1, 2, 2, hub)
        else:
            p.grain([sh(rim, 0.8), rim])
    return f


def wheel(name, bone, x, y, z, d, w, paint):
    return box(name, bone, (x - w / 2, y - d / 2, z - d / 2), (x + w / 2, y + d / 2, z + d / 2), paint)


def window(frame, glass, lamp=None):
    def f(p, face):
        p.fill(frame)
        if face in ('east', 'west', 'north', 'south'):
            p.rect(1, 1, p.w - 2, p.h - 2, glass)
            p.set(1, 1, sh(glass, 1.25))
            if lamp:
                p.set(p.w - 2, p.h - 2, lamp)
    return f


# --------------------------------------------------------------------------
# Horse cart.

WOOD, WOOD_D = '#8a6440', '#5e4129'
cart_wheel = wheel_paint(WOOD_D, C['iron'], WOOD)
CART = dict(
    id='cart', name='Horse cart',
    bones=[('body', None, (0, 12, 0)), ('wheel_l', 'body', (-14, 8, 4)), ('wheel_r', 'body', (14, 8, 4))],
    cubes=[
        box('bed', 'body', (-11, 9, -12), (11, 11, 18), planks(WOOD, vertical=True)),
        box('side_l', 'body', (-12, 9, -12), (-11, 16, 18), planks(WOOD)),
        box('side_r', 'body', (11, 9, -12), (12, 16, 18), planks(WOOD)),
        box('back', 'body', (-11, 11, 17), (11, 15, 18), planks(WOOD)),
        box('front', 'body', (-11, 11, -12), (11, 17, -11), planks(WOOD)),
        box('seat', 'body', (-9, 15, -11), (9, 17, -6), planks(WOOD_D)),
        box('axle', 'body', (-14, 7, 3), (14, 9, 5), C['iron']),
        box('shaft_l', 'body', (-8, 9, -36), (-6.5, 10.5, -11), planks(WOOD_D)),
        box('shaft_r', 'body', (6.5, 9, -36), (8, 10.5, -11), planks(WOOD_D)),
        box('lantern', 'body', (10, 17, -12), (12, 20, -10), {'all': lambda p, f: p.fill(G['lamp']).border(C['goldDark'])}),
        box('sack', 'body', (-8, 11, 6), (0, 17, 14), {'all': lambda p, f: p.grain([C['paper2'], C['paper3']]).row(0, '#8a6a4a')}),
        box('crate', 'body', (1, 11, 8), (9, 18, 16), planks('#a8743f')),
        wheel('wheel_l', 'wheel_l', -14, 8, 4, 16, 2, cart_wheel),
        wheel('wheel_r', 'wheel_r', 14, 8, 4, 16, 2, cart_wheel),
    ],
    anim={'wheel_l': spin(0), 'wheel_r': spin(0)},
)

# --------------------------------------------------------------------------
# The flying machine: da Vinci's wooden keel and ribbed canvas wings.

CANVAS = '#efe6d2'


def canvas(p, face):
    p.grain([CANVAS, '#e6dcc4'])
    if face in ('up', 'down'):
        for x in range(0, p.w, 6):
            p.col(x, '#8a6440')
        p.row(0, '#5e4129')
        for x in range(3, p.w, 12):
            p.set(x, p.h // 2, G['tealMid'])
    else:
        p.fill('#8a6440')


GLIDER = dict(
    id='glider', name='Flying machine',
    bones=[('body', None, (0, 30, 0)), ('wing_l', 'body', (-3, 32, -2)), ('wing_r', 'body', (3, 32, -2))],
    cubes=[
        box('keel', 'body', (-1.5, 30, -18), (1.5, 33, 22), planks(WOOD, every=6, vertical=True)),
        box('mast', 'body', (-1, 24, -3), (1, 30, -1), planks(WOOD_D)),
        box('harness', 'body', (-4, 22, -4), (4, 24, 2), planks(WOOD_D)),
        box('wing_l', 'wing_l', (-46, 32, -10), (-3, 33, 8), canvas),
        box('spar_l', 'wing_l', (-46, 33, -10), (-3, 34, -8), planks(WOOD_D)),
        box('wing_r', 'wing_r', (3, 32, -10), (46, 33, 8), canvas),
        box('spar_r', 'wing_r', (3, 33, -10), (46, 34, -8), planks(WOOD_D)),
        box('tail', 'body', (-10, 31, 22), (10, 32, 32), canvas),
        box('fin', 'body', (-0.5, 32, 24), (0.5, 40, 32), {'all': lambda p, f: p.grain([CANVAS, '#e6dcc4']).border('#8a6440')}),
        box('prow', 'body', (-2, 29, -22), (2, 33, -18), {'all': lambda p, f: p.grain([C['gold'], C['goldDark']]).set(1, 1, G['gold'])}),
    ],
    anim={'wing_l': [(1, (0, 0, -8)), (13, (0, 0, 8)), (25, (0, 0, -8))],
          'wing_r': [(1, (0, 0, 8)), (13, (0, 0, -8)), (25, (0, 0, 8))]},
)

# --------------------------------------------------------------------------
# The Helix: a red blocky helicopter.

RED, RED_D, DARK, TRIM, GLASS = '#c8402e', '#9a2f22', '#2e3036', '#e8e2d4', '#9fd3e8'


def helix_body(p, face):
    p.grain([RED, sh(RED, 0.94), sh(RED, 1.06)])
    p.row(-1, RED_D).row(-2, TRIM)
    if face in ('east', 'west'):
        p.rect(3, 3, p.w - 12, p.h - 10, GLASS).border(RED_D, '')
        p.rect(3, 3, p.w - 12, 1, sh(GLASS, 1.2))
        p.rect(p.w - 7, 4, 4, p.h - 9, RED_D)                 # the door
        p.set(p.w - 4, p.h // 2, C['gold'])
    elif face == 'north':
        p.rect(2, 2, p.w - 4, p.h - 9, GLASS)
        p.rect(2, 2, p.w - 4, 1, sh(GLASS, 1.2))
        p.set(2, p.h - 4, G['lamp']).set(p.w - 3, p.h - 4, G['lamp'])
    elif face == 'up':
        p.border(RED_D)


def blade(p, face):
    p.grain([DARK, '#3a3c44'])
    p.row(0, TRIM)


HELIX = dict(
    id='helix', name='The Helix',
    bones=[('body', None, (0, 12, 0)), ('rotor', 'body', (0, 30, 0)), ('tail_rotor', 'body', (3, 18, 46))],
    cubes=[
        box('cabin', 'body', (-11, 4, -14), (11, 26, 14), helix_body),
        box('nose', 'body', (-9, 6, -18), (9, 16, -14), {'all': helix_body}),
        box('boom', 'body', (-2.5, 14, 14), (2.5, 19, 44), metal(RED, C['gold'])),
        box('fin', 'body', (-1, 19, 38), (1, 30, 46), {'all': lambda p, f: p.grain([RED, RED_D]).row(0, TRIM).set(p.w // 2, 1, G['red'])}),
        box('stab', 'body', (-7, 15, 40), (7, 16, 45), metal(RED_D)),
        box('skid_l', 'body', (-12, 0, -16), (-10, 2, 16), metal(DARK)),
        box('skid_r', 'body', (10, 0, -16), (12, 2, 16), metal(DARK)),
        box('strut_lf', 'body', (-11.5, 2, -8), (-10, 4, -6), DARK),
        box('strut_lb', 'body', (-11.5, 2, 6), (-10, 4, 8), DARK),
        box('strut_rf', 'body', (10, 2, -8), (11.5, 4, -6), DARK),
        box('strut_rb', 'body', (10, 2, 6), (11.5, 4, 8), DARK),
        box('mast', 'body', (-2, 26, -2), (2, 30, 2), metal(DARK)),
        box('hub', 'rotor', (-3, 30, -3), (3, 32, 3), {'all': lambda p, f: p.grain([C['gold'], C['goldDark']])}),
        box('blade_a', 'rotor', (-44, 30.5, -2), (44, 31.5, 2), blade),
        box('blade_b', 'rotor', (-2, 30.5, -44), (2, 31.5, 44), blade),
        box('tail_blade', 'tail_rotor', (2.5, 12, 45), (3.5, 24, 47), blade),
        box('beacon', 'body', (-1, 29.5, 8), (1, 31, 10), G['red']),
    ],
    anim={'rotor': spin(1, turns=2), 'tail_rotor': spin(0, turns=3)},
)

# --------------------------------------------------------------------------
# The steam engine and a rail car. 8 blocks long, 3 wide, 4 high.

IRON, BOILER, BRASS, WHEEL = '#2e3036', '#2f5a44', '#c9a55a', '#3a3a3e'
COACH, COACH_T, ROOF = '#7a5236', '#5a3b28', '#4a4d55'


def boiler(p, face):
    p.grain([BOILER, sh(BOILER, 0.92), sh(BOILER, 1.08)])
    if face in ('east', 'west', 'up'):
        n = p.w if face != 'up' else p.h
        for i in range(10, n, 18):
            if face == 'up':
                p.row(i, BRASS).row(i + 1, sh(BRASS, 0.8))
            else:
                p.col(i, BRASS).col(i + 1, sh(BRASS, 0.8))
    if face in ('east', 'west'):
        p.row(-1, sh(BOILER, 0.7))


def smokebox(p, face):
    p.grain([IRON, '#383a42'])
    if face == 'north':
        p.border(BRASS)
        c = p.w // 2
        p.rect(c - 3, 2, 6, 6, G['lamp']).border(BRASS, '')
        p.rect(c - 2, 3, 4, 4, '#fff8d8')
        p.rect(c - 4, p.h - 6, 8, 2, BRASS)
        p.stamp(['.#.', '###', '.#.'], {'#': G['tealMid']}, None, p.h - 12)


def cab(p, face):
    p.grain([BOILER, sh(BOILER, 0.92)])
    p.row(-1, sh(BOILER, 0.7))
    if face in ('east', 'west'):
        p.rect(6, 5, p.w - 12, 14, IRON).rect(7, 6, p.w - 14, 12, '#2a3440')
        p.rect(7, 6, p.w - 14, 1, '#3a5468')
        p.set(8, 16, G['lamp'])
        p.row(0, BRASS)
        p.stamp(['#.#', '.#.', '#.#'], {'#': BRASS}, None, p.h - 12)
    elif face == 'north':
        for x0 in (5, p.w - 17):
            p.rect(x0, 5, 12, 10, IRON).rect(x0 + 1, 6, 10, 8, '#2a3440')
        p.row(0, BRASS)
    elif face == 'south':
        p.rect(p.w // 2 - 7, 4, 14, p.h - 4, IRON)


wheel_i = wheel_paint(WHEEL, BRASS, '#55565c')
ENGINE_WHEELS = []
for side, x in (('l', -22), ('r', 22)):
    for i, z in enumerate((-40, -16, 8, 34)):
        d = 18 if i in (1, 2) else 14
        ENGINE_WHEELS.append(wheel(f'wheel_{side}{i}', f'wheels_{side}', x, d / 2, z, d, 4, wheel_i))

ENGINE = dict(
    id='train_engine', name='Steam engine',
    bones=[('body', None, (0, 30, 0)), ('wheels_l', 'body', (-22, 8, 0)), ('wheels_r', 'body', (22, 8, 0))],
    cubes=[
        box('frame', 'body', (-24, 12, -64), (24, 20, 64), metal(IRON, BRASS)),
        box('buffer_beam', 'body', (-24, 10, -66), (24, 18, -64), {'all': lambda p, f: p.grain(['#9a2a22', '#8a2620']).row(0, BRASS)}),
        box('buffer_l', 'body', (-18, 12, -69), (-12, 16, -66), metal(BRASS)),
        box('buffer_r', 'body', (12, 12, -69), (18, 16, -66), metal(BRASS)),
        box('cowcatcher', 'body', (-20, 2, -70), (20, 12, -64), {'all': lambda p, f: p.grain(['#9a2a22', '#7a2018']).col(0, IRON) if True else None}),
        box('boiler', 'body', (-16, 20, -58), (16, 48, 16), boiler),
        box('boiler_top', 'body', (-12, 48, -56), (12, 52, 14), boiler),
        box('smokebox', 'body', (-17, 19, -62), (17, 49, -56), smokebox),
        box('chimney', 'body', (-5, 52, -54), (5, 66, -44), {'all': lambda p, f: p.grain([IRON, '#383a42']).row(0, BRASS).row(1, sh(BRASS, 0.8))}),
        box('dome', 'body', (-5, 52, -24), (5, 58, -14), metal(BRASS)),
        box('whistle', 'body', (-1.5, 58, -20), (1.5, 62, -17), {'all': lambda p, f: p.grain([BRASS]).row(0, G['gold'])}),
        box('cab', 'body', (-24, 20, 16), (24, 58, 56), cab),
        box('cab_roof', 'body', (-26, 58, 14), (26, 62, 58), metal(IRON, None, BRASS)),
        box('coal', 'body', (-20, 20, 56), (20, 30, 64), {'all': lambda p, f: p.grain(['#1e1e22', '#2a2a30', '#3a3a40'])}),
        box('rod_l', 'wheels_l', (-25, 7, -42), (-24, 9, 36), metal(BRASS)),
        box('rod_r', 'wheels_r', (24, 7, -42), (25, 9, 36), metal(BRASS)),
    ] + ENGINE_WHEELS,
    anim={'wheels_l': [(1, (0, 0, 0)), (13, (0, 0, 0)), (25, (0, 0, 0))]},
)


def coach_side(p, face):
    p.grain([COACH, sh(COACH, 0.92), sh(COACH, 1.06)])
    p.row(0, COACH_T).row(-1, COACH_T).row(-2, BRASS)
    if face in ('east', 'west'):
        for i, x in enumerate(range(6, p.w - 12, 16)):
            p.rect(x, 6, 10, 12, COACH_T).rect(x + 1, 7, 8, 10, '#2a3440')
            p.rect(x + 1, 7, 8, 1, '#3a5468')
            p.rect(x + 1, 16, 8, 1, G['lamp'] if i % 2 == 0 else '#4a5a68')   # a lit lamp in every other window
        p.rect(0, 2, 4, p.h - 4, COACH_T)
        p.rect(p.w - 4, 2, 4, p.h - 4, COACH_T)
    elif face in ('north', 'south'):
        p.rect(p.w // 2 - 6, 4, 12, p.h - 6, COACH_T).rect(p.w // 2 - 4, 6, 8, 10, '#2a3440')


car_wheel = wheel_paint(WHEEL, BRASS, '#55565c')
CAR_WHEELS = [wheel(f'wheel_{s}{i}', f'wheels_{s}', x, 7, z, 14, 4, car_wheel)
              for s, x in (('l', -22), ('r', 22)) for i, z in enumerate((-48, -32, 32, 48))]
RAILCAR = dict(
    id='rail_car', name='Rail car',
    bones=[('body', None, (0, 30, 0)), ('wheels_l', 'body', (-22, 7, 0)), ('wheels_r', 'body', (22, 7, 0))],
    cubes=[
        box('frame', 'body', (-23, 11, -62), (23, 17, 62), metal(IRON, BRASS)),
        box('coach', 'body', (-23, 17, -60), (23, 54, 60), coach_side),
        box('roof', 'body', (-25, 54, -62), (25, 58, 62), metal(ROOF, None, sh(ROOF, 0.8))),
        box('roof_ridge', 'body', (-16, 58, -58), (16, 61, 58), metal(ROOF)),
        box('vent', 'body', (-3, 61, -10), (3, 64, 10), {'all': lambda p, f: p.grain([ROOF]).row(0, G['tealMid'])}),
        box('step_l', 'body', (-25, 12, -58), (-23, 14, 58), metal(IRON)),
        box('step_r', 'body', (23, 12, -58), (25, 14, 58), metal(IRON)),
    ] + CAR_WHEELS,
)

# --------------------------------------------------------------------------
# The Future: a flying car and a maglev tram.

FW, FD, FCY = '#eef2f6', '#2b2f38', '#3fe6ff'


def future_body(col):
    def f(p, face):
        p.grain([col, sh(col, 0.95)])
        if face in ('east', 'west'):
            p.row(p.h // 2, G['teal'])
            p.row(-1, FD)
        elif face == 'north':
            p.rect(1, p.h // 2 - 1, 3, 2, C['white']).rect(p.w - 4, p.h // 2 - 1, 3, 2, C['white'])
            p.set(1, p.h // 2 - 1, G['lamp']).set(p.w - 2, p.h // 2 - 1, G['lamp'])
            p.row(-1, FD)
        elif face == 'south':
            p.rect(1, p.h // 2 - 1, 4, 2, G['red']).rect(p.w - 5, p.h // 2 - 1, 4, 2, G['red'])
        elif face == 'down':
            p.fill(FD)
    return f


def canopy(p, face):
    p.grain(['#9fe8ff', '#8fd8f0'])
    if face != 'down':
        p.row(0, sh('#9fe8ff', 1.1)).col(0, '#bff2ff')


def hover(p, face):
    p.fill(FD)
    if face == 'down':
        p.rect(1, 1, p.w - 2, p.h - 2, G['teal'])


FLYCAR = dict(
    id='flying_car', name='Flying car',
    bones=[('body', None, (0, 12, 0))],
    cubes=[
        box('hull', 'body', (-12, 6, -22), (12, 14, 22), future_body('#ffd166')),
        box('nose', 'body', (-10, 6, -26), (10, 11, -22), future_body('#ffd166')),
        box('canopy', 'body', (-9, 14, -10), (9, 21, 10), canopy),
        box('spoiler', 'body', (-11, 14, 18), (11, 16, 23), {'all': lambda p, f: p.grain([FD]).row(0, G['tealMid'])}),
        box('pod_lf', 'body', (-15, 4, -18), (-11, 8, -8), hover),
        box('pod_rf', 'body', (11, 4, -18), (15, 8, -8), hover),
        box('pod_lb', 'body', (-15, 4, 8), (-11, 8, 18), hover),
        box('pod_rb', 'body', (11, 4, 8), (15, 8, 18), hover),
    ],
    anim={'body': [(1, (0, 0, 0)), (13, (2, 0, 0)), (25, (0, 0, 0))]},
)


def tram_body(p, face):
    p.grain([FW, '#e2e8ee'])
    p.row(-1, FD).row(-2, FD)
    if face in ('east', 'west'):
        p.rect(4, 8, p.w - 8, 14, '#2b3a48')
        for x in range(4, p.w - 4, 12):
            p.col(x, FW)
        p.rect(4, 8, p.w - 8, 1, '#9fe8ff')
        p.row(25, G['teal']).row(26, FCY)
        for x in range(8, p.w - 8, 24):
            p.rect(x, 9, 2, 1, G['lamp'])
    elif face == 'north' or face == 'south':
        p.rect(4, 6, p.w - 8, 16, '#2b3a48').rect(4, 6, p.w - 8, 1, '#9fe8ff')
        p.rect(4, p.h - 8, 6, 3, G['lamp'] if face == 'north' else G['red'])
        p.rect(p.w - 10, p.h - 8, 6, 3, G['lamp'] if face == 'north' else G['red'])
        p.row(25, G['teal'])


TRAM = dict(
    id='tram', name='Maglev tram',
    bones=[('body', None, (0, 24, 0))],
    cubes=[
        box('car', 'body', (-20, 6, -64), (20, 44, 64), tram_body),
        box('roof', 'body', (-16, 44, -56), (16, 48, 56), {'all': lambda p, f: p.grain([FW, '#e2e8ee']).col(p.w // 2, G['tealMid']) if f == 'up' else p.grain([FW])}),
        box('skirt', 'body', (-18, 0, -60), (18, 6, 60), {'all': lambda p, f: p.grain([FD]).row(-1, G['teal'])}),
    ],
)

# --------------------------------------------------------------------------
# The Stone Kingdom's siege engines.

SW, SW_D = '#6a4a30', '#4a3220'
siege_wheel = wheel_paint(SW_D, C['iron'], SW)
RAM = dict(
    id='battering_ram', name='Battering ram',
    bones=[('body', None, (0, 20, 0)), ('log', 'body', (0, 30, 0))] +
          [(f'wheel_{s}{i}', 'body', (x, 7, z)) for s, x in (('l', -16), ('r', 16)) for i, z in enumerate((-20, 20))],
    cubes=[
        box('base', 'body', (-15, 8, -30), (15, 12, 30), planks(SW)),
        *[box(f'post{i}', 'body', (x, 12, z), (x + 3, 38, z + 3), planks(SW_D, vertical=True)) for i, (x, z) in enumerate(((-15, -28), (12, -28), (-15, 25), (12, 25)))],
        box('roof_l', 'body', (-18, 36, -32), (-1, 40, 32), {'all': lambda p, f: p.grain(['#5a5850', '#4a4840']).row(0, '#3a3830')}, (0, 0, 22.5)),
        box('roof_r', 'body', (1, 36, -32), (18, 40, 32), {'all': lambda p, f: p.grain(['#5a5850', '#4a4840']).row(0, '#3a3830')}, (0, 0, -22.5)),
        box('chain_f', 'log', (-0.5, 26, -16), (0.5, 38, -15), C['iron']),
        box('chain_b', 'log', (-0.5, 26, 15), (0.5, 38, 16), C['iron']),
        box('ram', 'log', (-4, 22, -34), (4, 28, 26), planks('#7a5a3a', every=6, vertical=True)),
        box('ram_head', 'log', (-6, 20, -42), (6, 30, -34), {'all': lambda p, f: p.grain([C['iron'], C['iron3']]).border(C['iron2']), 'north': lambda p, f: p.grain([C['iron'], C['iron3']]).rect(2, 3, 2, 2, G['red']).rect(p.w - 4, 3, 2, 2, G['red'])}),
    ] + [wheel(f'wheel_{s}{i}', f'wheel_{s}{i}', x, 7, z, 14, 3, siege_wheel) for s, x in (('l', -16), ('r', 16)) for i, z in enumerate((-20, 20))],
    anim={'log': [(1, (0, 0, 0)), (7, (0, 0, 0)), (13, (-6, 0, 0)), (19, (4, 0, 0)), (25, (0, 0, 0))]},
)

CATAPULT = dict(
    id='catapult', name='Siege catapult',
    bones=[('body', None, (0, 16, 0)), ('arm', 'body', (0, 22, 6))] +
          [(f'wheel_{s}{i}', 'body', (x, 7, z)) for s, x in (('l', -17), ('r', 17)) for i, z in enumerate((-18, 18))],
    cubes=[
        box('rail_l', 'body', (-15, 8, -26), (-11, 13, 26), planks(SW)),
        box('rail_r', 'body', (11, 8, -26), (15, 13, 26), planks(SW)),
        box('cross_f', 'body', (-11, 9, -24), (11, 12, -20), planks(SW_D)),
        box('cross_b', 'body', (-11, 9, 20), (11, 12, 24), planks(SW_D)),
        box('upright_l', 'body', (-13, 13, 2), (-10, 30, 6), planks(SW_D, vertical=True)),
        box('upright_r', 'body', (10, 13, 2), (13, 30, 6), planks(SW_D, vertical=True)),
        box('stop', 'body', (-10, 27, 2), (10, 30, 5), {'all': lambda p, f: p.grain([SW, SW_D]).row(0, C['iron'])}),
        box('pivot', 'body', (-13, 20, 4), (13, 24, 8), C['iron']),
        box('arm', 'arm', (-2, 20, -30), (2, 24, 8), planks('#7a5a3a', every=6, vertical=True), (-20, 0, 0)),
        box('bucket', 'arm', (-5, 28, -38), (5, 34, -28), {'all': planks(SW_D), 'up': lambda p, f: p.grain([SW_D]).rect(2, 2, p.w - 4, p.h - 4, '#6a6a70').set(4, 4, G['red'])}, (-20, 0, 0)),
        box('weight', 'arm', (-7, 10, 4), (7, 20, 14), {'all': lambda p, f: p.grain([C['iron'], C['iron3']]).border(C['iron2'])}),
    ] + [wheel(f'wheel_{s}{i}', f'wheel_{s}{i}', x, 7, z, 14, 3, siege_wheel) for s, x in (('l', -17), ('r', 17)) for i, z in enumerate((-18, 18))],
    anim={'arm': [(1, (0, 0, 0)), (6, (0, 0, 0)), (9, (70, 0, 0)), (20, (0, 0, 0)), (25, (0, 0, 0))]},
)

VEHICLES = [CART, GLIDER, HELIX, ENGINE, RAILCAR, FLYCAR, TRAM, RAM, CATAPULT]


# The Future's traffic comes in the colours of its view (FutureView's CAR_COLOURS).
def _car(i, colour):
    car = dict(FLYCAR, id=f'flying_car_{i}', name=f'Flying car {i + 1}')
    car['cubes'] = [box(c[0], c[1], c[2], c[3], {'all': future_body(colour)}) if c[0] in ('hull', 'nose') else c for c in FLYCAR['cubes']]
    return car


VEHICLES += [_car(i, col) for i, col in enumerate(['#e8ecf0', '#ff4fb8', '#3fe6ff', '#9b7bff', '#2b2f38'], start=1)]
