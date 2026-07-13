/* FarmBotVille: Resilencity — core simulation (DOM-free, node-testable)
 *
 * 2.5D rebuild: the backyard is a tile grid. Tyler walks it. Machines are
 * placed objects that only run while connected to a powered network
 * (solar -> battery -> wires -> machines), Green-With-Energy style.
 * Resource names still mirror the real Pi MQTT topic tree (resilencity/tyler/...).
 */

// --- Grid: one fenced house lot. The dump is OFF-SCREEN (trips via the gate). ---
const GRID_W = 14;
const GRID_H = 10;
const HOUSE = { x: 1, y: 1, w: 4, h: 2 }; // fixed, blocked
const BARREL = { x: 6, y: 1 }; // rain barrel row against the back fence (blocked)
const GATE = { x: GRID_W - 1, y: 5 }; // gap in the east fence; dump trips start here

// --- Time ---
const TICKS_PER_DAY = 60;
const NIGHT_START = 45; // ticks >= this are night (solar off)
const TOTAL_DAYS = 12;

// --- Tri-Path (build quality) ---
const BUILD_PATHS = {
  hack: { label: "Scrap-Yard Hack", cost: 5, reliability: 0.75, outputMultiplier: 1.0 },
  ancestral: { label: "Ancestral Method", cost: 8, reliability: 1.0, outputMultiplier: 0.75 },
  compliant: { label: "Code-Compliant Build", cost: 12, reliability: 1.0, outputMultiplier: 1.0 },
};

// --- Placeable objects ---
// buildCost: resources consumed to place. staminaCost via Tri-Path for machines,
// flat for infrastructure. powerDraw is per-tick while running.
const OBJECT_DEFS = {
  solar: {
    label: "Solar Panel", kind: "power", buildCost: { bottles: 4 }, staminaCost: 4,
    powerOutput: 3, // per tick, daytime only
  },
  battery: {
    label: "Battery Bank", kind: "power", buildCost: { bottles: 3 }, staminaCost: 3,
    capacity: 30,
  },
  wire: {
    label: "Wire", kind: "wire", buildCost: { bottles: 1 }, staminaCost: 1,
  },
  polyformer: {
    label: "Polyformer", kind: "machine", buildCost: { bottles: 3 }, triPath: true,
    inputs: { bottles: 3 }, outputs: { filament: 2 }, powerDraw: 2, ticks: 8,
  },
  printer: {
    label: "3D Printer", kind: "machine", buildCost: { bottles: 3 }, triPath: true,
    inputs: { filament: 2 }, outputs: { parts: 1 }, powerDraw: 2, ticks: 8,
  },
  farmbot: {
    label: "FarmBot", kind: "machine", buildCost: { parts: 1 }, triPath: true,
    inputs: { water: 2, seed: 1 }, outputs: { crop: 4, seed: 1 }, powerDraw: 1, ticks: 20,
    soilBonus: true, // +1 crop if 1 soil available (consumed)
  },
  composter: {
    label: "Composter", kind: "machine", buildCost: { bottles: 2 }, triPath: true,
    inputs: { waste: 2 }, outputs: { soil: 1 }, powerDraw: 0, ticks: 12,
    closesLoop: true,
  },
};

const CRISIS_STAGES = [
  { day: 1, name: "Month 1: Inflation", detail: "Prices double. Scavenging costs +1 stamina.", applied: false },
  { day: 3, name: "Month 2: Layoffs", detail: "Income stops. Daily stamina drops to 20.", applied: false },
  { day: 5, name: "Month 3: SNAP Cut", detail: "The safety net fails. The family needs 4 food/day.", applied: false },
  { day: 8, name: "Month 6: Delivery Isolation", detail: "Trucks stop. Dump pickings are halved.", applied: false },
];

const RESOURCE_PATHS = {
  bottles: "waste/bottles",
  filament: "waste/filament",
  parts: "waste/parts",
  waste: "waste/waste",
  soil: "waste/soil",
  water: "water/barrel",
  seed: "food/seed",
  crop: "food/crop",
  pantry: "food/pantry",
  hungryNights: "food/hungryNights",
};

