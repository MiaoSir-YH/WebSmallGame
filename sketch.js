const GRID_COLS = 24;
const GRID_ROWS = 24;
const TOUCH_BREAKPOINT = 760;
const MOBILE_CONTROL_SHORT_EDGE = 820;
const MOBILE_CONTROL_LONG_EDGE = 1180;
const SWIPE_MIN_DISTANCE = 22;
const SWIPE_DOMINANCE = 1.16;

const PALETTE = {
  ink: "#05060c",
  board: "#070b16",
  cyan: "#00e5ff",
  acid: "#b6ff00",
  acidDark: "#5d8f00",
  pink: "#ff2bd6",
  white: "#f2fff5",
  readable: "#f7ffe8",
  limeText: "#dfff69",
  amber: "#ffe066",
  violet: "#8f4dff",
};

const I18N = globalThis.WebSmallGameI18N;
const DEFAULT_LANGUAGE = I18N.defaultLanguage;
const COPY = I18N.copy;
const Progression = globalThis.WebSmallGameProgression || null;

let game;
let board;
let screen = "select";
let activeModeId = "classic";
let modeCards = [];
let languageButton = null;
let progressionArchiveButton = null;
let dailyChallengeCard = null;
let archiveBackButton = null;
let mobileModeButton = null;
let touchControls = [];
let touchStart = null;
let paused = false;
let lastStepAt = 0;
let lastTouchAt = 0;
let gameOverFlashUntil = 0;
let scorePulseUntil = 0;
let eatFeedbacks = [];
let teleportFeedbacks = [];
let impactEvents = [];
let hitStopUntil = 0;
let screenShake = { startedAt: 0, until: 0, duration: 0, magnitude: 0 };
let feedbackMode = "full";
let language = DEFAULT_LANGUAGE;
let muted = false;
let audioState = { context: null, unlocked: false };
let progressionSummary = null;
let todayChallenge = null;
let currentRun = null;
let activeDailyChallenge = null;
let progressionToasts = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  textFont('"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif');
  setLanguage(DEFAULT_LANGUAGE);
  refreshProgressionSummary();
  ensureDailyChallenge();
  game = SnakeLogic.createGame({ cols: GRID_COLS, rows: GRID_ROWS, modeId: activeModeId });
  calculateLayout();
}

function draw() {
  const now = millis();

  if (
    screen === "playing" &&
    !paused &&
    game.status === "running" &&
    now >= hitStopUntil &&
    now - lastStepAt >= SnakeLogic.getStepInterval(game)
  ) {
    const previousStatus = game.status;
    SnakeLogic.stepGame(game);
    lastStepAt = now;
    handleGameEvent(game.lastEvent, now);
    handleProgressionStep(game.lastEvent, now);

    if (previousStatus !== game.status && game.status === "gameover") {
      gameOverFlashUntil = Math.max(gameOverFlashUntil, now + 180);
    }

    if (game.status !== "running") {
      finalizeProgressionRun(now);
    }
  }

  renderScene(now);
}

function getCopy() {
  return COPY[language] || COPY[DEFAULT_LANGUAGE];
}

function getModeCopy(modeId) {
  const copy = getCopy();
  return copy.modes[modeId] || copy.modes.classic;
}

function formatCopy(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(values || {}, key) ? values[key] : match
  ));
}

function refreshProgressionSummary(summary) {
  if (!Progression) {
    progressionSummary = null;
    return null;
  }

  progressionSummary = summary || Progression.getSummary();
  return progressionSummary;
}

function ensureDailyChallenge() {
  if (!Progression) {
    todayChallenge = null;
    return null;
  }

  const nextChallenge = Progression.getDailyChallenge(new Date(), SnakeLogic.MODE_SEQUENCE);

  if (!todayChallenge || todayChallenge.key !== nextChallenge.key) {
    todayChallenge = nextChallenge;
  }

  return todayChallenge;
}

function setLanguage(nextLanguage) {
  if (!COPY[nextLanguage]) {
    return;
  }

  language = nextLanguage;

  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }
}

function toggleLanguage() {
  setLanguage(language === "zh" ? "en" : "zh");
  playModeSound();
}

function calculateLayout() {
  const mobileViewport = shouldUseTouchLayout();
  const margin = mobileViewport ? 16 : 26;
  const progressReserve = Progression ? (mobileViewport ? 22 : 30) : 0;
  const topReserve = (mobileViewport ? 128 : 204) + progressReserve;
  const bottomReserve = mobileViewport ? 28 : 36;
  const sideReserve = 0;
  const availableWidth = Math.max(220, width - margin * 2 - sideReserve);
  const availableHeight = Math.max(220, height - topReserve - bottomReserve);
  const cellSize = Math.max(7, Math.floor(Math.min(availableWidth / GRID_COLS, availableHeight / GRID_ROWS)));
  const boardWidth = cellSize * GRID_COLS;
  const boardHeight = cellSize * GRID_ROWS;
  const playAreaWidth = width - sideReserve;
  const boardY = mobileViewport
    ? topReserve
    : Math.floor(topReserve + Math.max(0, (availableHeight - boardHeight) / 2));

  board = {
    x: Math.floor((playAreaWidth - boardWidth) / 2),
    y: boardY,
    w: boardWidth,
    h: boardHeight,
    cell: cellSize,
  };
}

function shouldShowTouchControls() {
  return false;
}

function shouldUseTouchLayout() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return width <= TOUCH_BREAKPOINT;
  }

  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  const primaryTouch = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent || "";
  const touchPoints = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  const mobileAgent = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(userAgent);
  const compactTouchViewport = shortEdge <= MOBILE_CONTROL_SHORT_EDGE && longEdge <= MOBILE_CONTROL_LONG_EDGE;
  const roomyMobileViewport = mobileAgent && shortEdge <= 900 && longEdge <= 1400;

  return (primaryTouch && noHover && compactTouchViewport) || (mobileAgent && touchPoints && roomyMobileViewport);
}

function shouldUseSideTouchControls() {
  return false;
}

function getTouchSideReserve() {
  return clamp(width * 0.25, 156, 220);
}

function getTouchBottomReserve() {
  return 28;
}

function renderScene(now) {
  background(PALETTE.ink);
  drawPunkBackdrop(now);

  if (screen === "select") {
    drawModeSelect(now);
    drawProgressionToasts(now);
    return;
  }

  if (screen === "achievements") {
    drawProgressionArchive(now);
    drawProgressionToasts(now);
    return;
  }

  const shake = getShakeOffset(now);

  push();
  translate(shake.x, shake.y);
  drawHeader(now);
  drawBoardFrame(now);
  drawGrid();
  drawWalls(now);
  drawPortals(now);
  drawFood(now);
  drawSnake();
  drawEatFeedback(now);
  drawTeleportFeedback(now);
  drawImpactEvents(now);
  drawStateOverlay();
  drawTouchControls();
  pop();

  drawFlash(now);
  drawProgressionToasts(now);
}

function drawPunkBackdrop(now) {
  push();
  noFill();
  strokeWeight(1);

  for (let i = -height; i < width; i += 34) {
    const drift = (now * 0.012 + i) % 34;
    stroke(0, 229, 255, 12);
    line(i + drift, 0, i + height + drift, height);
  }

  for (let y = 18; y < height; y += 42) {
    stroke(255, 43, 214, 18);
    line(0, y, width, y + sin(now * 0.004 + y) * 3);
  }

  pop();
}

function setNativeTextStyle(align, baseline, style, size) {
  const canvasBaseline = baseline === "center" ? "middle" : baseline;
  const fontWeight = style === "normal" ? 600 : 800;
  drawingContext.textAlign = align || "center";
  drawingContext.textBaseline = canvasBaseline || "middle";
  drawingContext.font = `${fontWeight} ${size}px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", Arial, sans-serif`;
}

function drawNativeText(label, x, y, settings) {
  const options = settings || {};
  const value = String(label);

  if (options.stroke !== false) {
    drawingContext.strokeText(value, x, y);
  }

  if (options.fill !== false) {
    drawingContext.fillText(value, x, y);
  }
}

function drawNeonText(label, x, y, options) {
  const settings = options || {};
  const size = settings.size || 42;
  const alpha = settings.alpha === undefined ? 1 : settings.alpha;
  const offset = settings.offset || Math.max(1, size * 0.026);
  const glowA = settings.glowA || PALETTE.pink;
  const glowB = settings.glowB || PALETTE.cyan;
  const accent = settings.accent || PALETTE.acid;
  const primary = settings.primary || PALETTE.readable;
  const outlineWeight = settings.outlineWeight || Math.max(4, size * 0.18);
  const glowScale = settings.glowScale === undefined ? 0.58 : settings.glowScale;

  push();
  setNativeTextStyle(settings.align || CENTER, settings.baseline || CENTER, settings.style || BOLD, size);

  drawingContext.shadowBlur = size * 0.16 * glowScale;
  drawingContext.shadowColor = PALETTE.ink;
  stroke(colorWithAlpha(PALETTE.ink, 250 * alpha));
  strokeWeight(outlineWeight * 1.18);
  fill(colorWithAlpha(PALETTE.ink, 190 * alpha));
  drawNativeText(label, x, y);

  drawingContext.shadowBlur = size * 0.34 * glowScale;
  drawingContext.shadowColor = glowB;
  stroke(colorWithAlpha(glowB, 96 * alpha));
  strokeWeight(outlineWeight);
  fill(colorWithAlpha(PALETTE.ink, 76 * alpha));
  drawNativeText(label, x, y);

  drawingContext.shadowBlur = size * 0.28 * glowScale;
  drawingContext.shadowColor = glowA;
  stroke(colorWithAlpha(glowA, 118 * alpha));
  strokeWeight(outlineWeight * 0.66);
  fill(colorWithAlpha(PALETTE.ink, 58 * alpha));
  drawNativeText(label, x, y);

  drawingContext.shadowBlur = size * 0.28 * glowScale;
  drawingContext.shadowColor = glowA;
  noStroke();
  fill(colorWithAlpha(glowA, 62 * alpha));
  drawNativeText(label, x - offset, y, { stroke: false });

  drawingContext.shadowColor = glowB;
  fill(colorWithAlpha(glowB, 66 * alpha));
  drawNativeText(label, x + offset, y + offset * 0.35, { stroke: false });

  drawingContext.shadowBlur = size * 0.16 * glowScale;
  drawingContext.shadowColor = accent;
  stroke(colorWithAlpha(accent, 188 * alpha));
  strokeWeight(settings.strokeWeight || Math.max(2.6, size * 0.052));
  fill(colorWithAlpha(primary, 248 * alpha));
  drawNativeText(label, x, y);

  noStroke();
  drawingContext.shadowBlur = size * 0.06 * glowScale;
  drawingContext.shadowColor = primary;
  fill(colorWithAlpha(PALETTE.white, 116 * alpha));
  drawNativeText(label, x, y - offset * 0.35, { stroke: false });
  pop();
}

