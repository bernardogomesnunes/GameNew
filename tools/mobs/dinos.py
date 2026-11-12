"""
The Past's dinosaurs, rebuilt (owner, 9 November: "review the models of the
dinosaurs they look off in sizes and form. They need to be bigger for sure.
And animation wise improve too").

Bigger, and built from the same chain of bones as the dragons
(tools/mobs/dragons.py), so the game moves them the same way: a neck in two
parts and a head with a jaw, a tail in three parts that swing one after the
other, and legs with a heavy thigh.

  raptor    a big raptor, 3 blocks to the top of its head and 5 nose to tail,
            green with stripes, a crest of red feathers and sickle claws
  trike     a triceratops 4 blocks high and 8 long: a great frill and three horns
  longneck  a long-neck 13 blocks to the top of its head and 15 long
"""
from lib import *
from dragons import shade, scales, belly, horn_paint, jaw_paint
from beasts import tube


def pair(cube):
    return [cube, mirror(cube)]


def striped(main, stripe, under):
    def f(p, face):
        p.grain([main, shade(main, 0.94), shade(main, 1.05)])
        if face in ('east', 'west', 'up'):
            for i in range(2, p.w if face != 'up' else p.h, 5):
                (p.row if face == 'up' else p.col)(i, stripe)
        if face == 'down':
            p.grain([under, shade(under, 0.94)])
    return f


