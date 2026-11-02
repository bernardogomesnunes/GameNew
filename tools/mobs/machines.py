"""
CRAFT3D close-ups: the parts drawn on a machine block when you use it.

Coordinates are in the close-up's own frame (one pixel = 1/16 block, y up,
origin at the middle of the block's top), and each view dresses its model
with no turn, so +x here is +x in the game. Owner, 2 November: "3d looks
awful" about plain coloured boxes; these are the same pixel-textured boxes
as the villagers and animals.

- crucible_hearth: firebrick hearth with glowing coals, the ingot and the coin
  mould to its right, tongs in front. Static.
- crucible_pot: the clay crucible, its molten top glowing. Origin = the pivot
  it tilts about (its bottom right edge), so the view turns it whole.
- carpentry_plank: the plank on the counter, grain along its length, end
  grain and pencil marks.
- carpentry_saw: a panel saw, steel blade with teeth, wooden handle.
"""
from lib import *


def sh(hexc, f):
    r, g, b = (int(hexc[i:i + 2], 16) for i in (1, 3, 5))
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(v * f))) for v in (r, g, b))


BRICK, BRICK_D, MORTAR = '#9a4e36', '#7a3a28', '#5e2e22'
CLAY, CLAY_D, CLAY_L = '#8a5a44', '#5e3a2c', '#a8705a'
COAL, COAL_D = '#2a2224', '#171315'
OAK, OAK_D, OAK_L = '#b07a44', '#7e5229', '#c99559'


def bricks(p, face):
    p.fill(BRICK)
    for y in range(p.h):
        if y % 2 == 1:
            p.row(y, MORTAR)
            continue
        off = 0 if (y // 2) % 2 == 0 else 2
        for x in range(off, p.w, 4):
            p.set(x, y, MORTAR)
        for x in range(p.w):
            if hash_(x, y, p.seed) > 0.8:
                p.set(x, y, BRICK_D)


def hash_(x, y, s):
    import math
    v = math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453
    return v - math.floor(v)


def coals(p, face):
    p.grain([COAL, COAL_D, '#3a2e30'])
    if face == 'up':
        for y in range(p.h):
            for x in range(p.w):
                r = hash_(x, y, p.seed + 3)
                if r > 0.72:
                    p.set(x, y, G['red'])
                elif r > 0.6:
                    p.set(x, y, G['gold'])


def clay_pot(p, face):
    p.grain([CLAY, sh(CLAY, 0.9), CLAY_L])
    if face not in ('up', 'down'):
        p.row(-1, COAL)              # soot from the fire
        if face == 'south' and p.h > 3:
            p.set(1, p.h - 2, G['red'])  # a hot crack
        p.row(0, CLAY_L)


def molten_top(p, face):
    if face != 'up':
        return clay_pot(p, face)
    p.fill(CLAY_L)
    p.rect(1, 1, p.w - 2, p.h - 2, G['gold'])
    for y in range(1, p.h - 1):
        for x in range(1, p.w - 1):
            if hash_(x, y, p.seed) > 0.7:
                p.set(x, y, G['red'])


def iron_mould(cavity_rows=None, coins=False):
    def f(p, face):
        p.grain([C['iron3'], C['iron'], '#5c5a66'])
        if face != 'up':
            p.row(0, '#6c6a76')
            return
        p.border('#6c6a76')
        if coins:
            for cy in range(1, p.h - 1, 2):
                for cx in range(1, p.w - 1, 2):
                    p.set(cx, cy, C['iron2'])
        else:
            p.rect(1, 1, p.w - 2, p.h - 2, C['iron2'])
            p.row(1, '#1e1c22')
    return f


def oak(p, face):
    p.grain([OAK, sh(OAK, 0.93), OAK_L])
    if face in ('east', 'west'):     # end grain: rings
        p.fill(OAK_L).border(OAK_D)
        p.set(p.w // 2, p.h // 2, OAK_D)
        return
    for y in range(0, p.h, 3):
        for x in range(p.w):
            if hash_(x, y, p.seed) > 0.55:
                p.set(x, y, OAK_D)
    if face == 'up':
        for x in (p.w // 4, p.w // 2, 3 * p.w // 4):
            p.col(x, '#5a3a22')      # pencil marks where it is cut


def blade(p, face):
    p.grain([C['steel'], C['steel2'], C['steel3']])
    if face in ('north', 'south'):
        p.row(-1, C['iron3'])
        for x in range(0, p.w, 2):
            p.set(x, p.h - 1, C['steel4'])   # the teeth
        p.row(0, C['steel4'])


def handle(p, face):
    p.grain([C['woodLight'], C['wood']])
    if face in ('north', 'south') and p.w > 2 and p.h > 2:
        p.rect(1, 1, p.w - 2, max(1, p.h - 3), C['woodDark'])   # the grip hole


CRUCIBLE_HEARTH = dict(
    id='crucible_hearth', name='Crucible hearth',
    bones=[('base', None, (0, 0, 0))],
    cubes=[
        box('hearth', 'base', (-10, 0, -6), (1, 1, 6), {'all': bricks}),
        box('coals', 'base', (-9, 1, -5), (0, 2, 5), {'all': coals}),
        box('wall_back', 'base', (-10, 1, -6), (1, 5, -5), {'all': bricks}),
        box('wall_left', 'base', (-10, 1, -5), (-9, 3, 5), {'all': bricks}),
        box('wall_front', 'base', (-10, 1, 5), (1, 2, 6), {'all': bricks}),
        box('wall_right', 'base', (0, 1, -5), (1, 2, 5), {'all': bricks}),
        box('ingot_mould', 'base', (3, 0, -5), (10, 2, -1), {'all': iron_mould()}),
        box('coin_mould', 'base', (3, 0, 1), (9, 1, 6), {'all': iron_mould(coins=True)}),
        box('tongs_a', 'base', (2, 0, 7), (11, 0.5, 7.5), C['iron']),
        box('tongs_b', 'base', (2, 0, 6.5), (6, 0.5, 7), C['iron3']),
    ],
)

CRUCIBLE_POT = dict(
    id='crucible_pot', name='Crucible pot',
    bones=[('pot', None, (0, 0, 0))],
    cubes=[
        box('foot', 'pot', (-5, 0, -2), (-2, 1, 2), {'all': clay_pot}),
        box('body', 'pot', (-6, 1, -2.5), (-1, 6, 2.5), {'all': clay_pot}),
        box('rim', 'pot', (-6.5, 6, -3), (-0.5, 7, 3), {'all': molten_top}),
        box('spout', 'pot', (-0.5, 5.5, -1), (1, 6.5, 1), {'all': clay_pot, 'up': lambda p, f: p.fill(CLAY_L).set(0, 0, G['gold']).set(0, 1, G['gold'])}),
    ],
)

CARPENTRY_PLANK = dict(
    id='carpentry_plank', name='Plank',
    bones=[('plank', None, (0, 0, 0))],
    cubes=[box('plank', 'plank', (-13, 0, -4), (13, 2, 4), {'all': oak})],
)

CARPENTRY_SAW = dict(
    id='carpentry_saw', name='Panel saw',
    bones=[('saw', None, (0, 0, 0))],
    cubes=[
        box('blade', 'saw', (-5, 0, -0.25), (4, 2.5, 0.25), {'all': blade}),
        box('handle', 'saw', (4, 0.5, -0.5), (7, 3, 0.5), {'all': handle}),
    ],
)

MACHINES = [CRUCIBLE_HEARTH, CRUCIBLE_POT, CARPENTRY_PLANK, CARPENTRY_SAW]
