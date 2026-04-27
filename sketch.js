const GRID_COLS = 24;
const GRID_ROWS = 24;
const TOUCH_BREAKPOINT = 760;

const PALETTE = {
  ink: "#05060c",
  board: "#070b16",
  cyan: "#00e5ff",
  acid: "#b6ff00",
  acidDark: "#5d8f00",
  pink: "#ff2bd6",
  white: "#f2fff5",
  amber: "#ffe066",
  violet: "#8f4dff",
};

const DEFAULT_LANGUAGE = "zh";

const COPY = {
  zh: {
    appSubtitle: "霓虹蛇阵已点亮  |  选择模式  |  按 1-4",
    languageButton: "EN",
    score: "分数",
    modeShortcut: "M 模式",
    resetShortcut: "R 重开",
    languageShortcut: "L 语言",
    soundOn: "音效开",
    soundOff: "音效关",
    fxFull: "特效完整",
    fxReduced: "特效精简",
    modes: {
      classic: {
        title: "经典模式",
        tagline: "熟悉的节奏，考验每一次转弯。",
        hint: "稳定速度 / 专注走位",
      },
      rush: {
        title: "霓虹疾行",
        tagline: "连吃越快，节奏越狠。",
        hint: "连击加分 / 逐步加速",
      },
      maze: {
        title: "电路迷宫",
        tagline: "电墙封住去路，绕行才是本事。",
        hint: "固定电墙 / 小心绕行",
      },
      portal: {
        title: "传送漂移",
        tagline: "传送门会突然改写你的路线。",
        hint: "每 5 个食物重组传送门",
      },
    },
    status: {
      classic: "经典巡航",
      rush: "速度 {speed}  连击 x{combo}",
      maze: "电墙 {count}",
      portal: "传送门重组 {current}/{total}",
    },
    impact: {
      overdrive: "超载连击",
      combo: "连击 x{combo}",
      gatesShifted: "传送门重组",
      portalDrift: "路线已改变",
      modeOnline: "模式启动",
      fxFull: "完整特效",
      impactArmed: "冲击反馈已启动",
    },
    crash: {
      electric: { label: "短路", reason: "电墙过载" },
      body: { label: "撞到自己", reason: "蛇身回环" },
      wall: { label: "系统崩溃", reason: "边界越界" },
    },
    overlay: {
      paused: "已暂停",
      won: "棋盘已清空",
      gameover: "游戏结束",
      progressSaved: "当前进度已保留",
      finalScore: "最终分数 {score}",
      resume: "空格 / P 继续",
      restart: "R / 回车 / 点击重开",
      backToModes: "M 返回模式选择",
    },
    scorePopup: {
      points: "+{points}",
      combo: "+{points} 连击 x{combo}",
    },
  },
  en: {
    appSubtitle: "NEON SNAKE ONLINE  |  CHOOSE A MODE  |  PRESS 1-4",
    languageButton: "中文",
    score: "SCORE",
    modeShortcut: "M MODE",
    resetShortcut: "R RESET",
    languageShortcut: "L LANG",
    soundOn: "SFX ON",
    soundOff: "SFX OFF",
    fxFull: "FX FULL",
    fxReduced: "FX REDUCED",
    modes: {
      classic: {
        title: "Classic",
        tagline: "The familiar loop, tuned for clean turns.",
        hint: "steady pace / pure routing",
      },
      rush: {
        title: "Neon Rush",
        tagline: "Chain pickups and the tempo bites back.",
        hint: "combo scoring / rising speed",
      },
      maze: {
        title: "Circuit Maze",
        tagline: "Live wires block the lane. Thread the gap.",
        hint: "fixed walls / careful routing",
      },
      portal: {
        title: "Portal Drift",
        tagline: "Twin gates keep rewriting your path.",
        hint: "gates reshuffle every 5 food",
      },
    },
    status: {
      classic: "CLASSIC LOOP",
      rush: "SPD {speed}  COMBO x{combo}",
      maze: "WALLS {count}",
      portal: "GATE SHIFT {current}/{total}",
    },
    impact: {
      overdrive: "OVERDRIVE",
      combo: "COMBO x{combo}",
      gatesShifted: "GATES SHIFTED",
      portalDrift: "PORTAL DRIFT",
      modeOnline: "ONLINE",
      fxFull: "FX FULL",
      impactArmed: "IMPACT SYSTEM ARMED",
    },
    crash: {
      electric: { label: "SHORT CIRCUIT", reason: "ELECTRIC WALL" },
      body: { label: "SELF COLLISION", reason: "SNAKE BODY" },
      wall: { label: "SYSTEM CRASH", reason: "OUT OF BOUNDS" },
    },
    overlay: {
      paused: "PAUSED",
      won: "GRID CLEARED",
      gameover: "GAME OVER",
      progressSaved: "Run state preserved",
      finalScore: "FINAL SCORE {score}",
      resume: "SPACE / P TO RESUME",
      restart: "R / ENTER / TAP TO RESTART",
      backToModes: "M BACK TO MODES",
    },
    scorePopup: {
      points: "+{points}",
      combo: "+{points} x{combo}",
    },
  },
};

