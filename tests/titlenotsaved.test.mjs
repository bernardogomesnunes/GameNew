/**
 * Reported directly: "You created a world called title." Nothing in the
 * tests can reach an account — they run signed out — but the game itself
 * could: Leave saves (an upload that first asks the account for its list)
 * and puts the title scene up straight away, without waiting. When the list
 * came back, the upload went on with whatever was loaded by then — the title
 * scene, named "Title" — instead of the world just left.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { Game } = await import('../src/Game.js');

function fake() {
  const g = {
    worldId: 'mine', worldName: 'My world', pendingSave: true, discarded: false, saving: null,
    cloud: { signedIn: true, reportFailure: async () => {} },
    syncState: { agreedFor: () => null, agree() {} },
    bus: { emit() {} },
    uploaded: [], sentHeld: 0,
    async saveToCloud(name) { g.uploaded.push({ id: g.worldId, name }); },
    async sendUnsent() { g.sentHeld++; return true; },
    dropSafeCopy() {},
    ui: null,
  };
  return g;
}

// Leave, then the title scene goes up while the account is still answering.
const g = fake();
g.cloudList = async () => {
  Object.assign(g, { worldId: 'title-scene', worldName: 'Title', discarded: true });
  return [];
};
await Game.prototype.flush.call(g);
ok('the title scene is never uploaded', !g.uploaded.some((u) => u.name === 'Title' || u.id === 'title-scene'));
ok('the world you left goes up from the copy put aside as you left', g.sentHeld === 1);

// Nobody left: an ordinary save still goes up as itself.
const h = fake();
h.cloudList = async () => [];
await Game.prototype.flush.call(h);
ok('an ordinary save is unchanged', h.uploaded.length === 1 && h.uploaded[0].id === 'mine' && h.uploaded[0].name === 'My world' && h.sentHeld === 0);

process.exit(f ? 1 : 0);
