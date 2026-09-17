/* =====================================================================
   SPECIES LOG — shared template for pest/game sections.

   Fox, Boar, Goats now match v3.9's real structure:
     - Overview = totals only (all-time, year tabs, category breakdown).
       No adding entries here.
     - Locations = plain farm list. Drilling into a farm reveals that
       farm's own Overview *and* a separate Log tab — entries only ever
       get added from inside a farm's Log, never species-wide.
     - Entry fields match v3.9 exactly: Date, AM/PM, Category, Area,
       what3words (fox/boar/goat/squirrel only), Firearm, Shots,
       multiple Photos, Notes.

   Rabbit, Rats, Squirrel, Winged Vermin, Game Shooting, and Clay
   Shooting are UNCHANGED for now — REMINDER: these six still need the
   same old-software rework once their layout is confirmed. They keep
   the simpler flat structure (add-from-anywhere, single photo, no
   AM/PM) until then.
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

// Species with GPS/what3words shot-location support.
const W3W_SPECIES = ["deer", "fox", "goats", "boar", "squirrel"];

// Sections rebuilt to match v3.9's real structure (see header comment).
// REMINDER: rabbit, rats, squirrel, winged, game, clay still need this
// same treatment — ask Ben how he wants those laid out, then add their
// keys here.
const OLD_FLOW_SECTIONS = ["fox", "boar", "goats"];

const SpeciesLog = {
  currentSection: null,
  topTab: "overview",      // 'overview' | 'locations'
  currentFarmId: null,     // null = species-wide; set = drilled into one farm
  farmSubTab: "overview",  // old-flow only, once drilled in: 'overview' | 'log'
  selectedYear: null,
  subView: "log",          // 'log' | 'by-field'

  isOldFlow() { return OLD_FLOW_SECTIONS.includes(this.currentSection); },

  open(sectionKey) {
    this.currentSection = sectionKey;
    this.topTab = "overview";
    this.currentFarmId = null;
    this.farmSubTab = "overview";
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

  newEntryDefaults() {
    const def = SPECIES_SECTIONS[this.currentSection];
    const farms = window.APP_DATA.farms || [];
    return {
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
    };
  },

  addEntry() {
    this.entries().push(this.newEntryDefaults());
    this.saveAndRender();
  },

  // Camera → GPS → what3words → auto-match to a farm boundary, falling
  // back to "Other" when the point doesn't land inside any drawn farm
  // (for old-flow sections, already inside a specific farm, this just
  // confirms/keeps that farm rather than picking one from scratch).
  addEntryFromCamera(inputEl) {
    LocationMatch.captureWithCamera(inputEl, (photoDataUrl, loc) => {
      const entry = this.newEntryDefaults();
      if (loc) {
        entry.what3words = loc.what3words;
        entry.lat = loc.lat;
        entry.lng = loc.lng;
        if (!this.currentFarmId) entry.farmId = loc.farmId;
      }
      entry.photos = [photoDataUrl];
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

  // ---------- Multi-photo (old-flow) ----------
  addPhoto(idx, inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const entry = this.entries()[idx];
      entry.photos = entry.photos || [];
      entry.photos.push(reader.result);
      const photoIdx = entry.photos.length - 1;
      this.saveAndRender();
      uploadAndReplace(entry.photos, photoIdx);
    };
    reader.readAsDataURL(file);
  },
  removePhoto(idx, photoIdx) {
    if (!confirm("Remove this photo? This can't be undone.")) return;
    this.entries()[idx].photos.splice(photoIdx, 1);
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
  setFarmSubTab(tab) { this.farmSubTab = tab; this.render(); },
  drillIntoFarm(farmId) {
    this.currentFarmId = farmId;
    this.topTab = "overview";
    this.farmSubTab = "overview";
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
    const oldFlow = this.isOldFlow();

    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <h3>${def.title}${inFarm ? " — " + this.farmName(this.currentFarmId) : ""}</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">✕</button>
        </div>
        ${inFarm ? `<button class="tab-btn" onclick="SpeciesLog.backToSpeciesWide()">← All farms</button>` : ""}
        <div class="species-tabs">
          ${inFarm && oldFlow
            ? `<button class="tab-btn ${this.farmSubTab === "overview" ? "active" : ""}" onclick="SpeciesLog.setFarmSubTab('overview')">Overview</button>
               <button class="tab-btn ${this.farmSubTab === "log" ? "active" : ""}" onclick="SpeciesLog.setFarmSubTab('log')">Log</button>`
            : `<button class="tab-btn ${this.topTab === "overview" ? "active" : ""}" onclick="SpeciesLog.setTopTab('overview')">Overview</button>
               ${!inFarm ? `<button class="tab-btn ${this.topTab === "locations" ? "active" : ""}" onclick="SpeciesLog.setTopTab('locations')">Locations</button>` : ""}`}
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
    const inFarm = !!this.currentFarmId;

    if (inFarm && this.isOldFlow()) {
      body.innerHTML = this.farmSubTab === "log" ? this.renderLogSection() : this.renderTotalsOnly();
      return;
    }
    if (this.topTab === "locations") {
      body.innerHTML = this.renderLocationsList();
    } else if (this.isOldFlow()) {
      body.innerHTML = this.renderTotalsOnly(); // species-wide Overview, old-flow: totals only, no add button
    } else {
      body.innerHTML = this.renderLegacyOverview(); // unchanged sections keep add-from-anywhere
    }
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

  // ---------- Totals block, shared by both flows ----------
  totalsHtml() {
    const scoped = this.scopedEntries();
    const years = seasonYearsFor(scoped, this.currentSection);
    if (!years.includes(this.selectedYear)) this.selectedYear = years[0];
    const def = SPECIES_SECTIONS[this.currentSection];
    const yearEntries = scoped.filter((e) => seasonLabelFor(e.date, this.currentSection) === this.selectedYear);

    const totals = {};
    yearEntries.forEach((e) => { totals[e.category] = (totals[e.category] || 0) + (parseInt(e.shots, 10) || 1); });
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
    const allTimeTotal = scoped.reduce((sum, e) => sum + (parseInt(e.shots, 10) || 1), 0);

    const yearTabs = years
      .map((y) => `<button class="tab-btn ${y === this.selectedYear ? "active" : ""}" onclick="SpeciesLog.setYear('${y}')">${y}</button>`)
      .join("");
    const totalsRows = def.categories
      .map((c) => `<div class="grouped-row"><span>${c}</span><span>${totals[c] || 0}</span></div>`)
      .join("");

    return `
      <div class="overview-alltime">All-time total: <strong>${allTimeTotal}</strong></div>
      <div class="species-tabs" style="margin-top:8px;">${yearTabs}</div>
      <div class="grouped-block" style="margin-top:10px;">
        ${totalsRows}
        <div class="grouped-row" style="border-top:1px solid var(--gold-dim); font-weight:bold;"><span>All categories</span><span>${grandTotal}</span></div>
      </div>`;
  },

  // Old-flow Overview: totals only, nothing else — matches v3.9.
  renderTotalsOnly() {
    const inFarm = !!this.currentFarmId;
    return this.totalsHtml() + (inFarm ? "" : `<p class="hint">Open a farm under Locations to add or view entries.</p>`);
  },

  // Old-flow Log tab (only reachable once inside a farm): the actual
  // add-entry table, matching v3.9's field set exactly.
  renderLogSection() {
    return `
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
      <div style="margin-top:8px;">${this.subView === "log" ? this.renderOldFlowLog() : this.renderGroupedByField()}</div>`;
  },

  // v3.9's exact field set: Date, AM/PM, Category, Area, what3words
  // (fox/boar/goat/squirrel only), Firearm, Shots, multiple Photos, Notes.
  renderOldFlowLog() {
    const entries = this.scopedEntries();
    const def = SPECIES_SECTIONS[this.currentSection];
    const w3wEnabled = W3W_SPECIES.includes(this.currentSection);
    const rows = entries
      .map((e) => {
        const idx = this.entries().indexOf(e);
        const photos = e.photos || [];
        const photoThumbs = photos
          .map((p, pIdx) => `<span class="photo-thumb-wrap"><img src="${cloudinaryThumb(p, 60)}" class="zeroing-thumb" /><button class="icon-btn photo-remove" onclick="SpeciesLog.removePhoto(${idx},${pIdx})">✕</button></span>`)
          .join("");
        return `
      <div class="log-row-card">
        <div class="log-row">
          <input type="date" value="${e.date}" onchange="SpeciesLog.updateEntry(${idx},'date',this.value)" />
          <select onchange="SpeciesLog.updateEntry(${idx},'ampm',this.value)" style="width:70px;">
            <option ${e.ampm === "AM" ? "selected" : ""}>AM</option>
            <option ${e.ampm === "PM" ? "selected" : ""}>PM</option>
          </select>
          <select onchange="SpeciesLog.updateEntry(${idx},'category',this.value)">
            ${def.categories.map((c) => `<option ${c === e.category ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>
        <div class="log-row">
          <input type="text" placeholder="Area (within property)" value="${e.area || ""}" onchange="SpeciesLog.updateEntry(${idx},'area',this.value)" />
          ${w3wEnabled ? `<input type="text" placeholder="///what3words" value="${e.what3words || ""}" onchange="SpeciesLog.updateEntry(${idx},'what3words',this.value)" />` : ""}
          <input type="number" min="0" value="${e.shots}" onchange="SpeciesLog.updateEntry(${idx},'shots',this.value)" style="width:60px;" />
        </div>
        <div class="log-row">
          <select onchange="SpeciesLog.handleFirearmChange(${idx}, this)">
            <option value="" ${!e.firearm ? "selected" : ""}>Firearm…</option>
            ${this.firearmOptionsHtml(e.firearm)}
          </select>
          <input type="text" placeholder="Notes" value="${e.notes || ""}" onchange="SpeciesLog.updateEntry(${idx},'notes',this.value)" />
        </div>
        <div class="log-row photo-row">
          ${photoThumbs}
          <label class="btn small ghost" style="cursor:pointer;">+ Photo
            <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="SpeciesLog.addPhoto(${idx}, this)" />
          </label>
          <button class="icon-btn" onclick="SpeciesLog.removeEntry(${idx})" style="margin-left:auto;">✕ Remove entry</button>
        </div>
      </div>`;
      })
      .join("");
    return rows || '<p class="hint">No entries yet — tap "+ Add entry" above to log one.</p>';
  },

  // ---------- Legacy (unchanged) sections: rabbit, rats, squirrel, winged, game, clay ----------
  // REMINDER: still need the old-software rework — ask Ben how these
  // should be laid out, then move their keys into OLD_FLOW_SECTIONS.
  renderLegacyOverview() {
    const html = this.totalsHtml();
    return html + `
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
      <div style="margin-top:8px;">${this.subView === "log" ? this.renderLegacyFlatLog() : this.renderGroupedByField()}</div>`;
  },

  renderLegacyFlatLog() {
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
