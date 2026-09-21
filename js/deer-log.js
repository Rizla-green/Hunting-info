/* =====================================================================
   DEER — matches v3.9's real structure exactly:

   Species-wide (screen-deer) is ONE continuous page, not tabs:
     reference buttons -> all-time stat (click for species breakdown
     popup) -> year tabs -> year total -> Species x Male/Female/Young/
     Total table -> "Properties" quick-view list (popup summaries) ->
     "Cull Plans" full directory (search/add, leads into the farm's
     six-tab workspace).

   A farm's workspace (screen-property) has six real tabs: Overview,
   Setup, Deer Counts, Cull Quota Plan, Cull Record Log, Dashboard.
===================================================================== */

const SPECIES_LIST = ["Red deer", "Fallow deer", "Roe deer", "Sika deer", "Chinese water deer", "Muntjac"];
const SPECIES_TERMS = {
  "Red deer":           { male: "Stag", female: "Hind", young: "Calf" },
  "Fallow deer":        { male: "Buck", female: "Doe",  young: "Fawn" },
  "Roe deer":           { male: "Buck", female: "Doe",  young: "Kid" },
  "Sika deer":          { male: "Stag", female: "Hind", young: "Calf" },
  "Chinese water deer": { male: "Buck", female: "Doe",  young: "Fawn" },
  "Muntjac":            { male: "Buck", female: "Doe",  young: "Fawn" },
};
const DEER_CONDITIONS = ["Good", "Fair", "Poor", "Rejected"];

