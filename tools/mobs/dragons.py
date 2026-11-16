"""
Dragons (owner, 9 November: "Could you model a set of different dragons,
like 4 types. One super big, the other three a bit smaller ... Dragons
should have some dynamic movements of wings and all that").

IMP-47 (owner, 15 November: "the dragons need fable then they are odd
looking"): remodelled the way fauna.py and dinos.py build their animals.
A body in four parts (keel, chest, barrel, hips). A neck and a tail of
tapering tubes laid along a curve. A head with a stepped snout, nostrils,
brows, eyes, fangs and a two-part jaw, about half as long as the body.
Horns in segments that curve. Legs with a thigh, a shin and clawed feet.
Wings with an arm bent at the elbow, four finger bones fanning from the
wrist and a membrane cut to a scalloped outline between them.

Units are sixteenths of a block, y up, the model facing -z (its head to -z,
its tail to +z), the same as every other model here. Each dragon is built
from the same bones so one animation drives them all (render/MobView.js):

    body                     the trunk, its pivot at the middle
    neck0, neck1 -> head     a neck in two parts, for a sway
    jaw                      the lower jaw, hinged under the head
    tail0, tail1, tail2      a tail in three parts, each swinging after the last
    wing_l, wing_r           the arm and inner membrane, hinged at the shoulder
    wingtip_l, wingtip_r     the fingers and outer membrane, hinged at the wrist
    leg_fl/fr/bl/br, or leg_l/leg_r for a wyvern

Wings rest spread flat; the game flaps them about z, sweeps them back about
y to fold them on the ground, and bends the tips after the arm.

  elder_dragon   the Elder Dragon, drawn 1.5 times over: 29 blocks nose to
                 tail and 37 across the wings. Black with a gold belly and
                 crimson wings, a crown of six horns, a beard of spikes and
                 a spiked club on its tail
  fire_drake     red and orange, stocky, four legs, curled black horns, a
                 nose horn, a glowing throat and an arrow tail
  frost_wyvern   pale blue and white, slim, two legs, the widest wings for
                 its size, straight ice horns, a head fin and a tail blade
  storm_dragon   green and yellow, long and low, swept horns, a feathered
                 crest, whiskers, a lightning stripe and a forked tail
"""
import math
from lib import *
from beasts import tube


def pair(cube):
    return [cube, mirror(cube)]


def shade(hexc, f):
    r, g, b = (int(hexc[i:i + 2], 16) for i in (1, 3, 5))
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(v * f))) for v in (r, g, b))


def scales(main, dark, light):
    """Overlapping scales: rows of arcs, offset each row. (The dinosaurs' hide, dinos.py.)"""
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


def horn_paint(c):
    def f(p, face):
        p.grain([c, shade(c, 0.88)])
        p.row(-1, shade(c, 0.7))
        p.row(0, shade(c, 1.15))
    return f


def jaw_paint(main, teeth):
    def f(p, face):
        p.grain([main, shade(main, 0.9)])
        if face in ('north', 'east', 'west'):
            for x in range(0, p.w, 2):
                p.set(x, 0, teeth)
    return f


# --------------------------------------------------------------------------
# Painters.

