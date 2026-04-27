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

  const MAX_DIRECTION_QUEUE = 4;
  const MODE_SEQUENCE = ["classic", "rush", "maze", "portal"];

  const MODE_CONFIGS = {
    classic: {
      id: "classic",
      number: 1,
      title: "经典模式",
      tagline: "纯粹贪吃蛇，压力拉满。",
      baseInterval: 125,
      minInterval: 125,
    },
    rush: {
      id: "rush",
      number: 2,
      title: "霓虹疾行",
      tagline: "每吃 3 个食物都会提速。",
      baseInterval: 135,
      minInterval: 70,
      speedStep: 12,
      comboWindow: 12,
    },
    maze: {
      id: "maze",
      number: 3,
      title: "电路迷宫",
      tagline: "电墙会惩罚草率转向。",
      baseInterval: 125,
      minInterval: 125,
      wallCount: 22,
    },
    portal: {
      id: "portal",
      number: 4,
      title: "传送漂移",
      tagline: "双门传送改写棋盘。",
      baseInterval: 120,
      minInterval: 120,
      relocateEvery: 5,
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

  function createGame(options) {
    const settings = options || {};
    const cols = Math.max(6, Math.floor(settings.cols || 24));
    const rows = Math.max(6, Math.floor(settings.rows || 24));
    const mode = getModeConfig(settings.modeId);
    const direction = normalizeDirection(settings.direction) || "right";
    const random = typeof settings.random === "function" ? settings.random : Math.random;

    const game = {
      cols,
      rows,
      modeId: mode.id,
      snake: settings.snake ? cloneCells(settings.snake) : buildStartingSnake(cols, rows),
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

  function getNextHead(game) {
    const movement = DIRECTIONS[game.pendingDirection];
    const head = game.snake[0];

    return {
      x: head.x + movement.x,
      y: head.y + movement.y,
    };
  }

  function isOutOfBounds(position, bounds) {
    return (
      position.x < 0 ||
      position.y < 0 ||
      position.x >= bounds.cols ||
      position.y >= bounds.rows
    );
  }

  function isCollision(position, snake, bounds) {
    return isOutOfBounds(position, bounds) || snake.some((segment) => sameCell(segment, position));
  }

  function isProtectedStart(cell, game) {
    const head = game.snake[0];

    return Math.abs(cell.x - head.x) <= 3 && Math.abs(cell.y - head.y) <= 2;
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

        if (settings.avoidWalls !== false && cellInList(game.walls, cell)) {
          continue;
        }

        if (settings.avoidPortals !== false && cellInList(game.portals, cell)) {
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

  function placeFood(game) {
    const emptyCells = getEmptyCells(game, {
      avoidWalls: true,
      avoidPortals: true,
      avoidFood: false,
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

    game.combo = 1;
    game.lastEatTick = game.tick;
    return 10;
  }

  function expireRushCombo(game) {
    const mode = getModeConfig(game.modeId);

    if (game.modeId !== "rush" || game.lastEatTick === null) {
      return;
    }

    if (game.tick - game.lastEatTick > mode.comboWindow) {
      game.combo = 0;
    }
  }

  function getCrashReason(position, collisionBody, game) {
    if (cellInList(game.walls, position)) {
      return "electric";
    }

    if (isOutOfBounds(position, game)) {
      return "wall";
    }

    if (cellInList(collisionBody, position)) {
      return "body";
    }

    return "wall";
  }

  function stepGame(game) {
    if (game.status !== "running") {
      return game;
    }

    game.lastEvent = null;
    consumeQueuedDirection(game);

    const rawNextHead = getNextHead(game);
    const portalMove = findPortalExit(game, rawNextHead);
    const nextHead = portalMove ? cloneCell(portalMove.to) : rawNextHead;
    const willGrow = sameCell(nextHead, game.food);
    const collisionBody = willGrow ? game.snake : game.snake.slice(0, -1);

    game.direction = game.pendingDirection;
    game.tick += 1;

    if (cellInList(game.walls, nextHead) || isCollision(nextHead, collisionBody, game)) {
      const reason = getCrashReason(nextHead, collisionBody, game);

      game.status = "gameover";
      game.lastEvent = {
        type: "crash",
        reason,
        cell: cloneCell(nextHead),
        modeId: game.modeId,
      };
      expireRushCombo(game);
      return game;
    }

    game.snake.unshift(nextHead);

    if (willGrow) {
      const eatenCell = cloneCell(game.food);
      const points = applyScore(game);
      let portalRelocated = false;

      game.score += points;
      game.food = null;

      if (game.modeId === "portal" && game.foodsEaten % getModeConfig("portal").relocateEvery === 0) {
        game.portals = buildPortals(game);
        portalRelocated = true;
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
      };
    } else {
      game.snake.pop();
      expireRushCombo(game);

      if (portalMove) {
        game.lastEvent = {
          type: "teleport",
          from: portalMove.from,
          to: portalMove.to,
          modeId: game.modeId,
        };
      }
    }

    return game;
  }

  return {
    DIRECTIONS,
    OPPOSITE,
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
  };
});
