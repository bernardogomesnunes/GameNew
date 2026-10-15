"""
Three test mobs (a cow, an explorer and a sky warrior), built in Blender out
of boxes with hand-placed pixel textures, the same blocky look as the world.

Runs inside Blender. tools/mobs/run.py sends it through the blender-mcp
addon's execute_code command, the way Claude would over MCP. It expects
OUT_DIR in its namespace.

Units are Blockbench's: 16 to a block, y up, the model facing -z. A face's
pixels run x right and y down as seen from outside it. Converted to
Blender's z-up on the way in, so the exported .glb comes out y-up, facing -z.

Colours are the game's palette (src/ui/styles.css). Pixels in a GLOW colour
glow: they go into an emission map as well as the colour map.
"""
import bpy, math, os
from mathutils import Euler, Vector

C = dict(
    ink='#2b1d12', paper='#f4e7c5', paper2='#e6d2a2', paper3='#d6bd85',
    wood='#8a5a32', woodLight='#a8743f', woodDark='#4a2e19',
    gold='#f1c84b', goldDark='#c79a2a', goldDeep='#93701c',
    teal='#299e8a', tealDark='#1d6e61', tealDeep='#134a42', tealLight='#62c2b0',
    steel='#e3ecea', steel2='#c9d6d3', steel3='#9fb1ad', steel4='#6f817d',
    skin='#d9a066', skinShade='#b97f4a', pink='#e79a96', pinkDark='#b86e6a',
    stoneDark='#55585c', white='#fffdf6',
)
GLOW = dict(teal='#8ff5e0', tealMid='#4fd8bf', gold='#ffe27a')
GLOW_SET = set(GLOW.values())
G = GLOW


def _hash(x, y, s):
    v = math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453
    return v - math.floor(v)


class P:
    """One face, w x h pixels."""
    def __init__(self, w, h, seed):
        self.w, self.h, self.seed = w, h, seed
        self.px = [[None] * w for _ in range(h)]

    def set(self, x, y, c):
        if c and 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = c
        return self

    def rect(self, x, y, w, h, c):
        for j in range(h):
            for i in range(w):
                self.set(x + i, y + j, c)
        return self

    def fill(self, c): return self.rect(0, 0, self.w, self.h, c)
    def row(self, y, c): return self.rect(0, y if y >= 0 else self.h + y, self.w, 1, c)
    def col(self, x, c): return self.rect(x if x >= 0 else self.w + x, 0, 1, self.h, c)

    def grain(self, cols, s=None):
        """Mottled: mostly the first colour, flecks of the others."""
        s = self.seed if s is None else s
        for y in range(self.h):
            for x in range(self.w):
                r = _hash(x, y, s)
                self.set(x, y, cols[0] if r < 0.62 or len(cols) == 1 else cols[1] if r < 0.9 or len(cols) == 2 else cols[2])
        return self

    def border(self, c, sides='tlbr'):
        if 't' in sides: self.row(0, c)
        if 'b' in sides: self.row(-1, c)
        if 'l' in sides: self.col(0, c)
        if 'r' in sides: self.col(-1, c)
        return self

    def stamp(self, lines, key, x=None, y=None):
        sw, sh = max(len(l) for l in lines), len(lines)
        ox = (self.w - sw) // 2 if x is None else x
        oy = (self.h - sh) // 2 if y is None else y
        for j, l in enumerate(lines):
            for i, ch in enumerate(l):
                if ch in key:
                    self.set(ox + i, oy + j, key[ch])
        return self


RUNE = [['.#.', '###', '.#.'], ['#.#', '.#.', '#.#'], ['##.', '.#.', '.##'], ['.#.', '#.#', '.#.']]

# --------------------------------------------------------------------------
# Painters. Each takes (p, face) and paints in place.

def grained(cols, top=None, bottom=None):
    def f(p, face):
        p.grain(cols)
        if top and face not in ('up', 'down'): p.row(0, top)
        if bottom and face not in ('up', 'down'): p.row(-1, bottom)
    return f


def solid(c):
    return lambda p, face: p.fill(c)


def crystal(p, face):
    p.fill(G['tealMid']).col(0, G['teal']).border(C['teal'], 'rb')
    if p.w > 2:
        p.col(1, G['teal'])


# --- the cow: a moon cow, cream with glowing teal rune markings -------------

