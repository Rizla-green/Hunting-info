/* =====================================================================
   GAME SHOOTING — day-based entries. Each entry represents a whole
   day, not one bird: one or more species lines (each with shots taken
   and shot/hits), a Guns standing headcount, and a remembered-location
   dropdown (same pattern as Clay Shooting/Zeroing — its own separate
   list). Day totals (total shot, total shots taken) are calculated
   automatically. Two ratios per day, both using the same total-shots-
   vs-total-bag numbers, just shown as two framings (confirmed — see
   spec). The old "log an incidental Fox/Squirrel/corvid kill without
   leaving Game Shooting" feature has been DROPPED per Ben's decision —
   incidental kills are now logged normally under their own section.
   List view is compact: Date, Location, day's total shot; tap to
   expand the full species-by-species breakdown.
===================================================================== */

const GameShooting = {
  selectedYear: null,
  expanded: {},

  entries() {
    window.APP_DATA.gameShooting = window.APP_DATA.gameShooting || [];
    return window.APP_DATA.gameShooting;
  },

  // Remembered locations — own separate list, same pattern as Clay Shooting.
  locations() {
    window.APP_DATA.gameLocations = window.APP_DATA.gameLocations || [];
    return window.APP_DATA.gameLocations;
  },
  addLocation(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    const locations = this.locations();
    if (!locations.includes(trimmed)) locations.push(trimmed);
    return trimmed;
  },

  open() {
    this.selectedYear = currentSeasonLabel("game");
    this.render();
  },

  toggleExpand(idx) {
    this.expanded[idx] = !this.expanded[idx];
    this.renderBody();
  },

  dayTotals(day) {
    const shotsTaken = (day.species || []).reduce((s, l) => s + (parseInt(l.shotsTaken, 10) || 0), 0);
    const hits = (day.species || []).reduce((s, l) => s + (parseInt(l.hits, 10) || 0), 0);
    const pct = shotsTaken > 0 ? Math.round((hits / shotsTaken) * 100) : 0;
    return { shotsTaken, hits, pct };
  },

  addDay() {
    this.entries().push({
      date: new Date().toISOString().slice(0, 10),
      location: this.locations()[0] || "",
      gunsStanding: 1,
      species: [{ species: GAME_BIRD_LIST[0], shotsTaken: 0, hits: 0 }],
    });
    this.saveAndRender();
  },

  removeDay(idx) {
    if (!confirm("Remove this day? This can't be undone.")) return;
    this.entries().splice(idx, 1);
    this.saveAndRender();
  },

  updateDay(idx, field, value) {
    this.entries()[idx][field] = value;
    this.saveAndRender();
  },

  handleLocationChange(idx, selectEl) {
    if (selectEl.value === "__add_new__") {
      const name = prompt("New location name:");
      const added = this.addLocation(name);
      if (added) this.updateDay(idx, "location", added);
      else this.render();
      return;
    }
    this.updateDay(idx, "location", selectEl.value);
  },

  addSpeciesLine(dayIdx) {
    this.entries()[dayIdx].species.push({ species: GAME_BIRD_LIST[0], shotsTaken: 0, hits: 0 });
    this.saveAndRender();
  },
  removeSpeciesLine(dayIdx, lineIdx) {
    this.entries()[dayIdx].species.splice(lineIdx, 1);
    this.saveAndRender();
  },
  updateSpeciesLine(dayIdx, lineIdx, field, value) {
    this.entries()[dayIdx].species[lineIdx][field] = value;
    this.saveAndRender();
  },

  saveAndRender() { persistData(); this.render(); },

  setYear(year) { this.selectedYear = year; this.render(); },

  // ---------- Category totals across all days in a season (birds shot/hits) ----------
  categoryTotalsFor(days) {
    const totals = {};
    GAME_BIRD_LIST.forEach((b) => { totals[b] = 0; });
    days.forEach((day) => {
      (day.species || []).forEach((l) => {
        if (totals[l.species] === undefined) return;
        totals[l.species] += parseInt(l.hits, 10) || 0;
      });
    });
    return totals;
  },

  render() {
    const overlay = document.getElementById("modalOverlay");
    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">← Back</button>
          <h3>Game Shooting</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
        </div>
        <div class="species-tabs">
          <button class="tab-btn" onclick="ReferenceInfo.gameSeasons()">📅 View game seasons</button>
        </div>
        <div id="gameShootingBody"></div>
      </div>`;
    overlay.classList.remove("hidden");
    this.renderBody();
  },

  renderBody() {
    document.getElementById("gameShootingBody").innerHTML = this.renderOverview() + this.renderDayList();
  },

  renderOverview() {
    const days = this.entries();
    const years = seasonYearsFor(days, "game");
    if (!years.includes(this.selectedYear)) this.selectedYear = years[0];
    const yearDays = days.filter((d) => seasonLabelFor(d.date, "game") === this.selectedYear);

    const allTimeTotal = days.reduce((s, d) => s + this.dayTotals(d).hits, 0);
    const totals = this.categoryTotalsFor(yearDays);
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

    return `
      ${renderStatCards([{ value: allTimeTotal, label: "Overall total (all years)" }])}
      <p class="hint">${seasonHintFor("game")}</p>
      <div class="species-tabs">${renderYearTabs(years, this.selectedYear, "game", "GameShooting.setYear")}</div>
      ${renderStatCards([{ value: grandTotal, label: "Total — season " + this.selectedYear }])}
      <div style="margin-top:10px;">${renderCategoryTable(totals, grandTotal)}</div>
      <button class="btn small" style="margin-top:10px;" onclick="GameShooting.addDay()">+ Add day</button>`;
  },

  renderDayList() {
    const days = this.entries();
    const locations = this.locations();
    const rows = days
      .map((day, idx) => {
        const t = this.dayTotals(day);

        if (!this.expanded[idx]) {
          return `
      <div class="log-row-card compact-row" onclick="GameShooting.toggleExpand(${idx})" style="cursor:pointer;">
        <div class="log-row compact-summary">
          <span>${day.date}</span>
          <span>${day.location || ""}</span>
          <span>${t.hits} shot</span>
        </div>
      </div>`;
        }

        const speciesRows = (day.species || [])
          .map((line, lineIdx) => `
        <div class="log-row">
          <select onchange="GameShooting.updateSpeciesLine(${idx},${lineIdx},'species',this.value)">
            ${GAME_BIRD_LIST.map((b) => `<option ${b === line.species ? "selected" : ""}>${b}</option>`).join("")}
          </select>
          <input type="number" min="0" placeholder="Shots taken" value="${line.shotsTaken}" onchange="GameShooting.updateSpeciesLine(${idx},${lineIdx},'shotsTaken',this.value)" style="width:100px;" />
          <input type="number" min="0" placeholder="Shot (hits)" value="${line.hits}" onchange="GameShooting.updateSpeciesLine(${idx},${lineIdx},'hits',this.value)" style="width:100px;" />
          <button class="icon-btn" onclick="GameShooting.removeSpeciesLine(${idx},${lineIdx})">✕</button>
        </div>`)
          .join("");

        return `
      <div class="log-row-card">
        <div class="log-row" style="justify-content:flex-end;"><button class="icon-btn" onclick="GameShooting.toggleExpand(${idx})">▲ Collapse</button></div>
        <div class="log-row">
          <input type="date" value="${day.date}" onchange="GameShooting.updateDay(${idx},'date',this.value)" />
          <select onchange="GameShooting.handleLocationChange(${idx}, this)">
            <option value="" ${!day.location ? "selected" : ""}>Location…</option>
            ${locations.map((l) => `<option ${l === day.location ? "selected" : ""}>${l}</option>`).join("")}
            <option value="__add_new__">+ Add new location…</option>
          </select>
        </div>
        <div class="log-row">
          <input type="number" min="0" placeholder="Guns standing" value="${day.gunsStanding}" onchange="GameShooting.updateDay(${idx},'gunsStanding',this.value)" style="width:130px;" />
        </div>
        <div class="section-title" style="margin-top:10px;"><h4>Species shot today</h4></div>
        ${speciesRows}
        <button class="btn small ghost" onclick="GameShooting.addSpeciesLine(${idx})">+ Add species</button>
        <div class="log-row" style="margin-top:10px;">
          <span class="hint" style="margin:0;">Day total: ${t.hits} shot / ${t.shotsTaken} shots taken</span>
        </div>
        <div class="stat-cards" style="margin-top:6px;">
          <div class="stat-card"><div class="num">${t.pct}%</div><div class="lbl">Your shots-to-hits ratio</div></div>
          <div class="stat-card"><div class="num">${t.pct}%</div><div class="lbl">Whole day ratio</div></div>
        </div>
        <button class="icon-btn" onclick="GameShooting.removeDay(${idx})" style="margin-top:8px;">✕ Remove day</button>
      </div>`;
      })
      .join("");
    return `<div style="margin-top:8px;">${rows || '<p class="hint">No days logged yet — tap "+ Add day" above.</p>'}</div>`;
  },
};
