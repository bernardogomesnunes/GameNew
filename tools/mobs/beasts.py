"""
The kit the animals are built from (owner, 11 November: "improve their 3d
model, animations"). Each has a body in parts (chest, barrel, rump), so its
back and belly have a line to them; a neck that slopes up to a head with a
muzzle; legs with a heavy upper part against the body and a thin shank; ears
on a bone of their own so they flick; and a tail. The bone names the game
already moves (body, head, neck, tail, leg_fl ... leg_br) are kept. The
models themselves are in fauna.py.
"""
import math
from lib import *


def tube(name, bone, a, b, w, h, paint, x=0.0, grow=0.0):
    """A box `w` wide and `h` deep lying along the line from a = (y, z) to b = (y, z)."""
    (ya, za), (yb, zb) = a, b
    length = math.hypot(yb - ya, zb - za) + grow
    cy, cz = (ya + yb) / 2, (za + zb) / 2
    ang = math.degrees(math.atan2(yb - ya, za - zb))      # the front end (-z) rising is positive
    return box(name, bone, (x - w / 2, cy - h / 2, cz - length / 2), (x + w / 2, cy + h / 2, cz + length / 2), paint, (ang, 0, 0))


def skull(cols, row=1, size=2, eye=None, glint=G['tealMid'], north=None, inset=1, extra=None):
    """A head: fur, an eye on each side towards the front, and whatever `north` adds to the face."""
    def f(p, face):
        p.grain(cols)
        if extra:
            extra(p, face)
        if face in ('east', 'west'):
            x = inset if face == 'west' else p.w - inset - size
            p.rect(x, row, size, size, eye or C['ink'])
            if glint:
                p.set(x if face == 'west' else x + size - 1, row, glint)
        elif face == 'north' and north:
            north(p)
    return f


AUTO_BONES = {
    'ears': lambda H: ('head', (0, H['y1'] - 0.5, H['z1'] - 1.5)),
    'jaw': lambda H: ('head', (0, H['y0'] + 1, H['z1'] - 1)),
}


def beast(id, name, torso, leg, limbs, hide, head, neck=None, tail=None, features=None, bones=None, scale=1, rest=None):
    """
    torso   [(z0, z1, width, y0, y1[, paint])] front to back
    leg     how high the hips are
    limbs   dict(w, x, fz, hz, knee, upper=(w, into, d), hind=(w, into, d), hock, paint=(upper, shank))
            or, on two legs, dict(two=True, w, x, z, knee, upper, paint)
    head    dict(size=(w, h, d), paint, muzzle=dict(size, paint, lift), pitch, back, up, at=(y, z) without a neck)
    neck    dict(at=(y, z), to=(y, z), w, h[, paint])
    tail    (y, z), where the tail's bone is; its boxes come from `features`
    features(H, B) → more boxes; a box on 'ears' or 'jaw' gets that bone
    bones(H, B) → more bones
    """
    y0, y1 = min(s[3] for s in torso), max(s[4] for s in torso)
    z0, z1 = torso[0][0], torso[-1][1]
    w = max(s[2] for s in torso)
    B = dict(x0=-w / 2, x1=w / 2, y0=y0, y1=y1, z0=z0, z1=z1)
    out_bones = [('body', None, (0, (y0 + y1) / 2, (z0 + z1) / 2))]
    cubes = []
    for i, s in enumerate(torso):
        cubes.append(box(f'body{i}', 'body', (-s[2] / 2, s[3], s[0]), (s[2] / 2, s[4], s[1]), s[5] if len(s) > 5 else hide))

    if neck:
        out_bones.append(('neck', 'body', (0,) + tuple(neck['at'])))
        cubes.append(tube('neck', 'neck', neck['at'], neck['to'], neck['w'], neck['h'], neck.get('paint', hide), grow=neck.get('grow', 2)))
        hp = neck['to']
    else:
        hp = head['at']
    hw, hh, hd = head['size']
    up, back = head.get('up', 0.5), head.get('back', 0.3)
    H = dict(x0=-hw / 2, x1=hw / 2, y0=hp[0] - hh * (1 - up), y1=hp[0] + hh * up, z0=hp[1] - hd * (1 - back), z1=hp[1] + hd * back)
    out_bones.append(('head', 'neck' if neck else 'body', (0,) + tuple(hp)))
    cubes.append(box('head', 'head', (H['x0'], H['y0'], H['z0']), (H['x1'], H['y1'], H['z1']), head['paint']))
    mz = head.get('muzzle')
    if mz:
        mw, mh, md = mz['size']
        my = H['y0'] + mz.get('lift', 0)
        H['m'] = dict(x0=-mw / 2, x1=mw / 2, y0=my, y1=my + mh, z0=H['z0'] - md, z1=H['z0'])
        cubes.append(box('muzzle', 'head', (-mw / 2, my, H['z0'] - md), (mw / 2, my + mh, H['z0']), mz['paint']))

    up_p, shank_p = limbs['paint']
    lw, knee = limbs['w'], limbs['knee']
    if limbs.get('two'):
        spots = {'leg_l': (-limbs['x'], limbs['z'], 'upper', 0), 'leg_r': (limbs['x'], limbs['z'], 'upper', 0)}
    else:
        fx, hx = limbs['x'], limbs.get('hx', limbs['x'])
        spots = {'leg_fl': (-fx, limbs['fz'], 'upper', 0), 'leg_fr': (fx, limbs['fz'], 'upper', 0),
                 'leg_bl': (-hx, limbs['hz'], 'hind', limbs.get('hock', 0)), 'leg_br': (hx, limbs['hz'], 'hind', limbs.get('hock', 0))}
    for bname, (x, z, which, hock) in spots.items():
        uw, into, ud = limbs[which]
        out_bones.append((bname, 'body', (x, leg + limbs.get('pivot', into * 0.5), z)))
        cubes.append(box(bname + '_upper', bname, (x - uw / 2, knee, z - ud / 2), (x + uw / 2, leg + into, z + ud / 2), up_p))
        cubes.append(box(bname, bname, (x - lw / 2, 0, z + hock - lw / 2), (x + lw / 2, knee, z + hock + lw / 2), shank_p))
        if limbs.get('foot'):
            cubes += limbs['foot'](bname, x, z + hock)

    if tail:
        out_bones.append(('tail', 'body', (0,) + tuple(tail)))
    if bones:
        out_bones += bones(H, B)
    if features:
        cubes += features(H, B)
    have = {b[0] for b in out_bones}
    for c in cubes:
        if c[1] not in have:
            parent, origin = AUTO_BONES[c[1]](H)
            out_bones.append((c[1], parent, origin))
            have.add(c[1])
    r = dict(rest or {})
    if head.get('pitch'):
        r['head'] = (head['pitch'], 0, 0)
    return dict(id=id, name=name, bones=out_bones, cubes=cubes, anim={}, scale=scale, rest=r)


def sides(cube):
    """A box and its mirror on the other side, on the same bone."""
    name, bone, a, b, paint = cube[:5]
    rot = cube[5] if len(cube) > 5 else None
    if rot:
        rot = (rot[0], -rot[1], -rot[2])
    return [cube, box(name + '_m', bone, (-b[0], a[1], a[2]), (-a[0], b[1], b[2]), paint, rot)]
