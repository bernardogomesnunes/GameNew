import { SHOWCASE_SEED, SHOWCASE_TIMES, SHOWCASE_SPOTS_BY_ID, SHOWCASE_BUILDINGS, SHOWCASE_FIGURES, findShowcaseSite, flattenShowcase, placeBlocks, showcaseLabels, spotPose } from '../world/showcase.js';
import { MOBS_BY_ID } from '../config/mobs.js';
import { WANDERERS } from '../config/wanderers.js';
import { settlerName, settlerColour } from '../config/settlers.js';
import { Defenders } from '../world/Defenders.js';
import { Army } from '../world/Army.js';
import { Guardian } from '../world/Guardian.js';
const CREATIVE='creative';

export const methods = {
  openShowcase({ spot = 'overview', time = 'day' } = {}) {
    this.saveNow();
    this.newWorld({ mode: CREATIVE, name: 'Showcase', scenery: true, silent: true, seed: SHOWCASE_SEED });
    const gen = this.world.gen;
    const site = findShowcaseSite(gen);
    if (!site) return false;
    flattenShowcase(this.world, site);
    // The buildings through the same starterPlacement a tap on a design
    // goes through; the places the way the world lays them.
    for (const b of SHOWCASE_BUILDINGS) {
      if (!b.structure) continue;
      const plan = this.duilt.starterPlacement(b.structure, { x: site.x + b.anchor.x, y: site.y, z: site.z + b.anchor.z });
      for (const c of plan.changes ?? []) this.world.setBlock(c.x, c.y, c.z, c.next);
    }
    for (const [x, y, z, id] of placeBlocks(site)) this.world.setBlock(x, y, z, id);
    // The Sky city is laid only while this is set (Creative has it anyway — skyOpen).
    gen.sky = true;
    this.syncMobs();
    // Nobody wanders through the pictures: no herds, no explorers.
    this.mobs.cap = 0;
    this.wanderers.untilExplorer = Infinity;
    // Everyone in the same lists the game draws them from, made by the same
    // code that makes them in play, then stood still (`still`: Mobs and
    // Wanderers leave them be). Names and coats are fixed rather than rolled,
    // so a face is the same face in every picture.
    const figures = { settlers: [], defenders: [], warriors: [], guardians: [] };
    const defenders = new Defenders({ world: this.world });
    const army = new Army({ world: this.world });
    for (const g of SHOWCASE_FIGURES) {
      for (const f of g.figures) {
        const x = site.x + f.x, y = site.y, z = site.z + f.z;
        const still = { still: true, facing: f.facing, target: null, speed: 0 };
        if (f.kind === 'mob') {
          this.mobs.list.push(Object.assign(this.mobs.make(MOBS_BY_ID.get(f.type), x, y, z), still));
        } else if (f.kind === 'wanderer') {
          const make = (kind) => this.wanderers.person(kind, x, y, z, { ...still, name: f.label, colour: WANDERERS[kind].colours[0] });
          const p = make(f.type);
          this.wanderers.list.push(p);
          if (f.rider) {
            const r = make(f.rider);
            r.mount = p;
            p.rider = r;
            this.wanderers.list.push(r);
          }
        } else if (f.kind === 'settler') {
          figures.settlers.push({ id: `showcase-${f.n}`, name: settlerName(f.n), colour: settlerColour(f.n), x, y, z, ...still });
        } else if (f.kind === 'defender') {
          figures.defenders.push(Object.assign(defenders.person(f.type, { x: x - 0.5, y, z: z - 0.5 }, null), still));
        } else if (f.kind === 'warrior') {
          army.total = army.field.length + 1;
          army.muster({ x, y, z }, 0);
          figures.warriors.push(Object.assign(army.field.at(-1), { x, y, z }, still));
        } else if (f.kind === 'guardian') {
          figures.guardians.push(Object.assign(new Guardian({ world: this.world, ring: f.type, home: { x, y, z } }), still));
        }
      }
    }
    this.showcase = { site, figures, labelSpots: showcaseLabels(site), labels: true, spot: null };
    this.rebuildAllChunks();
    this.ui?.refreshForMode();
    this.showcaseTime(time);
    this.showcaseSpot(spot);
    return true;
  },
  showcaseSpot(id, { settle = false } = {}) {
    const spot = SHOWCASE_SPOTS_BY_ID.get(id);
    if (!this.showcase || !spot) return false;
    const pose = spotPose(spot, { site: this.showcase.site, gen: this.world.gen, world: this.world });
    if (!pose) return false;
    const eye = this.player.eyePosition().y - this.player.position.y;
    this.player.flying = true;
    this.player.teleport(pose.eye.x, pose.eye.y - eye, pose.eye.z);
    this.player.yaw = pose.yaw;
    this.player.pitch = pose.pitch;
    this.showcase.spot = id;
    if (settle) this.finishLoading();
    return true;
  }
};
