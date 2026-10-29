import './WandererWarRuntime.js';
import { ROUNDS, LAST_ROUND, ROUND_GOLD, companyWords } from '../config/war.js';
import { FALL_DAYS } from '../duilt/Rivals.js';
import { rivalSites, RIVAL_HEX } from '../world/rivals.js';
export { rivalSites, RIVAL_HEX } from '../world/rivals.js';
import { compass } from '../world/Wanderers.js';
import { WANDERERS } from '../config/wanderers.js';
import { LocalRivalAI } from '../duilt/LocalRivalAI.js';
const WAR_HOME_RANGE = 220;
function rivalColour(id) { return parseInt(RIVAL_HEX[id].slice(1),16); }
function rivalWords(who) {
 const parts=who.map(([kind,n])=>n===1?WANDERERS[kind].one:`${n} ${WANDERERS[kind].many}`);
 return parts.length>1?`${parts.slice(0,-1).join(', ')} and ${parts.at(-1)}`:parts[0];
}

export const methods = {
  tickWar() {
    const d = this.duilt;
    if (!d || d.sandbox || !this.wanderers) return;
    const war = d.war;
    if (war.stage === 'fighting') {
      if (this.wanderers.warParty) this.watchRound();
      else this.sendRound();
      return;
    }
    if (!war.atWar) return;
    const home = this.settlementCentre(), p = this.player.position;
    if (Math.hypot(p.x - home.x, p.z - home.z) > WAR_HOME_RANGE) return;
    const what = war.tick(d.days);
    if (what === 'warn') {
      const shut = this.shutGates();
      if (shut) this.ui?.toast({ kind: 'challenge', title: 'The gates are shut', body: `${shut === 1 ? 'Your gatehouse has' : `${shut} gatehouses have`} closed for the round` });
      const dir = this.kingdomDirection() ?? 'north';
      this.sound?.horn();
      this.ui?.toast({
        kind: 'challenge',
        title: `War horns to the ${dir}`,
        body: `Round ${war.round} of ${LAST_ROUND}: ${companyWords(war.round, WANDERERS)}. They'll be at your border in about a minute.`,
      });
    } else if (what === 'start') {
      this.sendRound();
    }
  },
  sendRound() {
    const war = this.duilt.war;
    const home = this.settlementCentre();
    const k = this.wanderers.landmarks.find((l) => l.kind === 'kingdom');
    const towards = k ? { x: k.x, z: k.z } : { x: home.x, z: home.z - 1000 };
    const band = this.wanderers.sendWarband(home, towards, this.duilt.territory.size / 2, ROUNDS[war.round - 1].who, war.round);
    if (!band) return; // nowhere loaded to gather yet — next frame
    this.wanderers.warParty = { round: war.round, band, died: false };
    const dir = compass(band[0].x - home.x, band[0].z - home.z);
    this.ui?.toast({
      kind: 'challenge',
      title: `Round ${war.round} of ${LAST_ROUND} — they're here`,
      body: `${companyWords(war.round, WANDERERS)}, coming in from the ${dir}. Beat them back.`,
    });
  },
  watchRound() {
    const party = this.wanderers.warParty;
    if (party.band.some((p) => !p.dead && !p.done)) return;
    this.wanderers.warParty = null;
    const d = this.duilt, war = d.war, n = party.round;
    const won = !party.died && !party.band.some((p) => p.escaped);
    const res = war.resolve(won, d.days);
    if (res === 'lost') {
      this.ui?.toast({
        kind: 'xp',
        title: `Round ${n} lost`,
        body: party.died ? 'They beat you, and went home with what they came for. They\'ll be back.'
          : 'Some of them got away with what they took. They\'ll be back — the round comes again.',
      });
      return;
    }
    const gold = ROUND_GOLD(n);
    d.collect({ gold });
    if (res === 'victory') {
      this.ui?.toast({
        kind: 'achievement',
        title: 'The dark army is broken',
        body: `All ten rounds beaten, the Warlord with them. The raids are over for good — the white god's light is on your land. +${gold} gold`,
      });
      d.endWhitePath();
      d.checkAgeAdvance();
      this.editedAt = Date.now();
      return;
    }
    this.ui?.toast({
      kind: 'achievement',
      title: `Round ${n} of ${LAST_ROUND} won`,
      body: `+${gold} gold. Round ${war.round} comes in a day or so — or sound a war horn when you're ready.`,
    });
    this.editedAt = Date.now();
  },
  syncRivals() {
    const w = this.wanderers, gen = this.world?.gen;
    if (!w || !gen) return;
    w.rivalState = (lm) => {
      const b = this.duilt?.battle, r = b?.list[lm?.rival];
      if (!r) return null;
      return { garrison: b.garrison(r), fallen: b.fallen(r, this.duilt.days), colour: rivalColour(r.id) };
    };
    const has = w.landmarks.some((l) => l.kind === 'rival');
    if (!!this.duilt?.battle === has) return;
    w.landmarks = has ? w.landmarks.filter((l) => l.kind !== 'rival')
      : [...w.landmarks, ...rivalSites(gen).map((s) => ({ kind: 'rival', rival: s.id, name: s.name, x: s.x, z: s.z, y: s.y, half: s.half, people: s.people }))];
  },
  battleWelcome() {
    const home = this.settlementCentre();
    const names = rivalSites(this.world.gen).map((r) => `${r.name} to the ${compass(r.x - home.x, r.z - home.z)}`);
    this.ui.toast({
      kind: 'challenge', title: 'Battle: three rivals',
      body: `${names.join(', ')} — about 5,000 blocks out, on your map. Build up: once you've a barracks, their armies come. Take a city's standard to break its strength.`,
      duration: 10000,
    });
  },
  tickRivals() {
    const d = this.duilt, b = d?.battle;
    if (!b || d.sandbox || !this.wanderers || this.peerSession?.role==='guest') return;
    if (b.localAI && import.meta.env?.DEV) {
      this.localRivalAI ??= new LocalRivalAI({onStatus:status=>{
        if (this.localAIStatus === status) return;
        this.localAIStatus = status;
        this.ui?.toast({kind:'challenge',title:status==='connected'?'LM Studio rivals connected':'LM Studio unavailable',body:status==='connected'?'Your model is choosing rival strategies.':'Normal rival strategies continue; the model will be tried again.'});
      }});
      void this.localRivalAI.tick(b);
    }
    b.grow(d.days);
    if (!b.armed && d.structures.countOf('barracks') > 0 && b.arm(d.days)) {
      this.editedAt = Date.now();
      this.ui?.toast({ kind: 'challenge', title: 'Your barracks is up — and the rivals have seen it', body: 'Their armies will come for you now, one city at a time. Raise soldiers, build walls.', duration: 8000 });
    }
    const party = this.wanderers.rivalParty;
    if (party) return void this.watchRivals(party);
    const fighting = b.fighting();
    if (fighting) return void this.sendRivals(fighting);
    if (this.wanderers.warParty) return; // the Stone Kingdom's round first
    const home = this.settlementCentre(), p = this.player.position;
    if (Math.hypot(p.x - home.x, p.z - home.z) > WAR_HOME_RANGE) return;
    const due = b.tick(d.days);
    if (!due) return;
    const site = rivalSites(this.world.gen)[due.rival.id];
    if (due.what === 'warn') {
      this.sound?.horn();
      this.ui?.toast({
        kind: 'challenge',
        title: `${site.name} marches on you`,
        body: `${rivalWords(b.company(due.rival))}, from the ${compass(site.x - home.x, site.z - home.z)}. They'll be at your border in about a minute.`,
      });
    } else this.sendRivals(due.rival);
  },
  sendRivals(r) {
    const home = this.settlementCentre();
    const site = rivalSites(this.world.gen)[r.id];
    const band = this.wanderers.sendWarband(home, site, this.duilt.territory.size / 2, this.duilt.battle.company(r), 0);
    if (!band) return; // nowhere loaded to gather yet — next frame
    for (const q of band) { q.rival = r.id; if (!WANDERERS[q.kind].siege) q.colour = rivalColour(r.id); }
    this.wanderers.rivalParty = { rival: r.id, band, died: false };
    this.ui?.toast({ kind: 'challenge', title: `${site.name}'s army is here`, body: `Coming in from the ${compass(band[0].x - home.x, band[0].z - home.z)}. Beat them back.` });
  },
  watchRivals(party) {
    if (party.band.some((q) => !q.dead && !q.done)) return;
    this.wanderers.rivalParty = null;
    const d = this.duilt, b = d.battle, r = b.list[party.rival];
    const site = rivalSites(this.world.gen)[r.id];
    const won = !party.died && !party.band.some((q) => q.escaped);
    b.resolve(r, won, d.days);
    this.editedAt = Date.now();
    if (!won) return void this.ui?.toast({ kind: 'xp', title: `${site.name} got the better of you`, body: 'They went home with what they came for — and a little stronger for it.' });
    const gold = 2 + Math.round(r.strength);
    d.collect({ gold });
    this.ui?.toast({ kind: 'achievement', title: `${site.name}'s army is beaten`, body: `+${gold} gold. They're weaker for it — for now.` });
  },
  takeStandard(aimed) {
    const d = this.duilt, b = d?.battle;
    if (!b) return;
    const site = rivalSites(this.world.gen).find((s) => Math.abs(s.x - aimed.x) <= s.half && Math.abs(s.z - aimed.z) <= s.half);
    if (!site) return;
    const r = b.list[site.id];
    if (b.fallen(r, d.days)) {
      const left = Math.max(1, Math.ceil(r.fallenUntil - d.days));
      return void this.ui.toast({ kind: 'xp', title: `${site.name} is yours`, body: `For now: they'll have rebuilt in ${left === 1 ? 'a day' : `${left} days`}.` });
    }
    const guards = (this.wanderers?.list ?? []).filter((q) => q.landmark?.rival === site.id && q.kind === 'rival_guard' && !q.dead).length;
    if (guards) return void this.ui.toast({ kind: 'challenge', title: 'The garrison holds the standard', body: `${guards} of them still stand. Beat them first.` });
    const gold = b.conquer(r, d.days);
    d.collect({ gold });
    this.editedAt = Date.now();
    this.sound?.lift?.();
    this.ui.toast({ kind: 'achievement', title: `You took ${site.name}`, body: `+${gold} gold in tribute. Their strength is broken in half, and no army comes from them while they rebuild — about ${FALL_DAYS} days.`, duration: 8000 });
  },
  blowHorn() {
    const d = this.duilt;
    if (!d || d.sandbox) return;
    this.sound?.horn();
    const war = d.war;
    if (!war.atWar) {
      this.ui?.toast({ kind: 'xp', title: 'Your horn sounds over the hills', body: war.stage === 'won' ? 'Nobody answers. The war is over.' : 'Nobody answers — the Stone Kingdom isn\'t at war with you.' });
      return;
    }
    if (war.stage === 'fighting') {
      this.ui?.toast({ kind: 'xp', title: 'They\'re already here', body: `Round ${war.round} is at your walls` });
      return;
    }
    if (war.horn(d.days)) {
      this.ui?.toast({ kind: 'challenge', title: 'You sounded the war horn', body: `Round ${war.round} of ${LAST_ROUND} answers. They'll come in about a minute.` });
    } else {
      this.ui?.toast({ kind: 'xp', title: 'They\'re already coming', body: `Round ${war.round} is on its way` });
    }
  }
};
