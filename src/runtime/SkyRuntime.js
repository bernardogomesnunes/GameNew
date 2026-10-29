import { skyFor, skyAt, liftAt, chainAt, SKY_REACH } from '../world/skyKingdom.js';
export { skyFor, liftAt, chainAt } from '../world/skyKingdom.js';
import { CHAINS, SINK_DAYS } from '../duilt/SkyWar.js';
import { SUSPICION } from '../duilt/Suspicion.js';
import { MODE_WORDS as ARMY_WORDS, MARCH_DAYS } from '../world/Army.js';
import { WANDERERS } from '../config/wanderers.js';
import { ITEMS, itemName } from '../config/items.js';
import { AIR, CHAIN, SKY_LIFT, WAR_TENT, WAR_TENT_BACK, CAMPFIRE, turned } from '../config/blocks.js';
const SKY_PEOPLE=240, SKY_TRIBUTE=64, EXPEDITION_OUT=24, CAMP_CLEAR=10, BLACK_BANNER=186;
const DARK_GEAR=/^(armour_stone_|ring_black$|nightstone$|banner_black$)/;
const SKY_ATTACK_IN=SKY_REACH+10, SKY_ATTACK_OUT=SKY_REACH+120;

export const methods = {
  swearOath() {
    const d = this.duilt;
    if (!d || d.sandbox) return;
    if (d.army.sworn) return void this.ui?.toast({ kind: 'xp', title: 'You are sworn already', body: `${d.army.total} warriors answer to you` });
    if (d.ringWorn() !== 'black') {
      return void this.ui?.toast({
        kind: 'xp', title: 'The altar is cold',
        body: d.ring === 'white' ? 'The dark god turns from the White Ring' : d.ring === 'black' ? 'Put the Black Ring on, and kneel again' : 'Only the bearer of the Black Ring can swear here',
      });
    }
    d.army.swear(d.days);
    this.sound?.gong();
    this.ui?.toast({
      kind: 'achievement',
      title: 'You swore to the dark god',
      body: `The Stone King keeps his word: ${d.army.total} warriors march with you. Order them from the ⚔ banner — follow, hold, attack, or form a line.`,
    });
    this.ui?.duiltUI?.renderArmy?.();
    this.editedAt = Date.now();
  },
  makeCamp({ x, y, z }) {
    const d = this.duilt;
    if (!d) return;
    d.spawn = { x, y, z };
    if (d.army.active) d.army.command('hold', { x: x + 0.5, z: z + 2.5 }, this.player.yaw);
    this.ui?.toast({
      kind: 'challenge', title: 'You made camp',
      body: d.army.active ? 'You\'ll wake here, and the army holds round it. Order them on from the ⚔ banner.' : 'You\'ll wake here when you fall.',
    });
    this.ui?.duiltUI?.renderArmy?.();
  },
  skyNear() {
    if (!this.skyOpen() || this.duilt.skyFallen) return null;
    const at = skyAt(this.world.gen), p = this.player.position;
    return Math.hypot(at.x - p.x, at.z - p.z) < SKY_PEOPLE ? skyFor(this.world.gen) : null;
  },
  rideLift({ x, y, z }) {
    const ride = this.world.gen ? liftAt(this.world.gen, x, y, z) : null;
    if (!ride) {
      const own = this.chainLift(x, y, z);
      if (!own) return void this.ui?.toast({ kind: 'xp', title: 'It goes nowhere yet', body: 'Hang chain straight up or down from it, with another sky lift at the far end — it rides the chain between them.' });
      this.player.teleport(own.to.x, own.to.y, own.to.z);
      this.player.velocity?.set?.(0, 0, 0);
      this.sound?.lift();
      return void this.ui?.toast({ kind: 'challenge', title: own.up ? 'Up the chain' : 'Down the chain', body: `${own.links} links` });
    }
    const i = skyFor(this.world.gen).towers.indexOf(ride.tower);
    if (this.duilt && !this.duilt.sandbox && this.duilt.skyWar.chains[i]) {
      this.ui?.toast({ kind: 'xp', title: 'Its chain is cut', body: 'This lift goes nowhere now — another tower\'s still might' });
      return;
    }
    const from = { x: this.player.position.x, z: this.player.position.z };
    this.player.teleport(ride.to.x, ride.to.y, ride.to.z);
    const army = this.duilt?.army;
    if (army?.active && army.mode === 'follow') {
      for (const w of army.field) {
        if (Math.hypot(w.x - from.x, w.z - from.z) > 30) continue;
        w.x = ride.to.x + (Math.random() - 0.5) * 3; w.z = ride.to.z + (Math.random() - 0.5) * 3; w.y = ride.to.y;
      }
    }
    this.sound?.lift();
    this.ui?.toast(ride.up
      ? { kind: 'challenge', title: 'Up the chain to the Sky Kingdom', body: this.wanderers?.skyHostile() ? 'Its guards know the Black Ring. Bring down the Sky King in his palace.' : 'White marble and gold, a long way up' }
      : { kind: 'challenge', title: 'Down to the anchor tower' });
  },
  tickSkyAttack() {
    const d = this.duilt, gen = this.world?.gen;
    if (!d || d.sandbox || d.ring !== 'black' || d.skyFallen || !gen) return;
    const at = skyAt(gen), p = this.player.position;
    const far = Math.hypot(at.x - p.x, at.z - p.z);
    const war = d.skyWar;
    if (!war.attack) {
      if (far > SKY_ATTACK_IN) return;
      war.begin(d.days, d.army.active ? d.army.total : 0);
      this.ui?.toast({
        kind: 'challenge', title: 'The attack on the Sky Kingdom has begun',
        body: this.disguised()
          ? 'In the Sky armour they take you for one of their own. Walk, keep your distance, don\'t linger — and keep the Black Ring out of sight. Watch the 👁 meter.'
          : 'Bring down the Sky King in his palace. Fall here, or lose your army, and you\'re driven back home — and the Sky Kingdom will tax you for it.',
      });
      return;
    }
    if (far > SKY_ATTACK_OUT) { war.withdraw(); return; }
    if (war.attack.army > 0 && d.army.total === 0) this.skyAttackLost('army');
  },
  skyAttackLost(how) {
    const d = this.duilt;
    const r = d.loseSkyAttack();
    if (!r) return;
    if (how === 'army') {
      const home = this.homeSpawn();
      this.player.teleport(home.x, home.y, home.z);
    }
    const pct = Math.round(r.rate * 100);
    this.ui?.toast({
      kind: 'xp',
      title: 'The attack on the Sky Kingdom failed',
      body: `${how === 'army' ? 'Your army was wiped out' : 'You fell'}, and you were driven back home. `
        + `The Sky Kingdom now takes ${pct}% of what your buildings make, until it falls. `
        + (d.army.sworn ? (r.replaced ? `The Stone King sends ${r.replaced} warriors to make up your losses.` : r.lost ? 'The Stone King sends no more warriors.' : '') : ''),
    });
    this.ui?.duiltUI?.renderArmy?.();
    this.editedAt = Date.now();
  },
  skyKingDown() {
    this.skyFalls(false);
  },
  skyFalls(yielded) {
    const d = this.duilt;
    const taxed = d?.skyWar.failures > 0;
    if (d && yielded) d.skyWar.yielded = true;
    if (!d || !d.bringDownSky()) return;
    // Its guards lay down their arms: nobody on the island fights you now.
    for (const p of this.wanderers?.list ?? []) {
      if (!WANDERERS[p.kind]?.sky) continue;
      p.angry = false; p.target = null; p.speed = 0;
    }
    this.sound?.rumble();
    this.ui?.toast({
      kind: 'achievement',
      title: yielded ? 'The Sky Kingdom yields' : 'The Sky Kingdom has fallen',
      body: d.sandbox ? 'Its King is down.' : `${yielded ? 'Sunk low on its cut chains, it can hold out no longer: its King comes down from his throne' : 'Its King is down'}, and its guards lay down their arms.${taxed ? ' Its taxes end.' : ''} The island is your land now: build on it as you would at home.`,
    });
    if (d.sandbox) return;
    // The Stone King keeps his word: honour, and gold from his treasury.
    const gained = d.collect({ gold: SKY_TRIBUTE }) ?? {};
    this.ui?.toast({
      kind: 'achievement',
      title: 'The Stone King honours you',
      body: `He names you Lord of the Sky, above every lord he has${gained.gold ? `, and sends ${gained.gold} gold from his treasury` : ''}. Speak to him in his keep.`,
    });
    this.editedAt = Date.now();
  },
  cutChainAt(hit) {
    const d = this.duilt, gen = this.world?.gen;
    if (!d || d.sandbox || d.ring !== 'black' || d.skyFallen || !gen || !hit) return false;
    if (this.world.getBlock(hit.x, hit.y, hit.z) !== CHAIN) return false;
    const i = chainAt(gen, hit.x, hit.y, hit.z);
    if (i < 0) return false;
    const r = d.skyWar.cutChain(i, d.days);
    if (!r) return false;
    // Every link of it, gone.
    for (const [x, y, z] of skyFor(gen).towers[i].chain) {
      if (this.world.getBlock(x, y, z) === CHAIN) this.world.setBlock(x, y, z, AIR);
    }
    this.remeshDirty();
    this.sound?.chain?.();
    this.ui?.toast(r.sinking
      ? { kind: 'achievement', title: 'The last chain is cut', body: `Nothing holds the Sky Kingdom up now. It will sink lower day by day — in ${SINK_DAYS} days it must yield.` }
      : { kind: 'challenge', title: `An anchor chain is cut — ${CHAINS - r.left} of ${CHAINS}`, body: `Its lift goes nowhere now. Cut the other ${r.left} and the island will sink until it yields.` });
    this.editedAt = Date.now();
    return true;
  },
  tickDisguise(dt) {
    const d = this.duilt;
    const on = this.disguised();
    if (!on) {
      const gen = this.world?.gen, p = this.player.position;
      const away = !gen || !this.skyOpen() || Math.hypot(skyAt(gen).x - p.x, skyAt(gen).z - p.z) > SKY_ATTACK_OUT;
      if (away || d?.skyFallen) this.suspicion.reset();
      this.markerView.update([]);
      this.ui?.duiltUI?.renderSuspicion?.(null);
      return;
    }
    const p = this.player.position;
    const sky = this.wanderers.list.filter((q) => WANDERERS[q.kind]?.sky && !q.dead);
    if (!this.suspicion.discovered) {
      const palace = skyFor(this.world.gen).palace;
      const worn = Object.values(d.worn).map((w) => w?.id ?? '');
      this.suspicion.tick(dt, {
        ring: d.ringWorn() === 'black',
        running: !!this.player.running,
        darkGear: worn.some((id) => DARK_GEAR.test(id)) || DARK_GEAR.test(this.selectedItemId ?? ''),
        nearGuards: sky.filter((q) => q.kind !== 'sky_king' && Math.hypot(q.x - p.x, q.z - p.z) < SUSPICION.near && Math.abs(q.y - p.y) < 3).length,
        inThrone: p.x >= palace.minX && p.x <= palace.maxX + 1 && p.z >= palace.minZ && p.z <= palace.maxZ + 1 && Math.abs(p.y - 172) < 4,
        warriors: d.army.active ? d.army.field.filter((w) => Math.hypot(w.x - p.x, w.z - p.z) < 14).length : 0,
      });
      if (this.suspicion.discovered) this.revealDisguise();
    }
    // A ? over each guard near enough to be looking you over; a ! over those who know.
    const s = this.suspicion;
    this.markerView.update(sky.filter((q) => q.kind !== 'sky_king' || s.discovered)
      .filter((q) => Math.hypot(q.x - p.x, q.z - p.z) < (s.discovered ? 24 : 10))
      .filter(() => s.discovered || s.level > 25)
      .map((q) => ({ x: q.x, y: q.y, z: q.z, mark: s.discovered ? '!' : '?' })));
    this.ui?.duiltUI?.renderSuspicion?.({ level: s.level / SUSPICION.max, rising: s.rising, reason: s.reason, discovered: s.discovered });
  },
  revealDisguise() {
    if (!this.suspicion.discovered) this.suspicion.reveal();
    const p = this.player.position;
    for (const q of this.wanderers?.list ?? []) {
      if (WANDERERS[q.kind]?.sky && Math.hypot(q.x - p.x, q.z - p.z) < 30) q.angry = true;
    }
  },
  tickSinking() {
    const d = this.duilt;
    if (!d || d.sandbox || d.ring !== 'black' || d.skyFallen) return;
    const s = d.skyWar.sinking(d.days);
    if (!s) return;
    if (s.left <= 0) return void this.skyFalls(true);
    if (s.day > d.skyWar.toldDay) {
      d.skyWar.toldDay = s.day;
      this.ui?.toast({ kind: 'challenge', title: 'The Sky Kingdom sinks lower', body: `Its waterfalls run thin and its towers lean. ${Math.ceil(s.left)} more day${Math.ceil(s.left) === 1 ? '' : 's'} and it must yield.` });
    }
  },
  expeditionCampSpot() {
    const gen = this.world.gen, s = skyFor(gen);
    const home = { x: gen.biomes?.centreX ?? 0, z: gen.biomes?.centreZ ?? 0 };
    const t = s.towers.reduce((best, t) => (Math.hypot(t.x - home.x, t.z - home.z) < Math.hypot(best.x - home.x, best.z - home.z) ? t : best));
    const { ux, uz } = t.landing;
    // Dry and level ground (seen: a camp pitched in a lake): try further
    // out and to either side until the tents, fire and banners all fit.
    const camp = (x, z) => {
      const y = gen.heightAt(x, z);
      for (let dx = -6; dx <= 6; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          if (gen.waterLevelAt?.(x + dx, z + dz) || Math.abs(gen.heightAt(x + dx, z + dz) - y) > 1) return null;
        }
      }
      return { x, y, z, facing: Math.atan2(ux, uz) };
    };
    for (let out = EXPEDITION_OUT; out <= EXPEDITION_OUT + 60; out += 6) {
      for (const side of [0, 8, -8, 16, -16, 24, -24]) {
        const at = camp(Math.round(t.x + ux * out + uz * side), Math.round(t.z + uz * out - ux * side));
        if (at) return at;
      }
    }
    const x = Math.round(t.x + ux * EXPEDITION_OUT), z = Math.round(t.z + uz * EXPEDITION_OUT);
    return { x, y: Math.max(gen.heightAt(x, z), gen.waterLevelAt?.(x, z) ?? 0), z, facing: Math.atan2(ux, uz) };
  },
  sendExpedition() {
    const d = this.duilt, st = this.expeditionState();
    if (!st?.ready) return false;
    d.army.sendTo(this.expeditionCampSpot(), d.days, MARCH_DAYS);
    this.ui?.toast({
      kind: 'challenge', title: 'Your army marches for the Sky Kingdom',
      body: `It will make camp below the island in ${MARCH_DAYS} days. They still eat every day on the road — keep your storehouses stocked.`,
    });
    this.ui?.duiltUI?.renderArmy?.();
    this.editedAt = Date.now();
    return true;
  },
  makeExpeditionCamp() {
    const d = this.duilt, c = d.army.camp;
    if (!c) return;
    const { x, z } = c;
    const gen = this.world.gen;
    // The ground cleared first (seen: a camp pitched in the canopy of a
    // forest, and you joining it inside a tree): everything standing on it,
    // round the fire and out to where you'll arrive, is cut down.
    for (let dx = -CAMP_CLEAR; dx <= CAMP_CLEAR; dx++) {
      for (let dz = -CAMP_CLEAR; dz <= CAMP_CLEAR; dz++) {
        if (dx * dx + dz * dz > CAMP_CLEAR * CAMP_CLEAR) continue;
        const g = gen.heightAt(x + dx, z + dz);
        if (gen.waterLevelAt?.(x + dx, z + dz)) continue;
        for (let by = g; by < g + 18; by++) {
          if (this.world.getBlock(x + dx, by, z + dz) !== AIR) this.world.setBlock(x + dx, by, z + dz, AIR);
        }
      }
    }
    // Each piece on its own column's ground, however the land slopes.
    const put = (bx, bz, id) => {
      const by = gen.heightAt(bx, bz);
      this.world.setBlock(bx, by, bz, id);
      return { x: bx, y: by, z: bz };
    };
    // Three tents in a row, a fire in front of them, a black banner each end.
    const tents = [-3, 0, 3].map((dx) => {
      put(x + dx, z + 3, WAR_TENT_BACK); // two blocks long: the back behind the flap
      return put(x + dx, z + 2, turned(WAR_TENT, 0));
    });
    put(x, z - 1, CAMPFIRE);
    put(x - 5, z + 2, BLACK_BANNER); put(x + 5, z + 2, BLACK_BANNER);
    d.spawn = tents[1];
    this.remeshDirty();
    this.ui?.toast({ kind: 'challenge', title: 'Your army has made camp below the Sky Kingdom', body: 'Join it from the map. You\'ll wake at its tents now, too.' });
    this.ui?.duiltUI?.renderArmy?.();
    this.editedAt = Date.now();
  },
  joinExpedition() {
    const c = this.duilt?.army.camp;
    if (!c || !this.expeditionState()?.camped) return false;
    this.player.flying = false;
    // In front of the camp, on the island's side, clear of the ranks round the fire.
    const f = this.duilt.army.anchor?.facing ?? 0;
    const jx = Math.floor(c.x - Math.sin(f) * 8), jz = Math.floor(c.z - Math.cos(f) * 8);
    this.player.teleport(jx + 0.5, this.world.gen.heightAt(jx, jz) + 0.5, jz + 0.5);
    const at = skyAt(this.world.gen), p = this.player.position;
    this.player.yaw = Math.atan2(-(at.x - p.x), -(at.z - p.z));
    this.player.pitch = 0.35;
    this.ui?.toast({ kind: 'challenge', title: 'You join your army at its camp', body: `${this.duilt.army.total} warriors, holding. Order them on from the ⚔ banner.` });
    return true;
  },
  commandArmy(mode) {
    const army = this.duilt?.army;
    if (!army?.active) return;
    if (army.marching) return void this.ui?.toast({ kind: 'xp', title: 'Your army is on the march', body: 'It can\'t hear you from here — join it at its camp when it arrives' });
    if (army.camp && army.away(this.player.position)) return void this.ui?.toast({ kind: 'xp', title: 'Your army is at its camp', body: 'It can\'t hear you from here — join it from the map' });
    army.command(mode, this.player.position, this.player.yaw);
    this.ui?.toast({ kind: 'challenge', title: `Your army — ${ARMY_WORDS[mode]}`, body: `${army.total} warriors` });
    this.ui?.duiltUI?.renderArmy?.();
  },
  tickArmy(dt) {
    const d = this.duilt;
    if (!d || d.sandbox || !d.army.active || !this.wanderers) { if (d?.army) d.army.field = d.army.active ? d.army.field : []; return; }
    const p = this.player.position;
    const hostile = this.wanderers.hostile();
    const enemies = this.wanderers.list.filter((e) => WANDERERS[e.kind].hp && !e.dead && !e.done
      && (e.war || e.raider || e.angry || (hostile && e.kind === 'bandit') || (WANDERERS[e.kind].sky && this.wanderers.skyHostile()))
      && Math.hypot(e.x - p.x, e.z - p.z) < 60);
    const before = d.army.total;
    d.army.tick(dt, p, this.player.yaw, enemies, {
      strike: (e, damage, w) => {
        const res = this.wanderers.hit(e, damage, w.x, w.z);
        if (res?.killed) d.collect(res.drops);
      },
    });
    // The expedition: the day it reaches the Sky Kingdom, it makes camp.
    if (d.army.update(d.days) === 'arrived') this.makeExpeditionCamp();
    const meal = d.army.eat(d.days, (n) => this.takeRations(n));
    if (meal?.deserted) {
      this.ui?.toast({ kind: 'xp', title: `${meal.deserted} of your warriors deserted`, body: `There wasn't enough to eat — ${meal.got} of ${meal.need} rations. Keep food in your bag or storehouses.` });
    }
    if (d.army.total !== before || meal) this.ui?.duiltUI?.renderArmy?.();
    if (!d.army.total && before) this.ui?.toast({ kind: 'xp', title: 'Your army is gone', body: 'Every last warrior has fallen or walked away' });
  },
  takeRations(n) {
    const d = this.duilt;
    const foods = ITEMS.filter((i) => i.kind === 'food').sort((a, b) => (a.feeds ?? 0) - (b.feeds ?? 0));
    let got = 0;
    for (const inv of [d.inventory, ...d.structures.stores().map((s) => s.store)]) {
      for (const f of foods) {
        if (got >= n) return got;
        const take = Math.min(n - got, inv.countOf(f.id));
        if (take > 0) { inv.remove(f.id, take); got += take; }
      }
    }
    return got;
  }
};
