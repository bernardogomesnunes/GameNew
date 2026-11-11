"""
Every animal in the game (src/config/mobs.js), plus the guardians and the
Warlord's beast, rebuilt as pixel-textured boxes.

Sizes follow mobs.js (blocks × 16). Ordinary animals keep their real colours;
the world's one touch of magic on them is a teal glint in each eye. The
creatures out of legend (the basilisk, the guardians, the war beast) glow.
"""
from lib import *

# --------------------------------------------------------------------------
# A four-legged (or two-legged) body, a head, legs, and whatever else.


def fur(cols, belly=None, bottom=None):
    def f(p, face):
        p.grain(cols)
        if face == 'down' and belly:
            p.grain([belly, cols[0]] if belly != cols[0] else [belly])
        elif face not in ('up', 'down') and bottom:
            p.row(-1, bottom)
    return f


def eyes(p, y, colour=None, glint=G['tealMid'], white=None, size=2):
    """Two eyes near the sides of a face, a glint in each."""
    colour = colour or C['ink']
    if p.w < 5:
        p.set(0, y, colour).set(p.w - 1, y, colour)
        return p
    for ex in (1, p.w - 1 - size):
        p.rect(ex, y, size, size if size > 1 else 1, colour)
        if white:
            p.set(ex if ex == 1 else ex + size - 1, y + size - 1, white)
        if glint:
            p.set(ex + (size - 1 if ex == 1 else 0), y, glint)
    return p


