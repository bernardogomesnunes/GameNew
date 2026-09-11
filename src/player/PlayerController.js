import * as THREE from 'three';

const HALF_WIDTH = 0.3;
const HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const GRAVITY = -26;
const JUMP_SPEED = 8.2;
const WALK_SPEED = 4.6;
const SPRINT_SPEED = 7.2;
const TURN_SPEED = 2.4; // radians/sec at full joystick deflection
const FLY_SPEED = 10;
const FLY_SPRINT_SPEED = 20;

export class PlayerController {
  constructor(world, camera, spawn) {
    this.world = world;
    this.camera = camera;
    this.camera.rotation.order = 'YXZ';

    this.position = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.flying = false;
    this.grounded = false;

    this.keys = new Set();
    this.externalMove = { x: 0, z: 0 };
    this.externalUp = 0;
    this.turnInput = 0; // -1..1, held; turns the camera over time rather than by a delta
    this.sprint = false;
    this.jumpQueued = false;

    this._onKeyDown = (e) => {
      this.keys.add(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprint = true;
      if (e.code === 'Space') this.jumpQueued = true;
      if (e.code === 'KeyF') this.toggleFly();
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprint = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    this.syncCamera();
  }

  toggleFly() {
    this.flying = !this.flying;
    this.velocity.set(0, 0, 0);
  }

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
    dt = Math.min(dt, 0.05);
    this.resolveStuck();
    if (this.turnInput) this.yaw -= this.turnInput * TURN_SPEED * dt;
    let moveX = this.externalMove.x;
    let moveZ = this.externalMove.z;
    if (this.keys.has('KeyW')) moveZ += 1;
    if (this.keys.has('KeyS')) moveZ -= 1;
    if (this.keys.has('KeyD')) moveX += 1;
    if (this.keys.has('KeyA')) moveX -= 1;
    moveX = Math.max(-1, Math.min(1, moveX));
    moveZ = Math.max(-1, Math.min(1, moveZ));

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3()
      .addScaledVector(forward, moveZ)
      .addScaledVector(right, moveX);
    if (wish.lengthSq() > 1) wish.normalize();

    const sprinting = this.sprint || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    if (this.flying) {
      const speed = sprinting ? FLY_SPRINT_SPEED : FLY_SPEED;
      this.velocity.x = wish.x * speed;
      this.velocity.z = wish.z * speed;
      let up = this.externalUp;
      if (this.keys.has('Space')) up += 1;
      if (this.keys.has('ControlLeft') || this.keys.has('ShiftLeft')) up -= 1;
      this.velocity.y = up * speed;
    } else {
      const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
      this.velocity.x = wish.x * speed;
      this.velocity.z = wish.z * speed;
      this.velocity.y += GRAVITY * dt;
      if (this.velocity.y < -50) this.velocity.y = -50;
      if (this.jumpQueued && this.grounded) {
        this.velocity.y = JUMP_SPEED;
        this.grounded = false;
      }
    }
    this.jumpQueued = false;

    this.moveAndCollide(this.velocity.x * dt, this.velocity.y * dt, this.velocity.z * dt);
    this.syncCamera();
  }

  moveAndCollide(dx, dy, dz) {
    const p = this.position;

    if (dx !== 0) {
      const nx = p.x + dx;
      if (this.collidesAt(nx, p.y, p.z)) this.velocity.x = 0;
      else p.x = nx;
    }
    if (dz !== 0) {
      const nz = p.z + dz;
      if (this.collidesAt(p.x, p.y, nz)) this.velocity.z = 0;
      else p.z = nz;
    }
    if (dy !== 0) {
      const ny = p.y + dy;
      if (this.collidesAt(p.x, ny, p.z)) {
        // Snap flush against the surface instead of stopping short of it, so
        // the ground probe below stays reliable and jumping always works.
        if (dy < 0) {
          p.y = Math.floor(ny) + 1;
          this.grounded = true;
        } else {
          p.y = Math.floor(ny + HEIGHT) - HEIGHT - 0.001;
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
    const minX = Math.floor(x - HALF_WIDTH), maxX = Math.floor(x + HALF_WIDTH);
    const minY = Math.floor(y), maxY = Math.floor(y + HEIGHT);
    const minZ = Math.floor(z - HALF_WIDTH), maxZ = Math.floor(z + HALF_WIDTH);
    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (this.world.isCollidable(bx, by, bz)) return true;
        }
      }
    }
    return false;
  }

  syncCamera() {
    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  eyePosition() {
    return new THREE.Vector3(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
  }

  lookDirection() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