function drawNeonLogo(label, x, y, size, now, options) {
  const settings = options || {};
  const baseline = settings.baseline || TOP;
  const flicker = 0.94 + sin(now * 0.009) * 0.035 + sin(now * 0.023) * 0.018;
  const lineWidth = Math.min(settings.maxWidth || width * 0.72, size * label.length * 0.58);
  const underlineY = baseline === CENTER ? y + size * 0.62 : y + size * 1.06;

  drawNeonText(label, x, y, {
    size,
    baseline,
    alpha: flicker,
    glowA: PALETTE.pink,
    glowB: PALETTE.cyan,
    accent: PALETTE.acid,
    primary: PALETTE.readable,
    strokeWeight: settings.strokeWeight || Math.max(2.2, size * 0.05),
    outlineWeight: settings.outlineWeight || Math.max(6, size * 0.2),
    offset: settings.offset || Math.max(1, size * 0.02),
    glowScale: settings.glowScale === undefined ? 0.5 : settings.glowScale,
  });

  push();
  drawingContext.shadowBlur = size * 0.16;
  drawingContext.shadowColor = PALETTE.cyan;
  stroke(colorWithAlpha(PALETTE.cyan, 185));
  strokeWeight(Math.max(1, size * 0.035));
  line(x - lineWidth / 2, underlineY, x + lineWidth / 2, underlineY);

  drawingContext.shadowColor = PALETTE.pink;
  stroke(colorWithAlpha(PALETTE.pink, 165));
  strokeWeight(Math.max(1, size * 0.02));
  line(x - lineWidth * 0.36, underlineY + 5, x + lineWidth * 0.36, underlineY + 5);

  noStroke();
  fill(colorWithAlpha(PALETTE.acid, 190));
  rect(x - lineWidth / 2 - 8, underlineY - 2, 5, 5, 1);
  rect(x + lineWidth / 2 + 3, underlineY - 2, 5, 5, 1);
  pop();
}

function drawReadableText(label, x, y, options) {
  const settings = options || {};
  const size = settings.size || 20;
  const primary = settings.primary || PALETTE.limeText;
  const glow = settings.glow || PALETTE.cyan;
  const alpha = settings.alpha === undefined ? 1 : settings.alpha;

  push();
  setNativeTextStyle(settings.align || CENTER, settings.baseline || TOP, settings.style || BOLD, size);
  drawingContext.shadowBlur = settings.glowBlur === undefined ? Math.max(4, size * 0.16) : settings.glowBlur;
  drawingContext.shadowColor = glow;
  stroke(colorWithAlpha(PALETTE.ink, 250 * alpha));
  strokeWeight(settings.outlineWeight || Math.max(2.4, size * 0.16));
  fill(colorWithAlpha(primary, 238 * alpha));
  drawNativeText(label, x, y);

  drawingContext.shadowBlur = 0;
  stroke(colorWithAlpha(PALETTE.ink, 190 * alpha));
  strokeWeight(Math.max(1, size * 0.055));
  fill(colorWithAlpha(primary, 248 * alpha));
  drawNativeText(label, x, y);
  pop();
}

function drawFittedReadableText(label, x, y, maxWidth, options) {
  const settings = options || {};
  const size = getFittedTextSize(label, maxWidth, settings.size || 20, settings.minSize || 12);
  drawReadableText(label, x, y, { ...settings, size });
}

function getFittedTextSize(label, maxWidth, preferredSize, minSize) {
  let size = preferredSize;

  push();
  while (size > minSize) {
    setNativeTextStyle(CENTER, CENTER, BOLD, size);

    if (drawingContext.measureText(String(label)).width <= maxWidth) {
      break;
    }

    size -= 1;
  }
  pop();

  return size;
}

function drawModeSelect(now) {
  modeCards = [];
  languageButton = null;
  progressionArchiveButton = null;
  dailyChallengeCard = null;
  archiveBackButton = null;
  mobileModeButton = null;
  touchControls = [];
  refreshProgressionSummary();
  ensureDailyChallenge();
  const compact = width < 760 || shouldUseTouchLayout();
  const titleY = compact ? 12 : clamp(height * 0.034, 14, 30);
  const titleSize = compact ? clamp(width * 0.09, 32, 42) : clamp(width * 0.052, 58, 92);

  drawNeonLogo("WebSmallGame", width / 2, titleY, titleSize, now, {
    baseline: TOP,
    maxWidth: width * 0.82,
    glowScale: 0.46,
  });

  drawReadableText(getCopy().appSubtitle, width / 2, titleY + titleSize + 22, {
    size: compact ? clamp(width * 0.032, 12, 15) : clamp(width * 0.016, 18, 26),
    style: BOLD,
    primary: PALETTE.limeText,
    glow: PALETTE.cyan,
  });

  drawLanguageButton();

  const columns = compact ? 1 : 2;
  const gap = compact ? 12 : 18;
  const margin = compact ? 20 : 34;
  const cardW = Math.min(380, (width - margin * 2 - gap * (columns - 1)) / columns);
  const cardH = compact ? 92 : 116;
  const rows = Math.ceil(SnakeLogic.MODE_SEQUENCE.length / columns);
  const totalW = cardW * columns + gap * (columns - 1);
  const totalH = cardH * rows + gap * (rows - 1);
  const startX = (width - totalW) / 2;
  const startY = Math.max(titleY + titleSize + 76, Math.min(height - totalH - 24, height * 0.29));

  SnakeLogic.MODE_SEQUENCE.forEach((modeId, index) => {
    const config = SnakeLogic.getModeConfig(modeId);
    const modeCopy = getModeCopy(modeId);
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = startX + col * (cardW + gap);
    const y = startY + row * (cardH + gap);
    const selected = modeId === activeModeId;
    const pulse = selected ? 0.45 + sin(now * 0.008) * 0.2 : 0;

    modeCards.push({ modeId, x, y, w: cardW, h: cardH });

    push();
    drawingContext.shadowBlur = selected ? 22 : 12;
    drawingContext.shadowColor = selected ? PALETTE.acid : PALETTE.cyan;
    stroke(selected ? PALETTE.acid : PALETTE.cyan);
    strokeWeight(selected ? 2.5 : 1.5);
    fill(6, 11, 22, selected ? 230 : 205);
    rect(x, y, cardW, cardH, 6);

    noStroke();
    fill(255, 43, 214, 52 + pulse * 70);
    rect(x, y, 5, cardH);

    textAlign(LEFT, TOP);
    textStyle(BOLD);
    fill(PALETTE.pink);
    textSize(13);
    text(`0${config.number}`, x + 18, y + 16);

    fill(PALETTE.white);
    textSize(compact ? 22 : 28);
    text(modeCopy.title, x + 58, y + 13);

    textStyle(NORMAL);
    fill(PALETTE.acid);
    textSize(compact ? 13 : 16);
    text(modeCopy.tagline, x + 18, y + (compact ? 50 : 60), cardW - 36, 42);

    fill(PALETTE.cyan);
    textSize(compact ? 12 : 13);
    text(getModeHint(modeId), x + 18, y + cardH - 27, cardW - 36, 18);
    pop();
  });

  drawProgressionSelectPanel(startY + totalH + 18, now);
}

function getModeHint(modeId) {
  return getModeCopy(modeId).hint;
}

function drawProgressionSelectPanel(preferredY, now) {
  if (!Progression) {
    return;
  }

  const summary = progressionSummary || refreshProgressionSummary();
  const challenge = todayChallenge || ensureDailyChallenge();
  const copy = getCopy().progression;
  const compact = width < 760;
  const margin = compact ? 18 : 34;
  const gap = compact ? 10 : 14;
  const totalW = Math.min(width - margin * 2, compact ? 440 : 840);
  const cardH = compact ? 62 : 88;
  const cardW = compact ? totalW : (totalW - gap) / 2;
  const totalH = compact ? cardH * 2 + gap : cardH;
  const x = (width - totalW) / 2;
  const y = clamp(preferredY, 112, Math.max(112, height - totalH - 18));

  progressionArchiveButton = { x, y, w: cardW, h: cardH };
  dailyChallengeCard = compact
    ? { x, y: y + cardH + gap, w: cardW, h: cardH }
    : { x: x + cardW + gap, y, w: cardW, h: cardH };

  drawProgressionSummaryCard(progressionArchiveButton, summary, copy);
  drawDailyChallengeSelectCard(dailyChallengeCard, challenge, summary, copy, now);
}