let game;
let board;
let screen = "select";
let activeModeId = "classic";
let modeCards = [];
let languageButton = null;
let touchControls = [];
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

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  textFont('"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif');
  setLanguage(DEFAULT_LANGUAGE);
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

    if (previousStatus !== game.status && game.status === "gameover") {
      gameOverFlashUntil = Math.max(gameOverFlashUntil, now + 180);
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
  const compactControls = shouldShowTouchControls();
  const margin = compactControls ? 16 : 26;
  const topReserve = compactControls ? 92 : 112;
  const bottomReserve = compactControls ? 152 : 36;
  const availableWidth = Math.max(220, width - margin * 2);
  const availableHeight = Math.max(220, height - topReserve - bottomReserve);
  const cellSize = Math.max(7, Math.floor(Math.min(availableWidth / GRID_COLS, availableHeight / GRID_ROWS)));
  const boardWidth = cellSize * GRID_COLS;
  const boardHeight = cellSize * GRID_ROWS;

  board = {
    x: Math.floor((width - boardWidth) / 2),
    y: Math.floor(topReserve + Math.max(0, (availableHeight - boardHeight) / 2)),
    w: boardWidth,
    h: boardHeight,
    cell: cellSize,
  };
}

function shouldShowTouchControls() {
  return width <= TOUCH_BREAKPOINT || navigator.maxTouchPoints > 0;
}

function renderScene(now) {
  background(PALETTE.ink);
  drawPunkBackdrop(now);

  if (screen === "select") {
    drawModeSelect(now);
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

function drawModeSelect(now) {
  modeCards = [];
  languageButton = null;
  touchControls = [];

  push();
  textAlign(CENTER, TOP);
  drawingContext.shadowBlur = 24;
  drawingContext.shadowColor = PALETTE.pink;
  fill(PALETTE.white);
  textStyle(BOLD);
  textSize(clamp(width * 0.056, 30, 58));
  text("WebSmallGame", width / 2, clamp(height * 0.055, 18, 44));

  drawingContext.shadowColor = PALETTE.cyan;
  fill(PALETTE.acid);
  textStyle(NORMAL);
  textSize(clamp(width * 0.02, 13, 18));
  text(getCopy().appSubtitle, width / 2, clamp(height * 0.055, 18, 44) + 62);
  pop();

  drawLanguageButton();

  const compact = width < 760;
  const columns = compact ? 1 : 2;
  const gap = compact ? 12 : 18;
  const margin = compact ? 20 : 34;
  const cardW = Math.min(380, (width - margin * 2 - gap * (columns - 1)) / columns);
  const cardH = compact ? 92 : 116;
  const rows = Math.ceil(SnakeLogic.MODE_SEQUENCE.length / columns);
  const totalW = cardW * columns + gap * (columns - 1);
  const totalH = cardH * rows + gap * (rows - 1);
  const startX = (width - totalW) / 2;
  const startY = Math.max(118, Math.min(height - totalH - 24, height * 0.24));

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
    textSize(compact ? 20 : 24);
    text(modeCopy.title, x + 58, y + 13);

    textStyle(NORMAL);
    fill(PALETTE.acid);
    textSize(compact ? 12 : 14);
    text(modeCopy.tagline, x + 18, y + (compact ? 48 : 58), cardW - 36, 42);

    fill(PALETTE.cyan);
    textSize(11);
    text(getModeHint(modeId), x + 18, y + cardH - 25, cardW - 36, 18);
    pop();
  });
}

