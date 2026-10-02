import { readFileSync } from 'node:fs';
import { BLOCKS, BLOCKS_BY_ID } from '../src/config/blocks.js';
import { DEFAULT_CONTROLS, SOUND_PARTS, loadControls, saveControls } from '../src/config/controls.js';
import { RATE, Biquad, seeded, seedOf, centroid, loudness } from '../src/audio/synth.js';
import { RECIPES, MATERIAL_NAMES, LOOPS, INSTRUMENTS, render, renderLoop, renderInstrument } from '../src/audio/recipes.js';
import {
  soundOf, materialSound, ACTION_SOUNDS, swingSound, everySound, isSound, busGains, DEFAULT_LEVELS,
  pickAmbience, BEDS, CALLS, musicMood, musicPhrase, MOODS, noteOf,
} from '../src/audio/soundscape.js';
import { Sound } from '../src/audio/Sound.js';

/**
 * The sound, redone (docs/plan-look-and-sound.md, section 6). Asked for
 * directly: "the sounds we have now are awful tbh they are too high and
 * don't make a lot of sense in terms of representation of the action they
 * are meant for." So: every action has a sound that's its own, each
 * material sounds like itself, all of it lower than before; the place and
 * the hour have their own ambience; there's sparse music, darker on the
 * dark path; and a slider for each part.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const take = (key, i = 0) => render(key, seeded(seedOf(`${key}#${i}`)));

// --- every action maps to a sound ----------------------------------------------------------------

const all = everySound();
ok('every action and every material impact names a real recipe', all.every(isSound) && Object.values(ACTION_SOUNDS).every(isSound));
const rendered = all.map((k) => [k, take(k)]);
ok('every sound renders: finite, not silent, never past full scale',
  rendered.every(([, x]) => x && x.length > 0 && x.every(Number.isFinite) && loudness(x) > 0.002 && x.every((v) => Math.abs(v) <= 1)));
ok('every bed loops and every instrument plays',
  Object.keys(LOOPS).every((k) => loudness(renderLoop(k, seeded(1))) > 0.05) && Object.keys(INSTRUMENTS).every((k) => loudness(renderInstrument(k, seeded(1))) > 0.01));

// Every sound the game asks for exists on Sound — none can silently be a no-op.
const called = new Set([...game.matchAll(/this\.sound(?:\?)?\.(\w+)(?:\?\.)?\(/g)].map((m) => m[1]));
const missing = [...called].filter((m) => typeof Sound.prototype[m] !== 'function');
ok(`every sound Game.js plays is a Sound method (${called.size} of them)`, called.size >= 20 && !missing.length);
ok('the actions that were silent or borrowed another sound now have their own',
  /drinkSelected[\s\S]{0,200}sound\?\.drink\(\)/.test(game)
  && /fillBucket[\s\S]{0,600}sound\?\.bucket\(true\)/.test(game) && /emptyBucket[\s\S]{0,900}sound\?\.bucket\(false\)/.test(game)
  && /openChest[\s\S]{0,300}sound\?\.chest\(\)/.test(game)
  && /blowHorn\(\) \{[\s\S]{0,120}sound\?\.horn\(\)/.test(game)
  && /swearOath[\s\S]{0,900}sound\?\.gong\(\)/.test(game)
  && /hitMob[\s\S]{0,700}sound\?\.strike\(\{ weapon/.test(game) && /hitBandit[\s\S]{0,1200}sound\?\.strike\(\{ weapon/.test(game)
  && /creak\(!shutting, door \? 'door' : trap \? 'trapdoor' : 'gate'\)/.test(game)
  && /sound\?\.dig\(soundOf/.test(game)
  && /sound\.land\(underfoot\(\)/.test(game));
ok('hurt is heard whatever hurt you, and arrows loosed nearby are heard', /health:change', \(\{ hurt, cause \}\) => \{ if \(hurt\) this\.sound\.hurt\(cause\)/.test(game)
  && /hear\(this, dt, playing\)/.test(game) && /sound\.bow\(/.test(readFileSync(new URL('../src/audio/listen.js', import.meta.url), 'utf8')));
ok('doors, gates and trapdoors each open and shut their own way',
  swingSound('door', true) === 'doorOpen' && swingSound('door', false) === 'doorClose' && swingSound('gate', true) === 'gateOpen' && swingSound('trapdoor', true) === 'trapdoor');

// --- each material sounds like itself --------------------------------------------------------------

const by = (name) => BLOCKS.find((b) => b.name === name);
ok('blocks sound like what they are: grass rustles, sand hisses, gold clangs, glass rings',
  soundOf(by('Grass')) === 'grass' && soundOf(by('Moss')) === 'grass' && soundOf(by('Dirt')) === 'dirt' && soundOf(by('Sand')) === 'sand'
  && soundOf(by('Gravel')) === 'gravel' && soundOf(by('Snow')) === 'snow' && soundOf(by('Stone')) === 'stone' && soundOf(by('Iron Ore')) === 'stone'
  && soundOf(by('Planks')) === 'wood' && soundOf(by('Leaves')) === 'plant' && soundOf(by('Glass')) === 'glass' && soundOf(by('Framed Window')) === 'glass'
  && soundOf(by('Gold Block')) === 'metal' && soundOf(by('Chain')) === 'metal' && soundOf(by('Red Rug')) === 'cloth'
  && soundOf(by('Water')) === 'water' && soundOf(by('Lava')) === 'lava' && soundOf(null) === 'dirt');
ok('the old test still holds: stone, planks and glass', soundOf(BLOCKS_BY_ID.get(3)) === 'stone' && soundOf(BLOCKS_BY_ID.get(7)) === 'wood' && soundOf(BLOCKS_BY_ID.get(10)) === 'glass');
ok('every block has a sound that exists', BLOCKS.every((b) => MATERIAL_NAMES.includes(soundOf(b))));
ok('the seven asked for are all there, and more', ['stone', 'wood', 'dirt', 'grass', 'sand', 'glass', 'metal'].every((m) => MATERIAL_NAMES.includes(m)) && MATERIAL_NAMES.length >= 11);

// Different materials differ: in where their energy is, or in how long they ring.
const ring = (x) => { let last = 0; const peak = Math.max(...x.map(Math.abs)); x.forEach((v, i) => { if (Math.abs(v) > peak * 0.05) last = i; }); return last / RATE; };
const feats = Object.fromEntries(['stone', 'wood', 'dirt', 'grass', 'sand', 'gravel', 'glass', 'metal', 'plant'].map((m) => {
  const x = take(`place:${m}`);
  return [m, { c: centroid(x), r: ring(x) }];
}));
const names = Object.keys(feats);
const alike = [];
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
  const a = feats[names[i]], b = feats[names[j]];
  const dc = Math.abs(a.c - b.c) / Math.max(a.c, b.c), dr = Math.abs(a.r - b.r) / Math.max(a.r, b.r);
  if (dc < 0.08 && dr < 0.2) alike.push(`${names[i]}/${names[j]}`);
}
ok(`every pair of materials differs in pitch or ring (${alike.join(', ') || 'none alike'})`, !alike.length);
ok('metal rings longest, sand and dirt hardly at all', feats.metal.r > feats.stone.r && feats.metal.r > feats.dirt.r && feats.glass.r > feats.sand.r);
ok('wood knocks lower than stone; stone lower than glass', feats.wood.c < feats.stone.c && feats.stone.c < feats.glass.c);
ok('takes of one sound differ, so steps never repeat exactly', take('step:grass', 0).some((v, i) => v !== take('step:grass', 1)[i]));
ok('a step is quieter than a placed block, which is quieter than a break',
  Math.max(...take('step:stone').map(Math.abs)) < Math.max(...take('place:stone').map(Math.abs))
  && Math.max(...take('place:stone').map(Math.abs)) < Math.max(...take('break:stone').map(Math.abs)));

// --- lower than before -----------------------------------------------------------------------------

/** The old voices, re-made sample for sample (Web Audio's bandpass is this same cookbook filter). */
const OLD = { stone: [2600, 1.2, 180, 0.09], wood: [1400, 1.6, 120, 0.12], dirt: [700, 0.8, 70, 0.14], plant: [3800, 0.6, null, 0.1], glass: [5200, 4, 900, 0.08] };
function legacy(material, { gain = 0.45, pitch = 1, length = 1 } = {}) {
  const [noise, q, knock, d] = OLD[material], decay = d * length, rand = seeded(7);
  const out = new Float32Array(Math.ceil((decay + 0.05) * RATE));
  const flt = new Biquad('bandpass', noise * pitch, q);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    if (t > decay) break;
    out[i] = flt.run(rand() * 2 - 1) * gain * (0.001 / gain) ** (t / decay);
    if (knock && t < decay * 0.8) {
      const fr = t < decay * 0.6 ? knock * pitch * 1.6 * (1 / 1.6) ** (t / (decay * 0.6)) : knock * pitch;
      ph = (ph + fr / RATE) % 1;
      out[i] += (1 - 4 * Math.abs(ph - 0.5)) * gain * 0.6 * (0.001 / (gain * 0.6)) ** (t / (decay * 0.8));
    }
  }
  return out;
}
const lower = [
  ['place:stone', legacy('stone')], ['break:stone', legacy('stone', { pitch: 0.8, length: 1.6 })], ['step:stone', legacy('stone', { gain: 0.14, length: 0.7 })],
  ['place:wood', legacy('wood')], ['place:dirt', legacy('dirt')], ['break:dirt', legacy('dirt', { pitch: 0.8, length: 1.6 })],
  ['step:grass', legacy('dirt', { gain: 0.14, length: 0.7 })], ['place:plant', legacy('plant')], ['place:glass', legacy('glass')],
  ['blow', legacy('wood', { gain: 0.6, pitch: 0.55 })], ['horn', legacy('stone', { gain: 0.9, pitch: 0.4 })],
].map(([k, old]) => [k, centroid(old), centroid(take(k))]);
ok(`every sound is lower than the one it replaced (${lower.map(([k, o, n]) => `${k} ${o | 0}→${n | 0} Hz`).join(', ')})`, lower.every(([, o, n]) => n < o * 0.85));
ok('stone, wood and earth moved down by more than an octave', lower.filter(([k]) => /stone|wood|dirt/.test(k)).every(([, o, n]) => n < o / 2));
ok('a button click: a low tone, not the old 880 Hz beep', centroid(take('click'), RATE, 512) < 880);