function res(state, key) {
  return state[`resilencity/tyler/${RESOURCE_PATHS[key] || key}`];
}
function addRes(state, key, amount) {
  state[`resilencity/tyler/${RESOURCE_PATHS[key] || key}`] += amount;
}
function canAfford(state, costs) {
  return Object.entries(costs).every(([k, v]) => res(state, k) >= v);
}
function payCosts(state, costs) {
  Object.entries(costs).forEach(([k, v]) => addRes(state, k, -v));
}

function createInitialState() {
  return {
    day: 1,
    totalDays: TOTAL_DAYS,
    tick: 0, // tick within the day
    ticksPerDay: TICKS_PER_DAY,
    nightStart: NIGHT_START,

    staminaMax: 24,
    stamina: 24,
    pantryDrain: 3, // Tyler + grandparents

    "resilencity/tyler/waste/bottles": 0,
    "resilencity/tyler/waste/filament": 0,
    "resilencity/tyler/waste/parts": 0,
    "resilencity/tyler/waste/waste": 2,
    "resilencity/tyler/waste/soil": 0,
    "resilencity/tyler/water/barrel": 6,
    "resilencity/tyler/food/seed": 6,
    "resilencity/tyler/food/crop": 0,
    "resilencity/tyler/food/pantry": 18,
    "resilencity/tyler/food/hungryNights": 0,

    objects: [], // {id,type,x,y,path,state:'idle'|'running'|'nopower',progress,charge}
    wires: {}, // "x,y" -> true
    nextId: 1,

    tyler: { x: 6, y: 5 }, // authoritative tile (rendering interpolates)

    community: 0,
    _tier2Announced: false,
    stats: { filamentMade: 0, partsMade: 0 },
    scavengeCostBonus: 0,
    scavengeYieldMultiplier: 1.0,

    crisisStages: CRISIS_STAGES.map((s) => ({ ...s })),
    harvestedOnce: false,
    loopClosedCount: 0,
    gameOver: false,
    win: false,
    log: [],
    lastCrisis: null,
  };
}

function logEvent(state, msg) {
  state.log.unshift(`Day ${state.day}: ${msg}`);
  if (state.log.length > 60) state.log.pop();
}

// --- Grid helpers ---
function inBounds(x, y) {
  return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
}
function isFence(x, y) {
  // border ring is the fence; the gate tile is part of it (interactable, not walkable)
  return x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1;
}
function isGate(x, y) {
  return x === GATE.x && y === GATE.y;
}
function isHouse(x, y) {
  return x >= HOUSE.x && x < HOUSE.x + HOUSE.w && y >= HOUSE.y && y < HOUSE.y + HOUSE.h;
}
function isBarrel(x, y) {
  return x === BARREL.x && y === BARREL.y;
}
function objectAt(state, x, y) {
  return state.objects.find((o) => o.x === x && o.y === y) || null;
}
function isBlocked(state, x, y) {
  if (!inBounds(x, y)) return true;
  if (isFence(x, y) || isHouse(x, y) || isBarrel(x, y)) return true;
  return !!objectAt(state, x, y);
}
function isPlaceable(state, x, y) {
  return inBounds(x, y) && !isFence(x, y) && !isHouse(x, y) && !isBarrel(x, y) &&
    !objectAt(state, x, y) && !state.wires[`${x},${y}`] &&
    !(state.tyler.x === x && state.tyler.y === y);
}
function adjacent(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}
function tylerAdjacentTo(state, x, y) {
  return adjacent(state.tyler.x, state.tyler.y, x, y);
}

// BFS pathfinding for Tyler; returns array of {x,y} steps (excluding start) or null
function findPath(state, fromX, fromY, toX, toY) {
  if (fromX === toX && fromY === toY) return [];
  const key = (x, y) => `${x},${y}`;
  const prev = { [key(fromX, fromY)]: null };
  const queue = [[fromX, fromY]];
  while (queue.length) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (key(nx, ny) in prev) continue;
      if (nx === toX && ny === toY) {
        // allow ending on the target even if blocked? No — caller passes walkable target
        if (isBlocked(state, nx, ny)) continue;
        prev[key(nx, ny)] = key(cx, cy);
        const path = [];
        let cur = key(nx, ny);
        while (cur && cur !== key(fromX, fromY)) {
          const [px, py] = cur.split(",").map(Number);
          path.unshift({ x: px, y: py });
          cur = prev[cur];
        }
        return path;
      }
      if (isBlocked(state, nx, ny)) continue;
      prev[key(nx, ny)] = key(cx, cy);
      queue.push([nx, ny]);
    }
  }
  return null;
}

