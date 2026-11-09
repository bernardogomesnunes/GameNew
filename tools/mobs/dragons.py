"""
Dragons (owner, 9 November: "Could you model a set of different dragons,
like 4 types. One super big, the other three a bit smaller ... Dragons
should have some dynamic movements of wings and all that").

Units are sixteenths of a block, y up, the model facing -z (its head to -z,
its tail to +z), the same as every other model here. Each dragon is built
from the same bones so one animation drives them all (render/MobView.js):

    body                     the trunk, its pivot at the middle
    neck0, neck1 -> head     a neck in two parts, for a sway
    jaw                      the lower jaw, hinged under the head
    tail0, tail1, tail2      a tail in three parts, each swinging after the last
    wing_l, wing_r           the inner wing, hinged at the shoulder
    wingtip_l, wingtip_r     the outer wing, hinged at the elbow
    leg_fl/fr/bl/br, or leg_l/leg_r for a wyvern

Wings rest spread flat; the game flaps them about z, sweeps them back about
y to fold them on the ground, and bends the tips after the arm.

  elder_dragon   the Elder Dragon: the big one, some 16 blocks nose to tail
                 and 20 across the wings, black and crimson with a gold belly
  fire_drake     red and orange, four legs, a horned crest
  frost_wyvern   pale blue and white, two legs, ice spikes
  storm_dragon   green and yellow, a feathered crest and a lightning stripe
"""
from lib import *


def pair(cube):
    return [cube, mirror(cube)]


def shade(hexc, f):
    r, g, b = (int(hexc[i:i + 2], 16) for i in (1, 3, 5))
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(v * f))) for v in (r, g, b))


