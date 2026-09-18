/* =====================================================================
   GAME SHOOTING — day-based entries. Each entry represents a whole
   day, not one bird: one or more species lines (each with shots taken
   and shot/hits), a Guns standing headcount, a what3words location
   (for the auto weather lookup) and a remembered-location dropdown
   (same pattern as Clay Shooting/Zeroing — its own separate list).
   Day totals (total shot, total shots taken) are calculated
   automatically. Two ratios per day, both using the same total-shots-
   vs-total-bag numbers, just shown as two framings (confirmed — see
   spec). The old "log an incidental Fox/Squirrel/corvid kill without
   leaving Game Shooting" feature has been DROPPED per Ben's decision —
   incidental kills are now logged normally under their own section.
   Adding/editing a day always opens a genuine POPUP (never inline).
   List view is a compact summary line — Date, Location, day's total
   shot; tap to reopen the popup. Every day also carries Firearm (from
   the shared Firearms list), Notes, an auto-filled Weather line, and
   a computed Moon phase for that night.
===================================================================== */

const GameShooting = {
  selectedYear: null,
  popupIdx: null,   // index of the day currently open in the popup editor, or null

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
    this.popupIdx = null;
    this.render();
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
      what3words: "",
      lat: null,
      lng: null,
      weather: "",
      gunsStanding: 1,
      firearm: "",
      notes: "",
      species: [{ species: GAME_BIRD_LIST[0], shotsTaken: 0, hits: 0 }],
    });
    this.popupIdx = this.entries().length - 1;
    persistData();
    this.render();
  },

  removeDay(idx) {
    if (!confirm("Remove this day? This can't be undone.")) return;
    this.entries().splice(idx, 1);
    this.popupIdx = null;
    persistData();
    this.render();
  },

  updateDay(idx, field, value) {
    this.entries()[idx][field] = value;
    this.saveAndRenderPopup(idx);
  },

  handleLocationChange(idx, selectEl) {
    if (selectEl.value === "__add_new__") {
      const name = prompt("New location name:");
      const added = this.addLocation(name);
      if (added) this.updateDay(idx, "location", added);
      else this.saveAndRenderPopup(idx);
      return;
    }
    this.updateDay(idx, "location", selectEl.value);
  },

  handleFirearmChange(idx, selectEl) {
    if (selectEl.value === "__add_new__") {
      const added = Firearms.addInline();
      if (added) this.updateDay(idx, "firearm", added);
      else this.saveAndRenderPopup(idx);
      return;
    }
    this.updateDay(idx, "firearm", selectEl.value);
  },

  captureW3w(idx) {
    LocationMatch.captureLocation(async (loc) => {
      if (!loc) return;
      const day = this.entries()[idx];
      day.what3words = loc.what3words;
      day.lat = loc.lat;
      day.lng = loc.lng;
      this.saveAndRenderPopup(idx);
      day.weather = await fetchWeatherForEntry(loc.lat, loc.lng, day.date);
      this.saveAndRenderPopup(idx);
    });
  },

  addSpeciesLine(dayIdx) {
    this.entries()[dayIdx].species.push({ species: GAME_BIRD_LIST[0], shotsTaken: 0, hits: 0 });
    this.saveAndRenderPopup(dayIdx);
  },
  removeSpeciesLine(dayIdx, lineIdx) {
    this.entries()[dayIdx].species.splice(lineIdx, 1);
    this.saveAndRenderPopup(dayIdx);
  },
  updateSpeciesLine(dayIdx, lineIdx, field, value) {
    this.entries()[dayIdx].species[lineIdx][field] = value;
    this.saveAndRenderPopup(dayIdx);
  },

  saveAndRender() { persistData(); this.render(); },
  saveAndRenderPopup(idx) {
    persistData();
    this.popupIdx = idx;
    const body = document.getElementById("gameShootingBody");
    if (body) body.innerHTML = this.renderDayPopup(idx);
  },

  setYear(year) { this.selectedYear = year; this.render(); },

  openDayPopup(idx) { this.popupIdx = idx; this.render(); },
  closeDayPopup() { this.popupIdx = null; this.render(); },

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

    if (this.popupIdx !== null && this.entries()[this.popupIdx]) {
      overlay.innerHTML = `<div class="modal-box species-modal-box"><div id="gameShootingBody"></div></div>`;
      overlay.classList.remove("hidden");
      document.getElementById("gameShootingBody").innerHTML = this.renderDayPopup(this.popupIdx);
      return;
    }

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
    const rows = days
      .map((day, idx) => {
        const t = this.dayTotals(day);
        return `
      <div class="log-row-card compact-row" onclick="GameShooting.openDayPopup(${idx})" style="cursor:pointer;">
        <div class="log-row compact-summary">
          <span>${day.date}</span>
          <span>${day.location || ""}</span>
          <span>${t.hits} shot</span>
        </div>
      </div>`;
      })
      .join("");
    return `<div style="margin-top:8px;">${rows || '<p class="hint">No days logged yet — tap "+ Add day" above.</p>'}</div>`;
  },

  // ---------- The popup editor for a single day ----------
  renderDayPopup(idx) {
    const day = this.entries()[idx];
    const t = this.dayTotals(day);
    const locations = this.locations();

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
      <div class="map-modal-header">
        <button class="icon-btn" onclick="GameShooting.closeDayPopup()">← Back</button>
        <h3>Game Shooting Day</h3>
        <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
      </div>
      <div class="log-row">
        <input type="date" value="${day.date}" onchange="GameShooting.updateDay(${idx},'date',this.value)" />
        <select onchange="GameShooting.handleLocationChange(${idx}, this)">
          <option value="" ${!day.location ? "selected" : ""}>Location…</option>
          ${locations.map((l) => `<option ${l === day.location ? "selected" : ""}>${l}</option>`).join("")}
          <option value="__add_new__">+ Add new location…</option>
        </select>
      </div>
      <div class="log-row">
        <input type="text" placeholder="///what3words" value="${day.what3words || ""}" onchange="GameShooting.updateDay(${idx},'what3words',this.value)" />
        <button class="btn small ghost" onclick="GameShooting.captureW3w(${idx})">📍 Auto</button>
      </div>
      <div class="log-row">
        <span class="hint" style="margin:0;">🌦️ Weather: ${day.weather || "— (set a location to auto-fill)"}</span>
      </div>
      <div class="log-row">
        <span class="hint" style="margin:0;">${moonPhaseLabel(day.date) || ""} (that night)</span>
      </div>
      <div class="log-row">
        <input type="number" min="0" placeholder="Guns standing" value="${day.gunsStanding}" onchange="GameShooting.updateDay(${idx},'gunsStanding',this.value)" style="width:130px;" />
      </div>
      <div class="log-row">
        <select onchange="GameShooting.handleFirearmChange(${idx}, this)">
          <option value="" ${!day.firearm ? "selected" : ""}>Firearm…</option>
          ${Firearms.list().map((f) => `<option ${f === day.firearm ? "selected" : ""}>${f}</option>`).join("")}
          <option value="__add_new__">+ Add new firearm…</option>
        </select>
      </div>
      <div class="log-row">
        <input type="text" placeholder="Notes" value="${day.notes || ""}" onchange="GameShooting.updateDay(${idx},'notes',this.value)" />
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
    `;
  },
};
