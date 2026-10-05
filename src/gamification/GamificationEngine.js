import { BLOCKS, BLOCKS_BY_ID, PLACEABLE_BLOCKS } from '../config/blocks.js';
import { ACHIEVEMENTS } from '../config/achievements.js';
import { CHALLENGES_BY_ID, dailyChallengeIdsFor } from '../config/challenges.js';

const SESSION_IDLE_MS = 120_000; // no block edits for 2 minutes ends the session
const ENCLOSED_CHECK_COOLDOWN_MS = 1000;

function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a, b) {
  const A = new Date(a + 'T00:00:00');
  const B = new Date(b + 'T00:00:00');
  return Math.round((B - A) / 86_400_000);
}

/** Experience for a kill: an animal pays twice its hit points, a person theirs — never less than 3. */
export function killXp(kind, hp = 0) {
  return Math.max(3, Math.round(kind === 'mob' ? hp * 2 : hp));
}

function requiredXpForLevel(level) {
  return Math.floor(100 + (level - 1) * 75);
}

function freshSession() {
  return {
    active: false,
    startTime: 0,
    lastActionTime: 0,
    blocksPlaced: 0,
    byType: new Map(),
    distinctTypes: new Set(),
    minX: null, maxX: null, minY: null, maxY: null, minZ: null, maxZ: null,
    symmetryPlacements: 0,
    undergroundBreaks: 0,
    recentTypes: [],
    currentDistinctStreak: 0,
    bestDistinctStreak: 0,
    lastEnclosedCheck: 0,
  };
}

export class GamificationEngine {
  constructor(bus) {
    this.bus = bus;
    // The live settlement, when there is one — set by Game.js whenever it
    // changes. A required goal (see config/achievements.js's requiredGoals)
    // reads the settlement directly rather than through `stats`, so it needs
    // the real thing, not the shadow copy everything else here checks against.
    this.duilt = null;
    this.state = {
      xp: 0,
      level: 1,
      totalBlocksPlaced: 0,
      totalBlocksBroken: 0,
      distinctTypesPlacedEver: new Set(),
      maxHeightPlaced: 0,
      undergroundActions: 0,
      bridgesBuilt: 0,
      enclosedSpacesFound: 0,
      achievementsUnlocked: new Set(),
      earlyUnlockedBlocks: new Set(),
      streakCount: 0,
      lastPlayDate: null,
      challengesCompletedTotal: 0,
      dailyChallenge: { date: null, ids: [], completed: [] },
      lastBuildScore: null,
      templatesSaved: 0,
      templatesPlaced: 0,
      largestTemplateBlocks: 0,
      templateNames: new Set(),

      // The settlement's own progress, which is what the goals are about now
      // that they are the thing teaching the game. Kept here rather than read
      // off Duilt on demand because a goal has to be checkable in a creative
      // world too, where there is no Duilt to ask.
      age: 1,
      claimed: new Set(),     // structure types you have ever claimed
      claimedCount: 0,
      settlersEver: 0,
      landSize: 0,
    };
    this.session = freshSession();
    this.refreshDailyChallenge();
    this.watchSettlement();
  }

  /**
   * Listens to the settlement so a goal can ask about it.
   *
   * One place, rather than every goal reaching into Duilt: a goal is a small
   * predicate over `stats`, and it stays that way whether the world has a
   * settlement in it or not.
   */
  watchSettlement() {
    this.bus.on('duilt:age', ({ age, size }) => {
      this.state.age = Math.max(this.state.age, age ?? 1);
      if (size) this.state.landSize = Math.max(this.state.landSize, size);
      this.checkAchievements(null);
    });
    this.bus.on('territory:expanded', ({ size } = {}) => {
      if (size) this.state.landSize = Math.max(this.state.landSize, size);
      this.checkAchievements(null);
    });
    this.bus.on('structure:claimed', ({ structure } = {}) => {
      if (structure?.type) this.state.claimed.add(structure.type);
      this.state.claimedCount += 1;
      this.checkAchievements(null);
    });
    // The market and the building ladder (the batch's traders and levels):
    // checked as they happen, so a goal can ask what just did.
    this.bus.on('duilt:bought', (e = {}) => this.checkAchievements({ type: 'bought', ...e }));
    // A quest handed in pays its experience (config/quests.js).
    this.bus.on('duilt:quest', ({ quest } = {}) => {
      if (this.duilt?.sandbox || !quest) return;
      this.addXp(quest.reward?.xp ?? 0, `Quest: ${quest.title}`);
      this.checkAchievements({ type: 'quest', quest });
    });
    this.bus.on('structure:upgraded', ({ structure } = {}) => this.checkAchievements({ type: 'upgraded', structure }));
    this.bus.on('settler:arrived', () => {
      this.state.settlersEver += 1;
      this.checkAchievements(null);
    });
  }