// --- the sliders -----------------------------------------------------------------------------------

ok('a slider for each part under the master volume', SOUND_PARTS.map((s) => s.id).join() === 'sfx,ambience,music'
  && SOUND_PARTS.every((s) => DEFAULT_CONTROLS[s.id] > 0 && DEFAULT_CONTROLS[s.id] <= 1) && DEFAULT_CONTROLS.volume === 0.7);
const g = busGains({ volume: 0.5, sfx: 1, ambience: 0.5, music: 0 });
ok('bus gains follow the sliders (squared, so the travel feels even)', g.master === 0.25 && g.sfx === 1 && Math.abs(g.ambience - 0.25 * 0.55) < 1e-9 && g.music === 0);
const d = busGains(DEFAULT_LEVELS);
ok('by default effects lead, ambience sits under them, music lowest', d.sfx > d.ambience && d.ambience > d.music && d.music > 0);
ok('master at zero is off; nonsense is clamped', busGains({ volume: 0 }).master === 0 && busGains({ volume: 5, sfx: -1 }).master === 1 && busGains({ volume: 5, sfx: -1 }).sfx === 0);

const store = new Map();
globalThis.localStorage ??= { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
saveControls({ ...DEFAULT_CONTROLS, volume: 0.9, sfx: 0.3, ambience: 0.1, music: 0 });
const back = loadControls();
ok('the levels are remembered between visits', back.volume === 0.9 && back.sfx === 0.3 && back.ambience === 0.1 && back.music === 0);
store.set('voxelgame:controls', JSON.stringify({ volume: 0.4 }));
ok('settings saved before the parts existed get the defaults for them', loadControls().sfx === DEFAULT_CONTROLS.sfx && loadControls().music === DEFAULT_CONTROLS.music);
ok('the settings show the sliders and apply them as you drag',
  /SOUND_PARTS\.map\(\(s\) => `<label class="ctl-sub">/.test(ui) && /data-part="\$\{s\.id\}"/.test(ui)
  && /addEventListener\('input', \(\) => apply\(\{ \[s\.id\]: Number\(input\.value\) \}\)\)/.test(ui)
  && /input\.disabled = !\(c\.volume > 0\)/.test(ui) && /this\.sound\.setLevels\(this\.controls\)/.test(game));
ok('UI clicks only in panels, and a chime for an achievement',
  /\[id\^="panel-"\] button'\)\) this\.game\.sound\?\.click\(\)/.test(ui) && /kind === 'achievement'\) this\.game\?\.sound\?\.chime\(\)/.test(ui));

// --- ambience by place and time --------------------------------------------------------------------

const noon = pickAmbience({ day: 1, biome: 'forestOak' }), midnight = pickAmbience({ day: 0, biome: 'forestOak' });
ok('a forest by day: birds, wind, no crickets or owls', noon.calls.birds > 0.5 && noon.beds.wind > 0 && noon.calls.crickets === 0 && noon.calls.owls === 0);
ok('a forest by night: crickets and owls, no birds', midnight.calls.birds === 0 && midnight.calls.crickets > 0.3 && midnight.calls.owls > 0.5);
const river = pickAmbience({ day: 1, biome: 'plains', water: 1 });
ok('running water near a river', river.beds.stream > 0.5 && pickAmbience({ day: 1, biome: 'plains' }).beds.stream === 0);
const island = pickAmbience({ day: 1, biome: 'plains', island: true });
ok('high wind on the floating island, in place of the ordinary wind', island.beds.gale > 0.5 && island.beds.wind === 0);
const kingdom = pickAmbience({ day: 1, biome: 'plains', kingdom: 1 });
ok('the Stone Kingdom hums, and has fewer birds', kingdom.beds.hum > 0.4 && kingdom.calls.birds < noon.calls.birds * 0.5 + 0.01 && pickAmbience({ day: 1 }).beds.hum === 0);
const cave = pickAmbience({ day: 1, biome: 'forestOak', underground: 1 });
ok('underground: the cave and its drips, the birds far off', cave.beds.cave > 0.5 && cave.calls.drips > 0.5 && cave.calls.birds < noon.calls.birds * 0.2);
ok('the sea by the ocean, frogs in the wetland at night, lava where there is lava',
  pickAmbience({ day: 1, biome: 'ocean' }).beds.sea > 0.5 && pickAmbience({ day: 0, biome: 'wetland' }).calls.frogs > 0.5
  && pickAmbience({ day: 0, biome: 'desert', lava: 1 }).beds.lava > 0.5);
ok('the desert and the mountains are windier than the forest', pickAmbience({ day: 1, biome: 'desert' }).beds.wind > noon.beds.wind && pickAmbience({ day: 1, biome: 'mountains1' }).beds.wind > noon.beds.wind);
const paused = pickAmbience({ day: 1, biome: 'forestOak', paused: true });
ok('a menu open: everything drops back', paused.calls.birds < noon.calls.birds && paused.beds.wind < noon.beds.wind);
ok('every bed and call is a real loop or call', BEDS.every((b) => LOOPS[b]) && Object.values(CALLS).flat().every(isSound));

// --- music, darker on the dark path ----------------------------------------------------------------

ok('the dark path is dark music whatever the hour; otherwise day or night',
  musicMood({ day: 1, darkPath: true }) === 'dark' && musicMood({ day: 1 }) === 'day' && musicMood({ day: 0.1 }) === 'night');
const avg = (mood) => {
  let sum = 0, n = 0, gaps = 0, gn = 0;
  const rand = seeded(42);
  for (let i = 0; i < 40; i++) {
    const melody = musicPhrase(mood, rand).notes.filter((x) => x.inst === MOODS[mood].inst);
    for (const x of melody) { sum += x.midi; n++; }
    for (let k = 1; k < melody.length; k++) { gaps += melody[k].t - melody[k - 1].t; gn++; }
  }
  return { pitch: sum / n, gap: gaps / gn };
};
const day = avg('day'), night = avg('night'), dark = avg('dark');
ok(`the dark path's music is lower and slower (mean note ${dark.pitch.toFixed(1)} vs ${day.pitch.toFixed(1)} by day)`, dark.pitch < night.pitch && night.pitch < day.pitch && dark.gap > day.gap);
ok('and darker: a half step in its scale, a drone, a bell; the day is a major pentatonic',
  MOODS.dark.scale.includes(1) && MOODS.dark.drone && MOODS.dark.inst === 'bell' && MOODS.day.scale.join() === '0,2,4,7,9' && MOODS.night.scale.includes(3));
const phrase = musicPhrase('day', seeded(5));
ok('sparse: a handful of notes, then most of a minute of silence', phrase.notes.filter((x) => x.inst === 'pluck').length <= 6 && phrase.rest >= 25);
ok('notes stay in key', phrase.notes.every((x) => MOODS.day.scale.includes((((x.midi - MOODS.day.root) % 12) + 12) % 12)) && noteOf('day', 5) === 74);

// --- the engine, against a stand-in for Web Audio ----------------------------------------------------

const quiet = new Sound({ volume: 0.5 });
let threw = false;
try { quiet.unlock(); quiet.place('stone'); quiet.walk(3, 'grass'); quiet.tick(0.1, { day: 1 }); quiet.strike({ weapon: true }); quiet.horn(); } catch { threw = true; }
ok('in Node (no Web Audio) every sound is safe and silent', !threw && !quiet.ready);

/** Just enough of an AudioContext to count what Sound builds. */
class FakeParam { constructor(v) { this.value = v; } setTargetAtTime(v) { this.value = v; } }
class FakeNode { constructor() { this.gain = new FakeParam(1); this.playbackRate = new FakeParam(1); this.pan = new FakeParam(0); } connect(n) { return n; } disconnect() {} start() { FakeCtx.started++; } stop() {} }
class FakeCtx {
  static started = 0;
  constructor() { this.currentTime = 0; this.state = 'running'; this.destination = new FakeNode(); }
  createGain() { return new FakeNode(); }
  createBufferSource() { return new FakeNode(); }
  createStereoPanner() { return new FakeNode(); }
  createBuffer(ch, len, rate) { const d = new Float32Array(len); return { duration: len / rate, getChannelData: () => d }; }
}
globalThis.AudioContext = FakeCtx;
globalThis.requestIdleCallback = () => {};
const s = new Sound({ volume: 0.8, sfx: 0.5, ambience: 1, music: 0.5 });
s.unlock();
const want = busGains({ volume: 0.8, sfx: 0.5, ambience: 1, music: 0.5 });
ok('the buses start at the sliders\' gains', s.ready && ['master', 'sfx', 'ambience', 'music'].every((k) => Math.abs(s.buses[k].gain.value - want[k]) < 1e-9));
s.setLevels({ music: 0, sfx: 1 });
ok('moving a slider moves its bus', s.buses.music.gain.value === 0 && s.buses.sfx.gain.value === 1);
for (let i = 0; i < 30; i++) { s.ctx.currentTime += 0.001; s.play(`place:${MATERIAL_NAMES[i % MATERIAL_NAMES.length]}`, { gap: 0 }); }
ok('no more than twelve effects at once on a phone; the rest are dropped', s.voices === 12 && s.stats.dropped >= 18);
s.voices = 0;
const before = s.stats.started;
s.break('stone'); s.break('stone'); s.break('stone');
ok('forty blocks broken at once are one crunch, not forty', s.stats.started - before === 1);
ok('a sound far away is not played at all', (s.listen(0, 0, 0), !s.play('boom', { at: { x: 500, z: 0 } })));
s.voices = 0;
s.tick(0.1, { day: 1, biome: 'forestOak', water: 1 });
s.tick(0.1, { day: 1, biome: 'forestOak', water: 1 });
ok('listening to a place never shadows a sound (it once overwrote place())', typeof s.place === 'function' && typeof s.break === 'function');
ok('ambience: the beds the place calls for start, one new loop a frame', s.beds.has('wind') && s.beds.has('stream') && !s.beds.has('hum') && Math.abs(s.beds.get('stream').want - 0.8) < 1e-9);
s.setLevels({ music: 0.5 });
s.ctx.currentTime = 1000;
const was = FakeCtx.started;
s.tick(0.1, { day: 1, darkPath: true, biome: 'plains' });
ok('the music plays a phrase when its silence is over — the dark one on the dark path', s.mood === 'dark' && FakeCtx.started - was >= 3 && s.nextPhrase > 1030);
s.setVolume(0);
ok('master off: nothing plays', !s.ready && !s.play('click'));

process.exit(f ? 1 : 0);
