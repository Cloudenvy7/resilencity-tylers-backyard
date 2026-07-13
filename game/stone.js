/* Stone — scripted dashboard + advice: energy-first build order, then community. */

function stoneGauges(state) {
  const batteries = state.objects.filter((o) => o.type === "battery");
  const charge = batteries.reduce((s, b) => s + b.charge, 0);
  const cap = batteries.length * OBJECT_DEFS.battery.capacity;
  return [
    { label: "Stamina", value: `${state.stamina} / ${state.staminaMax}` },
    { label: "Power", value: cap ? `${Math.round(charge)} / ${cap}` : "no grid" },
    { label: "Community", value: `${state.community} · ${TIER_NAMES[communityTier(state)]}` },
    { label: "Bottles", value: res(state, "bottles") },
    { label: "Filament", value: res(state, "filament") },
    { label: "Parts", value: res(state, "parts") },
    { label: "Water", value: res(state, "water") },
    { label: "Seed", value: res(state, "seed") },
    { label: "Waste", value: res(state, "waste") },
    { label: "Soil", value: res(state, "soil") },
    { label: "Pantry", value: res(state, "pantry") },
  ];
}

function has(state, type) {
  return state.objects.some((o) => o.type === type);
}

/* The run's order of operations, tracked live. The first unfinished step is
 * "current" — this is the game's visible plan. */
function stoneObjectives(state) {
  const nets = computeNetworks(state);
  const gridUp = nets.some((n) =>
    n.objects.some((o) => o.type === "solar") && n.objects.some((o) => o.type === "battery"));
  const stats = state.stats || {};
  const steps = [
    { label: "Salvage bottles at the dump (crap shoot for now)", done: res(state, "bottles") >= 4 || state.objects.length > 0 },
    { label: "Build a Solar Panel — power before anything", done: has(state, "solar") },
    { label: "Wire a Battery to it — bank the daylight", done: gridUp },
    { label: "Polyformer on the grid: bottles → filament", done: stats.filamentMade > 0 },
    { label: "3D Printer: filament → a real part", done: stats.partsMade > 0 },
    { label: "FarmBot bed: water + seed → harvest", done: state.harvestedOnce },
    { label: "Composter: scraps → soil. THE LOOP CLOSES", done: state.loopClosedCount > 0 },
    { label: `Share food — organize the block (${Math.min(state.community, 3)}/3)`, done: communityTier(state) >= 1 },
    { label: "Hold the loop through Day 12", done: state.gameOver && state.win },
  ];
  const current = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => ({ ...s, current: i === current }));
}

function stoneAdvice(state) {
  if (res(state, "bottles") < 4 && !has(state, "solar")) {
    return "Stone: “Take a dump trip through the gate. It's a mess up there — you'll get what you get until the block organizes it.”";
  }
  if (!has(state, "solar")) {
    return "Stone: “Power before anything. Build a Solar Panel from salvaged cells (4 bottles). Nothing in this yard runs without watts.”";
  }
  if (!has(state, "battery")) {
    return "Stone: “Sun sets, machines stop. Add a Battery Bank (3 bottles) and wire it in so we bank the daylight.”";
  }
  if (!has(state, "polyformer")) {
    return "Stone: “Grid's live. Now the Polyformer — set it on the network and it turns bottles into filament.”";
  }
  if (!has(state, "printer")) {
    return "Stone: “Filament needs a 3D Printer to become parts. Same rule: no connection, no power, no printing.”";
  }
  if (!has(state, "farmbot") && res(state, "parts") < 1) {
    return "Stone: “The FarmBot needs a printed part. Keep the Polyformer and Printer fed and powered.”";
  }
  if (!has(state, "farmbot")) {
    return "Stone: “Part's ready. Build the FarmBot bed, load water and seed, and we grow real food in real dirt.”";
  }
  if (!has(state, "composter")) {
    return "Stone: “Food's coming. Build the Composter — scraps become soil, soil fattens the harvest. That's the loop.”";
  }
  if (state.loopClosedCount === 0) {
    return "Stone: “Everything's on the board. Grow, eat, compost, return the soil — one full pass closes the loop.”";
  }
  if (communityTier(state) < 1) {
    return "Stone: “The loop works. Now share food at the gate — when the block eats, the block organizes, and that dump becomes a supply depot.”";
  }
  if (communityTier(state) < 2) {
    return "Stone: “Neighbors are sorting piles now. Keep showing up — an organized waste center beats a lucky dig every time.”";
  }
  if (res(state, "pantry") <= state.pantryDrain) {
    return "Stone: “Pantry's thin. Keep the FarmBot cycling — water, seed, power.”";
  }
  return "Stone: “Sorted bins, steady grid, growing beds. The block built its own supply chain. Keep it turning.”";
}

if (typeof module !== "undefined") {
  module.exports = { stoneGauges, stoneAdvice, stoneObjectives };
}
