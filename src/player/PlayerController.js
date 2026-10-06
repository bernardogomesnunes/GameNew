import * as THREE from 'three';
import { VIEW_DISTANCE } from '../config/avatar.js';
import { isTyping } from '../ui/Panels.js';
import { AIR, isFluid } from '../config/blocks.js';
import { DEFAULT_CONTROLS } from '../config/controls.js';

const HALF_WIDTH = 0.3;
const HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const GRAVITY = -26;
const JUMP_SPEED = 8.2;
const WALK_SPEED = 4.6;
const SPRINT_SPEED = 7.2;
/**
 * Sneaking (asked for directly, a Down button on the right "to sneak"): a
 * slow, careful walk with your head a little lower, and the edge of a drop
 * stops you instead of tipping you over it.
 */
const SNEAK_SPEED = 1.6;
const SNEAK_DROP = 0.28;
const SNEAK_EASE = 12;
// A heavy blow's shove: how fast it throws you back, how high, and how quickly it dies away.
const KNOCK_SPEED = 9, KNOCK_LIFT = 5.5, KNOCK_FADE = 6;
const FLY_SPEED = 10;
const FLY_SPRINT_SPEED = 20;
// Coming down under a flying machine's wings with the flying turned off: a
// glide, not a fall — the wings hold you, and the landing doesn't hurt.
const GLIDE_FALL_SPEED = 3.5;
/*
 * Walking into something low lifts you onto it instead of stopping you dead.
 * A slab's hitbox is only the bottom half of its cell (see
 * World.collisionBoxAt), so half a block is enough to walk onto one from
 * the ground. Stairs get a whole block: their hitbox is the whole cell (its
 * three steps are drawn, not collided), so each stair in a flight sits a
 * full block above the one before it, and without this a staircase would
 * need a jump per step. A full cube is still a jump.
 */
const STEP_HEIGHT = 0.5;
const STAIR_STEP_HEIGHT = 1;
const STEP_EASE = 14; // how fast the camera catches up after a step, per second
/*
 * The near clip plane, in two settings. 0.2 out in the open for depth
 * precision (see Game's own note where the camera is made), but its corners
 * reach further from the eye than the player's 0.3 half-width, so pressed
 * against a wall at an angle — down a one-wide shaft, say — it sliced into
 * the rock and you saw through it. Close to a block it drops to 0.05.
 */
const NEAR_OPEN = 0.2;
const NEAR_CLOSE = 0.05;
/*
 * Water was never collidable (see World's NON_COLLIDABLE set), which is
 * correct — you should be able to swim into it — but nothing filled in what
 * happens once you're in it, so it acted exactly like air and you sank or
 * walked through a river like it wasn't there. This is what actually holds
 * you: gentler gravity, a soft cap on how fast you sink, and a small upward
 * pull when you're not actively paddling, so letting go of every key drifts
 * you back toward the surface instead of straight to the bottom.
 */
const SWIM_SPEED = 3.0;      // walking speed underwater; water resists you
const SWIM_VERTICAL_SPEED = 3.2; // paddling up (Space) or diving down (Ctrl)
const SWIM_FLOAT_SPEED = 0.8; // passive buoyancy — no input at all still drifts up
const SWIM_EASE = 6;         // how fast vertical speed catches up to the target above
/** How high a swimmer can climb out: onto a bank level with the water, not one a block above it. */
const SWIM_STEP_HEIGHT = 1.25;
/*
 * Camera-on-a-stick tuning.
 *
 * A stick can only ask for a turn *rate*, so unlike a mouse it trades top speed
 * against fine aim, and the numbers here had been pushed too far the fast way:
 * 206 deg/s at full stick and 330 with the ramp charged, which is most of a
 * full turn in a second. On a phone that reads as the camera running away from
 * your thumb — you overshoot what you were aiming at, correct, overshoot back.
 *
 * Halved, roughly, and the ramp softened with it. This is a game about placing
 * one block on top of another, not about whipping round behind you.
 */
const LOOK_YAW_SPEED = 2.2;   // rad/s at full deflection (~126 deg/s)
const LOOK_PITCH_SPEED = 1.5; // rad/s; pitch only spans 180 degrees in total
/*
 * How fast the camera catches up with the thumb, as a time constant: 1/18 is
 * about 55ms to settle, 170ms to arrive.
 *
 * This was 34 — 30ms — which is enough to filter jitter and nothing else, so a
 * stick shoved from rest turned into an instant full-speed swing. Most of what
 * reads as "abrupt" is that first frame. Slower than this and it stops feeling
 * like the camera is attached to your thumb.
 */