// Nearest walkable tile adjacent to (x,y), reachable from Tyler; returns {x,y,path} or null
function approach(state, x, y) {
  let best = null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ax = x + dx, ay = y + dy;
    if (isBlocked(state, ax, ay) && !(state.tyler.x === ax && state.tyler.y === ay)) continue;
    const path = findPath(state, state.tyler.x, state.tyler.y, ax, ay);
    if (path !== null && (best === null || path.length < best.path.length)) {
      best = { x: ax, y: ay, path };
    }
  }
  return best;
}

// --- Power network (the Green-With-Energy heart) ---
// Networks = connected components over {solar, battery, machines} linked by
// 4-adjacency, where wires conduct across tiles. Machines only run on a
// network with enough available power (solar transient first, then battery).
function computeNetworks(state) {
  const nodeKey = (o) => `o${o.id}`;
  const visitedObj = new Set();
  const visitedWire = new Set();
  const networks = [];

  const conductive = (x, y) => {
    if (state.wires[`${x},${y}`]) return { type: "wire", x, y };
    const o = objectAt(state, x, y);
    if (o) return { type: "obj", o };
    return null;
  };

  for (const start of state.objects) {
    if (visitedObj.has(start.id)) continue;
    const net = { objects: [], wires: [] };
    const queue = [{ type: "obj", o: start }];
    visitedObj.add(start.id);
    while (queue.length) {
      const node = queue.shift();
      let cx, cy;
      if (node.type === "obj") {
        net.objects.push(node.o);
        cx = node.o.x; cy = node.o.y;
      } else {
        net.wires.push(`${node.x},${node.y}`);
        cx = node.x; cy = node.y;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = conductive(cx + dx, cy + dy);
        if (!n) continue;
        if (n.type === "obj") {
          if (visitedObj.has(n.o.id)) continue;
          visitedObj.add(n.o.id);
          queue.push(n);
        } else {
          const wk = `${n.x},${n.y}`;
          if (visitedWire.has(wk)) continue;
          visitedWire.add(wk);
          queue.push(n);
        }
      }
    }
    networks.push(net);
  }
  return networks;
}

function isDaytime(state) {
  return state.tick < state.nightStart;
}

// --- Community buy-in: sharing food organizes the dump over time ---
function communityTier(state) {
  if (state.community >= 6 && state.loopClosedCount > 0) return 2; // organized waste center
  if (state.community >= 3) return 1; // neighbors pitching in
  return 0; // alone out there
}
const TIER_NAMES = ["alone", "neighbors helping", "organized"];

function atGate(state) {
  return state.tyler.x === GATE.x - 1 && state.tyler.y === GATE.y;
}

function shareFood(state) {
  if (!atGate(state)) return { ok: false, reason: "Walk to the gate first." };
  if (state.stamina < 1) return { ok: false, reason: "Not enough stamina." };
  if (res(state, "pantry") < 2) return { ok: false, reason: "Not enough food to spare." };
  state.stamina -= 1;
  addRes(state, "pantry", -2);
  state.community += 1;
  const tier = communityTier(state);
  if (state.community === 3) {
    logEvent(state, "Word spreads. The Okafors and Ms. Ruth started sorting piles at the dump.");
  } else if (tier === 2 && !state._tier2Announced) {
    state._tier2Announced = true;
    logEvent(state, "The block organized the waste center — clean bins: METAL, PLASTICS, GLASS, ORGANICS. Sort it right.");
  } else {
    logEvent(state, "Shared food over the fence. The block remembers who shows up.");
  }
  return { ok: true };
}

