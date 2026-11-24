// Getting about on something: the steam engine and its cars, the Helix and the
// worn Plainer, and the horse you ride. Moved out of Game.js (TECH-10); every
// function runs with `this` set to the Game, which delegates to it.
import { ITEMS_BY_ID } from '../config/items.js';
import { MOBS_BY_ID } from '../config/mobs.js';
import { rayBox } from '../world/Mobs.js';
import { HELIX_SKIDS } from '../render/HelixView.js';
import { RAIL, BUNKER } from '../world/Trains.js';
// Game.js imports this file and this file imports Game.js: REACH is only read
// inside functions, after both modules have loaded.
import { REACH } from '../Game.js';

/** On horseback you sit this much higher than on foot. */
const SEAT_HEIGHT = 0.9;
/** A parked machine's reach for the crosshair: this far either side of it, and (a Plainer) this tall. */
const MACHINE_HALF = 1.4, MACHINE_TALL = 2.8;

/**
 * In Duilt, flying is the Helix's, and only while you're in one (asked for
 * directly: "Flying machine should be a plainer and should not fly with fly
 * button, that's for the helix ... Two different mobility vehicles"). The
 * Plainer you wear only glides — see wireFlight's canGlide. See pilot.
 */
export function hasFlyingMachine() {
  return !!this.duilt && !!this.piloting;
}

/** The Plainer on your body (asked for directly: "Plainer should be held as chest plate instead of placed"). */
export function wearingPlainer() {
  return this.duilt?.worn?.body?.id === 'flying_machine';
}

/** Place with something you wear in hand: on it goes, from the bag (the Plainer, so a thumb can put it on). */
export function wearSelected() {
  const d = this.duilt, id = this.selectedItemId;
  if (!d || !id) return;
  const i = d.inventory.slots.findIndex((s) => s?.id === id);
  if (i < 0) return;
  const r = d.wear(i);
  const name = ITEMS_BY_ID.get(id)?.name ?? 'It';
  this.ui.toast(r.ok
    ? { kind: 'challenge', title: `${name} on`, body: id === 'flying_machine' ? 'Climb somewhere high and step off: its wings glide you down, faster than you run. Steer as you walk.' : undefined }
    : { kind: 'xp', title: `Can't put it on`, body: r.reason });
  if (r.ok) { this.editedAt = Date.now(); this.ui?.refreshTools?.(); }
}

/**
 * Hold the Helix and press Place: it's set down on the block you point
 * at, standing on its skids, facing the way you face (asked for directly:
 * "a physical vehicle to fly. I could place it and fly in it").
 */
export function setDownMachine() {
  const d = this.duilt, hit = this.raycast();
  if (!d || !hit) return;
  const x = hit.x + 0.5, y = hit.y + 1 + HELIX_SKIDS, z = hit.z + 0.5;
  for (let up = 0; up < 4; up++) {
    if (this.world.isCollidable(hit.x, hit.y + 1 + up, hit.z)) {
      return void this.ui.toast({ kind: 'xp', title: 'No room', body: 'Set it down somewhere open, with sky above it.' });
    }
  }
  const r = d.placeMachine(x, y, z, this.player.yaw);
  if (!r.ok) return void this.ui.toast({ kind: 'xp', title: 'No Helix', body: r.reason });
  this.editedAt = Date.now();
  this.ui.toast({ kind: 'challenge', title: 'Helix set down', body: 'Place on it to climb in. Hit it to pick it up again.' });
}

/**
 * Hold a steam engine and Place on a rail: it's set on the line there,
 * facing the way you look, with the rail behind it under its length
 * (backlog batch 2: "a train on a one-block rail").
 */
export function setDownTrain() {
  const d = this.duilt, hit = this.raycast();
  if (!d || !hit) return;
  if (hit.block !== RAIL) {
    return void this.ui.toast({ kind: 'xp', title: 'Set it on a rail', body: 'Lay a line of rail first — nine at least — and Place on it.' });
  }
  const look = this.player.lookDirection();
  const r = d.placeTrain({ x: hit.x, y: hit.y, z: hit.z }, { x: look.x, z: look.z });
  if (!r.ok) return void this.ui.toast({ kind: 'xp', title: 'No room for it', body: r.reason });
  this.editedAt = Date.now();
  this.ui.toast({ kind: 'challenge', title: 'Steam engine on the rails', body: 'Coal in your hand and Place on it to fire it. Place on it to drive.' });
}