function drawProgressionSummaryCard(bounds, summary, copy) {
  push();
  drawingContext.shadowBlur = 12;
  drawingContext.shadowColor = PALETTE.cyan;
  stroke(PALETTE.cyan);
  strokeWeight(1.5);
  fill(6, 11, 22, 222);
  rect(bounds.x, bounds.y, bounds.w, bounds.h, 6);

  noStroke();
  fill(PALETTE.pink);
  rect(bounds.x, bounds.y, 5, bounds.h);

  textAlign(LEFT, TOP);
  textStyle(BOLD);
  textSize(bounds.h < 70 ? 18 : 22);
  fill(PALETTE.white);
  text(copy.archiveButton, bounds.x + 18, bounds.y + 12, bounds.w - 36, 24);

  textStyle(NORMAL);
  textSize(bounds.h < 70 ? 12 : 14);
  fill(PALETTE.acid);
  text(formatCopy(copy.archiveSummary, {
    chips: summary.chips,
    done: summary.unlockedAchievements,
    total: summary.totalAchievements,
  }), bounds.x + 18, bounds.y + (bounds.h < 70 ? 38 : 48), bounds.w - 36, 24);
  pop();
}

function drawDailyChallengeSelectCard(bounds, challenge, summary, copy, now) {
  const cleared = Boolean(summary.todayCleared);
  const modeTitle = getModeCopy(challenge.modeId).title;
  const targetLabel = formatDailyTarget(challenge);
  const pulse = cleared ? 0 : 0.55 + sin(now * 0.008) * 0.18;

  push();
  drawingContext.shadowBlur = cleared ? 10 : 18 + pulse * 8;
  drawingContext.shadowColor = cleared ? PALETTE.acid : PALETTE.pink;
  stroke(cleared ? PALETTE.acid : PALETTE.pink);
  strokeWeight(cleared ? 1.5 : 2);
  fill(6, 11, 22, 222);
  rect(bounds.x, bounds.y, bounds.w, bounds.h, 6);

  noStroke();
  fill(0, 229, 255, cleared ? 40 : 64 + pulse * 60);
  rect(bounds.x, bounds.y, 5, bounds.h);

  textAlign(LEFT, TOP);
  textStyle(BOLD);
  textSize(bounds.h < 70 ? 17 : 22);
  fill(cleared ? PALETTE.acid : PALETTE.white);
  text(cleared ? copy.dailyCleared : copy.dailyTitle, bounds.x + 18, bounds.y + 12, bounds.w - 36, 24);

  textStyle(NORMAL);
  textSize(bounds.h < 70 ? 12 : 14);
  fill(PALETTE.limeText);
  text(formatCopy(copy.dailySummary, {
    mode: modeTitle,
    target: targetLabel,
  }), bounds.x + 18, bounds.y + (bounds.h < 70 ? 38 : 48), bounds.w - 36, 32);
  pop();
}

function drawProgressionArchive(now) {
  modeCards = [];
  languageButton = null;
  progressionArchiveButton = null;
  dailyChallengeCard = null;
  mobileModeButton = null;
  touchControls = [];
  refreshProgressionSummary();

  const copy = getCopy().progression;
  const summary = progressionSummary;
  const compact = width < 760;
  const margin = compact ? 16 : 34;
  const titleSize = compact ? 32 : 68;
  const titleY = compact ? 18 : 26;

  drawNeonLogo(copy.archiveTitle, width / 2, titleY, titleSize, now, {
    baseline: TOP,
    maxWidth: width * 0.82,
    glowScale: 0.42,
  });

  archiveBackButton = { x: margin, y: compact ? 20 : 28, w: compact ? 82 : 104, h: compact ? 30 : 34 };
  drawArchiveBackButton(copy.backToModes);

  drawReadableText(formatCopy(copy.archiveSummary, {
    chips: summary.chips,
    done: summary.unlockedAchievements,
    total: summary.totalAchievements,
  }), width / 2, titleY + titleSize + 18, {
    size: compact ? 17 : 23,
    primary: PALETTE.limeText,
    glow: PALETTE.cyan,
  });

  drawAchievementGrid(titleY + titleSize + (compact ? 54 : 70), compact);
}

function drawArchiveBackButton(label) {
  push();
  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = PALETTE.cyan;
  stroke(PALETTE.cyan);
  strokeWeight(1.4);
  fill(6, 11, 22, 220);
  rect(archiveBackButton.x, archiveBackButton.y, archiveBackButton.w, archiveBackButton.h, 5);
  noStroke();
  fill(PALETTE.acid);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(12);
  text(label, archiveBackButton.x + archiveBackButton.w / 2, archiveBackButton.y + archiveBackButton.h / 2 + 0.5);
  pop();
}

function drawAchievementGrid(startY, compact) {
  const copy = getCopy().progression;
  const achievements = Progression.getAchievements();
  const columns = width < 360 ? 1 : width < 920 ? 2 : 3;
  const gap = compact ? 8 : 14;
  const margin = compact ? 16 : 34;
  const cardW = (width - margin * 2 - gap * (columns - 1)) / columns;
  const cardH = compact ? 68 : 86;
  const totalW = cardW * columns + gap * (columns - 1);
  const startX = (width - totalW) / 2;
  const y = Math.min(startY, Math.max(128, height - Math.ceil(achievements.length / columns) * (cardH + gap) - 18));

  achievements.forEach((achievement, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = startX + col * (cardW + gap);
    const cardY = y + row * (cardH + gap);
    const achievementCopy = copy.achievements[achievement.id] || { title: achievement.id, description: "" };
    const unlocked = achievement.unlocked;

    push();
    drawingContext.shadowBlur = unlocked ? 14 : 5;
    drawingContext.shadowColor = unlocked ? PALETTE.acid : PALETTE.cyan;
    stroke(unlocked ? PALETTE.acid : colorWithAlpha(PALETTE.cyan, 90));
    strokeWeight(unlocked ? 2 : 1);
    fill(6, 11, 22, unlocked ? 232 : 176);
    rect(x, cardY, cardW, cardH, 6);

    noStroke();
    fill(unlocked ? PALETTE.acid : colorWithAlpha(PALETTE.pink, 110));
    rect(x, cardY, 5, cardH);

    textAlign(LEFT, TOP);
    textStyle(BOLD);
    textSize(compact ? 14 : 17);
    fill(unlocked ? PALETTE.white : colorWithAlpha(PALETTE.white, 132));
    text(achievementCopy.title, x + 14, cardY + 10, cardW - 28, compact ? 20 : 24);

    textStyle(NORMAL);
    textSize(compact ? 11 : 13);
    fill(unlocked ? PALETTE.limeText : colorWithAlpha(PALETTE.limeText, 132));
    text(
      compact ? (unlocked ? copy.unlocked : copy.locked) : achievementCopy.description,
      x + 14,
      cardY + (compact ? 36 : 40),
      cardW - 28,
      compact ? 22 : 36,
    );
    pop();
  });
}

function formatDailyTarget(challenge) {
  const targets = getCopy().progression.dailyTargets;
  const template = targets[challenge.metric] || targets.score;
  return formatCopy(template, { target: challenge.target });
}

function drawLanguageButton() {
  const compact = width < 640;
  const label = getCopy().languageButton;
  const buttonW = compact ? 58 : 74;
  const buttonH = compact ? 30 : 34;
  const margin = compact ? 14 : 26;
  const x = width - buttonW - margin;
  const y = compact ? 82 : 26;

  languageButton = { x, y, w: buttonW, h: buttonH };

  push();
  drawingContext.shadowBlur = 14;
  drawingContext.shadowColor = PALETTE.cyan;
  stroke(PALETTE.cyan);
  strokeWeight(1.5);
  fill(6, 11, 22, 220);
  rect(x, y, buttonW, buttonH, 5);

  noStroke();
  fill(PALETTE.acid);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(compact ? 12 : 13);
  text(label, x + buttonW / 2, y + buttonH / 2 + 0.5);
  pop();
}

function drawHeader(now) {
  mobileModeButton = null;
  const scoreLabel = String(game.score).padStart(4, "0");
  const touchLayout = shouldUseTouchLayout();
  const compact = width < 720 || touchLayout;
  const pulse = getScorePulse(now);
  const copy = getCopy();
  const modeCopy = getModeCopy(game.modeId);
  const titleTop = compact ? 8 : 14;
  const titleSize = (compact ? clamp(Math.min(width, height) * 0.075, 28, 38) : clamp(width * 0.04, 64, 78)) + pulse * (compact ? 2 : 4);
  const lineSize = compact ? clamp(Math.min(width, height) * 0.032, 14, 18) : clamp(width * 0.013, 22, 26);
  const firstLineY = titleTop + titleSize + (compact ? 12 : 28);
  const secondLineY = firstLineY + lineSize + (compact ? 6 : 12);

  push();
  drawNeonLogo("WebSmallGame", width / 2 + 2, titleTop, titleSize, now, {
    baseline: TOP,
    maxWidth: compact ? width * 0.82 : width * 0.74,
    outlineWeight: Math.max(8, titleSize * 0.22),
    offset: Math.max(1, titleSize * 0.018),
    glowScale: 0.36,
  });

  if (compact) {
    drawReadableText(`${modeCopy.title}  |  ${copy.score} ${scoreLabel}`, width / 2, firstLineY, {
      size: lineSize,
      primary: pulse > 0 ? PALETTE.amber : PALETTE.limeText,
      glow: PALETTE.cyan,
    });
    drawReadableText(`${getModeStatus()}  |  ${getFeedbackStatus()}`, width / 2, secondLineY, {
      size: Math.max(17, lineSize - 2),
      primary: PALETTE.limeText,
      glow: PALETTE.pink,
    });
  } else {
    drawReadableText(`${modeCopy.title}  |  ${copy.score} ${scoreLabel}  |  ${getModeStatus()}`, width / 2, firstLineY, {
      size: lineSize,
      primary: pulse > 0 ? PALETTE.amber : PALETTE.limeText,
      glow: PALETTE.cyan,
    });
    drawReadableText(`${getFeedbackStatus()}  |  ${copy.modeShortcut}  |  ${copy.resetShortcut}  |  ${copy.languageShortcut}`, width / 2, secondLineY, {
      size: Math.max(21, lineSize - 2),
      primary: PALETTE.limeText,
      glow: PALETTE.pink,
    });
  }

  drawRunGoalsStatus(secondLineY + lineSize + (compact ? 8 : 10), compact);
  pop();
}

