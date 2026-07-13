/* Isometric backyard renderer — warm golden-hour lot per the concept art:
 * wooden fence ring with a gate, pitched-roof house, rain barrels, FarmBot
 * gantry over a raised bed, paver path, Stone the owl hovering by Tyler.
 * The dump is OFF-SCREEN — hinted past the gate. Pure canvas, no assets. */

const TILE_W = 64;
const TILE_H = 32;
const ORIGIN_X = 470;
const ORIGIN_Y = 80;

function isoPt(fx, fy) {
  return {
    sx: ORIGIN_X + (fx - fy) * (TILE_W / 2),
    sy: ORIGIN_Y + (fx + fy) * (TILE_H / 2),
  };
}
function isoToScreen(x, y) {
  return isoPt(x, y);
}
function screenToIso(sx, sy) {
  const dx = (sx - ORIGIN_X) / (TILE_W / 2);
  const dy = (sy - ORIGIN_Y) / (TILE_H / 2);
  return { x: Math.floor((dx + dy) / 2), y: Math.floor((dy - dx) / 2) };
}

function diamondPath(ctx, sx, sy) {
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + TILE_W / 2, sy + TILE_H / 2);
  ctx.lineTo(sx, sy + TILE_H);
  ctx.lineTo(sx - TILE_W / 2, sy + TILE_H / 2);
  ctx.closePath();
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

