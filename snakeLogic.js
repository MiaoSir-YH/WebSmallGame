(function attachSnakeLogic(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.SnakeLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildSnakeLogic() {
  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const OPPOSITE = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };

  const MIRROR_DIRECTIONS = {
    up: "up",
    down: "down",
    left: "right",
    right: "left",
  };

  const MAX_DIRECTION_QUEUE = 4;
  const MODE_SEQUENCE = [
    "classic",
    "rush",
    "maze",
    "portal",
    "chain",
    "hunter",
    "collapse",
    "twin",
  ];

  const MODE_CONFIGS = {
    classic: {
      id: "classic",
      number: 1,
      baseInterval: 125,
      minInterval: 125,
    },
    rush: {
      id: "rush",
      number: 2,
      baseInterval: 135,
      minInterval: 70,
      speedStep: 12,
      comboWindow: 12,
    },
    maze: {
      id: "maze",
      number: 3,
      baseInterval: 125,
      minInterval: 125,
      wallCount: 22,
    },
    portal: {
      id: "portal",
      number: 4,
      baseInterval: 120,
      minInterval: 120,
      relocateEvery: 5,
    },
    chain: {
      id: "chain",
      number: 5,
      baseInterval: 112,
      minInterval: 112,
      bonusCount: 3,
      bonusLifetime: 8,
      bonusPoints: 15,
      comboWindow: 8,
    },
    hunter: {
      id: "hunter",
      number: 6,
      baseInterval: 120,
      minInterval: 120,
      hunterMoveEvery: 2,
    },
    collapse: {
      id: "collapse",
      number: 7,
      baseInterval: 118,
      minInterval: 118,
      shrinkEvery: 4,
      maxInset: 5,
    },
    twin: {
      id: "twin",
      number: 8,
      baseInterval: 122,
      minInterval: 122,
    },
  };

  function normalizeDirection(direction) {
    if (typeof direction !== "string") {
      return null;
    }

    const normalized = direction.toLowerCase();
    return Object.prototype.hasOwnProperty.call(DIRECTIONS, normalized) ? normalized : null;
  }

  function getModeConfig(modeId) {
    return MODE_CONFIGS[modeId] || MODE_CONFIGS.classic;
  }

  function sameCell(a, b) {
    return Boolean(a && b && a.x === b.x && a.y === b.y);
  }

  function cloneCell(cell) {
    return { x: cell.x, y: cell.y };
  }

  function cloneCells(cells) {
    return (cells || []).map(cloneCell);
  }

  function cloneBonusFoods(cells) {
    return (cells || []).map((cell) => ({
      x: cell.x,
      y: cell.y,
      expiresAt: Number.isFinite(cell.expiresAt) ? cell.expiresAt : 0,
    }));
  }

  function cloneSafeBounds(bounds, mode) {
    if (!bounds && mode.id !== "collapse") {
      return null;
    }

    const maxInset = mode.maxInset || (bounds && bounds.maxInset) || 0;
    const inset = Math.max(0, Math.min(maxInset, Math.floor((bounds && bounds.inset) || 0)));

    return { inset, maxInset };
  }

  function cloneDirectionQueue(queue) {
    return (queue || []).map(normalizeDirection).filter(Boolean).slice(0, MAX_DIRECTION_QUEUE);
  }

  function cellInList(cells, cell) {
    return (cells || []).some((candidate) => sameCell(candidate, cell));
  }

  function buildStartingSnake(cols, rows) {
    const headX = Math.floor(cols / 2);
    const headY = Math.floor(rows / 2);
    const maxLength = Math.min(4, cols);
    const snake = [];

    for (let index = 0; index < maxLength; index += 1) {
      snake.push({ x: headX - index, y: headY });
    }

    return snake;
  }

  function buildTwinMainSnake(cols, rows) {
    const maxLength = Math.min(4, Math.max(2, Math.floor(cols / 2) - 1));
    const headX = Math.max(maxLength - 1, Math.min(Math.floor(cols * 0.32), Math.floor(cols / 2) - 2));
    const headY = Math.floor(rows / 2);
    const snake = [];

    for (let index = 0; index < maxLength; index += 1) {
      snake.push({ x: headX - index, y: headY });
    }

    return snake;
  }

  function buildTwinSnake(game) {
    return game.snake.map((segment) => ({
      x: game.cols - 1 - segment.x,
      y: segment.y,
    }));
  }

  function createGame(options) {
    const settings = options || {};
    const cols = Math.max(6, Math.floor(settings.cols || 24));
    const rows = Math.max(6, Math.floor(settings.rows || 24));
    const mode = getModeConfig(settings.modeId);
    const direction = normalizeDirection(settings.direction) || "right";
    const random = typeof settings.random === "function" ? settings.random : Math.random;
    const snake = settings.snake
      ? cloneCells(settings.snake)
      : mode.id === "twin"
        ? buildTwinMainSnake(cols, rows)
        : buildStartingSnake(cols, rows);

    const game = {
      cols,
      rows,
      modeId: mode.id,
      snake,
      direction,
      pendingDirection: direction,
      directionQueue: cloneDirectionQueue(settings.directionQueue),
      food: settings.food ? cloneCell(settings.food) : null,
      score: Number.isFinite(settings.score) ? settings.score : 0,
      status: "running",
      tick: Number.isFinite(settings.tick) ? settings.tick : 0,
      speedLevel: Number.isFinite(settings.speedLevel) ? settings.speedLevel : 0,
      combo: Number.isFinite(settings.combo) ? settings.combo : 0,
      walls: cloneCells(settings.walls),
      portals: cloneCells(settings.portals),
      bonusFoods: cloneBonusFoods(settings.bonusFoods),
      hunter: settings.hunter ? cloneCell(settings.hunter) : null,
      safeBounds: cloneSafeBounds(settings.safeBounds, mode),
      twinSnake: settings.twinSnake ? cloneCells(settings.twinSnake) : [],
      foodsEaten: Number.isFinite(settings.foodsEaten) ? settings.foodsEaten : 0,
      lastEatTick: Number.isFinite(settings.lastEatTick) ? settings.lastEatTick : null,
      lastEvent: null,
      random,
    };

    if (mode.id === "maze" && game.walls.length === 0) {
      game.walls = buildWalls(game, mode.wallCount);
    }

    if (mode.id === "portal" && game.portals.length < 2) {
      game.portals = buildPortals(game);
    }

    if (mode.id === "hunter" && !game.hunter) {
      game.hunter = buildHunter(game);
    }

    if (mode.id === "twin" && game.twinSnake.length === 0) {
      game.twinSnake = buildTwinSnake(game);
    }

    if (!game.food) {
      placeFood(game);
    }

    return game;
  }

  function restartGame(game, modeId) {
    const fresh = createGame({
      cols: game.cols,
      rows: game.rows,
      modeId: modeId || game.modeId,
      random: game.random,
    });

    game.modeId = fresh.modeId;
    game.snake = fresh.snake;
    game.direction = fresh.direction;
    game.pendingDirection = fresh.pendingDirection;
    game.directionQueue = fresh.directionQueue;
    game.food = fresh.food;
    game.score = fresh.score;
    game.status = fresh.status;
    game.tick = fresh.tick;
    game.speedLevel = fresh.speedLevel;
    game.combo = fresh.combo;
    game.walls = fresh.walls;
    game.portals = fresh.portals;
    game.bonusFoods = fresh.bonusFoods;
    game.hunter = fresh.hunter;
    game.safeBounds = fresh.safeBounds;
    game.twinSnake = fresh.twinSnake;
    game.foodsEaten = fresh.foodsEaten;
    game.lastEatTick = fresh.lastEatTick;
    game.lastEvent = fresh.lastEvent;

    return game;
  }

  function setDirection(game, direction) {
    const nextDirection = normalizeDirection(direction);

    if (!nextDirection || game.status !== "running") {
      return game;
    }

    if (!game.directionQueue) {
      game.directionQueue = [];
    }

    const lastQueuedDirection = game.directionQueue[game.directionQueue.length - 1];
    const comparisonDirection = lastQueuedDirection || game.pendingDirection || game.direction;

    if (nextDirection === comparisonDirection || OPPOSITE[nextDirection] === comparisonDirection) {
      return game;
    }

    if (game.directionQueue.length >= MAX_DIRECTION_QUEUE) {
      game.directionQueue.shift();
    }

    game.directionQueue.push(nextDirection);
    return game;
  }

  function consumeQueuedDirection(game) {
    if (!game.directionQueue) {
      game.directionQueue = [];
    }

    if (game.directionQueue.length > 0) {
      game.pendingDirection = game.directionQueue.shift();
    } else {
      game.pendingDirection = game.direction;
    }

    return game.pendingDirection;
  }

  function getNextHeadForSnake(snake, direction) {
    const movement = DIRECTIONS[direction];
    const head = snake[0];

    return {
      x: head.x + movement.x,
      y: head.y + movement.y,
    };
  }

  function getNextHead(game) {
    return getNextHeadForSnake(game.snake, game.pendingDirection);
  }

  function getNextTwinHead(game) {
    return getNextHeadForSnake(game.twinSnake, MIRROR_DIRECTIONS[game.pendingDirection]);
  }

  function isOutOfBounds(position, bounds) {
    return (
      position.x < 0 ||
      position.y < 0 ||
      position.x >= bounds.cols ||
      position.y >= bounds.rows
    );
  }

  function isInsideSafeBounds(position, game) {
    if (!game.safeBounds) {
      return true;
    }

    const inset = game.safeBounds.inset || 0;

    return (
      position.x >= inset &&
      position.y >= inset &&
      position.x < game.cols - inset &&
      position.y < game.rows - inset
    );
  }

  function isCollision(position, snake, bounds) {
    return isOutOfBounds(position, bounds) || snake.some((segment) => sameCell(segment, position));
  }

  function isProtectedStart(cell, game) {
    const head = game.snake[0];
    const protectedMain = Math.abs(cell.x - head.x) <= 3 && Math.abs(cell.y - head.y) <= 2;

    if (protectedMain || !game.twinSnake || game.twinSnake.length === 0) {
      return protectedMain;
    }

    const twinHead = game.twinSnake[0];
    return Math.abs(cell.x - twinHead.x) <= 3 && Math.abs(cell.y - twinHead.y) <= 2;
  }

  function getEmptyCells(game, options) {
    const settings = options || {};
    const cells = [];

    for (let y = 0; y < game.rows; y += 1) {
      for (let x = 0; x < game.cols; x += 1) {
        const cell = { x, y };

        if (cellInList(game.snake, cell)) {
          continue;
        }

        if (settings.avoidTwin !== false && cellInList(game.twinSnake, cell)) {
          continue;
        }

        if (settings.avoidWalls !== false && cellInList(game.walls, cell)) {
          continue;
        }

        if (settings.avoidPortals !== false && cellInList(game.portals, cell)) {
          continue;
        }

        if (settings.avoidBonusFoods !== false && cellInList(game.bonusFoods, cell)) {
          continue;
        }

        if (settings.avoidHunter !== false && sameCell(game.hunter, cell)) {
          continue;
        }

        if (settings.avoidSafeBounds !== false && !isInsideSafeBounds(cell, game)) {
          continue;
        }

        if (settings.avoidFood && game.food && sameCell(game.food, cell)) {
          continue;
        }

        if (settings.protectStart && isProtectedStart(cell, game)) {
          continue;
        }

        cells.push(cell);
      }
    }

    return cells;
  }

  function pickRandomCell(cells, random) {
    if (cells.length === 0) {
      return null;
    }

    const index = Math.max(0, Math.min(cells.length - 1, Math.floor(random() * cells.length)));
    return cloneCell(cells[index]);
  }

  function buildWalls(game, count) {
    const cells = getEmptyCells(game, {
      avoidWalls: false,
      avoidPortals: false,
      avoidFood: true,
      protectStart: true,
    });
    const walls = [];

    while (walls.length < count && cells.length > 0) {
      const index = Math.max(0, Math.min(cells.length - 1, Math.floor(game.random() * cells.length)));
      walls.push(cloneCell(cells[index]));
      cells.splice(index, 1);
    }

    return walls;
  }

  function buildPortals(game) {
    const cells = getEmptyCells(game, {
      avoidWalls: true,
      avoidPortals: false,
      avoidFood: true,
      protectStart: true,
    });
    const first = pickRandomCell(cells, game.random);

    if (!first) {
      return [];
    }

    const remaining = cells.filter((cell) => !sameCell(cell, first));
    const second = pickRandomCell(remaining, game.random);

    return second ? [first, second] : [];
  }

  function buildHunter(game) {
    const cells = getEmptyCells(game, {
      avoidHunter: false,
      avoidFood: true,
      protectStart: true,
    });
    const head = game.snake[0];
    let bestDistance = -1;
    let candidates = [];

    cells.forEach((cell) => {
      const distance = Math.abs(cell.x - head.x) + Math.abs(cell.y - head.y);

      if (distance > bestDistance) {
        bestDistance = distance;
        candidates = [cell];
      } else if (distance === bestDistance) {
        candidates.push(cell);
      }
    });

    return pickRandomCell(candidates, game.random);
  }

  function placeFood(game) {
    const emptyCells = getEmptyCells(game, {
      avoidWalls: true,
      avoidPortals: true,
      avoidFood: false,
      avoidBonusFoods: true,
      avoidHunter: true,
      avoidTwin: true,
      avoidSafeBounds: true,
    });
    const food = pickRandomCell(emptyCells, game.random);

    if (!food) {
      game.food = null;
      game.status = "won";
      return null;
    }

    game.food = food;
    return game.food;
  }

  function spawnBonusFoods(game) {
    const mode = getModeConfig(game.modeId);
    const cells = getEmptyCells(game, {
      avoidWalls: true,
      avoidPortals: true,
      avoidFood: true,
      avoidBonusFoods: false,
      avoidHunter: true,
      avoidTwin: true,
      avoidSafeBounds: true,
    });
    const bonuses = [];

    game.bonusFoods = [];

    while (bonuses.length < mode.bonusCount && cells.length > 0) {
      const index = Math.max(0, Math.min(cells.length - 1, Math.floor(game.random() * cells.length)));
      bonuses.push({
        ...cloneCell(cells[index]),
        expiresAt: game.tick + mode.bonusLifetime,
      });
      cells.splice(index, 1);
    }

    game.bonusFoods = bonuses;
    return bonuses;
  }

  function expireBonusFoods(game) {
    if (!game.bonusFoods || game.bonusFoods.length === 0) {
      return;
    }

    game.bonusFoods = game.bonusFoods.filter((bonus) => bonus.expiresAt >= game.tick);
  }

  function findBonusFoodIndex(game, position) {
    if (game.modeId !== "chain") {
      return -1;
    }

    return (game.bonusFoods || []).findIndex((bonus) => sameCell(bonus, position));
  }

  function findPortalExit(game, position) {
    if (game.modeId !== "portal" || game.portals.length < 2) {
      return null;
    }

    if (sameCell(position, game.portals[0])) {
      return { from: cloneCell(game.portals[0]), to: cloneCell(game.portals[1]) };
    }

    if (sameCell(position, game.portals[1])) {
      return { from: cloneCell(game.portals[1]), to: cloneCell(game.portals[0]) };
    }

    return null;
  }

  function getStepInterval(game) {
    const mode = getModeConfig(game.modeId);

    if (game.modeId !== "rush") {
      return mode.baseInterval;
    }

    return Math.max(mode.minInterval, mode.baseInterval - game.speedLevel * mode.speedStep);
  }

  function applyScore(game) {
    const mode = getModeConfig(game.modeId);

    game.foodsEaten += 1;

    if (game.modeId === "rush") {
      const gap = game.lastEatTick === null ? Infinity : game.tick - game.lastEatTick;
      game.combo = gap <= mode.comboWindow ? Math.min(game.combo + 1, 9) : 1;
      game.speedLevel = Math.floor(game.foodsEaten / 3);
      game.lastEatTick = game.tick;
      return 10 + (game.combo - 1) * 5;
    }

    if (game.modeId === "chain") {
      game.combo = 1;
      game.lastEatTick = game.tick;
      return 10;
    }

    game.combo = 1;
    game.lastEatTick = game.tick;
    return 10;
  }

  function applyBonusScore(game) {
    const mode = getModeConfig(game.modeId);
    const gap = game.lastEatTick === null ? Infinity : game.tick - game.lastEatTick;

    game.combo = gap <= mode.comboWindow ? Math.min(game.combo + 1, 9) : 1;
    game.lastEatTick = game.tick;
    return mode.bonusPoints;
  }

  function expireCombo(game) {
    const mode = getModeConfig(game.modeId);

    if ((game.modeId !== "rush" && game.modeId !== "chain") || game.lastEatTick === null) {
      return;
    }

    if (game.tick - game.lastEatTick > mode.comboWindow) {
      game.combo = 0;
    }
  }

  function updateSafeBounds(game) {
    if (game.modeId !== "collapse" || !game.safeBounds) {
      return false;
    }

    const mode = getModeConfig(game.modeId);
    const nextInset = Math.min(mode.maxInset, Math.floor(game.foodsEaten / mode.shrinkEvery));
    const changed = nextInset !== game.safeBounds.inset;

    game.safeBounds.inset = nextInset;
    return changed;
  }

  function getCrashReason(position, collisionBody, game) {
    if (cellInList(game.walls, position)) {
      return "electric";
    }

    if (!isInsideSafeBounds(position, game)) {
      return "collapse";
    }

    if (sameCell(game.hunter, position)) {
      return "hunter";
    }

    if (isOutOfBounds(position, game)) {
      return "wall";
    }

    if (cellInList(collisionBody, position)) {
      return "body";
    }

    return "wall";
  }

  function crashGame(game, reason, cell) {
    game.status = "gameover";
    game.lastEvent = {
      type: "crash",
      reason,
      cell: cloneCell(cell),
      modeId: game.modeId,
    };
    expireCombo(game);
    return game;
  }

  function stepHunter(game) {
    const mode = getModeConfig(game.modeId);

    if (
      game.status !== "running" ||
      game.modeId !== "hunter" ||
      !game.hunter ||
      game.tick % mode.hunterMoveEvery !== 0
    ) {
      return false;
    }

    const head = game.snake[0];
    const dx = head.x - game.hunter.x;
    const dy = head.y - game.hunter.y;
    const nextHunter = cloneCell(game.hunter);

    if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
      nextHunter.x += dx > 0 ? 1 : -1;
    } else if (dy !== 0) {
      nextHunter.y += dy > 0 ? 1 : -1;
    } else if (dx !== 0) {
      nextHunter.x += dx > 0 ? 1 : -1;
    }

    game.hunter = nextHunter;
    game.bonusFoods = (game.bonusFoods || []).filter((bonus) => !sameCell(bonus, game.hunter));

    if (game.food && sameCell(game.food, game.hunter)) {
      game.food = null;
      placeFood(game);

      if (game.status !== "running") {
        return false;
      }
    }

    if (cellInList(game.snake, game.hunter)) {
      crashGame(game, "hunter", game.hunter);
      return true;
    }

    return false;
  }

  function finishRegularEat(game, eatenCell, portalMove) {
    const points = applyScore(game);
    let portalRelocated = false;
    let bonusSpawned = false;
    let safeInsetChanged = false;

    game.score += points;
    game.food = null;

    if (game.modeId === "chain") {
      bonusSpawned = spawnBonusFoods(game).length > 0;
    }

    if (game.modeId === "portal" && game.foodsEaten % getModeConfig("portal").relocateEvery === 0) {
      game.portals = buildPortals(game);
      portalRelocated = true;
    }

    if (game.modeId === "collapse") {
      safeInsetChanged = updateSafeBounds(game);
    }

    placeFood(game);

    game.lastEvent = {
      type: "eat",
      cell: eatenCell,
      points,
      combo: game.combo,
      speedLevel: game.speedLevel,
      modeId: game.modeId,
      portalRelocated,
      teleported: Boolean(portalMove),
      from: portalMove ? portalMove.from : null,
      to: portalMove ? portalMove.to : null,
      bonusSpawned,
      safeInsetChanged,
      hunterPulse: game.modeId === "hunter",
      safeInset: game.safeBounds ? game.safeBounds.inset : 0,
    };
  }

  function finishBonusEat(game, bonusIndex, eatenCell) {
    const points = applyBonusScore(game);

    game.bonusFoods.splice(bonusIndex, 1);
    game.score += points;
    game.lastEvent = {
      type: "bonus",
      cell: eatenCell,
      points,
      combo: game.combo,
      modeId: game.modeId,
    };
  }

  function getTwinCrashReason(nextHead, nextTwinHead, collisionBody, twinCollisionBody, game) {
    if (isOutOfBounds(nextHead, game) || isOutOfBounds(nextTwinHead, game)) {
      return "wall";
    }

    if (
      sameCell(nextHead, nextTwinHead) ||
      sameCell(nextHead, game.twinSnake[0]) ||
      sameCell(nextTwinHead, game.snake[0]) ||
      cellInList(twinCollisionBody, nextHead) ||
      cellInList(collisionBody, nextTwinHead)
    ) {
      return "twin";
    }

    if (cellInList(collisionBody, nextHead) || cellInList(twinCollisionBody, nextTwinHead)) {
      return "body";
    }

    return null;
  }

  function stepTwinGame(game) {
    game.lastEvent = null;
    consumeQueuedDirection(game);

    const nextHead = getNextHead(game);
    const nextTwinHead = getNextTwinHead(game);
    const willGrow = sameCell(nextHead, game.food) || sameCell(nextTwinHead, game.food);
    const collisionBody = willGrow ? game.snake : game.snake.slice(0, -1);
    const twinCollisionBody = willGrow ? game.twinSnake : game.twinSnake.slice(0, -1);

    game.direction = game.pendingDirection;
    game.tick += 1;

    const crashReason = getTwinCrashReason(nextHead, nextTwinHead, collisionBody, twinCollisionBody, game);

    if (crashReason) {
      return crashGame(game, crashReason, crashReason === "twin" ? nextTwinHead : nextHead);
    }

    game.snake.unshift(nextHead);
    game.twinSnake.unshift(nextTwinHead);

    if (willGrow) {
      const eatenCell = cloneCell(game.food);
      finishRegularEat(game, eatenCell, null);
    } else {
      game.snake.pop();
      game.twinSnake.pop();
      expireCombo(game);
    }

    return game;
  }

  function stepGame(game) {
    if (game.status !== "running") {
      return game;
    }

    if (game.modeId === "twin") {
      return stepTwinGame(game);
    }

    game.lastEvent = null;
    consumeQueuedDirection(game);
    game.tick += 1;
    expireBonusFoods(game);

    const rawNextHead = getNextHead(game);
    const portalMove = findPortalExit(game, rawNextHead);
    const nextHead = portalMove ? cloneCell(portalMove.to) : rawNextHead;
    const willGrow = sameCell(nextHead, game.food);
    const bonusIndex = findBonusFoodIndex(game, nextHead);
    const willEatBonus = bonusIndex >= 0;
    const collisionBody = willGrow ? game.snake : game.snake.slice(0, -1);

    game.direction = game.pendingDirection;

    if (
      cellInList(game.walls, nextHead) ||
      !isInsideSafeBounds(nextHead, game) ||
      sameCell(game.hunter, nextHead) ||
      isCollision(nextHead, collisionBody, game)
    ) {
      const reason = getCrashReason(nextHead, collisionBody, game);
      return crashGame(game, reason, nextHead);
    }

    game.snake.unshift(nextHead);

    if (willGrow) {
      finishRegularEat(game, cloneCell(game.food), portalMove);
    } else {
      game.snake.pop();

      if (willEatBonus) {
        finishBonusEat(game, bonusIndex, cloneCell(nextHead));
      } else {
        expireCombo(game);

        if (portalMove) {
          game.lastEvent = {
            type: "teleport",
            from: portalMove.from,
            to: portalMove.to,
            modeId: game.modeId,
          };
        }
      }
    }

    if (stepHunter(game)) {
      return game;
    }

    return game;
  }

  return {
    DIRECTIONS,
    OPPOSITE,
    MIRROR_DIRECTIONS,
    MODE_CONFIGS,
    MODE_SEQUENCE,
    createGame,
    setDirection,
    stepGame,
    restartGame,
    placeFood,
    isCollision,
    sameCell,
    cellInList,
    getEmptyCells,
    getModeConfig,
    getStepInterval,
    isInsideSafeBounds,
  };
});