const LOOK_SMOOTHING = 18;
// Holding the stick out ramps the turn up, so small pushes stay precise while a
// held push still swings you around. Standard console-shooter behaviour.
const LOOK_ACCEL_MAX = 1.35;  // multiplier reached at full ramp (~170 deg/s peak)
const LOOK_ACCEL_TIME = 0.75; // seconds of sustained deflection to get there
const LOOK_ACCEL_GATE = 0.7;  // deflection above which the ramp charges

export class PlayerController {
  constructor(world, camera, spawn) {
    this.world = world;
    this.camera = camera;
    this.camera.rotation.order = 'YXZ';

    this.position = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
    this.velocity = new THREE.Vector3();
    // A shove from a heavy blow (knockBack): added to your walking, fading fast.
    this.knock = { x: 0, z: 0 };
    // Just arrived: the first landing doesn't hurt — see trackFall.
    this.arriving = true;
    // Which way you see the world: 'first', 'behind' or 'front' — see config/avatar.js.
    this.view = 'first';
    this._eye = new THREE.Vector3();
    this._look = new THREE.Euler();
    this.yaw = 0;
    this.pitch = 0;
    this.flying = false;
    this.grounded = false;
    this.swimming = false;
    this.bounds = null;   // set by Duilt to the land you have claimed

    this.keys = new Set();
    this.externalMove = { x: 0, z: 0 };
    // The touch stick pushed all the way out runs — a phone has no Shift
    // (asked for directly: "can't run in mobile").
    this.stickSprint = false;
    this.externalUp = 0;
    // The touch Down button held (Game.onFlyDown): sneaking, on your feet.
    this.sneakHeld = false;
    this.sneaking = false;
    this.sneakLag = 0; // how far down the camera has dipped for a sneak, in blocks
    // Held right-stick deflection: turns the camera at a rate, unlike the
    // mouse and drag paths which apply one-off deltas. `lookSmoothed` trails it
    // so starting and stopping a turn eases instead of snapping.
    this.lookInput = { x: 0, y: 0 };
    this.lookSmoothed = { x: 0, y: 0 };
    this.lookRamp = 0; // 0..1 charge of the turn acceleration
    // Duilt scales this with hunger and Athletics; 1 everywhere else.
    this.speedScale = 1;
    this.sprint = false;
    this.jumpQueued = false;
    this.stepLag = 0; // how far the camera still trails a step up, in blocks
    this.seatHeight = 0; // how far up a saddle lifts you while riding
    // Which key does what — see config/controls.js. Game hands over the
    // player's own choices; these are the defaults until it does.
    this.binds = { ...DEFAULT_CONTROLS.keys };

    this._onKeyDown = (e) => {
      // A space in a password field must not make the player jump, and an "f"
      // in an email address must not start them flying.
      if (isTyping(e)) return;
      this.keys.add(e.code);
      const b = this.binds;
      if (e.code === b.sprint) this.sprint = true;
      if (e.code === b.jump) this.jumpQueued = true;
      if (e.code === b.fly && !e.repeat) this.toggleFly();
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
      if (e.code === this.binds.sprint) this.sprint = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    this.syncCamera();
  }

  /**
   * Forgets anything currently held down.
   *
   * A key pressed before a panel opened is still held when it closes, and the
   * player would set off walking the moment you came back. The browser sends no
   * keyup for a key released while something else had focus, so this has to be
   * explicit.
   */
  releaseKeys() {
    if (!this.keys.size && !this.sprint) return;
    this.keys.clear();
    this.sprint = false;
    this.jumpQueued = false;
    this.velocity.x = 0;
    this.velocity.z = 0;
  }

  toggleFly() {
    // In Duilt you fly by owning a flying machine (Game sets canFly); a
    // world without one says why rather than doing nothing.
    if (!this.flying && !this.canFly()) { this.onFlyRefused?.(); return; }
    this.flying = !this.flying;
    this.velocity.set(0, 0, 0);
  }

  /** Whether flying is allowed right now. Anything goes until Game says otherwise. */
  canFly() { return true; }

  /** Whether the wings will hold a fall — see GLIDE_FALL_SPEED. */
  canGlide() { return false; }

  look(deltaX, deltaY) {
    this.yaw -= deltaX;
    this.pitch -= deltaY;
    const limit = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  requestJump() {
    this.jumpQueued = true;
  }

  update(dt) {
    // Clamping low enough to matter turns a bad frame into slow motion, which
    // reads as input lag. 0.1s still can't tunnel through a block at this speed.
    dt = Math.min(dt, 0.1);
    this.resolveStuck();
    // Checked at chest height, not the feet: wading through ankle-deep water
    // should still walk and jump normally, not float.
    this.swimming = !this.flying && this.isWaterAt(this.position.x, this.position.y + HEIGHT * 0.5, this.position.z);

    const k = 1 - Math.exp(-LOOK_SMOOTHING * dt); // frame-rate independent ease
    this.lookSmoothed.x += (this.lookInput.x - this.lookSmoothed.x) * k;
    this.lookSmoothed.y += (this.lookInput.y - this.lookSmoothed.y) * k;

    const deflection = Math.min(1, Math.hypot(this.lookInput.x, this.lookInput.y));
    // Charges while the stick is held out, and drains fast so letting go and
    // re-aiming starts precise again.
    this.lookRamp = deflection > LOOK_ACCEL_GATE
      ? Math.min(1, this.lookRamp + dt / LOOK_ACCEL_TIME)
      : Math.max(0, this.lookRamp - dt / (LOOK_ACCEL_TIME * 0.5));
    const boost = 1 + (LOOK_ACCEL_MAX - 1) * this.lookRamp;

    if (Math.abs(this.lookSmoothed.x) > 1e-4 || Math.abs(this.lookSmoothed.y) > 1e-4) {
      this.look(
        this.lookSmoothed.x * LOOK_YAW_SPEED * boost * dt,
        -this.lookSmoothed.y * LOOK_PITCH_SPEED * boost * dt,
      );
    }
    let moveX = this.externalMove.x;
    let moveZ = this.externalMove.z;
    const b = this.binds;
    if (this.keys.has(b.forward)) moveZ += 1;
    if (this.keys.has(b.back)) moveZ -= 1;
    if (this.keys.has(b.right)) moveX += 1;
    if (this.keys.has(b.left)) moveX -= 1;
    moveX = Math.max(-1, Math.min(1, moveX));
    moveZ = Math.max(-1, Math.min(1, moveZ));

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3()
      .addScaledVector(forward, moveZ)
      .addScaledVector(right, moveX);
    if (wish.lengthSq() > 1) wish.normalize();

    const shift = this.sprint || this.keys.has(b.sprint);
    // One key, two jobs — asked for directly: fly down "on shift" as well as
    // sprint. On your feet Shift sprints; flying or swimming it takes you
    // down, and in the air the down key (Ctrl) is the one that goes faster.
    // The stick pushed right out only ever means faster, never down.
    const sprinting = this.flying ? this.keys.has(b.down) || this.stickSprint : shift || this.stickSprint;
    const goingDown = this.keys.has(b.down) && !this.flying || shift;
    // On your feet, the Down key or button sneaks. A sneak is never a run.
    this.sneaking = !this.flying && !this.swimming && (this.sneakHeld || this.keys.has(b.down));
    // Running on your feet, for whoever's watching (duilt/Suspicion.js).
    this.running = !this.flying && !this.sneaking && sprinting && wish.lengthSq() > 0.01;

    if (this.flying) {
      const speed = (sprinting ? FLY_SPRINT_SPEED : FLY_SPEED) * this.speedScale;
      this.velocity.x = wish.x * speed;
      this.velocity.z = wish.z * speed;
      let up = this.externalUp;
      if (this.keys.has(b.jump)) up += 1;
      if (goingDown) up -= 1;
      this.velocity.y = up * speed;
    } else if (this.swimming) {
      const speed = SWIM_SPEED * this.speedScale;
      this.velocity.x = wish.x * speed;
      this.velocity.z = wish.z * speed;
      let up = this.externalUp;
      if (this.keys.has(b.jump)) up += 1;
      if (goingDown) up -= 1;
      up = Math.max(-1, Math.min(1, up));
      const targetVy = up !== 0 ? up * SWIM_VERTICAL_SPEED : SWIM_FLOAT_SPEED;
      // Eased toward rather than snapped to, same idea as the look smoothing
      // above — water resists a change of direction, it doesn't obey it
      // instantly, and jumping straight to full speed read as bobbing like a
      // cork rather than swimming through something.
      const k = 1 - Math.exp(-SWIM_EASE * dt);
      this.velocity.y += (targetVy - this.velocity.y) * k;
      this.grounded = false;
    } else {
      const speed = (this.sneaking ? SNEAK_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED) * this.speedScale;
      this.velocity.x = wish.x * speed + this.knock.x;
      this.velocity.z = wish.z * speed + this.knock.z;
      const fade = Math.exp(-KNOCK_FADE * dt);
      this.knock.x *= fade; this.knock.z *= fade;
      this.velocity.y += GRAVITY * dt;
      if (this.velocity.y < -50) this.velocity.y = -50;
      this.gliding = !this.grounded && this.velocity.y < -GLIDE_FALL_SPEED && this.canGlide();
      if (this.gliding) this.velocity.y = -GLIDE_FALL_SPEED;
      if (this.jumpQueued && this.grounded) {
        this.velocity.y = JUMP_SPEED * (this.jumpScale ?? 1);
        this.grounded = false;
      }
    }
    this.jumpQueued = false;

    this.moveAndCollide(this.velocity.x * dt, this.velocity.y * dt, this.velocity.z * dt);
    this.trackFall();
    this.sneakLag += ((this.sneaking ? SNEAK_DROP : 0) - this.sneakLag) * (1 - Math.exp(-SNEAK_EASE * dt));
    this.stepLag *= Math.exp(-STEP_EASE * dt);
    if (this.stepLag < 1e-3) this.stepLag = 0;
    this.syncCamera();
  }

  /**
   * How far you fell, for the game to turn into damage (survival/Health.js's
   * fallDamage). The highest point of a fall is kept while you're in the
   * air; landing hands over the drop. Flying and water reset it — landing in
   * a lake is how you survive a cliff.
   */
  trackFall() {
    if (this.flying || this.swimming || this.gliding) { this.fallPeak = null; return; }
    if (!this.grounded) {
      this.fallPeak = Math.max(this.fallPeak ?? this.position.y, this.position.y);
      return;
    }
    if (this.fallPeak != null) {
      const drop = this.fallPeak - this.position.y;
      // Coming into a world (or back after a fall), you drop in before the
      // ground under you is there — reported directly: "when I log into a
      // world, I fall from the sky, and it hurts. It should not hurt." That
      // first landing is free.
      if (drop > 0 && !this.arriving) this.landing = (this.landing ?? 0) + drop;
      this.fallPeak = null;
    }
    // On the ground, you've arrived: from here on a fall is a fall.
    this.arriving = false;
  }

  /** The drop of the last landing, once — 0 when there hasn't been one. */
  takeLanding() {
    const d = this.landing ?? 0;
    this.landing = 0;
    return d;
  }

  /** Puts the player somewhere at once — a respawn — with no fall to account for. */
  /** Shoved away along (dx, dz) — a heavy blow: off your feet, and back a few blocks. */
  knockBack(dx, dz, strength = KNOCK_SPEED) {
    if (this.flying) return;
    const d = Math.hypot(dx, dz) || 1;
    this.knock.x = (dx / d) * strength;
    this.knock.z = (dz / d) * strength;
    if (this.grounded) { this.velocity.y = KNOCK_LIFT; this.grounded = false; }
  }

  teleport(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.knock.x = this.knock.z = 0;
    this.fallPeak = null;
    this.landing = 0;
    this.arriving = true;
    this.syncCamera();
  }

  /**
   * A rectangle the player may not walk out of, in block coordinates, or null
   * for the whole world.
   *
   * Duilt gives you a piece of land and says the rest is not yours yet — but
   * only blocking the *edits* meant you could still stroll off into country
   * you had no business in, and the only sign of it was that nothing you tried
   * to do out there worked. The border is a wall now, treated exactly like
   * block collision so it stops you rather than snatching you back.
   */
  setBounds(bounds) {
    this.bounds = bounds ?? null;
  }

  /** Whether the player's box at (x, z) would stick out past the border. */
  outsideBounds(x, z) {
    const b = this.bounds;
    if (!b) return false;
    return x - HALF_WIDTH < b.minX || x + HALF_WIDTH > b.maxX + 1
        || z - HALF_WIDTH < b.minZ || z + HALF_WIDTH > b.maxZ + 1;
  }

  /**
   * Sneaking on the ground, a step that would leave nothing under your feet
   * isn't taken — you stop at the edge of a drop, the way a careful step
   * does, and can lean out over it to build.
   */
  wouldStepOff(x, z) {
    return this.sneaking && this.grounded && !this.collidesAt(x, this.position.y - 0.05, z);
  }

  moveAndCollide(dx, dy, dz) {
    const p = this.position;

    if (dx !== 0) {
      const nx = p.x + dx;
      if (this.outsideBounds(nx, p.z) || this.wouldStepOff(nx, p.z)) this.velocity.x = 0;
      else if (!this.collidesAt(nx, p.y, p.z)) p.x = nx;
      else if (!this.stepUp(nx, p.z)) this.velocity.x = 0;
    }
    if (dz !== 0) {
      const nz = p.z + dz;
      if (this.outsideBounds(p.x, nz) || this.wouldStepOff(p.x, nz)) this.velocity.z = 0;
      else if (!this.collidesAt(p.x, p.y, nz)) p.z = nz;
      else if (!this.stepUp(p.x, nz)) this.velocity.z = 0;
    }
    if (dy !== 0) {
      const ny = p.y + dy;
      const hits = this.collisionBoxesAt(p.x, ny, p.z);
      if (hits.length) {
        // Snap flush against the surface instead of stopping short of it, so
        // the ground probe below stays reliable and jumping always works.
        // The surface itself might not be a whole block up — a slab or a
        // stair only fills the bottom half of its cell (see World's own
        // note on collisionBoxAt) — so this snaps to whichever real box was
        // hit rather than assuming every solid cell is a full block tall.
        if (dy < 0) {
          p.y = Math.max(...hits.map((h) => h.maxY));
          this.grounded = true;
        } else {
          p.y = Math.min(...hits.map((h) => h.minY)) - HEIGHT - 0.001;
        }
        this.velocity.y = 0;
      } else {
        p.y = ny;
        if (dy < 0) this.grounded = this.collidesAt(p.x, p.y - 0.05, p.z);
      }
    } else {
      this.grounded = this.collidesAt(p.x, p.y - 0.05, p.z);
    }
  }

  /**
   * Moves onto (x, z) lifted to the top of whatever blocked it, if that is
   * low enough to step onto and there is headroom there — see STEP_HEIGHT.
   * The limit comes from the highest box in the way, so a stair standing on
   * a full block steps like a stair, not like the block under it.
   */
  stepUp(x, z) {
    if (this.flying || !(this.grounded || this.swimming)) return false;
    const p = this.position;
    let highest = null;
    for (const h of this.collisionBoxesAt(x, p.y, z)) {
      if (!highest || h.maxY > highest.maxY) highest = h;
    }
    if (!highest) return false;
    const rise = highest.maxY - p.y;
    // Swimming, you pull yourself out onto a bank level with the water —
    // floating, your feet are most of a block under its surface, too far for
    // an ordinary step (asked for directly: "I should be able to leave the
    // water to a block that it's the same height as the water").
    const limit = this.swimming ? SWIM_STEP_HEIGHT : highest.stair ? STAIR_STEP_HEIGHT : STEP_HEIGHT;
    if (rise <= 0 || rise > limit + 1e-6) return false;
    if (this.collidesAt(x, highest.maxY, z) || this.collidesAt(p.x, highest.maxY, p.z)) return false;
    p.x = x;
    p.z = z;
    p.y = highest.maxY;
    this.stepLag += rise;
    return true;
  }

  /**
   * Frees the player if they end up embedded in blocks — walled in by their own
   * building, or dropped into terrain by a spawn or a loaded save. Without this
   * every axis of movement collides and the player is stuck for good.
   */
  resolveStuck() {
    const p = this.position;
    if (!this.collidesAt(p.x, p.y, p.z)) return;

    const cx = Math.floor(p.x) + 0.5;
    const cz = Math.floor(p.z) + 0.5;
    if (!this.collidesAt(cx, p.y, cz)) {
      p.x = cx; p.z = cz;
      return;
    }
    for (let y = Math.floor(p.y); y < this.world.height; y++) {
      if (!this.collidesAt(cx, y, cz)) {
        p.x = cx; p.y = y; p.z = cz;
        this.velocity.set(0, 0, 0);
        return;
      }
    }
    p.x = cx; p.y = this.world.height - HEIGHT - 1; p.z = cz;
    this.velocity.set(0, 0, 0);
  }

  collidesAt(x, y, z) {
    return this.collisionBoxesAt(x, y, z).length > 0;
  }

  /**
   * Every real solid box (world-space Y) the player's AABB at (x, y, z)
   * actually overlaps — not just which cells have something solid in them,
   * since a slab or stair's box only reaches halfway up its cell. See
   * World.collisionBoxAt.
   */
  collisionBoxesAt(x, y, z) {
    const minX = Math.floor(x - HALF_WIDTH), maxX = Math.floor(x + HALF_WIDTH);
    // One cell lower than the feet: a fence's box reaches half a block above
    // its own cell (see World.collisionBoxAt), so it can be in the way of a
    // player whose feet are already in the cell over it.
    const minY = Math.floor(y) - 1, maxY = Math.floor(y + HEIGHT);
    const minZ = Math.floor(z - HALF_WIDTH), maxZ = Math.floor(z + HALF_WIDTH);
    const hits = [];
    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const box = this.world.collisionBoxAt(bx, by, bz);
          if (box && y + HEIGHT > box.minY && y < box.maxY) hits.push(box);
        }
      }
    }
    return hits;
  }

  /** Whether a single point sits inside a water block — see `swimming`. */
  isWaterAt(x, y, z) {
    return isFluid(this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));
  }

  syncCamera() {
    const eyeY = this.position.y + EYE_HEIGHT + this.seatHeight - this.stepLag - this.sneakLag;
    this.camera.position.set(this.position.x, eyeY, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    // Out of your own eyes (playtest, P3): behind your shoulder, or in front
    // looking back — pulled in short of anything solid in between, so a wall
    // behind you never ends up between you and the camera.
    if (this.view === 'behind' || this.view === 'front') {
      const dir = this.lookDirection();
      const away = this.view === 'behind' ? -1 : 1;
      const eye = this._eye.set(this.position.x, eyeY, this.position.z);
      const reach = this.clearDistance(eye, dir.x * away, dir.y * away + (away < 0 ? 0.12 : 0), dir.z * away, VIEW_DISTANCE);
      this.camera.position.set(eye.x + dir.x * away * reach, eye.y + (dir.y * away + (away < 0 ? 0.12 : 0)) * reach, eye.z + dir.z * away * reach);
      this.camera.lookAt(eye);
    }
    if (!this.camera.isPerspectiveCamera) return;
    const cam = this.camera.position;
    const near = this.blockNear(cam.x, cam.y, cam.z) ? NEAR_CLOSE : NEAR_OPEN;
    if (this.camera.near !== near) {
      this.camera.near = near;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Whether any block sits within reach of the near plane's corners around (x, y, z). */
  blockNear(x, y, z) {
    const r = 0.6;
    for (let bx = Math.floor(x - r); bx <= Math.floor(x + r); bx++) {
      for (let by = Math.floor(y - r); by <= Math.floor(y + r); by++) {
        for (let bz = Math.floor(z - r); bz <= Math.floor(z + r); bz++) {
          if (this.world.getBlock(bx, by, bz) !== AIR) return true;
        }
      }
    }
    return false;
  }

  eyePosition() {
    return new THREE.Vector3(this.position.x, this.position.y + EYE_HEIGHT + (this.seatHeight || 0), this.position.z);
  }

  /**
   * Where your eyes point — from your own yaw and pitch, not the camera's,
   * which out of first person is somewhere else looking back at you.
   */
  lookDirection() {
    this._look.set(this.pitch, this.yaw, 0, 'YXZ');
    return new THREE.Vector3(0, 0, -1).applyEuler(this._look);
  }

  /** How far from `from` along (dx, dy, dz) the camera can go before it meets something solid. */
  clearDistance(from, dx, dy, dz, max) {
    const len = Math.hypot(dx, dy, dz) || 1;
    for (let t = 0.3; t <= max; t += 0.1) {
      const x = from.x + (dx / len) * t, y = from.y + (dy / len) * t, z = from.z + (dz / len) * t;
      const id = this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
      if (id !== AIR && !isFluid(id)) return Math.max(0.3, t - 0.35);
    }
    return max;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