  /** Called by Game.js whenever the live settlement changes — a new world, a
   *  loaded one, or leaving Duilt for Creative, where it goes back to null. */
  setDuilt(duilt) {
    this.duilt = duilt ?? null;
    this.checkAchievements(null);
  }

  /** What a goal's check/progress function reads — see requiredGoals in
   *  config/achievements.js for the one kind that needs `duilt` itself. */
  ctx(event = null) {
    return { stats: this.snapshot(), event, duilt: this.duilt };
  }

  // ---- daily challenge / streak bookkeeping ----

  refreshDailyChallenge() {
    const today = todayStr();
    if (this.state.dailyChallenge.date !== today) {
      this.state.dailyChallenge = { date: today, ids: dailyChallengeIdsFor(today), completed: [] };
    }
  }

  registerPlaySession() {
    const today = todayStr();
    if (this.state.lastPlayDate === today) return;
    if (this.state.lastPlayDate) {
      const gap = daysBetween(this.state.lastPlayDate, today);
      this.state.streakCount = gap === 1 ? this.state.streakCount + 1 : 1;
    } else {
      this.state.streakCount = 1;
    }
    this.state.lastPlayDate = today;
    this.bus.emit('streak:update', { count: this.state.streakCount });
    this.checkAchievements(null);
  }

  // ---- session lifecycle ----

  ensureSession(now) {
    this.refreshDailyChallenge();
    this.registerPlaySession();
    if (!this.session.active) {
      this.session = freshSession();
      this.session.active = true;
      this.session.startTime = now;
      this.session.lastActionTime = now;
      this.bus.emit('session:start', {});
    }
  }

  tick(now) {
    if (this.session.active && now - this.session.lastActionTime > SESSION_IDLE_MS) {
      this.endSession();
    }
  }

  endSession() {
    if (!this.session.active) return;
    const s = this.session;
    s.active = false;
    // No "Session complete" bonus any more: it popped up after two idle
    // minutes and was never kept or shown anywhere (backlog batch 2).
    if (s.blocksPlaced > 0) {
      this.state.lastBuildScore = this.computeBuildScore();
      this.bus.emit('session:end', { score: this.state.lastBuildScore });
    }
  }

  computeBuildScore() {
    const s = this.session;
    const totalTypes = PLACEABLE_BLOCKS.length;
    const heightRange = s.maxY != null ? s.maxY - s.minY : 0;
    const sizeScore = Math.min(100, (s.blocksPlaced / 5));
    const varietyScore = Math.min(100, (s.distinctTypes.size / totalTypes) * 100);
    const heightScore = Math.min(100, (heightRange / 20) * 100);
    const totalScore = Math.round(sizeScore * 0.5 + varietyScore * 0.3 + heightScore * 0.2);
    return {
      totalScore,
      sizeScore: Math.round(sizeScore),
      varietyScore: Math.round(varietyScore),
      heightScore: Math.round(heightScore),
      blocksPlaced: s.blocksPlaced,
      distinctTypes: s.distinctTypes.size,
      heightRange,
    };
  }

  // ---- XP / levels ----

  addXp(amount, reason) {
    if (amount <= 0) return;
    this.state.xp += amount;
    this.bus.emit('xp:gain', { amount, reason, xp: this.state.xp, level: this.state.level });
    const startLevel = this.state.level;
    while (this.state.xp >= requiredXpForLevel(this.state.level)) {
      this.state.xp -= requiredXpForLevel(this.state.level);
      this.state.level += 1;
      this.bus.emit('level:up', { level: this.state.level });
    }
    if (this.state.level > startLevel) {
      this.checkAchievements(null);
      for (const b of BLOCKS) {
        if (b.unlock?.type === 'level' && b.unlock.value > startLevel && b.unlock.value <= this.state.level) {
          this.bus.emit('block:unlock', b);
        }
      }
    }
  }

  xpProgress() {
    const req = requiredXpForLevel(this.state.level);
    return { xp: this.state.xp, required: req, level: this.state.level, pct: Math.min(1, this.state.xp / req) };
  }