def hide(main, dark, under, stripe=None, glow=None):
    """
    A dragon's skin: quiet scales on the sides (dark along the back, paler
    towards the belly), a dark ridge on top, belly plates underneath.
    `stripe` runs down the middle of the top; `glow` shows between the plates.
    """
    mark, pale = shade(main, 0.86), shade(main, 1.1)

    def f(p, face):
        if face == 'down':
            p.grain([under, shade(under, 0.94)])
            for y in range(1, p.h, 3):
                p.row(y, shade(under, 0.72))
                if glow and p.w > 4:
                    p.rect(p.w // 2 - 1, y, 2, 1, glow)
            return
        p.grain([main, shade(main, 0.94), shade(main, 1.05)])
        if face == 'up':
            for y in range(p.h):
                for x in range((y % 2) * 2, p.w, 4):
                    p.set(x, y, dark)
            if stripe and p.w > 2:
                for y in range(p.h):
                    p.set(p.w // 2 - 1 + (y // 2) % 2, y, stripe)
            return
        for y in range(p.h):
            t = y / max(1, p.h - 1)
            for x in range(((y // 2) % 2) * 2, p.w, 4):
                if y % 2 == 0:
                    p.set(x, y, shade(main, 0.74) if t < 0.3 else mark)
                elif t > 0.6:
                    p.set(x, y, pale)
        p.row(0, dark)
    return f


def skin_paint(top, under, rib):
    """A wing's membrane: its upper colour above, a brighter one beneath, dark at the trailing edge."""
    def f(p, face):
        c = under if face == 'down' else top
        p.grain([c, shade(c, 0.93), shade(c, 1.06)])
        edge = (0, 1) if face == 'down' else (-1, -2)
        p.row(edge[0], rib).row(edge[1], shade(c, 0.8))
    return f


def bone_paint(c):
    def f(p, face):
        p.grain([c, shade(c, 0.9)])
        if face in ('up', 'down'):
            p.row(0, shade(c, 1.2))
    return f


def eye_paint(glow):
    def f(p, face):
        p.fill(glow)
        if face in ('east', 'west'):
            p.col(p.w // 2, '#140c0c')
    return f


def mouth_paint(base):
    """The inside of the mouth on the face that shows when the jaw drops."""
    def f(p, face):
        if face in ('up', 'down') and getattr(f, 'inside', None) == face:
            p.fill('#6a1418').rect(1, 1, max(1, p.w - 2), max(1, p.h - 3), '#a8323a')
        else:
            base(p, face)
    return f


def inside(painter, face):
    f = mouth_paint(painter)
    f.inside = face
    return f


def teeth(painter, edge, colour='#f2ead8'):
    """A row of teeth along one edge (0 the top, -1 the bottom) of the front and sides."""
    def f(p, face):
        painter(p, face)
        if face in ('north', 'east', 'west'):
            for x in range(0, p.w, 2):
                p.set(x, edge if edge >= 0 else p.h + edge, colour)
    return f


# --------------------------------------------------------------------------
# Shapes.

def rod(name, bone, a, b, w, h, paint, x=0.0, grow=0.0, skip=()):
    """beasts.tube, with faces left out."""
    c = tube(name, bone, a, b, w, h, paint, x=x, grow=grow)
    return box(c[0], c[1], c[2], c[3], c[4], c[5], skip)


def bar(name, bone, a, b, y, w, h, paint, skip=()):
    """A box lying flat from a = (x, z) to b = (x, z), `w` across and `h` thick, at height y."""
    (xa, za), (xb, zb) = a, b
    length = math.hypot(xb - xa, zb - za)
    cx, cz = (xa + xb) / 2, (za + zb) / 2
    ang = -math.degrees(math.atan2(zb - za, xb - xa))
    return box(name, bone, (cx - length / 2, y - h / 2, cz - w / 2), (cx + length / 2, y + h / 2, cz + w / 2), paint, (0, ang, 0), skip)


def horn(name, bone, start, segs, x, w, paint, dx=0.0, taper=0.28):
    """A curved horn: tubes end to end from start = (y, z). segs [(length, degrees above level, pointing back)]."""
    out, (y, z) = [], start
    for i, (length, a) in enumerate(segs):
        ny, nz = y + length * math.sin(math.radians(a)), z + length * math.cos(math.radians(a))
        t = w * (1 - taper * i)
        out.append(rod(f'{name}{i}_r', bone, (y, z), (ny, nz), t, t, paint, x=x + dx * i, grow=t * 0.5))
        y, z = ny, nz
    return out


def spine(name, bone, p, n, back, high, thick, paint):
    """A spine standing on p = (y, z), along the normal n and leaning towards `back`."""
    tip = (p[0] + n[0] * high + back[0] * high * 0.55, p[1] + n[1] * high + back[1] * high * 0.55)
    return rod(name, bone, (p[0] - n[0] * 0.8, p[1] - n[1] * 0.8), tip, thick, high * 0.6, paint)


def span_at(poly, x):
    """Where the line at x crosses an outline of (x, z) points: its least and greatest z."""
    zs = []
    for (xa, za), (xb, zb) in zip(poly, poly[1:] + poly[:1]):
        if xa != xb and (xa - x) * (xb - x) <= 0:
            zs.append(za + (zb - za) * (x - xa) / (xb - xa))
    return (min(zs), max(zs)) if zs else None


def membrane(name, bone, poly, xa, xb, n, y, paint):
    """An outline filled with `n` thin strips side by side: only the top and the underside are drawn."""
    out = []
    for k in range(n):
        s0, s1 = xa + (xb - xa) * k / n, xa + (xb - xa) * (k + 1) / n
        cut = span_at(poly, (s0 + s1) / 2)
        if cut and cut[1] - cut[0] > 0.5:
            out.append(box(f'{name}{k}_r', bone, (s0, y - 0.2, cut[0]), (s1, y + 0.2, cut[1]), paint, skip=('north', 'south', 'east', 'west')))
    return out


# --------------------------------------------------------------------------
# The dragon.

def dragon(id, name, cols, body, legs, neck, head, tail, wings, crown, scale=1, two_legs=False,
           spines=(3, 1.2), tip='spade', extra=None, strips=(5, 8), fingers=((8, 1.0), (33, 0.92), (60, 0.8)),
           bend=(0.62, 0.36), droop=(-14, -5, 7)):
    """
    body (w, h, l); legs (height, width); neck (rise, reach, width); head
    (w, h, length); tail (length of each of the three parts, base width);
    wings (arm span, hand span, chord, bone thickness); crown(H) the horns.
    cols: main, dark, under, skin, skin_under, bone, horn, eye, and
    optionally stripe, glow, spine.
    """
    main, dark, under = cols['main'], cols['dark'], cols['under']
    w, h, l = body
    lh, lw = legs
    rise, reach, nw = neck
    tl, tw = tail
    si, so, chord, th = wings
    skin = hide(main, dark, under, cols.get('stripe'), cols.get('glow'))
    plain = hide(main, dark, under)
    hornp = horn_paint(cols['horn'])
    spinep = horn_paint(cols.get('spine', cols['horn']))
    B = dict(x0=-w / 2, x1=w / 2, y0=lh, y1=lh + h, z0=-l / 2, z1=l / 2, w=w, h=h, l=l)
    bones = [('body', None, (0, lh + h / 2, 0))]

    # The body: a keel at the front, a deep chest, a leaner barrel, narrow hips.
    za, zb = B['z0'] + l * 0.38, B['z1'] - l * 0.28
    tops = [(B['z0'], za, B['y1'] + h * 0.05), (za, zb, B['y1'] - h * 0.03), (zb, B['z1'], B['y1'] - h * 0.1)]
    cubes = [
        box('keel', 'body', (-w * 0.36, B['y0'] + h * 0.02, B['z0'] - l * 0.09), (w * 0.36, B['y1'] - h * 0.12, B['z0']), skin, skip=('south',)),
        box('chest', 'body', (B['x0'], B['y0'] - h * 0.1, B['z0']), (B['x1'], tops[0][2], za), skin),
        box('barrel', 'body', (-w * 0.43, B['y0'] + h * 0.04, za), (w * 0.43, tops[1][2], zb), skin, skip=('north',)),
        box('hips', 'body', (-w * 0.39, B['y0'] + h * 0.14, zb), (w * 0.39, tops[2][2], B['z1']), skin, skip=('north',)),
    ]

    def top_at(z):
        return next(t[2] for t in tops if z <= t[1])

    # The neck: tapering tubes along a curve, steep from the chest, then reaching forward.
    n0 = (0, B['y1'] - nw * 0.55, B['z0'] + nw * 0.4)
    n1 = (0, n0[1] + rise * bend[0], n0[2] - reach * bend[1])
    hd = (0, n0[1] + rise, n0[2] - reach)
    bones += [('neck0', 'body', n0), ('neck1', 'neck0', n1), ('head', 'neck1', hd)]
    sh, st = spines
    for i, (a, b, bone) in enumerate([(n0, n1, 'neck0'), (n1, hd, 'neck1')]):
        dy, dz = b[1] - a[1], b[2] - a[2]
        ln = math.hypot(dy, dz)
        nrm, back = (-dz / ln, dy / ln), (-dy / ln, -dz / ln)
        for k in range(2):
            t0, t1 = k / 2, (k + 1) / 2
            cw = nw * (1 - 0.4 * (i * 2 + k + 0.5) / 4)
            pa, pb = (a[1] + dy * t0, a[2] + dz * t0), (a[1] + dy * t1, a[2] + dz * t1)
            cubes.append(rod(f'neck{i}_{k}', bone, pa, pb, cw, cw * 1.12, skin, grow=cw * 0.6, skip=('north', 'south')))
            mid = ((pa[0] + pb[0]) / 2 + nrm[0] * cw * 0.56, (pa[1] + pb[1]) / 2 + nrm[1] * cw * 0.56)
            cubes.append(spine(f'neck{i}_spine{k}', bone, mid, nrm, back, sh * 0.8, st, spinep))

    # The head: a skull, a snout stepping down to the nose, brows over the
    # eyes, fangs, and a jaw in two parts hinged under the skull.
    hw, hh, hl = head
    y0, y1 = hd[1] - hh * 0.5, hd[1] + hh * 0.5
    z1, z0 = hd[2] + hl * 0.12, hd[2] - hl * 0.88
    zc, zn = z1 - hl * 0.42, z0 + hl * 0.16
    lip = y0 + hh * 0.36
    H = dict(x0=-hw / 2, x1=hw / 2, y0=y0, y1=y1, z0=z0, z1=z1, zc=zc, zn=zn, lip=lip, hw=hw, hh=hh, hl=hl)
    upper = teeth(plain, -1)
    cubes += [
        box('skull', 'head', (-hw / 2, y0 + hh * 0.3, zc), (hw / 2, y1, z1), plain),
        box('snout', 'head', (-hw * 0.37, lip, zn), (hw * 0.37, y1 - hh * 0.2, zc), {'all': upper, 'down': inside(plain, 'down')}, skip=('south',)),
        box('nose', 'head', (-hw * 0.3, lip, z0), (hw * 0.3, y1 - hh * 0.3, zn), {'all': upper, 'down': inside(plain, 'down')}, skip=('south',)),
        box('ridge', 'head', (-hw * 0.12, y1 - hh * 0.22, zn + hl * 0.04), (hw * 0.12, y1 - hh * 0.09, zc + hl * 0.05), {'all': dark}, skip=('down', 'south')),
        *pair(box('nostril_r', 'head', (hw * 0.07, y1 - hh * 0.32, z0 - 0.2), (hw * 0.3 + 0.2, y1 - hh * 0.2, z0 + hl * 0.09), {'all': shade(main, 0.9), 'north': '#140c0c'}, skip=('down',))),
        *pair(box('brow_r', 'head', (hw * 0.2, y1 - hh * 0.2, zc - hl * 0.03), (hw / 2 + hw * 0.07, y1 + hh * 0.07, zc + hl * 0.24), {'all': dark}, (-13, 0, 0))),
        *pair(box('eye_r', 'head', (hw / 2 - 0.4, y1 - hh * 0.43, zc + hl * 0.03), (hw / 2 + hw * 0.035, y1 - hh * 0.2, zc + hl * 0.16), {'all': eye_paint(cols['eye'])})),
        *pair(box('fang_r', 'head', (hw * 0.3 - hw * 0.08, y0 + hh * 0.14, z0 + hl * 0.07), (hw * 0.3 + hw * 0.03, lip + 0.1, z0 + hl * 0.07 + hw * 0.11), {'all': '#f2ead8'}, skip=('up',))),
        *pair(box('tooth_r', 'head', (hw * 0.37 - hw * 0.07, y0 + hh * 0.2, zn + hl * 0.12), (hw * 0.37 + hw * 0.03, lip + 0.1, zn + hl * 0.12 + hw * 0.1), {'all': '#f2ead8'}, skip=('up',))),
    ]
    bones.append(('jaw', 'head', (0, lip, z1 - hl * 0.2)))
    lower = hide(shade(main, 0.92), dark, under)
    cubes += [
        box('jaw', 'jaw', (-hw * 0.43, y0, zc - hl * 0.06), (hw * 0.43, lip, z1 - hl * 0.08), lower),
        box('chin', 'jaw', (-hw * 0.29, y0 + hh * 0.08, z0 + hl * 0.05), (hw * 0.29, lip, zc - hl * 0.06), {'all': teeth(lower, 0), 'up': inside(lower, 'up'), 'down': lower}, skip=('south',)),
    ]
    cubes += crown(H)

    # Spines down the back, the tallest over the shoulders.
    count = max(4, int(l // (sh * 2.6)))
    for k in range(count):
        z = B['z0'] + l * (0.06 + 0.9 * k / count)
        big = sh * (1.25 if k in (1, 2) else 1.0 if k < count - 1 else 0.8)
        cubes.append(spine(f'spine{k}', 'body', (top_at(z), z), (1, 0), (0, 1), big, st, spinep))

    # The tail: three bones, each two tapering tubes, drooping then lifting to the tip.
    pos = (0, B['y1'] - h * 0.1 - tw * 0.5, B['z1'] - tw * 0.25)
    prev = 'body'
    for i in range(3):
        bone = f'tail{i}'
        bones.append((bone, prev, pos))
        e = math.radians(droop[i])
        dy, dz = tl * math.sin(e), tl * math.cos(e)
        nrm = (dz / tl, -dy / tl)
        for k in range(2):
            cw = tw * (1 - 0.78 * (i * 2 + k + 0.5) / 6)
            pa = (pos[1] + dy * k / 2, pos[2] + dz * k / 2)
            pb = (pos[1] + dy * (k + 1) / 2, pos[2] + dz * (k + 1) / 2)
            cubes.append(rod(f'{bone}_{k}', bone, pa, pb, cw, cw * 1.08, skin, grow=cw * 0.5, skip=('north',) if i + k < 3 else ()))
            if k == 0 or i == 0:
                mid = ((pa[0] + pb[0]) / 2 + nrm[0] * cw * 0.54, (pa[1] + pb[1]) / 2 + nrm[1] * cw * 0.54)
                cubes.append(spine(f'{bone}_spine{k}', bone, mid, nrm, (dy / tl, dz / tl), sh * (0.75 - 0.15 * i), st, spinep))
        prev, pos = bone, (0, pos[1] + dy, pos[2] + dz)
    ty, tz, s = pos[1], pos[2], tw * 0.62
    if tip == 'spade':        # an arrowhead: a flat diamond and a barb each side
        cubes.append(box('tail_tip', 'tail2', (-s * 0.62, ty - 0.7, tz - s * 0.3), (s * 0.62, ty + 0.7, tz + s * 0.94), hornp, (0, 45, 0)))
        cubes += pair(bar('tail_barb_r', 'tail2', (s * 0.2, tz - s * 0.1), (s * 1.15, tz - s * 0.85), ty, s * 0.3, 1.0, hornp))
    elif tip == 'club':       # a club with spikes
        cubes.append(box('tail_tip', 'tail2', (-s * 0.5, ty - s * 0.45, tz - s * 0.2), (s * 0.5, ty + s * 0.45, tz + s * 0.9), plain))
        cubes += pair(bar('tail_spike_r', 'tail2', (s * 0.3, tz + s * 0.25), (s * 1.5, tz + s * 0.75), ty, s * 0.3, s * 0.3, hornp))
        cubes += pair(bar('tail_spike2_r', 'tail2', (s * 0.3, tz - s * 0.1), (s * 1.2, tz - s * 0.4), ty, s * 0.26, s * 0.26, hornp))
        cubes.append(rod('tail_spike_up', 'tail2', (ty + s * 0.3, tz + s * 0.3), (ty + s * 1.4, tz + s * 0.8), s * 0.3, s * 0.3, hornp))
        cubes.append(rod('tail_spike_end', 'tail2', (ty, tz + s * 0.8), (ty + s * 0.2, tz + s * 1.9), s * 0.3, s * 0.3, hornp))
    elif tip == 'blade':      # a fin standing on edge
        cubes.append(box('tail_tip', 'tail2', (-0.5, ty - s * 0.8, tz - s * 0.5), (0.5, ty + s * 0.8, tz + s * 1.1), {'all': cols['horn'], 'up': cols.get('spine', cols['horn'])}, (45, 0, 0)))
    elif tip == 'fork':       # two prongs
        cubes += pair(bar('tail_fork_r', 'tail2', (0, tz - s * 0.2), (s * 0.9, tz + s * 2.2), ty, s * 0.42, s * 0.42, hornp))

    # The wings. The arm bends back to an elbow and forward to the wrist;
    # four fingers fan from the wrist; the membrane is cut to the outline
    # between them, scalloped along the trailing edge.
    sy, sz = B['y1'] - h * 0.08, B['z0'] + l * 0.26
    x0, x1 = w * 0.44, w * 0.44 + si
    bonep = bone_paint(cols['bone'])
    skinp = skin_paint(cols['skin'], cols['skin_under'], shade(cols['skin'], 0.6))
    bones += [('wing_r', 'body', (x0, sy, sz)), ('wingtip_r', 'wing_r', (x1, sy, sz)),
              ('wing_l', 'body', (-x0, sy, sz)), ('wingtip_l', 'wing_l', (-x1, sy, sz))]
    elbow = (x0 + si * 0.46, sz + chord * 0.13)
    tips = [(x1 + so * f * math.cos(math.radians(a)), sz + so * f * math.sin(math.radians(a))) for a, f in fingers] + [(x1, sz + chord * 0.92)]
    hand = [(x1, sz - th * 0.4)]
    for i, t in enumerate(tips):
        hand.append(t)
        if i + 1 < len(tips):
            u = tips[i + 1]
            hand.append((x1 + ((t[0] + u[0]) / 2 - x1) * 0.84, sz + ((t[1] + u[1]) / 2 - sz) * 0.84))
    arm = [(x0 - 1, sz - th * 0.4), (x1, sz - th * 0.4), (x1, sz + chord * 0.92), (x0 + si * 0.55, sz + chord * 0.76), (x0 - 1, sz + chord)]
    wing = [
        box('shoulder_r', 'wing_r', (x0 - th * 0.9, sy - th * 0.9, sz - th * 1.1), (x0 + th * 1.3, sy + th * 0.9, sz + th * 1.5), plain),
        bar('arm_r', 'wing_r', (x0, sz + th * 0.2), elbow, sy, th * 1.5, th * 1.4, bonep, skip=('east', 'west')),
        bar('forearm_r', 'wing_r', elbow, (x1, sz), sy, th * 1.1, th * 1.05, bonep, skip=('east', 'west')),
        *membrane('skin', 'wing_r', arm, x0 - 1, x1, strips[0], sy, skinp),
        box('wrist_r', 'wingtip_r', (x1 - th * 0.75, sy - th * 0.7, sz - th * 0.75), (x1 + th * 0.75, sy + th * 0.7, sz + th * 0.75), bonep),
        bar('thumb_r', 'wingtip_r', (x1, sz - th * 0.5), (x1 + th * 1.2, sz - th * 3.4), sy, th * 0.7, th * 0.7, hornp, skip=('west',)),
        *[bar(f'finger{k}_r', 'wingtip_r', (x1, sz), t, sy, th * (0.8 - 0.08 * k), th * (0.8 - 0.08 * k), bonep, skip=('east', 'west')) for k, t in enumerate(tips)],
        *membrane('skinout', 'wingtip_r', hand, x1, tips[0][0], strips[1], sy, skinp),
    ]
    for c in wing:
        cubes += [c, mirror(c)]

    # The legs: a heavy upper part against the body, a thinner shin, a
    # clawed foot. The hind legs bend the way a runner's do.
    legp = hide(shade(main, 0.9), dark, shade(main, 0.7))
    clawp = horn_paint(cols.get('claw', cols['horn']))
    if two_legs:
        spots = {'leg_l': (-w * 0.4, l * 0.1, False), 'leg_r': (w * 0.4, l * 0.1, False)}
    else:
        fx, bx, lz = w / 2 - lw * 0.3, w * 0.39 + lw * 0.15, l / 2 - lw * 0.9
        spots = {'leg_fl': (-fx, -lz + lw * 0.4, True), 'leg_fr': (fx, -lz + lw * 0.4, True), 'leg_bl': (-bx, lz - lw * 0.5, False), 'leg_br': (bx, lz - lw * 0.5, False)}
    for bname, (x, z, front) in spots.items():
        bones.append((bname, 'body', (x, lh + h * 0.25, z)))
        if front:
            top, joint, low = (lh + h * 0.34, z + lw * 0.1), (lh * 0.56, z + lw * 0.75), (lw * 0.35, z - lw * 0.1)
            cubes.append(rod(bname + '_thigh', bname, top, joint, lw * 1.35, lw * 1.7, legp, x=x, grow=lw * 0.5))
            cubes.append(rod(bname, bname, joint, low, lw * 0.9, lw * 1.0, legp, x=x, grow=lw * 0.5, skip=('north',)))
        else:
            top, knee, ankle, low = (lh + h * 0.4, z + lw * 0.4), (lh * 0.6, z - lw * 0.9), (lh * 0.32, z + lw * 0.8), (lw * 0.35, z)
            cubes.append(rod(bname + '_thigh', bname, top, knee, lw * 1.55, lw * 2.3, legp, x=x, grow=lw * 0.6))
            cubes.append(rod(bname + '_shin', bname, knee, ankle, lw * 0.95, lw * 1.1, legp, x=x, grow=lw * 0.6, skip=('north', 'south')))
            cubes.append(rod(bname, bname, ankle, low, lw * 0.78, lw * 0.85, legp, x=x, grow=lw * 0.4, skip=('north',)))
        cubes.append(box(bname + '_foot', bname, (x - lw * 0.62, 0, z - lw * 1.35), (x + lw * 0.62, lw * 0.42, z + lw * 0.35), legp))
        for k, dx in enumerate((-lw * 0.42, 0, lw * 0.42)):
            cubes.append(box(f'{bname}_claw{k}', bname, (x + dx - lw * 0.13, 0, z - lw * 1.35 - lw * (0.5 if k != 1 else 0.65)), (x + dx + lw * 0.13, lw * 0.3, z - lw * 1.35), clawp, skip=('south',)))
    if extra:
        cubes += extra(H, B)
    m = dict(id=id, name=name, bones=bones, cubes=cubes, anim={}, scale=scale)
    # For its picture (lib.render_one) the wings are half raised and swept back; the .glb keeps them flat.
    m['show'] = {'wing_r': (0, 35, 30), 'wing_l': (0, -35, -30), 'wingtip_r': (0, 30, -25), 'wingtip_l': (0, -30, 25)}
    m['show_yaw'] = -50
    # Where the fire leaves it, and how big it stands, in blocks (config/mobs.js).
    m['mouth'] = dict(up=round((lip + hh * 0.05) * scale / 16, 2), out=round(-z0 * scale / 16, 2))
    m['size'] = dict(w=round(w * scale / 16, 2), h=round(h * scale / 16, 2), l=round(l * scale / 16, 2), leg=round(lh * scale / 16, 2),
                     head=round((hw + hl) / 2 * scale / 16, 2), span=round(2 * tips[0][0] * scale / 16, 1),
                     long=round((pos[2] - z0) * scale / 16, 1))
    return m


def cheeks(H, paint, n=1, bone='head'):
    """Spikes back from the corners of the jaw, splayed out."""
    hw, hh, hl = H['hw'], H['hh'], H['hl']
    out = []
    for k in range(n):
        y = H['y0'] + hh * (0.5 - 0.22 * k)
        out += pair(bar(f'cheek{k}_r', bone, (hw * 0.42, H['z1'] - hl * 0.1), (hw * (0.72 - 0.1 * k), H['z1'] + hl * (0.2 - 0.05 * k)), y, hw * 0.16, hw * 0.16, paint))
    return out


# --------------------------------------------------------------------------
# The four.

def elder_crown(H):
    hw, hh, hl, y1, z1 = H['hw'], H['hh'], H['hl'], H['y1'], H['z1']
    hp = horn_paint('#d8c8a0')
    return [
        # A crown: two long horns curving up, a shorter pair under them and a third at the temples.
        *[c for part in horn('horn', 'head', (y1 - hh * 0.12, z1 - hl * 0.12), [(hl * 0.42, 22), (hl * 0.36, 42), (hl * 0.26, 66)], hw * 0.32, hw * 0.2, hp, dx=hw * 0.05) for c in pair(part)],
        *[c for part in horn('horn2_', 'head', (y1 - hh * 0.38, z1 - hl * 0.06), [(hl * 0.3, 6), (hl * 0.22, 26)], hw * 0.47, hw * 0.15, hp, dx=hw * 0.05) for c in pair(part)],
        *[c for part in horn('horn3_', 'head', (y1 - hh * 0.02, H['zc'] + hl * 0.2), [(hl * 0.17, 58)], hw * 0.12, hw * 0.11, hp) for c in pair(part)],
        rod('nose_horn', 'head', (y1 - hh * 0.32, H['z0'] + hl * 0.13), (y1 + hh * 0.06, H['z0'] + hl * 0.2), hw * 0.13, hw * 0.13, hp),
        *cheeks(H, hp, 2),
        # A beard of spikes under the jaw.
        *pair(rod('beard_r', 'jaw', (H['y0'] + hh * 0.06, H['zc'] - hl * 0.02), (H['y0'] - hh * 0.3, H['zc'] + hl * 0.12), hw * 0.1, hw * 0.1, hp, x=hw * 0.26)),
        rod('beard', 'jaw', (H['y0'] + hh * 0.12, H['z0'] + hl * 0.2), (H['y0'] - hh * 0.26, H['z0'] + hl * 0.3), hw * 0.1, hw * 0.1, hp),
    ]


ELDER = dragon(
    'elder_dragon', 'Elder Dragon', scale=1.5,
    body=(46, 36, 92), legs=(28, 12), neck=(50, 48, 21), head=(24, 20, 50),
    tail=(46, 21), wings=(72, 104, 74, 3.4), spines=(11, 2.4), tip='club', strips=(6, 10),
    crown=elder_crown, bend=(0.66, 0.34), droop=(-16, -5, 9),
    cols=dict(main='#33252e', dark='#171016', under='#c8962e', skin='#7a1c22', skin_under='#a8322a',
              bone='#2a1e26', horn='#d8c8a0', eye=G['gold'], glow=G['red'], spine='#b8a888'),
    extra=lambda H, B: [
        # Spikes on its shoulders.
        *pair(rod('pauldron_r', 'body', (B['y1'] - 3, B['z0'] + 12), (B['y1'] + 9, B['z0'] + 19), 3, 4.5, horn_paint('#d8c8a0'), x=B['x1'] - 5)),
        *pair(rod('pauldron2_r', 'body', (B['y1'] - 4, B['z0'] + 3), (B['y1'] + 5, B['z0'] + 8), 2.4, 3.6, horn_paint('#d8c8a0'), x=B['x1'] - 9)),
    ],
)


def fire_crown(H):
    hw, hh, hl, y1, z1 = H['hw'], H['hh'], H['hl'], H['y1'], H['z1']
    hp = horn_paint('#2a1e1e')
    return [
        # Horns that sweep back, then curl up.
        *[c for part in horn('horn', 'head', (y1 - hh * 0.15, z1 - hl * 0.12), [(hl * 0.36, 12), (hl * 0.3, 48), (hl * 0.2, 95)], hw * 0.33, hw * 0.24, hp, dx=hw * 0.04) for c in pair(part)],
        rod('nose_horn', 'head', (y1 - hh * 0.32, H['z0'] + hl * 0.12), (y1 + hh * 0.14, H['z0'] + hl * 0.2), hw * 0.16, hw * 0.16, hp),
        *cheeks(H, hp, 2),
    ]


FIRE = dragon(
    'fire_drake', 'Fire Drake',
    body=(21, 16, 42), legs=(13, 5.5), neck=(16, 17, 9.5), head=(9.5, 8.5, 20),
    tail=(21, 9.5), wings=(30, 44, 32, 1.6), spines=(4, 1.2), tip='spade',
    crown=fire_crown,
    cols=dict(main='#b8361e', dark='#6a1a10', under='#f0b24a', skin='#d8642a', skin_under='#f09a3a',
              bone='#7a2212', horn='#2a1e1e', eye=G['lamp'], glow=G['red']),
)


def frost_crown(H):
    hw, hh, hl, y1, z1 = H['hw'], H['hh'], H['hl'], H['y1'], H['z1']
    ice = {'all': '#e8f6ff', 'up': G['teal'], 'south': '#bfe6f6'}
    return [
        # Straight horns of ice, a second pair under them, and a fin over the skull.
        *[c for part in horn('horn', 'head', (y1 - hh * 0.15, z1 - hl * 0.12), [(hl * 0.62, 30)], hw * 0.34, hw * 0.17, ice) for c in pair(part)],
        *[c for part in horn('horn2_', 'head', (y1 - hh * 0.45, z1 - hl * 0.08), [(hl * 0.4, 8)], hw * 0.48, hw * 0.14, ice) for c in pair(part)],
        rod('fin', 'head', (y1 - hh * 0.05, H['zc'] + hl * 0.08), (y1 + hh * 0.5, z1 + hl * 0.2), 0.8, hh * 0.5, {'all': '#bfe6f6', 'up': '#e8f6ff'}),
        rod('chin_ice', 'jaw', (H['y0'] + hh * 0.1, H['z0'] + hl * 0.2), (H['y0'] - hh * 0.3, H['z0'] + hl * 0.32), hw * 0.13, hw * 0.13, ice),
    ]


FROST = dragon(
    'frost_wyvern', 'Frost Wyvern', two_legs=True,
    body=(15, 13, 38), legs=(15, 5), neck=(22, 17, 7.5), head=(8, 7, 18),
    tail=(25, 7.5), wings=(36, 54, 34, 1.5), spines=(4.5, 1), tip='blade',
    crown=frost_crown, bend=(0.7, 0.3), fingers=((6, 1.0), (30, 0.94), (56, 0.84)),
    cols=dict(main='#9ecbe8', dark='#4f7fa6', under='#f4fbff', skin='#cfe8f6', skin_under='#e8f6ff',
              bone='#5a8ab0', horn='#e8f6ff', eye=G['teal'], spine='#e8f6ff', claw='#2f4f6a'),
    extra=lambda H, B: [
        # Ice crystals on its shoulders.
        *pair(box('ice_r', 'body', (B['x1'] - 2.5, B['y1'] - 2, B['z0'] + 3), (B['x1'] + 0.5, B['y1'] + 5.5, B['z0'] + 6), {'all': '#e8f6ff', 'north': '#bfe6f6', 'up': G['teal']}, (0, 0, -22), skip=('down',))),
        *pair(box('ice2_r', 'body', (B['x1'] - 4.5, B['y1'] - 1, B['z0'] + 7.5), (B['x1'] - 2.5, B['y1'] + 3.5, B['z0'] + 9.5), {'all': '#e8f6ff', 'north': '#bfe6f6', 'up': G['teal']}, (0, 0, -10), skip=('down',))),
    ],
)


def storm_crown(H):
    hw, hh, hl, y1, z1 = H['hw'], H['hh'], H['hl'], H['y1'], H['z1']
    hp = horn_paint('#f2e8a0')
    plume = {'all': '#e8d65a', 'up': '#f6ec7a', 'south': '#c8b63a'}
    return [
        # Long horns swept nearly flat, a crest of feathers fanned over the skull, whiskers from the nose.
        *[c for part in horn('horn', 'head', (y1 - hh * 0.2, z1 - hl * 0.12), [(hl * 0.42, 8), (hl * 0.34, 20)], hw * 0.36, hw * 0.17, hp, dx=hw * 0.06) for c in pair(part)],
        *[rod(f'crest{k}', 'head', (y1 - hh * 0.05, H['zc'] + hl * (0.1 + 0.11 * k)), (y1 + hh * (0.62 - 0.08 * k), H['zc'] + hl * (0.3 + 0.2 * k)), 1.0, hh * 0.3, plume) for k in range(3)],
        *pair(bar('whisker_r', 'head', (hw * 0.28, H['z0'] + hl * 0.06), (hw * 0.95, H['z0'] + hl * 0.5), H['lip'] + hh * 0.12, 0.6, 0.6, {'all': '#f6ec7a'})),
        *cheeks(H, hp, 1),
    ]


STORM = dragon(
    'storm_dragon', 'Storm Dragon',
    body=(17, 14, 48), legs=(12, 5), neck=(17, 23, 8), head=(8.5, 7.5, 20),
    tail=(27, 8), wings=(32, 50, 29, 1.5), spines=(3, 1), tip='fork',
    crown=storm_crown, bend=(0.55, 0.4), fingers=((10, 1.0), (30, 0.84), (54, 0.66)), droop=(-10, -3, 10),
    cols=dict(main='#2f7a4a', dark='#1a4a2c', under='#e8d65a', skin='#3a8a5a', skin_under='#8ac46a',
              bone='#1a4a2c', horn='#f2e8a0', eye=G['gold'], stripe=G['lamp'], spine='#e8d65a'),
)

DRAGONS = [ELDER, FIRE, FROST, STORM]