function drawMobileModeButton(copy, bounds) {
  const settings = bounds || {};
  const buttonW = settings.w || 66;
  const buttonH = settings.h || 30;
  const x = settings.x === undefined ? 14 : settings.x;
  const y = settings.y === undefined ? 12 : settings.y;
  const label = getMobileModeButtonLabel(copy);

  mobileModeButton = { x, y, w: buttonW, h: buttonH };

  push();
  drawingContext.shadowBlur = 12;
  drawingContext.shadowColor = PALETTE.cyan;
  stroke(PALETTE.cyan);
  strokeWeight(1.4);
  fill(6, 11, 22, 226);
  rect(x, y, buttonW, buttonH, 5);
  noStroke();
  fill(PALETTE.acid);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(12);
  text(label, x + buttonW / 2, y + buttonH / 2 + 0.5);
  pop();
}

function getMobileModeButtonLabel(copy) {
  return String(copy.modeShortcut || "MODE").replace(/^M\s*/i, "");
}

function drawRunGoalsStatus(y, compact) {
  if (!Progression || !currentRun) {
    return;
  }

  const copy = getCopy().progression;
  const goals = Progression.getRunGoalStatus(currentRun, game);
  const daily = Progression.getDailyRunStatus(currentRun);
  const contractLabel = goals.map((goal) => formatContractStatus(goal)).join("  |  ");
  const dailyLabel = daily
    ? `  |  ${daily.complete ? copy.dailyDone : copy.dailyTitle}: ${formatGoalProgress(daily)} ${formatDailyTarget(daily)}`
    : "";
  const label = `${copy.contractsTitle} ${contractLabel}${dailyLabel}`;

  drawFittedReadableText(label, width / 2, y, width * 0.92, {
    size: compact ? 15 : 19,
    minSize: compact ? 11 : 14,
    primary: PALETTE.amber,
    glow: PALETTE.pink,
  });
}

function formatContractStatus(goal) {
  const contractCopy = getCopy().progression.contracts[goal.id] || { short: goal.id };
  return `${goal.complete ? getCopy().progression.goalDone : formatGoalProgress(goal)} ${contractCopy.short}`;
}

function formatGoalProgress(goal) {
  return `${Math.min(goal.value, goal.target)}/${goal.target}`;
}

function getModeStatus() {
  const copy = getCopy();

  if (game.modeId === "rush") {
    return formatCopy(copy.status.rush, {
      speed: game.speedLevel + 1,
      combo: game.combo || 0,
    });
  }

  if (game.modeId === "maze") {
    return formatCopy(copy.status.maze, { count: game.walls.length });
  }

  if (game.modeId === "portal") {
    const every = SnakeLogic.getModeConfig("portal").relocateEvery;
    return formatCopy(copy.status.portal, {
      current: game.foodsEaten % every,
      total: every,
    });
  }

  return copy.status.classic;
}

function getFeedbackStatus() {
  const copy = getCopy();
  return `${muted ? copy.soundOff : copy.soundOn}  ${feedbackMode === "full" ? copy.fxFull : copy.fxReduced}`;
}

function drawBoardFrame(now) {
  const jitter = game.status === "gameover" ? sin(now * 0.08) * 3 : 0;
  const pulse = getScorePulse(now);

  push();
  drawingContext.shadowBlur = 24 + pulse * 14;
  drawingContext.shadowColor = pulse > 0 ? PALETTE.acid : PALETTE.cyan;
  noFill();
  stroke(pulse > 0 ? PALETTE.acid : PALETTE.cyan);
  strokeWeight(2 + pulse);
  rect(board.x - 9 + jitter, board.y - 9, board.w + 18, board.h + 18, 4);

  drawingContext.shadowColor = PALETTE.pink;
  stroke(PALETTE.pink);
  strokeWeight(1);
  rect(board.x - 15 - jitter, board.y - 15, board.w + 30, board.h + 30, 2);

  noStroke();
  fill(255, 43, 214, 72);
  rect(board.x - 15, board.y - 15, board.w + 30, 3);
  fill(0, 229, 255, 72);
  rect(board.x - 15, board.y + board.h + 12, board.w + 30, 3);
  pop();
}

function drawGrid() {
  push();
  noStroke();
  fill(PALETTE.board);
  rect(board.x, board.y, board.w, board.h);

  stroke(0, 229, 255, 28);
  strokeWeight(1);

  for (let x = 0; x <= GRID_COLS; x += 1) {
    const px = board.x + x * board.cell;
    line(px, board.y, px, board.y + board.h);
  }

  for (let y = 0; y <= GRID_ROWS; y += 1) {
    const py = board.y + y * board.cell;
    line(board.x, py, board.x + board.w, py);
  }

  pop();
}

function drawWalls(now) {
  if (!game.walls || game.walls.length === 0) {
    return;
  }

  push();

  game.walls.forEach((wall, index) => {
    const x = board.x + wall.x * board.cell;
    const y = board.y + wall.y * board.cell;
    const flicker = 0.5 + sin(now * 0.012 + index) * 0.35;
    const inset = Math.max(1, Math.floor(board.cell * 0.16));

    drawingContext.shadowBlur = 12 + flicker * 10;
    drawingContext.shadowColor = PALETTE.cyan;
    stroke(0, 229, 255, 160 + flicker * 70);
    strokeWeight(1.5);
    fill(0, 229, 255, 32 + flicker * 36);
    rect(x + inset, y + inset, board.cell - inset * 2, board.cell - inset * 2, 2);

    stroke(PALETTE.pink);
    line(x + inset, y + board.cell - inset, x + board.cell - inset, y + inset);
  });

  pop();
}

function drawPortals(now) {
  if (!game.portals || game.portals.length < 2) {
    return;
  }

  push();
  rectMode(CENTER);

  game.portals.forEach((portal, index) => {
    const cx = board.x + portal.x * board.cell + board.cell / 2;
    const cy = board.y + portal.y * board.cell + board.cell / 2;
    const spin = now * 0.004 * (index === 0 ? 1 : -1);
    const outer = board.cell * (0.78 + sin(now * 0.01 + index) * 0.04);
    const colorA = index === 0 ? PALETTE.cyan : PALETTE.pink;
    const colorB = index === 0 ? PALETTE.violet : PALETTE.acid;

    translate(cx, cy);
    rotate(spin);
    drawingContext.shadowBlur = 20;
    drawingContext.shadowColor = colorA;
    noFill();
    stroke(colorA);
    strokeWeight(2);
    circle(0, 0, outer);
    stroke(colorB);
    strokeWeight(1.5);
    rect(0, 0, outer * 0.62, outer * 0.62, 3);
    rotate(-spin);
    translate(-cx, -cy);
  });

  pop();
}

function drawSnake() {
  push();

  game.snake.forEach((segment, index) => {
    const x = board.x + segment.x * board.cell;
    const y = board.y + segment.y * board.cell;
    const inset = Math.max(1, Math.floor(board.cell * 0.12));
    const size = board.cell - inset * 2;
    const isHead = index === 0;

    drawingContext.shadowBlur = isHead ? 22 : 12;
    drawingContext.shadowColor = isHead ? PALETTE.acid : PALETTE.acidDark;
    stroke(isHead ? PALETTE.white : PALETTE.acidDark);
    strokeWeight(isHead ? 2 : 1);
    fill(isHead ? PALETTE.acid : color(118, 255, 0, map(index, 0, game.snake.length - 1, 238, 148)));
    rect(x + inset, y + inset, size, size, Math.min(5, board.cell * 0.18));
  });

  pop();
}

function drawFood(now) {
  if (!game.food) {
    return;
  }

  const cx = board.x + game.food.x * board.cell + board.cell / 2;
  const cy = board.y + game.food.y * board.cell + board.cell / 2;
  const radius = board.cell * (0.25 + sin(now * 0.01) * 0.04);

  push();
  drawingContext.shadowBlur = 24;
  drawingContext.shadowColor = PALETTE.pink;
  translate(cx, cy);
  rotate(PI / 4);
  stroke(PALETTE.white);
  strokeWeight(1.5);
  fill(PALETTE.pink);
  rectMode(CENTER);
  rect(0, 0, radius * 2, radius * 2, 3);
  pop();
}

function handleGameEvent(event, now) {
  if (!event) {
    return;
  }

  if (event.type === "eat") {
    triggerEatFeedback(event.cell, event.points, event.combo, now);
    triggerEatImpact(event, now);
  }

  if (event.type === "teleport") {
    triggerTeleportFeedback(event.from, event.to, now);
    triggerTeleportImpact(event, now);
  }

  if (event.type === "crash") {
    triggerCrashImpact(event, now);
  }
}

function handleProgressionStep(event, now) {
  if (!Progression || !currentRun) {
    return;
  }

  const result = Progression.recordStep(currentRun, game, event);
  currentRun = result.run;
  refreshProgressionSummary(result.profile);
  pushProgressionRewards(result.rewards, now);
}

function finalizeProgressionRun(now) {
  if (!Progression || !currentRun || currentRun.finalized) {
    return;
  }

  const result = Progression.finalizeRun(currentRun, game);
  currentRun = result.run;
  refreshProgressionSummary(result.profile);
  pushProgressionRewards(result.rewards, now);
}

