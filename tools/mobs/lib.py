"""
The shared kit for the game's models: the palette, a pixel painter, and the
code that turns a model definition (boxes, bones, a walk cycle) into Blender
objects, a .glb and a picture. The models live in featured.py, animals.py,
people.py and vehicles.py; tools/mobs/run.py sends the lot through the
blender-mcp addon's execute_code command, the way Claude would over MCP.

Units are Blockbench's: 16 to a block, y up, the model facing -z. A face's
pixels run x right and y down as seen from outside it. Converted to
Blender's z-up on the way in, so the exported .glb comes out y-up, facing -z.

Colours are the game's palette (src/ui/styles.css). Pixels in a GLOW colour
glow: they go into an emission map as well as the colour map. Teal and gold
are the world's own magic; red is the Stone Kingdom's, violet the dark god's.
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
    iron='#3a3840', iron2='#2c2a31', iron3='#4c4a55', red='#b84a3a', redDark='#7a2a20',
    grass='#5aa53a', grassDark='#2f6b23', stone='#8f9296', glass='#a9d8d2', glass2='#7fbdb5',
)
GLOW = dict(teal='#8ff5e0', tealMid='#4fd8bf', gold='#ffe27a', red='#ff6a4a', violet='#c58cff', lamp='#fff1b8')
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
    area = sum(t['w'] * t['h'] for t in tiles)
    W = 128
    while W < max(t['w'] for t in tiles) or W * W < area * 1.6:
        W *= 2
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
    root.scale = (model.get('scale', 1),) * 3
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


def export_each(models, out_dir):
    """One .glb per model, with its walk cycle."""
    stats = {}
    for model in models:
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


def render_one(model, path, time='day', samples=16, size=480, yaw=-30):
    """One model, framed to fit, in an orthographic three-quarter view."""
    clear_scene()
    sc = bpy.context.scene
    sc.frame_set(1)
    info = build(model)
    info['root'].rotation_euler.z = math.radians(yaw)
    bpy.context.view_layer.update()
    pts = [ob.matrix_world @ Vector(c) for ob in bpy.data.objects if ob.type == 'MESH' for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre, ext = (lo + hi) / 2, hi - lo

    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = max(ext.x, ext.y, ext.z) * 1.18 + 0.1
    cam = bpy.data.objects.new('cam', cam_data)
    bpy.context.collection.objects.link(cam)
    pitch = math.radians(14)
    d = 40
    cam.location = centre + Vector((0, d * math.cos(pitch), d * math.sin(pitch)))
    cam.rotation_euler = Euler((math.radians(90) - pitch, 0, math.radians(180)), 'XYZ')
    cam_data.clip_end = 200
    sc.camera = cam

    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.angle = math.radians(8)
    sun.rotation_euler = Euler((math.radians(50), 0, math.radians(150)), 'XYZ')
    bpy.context.collection.objects.link(sun)
    bpy.ops.mesh.primitive_plane_add(size=400)
    gm = bpy.data.materials.new('ground'); gm.use_nodes = True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = hex_rgba('#cfe3dc')
    gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
    bpy.context.active_object.data.materials.append(gm)
    world = bpy.data.worlds.get('World') or bpy.data.worlds.new('World')
    sc.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = [srgb_to_linear(v) for v in hex_rgba('#eef5f4')[:3]] + [1]
    light(sc, time)
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'Standard'
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


# --------------------------------------------------------------------------
# Shapes shared by many models.

def box(name, bone, a, b, paint, rot=None):
    """A cube entry; `paint` a painter or a colour."""
    p = paint if isinstance(paint, dict) else {'all': paint}
    return (name, bone, tuple(a), tuple(b), p) + ((rot,) if rot else ())


def mirror(cube):
    """The same box on the other side (x flipped, bone _l ↔ _r)."""
    name, bone, a, b, paint = cube[:5]
    sw = lambda n: '_'.join({'l': 'r', 'r': 'l', 'fl': 'fr', 'fr': 'fl', 'bl': 'br', 'br': 'bl'}.get(t, t) for t in n.split('_'))
    rot = cube[5] if len(cube) > 5 else None
    if rot:
        rot = (rot[0], -rot[1], -rot[2])
    return box(sw(name) if name != sw(name) else name + '_m', sw(bone), (-b[0], a[1], a[2]), (-a[0], b[1], b[2]), paint, rot)


def swing(deg, frames=(1, 13, 25)):
    """A to-and-fro about x over a 1 s cycle."""
    return [(frames[0], (deg, 0, 0)), (frames[1], (-deg, 0, 0)), (frames[2], (deg, 0, 0))]


def spin(axis, frames=25, turns=1):
    """A full turn about one axis over the cycle."""
    out = []
    for i, f in enumerate((1, 1 + (frames - 1) // 2, frames)):
        r = [0, 0, 0]
        r[axis] = 180 * i * turns
        out.append((f, tuple(r)))
    return out
