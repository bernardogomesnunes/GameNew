"""Run with portable Blender: blender -b --python tools/mobs/finish_villagers.py.

Uses the same model builders as the MCP pipeline; exports only the ten
settler/citizen assets and regenerates their previews without touching others.
"""
import os, sys, json
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.dirname(__file__))
from people import PEOPLE
from lib import export_each, render_one

models = [m for m in PEOPLE if m['id'].split('_')[0] in ('settler', 'citizen')]
stats_path = os.path.join(root, 'art', 'mobs', 'stats.json')
with open(stats_path) as f:
    stats = json.load(f)
for m in models:
    result = export_each([m], os.path.join(root, 'public', 'models'))
    stats[m['id']] = dict(stats.get(m['id'], {}), **result[m['id']])
    render_one(m, os.path.join(root, 'art', 'mobs', 'renders', m['id'] + '.png'), samples=8, size=480)
with open(stats_path, 'w') as f:
    json.dump(stats, f, indent=1)
print('FINISHED_VILLAGERS', len(models), flush=True)
