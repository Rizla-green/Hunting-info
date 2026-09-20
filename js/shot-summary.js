/* =====================================================================
   SHOT SUMMARY — the "everything shot" card on the main menu (under the
   logo, above the tiles) and the all-time species list it opens.

   Counts every animal/bird ever logged in Deer, Fox, Rabbit, Rats,
   Squirrels, Winged Vermin, Game Shooting, Goats and Boar, ALL TIME.
   Clay Shooting and Zeroing are NOT counted (neither animals nor shots).

   Nothing is counted twice: winged vermin taken on Game Shooting days
   (Crow, Pigeon, etc.) are counted once, under Winged Vermin, together
   with the Winged Vermin entries. Game Shooting shows the game birds.

   SHOTS (cartridges) are only truly recorded in two places, so:
     - Game Shooting: each day's "Shots taken" figure (covers everything
       shot that day, vermin included). Days with no figure count as 0.
     - Winged Vermin: the entry's "Shots taken" when entered, otherwise
       1 per animal.
     - Deer, Fox, Rabbit, Rats, Squirrels, Goats, Boar: no cartridge
       figure exists, so 1 per animal (same assumption the Firearms
       round counter makes). So the total is a minimum.
   Read-only: this never changes any data.
===================================================================== */

const ShotSummary = {
  _int(v, dflt) { const n = parseInt(v, 10); return isNaN(n) ? dflt : n; },

  // Builds the groups (menu order) plus grand totals.
  compute() {
    const data = window.APP_DATA || {};
    const sp = data.species || {};
    const groups = [];
    const known = (names, counts) => {
      const rows = names.map((n) => ({ name: n, count: counts.get(n) || 0 }));
      Array.from(counts.keys()).filter((n) => !names.includes(n)).sort().forEach((n) => rows.push({ name: n, count: counts.get(n) }));
      return rows;
    };
    const add = (counts, name, n) => counts.set(name, (counts.get(name) || 0) + n);

    // Deer — one entry = one animal, split by species
    const deerCounts = new Map();
    (sp.deer || []).forEach((e) => add(deerCounts, e.species || "No species", 1));
    const deerRows = known(typeof SPECIES_LIST !== "undefined" ? SPECIES_LIST : [], deerCounts);
    const deerN = (sp.deer || []).length;
    groups.push({ title: "Deer", rows: deerRows, animals: deerN, shots: deerN, basis: "1 shot per animal (no cartridge figure is recorded for deer)." });

    // Single-species sections (one row each; entries carry an amount)
    [["fox", "Fox"], ["rabbit", "Rabbit"], ["rats", "Rats"], ["squirrel", "Squirrels"]].forEach(([key, label]) => {
      const n = (sp[key] || []).reduce((s, e) => s + (this._int(e.shots, 1) || 1), 0);
      groups.push({ title: label, rows: [{ name: label, count: n }], animals: n, shots: n, basis: "1 shot per animal." });
    });

    // Winged Vermin — real entries + vermin lines on Game Shooting days, combined per species
    const wingedCounts = new Map();
    const tally = typeof wingedTallyEntries === "function" ? wingedTallyEntries() : (sp.winged || []);
    tally.forEach((e) => (e.lines || []).forEach((l) => add(wingedCounts, l.category, this._int(l.shots, 0))));
    const wingedNames = typeof WINGED_VERMIN_LIST !== "undefined" ? WINGED_VERMIN_LIST : [];
    let wingedShots = 0;
    (sp.winged || []).forEach((e) => {
      const lineSum = (e.lines || []).reduce((s, l) => s + this._int(l.shots, 0), 0);
      wingedShots += (e.shotsTaken !== undefined && e.shotsTaken !== null && e.shotsTaken !== "") ? this._int(e.shotsTaken, 0) : lineSum;
    });
    const wingedAnimals = Array.from(wingedCounts.values()).reduce((a, b) => a + b, 0);
    groups.push({
      title: "Winged Vermin", rows: known(wingedNames, wingedCounts), animals: wingedAnimals, shots: wingedShots,
      basis: "Includes vermin taken on Game Shooting days. Shots: the entry's shots taken where entered, otherwise 1 per animal; shoot-day shots are in Game Shooting's figure.",
    });

    // Game Shooting — game birds only here (vermin lines were counted above)
    const gameCounts = new Map();
    let gameShots = 0;
    (data.gameShooting || []).forEach((day) => {
      gameShots += typeof GameShooting !== "undefined" ? GameShooting.dayShotsTaken(day) : this._int(day.shotsTaken, 0);
      (day.species || []).forEach((l) => {
        if (wingedNames.includes(l.species)) return;
        add(gameCounts, l.species || "Other", this._int(l.hits, 0));
      });
    });
    const gameAnimals = Array.from(gameCounts.values()).reduce((a, b) => a + b, 0);
    groups.push({
      title: "Game Shooting", rows: known(typeof GAME_BIRD_LIST !== "undefined" ? GAME_BIRD_LIST : [], gameCounts), animals: gameAnimals, shots: gameShots,
      basis: "Shots = every day's shots taken (covers all species shot that day, vermin included). Days with no figure count as 0.",
    });

    // Goats, Boar
    [["goats", "Goats"], ["boar", "Boar"]].forEach(([key, label]) => {
      const n = (sp[key] || []).reduce((s, e) => s + (this._int(e.shots, 1) || 1), 0);
      groups.push({ title: label, rows: [{ name: label, count: n }], animals: n, shots: n, basis: "1 shot per animal." });
    });

    return {
      groups,
      animals: groups.reduce((s, g) => s + g.animals, 0),
      shots: groups.reduce((s, g) => s + g.shots, 0),
    };
  },

  // The card under the logo. Safe to call any time (also before data has loaded).
  renderCard() {
    const el = document.getElementById("shotSummary");
    if (!el) return;
    let t;
    try { t = this.compute(); } catch (err) { console.warn("Shot summary failed:", err); el.innerHTML = ""; return; }
    el.innerHTML = `
      <div class="shot-summary" onclick="ShotSummary.open()">
        <div class="stat-cards">
          <div class="stat-card"><div class="num">${t.animals}</div><div class="lbl">Total shot (all species)</div></div>
          <div class="stat-card"><div class="num">${t.shots}</div><div class="lbl">Total shots fired</div></div>
        </div>
        <div class="hint" style="text-align:center; margin:4px 0 0;">Tap for every species</div>
      </div>`;
  },

  open() {
    const t = this.compute();
    const groupHtml = t.groups.map((g) => `
      <div class="section-title" style="margin-top:14px;"><h4>${escapeHtml(g.title)} — ${g.animals} shot · ${g.shots} shots</h4></div>
      <p class="hint" style="margin:0 0 4px;">${escapeHtml(g.basis)}</p>
      <div class="table-scroll"><table class="data-table">
        <tr><th>Species</th><th>Shot</th></tr>
        ${g.rows.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td><strong>${r.count}</strong></td></tr>`).join("")}
      </table></div>`).join("");
    const overlay = document.getElementById("modalOverlay");
    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">← Back</button>
          <h3>Everything shot</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
        </div>
        <div class="stat-cards">
          <div class="stat-card"><div class="num">${t.animals}</div><div class="lbl">Total shot (all time)</div></div>
          <div class="stat-card"><div class="num">${t.shots}</div><div class="lbl">Total shots fired</div></div>
        </div>
        <p class="hint">All time. Clay Shooting and Zeroing are not counted. Each animal is counted once. Shots are real cartridge figures where the app records them (Game Shooting, Winged Vermin) and 1 per animal elsewhere, so the total is a minimum.</p>
        ${groupHtml}
      </div>`;
    overlay.classList.remove("hidden");
  },

  // Keeps the card current when a section is closed and the menu shows again.
  init() {
    const overlay = document.getElementById("modalOverlay");
    if (!overlay || !window.MutationObserver) return;
    new MutationObserver(() => { if (overlay.classList.contains("hidden")) this.renderCard(); })
      .observe(overlay, { attributes: true, attributeFilter: ["class"] });
  },
};