function pushProgressionRewards(rewards, now) {
  if (!rewards || rewards.length === 0) {
    return;
  }

  const copy = getCopy().progression;

  rewards.forEach((reward, index) => {
    progressionToasts.push({
      label: getRewardLabel(reward, copy),
      sublabel: formatCopy(copy.rewardChips, { chips: reward.chips }),
      startedAt: now + index * 180,
      duration: 2600,
    });
  });

  if (progressionToasts.length > 5) {
    progressionToasts.splice(0, progressionToasts.length - 5);
  }
}

function getRewardLabel(reward, copy) {
  if (reward.category === "contract") {
    const contractCopy = copy.contracts[reward.id] || { short: reward.id };
    return formatCopy(copy.rewardContract, { name: contractCopy.short });
  }

  if (reward.category === "achievement") {
    const achievementCopy = copy.achievements[reward.id] || { title: reward.id };
    return formatCopy(copy.rewardAchievement, { name: achievementCopy.title });
  }

  return copy.rewardDaily;
}

function drawProgressionToasts(now) {
  progressionToasts = progressionToasts.filter((toast) => now - toast.startedAt <= toast.duration);

  if (progressionToasts.length === 0) {
    return;
  }

  const margin = width < 640 ? 14 : 24;
  const toastW = Math.min(width - margin * 2, width < 640 ? 300 : 360);
  const toastH = 58;
  const x = width - toastW - margin;

  progressionToasts.forEach((toast, index) => {
    const age = Math.max(0, now - toast.startedAt);
    const fadeOut = clamp((toast.duration - age) / 360, 0, 1);
    const fadeIn = clamp(age / 220, 0, 1);
    const alpha = Math.min(fadeIn, fadeOut);
    const y = margin + index * (toastH + 10);

    push();
    drawingContext.shadowBlur = 18 * alpha;
    drawingContext.shadowColor = PALETTE.acid;
    stroke(colorWithAlpha(PALETTE.acid, 190 * alpha));
    strokeWeight(1.5);
    fill(colorWithAlpha(PALETTE.board, 226 * alpha));
    rect(x, y, toastW, toastH, 6);

    noStroke();
    fill(colorWithAlpha(PALETTE.pink, 180 * alpha));
    rect(x, y, 5, toastH);

    textAlign(LEFT, TOP);
    textStyle(BOLD);
    textSize(15);
    fill(colorWithAlpha(PALETTE.white, 250 * alpha));
    text(toast.label, x + 16, y + 10, toastW - 32, 20);

    textStyle(NORMAL);
    textSize(13);
    fill(colorWithAlpha(PALETTE.acid, 240 * alpha));
    text(toast.sublabel, x + 16, y + 34, toastW - 32, 18);
    pop();
  });
}

function triggerEatImpact(event, now) {
  const copy = getCopy();
  const combo = event.combo || 1;
  const overdrive = combo >= 4;
  const intensity = overdrive ? 2.4 : combo >= 2 ? 1.55 : 1;
  const tint = combo >= 2 ? PALETTE.acid : PALETTE.pink;

  addImpactEvent({
    type: "shock",
    cell: event.cell,
    tint,
    accent: PALETTE.cyan,
    intensity,
    duration: overdrive ? 680 : combo >= 2 ? 560 : 440,
    particles: buildParticleBurst(event.cell, overdrive ? 30 : combo >= 2 ? 22 : 14, [tint, PALETTE.cyan, PALETTE.amber], intensity),
  });

  if (combo >= 2) {
    addImpactEvent({
      type: "glitch",
      intensity,
      duration: overdrive ? 380 : 220,
      fullScreen: true,
      slices: buildGlitchSlices(overdrive ? 10 : 6),
    });
  }

  if (overdrive) {
    addImpactEvent({
      type: "banner",
      label: copy.impact.overdrive,
      sublabel: formatCopy(copy.impact.combo, { combo }),
      tint: PALETTE.acid,
      accent: PALETTE.pink,
      duration: 760,
      fullScreen: true,
    });
  }

  if (event.portalRelocated) {
    addImpactEvent({
      type: "banner",
      label: copy.impact.gatesShifted,
      sublabel: copy.impact.portalDrift,
      tint: PALETTE.violet,
      accent: PALETTE.cyan,
      duration: 620,
      fullScreen: true,
    });
  }

  addShake(overdrive ? 13 : combo >= 2 ? 8 : 4, overdrive ? 280 : 160);
  addHitStop(overdrive ? 88 : combo >= 2 ? 55 : 32);
  playEatSound(combo);
  if (overdrive) {
    playOverdriveSound();
  }
  vibrate(overdrive ? [18, 28, 36] : combo >= 2 ? [14, 18, 14] : 14);
}

function triggerTeleportImpact(event, now) {
  addImpactEvent({
    type: "tunnel",
    from: event.from,
    to: event.to,
    tint: PALETTE.violet,
    accent: PALETTE.cyan,
    intensity: 1.35,
    duration: 520,
  });

  addShake(6, 180);
  addHitStop(45);
  playTeleportSound();
  vibrate([12, 22, 12]);
}

function triggerCrashImpact(event, now) {
  const copy = getCopy();
  const electric = event.reason === "electric";
  const body = event.reason === "body";
  const tint = electric ? PALETTE.cyan : body ? PALETTE.acid : PALETTE.pink;
  const crashCopy = copy.crash[event.reason] || copy.crash.wall;

  addImpactEvent({
    type: "crash",
    cell: event.cell,
    reason: event.reason,
    tint,
    accent: electric ? PALETTE.white : PALETTE.pink,
    intensity: electric ? 2.4 : 1.85,
    duration: electric ? 860 : 720,
    particles: buildParticleBurst(event.cell, electric ? 42 : 30, [tint, PALETTE.pink, PALETTE.white], electric ? 2.4 : 1.85),
  });

  addImpactEvent({
    type: "glitch",
    intensity: electric ? 2.5 : 1.8,
    duration: electric ? 620 : 420,
    fullScreen: true,
    slices: buildGlitchSlices(electric ? 16 : 11),
  });

  addImpactEvent({
    type: "banner",
    label: crashCopy.label,
    sublabel: crashCopy.reason,
    tint,
    accent: PALETTE.pink,
    duration: 900,
    fullScreen: true,
  });

  addShake(electric ? 18 : 14, electric ? 460 : 380);
  addHitStop(electric ? 150 : 120);
  gameOverFlashUntil = Math.max(gameOverFlashUntil, now + (electric ? 360 : 300));
  playCrashSound(electric);
  vibrate(electric ? [32, 28, 46, 26, 60] : [28, 36, 46]);
}

function triggerModeStartFeedback(modeId, now) {
  const copy = getCopy();
  const modeCopy = getModeCopy(modeId);

  addImpactEvent({
    type: "banner",
    label: modeCopy.title,
    sublabel: copy.impact.modeOnline,
    tint: PALETTE.cyan,
    accent: PALETTE.acid,
    duration: 650,
    fullScreen: true,
  });

  addShake(5, 160);
  addHitStop(36);
  playModeSound();
  vibrate(18);
}

function addImpactEvent(event) {
  if (feedbackMode === "reduced" && event.fullScreen) {
    return;
  }

  const normalized = {
    ...event,
    startedAt: millis(),
    duration: feedbackMode === "reduced" ? Math.max(160, event.duration * 0.58) : event.duration,
    intensity: feedbackMode === "reduced" ? (event.intensity || 1) * 0.45 : event.intensity || 1,
  };

  if (feedbackMode === "reduced" && normalized.particles) {
    normalized.particles = normalized.particles.slice(0, 8);
  }

  impactEvents.push(normalized);

  if (impactEvents.length > 28) {
    impactEvents.splice(0, impactEvents.length - 28);
  }
}

function drawImpactEvents(now) {
  impactEvents = impactEvents.filter((event) => now - event.startedAt <= event.duration);

  impactEvents.forEach((event) => {
    const progress = clamp((now - event.startedAt) / event.duration, 0, 1);
    const alpha = 255 * (1 - progress);

    if (event.type === "shock") {
      drawShockImpact(event, progress, alpha);
    } else if (event.type === "crash") {
      drawCrashImpact(event, progress, alpha);
    } else if (event.type === "tunnel") {
      drawTunnelImpact(event, progress, alpha);
    } else if (event.type === "glitch") {
      drawGlitchImpact(event, progress, alpha);
    } else if (event.type === "banner") {
      drawBannerImpact(event, progress, alpha);
    }
  });
}

function drawShockImpact(event, progress, alpha) {
  const center = cellToPoint(event.cell);
  const base = board.cell * (1.5 + progress * 4.4 * event.intensity);

  push();
  noFill();
  drawingContext.shadowBlur = 24 * event.intensity;
  drawingContext.shadowColor = event.tint;
  stroke(colorWithAlpha(event.tint, alpha));
  strokeWeight(2.5);
  circle(center.x, center.y, base);
  stroke(colorWithAlpha(event.accent, alpha * 0.72));
  strokeWeight(1.3);
  circle(center.x, center.y, base * 0.58);
  drawImpactParticles(event, center, progress, alpha);
  pop();
}