def scales(main, dark, light):
    """Overlapping scales: rows of arcs, offset each row."""
    def f(p, face):
        p.grain([main, shade(main, 0.94), main])
        for y in range(0, p.h, 3):
            off = 0 if (y // 3) % 2 == 0 else 2
            for x in range(off, p.w, 4):
                p.set(x, y, dark).set(x + 1, y, dark)
                p.set(x, y + 1, light)
    return f


def belly(main, line):
    def f(p, face):
        p.grain([main, shade(main, 0.95)])
        for y in range(1, p.h, 3):
            p.row(y, line)
    return f


def trunk(main, dark, light, under):
    """The body: scales on top and sides, belly plates under."""
    s, b = scales(main, dark, light), belly(under, shade(under, 0.8))
    return {'all': s, 'down': b}


def membrane(skin, vein):
    """A wing's skin: dark, with veins fanning across it."""
    def f(p, face):
        p.grain([skin, shade(skin, 0.92), shade(skin, 1.06)])
        if face in ('up', 'down'):
            for x in range(0, p.w, 5):
                p.col(x, vein)
            p.row(0, shade(vein, 0.85))
    return f


def bone_paint(c):
    def f(p, face):
        p.grain([c, shade(c, 0.9)])
        if face in ('up', 'down'):
            for x in range(0, p.w, 6):
                p.set(x, 0, shade(c, 0.7))
    return f


def horn_paint(c):
    def f(p, face):
        p.grain([c, shade(c, 0.88)])
        p.row(-1, shade(c, 0.7))
        p.row(0, shade(c, 1.15))
    return f


def head_paint(main, dark, light, eye, glow=None):
    s = scales(main, dark, light)

    def f(p, face):
        s(p, face)
        if face in ('east', 'west'):
            ex = 2 if face == 'west' else p.w - 4
            p.rect(ex, 2, 2, 2, eye)
            if glow:
                p.set(ex, 2, glow)
            p.row(-1, dark)
        if face == 'north':
            p.set(1, 1, '#1a1214').set(p.w - 2, 1, '#1a1214')   # nostrils
            p.row(-1, dark)
    return f


def jaw_paint(main, teeth):
    def f(p, face):
        p.grain([main, shade(main, 0.9)])
        if face in ('north', 'east', 'west'):
            for x in range(0, p.w, 2):
                p.set(x, 0, teeth)
    return f


def dragon(id, name, body, legs, neck, head, tail, wings, cols, spikes=2, horns=None, two_legs=False, extra=None):
    """
    body (w, h, l); legs (height, width); neck (rise, reach, width); head
    (w, h, length); tail (length of each of the three parts, base width);
    wings (inner span, outer span, chord); cols: main, dark, light, under,
    skin, vein, bone, horn, eye, glow.
    """
    main, dark, light, under = cols['main'], cols['dark'], cols['light'], cols['under']
    w, h, l = body
    lh, lw = legs
    rise, reach, nw = neck
    hw, hh, hl = head
    tl, tw = tail
    span_in, span_out, chord = wings
    hide = trunk(main, dark, light, under)
    B = dict(x0=-w / 2, x1=w / 2, y0=lh, y1=lh + h, z0=-l / 2, z1=l / 2)
    bones = [('body', None, (0, lh + h / 2, 0))]
    cubes = [box('body', 'body', (B['x0'], B['y0'], B['z0']), (B['x1'], B['y1'], B['z1']), hide)]
    # The chest, deeper than the hips.
    cubes.append(box('chest', 'body', (B['x0'] + 1, B['y0'] - 3, B['z0'] + 2), (B['x1'] - 1, B['y0'] + 2, B['z0'] + l * 0.45), {'all': belly(under, shade(under, 0.8))}))

    # The neck: two parts rising up and forward from the top of the chest.
    n0 = (0, B['y1'] - nw * 0.6, B['z0'] + nw * 0.4)
    n1 = (0, n0[1] + rise / 2, n0[2] - reach / 2)
    hd = (0, n0[1] + rise, n0[2] - reach)
    bones += [('neck0', 'body', n0), ('neck1', 'neck0', n1), ('head', 'neck1', hd)]
    for i, (a, b, bone) in enumerate([(n0, n1, 'neck0'), (n1, hd, 'neck1')]):
        cw = nw * (1 - 0.15 * i)
        steps = 3
        for k in range(steps):
            t0, t1 = k / steps, (k + 1) / steps
            y0 = a[1] + (b[1] - a[1]) * t0 - cw / 2
            z0 = a[2] + (b[2] - a[2]) * t1 - cw / 2
            cubes.append(box(f'neck{i}_{k}', bone, (-cw / 2, y0, z0), (cw / 2, y0 + abs(b[1] - a[1]) / steps + cw, z0 + cw + abs(b[2] - a[2]) / steps), hide))

    # The head: a skull, a snout, a jaw under it, horns and brows.
    H = dict(x0=-hw / 2, x1=hw / 2, y0=hd[1] - hh * 0.4, y1=hd[1] + hh * 0.6, z0=hd[2] - hl * 0.55, z1=hd[2] + hl * 0.45)
    hp = head_paint(main, dark, light, cols['eye'], cols.get('glow'))
    cubes.append(box('skull', 'head', (H['x0'], H['y0'], H['z0'] + hl * 0.35), (H['x1'], H['y1'], H['z1']), hp))
    cubes.append(box('snout', 'head', (H['x0'] + hw * 0.15, H['y0'] + hh * 0.2, H['z0']), (H['x1'] - hw * 0.15, H['y1'] - hh * 0.25, H['z0'] + hl * 0.4), hp))
    bones.append(('jaw', 'head', (0, H['y0'] + hh * 0.15, H['z1'] - hl * 0.25)))
    cubes.append(box('jaw', 'jaw', (H['x0'] + hw * 0.2, H['y0'] - hh * 0.22, H['z0'] + 1), (H['x1'] - hw * 0.2, H['y0'] + hh * 0.18, H['z1'] - hl * 0.2), jaw_paint(under, '#f2ead8')))
    cubes += pair(box('brow_l', 'head', (H['x0'] - 0.5, H['y1'] - 1, H['z0'] + hl * 0.38), (H['x0'] + hw * 0.32, H['y1'] + 1, H['z0'] + hl * 0.6), {'all': dark}))
    hn = horns or (hh * 0.9, 2.2, (-30, 0, 0))
    hlen, hthick, hrot = hn
    cubes += pair(box('horn_l', 'head', (H['x0'] + 0.5, H['y1'] - 1, H['z1'] - 3), (H['x0'] + 0.5 + hthick, H['y1'] - 1 + hthick, H['z1'] - 3 + hlen), horn_paint(cols['horn']), hrot))
    cubes += pair(box('horn2_l', 'head', (H['x0'] + 2.5, H['y1'] - 1, H['z1'] - 1), (H['x0'] + 2.5 + hthick * 0.7, H['y1'] - 1 + hthick * 0.7, H['z1'] - 1 + hlen * 0.6), horn_paint(cols['horn']), (hrot[0] + 12, 0, 0)))

    # Spines down the back.
    for k in range(int(l // 8)):
        z = B['z0'] + 4 + k * 8
        sh = spikes + (2 if k % 2 == 0 else 0)
        cubes.append(box(f'spine{k}', 'body', (-1, B['y1'], z), (1, B['y1'] + sh, z + 3), horn_paint(cols['horn'])))

    # The tail: three parts, each narrower, swinging after the one before.
    t0 = (0, B['y1'] - tw * 0.6, B['z1'] - 2)
    prev, pos = 'body', t0
    for i in range(3):
        bone = f'tail{i}'
        bones.append((bone, prev, pos))
        cw = tw * (1 - 0.28 * i)
        drop = 2 if i == 0 else 1
        cubes.append(box(bone, bone, (-cw / 2, pos[1] - cw / 2 - drop, pos[2]), (cw / 2, pos[1] + cw / 2 - drop, pos[2] + tl), hide))
        cubes.append(box(f'{bone}_spine', bone, (-0.75, pos[1] + cw / 2 - drop, pos[2] + 2), (0.75, pos[1] + cw / 2 - drop + max(1.5, spikes - i), pos[2] + 5), horn_paint(cols['horn'])))
        prev, pos = bone, (0, pos[1] - drop, pos[2] + tl)
    # A spade at the tip.
    cubes.append(box('tail_tip', 'tail2', (-tw * 0.5, pos[1] - 1.5, pos[2] - 2), (tw * 0.5, pos[1] + 0.5, pos[2] + 5), horn_paint(cols['horn'])))

    # The wings: an arm along the leading edge, a skin behind it, in two
    # hinged halves. Spread flat at rest; the game flaps and folds them.
    sy, sz = B['y1'] - 2, B['z0'] + l * 0.3
    skin, bonec = membrane(cols['skin'], cols['vein']), bone_paint(cols['bone'])
    bones.append(('wing_r', 'body', (B['x1'], sy, sz)))
    bones.append(('wingtip_r', 'wing_r', (B['x1'] + span_in, sy, sz)))
    x0, x1, x2 = B['x1'], B['x1'] + span_in, B['x1'] + span_in + span_out
    wing = [
        box('arm_r', 'wing_r', (x0, sy - 1, sz - 1.5), (x1, sy + 1.5, sz + 1.5), bonec),
        # The skin in strips, each a little shorter: a scalloped trailing edge.
        *[box(f'skin{k}_r', 'wing_r', (x0 + span_in * k / 3, sy - 0.25, sz + 1.5), (x0 + span_in * (k + 1) / 3, sy + 0.25, sz + chord * (1 - 0.06 * k) - (2 if k == 1 else 0)), skin) for k in range(3)],
        box('hand_r', 'wingtip_r', (x1, sy - 0.75, sz - 1), (x2, sy + 1, sz + 1), bonec),
        *[box(f'skinout{k}_r', 'wingtip_r', (x1 + span_out * k / 4, sy - 0.25, sz + 1), (x1 + span_out * (k + 1) / 4, sy + 0.25, sz + chord * (0.92 - 0.16 * k) - (2.5 if k % 2 else 0)), skin) for k in range(4)],
        box('claw_r', 'wingtip_r', (x1 - 1, sy, sz - 3), (x1 + 1, sy + 1.5, sz - 1), horn_paint(cols['horn'])),
    ]
    # Finger spars through the outer skin.
    for k, f in enumerate((0.35, 0.7)):
        xs = x1 + span_out * f
        wing.append(box(f'finger{k}_r', 'wingtip_r', (xs - 0.5, sy - 0.4, sz + 1), (xs + 0.5, sy + 0.4, sz + chord * (0.95 - 0.3 * k)), bonec))
    for c in wing:
        cubes += [c, mirror(c)]
    bones.append(('wing_l', 'body', (B['x0'], sy, sz)))
    bones.append(('wingtip_l', 'wing_l', (B['x0'] - span_in, sy, sz)))

    # The legs.
    leg_p = {'all': scales(shade(main, 0.9), dark, light), 'down': solid(dark)}
    if two_legs:
        spots = {'leg_l': (-w / 2 + lw / 2, l * 0.15), 'leg_r': (w / 2 - lw / 2, l * 0.15)}
    else:
        lx, lz = w / 2 - lw / 2, l / 2 - lw / 2 - 2
        spots = {'leg_fl': (-lx, -lz), 'leg_fr': (lx, -lz), 'leg_bl': (-lx, lz), 'leg_br': (lx, lz)}
    for bname, (x, z) in spots.items():
        bones.append((bname, 'body', (x, lh + 2, z)))
        cubes.append(box(bname, bname, (x - lw / 2, 2, z - lw / 2), (x + lw / 2, lh + 3, z + lw / 2), leg_p))
        # A heavy thigh or shoulder over the top half.
        tw2 = lw * 1.55
        cubes.append(box(bname + '_thigh', bname, (x - tw2 / 2, lh * 0.5, z - tw2 / 2 + (1 if 'b' in bname or two_legs else -1)), (x + tw2 / 2, lh + 4, z + tw2 / 2 + (1 if 'b' in bname or two_legs else -1)), leg_p))
        cubes.append(box(bname + '_foot', bname, (x - lw / 2 - 0.5, 0, z - lw / 2 - 2), (x + lw / 2 + 0.5, 2.5, z + lw / 2), leg_p))
        for k, dx in enumerate((-lw / 3, lw / 3)):
            cubes.append(box(f'{bname}_claw{k}', bname, (x + dx - 0.6, 0, z - lw / 2 - 3.5), (x + dx + 0.6, 1.2, z - lw / 2 - 2), horn_paint(cols['horn'])))
    if extra:
        cubes += extra(H, B)
    return dict(id=id, name=name, bones=bones, cubes=cubes, anim={}, scale=1)


ELDER = dragon(
    'elder_dragon', 'Elder Dragon',
    body=(44, 36, 92), legs=(30, 12), neck=(46, 40, 16), head=(26, 20, 42),
    tail=(40, 18), wings=(70, 90, 64), spikes=5, horns=(26, 4, (-28, 0, 0)),
    cols=dict(main='#2a1e26', dark='#120c12', light='#4a3040', under='#c8962e', skin='#6a1a20', vein='#3a0c10',
              bone='#3a2a30', horn='#d8c8a0', eye='#ffcf3a', glow='#ffe58a'),
)

FIRE = dragon(
    'fire_drake', 'Fire Drake',
    body=(22, 18, 44), legs=(16, 6), neck=(22, 20, 9), head=(15, 12, 23),
    tail=(20, 9), wings=(34, 42, 30), spikes=3, horns=(12, 2.5, (-35, 0, 0)),
    cols=dict(main='#b8361e', dark='#6a1a10', light='#e8642a', under='#f0b24a', skin='#d8642a', vein='#8a2a12',
              bone='#6a1a10', horn='#2a1e1e', eye='#ffe14a', glow='#fff2a0'),
)

FROST = dragon(
    'frost_wyvern', 'Frost Wyvern',
    body=(18, 16, 40), legs=(18, 6), neck=(24, 18, 8), head=(14, 11, 22),
    tail=(22, 8), wings=(36, 46, 32), spikes=4, horns=(10, 2, (-40, 0, 0)), two_legs=True,
    cols=dict(main='#a8d4ee', dark='#5a8ab0', light='#e8f6ff', under='#f4fbff', skin='#cfe8f6', vein='#7aa8cc',
              bone='#5a8ab0', horn='#e8f6ff', eye='#3ad0ff', glow='#bff2ff'),
    extra=lambda H, B: [
        # Ice spikes on its shoulders.
        *pair(box('ice_l', 'body', (B['x0'] - 1, B['y1'] - 2, B['z0'] + 6), (B['x0'] + 2, B['y1'] + 5, B['z0'] + 9), {'all': '#e8f6ff', 'north': '#bff2ff'}, (0, 0, 20))),
    ],
)

STORM = dragon(
    'storm_dragon', 'Storm Dragon',
    body=(20, 17, 46), legs=(15, 6), neck=(22, 22, 9), head=(15, 12, 23),
    tail=(22, 8), wings=(36, 44, 30), spikes=2, horns=(9, 2, (-45, 0, 0)),
    cols=dict(main='#2f7a4a', dark='#1a4a2c', light='#5ab070', under='#e8d65a', skin='#3a8a5a', vein='#e8d65a',
              bone='#1a4a2c', horn='#f2e8a0', eye='#ffef6a', glow='#fff8c0'),
    extra=lambda H, B: [
        # A feathered crest down the back of its head, and a lightning stripe.
        box('crest', 'head', (-1, H['y1'], H['z1'] - 8), (1, H['y1'] + 5, H['z1'] + 2), {'all': '#e8d65a', 'east': '#f2e8a0', 'west': '#f2e8a0'}, (-20, 0, 0)),
        box('stripe', 'body', (-1.5, B['y1'] + 0.01, B['z0'] + 2), (1.5, B['y1'] + 0.3, B['z1'] - 2), {'all': '#f6ec7a'}),
    ],
)

DRAGONS = [ELDER, FIRE, FROST, STORM]
