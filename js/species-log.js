/* =====================================================================
   SPECIES LOG — Fox, Rabbit, Rats, Squirrel, Winged Vermin, Goats,
   Boar (Game Shooting and Deer are their own separate modules now).

   Two entry shapes:
     - COMPACT_ROW_SECTIONS (Fox, Boar, Squirrel, Goats): one entry
       per animal.
     - FLAT_SECTIONS (Rabbit, Rats, Winged Vermin): no Locations/farm-
       drilling — one flat "outing" list; entries can cover multiple
       animals (Amount) and, for Winged Vermin, different species.

   Every entry — either shape — now opens in a genuine POPUP to add or
   edit (never inline on the page). Saved entries collapse to a single
   summary line; tapping it reopens the popup. Every entry also carries
   Firearm (from the shared Firearms list), Notes (free text), an
   auto-filled Weather line (once a location is set) and a computed
   Moon phase for that night — across BOTH shapes.
===================================================================== */

const GAME_BIRD_LIST = ["Pheasant", "Mallard", "Wigeon", "French partridge", "English partridge", "Canada goose", "Greylag goose", "Pinkfoot goose", "Egyptian goose", "Snipe", "Woodcock", "Teal"];
const WINGED_VERMIN_LIST = ["Crow", "Rook", "Jackdaw", "Magpie", "Pigeon", "Jay"];
const SQUIRREL_LIST = ["Male", "Female"];
const FOX_LIST = ["Dog", "Vixen", "Dog cub", "Vixen cub"];

const SPECIES_SECTIONS = {
  fox:     { title: "Fox",           categories: FOX_LIST },
  rabbit:  { title: "Rabbit",        categories: ["Rabbit"] },
  rats:    { title: "Rats",          categories: ["Rat"] },
  squirrel:{ title: "Squirrels",     categories: SQUIRREL_LIST },
  winged:  { title: "Winged Vermin", categories: WINGED_VERMIN_LIST },
  goats:   { title: "Goats",         categories: ["Billy", "Nanny", "Kid"] },
  boar:    { title: "Boar",          categories: ["Boar", "Sow", "Piglet"] },
};

function categoryOptionsFor(sectionKey) {
  return SPECIES_SECTIONS[sectionKey].categories;
}

const W3W_SPECIES = ["deer", "fox", "goats", "boar", "squirrel"];

const COMPACT_ROW_SECTIONS = ["fox", "boar", "squirrel", "goats"]; // one entry per animal
const FLAT_SECTIONS = ["rabbit", "rats", "winged"]; // no Locations/farm-drilling — one flat outing list