// --- Dump trip: off-screen. A crap shoot alone; reliable once the block organizes. ---
function scavenge(state) {
  if (!atGate(state)) return { ok: false, reason: "Walk to the gate first — the dump is up the block." };
  const cost = 3 + state.scavengeCostBonus;
  if (state.stamina < cost) return { ok: false, reason: "Not enough stamina for a dump run." };
  state.stamina -= cost;

  const tier = communityTier(state);
  const roll = Math.random();
  let bottles = 0;
  let msg;

  if (tier === 0) {
    // unsorted mountain: pure crap shoot
    if (roll < 0.25) {
      addRes(state, "waste", 1);
      msg = "Dump run: nothing but junk today. Grabbed some compostables at least.";
    } else if (roll < 0.7) {
      bottles = 1 + Math.floor(Math.random() * 2);
      msg = `Dump run: dug out ${bottles} bottles from the mess.`;
    } else if (roll < 0.9) {
      bottles = 3;
      msg = "Dump run: a decent pocket of plastics. +3 bottles.";
    } else {
      bottles = 4;
      addRes(state, "seed", 1);
      msg = "Lucky find! +4 bottles and a seed packet someone tossed.";
    }
  } else if (tier === 1) {
    bottles = 2 + Math.floor(Math.random() * 3);
    msg = `The sorted piles pay off: +${bottles} bottles.`;
    if (roll > 0.8) { addRes(state, "seed", 1); msg += " Ms. Ruth saved you a seed packet."; }
    else if (roll > 0.65) { addRes(state, "filament", 1); msg += " Found clean PET — practically filament-grade."; }
  } else {
    bottles = 4 + Math.floor(Math.random() * 3);
    msg = `The PLASTICS bin is clean and full: +${bottles} bottles.`;
    if (roll > 0.75) { addRes(state, "filament", 2); msg += " The Okafors set aside filament-grade stock (+2)."; }
    else if (roll > 0.6) { addRes(state, "waste", 2); msg += " ORGANICS bin topped off the composter (+2 waste)."; }
  }

  bottles = Math.round(bottles * state.scavengeYieldMultiplier);
  if (bottles > 0) addRes(state, "bottles", bottles);
  logEvent(state, msg);

  // the trip up the block takes real time
  for (let i = 0; i < 3 && !state.gameOver; i++) tickOnce(state);
  return { ok: true, bottles };
}

function placeObject(state, type, x, y, pathKey) {
  const def = OBJECT_DEFS[type];
  if (!def || def.kind === "wire") return { ok: false, reason: "Unknown object." };
  if (!isPlaceable(state, x, y)) return { ok: false, reason: "Can't place there." };
  const staminaCost = def.triPath ? BUILD_PATHS[pathKey].cost : def.staminaCost;
  if (def.triPath && !BUILD_PATHS[pathKey]) return { ok: false, reason: "Pick a build path." };
  if (state.stamina < staminaCost) return { ok: false, reason: "Not enough stamina." };
  if (!canAfford(state, def.buildCost)) {
    const need = Object.entries(def.buildCost).map(([k, v]) => `${v} ${k}`).join(", ");
    return { ok: false, reason: `Needs ${need}.` };
  }
  state.stamina -= staminaCost;
  payCosts(state, def.buildCost);
  const obj = {
    id: state.nextId++, type, x, y,
    path: def.triPath ? pathKey : null,
    state: "idle", progress: 0,
    charge: type === "battery" ? 10 : 0,
  };
  state.objects.push(obj);
  logEvent(state, `Built ${def.label}${def.triPath ? ` (${BUILD_PATHS[pathKey].label})` : ""}.`);
  return { ok: true, obj };
}

function placeWire(state, x, y) {
  const def = OBJECT_DEFS.wire;
  if (!isPlaceable(state, x, y)) return { ok: false, reason: "Can't place there." };
  if (state.stamina < def.staminaCost) return { ok: false, reason: "Not enough stamina." };
  if (!canAfford(state, def.buildCost)) return { ok: false, reason: "Needs 1 bottle (stripped for copper)." };
  state.stamina -= def.staminaCost;
  payCosts(state, def.buildCost);
  state.wires[`${x},${y}`] = true;
  return { ok: true };
}

