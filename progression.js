(function attachWebSmallGameProgression(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.WebSmallGameProgression = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildProgression(root) {
  const STORAGE_KEY = "web-small-game.progression.v1";
  const VERSION = 1;
  const MODE_SEQUENCE = ["classic", "rush", "maze", "portal", "chain", "hunter", "collapse", "twin"];
  const CONTRACT_REWARD = 1;
  const ACHIEVEMENT_REWARD = 3;
  const DAILY_REWARD = 5;

  const CONTRACT_DEFS = {
    score_100: { id: "score_100", metric: "score", target: 100, reward: CONTRACT_REWARD },
    food_12: { id: "food_12", metric: "foods", target: 12, reward: CONTRACT_REWARD },
    classic_survive_180: {
      id: "classic_survive_180",
      metric: "ticks",
      target: 180,
      reward: CONTRACT_REWARD,
      modeId: "classic",
    },
    rush_combo_5_contract: {
      id: "rush_combo_5_contract",
      metric: "combo",
      target: 5,
      reward: CONTRACT_REWARD,
      modeId: "rush",
    },
    maze_score_90: {
      id: "maze_score_90",
      metric: "score",
      target: 90,
      reward: CONTRACT_REWARD,
      modeId: "maze",
    },
    portal_teleport_4: {
      id: "portal_teleport_4",
      metric: "teleports",
      target: 4,
      reward: CONTRACT_REWARD,
      modeId: "portal",
    },
    chain_score_120: {
      id: "chain_score_120",
      metric: "score",
      target: 120,
      reward: CONTRACT_REWARD,
      modeId: "chain",
    },
    hunter_score_100: {
      id: "hunter_score_100",
      metric: "score",
      target: 100,
      reward: CONTRACT_REWARD,
      modeId: "hunter",
    },
    collapse_score_100: {
      id: "collapse_score_100",
      metric: "score",
      target: 100,
      reward: CONTRACT_REWARD,
      modeId: "collapse",
    },
    twin_score_80: {
      id: "twin_score_80",
      metric: "score",
      target: 80,
      reward: CONTRACT_REWARD,
      modeId: "twin",
    },
  };

  const CONTRACTS_BY_MODE = {
    classic: ["score_100", "food_12", "classic_survive_180"],
    rush: ["score_100", "food_12", "rush_combo_5_contract"],
    maze: ["score_100", "food_12", "maze_score_90"],
    portal: ["score_100", "food_12", "portal_teleport_4"],
    chain: ["score_100", "food_12", "chain_score_120"],
    hunter: ["score_100", "food_12", "hunter_score_100"],
    collapse: ["score_100", "food_12", "collapse_score_100"],
    twin: ["score_100", "food_12", "twin_score_80"],
  };

  const ACHIEVEMENT_DEFS = [
    { id: "first_food", metric: "foods", target: 1 },
    { id: "score_100", metric: "score", target: 100 },
    { id: "score_250", metric: "score", target: 250 },
    { id: "rush_combo_5", metric: "combo", target: 5, modeId: "rush" },
    { id: "rush_combo_9", metric: "combo", target: 9, modeId: "rush" },
    { id: "maze_score_100", metric: "score", target: 100, modeId: "maze" },
    { id: "portal_teleport_5", metric: "teleports", target: 5, modeId: "portal" },
    { id: "chain_score_150", metric: "score", target: 150, modeId: "chain" },
    { id: "hunter_score_140", metric: "score", target: 140, modeId: "hunter" },
    { id: "collapse_score_140", metric: "score", target: 140, modeId: "collapse" },
    { id: "twin_score_120", metric: "score", target: 120, modeId: "twin" },
    { id: "all_modes", special: "all_modes" },
    { id: "no_pause_120", special: "no_pause_score", target: 120 },
    { id: "first_daily_clear", special: "first_daily_clear" },
    { id: "ten_contracts", special: "contract_count", target: 10 },
    { id: "board_cleared", special: "board_cleared" },
  ];

  let storageAdapter = null;
  let memoryProfile = null;

  function createEmptyProfile() {
    return {
      version: VERSION,
      chips: 0,
      runs: 0,
      bestScoreByMode: {},
      achievements: {},
      contractCompletions: 0,
      playedModes: {},
      dailyClears: {},
    };
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeProfile(candidate) {
    const base = createEmptyProfile();
    const source = candidate && typeof candidate === "object" ? candidate : {};

    return {
      version: VERSION,
      chips: getSafeNumber(source.chips, base.chips),
      runs: getSafeNumber(source.runs, base.runs),
      bestScoreByMode: normalizeMap(source.bestScoreByMode),
      achievements: normalizeMap(source.achievements),
      contractCompletions: getSafeNumber(source.contractCompletions, base.contractCompletions),
      playedModes: normalizeMap(source.playedModes),
      dailyClears: normalizeMap(source.dailyClears),
    };
  }

  function normalizeMap(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
  }

  function getSafeNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function getStorage() {
    if (storageAdapter) {
      return storageAdapter;
    }

    try {
      return root && root.localStorage ? root.localStorage : null;
    } catch (error) {
      return null;
    }
  }

  function loadProfile() {
    const storage = getStorage();

    if (!storage) {
      if (!memoryProfile) {
        memoryProfile = createEmptyProfile();
      }

      return normalizeProfile(memoryProfile);
    }

    try {
      const raw = storage.getItem(STORAGE_KEY);
      return normalizeProfile(raw ? JSON.parse(raw) : null);
    } catch (error) {
      return createEmptyProfile();
    }
  }

  function saveProfile(profile) {
    const normalized = normalizeProfile(profile);
    const storage = getStorage();

    if (!storage) {
      memoryProfile = cloneJson(normalized);
      return normalized;
    }

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      memoryProfile = cloneJson(normalized);
    }

    return normalized;
  }

  function setStorageAdapter(storage) {
    storageAdapter = storage || null;
    memoryProfile = null;
  }

  function resetProfile() {
    const profile = createEmptyProfile();
    saveProfile(profile);
    return getSummary(profile);
  }

  function getSummary(profile) {
    const source = normalizeProfile(profile || loadProfile());
    const unlockedAchievements = countTruthy(source.achievements);
    const daily = getDailyChallenge();

    return {
      chips: source.chips,
      runs: source.runs,
      bestScoreByMode: { ...source.bestScoreByMode },
      achievements: { ...source.achievements },
      unlockedAchievements,
      totalAchievements: ACHIEVEMENT_DEFS.length,
      contractCompletions: source.contractCompletions,
      playedModes: { ...source.playedModes },
      dailyClears: { ...source.dailyClears },
      todayCleared: Boolean(source.dailyClears[daily.key]),
    };
  }

  function countTruthy(value) {
    return Object.keys(value || {}).filter((key) => Boolean(value[key])).length;
  }

  function getContractsForMode(modeId) {
    const ids = CONTRACTS_BY_MODE[modeId] || CONTRACTS_BY_MODE.classic;
    return ids.map((id) => ({ ...CONTRACT_DEFS[id] }));
  }

  function startRun(options) {
    const settings = options || {};
    const modeId = normalizeMode(settings.modeId);
    const dailyChallenge = settings.daily
      ? { ...(settings.challenge || getDailyChallenge(settings.date)) }
      : null;
    const profile = loadProfile();
    const run = {
      id: `${Date.now ? Date.now() : 0}-${Math.floor(Math.random() * 1000000)}`,
      modeId,
      daily: Boolean(dailyChallenge),
      dailyKey: dailyChallenge ? dailyChallenge.key : null,
      dailyChallenge,
      contracts: getContractsForMode(modeId),
      completedContracts: {},
      score: 0,
      foodsEaten: 0,
      bestCombo: 0,
      teleports: 0,
      ticksSurvived: 0,
      noPause: true,
      won: false,
      finalized: false,
      dailyComplete: false,
    };
    const rewards = [];

    profile.playedModes[modeId] = true;
    unlockAchievements(profile, run, rewards);
    saveProfile(profile);

    return buildResult(run, rewards, profile);
  }

  function markPaused(run) {
    if (run) {
      run.noPause = false;
    }

    return run;
  }

  function recordStep(run, game, event) {
    if (!run) {
      return buildResult(run, [], loadProfile());
    }

    const profile = loadProfile();
    const rewards = [];

    updateRunFromGame(run, game, event);
    completeContracts(profile, run, game, rewards);
    maybeCompleteDaily(profile, run, rewards);
    unlockAchievements(profile, run, rewards);

    if (rewards.length > 0) {
      saveProfile(profile);
    }

    return buildResult(run, rewards, profile);
  }

  function finalizeRun(run, game) {
    if (!run || run.finalized) {
      return buildResult(run, [], loadProfile());
    }

    const profile = loadProfile();
    const rewards = [];

    updateRunFromGame(run, game, null);
    run.finalized = true;
    profile.runs += 1;
    profile.playedModes[run.modeId] = true;
    profile.bestScoreByMode[run.modeId] = Math.max(
      getSafeNumber(profile.bestScoreByMode[run.modeId], 0),
      run.score,
    );

    maybeCompleteDaily(profile, run, rewards);
    unlockAchievements(profile, run, rewards);
    saveProfile(profile);

    return buildResult(run, rewards, profile);
  }

  function buildResult(run, rewards, profile) {
    return {
      run,
      rewards: rewards.slice(),
      profile: getSummary(profile),
    };
  }

  function updateRunFromGame(run, game, event) {
    if (!run || !game) {
      return;
    }

    run.score = getSafeNumber(game.score, run.score);
    run.foodsEaten = getSafeNumber(game.foodsEaten, run.foodsEaten);
    run.bestCombo = Math.max(run.bestCombo, getSafeNumber(game.combo, 0));
    run.ticksSurvived = Math.max(run.ticksSurvived, getSafeNumber(game.tick, 0));
    run.won = run.won || game.status === "won";

    if (event && event.type === "teleport") {
      run.teleports += 1;
    }

    if (event && event.type === "eat" && event.teleported) {
      run.teleports += 1;
    }
  }

  function completeContracts(profile, run, game, rewards) {
    run.contracts.forEach((contract) => {
      if (run.completedContracts[contract.id] || !isGoalComplete(contract, run, game)) {
        return;
      }

      run.completedContracts[contract.id] = true;
      profile.contractCompletions += 1;
      profile.chips += contract.reward;
      rewards.push({
        category: "contract",
        id: contract.id,
        chips: contract.reward,
      });
    });
  }

  function maybeCompleteDaily(profile, run, rewards) {
    if (!run.daily || run.dailyComplete || !isDailyTargetComplete(run)) {
      return;
    }

    run.dailyComplete = true;

    if (profile.dailyClears[run.dailyKey]) {
      return;
    }

    profile.dailyClears[run.dailyKey] = true;
    profile.chips += DAILY_REWARD;
    rewards.push({
      category: "daily",
      id: "daily_clear",
      key: run.dailyKey,
      chips: DAILY_REWARD,
    });
  }

  function unlockAchievements(profile, run, rewards) {
    ACHIEVEMENT_DEFS.forEach((achievement) => {
      if (profile.achievements[achievement.id] || !isAchievementUnlocked(achievement, profile, run)) {
        return;
      }

      profile.achievements[achievement.id] = true;
      profile.chips += ACHIEVEMENT_REWARD;
      rewards.push({
        category: "achievement",
        id: achievement.id,
        chips: ACHIEVEMENT_REWARD,
      });
    });
  }

  function isAchievementUnlocked(achievement, profile, run) {
    if (achievement.modeId && (!run || run.modeId !== achievement.modeId)) {
      return false;
    }

    if (achievement.special === "all_modes") {
      return MODE_SEQUENCE.every((modeId) => profile.playedModes[modeId]);
    }

    if (achievement.special === "no_pause_score") {
      return Boolean(run && run.noPause && run.score >= achievement.target);
    }

    if (achievement.special === "first_daily_clear") {
      return countTruthy(profile.dailyClears) > 0;
    }

    if (achievement.special === "contract_count") {
      return profile.contractCompletions >= achievement.target;
    }

    if (achievement.special === "board_cleared") {
      return Boolean(run && run.won);
    }

    return Boolean(run && getMetricValue(achievement.metric, run) >= achievement.target);
  }

  function getRunGoalStatus(run, game) {
    if (!run) {
      return [];
    }

    return run.contracts.map((contract) => {
      const value = getMetricValue(contract.metric, run, game);
      return {
        id: contract.id,
        metric: contract.metric,
        value,
        target: contract.target,
        complete: Boolean(run.completedContracts[contract.id]) || value >= contract.target,
        reward: contract.reward,
      };
    });
  }

  function getDailyRunStatus(run) {
    if (!run || !run.daily || !run.dailyChallenge) {
      return null;
    }

    const value = getMetricValue(run.dailyChallenge.metric, run);
    return {
      ...run.dailyChallenge,
      value,
      complete: run.dailyComplete || value >= run.dailyChallenge.target,
      reward: DAILY_REWARD,
    };
  }

  function isGoalComplete(goal, run, game) {
    return getMetricValue(goal.metric, run, game) >= goal.target;
  }

  function isDailyTargetComplete(run) {
    return Boolean(
      run &&
      run.dailyChallenge &&
      getMetricValue(run.dailyChallenge.metric, run) >= run.dailyChallenge.target
    );
  }

  function getMetricValue(metric, run, game) {
    if (metric === "score") {
      return getSafeNumber(game && game.score, run ? run.score : 0);
    }

    if (metric === "foods") {
      return getSafeNumber(game && game.foodsEaten, run ? run.foodsEaten : 0);
    }

    if (metric === "ticks") {
      return getSafeNumber(game && game.tick, run ? run.ticksSurvived : 0);
    }

    if (metric === "combo") {
      return Math.max(run ? run.bestCombo : 0, getSafeNumber(game && game.combo, 0));
    }

    if (metric === "teleports") {
      return run ? run.teleports : 0;
    }

    return 0;
  }

  function getAchievements() {
    const profile = loadProfile();

    return ACHIEVEMENT_DEFS.map((achievement) => ({
      ...achievement,
      reward: ACHIEVEMENT_REWARD,
      unlocked: Boolean(profile.achievements[achievement.id]),
    }));
  }

  function getDailyChallenge(date, modeSequence) {
    const key = getLocalDateKey(date || new Date());
    const modes = Array.isArray(modeSequence) && modeSequence.length > 0 ? modeSequence : MODE_SEQUENCE;
    const hash = hashString(key);
    const modeId = normalizeMode(modes[hash % modes.length]);
    const target = getDailyTarget(modeId);

    return {
      key,
      seed: `${key}:${modeId}:${hash}`,
      modeId,
      metric: target.metric,
      target: target.target,
      reward: DAILY_REWARD,
    };
  }

  function getDailyTarget(modeId) {
    if (modeId === "rush") {
      return { metric: "combo", target: 6 };
    }

    if (modeId === "maze") {
      return { metric: "score", target: 110 };
    }

    if (modeId === "portal") {
      return { metric: "teleports", target: 5 };
    }

    if (modeId === "chain") {
      return { metric: "score", target: 160 };
    }

    if (modeId === "hunter") {
      return { metric: "score", target: 130 };
    }

    if (modeId === "collapse") {
      return { metric: "score", target: 130 };
    }

    if (modeId === "twin") {
      return { metric: "score", target: 100 };
    }

    return { metric: "score", target: 140 };
  }

  function getLocalDateKey(date) {
    const value = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function createSeededRandom(seedInput) {
    let state = hashString(String(seedInput || "web-small-game")) || 1;

    return function seededRandom() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(value) {
    let hash = 2166136261;
    const text = String(value);

    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  function normalizeMode(modeId) {
    return MODE_SEQUENCE.includes(modeId) ? modeId : "classic";
  }

  return {
    STORAGE_KEY,
    CONTRACT_DEFS,
    ACHIEVEMENT_DEFS,
    DAILY_REWARD,
    loadProfile,
    saveProfile,
    resetProfile,
    setStorageAdapter,
    getSummary,
    getContractsForMode,
    getRunGoalStatus,
    getDailyRunStatus,
    getAchievements,
    getDailyChallenge,
    createSeededRandom,
    startRun,
    recordStep,
    finalizeRun,
    markPaused,
  };
});
