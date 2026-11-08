/**
 * IMP-22: which strangers the people view draws when there are more than it
 * can hold. Owner, 8 November: "I'm being attacked by stone soldiers and I
 * don't see them anywhere." The view holds `max`; a round's attackers are
 * added last to the list, so near a kingdom its guards took every place.
 * Over the limit: anyone fighting you (a round's attackers, raiders, the
 * angry) first, then the nearest to `at`. Under it, the list as it is.
 * `out` is reused from frame to frame.
 */
export function strangersToDraw(list, at, max, out) {
  if (list.length <= max) return list;
  out.length = 0;
  for (const p of list) if (p.war || p.raider || p.angry) out.push(p);
  out.sort((a, b) => dist(a, at) - dist(b, at));
  if (out.length >= max) { out.length = max; return out; }
  const fighting = out.length;
  for (const p of list) if (!(p.war || p.raider || p.angry)) out.push(p);
  const rest = out.slice(fighting).sort((a, b) => dist(a, at) - dist(b, at));
  out.length = fighting;
  for (let i = 0; i < rest.length && out.length < max; i++) out.push(rest[i]);
  return out;
}

const dist = (p, at) => (p.x - at.x) ** 2 + (p.z - at.z) ** 2;
