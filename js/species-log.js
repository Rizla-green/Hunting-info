/* =====================================================================
   SPECIES LOG — the shared template every pest/game section reuses
   (Fox, Rabbit, Rats, Squirrels, Winged Vermin, Game Shooting, Goats,
   Boar, Clay Shooting). Deer gets its own fuller Cull Record Log
   (separate module) but shares this drill-down structure.

   Structure (matches v3.9): a species landing page with two tabs —
   Overview (all-time total across every farm, year tabs, a category
   breakdown table for the selected year, "+ Add entry" right here) and
   Locations (a plain list of farms). Tapping a farm drills into that
   farm's own Overview (same idea, scoped to just this farm) with the
   entry log and By Field Name view underneath it.

   Each entry: {date, ampm, firearm, farmId, area, what3words, category,
                shots, photos, notes}
===================================================================== */

const SPECIES_SECTIONS = {
  fox:     { title: "Fox",           categories: ["Fox"] },
  rabbit:  { title: "Rabbit",        categories: ["Rabbit"] },
  rats:    { title: "Rats",          categories: ["Rat"] },
  squirrel:{ title: "Squirrels",     categories: ["Grey Squirrel"] },
  winged:  { title: "Winged Vermin", categories: ["Pigeon", "Crow", "Magpie"] },
  game:    { title: "Game Shooting", categories: ["Pheasant", "Partridge", "Duck"] },
  goats:   { title: "Goats",         categories: ["Goat"] },
  boar:    { title: "Boar",          categories: ["Boar"] },
  clay:    { title: "Clay Shooting", categories: ["Clay"] },
};

// Species with GPS/what3words shot-location support — expanded per spec.
const W3W_SPECIES = ["deer", "fox", "goat", "boar", "squirrel"];