/** A rail car in hand goes on a train — Place on one. */
export function railCarHint() {
  this.ui.toast({ kind: 'xp', title: 'Place it on a train', body: 'Point at a train on the rails and Place: the car couples on behind.' });
}

/** The train part under the crosshair, nearer than the block behind it: { train, part } or null. */
export function trainTarget(hit = this.raycast()) {
  const trains = this.duilt?.trains;
  if (!trains?.list.length || this.driving) return null;
  const eye = this.player.eyePosition(), dir = this.player.lookDirection();
  const found = trains.pick(eye, dir, REACH + 2);
  if (!found) return null;
  if (hit) {
    const blockT = rayBox(eye, dir, hit.x, hit.y, hit.z, hit.x + 1, hit.y + 1, hit.z + 1);
    if (blockT != null && blockT < found.t) return null;
  }
  return found;
}

/**
 * Place on a train: coal in hand fires it, a car couples on; otherwise, on
 * a car it opens what the car carries, and on the engine you climb into the cab.
 */
export function useTrain(t, part = null) {
  const d = this.duilt;
  if (this.selectedItemId === 'coal') {
    const n = d.fuelTrain(t);
    this.ui.toast(n
      ? { kind: 'xp', title: `${n} coal in the bunker`, body: `${t.coal} of ${BUNKER} — Place on it to drive.` }
      : { kind: 'xp', title: t.coal >= BUNKER ? 'The bunker is full' : 'No coal', body: t.coal >= BUNKER ? undefined : 'Dig it in the high peaks, or a mine brings it up.' });
    if (n) this.editedAt = Date.now();
    return;
  }
  if (this.selectedItemId === 'rail_car') {
    const r = d.coupleCar(t);
    this.ui.toast(r.ok ? { kind: 'xp', title: 'Car coupled on', body: `${t.cars} of 5.` } : { kind: 'xp', title: 'Can\'t couple it', body: r.reason });
    if (r.ok) this.editedAt = Date.now();
    return;
  }
  if (part?.kind === 'car') {
    const car = t.loads[part.index - 1];
    if (car) this.ui.openStore({ car });
    return;
  }
  this.drive(t);
}

/** Break on a train standing there: its last car back in your bag, or the engine when it has none. */
export function pickUpTrain(hit) {
  const found = this.trainTarget(hit);
  if (!found) return false;
  const r = this.duilt.pickUpTrain(found.train);
  // One piece a press: a hold that kept going took every car and then the
  // engine. The rest of this press does nothing; lift and press again.
  this.holdSpent = true;
  this.ui.toast(r.ok
    ? { kind: 'xp', title: r.piece === 'rail_car' ? 'Car taken off' : 'Steam engine picked up', body: 'It is back in your bag.' }
    : { kind: 'xp', title: 'Can\'t pick it up', body: r.reason });
  if (r.ok) this.editedAt = Date.now();
  return true;
}

/** Into the cab: forward and back drive it, Sneak gets you down. */
export function drive(t) {
  if (!t || this.driving) return;
  this.stopRide();
  this.leaveMachine();
  this.driving = t;
  const cab = this.duilt.trains.cab(t);
  this.player.flying = false;
  this.player.position.set(cab.x, cab.y, cab.z);
  this.player.velocity?.set?.(0, 0, 0);
  this.player.yaw = cab.yaw + Math.PI;
  this.cabYaw = cab.yaw;
  this.player.viewLift = 0.55;
  this.player.viewReach = 9;
  const fired = this.duilt.inventory.endless || t.coal > 0 || t.fuel > 0;
  this.ui.toast({
    kind: 'xp', title: 'Driving',
    body: fired ? 'Forward and back to drive. Sneak to get down.' : 'No coal in it — get down (Sneak), hold coal and Place on it to fire it.',
  });
}

