(function attachWebSmallGameMiniGames(root, factory) {
  root.WebSmallGameMiniGames = factory();
})(typeof globalThis !== "undefined" ? globalThis : window, function buildWebSmallGameMiniGames() {
  const KEY_LEFT = 37;
  const KEY_UP = 38;
  const KEY_RIGHT = 39;
  const KEY_DOWN = 40;
  const MEMORY_KEYS = ["1", "2", "3", "4", "q", "w", "e", "t", "a", "s", "d", "g", "z", "x", "c", "b"];

  function clamp(value, minValue, maxValue) {
    return Math.max(minValue, Math.min(maxValue, value));
  }

  function overlapCircleRect(circle, rect) {
    const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
    const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
    const dx = circle.x - nearestX;
    const dy = circle.y - nearestY;
    return dx * dx + dy * dy <= circle.r * circle.r;
  }

  function formatCopy(template, values) {
    return String(template).replace(/\{(\w+)\}/g, (match, key) => (
      Object.prototype.hasOwnProperty.call(values || {}, key) ? values[key] : match
    ));
  }

  function copyText(env, key, values, fallback) {
    const template = env.copy && env.copy[key] ? env.copy[key] : fallback;
    return formatCopy(template, values);
  }

  function beginAreaClip(area) {
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(area.x, area.y, area.w, area.h);
    drawingContext.clip();
  }

  function endAreaClip() {
    drawingContext.restore();
  }

  function drawMiniFrame(env, area) {
    const { palette } = env;

    push();
    drawingContext.shadowBlur = 22;
    drawingContext.shadowColor = palette.cyan;
    stroke(palette.cyan);
    strokeWeight(2);
    fill(5, 6, 12, 198);
    rect(area.x, area.y, area.w, area.h, 8);

    drawingContext.shadowColor = palette.pink;
    stroke(palette.pink);
    strokeWeight(1);
    noFill();
    rect(area.x - 7, area.y - 7, area.w + 14, area.h + 14, 4);
    pop();
  }

  function toAreaPoint(area, x, y) {
    return {
      x: clamp((x - area.x) / area.w, 0, 1),
      y: clamp((y - area.y) / area.h, 0, 1),
    };
  }

  function emitEvent(state, event) {
    if (!state.events) {
      state.events = [];
    }

    state.events.push({
      intensity: 1,
      ...event,
    });
  }

  function cellEventPoint(index) {
    const col = index % 4;
    const row = Math.floor(index / 4);

    return {
      x: 0.225 + col * 0.183,
      y: 0.225 + row * 0.183,
    };
  }

  function createBreakout() {
    function createState() {
      const state = {
        status: "running",
        score: 0,
        lives: 3,
        paddleX: 0.5,
        ball: { x: 0.5, y: 0.72, vx: 0.28, vy: -0.38, r: 0.018 },
        bricks: [],
        lastNow: null,
        pointerActive: false,
        events: [],
      };

      reset(state);
      return state;
    }

    function reset(state) {
      state.status = "running";
      state.score = 0;
      state.lives = 3;
      state.paddleX = 0.5;
      state.ball = { x: 0.5, y: 0.72, vx: 0.28, vy: -0.38, r: 0.018 };
      state.bricks = [];
      state.lastNow = null;
      state.pointerActive = false;
      state.events = [];

      const rows = 5;
      const cols = 8;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          state.bricks.push({
            x: 0.08 + col * 0.108,
            y: 0.12 + row * 0.054,
            w: 0.086,
            h: 0.032,
            alive: true,
            points: 10 + row * 3,
          });
        }
      }
    }

    function update(state, env) {
      if (state.status !== "running") {
        state.lastNow = env.now;
        return;
      }

      const dt = state.lastNow ? clamp((env.now - state.lastNow) / 1000, 0, 0.033) : 0;
      state.lastNow = env.now;

      const left = env.isDown("a") || env.isDown(KEY_LEFT);
      const right = env.isDown("d") || env.isDown(KEY_RIGHT);
      const move = (right ? 1 : 0) - (left ? 1 : 0);
      state.paddleX = clamp(state.paddleX + move * dt * 0.9, 0.09, 0.91);

      const ball = state.ball;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x - ball.r <= 0 || ball.x + ball.r >= 1) {
        ball.vx *= -1;
        ball.x = clamp(ball.x, ball.r, 1 - ball.r);
        emitEvent(state, { type: "wall", x: ball.x, y: ball.y, tint: "cyan", intensity: 0.75 });
      }

      if (ball.y - ball.r <= 0) {
        ball.vy = Math.abs(ball.vy);
        ball.y = ball.r;
        emitEvent(state, { type: "wall", x: ball.x, y: ball.y, tint: "cyan", intensity: 0.75 });
      }

      const paddle = { x: state.paddleX - 0.095, y: 0.88, w: 0.19, h: 0.026 };
      if (ball.vy > 0 && overlapCircleRect(ball, paddle)) {
        const hit = clamp((ball.x - state.paddleX) / (paddle.w / 2), -1, 1);
        ball.vx = hit * 0.42;
        ball.vy = -Math.abs(ball.vy) - 0.012;
        ball.y = paddle.y - ball.r;
        emitEvent(state, { type: "paddle", x: ball.x, y: paddle.y, tint: "acid", intensity: 1.05 });
      }

      state.bricks.forEach((brick) => {
        if (!brick.alive || !overlapCircleRect(ball, brick)) {
          return;
        }

        brick.alive = false;
        state.score += brick.points;
        ball.vy *= -1;
        emitEvent(state, {
          type: "brick",
          x: brick.x + brick.w / 2,
          y: brick.y + brick.h / 2,
          points: brick.points,
          tint: "pink",
          intensity: 1.35,
        });
      });

      if (ball.y - ball.r > 1) {
        state.lives -= 1;
        emitEvent(state, { type: "miss", x: ball.x, y: 0.94, tint: "pink", intensity: 1.5 });

        if (state.lives <= 0) {
          state.status = "gameover";
          emitEvent(state, { type: "gameover", x: ball.x, y: 0.94, tint: "pink", intensity: 2 });
          return;
        }

        ball.x = 0.5;
        ball.y = 0.72;
        ball.vx = state.lives % 2 === 0 ? -0.28 : 0.28;
        ball.vy = -0.38;
      }

      if (state.bricks.every((brick) => !brick.alive)) {
        state.status = "won";
        emitEvent(state, { type: "won", x: ball.x, y: ball.y, tint: "acid", intensity: 2.2 });
      }
    }

    function render(state, env) {
      const { area, palette } = env;
      drawMiniFrame(env, area);

      push();
      beginAreaClip(area);

      state.bricks.forEach((brick, index) => {
        if (!brick.alive) {
          return;
        }

        const x = area.x + brick.x * area.w;
        const y = area.y + brick.y * area.h;
        const w = brick.w * area.w;
        const h = brick.h * area.h;
        const tint = index % 3 === 0 ? palette.acid : index % 3 === 1 ? palette.cyan : palette.pink;
        drawingContext.shadowBlur = 14;
        drawingContext.shadowColor = tint;
        stroke(tint);
        strokeWeight(1.2);
        fill(tint === palette.acid ? 150 : 0, tint === palette.pink ? 32 : 190, tint === palette.pink ? 180 : 255, 70);
        rect(x, y, w, h, 3);
      });

      const paddleW = area.w * 0.19;
      const paddleH = Math.max(10, area.h * 0.026);
      const paddleX = area.x + state.paddleX * area.w - paddleW / 2;
      const paddleY = area.y + area.h * 0.88;
      drawingContext.shadowBlur = 20;
      drawingContext.shadowColor = palette.acid;
      noStroke();
      fill(palette.acid);
      rect(paddleX, paddleY, paddleW, paddleH, 5);

      const ball = state.ball;
      drawingContext.shadowBlur = 22;
      drawingContext.shadowColor = palette.pink;
      fill(palette.pink);
      circle(area.x + ball.x * area.w, area.y + ball.y * area.h, Math.max(12, ball.r * area.w * 2));

      endAreaClip();
      pop();

      env.drawReadableText(copyText(env, "lives", { lives: state.lives }, "LIVES {lives}"), area.x + area.w - 16, area.y + 16, {
        align: "right",
        baseline: "top",
        size: env.compact ? 13 : 16,
        primary: palette.limeText,
        glow: palette.cyan,
      });
    }

    function pointerPressed(state, x, y, env) {
      pointerMoved(state, x, y, env);
    }

    function pointerMoved(state, x, y, env) {
      state.paddleX = toAreaPoint(env.area, x, y).x;
      state.pointerActive = true;
    }

    return {
      id: "breakout",
      createState,
      reset,
      update,
      render,
      pointerPressed,
      pointerMoved,
      keyPressed: () => false,
    };
  }

  function createDodge() {
    function createState() {
      const state = {
        status: "running",
        score: 0,
        player: { x: 0.5, y: 0.76, r: 0.025 },
        hazards: [],
        chip: null,
        target: null,
        startedAt: null,
        lastNow: null,
        nextSpawnAt: 0,
        chips: 0,
        events: [],
      };

      reset(state);
      return state;
    }

    function reset(state) {
      state.status = "running";
      state.score = 0;
      state.player = { x: 0.5, y: 0.76, r: 0.025 };
      state.hazards = [
        { x: 0.2, y: 0.18, vx: 0.18, vy: 0.22, r: 0.026 },
        { x: 0.78, y: 0.32, vx: -0.24, vy: 0.16, r: 0.023 },
        { x: 0.44, y: 0.52, vx: 0.2, vy: -0.2, r: 0.024 },
      ];
      state.chip = { x: 0.5, y: 0.36, r: 0.018 };
      state.target = null;
      state.startedAt = null;
      state.lastNow = null;
      state.nextSpawnAt = 0;
      state.chips = 0;
      state.events = [];
    }

    function update(state, env) {
      if (state.status !== "running") {
        state.lastNow = env.now;
        return;
      }

      if (!state.startedAt) {
        state.startedAt = env.now;
        state.nextSpawnAt = env.now + 1300;
      }

      const dt = state.lastNow ? clamp((env.now - state.lastNow) / 1000, 0, 0.033) : 0;
      state.lastNow = env.now;

      const dx = (env.isDown("d") || env.isDown(KEY_RIGHT) ? 1 : 0) - (env.isDown("a") || env.isDown(KEY_LEFT) ? 1 : 0);
      const dy = (env.isDown("s") || env.isDown(KEY_DOWN) ? 1 : 0) - (env.isDown("w") || env.isDown(KEY_UP) ? 1 : 0);

      if (state.target) {
        const tx = state.target.x - state.player.x;
        const ty = state.target.y - state.player.y;
        const distance = Math.hypot(tx, ty);
        if (distance > 0.006) {
          state.player.x += (tx / distance) * dt * 0.52;
          state.player.y += (ty / distance) * dt * 0.52;
        }
      }

      if (dx || dy) {
        const length = Math.hypot(dx, dy) || 1;
        state.player.x += (dx / length) * dt * 0.55;
        state.player.y += (dy / length) * dt * 0.55;
        state.target = null;
      }

      state.player.x = clamp(state.player.x, state.player.r, 1 - state.player.r);
      state.player.y = clamp(state.player.y, state.player.r, 1 - state.player.r);

      state.hazards.forEach((hazard) => {
        hazard.x += hazard.vx * dt;
        hazard.y += hazard.vy * dt;

        if (hazard.x - hazard.r < 0 || hazard.x + hazard.r > 1) {
          hazard.vx *= -1;
          hazard.x = clamp(hazard.x, hazard.r, 1 - hazard.r);
        }

        if (hazard.y - hazard.r < 0 || hazard.y + hazard.r > 1) {
          hazard.vy *= -1;
          hazard.y = clamp(hazard.y, hazard.r, 1 - hazard.r);
        }
      });

      if (env.now >= state.nextSpawnAt && state.hazards.length < 9) {
        const edge = state.hazards.length % 4;
        const speed = 0.18 + state.hazards.length * 0.018;
        const hazard = {
          x: edge === 0 ? 0.05 : edge === 1 ? 0.95 : 0.2 + Math.random() * 0.6,
          y: edge === 2 ? 0.05 : edge === 3 ? 0.95 : 0.2 + Math.random() * 0.6,
          vx: (Math.random() > 0.5 ? 1 : -1) * speed,
          vy: (Math.random() > 0.5 ? 1 : -1) * speed,
          r: 0.02 + Math.random() * 0.012,
        };

        state.hazards.push(hazard);
        emitEvent(state, { type: "spawn", x: hazard.x, y: hazard.y, tint: "cyan", intensity: 1.05 });
        state.nextSpawnAt = env.now + 1600;
      }

      state.hazards.forEach((hazard) => {
        const distance = Math.hypot(hazard.x - state.player.x, hazard.y - state.player.y);
        if (state.status === "running" && distance < hazard.r + state.player.r) {
          state.status = "gameover";
          emitEvent(state, { type: "crash", x: state.player.x, y: state.player.y, tint: "pink", intensity: 2.15 });
        }
      });

      if (state.status !== "running") {
        return;
      }

      if (state.chip) {
        const chipDistance = Math.hypot(state.chip.x - state.player.x, state.chip.y - state.player.y);
        if (chipDistance < state.chip.r + state.player.r) {
          const chip = state.chip;
          state.chips += 1;
          state.score += 25;
          emitEvent(state, { type: "chip", x: chip.x, y: chip.y, points: 25, tint: "acid", intensity: 1.45 });
          state.chip = {
            x: 0.08 + Math.random() * 0.84,
            y: 0.08 + Math.random() * 0.84,
            r: 0.018,
          };
        }
      }

      const survivalScore = Math.floor((env.now - state.startedAt) / 200);
      state.score = Math.max(state.score, survivalScore + state.chips * 25);

      if (state.score >= 300) {
        state.status = "won";
        emitEvent(state, { type: "won", x: state.player.x, y: state.player.y, tint: "acid", intensity: 2.2 });
      }
    }

    function render(state, env) {
      const { area, palette } = env;
      drawMiniFrame(env, area);

      push();
      beginAreaClip(area);

      state.hazards.forEach((hazard, index) => {
        const x = area.x + hazard.x * area.w;
        const y = area.y + hazard.y * area.h;
        const size = Math.max(16, hazard.r * area.w * 2);
        drawingContext.shadowBlur = 18;
        drawingContext.shadowColor = index % 2 === 0 ? palette.pink : palette.cyan;
        stroke(index % 2 === 0 ? palette.pink : palette.cyan);
        strokeWeight(2);
        noFill();
        circle(x, y, size);
        line(x - size * 0.32, y, x + size * 0.32, y);
        line(x, y - size * 0.32, x, y + size * 0.32);
      });

      if (state.chip) {
        const x = area.x + state.chip.x * area.w;
        const y = area.y + state.chip.y * area.h;
        drawingContext.shadowBlur = 22;
        drawingContext.shadowColor = palette.acid;
        noStroke();
        fill(palette.acid);
        rectMode(CENTER);
        rect(x, y, 16, 16, 4);
        rectMode(CORNER);
      }

      const player = state.player;
      drawingContext.shadowBlur = 26;
      drawingContext.shadowColor = palette.cyan;
      stroke(palette.white);
      strokeWeight(2);
      fill(palette.cyan);
      rectMode(CENTER);
      rect(area.x + player.x * area.w, area.y + player.y * area.h, 24, 24, 5);
      rectMode(CORNER);

      endAreaClip();
      pop();

      env.drawReadableText(copyText(env, "chips", { chips: state.chips }, "CHIPS {chips}"), area.x + 16, area.y + 16, {
        align: "left",
        baseline: "top",
        size: env.compact ? 13 : 16,
        primary: palette.limeText,
        glow: palette.cyan,
      });
    }

    function pointerPressed(state, x, y, env) {
      pointerMoved(state, x, y, env);
    }

    function pointerMoved(state, x, y, env) {
      state.target = toAreaPoint(env.area, x, y);
    }

    return {
      id: "dodge",
      createState,
      reset,
      update,
      render,
      pointerPressed,
      pointerMoved,
      keyPressed: () => false,
    };
  }

  function createMemory() {
    function createState() {
      const state = {
        status: "running",
        score: 0,
        round: 1,
        sequence: [],
        phase: "show",
        showIndex: 0,
        litCell: null,
        inputIndex: 0,
        nextAt: 0,
        lastNow: null,
        events: [],
      };

      reset(state);
      return state;
    }

    function reset(state) {
      state.status = "running";
      state.score = 0;
      state.round = 1;
      state.sequence = [randomCell()];
      state.phase = "show";
      state.showIndex = 0;
      state.litCell = null;
      state.inputIndex = 0;
      state.nextAt = 0;
      state.lastNow = null;
      state.events = [];
    }

    function randomCell() {
      return Math.floor(Math.random() * 16);
    }

    function startShow(state, now) {
      state.phase = "show";
      state.showIndex = 0;
      state.inputIndex = 0;
      state.litCell = null;
      state.nextAt = now + 260;
    }

    function update(state, env) {
      if (state.status !== "running") {
        return;
      }

      if (!state.nextAt) {
        startShow(state, env.now);
      }

      if (state.phase === "input" && state.litCell !== null && env.now >= state.nextAt) {
        state.litCell = null;
        return;
      }

      if (state.phase !== "show" || env.now < state.nextAt) {
        return;
      }

      if (state.litCell === null && state.showIndex < state.sequence.length) {
        state.litCell = state.sequence[state.showIndex];
        state.nextAt = env.now + 520;
        emitEvent(state, {
          type: "show",
          ...cellEventPoint(state.litCell),
          tint: "cyan",
          intensity: 0.8,
        });
        return;
      }

      if (state.litCell !== null) {
        state.litCell = null;
        state.showIndex += 1;
        state.nextAt = env.now + 170;
        return;
      }

      state.phase = "input";
      state.inputIndex = 0;
    }

    function render(state, env) {
      const { area, palette } = env;
      drawMiniFrame(env, area);

      const gridSize = Math.min(area.w, area.h) * 0.74;
      const cellGap = Math.max(8, gridSize * 0.035);
      const cellSize = (gridSize - cellGap * 3) / 4;
      const startX = area.x + (area.w - gridSize) / 2;
      const startY = area.y + (area.h - gridSize) / 2 + (env.compact ? 10 : 18);
      const active = state.litCell;

      env.drawReadableText(state.phase === "show" ? copyText(env, "watch", null, "WATCH") : copyText(env, "repeat", null, "REPEAT"), area.x + area.w / 2, area.y + 20, {
        size: env.compact ? 16 : 20,
        primary: palette.limeText,
        glow: palette.cyan,
      });

      for (let index = 0; index < 16; index += 1) {
        const col = index % 4;
        const row = Math.floor(index / 4);
        const x = startX + col * (cellSize + cellGap);
        const y = startY + row * (cellSize + cellGap);
        const isActive = index === active;
        const tint = index % 2 === 0 ? palette.cyan : palette.pink;

        drawingContext.shadowBlur = isActive ? 28 : 10;
        drawingContext.shadowColor = isActive ? palette.acid : tint;
        stroke(isActive ? palette.acid : tint);
        strokeWeight(isActive ? 3 : 1.4);
        fill(isActive ? palette.acid : colorWithAlpha(tint, 44));
        rect(x, y, cellSize, cellSize, 7);
      }

      env.drawReadableText(copyText(env, "round", { round: state.round }, "ROUND {round} / 8"), area.x + area.w / 2, area.y + area.h - 34, {
        size: env.compact ? 14 : 18,
        primary: palette.limeText,
        glow: palette.pink,
      });
    }

    function pointerPressed(state, x, y, env) {
      if (state.status !== "running" || state.phase !== "input") {
        return;
      }

      const cell = cellFromPoint(env.area, x, y, env.compact);
      if (cell === null) {
        return;
      }

      state.litCell = cell;
      state.nextAt = env.now + 140;

      if (cell !== state.sequence[state.inputIndex]) {
        state.status = "gameover";
        emitEvent(state, { type: "wrong", ...cellEventPoint(cell), tint: "pink", intensity: 2 });
        return;
      }

      state.inputIndex += 1;
      state.score += 5;
      emitEvent(state, { type: "correct", ...cellEventPoint(cell), points: 5, tint: "acid", intensity: 1.1 });

      if (state.inputIndex < state.sequence.length) {
        return;
      }

      state.score += state.round * 10;
      state.round += 1;

      if (state.round > 8) {
        state.status = "won";
        emitEvent(state, { type: "won", x: 0.5, y: 0.5, tint: "acid", intensity: 2.25 });
        return;
      }

      emitEvent(state, { type: "round", x: 0.5, y: 0.5, points: (state.round - 1) * 10, tint: "cyan", intensity: 1.45 });
      state.sequence.push(randomCell());
      startShow(state, env.now + 300);
    }

    function cellFromPoint(area, x, y, compact) {
      const gridSize = Math.min(area.w, area.h) * 0.74;
      const cellGap = Math.max(8, gridSize * 0.035);
      const cellSize = (gridSize - cellGap * 3) / 4;
      const startX = area.x + (area.w - gridSize) / 2;
      const startY = area.y + (area.h - gridSize) / 2 + (compact ? 10 : 18);

      for (let index = 0; index < 16; index += 1) {
        const col = index % 4;
        const row = Math.floor(index / 4);
        const cellX = startX + col * (cellSize + cellGap);
        const cellY = startY + row * (cellSize + cellGap);

        if (x >= cellX && x <= cellX + cellSize && y >= cellY && y <= cellY + cellSize) {
          return index;
        }
      }

      return null;
    }

    function keyPressed(state, keyName, keyCode, env) {
      const cell = MEMORY_KEYS.indexOf(keyName);
      if (cell < 0) {
        return false;
      }

      const point = pointForCell(env.area, cell, env.compact);
      pointerPressed(state, point.x, point.y, env);
      return true;
    }

    function pointForCell(area, index, compact) {
      const gridSize = Math.min(area.w, area.h) * 0.74;
      const cellGap = Math.max(8, gridSize * 0.035);
      const cellSize = (gridSize - cellGap * 3) / 4;
      const startX = area.x + (area.w - gridSize) / 2;
      const startY = area.y + (area.h - gridSize) / 2 + (compact ? 10 : 18);
      const col = index % 4;
      const row = Math.floor(index / 4);

      return {
        x: startX + col * (cellSize + cellGap) + cellSize / 2,
        y: startY + row * (cellSize + cellGap) + cellSize / 2,
      };
    }

    return {
      id: "memory",
      createState,
      reset,
      update,
      render,
      pointerPressed,
      pointerMoved: () => false,
      keyPressed,
    };
  }

  return {
    breakout: createBreakout(),
    dodge: createDodge(),
    memory: createMemory(),
  };
});