function startMachine(state, objId) {
  const obj = state.objects.find((o) => o.id === objId);
  if (!obj) return { ok: false, reason: "No such machine." };
  const def = OBJECT_DEFS[obj.type];
  if (def.kind !== "machine") return { ok: false, reason: "Not a machine." };
  if (!tylerAdjacentTo(state, obj.x, obj.y)) return { ok: false, reason: "Walk over to it first." };
  if (obj.state === "running" || obj.state === "nopower") return { ok: false, reason: "Already loaded and working." };
  if (state.stamina < 1) return { ok: false, reason: "Not enough stamina." };
  if (!canAfford(state, def.inputs)) {
    const need = Object.entries(def.inputs).map(([k, v]) => `${v} ${k}`).join(", ");
    return { ok: false, reason: `Needs ${need}.` };
  }
  state.stamina -= 1;
  payCosts(state, def.inputs);
  obj.state = "running";
  obj.progress = 0;
  logEvent(state, `Loaded the ${def.label}.`);
  return { ok: true };
}

/* One click = Tyler does his rounds: load every idle machine that has inputs.
 * Costs the same 1 stamina per machine as loading by hand; adjacency is
 * abstracted (the rounds ARE the walking). Food chain first. */
const ROUNDS_ORDER = ["farmbot", "composter", "polyformer", "printer"];
function runAllMachines(state) {
  const loaded = [];
  let skippedInputs = 0;
  for (const type of ROUNDS_ORDER) {
    for (const obj of state.objects.filter((o) => o.type === type)) {
      const def = OBJECT_DEFS[type];
      if (def.kind !== "machine" || obj.state !== "idle") continue;
      if (state.stamina < 1) {
        logEvent(state, `Rounds cut short — out of stamina after ${loaded.length} machine(s).`);
        return { ok: loaded.length > 0, loaded, reason: "Ran out of stamina mid-rounds." };
      }
      if (!canAfford(state, def.inputs)) { skippedInputs++; continue; }
      state.stamina -= 1;
      payCosts(state, def.inputs);
      obj.state = "running";
      obj.progress = 0;
      loaded.push(obj);
    }
  }
  if (loaded.length === 0) {
    return {
      ok: false, loaded,
      reason: skippedInputs > 0
        ? "Nothing to load — machines are missing input materials."
        : "No idle machines to load.",
    };
  }
  logEvent(state, `Did the rounds: loaded ${loaded.length} machine(s) in one pass.`);
  return { ok: true, loaded };
}

function finishCycle(state, obj) {
  const def = OBJECT_DEFS[obj.type];
  const path = BUILD_PATHS[obj.path] || { reliability: 1, outputMultiplier: 1 };
  obj.state = "idle";
  obj.progress = 0;
  if (Math.random() > path.reliability) {
    logEvent(state, `${def.label} misfired — the hack didn't hold. Materials lost.`);
    return;
  }
  Object.entries(def.outputs).forEach(([k, v]) => {
    let amt = Math.max(1, Math.round(v * path.outputMultiplier));
    if (k === "crop") {
      if (def.soilBonus && res(state, "soil") >= 1) {
        addRes(state, "soil", -1);
        amt += 1;
      }
      addRes(state, "pantry", amt);
      state.harvestedOnce = true;
      logEvent(state, `Harvest! +${amt} food to the pantry.`);
      return;
    }
    addRes(state, k, amt);
    if (k === "filament") state.stats.filamentMade += amt;
    if (k === "parts") state.stats.partsMade += amt;
  });
  if (def.closesLoop && state.harvestedOnce) {
    state.loopClosedCount += 1;
    logEvent(state, `Compost returned to soil — THE LOOP CLOSED (${state.loopClosedCount}x). Bottle to dinner to dirt.`);
  } else if (!def.closesLoop) {
    logEvent(state, `${def.label} finished a cycle.`);
  } else {
    logEvent(state, `${def.label} made soil — grow food first to close the full loop.`);
  }
}

