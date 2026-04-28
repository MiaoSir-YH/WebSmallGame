const assert = require("node:assert/strict");
const SnakeLogic = require("../snakeLogic.js");

function makeRandom(values) {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

function cellKey(cell) {
  return `${cell.x},${cell.y}`;
}

function assertFoodIsLegal(game) {
  if (!game.food) {
    return;
  }

  const occupied = new Set([
    ...game.snake.map(cellKey),
    ...(game.twinSnake || []).map(cellKey),
    ...(game.walls || []).map(cellKey),
    ...(game.portals || []).map(cellKey),
    ...(game.bonusFoods || []).map(cellKey),
    game.hunter ? cellKey(game.hunter) : null,
  ].filter(Boolean));

  assert.equal(occupied.has(cellKey(game.food)), false, `${game.modeId} food overlaps a blocked cell`);
  assert.equal(SnakeLogic.isInsideSafeBounds(game.food, game), true, `${game.modeId} food is outside safe bounds`);
}

function makeFilledSnake(cols, rows, food) {
  const cells = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (x === food.x && y === food.y) {
        continue;
      }

      cells.push({ x, y });
    }
  }

  return [{ x: food.x - 1, y: food.y }, ...cells.filter((cell) => !(cell.x === food.x - 1 && cell.y === food.y))];
}

function testAllModesCreateLegalFood() {
  assert.deepEqual(SnakeLogic.MODE_SEQUENCE, [
    "classic",
    "rush",
    "maze",
    "portal",
    "chain",
    "hunter",
    "collapse",
    "twin",
  ]);

  SnakeLogic.MODE_SEQUENCE.forEach((modeId) => {
    const game = SnakeLogic.createGame({
      cols: 24,
      rows: 24,
      modeId,
      random: makeRandom([0.1, 0.6, 0.9, 0.3]),
    });

    assert.equal(game.modeId, modeId);
    assert.equal(game.status, "running");
    assertFoodIsLegal(game);
  });
}

function testLegacyModesStillWork() {
  const rush = SnakeLogic.createGame({
    cols: 8,
    rows: 8,
    modeId: "rush",
    snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }],
    food: { x: 3, y: 2 },
    random: makeRandom([0.5]),
  });

  SnakeLogic.stepGame(rush);
  assert.equal(rush.score, 10);
  assert.equal(rush.foodsEaten, 1);
  assert.equal(rush.speedLevel, 0);
  assert.equal(rush.lastEvent.type, "eat");

  const maze = SnakeLogic.createGame({ cols: 12, rows: 12, modeId: "maze", random: makeRandom([0.2]) });
  assert.equal(maze.walls.length, SnakeLogic.getModeConfig("maze").wallCount);

  const portal = SnakeLogic.createGame({ cols: 12, rows: 12, modeId: "portal", random: makeRandom([0.2, 0.8]) });
  assert.equal(portal.portals.length, 2);
  assertFoodIsLegal(portal);
}

function testPortalEatStillReportsTeleportForProgression() {
  const portal = SnakeLogic.createGame({
    cols: 10,
    rows: 10,
    modeId: "portal",
    snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }],
    portals: [{ x: 3, y: 2 }, { x: 5, y: 2 }],
    food: { x: 5, y: 2 },
    random: makeRandom([0.7]),
  });

  SnakeLogic.stepGame(portal);
  assert.equal(portal.score, 10);
  assert.equal(portal.lastEvent.type, "eat");
  assert.equal(portal.lastEvent.teleported, true);
  assert.deepEqual(portal.lastEvent.from, { x: 3, y: 2 });
  assert.deepEqual(portal.lastEvent.to, { x: 5, y: 2 });
}