function getModeHint(modeId) {
  return getModeCopy(modeId).hint;
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
  const scoreLabel = String(game.score).padStart(4, "0");
  const compact = width < 640;
  const pulse = getScorePulse(now);
  const copy = getCopy();
  const modeCopy = getModeCopy(game.modeId);

  push();
  textAlign(CENTER, TOP);
  drawingContext.shadowBlur = 18 + pulse * 16;
  drawingContext.shadowColor = pulse > 0 ? PALETTE.acid : PALETTE.pink;
  fill(pulse > 0 ? PALETTE.acid : PALETTE.white);
  textSize(clamp(width * 0.052, 26, 52) + pulse * 4);
  textStyle(BOLD);
  text("WebSmallGame", width / 2 + 2, compact ? 10 : 18);

  drawingContext.shadowColor = PALETTE.cyan;
  drawingContext.shadowBlur = 10 + pulse * 18;
  fill(pulse > 0 ? PALETTE.amber : PALETTE.acid);
  textStyle(NORMAL);

  if (compact) {
    textSize(12);
    text(`${modeCopy.title}  |  ${copy.score} ${scoreLabel}`, width / 2, 48);
    text(`${getModeStatus()}  |  ${getFeedbackStatus()}`, width / 2, 66);
  } else {
    textSize(clamp(width * 0.016, 12, 16));
    text(`${modeCopy.title}  |  ${copy.score} ${scoreLabel}  |  ${getModeStatus()}`, width / 2, 58);
    text(`${getFeedbackStatus()}  |  ${copy.modeShortcut}  |  ${copy.resetShortcut}  |  ${copy.languageShortcut}`, width / 2, 78);
  }

  pop();
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
  if (feedbackMode !== "full" || !navigator.vibrate) {
    return;
  }

  navigator.vibrate(pattern);
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

  push();
  noStroke();
  fill(5, 6, 12, 190);
  rect(board.x, board.y, board.w, board.h);

  textAlign(CENTER, CENTER);
  drawingContext.shadowBlur = 20;
  drawingContext.shadowColor = paused ? PALETTE.cyan : PALETTE.pink;
  textStyle(BOLD);
  fill(paused ? PALETTE.cyan : PALETTE.pink);
  textSize(clamp(board.w * 0.12, 30, 58));
  text(title, board.x + board.w / 2, board.y + board.h / 2 - 44);

  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = PALETTE.acid;
  textStyle(NORMAL);
  fill(PALETTE.acid);
  textSize(clamp(board.w * 0.038, 12, 18));
  text(scoreLine, board.x + board.w / 2, board.y + board.h / 2 + 8);
  textSize(clamp(board.w * 0.032, 11, 16));
  text(actionLine, board.x + board.w / 2, board.y + board.h / 2 + 36);
  text(modeLine, board.x + board.w / 2, board.y + board.h / 2 + 60);
  pop();
}

function drawTouchControls() {
  touchControls = [];

  if (screen !== "playing" || !shouldShowTouchControls()) {
    return;
  }

  const size = clamp(Math.min(width, height) * 0.12, 42, 58);
  const gap = Math.max(8, size * 0.18);
  const cx = width / 2;
  const preferredCy = height - size * 1.25;
  const minCy = board.y + board.h + size * 1.6 + gap;
  const maxCy = height - size * 0.6;
  const cy = Math.min(Math.max(preferredCy, minCy), maxCy);

  touchControls = [
    { direction: "up", x: cx, y: cy - size - gap, size },
    { direction: "left", x: cx - size - gap, y: cy, size },
    { direction: "down", x: cx, y: cy, size },
    { direction: "right", x: cx + size + gap, y: cy, size },
  ];

  push();
  rectMode(CENTER);

  touchControls.forEach((control) => {
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

  if (screen === "select") {
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
  const touch = touches[0] || { x: mouseX, y: mouseY };
  return handlePointer(touch.x, touch.y);
}

function handlePointer(x, y) {
  unlockAudio();

  if (screen === "select") {
    if (languageButton && pointInRect(x, y, languageButton)) {
      toggleLanguage();
      return false;
    }

    const card = modeCards.find((candidate) => pointInRect(x, y, candidate));

    if (card) {
      startMode(card.modeId);
    }

    return false;
  }

  if (game.status !== "running") {
    resetGame();
    return false;
  }

  const control = touchControls.find((button) => pointInControl(x, y, button));

  if (control) {
    SnakeLogic.setDirection(game, control.direction);
  }

  return false;
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
  const half = control.size / 2;
  return x >= control.x - half && x <= control.x + half && y >= control.y - half && y <= control.y + half;
}

function startMode(modeId) {
  activeModeId = SnakeLogic.getModeConfig(modeId).id;
  game = SnakeLogic.createGame({ cols: GRID_COLS, rows: GRID_ROWS, modeId: activeModeId });
  screen = "playing";
  paused = false;
  lastStepAt = millis();
  clearFeedback();
  triggerModeStartFeedback(activeModeId, millis());
}

function returnToModeSelect() {
  screen = "select";
  paused = false;
  clearFeedback();
}

function togglePause() {
  if (screen === "playing" && game.status === "running") {
    paused = !paused;
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

    if (navigator.vibrate) {
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
  SnakeLogic.restartGame(game, activeModeId);
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
