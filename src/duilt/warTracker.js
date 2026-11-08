/**
 * IMP-22: where a round's attackers are, from where you stand. Owner, 5 and 8
 * November: "I did not see any warrior", "I don't see them. Never did." A
 * round is fought some 40 blocks out of town, often over in seconds, so the
 * HUD says how many are left and points at the nearest one.
 *
 * `band`  the round's war party (Wanderers.warParty.band)
 * `at`    where you are { x, z }
 * `look`  which way you face, flat { x, z }
 * Returns null when nobody of theirs is standing, else { left, total, dist,
 * turn }: `turn` in radians from straight ahead, positive to your right.
 */
export function warTrack(band, at, look) {
  let near = null, best = Infinity, left = 0;
  for (const p of band ?? []) {
    if (p.dead || p.done || !(p.hp > 0)) continue;
    left++;
    const d = Math.hypot(p.x - at.x, p.z - at.z);
    if (d < best) { best = d; near = p; }
  }
  if (!near) return null;
  const n = Math.hypot(look.x, look.z) || 1, lx = look.x / n, lz = look.z / n;
  const dx = near.x - at.x, dz = near.z - at.z;
  // Your right, looking along (lx, lz) with y up, is (-lz, lx).
  const turn = Math.atan2(dx * -lz + dz * lx, dx * lx + dz * lz);
  return { left, total: band.length, dist: best, turn };
}