/** Down from the cab, beside the engine. `stay`: you're elsewhere already. */
export function leaveTrain(stay = false) {
  const t = this.driving;
  if (!t) return;
  t.throttle = 0;
  this.driving = null;
  this.player.viewLift = 0;
  this.player.viewReach = 0;
  if (stay || !this.duilt) return;
  const cab = this.duilt.trains.cab(t);
  const side = cab.yaw + Math.PI / 2;
  const x = cab.x + Math.sin(side) * 2.4, z = cab.z + Math.cos(side) * 2.4;
  // Onto whatever's there: up out of the ground, or down to it.
  let y = Math.floor(cab.y);
  const bx = Math.floor(x), bz = Math.floor(z);
  while (y < cab.y + 6 && (this.world.isCollidable(bx, y, bz) || this.world.isCollidable(bx, y + 1, bz))) y++;
  while (y > cab.y - 8 && !this.world.isCollidable(bx, y - 1, bz)) y--;
  this.player.position.set(x, y, z);
  this.player.velocity?.set?.(0, 0, 0);
}

/**
 * Each frame you're driving: forward and back are the throttle, you stand
 * in the cab wherever the train has got to, and your view turns with it
 * round a bend. Sneak to get down.
 */
export function tickDrive() {
  const t = this.driving;
  if (!t) return;
  const trains = this.duilt?.trains;
  if (!trains || !trains.list.includes(t)) return void this.leaveTrain(true);
  const p = this.player;
  if (p.sneaking) return void this.leaveTrain();
  const cab = trains.cab(t);
  // Sent somewhere in one go (a respawn, a bed): the train stays behind.
  if (Math.hypot(p.position.x - cab.x, p.position.z - cab.z) > 12) return void this.leaveTrain(true);
  t.throttle = p.moveInput().z;
  const empty = t.throttle && !this.duilt.inventory.endless && t.coal <= 0 && t.fuel <= 0;
  if (empty && !this.toldEmpty) {
    this.toldEmpty = true;
    this.ui.toast({ kind: 'xp', title: 'Out of coal', body: 'Get down (Sneak), hold coal and Place on the engine.' });
  } else if (!empty) this.toldEmpty = false;
  p.position.set(cab.x, cab.y, cab.z);
  p.velocity?.set?.(0, 0, 0);
  let turn = cab.yaw - (this.cabYaw ?? cab.yaw);
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  p.yaw += turn;
  this.cabYaw = cab.yaw;
}

/** " · 6 aboard for Ashford" — who's riding in a car, and where to. */
export function ridersText(train, car) {
  const rs = (train.riders ?? []).filter((r) => r.car === car);
  if (!rs.length) return '';
  const names = rs.map((r) => (r.to === 'home' ? 'home' : this.duilt?.stations?.find((s) => s.key === r.to)?.name ?? 'a city'));
  return ` · ${rs.reduce((t, r) => t + r.n, 0)} aboard for ${[...new Set(names)].join(' and ')}`;
}

/** The flying machine under the crosshair, nearer than the block behind it. */
export function machineTarget(hit = this.raycast()) {
  const list = this.duilt?.machines;
  if (!list?.length || this.piloting) return null;
  const eye = this.player.eyePosition(), dir = this.player.lookDirection();
  let best = null;
  for (const m of list) {
    const helix = m.kind === 'helix';
    const y0 = helix ? m.y - HELIX_SKIDS : m.y, y1 = helix ? m.y + 3.2 : m.y + MACHINE_TALL;
    const t = rayBox(eye, dir, m.x - MACHINE_HALF, y0, m.z - MACHINE_HALF, m.x + MACHINE_HALF, y1, m.z + MACHINE_HALF);
    if (t != null && t <= REACH && (!best || t < best.t)) best = { m, t };
  }
  if (!best) return null;
  if (hit) {
    const blockT = rayBox(eye, dir, hit.x, hit.y, hit.z, hit.x + 1, hit.y + 1, hit.z + 1);
    if (blockT != null && blockT < best.t) return null;
  }
  return best.m;
}

/** Break on a flying machine standing in the world puts it back in your bag. */
export function pickUpMachine(hit) {
  const m = this.machineTarget(hit);
  if (!m) return false;
  const r = this.duilt.pickUpMachine(m);
  this.ui.toast(r.ok
    ? { kind: 'xp', title: `${r.id === 'helix' ? 'Helix' : 'Plainer'} picked up`, body: r.id === 'helix' ? 'It is back in your bag.' : 'It is back in your bag — wear it (Body) to fly.' }
    : { kind: 'xp', title: 'Can\'t pick it up', body: r.reason });
  if (r.ok) this.editedAt = Date.now();
  return true;
}