const DeerLog = {
  currentFarmId: null,
  farmTab: "overview",   // 'overview' | 'setup' | 'counts' | 'quota' | 'log' | 'dashboard'
  speciesWideTab: "overview", // 'overview' | 'list' | 'cullplans'
  selectedYear: null,
  subView: "log",
  draft: null,       // entry currently open in the popup (a working copy — not yet saved)
  draftIdx: null,    // index into entries() being edited, or null if this draft is a new entry

  newEntryDefaults() {
    const farms = window.APP_DATA.farms || [];
    return {
      date: new Date().toISOString().slice(0, 10),
      species: SPECIES_LIST[0],
      sex: SPECIES_TERMS[SPECIES_LIST[0]].male,
      age: "",   // blank until chosen — never assumed
      farmId: this.currentFarmId || "other",   // starts on Other unless opened from inside one farm's Cull Plan
      location: "", what3words: "", lat: null, lng: null, weather: "",
      fieldId: "",   // named field inside the property; auto-set from a pin, changeable by hand
      time: "", weight: "", tag: "", firearm: "", condition: DEER_CONDITIONS[0],
      abnormalities: "", shotPlacement: "", shotBy: "", recordedBy: "", destination: "",
      photos: [], notes: "",
      locationNotes: "",
    };
  },

  openAddPopup(farmId) {
    this.draft = this.newEntryDefaults();
    if (farmId) this.draft.farmId = farmId;
    this.draftIdx = null;
    Popup.open(this.renderPopupBody(), () => { if (this.currentFarmId) this.renderFarmWorkspace(); else this.renderSpeciesWide(); });
  },
  openEditPopup(idx) {
    this.draft = { ...this.entries()[idx], photos: [...(this.entries()[idx].photos || [])] };   // own copy of the photo list, so removing a photo isn't final until Save
    this.draftIdx = idx;
    Popup.open(this.renderPopupBody(), () => { if (this.currentFarmId) this.renderFarmWorkspace(); else this.renderSpeciesWide(); });
  },
  updateDraft(field, value) {
    this.draft[field] = value;
    if (field === "species" && SPECIES_TERMS[value]) {
      // Keep a sex that already suits the new species (e.g. an imported "Doe"); otherwise start on the male term.
      const t = SPECIES_TERMS[value];
      if (![t.male, t.female, t.young].includes(this.draft.sex)) this.draft.sex = t.male;
    }
    if (field === "farmId") this.draft.fieldId = Fields.validFieldId(value, this.draft.fieldId); // a field only belongs to its own property
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },
  saveDraft() {
    if (this.draftIdx === null) this.entries().push(this.draft);
    else this.entries()[this.draftIdx] = this.draft;
    persistData();
    this.selectedYear = seasonLabelFor(this.draft.date, "deer"); // the list moves to the saved entry's year so it doesn't seem to vanish
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

  entries() {
    window.APP_DATA.species = window.APP_DATA.species || {};
    window.APP_DATA.species.deer = window.APP_DATA.species.deer || [];
    return window.APP_DATA.species.deer;
  },

  scopedEntries() {
    if (!this.currentFarmId) return this.entries();
    return this.entries().filter((e) => (e.farmId || "other") === this.currentFarmId);
  },

  farmName(farmId) {
    if (!farmId || farmId === "other") return "Other";
    return (window.APP_DATA.farms || []).find((f) => f.id === farmId)?.name || "Other";
  },
  findFarm(farmId) {
    return (window.APP_DATA.farms || []).find((f) => f.id === farmId);
  },

  ensureDeerSetup(farm) {
    if (!farm.deerSetup) {
      farm.deerSetup = {
        hasCullPlan: false, season: "", manager: "", contact: "", landAreaHa: "", objective: "",
        species: {}, quotaTargets: {},
      };
    }
    if (farm.deerSetup.landAreaHa === undefined) farm.deerSetup.landAreaHa = "";
    if (farm.deerSetup.season === undefined) farm.deerSetup.season = "";
    if (farm.deerSetup.manager === undefined) farm.deerSetup.manager = "";
    if (farm.deerSetup.contact === undefined) farm.deerSetup.contact = "";
    if (farm.deerSetup.objective === undefined) farm.deerSetup.objective = "";
    Object.keys(SPECIES_TERMS).forEach((sp) => {
      if (!farm.deerSetup.species[sp]) farm.deerSetup.species[sp] = { present: false, estPopulation: "", targetRatio: "", notes: "" };
      if (!farm.deerSetup.quotaTargets[sp]) {
        const t = SPECIES_TERMS[sp];
        farm.deerSetup.quotaTargets[sp] = { [t.male]: 0, [t.female]: 0, [t.young]: 0 };
      }
    });
    return farm.deerSetup;
  },

  open() {
    this.currentFarmId = null;
    this.speciesWideTab = "overview";
    this.selectedYear = currentSeasonLabel("deer");
    this.render();
  },

  // Photos chosen from the phone's library: a new entry with the photos and NO location (see SpeciesLog).
  async addEntryFromLibrary(inputEl) {
    const files = Array.from(inputEl.files || []);
    inputEl.value = "";
    if (!files.length) return;
    const entry = this.newEntryDefaults();
    entry.photos = [];
    for (const file of files) entry.photos.push(await PhotoTools.fileToDataUrl(file));
    this.entries().push(entry);
    const idx = this.entries().length - 1;
    persistData();
    entry.photos.forEach((_, i) => uploadAndReplace(entry.photos, i));
    this.openEditPopup(idx);
  },

  addEntryFromCamera(inputEl) {
    LocationMatch.captureWithCamera(inputEl, (photoDataUrl, loc) => {
      const entry = this.newEntryDefaults();
      if (loc) {
        entry.farmId = loc.farmId;
        entry.fieldId = loc.fieldId || "";
        entry.what3words = loc.what3words;
        entry.lat = loc.lat;
        entry.lng = loc.lng;
      }
      entry.photos = [photoDataUrl];
      this.entries().push(entry);
      const idx = this.entries().length - 1;
      persistData();
      uploadAndReplace(entry.photos, 0);
      const finish = async () => {
        if (loc) {
          entry.weather = await fetchWeatherForEntry(loc.lat, loc.lng, entry.date);
          persistData();
        }
        this.openEditPopup(idx);
      };
      finish();
    });
  },

  // what3words typed or pasted by hand is just saved as typed. (Turning typed words into a
  // map position needs a paid what3words plan, so nothing is looked up. Positions come from
  // 📍 Auto (GPS) or from Options > Place pins.)
  // Coordinates typed by hand (from a GPS, a map, a spreadsheet…): sets the position and, from Other, the property/field.
  saveCoordinates(value) {
    return Fields.applyCoordinates(this, value, true);
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
      this.draft.fieldId = Fields.fieldIdForPin(this.draft.farmId, loc);
      Popup.markDirty();
      Popup.setBody(this.renderPopupBody());
      this.draft.weather = await fetchWeatherForEntry(loc.lat, loc.lng, this.draft.date);
      Popup.setBody(this.renderPopupBody());
    });
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
  async addPhoto(inputEl) {
    const files = Array.from(inputEl.files || []);
    inputEl.value = "";   // so the same photo can be picked again
    for (const file of files) {
      const dataUrl = await PhotoTools.fileToDataUrl(file);
      if (!this.draft) return;   // the popup was closed while the photo was being prepared
      this.draft.photos = this.draft.photos || [];
      this.draft.photos.push(dataUrl);
      const photoIdx = this.draft.photos.length - 1;
      Popup.markDirty();
      Popup.setBody(this.renderPopupBody());
      uploadAndReplace(this.draft.photos, photoIdx);
    }
  },
  removePhoto(photoIdx) {
    if (!confirm("Delete this picture? This can't be undone.")) return;
    this.draft.photos.splice(photoIdx, 1);
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },

  saveAndRender() { persistData(); this.render(); },

  sexOptionsFor(species) {
    const t = SPECIES_TERMS[species];
    return t ? [t.male, t.female, t.young] : []; // blank/unknown species (e.g. from an import) has no terms yet
  },

  setYear(year) { this.selectedYear = year; this.render(); },
  setFarmTab(tab) { this.farmTab = tab; this.render(); },
  setSubView(v) { this.subView = v; this.render(); },
  drillIntoFarm(farmId) {
    this.currentFarmId = farmId;
    this.farmTab = "overview";
    document.getElementById("modalOverlay").classList.add("hidden");
    this.render();
  },
  backToSpeciesWide() {
    this.currentFarmId = null;
    this.render();
  },

  groupByField() {
    const groups = {};
    listInYear(this.scopedEntries(), "deer", this.selectedYear).forEach((e) => {
      const key = Fields.nameFor(e.farmId, e.fieldId) || e.location || "(no field name)";
      groups[key] = groups[key] || [];
      groups[key].push(e);
    });
    return groups;
  },

  // ---------- Close season compliance ----------
  // Checks an entry's species/sex/date against CLOSE_SEASON for the
  // farm's country (reference-info.js). Returns null if compliant/unknown,
  // or a short warning string if it falls in a closed season.
  checkCompliance(farmId, species, sex, dateStr) {
    const farm = this.findFarm(farmId);
    const country = farm?.profile?.country;
    if (!country || !CLOSE_SEASON[country] || !CLOSE_SEASON[country][species]) return null;
    const rule = CLOSE_SEASON[country][species];
    const terms = SPECIES_TERMS[species];
    const isMale = sex === terms.male;
    const seasonText = isMale ? rule.male : rule.female;
    if (!seasonText || seasonText.includes("No close season") || seasonText === "N/A") return null;
    // The table holds the OPEN season for this species/sex, e.g. "1 Apr – 31 Oct". Compared by exact
    // day (not whole months), so a season starting on the 21st only opens on the 21st.
    const range = parseSeasonRange(seasonText);
    if (!range) return null;
    let month, day;
    const iso = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) { month = parseInt(iso[2], 10) - 1; day = parseInt(iso[3], 10); }
    else { const d = new Date(dateStr); if (isNaN(d)) return null; month = d.getMonth(); day = d.getDate(); }
    const value = month * 100 + day, start = range.sm * 100 + range.sd, end = range.em * 100 + range.ed;
    const inOpenSeason = start <= end ? (value >= start && value <= end) : (value >= start || value <= end);
    return inOpenSeason ? null : `Closed season in ${country} for this date`;
  },

  // ---------- Render ----------
  render() {
    if (!this.currentFarmId) { this.renderSpeciesWide(); return; }
    this.renderFarmWorkspace();
  },

  // ===================================================================
  // SPECIES-WIDE — one continuous page, matching v3.9 exactly
  // ===================================================================
  renderSpeciesWide() {
    const overlay = document.getElementById("modalOverlay");
    const years = seasonYearsFor(this.entries(), "deer");
    if (!years.includes(this.selectedYear)) this.selectedYear = years[0];

    let allTimeTotal = 0;
    this.entries().forEach((e) => {
      const terms = SPECIES_TERMS[e.species];
      if (terms && (e.age === "Young" || e.sex === terms.male || e.sex === terms.female)) allTimeTotal++;
    });

    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">← Back</button>
          <h3>Deer</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
        </div>
        <div class="species-tabs">
          <button class="tab-btn ${this.speciesWideTab === "overview" ? "active" : ""}" onclick="DeerLog.setSpeciesWideTab('overview')">Overview</button>
          <button class="tab-btn ${this.speciesWideTab === "list" ? "active" : ""}" onclick="DeerLog.setSpeciesWideTab('list')">List</button>
          <button class="tab-btn ${this.speciesWideTab === "cullplans" ? "active" : ""}" onclick="DeerLog.setSpeciesWideTab('cullplans')">Cull Plans</button>
        </div>
        <div id="deerSpeciesWideBody"></div>
      </div>`;
    overlay.classList.remove("hidden");
    this.renderSpeciesWideBody(allTimeTotal, years);
  },

  setSpeciesWideTab(tab) { this.speciesWideTab = tab; this.renderSpeciesWide(); },

  renderSpeciesWideBody(allTimeTotal, years) {
    const body = document.getElementById("deerSpeciesWideBody");
    if (this.speciesWideTab === "list") {
      body.innerHTML = `
        <button class="btn small" style="display:block; width:100%;" onclick="DeerLog.openAddPopup()">+ Add entry</button>
        ${listYearTabsHtml(this.entries(), "deer", this.selectedYear, "DeerLog.setYear")}
        ${listHeaderHtml("Entries", listInYear(this.entries(), "deer", this.selectedYear).length, "DeerLog.openColumnSettings()")}
        <p class="hint">Tap a property's name for its total deer shot and the tally by year.</p>
        <div id="deerQuickPropList"></div>`;
      this.renderQuickPropList();
      return;
    }
    if (this.speciesWideTab === "cullplans") {
      body.innerHTML = `
        <input type="text" id="deerFarmSearch" placeholder="Filter properties…" oninput="DeerLog.filterCullPlanList(this.value)"
          style="width:100%; box-sizing:border-box; padding:8px 10px; border-radius:8px; border:1px solid var(--gold-dim); background:var(--navy); color:var(--cream); margin-bottom:10px;" />
        <div id="deerCullPlanList"></div>`;
      this.renderCullPlanList();
      return;
    }
    // Overview
    body.innerHTML = `
      <div class="species-tabs">
        <button class="tab-btn" onclick="ReferenceInfo.seasons()">Seasons</button>
        <button class="tab-btn" onclick="ReferenceInfo.lymphNodes()">Lymph Nodes</button>
        <button class="tab-btn" onclick="ReferenceInfo.deerDisease()">Disease</button>
        <button class="tab-btn" onclick="ReferenceInfo.deerLifecycle()">Lifecycle</button>
      </div>
      <div class="section-title"><h4>Deer culled — all properties</h4></div>
      ${renderStatCards([{ value: allTimeTotal, label: "Overall total shot (all years) — tap for breakdown" }])
        .replace('<div class="stat-card">', `<div class="stat-card" style="cursor:pointer;" onclick="DeerLog.openSpeciesBreakdown()">`)}
      <p class="hint">Season year runs 1 April – 31 March.</p>
      <div class="species-tabs">${renderYearTabs(years, this.selectedYear, "deer", "DeerLog.setYear")}</div>
      <div id="deerYearStat"></div>
      <div id="deerYearTable"></div>`;
    this.renderYearBlock();
  },

  listColumnCandidates: [
    { key: "species", label: "Species" }, { key: "location", label: "Location" }, { key: "field", label: "Field" },
    { key: "firearm", label: "Weapon" }, { key: "notes", label: "Notes" },
  ],
  listColumns() {
    window.APP_DATA.listColumnPrefs = window.APP_DATA.listColumnPrefs || {};
    return window.APP_DATA.listColumnPrefs.deer || ["species", "location"];
  },
  openColumnSettings() {
    const current = this.listColumns();
    const html = `
      ${Popup.header("List columns")}
      <div style="padding:0 16px 16px;">
        <p class="hint" style="margin-top:0;">Date and Sex always show. Choose what else appears on each summary line.</p>
        ${this.listColumnCandidates.map((c) => `
          <label style="display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--navy-light);">
            <input type="checkbox" ${current.includes(c.key) ? "checked" : ""} onchange="DeerLog.toggleListColumn('${c.key}', this.checked)" />
            ${c.label}
          </label>`).join("")}
      </div>`;
    Popup.open(html, () => this.renderSpeciesWide());
  },
  toggleListColumn(key, checked) {
    window.APP_DATA.listColumnPrefs = window.APP_DATA.listColumnPrefs || {};
    let cols = window.APP_DATA.listColumnPrefs.deer || ["species", "location"];
    cols = checked ? [...new Set([...cols, key])] : cols.filter((c) => c !== key);
    window.APP_DATA.listColumnPrefs.deer = cols;
    persistData();
  },

  renderYearBlock() {
    const yearEntries = this.entries().filter((e) => seasonLabelFor(e.date, "deer") === this.selectedYear);
    const totals = {};
    SPECIES_LIST.forEach((sp) => { totals[sp] = { male: 0, female: 0, young: 0 }; });
    yearEntries.forEach((e) => {
      const terms = SPECIES_TERMS[e.species];
      if (!terms || !totals[e.species]) return;
      if (e.age === "Young") totals[e.species].young++;
      else if (e.sex === terms.male) totals[e.species].male++;
      else if (e.sex === terms.female) totals[e.species].female++;
    });
    let grandM = 0, grandF = 0, grandY = 0;
    let rows = "";
    SPECIES_LIST.forEach((sp) => {
      const t = SPECIES_TERMS[sp];
      const row = totals[sp];
      const total = row.male + row.female + row.young;
      grandM += row.male; grandF += row.female; grandY += row.young;
      rows += `<tr><td><strong>${sp}</strong></td><td>${row.male} <span class="hint">(${t.male})</span></td><td>${row.female} <span class="hint">(${t.female})</span></td><td>${row.young} <span class="hint">(${t.young})</span></td><td><strong>${total}</strong></td></tr>`;
    });
    const grandTotal = grandM + grandF + grandY;
    rows += `<tr style="font-weight:700;"><td>All species</td><td>${grandM}</td><td>${grandF}</td><td>${grandY}</td><td>${grandTotal}</td></tr>`;

    document.getElementById("deerYearStat").innerHTML = renderStatCards([{ value: grandTotal, label: "Total shot — season " + this.selectedYear }]);
    document.getElementById("deerYearTable").innerHTML = `<div class="table-scroll"><table class="data-table">
      <tr><th>Species</th><th>Male</th><th>Female</th><th>Young</th><th>Total</th></tr>${rows}</table></div>`;
  },

  openSpeciesBreakdown() {
    const totals = {};
    SPECIES_LIST.forEach((sp) => { totals[sp] = { male: 0, female: 0 }; });
    this.entries().forEach((e) => {
      const terms = SPECIES_TERMS[e.species];
      if (!terms) return;
      if (e.sex === terms.male) totals[e.species].male++;
      else if (e.sex === terms.female) totals[e.species].female++;
    });
    let grandM = 0, grandF = 0, rows = "";
    SPECIES_LIST.forEach((sp) => {
      const t = SPECIES_TERMS[sp];
      const row = totals[sp];
      if (row.male === 0 && row.female === 0) return;
      grandM += row.male; grandF += row.female;
      rows += `<tr><td><strong>${sp}</strong></td><td>${row.male} <span class="hint">(${t.male})</span></td><td>${row.female} <span class="hint">(${t.female})</span></td><td><strong>${row.male + row.female}</strong></td></tr>`;
    });
    if (!rows) rows = `<tr><td colspan="4">No cull entries logged yet.</td></tr>`;
    else rows += `<tr style="font-weight:700;"><td>All species</td><td>${grandM}</td><td>${grandF}</td><td>${grandM + grandF}</td></tr>`;

    ReferenceInfo.showModal("Overall totals by species", `
      <p class="hint" style="margin-top:0;">All properties, all seasons. Young are counted under Male or Female by their actual sex.</p>
      <div class="table-scroll"><table class="data-table"><tr><th>Species</th><th>Male</th><th>Female</th><th>Total</th></tr>${rows}</table></div>`);
  },

  renderQuickPropList() {
    const farms = window.APP_DATA.farms || [];
    const el = document.getElementById("deerQuickPropList");
    if (farms.length === 0) { el.innerHTML = `<p class="hint">No properties yet — add one below under Cull Plans.</p>`; return; }
    const entries = this.entries();                    // whole list — positions in it are what the edit popup uses
    const shown = listInYear(entries, "deer", this.selectedYear);   // just the selected year
    const groups = farms.map((f) => ({ id: f.id, name: f.name, list: shown.filter((e) => (e.farmId || "other") === f.id) }));
    const other = shown.filter((e) => !e.farmId || e.farmId === "other" || !farms.some((f) => f.id === e.farmId));
    if (other.length) groups.push({ id: "other", name: "Other", list: other });

    const cols = this.listColumns();
    const colLabel = (e) => cols.map((c) => c === "species" ? e.species : c === "location" ? (e.location || "") : c === "field" ? Fields.nameFor(e.farmId, e.fieldId) : c === "firearm" ? (e.firearm || "") : c === "notes" ? (e.notes || "") : "").filter(Boolean).join(" · ");

    el.innerHTML = PropertyRows.barHtml("deer", groups.map((g) => g.id), "DeerLog.renderQuickPropList()") + groups
      .map((g) => {
        const sorted = g.list.slice().sort(compareByDateOldestFirst); // oldest first, undated last
        const rowHtml = (e) => {
            const idx = entries.indexOf(e);
            const warning = this.checkCompliance(e.farmId, e.species, e.sex, e.date);
            return `
      <div class="log-row-card compact-row" onclick="DeerLog.openEditPopup(${idx})" style="cursor:pointer;">
        ${warning ? `<div class="compliance-warning">⚠ ${warning}</div>` : ""}
        <div class="log-row compact-summary cs3">
          <span>${displayDate(e.date)}</span>
          <span>${e.sex}</span>
          <span>${colLabel(e)}</span>
        </div>
      </div>`;
        };
        // All of one species together (in the app's usual order), oldest at the top of each.
        const order = [...SPECIES_LIST];
        sorted.forEach((e) => { if (e.species && !order.includes(e.species)) order.push(e.species); });
        const block = (title, list) => list.length
          ? `<div class="species-subhead">${escapeHtml(title)} (${list.length})</div>${list.map(rowHtml).join("")}` : "";
        const rows = order.map((sp) => block(sp, sorted.filter((e) => e.species === sp))).join("")
          + block("No species", sorted.filter((e) => !e.species));
        return PropertyRows.blockHtml("deer", g.id, g.name, g.list.length, rows, "DeerLog.renderQuickPropList()", `DeerLog.openPropertyQuickView('${g.id}')`);
      })
      .join("") || '<p class="hint">No entries yet — tap "+ Add entry" above.</p>';
  },

  openPropertyQuickView(farmId) {
    const farm = this.findFarm(farmId);
    const entries = this.entries().filter((e) => (e.farmId || "other") === farmId);
    const years = seasonYearsFor(entries, "deer");
    const cur = currentSeasonLabel("deer");
    const byYear = {};
    let total = 0;
    entries.forEach((e) => {
      const terms = SPECIES_TERMS[e.species];
      if (!terms) return;
      if (!(e.age === "Young" || e.sex === terms.male || e.sex === terms.female)) return;
      total++;
      const y = seasonLabelFor(e.date, "deer");
      byYear[y] = (byYear[y] || 0) + 1;
    });
    const rows = years
      .map((y) => `<tr><td>${y}${y === cur ? " (current)" : ""}</td><td><strong>${byYear[y] || 0}</strong></td><td><button class="icon-btn" style="font-size:13px;" onclick="ShotLocationMap.open('deer','${farmId}')">📍 Map</button></td></tr>`)
      .join("");

    const name = farmId === "other" ? "Other" : (farm ? farm.name : "Other");
    ReferenceInfo.showModal(name, `
      ${renderStatCards([{ value: total, label: "Total shot" }])}
      <div class="table-scroll" style="margin-top:10px;"><table class="data-table"><tr><th>Season year</th><th>Shot</th><th></th></tr>${rows}</table></div>
      ${farm ? `<button class="btn secondary small" style="width:100%; margin-top:14px;" onclick="ShotLocationMap.open('deer','${farmId}')">📍 Total kills map — all seasons</button>
      <button class="btn small" style="width:100%; margin-top:8px;" onclick="DeerLog.drillIntoFarm('${farmId}')">Open full Cull Plan workspace</button>` : ""}
      ${farm ? Fields.byFieldBlockHtml(farmId, entries.filter((e) => { const t = SPECIES_TERMS[e.species]; return t && (e.age === "Young" || e.sex === t.male || e.sex === t.female); }), "deer", () => 1) : ""}`);
  },

  renderCullPlanList(filter) {
    const farms = (window.APP_DATA.farms || []).filter((f) => !filter || f.name.toLowerCase().includes(filter.toLowerCase()));
    const el = document.getElementById("deerCullPlanList");
    const rows = farms.map((f) => renderLocationRow(f, "DeerLog.drillIntoFarm")).join("");
    el.innerHTML =
      `<button class="btn small" style="display:block; width:100%; margin-bottom:10px;" onclick="addFarm()">+ Add property</button>` +
      `<div class="farm-list">${rows || '<p class="hint">No properties match.</p>'}</div>`;
  },
  filterCullPlanList(q) { this.renderCullPlanList(q); },

  // ===================================================================
  // FARM WORKSPACE — six real tabs
  // ===================================================================
  renderFarmWorkspace() {
    const overlay = document.getElementById("modalOverlay");
    const farm = this.findFarm(this.currentFarmId);
    const hasCullPlan = farm?.deerSetup?.hasCullPlan;
    const tabs = [
      ["overview", "Overview"], ["setup", "Setup"], ["counts", "Deer Counts"],
      ...(hasCullPlan ? [["quota", "Cull Quota Plan"]] : []),
      ["log", "Cull Record Log"], ["dashboard", "Dashboard"],
    ];

    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="DeerLog.backToSpeciesWide()">← Back</button>
          <h3>${farm.name}</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
        </div>
        <button class="btn secondary small" style="margin:6px 0;" onclick="DeerLog.exportCullPlan()">⬇ Cull Plan Export</button>
        <div class="species-tabs">
          ${tabs.map(([key, label]) => `<button class="tab-btn ${this.farmTab === key ? "active" : ""}" onclick="DeerLog.setFarmTab('${key}')">${label}</button>`).join("")}
        </div>
        <div id="deerLogBody"></div>
      </div>`;
    overlay.classList.remove("hidden");
    this.renderFarmBody(farm);
  },

  renderFarmBody(farm) {
    const body = document.getElementById("deerLogBody");
    switch (this.farmTab) {
      case "setup": body.innerHTML = this.renderSetup(farm); break;
      case "counts": body.innerHTML = `<div class="section-title"><h4>Survey / count log</h4></div><p class="hint">Deer Counts are imported from your Deer Count app rather than logged here.</p>`; break;
      case "quota": body.innerHTML = this.renderQuotaPlan(farm); break;
      case "log": body.innerHTML = this.renderCullRecordLog(farm); break;
      case "dashboard": body.innerHTML = this.renderDashboard(farm); break;
      default: body.innerHTML = this.renderFarmOverview(farm);
    }
  },

  renderFarmOverview(farm) {
    const scoped = this.scopedEntries();
    const years = seasonYearsFor(scoped, "deer");
    if (!years.includes(this.selectedYear)) this.selectedYear = years[0];
    const yearEntries = scoped.filter((e) => seasonLabelFor(e.date, "deer") === this.selectedYear);

    let allTime = 0;
    scoped.forEach((e) => {
      const terms = SPECIES_TERMS[e.species];
      if (terms && (e.age === "Young" || e.sex === terms.male || e.sex === terms.female)) allTime++;
    });

    const totals = {};
    SPECIES_LIST.forEach((sp) => { totals[sp] = { male: 0, female: 0, young: 0 }; });
    yearEntries.forEach((e) => {
      const terms = SPECIES_TERMS[e.species];
      if (!terms || !totals[e.species]) return;
      if (e.age === "Young") totals[e.species].young++;
      else if (e.sex === terms.male) totals[e.species].male++;
      else if (e.sex === terms.female) totals[e.species].female++;
    });
    let grandM = 0, grandF = 0, grandY = 0, rows = "";
    SPECIES_LIST.forEach((sp) => {
      const t = SPECIES_TERMS[sp];
      const row = totals[sp];
      const total = row.male + row.female + row.young;
      grandM += row.male; grandF += row.female; grandY += row.young;
      rows += `<tr><td><strong>${sp}</strong></td><td>${row.male} <span class="hint">(${t.male})</span></td><td>${row.female} <span class="hint">(${t.female})</span></td><td>${row.young} <span class="hint">(${t.young})</span></td><td><strong>${total}</strong></td></tr>`;
    });
    const grandTotal = grandM + grandF + grandY;
    rows += `<tr style="font-weight:700;"><td>All species</td><td>${grandM}</td><td>${grandF}</td><td>${grandY}</td><td>${grandTotal}</td></tr>`;

    return `
      ${renderStatCards([{ value: allTime, label: "Overall total culled (all years)" }])}
      <p class="hint">Season year runs 1 April – 31 March.</p>
      <div class="species-tabs">${renderYearTabs(years, this.selectedYear, "deer", "DeerLog.setYear")}</div>
      ${renderStatCards([{ value: grandTotal, label: "Total culled — season " + this.selectedYear }])}
      <button class="btn secondary small" style="margin:8px 0;" onclick="ShotLocationMap.open('deer','${this.currentFarmId}')">📍 View shot locations map</button>
      <div class="table-scroll"><table class="data-table"><tr><th>Species</th><th>Male</th><th>Female</th><th>Young</th><th>Total</th></tr>${rows}</table></div>
      <button class="btn secondary small" style="margin-top:10px;" onclick="ShotLocationMap.open('deer','${this.currentFarmId}')">📍 Total kills map — all seasons</button>`;
  },

  renderSetup(farm) {
    const setup = this.ensureDeerSetup(farm);
    const speciesRows = Object.keys(SPECIES_TERMS)
      .map((sp) => {
        const s = setup.species[sp];
        return `
      <div class="log-row">
        <label style="display:flex;align-items:center;gap:6px;flex:1;min-width:110px;">
          <input type="checkbox" ${s.present ? "checked" : ""} onchange="DeerLog.setSpeciesField('${sp}','present', this.checked)" />
          ${sp}
        </label>
        ${Popup.labeled("Est. population", `<input type="number" placeholder="Est. population" value="${s.estPopulation || ""}" onchange="DeerLog.setSpeciesField('${sp}','estPopulation', this.value)" style="width:110px;" />`, "flex:none;")}
        ${Popup.labeled("Target ratio", `<input type="text" placeholder="Target ratio" value="${s.targetRatio || ""}" onchange="DeerLog.setSpeciesField('${sp}','targetRatio', this.value)" style="width:90px;" />`, "flex:none;")}
        ${Popup.labeled("Notes", `<input type="text" placeholder="Notes" value="${s.notes || ""}" onchange="DeerLog.setSpeciesField('${sp}','notes', this.value)" />`)}
      </div>`;
      })
      .join("");

    return `
      <div class="section-title"><h4>Property &amp; season details</h4></div>
      <div class="log-row">${Popup.labeled("Season", `<input type="text" placeholder="Season (e.g. 2026/27)" value="${setup.season}" onchange="DeerLog.setSetupField('season', this.value)" />`)}</div>
      <div class="log-row">${Popup.labeled("DMQ holder / manager", `<input type="text" placeholder="DMQ holder / manager" value="${setup.manager}" onchange="DeerLog.setSetupField('manager', this.value)" />`)}</div>
      <div class="log-row">${Popup.labeled("Contact number / email", `<input type="text" placeholder="Contact number / email" value="${setup.contact}" onchange="DeerLog.setSetupField('contact', this.value)" />`)}</div>
      <div class="log-row">${Popup.labeled("Total land area (ha)", `<input type="number" placeholder="Total land area (ha)" value="${setup.landAreaHa}" onchange="DeerLog.setSetupField('landAreaHa', this.value)" />`)}</div>
      <div class="log-row">${Popup.labeled("Cull plan", `<select onchange="DeerLog.toggleCullPlan(this.value === 'true')">
          <option value="true" ${setup.hasCullPlan ? "selected" : ""}>Plan in place</option>
          <option value="false" ${!setup.hasCullPlan ? "selected" : ""}>No plan in place</option>
        </select>`)}</div>
      <div class="log-row">${Popup.labeled("Habitat / management objective", `<textarea class="farm-notes" placeholder="Habitat / management objective" onchange="DeerLog.setSetupField('objective', this.value)">${setup.objective}</textarea>`, "display:block; width:100%;")}</div>

      <div class="section-title" style="margin-top:14px;"><h4>Species present &amp; population</h4></div>
      ${speciesRows}
      <p class="hint">Enter your best current estimate. Deer Counts tab logs the underlying survey(s) this is based on.</p>`;
  },

  setSetupField(field, value) {
    const farm = this.findFarm(this.currentFarmId);
    this.ensureDeerSetup(farm)[field] = value;
    this.saveAndRender();
  },
  setSpeciesField(species, field, value) {
    const farm = this.findFarm(this.currentFarmId);
    this.ensureDeerSetup(farm).species[species][field] = value;
    this.saveAndRender();
  },
  toggleCullPlan(checked) {
    const farm = this.findFarm(this.currentFarmId);
    this.ensureDeerSetup(farm).hasCullPlan = checked;
    this.saveAndRender();
  },

  renderQuotaPlan(farm) {
    const setup = this.ensureDeerSetup(farm);
    const years = seasonYearsFor(this.scopedEntries(), "deer");
    if (!years.includes(this.selectedYear)) this.selectedYear = years[0];
    const yearEntries = this.scopedEntries().filter((e) => seasonLabelFor(e.date, "deer") === this.selectedYear);

    const rows = Object.keys(SPECIES_TERMS)
      .filter((sp) => setup.species[sp].present)
      .map((sp) => {
        const terms = SPECIES_TERMS[sp];
        const targets = setup.quotaTargets[sp];
        return [terms.male, terms.female, terms.young]
          .map((term) => {
            const achieved = yearEntries.filter((e) => e.species === sp && e.sex === term).length;
            const target = targets[term] || 0;
            const remaining = Math.max(0, target - achieved);
            const pct = target > 0 ? Math.round((achieved / target) * 100) : 0;
            return `<tr><td>${sp} — ${term}</td><td><input type="number" min="0" value="${target}" style="width:55px;" onchange="DeerLog.setQuotaTarget('${sp}','${term}',this.value)" /></td><td>${achieved}</td><td>${remaining}</td><td>${pct}%</td></tr>`;
          })
          .join("");
      })
      .join("");

    if (!rows) return `<p class="hint">Tick which species are present on the Setup tab to set quota targets for them.</p>`;
    return `<div class="species-tabs">${renderYearTabs(years, this.selectedYear, "deer", "DeerLog.setYear")}</div>
      <div class="table-scroll" style="margin-top:10px;"><table class="data-table"><tr><th>Species — Term</th><th>Target</th><th>Achieved</th><th>Remaining</th><th>%</th></tr>${rows}</table></div>`;
  },

  setQuotaTarget(species, term, value) {
    const farm = this.findFarm(this.currentFarmId);
    this.ensureDeerSetup(farm).quotaTargets[species][term] = parseInt(value, 10) || 0;
    this.saveAndRender();
  },

  renderDashboard(farm) {
    const setup = this.ensureDeerSetup(farm);
    if (!setup.hasCullPlan) return `<p class="hint">No cull plan in place for this farm — set one up on the Setup tab to see progress here.</p>`;
    const yearEntries = this.scopedEntries().filter((e) => seasonLabelFor(e.date, "deer") === this.selectedYear);
    const speciesPresent = Object.keys(SPECIES_TERMS).filter((sp) => setup.species[sp].present);
    if (!speciesPresent.length) return `<p class="hint">Tick which species are present on the Setup tab to see progress here.</p>`;

    let totalAchieved = 0, totalTarget = 0;
    speciesPresent.forEach((sp) => {
      const t = SPECIES_TERMS[sp];
      [t.male, t.female, t.young].forEach((term) => {
        totalTarget += setup.quotaTargets[sp][term] || 0;
        totalAchieved += yearEntries.filter((e) => e.species === sp && e.sex === term).length;
      });
    });

    const bars = speciesPresent
      .map((sp) => {
        const terms = SPECIES_TERMS[sp];
        return [terms.male, terms.female, terms.young]
          .map((term) => {
            const target = setup.quotaTargets[sp][term] || 0;
            const achieved = yearEntries.filter((e) => e.species === sp && e.sex === term).length;
            const pct = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
            return `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--cream);"><span>${sp} — ${term}</span><span>${achieved}/${target}</span></div><div style="background:var(--navy);border-radius:6px;height:8px;overflow:hidden;margin-top:3px;"><div style="background:var(--gold);height:100%;width:${pct}%;"></div></div></div>`;
          })
          .join("");
      })
      .join("");

    return `
      ${renderStatCards([
        { value: totalAchieved, label: "Achieved — season " + this.selectedYear },
        { value: totalTarget, label: "Target — season " + this.selectedYear },
        { value: Math.max(0, totalTarget - totalAchieved), label: "Remaining" },
      ])}
      <h4 style="margin-top:16px;">Achieved vs target</h4>
      ${bars}`;
  },

  exportCullPlan() {
    const farm = this.findFarm(this.currentFarmId);
    const rows = this.scopedEntries().map((e) => ({
      Date: e.date, Species: e.species, Sex: e.sex, Age: e.age, Location: e.location,
      Field: Fields.nameFor(e.farmId, e.fieldId), "what3words": e.what3words, Weight: e.weight, Firearm: e.firearm, Condition: e.condition,
      "Recorded by": e.recordedBy, "Shot by": e.shotBy, Destination: e.destination, Notes: e.notes,
    }));
    exportSectionExcel("deer-cull-plan-" + farm.name.replace(/[^a-z0-9]+/gi, "-"), rows, farm.name);
  },

  renderCullRecordLog(farm) {
    return `
      <button class="btn small" onclick="DeerLog.openAddPopup('${farm.id}')">+ Add entry</button>
      <label class="btn small ghost" style="display:inline-block; margin-left:8px; cursor:pointer;">
        📷 Add via camera
        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="DeerLog.addEntryFromCamera(this)" />
      </label>
      <label class="btn small ghost" style="display:inline-block; margin-left:8px; cursor:pointer;">
        🖼 Add from photos (no location)
        <input type="file" accept="image/*" multiple style="display:none;" onchange="DeerLog.addEntryFromLibrary(this)" />
      </label>
      <p class="hint">Every entry is checked against the close season for this property's country automatically.</p>
      ${listHeaderHtml("Entries", this.scopedEntries().length, "DeerLog.openFieldSettings()", "Choose which boxes show in the entry popup")}
      <div class="species-tabs">
        <button class="tab-btn ${this.subView === "log" ? "active" : ""}" onclick="DeerLog.setSubView('log')">Entry Log</button>
        <button class="tab-btn ${this.subView === "by-field" ? "active" : ""}" onclick="DeerLog.setSubView('by-field')">By Field Name</button>
      </div>
      ${listYearTabsHtml(this.scopedEntries(), "deer", this.selectedYear, "DeerLog.setYear")}
      <div style="margin-top:8px;">${this.subView === "log" ? this.renderFlatLog() : this.renderGroupedByField()}</div>`;
  },

  fieldDefs: [
    { key: "location", label: "Location" },
    { key: "what3words", label: "what3words" },
    { key: "time", label: "Time (nearest hour)" },
    { key: "weight", label: "Weight (kg)" },
    { key: "tag", label: "Tag no." },
    { key: "firearm", label: "Firearm" },
    { key: "condition", label: "Condition" },
    { key: "abnormalities", label: "Abnormalities" },
    { key: "shotPlacement", label: "Shot placement" },
    { key: "shotBy", label: "Shot by" },
    { key: "recordedBy", label: "Inspected by" },
    { key: "destination", label: "Destination" },
    { key: "photos", label: "Photos" },
    { key: "notes", label: "Notes" },
  ],
  openFieldSettings() {
    openFieldSettings("deer", "Deer", this.fieldDefs, () => this.render());
  },

  renderFlatLog() {
    const entries = listInYear(this.scopedEntries(), "deer", this.selectedYear);
    if (!entries.length) return listEmptyYearHtml(this.scopedEntries(), "deer", this.selectedYear);
    const rows = entries.slice().sort(compareByDateOldestFirst) // Cull Record Log: plain date order, oldest first, undated last
      .map((e) => {
        const idx = this.entries().indexOf(e);
        const warning = this.checkCompliance(e.farmId, e.species, e.sex, e.date);
        return `
      <div class="log-row-card compact-row" onclick="DeerLog.openEditPopup(${idx})" style="cursor:pointer;">
        ${warning ? `<div class="compliance-warning">⚠ ${warning}</div>` : ""}
        <div class="log-row compact-summary cs3">
          <span>${displayDate(e.date)}</span>
          <span>${e.sex}</span>
          <span>${e.location || ""}</span>
        </div>
      </div>`;
      })
      .join("");
    return rows || '<p class="hint">No entries yet — tap "+ Add entry" above to log one.</p>';
  },

  // ---------- The popup editor for a single Cull Record Log entry (draft) ----------
  renderPopupBody() {
    const e = this.draft;
    const on = (f) => isFieldOn("deer", f);
    const photos = e.photos || [];
    const photoThumbs = photos
      .map((p, pIdx) => `<span class="photo-thumb-wrap"><img src="${cloudinaryThumb(p, 60)}" class="zeroing-thumb" /><button class="icon-btn photo-remove" onclick="DeerLog.removePhoto(${pIdx})">✕</button></span>`)
      .join("");
    const warning = this.checkCompliance(e.farmId, e.species, e.sex, e.date);
    const farms = window.APP_DATA.farms || [];

    let html = Popup.header("Deer Entry");
    html += `<div style="padding:0 16px 16px;">`;
    if (warning) html += `<div class="compliance-warning">⚠ ${warning}</div>`;
    html += `<div class="log-row">
      ${Popup.labeled("Date", `${DateInput.html(e.date, "DeerLog.updateDraft('date', v)")}`)}
      ${Popup.labeled("Species", `<select onchange="DeerLog.updateDraft('species',this.value)">
        ${SPECIES_TERMS[e.species] ? "" : `<option value="" selected>Species…</option>`}
        ${Object.keys(SPECIES_TERMS).map((s) => `<option ${s === e.species ? "selected" : ""}>${s}</option>`).join("")}
      </select>`)}
    </div>
    <div class="log-row">
      ${Popup.labeled("Sex", `<select onchange="DeerLog.updateDraft('sex',this.value)">
        ${(!e.sex || !this.sexOptionsFor(e.species).includes(e.sex)) ? `<option value="" ${e.sex ? "" : "selected"}>Sex…</option>${e.sex ? `<option selected>${escapeHtml(e.sex)}</option>` : ""}` : ""}
        ${this.sexOptionsFor(e.species).map((s) => `<option ${s === e.sex ? "selected" : ""}>${s}</option>`).join("")}
      </select>`)}
      ${Popup.labeled("Age", `<select onchange="DeerLog.updateDraft('age',this.value)">
        <option value="" ${!e.age ? "selected" : ""}>Not set</option>
        ${["Adult", "Young"].map((a) => `<option ${a === e.age ? "selected" : ""}>${a}</option>`).join("")}
      </select>`)}
    </div>
    <div class="log-row">
      ${Popup.labeled("Property", `<select onchange="DeerLog.updateDraft('farmId',this.value)">
        ${farms.map((f) => `<option value="${f.id}" ${e.farmId === f.id ? "selected" : ""}>${f.name}</option>`).join("")}
        <option value="other" ${!e.farmId || e.farmId === "other" ? "selected" : ""}>Other</option>
      </select>`)}
    </div>
    ${Fields.selectRowHtml(e, "DeerLog")}
    <div class="log-row">
      ${on("location") ? Popup.labeled("Location", `<input type="text" placeholder="Location" value="${e.location || ""}" onchange="DeerLog.updateDraft('location',this.value)" />`) : ""}
      ${on("time") ? `<div class="row-below">${Popup.labeled("Time", `<input type="time" value="${e.time || ""}" onchange="DeerLog.updateDraft('time',this.value)" />`, "width:100px;")}</div>` : ""}
    </div>
    ${on("what3words") ? `<div class="log-row">
      ${Popup.labeled("what3words", `<input type="text" placeholder="///what3words" value="${e.what3words || ""}" onchange="DeerLog.saveTypedWords(this.value)" />`)}
      <div class="row-below"><button class="btn small ghost" onclick="DeerLog.captureW3w()">📍 Auto</button></div>
    </div>
    <div class="log-row">${Popup.labeled("Coordinates (latitude, longitude)", `<input type="text" placeholder="e.g. 54.9353, -5.1566 or N54° 56.117' W005° 09.396'" value="${Fields.coordinatesText(e)}" onchange="DeerLog.saveCoordinates(this.value)" />`)}</div>` : ""}
    <div class="log-row"><span class="hint" style="margin:0;">🌦️ Weather: ${e.weather || "— (set a location to auto-fill)"}</span></div>
    <div class="log-row"><span class="hint" style="margin:0;">${moonPhaseLabel(e.date) || ""} (that night)</span></div>
    <div class="log-row">
      ${on("weight") ? Popup.labeled("Weight (kg)", `<input type="number" placeholder="Weight (kg)" value="${e.weight || ""}" onchange="DeerLog.updateDraft('weight',this.value)" />`, "width:100px;") : ""}
      ${on("tag") ? Popup.labeled("Tag no.", `<input type="text" placeholder="Tag no." value="${e.tag || ""}" onchange="DeerLog.updateDraft('tag',this.value)" />`, "width:90px;") : ""}
      ${on("condition") ? `<div class="row-below">${Popup.labeled("Condition", `<select onchange="DeerLog.updateDraft('condition',this.value)">
        ${DEER_CONDITIONS.map((c) => `<option ${c === e.condition ? "selected" : ""}>${c}</option>`).join("")}
      </select>`)}</div>` : ""}
    </div>
    ${on("firearm") ? `<div class="log-row">
      ${Popup.labeled("Firearm", `<select onchange="DeerLog.handleFirearmChange(this)">
        <option value="" ${!e.firearm ? "selected" : ""}>Firearm…</option>
        ${Firearms.list().map((f) => `<option ${f === e.firearm ? "selected" : ""}>${f}</option>`).join("")}
        <option value="__add_new__">+ Add new firearm…</option>
      </select>`)}
    </div>` : ""}
    <div class="log-row">
      ${on("abnormalities") ? Popup.labeled("Abnormalities", `<input type="text" placeholder="Abnormalities" value="${e.abnormalities || ""}" onchange="DeerLog.updateDraft('abnormalities',this.value)" />`) : ""}
      ${on("shotPlacement") ? Popup.labeled("Shot placement", `<input type="text" placeholder="Shot placement" value="${e.shotPlacement || ""}" onchange="DeerLog.updateDraft('shotPlacement',this.value)" />`) : ""}
    </div>
    <div class="log-row">
      ${on("shotBy") ? Popup.labeled("Shot by", `<input type="text" placeholder="Shot by" value="${e.shotBy || ""}" onchange="DeerLog.updateDraft('shotBy',this.value)" />`) : ""}
      ${on("recordedBy") ? Popup.labeled("Inspected by", `<input type="text" placeholder="Inspected by" value="${e.recordedBy || ""}" onchange="DeerLog.updateDraft('recordedBy',this.value)" />`) : ""}
    </div>
    <div class="log-row">
      ${on("destination") ? Popup.labeled("Destination", `<input type="text" placeholder="Destination" value="${e.destination || ""}" onchange="DeerLog.updateDraft('destination',this.value)" />`) : ""}
    </div>
    <div class="log-row">
      ${Popup.labeled("Location notes", `<input type="text" placeholder="On-the-ground spot description" value="${e.locationNotes || ""}" onchange="DeerLog.updateDraft('locationNotes',this.value)" />`)}
    </div>
    <div class="log-row">
      ${on("notes") ? Popup.labeled("Notes", `<input type="text" placeholder="Notes" value="${e.notes || ""}" onchange="DeerLog.updateDraft('notes',this.value)" />`) : ""}
    </div>
    ${on("photos") ? `<div class="log-row photo-row">
      ${photoThumbs}
      <label class="btn small ghost" style="cursor:pointer;">📷 Take photo
        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="DeerLog.addPhoto(this)" />
      </label>
      <label class="btn small ghost" style="cursor:pointer;">🖼 From photos
        <input type="file" accept="image/*" multiple style="display:none;" onchange="DeerLog.addPhoto(this)" />
      </label>
    </div>` : ""}
    ${Popup.removeFooter("DeerLog.removeDraft()", "Remove entry")}
    ${Popup.saveFooter("DeerLog.saveDraft()")}
    </div>`;
    return html;
  },

  renderGroupedByField() {
    const groups = this.groupByField();
    const keys = Object.keys(groups);
    if (keys.length === 0) return listEmptyYearHtml(this.scopedEntries(), "deer", this.selectedYear);
    return keys
      .map((key) => {
        const list = groups[key];
        const rows = list.map((e) => `<div class="grouped-row aligned"><span>${displayDate(e.date)}</span><span>${e.species}</span><span>${e.sex}</span><span>${e.age}</span></div>`).join("");
        return `<div class="grouped-block"><h4>${key} <span class="grouped-count">(${list.length})</span></h4>${rows}</div>`;
      })
      .join("");
  },
};