def cow_body(p, face):
    p.grain([C['paper'], C['paper2'], C['paper3']])
    if face in ('east', 'west'):
        p.row(-1, C['paper3']).row(-2, C['paper3'])
        # A ring of runes along each flank, under the blanket.
        p.stamp(['..##..', '.#..#.', '#.##.#', '#.##.#', '.#..#.', '..##..'], {'#': G['tealMid']}, 2, 2)
        p.stamp(RUNE[1], {'#': G['teal']}, 13, 6)
        p.stamp(['.#', '#.'], {'#': C['teal']}, 10, 2)
    elif face == 'up':
        for y in range(1, p.h, 3):
            p.set(p.w // 2, y, G['tealMid'])
    elif face == 'down':
        p.grain([C['paper3'], C['paper2']])
    elif face == 'south':
        p.stamp(RUNE[0], {'#': G['tealMid']}, None, 2)


def cow_blanket(p, face):
    p.grain([C['teal'], C['tealDark'], C['teal']])
    if face in ('east', 'west'):
        p.border(C['gold'], 'b').row(-2, C['goldDark'])
        for x in range(1, p.w, 2):
            p.set(x, p.h - 1, C['goldDeep'])
        p.stamp(['.#.', '#.#', '.#.'], {'#': G['gold']}, None, 1)
        p.set(p.w // 2, 2, G['teal'])
    elif face == 'up':
        p.border(C['gold'])
        p.stamp(['..#..', '.#.#.', '#.#.#', '.#.#.', '..#..'], {'#': G['gold']})
    elif face in ('north', 'south'):
        p.border(C['gold'], 'b')


def cow_head(p, face):
    p.grain([C['paper'], C['paper2']])
    if face == 'north':
        # Eyes with a glowing teal iris, a forehead rune.
        for ex in (1, p.w - 3):
            p.rect(ex, 3, 2, 2, C['ink']).set(ex + (1 if ex == 1 else 0), 3, G['teal'])
        p.stamp(['.#.', '###', '.#.'], {'#': G['tealMid']}, None, 0)
        p.row(-1, C['paper3'])
    elif face in ('east', 'west'):
        p.set(1 if face == 'west' else p.w - 2, 3, C['ink'])


def cow_snout(p, face):
    p.grain([C['pink'], '#e08f8b'])
    if face == 'north':
        p.set(1, 1, C['pinkDark']).set(p.w - 2, 1, C['pinkDark']).row(-1, C['pinkDark'])


def horn(p, face):
    p.grain([C['gold'], C['goldDark']])
    if face not in ('up', 'down'):
        p.col(0, C['goldDark'])


def horn_tip(p, face):
    p.grain([C['gold'], C['goldDark']])
    p.row(0, G['gold'])


def cow_leg(p, face):
    p.grain([C['paper'], C['paper2']])
    if face not in ('up', 'down'):
        p.row(-1, C['woodDark']).row(-2, C['woodDark']).row(-3, C['wood'])
        p.row(4, C['gold']).set(1, 4, G['gold'])
    elif face == 'down':
        p.fill(C['woodDark'])


def ear(p, face):
    p.grain([C['paper2'], C['paper3']])
    if face == 'north':
        p.fill(C['pink']).border(C['paper2'])


def tail(p, face):
    p.grain([C['paper2'], C['paper3']])


def tail_tuft(p, face):
    p.grain([G['tealMid'], C['teal'], G['teal']])


MOON_COW = dict(
    id='moon_cow', name='Moon Cow',
    bones=[
        ('body', None, (0, 15, 0)),
        ('head', 'body', (0, 18, -9)),
        ('crystal', 'head', (0, 27, -12)),
        ('leg_fl', 'body', (-4, 10, -7)), ('leg_fr', 'body', (4, 10, -7)),
        ('leg_bl', 'body', (-4, 10, 7)), ('leg_br', 'body', (4, 10, 7)),
        ('tail', 'body', (0, 19, 9)),
    ],
    cubes=[
        ('body', 'body', (-6, 10, -9), (6, 20, 9), {'all': cow_body}),
        ('blanket', 'body', (-6.5, 14, -3), (6.5, 20.5, 4), {'all': cow_blanket}),
        ('udder', 'body', (-2, 9, 3), (2, 10, 7), {'all': solid(C['pink'])}),
        ('head', 'head', (-4, 13, -15), (4, 22, -9), {'all': cow_head}),
        ('snout', 'head', (-3, 13, -16), (3, 17, -15), {'all': cow_snout}),
        ('horn_l', 'head', (-7, 20, -13), (-4, 22, -11), {'all': horn}),
        ('horn_l_tip', 'head', (-8, 21, -13), (-6, 25, -11), {'all': horn_tip}),
        ('horn_r', 'head', (4, 20, -13), (7, 22, -11), {'all': horn}),
        ('horn_r_tip', 'head', (6, 21, -13), (8, 25, -11), {'all': horn_tip}),
        ('ear_l', 'head', (-7, 17, -12), (-4, 19, -11), {'all': ear}),
        ('ear_r', 'head', (4, 17, -12), (7, 19, -11), {'all': ear}),
        ('crystal', 'crystal', (-1.5, 24.5, -13.5), (1.5, 29, -10.5), {'all': crystal}, (0, 45, 0)),
        ('crystal_tip', 'crystal', (-0.75, 29, -12.75), (0.75, 31, -11.25), {'all': crystal}, (0, 45, 0)),
        ('crystal_foot', 'crystal', (-0.75, 23, -12.75), (0.75, 24.5, -11.25), {'all': crystal}, (0, 45, 0)),
        ('leg_fl', 'leg_fl', (-6, 0, -9), (-2, 10, -5), {'all': cow_leg}),
        ('leg_fr', 'leg_fr', (2, 0, -9), (6, 10, -5), {'all': cow_leg}),
        ('leg_bl', 'leg_bl', (-6, 0, 5), (-2, 10, 9), {'all': cow_leg}),
        ('leg_br', 'leg_br', (2, 0, 5), (6, 10, 9), {'all': cow_leg}),
        ('tail', 'tail', (-0.5, 12, 9), (0.5, 19, 10), {'all': tail}),
        ('tail_tuft', 'tail', (-1, 10, 8.5), (1, 13, 10.5), {'all': tail_tuft}),
    ],
    # (bone, [(frame, (rx, ry, rz))]) in degrees, 24 fps, a 1 s walk cycle.
    anim={
        'leg_fl': [(1, (25, 0, 0)), (13, (-25, 0, 0)), (25, (25, 0, 0))],
        'leg_br': [(1, (25, 0, 0)), (13, (-25, 0, 0)), (25, (25, 0, 0))],
        'leg_fr': [(1, (-25, 0, 0)), (13, (25, 0, 0)), (25, (-25, 0, 0))],
        'leg_bl': [(1, (-25, 0, 0)), (13, (25, 0, 0)), (25, (-25, 0, 0))],
        'head': [(1, (0, 0, 0)), (7, (5, 0, 0)), (13, (0, 0, 0)), (19, (5, 0, 0)), (25, (0, 0, 0))],
        'tail': [(1, (0, 0, 12)), (13, (0, 0, -12)), (25, (0, 0, 12))],
        'crystal': [(1, (0, 0, 0)), (13, (0, 90, 0)), (25, (0, 180, 0))],
    },
)

# --- the explorer: wide hat, teal scarf, a lantern and a crystal staff -----

def ex_face(p, face):
    p.grain([C['skin'], '#d49a60'])
    if face == 'north':
        p.row(0, C['woodDark']).set(0, 1, C['woodDark']).set(7, 1, C['woodDark'])
        p.rect(1, 3, 2, 1, C['woodDark']).rect(5, 3, 2, 1, C['woodDark'])   # brows
        p.set(1, 4, C['white']).set(2, 4, C['ink']).set(5, 4, C['ink']).set(6, 4, C['white'])
        p.set(3, 5, C['skinShade']).set(4, 5, C['skinShade'])               # nose
        p.rect(2, 6, 4, 1, C['woodDark']).set(3, 7, C['woodDark']).set(4, 7, C['woodDark'])  # beard
        p.set(1, 6, C['skinShade']).set(6, 6, C['skinShade'])
    elif face == 'south':
        p.grain([C['woodDark'], C['wood'], '#3a2414'])
        p.row(-1, C['skinShade'])
    elif face in ('east', 'west'):
        p.rect(0, 0, p.w, 3, C['woodDark'])
        p.rect(0 if face == 'west' else p.w - 3, 3, 3, 4, C['woodDark'])
        p.set(6 if face == 'east' else 1, 3, C['woodDark'])
    elif face == 'up':
        p.grain([C['woodDark'], C['wood']])


def hat_brim(p, face):
    p.grain([C['wood'], C['woodLight'], C['woodDark']])
    if face == 'down':
        p.fill(C['woodDark'])


def hat_crown(p, face):
    p.grain([C['wood'], C['woodLight']])
    if face not in ('up', 'down'):
        p.row(-1, G['tealMid']).row(-2, C['tealDark'])
        if face == 'north':
            p.stamp(['.#.', '#.#'], {'#': G['gold']}, None, p.h - 2)


def feather(p, face):
    p.grain([C['paper'], C['white']])
    p.row(0, G['teal']).row(1, G['tealMid'])
    p.col(0, C['paper3'])


def ex_torso(p, face):
    p.grain([C['wood'], C['woodLight']])
    if face == 'north':
        p.rect(2, 0, 4, p.h, C['paper2'])                       # shirt
        p.col(2, C['woodDark']).col(5, C['woodDark'])           # coat edges
        for y in (3, 6):
            p.set(4, y, C['goldDark'])                          # buttons
        p.row(8, C['woodDark']).row(9, C['woodDark']).rect(3, 8, 2, 2, C['gold'])  # belt
        p.set(4, 9, G['gold'])
    elif face == 'south':
        p.row(8, C['woodDark']).row(9, C['woodDark'])
    elif face in ('east', 'west'):
        p.row(8, C['woodDark']).row(9, C['woodDark'])


def coat_tail(p, face):
    p.grain([C['wood'], C['woodLight']])
    p.row(-1, C['woodDark'])
    if face == 'north':
        p.rect(3, 0, 3, p.h, None)
        p.col(3, C['woodDark']).col(5, C['woodDark'])


def scarf(p, face):
    p.grain([C['teal'], C['tealLight']])
    for x in range(0, p.w, 3):
        p.set(x, 0, C['tealDark'])
    p.row(-1, C['tealDark'])


def scarf_end(p, face):
    p.grain([C['teal'], C['tealLight']])
    p.row(-1, G['tealMid']).row(-2, C['gold'])


def ex_arm(p, face):
    p.grain([C['wood'], C['woodLight']])
    if face not in ('up', 'down'):
        p.row(-4, C['woodDark'])
        p.rect(0, p.h - 3, p.w, 3, C['skin'])
        p.set(1, p.h - 1, C['skinShade'])
    elif face == 'down':
        p.fill(C['skin'])


def ex_leg(p, face):
    p.grain([C['tealDeep'], '#1a564d'])
    if face not in ('up', 'down'):
        p.rect(0, p.h - 5, p.w, 5, C['woodDark'])
        p.row(-5, C['paper3']).row(-1, C['ink'])
        p.set(1, p.h - 3, C['wood'])
    elif face == 'down':
        p.fill(C['ink'])


def backpack(p, face):
    p.grain([C['woodLight'], C['wood']])
    if face == 'south':
        p.border(C['woodDark']).rect(1, 2, p.w - 2, 3, C['wood']).row(2, C['woodDark'])
        p.set(p.w // 2, 4, C['gold'])
        p.stamp(['#.#', '.#.'], {'#': G['tealMid']}, None, p.h - 3)
    elif face in ('east', 'west'):
        p.col(1, C['woodDark']).border(C['woodDark'], 'tb')


def bedroll(p, face):
    p.stripes = None
    p.grain([C['tealLight'], C['teal']])
    if face in ('east', 'west'):
        p.fill(C['tealLight']).stamp(['.##.', '#..#', '#..#', '.##.'], {'#': C['tealDark']}, 0, 0)
    else:
        p.col(2, C['woodDark']).col(-3, C['woodDark'])


def lantern(p, face):
    p.fill(G['tealMid'])
    p.border(C['goldDark'])
    p.set(p.w // 2, p.h // 2, G['teal'])


def lantern_cap(p, face):
    p.grain([C['gold'], C['goldDark']])


def staff(p, face):
    p.grain([C['wood'], C['woodDark']])
    for y in (2, 26, 34):
        p.row(y, C['gold'])


def staff_head(p, face):
    p.fill(G['teal']).border(G['tealMid']).set(0, 0, C['white'])


HUMAN_BONES = [
    ('body', None, (0, 12, 0)),
    ('head', 'body', (0, 24, 0)),
    ('arm_l', 'body', (-6, 22, 0)), ('arm_r', 'body', (6, 22, 0)),
    ('leg_l', None, (-2, 12, 0)), ('leg_r', None, (2, 12, 0)),
]
HUMAN_WALK = {
    'leg_l': [(1, (30, 0, 0)), (13, (-30, 0, 0)), (25, (30, 0, 0))],
    'leg_r': [(1, (-30, 0, 0)), (13, (30, 0, 0)), (25, (-30, 0, 0))],
    'arm_l': [(1, (-25, 0, 0)), (13, (25, 0, 0)), (25, (-25, 0, 0))],
    'arm_r': [(1, (12, 0, 0)), (13, (-12, 0, 0)), (25, (12, 0, 0))],
    'head': [(1, (0, -4, 0)), (13, (0, 4, 0)), (25, (0, -4, 0))],
}

EXPLORER = dict(
    id='explorer', name='Explorer',
    bones=HUMAN_BONES,
    cubes=[
        ('leg_l', 'leg_l', (-4, 0, -2), (0, 12, 2), {'all': ex_leg}),
        ('leg_r', 'leg_r', (0, 0, -2), (4, 12, 2), {'all': ex_leg}),
        ('torso', 'body', (-4, 12, -2), (4, 24, 2), {'all': ex_torso}),
        ('coat_tail', 'body', (-4.5, 8, -2.5), (4.5, 12, 2.5), {'all': coat_tail}),
        ('scarf', 'body', (-4.5, 22, -2.5), (4.5, 24.5, 2.5), {'all': scarf}),
        ('scarf_end', 'body', (1, 16, -3.25), (3, 22.5, -2.5), {'all': scarf_end}),
        ('backpack', 'body', (-3.5, 12, 2), (3.5, 21, 5), {'all': backpack}),
        ('bedroll', 'body', (-4.5, 21, 2.5), (4.5, 24.5, 6), {'all': bedroll}),
        ('arm_l', 'arm_l', (-8, 12, -2), (-4, 24, 2), {'all': ex_arm}),
        ('lantern_cap', 'arm_l', (-7, 11, -1), (-5, 12, 1), {'all': lantern_cap}),
        ('lantern', 'arm_l', (-7.5, 7, -1.5), (-4.5, 11, 1.5), {'all': lantern}),
        ('arm_r', 'arm_r', (4, 12, -2), (8, 24, 2), {'all': ex_arm}),
        ('staff', 'arm_r', (5.5, -1, -1.5), (6.5, 37, -0.5), {'all': staff}),
        ('staff_head', 'arm_r', (4.75, 37, -2.25), (7.25, 41, 0.25), {'all': staff_head}, (0, 45, 0)),
        ('head', 'head', (-4, 24, -4), (4, 32, 4), {'all': ex_face}),
        ('hat_brim', 'head', (-6.5, 31, -6.5), (6.5, 32, 6.5), {'all': hat_brim}),
        ('hat_crown', 'head', (-4.5, 32, -4.5), (4.5, 36, 4.5), {'all': hat_crown}),
        ('feather', 'head', (4.5, 33, -1), (5.5, 39, 1), {'all': feather}, (0, 0, -15)),
    ],
    anim=HUMAN_WALK,
)

# --- the sky warrior: white steel and gold, teal light, feathered wings ----

def sw_helm(p, face):
    p.grain([C['steel'], C['steel2']])
    if face == 'north':
        p.row(0, C['gold'])
        p.rect(1, 4, p.w - 2, 2, C['ink'])                                   # visor slit
        p.set(2, 4, G['teal']).set(3, 4, G['tealMid']).set(p.w - 4, 4, G['tealMid']).set(p.w - 3, 4, G['teal'])
        p.rect(p.w // 2, 1, 1, 6, C['gold'])                                 # nose guard
        p.rect(2, 7, p.w - 4, 1, C['steel3'])
        p.row(-1, C['steel3']).col(0, C['gold']).col(-1, C['gold'])
    elif face in ('east', 'west', 'south'):
        p.row(0, C['gold']).row(-1, C['steel3'])
        p.stamp(['#.', '##'], {'#': C['gold']}, 3, 4)
    elif face == 'up':
        p.col(p.w // 2, C['gold'])


def crest(p, face):
    p.grain([C['gold'], C['goldDark']])
    if face in ('east', 'west'):
        for x in range(0, p.w, 2):
            p.set(x, 0, G['gold'])


def plume(p, face):
    p.grain([C['teal'], C['tealLight']])
    p.row(0, G['teal'])


def helm_wing(p, face):
    p.grain([C['white'], C['steel2']])
    p.col(0, C['gold'])
    p.row(0, G['tealMid'])


def sw_torso(p, face):
    p.grain([C['steel'], C['steel2']])
    if face == 'north':
        p.border(C['gold'], 'lr').row(0, C['gold'])
        p.stamp(['..#..', '.#.#.', '#.#.#', '.#.#.', '..#..'], {'#': C['gold'], '.': None}, None, 2)
        p.set(3, 4, G['teal']).set(4, 4, G['teal']).set(3, 5, G['teal']).set(4, 5, G['teal'])
        p.row(9, C['goldDark']).row(10, C['gold']).set(4, 10, G['gold'])
    else:
        p.row(9, C['goldDark']).row(10, C['gold'])
        if face == 'south':
            p.col(p.w // 2, C['steel3'])


def tabard(p, face):
    p.grain([C['teal'], C['tealDark']])
    p.border(C['gold'], 'lrb')
    if face == 'north':
        p.stamp(['.#.', '###', '.#.'], {'#': G['gold']}, None, 1)


def pauldron(p, face):
    p.grain([C['steel'], C['steel2']])
    if face not in ('up', 'down'):
        p.row(-1, C['gold']).row(0, C['white'])
        p.set(p.w // 2, p.h // 2, G['tealMid'])
    elif face == 'up':
        p.border(C['gold'])


def sw_arm(p, face):
    p.grain([C['steel3'], C['steel4']])                  # mail
    for y in range(1, p.h, 2):
        for x in range(y % 4 // 2, p.w, 2):
            p.set(x, y, C['steel2'])
    if face not in ('up', 'down'):
        p.rect(0, p.h - 5, p.w, 5, C['gold']).row(-5, C['goldDark']).row(-1, C['goldDeep'])  # gauntlet
    elif face == 'down':
        p.fill(C['goldDark'])


def sw_leg(p, face):
    p.grain([C['steel'], C['steel2']])
    if face not in ('up', 'down'):
        p.row(4, C['gold']).set(1, 4, G['gold'])                # knee
        p.rect(0, p.h - 3, p.w, 3, C['steel3']).row(-1, C['steel4'])
        p.col(0, C['steel2'])
    elif face == 'down':
        p.fill(C['steel4'])


def wing(p, face):
    if face in ('north', 'south'):
        # Rows of feathers, gold edged, glowing at the tips.
        p.grain([C['white'], C['steel']])
        for y in range(p.h):
            for x in range(p.w):
                if (x + (y // 3)) % 4 == 0:
                    p.set(x, y, C['steel3'])
                elif y % 3 == 2:
                    p.set(x, y, C['steel2'])
        p.row(0, C['gold']).row(1, C['goldDark'])
        for x in range(0, p.w, 2):
            depth = p.h - 1 - (x % 4)
            p.set(x, depth, G['tealMid'])
            p.set(x, min(depth + 1, p.h - 1), G['teal'])
    else:
        p.grain([C['steel2'], C['steel3']])


def spear_shaft(p, face):
    p.grain([C['steel2'], C['steel3']])
    for y in range(0, p.h, 6):
        p.row(y, C['gold'])


def spear_head(p, face):
    p.fill(G['teal']).border(G['tealMid'], 'lr').set(0, 0, C['white'])


def spear_guard(p, face):
    p.grain([C['gold'], C['goldDark']])


def shield(p, face):
    if face == 'west':
        p.grain([C['steel'], C['steel2']]).border(C['gold'])
        p.stamp(['...#...', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '...#...'],
                {'#': C['gold']}, None, None)
        cx, cy = p.w // 2, p.h // 2
        p.set(cx, cy, G['teal']).set(cx - 1, cy, G['tealMid']).set(cx + 1, cy, G['tealMid'])
        p.set(cx, cy - 1, G['tealMid']).set(cx, cy + 1, G['tealMid'])
    else:
        p.fill(C['gold'])


SKY = dict(
    id='sky_warrior', name='Sky Warrior',
    bones=HUMAN_BONES + [('wing_l', 'body', (-2, 22, 2)), ('wing_r', 'body', (2, 22, 2))],
    cubes=[
        ('leg_l', 'leg_l', (-4, 0, -2), (0, 12, 2), {'all': sw_leg}),
        ('leg_r', 'leg_r', (0, 0, -2), (4, 12, 2), {'all': sw_leg}),
        ('torso', 'body', (-4, 12, -2), (4, 24, 2), {'all': sw_torso}),
        ('tabard', 'body', (-2, 6, -2.75), (2, 14, -2), {'all': tabard}),
        ('pauldron_l', 'arm_l', (-9, 21, -3), (-4, 25, 3), {'all': pauldron}),
        ('pauldron_r', 'arm_r', (4, 21, -3), (9, 25, 3), {'all': pauldron}),
        ('arm_l', 'arm_l', (-8, 12, -2), (-4, 24, 2), {'all': sw_arm}),
        ('shield', 'arm_l', (-10, 9, -6), (-9, 23, 6), {'all': shield}),
        ('arm_r', 'arm_r', (4, 12, -2), (8, 24, 2), {'all': sw_arm}),
        ('spear', 'arm_r', (5.5, -2, -1.5), (6.5, 36, -0.5), {'all': spear_shaft}),
        ('spear_guard', 'arm_r', (4.5, 35, -2.5), (7.5, 36, 0.5), {'all': spear_guard}),
        ('spear_head', 'arm_r', (5, 36, -2), (7, 42, 0), {'all': spear_head}),
        ('head', 'head', (-4.5, 24, -4.5), (4.5, 33, 4.5), {'all': sw_helm}),
        ('crest', 'head', (-0.5, 33, -4), (0.5, 35, 4.5), {'all': crest}),
        ('plume', 'head', (-0.5, 33, 3.5), (0.5, 38, 5.5), {'all': plume}),
        ('helm_wing_l', 'head', (-6, 29, -1), (-4.5, 35, 2.5), {'all': helm_wing}),
        ('helm_wing_r', 'head', (4.5, 29, -1), (6, 35, 2.5), {'all': helm_wing}),
        ('wing_l', 'wing_l', (-14, 17, 2.5), (-2, 28, 3.5), {'all': wing}),
        ('wing_l_low', 'wing_l', (-10, 9, 2.5), (-2, 17, 3.5), {'all': wing}),
        ('wing_r', 'wing_r', (2, 17, 2.5), (14, 28, 3.5), {'all': wing}),
        ('wing_r_low', 'wing_r', (2, 9, 2.5), (10, 17, 3.5), {'all': wing}),
    ],
    rest={'wing_l': (0, 40, -12), 'wing_r': (0, -40, 12)},
    anim=dict(HUMAN_WALK, **{
        'arm_r': [(1, (6, 0, 0)), (13, (-6, 0, 0)), (25, (6, 0, 0))],
        'arm_l': [(1, (-10, 0, 0)), (13, (10, 0, 0)), (25, (-10, 0, 0))],
        'wing_l': [(1, (0, 40, -12)), (7, (0, 60, -18)), (13, (0, 40, -12)), (19, (0, 60, -18)), (25, (0, 40, -12))],
        'wing_r': [(1, (0, -40, 12)), (7, (0, -60, 18)), (13, (0, -40, 12)), (19, (0, -60, 18)), (25, (0, -40, 12))],
    }),
)

# --- the everyday cow: brown and cream, ivory horns, a glint in the eye --

BROWN, BROWN2, BROWN3 = '#7a5a44', '#8c6a55', '#5e4434'
CREAM, CREAM2 = '#efe6d8', '#ddd2c0'
IVORY, IVORY2 = '#e8dcc0', '#c9b896'


def patches(p, spots, cols=(CREAM, CREAM2)):
    """Cream patches: (x, y, w, h) blobs with their corners knocked off."""
    for x, y, w, h in spots:
        p.rect(x, y, w, h, cols[0])
        for cx, cy in ((x, y), (x + w - 1, y), (x, y + h - 1), (x + w - 1, y + h - 1)):
            p.set(cx, cy, BROWN)
        p.set(x + 1, y + h - 2, cols[1])


def plain_body(p, face):
    p.grain([BROWN2, BROWN, BROWN3])
    if face == 'east':
        patches(p, [(2, 1, 6, 5), (11, 4, 5, 4)])
    elif face == 'west':
        patches(p, [(9, 1, 6, 5), (2, 5, 5, 4)])
    elif face == 'up':
        patches(p, [(3, 2, 5, 6), (6, 11, 4, 5)])
    elif face == 'down':
        p.grain([CREAM2, CREAM])
    if face in ('east', 'west', 'north', 'south'):
        p.row(-1, BROWN3)


def plain_head(p, face):
    p.grain([CREAM, CREAM2])
    if face == 'north':
        p.rect(0, 0, 3, 5, BROWN2).set(3, 0, BROWN2).set(0, 5, BROWN2)   # a brown patch round one eye
        for ex in (1, p.w - 3):
            p.rect(ex, 3, 2, 2, C['ink'])
            p.set(ex + (1 if ex == 1 else 0), 3, G['tealMid'])          # the one glint of magic
    elif face in ('east', 'west'):
        p.set(1 if face == 'west' else p.w - 2, 3, C['ink'])
        if face == 'west':
            p.rect(0, 0, 3, 4, BROWN2)
    elif face == 'up':
        p.rect(0, 0, p.w, 2, BROWN2)


def plain_horn(p, face):
    p.grain([IVORY, IVORY2])


def plain_horn_tip(p, face):
    p.grain([IVORY, IVORY2])
    p.row(0, C['woodDark'])


def plain_leg(p, face):
    p.grain([BROWN2, BROWN])
    if face not in ('up', 'down'):
        if face in ('north', 'south'):
            p.rect(0, 2, p.w, 4, CREAM)
        p.row(-1, C['ink']).row(-2, C['woodDark']).row(-3, C['woodDark'])
    elif face == 'down':
        p.fill(C['ink'])


def plain_ear(p, face):
    p.grain([BROWN2, BROWN])
    if face == 'north':
        p.fill(C['pink']).border(BROWN2)


def plain_tail(p, face):
    p.grain([BROWN2, BROWN])


def plain_tuft(p, face):
    p.grain([C['woodDark'], '#3a2414'])


COW = dict(
    id='cow', name='Cow',
    bones=[b for b in MOON_COW['bones'] if b[0] != 'crystal'],
    cubes=[
        ('body', 'body', (-6, 10, -9), (6, 20, 9), {'all': plain_body}),
        ('udder', 'body', (-2, 9, 3), (2, 10, 7), {'all': solid(C['pink'])}),
        ('head', 'head', (-4, 13, -15), (4, 22, -9), {'all': plain_head}),
        ('snout', 'head', (-3, 13, -16), (3, 17, -15), {'all': cow_snout}),
        ('horn_l', 'head', (-7, 20, -13), (-4, 22, -11), {'all': plain_horn}),
        ('horn_l_tip', 'head', (-8, 21, -13), (-6, 24, -11), {'all': plain_horn_tip}),
        ('horn_r', 'head', (4, 20, -13), (7, 22, -11), {'all': plain_horn}),
        ('horn_r_tip', 'head', (6, 21, -13), (8, 24, -11), {'all': plain_horn_tip}),
        ('ear_l', 'head', (-7, 17, -12), (-4, 19, -11), {'all': plain_ear}),
        ('ear_r', 'head', (4, 17, -12), (7, 19, -11), {'all': plain_ear}),
        ('leg_fl', 'leg_fl', (-6, 0, -9), (-2, 10, -5), {'all': plain_leg}),
        ('leg_fr', 'leg_fr', (2, 0, -9), (6, 10, -5), {'all': plain_leg}),
        ('leg_bl', 'leg_bl', (-6, 0, 5), (-2, 10, 9), {'all': plain_leg}),
        ('leg_br', 'leg_br', (2, 0, 5), (6, 10, 9), {'all': plain_leg}),
        ('tail', 'tail', (-0.5, 12, 9), (0.5, 19, 10), {'all': plain_tail}),
        ('tail_tuft', 'tail', (-1, 10, 8.5), (1, 13, 10.5), {'all': plain_tuft}),
    ],
    anim={k: v for k, v in MOON_COW['anim'].items() if k != 'crystal'},
)

MODELS = [COW, MOON_COW, EXPLORER, SKY]

# --------------------------------------------------------------------------
# Building.

FACES = ['north', 'east', 'south', 'west', 'up', 'down']
S = 1 / 16


def to_blender(v):
    """Blockbench (x, y up, z) to Blender (x, y, z up), facing -z → +y."""
    return Vector((v[0] * S, -v[2] * S, v[1] * S))


def bb_euler(r):
    return Euler((math.radians(r[0]), math.radians(r[1]), math.radians(r[2])), 'ZYX')


def blender_rot(r):
    """A Blockbench rotation (degrees about x, y, z) as a Blender euler."""
    return Euler((math.radians(r[0]), math.radians(-r[2]), math.radians(r[1])), 'XYZ')


def face_size(face, a, b):
    d = [max(1, math.ceil(abs(b[i] - a[i]) - 1e-6)) for i in range(3)]
    return {'north': (d[0], d[1]), 'south': (d[0], d[1]), 'east': (d[2], d[1]), 'west': (d[2], d[1]),
            'up': (d[0], d[2]), 'down': (d[0], d[2])}[face]


def corners(face, a, b):
    x0, y0, z0 = a
    x1, y1, z1 = b
    return {  # TL, TR, BR, BL seen from outside
        'north': [(x1, y1, z0), (x0, y1, z0), (x0, y0, z0), (x1, y0, z0)],
        'south': [(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)],
        'east': [(x1, y1, z1), (x1, y1, z0), (x1, y0, z0), (x1, y0, z1)],
        'west': [(x0, y1, z0), (x0, y1, z1), (x0, y0, z1), (x0, y0, z0)],
        'up': [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)],
        'down': [(x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0)],
    }[face]


def hex_rgba(h):
    return [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)] + [1.0]


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def make_image(name, W, H, grid, glow_only=False):
    img = bpy.data.images.new(name, W, H, alpha=True)
    img.colorspace_settings.name = 'sRGB'
    flat = []
    for y in range(H - 1, -1, -1):      # Blender images start at the bottom row
        for x in range(W):
            c = grid[y][x]
            if glow_only:
                c = c if c in GLOW_SET else '#000000'
            flat += hex_rgba(c) if c else [0, 0, 0, 0 if not glow_only else 1]
    img.pixels[:] = flat
    img.pack()
    return img


def build(model, x_offset=0.0):
    tiles = []
    for ci, cube in enumerate(model['cubes']):
        name, bone, a, b, paint = cube[:5]
        for fi, face in enumerate(FACES):
            w, h = face_size(face, a, b)
            p = P(w, h, ci * 7 + fi + 1)
            fn = paint.get(face) or paint.get('all')
            fn(p, face) if callable(fn) else p.fill(fn)
            tiles.append(dict(ci=ci, face=face, w=w, h=h, p=p))
    W = 128
    x = y = row_h = 0
    for t in sorted(tiles, key=lambda t: -t['h']):
        if x + t['w'] > W:
            x, y, row_h = 0, y + row_h, 0
        t['u'], t['v'] = x, y
        x += t['w']
        row_h = max(row_h, t['h'])
    H = 16
    while H < y + row_h:
        H *= 2
    grid = [[None] * W for _ in range(H)]
    for t in tiles:
        for j in range(t['h']):
            for i in range(t['w']):
                grid[t['v'] + j][t['u'] + i] = t['p'].px[j][i]

    colour = make_image(f"{model['id']}_colour", W, H, grid)
    glow = make_image(f"{model['id']}_glow", W, H, grid, glow_only=True)

    mat = bpy.data.materials.new(f"{model['id']}_mat")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.9
    tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = colour; tc.interpolation = 'Closest'
    tg = nt.nodes.new('ShaderNodeTexImage'); tg.image = glow; tg.interpolation = 'Closest'
    nt.links.new(tc.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tg.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 3.0

    # Bones as empties, so the .glb keeps the hierarchy and the pivots.
    root = bpy.data.objects.new(model['id'], None)
    bpy.context.collection.objects.link(root)
    root.location.x = x_offset
    origins, empties = {}, {}
    for bname, parent, origin in model['bones']:
        e = bpy.data.objects.new(f"{model['id']}_{bname}", None)
        e.empty_display_size = 0.05
        bpy.context.collection.objects.link(e)
        e.parent = empties[parent] if parent else root
        po = origins[parent] if parent else (0, 0, 0)
        e.location = to_blender([origin[i] - po[i] for i in range(3)])
        e.rotation_mode = 'XYZ'
        e.rotation_euler = blender_rot(model.get('rest', {}).get(bname, (0, 0, 0)))
        origins[bname], empties[bname] = origin, e

    tri = 0
    for ci, cube in enumerate(model['cubes']):
        name, bone, a, b, paint = cube[:5]
        rot = cube[5] if len(cube) > 5 else None
        centre = Vector([(a[i] + b[i]) / 2 for i in range(3)])
        pivot = Vector(origins[bone])
        verts, faces, uvs = [], [], []
        for face in FACES:
            t = next(t for t in tiles if t['ci'] == ci and t['face'] == face)
            cs = [Vector(c) for c in corners(face, a, b)]
            if rot:
                m = bb_euler(rot).to_matrix()
                cs = [m @ (c - centre) + centre for c in cs]
            tl, tr, br, bl = cs
            base = len(verts)
            for c in (tl, bl, br, tr):         # counter-clockwise from outside
                verts.append(to_blender(c - pivot))
            faces.append((base, base + 1, base + 2, base + 3))
            u1, v1, u2, v2 = t['u'], t['v'], t['u'] + t['w'], t['v'] + t['h']
            uvs += [(u1 / W, 1 - v1 / H), (u1 / W, 1 - v2 / H), (u2 / W, 1 - v2 / H), (u2 / W, 1 - v1 / H)]
        mesh = bpy.data.meshes.new(f"{model['id']}_{name}")
        mesh.from_pydata([tuple(v) for v in verts], [], faces)
        uv = mesh.uv_layers.new(name='UVMap')
        for li, loop in enumerate(mesh.loops):
            uv.data[li].uv = uvs[loop.vertex_index]
        mesh.materials.append(mat)
        ob = bpy.data.objects.new(mesh.name, mesh)
        bpy.context.collection.objects.link(ob)
        ob.parent = empties[bone]
        tri += 12
    return dict(root=root, empties=empties, atlas=(W, H), triangles=tri, cubes=len(model['cubes']))


def animate(model, empties):
    rest = model.get('rest', {})
    for bname, keys in model.get('anim', {}).items():
        e = empties[bname]
        for frame, r in keys:
            e.rotation_euler = blender_rot(r)
            e.keyframe_insert('rotation_euler', frame=frame)
        e.rotation_euler = blender_rot(rest.get(bname, (0, 0, 0)))
        if e.animation_data and e.animation_data.action:
            e.animation_data.action.name = f"{model['id']}_walk"


def clear_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.actions, bpy.data.cameras, bpy.data.lights):
        for item in list(coll):
            coll.remove(item)


def export_each(out_dir):
    """One .glb per model, with its walk cycle."""
    stats = {}
    for model in MODELS:
        clear_scene()
        bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, 25
        bpy.context.scene.render.fps = 24
        info = build(model)
        animate(model, info['empties'])
        path = os.path.join(out_dir, f"{model['id']}.glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_animations=True,
                                  export_animation_mode='ACTIVE_ACTIONS', export_apply=False, export_yup=True)
        stats[model['id']] = dict(cubes=info['cubes'], triangles=info['triangles'], atlas=info['atlas'],
                                  kb=round(os.path.getsize(path) / 1024, 1))
    return stats


def light(sc, time):
    """Day: the game's pale teal sky. Dusk: low warm sun, blue sky, so the glow shows."""
    sun = bpy.data.objects['sun']
    bg = sc.world.node_tree.nodes['Background']
    if time == 'dusk':
        sun.data.energy = 0.9
        sun.data.color = (1.0, 0.72, 0.5)
        sun.rotation_euler = Euler((math.radians(75), 0, math.radians(120)), 'XYZ')
        bg.inputs['Color'].default_value = [srgb_to_linear(v) for v in hex_rgba('#2d4660')[:3]] + [1]
        bg.inputs['Strength'].default_value = 0.55
    else:
        sun.data.energy = 2.3
        bg.inputs['Strength'].default_value = 0.7


def render_lineup(out_dir, angle_deg, name, samples=64, time='day'):
    """All three side by side, lit like a sunny day in the game."""
    clear_scene()
    sc = bpy.context.scene
    sc.frame_set(1)
    xs = {'cow': 2.3, 'moon_cow': 0.75, 'explorer': -0.65, 'sky_warrior': -1.95}
    for model in MODELS:
        info = build(model, xs[model['id']])
        info['root'].rotation_euler.z = math.radians(angle_deg)

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (0.15, 12.5, 1.75)
    cam.rotation_euler = Euler((math.radians(86), 0, math.radians(180)), 'XYZ')
    sc.camera = cam

    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.2
    sun.data.angle = math.radians(8)
    sun.rotation_euler = Euler((math.radians(50), 0, math.radians(150)), 'XYZ')
    bpy.context.collection.objects.link(sun)

    # Ground: grass-green shadow catcher tint, then the brand's pale teal sky.
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
    ground = bpy.context.active_object
    gm = bpy.data.materials.new('ground'); gm.use_nodes = True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = hex_rgba('#cfe3dc')
    gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
    ground.data.materials.append(gm)

    world = bpy.data.worlds.get('World') or bpy.data.worlds.new('World')
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = [srgb_to_linear(v) for v in hex_rgba('#eef5f4')[:3]] + [1]
    bg.inputs['Strength'].default_value = 0.9

    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'Standard'
    light(sc, time)
    sc.render.resolution_x, sc.render.resolution_y = 1200, 760
    sc.render.film_transparent = False
    sc.render.filepath = os.path.join(out_dir, name)
    bpy.ops.render.render(write_still=True)
    return sc.render.filepath


def render_closeup(out_dir, model_id, angle_deg, name, samples=64):
    clear_scene()
    sc = bpy.context.scene
    sc.frame_set(1)
    model = next(m for m in MODELS if m['id'] == model_id)
    info = build(model)
    info['root'].rotation_euler.z = math.radians(angle_deg)
    cam_data = bpy.data.cameras.new('cam'); cam_data.lens = 85
    cam = bpy.data.objects.new('cam', cam_data); bpy.context.collection.objects.link(cam)
    cow = model_id.endswith('cow')
    h = 1.6 if cow else 2.6
    cam.location = (0.0, 5.6 if cow else 6.2, h * 0.55 + 0.25)
    cam.rotation_euler = Euler((math.radians(86), 0, math.radians(180)), 'XYZ')
    sc.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.2; sun.data.angle = math.radians(8)
    sun.rotation_euler = Euler((math.radians(50), 0, math.radians(150)), 'XYZ')
    bpy.context.collection.objects.link(sun)
    bpy.ops.mesh.primitive_plane_add(size=30)
    gm = bpy.data.materials.new('ground'); gm.use_nodes = True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = hex_rgba('#cfe3dc')
    bpy.context.active_object.data.materials.append(gm)
    world = bpy.data.worlds.get('World') or bpy.data.worlds.new('World')
    sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = [srgb_to_linear(v) for v in hex_rgba('#eef5f4')[:3]] + [1]
    bg.inputs['Strength'].default_value = 0.9
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'Standard'
    light(sc, 'day')
    sc.render.resolution_x, sc.render.resolution_y = 640, 760
    sc.render.filepath = os.path.join(out_dir, name)
    bpy.ops.render.render(write_still=True)
    return sc.render.filepath
