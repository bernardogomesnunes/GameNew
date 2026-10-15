"""
Builds every model through the blender-mcp addon (ahujasid, PyPI
blender-mcp 2.0.0), the same command path its MCP tools use: execute_code
to model, export and render, get_scene_info to inspect.

Blender here is the bpy module (PyPI bpy 5.2.2), which has no window, so the
addon's socket server refuses to start (it needs a GUI event loop). This
calls the server object's command handler directly instead; everything
after the socket is the addon's own code.

    BLENDER_MCP_DISABLE_TELEMETRY=1 python tools/mobs/run.py art/mobs [group ...] [--only id,id]

Groups: featured animals creatures people vehicles (default: all). Writes
each model to public/models/<id>.glb (and public/models/index.json, the list
the game loads), and into the art folder renders/<id>.png, one contact
sheet per group in sheets/, and stats.json.
"""
import importlib.util, json, os, sys, time
import blender_mcp
from PIL import Image, ImageDraw, ImageFont

args = [a for a in sys.argv[1:]]
only = None
if '--only' in args:
    i = args.index('--only'); only = set(args[i + 1].split(',')); del args[i:i + 2]
out = os.path.abspath(args[0] if args else 'art/mobs')
groups = args[1:] or ['featured', 'animals', 'creatures', 'people', 'vehicles']
for d in ('', 'renders', 'sheets'):
    os.makedirs(os.path.join(out, d), exist_ok=True)
here = os.path.dirname(os.path.abspath(__file__))
pub = os.path.abspath(os.path.join(here, '..', '..', 'public', 'models'))
os.makedirs(pub, exist_ok=True)

addon_path = os.path.join(os.path.dirname(blender_mcp.__file__), 'bundled', 'addon.py')
spec = importlib.util.spec_from_file_location('blendermcp_addon', addon_path)
addon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(addon)
addon.register()  # the scene settings its commands read
server = addon.BlenderMCPServer(port=9876)


def send(cmd_type, **params):
    res = server.execute_command({'type': cmd_type, 'params': params})
    if res.get('status') != 'success':
        raise SystemExit(f'{cmd_type} failed: {res.get("message")}')
    return res['result']


def code(body):
    return f'import sys\nsys.path.insert(0, {here!r})\nfrom catalogue import GROUPS\nfrom lib import *\n{body}'


print('ping:', send('ping'))
samples = int(os.environ.get('SAMPLES', 16))
listing = json.loads(send('execute_code', code=code('import json\nprint(json.dumps({g: [(m["id"], m["name"]) for m in ms] for g, ms in GROUPS.items()}))'))['result'].strip().splitlines()[-1])
groups = [g for g in groups if g in listing]

stats_path = os.path.join(out, 'stats.json')
stats = json.load(open(stats_path)) if os.path.exists(stats_path) else {}
stats = {k: v for k, v in stats.items() if isinstance(v, dict) and 'group' in v}
for g in groups:
    for mid, name in listing[g]:
        if only and mid not in only:
            continue
        t = time.time()
        r = send('execute_code', code=code(
            f'import json\nm = next(m for m in GROUPS[{g!r}] if m["id"] == {mid!r})\n'
            f's = export_each([m], {pub!r})\n'
            f'render_one(m, {os.path.join(out, "renders", mid + ".png")!r}, samples={samples})\n'
            f'print(json.dumps(s))'))
        s = json.loads(r['result'].strip().splitlines()[-1])[mid]
        stats[mid] = dict(s, name=name, group=g)
        print(f'{g:9} {mid:14} {s["cubes"]:3} boxes {s["triangles"]:4} tris {s["kb"]:5} KB  {time.time() - t:4.1f}s', flush=True)
json.dump(stats, open(stats_path, 'w'), indent=1)
info = send('get_scene_info')
print('get_scene_info:', info.get('object_count'), 'objects in the last scene')

# The game loads them from public/models/ (src/render/Models.js), listed in index.json.
ids = sorted(f[:-4] for f in os.listdir(pub) if f.endswith('.glb'))
json.dump(ids, open(os.path.join(pub, 'index.json'), 'w'))
print('public/models:', len(ids), 'models')

# Contact sheets: four across, a label under each.
bold = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font = ImageFont.truetype(bold, 22) if os.path.exists(bold) else ImageFont.load_default()
for g in groups:
    items = [(mid, name) for mid, name in listing[g] if os.path.exists(os.path.join(out, 'renders', mid + '.png'))]
    if not items:
        continue
    cols, cell, lab = 4, 360, 40
    items = [it for it in items if not it[0].rsplit('_', 1)[-1].isdigit()]   # variants stay off the sheets
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell, rows * (cell + lab)), '#eef5f4')
    d = ImageDraw.Draw(sheet)
    for i, (mid, name) in enumerate(items):
        im = Image.open(os.path.join(out, 'renders', mid + '.png')).convert('RGB').resize((cell, cell), Image.LANCZOS)
        x, y = (i % cols) * cell, (i // cols) * (cell + lab)
        sheet.paste(im, (x, y))
        d.text((x + cell / 2, y + cell + lab / 2), name, fill='#2b1d12', font=font, anchor='mm')
    sheet.save(os.path.join(out, 'sheets', f'{g}.png'))
    print('sheet:', g, len(items))