function drawCrashImpact(event, progress, alpha) {
  const center = cellToPoint(event.cell);
  const maxSize = board.cell * (2.4 + event.intensity * 4.8);
  const size = maxSize * (0.35 + progress);

  push();
  noFill();
  drawingContext.shadowBlur = 30;
  drawingContext.shadowColor = event.tint;
  stroke(colorWithAlpha(event.tint, alpha));
  strokeWeight(3);
  circle(center.x, center.y, size);

  for (let i = 0; i < 11; i += 1) {
    const angle = i * 0.73 + progress * 1.7;
    const inner = size * 0.17;
    const outer = size * (0.4 + (i % 3) * 0.11);
    const kink = sin(progress * PI + i) * board.cell * 0.35;
    stroke(colorWithAlpha(i % 2 === 0 ? event.tint : event.accent, alpha * 0.82));
    strokeWeight(i % 3 === 0 ? 2 : 1);
    line(
      center.x + cos(angle) * inner,
      center.y + sin(angle) * inner,
      center.x + cos(angle) * outer + kink,
      center.y + sin(angle) * outer - kink
    );
  }

  drawImpactParticles(event, center, progress, alpha);
  pop();
}

function drawTunnelImpact(event, progress, alpha) {
  const from = cellToPoint(event.from);
  const to = cellToPoint(event.to);
  const steps = 5;

  push();
  noFill();
  drawingContext.shadowBlur = 24;
  drawingContext.shadowColor = event.tint;
  stroke(colorWithAlpha(event.tint, alpha * 0.72));
  strokeWeight(2);
  line(from.x, from.y, to.x, to.y);

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = lerp(from.x, to.x, t);
    const y = lerp(from.y, to.y, t);
    const size = board.cell * (0.55 + progress * 2.4 + sin(progress * PI * 2 + i) * 0.18);
    stroke(colorWithAlpha(i % 2 === 0 ? event.tint : event.accent, alpha * (1 - t * 0.28)));
    circle(x, y, size);
  }

  pop();
}

function drawGlitchImpact(event, progress, alpha) {
  if (feedbackMode === "reduced") {
    return;
  }

  push();
  noStroke();
  rectMode(CORNER);

  event.slices.forEach((slice, index) => {
    const y = slice.y * height;
    const h = slice.h * height;
    const drift = sin(progress * PI * 2 + slice.phase) * slice.offset * event.intensity;
    const tint = index % 2 === 0 ? colorWithAlpha(PALETTE.pink, alpha * 0.34) : colorWithAlpha(PALETTE.cyan, alpha * 0.3);

    fill(tint);
    rect(drift, y, width, h);
    fill(colorWithAlpha(PALETTE.white, alpha * 0.12));
    rect(-drift * 0.5, y + h * 0.35, width, Math.max(1, h * 0.18));
  });

  pop();
}

function drawBannerImpact(event, progress, alpha) {
  if (feedbackMode === "reduced") {
    return;
  }

  const scaleIn = progress < 0.18 ? progress / 0.18 : 1;
  const scaleOut = progress > 0.78 ? 1 - (progress - 0.78) / 0.22 : 1;
  const scaleValue = clamp(scaleIn * scaleOut, 0, 1);
  const y = height * 0.49;

  push();
  textAlign(CENTER, CENTER);
  noStroke();
  fill(colorWithAlpha(PALETTE.ink, alpha * 0.72));
  rect(0, y - 44, width, 88);

  drawingContext.shadowBlur = 28;
  drawingContext.shadowColor = event.tint;
  fill(colorWithAlpha(event.tint, alpha));
  textStyle(BOLD);
  textSize(clamp(width * 0.064, 30, 72) * (0.82 + scaleValue * 0.28));
  text(event.label, width / 2, y - 8);

  drawingContext.shadowColor = event.accent;
  fill(colorWithAlpha(event.accent, alpha * 0.9));
  textStyle(NORMAL);
  textSize(clamp(width * 0.018, 12, 18));
  text(event.sublabel, width / 2, y + 34);
  pop();
}

function drawImpactParticles(event, center, progress, alpha) {
  if (!event.particles) {
    return;
  }

  noStroke();

  event.particles.forEach((particle) => {
    const distance = board.cell * particle.speed * progress * event.intensity;
    const x = center.x + cos(particle.angle) * distance;
    const y = center.y + sin(particle.angle) * distance + particle.drop * progress * progress;
    const size = particle.size * (1 - progress * 0.45);

    fill(colorWithAlpha(particle.color, alpha * particle.alpha));
    rect(x - size / 2, y - size / 2, size, size, 2);
  });
}

function buildParticleBurst(cell, count, colors, intensity) {
  return Array.from({ length: count }, (_, index) => ({
    angle: (Math.PI * 2 * index) / count + Math.random() * 0.42,
    speed: 1.1 + Math.random() * 3.2 * intensity,
    size: 2 + Math.random() * Math.max(2, board.cell * 0.22),
    drop: (Math.random() - 0.35) * board.cell * 1.7,
    color: colors[index % colors.length],
    alpha: 0.58 + Math.random() * 0.42,
  }));
}

function buildGlitchSlices(count) {
  return Array.from({ length: count }, () => ({
    y: Math.random(),
    h: 0.006 + Math.random() * 0.028,
    offset: 16 + Math.random() * 70,
    phase: Math.random() * Math.PI * 2,
  }));
}

function addShake(magnitude, duration) {
  if (feedbackMode === "reduced") {
    return;
  }

  const now = millis();
  const current = now < screenShake.until ? screenShake.magnitude * ((screenShake.until - now) / screenShake.duration) : 0;

  screenShake = {
    startedAt: now,
    until: now + duration,
    duration,
    magnitude: Math.max(magnitude, current),
  };
}

function getShakeOffset(now) {
  if (feedbackMode === "reduced" || now >= screenShake.until) {
    return { x: 0, y: 0 };
  }

  const progress = clamp((screenShake.until - now) / screenShake.duration, 0, 1);
  const magnitude = screenShake.magnitude * progress * progress;

  return {
    x: sin(now * 0.083) * magnitude + sin(now * 0.041) * magnitude * 0.45,
    y: cos(now * 0.071) * magnitude,
  };
}

function addHitStop(duration) {
  if (feedbackMode === "reduced") {
    return;
  }

  hitStopUntil = Math.max(hitStopUntil, millis() + duration);
}

function vibrate(pattern) {
  if (feedbackMode !== "full" || !canUseVibration()) {
    return;
  }

  navigator.vibrate(pattern);
}

function canUseVibration() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return false;
  }

  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
    return false;
  }

  return true;
}

function cellToPoint(cell) {
  const x = clamp(cell.x, 0, GRID_COLS - 1);
  const y = clamp(cell.y, 0, GRID_ROWS - 1);

  return {
    x: board.x + x * board.cell + board.cell / 2,
    y: board.y + y * board.cell + board.cell / 2,
  };
}

function colorWithAlpha(value, alpha) {
  const nextColor = color(value);
  nextColor.setAlpha(clamp(alpha, 0, 255));
  return nextColor;
}

function unlockAudio() {
  if (muted || typeof window === "undefined") {
    return;
  }

  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  if (!audioState.context) {
    audioState.context = new AudioContextConstructor();
  }

  if (audioState.context.state === "suspended") {
    audioState.context.resume();
  }

  audioState.unlocked = true;
}

function getAudioContext() {
  if (muted) {
    return null;
  }

  unlockAudio();
  return audioState.context;
}

function playTone(frequency, duration, type, gain, endFrequency, delay) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const now = context.currentTime + (delay || 0);
  const volume = feedbackMode === "reduced" ? gain * 0.35 : gain;
  const oscillator = context.createOscillator();
  const amp = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(20, frequency), now);

  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
  }

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(amp);
  amp.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function playNoise(duration, gain, delay) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const start = context.currentTime + (delay || 0);
  const sampleRate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
  const data = buffer.getChannelData(0);
  const source = context.createBufferSource();
  const amp = context.createGain();
  const volume = feedbackMode === "reduced" ? gain * 0.35 : gain;

  for (let i = 0; i < data.length; i += 1) {
    const fade = 1 - i / data.length;
    data[i] = (Math.random() * 2 - 1) * fade;
  }

  source.buffer = buffer;
  amp.gain.setValueAtTime(volume, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(amp);
  amp.connect(context.destination);
  source.start(start);
  source.stop(start + duration + 0.03);
}

function playEatSound(combo) {
  const base = 520 + Math.min(combo, 8) * 58;

  playTone(base, 0.075, "square", 0.032, base * 1.45);
  playTone(base * 2.02, 0.055, "sawtooth", 0.018, base * 2.42, 0.025);
}

function playOverdriveSound() {
  playTone(82, 0.22, "sawtooth", 0.065, 124);
  playTone(1240, 0.16, "triangle", 0.024, 620, 0.04);
}

function playTeleportSound() {
  playTone(240, 0.19, "sine", 0.038, 840);
  playTone(1080, 0.13, "triangle", 0.022, 360, 0.035);
}

function playCrashSound(electric) {
  playNoise(electric ? 0.28 : 0.2, electric ? 0.075 : 0.055);
  playTone(electric ? 72 : 92, electric ? 0.28 : 0.22, "sawtooth", electric ? 0.08 : 0.065, electric ? 34 : 46);
  playTone(electric ? 1320 : 680, 0.09, "square", electric ? 0.028 : 0.018, electric ? 220 : 180, 0.035);
}

function playModeSound() {
  playTone(220, 0.07, "triangle", 0.024, 330);
  playTone(440, 0.09, "square", 0.018, 660, 0.04);
}

function triggerEatFeedback(cell, points, combo, now) {
  eatFeedbacks.push({
    cell: { x: cell.x, y: cell.y },
    points,
    combo,
    startedAt: now,
    duration: combo > 1 ? 660 : 520,
  });

  if (eatFeedbacks.length > 8) {
    eatFeedbacks.shift();
  }

  scorePulseUntil = now + (combo > 1 ? 360 : 280);
}

