/* =====================================================================
   GAME SHOOTING — day-based entries. Each entry represents a whole
   day: a Shoot name, one or more species lines (each with Shot/hits
   THEN Shots taken — hits comes first since that's the count that
   matters), a Guns standing headcount, a what3words location (for
   weather), and a remembered-location dropdown (own separate list,
   same pattern as Clay Shooting). A separate DAY TOTAL block lets Ben
   jot down a rough species-by-species tally for the day (every game
   species + Teal + an Other line) — this is informal record-keeping
   only and never feeds into any running total elsewhere in the app.
   Day totals (from the real species lines) are calculated
   automatically. Two ratios per day, both using the same total-shots-
   vs-total-bag numbers (confirmed). Adding/editing opens a genuine
   POPUP working on a DRAFT — nothing saves until Save is tapped.
   List view is a compact summary line; tap to reopen the popup.
   Every day carries Firearm, Notes, auto Weather, and a computed
   Moon phase. Reference button (Seasons) only shows on Overview.
===================================================================== */

const GameShooting = {
  selectedYear: null,
  draft: null,
  draftIdx: null,

  entries() {
    window.APP_DATA.gameShooting = window.APP_DATA.gameShooting || [];
    return window.APP_DATA.gameShooting;
  },

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

  // Shots fired that day — ONE figure for the whole day. Days saved before this was a single box
  // still have the figure spread across their species lines; those are added up until the day is
  // edited and a single figure is entered.
  dayShotsTaken(day) {
    if (day.shotsTaken !== undefined && day.shotsTaken !== null && day.shotsTaken !== "") return parseInt(day.shotsTaken, 10) || 0;
    return (day.species || []).reduce((s, l) => s + (parseInt(l.shotsTaken, 10) || 0), 0);
  },

  dayTotals(day) {
    const shotsTaken = this.dayShotsTaken(day);
    const hits = (day.species || []).reduce((s, l) => s + (parseInt(l.hits, 10) || 0), 0);
    const pct = shotsTaken > 0 ? Math.round((hits / shotsTaken) * 100) : 0;
    return { shotsTaken, hits, pct };
  },

  newDayDefaults() {
    const dayTotal = {};
    GAME_BIRD_LIST.forEach((b) => { dayTotal[b] = 0; });
    const DEFAULT_THREE = ["Pheasant", "French partridge", "Mallard"];
    return {
      date: new Date().toISOString().slice(0, 10),
      shootName: "",
      location: this.locations()[0] || "",
      what3words: "", lat: null, lng: null, weather: "",
      gunsStanding: 1, // "Total guns" in the Day Total block
      firearm: "", notes: "",
      locationNotes: "",
      shotsTaken: "",   // ONE figure for the whole day, blank until entered
      species: DEFAULT_THREE.map((s) => ({ species: s, hits: 0 })),
      dayTotalShots: 0, // "Total shots" in the Day Total block
      // Rough species-by-species tally for the day only — never feeds any running total elsewhere.
      dayTotal: DEFAULT_THREE.map((s) => ({ species: s, amount: 0 })),
    };
  },

  openAddPopup() {
    this.draft = this.newDayDefaults();
    this.draftIdx = null;
    Popup.open(this.renderPopupBody(), () => this.renderBody());
  },
  openEditPopup(idx) {
    const day = this.entries()[idx];
    this.draft = { ...day, dayTotal: (day.dayTotal || []).map((l) => ({ ...l })) };
    if (this.draft.dayTotalShots === undefined) this.draft.dayTotalShots = 0;
    this.draftIdx = idx;
    Popup.open(this.renderPopupBody(), () => this.renderBody());
  },
  updateDraft(field, value) {
    this.draft[field] = value;
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },
  updateDayTotalLine(lineIdx, field, value) {
    this.draft.dayTotal[lineIdx][field] = value;
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },
  addDayTotalLine() {
    this.draft.dayTotal.push({ species: GAME_BIRD_LIST[0], amount: 0 });
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },
  removeDayTotalLine(lineIdx) {
    this.draft.dayTotal.splice(lineIdx, 1);
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },

  saveDraft() {
    if (this.draftIdx === null) this.entries().push(this.draft);
    else this.entries()[this.draftIdx] = this.draft;
    persistData();
    this.selectedYear = seasonLabelFor(this.draft.date, "game"); // the list moves to the saved entry's year so it doesn't seem to vanish
    Popup.dirty = false;
    this.draft = null;
    this.draftIdx = null;
    Popup.close();
  },
  removeDraft() {
    if (this.draftIdx === null) { Popup.dirty = false; Popup.close(); return; }
    if (!confirm("Remove this day? This can't be undone.")) return;
    this.entries().splice(this.draftIdx, 1);
    persistData();
    Popup.dirty = false;
    this.draft = null;
    this.draftIdx = null;
    Popup.close();
  },

  handleLocationChange(selectEl) {
    if (selectEl.value === "__add_new__") {
      const name = prompt("New location name:");
      const added = this.addLocation(name);
      if (added) this.updateDraft("location", added);
      else Popup.setBody(this.renderPopupBody());
      return;
    }
    this.updateDraft("location", selectEl.value);
  },
  handleFirearmChange(selectEl) {
    if (selectEl.value === "__add_new__") {
      const added = Firearms.addInline();
      if (added) this.updateDraft("firearm", added);
      else Popup.setBody(this.renderPopupBody());
      return;
    }
    this.updateDraft("firearm", selectEl.value);
  },
  captureW3w() {
    LocationMatch.captureLocation(async (loc) => {
      if (!loc) return;
      if (loc.what3words) this.draft.what3words = loc.what3words; // a failed lookup never wipes words already there
      this.draft.lat = loc.lat;
      this.draft.lng = loc.lng;
      Popup.markDirty();
      Popup.setBody(this.renderPopupBody());
      this.draft.weather = await fetchWeatherForEntry(loc.lat, loc.lng, this.draft.date);
      Popup.setBody(this.renderPopupBody());
    });
  },

  addSpeciesLine() {
    this.draft.species.push({ species: GAME_BIRD_LIST[0], hits: 0 });
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },
  removeSpeciesLine(lineIdx) {
    this.draft.species.splice(lineIdx, 1);
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },
  updateSpeciesLine(lineIdx, field, value) {
    this.draft.species[lineIdx][field] = value;
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },

  setYear(year) { this.selectedYear = year; this.render(); },

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
      <div class="species-tabs"><button class="tab-btn" onclick="ReferenceInfo.gameSeasons()">📅 View game seasons</button></div>
      ${renderStatCards([{ value: allTimeTotal, label: "Overall total (all years)" }])}
      <p class="hint">${seasonHintFor("game")}</p>
      <div class="species-tabs">${renderYearTabs(years, this.selectedYear, "game", "GameShooting.setYear")}</div>
      ${renderStatCards([{ value: grandTotal, label: "Total — season " + this.selectedYear }])}
      <div style="margin-top:10px;">${renderCategoryTable(totals, grandTotal)}</div>
      <button class="btn small" style="margin-top:10px;" onclick="GameShooting.openAddPopup()">+ Add day</button>`;
  },

  renderDayList() {
    const days = this.entries();
    const inYear = new Set(listInYear(days, "game", this.selectedYear)); // the year buttons above are the Overview's
    const rows = days
      .map((day, idx) => {
        if (!inYear.has(day)) return "";
        const t = this.dayTotals(day);
        return `
      <div class="log-row-card compact-row" onclick="GameShooting.openEditPopup(${idx})" style="cursor:pointer;">
        <div class="log-row compact-summary cs-g">
          <span>${displayDate(day.date)}</span>
          <span>${day.shootName || day.location || ""}</span>
          <span>${t.hits} shot</span>
        </div>
      </div>`;
      })
      .join("");
    const empty = !days.length ? '<p class="hint">No days logged yet — tap "+ Add day" above.</p>' : (!rows.trim() ? listEmptyYearHtml(days, "game", this.selectedYear) : "");
    return `<div style="margin-top:8px;">${rows}${empty}</div>`;
  },

  // ---------- The popup editor for a single day (draft) ----------
  renderPopupBody() {
    const day = this.draft;
    const t = this.dayTotals(day);
    const locations = this.locations();

    const speciesRows = (day.species || [])
      .map((line, lineIdx) => `
        <div class="log-row">
          ${Popup.labeled("Species", `<select onchange="GameShooting.updateSpeciesLine(${lineIdx},'species',this.value)">
            ${GAME_BIRD_LIST.map((b) => `<option ${b === line.species ? "selected" : ""}>${b}</option>`).join("")}
          </select>`)}
          ${Popup.labeled("Shot", `<input type="number" min="0" placeholder="Shot" value="${line.hits}" onchange="GameShooting.updateSpeciesLine(${lineIdx},'hits',this.value)" style="width:90px;" />`, "flex:none;")}
          <button class="icon-btn" style="align-self:flex-end;" onclick="GameShooting.removeSpeciesLine(${lineIdx})">✕</button>
        </div>`)
      .join("");

    const dayTotalRows = (day.dayTotal || [])
      .map((line, lineIdx) => `
        <div class="log-row">
          ${Popup.labeled("Species", `<select onchange="GameShooting.updateDayTotalLine(${lineIdx},'species',this.value)">
            ${[...GAME_BIRD_LIST, "Other"].map((sp) => `<option ${sp === line.species ? "selected" : ""}>${sp}</option>`).join("")}
          </select>`)}
          ${Popup.labeled("Day total", `<input type="number" min="0" value="${line.amount || 0}" onchange="GameShooting.updateDayTotalLine(${lineIdx},'amount',this.value)" style="width:80px;" />`, "flex:none;")}
          <button class="icon-btn" style="align-self:flex-end;" onclick="GameShooting.removeDayTotalLine(${lineIdx})">✕</button>
        </div>`)
      .join("");

    let html = Popup.header("Game Shooting Day");
    html += `<div style="padding:0 16px 16px;">`;
    html += `<div class="log-row">
      ${Popup.labeled("Date", `${DateInput.html(day.date, "GameShooting.updateDraft('date', v)")}`)}
      ${Popup.labeled("Shoot name", `<input type="text" placeholder="Shoot name" value="${day.shootName || ""}" onchange="GameShooting.updateDraft('shootName',this.value)" />`)}
    </div>`;
    html += `<div class="log-row">
      ${Popup.labeled("Location", `<select onchange="GameShooting.handleLocationChange(this)">
        <option value="" ${!day.location ? "selected" : ""}>Location…</option>
        ${Places.optionsHtml(day.location)}
        <option value="__add_new__">+ Add new location…</option>
      </select>`)}
    </div>`;
    html += `<div class="log-row">
      ${Popup.labeled("what3words", `<input type="text" placeholder="///what3words" value="${day.what3words || ""}" onchange="GameShooting.updateDraft('what3words',this.value)" />`)}
      <button class="btn small ghost" onclick="GameShooting.captureW3w()">📍 Auto</button>
    </div>`;
    html += `<div class="log-row"><span class="hint" style="margin:0;">🌦️ Weather: ${day.weather || "— (set a location to auto-fill)"}</span></div>`;
    html += `<div class="log-row"><span class="hint" style="margin:0;">${moonPhaseLabel(day.date) || ""} (that night)</span></div>`;
    html += `<div class="log-row">
      ${Popup.labeled("Firearm", `<select onchange="GameShooting.handleFirearmChange(this)">
        <option value="" ${!day.firearm ? "selected" : ""}>Firearm…</option>
        ${Firearms.list().map((f) => `<option ${f === day.firearm ? "selected" : ""}>${f}</option>`).join("")}
        <option value="__add_new__">+ Add new firearm…</option>
      </select>`)}
    </div>`;
    html += `<div class="log-row">${Popup.labeled("Location notes", `<input type="text" placeholder="On-the-ground spot description" value="${day.locationNotes || ""}" onchange="GameShooting.updateDraft('locationNotes',this.value)" />`)}</div>`;
    html += `<div class="log-row">${Popup.labeled("Notes", `<input type="text" placeholder="Notes" value="${day.notes || ""}" onchange="GameShooting.updateDraft('notes',this.value)" />`)}</div>`;

    html += `<div class="section-title" style="margin-top:12px;"><h4>Species shot today</h4></div>`;
    html += speciesRows;
    html += `<button class="btn small ghost" onclick="GameShooting.addSpeciesLine()">+ Add species</button>`;
    html += `<div class="log-row" style="margin-top:8px;">${Popup.labeled("Shots taken (whole day)", `<input type="number" min="0" placeholder="Shots taken" value="${day.shotsTaken !== undefined && day.shotsTaken !== null && day.shotsTaken !== "" ? day.shotsTaken : (t.shotsTaken || "")}" onchange="GameShooting.updateDraft('shotsTaken',this.value)" />`)}</div>`;
    html += `<div class="log-row" style="margin-top:10px;"><span class="hint" style="margin:0;">Calculated from the table above: ${t.hits} shot / ${t.shotsTaken} shots taken</span></div>`;
    html += `<div class="stat-cards" style="margin-top:6px;">
      <div class="stat-card"><div class="num">${t.pct}%</div><div class="lbl">Your shots-to-hits ratio</div></div>
      <div class="stat-card"><div class="num">${t.pct}%</div><div class="lbl">Whole day ratio</div></div>
    </div>`;

    html += `<div class="section-title" style="margin-top:16px;"><h4>Day total (rough tally)</h4></div>`;
    html += `<p class="hint" style="margin-top:0;">Just for this day — doesn't count towards any tally elsewhere.</p>`;
    html += `<div class="log-row">
      <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Total shots</span>
        <input type="number" min="0" value="${day.dayTotalShots || 0}" onchange="GameShooting.updateDraft('dayTotalShots',this.value)" />
      </label>
      <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Total guns</span>
        <input type="number" min="0" value="${day.gunsStanding || 0}" onchange="GameShooting.updateDraft('gunsStanding',this.value)" />
      </label>
    </div>`;
    html += dayTotalRows;
    html += `<button class="btn small ghost" onclick="GameShooting.addDayTotalLine()">+ Add species</button>`;

    html += `${Popup.removeFooter("GameShooting.removeDraft()", "Remove day")}`;
    html += Popup.saveFooter("GameShooting.saveDraft()");
    html += `</div>`;
    return html;
  },
};