const SpeciesLog = {
  currentSection: null,
  topTab: "overview",
  currentFarmId: null,
  selectedYear: null,
  subView: "log",
  popupIdx: null,   // index of the entry currently open in the popup editor, or null

  open(sectionKey) {
    this.currentSection = sectionKey;
    this.topTab = "overview";
    this.currentFarmId = null;
    this.selectedYear = currentSeasonLabel(sectionKey);
    this.subView = "log";
    this.popupIdx = null;
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
      locationText: "",   // free-typed location, used when farmId === "other" (flat sections only)
      area: "",
      what3words: "",
      lat: null,
      lng: null,
      weather: "",
      category: def.categories[0],
      shots: 1,
      firearm: "",
      photos: [],
      notes: "",
    };
  },

  // ---------- Add (compact: one animal; flat: one outing entry) — both open the popup immediately ----------
  addEntry() {
    this.entries().push(this.newEntryDefaults());
    this.popupIdx = this.entries().length - 1;
    persistData();
    this.render();
  },
  addFlatEntry() {
    const entry = this.newEntryDefaults();
    entry.farmId = "other";
    this.entries().push(entry);
    this.popupIdx = this.entries().length - 1;
    persistData();
    this.render();
  },

  addEntryFromCamera(inputEl) {
    LocationMatch.captureWithCamera(inputEl, async (photoDataUrl, loc) => {
      const entry = this.newEntryDefaults();
      if (loc) {
        entry.what3words = loc.what3words;
        entry.lat = loc.lat;
        entry.lng = loc.lng;
        if (!this.currentFarmId) entry.farmId = loc.farmId;
      }
      entry.photos = [photoDataUrl];
      this.entries().push(entry);
      const idx = this.entries().length - 1;
      this.saveAndRender();
      uploadAndReplace(entry.photos, 0);
      if (loc) {
        entry.weather = await fetchWeatherForEntry(loc.lat, loc.lng, entry.date);
        this.saveAndRender();
      }
    });
  },

  captureW3w(idx) {
    LocationMatch.captureLocation(async (loc) => {
      if (!loc) return;
      const entry = this.entries()[idx];
      entry.what3words = loc.what3words;
      entry.lat = loc.lat;
      entry.lng = loc.lng;
      this.saveAndRenderPopup(idx);
      entry.weather = await fetchWeatherForEntry(loc.lat, loc.lng, entry.date);
      this.saveAndRenderPopup(idx);
    });
  },

  removeEntry(idx) {
    if (!confirm("Remove this entry? This can't be undone.")) return;
    this.entries().splice(idx, 1);
    this.popupIdx = null;
    this.saveAndRender();
  },

  updateEntry(idx, field, value) {
    this.entries()[idx][field] = value;
    this.saveAndRenderPopup(idx);
  },

  addPhoto(idx, inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const entry = this.entries()[idx];
      entry.photos = entry.photos || [];
      entry.photos.push(reader.result);
      const photoIdx = entry.photos.length - 1;
      this.saveAndRenderPopup(idx);
      uploadAndReplace(entry.photos, photoIdx);
    };
    reader.readAsDataURL(file);
  },
  removePhoto(idx, photoIdx) {
    if (!confirm("Remove this photo? This can't be undone.")) return;
    this.entries()[idx].photos.splice(photoIdx, 1);
    this.saveAndRenderPopup(idx);
  },

  firearmOptionsHtml(selected) {
    const opts = Firearms.list().map((f) => `<option ${f === selected ? "selected" : ""}>${f}</option>`).join("");
    return opts + `<option value="__add_new__">+ Add new firearm…</option>`;
  },
  handleFirearmChange(idx, selectEl) {
    if (selectEl.value === "__add_new__") {
      const added = Firearms.addInline();
      if (added) this.updateEntry(idx, "firearm", added);
      else this.saveAndRenderPopup(idx);
      return;
    }
    this.updateEntry(idx, "firearm", selectEl.value);
  },
  handleFarmChange(idx, selectEl) {
    if (selectEl.value === "__add_new__") { return; }
    this.updateEntry(idx, "farmId", selectEl.value);
  },

  saveAndRender() { persistData(); this.render(); },
  saveAndRenderPopup(idx) { persistData(); this.popupIdx = idx; this.render(); },

  setTopTab(tab) { this.topTab = tab; this.render(); },
  setYear(year) { this.selectedYear = year; this.render(); },
  setSubView(view) { this.subView = view; this.render(); },
  drillIntoFarm(farmId) {
    this.currentFarmId = farmId;
    this.subView = "log";
    document.getElementById("modalOverlay").classList.add("hidden");
    this.render();
  },
  backToSpeciesWide() {
    this.currentFarmId = null;
    this.topTab = "overview";
    this.render();
  },

  openEntryPopup(idx) { this.popupIdx = idx; this.render(); },
  closeEntryPopup() { this.popupIdx = null; this.render(); },

  groupByField() {
    const groups = {};
    this.scopedEntries().forEach((e) => {
      const key = e.area || "(no field name)";
      groups[key] = groups[key] || [];
      groups[key].push(e);
    });
    return groups;
  },

  // ---------- Render ----------
  render() {
    const def = SPECIES_SECTIONS[this.currentSection];
    const overlay = document.getElementById("modalOverlay");
    const inFarm = !!this.currentFarmId;

    if (this.popupIdx !== null && this.entries()[this.popupIdx]) {
      overlay.innerHTML = `<div class="modal-box species-modal-box"><div id="speciesLogBody"></div></div>`;
      overlay.classList.remove("hidden");
      document.getElementById("speciesLogBody").innerHTML = this.renderEntryPopup(this.popupIdx);
      return;
    }

    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="${inFarm ? "SpeciesLog.backToSpeciesWide()" : "document.getElementById('modalOverlay').classList.add('hidden')"}">← Back</button>
          <h3>${def.title}${inFarm ? " — " + this.farmName(this.currentFarmId) : ""}</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
        </div>
        <div class="species-tabs">
          ${this.currentSection === "fox" ? `<button class="tab-btn" onclick="ReferenceInfo.foxBoarLifecycle('Fox')">🦊 Lifecycle chart</button>` : ""}
          ${this.currentSection === "boar" ? `<button class="tab-btn" onclick="ReferenceInfo.foxBoarLifecycle('Wild boar')">🐗 Lifecycle chart</button><button class="tab-btn" onclick="ReferenceInfo.boarDisease()">🦠 Boar Disease</button>` : ""}
          ${this.currentSection === "winged" ? `<button class="tab-btn" onclick="ReferenceInfo.generalLicences()">📜 General Licences</button>` : ""}
        </div>
        ${!inFarm && !FLAT_SECTIONS.includes(this.currentSection) ? `<div class="species-tabs">
          <button class="tab-btn ${this.topTab === "overview" ? "active" : ""}" onclick="SpeciesLog.setTopTab('overview')">Overview</button>
          <button class="tab-btn ${this.topTab === "locations" ? "active" : ""}" onclick="SpeciesLog.setTopTab('locations')">Locations</button>
        </div>` : ""}
        <div id="speciesLogBody"></div>
      </div>`;
    overlay.classList.remove("hidden");
    this.renderBody();
  },

  renderBody() {
    const body = document.getElementById("speciesLogBody");
    if (FLAT_SECTIONS.includes(this.currentSection)) { body.innerHTML = this.renderOverview() + this.renderFlatPestLog(); return; }
    if (this.currentFarmId) { body.innerHTML = this.renderFarmPage(); return; }
    body.innerHTML = this.topTab === "locations" ? this.renderLocationsList() : this.renderOverview();
  },

  renderLocationsList() {
    return renderLocationsListHtml("SpeciesLog.drillIntoFarm", this.entries().some((e) => !e.farmId || e.farmId === "other")) +
      `<button class="btn small" style="margin-top:10px;" onclick="addFarm()">+ Add location</button>`;
  },

  // ---------- Category totals ----------
  categoryTotalsFor(entries, year) {
    const def = SPECIES_SECTIONS[this.currentSection];
    const yearEntries = entries.filter((e) => seasonLabelFor(e.date, this.currentSection) === year);
    const totals = {};
    def.categories.forEach((c) => { totals[c] = 0; });
    yearEntries.forEach((e) => {
      if (totals[e.category] === undefined) return;
      totals[e.category] += parseInt(e.shots, 10) || 1;
    });
    return totals;
  },

  // ---------- Overview (species-wide or per-farm — identical shape) ----------
  renderOverview() {
    const scoped = this.entries();
    const years = seasonYearsFor(scoped, this.currentSection);
    if (!years.includes(this.selectedYear)) this.selectedYear = years[0];
    const allTimeTotal = scoped.reduce((sum, e) => sum + (parseInt(e.shots, 10) || 1), 0);
    const totals = this.categoryTotalsFor(scoped, this.selectedYear);
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

    let html = `
      ${renderStatCards([{ value: allTimeTotal, label: "Overall total (all years)" }])}
      <p class="hint">${seasonHintFor(this.currentSection)}</p>
      <div class="species-tabs">${renderYearTabs(years, this.selectedYear, this.currentSection, "SpeciesLog.setYear")}</div>
      ${renderStatCards([{ value: grandTotal, label: "Total — season " + this.selectedYear }])}
      <div style="margin-top:10px;">${renderCategoryTable(totals, grandTotal)}</div>`;

    if (!this.currentFarmId && !FLAT_SECTIONS.includes(this.currentSection)) html += `<p class="hint">Open a location under Locations to add or view entries.</p>`;
    return html;
  },

  // ---------- Farm page: ONE continuous page (stats -> table -> Records) ----------
  renderFarmPage() {
    const scoped = this.scopedEntries();
    const years = seasonYearsFor(scoped, this.currentSection);
    if (!years.includes(this.selectedYear)) this.selectedYear = years[0];
    const allTimeTotal = scoped.reduce((sum, e) => sum + (parseInt(e.shots, 10) || 1), 0);
    const totals = this.categoryTotalsFor(scoped, this.selectedYear);
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
    const w3wEnabled = W3W_SPECIES.includes(this.currentSection);
    const mapBtn = w3wEnabled ? `<button class="icon-btn" onclick="ShotLocationMap.open('${this.currentSection}','${this.currentFarmId}')">📍 Map</button>` : "";

    return `
      ${renderStatCards([{ value: allTimeTotal, label: "Total for this property (all years)" }])}
      ${mapBtn}
      <div class="species-tabs">${renderYearTabs(years, this.selectedYear, this.currentSection, "SpeciesLog.setYear")}</div>
      ${renderStatCards([{ value: grandTotal, label: "Total — season " + this.selectedYear }])}
      ${mapBtn}
      <div style="margin-top:10px;">${renderCategoryTable(totals, grandTotal)}</div>

      <div class="section-title" style="margin-top:18px;"><h4>Records</h4></div>
      <div class="species-tabs">
        <button class="tab-btn ${this.subView === "log" ? "active" : ""}" onclick="SpeciesLog.setSubView('log')">Entry Log</button>
        <button class="tab-btn ${this.subView === "by-field" ? "active" : ""}" onclick="SpeciesLog.setSubView('by-field')">By Field Name</button>
      </div>
      <div style="margin-top:8px;">${this.subView === "log" ? this.renderEntryLog() : this.renderGroupedByField()}</div>
      <button class="btn small" style="margin-top:10px;" onclick="SpeciesLog.addEntry()">+ Add entry</button>
      ${w3wEnabled ? `
      <label class="btn small ghost" style="display:inline-block; margin-left:8px; cursor:pointer;">
        📷 Add via camera
        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="SpeciesLog.addEntryFromCamera(this)" />
      </label>` : ""}`;
  },

  // ---------- Compact-section summary rows (one entry per animal) ----------
  renderEntryLog() {
    const entries = this.scopedEntries();
    const rows = entries
      .map((e) => {
        const idx = this.entries().indexOf(e);
        return `
      <div class="log-row-card compact-row" onclick="SpeciesLog.openEntryPopup(${idx})" style="cursor:pointer;">
        <div class="log-row compact-summary">
          <span>${e.date}</span>
          <span>${e.category}</span>
          <span>${e.area || ""}</span>
        </div>
      </div>`;
      })
      .join("");
    return rows || '<p class="hint">No entries yet — tap "+ Add entry" below to log one.</p>';
  },

  // ---------- Flat outing summary rows (Rabbit, Rats, Winged Vermin) ----------
  renderFlatPestLog() {
    const rows = this.entries()
      .map((e, idx) => {
        const locationLabel = (!e.farmId || e.farmId === "other") ? (e.locationText || "") : this.farmName(e.farmId);
        const secondLabel = this.currentSection === "winged" ? `${e.category} x${e.shots}` : `x${e.shots}`;
        return `
      <div class="log-row-card compact-row" onclick="SpeciesLog.openEntryPopup(${idx})" style="cursor:pointer;">
        <div class="log-row compact-summary">
          <span>${e.date}</span>
          <span>${secondLabel}</span>
          <span>${locationLabel}</span>
        </div>
      </div>`;
      })
      .join("");
    return `
      <button class="btn small" style="margin-top:10px;" onclick="SpeciesLog.addFlatEntry()">+ Add</button>
      <div style="margin-top:8px;">${rows || '<p class="hint">No entries yet — tap "+ Add" to log one.</p>'}</div>`;
  },

  // ---------- The popup editor — shared shape for BOTH compact and flat entries ----------
  renderEntryPopup(idx) {
    const e = this.entries()[idx];
    const isFlat = FLAT_SECTIONS.includes(this.currentSection);
    const def = SPECIES_SECTIONS[this.currentSection];
    const farms = window.APP_DATA.farms || [];
    const w3wEnabled = isFlat || W3W_SPECIES.includes(this.currentSection);
    const photos = e.photos || [];
    const photoThumbs = photos
      .map((p, pIdx) => `<span class="photo-thumb-wrap"><img src="${cloudinaryThumb(p, 60)}" class="zeroing-thumb" /><button class="icon-btn photo-remove" onclick="SpeciesLog.removePhoto(${idx},${pIdx})">✕</button></span>`)
      .join("");
    const backAction = this.currentFarmId || !isFlat ? "SpeciesLog.closeEntryPopup()" : "SpeciesLog.closeEntryPopup()";

    return `
      <div class="map-modal-header">
        <button class="icon-btn" onclick="${backAction}">← Back</button>
        <h3>${def.title} Entry</h3>
        <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
      </div>
      <div class="log-row">
        <input type="date" value="${e.date}" onchange="SpeciesLog.updateEntry(${idx},'date',this.value)" />
        ${!isFlat ? `<select onchange="SpeciesLog.updateEntry(${idx},'ampm',this.value)" style="width:70px;">
          <option ${e.ampm === "AM" ? "selected" : ""}>AM</option>
          <option ${e.ampm === "PM" ? "selected" : ""}>PM</option>
        </select>` : ""}
      </div>

      ${isFlat ? `
      ${this.currentSection === "winged" ? `<div class="log-row">
        <select onchange="SpeciesLog.updateEntry(${idx},'category',this.value)">
          ${WINGED_VERMIN_LIST.map((c) => `<option ${c === e.category ? "selected" : ""}>${c}</option>`).join("")}
        </select>
      </div>` : ""}
      <div class="log-row">
        <input type="number" min="0" placeholder="Amount" value="${e.shots}" onchange="SpeciesLog.updateEntry(${idx},'shots',this.value)" style="width:90px;" />
      </div>
      <div class="log-row">
        <select onchange="SpeciesLog.updateEntry(${idx},'farmId',this.value)">
          ${farms.map((f) => `<option value="${f.id}" ${e.farmId === f.id ? "selected" : ""}>${f.name}</option>`).join("")}
          <option value="other" ${!e.farmId || e.farmId === "other" ? "selected" : ""}>Other (type below)</option>
        </select>
      </div>
      ${!e.farmId || e.farmId === "other" ? `<div class="log-row">
        <input type="text" placeholder="Type a location" value="${e.locationText || ""}" onchange="SpeciesLog.updateEntry(${idx},'locationText',this.value)" />
      </div>` : ""}
      ` : `
      <div class="log-row">
        <select onchange="SpeciesLog.updateEntry(${idx},'category',this.value)">
          ${categoryOptionsFor(this.currentSection).map((c) => `<option ${c === e.category ? "selected" : ""}>${c}</option>`).join("")}
        </select>
      </div>
      <div class="log-row">
        <input type="text" placeholder="Area (within property)" value="${e.area || ""}" onchange="SpeciesLog.updateEntry(${idx},'area',this.value)" />
        <input type="number" min="0" placeholder="Shots" value="${e.shots}" onchange="SpeciesLog.updateEntry(${idx},'shots',this.value)" style="width:80px;" />
      </div>
      `}

      ${w3wEnabled ? `<div class="log-row">
        <input type="text" placeholder="///what3words" value="${e.what3words || ""}" onchange="SpeciesLog.updateEntry(${idx},'what3words',this.value)" />
        <button class="btn small ghost" onclick="SpeciesLog.captureW3w(${idx})">📍 Auto</button>
      </div>` : ""}

      <div class="log-row">
        <span class="hint" style="margin:0;">🌦️ Weather: ${e.weather || "— (set a location to auto-fill)"}</span>
      </div>
      <div class="log-row">
        <span class="hint" style="margin:0;">${moonPhaseLabel(e.date) || ""} (that night)</span>
      </div>

      <div class="log-row">
        <select onchange="SpeciesLog.handleFirearmChange(${idx}, this)">
          <option value="" ${!e.firearm ? "selected" : ""}>Firearm…</option>
          ${this.firearmOptionsHtml(e.firearm)}
        </select>
      </div>
      <div class="log-row">
        <input type="text" placeholder="Notes" value="${e.notes || ""}" onchange="SpeciesLog.updateEntry(${idx},'notes',this.value)" />
      </div>
      <div class="log-row photo-row">
        ${photoThumbs}
        <label class="btn small ghost" style="cursor:pointer;">+ Photo
          <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="SpeciesLog.addPhoto(${idx}, this)" />
        </label>
      </div>
      <button class="icon-btn" onclick="SpeciesLog.removeEntry(${idx})" style="margin-top:10px;">✕ Remove entry</button>
    `;
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