function drawEatFeedback(now) {
  eatFeedbacks = eatFeedbacks.filter((feedback) => now - feedback.startedAt <= feedback.duration);

  if (eatFeedbacks.length === 0) {
    return;
  }

  push();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);

  eatFeedbacks.forEach((feedback) => {
    const age = now - feedback.startedAt;
    const progress = clamp(age / feedback.duration, 0, 1);
    const alpha = 255 * (1 - progress);
    const cx = board.x + feedback.cell.x * board.cell + board.cell / 2;
    const cy = board.y + feedback.cell.y * board.cell + board.cell / 2;
    const ringSize = board.cell * (1.1 + progress * (feedback.combo > 1 ? 3.1 : 2.4));
    const textY = cy - board.cell * (progress * 1.8 + 0.35);
    const scorePopup = getCopy().scorePopup;
    const label = feedback.combo > 1
      ? formatCopy(scorePopup.combo, { points: feedback.points, combo: feedback.combo })
      : formatCopy(scorePopup.points, { points: feedback.points });

    noFill();
    drawingContext.shadowBlur = 22;
    drawingContext.shadowColor = feedback.combo > 1 ? PALETTE.acid : PALETTE.pink;
    stroke(feedback.combo > 1 ? color(182, 255, 0, alpha) : color(255, 43, 214, alpha));
    strokeWeight(2);
    circle(cx, cy, ringSize);

    drawingContext.shadowColor = PALETTE.cyan;
    stroke(0, 229, 255, alpha * 0.7);
    strokeWeight(1);
    circle(cx, cy, ringSize * 0.62);

    noStroke();
    drawingContext.shadowBlur = 18;
    fill(255, 224, 102, alpha);
    textSize(clamp(board.cell * 0.82, 13, 22));
    text(label, cx, textY);
  });

  pop();
}

function triggerTeleportFeedback(from, to, now) {
  teleportFeedbacks.push({
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y },
    startedAt: now,
    duration: 420,
  });

  if (teleportFeedbacks.length > 4) {
    teleportFeedbacks.shift();
  }
}

function drawTeleportFeedback(now) {
  teleportFeedbacks = teleportFeedbacks.filter((feedback) => now - feedback.startedAt <= feedback.duration);

  if (teleportFeedbacks.length === 0) {
    return;
  }

  push();

  teleportFeedbacks.forEach((feedback) => {
    const age = now - feedback.startedAt;
    const progress = clamp(age / feedback.duration, 0, 1);
    const alpha = 220 * (1 - progress);

    drawPortalPulse(feedback.from, progress, alpha, PALETTE.pink);
    drawPortalPulse(feedback.to, progress, alpha, PALETTE.cyan);
  });

  pop();
}

function drawPortalPulse(cell, progress, alpha, tint) {
  const cx = board.x + cell.x * board.cell + board.cell / 2;
  const cy = board.y + cell.y * board.cell + board.cell / 2;
  const size = board.cell * (0.9 + progress * 2.7);

  drawingContext.shadowBlur = 20;
  drawingContext.shadowColor = tint;
  noFill();
  stroke(tint);
  strokeWeight(2);
  circle(cx, cy, size);
  stroke(255, 255, 255, alpha * 0.7);
  strokeWeight(1);
  line(cx - size * 0.35, cy, cx + size * 0.35, cy);
  line(cx, cy - size * 0.35, cx, cy + size * 0.35);
}

function drawStateOverlay() {
  mobileModeButton = null;

  if (game.status === "running" && !paused) {
    return;
  }

  const copy = getCopy();
  const overlay = copy.overlay;
  const scoreLabel = String(game.score).padStart(4, "0");
  const title = paused ? overlay.paused : game.status === "won" ? overlay.won : overlay.gameover;
  const scoreLine = paused ? overlay.progressSaved : formatCopy(overlay.finalScore, { score: scoreLabel });
  const actionLine = paused ? overlay.resume : overlay.restart;
  const modeLine = overlay.backToModes;
  const showMobileModeButton = !paused && shouldUseTouchLayout();
  const titleSize = clamp(board.w * 0.18, 72, 120);

  push();
  noStroke();
  fill(5, 6, 12, 218);
  rect(board.x, board.y, board.w, board.h);

  const titleGlow = paused ? PALETTE.cyan : game.status === "won" ? PALETTE.acid : PALETTE.pink;
  const titleAccent = paused ? PALETTE.acid : game.status === "won" ? PALETTE.cyan : PALETTE.acid;
  const centerY = board.y + board.h / 2;
  const titleY = centerY - titleSize * 0.78;

  drawNeonText(title, board.x + board.w / 2, titleY, {
    size: titleSize,
    baseline: CENTER,
    glowA: titleGlow,
    glowB: PALETTE.cyan,
    accent: titleAccent,
    primary: PALETTE.readable,
    outlineWeight: Math.max(10, titleSize * 0.24),
    strokeWeight: Math.max(3, titleSize * 0.056),
    offset: Math.max(1.4, titleSize * 0.02),
    glowScale: 0.36,
  });

  rectMode(CENTER);
  noStroke();
  fill(5, 6, 12, 150);
  rect(board.x + board.w / 2, centerY + titleSize * 0.5, board.w * 0.7, titleSize * 0.92, 8);

  drawReadableText(scoreLine, board.x + board.w / 2, centerY + titleSize * 0.16, {
    size: clamp(board.w * 0.048, 24, 34),
    baseline: CENTER,
    primary: PALETTE.limeText,
    glow: PALETTE.cyan,
  });
  drawReadableText(actionLine, board.x + board.w / 2, centerY + titleSize * 0.52, {
    size: clamp(board.w * 0.04, 22, 30),
    baseline: CENTER,
    primary: PALETTE.limeText,
    glow: PALETTE.pink,
  });

  if (showMobileModeButton) {
    const buttonW = clamp(board.w * 0.36, 104, 132);
    const buttonH = clamp(board.w * 0.095, 32, 38);

    drawMobileModeButton(copy, {
      x: board.x + board.w / 2 - buttonW / 2,
      y: centerY + titleSize * 0.66,
      w: buttonW,
      h: buttonH,
    });
  } else {
    drawReadableText(modeLine, board.x + board.w / 2, centerY + titleSize * 0.82, {
      size: clamp(board.w * 0.036, 20, 28),
      baseline: CENTER,
      primary: PALETTE.limeText,
      glow: PALETTE.cyan,
    });
  }
  pop();
}

function drawTouchControls() {
  touchControls = [];

  if (screen !== "playing" || !shouldShowTouchControls()) {
    return;
  }

  const sideControls = shouldUseSideTouchControls();
  const size = clamp(Math.min(width, height) * 0.16, 58, 74);
  const gap = Math.max(12, size * 0.22);
  const hitSize = clamp(size * 1.54, 88, 112);
  const sideReserve = sideControls ? getTouchSideReserve() : 0;
  const cx = sideControls ? width - sideReserve / 2 : width / 2;
  const preferredCy = sideControls ? height * 0.58 : height - size * 1.1 - 22;
  const minCy = sideControls ? size + gap + 18 : board.y + board.h + size * 1.45 + gap;
  const maxCy = height - size * 0.66 - 18;
  const cy = Math.min(Math.max(preferredCy, minCy), maxCy);

  touchControls = [
    createTouchControl("up", cx, cy - size - gap, size, hitSize),
    createTouchControl("left", cx - size - gap, cy, size, hitSize),
    createTouchControl("down", cx, cy, size, hitSize),
    createTouchControl("right", cx + size + gap, cy, size, hitSize),
  ];

  push();
  rectMode(CENTER);

  touchControls.forEach((control) => {
    drawingContext.shadowBlur = 8;
    drawingContext.shadowColor = PALETTE.cyan;
    stroke(colorWithAlpha(PALETTE.cyan, 46));
    strokeWeight(1);
    fill(0, 229, 255, 14);
    rect(control.x, control.y, control.hitSize, control.hitSize, 8);

    drawingContext.shadowBlur = 18;
    drawingContext.shadowColor = PALETTE.cyan;
    stroke(PALETTE.cyan);
    strokeWeight(1.5);
    fill(6, 11, 22, 210);
    rect(control.x, control.y, control.size, control.size, 5);
    drawArrow(control.direction, control.x, control.y, control.size * 0.34);
  });

  pop();
}

function createTouchControl(direction, x, y, size, hitSize) {
  return { direction, x, y, size, hitSize };
}

function drawArrow(direction, x, y, size) {
  push();
  translate(x, y);

  if (direction === "right") {
    rotate(HALF_PI);
  } else if (direction === "down") {
    rotate(PI);
  } else if (direction === "left") {
    rotate(-HALF_PI);
  }

  noStroke();
  fill(PALETTE.acid);
  triangle(0, -size, size * 0.8, size * 0.85, -size * 0.8, size * 0.85);
  pop();
}

function drawFlash(now) {
  if (now >= gameOverFlashUntil) {
    return;
  }

  const strength = feedbackMode === "reduced" ? 0.34 : 1;

  push();
  noStroke();
  fill(255, 43, 214, map(gameOverFlashUntil - now, 0, 360, 0, 130) * strength);
  rect(0, 0, width, height);
  pop();
}

function getScorePulse(now) {
  if (now >= scorePulseUntil) {
    return 0;
  }

  return clamp((scorePulseUntil - now) / 280, 0, 1);
}