// --- The tick: power flow + machine progress + rain ---
function tickOnce(state) {
  if (state.gameOver) return;
  state.tick += 1;

  // rain barrel drips in
  if (state.tick % 10 === 0) {
    const water = res(state, "water");
    if (water < 12) addRes(state, "water", 1);
  }

  const day = isDaytime(state);
  const networks = computeNetworks(state);

  for (const net of networks) {
    const solars = net.objects.filter((o) => o.type === "solar");
    const batteries = net.objects.filter((o) => o.type === "battery");
    const running = net.objects.filter((o) => {
      const def = OBJECT_DEFS[o.type];
      return def.kind === "machine" && (o.state === "running" || o.state === "nopower");
    });

    let transient = day ? solars.length * OBJECT_DEFS.solar.powerOutput : 0;

    // power machines in placement order
    for (const m of running) {
      const draw = OBJECT_DEFS[m.type].powerDraw;
      let got = 0;
      const fromTransient = Math.min(transient, draw);
      transient -= fromTransient;
      got += fromTransient;
      for (const b of batteries) {
        if (got >= draw) break;
        const take = Math.min(b.charge, draw - got);
        b.charge -= take;
        got += take;
      }
      if (got >= draw) {
        if (m.state === "nopower") m.state = "running";
        m.progress += 1;
        if (m.progress >= OBJECT_DEFS[m.type].ticks) finishCycle(state, m);
      } else {
        m.state = "nopower"; // stalled, waiting for juice (inputs stay loaded)
      }
    }

    // leftover solar charges batteries
    for (const b of batteries) {
      if (transient <= 0) break;
      const room = OBJECT_DEFS.battery.capacity - b.charge;
      const put = Math.min(room, transient);
      b.charge += put;
      transient -= put;
    }
  }

  if (state.tick >= state.ticksPerDay) {
    endDay(state);
  }
}

function endDay(state) {
  // family eats
  const drain = state.pantryDrain;
  const pantry = res(state, "pantry");
  if (pantry >= drain) {
    addRes(state, "pantry", -drain);
    addRes(state, "waste", 2); // food scraps feed the composter
    state["resilencity/tyler/food/hungryNights"] = 0;
  } else {
    addRes(state, "pantry", -pantry);
    state["resilencity/tyler/food/hungryNights"] += 1;
    logEvent(state, "Not enough food tonight. The family went to bed hungry.");
  }

  if (res(state, "hungryNights") >= 2) {
    state.gameOver = true;
    state.win = false;
    logEvent(state, "Two hungry nights in a row. The household could not hold on.");
    return;
  }

  state.day += 1;
  state.tick = 0;

  if (state.day > state.totalDays) {
    state.gameOver = true;
    state.win = state.loopClosedCount > 0 && res(state, "pantry") > 0;
    logEvent(state, state.win
      ? "The crisis broke before the household did. The loop held."
      : "The crisis year ended, but the loop never carried the family.");
    return;
  }

  state.stamina = state.staminaMax;

  // tier-2 community: sorted drop-off waiting at the gate each morning
  if (communityTier(state) === 2) {
    addRes(state, "bottles", 2);
    logEvent(state, "Morning drop-off at the gate: +2 sorted bottles from the block.");
  }

  const stage = state.crisisStages.find((s) => s.day === state.day && !s.applied);
  if (stage) {
    stage.applied = true;
    state.lastCrisis = stage;
    if (stage.day === 1) state.scavengeCostBonus = 1;
    if (stage.day === 3) { state.staminaMax = 20; state.stamina = 20; }
    if (stage.day === 5) state.pantryDrain = 4;
    if (stage.day === 8) state.scavengeYieldMultiplier = 0.5;
    logEvent(state, `CRISIS — ${stage.name}: ${stage.detail}`);
  }
}

function sleepUntilMorning(state) {
  // fast-forward the rest of the day (machines keep working on battery)
  const target = state.day;
  let guard = 0;
  while (!state.gameOver && state.day === target && guard < state.ticksPerDay + 2) {
    tickOnce(state);
    guard++;
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    createInitialState, tickOnce, endDay, sleepUntilMorning,
    scavenge, shareFood, placeObject, placeWire, startMachine, runAllMachines,
    findPath, approach, isBlocked, isPlaceable, isFence, isGate, isHouse, isBarrel, inBounds,
    computeNetworks, isDaytime, communityTier, TIER_NAMES, res, addRes,
    OBJECT_DEFS, BUILD_PATHS, GRID_W, GRID_H, HOUSE, BARREL, GATE,
  };
}