/**
 * Into the Helix and up: it flies as Creative does — hover, Jump rises,
 * Sneak sinks, go where you look. Land and Sneak to get out. A Plainer an
 * older save left parked can't be climbed into: it's worn now.
 */
export function pilot(m) {
  if (!m || this.piloting) return;
  if (m.kind !== 'helix') return void this.ui.toast({ kind: 'xp', title: 'A Plainer', body: 'It\'s worn now, not flown from the ground: hit it to pick it up, then wear it (Body).' });
  this.stopRide();
  this.piloting = m;
  // Your feet where its skids stand, and you up in the cabin over them:
  // land, and it lands on its skids, not its floor.
  this.player.teleport?.(m.x, m.y - HELIX_SKIDS, m.z) ?? this.player.position.set(m.x, m.y - HELIX_SKIDS, m.z);
  this.player.seatHeight = HELIX_SKIDS;
  this.player.yaw = m.yaw ?? this.player.yaw;
  this.player.flying = true;
  this.player.velocity?.set?.(0, 0, 0);
  // From behind, far enough back to see the whole of it.
  this.player.viewReach = 9;
  this.ui?.setFlyIndicator?.(true);
  this.ui?.refreshTools?.();
  this.ui.toast({ kind: 'xp', title: 'Flying the Helix', body: 'Jump rises, Sneak sinks, look to steer. Land and Sneak to get out.' });
}

/** Out of the machine, beside it; it stays where it landed. `stay`: you're elsewhere already. */
export function leaveMachine(stay = false) {
  const m = this.piloting;
  if (!m) return;
  this.piloting = null;
  this.player.flying = false;
  this.player.viewReach = 0;
  this.player.seatHeight = 0;
  this.ui?.setFlyIndicator?.(false);
  // Down to whatever's under it, so a machine left in the air doesn't
  // hang there — standing on its skids.
  let y = Math.floor(m.y);
  while (y > 0 && !this.world.isCollidable(Math.floor(m.x), y - 1, Math.floor(m.z))) y--;
  m.y = y + (m.kind === 'helix' ? HELIX_SKIDS : 0);
  this.ui?.refreshTools?.();
  if (stay) return;
  const side = (m.yaw ?? 0) + Math.PI / 2;
  this.player.position.x = m.x + Math.sin(side) * 1.8;
  this.player.position.z = m.z + Math.cos(side) * 1.8;
}

/** Each frame in the machine: it goes where you go; land and Sneak to get out. */
export function tickPilot() {
  const m = this.piloting;
  if (!m) return;
  const p = this.player;
  if (!this.duilt || !this.duilt.machines.includes(m)) return void this.leaveMachine(true);
  // Sent somewhere in one go (a respawn, a bed): the machine stays behind.
  if (Math.hypot(p.position.x - m.x, p.position.z - m.z) > 30) return void this.leaveMachine(true);
  m.x = p.position.x; m.y = p.position.y + (m.kind === 'helix' ? HELIX_SKIDS : 0); m.z = p.position.z;
  m.yaw = p.yaw;
  const down = p.sneakHeld || p.keys?.has?.(p.binds?.down);
  if (p.grounded && (p.sneaking || (p.flying && down))) this.leaveMachine();
}

/**
 * Who may fly (asked for directly: a flying machine, "a wooden plane da
 * Vinci style"). Creative flies as it always has; in Duilt you fly in a
 * Helix, and only there. The Plainer's wings hold you when you fall — a
 * glide down, not a fall — and that's all it does ("Plainer I need to go
 * high in the sky and drop and I'll plain through the air descending
 * helix is a helicopter which allows flying in all directions").
 */
export function wireFlight() {
  const p = this.player;
  if (!p) return;
  p.canFly = () => !this.duilt || this.duilt.sandbox || this.hasFlyingMachine();
  p.canGlide = () => this.wearingPlainer();
  p.onFlyRefused = () => this.ui?.toast({
    kind: 'xp', title: 'Flying is the Helix\'s',
    body: 'Set a Helix down and climb in. A Plainer, worn, glides you down from somewhere high.',
  });
  this.ui?.refreshTools?.();
}