def face(cols, eye_row=None, eye=None, glint=G['tealMid'], extra=None, size=2):
    """A head: fur all round, eyes on the front."""
    def f(p, face):
        p.grain(cols)
        if face == 'north':
            eyes(p, eye_row if eye_row is not None else max(1, p.h // 3), eye, glint, size=size)
            if extra:
                extra(p)
        elif face in ('east', 'west') and p.w >= 6:
            p.set(1 if face == 'west' else p.w - 2, eye_row if eye_row is not None else max(1, p.h // 3), eye or C['ink'])
    return f


def legs_paint(cols, hoof, hoof_rows=2, band=None):
    def f(p, face):
        p.grain(cols)
        if face == 'down':
            p.fill(hoof)
        elif face != 'up':
            for r in range(1, hoof_rows + 1):
                p.row(-r, hoof)
            if band:
                p.row(-hoof_rows - 1, band)
    return f


def quad(id, name, body, head, leg, legw, fur_p, face_p, leg_p, features=lambda H, B: [], legs=4,
         neck=None, tail=None, head_lift=0.4, leg_z=None, scale=1, anim=True):
    """
    body (w, h, l), head (w, h, d) in units. Returns a model dict. `features`
    is a function (H, B) → cubes, H and B the head and body boxes as dicts.
    """
    w, h, l = body
    hw, hh, hd = head
    B = dict(x0=-w / 2, x1=w / 2, y0=leg, y1=leg + h, z0=-l / 2, z1=l / 2)
    bones = [('body', None, (0, leg + h / 2, 0))]
    cubes = [box('body', 'body', (B['x0'], B['y0'], B['z0']), (B['x1'], B['y1'], B['z1']), fur_p)]
    if neck:
        # A stepped neck: `n` blocks rising up and forward from the shoulders.
        up, out, nw, n = neck
        x0, x1 = -nw / 2, nw / 2
        bones.append(('neck', 'body', (0, B['y1'] - 2, B['z0'] + nw / 2)))
        for i in range(n):
            ya = B['y1'] - 2 + up * i / n
            za = B['z0'] - out * i / n
            cubes.append(box(f'neck{i}', 'neck', (x0, ya, za), (x1, ya + up / n + 3, za + nw), fur_p))
        top_y, front_z = B['y1'] + up, B['z0'] - out
        H = dict(x0=-hw / 2, x1=hw / 2, y0=top_y - hh / 2, y1=top_y + hh / 2, z0=front_z - hd + nw / 2, z1=front_z + nw / 2)
        bones.append(('head', 'neck', (0, top_y - hh / 2, front_z + nw / 2)))
    else:
        top = B['y1'] + hh * head_lift
        H = dict(x0=-hw / 2, x1=hw / 2, y0=top - hh, y1=top, z0=B['z0'] - hd + 1.5, z1=B['z0'] + 1.5)
        bones.append(('head', 'body', (0, top - hh / 2, B['z0'] + 1)))
    cubes.append(box('head', 'head', (H['x0'], H['y0'], H['z0']), (H['x1'], H['y1'], H['z1']), face_p))

    if legs == 4:
        lx = w / 2 - legw / 2 - 0.5
        lz = l / 2 - legw / 2 - 1 if leg_z is None else leg_z
        spots = {'leg_fl': (-lx, -lz), 'leg_fr': (lx, -lz), 'leg_bl': (-lx, lz), 'leg_br': (lx, lz)}
    else:
        lx = w / 4 + 0.25
        lz = 0 if leg_z is None else leg_z
        spots = {'leg_l': (-lx, lz), 'leg_r': (lx, lz)}
    for bname, (x, z) in spots.items():
        bones.append((bname, 'body', (x, leg, z)))
        cubes.append(box(bname, bname, (x - legw / 2, 0, z - legw / 2), (x + legw / 2, leg + 1, z + legw / 2), leg_p))

    if tail:
        bones.append(('tail', 'body', (0, B['y1'] - 1, B['z1'])))
        cubes += tail(B)
    cubes += features(H, B)

    walk = {}
    if anim:
        if legs == 4:
            walk = {'leg_fl': swing(22), 'leg_br': swing(22), 'leg_fr': swing(-22), 'leg_bl': swing(-22)}
        else:
            walk = {'leg_l': swing(28), 'leg_r': swing(-28)}
        walk['head'] = [(1, (0, 0, 0)), (7, (4, 0, 0)), (13, (0, 0, 0)), (19, (4, 0, 0)), (25, (0, 0, 0))]
        if tail:
            walk['tail'] = [(1, (0, 10, 0)), (13, (0, -10, 0)), (25, (0, 10, 0))]
    return dict(id=id, name=name, bones=bones, cubes=cubes, anim=walk, scale=scale)


def hbox(name, H, x, y, z, w, h, d, paint, rot=None, bone='head'):
    """A box placed from the head's front-top-left: x across, y down from the top, z back from the front."""
    return box(name, bone, (H['x0'] + x, H['y1'] - y - h, H['z0'] + z), (H['x0'] + x + w, H['y1'] - y, H['z0'] + z + d), paint, rot)


def pair(cube):
    return [cube, mirror(cube)]


# --------------------------------------------------------------------------
# Deer.

DEER = ['#b88a62', '#a87c56', '#c79c73']
ANTLER = ['#8a6a4a', '#a8865e']


def deer_body(p, face):
    p.grain(DEER)
    if face == 'up':
        for (x, y) in ((2, 4), (5, 7), (2, 10), (5, 13), (3, 2)):
            p.set(x, y, C['paper'])
    elif face == 'down':
        p.grain([C['paper2'], C['paper']])
    elif face in ('east', 'west'):
        p.row(-1, C['paper3'])
        for (x, y) in ((4, 1), (9, 2), (14, 1)):
            p.set(x, y, C['paper'])


def deer_face(p, face):
    p.grain(DEER)
    if face == 'north':
        eyes(p, 2)
        p.rect(2, p.h - 2, p.w - 4, 2, C['paper2'])
        p.rect(2, p.h - 2, 2, 1, C['ink'])
    elif face == 'down':
        p.fill(C['paper2'])


def antler_paint(p, face):
    p.grain(ANTLER)
    p.row(0, C['paper3'])



# --------------------------------------------------------------------------
# Rabbit.

RAB = ['#cdbba4', '#bfae97', '#d9c9b3']


def rab_face(p, face):
    p.grain(RAB)
    if face == 'north':
        eyes(p, 1, size=1)
        p.set(p.w // 2, p.h - 2, C['pink'])



# --------------------------------------------------------------------------
# Boar.

BOAR = ['#6f5646', '#5f4a3c', '#7d6352']


def boar_body(p, face):
    p.grain(BOAR)
    if face == 'up':
        p.rect(p.w // 2 - 1, 0, 2, p.h, '#3e3028')
    elif face in ('east', 'west'):
        p.row(0, '#4d3c31')


def boar_face(p, face):
    p.grain(BOAR)
    if face == 'north':
        eyes(p, 1)
        p.row(0, '#4d3c31')


def boar_snout(p, face):
    p.grain(['#4a3a30', '#55443a'])
    if face == 'north':
        p.set(1, 1, C['ink']).set(p.w - 2, 1, C['ink'])



# --------------------------------------------------------------------------
# Goat.

GOAT = ['#e4ddd0', '#d6cfc2', '#ece6da']


def goat_face(p, face):
    p.grain(GOAT)
    if face == 'north':
        p.rect(1, 2, 1, 1, C['ink']).set(p.w - 2, 2, C['ink'])
        p.set(1, 2, G['tealMid'])
        p.rect(1, 1, 1, 1, '#b8b0a2').rect(p.w - 2, 1, 1, 1, '#b8b0a2')
        p.row(-1, '#c4bcae')


def goat_horn(p, face):
    p.grain(['#cfc8ba', '#b8ae9c'])
    p.row(0, '#9c927f')



# --------------------------------------------------------------------------
# Sheep: a wool body in lumps, a dark face.

WOOL = [C['white'], '#f1ede4', '#e6e0d2']
SHEEP_FACE = ['#5f5248', '#6f6257']


def wool(p, face):
    p.grain(WOOL)
    for y in range(0, p.h, 3):
        for x in range((y // 3) % 2, p.w, 3):
            p.set(x, y, '#ddd6c6')


def sheep_face(p, face):
    p.grain(SHEEP_FACE)
    if face == 'north':
        p.rect(0, 2, 2, 1, C['white']).rect(p.w - 2, 2, 2, 1, C['white'])
        p.set(1, 2, C['ink']).set(p.w - 2, 2, C['ink'])
        p.set(1, 1, G['tealMid'])
        p.set(p.w // 2, p.h - 2, '#3a302a')



# --------------------------------------------------------------------------
# Pig.

PIG = ['#e9b3aa', '#eebdb4', '#dea49a']


def pig_face(p, face):
    p.grain(PIG)
    if face == 'north':
        eyes(p, 2)


def pig_snout(p, face):
    p.fill('#d88a84').border('#c97a74')
    if face == 'north':
        p.set(1, 1, '#8a4a48').set(p.w - 2, 1, '#8a4a48')



# --------------------------------------------------------------------------
# Chicken.

HEN = [C['white'], '#f4efe6', '#e8e2d6']


def hen_face(p, face):
    p.grain(HEN)
    if face == 'north':
        p.set(0, 1, C['ink']).set(p.w - 1, 1, C['ink'])
    elif face in ('east', 'west'):
        p.set(1, 1, C['ink'])


def hen_wing(p, face):
    p.grain(['#e8e2d6', '#ddd6c8'])
    if face in ('east', 'west'):
        p.row(-1, '#cfc6b4').set(0, 1, '#cfc6b4')



# --------------------------------------------------------------------------
# Horse: a stepped neck, a mane, a long head with a white blaze.

HORSE = ['#8a5a36', '#7a4e2e', '#946440']
MANE = ['#2f2018', '#3d2a1e']


def horse_face(p, face):
    p.grain(['#7a4e2e', '#84553a'])
    if face == 'north':
        p.rect(p.w // 2 - 1, 0, 2, p.h, C['paper'])
        p.rect(1, p.h - 2, 1, 1, C['ink']).set(p.w - 2, p.h - 2, C['ink'])
    elif face in ('east', 'west'):
        x = 2 if face == 'west' else p.w - 3
        p.rect(x, 1, 2, 2, C['ink']).set(x if face == 'west' else x + 1, 1, G['tealMid'])



# --------------------------------------------------------------------------
# Raptor: two legs, a long stiff tail, a crest, stripes.

RAP = ['#6d7f45', '#7d8f50', '#5f703c']


def rap_body(p, face):
    p.grain(RAP)
    if face in ('east', 'west', 'up'):
        for i in range(2, (p.w if face != 'up' else p.h), 4):
            if face == 'up':
                p.row(i, '#4a5a2e')
            else:
                p.col(i, '#4a5a2e')
    elif face == 'down':
        p.grain(['#c8c09a', '#b8b08a'])


def rap_face(p, face):
    p.grain(['#7d8f50', '#6d7f45'])
    if face == 'north':
        p.rect(1, 1, 1, 1, G['gold']).set(p.w - 2, 1, G['gold'])
        p.row(-1, '#efe6cf')
        for x in range(0, p.w, 2):
            p.set(x, p.h - 2, '#efe6cf')
    elif face in ('east', 'west'):
        p.rect(1 if face == 'west' else p.w - 2, 1, 1, 1, G['gold'])
        p.row(-2, C['ink'])


RAPTOR = quad(
    'raptor', 'Raptor', (7, 8, 16), (6, 6, 9), 12, 3, rap_body, rap_face,
    legs_paint(['#55633a', '#4a5732'], '#2e2a22', 2), legs=2, leg_z=2, head_lift=0.8,
    features=lambda H, B: [
        hbox('crest', H, 2.5, -2, 3, 1, 2, 5, fur(['#b84a2a', '#d0603a'])),
        box('arm_l', 'body', (B['x0'] - 1, B['y0'] + 1, B['z0'] + 1), (B['x0'] + 0.5, B['y0'] + 4, B['z0'] + 3.5), fur(['#55633a'])),
        box('arm_r', 'body', (B['x1'] - 0.5, B['y0'] + 1, B['z0'] + 1), (B['x1'] + 1, B['y0'] + 4, B['z0'] + 3.5), fur(['#55633a'])),
    ],
    tail=lambda B: [
        box('tail', 'tail', (-2.5, B['y1'] - 6, B['z1']), (2.5, B['y1'] - 1, B['z1'] + 8), rap_body),
        box('tail_end', 'tail', (-1.5, B['y1'] - 5, B['z1'] + 8), (1.5, B['y1'] - 2, B['z1'] + 15), rap_body),
    ],
)

# --------------------------------------------------------------------------
# Triceratops: a frill, three horns, a beak.

TRI = ['#8a7a5a', '#9a8a68', '#7a6a4c']


def tri_body(p, face):
    p.grain(TRI)
    if face in ('east', 'west', 'up'):
        for y in range(1, p.h, 4):
            for x in range((y // 4) % 2 * 3, p.w, 6):
                p.rect(x, y, 2, 2, '#6a5c42')


def frill(p, face):
    p.grain(['#b59a6a', '#a88c5c'])
    if face == 'north':
        p.border('#7a6a4c')
        for x in range(2, p.w - 2, 4):
            p.rect(x, 2, 2, 2, '#c45a3a')
            p.set(x, 3, G['gold'])
        p.row(1, '#d6bd85')


def tri_face(p, face):
    p.grain(['#9a8a68', '#8a7a5a'])
    if face == 'north':
        eyes(p, 3)
        p.rect(2, p.h - 3, p.w - 4, 3, '#7a6a4c')


def ivory(p, face):
    p.grain([C['paper'], C['paper2']])
    p.row(0, C['paper3'])


TRIKE = quad(
    'trike', 'Triceratops', (22, 19, 40), (14, 12, 12), 13, 6, tri_body, tri_face,
    legs_paint(['#6a5c42', '#76674a'], '#3e3428', 2), head_lift=0.2,
    features=lambda H, B: [
        hbox('frill', H, -5, -9, 9, 24, 18, 2, frill),
        hbox('beak', H, 4, 7, -3, 6, 5, 3, {'all': '#5a4c38', 'up': '#6a5c42'}),
        hbox('nose_horn', H, 6, 2, -2, 2, 4, 2, ivory),
        *pair(hbox('horn_l', H, 2, -6, 1, 2, 9, 2, ivory, (-35, 0, 0))),
    ],
    tail=lambda B: [
        box('tail', 'tail', (-4, B['y1'] - 10, B['z1']), (4, B['y1'] - 2, B['z1'] + 10), tri_body),
        box('tail_end', 'tail', (-2, B['y1'] - 9, B['z1'] + 10), (2, B['y1'] - 4, B['z1'] + 18), tri_body),
    ],
)

# --------------------------------------------------------------------------
# Long-neck.

LN = ['#7f8a90', '#8e999f', '#717c82']


def ln_body(p, face):
    p.grain(LN)
    if face in ('east', 'west', 'up'):
        for y in range(2, p.h, 6):
            for x in range((y // 6) % 2 * 4, p.w, 8):
                p.rect(x, y, 3, 2, '#646d72')
    elif face == 'down':
        p.grain(['#b8bfc2', '#a9b1b5'])


def ln_face(p, face):
    p.grain(['#8e999f', '#7f8a90'])
    if face == 'north':
        eyes(p, 2)
        p.row(-1, '#646d72')


LONGNECK = quad(
    'longneck', 'Long-neck', (28, 26, 56), (9, 8, 13), 30, 8, ln_body, ln_face,
    legs_paint(['#646d72', '#6f787d'], '#4a5155', 2),
    neck=(48, 22, 9, 4),
    tail=lambda B: [
        box('tail', 'tail', (-6, B['y1'] - 14, B['z1']), (6, B['y1'] - 3, B['z1'] + 14), ln_body),
        box('tail_mid', 'tail', (-4, B['y1'] - 16, B['z1'] + 14), (4, B['y1'] - 8, B['z1'] + 28), ln_body),
        box('tail_end', 'tail', (-2, B['y1'] - 17, B['z1'] + 28), (2, B['y1'] - 12, B['z1'] + 40), ln_body),
    ],
)

# --------------------------------------------------------------------------
# Basilisk: a crowned serpent-lizard out of legend. It glows.

BAS = ['#2f4a2a', '#3a5a32', '#243a20']


def bas_body(p, face):
    p.grain(BAS)
    if face == 'down':
        p.grain(['#9aa86a', '#8a985a'])
    else:
        for y in range(1, p.h, 3):
            for x in range((y // 3) % 2 * 2, p.w, 4):
                p.set(x, y, '#4f7a3a')
        if face in ('east', 'west'):
            for x in range(3, p.w, 7):
                p.set(x, p.h // 2, G['tealMid'])


def bas_face(p, face):
    p.grain(['#3a5a32', '#2f4a2a'])
    if face == 'north':
        for ex in (1, p.w - 4):
            p.rect(ex, 3, 3, 2, C['ink']).rect(ex, 3, 3, 1, G['gold'])
            p.set(ex + 1, 4, G['gold'])
        p.row(-1, '#1a2a16').row(-2, '#efe6cf')
        for x in range(0, p.w, 2):
            p.set(x, p.h - 3, '#efe6cf')
    elif face in ('east', 'west'):
        p.rect(2 if face == 'west' else p.w - 4, 3, 2, 1, G['gold'])


def gold_spike(p, face):
    p.grain([C['gold'], C['goldDark']])
    p.row(0, G['gold'])


def crown_gem(p, face):
    p.fill(G['teal']).border(G['tealMid'])



# --------------------------------------------------------------------------
# The guardians and the Warlord's beast.

LIGHT = [C['paper'], '#efe3c0', '#fbf3dc']


def light_body(p, face):
    p.grain(LIGHT)
    if face in ('east', 'west'):
        p.stamp(['.#.', '#.#', '.#.'], {'#': G['gold']}, 3, 2)
        p.stamp(['#.#', '.#.', '#.#'], {'#': G['tealMid']}, p.w - 6, 3)
    elif face == 'up':
        for y in range(1, p.h, 3):
            p.set(p.w // 2, y, G['gold'])


def light_face(p, face):
    p.grain(LIGHT)
    if face == 'north':
        p.rect(1, 2, 2, 2, G['tealMid']).rect(p.w - 3, 2, 2, 2, G['tealMid'])
        p.set(1, 2, G['teal']).set(p.w - 2, 2, G['teal'])
        p.stamp(['.#.', '###', '.#.'], {'#': G['gold']}, None, 0)


def glow_antler(p, face):
    p.grain([C['gold'], C['goldDark']])
    p.row(0, G['gold'])



SHADOW = ['#1d1a22', '#24202b', '#16131a']


def shadow_body(p, face):
    p.grain(SHADOW)
    if face in ('east', 'west'):
        for x in range(2, p.w, 5):
            p.set(x, p.h // 2, '#4a3a5a').set(x + 1, p.h // 2 + 1, G['violet'])
    elif face == 'up':
        p.col(p.w // 2, '#4a3a5a')


def shadow_face(p, face):
    p.grain(SHADOW)
    if face == 'north':
        p.rect(1, 2, 2, 1, G['violet']).rect(p.w - 3, 2, 2, 1, G['violet'])
        p.row(-1, '#0e0c12')
        for x in range(1, p.w - 1, 2):
            p.set(x, p.h - 2, '#cfc8d8')


def shadow_spike(p, face):
    p.grain(['#2e2838', '#3a3048'])
    p.row(0, G['violet'])



WB = ['#2a2628', '#332e30', '#221e20']


def war_body(p, face):
    p.grain(WB)
    if face == 'down':
        p.grain(['#3a3436', '#2a2628'])


def war_plate(p, face):
    p.grain([C['iron'], C['iron3']])
    p.border(C['iron2'])
    if face in ('east', 'west'):
        p.stamp(['#.#.#'], {'#': '#7a2a20'}, None, 1)
        p.set(p.w // 2, p.h // 2, G['red'])


def war_face(p, face):
    p.grain(WB)
    if face == 'north':
        p.rect(1, 2, 2, 1, G['red']).rect(p.w - 3, 2, 2, 1, G['red'])
        p.row(-1, C['ink'])
        p.set(2, p.h - 2, '#4a1a14').set(p.w - 3, p.h - 2, '#4a1a14')


def iron_horn(p, face):
    p.grain(['#4c4a55', '#5c5a66'])
    p.row(0, '#9a9aa6')



