(function () {
  let state = createInitialState();
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");

  const TICK_MS = 1000; // 60 ticks/day => ~60s per day
  const ui = { tool: "walk", hoverTile: null, pendingPlace: null, queuedInteraction: null };
  let walkPath = [];
  let walkTimer = 0;

  const el = {
    dayCounter: document.getElementById("dayCounter"),
    clockFill: document.getElementById("clockFill"),
    clockLabel: document.getElementById("clockLabel"),
    staminaFill: document.getElementById("staminaFill"),
    staminaLabel: document.getElementById("staminaLabel"),
    crisisBanner: document.getElementById("crisisBanner"),
    gauges: document.getElementById("gauges"),
    advice: document.getElementById("advice"),
    log: document.getElementById("log"),
    hint: document.getElementById("hint"),
    triPathModal: document.getElementById("triPathModal"),
    triPathTitle: document.getElementById("triPathTitle"),
    endScreen: document.getElementById("endScreen"),
    endTitle: document.getElementById("endTitle"),
    endBody: document.getElementById("endBody"),
  };

  function hint(msg, ms) {
    el.hint.textContent = msg || "";
    if (ms) setTimeout(() => { if (el.hint.textContent === msg) el.hint.textContent = ""; }, ms);
  }

  function renderHud() {
    el.dayCounter.textContent = `Day ${Math.min(state.day, state.totalDays)} / ${state.totalDays}`;
    const frac = state.tick / state.ticksPerDay;
    el.clockFill.style.width = `${Math.round(frac * 100)}%`;
    el.clockLabel.textContent = isDaytime(state) ? (frac < 0.4 ? "morning" : "afternoon") : "night";
    el.clockFill.style.background = isDaytime(state) ? "" : "linear-gradient(90deg,#3a4a63,#1d2740)";
    const spct = Math.round((state.stamina / state.staminaMax) * 100);
    el.staminaFill.style.width = spct + "%";
    el.staminaLabel.textContent = `${state.stamina} / ${state.staminaMax} stamina`;

    const obj = document.getElementById("objectives");
    obj.innerHTML = "";
    stoneObjectives(state).forEach((step) => {
      const li = document.createElement("li");
      li.textContent = (step.done ? "✔ " : step.current ? "▶ " : "· ") + step.label;
      li.className = step.done ? "done" : step.current ? "current" : "";
      obj.appendChild(li);
    });

    el.gauges.innerHTML = "";
    stoneGauges(state).forEach((g) => {
      const l = document.createElement("div");
      l.className = "gauge-label";
      l.textContent = g.label;
      const v = document.createElement("div");
      v.className = "gauge-value";
      v.textContent = g.value;
      el.gauges.appendChild(l);
      el.gauges.appendChild(v);
    });

    el.advice.textContent = stoneAdvice(state);

    el.log.innerHTML = "";
    state.log.slice(0, 14).forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      el.log.appendChild(li);
    });

    if (state.lastCrisis && state.lastCrisis !== renderHud._shownCrisis) {
      renderHud._shownCrisis = state.lastCrisis;
      el.crisisBanner.textContent = `⚠ ${state.lastCrisis.name} — ${state.lastCrisis.detail}`;
      el.crisisBanner.classList.remove("hidden");
      setTimeout(() => el.crisisBanner.classList.add("hidden"), 5000);
    }

    if (state.gameOver && el.endScreen.classList.contains("hidden")) {
      el.endScreen.classList.remove("hidden");
      el.endTitle.textContent = state.win ? "The Loop Held" : "The Household Fell Behind";
      el.endBody.textContent = state.win
        ? `You closed the Bottle Loop ${state.loopClosedCount} time(s). The dump fed the grid, the grid fed the garden, the garden fed the family. Every backyard can become a small utility.`
        : state.loopClosedCount > 0
          ? "The loop closed, but not soon enough or strong enough to carry the family through."
          : "The family went hungry before the loop could carry them. Power first, then production — and watch the pantry.";
    }
  }

  // --- Walking (one tile per walkTimer interval, engine tile is authoritative) ---
  function setWalkTarget(tx, ty, onArrive) {
    const path = findPath(state, state.tyler.x, state.tyler.y, tx, ty);
    if (path === null) { hint("Can't get there.", 1500); return false; }
    walkPath = path;
    ui.queuedInteraction = onArrive || null;
    return true;
  }

  function stepWalk() {
    if (walkPath.length === 0) {
      if (ui.queuedInteraction) {
        const act = ui.queuedInteraction;
        ui.queuedInteraction = null;
        act();
      }
      return;
    }
    const next = walkPath.shift();
    if (isBlocked(state, next.x, next.y)) { // something got built in the way
      walkPath = [];
      ui.queuedInteraction = null;
      return;
    }
    state.tyler.x = next.x;
    state.tyler.y = next.y;
  }

  // --- Input ---
  function canvasTile(evt) {
    const rect = canvas.getBoundingClientRect();
    const sx = (evt.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (evt.clientY - rect.top) * (canvas.height / rect.height);
    return screenToIso(sx, sy - 8); // slight bias toward tile tops
  }

  canvas.addEventListener("mousemove", (evt) => {
    ui.hoverTile = canvasTile(evt);
  });

  canvas.addEventListener("click", (evt) => {
    if (state.gameOver) return;
    const t = canvasTile(evt);
    if (!inBounds(t.x, t.y)) return;

    if (ui.tool === "walk") {
      handleWalkClick(t);
    } else if (ui.tool === "wire") {
      const r = placeWire(state, t.x, t.y);
      if (!r.ok) hint(r.reason, 1800);
      renderHud();
    } else {
      // placing an object
      const def = OBJECT_DEFS[ui.tool];
      if (!isPlaceable(state, t.x, t.y)) { hint("Can't place there.", 1500); return; }
      if (def.triPath) {
        ui.pendingPlace = { type: ui.tool, x: t.x, y: t.y };
        el.triPathTitle.textContent = `Build the ${def.label}`;
        el.triPathModal.classList.remove("hidden");
      } else {
        const r = placeObject(state, ui.tool, t.x, t.y, null);
        if (!r.ok) hint(r.reason, 1800);
        else spawnBurst(t.x, t.y, "#f2c14e");
        renderHud();
      }
    }
  });

  // walk to the gate, then run an action there (dump trip / share food)
  function goGateThen(action) {
    const gx = GATE.x - 1, gy = GATE.y;
    const doIt = () => {
      const r = action();
      if (!r.ok) hint(r.reason, 2200);
      else spawnBurst(gx + 1, gy, "#c9c4b8");
      renderHud();
    };
    if (state.tyler.x === gx && state.tyler.y === gy) doIt();
    else if (!setWalkTarget(gx, gy, doIt)) hint("Can't reach the gate.", 1500);
  }

  function handleWalkClick(t) {
    // clicked the gate (or the fence line near it) → dump trip
    if (t.x >= GATE.x - 1 && Math.abs(t.y - GATE.y) <= 1 && t.x >= GRID_W - 2 && isFence(Math.min(t.x, GRID_W - 1), t.y)) {
      goGateThen(() => scavenge(state));
      return;
    }
    if (isGate(t.x, t.y)) {
      goGateThen(() => scavenge(state));
      return;
    }

    // clicked a machine → walk adjacent, then load it
    const obj = state.objects.find((o) => o.x === t.x && o.y === t.y);
    if (obj && OBJECT_DEFS[obj.type].kind === "machine") {
      const doStart = () => {
        const r = startMachine(state, obj.id);
        if (!r.ok) hint(r.reason, 2200);
        else spawnBurst(obj.x, obj.y, "#7a9a4f");
        renderHud();
      };
      if (Math.abs(state.tyler.x - obj.x) + Math.abs(state.tyler.y - obj.y) === 1) doStart();
      else {
        const spot = approach(state, obj.x, obj.y);
        if (!spot) { hint("Can't reach that machine.", 1500); return; }
        setWalkTarget(spot.x, spot.y, doStart);
      }
      return;
    }

    // clicked the house → sleep prompt via hint (sleep is the button)
    if (isHouse(t.x, t.y)) {
      hint("Home. Use 🌙 Sleep to end the day — machines keep running on battery.", 2500);
      return;
    }

    // plain walk
    if (!isBlocked(state, t.x, t.y)) setWalkTarget(t.x, t.y);
  }

  document.getElementById("btnDumpTrip").addEventListener("click", () => {
    if (state.gameOver) return;
    goGateThen(() => scavenge(state));
  });
  document.getElementById("btnShare").addEventListener("click", () => {
    if (state.gameOver) return;
    goGateThen(() => shareFood(state));
  });

  // toolbar
  document.querySelectorAll(".tool").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tool").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      ui.tool = btn.dataset.tool;
      const tips = {
        walk: "Click the yard to walk. Click a machine to load & run it. The gate leads to the dump.",
        wire: "Wires carry power. 1 bottle + 1 stamina each. Connect solar → battery → machines.",
        solar: "Solar makes power in daylight. 4 bottles.",
        battery: "Batteries store power for night. 3 bottles.",
        polyformer: "Bottles → filament. Must touch the powered network.",
        printer: "Filament → parts. Must touch the powered network.",
        farmbot: "Needs 1 printed part to build. Water + seed → food.",
        composter: "Waste → soil. Soil makes harvests bigger. Closes the loop.",
      };
      hint(tips[ui.tool] || "");
    });
  });

  // Tri-Path modal
  document.querySelectorAll(".path-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!ui.pendingPlace) return;
      const { type, x, y } = ui.pendingPlace;
      const r = placeObject(state, type, x, y, btn.dataset.path);
      if (!r.ok) hint(r.reason, 2200);
      else spawnBurst(x, y, "#f2c14e");
      ui.pendingPlace = null;
      el.triPathModal.classList.add("hidden");
      renderHud();
    });
  });
  document.getElementById("btnCancelPath").addEventListener("click", () => {
    ui.pendingPlace = null;
    el.triPathModal.classList.add("hidden");
  });

  document.getElementById("btnRounds").addEventListener("click", () => {
    if (state.gameOver) return;
    const r = runAllMachines(state);
    if (!r.ok) {
      hint(r.reason, 2200);
    } else {
      r.loaded.forEach((obj) => spawnBurst(obj.x, obj.y, "#7a9a4f"));
      hint(r.reason || `Loaded ${r.loaded.length} machine(s).`, 2200);
    }
    renderHud();
  });

  document.getElementById("btnSleep").addEventListener("click", () => {
    if (state.gameOver) return;
    sleepUntilMorning(state);
    walkPath = [];
    ui.queuedInteraction = null;
    renderHud();
  });

  document.getElementById("btnRestart").addEventListener("click", () => {
    state = createInitialState();
    walkPath = [];
    ui.queuedInteraction = null;
    renderHud._shownCrisis = null;
    el.endScreen.classList.add("hidden");
    renderHud();
  });

  // --- Loops ---
  setInterval(() => {
    if (!state.gameOver) {
      tickOnce(state);
      renderHud();
    }
  }, TICK_MS);

  setInterval(() => stepWalk(), 180); // walking pace: ~5.5 tiles/sec

  function frame() {
    drawScene(ctx, state, ui);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  renderHud();
  hint("This backyard is the whole plan. Take a 🧺 Dump Trip for bottles — it's a crap shoot until the block gets organized.");
})();