const SpeciesLog = {
  currentSection: null,
  topTab: "overview",      // 'overview' | 'locations'
  currentFarmId: null,     // null = species-wide Overview; set = drilled into one farm
  selectedYear: null,
  subView: "log",          // within a farm: 'log' | 'by-field'

  open(sectionKey) {
    this.currentSection = sectionKey;
    this.topTab = "overview";
    this.currentFarmId = null;
    this.selectedYear = currentSeasonLabel(sectionKey);
    this.subView = "log";
    this.render();
  },

  entries() {
    window.APP_DATA.species = window.APP_DATA.species || {};
    window.APP_DATA.species[this.currentSection] = window.APP_DATA.species[this.currentSection] || [];
    return window.APP_DATA.species[this.currentSection];
  },

  scopedEntries() {
    if (!this.currentFarmId) return this.entries();
    return this.entries().filter((e) => (e.farmId || "other") === this.currentFarmId);
  },

  farmName(farmId) {
    if (!farmId || farmId === "other") return "Other";
    return (window.APP_DATA.farms || []).find((f) => f.id === farmId)?.name || "Other";
  },

  addEntry() {
    const def = SPECIES_SECTIONS[this.currentSection];
    const farms = window.APP_DATA.farms || [];
    this.entries().push({
      date: new Date().toISOString().slice(0, 10),
      ampm: "AM",
      farmId: this.currentFarmId || farms[0]?.id || "other",
      area: "",
      what3words: "",
      lat: null,
      lng: null,
      category: def.categories[0],
      shots: 1,
      firearm: "",
      photos: [],
      notes: "",
    });
    this.saveAndRender();
  },

  // Camera → GPS → what3words → auto-match to a farm boundary, falling
  // back to "Other" when the point doesn't land inside any drawn farm.
  // Photo saves locally immediately, then uploads to Cloudinary in the
  // background — see cloudinary-upload.js for the offline-retry logic.
  addEntryFromCamera(inputEl) {
    LocationMatch.captureWithCamera(inputEl, (photoDataUrl, loc) => {
      const def = SPECIES_SECTIONS[this.currentSection];
      const farms = window.APP_DATA.farms || [];
      const entry = {
        date: new Date().toISOString().slice(0, 10),
        ampm: "AM",
        farmId: loc ? loc.farmId : this.currentFarmId || farms[0]?.id || "other",
        area: "",
        what3words: loc ? loc.what3words : "",
        lat: loc ? loc.lat : null,
        lng: loc ? loc.lng : null,
        category: def.categories[0],
        shots: 1,
        firearm: "",
        photos: [photoDataUrl],
        notes: "",
      };
      this.entries().push(entry);
      this.saveAndRender();
      uploadAndReplace(entry.photos, 0);
    });
  },

  removeEntry(idx) {
    if (!confirm("Remove this entry? This can't be undone.")) return;
    this.entries().splice(idx, 1);
    this.saveAndRender();
  },

  updateEntry(idx, field, value) {
    this.entries()[idx][field] = value;
    this.saveAndRender();
  },

  firearmOptionsHtml(selected) {
    const opts = Firearms.list().map((f) => `<option ${f === selected ? "selected" : ""}>${f}</option>`).join("");
    return opts + `<option value="__add_new__">+ Add new firearm…</option>`;
  },

  handleFirearmChange(idx, selectEl) {
    if (selectEl.value === "__add_new__") {
      const added = Firearms.addInline();
      if (added) this.updateEntry(idx, "firearm", added);
      else this.render();
      return;
    }
    this.updateEntry(idx, "firearm", selectEl.value);
  },

  saveAndRender() {
    persistData();
    this.render();
  },

  setTopTab(tab) { this.topTab = tab; this.render(); },
  setYear(year) { this.selectedYear = year; this.render(); },
  drillIntoFarm(farmId) {
    this.currentFarmId = farmId;
    this.topTab = "overview";
    this.subView = "log";
    this.render();
  },
  backToSpeciesWide() {
    this.currentFarmId = null;
    this.topTab = "overview";
    this.render();
  },
  setSubView(view) { this.subView = view; this.render(); },

  groupByField() {
    const groups = {};
    this.scopedEntries().forEach((e) => {
      const key = e.area || "(no field name)";
      groups[key] = groups[key] || [];
      groups[key].push(e);
    });
    return groups;
  },

  render() {
    const def = SPECIES_SECTIONS[this.currentSection];
    const overlay = document.getElementById("modalOverlay");
    const w3wEnabled = W3W_SPECIES.includes(this.currentSection);
    const inFarm = !!this.currentFarmId;

    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <h3>${def.title}${inFarm ? " — " + this.farmName(this.currentFarmId) : ""}</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">✕</button>
        </div>
        ${inFarm ? `<button class="tab-btn" onclick="SpeciesLog.backToSpeciesWide()">← All farms</button>` : ""}
        <div class="species-tabs">
          <button class="tab-btn ${this.topTab === "overview" ? "active" : ""}" onclick="SpeciesLog.setTopTab('overview')">Overview</button>
          ${!inFarm ? `<button class="tab-btn ${this.topTab === "locations" ? "active" : ""}" onclick="SpeciesLog.setTopTab('locations')">Locations</button>` : ""}
          ${!inFarm && w3wEnabled ? `<button class="tab-btn" onclick="ShotLocationMap.open('${this.currentSection}', null)">📍 Map (all farms)</button>` : ""}
          ${inFarm && w3wEnabled ? `<button class="tab-btn" onclick="ShotLocationMap.open('${this.currentSection}', '${this.currentFarmId}')">📍 Map</button>` : ""}
          ${this.currentSection === "fox" ? `<button class="tab-btn" onclick="ReferenceInfo.foxBoarLifecycle('Fox')">Lifecycle</button>` : ""}
          ${this.currentSection === "boar" ? `<button class="tab-btn" onclick="ReferenceInfo.foxBoarLifecycle('Wild boar')">Lifecycle</button><button class="tab-btn" onclick="ReferenceInfo.boarDisease()">Disease</button>` : ""}
          ${this.currentSection === "game" ? `<button class="tab-btn" onclick="ReferenceInfo.gameSeasons()">Game Seasons</button>` : ""}
          ${this.currentSection === "winged" ? `<button class="tab-btn" onclick="ReferenceInfo.generalLicences()">General Licences</button>` : ""}
        </div>
        <div id="speciesLogBody"></div>
      </div>`;
    overlay.classList.remove("hidden");
    this.renderBody();
  },

  renderBody() {
    const body = document.getElementById("speciesLogBody");
    body.innerHTML = this.topTab === "locations" ? this.renderLocationsList() : this.renderOverview();
  },

  renderLocationsList() {
    const farms = window.APP_DATA.farms || [];
    const buttons = farms
      .map((f) => `<button class="btn secondary" onclick="SpeciesLog.drillIntoFarm('${f.id}')">${f.name}</button>`)
      .join("");
    const otherHasEntries = this.entries().some((e) => !e.farmId || e.farmId === "other");
    return `<div class="farm-list">${buttons}
      ${otherHasEntries ? `<button class="btn secondary" onclick="SpeciesLog.drillIntoFarm('other')">Other (unmatched location)</button>` : ""}
      </div>`;
  },

  renderOverview() {
    const scoped = this.scopedEntries();
    const years = seasonYearsFor(scoped, this.currentSection);
    if (!years.includes(this.selectedYear)) this.selectedYear = years[0];
    const def = SPECIES_SECTIONS[this.currentSection];
    const yearEntries = scoped.filter((e) => seasonLabelFor(e.date, this.currentSection) === this.selectedYear);

    const totals = {};
    yearEntries.forEach((e) => { totals[e.category] = (totals[e.category] || 0) + (parseInt(e.shots, 10) || 1); });
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

    const yearTabs = years
      .map((y) => `<button class="tab-btn ${y === this.selectedYear ? "active" : ""}" onclick="SpeciesLog.setYear('${y}')">${y}</button>`)
      .join("");

    const totalsRows = def.categories
      .map((c) => `<div class="grouped-row"><span>${c}</span><span>${totals[c] || 0}</span></div>`)
      .join("");

    const allTimeTotal = scoped.reduce((sum, e) => sum + (parseInt(e.shots, 10) || 1), 0);

    let html = `
      <div class="overview-alltime">All-time total: <strong>${allTimeTotal}</strong></div>
      <div class="species-tabs" style="margin-top:8px;">${yearTabs}</div>
      <div class="grouped-block" style="margin-top:10px;">
        ${totalsRows}
        <div class="grouped-row" style="border-top:1px solid var(--gold-dim); font-weight:bold;"><span>All categories</span><span>${grandTotal}</span></div>
      </div>
      <button class="btn small" onclick="SpeciesLog.addEntry()">+ Add entry</button>
      ${W3W_SPECIES.includes(this.currentSection) ? `
      <label class="btn small ghost" style="display:inline-block; margin-left:8px; cursor:pointer;">
        📷 Add via camera
        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="SpeciesLog.addEntryFromCamera(this)" />
      </label>` : ""}
      <div class="species-tabs" style="margin-top:14px;">
        <button class="tab-btn ${this.subView === "log" ? "active" : ""}" onclick="SpeciesLog.setSubView('log')">Entry Log</button>
        <button class="tab-btn ${this.subView === "by-field" ? "active" : ""}" onclick="SpeciesLog.setSubView('by-field')">By Field Name</button>
      </div>
      <div style="margin-top:8px;">${this.subView === "log" ? this.renderFlatLog() : this.renderGroupedByField()}</div>`;

    return html;
  },

  renderFlatLog() {
    const entries = this.scopedEntries();
    const def = SPECIES_SECTIONS[this.currentSection];
    const w3wEnabled = W3W_SPECIES.includes(this.currentSection);
    const farms = window.APP_DATA.farms || [];
    const showFarmColumn = !this.currentFarmId;
    const rows = entries
      .map((e) => {
        const idx = this.entries().indexOf(e);
        return `
      <div class="log-row">
        <input type="date" value="${e.date}" onchange="SpeciesLog.updateEntry(${idx},'date',this.value)" />
        ${showFarmColumn ? `
        <select onchange="SpeciesLog.updateEntry(${idx},'farmId',this.value)">
          ${farms.map((f) => `<option value="${f.id}" ${f.id === (e.farmId || "other") ? "selected" : ""}>${f.name}</option>`).join("")}
          <option value="other" ${(e.farmId || "other") === "other" ? "selected" : ""}>Other</option>
        </select>` : ""}
        <select onchange="SpeciesLog.updateEntry(${idx},'category',this.value)">
          ${def.categories.map((c) => `<option ${c === e.category ? "selected" : ""}>${c}</option>`).join("")}
        </select>
        <input type="text" placeholder="Field / area" value="${e.area || ""}" onchange="SpeciesLog.updateEntry(${idx},'area',this.value)" />
        ${w3wEnabled ? `<input type="text" placeholder="///what3words" value="${e.what3words || ""}" onchange="SpeciesLog.updateEntry(${idx},'what3words',this.value)" />` : ""}
        <input type="number" min="0" value="${e.shots}" onchange="SpeciesLog.updateEntry(${idx},'shots',this.value)" style="width:60px;" />
        <select onchange="SpeciesLog.handleFirearmChange(${idx}, this)">
          <option value="" ${!e.firearm ? "selected" : ""}>Firearm…</option>
          ${this.firearmOptionsHtml(e.firearm)}
        </select>
        <input type="text" placeholder="Notes" value="${e.notes || ""}" onchange="SpeciesLog.updateEntry(${idx},'notes',this.value)" />
        <button class="icon-btn" onclick="SpeciesLog.removeEntry(${idx})">✕</button>
      </div>`;
      })
      .join("");
    return rows || '<p class="hint">No entries yet — tap "+ Add entry" above to log one.</p>';
  },

  renderGroupedByField() {
    const groups = this.groupByField();
    const keys = Object.keys(groups);
    if (keys.length === 0) return '<p class="hint">No entries yet.</p>';
    return keys
      .map((key) => {
        const list = groups[key];
        const rows = list.map((e) => `<div class="grouped-row"><span>${e.date}</span><span>${e.category}</span><span>${e.shots} shots</span></div>`).join("");
        return `<div class="grouped-block"><h4>${key} <span class="grouped-count">(${list.length})</span></h4>${rows}</div>`;
      })
      .join("");
  },
};