  // ---- block events (called by Game after applying a change to the world) ----

  onBlockPlaced({ world, x, y, z, type, viaSymmetry, now }) {
    this.ensureSession(now);
    const s = this.session;
    s.lastActionTime = now;
    s.blocksPlaced += 1;
    s.byType.set(type, (s.byType.get(type) || 0) + 1);
    s.distinctTypes.add(type);
    if (viaSymmetry) s.symmetryPlacements += 1;
    s.minX = s.minX == null ? x : Math.min(s.minX, x);
    s.maxX = s.maxX == null ? x : Math.max(s.maxX, x);
    s.minY = s.minY == null ? y : Math.min(s.minY, y);
    s.maxY = s.maxY == null ? y : Math.max(s.maxY, y);
    s.minZ = s.minZ == null ? z : Math.min(s.minZ, z);
    s.maxZ = s.maxZ == null ? z : Math.max(s.maxZ, z);

    const windowStart = Math.max(0, s.recentTypes.length - s.currentDistinctStreak);
    const window = s.recentTypes.slice(windowStart);
    s.currentDistinctStreak = window.includes(type) ? 1 : s.currentDistinctStreak + 1;
    s.recentTypes.push(type);
    if (s.recentTypes.length > 16) s.recentTypes.shift();
    s.bestDistinctStreak = Math.max(s.bestDistinctStreak, s.currentDistinctStreak);

    this.state.totalBlocksPlaced += 1;
    const isFirstEver = !this.state.distinctTypesPlacedEver.has(type);
    this.state.distinctTypesPlacedEver.add(type);
    this.state.maxHeightPlaced = Math.max(this.state.maxHeightPlaced, y);

    const underground = y < world.surfaceHeight(x, z) - 2;
    if (underground) this.state.undergroundActions += 1;

    if (this.detectBridge(world, x, y, z)) this.state.bridgesBuilt = Math.max(this.state.bridgesBuilt, 1);
    if (now - s.lastEnclosedCheck > ENCLOSED_CHECK_COOLDOWN_MS && this.state.enclosedSpacesFound === 0) {
      s.lastEnclosedCheck = now;
      if (this.detectEnclosedSpace(world, x, y, z)) this.state.enclosedSpacesFound += 1;
    }

    // No experience for placing (asked for directly: "remove the experience
    // by placing and stuff, experience should come from goals ... Plus
    // killing players and mobs should give exp too"). It's still counted,
    // for the goals that ask how much you've built.

    this.checkAchievements({ type: 'place', blockId: type, x, y, z });
    this.checkChallenges();
  }

  onBlockBroken({ world, x, y, z, type, now }) {
    this.ensureSession(now);
    const s = this.session;
    s.lastActionTime = now;
    this.state.totalBlocksBroken += 1;
    const underground = y < world.surfaceHeight(x, z) - 2;
    if (underground) {
      this.state.undergroundActions += 1;
      s.undergroundBreaks += 1;
    }
    this.checkAchievements({ type: 'break', blockId: type, x, y, z });
    this.checkChallenges();
  }

  // ---- kills ----

  /**
   * Something you brought down yourself: an animal (`mob`, its hit points)
   * or a person (`person`, theirs) — the harder to bring down, the more it
   * pays. Your army, soldiers and guardian fight for you, but the
   * experience is for what you do yourself. Nothing in a sandbox.
   */
  onKill({ kind, hp = 0, name = null } = {}) {
    if (this.duilt?.sandbox) return 0;
    const xp = killXp(kind, hp);
    this.addXp(xp, name ? `Brought down ${name}` : null);
    return xp;
  }

  // ---- templates ----

  /**
   * Designing a reusable template is a creative act in its own right, so it
   * pays like one. Templates also give achievements something concrete to
   * reference: a saved design has a known size and block manifest.
   */
  onTemplateSaved(record) {
    this.state.templatesSaved += 1;
    this.state.largestTemplateBlocks = Math.max(this.state.largestTemplateBlocks, record.blockCount);
    this.state.templateNames.add(record.name.toLowerCase());
    this.checkAchievements({ type: 'template:save', record });
  }

  onTemplatePlaced(record) {
    this.state.templatesPlaced += 1;
    this.checkAchievements({ type: 'template:place', record });
  }

  // ---- spatial heuristics ----