def mottled(main, dark, under):
    def f(p, face):
        p.grain([main, shade(main, 0.95), shade(main, 1.04)])
        if face in ('east', 'west', 'up'):
            for y in range(1, p.h, 4):
                for x in range((y // 4) % 2 * 3, p.w, 7):
                    p.rect(x, y, 2, 2, dark)
        if face == 'down':
            p.grain([under, shade(under, 0.94)])
    return f


def head_p(hide, eye, dark):
    def f(p, face):
        hide(p, face)
        if face in ('east', 'west'):
            ex = 2 if face == 'west' else p.w - 4
            p.rect(ex, 1, 2, 2, '#1a1410').set(ex, 1, eye)
            p.row(-1, dark)
        if face == 'north':
            p.set(1, 1, '#1a1410').set(p.w - 2, 1, '#1a1410')
    return f


def dino(id, name, body, legs, neck, head, tail, hide, cols, two_legs=False, features=None, neck_boxes=3, shape=(0.04, 0.0), neck_taper=0.36):
    """
    body (w, h, l); legs (height, width); neck (rise, reach, width); head
    (w, h, length); tail (length of each of three parts, base width).
    """
    w, h, l = body
    lh, lw = legs
    rise, reach, nw = neck
    hw, hh, hl = head
    tl, tw = tail
    dark, under, eye = cols['dark'], cols['under'], cols['eye']
    B = dict(x0=-w / 2, x1=w / 2, y0=lh, y1=lh + h, z0=-l / 2, z1=l / 2)
    bones = [('body', None, (0, lh + h / 2, 0))]
    # The body in three parts (reviewed 11 November: "off in sizes and form"):
    # shoulders, a barrel that sags below and arches above, and narrower hips,
    # so the back and the belly have a line to them.
    front, rear = shape
    trunk = {'all': hide, 'down': belly(under, shade(under, 0.85))}
    za, zb = B['z0'] + l * 0.3, B['z1'] - l * 0.3
    cubes = [
        box('chest', 'body', (-w * 0.46, B['y0'] + h * 0.04, B['z0']), (w * 0.46, B['y1'] + h * front, za), trunk),
        box('barrel', 'body', (B['x0'], B['y0'] - h * 0.08, za), (B['x1'], B['y1'] + h * (0.1 + (front + rear) / 2), zb), trunk),
        box('hips', 'body', (-w * 0.44, B['y0'] + h * 0.1, zb), (w * 0.44, B['y1'] + h * rear, B['z1']), trunk),
    ]

    # The neck: boxes laid along its line and tapering to the head, in place of steps.
    n0 = (0, B['y1'] - nw * 0.7, B['z0'] + nw * 0.3)
    n1 = (0, n0[1] + rise / 2, n0[2] - reach / 2)
    hd = (0, n0[1] + rise, n0[2] - reach)
    bones += [('neck0', 'body', n0), ('neck1', 'neck0', n1), ('head', 'neck1', hd)]
    parts = 1 if neck_boxes <= 3 else 2
    for i, (a, b, bone) in enumerate([(n0, n1, 'neck0'), (n1, hd, 'neck1')]):
        for k in range(parts):
            t0, t1 = k / parts, (k + 1) / parts
            cw = nw * (1 - neck_taper * (i + (t0 + t1) / 2) / 2)
            pa = (a[1] + (b[1] - a[1]) * t0, a[2] + (b[2] - a[2]) * t0)
            pb = (a[1] + (b[1] - a[1]) * t1, a[2] + (b[2] - a[2]) * t1)
            cubes.append(tube(f'neck{i}_{k}', bone, pa, pb, cw, cw * 1.12, hide, grow=cw * 0.55))

    H = dict(x0=-hw / 2, x1=hw / 2, y0=hd[1] - hh * 0.45, y1=hd[1] + hh * 0.55, z0=hd[2] - hl * 0.6, z1=hd[2] + hl * 0.4)
    hp = head_p(hide, eye, dark)
    cubes.append(box('skull', 'head', (H['x0'], H['y0'], H['z0'] + hl * 0.4), (H['x1'], H['y1'], H['z1']), hp))
    cubes.append(box('snout', 'head', (H['x0'] + hw * 0.12, H['y0'] + hh * 0.25, H['z0']), (H['x1'] - hw * 0.12, H['y1'] - hh * 0.15, H['z0'] + hl * 0.45), hp))
    bones.append(('jaw', 'head', (0, H['y0'] + hh * 0.25, H['z1'] - hl * 0.2)))
    cubes.append(box('jaw', 'jaw', (H['x0'] + hw * 0.18, H['y0'] - hh * 0.05, H['z0'] + 1), (H['x1'] - hw * 0.18, H['y0'] + hh * 0.28, H['z1'] - hl * 0.15), jaw_paint(under, cols.get('teeth', '#f2ead8'))))

    t0 = (0, B['y1'] - tw * 0.55, B['z1'] - 2)
    prev, pos = 'body', t0
    for i in range(3):
        bone = f'tail{i}'
        bones.append((bone, prev, pos))
        cw = tw * (1 - 0.3 * i)
        drop = tw * 0.12
        # Each part in two steps, so the tail narrows evenly to its tip.
        cubes.append(box(bone, bone, (-cw / 2, pos[1] - cw / 2 - drop, pos[2]), (cw / 2, pos[1] + cw / 2 - drop, pos[2] + tl / 2), hide))
        c2 = cw * 0.85
        cubes.append(box(bone + '_b', bone, (-c2 / 2, pos[1] - c2 / 2 - drop, pos[2] + tl / 2), (c2 / 2, pos[1] + c2 / 2 - drop, pos[2] + tl), hide))
        prev, pos = bone, (0, pos[1] - drop, pos[2] + tl)

    leg_p = {'all': hide, 'down': solid(dark)}
    claw_p = horn_paint(cols.get('claw', '#e8dcc0'))
    if two_legs:
        # A runner's leg: a heavy thigh forward to the knee, the shin back to
        # the ankle, then down to long toes, the inner one a raised sickle claw.
        for bname, s in (('leg_l', -1), ('leg_r', 1)):
            x, z = s * (w / 2 - lw / 2 + 1), l * 0.12
            bones.append((bname, 'body', (x, lh + 3, z)))
            knee, ankle = (lh * 0.6, z - lw * 0.9), (lh * 0.3, z + lw * 0.9)
            cubes.append(tube(bname + '_thigh', bname, knee, (lh + 4, z + lw * 0.3), lw * 1.5, lw * 2.1, leg_p, x=x, grow=lw * 0.5))
            cubes.append(tube(bname + '_shin', bname, knee, ankle, lw * 0.95, lw * 1.1, leg_p, x=x, grow=lw * 0.6))
            cubes.append(tube(bname, bname, (1.5, z - lw * 0.2), ankle, lw * 0.75, lw * 0.85, leg_p, x=x, grow=lw * 0.4))
            cubes.append(box(bname + '_foot', bname, (x - lw / 2 - 0.5, 0, z - lw * 1.4), (x + lw / 2 + 0.5, 2, z + lw * 0.2), leg_p))
            for k, dx in enumerate((-lw / 3 * s, lw / 3 * s)):
                cubes.append(box(f'{bname}_toe{k}', bname, (x + dx - 0.6, 0, z - lw * 1.4 - 1.5), (x + dx + 0.6, 1.2, z - lw * 1.4), claw_p))
            cubes.append(box(bname + '_sickle', bname, (x - s * lw / 2 - 0.6, 1.2, z - lw * 1.4 - 0.5), (x - s * lw / 2 + 0.6, 4.2, z - lw * 1.4 + 0.8), claw_p, (-35, 0, 0)))
        if features:
            cubes += features(H, B)
        return dict(id=id, name=name, bones=bones, cubes=cubes, anim={}, scale=1)
    if two_legs:
        spots = {'leg_l': (-w / 2 + lw / 2 + 0.5, l * 0.12), 'leg_r': (w / 2 - lw / 2 - 0.5, l * 0.12)}
    else:
        lx, lz = w / 2 - lw / 2 - 0.5, l / 2 - lw / 2 - 2
        spots = {'leg_fl': (-lx, -lz), 'leg_fr': (lx, -lz), 'leg_bl': (-lx, lz), 'leg_br': (lx, lz)}
    for bname, (x, z) in spots.items():
        bones.append((bname, 'body', (x, lh + 2, z)))
        cubes.append(box(bname, bname, (x - lw / 2, 2, z - lw / 2), (x + lw / 2, lh + 3, z + lw / 2), leg_p))
        tw2 = lw * (1.7 if two_legs else 1.4)
        cubes.append(box(bname + '_thigh', bname, (x - tw2 / 2, lh * 0.45, z - tw2 / 2), (x + tw2 / 2, lh + 5, z + tw2 / 2), leg_p))
        cubes.append(box(bname + '_foot', bname, (x - lw / 2 - 0.5, 0, z - lw / 2 - (3 if two_legs else 1.5)), (x + lw / 2 + 0.5, 2.5, z + lw / 2), leg_p))
        claws = (-lw / 3, 0, lw / 3) if two_legs else (-lw / 3, lw / 3)
        for k, dx in enumerate(claws):
            cubes.append(box(f'{bname}_toe{k}', bname, (x + dx - 0.6, 0, z - lw / 2 - (4.5 if two_legs else 2.5)), (x + dx + 0.6, 1.2, z - lw / 2 - (3 if two_legs else 1.5)), horn_paint(cols.get('claw', '#e8dcc0'))))
    if features:
        cubes += features(H, B)
    return dict(id=id, name=name, bones=bones, cubes=cubes, anim={}, scale=1)


RAP_HIDE = striped('#6d7f45', '#3e4a26', '#d8cfa8')
RAPTOR = dino(
    'raptor', 'Raptor', body=(11, 12, 24), legs=(18, 4), neck=(10, 8, 6), head=(8, 8, 16), tail=(13, 7),
    hide=RAP_HIDE, two_legs=True, cols=dict(dark='#3e4a26', under='#d8cfa8', eye='#f2c23a'),
    features=lambda H, B: [
        # A crest of red feathers, and feathered arms tucked under the chest.
        box('crest', 'head', (-1, H['y1'], H['z1'] - 7), (1, H['y1'] + 3, H['z1'] + 1), {'all': '#c8442a', 'up': '#e0603a'}, (-15, 0, 0)),
        *pair(box('arm_l', 'body', (B['x0'] - 1.5, B['y0'] + 1, B['z0'] + 2), (B['x0'] + 0.5, B['y0'] + 6, B['z0'] + 6), {'all': '#55633a', 'west': '#c8442a'}, (30, 0, 0))),
        # Feathers along the top of the tail's root.
        box('plume', 'tail0', (-1, B['y1'] - 1, B['z1'] - 1), (1, B['y1'] + 2, B['z1'] + 9), {'all': '#c8442a', 'up': '#e0603a'}),
    ],
)

TRI_HIDE = mottled('#8a7a5a', '#6a5c42', '#c8b890')


def frill_p(p, face):
    p.grain(['#b59a6a', '#a88c5c'])
    if face in ('north', 'south'):
        p.border('#6a5c42')
        for x in range(2, p.w - 2, 5):
            p.rect(x, 2, 3, 3, '#c45a3a')
            p.set(x + 1, 3, G['gold'])


TRIKE = dino(
    'trike', 'Triceratops', body=(32, 28, 60), legs=(18, 9), neck=(4, 8, 18), head=(22, 18, 28), tail=(18, 14),
    hide=TRI_HIDE, cols=dict(dark='#4e4232', under='#c8b890', eye='#2a1e14'), neck_boxes=2, shape=(-0.02, 0.08),
    features=lambda H, B: [
        box('frill', 'head', (H['x0'] - 7, H['y0'] + 2, H['z1'] - 3), (H['x1'] + 7, H['y1'] + 14, H['z1'] - 0.5), {'all': frill_p}, (20, 0, 0)),
        box('beak', 'head', (-4, H['y0'] + 1, H['z0'] - 4), (4, H['y0'] + 8, H['z0'] + 1), {'all': '#4e4232', 'up': '#5a4c38'}),
        box('nose_horn', 'head', (-1.5, H['y1'] - 4, H['z0'] + 2), (1.5, H['y1'] + 4, H['z0'] + 5), horn_paint('#efe6d2'), (-20, 0, 0)),
        *pair(box('horn_l', 'head', (H['x0'] + 3, H['y1'] - 2, H['z0'] + 9), (H['x0'] + 6, H['y1'] + 14, H['z0'] + 12), horn_paint('#efe6d2'), (-50, 0, 0))),
    ],
)

LN_HIDE = mottled('#7f8a90', '#646d72', '#c0c7ca')
LONGNECK = dino(
    'longneck', 'Long-neck', body=(40, 38, 84), legs=(46, 13), neck=(120, 60, 14), head=(12, 10, 20), tail=(34, 18),
    hide=LN_HIDE, cols=dict(dark='#4a5155', under='#c0c7ca', eye='#2a2420'), neck_boxes=5, shape=(0.12, -0.06), neck_taper=0.5,
    features=lambda H, B: [
        # A ridge of plates down the back.
        *[box(f'plate{k}', 'body', (-1.5, B['y1'] + 4, B['z0'] + 27 + k * 8), (1.5, B['y1'] + 9, B['z0'] + 32 + k * 8), {'all': '#646d72'}) for k in range(4)],
    ],
)

DINOS = [RAPTOR, TRIKE, LONGNECK]