function testChainBonusScoringAndExpiry() {
  const chain = SnakeLogic.createGame({
    cols: 10,
    rows: 10,
    modeId: "chain",
    snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }],
    food: { x: 3, y: 2 },
    random: makeRandom([0.2, 0.4, 0.6, 0.8]),
  });

  SnakeLogic.stepGame(chain);
  assert.equal(chain.score, 10);
  assert.equal(chain.bonusFoods.length, 3);
  assert.equal(chain.lastEvent.bonusSpawned, true);
  assertFoodIsLegal(chain);

  const bonus = SnakeLogic.createGame({
    cols: 10,
    rows: 10,
    modeId: "chain",
    snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }],
    food: { x: 8, y: 8 },
    bonusFoods: [{ x: 3, y: 2, expiresAt: 8 }],
  });

  SnakeLogic.stepGame(bonus);
  assert.equal(bonus.score, 15);
  assert.equal(bonus.snake.length, 2);
  assert.equal(bonus.combo, 1);
  assert.equal(bonus.lastEvent.type, "bonus");

  const expired = SnakeLogic.createGame({
    cols: 10,
    rows: 10,
    modeId: "chain",
    snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }],
    food: { x: 8, y: 8 },
    bonusFoods: [{ x: 3, y: 2, expiresAt: 0 }],
  });

  SnakeLogic.stepGame(expired);
  assert.equal(expired.score, 0);
  assert.equal(expired.bonusFoods.length, 0);
}

function testHunterCollision() {
  const hunter = SnakeLogic.createGame({
    cols: 10,
    rows: 10,
    modeId: "hunter",
    snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }],
    hunter: { x: 3, y: 2 },
    food: { x: 8, y: 8 },
  });

  SnakeLogic.stepGame(hunter);
  assert.equal(hunter.status, "gameover");
  assert.equal(hunter.lastEvent.reason, "hunter");
}

function testCollapseBoundsAndShrink() {
  const crash = SnakeLogic.createGame({
    cols: 10,
    rows: 10,
    modeId: "collapse",
    snake: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
    direction: "left",
    safeBounds: { inset: 1, maxInset: 5 },
    food: { x: 8, y: 8 },
  });

  SnakeLogic.stepGame(crash);
  assert.equal(crash.status, "gameover");
  assert.equal(crash.lastEvent.reason, "collapse");

  const shrink = SnakeLogic.createGame({
    cols: 10,
    rows: 10,
    modeId: "collapse",
    snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }],
    food: { x: 3, y: 2 },
    foodsEaten: 3,
    safeBounds: { inset: 0, maxInset: 5 },
    random: makeRandom([0.6]),
  });

  SnakeLogic.stepGame(shrink);
  assert.equal(shrink.safeBounds.inset, 1);
  assert.equal(shrink.lastEvent.safeInsetChanged, true);
  assertFoodIsLegal(shrink);
}

function testTwinGrowthAndCrash() {
  const grow = SnakeLogic.createGame({
    cols: 12,
    rows: 8,
    modeId: "twin",
    snake: [{ x: 3, y: 3 }, { x: 2, y: 3 }],
    twinSnake: [{ x: 8, y: 3 }, { x: 9, y: 3 }],
    food: { x: 4, y: 3 },
    random: makeRandom([0.6]),
  });

  SnakeLogic.stepGame(grow);
  assert.equal(grow.score, 10);
  assert.equal(grow.snake.length, 3);
  assert.equal(grow.twinSnake.length, 3);
  assert.equal(grow.status, "running");
  assertFoodIsLegal(grow);

  const crash = SnakeLogic.createGame({
    cols: 10,
    rows: 8,
    modeId: "twin",
    snake: [{ x: 2, y: 3 }, { x: 1, y: 3 }],
    twinSnake: [{ x: 3, y: 3 }, { x: 4, y: 3 }],
    food: { x: 8, y: 6 },
  });

  SnakeLogic.stepGame(crash);
  assert.equal(crash.status, "gameover");
  assert.equal(crash.lastEvent.reason, "twin");
}

function testWinWhenFoodCannotRespawn() {
  const food = { x: 5, y: 5 };
  const game = SnakeLogic.createGame({
    cols: 6,
    rows: 6,
    modeId: "classic",
    snake: makeFilledSnake(6, 6, food),
    food,
  });

  SnakeLogic.stepGame(game);
  assert.equal(game.status, "won");
  assert.equal(game.food, null);
}

testAllModesCreateLegalFood();
testLegacyModesStillWork();
testPortalEatStillReportsTeleportForProgression();
testChainBonusScoringAndExpiry();
testHunterCollision();
testCollapseBoundsAndShrink();
testTwinGrowthAndCrash();
testWinWhenFoodCannotRespawn();

console.log("snakeLogic tests passed");