  detectBridge(world, x, y, z) {
    const runLength = (dx, dz) => {
      let len = 1;
      for (const sign of [1, -1]) {
        let cx = x, cz = z;
        for (let i = 0; i < 20; i++) {
          cx += dx * sign; cz += dz * sign;
          if (world.getBlock(cx, y, cz) === 0) break;
          if (world.getBlock(cx, y - 1, cz) !== 0) break;
          len++;
        }
      }
      return len;
    };
    if (world.getBlock(x, y - 1, z) !== 0) return false;
    return runLength(1, 0) >= 5 || runLength(0, 1) >= 5;
  }

  detectEnclosedSpace(world, x, y, z) {
    const neighbors = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    let startAir = null;
    for (const [dx, dy, dz] of neighbors) {
      if (world.getBlock(x + dx, y + dy, z + dz) === 0) { startAir = [x + dx, y + dy, z + dz]; break; }
    }
    if (!startAir) return false;

    const radius = 6;
    const bounds = { minX: x - radius, maxX: x + radius, minY: Math.max(0, y - radius), maxY: y + radius, minZ: z - radius, maxZ: z + radius };
    const visited = new Set();
    const stack = [startAir];
    let count = 0;
    while (stack.length) {
      const [cx, cy, cz] = stack.pop();
      const key = `${cx},${cy},${cz}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (cx <= bounds.minX || cx >= bounds.maxX || cy <= bounds.minY || cy >= bounds.maxY || cz <= bounds.minZ || cz >= bounds.maxZ) {
        return false; // escaped the bounding box: not enclosed
      }
      count++;
      if (count > 400) return false; // too large to be a small room
      for (const [dx, dy, dz] of neighbors) {
        const nx = cx + dx, ny = cy + dy, nz = cz + dz;
        if (world.getBlock(nx, ny, nz) === 0 && !visited.has(`${nx},${ny},${nz}`)) stack.push([nx, ny, nz]);
      }
    }
    return count >= 4;
  }

  // ---- achievements / challenges / unlocks ----

  snapshot() {
    return {
      ...this.state,
      ...this.settlementNow(),
      sessionBlocksPlaced: this.session.blocksPlaced,
      challengesCompleted: this.state.challengesCompletedTotal,
    };
  }

  /**
   * The settlement's facts as the world itself has them, merged over what the
   * events above have counted. Those counts are never saved and only move on
   * an event, so a world reopened in its second age — or with buildings
   * claimed last time — read as "Age 1" with nothing claimed. Reported
   * directly: every Age 1 goal ticked, and no Age 2 in the panel, though the
   * world had moved on.
   */
  settlementNow() {
    const d = this.duilt;
    const st = this.state;
    if (!d || d.sandbox) return {};
    const standing = d.structures?.list?.().filter((s) => s.valid) ?? [];
    const claimed = new Set(st.claimed);
    for (const s of standing) claimed.add(s.type);
    return {
      age: Math.max(st.age, d.age ?? 1),
      landSize: Math.max(st.landSize, d.territory?.size ?? 0),
      claimed,
      claimedCount: Math.max(st.claimedCount, standing.length),
      settlersEver: Math.max(st.settlersEver, d.settlers?.people?.length ?? 0),
    };
  }

  checkAchievements(event) {
    // A sandbox world has no progression at all — reported directly as
    // wanting Creative "without achievements progression" once it got the
    // rest of Duilt's engine. Every path that could unlock something (XP
    // level-ups, a claimed structure, a settler arriving, an age advancing)
    // runs through here, so one guard covers all of them rather than
    // scattering a `duilt.sandbox` check into each listener in
    // watchSettlement below. isBlockUnlocked stays reachable on its own —
    // Game.js's blockAvailability bypasses it for a sandbox world directly,
    // since nothing should ever be gated there in the first place.
    if (this.duilt?.sandbox) return;
    const ctx = this.ctx(event);
    for (const ach of ACHIEVEMENTS) {
      if (this.state.achievementsUnlocked.has(ach.id)) continue;
      if (ach.check(ctx)) {
        this.state.achievementsUnlocked.add(ach.id);
        if (ach.xpReward) this.addXp(ach.xpReward, `Achievement: ${ach.name}`);
        this.bus.emit('achievement:unlock', ach);
        this.checkBlockUnlocksFromAchievement(ach.id);
      }
    }
  }

  checkChallenges() {
    const dc = this.state.dailyChallenge;
    for (const id of dc.ids) {
      if (dc.completed.includes(id)) continue;
      const challenge = CHALLENGES_BY_ID.get(id);
      if (!challenge) continue;
      if (challenge.check({ session: this.session })) {
        dc.completed.push(id);
        this.state.challengesCompletedTotal += 1;
        this.addXp(challenge.xpReward, `Challenge: ${challenge.description}`);
        if (challenge.unlockBlock) {
          this.state.earlyUnlockedBlocks.add(challenge.unlockBlock);
          this.bus.emit('block:unlock', BLOCKS_BY_ID.get(challenge.unlockBlock));
        }
        this.bus.emit('challenge:complete', challenge);
        this.checkAchievements(null);
      }
    }
  }

  checkBlockUnlocksFromAchievement(achievementId) {
    for (const b of BLOCKS) {
      if (b.unlock?.type === 'achievement' && b.unlock.value === achievementId) {
        this.bus.emit('block:unlock', b);
      }
    }
  }

  isBlockUnlocked(id) {
    const cfg = BLOCKS_BY_ID.get(id);
    if (!cfg || !cfg.unlock) return true;
    if (this.state.earlyUnlockedBlocks.has(id)) return true;
    if (cfg.unlock.type === 'level') return this.state.level >= cfg.unlock.value;
    if (cfg.unlock.type === 'achievement') return this.state.achievementsUnlocked.has(cfg.unlock.value);
    return true;
  }

  unlockedBlocks() {
    return PLACEABLE_BLOCKS.filter((b) => this.isBlockUnlocked(b.id));
  }

  // ---- persistence ----

  toJSON() {
    return {
      xp: this.state.xp,
      level: this.state.level,
      totalBlocksPlaced: this.state.totalBlocksPlaced,
      totalBlocksBroken: this.state.totalBlocksBroken,
      distinctTypesPlacedEver: [...this.state.distinctTypesPlacedEver],
      maxHeightPlaced: this.state.maxHeightPlaced,
      undergroundActions: this.state.undergroundActions,
      bridgesBuilt: this.state.bridgesBuilt,
      enclosedSpacesFound: this.state.enclosedSpacesFound,
      achievementsUnlocked: [...this.state.achievementsUnlocked],
      earlyUnlockedBlocks: [...this.state.earlyUnlockedBlocks],
      streakCount: this.state.streakCount,
      lastPlayDate: this.state.lastPlayDate,
      challengesCompletedTotal: this.state.challengesCompletedTotal,
      dailyChallenge: this.state.dailyChallenge,
      lastBuildScore: this.state.lastBuildScore,
      templatesSaved: this.state.templatesSaved,
      templatesPlaced: this.state.templatesPlaced,
      largestTemplateBlocks: this.state.largestTemplateBlocks,
      templateNames: [...this.state.templateNames],
    };
  }

  loadJSON(json) {
    if (!json) return;
    this.state.xp = json.xp ?? 0;
    this.state.level = json.level ?? 1;
    this.state.totalBlocksPlaced = json.totalBlocksPlaced ?? 0;
    this.state.totalBlocksBroken = json.totalBlocksBroken ?? 0;
    this.state.distinctTypesPlacedEver = new Set(json.distinctTypesPlacedEver ?? []);
    this.state.maxHeightPlaced = json.maxHeightPlaced ?? 0;
    this.state.undergroundActions = json.undergroundActions ?? 0;
    this.state.bridgesBuilt = json.bridgesBuilt ?? 0;
    this.state.enclosedSpacesFound = json.enclosedSpacesFound ?? 0;
    this.state.achievementsUnlocked = new Set(json.achievementsUnlocked ?? []);
    this.state.earlyUnlockedBlocks = new Set(json.earlyUnlockedBlocks ?? []);
    this.state.streakCount = json.streakCount ?? 0;
    this.state.lastPlayDate = json.lastPlayDate ?? null;
    this.state.challengesCompletedTotal = json.challengesCompletedTotal ?? 0;
    this.state.dailyChallenge = json.dailyChallenge ?? { date: null, ids: [], completed: [] };
    this.state.lastBuildScore = json.lastBuildScore ?? null;
    this.state.templatesSaved = json.templatesSaved ?? 0;
    this.state.templatesPlaced = json.templatesPlaced ?? 0;
    this.state.largestTemplateBlocks = json.largestTemplateBlocks ?? 0;
    this.state.templateNames = new Set(json.templateNames ?? []);
    this.refreshDailyChallenge();
  }
}