function keyPressed() {
  unlockAudio();

  const keyName = String(key).toLowerCase();

  if (keyName === "l") {
    toggleLanguage();
    return false;
  }

  if (keyName === "v") {
    toggleMute();
    return false;
  }

  if (keyName === "f") {
    toggleFeedbackMode();
    return false;
  }

  if (keyName === "m") {
    returnToModeSelect();
    return false;
  }

  if (screen === "achievements") {
    if (keyName === "a" || keyCode === ESCAPE) {
      returnToModeSelect();
    }

    return false;
  }

  if (screen === "select") {
    if (keyName === "a") {
      openProgressionArchive();
      return false;
    }

    if (keyName === "d") {
      startDailyChallenge();
      return false;
    }

    const selectedMode = getModeIdFromNumber(keyName);

    if (selectedMode) {
      startMode(selectedMode);
    }

    return false;
  }

  const direction = directionFromKey();

  if (direction) {
    SnakeLogic.setDirection(game, direction);
    return false;
  }

  if (keyCode === ENTER || keyName === "r") {
    resetGame();
    return false;
  }

  if (keyName === " " || keyName === "p") {
    togglePause();
    return false;
  }

  return true;
}

function getModeIdFromNumber(value) {
  const numeric = Number(value);

  if (!Number.isInteger(numeric)) {
    return null;
  }

  return SnakeLogic.MODE_SEQUENCE.find((modeId) => SnakeLogic.getModeConfig(modeId).number === numeric) || null;
}

function directionFromKey() {
  if (keyCode === UP_ARROW || String(key).toLowerCase() === "w") {
    return "up";
  }

  if (keyCode === DOWN_ARROW || String(key).toLowerCase() === "s") {
    return "down";
  }

  if (keyCode === LEFT_ARROW || String(key).toLowerCase() === "a") {
    return "left";
  }

  if (keyCode === RIGHT_ARROW || String(key).toLowerCase() === "d") {
    return "right";
  }

  return null;
}

function mousePressed() {
  if (millis() - lastTouchAt < 350) {
    return false;
  }

  return handlePointer(mouseX, mouseY);
}

function touchStarted() {
  lastTouchAt = millis();
  const touch = getTouchPoint();
  const startsOnControl = Boolean(findTouchControl(touch.x, touch.y) || findMobileActionButton(touch.x, touch.y));
  touchStart = shouldTrackSwipe(startsOnControl) ? { x: touch.x, y: touch.y, lastDirection: null } : null;
  return handlePointer(touch.x, touch.y);
}

function touchMoved(event) {
  const touch = getTouchPoint(event);
  tryHandleSwipe(touch.x, touch.y);
  return false;
}

function touchEnded(event) {
  const touch = getTouchPoint(event);
  tryHandleSwipe(touch.x, touch.y);
  touchStart = null;
  return false;
}

function handlePointer(x, y) {
  unlockAudio();

  if (screen === "achievements") {
    if (archiveBackButton && pointInRect(x, y, archiveBackButton)) {
      returnToModeSelect();
    }

    return false;
  }

  if (screen === "select") {
    if (languageButton && pointInRect(x, y, languageButton)) {
      toggleLanguage();
      return false;
    }

    if (progressionArchiveButton && pointInRect(x, y, progressionArchiveButton)) {
      openProgressionArchive();
      return false;
    }

    if (dailyChallengeCard && pointInRect(x, y, dailyChallengeCard)) {
      startDailyChallenge();
      return false;
    }

    const card = modeCards.find((candidate) => pointInRect(x, y, candidate));

    if (card) {
      startMode(card.modeId);
    }

    return false;
  }

  const mobileAction = findMobileActionButton(x, y);

  if (mobileAction === "mode") {
    returnToModeSelect();
    return false;
  }

  if (game.status !== "running") {
    resetGame();
    return false;
  }

  const control = findTouchControl(x, y);

  if (control) {
    SnakeLogic.setDirection(game, control.direction);
  }

  return false;
}

function getTouchPoint(event) {
  const changedTouch = event && event.changedTouches && event.changedTouches[0];
  const activeTouch = event && event.touches && event.touches[0];
  const p5Touch = typeof touches !== "undefined" && touches.length > 0 ? touches[0] : null;
  const source = changedTouch || activeTouch || p5Touch;

  if (source) {
    return {
      x: source.clientX === undefined ? source.x : source.clientX,
      y: source.clientY === undefined ? source.y : source.clientY,
    };
  }

  return { x: mouseX, y: mouseY };
}

function shouldTrackSwipe(startsOnControl) {
  return (
    shouldUseTouchLayout() &&
    screen === "playing" &&
    game.status === "running" &&
    !paused &&
    !startsOnControl
  );
}

function tryHandleSwipe(x, y) {
  if (!touchStart || !shouldTrackSwipe(false)) {
    return false;
  }

  const dx = x - touchStart.x;
  const dy = y - touchStart.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const distance = Math.max(absX, absY);

  if (distance < SWIPE_MIN_DISTANCE) {
    return false;
  }

  let direction = null;

  if (absX > absY * SWIPE_DOMINANCE) {
    direction = dx > 0 ? "right" : "left";
  } else if (absY > absX * SWIPE_DOMINANCE) {
    direction = dy > 0 ? "down" : "up";
  }

  if (!direction) {
    return false;
  }

  SnakeLogic.setDirection(game, direction);
  touchStart.x = x;
  touchStart.y = y;
  touchStart.lastDirection = direction;
  return true;
}

function findTouchControl(x, y) {
  const candidates = touchControls.filter((button) => pointInControl(x, y, button));

  if (candidates.length <= 1) {
    return candidates[0] || null;
  }

  return candidates.reduce((nearest, candidate) => (
    getDistanceSquared(x, y, candidate) < getDistanceSquared(x, y, nearest) ? candidate : nearest
  ));
}

function findMobileActionButton(x, y) {
  if (screen === "playing" && mobileModeButton && pointInRect(x, y, mobileModeButton)) {
    return "mode";
  }

  return null;
}

function pointInRect(x, y, rectBounds) {
  return (
    x >= rectBounds.x &&
    x <= rectBounds.x + rectBounds.w &&
    y >= rectBounds.y &&
    y <= rectBounds.y + rectBounds.h
  );
}

function pointInControl(x, y, control) {
  const half = (control.hitSize || control.size) / 2;
  return x >= control.x - half && x <= control.x + half && y >= control.y - half && y <= control.y + half;
}

function getDistanceSquared(x, y, control) {
  const dx = x - control.x;
  const dy = y - control.y;
  return dx * dx + dy * dy;
}

function startMode(modeId, options) {
  const settings = options || {};
  const dailyChallenge = settings.dailyChallenge || null;
  activeModeId = SnakeLogic.getModeConfig(modeId).id;
  activeDailyChallenge = dailyChallenge;
  game = SnakeLogic.createGame({
    cols: GRID_COLS,
    rows: GRID_ROWS,
    modeId: activeModeId,
    random: dailyChallenge && Progression ? Progression.createSeededRandom(dailyChallenge.seed) : Math.random,
  });
  startProgressionRun(activeModeId, dailyChallenge, millis());
  screen = "playing";
  paused = false;
  lastStepAt = millis();
  clearFeedback();
  triggerModeStartFeedback(activeModeId, millis());
}

function startProgressionRun(modeId, dailyChallenge, now) {
  if (!Progression) {
    currentRun = null;
    return;
  }

  const result = Progression.startRun({
    modeId,
    daily: Boolean(dailyChallenge),
    challenge: dailyChallenge,
  });
  currentRun = result.run;
  refreshProgressionSummary(result.profile);
  pushProgressionRewards(result.rewards, now);
}

function startDailyChallenge() {
  const challenge = ensureDailyChallenge();

  if (!challenge) {
    return;
  }

  startMode(challenge.modeId, { dailyChallenge: challenge });
}

function openProgressionArchive() {
  if (!Progression) {
    return;
  }

  screen = "achievements";
  paused = false;
  clearFeedback();
  playModeSound();
}

function returnToModeSelect() {
  screen = "select";
  paused = false;
  currentRun = null;
  activeDailyChallenge = null;
  clearFeedback();
}

function togglePause() {
  if (screen === "playing" && game.status === "running") {
    paused = !paused;

    if (paused && Progression) {
      currentRun = Progression.markPaused(currentRun);
    }
  }
}

function toggleMute() {
  muted = !muted;

  if (!muted) {
    unlockAudio();
    playModeSound();
  }
}

function toggleFeedbackMode() {
  feedbackMode = feedbackMode === "full" ? "reduced" : "full";

  if (feedbackMode === "reduced") {
    hitStopUntil = 0;
    screenShake = { startedAt: 0, until: 0, duration: 0, magnitude: 0 };

    if (canUseVibration()) {
      navigator.vibrate(0);
    }
  } else {
    addImpactEvent({
      type: "banner",
      label: getCopy().impact.fxFull,
      sublabel: getCopy().impact.impactArmed,
      tint: PALETTE.acid,
      accent: PALETTE.cyan,
      duration: 560,
      fullScreen: true,
    });
    addShake(5, 150);
    vibrate(12);
  }

  playModeSound();
}

function resetGame() {
  const dailyChallenge = currentRun && currentRun.daily ? currentRun.dailyChallenge : activeDailyChallenge;

  if (dailyChallenge && Progression) {
    activeModeId = dailyChallenge.modeId;
    activeDailyChallenge = dailyChallenge;
    game = SnakeLogic.createGame({
      cols: GRID_COLS,
      rows: GRID_ROWS,
      modeId: activeModeId,
      random: Progression.createSeededRandom(dailyChallenge.seed),
    });
  } else {
    SnakeLogic.restartGame(game, activeModeId);
    activeDailyChallenge = null;
  }

  startProgressionRun(activeModeId, activeDailyChallenge, millis());
  screen = "playing";
  paused = false;
  lastStepAt = millis();
  clearFeedback();
}

function clearFeedback() {
  gameOverFlashUntil = 0;
  scorePulseUntil = 0;
  hitStopUntil = 0;
  screenShake = { startedAt: 0, until: 0, duration: 0, magnitude: 0 };
  eatFeedbacks = [];
  teleportFeedbacks = [];
  impactEvents = [];
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculateLayout();
}

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}
