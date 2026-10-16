"""The first hand-made test models: cow, moon cow, explorer and sky warrior."""
from lib import *


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

FEATURED = [COW, MOON_COW, EXPLORER, SKY]