function drawPrism(ctx, x, y, h, color, opts) {
  const { sx, sy } = isoPt(x, y);
  const top = sy - h;
  ctx.fillStyle = shade(color, 0.72);
  ctx.beginPath();
  ctx.moveTo(sx - TILE_W / 2, top + TILE_H / 2);
  ctx.lineTo(sx, top + TILE_H);
  ctx.lineTo(sx, sy + TILE_H);
  ctx.lineTo(sx - TILE_W / 2, sy + TILE_H / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(color, 0.55);
  ctx.beginPath();
  ctx.moveTo(sx + TILE_W / 2, top + TILE_H / 2);
  ctx.lineTo(sx, top + TILE_H);
  ctx.lineTo(sx, sy + TILE_H);
  ctx.lineTo(sx + TILE_W / 2, sy + TILE_H / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  diamondPath(ctx, sx, top);
  ctx.fill();
  if (!opts || !opts.noStroke) {
    ctx.strokeStyle = "rgba(30,20,10,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

let _day = true; // set each frame; lets painters pick day-dependent sprites
function runFrame() {
  return Math.floor(Date.now() / 300) % 2;
}

/* status overlays drawn on top of sprite OR greybox */
function statusOverlay(ctx, o, topH) {
  const def = OBJECT_DEFS[o.type];
  const { sx, sy } = isoPt(o.x, o.y);
  if (def.kind === "machine") {
    if (o.state === "running") {
      const frac = o.progress / def.ticks;
      ctx.fillStyle = "#14100a";
      ctx.fillRect(sx - 15, sy - topH - 6, 30, 4);
      ctx.fillStyle = "#8fbf5f";
      ctx.fillRect(sx - 15, sy - topH - 6, 30 * frac, 4);
    } else if (o.state === "nopower") {
      ctx.fillStyle = "#f2c14e";
      ctx.font = "bold 13px monospace";
      ctx.fillText("⚡!", sx - 8, sy - topH - 4);
    }
  }
  if (o.type === "battery") {
    const frac = o.charge / OBJECT_DEFS.battery.capacity;
    ctx.fillStyle = "#14100a";
    ctx.fillRect(sx - 13, sy - topH - 4, 26, 5);
    ctx.fillStyle = "#f2c14e";
    ctx.fillRect(sx - 13, sy - topH - 4, 26 * frac, 5);
  }
}

/* machine painter: sprite first (per ART_SPEC naming), greybox fallback */
function paintMachine(ctx, o, fallbackFn) {
  let drew;
  if (o.type === "solar") {
    drew = _day
      ? drawSpriteOr(ctx, "solar_run", runFrame(), o.x, o.y, null)
        || drawSpriteOr(ctx, "solar_idle", undefined, o.x, o.y, null)
      : drawSpriteOr(ctx, "solar_idle", undefined, o.x, o.y, null);
  } else if (o.state === "running" || o.state === "nopower") {
    drew = drawSpriteOr(ctx, o.type + "_run", runFrame(), o.x, o.y, null)
      || drawSpriteOr(ctx, o.type + "_idle", undefined, o.x, o.y, null);
  } else {
    drew = drawSpriteOr(ctx, o.type + "_idle", undefined, o.x, o.y, null);
  }
  if (!drew) {
    fallbackFn();
    return;
  }
  // farmbot sprout overlay by growth stage
  if (o.type === "farmbot") {
    const def = OBJECT_DEFS.farmbot;
    const frac = o.state === "running" ? o.progress / def.ticks : 0;
    const stage = Math.min(3, Math.floor(frac * 4));
    drawSpriteOr(ctx, "sprouts_" + stage, undefined, o.x, o.y, null, { dy: -6 });
  }
  // sprite top = ground(sy + TILE_H/2) - img.height; overlay sits just above it
  const img = sprite(o.type + "_idle") || sprite(o.type + "_run", 0);
  statusOverlay(ctx, o, (img ? img.height : 30) - TILE_H / 2);
}

let particles = [];
function spawnBurst(x, y, color) {
  const { sx, sy } = isoPt(x, y);
  for (let i = 0; i < 6; i++) {
    particles.push({
      sx, sy: sy + TILE_H / 2,
      vx: (Math.random() - 0.5) * 2, vy: -1.5 - Math.random() * 1.5,
      life: 1, color,
    });
  }
}

const tylerVisual = { sx: null, sy: null, step: 0, facing: "e", face4: "se", lastX: undefined, lastY: undefined };
let owlBob = 0;

function drawOwlFallback(ctx, ox, oy) {
  ctx.fillStyle = "#d8d4c8";
  ctx.beginPath(); ctx.ellipse(ox, oy, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#4ac2d8";
  ctx.beginPath(); ctx.arc(ox - 2, oy - 2, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ox + 2, oy - 2, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#b8b4a8";
  ctx.lineWidth = 2;
  const wing = Math.sin(owlBob * 3) * 3;
  ctx.beginPath(); ctx.moveTo(ox - 6, oy); ctx.lineTo(ox - 10, oy - 3 + wing); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ox + 6, oy); ctx.lineTo(ox + 10, oy - 3 + wing); ctx.stroke();
}

// ---------- fixed structure painters ----------

function drawHouse(ctx) {
  // sprite: anchored at footprint center; image ground line = south corner of footprint
  if (drawSpriteOr(ctx, "house", undefined,
      HOUSE.x + (HOUSE.w - 1) / 2, HOUSE.y + (HOUSE.h - 1) / 2, null,
      { dy: TILE_H })) return;
  const H = 44, ROOF = 26;
  const x0 = HOUSE.x, y0 = HOUSE.y, x1 = HOUSE.x + HOUSE.w, y1 = HOUSE.y + HOUSE.h;
  const wall = "#8a6a4a";
  // south wall (front, facing yard)
  let a = isoPt(x0, y1), b = isoPt(x1, y1);
  ctx.fillStyle = shade(wall, 0.85);
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
  ctx.lineTo(b.sx, b.sy - H); ctx.lineTo(a.sx, a.sy - H);
  ctx.closePath(); ctx.fill();
  // windows (warm light)
  for (let i = 0; i < HOUSE.w; i++) {
    const w = isoPt(x0 + i + 0.5, y1);
    ctx.fillStyle = "#f2c14e";
    ctx.fillRect(w.sx - 6, w.sy - H + 14, 12, 12);
    ctx.strokeStyle = "#4a3626";
    ctx.strokeRect(w.sx - 6, w.sy - H + 14, 12, 12);
  }
  // east wall
  a = isoPt(x1, y0); b = isoPt(x1, y1);
  ctx.fillStyle = shade(wall, 0.6);
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
  ctx.lineTo(b.sx, b.sy - H); ctx.lineTo(a.sx, a.sy - H);
  ctx.closePath(); ctx.fill();
  // door on east wall
  const d = isoPt(x1, y0 + 0.6);
  ctx.fillStyle = "#4a3626";
  ctx.beginPath();
  ctx.moveTo(d.sx, d.sy - 2); ctx.lineTo(d.sx + 12, d.sy + 4);
  ctx.lineTo(d.sx + 12, d.sy - 24); ctx.lineTo(d.sx, d.sy - 30);
  ctx.closePath(); ctx.fill();
  // roof: ridge along x, centered in y
  const yc = (y0 + y1) / 2;
  const eN0 = isoPt(x0 - 0.15, y0 - 0.15), eN1 = isoPt(x1 + 0.15, y0 - 0.15);
  const eS0 = isoPt(x0 - 0.15, y1 + 0.15), eS1 = isoPt(x1 + 0.15, y1 + 0.15);
  const r0 = isoPt(x0 - 0.15, yc), r1 = isoPt(x1 + 0.15, yc);
  ctx.fillStyle = "#5a4030"; // back slope
  ctx.beginPath();
  ctx.moveTo(eN0.sx, eN0.sy - H); ctx.lineTo(eN1.sx, eN1.sy - H);
  ctx.lineTo(r1.sx, r1.sy - H - ROOF); ctx.lineTo(r0.sx, r0.sy - H - ROOF);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#6e4e38"; // front slope (lit)
  ctx.beginPath();
  ctx.moveTo(eS0.sx, eS0.sy - H); ctx.lineTo(eS1.sx, eS1.sy - H);
  ctx.lineTo(r1.sx, r1.sy - H - ROOF); ctx.lineTo(r0.sx, r0.sy - H - ROOF);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(30,20,10,0.4)";
  ctx.stroke();
  // rooftop solar sheen (flavor)
  ctx.fillStyle = "rgba(47,109,179,0.85)";
  const p0 = isoPt(x0 + 0.4, y1 - 0.1), p1 = isoPt(x0 + 1.8, y1 - 0.1);
  const q0 = isoPt(x0 + 0.4, yc + 0.15), q1 = isoPt(x0 + 1.8, yc + 0.15);
  ctx.beginPath();
  ctx.moveTo(p0.sx, p0.sy - H - 2); ctx.lineTo(p1.sx, p1.sy - H - 2);
  ctx.lineTo(q1.sx, q1.sy - H - ROOF * 0.55); ctx.lineTo(q0.sx, q0.sy - H - ROOF * 0.55);
  ctx.closePath(); ctx.fill();
}

function drawFencePost(ctx, x, y) {
  // sprite: pick run orientation / corner per position on the ring
  const corner = (x === 0 || x === GRID_W - 1) && (y === 0 || y === GRID_H - 1);
  const spriteName = corner ? "fence_corner" : (y === 0 || y === GRID_H - 1) ? "fence_n" : "fence_e";
  if (drawSpriteOr(ctx, spriteName, undefined, x, y, null)) return;
  const { sx, sy } = isoPt(x, y);
  const h = 22;
  ctx.fillStyle = "#6e5638";
  ctx.fillRect(sx - 2, sy + TILE_H / 2 - h, 4, h);
  // rails to east + south neighbours (if also fence)
  ctx.strokeStyle = "#7d6342";
  ctx.lineWidth = 3;
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const nx = x + dx, ny = y + dy;
    if (!inBounds(nx, ny) || !isFence(nx, ny)) continue;
    if (isGate(nx, ny) || isGate(x, y)) continue; // leave the gate open
    const n = isoPt(nx, ny);
    ctx.beginPath();
    ctx.moveTo(sx, sy + TILE_H / 2 - h + 5);
    ctx.lineTo(n.sx, n.sy + TILE_H / 2 - h + 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx, sy + TILE_H / 2 - h + 13);
    ctx.lineTo(n.sx, n.sy + TILE_H / 2 - h + 13);
    ctx.stroke();
  }
}

function drawBarrels(ctx) {
  if (drawSpriteOr(ctx, "barrels", undefined, BARREL.x, BARREL.y, null)) return;
  // a row of three blue rain barrels against the back fence
  for (let i = 0; i < 3; i++) {
    const p = isoPt(BARREL.x + (i - 1) * 0.3, BARREL.y + (i % 2) * 0.15);
    const bx = p.sx, by = p.sy + TILE_H / 2;
    ctx.fillStyle = "#2c5a7a";
    ctx.fillRect(bx - 7, by - 26, 14, 24);
    ctx.fillStyle = "#3a6d91";
    ctx.beginPath();
    ctx.ellipse(bx, by - 26, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1d3d54";
    ctx.strokeRect(bx - 7, by - 18, 14, 0.5);
  }
}

// ---------- placed object painters ----------

function drawSolar(ctx, o) {
  const { sx, sy } = isoPt(o.x, o.y);
  const base = sy + TILE_H / 2;
  ctx.fillStyle = "#555";
  ctx.fillRect(sx - 2, base - 12, 4, 12);
  ctx.fillStyle = "#2f6db3";
  ctx.beginPath();
  ctx.moveTo(sx - 18, base - 10);
  ctx.lineTo(sx + 14, base - 22);
  ctx.lineTo(sx + 18, base - 14);
  ctx.lineTo(sx - 14, base - 2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#9cc4e8";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawBattery(ctx, o) {
  drawPrism(ctx, o.x, o.y, 18, "#8a6a2a");
  const { sx, sy } = isoPt(o.x, o.y);
  const frac = o.charge / OBJECT_DEFS.battery.capacity;
  ctx.fillStyle = "#14100a";
  ctx.fillRect(sx - 13, sy - 24, 26, 5);
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(sx - 13, sy - 24, 26 * frac, 5);
}

function drawMachineBox(ctx, o, color, h) {
  drawPrism(ctx, o.x, o.y, h, color);
  const def = OBJECT_DEFS[o.type];
  const { sx, sy } = isoPt(o.x, o.y);
  if (o.state === "running") {
    const frac = o.progress / def.ticks;
    ctx.fillStyle = "#14100a";
    ctx.fillRect(sx - 15, sy - h - 6, 30, 4);
    ctx.fillStyle = "#8fbf5f";
    ctx.fillRect(sx - 15, sy - h - 6, 30 * frac, 4);
  } else if (o.state === "nopower") {
    ctx.fillStyle = "#f2c14e";
    ctx.font = "bold 13px monospace";
    ctx.fillText("⚡!", sx - 8, sy - h - 4);
  }
}

function drawFarmbot(ctx, o) {
  const def = OBJECT_DEFS[o.type];
  const { sx, sy } = isoPt(o.x, o.y);
  // raised wooden bed
  drawPrism(ctx, o.x, o.y, 8, "#6e4e30");
  ctx.fillStyle = "#3f2e1d"; // soil
  diamondPath(ctx, sx, sy - 8);
  ctx.fill();
  // sprouts scale with progress
  const frac = o.state === "running" ? o.progress / def.ticks : 0;
  const n = 5;
  for (let i = 0; i < n; i++) {
    const fx = o.x - 0.28 + 0.14 * i + ((i % 2) * 0.1);
    const fy = o.y + (i % 3) * 0.16 - 0.16;
    const p = isoPt(fx + 0.5 - o.x + o.x - 0.5, fy); // keep within tile
    const hgt = 2 + frac * 8;
    ctx.strokeStyle = "#4f8f3f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.sx, p.sy + TILE_H / 2 - 8);
    ctx.lineTo(p.sx, p.sy + TILE_H / 2 - 8 - hgt);
    ctx.stroke();
    if (frac > 0.5) {
      ctx.fillStyle = "#7fbf4f";
      ctx.beginPath();
      ctx.arc(p.sx, p.sy + TILE_H / 2 - 8 - hgt, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // gantry frame
  const l = isoPt(o.x - 0.45, o.y), r = isoPt(o.x + 0.45, o.y);
  ctx.strokeStyle = "#c9c4b8";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(l.sx, l.sy + TILE_H / 2); ctx.lineTo(l.sx, l.sy + TILE_H / 2 - 26); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r.sx, r.sy + TILE_H / 2); ctx.lineTo(r.sx, r.sy + TILE_H / 2 - 26); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(l.sx, l.sy + TILE_H / 2 - 26); ctx.lineTo(r.sx, r.sy + TILE_H / 2 - 26); ctx.stroke();
  // moving tool head while running
  if (o.state === "running") {
    const t = (Date.now() / 600) % 1;
    const hx = l.sx + (r.sx - l.sx) * (0.5 + 0.4 * Math.sin(t * Math.PI * 2));
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(hx - 3, l.sy + TILE_H / 2 - 26, 6, 10);
  }
  if (o.state === "nopower") {
    ctx.fillStyle = "#f2c14e";
    ctx.font = "bold 13px monospace";
    ctx.fillText("⚡!", sx - 8, sy - 34);
  }
}

const OBJECT_PAINTERS = {
  solar: (ctx, o) => paintMachine(ctx, o, () => drawSolar(ctx, o)),
  battery: (ctx, o) => paintMachine(ctx, o, () => drawBattery(ctx, o)),
  polyformer: (ctx, o) => paintMachine(ctx, o, () => drawMachineBox(ctx, o, "#4a7c59", 26)),
  printer: (ctx, o) => paintMachine(ctx, o, () => drawMachineBox(ctx, o, "#3d6a91", 26)),
  farmbot: (ctx, o) => paintMachine(ctx, o, () => drawFarmbot(ctx, o)),
  composter: (ctx, o) => paintMachine(ctx, o, () => drawMachineBox(ctx, o, "#6b4c3a", 20)),
};

// ---------- main ----------

function drawScene(ctx, state, ui) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const day = isDaytime(state);
  _day = day;

  // golden-hour sky
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  if (day) { grad.addColorStop(0, "#c98a4b"); grad.addColorStop(0.35, "#8a7a4a"); grad.addColorStop(1, "#3d5230"); }
  else { grad.addColorStop(0, "#141b30"); grad.addColorStop(1, "#18251c"); }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // neighborhood skyline: sprite strip, else procedural silhouettes
  const skylineImg = sprite("skyline");
  if (skylineImg) {
    ctx.drawImage(skylineImg, 0, 20, W, 90);
  } else {
  ctx.fillStyle = day ? "rgba(70,50,40,0.55)" : "rgba(20,18,30,0.8)";
  for (let i = 0; i < 6; i++) {
    const bx = 40 + i * 160, bw = 90, bh = 46 + (i % 3) * 18;
    ctx.fillRect(bx, 60 - bh + 40, bw, bh);
    ctx.beginPath();
    ctx.moveTo(bx - 8, 100 - bh + 40 + (bh - 40));
    ctx.lineTo(bx + bw / 2, 40 - bh + 30 + (bh - 40));
    ctx.lineTo(bx + bw + 8, 100 - bh + 40 + (bh - 40));
    ctx.closePath(); ctx.fill();
  }
  }

  // the dump, off-screen up the block: sprite by community tier, else mounds
  const dumpImg = communityTier(state) >= 2 ? sprite("dump_tier2") : sprite("dump_tier0");
  if (dumpImg) {
    ctx.drawImage(dumpImg, W - dumpImg.width - 10, 150);
  } else {
    ctx.fillStyle = day ? "#6a5a44" : "#3a3228";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(W - 60 - i * 34, 190 + i * 46, 42, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(232,230,223,0.75)";
  ctx.font = "11px monospace";
  ctx.fillText("→ THE DUMP (up the block)", W - 232, 156);

  // ground: lot interior grass, warm; fence ring dirt. Flat tile sprites first.
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const { sx, sy } = isoPt(x, y);
      const isPath = !isFence(x, y) && !isHouse(x, y) && y === GATE.y && x >= 7;
      let tileImg = null;
      if (isPath) tileImg = sprite("paver");
      else if (!isFence(x, y) && !isHouse(x, y)) tileImg = sprite((x + y) % 2 ? "grass_a" : "grass_b");
      if (tileImg) {
        ctx.drawImage(tileImg, sx - TILE_W / 2, sy, TILE_W, TILE_H);
        continue;
      }
      let c;
      if (isFence(x, y)) c = (x + y) % 2 ? "#54452e" : "#4c3f2a";
      else if (isHouse(x, y)) c = "#5a4a38";
      else if (isPath) c = (x % 2) ? "#8a8272" : "#7d7668"; // paver path to gate
      else c = (x + y) % 2 ? "#59713b" : "#516a36";
      ctx.fillStyle = c;
      diamondPath(ctx, sx, sy);
      ctx.fill();
      ctx.strokeStyle = "rgba(30,25,15,0.18)";
      ctx.stroke();
    }
  }

  // placement ghost
  if (ui && ui.hoverTile && ui.tool && ui.tool !== "walk") {
    const { x, y } = ui.hoverTile;
    if (inBounds(x, y)) {
      const ok = isPlaceable(state, x, y);
      const { sx, sy } = isoPt(x, y);
      ctx.fillStyle = ok ? "rgba(143,191,95,0.5)" : "rgba(193,87,58,0.5)";
      diamondPath(ctx, sx, sy);
      ctx.fill();
    }
  }

  // wires with powered glow
  const networks = computeNetworks(state);
  const poweredWires = new Set();
  for (const net of networks) {
    const hasSource = net.objects.some((o) =>
      (o.type === "solar" && day) || (o.type === "battery" && o.charge > 0));
    if (hasSource) net.wires.forEach((w) => poweredWires.add(w));
  }
  Object.keys(state.wires).forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    const { sx, sy } = isoPt(x, y);
    const powered = poweredWires.has(key);
    const cx = sx, cy = sy + TILE_H / 2;
    ctx.strokeStyle = powered ? "#f2c14e" : "#6a6a5a";
    ctx.lineWidth = powered ? 3 : 2;
    let drew = false;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nk = `${x + dx},${y + dy}`;
      const nObj = state.objects.find((o) => o.x === x + dx && o.y === y + dy);
      if (state.wires[nk] || nObj) {
        const n = isoPt(x + dx, y + dy);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo((cx + n.sx) / 2, (cy + n.sy + TILE_H / 2) / 2);
        ctx.stroke();
        drew = true;
      }
    });
    if (!drew) { ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.stroke(); }
    if (powered) {
      ctx.fillStyle = "rgba(242,193,78,0.9)";
      ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  });

  // depth-sorted drawables
  const drawables = [];

  drawables.push({ depth: HOUSE.x + HOUSE.w / 2 + HOUSE.y + HOUSE.h, draw: () => drawHouse(ctx) });
  drawables.push({ depth: BARREL.x + BARREL.y + 0.2, draw: () => drawBarrels(ctx) });

  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (isFence(x, y) && !isGate(x, y)) {
        drawables.push({ depth: x + y, draw: ((fx, fy) => () => drawFencePost(ctx, fx, fy))(x, y) });
      }
    }
  }
  // gate posts (taller, marking the opening)
  drawables.push({
    depth: GATE.x + GATE.y,
    draw: () => {
      if (drawSpriteOr(ctx, "gate_posts", undefined, GATE.x, GATE.y, null)) return;
      for (const gy of [GATE.y - 1, GATE.y + 1]) {
        const p = isoPt(GATE.x, gy);
        ctx.fillStyle = "#7d6342";
        ctx.fillRect(p.sx - 3, p.sy + TILE_H / 2 - 30, 6, 30);
      }
    },
  });

  // trees in two corners
  let treeVariant = 0;
  for (const [tx, ty] of [[1, GRID_H - 2], [GRID_W - 2, 1]]) {
    const variant = treeVariant++ % 2 ? "tree_b" : "tree_a";
    if (!objectAt(state, tx, ty)) {
      drawables.push({
        depth: tx + ty,
        draw: () => {
          if (drawSpriteOr(ctx, variant, undefined, tx, ty, null)) return;
          const p = isoPt(tx, ty);
          const bx = p.sx, by = p.sy + TILE_H / 2;
          ctx.fillStyle = "#5a4632";
          ctx.fillRect(bx - 2, by - 22, 5, 22);
          ctx.fillStyle = "#4f7a38";
          ctx.beginPath(); ctx.arc(bx + 1, by - 30, 14, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#5f8f42";
          ctx.beginPath(); ctx.arc(bx - 6, by - 24, 9, 0, Math.PI * 2); ctx.fill();
        },
      });
    }
  }

  for (const o of state.objects) {
    drawables.push({
      depth: o.x + o.y,
      draw: () => {
        OBJECT_PAINTERS[o.type](ctx, o);
        const { sx, sy } = isoPt(o.x, o.y);
        ctx.fillStyle = "rgba(232,230,223,0.85)";
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(OBJECT_DEFS[o.type].label, sx, sy - 36);
        ctx.textAlign = "left";
      },
    });
  }

  // Tyler + Stone the owl
  const tt = isoPt(state.tyler.x, state.tyler.y);
  if (tylerVisual.sx === null) { tylerVisual.sx = tt.sx; tylerVisual.sy = tt.sy; }
  if (Math.abs(tt.sx - tylerVisual.sx) > 1) tylerVisual.facing = tt.sx < tylerVisual.sx ? "w" : "e";
  // 4-way facing from tile movement (turnaround mapping: front art = SE, back art = NW)
  if (tylerVisual.lastX === undefined) { tylerVisual.lastX = state.tyler.x; tylerVisual.lastY = state.tyler.y; }
  const tdx = state.tyler.x - tylerVisual.lastX;
  const tdy = state.tyler.y - tylerVisual.lastY;
  if (tdx > 0) tylerVisual.face4 = "se";
  else if (tdx < 0) tylerVisual.face4 = "nw";
  else if (tdy > 0) tylerVisual.face4 = "sw";
  else if (tdy < 0) tylerVisual.face4 = "ne";
  tylerVisual.lastX = state.tyler.x;
  tylerVisual.lastY = state.tyler.y;
  tylerVisual.sx += (tt.sx - tylerVisual.sx) * 0.18;
  tylerVisual.sy += (tt.sy - tylerVisual.sy) * 0.18;
  const moving = Math.abs(tt.sx - tylerVisual.sx) + Math.abs(tt.sy - tylerVisual.sy) > 1;
  tylerVisual.step += moving ? 0.35 : 0.05;
  const bob = moving ? Math.abs(Math.sin(tylerVisual.step)) * 3 : 0;
  owlBob += 0.06;

  // continuous interpolated depth (from Antigravity's build): sorts Tyler by his
  // on-screen position while walking, so he doesn't pop in front of/behind
  // objects at tile boundaries. (sy-ORIGIN_Y)/(TILE_H/2) recovers x+y in tile units.
  drawables.push({
    depth: (tylerVisual.sy - ORIGIN_Y) / (TILE_H / 2) + 0.5,
    draw: () => {
      const sx = tylerVisual.sx, sy = tylerVisual.sy + TILE_H / 2;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath(); ctx.ellipse(sx, sy, 9, 4, 0, 0, Math.PI * 2); ctx.fill();

      // sprite path: idle / walk / work frames, W-facing mirrored
      const working = !moving && state.objects.some((o) =>
        o.state === "running" && Math.abs(o.x - state.tyler.x) + Math.abs(o.y - state.tyler.y) === 1);
      // 8-dir set first (per-direction art, unmirrored); fallback: front/back
      // 2-frame set where SE/SW share mirrored front art and NW/NE share back art.
      const dir = tylerVisual.face4;
      const back = dir === "nw" || dir === "ne";
      const walkFrame = Math.floor(tylerVisual.step) % 2;
      let tylerImg = null;
      let mirror = false;
      if (moving) {
        const n8 = walkFrameCount(dir);
        if (n8 > 0) {
          // slower cadence for the longer loop (~95ms/frame at 60fps walk)
          tylerImg = sprite("tyler_walk_" + dir, Math.floor(tylerVisual.step * 1.6) % n8);
        }
        if (!tylerImg) {
          tylerImg = (back ? sprite("tyler_back_walk", walkFrame) : null) || sprite("tyler_walk", walkFrame);
          mirror = dir === "sw" || dir === "ne";
        }
      } else if (working) {
        tylerImg = sprite("tyler_work", runFrame()); // work pose is always front — he faces the machine
        mirror = dir === "sw" || dir === "ne";
      } else {
        tylerImg = sprite("tyler_idle_" + dir);
        if (!tylerImg) {
          tylerImg = (back ? sprite("tyler_back_idle") : null) || sprite("tyler_idle");
          mirror = dir === "sw" || dir === "ne";
        }
      }
      if (tylerImg) {
        ctx.save();
        if (mirror) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); }
        ctx.drawImage(tylerImg, sx - tylerImg.width / 2, sy - tylerImg.height - bob);
        ctx.restore();
        // Stone the owl (sprite or fallback drawn below needs the same anchor)
        const owlImg = sprite("stone", Math.floor(owlBob * 2) % 2);
        const ox = sx + 16, oy = sy - 34 + Math.sin(owlBob) * 3;
        if (owlImg) {
          ctx.drawImage(owlImg, ox - owlImg.width / 2, oy - owlImg.height / 2);
          return;
        }
        drawOwlFallback(ctx, ox, oy);
        return;
      }
      // hoodie (green, from the art)
      ctx.fillStyle = "#4a6a3a";
      ctx.fillRect(sx - 5, sy - 19 - bob, 10, 15);
      // vest
      ctx.fillStyle = "#c9973a";
      ctx.fillRect(sx - 5, sy - 17 - bob, 3, 11);
      ctx.fillRect(sx + 2, sy - 17 - bob, 3, 11);
      // head
      ctx.fillStyle = "#6a4a32";
      ctx.beginPath(); ctx.arc(sx, sy - 24 - bob, 6, 0, Math.PI * 2); ctx.fill();
      // working arms when idle next to a running machine
      if (!moving) {
        const near = state.objects.some((o) =>
          o.state === "running" && Math.abs(o.x - state.tyler.x) + Math.abs(o.y - state.tyler.y) === 1);
        if (near) {
          const swing = Math.sin(Date.now() / 200) * 4;
          ctx.strokeStyle = "#4a6a3a";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(sx + 5, sy - 15);
          ctx.lineTo(sx + 11, sy - 11 + swing);
          ctx.stroke();
        }
      }
      // Stone the owl, hovering at Tyler's shoulder
      const ox = sx + 16, oy = sy - 34 + Math.sin(owlBob) * 3;
      const owlImg2 = sprite("stone", Math.floor(owlBob * 2) % 2);
      if (owlImg2) ctx.drawImage(owlImg2, ox - owlImg2.width / 2, oy - owlImg2.height / 2);
      else drawOwlFallback(ctx, ox, oy);
    },
  });

  drawables.sort((a, b) => a.depth - b.depth);
  drawables.forEach((d) => d.draw());

  // particles
  particles.forEach((p) => { p.sx += p.vx; p.sy += p.vy; p.vy += 0.06; p.life -= 0.03; });
  particles = particles.filter((p) => p.life > 0);
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  });

  // warm light wash / night
  if (day) {
    ctx.fillStyle = "rgba(242,180,80,0.07)";
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = "rgba(10,14,40,0.4)";
    ctx.fillRect(0, 0, W, H);
  }
}

if (typeof module !== "undefined") {
  module.exports = { drawScene, isoToScreen, screenToIso, spawnBurst };
}
