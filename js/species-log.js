/* =====================================================================
   SPECIES LOG — Fox, Rabbit, Rats, Squirrel, Winged Vermin, Goats,
   Boar (Game Shooting and Deer are their own separate modules).

   Two shapes:
     - COMPACT (Fox, Boar, Squirrel, Goats): one entry per animal.
       Two tabs: Overview, and List — List has "+ Add" pinned at the
       top, then every entry from every farm shown together, grouped
       by farm (each farm's entries oldest-first), farm workspace
       drilling is gone. Tapping a farm's name opens a quick-view
       popup (total + year-by-year table + map button), same pattern
       as Deer's Properties popup.
     - FLAT (Rabbit, Rats, Winged Vermin): no farm grouping — one
       flat "outing" list. Winged Vermin entries can hold MULTIPLE
       species lines (like Game Shooting's day species lines).

   Both shapes: adding/editing opens a genuine POPUP working on a
   DRAFT — nothing saves until "Save" is tapped; Back/Main Menu warn
   on unsaved changes. Both carry Firearm, Notes, auto Weather, and a
   computed Moon phase. Each section has its own "⚙ list columns" cog
   choosing which fields show on the collapsed summary line.
   Reference buttons (Lifecycle/Disease/Licences) only show on Overview.
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

const W3W_SPECIES = ["fox", "goats", "boar", "squirrel"];
const COMPACT_ROW_SECTIONS = ["fox", "boar", "squirrel", "goats"]; // one entry per animal, farm-grouped List
const FLAT_SECTIONS = ["rabbit", "rats", "winged"]; // one flat outing list, no farm grouping
const RICH_SECTIONS = ["boar", "goats"]; // same field set as Deer (Location/Weight/Tag/Condition/etc), no closed-season warning

// Candidate columns offered by each section's "list columns" cog, and sensible defaults.
const LIST_COLUMN_CANDIDATES_RICH = [
  { key: "category", label: "Category" }, { key: "location", label: "Location" }, { key: "field", label: "Field" },
  { key: "firearm", label: "Weapon" }, { key: "condition", label: "Condition" }, { key: "notes", label: "Notes" },
];

// Candidate columns offered by each section's "list columns" cog, and sensible defaults.
const LIST_COLUMN_CANDIDATES_COMPACT = [
  { key: "category", label: "Category" }, { key: "area", label: "Area" }, { key: "field", label: "Field" },
  { key: "firearm", label: "Weapon" }, { key: "notes", label: "Notes" },
];
const LIST_COLUMN_CANDIDATES_FLAT = [
  { key: "shots", label: "Amount" }, { key: "location", label: "Location" },
  { key: "firearm", label: "Weapon" }, { key: "notes", label: "Notes" },
];
const LIST_COLUMN_DEFAULTS = {
  fox: ["category", "area"], squirrel: ["category", "area"],
  boar: ["category", "location"], goats: ["category", "location"],
  rabbit: ["shots", "location"], rats: ["shots", "location"], winged: ["shots", "location"],
};

const SpeciesLog = {
  currentSection: null,
  topTab: "overview",
  selectedYear: null,
  draft: null,        // entry currently open in the popup (a working copy — not yet saved)
  draftIdx: null,     // index into entries() being edited, or null if this draft is a new entry

  open(sectionKey) {
    this.currentSection = sectionKey;
    this.topTab = "overview";
    this.selectedYear = currentSeasonLabel(sectionKey);
    this.render();
  },

  entries() {
    window.APP_DATA.species = window.APP_DATA.species || {};
    window.APP_DATA.species[this.currentSection] = window.APP_DATA.species[this.currentSection] || [];
    return window.APP_DATA.species[this.currentSection];
  },

  farmName(farmId) {
    if (!farmId || farmId === "other") return "Other";
    return (window.APP_DATA.farms || []).find((f) => f.id === farmId)?.name || "Other";
  },

  listColumns() {
    window.APP_DATA.listColumnPrefs = window.APP_DATA.listColumnPrefs || {};
    return window.APP_DATA.listColumnPrefs[this.currentSection] || LIST_COLUMN_DEFAULTS[this.currentSection] || [];
  },

  // ---------- List-columns cog (which fields show on the collapsed summary line) ----------
  openColumnSettings() {
    const isFlat = FLAT_SECTIONS.includes(this.currentSection);
    const isRich = RICH_SECTIONS.includes(this.currentSection);
    const candidates = isFlat ? LIST_COLUMN_CANDIDATES_FLAT : isRich ? LIST_COLUMN_CANDIDATES_RICH : LIST_COLUMN_CANDIDATES_COMPACT;
    const current = this.listColumns();
    const html = `
      ${Popup.refHeader("List columns")}
      <div style="padding:0 16px 16px;">
        <p class="hint" style="margin-top:0;">Date always shows. Choose what else appears on each summary line.</p>
        ${candidates.map((c) => `
          <label style="display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--navy-light);">
            <input type="checkbox" ${current.includes(c.key) ? "checked" : ""} onchange="SpeciesLog.toggleListColumn('${c.key}', this.checked)" />
            ${c.label}
          </label>`).join("")}
      </div>`;
    Popup.open(html, () => this.renderBody());
  },
  toggleListColumn(key, checked) {
    window.APP_DATA.listColumnPrefs = window.APP_DATA.listColumnPrefs || {};
    let cols = window.APP_DATA.listColumnPrefs[this.currentSection] || LIST_COLUMN_DEFAULTS[this.currentSection] || [];
    cols = checked ? [...new Set([...cols, key])] : cols.filter((c) => c !== key);
    window.APP_DATA.listColumnPrefs[this.currentSection] = cols;
    persistData();
  },

  // ---------- Draft lifecycle (popup add/edit, nothing saved until Save) ----------
  newEntryDefaults() {
    const def = SPECIES_SECTIONS[this.currentSection];
    const farms = window.APP_DATA.farms || [];
    return {
      date: new Date().toISOString().slice(0, 10),
      ampm: "",   // blank until chosen — never assumed
      farmId: "other",   // every new entry starts on Other until a farm is chosen (or a pin picks one)
      locationText: "",
      area: "",
      location: "",
      time: "",
      what3words: "",
      lat: null,
      lng: null,
      fieldId: "",   // named field inside the farm (Fox/Squirrel/Boar/Goats only); auto-set from a pin
      weather: "",
      category: def.categories[0],
      shots: 1,
      ...(FLAT_SECTIONS.includes(this.currentSection) ? { lines: [{ category: def.categories[0], shots: 1 }] } : {}),
      ...(this.currentSection === "winged" ? { shotsTaken: "" } : {}),   // one figure for the whole day, blank until entered
      firearm: "",
      weight: "", tag: "", condition: (typeof DEER_CONDITIONS !== "undefined" ? DEER_CONDITIONS[0] : "Good"),
      abnormalities: "", shotPlacement: "", shotBy: "", recordedBy: "", destination: "",
      photos: [],
      notes: "",
      locationNotes: "", // free-text spot description, distinct from Location/Area — mainly populated by spreadsheet import
    };
  },

  openAddPopup() {
    this.draft = this.newEntryDefaults();
    this.draftIdx = null;
    Popup.open(this.renderPopupBody(), () => this.renderBody());
  },
  openEditPopup(idx) {
    this.draft = { ...this.entries()[idx] };
    this.draftIdx = idx;
    Popup.open(this.renderPopupBody(), () => this.renderBody());
  },
  updateDraft(field, value) {
    this.draft[field] = value;
    if (field === "farmId") this.draft.fieldId = Fields.validFieldId(value, this.draft.fieldId); // a field only belongs to its own farm
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },
  updateDraftLine(lineIdx, field, value) {
    this.draft.lines[lineIdx][field] = value;
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },
  addDraftLine() {
    const def = SPECIES_SECTIONS[this.currentSection];
    this.draft.lines.push({ category: def.categories[0], shots: 1 });
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },
  removeDraftLine(lineIdx) {
    this.draft.lines.splice(lineIdx, 1);
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },

  saveDraft() {
    if (this.draftIdx === null) this.entries().push(this.draft);
    else this.entries()[this.draftIdx] = this.draft;
    persistData();
    this.selectedYear = seasonLabelFor(this.draft.date, this.currentSection); // the list moves to the saved entry's year so it doesn't seem to vanish
    Popup.dirty = false;
    this.draft = null;
    this.draftIdx = null;
    Popup.close();
  },
  removeDraft() {
    if (this.draftIdx === null) { Popup.dirty = false; Popup.close(); return; }
    if (!confirm("Remove this entry? This can't be undone.")) return;
    this.entries().splice(this.draftIdx, 1);
    persistData();
    Popup.dirty = false;
    this.draft = null;
    this.draftIdx = null;
    Popup.close();
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

  // what3words typed or pasted by hand is just saved as typed. (Turning typed words into a
  // map position needs a paid what3words plan, so nothing is looked up. Positions come from
  // 📍 Auto (GPS) or from Options > Place pins.)
  // Coordinates typed by hand (from a GPS, a map, a spreadsheet…): sets the position and, from Other, the property/field.
  saveCoordinates(value) {
    return Fields.applyCoordinates(this, value, FIELD_SECTIONS.includes(this.currentSection));
  },

  // Location box on Rabbit / Rats / Winged Vermin: a property, a saved place, a new place, or "Other".
  setFlatLocation(value) {
    if (value === "__add_place__") {
      const added = Places.add(prompt("New place name:"));
      if (added) { this.draft.farmId = "other"; this.draft.locationText = added; Popup.markDirty(); }
      Popup.setBody(this.renderPopupBody());
      return;
    }
    if (value.startsWith("place:")) {
      this.draft.farmId = "other";
      this.draft.locationText = value.slice(6);
      Popup.markDirty();
      Popup.setBody(this.renderPopupBody());
      return;
    }
    if (value === "other") {
      this.draft.farmId = "other";
      if (Places.saved().includes(this.draft.locationText)) this.draft.locationText = ""; // leaving a saved place: start the typing box empty
      Popup.markDirty();
      Popup.setBody(this.renderPopupBody());
      return;
    }
    this.updateDraft("farmId", value);
  },

  saveTypedWords(value) {
    this.draft.what3words = value;
    Popup.markDirty();
  },

  captureW3w() {
    LocationMatch.captureLocation(async (loc) => {
      if (!loc) return;
      if (loc.what3words) this.draft.what3words = loc.what3words; // a failed lookup never wipes words already there
      this.draft.lat = loc.lat;
      this.draft.lng = loc.lng;
      const pinFarm = Fields.propertyForPin(this.draft.farmId, loc.lat, loc.lng); // only replaces "Other"
      if (pinFarm) this.draft.farmId = pinFarm;
      if (FIELD_SECTIONS.includes(this.currentSection)) this.draft.fieldId = Fields.fieldIdForPin(this.draft.farmId, loc);
      Popup.markDirty();
      Popup.setBody(this.renderPopupBody());
      this.draft.weather = await fetchWeatherForEntry(loc.lat, loc.lng, this.draft.date);
      Popup.setBody(this.renderPopupBody());
    });
  },

  addPhoto(inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.draft.photos = this.draft.photos || [];
      this.draft.photos.push(reader.result);
      const photoIdx = this.draft.photos.length - 1;
      Popup.markDirty();
      Popup.setBody(this.renderPopupBody());
      uploadAndReplace(this.draft.photos, photoIdx);
    };
    reader.readAsDataURL(file);
  },
  removePhoto(photoIdx) {
    this.draft.photos.splice(photoIdx, 1);
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },

  setTopTab(tab) { this.topTab = tab; this.render(); },
  setYear(year) { this.selectedYear = year; this.render(); },

  // ---------- Render ----------
  render() {
    const def = SPECIES_SECTIONS[this.currentSection];
    const overlay = document.getElementById("modalOverlay");
    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">← Back</button>
          <h3>${def.title}</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
        </div>
        <div class="species-tabs">
          <button class="tab-btn ${this.topTab === "overview" ? "active" : ""}" onclick="SpeciesLog.setTopTab('overview')">Overview</button>
          ${!FLAT_SECTIONS.includes(this.currentSection) ? `<button class="tab-btn ${this.topTab === "list" ? "active" : ""}" onclick="SpeciesLog.setTopTab('list')">List</button>` : ""}
        </div>
        <div id="speciesLogBody"></div>
      </div>`;
    overlay.classList.remove("hidden");
    this.renderBody();
  },

  renderBody() {
    const body = document.getElementById("speciesLogBody");
    if (FLAT_SECTIONS.includes(this.currentSection)) { body.innerHTML = this.renderOverview() + this.renderFlatList(); return; }
    body.innerHTML = this.topTab === "list" ? this.renderCompactList() : this.renderOverview();
  },

  // ---------- Category totals ----------
  categoryTotalsFor(entries, year) {
    const def = SPECIES_SECTIONS[this.currentSection];
    const yearEntries = entries.filter((e) => seasonLabelFor(e.date, this.currentSection) === year);
    const totals = {};
    def.categories.forEach((c) => { totals[c] = 0; });
    yearEntries.forEach((e) => {
      if (FLAT_SECTIONS.includes(this.currentSection) && this.currentSection === "winged") {
        (e.lines || []).forEach((l) => { if (totals[l.category] !== undefined) totals[l.category] += parseInt(l.shots, 10) || 0; });
        return;
      }
      if (totals[e.category] === undefined) return;
      totals[e.category] += parseInt(e.shots, 10) || 1;
    });
    return totals;
  },

  entryTotal(e) {
    if (this.currentSection === "winged") return (e.lines || []).reduce((s, l) => s + (parseInt(l.shots, 10) || 0), 0);
    return parseInt(e.shots, 10) || 1;
  },

  // ---------- Overview — reference buttons live ONLY here ----------
  renderOverview() {
    const entries = this.entries();
    const years = seasonYearsFor(entries, this.currentSection);
    if (!years.includes(this.selectedYear)) this.selectedYear = years[0];
    const allTimeTotal = entries.reduce((sum, e) => sum + this.entryTotal(e), 0);
    const totals = this.categoryTotalsFor(entries, this.selectedYear);
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

    const refButtons = `
      ${this.currentSection === "fox" ? `<button class="tab-btn" onclick="ReferenceInfo.foxBoarLifecycle('Fox')">🦊 Lifecycle chart</button>` : ""}
      ${this.currentSection === "boar" ? `<button class="tab-btn" onclick="ReferenceInfo.foxBoarLifecycle('Wild boar')">🐗 Lifecycle chart</button><button class="tab-btn" onclick="ReferenceInfo.boarDisease()">🦠 Boar Disease</button>` : ""}
      ${this.currentSection === "winged" ? `<button class="tab-btn" onclick="ReferenceInfo.generalLicences()">📜 General Licences</button>` : ""}
    `;

    return `
      ${refButtons.trim() ? `<div class="species-tabs">${refButtons}</div>` : ""}
      ${renderStatCards([{ value: allTimeTotal, label: "Overall total (all years)" }])}
      <p class="hint">${seasonHintFor(this.currentSection)}</p>
      <div class="species-tabs">${renderYearTabs(years, this.selectedYear, this.currentSection, "SpeciesLog.setYear")}</div>
      ${renderStatCards([{ value: grandTotal, label: "Total — season " + this.selectedYear }])}
      <div style="margin-top:10px;">${renderCategoryTable(totals, grandTotal)}</div>`;
  },

  // ---------- COMPACT sections: List — Add pinned top, farm-grouped, oldest-first ----------
  renderCompactList() {
    const farms = window.APP_DATA.farms || [];
    const entries = this.entries();                    // whole list — positions in it are what the edit popup uses
    const shown = listInYear(entries, this.currentSection, this.selectedYear);   // just the selected year
    const groups = farms.map((f) => ({ id: f.id, name: f.name, list: shown.filter((e) => (e.farmId || "other") === f.id) }));
    const other = shown.filter((e) => !e.farmId || e.farmId === "other" || !farms.some((f) => f.id === e.farmId));
    if (other.length) groups.push({ id: "other", name: "Other", list: other });

    const cols = this.listColumns();
    const colLabel = (e, skip) => cols.filter((c) => c !== skip).map((c) => c === "category" ? e.category : c === "area" ? (e.area || "") : c === "location" ? (e.location || "") : c === "firearm" ? (e.firearm || "") : c === "condition" ? (e.condition || "") : c === "field" ? Fields.nameFor(e.farmId, e.fieldId) : c === "notes" ? (e.notes || "") : "").filter(Boolean).join(" · ");

    const scope = this.currentSection;
    const groupsHtml = groups
      .map((g) => {
        const sorted = g.list.slice().sort((a, b) => (a.date || "").localeCompare(b.date || "")); // oldest first
        const rows = sorted
          .map((e) => {
            const idx = entries.indexOf(e);
            return `
      <div class="log-row-card compact-row" onclick="SpeciesLog.openEditPopup(${idx})" style="cursor:pointer;">
        <div class="log-row compact-summary cs3">
          <span>${displayDate(e.date)}</span>
          <span>${cols.includes("category") ? escapeHtml(e.category || "") : ""}</span>
          <span>${colLabel(e, "category")}</span>
        </div>
      </div>`;
          })
          .join("");
        return PropertyRows.blockHtml(scope, g.id, g.name, g.list.length, rows, "SpeciesLog.renderBody()", `SpeciesLog.openFarmQuickView('${g.id}')`);
      })
      .join("");
    const groupIds = groups.map((g) => g.id);

    return `
      <button class="btn small" style="display:block; width:100%;" onclick="SpeciesLog.openAddPopup()">+ Add entry</button>
      ${W3W_SPECIES.includes(this.currentSection) ? `
      <label class="btn small ghost" style="display:block; text-align:center; margin-top:8px; cursor:pointer;">
        📷 Add via camera
        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="SpeciesLog.addEntryFromCamera(this)" />
      </label>` : ""}
      ${listYearTabsHtml(entries, this.currentSection, this.selectedYear, "SpeciesLog.setYear")}
      ${listHeaderHtml("Entries", shown.length, "SpeciesLog.openColumnSettings()")}
      ${shown.length ? "" : listEmptyYearHtml(entries, this.currentSection, this.selectedYear)}
      ${PropertyRows.barHtml(scope, groupIds, "SpeciesLog.renderBody()")}
      <div>${groupsHtml || '<p class="hint">No properties yet — tap "+ Add entry" above.</p>'}</div>`;
  },

  openFarmQuickView(farmId) {
    const entries = this.entries().filter((e) => (e.farmId || "other") === farmId || (farmId === "other" && (!e.farmId || !( window.APP_DATA.farms||[]).some(f=>f.id===e.farmId))));
    const years = seasonYearsFor(entries, this.currentSection);
    const cur = currentSeasonLabel(this.currentSection);
    const byYear = {};
    let total = 0;
    entries.forEach((e) => {
      total += this.entryTotal(e);
      const y = seasonLabelFor(e.date, this.currentSection);
      byYear[y] = (byYear[y] || 0) + this.entryTotal(e);
    });
    const rows = years
      .map((y) => `<tr><td>${y}${y === cur ? " (current)" : ""}</td><td><strong>${byYear[y] || 0}</strong></td><td>${W3W_SPECIES.includes(this.currentSection) ? `<button class="icon-btn" style="font-size:13px;" onclick="ShotLocationMap.open('${this.currentSection}','${farmId}')">📍 Map</button>` : ""}</td></tr>`)
      .join("");
    const name = this.farmName(farmId);
    ReferenceInfo.showModal(name, `
      ${renderStatCards([{ value: total, label: "Total" }])}
      <div class="table-scroll" style="margin-top:10px;"><table class="data-table"><tr><th>Season year</th><th>Total</th><th></th></tr>${rows}</table></div>
      ${W3W_SPECIES.includes(this.currentSection) ? `<button class="btn secondary small" style="width:100%; margin-top:14px;" onclick="ShotLocationMap.open('${this.currentSection}','${farmId}')">📍 Total kills map — all seasons</button>` : ""}
      ${FIELD_SECTIONS.includes(this.currentSection) && farmId !== "other" ? Fields.byFieldBlockHtml(farmId, entries, this.currentSection, (e) => this.entryTotal(e)) : ""}`);
  },

  addEntryFromCamera(inputEl) {
    LocationMatch.captureWithCamera(inputEl, async (photoDataUrl, loc) => {
      const entry = this.newEntryDefaults();
      if (loc) {
        entry.what3words = loc.what3words;
        entry.lat = loc.lat;
        entry.lng = loc.lng;
        entry.farmId = loc.farmId;
        if (FIELD_SECTIONS.includes(this.currentSection)) entry.fieldId = loc.fieldId || "";
      }
      entry.photos = [photoDataUrl];
      this.entries().push(entry);
      const idx = this.entries().length - 1;
      persistData();
      uploadAndReplace(entry.photos, 0);
      if (loc) {
        entry.weather = await fetchWeatherForEntry(loc.lat, loc.lng, entry.date);
        persistData();
      }
      this.renderBody();
    });
  },

  // ---------- FLAT sections: one outing list, no farm grouping ----------
  renderFlatList() {
    const cols = this.listColumns();
    const colLabel = (e) => cols.map((c) => {
      if (c === "shots") return this.currentSection === "winged" ? (e.lines || []).map((l) => `${l.category} x${l.shots}`).join(", ") : `x${e.shots}`;
      if (c === "location") return (!e.farmId || e.farmId === "other") ? (e.locationText || "") : this.farmName(e.farmId);
      if (c === "firearm") return e.firearm || "";
      if (c === "notes") return e.notes || "";
      return "";
    }).filter(Boolean).join(" · ");

    const all = this.entries();
    const inYear = new Set(listInYear(all, this.currentSection, this.selectedYear)); // the year buttons above are the Overview's
    const rows = all
      .map((e, idx) => inYear.has(e) ? `
      <div class="log-row-card compact-row" onclick="SpeciesLog.openEditPopup(${idx})" style="cursor:pointer;">
        <div class="log-row compact-summary cs2">
          <span>${displayDate(e.date)}</span>
          <span>${colLabel(e)}</span>
        </div>
      </div>` : "")
      .join("");
    return `
      <button class="btn small" style="display:block; width:100%;" onclick="SpeciesLog.openAddPopup()">+ Add</button>
      ${listHeaderHtml("Entries", this.entries().length, "SpeciesLog.openColumnSettings()")}
      <div>${rows || '<p class="hint">No entries yet — tap "+ Add" to log one.</p>'}</div>`;
  },

  // ---------- The popup editor — shared shape for compact and flat drafts ----------
  renderPopupBody() {
    const e = this.draft;
    const isFlat = FLAT_SECTIONS.includes(this.currentSection);
    const isWinged = this.currentSection === "winged";
    const def = SPECIES_SECTIONS[this.currentSection];
    const farms = window.APP_DATA.farms || [];
    const w3wEnabled = isFlat || W3W_SPECIES.includes(this.currentSection);
    const photos = e.photos || [];
    const photoThumbs = photos
      .map((p, pIdx) => `<span class="photo-thumb-wrap"><img src="${cloudinaryThumb(p, 60)}" class="zeroing-thumb" /><button class="icon-btn photo-remove" onclick="SpeciesLog.removePhoto(${pIdx})">✕</button></span>`)
      .join("");

    const isRich = RICH_SECTIONS.includes(this.currentSection);
    let html = Popup.header(`${def.title} Entry`);
    html += `<div style="padding:0 16px 16px;">`;
    html += `<div class="log-row">
      <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Date</span>
      ${DateInput.html(e.date, "SpeciesLog.updateDraft('date', v)")}</label>
      ${!isFlat ? `<label style="width:92px;"><span class="hint" style="display:block; margin:0 0 2px;">AM/PM</span><select onchange="SpeciesLog.updateDraft('ampm',this.value)">
        <option value="" ${!e.ampm ? "selected" : ""}>Not set</option>
        <option ${e.ampm === "AM" ? "selected" : ""}>AM</option>
        <option ${e.ampm === "PM" ? "selected" : ""}>PM</option>
      </select></label>` : ""}
    </div>`;

    if (isFlat) {
      if (isWinged) {
        html += `<div class="section-title" style="margin-top:8px;"><h4>Species</h4></div>`;
        (e.lines || []).forEach((line, lineIdx) => {
          html += `<div class="log-row">
            <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Species</span>
            <select onchange="SpeciesLog.updateDraftLine(${lineIdx},'category',this.value)">
              ${WINGED_VERMIN_LIST.map((c) => `<option ${c === line.category ? "selected" : ""}>${c}</option>`).join("")}
            </select></label>
            <label style="width:90px;"><span class="hint" style="display:block; margin:0 0 2px;">Amount</span>
            <input type="number" min="0" placeholder="Amount" value="${line.shots}" onchange="SpeciesLog.updateDraftLine(${lineIdx},'shots',this.value)" /></label>
            <button class="icon-btn" onclick="SpeciesLog.removeDraftLine(${lineIdx})">✕</button>
          </div>`;
        });
        html += `<button class="btn small ghost" onclick="SpeciesLog.addDraftLine()">+ Add species</button>`;
        html += `<div class="log-row" style="margin-top:8px;">${Popup.labeled("Shots taken (whole day)", `<input type="number" min="0" placeholder="Shots taken" value="${e.shotsTaken === undefined || e.shotsTaken === null ? "" : e.shotsTaken}" onchange="SpeciesLog.updateDraft('shotsTaken',this.value)" />`)}</div>`;
      } else {
        html += `<div class="log-row"><label style="width:120px;"><span class="hint" style="display:block; margin:0 0 2px;">Amount</span><input type="number" min="0" placeholder="Amount" value="${e.shots}" onchange="SpeciesLog.updateDraft('shots',this.value)" /></label></div>`;
      }
      // Location: your properties, then the places you've saved (Game Shooting, Clay, Zeroing, earlier "Other" places),
      // then "+ Add new place" / "Other (type below)". Saved places are NOT properties.
      const saved = Places.saved();
      const onOther = !e.farmId || e.farmId === "other";
      const onPlace = onOther && e.locationText && saved.includes(e.locationText);
      const sel = onPlace ? "place:" + e.locationText : (onOther ? "other" : e.farmId);
      html += `<div class="log-row">
        <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Location</span>
        <select onchange="SpeciesLog.setFlatLocation(this.value)">
          ${farms.length ? `<optgroup label="My properties">${farms.map((f) => `<option value="${f.id}" ${sel === f.id ? "selected" : ""}>${escapeHtml(f.name)}</option>`).join("")}</optgroup>` : ""}
          ${saved.length ? `<optgroup label="Saved places">${saved.map((p) => `<option value="place:${escapeHtml(p)}" ${sel === "place:" + p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}</optgroup>` : ""}
          <option value="__add_place__">+ Add new place</option>
          <option value="other" ${sel === "other" ? "selected" : ""}>Other (type below)</option>
        </select></label>
      </div>`;
      if (sel === "other") {
        html += `<div class="log-row"><label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Type a location</span><input type="text" placeholder="Type a location" value="${escapeHtml(e.locationText || "")}" onchange="SpeciesLog.updateDraft('locationText',this.value)" /></label></div>`;
      }
    } else if (isRich) {
      const conditions = (typeof DEER_CONDITIONS !== "undefined") ? DEER_CONDITIONS : ["Good", "Fair", "Poor", "Rejected"];
      html += `<div class="log-row">
        <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Category</span>
        <select onchange="SpeciesLog.updateDraft('category',this.value)">
          ${def.categories.map((c) => `<option ${c === e.category ? "selected" : ""}>${c}</option>`).join("")}
        </select></label>
      </div>
      <div class="log-row">
        <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Location</span>
          <input type="text" placeholder="Location" value="${e.location || ""}" onchange="SpeciesLog.updateDraft('location',this.value)" />
        </label>
        <label style="width:100px;"><span class="hint" style="display:block; margin:0 0 2px;">Time</span>
          <input type="time" value="${e.time || ""}" onchange="SpeciesLog.updateDraft('time',this.value)" />
        </label>
      </div>
      <div class="log-row">
        <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Weight (kg)</span>
          <input type="number" placeholder="Weight (kg)" value="${e.weight || ""}" onchange="SpeciesLog.updateDraft('weight',this.value)" />
        </label>
        <label style="width:100px;"><span class="hint" style="display:block; margin:0 0 2px;">Tag no.</span>
          <input type="text" placeholder="Tag no." value="${e.tag || ""}" onchange="SpeciesLog.updateDraft('tag',this.value)" />
        </label>
      </div>
      <div class="log-row">
        <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Condition</span>
          <select onchange="SpeciesLog.updateDraft('condition',this.value)">
            ${conditions.map((c) => `<option ${c === e.condition ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="log-row">
        <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Abnormalities</span>
          <input type="text" placeholder="Abnormalities" value="${e.abnormalities || ""}" onchange="SpeciesLog.updateDraft('abnormalities',this.value)" />
        </label>
      </div>
      <div class="log-row">
        <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Shot placement</span>
          <input type="text" placeholder="Shot placement" value="${e.shotPlacement || ""}" onchange="SpeciesLog.updateDraft('shotPlacement',this.value)" />
        </label>
      </div>
      <div class="log-row">
        <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Shot by</span>
          <input type="text" placeholder="Shot by" value="${e.shotBy || ""}" onchange="SpeciesLog.updateDraft('shotBy',this.value)" />
        </label>
        <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Inspected by</span>
          <input type="text" placeholder="Inspected by" value="${e.recordedBy || ""}" onchange="SpeciesLog.updateDraft('recordedBy',this.value)" />
        </label>
      </div>
      <div class="log-row">
        <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Destination</span>
          <input type="text" placeholder="Destination" value="${e.destination || ""}" onchange="SpeciesLog.updateDraft('destination',this.value)" />
        </label>
      </div>
      ${Fields.propertyAndFieldHtml(e, "SpeciesLog")}`;
    } else {
      html += `<div class="log-row">
        <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Category</span>
        <select onchange="SpeciesLog.updateDraft('category',this.value)">
          ${def.categories.map((c) => `<option ${c === e.category ? "selected" : ""}>${c}</option>`).join("")}
        </select></label>
      </div>
      <div class="log-row">
        <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Area (within property)</span>
          <input type="text" placeholder="Area" value="${e.area || ""}" onchange="SpeciesLog.updateDraft('area',this.value)" />
        </label>
        <label style="width:80px;"><span class="hint" style="display:block; margin:0 0 2px;">Shots</span>
          <input type="number" min="0" placeholder="Shots" value="${e.shots}" onchange="SpeciesLog.updateDraft('shots',this.value)" />
        </label>
      </div>
      ${Fields.propertyAndFieldHtml(e, "SpeciesLog")}`;
    }

    if (w3wEnabled) {
      html += `<div class="log-row">
        <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">what3words</span>
          <input type="text" placeholder="///what3words" value="${e.what3words || ""}" onchange="SpeciesLog.saveTypedWords(this.value)" />
        </label>
        <button class="btn small ghost" onclick="SpeciesLog.captureW3w()">📍 Auto</button>
      </div>
      <div class="log-row">${Popup.labeled("Coordinates (latitude, longitude)", `<input type="text" placeholder="e.g. 54.9353, -5.1566 or N54° 56.117' W005° 09.396'" value="${Fields.coordinatesText(e)}" onchange="SpeciesLog.saveCoordinates(this.value)" />`)}</div>`;
    }

    html += `<div class="log-row"><span class="hint" style="margin:0;">🌦️ Weather: ${e.weather || "— (set a location to auto-fill)"}</span></div>`;
    html += `<div class="log-row"><span class="hint" style="margin:0;">${moonPhaseLabel(e.date) || ""} (that night)</span></div>`;
    html += `<div class="log-row">
      <label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Firearm</span>
      <select onchange="SpeciesLog.handleFirearmChange(this)">
        <option value="" ${!e.firearm ? "selected" : ""}>Firearm…</option>
        ${Firearms.list().map((f) => `<option ${f === e.firearm ? "selected" : ""}>${f}</option>`).join("")}
        <option value="__add_new__">+ Add new firearm…</option>
      </select></label>
    </div>`;
    html += `<div class="log-row"><label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Location notes</span><input type="text" placeholder="On-the-ground spot description" value="${e.locationNotes || ""}" onchange="SpeciesLog.updateDraft('locationNotes',this.value)" /></label></div>`;
    html += `<div class="log-row"><label style="flex:1;"><span class="hint" style="display:block; margin:0 0 2px;">Notes</span><input type="text" placeholder="Notes" value="${e.notes || ""}" onchange="SpeciesLog.updateDraft('notes',this.value)" /></label></div>`;
    html += `<div class="log-row photo-row">
      ${photoThumbs}
      <label class="btn small ghost" style="cursor:pointer;">+ Photo
        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="SpeciesLog.addPhoto(this)" />
      </label>
    </div>`;
    html += `${Popup.removeFooter("SpeciesLog.removeDraft()", "Remove entry")}`;
    html += Popup.saveFooter("SpeciesLog.saveDraft()");
    html += `</div>`;
    return html;
  },
};
