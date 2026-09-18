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

// Candidate columns offered by each section's "list columns" cog, and sensible defaults.
const LIST_COLUMN_CANDIDATES_COMPACT = [
  { key: "category", label: "Category" }, { key: "area", label: "Area" },
  { key: "firearm", label: "Weapon" }, { key: "notes", label: "Notes" },
];
const LIST_COLUMN_CANDIDATES_FLAT = [
  { key: "shots", label: "Amount" }, { key: "location", label: "Location" },
  { key: "firearm", label: "Weapon" }, { key: "notes", label: "Notes" },
];
const LIST_COLUMN_DEFAULTS = {
  fox: ["category", "area"], boar: ["category", "area"], goats: ["category", "area"], squirrel: ["category", "area"],
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
    const candidates = isFlat ? LIST_COLUMN_CANDIDATES_FLAT : LIST_COLUMN_CANDIDATES_COMPACT;
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
      ampm: "AM",
      farmId: farms[0]?.id || "other",
      locationText: "",
      area: "",
      what3words: "",
      lat: null,
      lng: null,
      weather: "",
      category: def.categories[0],
      shots: 1,
      lines: FLAT_SECTIONS.includes(this.currentSection) ? [{ category: def.categories[0], shots: 1 }] : undefined,
      firearm: "",
      photos: [],
      notes: "",
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

  captureW3w() {
    LocationMatch.captureLocation(async (loc) => {
      if (!loc) return;
      this.draft.what3words = loc.what3words;
      this.draft.lat = loc.lat;
      this.draft.lng = loc.lng;
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
    const entries = this.entries();
    const groups = farms.map((f) => ({ id: f.id, name: f.name, list: entries.filter((e) => (e.farmId || "other") === f.id) }));
    const other = entries.filter((e) => !e.farmId || e.farmId === "other" || !farms.some((f) => f.id === e.farmId));
    if (other.length) groups.push({ id: "other", name: "Other", list: other });

    const cols = this.listColumns();
    const colLabel = (e) => cols.map((c) => c === "category" ? e.category : c === "area" ? (e.area || "") : c === "firearm" ? (e.firearm || "") : c === "notes" ? (e.notes || "") : "").filter(Boolean).join(" · ");

    const groupsHtml = groups
      .filter((g) => g.list.length > 0)
      .map((g) => {
        const sorted = g.list.slice().sort((a, b) => a.date.localeCompare(b.date)); // oldest first
        const rows = sorted
          .map((e) => {
            const idx = entries.indexOf(e);
            return `
      <div class="log-row-card compact-row" onclick="SpeciesLog.openEditPopup(${idx})" style="cursor:pointer;">
        <div class="log-row compact-summary">
          <span>${e.date}</span>
          <span>${colLabel(e)}</span>
        </div>
      </div>`;
          })
          .join("");
        return `
      <div class="section-title" style="margin-top:14px; cursor:pointer;" onclick="SpeciesLog.openFarmQuickView('${g.id}')"><h4>${g.name} <span class="grouped-count">(${g.list.length})</span></h4></div>
      ${rows}`;
      })
      .join("");

    return `
      <button class="icon-btn" onclick="SpeciesLog.openColumnSettings()" title="Choose list columns">⚙ List columns</button>
      <button class="btn small" style="margin-top:10px; display:block; width:100%;" onclick="SpeciesLog.openAddPopup()">+ Add entry</button>
      ${W3W_SPECIES.includes(this.currentSection) ? `
      <label class="btn small ghost" style="display:block; text-align:center; margin-top:8px; cursor:pointer;">
        📷 Add via camera
        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="SpeciesLog.addEntryFromCamera(this)" />
      </label>` : ""}
      <div style="margin-top:10px;">${groupsHtml || '<p class="hint">No entries yet — tap "+ Add entry" above.</p>'}</div>`;
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
      ${W3W_SPECIES.includes(this.currentSection) ? `<button class="btn secondary small" style="width:100%; margin-top:14px;" onclick="ShotLocationMap.open('${this.currentSection}','${farmId}')">📍 Total kills map — all seasons</button>` : ""}`);
  },

  addEntryFromCamera(inputEl) {
    LocationMatch.captureWithCamera(inputEl, async (photoDataUrl, loc) => {
      const entry = this.newEntryDefaults();
      if (loc) {
        entry.what3words = loc.what3words;
        entry.lat = loc.lat;
        entry.lng = loc.lng;
        entry.farmId = loc.farmId;
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

    const rows = this.entries()
      .map((e, idx) => `
      <div class="log-row-card compact-row" onclick="SpeciesLog.openEditPopup(${idx})" style="cursor:pointer;">
        <div class="log-row compact-summary">
          <span>${e.date}</span>
          <span>${colLabel(e)}</span>
        </div>
      </div>`)
      .join("");
    return `
      <button class="icon-btn" onclick="SpeciesLog.openColumnSettings()" title="Choose list columns">⚙ List columns</button>
      <button class="btn small" style="margin-top:10px; display:block; width:100%;" onclick="SpeciesLog.openAddPopup()">+ Add</button>
      <div style="margin-top:8px;">${rows || '<p class="hint">No entries yet — tap "+ Add" to log one.</p>'}</div>`;
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

    let html = Popup.header(`${def.title} Entry`);
    html += `<div style="padding:0 16px 16px;">`;
    html += `<div class="log-row">
      <input type="date" value="${e.date}" onchange="SpeciesLog.updateDraft('date',this.value)" />
      ${!isFlat ? `<select onchange="SpeciesLog.updateDraft('ampm',this.value)" style="width:70px;">
        <option ${e.ampm === "AM" ? "selected" : ""}>AM</option>
        <option ${e.ampm === "PM" ? "selected" : ""}>PM</option>
      </select>` : ""}
    </div>`;

    if (isFlat) {
      if (isWinged) {
        html += `<div class="section-title" style="margin-top:8px;"><h4>Species</h4></div>`;
        (e.lines || []).forEach((line, lineIdx) => {
          html += `<div class="log-row">
            <select onchange="SpeciesLog.updateDraftLine(${lineIdx},'category',this.value)">
              ${WINGED_VERMIN_LIST.map((c) => `<option ${c === line.category ? "selected" : ""}>${c}</option>`).join("")}
            </select>
            <input type="number" min="0" placeholder="Amount" value="${line.shots}" onchange="SpeciesLog.updateDraftLine(${lineIdx},'shots',this.value)" style="width:90px;" />
            <button class="icon-btn" onclick="SpeciesLog.removeDraftLine(${lineIdx})">✕</button>
          </div>`;
        });
        html += `<button class="btn small ghost" onclick="SpeciesLog.addDraftLine()">+ Add species</button>`;
      } else {
        html += `<div class="log-row"><input type="number" min="0" placeholder="Amount" value="${e.shots}" onchange="SpeciesLog.updateDraft('shots',this.value)" style="width:90px;" /></div>`;
      }
      html += `<div class="log-row">
        <select onchange="SpeciesLog.updateDraft('farmId',this.value)">
          ${farms.map((f) => `<option value="${f.id}" ${e.farmId === f.id ? "selected" : ""}>${f.name}</option>`).join("")}
          <option value="other" ${!e.farmId || e.farmId === "other" ? "selected" : ""}>Other (type below)</option>
        </select>
      </div>`;
      if (!e.farmId || e.farmId === "other") {
        html += `<div class="log-row"><input type="text" placeholder="Type a location" value="${e.locationText || ""}" onchange="SpeciesLog.updateDraft('locationText',this.value)" /></div>`;
      }
    } else {
      html += `<div class="log-row">
        <select onchange="SpeciesLog.updateDraft('category',this.value)">
          ${def.categories.map((c) => `<option ${c === e.category ? "selected" : ""}>${c}</option>`).join("")}
        </select>
      </div>
      <div class="log-row">
        <input type="text" placeholder="Area (within property)" value="${e.area || ""}" onchange="SpeciesLog.updateDraft('area',this.value)" />
        <input type="number" min="0" placeholder="Shots" value="${e.shots}" onchange="SpeciesLog.updateDraft('shots',this.value)" style="width:80px;" />
      </div>
      <div class="log-row">
        <select onchange="SpeciesLog.updateDraft('farmId',this.value)">
          ${farms.map((f) => `<option value="${f.id}" ${e.farmId === f.id ? "selected" : ""}>${f.name}</option>`).join("")}
          <option value="other" ${!e.farmId || e.farmId === "other" ? "selected" : ""}>Other</option>
        </select>
      </div>`;
    }

    if (w3wEnabled) {
      html += `<div class="log-row">
        <input type="text" placeholder="///what3words" value="${e.what3words || ""}" onchange="SpeciesLog.updateDraft('what3words',this.value)" />
        <button class="btn small ghost" onclick="SpeciesLog.captureW3w()">📍 Auto</button>
      </div>`;
    }

    html += `<div class="log-row"><span class="hint" style="margin:0;">🌦️ Weather: ${e.weather || "— (set a location to auto-fill)"}</span></div>`;
    html += `<div class="log-row"><span class="hint" style="margin:0;">${moonPhaseLabel(e.date) || ""} (that night)</span></div>`;
    html += `<div class="log-row">
      <select onchange="SpeciesLog.handleFirearmChange(this)">
        <option value="" ${!e.firearm ? "selected" : ""}>Firearm…</option>
        ${Firearms.list().map((f) => `<option ${f === e.firearm ? "selected" : ""}>${f}</option>`).join("")}
        <option value="__add_new__">+ Add new firearm…</option>
      </select>
    </div>`;
    html += `<div class="log-row"><input type="text" placeholder="Notes" value="${e.notes || ""}" onchange="SpeciesLog.updateDraft('notes',this.value)" /></div>`;
    html += `<div class="log-row photo-row">
      ${photoThumbs}
      <label class="btn small ghost" style="cursor:pointer;">+ Photo
        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="SpeciesLog.addPhoto(this)" />
      </label>
    </div>`;
    html += `<button class="icon-btn" onclick="SpeciesLog.removeDraft()" style="margin-top:10px;">✕ Remove entry</button>`;
    html += Popup.saveFooter("SpeciesLog.saveDraft()");
    html += `</div>`;
    return html;
  },
};
