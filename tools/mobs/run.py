"""
Drives tools/mobs/build_mobs.py through the blender-mcp addon (ahujasid,
PyPI blender-mcp 2.0.0), the same command path its MCP tools use:
execute_code to model, get_scene_info to inspect.

Blender here is the bpy module (PyPI bpy 5.2.2), which has no window, so the
addon's socket server refuses to start (it needs a GUI event loop). This
calls the server object's command handler directly instead; everything
after the socket is the addon's own code.

    BLENDER_MCP_DISABLE_TELEMETRY=1 python tools/mobs/run.py art/mobs
"""
import importlib.util, json, os, sys, time
import blender_mcp

out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'art/mobs')
os.makedirs(out, exist_ok=True)
here = os.path.dirname(os.path.abspath(__file__))

addon_path = os.path.join(os.path.dirname(blender_mcp.__file__), 'bundled', 'addon.py')
spec = importlib.util.spec_from_file_location('blendermcp_addon', addon_path)
addon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(addon)
addon.register()  # the scene settings its commands read
server = addon.BlenderMCPServer(port=9876)


def send(cmd_type, **params):
    t = time.time()
    res = server.execute_command({'type': cmd_type, 'params': params})
    if res.get('status') != 'success':
        raise SystemExit(f'{cmd_type} failed: {res.get("message")}')
    print(f'{cmd_type}: ok in {time.time() - t:.1f}s')
    return res['result']


print('ping:', send('ping'))
src = open(os.path.join(here, 'build_mobs.py')).read()
prelude = src + f'\nOUT_DIR = {out!r}\n'

r = send('execute_code', code=prelude + 'import json\nprint(json.dumps(export_each(OUT_DIR)))')
stats = json.loads(r['result'].strip().splitlines()[-1])
print(json.dumps(stats, indent=1))

info = send('get_scene_info')
print('scene after last export:', json.dumps(info)[:300])

samples = int(os.environ.get('SAMPLES', 64))
send('execute_code', code=prelude + f'render_lineup(OUT_DIR, 25, "lineup_front.png", {samples})')
send('execute_code', code=prelude + f'render_lineup(OUT_DIR, 155, "lineup_back.png", {samples})')
send('execute_code', code=prelude + f'render_lineup(OUT_DIR, 25, "lineup_dusk.png", {samples}, "dusk")')
for mid in ('cow', 'moon_cow', 'explorer', 'sky_warrior'):
    send('execute_code', code=prelude + f'render_closeup(OUT_DIR, {mid!r}, 30, "{mid}.png", {samples})')
json.dump(stats, open(os.path.join(out, 'stats.json'), 'w'), indent=1)