/** The horse under the crosshair, if that's what's there. */
export function horseTarget(hit) {
  if (!this.duilt || this.riding) return null;
  const m = this.mobTarget(hit);
  return m && MOBS_BY_ID.get(m.type)?.rideable ? m : null;
}

/**
 * Place on a horse (asked for directly: "horses with wooden carts, at
 * age 2 — you need to have a horse and build the cart and apply the cart
 * to the horse and it's done. This should take 40 slots of items").
 * A wild one is tamed with fruit or vegetables; yours takes a cart if
 * you're holding one; with a cart it opens (forty slots, and Ride); without
 * one you get on.
 */
export function useHorse(m) {
  const d = this.duilt;
  if (!m.owned) {
    const r = d.tameHorse(m, this.selectedItemId);
    const name = (MOBS_BY_ID.get(m.type)?.name ?? 'Horse').toLowerCase();
    if (!r.ok) return void this.ui.toast({ kind: 'xp', title: `A wild ${name}`, body: r.reason });
    this.ui.toast(m.type === 'horse'
      ? { kind: 'challenge', title: 'The horse is yours', body: 'Build a cart and use it on it — forty slots, and something to ride.' }
      : { kind: 'challenge', title: `The ${name} is yours`, body: 'Place on it to ride. It waits where you leave it.' });
    this.editedAt = Date.now();
    return;
  }
  if (this.selectedItemId === 'cart' && !m.cart) {
    const r = d.hitchCart(m);
    this.ui.toast(r.ok
      ? { kind: 'challenge', title: 'Cart hitched', body: 'Place on it to load it, or to ride.' }
      : { kind: 'xp', title: 'No cart', body: r.reason });
    if (r.ok) this.editedAt = Date.now();
    return;
  }
  if (m.cart) return void this.ui.openStore({ mount: m });
  this.startRide(m);
}

/** Up on the horse: you steer, it goes where you go, faster than on foot. */
export function startRide(m) {
  if (!m?.owned || this.riding || this.piloting) return;
  if (MOBS_BY_ID.get(m.type)?.flies) return void this.ui.toast({ kind: 'xp', title: 'Your dragon is too young to carry you' });
  this.ui.closePanel?.('panel-store');
  this.player.flying = false;
  this.player.teleport?.(m.x, m.y, m.z) ?? this.player.position.set(m.x, m.y, m.z);
  // A horse's head is down its +z; your view at yaw 0 looks down -z.
  this.player.yaw = (m.facing ?? 0) + Math.PI;
  this.player.seatHeight = SEAT_HEIGHT;
  m.ridden = true;
  this.riding = m;
  this.ui.toast({ kind: 'xp', title: 'Riding', body: 'Sneak (or the Down button) to get off.' });
}

/** Down off the horse, beside it; it stays where you left it. `stay`: you're elsewhere already. */
export function stopRide(stay = false) {
  const m = this.riding;
  if (!m) return;
  this.riding = null;
  m.ridden = false;
  m.speed = 0;
  this.player.seatHeight = 0;
  if (stay) return;
  const side = (m.facing ?? 0) + Math.PI / 2;
  this.player.position.x = m.x + Math.sin(side) * 1.2;
  this.player.position.z = m.z + Math.cos(side) * 1.2;
}

/** Each frame while riding: the horse under you, and Sneak to get off. */
export function tickRide(dt) {
  const m = this.riding;
  if (!m) return;
  if (m.dead || m.dying || !this.duilt || this.player.flying) return void this.stopRide();
  if (this.player.sneaking) return void this.stopRide();
  const p = this.player.position;
  const moved = Math.hypot(p.x - m.x, p.z - m.z);
  // Sent somewhere in one go (a respawn, a bed): the horse stays behind.
  if (moved > 6) return void this.stopRide(true);
  m.x = p.x; m.y = p.y; m.z = p.z;
  m.facing = this.player.yaw + Math.PI;
  m.speed = dt > 0 ? moved / dt : 0;
  m.grazing = false;
}
