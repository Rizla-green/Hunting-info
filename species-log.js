/* =====================================================================
   SPECIES LOG — all 8 pest/game sections (Fox, Rabbit, Rats, Squirrel,
   Winged Vermin, Game Shooting, Goats, Boar) share ONE identical
   structure in v3.9 — confirmed from source, no section is actually
   different in shape:

     - Reference buttons (Lifecycle/Disease/Game Seasons) sit ABOVE the
       Overview/Locations tabs, visible regardless of which tab is open.
     - Overview: all-time stat -> hint -> year tabs -> year total stat
       -> category table. No adding entries here.
     - Locations: a plain farm list, "+ Add location".
     - Drilling into a farm is ONE continuous page (not more tabs):
       all-time stat+map button -> year tabs -> year stat+map button ->
       category table -> "Records" section (gear icon placeholder) ->
       the actual entry log table -> "+ Add entry".
     - Fields per entry: Date, AM/PM, Category, Area, what3words
       (fox/boar/goat/squirrel only), Firearm, Shots, multiple Photos,
       Notes.

   Game Shooting's category table only ever shows its OWN 11 game birds
   (ownCategoriesFor) — the combined list (+ Winged Vermin + labelled
   Squirrel/Fox) is only offered in the add-entry dropdown, and any
   entry logged under a "borrowed" category rolls up into THAT
   species' own totals instead of Game Shooting's.

   Winged Vermin's Overview also embeds the General Licences chart and
   tiles directly (not a separate popup).
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

const COMPACT_ROW_SECTIONS = ["fox", "boar", "squirrel", "goats"];
const FLAT_SECTIONS = ["rabbit", "rats", "winged"]; // no Locations/farm-drilling — one flat outing list

const SpeciesLog = {
  currentSection: null,
  topTab: "overview",
  currentFarmId: null,
  selectedYear: null,
  subView: "log",
  expanded: {},   // { "sectionKey:idx": true } — collapsed-row expand state, compact sections only

  toggleExpand(idx) {
    const key = `${this.currentSection}:${idx}`;
    this.expanded[key] = !this.expanded[key];
    this.renderBody();
  },

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

  captureW3w(idx) {
    LocationMatch.captureLocation((loc) => {
      if (!loc) return;
      const entry = this.entries()[idx];
      entry.what3words = loc.what3words;
      entry.lat = loc.lat;
      entry.lng = loc.lng;
      this.saveAndRender();
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

  fieldDefsFor() {
    const defs = [
      { key: "ampm", label: "AM / PM" },
      { key: "area", label: "Area (within property)" },
      { key: "firearm", label: "Firearm" },
      { key: "photos", label: "Photos" },
      { key: "notes", label: "Notes" },
    ];
    if (W3W_SPECIES.includes(this.currentSection)) defs.splice(2, 0, { key: "what3words", label: "what3words" });
    return defs;
  },
  openFieldSettings() {
    const def = SPECIES_SECTIONS[this.currentSection];
    openFieldSettings(this.currentSection, def.title, this.fieldDefsFor(), () => this.render());
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

  saveAndRender() { persistData(); this.render(); },

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

  // ---------- Category totals (own tally, with Game Shooting's
  // borrowed-category routing folded in for fox/squirrel/winged) ----------
  categoryTotalsFor(entries, year) {
    const def = SPECIES_SECTIONS[this.currentSection];
    const yearEntries = entries.filter((e) => seasonLabelFor(e.date, this.currentSection) === year);
    const totals = {};
    def.categories.forEach((c) => { totals[c] = 0; });
    yearEntries.forEach((e) => {
      if (totals[e.category] === undefined) return; // borrowed-into-game categories never show on game's own table
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

    if (this.currentSection === "winged") html += this.renderGeneralLicencesBlock();
    if (!this.currentFarmId && !FLAT_SECTIONS.includes(this.currentSection)) html += `<p class="hint">Open a location under Locations to add or view entries.</p>`;
    return html;
  },

  renderGeneralLicencesBlock() {
    const rows = GL_SPECIES_CHART
      .map((r) => `<tr><td>${r[0]}</td><td>${r[1] ? "✓" : "—"}</td><td>${r[2] ? "✓" : "—"}</td><td>${r[3] ? "✓" : "—"}</td></tr>`)
      .join("");
    return `
      <div class="section-title" style="margin-top:18px;"><h4>General Licences (England)</h4></div>
      <p class="hint" style="margin-top:0;">Wild birds are protected by law, so control of any species relies on one of these general licences applying. Always check the current official version before relying on it.</p>
      <div class="table-scroll"><table class="data-table"><tr><th>Species</th><th>GL40</th><th>GL41</th><th>GL42</th></tr>${rows}</table></div>
      <p class="hint">A tick means the species is a permitted target under that licence for at least one purpose. Source: Natural England's GL40/GL41/GL42 species tables (gov.uk).</p>
      <p class="hint">Tap a licence for a plain-English summary and a link to the full official conditions.</p>
      <div class="species-tabs">
        <button class="tab-btn" onclick="ReferenceInfo.generalLicences()">GL40 — Conservation</button>
        <button class="tab-btn" onclick="ReferenceInfo.generalLicences()">GL41 — Public health</button>
        <button class="tab-btn" onclick="ReferenceInfo.generalLicences()">GL42 — Preventing damage</button>
        <button class="tab-btn" onclick="ReferenceInfo.generalLicences()">GL33 — Trapping conditions</button>
      </div>`;
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
      ${this.currentSection === "winged" ? this.renderGeneralLicencesBlock() : ""}

      <div class="section-title" style="margin-top:18px;"><h4>Records</h4></div>
      <button class="icon-btn" onclick="SpeciesLog.openFieldSettings()" title="Choose which fields show">⚙</button>
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

  // v3.9's exact field set: Date, AM/PM, Category, Area, what3words
  // (fox/boar/goat/squirrel only), Firearm, Shots, multiple Photos, Notes.
  renderEntryLog() {
    const entries = this.scopedEntries();
    const categoryOptions = categoryOptionsFor(this.currentSection);
    const w3wEnabled = W3W_SPECIES.includes(this.currentSection);
    const on = (f) => isFieldOn(this.currentSection, f);
    const isCompact = COMPACT_ROW_SECTIONS.includes(this.currentSection);
    const rows = entries
      .map((e) => {
        const idx = this.entries().indexOf(e);
        const photos = e.photos || [];
        const photoThumbs = photos
          .map((p, pIdx) => `<span class="photo-thumb-wrap"><img src="${cloudinaryThumb(p, 60)}" class="zeroing-thumb" /><button class="icon-btn photo-remove" onclick="SpeciesLog.removePhoto(${idx},${pIdx})">✕</button></span>`)
          .join("");

        const isExpanded = !isCompact || this.expanded[`${this.currentSection}:${idx}`];

        if (isCompact && !isExpanded) {
          return `
      <div class="log-row-card compact-row" onclick="SpeciesLog.toggleExpand(${idx})" style="cursor:pointer;">
        <div class="log-row compact-summary">
          <span>${e.date}</span>
          <span>${e.category}</span>
          <span>${e.area || ""}</span>
        </div>
      </div>`;
        }

        return `
      <div class="log-row-card">
        ${isCompact ? `<div class="log-row" style="justify-content:flex-end;"><button class="icon-btn" onclick="SpeciesLog.toggleExpand(${idx})">▲ Collapse</button></div>` : ""}
        <div class="log-row">
          <input type="date" value="${e.date}" onchange="SpeciesLog.updateEntry(${idx},'date',this.value)" />
          ${on("ampm") ? `<select onchange="SpeciesLog.updateEntry(${idx},'ampm',this.value)" style="width:70px;">
            <option ${e.ampm === "AM" ? "selected" : ""}>AM</option>
            <option ${e.ampm === "PM" ? "selected" : ""}>PM</option>
          </select>` : ""}
          <select onchange="SpeciesLog.updateEntry(${idx},'category',this.value)">
            ${categoryOptions.map((c) => `<option ${c === e.category ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>
        <div class="log-row">
          ${on("area") ? `<input type="text" placeholder="Area (within property)" value="${e.area || ""}" onchange="SpeciesLog.updateEntry(${idx},'area',this.value)" />` : ""}
          ${w3wEnabled && on("what3words") ? `<input type="text" placeholder="///what3words" value="${e.what3words || ""}" onchange="SpeciesLog.updateEntry(${idx},'what3words',this.value)" />` : ""}
          <input type="number" min="0" value="${e.shots}" onchange="SpeciesLog.updateEntry(${idx},'shots',this.value)" style="width:60px;" />
        </div>
        <div class="log-row">
          ${on("firearm") ? `<select onchange="SpeciesLog.handleFirearmChange(${idx}, this)">
            <option value="" ${!e.firearm ? "selected" : ""}>Firearm…</option>
            ${this.firearmOptionsHtml(e.firearm)}
          </select>` : ""}
          ${on("notes") ? `<input type="text" placeholder="Notes" value="${e.notes || ""}" onchange="SpeciesLog.updateEntry(${idx},'notes',this.value)" />` : ""}
        </div>
        ${on("photos") ? `<div class="log-row photo-row">
          ${photoThumbs}
          <label class="btn small ghost" style="cursor:pointer;">+ Photo
            <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="SpeciesLog.addPhoto(${idx}, this)" />
          </label>
          <button class="icon-btn" onclick="SpeciesLog.removeEntry(${idx})" style="margin-left:auto;">✕ Remove entry</button>
        </div>` : `<div class="log-row"><button class="icon-btn" onclick="SpeciesLog.removeEntry(${idx})" style="margin-left:auto;">✕ Remove entry</button></div>`}
      </div>`;
      })
      .join("");
    return rows || '<p class="hint">No entries yet — tap "+ Add entry" below to log one.</p>';
  },

  // ---------- Flat outing log (Rabbit, Rats, Winged Vermin — no Locations) ----------
  renderFlatPestLog() {
    const farms = window.APP_DATA.farms || [];
    const on = (f) => isFieldOn(this.currentSection, f);
    const showCategoryPicker = this.currentSection === "winged"; // only Winged Vermin picks a species first
    const rows = this.entries()
      .map((e, idx) => {
        const photos = e.photos || [];
        const photoThumbs = photos
          .map((p, pIdx) => `<span class="photo-thumb-wrap"><img src="${cloudinaryThumb(p, 60)}" class="zeroing-thumb" /><button class="icon-btn photo-remove" onclick="SpeciesLog.removePhoto(${idx},${pIdx})">✕</button></span>`)
          .join("");
        return `
      <div class="log-row-card">
        <div class="log-row">
          <input type="date" value="${e.date}" onchange="SpeciesLog.updateEntry(${idx},'date',this.value)" />
          ${showCategoryPicker ? `<select onchange="SpeciesLog.updateEntry(${idx},'category',this.value)">
            ${WINGED_VERMIN_LIST.map((c) => `<option ${c === e.category ? "selected" : ""}>${c}</option>`).join("")}
          </select>` : ""}
          <input type="number" min="0" placeholder="Amount" value="${e.shots}" onchange="SpeciesLog.updateEntry(${idx},'shots',this.value)" style="width:70px;" />
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
        <div class="log-row">
          <input type="text" placeholder="///what3words" value="${e.what3words || ""}" onchange="SpeciesLog.updateEntry(${idx},'what3words',this.value)" />
          <button class="btn small ghost" onclick="SpeciesLog.captureW3w(${idx})">📍 Auto</button>
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
    return `
      <button class="btn small" style="margin-top:10px;" onclick="SpeciesLog.addFlatEntry()">+ Add</button>
      <div style="margin-top:8px;">${rows || '<p class="hint">No entries yet — tap "+ Add" to log one.</p>'}</div>`;
  },

  addFlatEntry() {
    const entry = this.newEntryDefaults();
    entry.farmId = "other";
    this.entries().push(entry);
    this.saveAndRender();
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
