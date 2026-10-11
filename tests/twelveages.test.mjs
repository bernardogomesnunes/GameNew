import * as THREE from 'three';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { World } from '../src/world/World.js';
import { AGES, OLD_AGE, ageOf, WAR_AGE } from '../src/config/ages.js';
import { KEEP_SIZE } from '../src/world/Territory.js';

/**
 * Asked for directly: "we need more ages to divide all this, and increase
 * the terrain available for building. I would say age 12", "3 goals per age
 * until age 5 and then we can go with 4. Age 1 should be teaching how to
 * play, like break tree, gather water, build a pick axe", and "The sanctuary
 * should not be a goal with the two, we should have build a sanctuary, the
 * user chooses."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const make = () => new DuiltGame({ world: new World({ sizeX: 32, sizeZ: 32, height: 32 }), scene: new THREE.Scene(), bus: null });

// --- Age 1 teaches ------------------------------------------------------------------------------

{
  const g = make();
  ok('a new world starts in Age 1 with none of its lessons done', g.age === 1 && g.ageGoals().every((x) => !x.done));
  g.inventory.add('wood', 3);
  ok('wood in the bag: a tree broken', g.ageGoals().find((x) => x.id === 'wood').done);
  g.inventory.remove('wood', 3);
  ok('and it stays learnt once the wood is spent', g.ageGoals().find((x) => x.id === 'wood').done);
  g.inventory.add('pickaxe_iron', 1);
  ok('a pickaxe of any metal counts', g.ageGoals().find((x) => x.id === 'pickaxe').done);
  g.inventory.add('bucket_water', 1);
  g.tick(1.5);
  ok('all three, and the next look moves the age on — no building needed', g.age === 2);
  const back = make();
  back.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('the lessons are saved with the world', ['wood', 'water', 'pickaxe'].every((k) => back.firsts.has(k)));
}

// --- one Sanctuary goal ---------------------------------------------------------------------------

{
  const goals = AGES.flatMap((a) => a.goals);
  ok('one goal for the Sanctuary, either one', goals.filter((x) => /Sanctuary/i.test(x.label)).length === 1 && !goals.some((x) => /sanctuary_(white|black)/.test(x.structure ?? '')));
  const g = make();
  const sanctuary = goals.find((x) => x.id === 'sanctuary');
  g.structures.structures.push({ id: 1, type: 'sanctuary_black', valid: true, region: { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 } });
  ok('the Black Sanctuary meets it', sanctuary.test(g));
}

// --- a world from before the twelve ages ----------------------------------------------------------

{
  for (const [was, now] of Object.entries(OLD_AGE)) {
    const old = make();
    const data = JSON.parse(JSON.stringify(old.toJSON()));
    delete data.agesVersion;
    data.territory.age = Number(was);
    const g = make();
    g.loadJSON(data);
    const oldSize = { 1: 32, 2: 64, 3: 128, 4: 192, 5: 256, 6: 320 }[was];
    ok(`an old Age ${was} world opens in Age ${now}, with as much land or more (${oldSize} → ${g.territory.size})`, g.age === now && g.territory.size >= oldSize);
  }
  const g = make();
  g.territory.setAge(7);
  const again = make();
  again.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('a world saved since stays in its age', again.age === 7);
  const war = make();
  const old = JSON.parse(JSON.stringify(war.toJSON()));
  delete old.agesVersion;
  old.territory.age = 6;
  war.loadJSON(old);
  ok('an old world in the last age is in the war\'s age now, the war on', war.age === WAR_AGE && war.war.atWar);
}

// --- more land, the same size of save ------------------------------------------------------------

{
  const g = make();
  g.territory.setAge(12);
  const kept = g.territory.keptBounds(), all = g.territory.bounds();
  ok(`Age 12 holds ${ageOf(12).size} blocks of land`, all.maxX - all.minX + 1 === 512);
  ok(`but a save keeps only ${KEEP_SIZE} of it whole — what you touch past that comes anyway`, kept.maxX - kept.minX + 1 === KEEP_SIZE);
  g.territory.setAge(3);
  ok('below that, all of it', JSON.stringify(g.territory.keptBounds()) === JSON.stringify(g.territory.bounds()));
}

process.exit(f ? 1 : 0);
