/* =====================================================================
   DEER — Cull Record Log, plus the fuller six-tab structure per farm
   from v3.9: Overview, Setup, Deer Counts, Cull Quota Plan, Cull
   Record Log, Dashboard. Species-wide landing page (Overview/Locations)
   matches every other species; drilling into a farm reveals all six.

   Setup and quota targets live on the farm object itself:
     farm.deerSetup = {
       hasCullPlan: false,
       species: { "Red deer": {present:false, notes:""}, ... },
       quotaTargets: { "Red deer": {Stag:0, Hind:0, Calf:0}, ... }
     }
   Achieved is always computed live from the Cull Record Log — never
   stored — so it's automatically correct as entries are added/edited.
===================================================================== */

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
  topTab: "overview",       // 'overview' | 'locations' — species-wide only
  currentFarmId: null,
  farmTab: "overview",      // 'overview' | 'setup' | 'counts' | 'quota' | 'log' | 'dashboard'
  selectedYear: null,
  subView: "log",           // within Cull Record Log: 'log' | 'by-field'

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
      farm.deerSetup = { hasCullPlan: false, species: {}, quotaTargets: {} };
    }
    Object.keys(SPECIES_TERMS).forEach((sp) => {
      if (!farm.deerSetup.species[sp]) farm.deerSetup.species[sp] = { present: false, notes: "" };
      if (!farm.deerSetup.quotaTargets[sp]) {
        const t = SPECIES_TERMS[sp];
        farm.deerSetup.quotaTargets[sp] = { [t.male]: 0, [t.female]: 0, [t.young]: 0 };
      }
    });
    return farm.deerSetup;
  },

  open() {
    this.topTab = "overview";
    this.currentFarmId = null;
    this.selectedYear = currentSeasonLabel("deer");
    this.render();
  },

  addEntry() {
    const entries = this.entries();
    const last = entries[entries.length - 1];
    const farms = window.APP_DATA.farms || [];
    const defSpecies = Object.keys(SPECIES_TERMS)[0];
    entries.push({
      date: new Date().toISOString().slice(0, 10),
      species: defSpecies,
      sex: SPECIES_TERMS[defSpecies].male,
      age: "Adult",
      farmId: this.currentFarmId || last?.farmId || farms[0]?.id || "other",
      location: last ? last.location : "",
      what3words: "",
      lat: null,
      lng: null,
      weight: "",
      tag: "",
      firearm: last ? last.firearm : "",
      condition: DEER_CONDITIONS[0],
      recordedBy: last ? last.recordedBy : "",
      shotBy: last ? last.shotBy : "",
      destination: last ? last.destination : "",
      time: "",
      abnormalities: "",
      shotPlacement: "",
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
      const entries = this.entries();
      const last = entries[entries.length - 1];
      const farms = window.APP_DATA.farms || [];
      const defSpecies = Object.keys(SPECIES_TERMS)[0];
      const entry = {
        date: new Date().toISOString().slice(0, 10),
        species: defSpecies,
        sex: SPECIES_TERMS[defSpecies].male,
        age: "Adult",
        farmId: loc ? loc.farmId : this.currentFarmId || last?.farmId || farms[0]?.id || "other",
        location: last ? last.location : "",
        what3words: loc ? loc.what3words : "",
        lat: loc ? loc.lat : null,
        lng: loc ? loc.lng : null,
        weight: "",
        tag: "",
        firearm: last ? last.firearm : "",
        condition: DEER_CONDITIONS[0],
        recordedBy: last ? last.recordedBy : "",
        shotBy: last ? last.shotBy : "",
        destination: last ? last.destination : "",
        time: "",
        abnormalities: "",
        shotPlacement: "",
        photos: [photoDataUrl],
        notes: "",
      };
      entries.push(entry);
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
    const entry = this.entries()[idx];
    entry[field] = value;
    if (field === "species") entry.sex = SPECIES_TERMS[value].male;
    this.saveAndRender();
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

  sexOptionsFor(species) {
    const t = SPECIES_TERMS[species];
    return [t.male, t.female, t.young];
  },

  setTopTab(tab) { this.topTab = tab; this.render(); },
  setYear(year) { this.selectedYear = year; this.render(); },
  setFarmTab(tab) { this.farmTab = tab; this.render(); },
  setSubView(v) { this.subView = v; this.render(); },
  drillIntoFarm(farmId) {
    this.currentFarmId = farmId;
    this.farmTab = "overview";
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
      const key = e.location || "(no field name)";
      groups[key] = groups[key] || [];
      groups[key].push(e);
    });
    return groups;
  },

  // ---------- Render ----------
  render() {
    const overlay = document.getElementById("modalOverlay");
    const inFarm = !!this.currentFarmId;
    const farm = inFarm ? this.findFarm(this.currentFarmId) : null;

    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <h3>Deer${inFarm ? " — " + this.farmName(this.currentFarmId) : ""}</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">✕</button>
        </div>
        ${inFarm ? `<button class="tab-btn" onclick="DeerLog.backToSpeciesWide()">← All farms</button>` : ""}
        <div class="species-tabs">
          ${inFarm ? this.farmTabsHtml() : this.topTabsHtml()}
        </div>
        ${!inFarm ? "" : `<div class="species-tabs" style="margin-top:4px;">
          <button class="tab-btn" onclick="ShotLocationMap.open('deer', '${this.currentFarmId}')">📍 Map</button>
          <button class="tab-btn" onclick="ReferenceInfo.seasons()">Seasons</button>
          <button class="tab-btn" onclick="ReferenceInfo.lymphNodes()">Lymph Nodes</button>
          <button class="tab-btn" onclick="ReferenceInfo.deerDisease()">Disease</button>
          <button class="tab-btn" onclick="ReferenceInfo.deerLifecycle()">Lifecycle</button>
          <button class="tab-btn" onclick="CullPlanImport.openImportScreen()">⤓ Import Cull Plan</button>
        </div>`}
        <div id="deerLogBody"></div>
      </div>`;
    overlay.classList.remove("hidden");
    this.renderBody(farm);
  },

  topTabsHtml() {
    return `
      <button class="tab-btn ${this.topTab === "overview" ? "active" : ""}" onclick="DeerLog.setTopTab('overview')">Overview</button>
      <button class="tab-btn ${this.topTab === "locations" ? "active" : ""}" onclick="DeerLog.setTopTab('locations')">Locations</button>
      <button class="tab-btn" onclick="ShotLocationMap.open('deer', null)">📍 Map (all farms)</button>`;
  },

  farmTabsHtml() {
    const farm = this.findFarm(this.currentFarmId);
    const hasCullPlan = farm?.deerSetup?.hasCullPlan;
    const tabs = [
      ["overview", "Overview"], ["setup", "Setup"], ["counts", "Deer Counts"],
      ...(hasCullPlan ? [["quota", "Cull Quota Plan"]] : []),
      ["log", "Cull Record Log"], ["dashboard", "Dashboard"],
    ];
    return tabs
      .map(([key, label]) => `<button class="tab-btn ${this.farmTab === key ? "active" : ""}" onclick="DeerLog.setFarmTab('${key}')">${label}</button>`)
      .join("");
  },

  renderBody(farm) {
    const body = document.getElementById("deerLogBody");
    if (!this.currentFarmId) {
      body.innerHTML = this.topTab === "locations" ? this.renderLocationsList() : this.renderOverview();
      return;
    }
    switch (this.farmTab) {
      case "setup": body.innerHTML = this.renderSetup(farm); break;
      case "counts": body.innerHTML = `<p class="hint">Deer Counts are imported from your Deer Count app rather than logged here.</p>`; break;
      case "quota": body.innerHTML = this.renderQuotaPlan(farm); break;
      case "log": body.innerHTML = this.renderCullRecordLog(); break;
      case "dashboard": body.innerHTML = this.renderDashboard(farm); break;
      default: body.innerHTML = this.renderOverview();
    }
  },

  renderLocationsList() {
    return renderLocationsListHtml("DeerLog.drillIntoFarm", this.entries().some((e) => !e.farmId || e.farmId === "other"));
  },

  renderOverview() {
    const scoped = this.scopedEntries();
    const years = seasonYearsFor(scoped, "deer");
    if (!years.includes(this.selectedYear)) this.selectedYear = years[0];
    const yearEntries = scoped.filter((e) => seasonLabelFor(e.date, "deer") === this.selectedYear);

    const totals = {};
    Object.keys(SPECIES_TERMS).forEach((sp) => { totals[sp] = 0; });
    yearEntries.forEach((e) => { totals[e.species] = (totals[e.species] || 0) + 1; });
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
    const allTimeTotal = scoped.length;

    return `
      ${renderStatCards([{ value: allTimeTotal, label: "All-time total" }])}
      <div class="species-tabs" style="margin-top:10px;">${renderYearTabs(years, this.selectedYear, "deer", "DeerLog.setYear")}</div>
      ${renderStatCards([{ value: grandTotal, label: "Total — season " + this.selectedYear }])}
      <div style="margin-top:10px;">${renderCategoryTable(totals, grandTotal, "All species", "Species")}</div>
      ${this.currentFarmId ? "" : `<p class="hint">Open a farm under Locations to add or view Cull Record Log entries.</p>`}`;
  },

  renderSetup(farm) {
    const setup = this.ensureDeerSetup(farm);
    const speciesRows = Object.keys(SPECIES_TERMS)
      .map((sp) => {
        const s = setup.species[sp];
        return `
      <div class="log-row">
        <label style="display:flex;align-items:center;gap:6px;flex:1;min-width:140px;">
          <input type="checkbox" ${s.present ? "checked" : ""} onchange="DeerLog.setSpeciesPresent('${sp}', this.checked)" />
          ${sp}
        </label>
        <input type="text" placeholder="Notes" value="${s.notes || ""}" onchange="DeerLog.setSpeciesNotes('${sp}', this.value)" />
      </div>`;
      })
      .join("");

    return `
      <h4>Cull Plan</h4>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <input type="checkbox" ${setup.hasCullPlan ? "checked" : ""} onchange="DeerLog.toggleCullPlan(this.checked)" />
        Plan in place for this farm
      </label>
      <h4>Species present</h4>
      ${speciesRows}`;
  },

  setSpeciesPresent(species, present) {
    const farm = this.findFarm(this.currentFarmId);
    this.ensureDeerSetup(farm).species[species].present = present;
    this.saveAndRender();
  },
  setSpeciesNotes(species, notes) {
    const farm = this.findFarm(this.currentFarmId);
    this.ensureDeerSetup(farm).species[species].notes = notes;
    this.saveAndRender();
  },
  toggleCullPlan(checked) {
    const farm = this.findFarm(this.currentFarmId);
    this.ensureDeerSetup(farm).hasCullPlan = checked;
    this.saveAndRender();
  },

  renderQuotaPlan(farm) {
    const setup = this.ensureDeerSetup(farm);
    const yearEntries = this.scopedEntries().filter((e) => seasonLabelFor(e.date, "deer") === this.selectedYear);
    const years = seasonYearsFor(this.scopedEntries(), "deer");
    if (!years.includes(this.selectedYear)) this.selectedYear = years[0];
    const yearTabs = years.map((y) => `<button class="tab-btn ${y === this.selectedYear ? "active" : ""}" onclick="DeerLog.setYear('${y}')">${y}</button>`).join("");

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
            return `<div class="grouped-row"><span>${sp} — ${term}</span><span>Target: <input type="number" min="0" value="${target}" style="width:50px;" onchange="DeerLog.setQuotaTarget('${sp}','${term}',this.value)" /></span><span>Achieved: ${achieved}</span><span>Remaining: ${remaining} (${pct}%)</span></div>`;
          })
          .join("");
      })
      .join("");

    if (!rows) return `<p class="hint">Tick which species are present on the Setup tab to set quota targets for them.</p>`;
    return `<div class="species-tabs">${yearTabs}</div><div class="grouped-block" style="margin-top:10px;">${rows}</div>`;
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
    const bars = Object.keys(SPECIES_TERMS)
      .filter((sp) => setup.species[sp].present)
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
    return bars || `<p class="hint">Tick which species are present on the Setup tab to see progress here.</p>`;
  },

  renderCullRecordLog() {
    return `
      <button class="btn small" onclick="DeerLog.addEntry()">+ Add entry</button>
      <label class="btn small ghost" style="display:inline-block; margin-left:8px; cursor:pointer;">
        📷 Add via camera
        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="DeerLog.addEntryFromCamera(this)" />
      </label>
      <div class="species-tabs" style="margin-top:14px;">
        <button class="tab-btn ${this.subView === "log" ? "active" : ""}" onclick="DeerLog.setSubView('log')">Entry Log</button>
        <button class="tab-btn ${this.subView === "by-field" ? "active" : ""}" onclick="DeerLog.setSubView('by-field')">By Field Name</button>
      </div>
      <div style="margin-top:8px;">${this.subView === "log" ? this.renderFlatLog() : this.renderGroupedByField()}</div>`;
  },

  // ---------- Multi-photo ----------
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

  renderFlatLog() {
    const entries = this.scopedEntries();
    const farms = window.APP_DATA.farms || [];
    const showFarmColumn = !this.currentFarmId;
    const rows = entries
      .map((e) => {
        const idx = this.entries().indexOf(e);
        const photos = e.photos || [];
        const photoThumbs = photos
          .map((p, pIdx) => `<span class="photo-thumb-wrap"><img src="${cloudinaryThumb(p, 60)}" class="zeroing-thumb" /><button class="icon-btn photo-remove" onclick="DeerLog.removePhoto(${idx},${pIdx})">✕</button></span>`)
          .join("");
        return `
      <div class="log-row-card">
        <div class="log-row">
        <input type="date" value="${e.date}" onchange="DeerLog.updateEntry(${idx},'date',this.value)" />
        ${showFarmColumn ? `
        <select onchange="DeerLog.updateEntry(${idx},'farmId',this.value)">
          ${farms.map((f) => `<option value="${f.id}" ${f.id === (e.farmId || "other") ? "selected" : ""}>${f.name}</option>`).join("")}
          <option value="other" ${(e.farmId || "other") === "other" ? "selected" : ""}>Other</option>
        </select>` : ""}
        <select onchange="DeerLog.updateEntry(${idx},'species',this.value)">
          ${Object.keys(SPECIES_TERMS).map((s) => `<option ${s === e.species ? "selected" : ""}>${s}</option>`).join("")}
        </select>
        <select onchange="DeerLog.updateEntry(${idx},'sex',this.value)">
          ${this.sexOptionsFor(e.species).map((s) => `<option ${s === e.sex ? "selected" : ""}>${s}</option>`).join("")}
        </select>
        <select onchange="DeerLog.updateEntry(${idx},'age',this.value)">
          ${["Adult", "Young"].map((a) => `<option ${a === e.age ? "selected" : ""}>${a}</option>`).join("")}
        </select>
        </div>
        <div class="log-row">
        <input type="text" placeholder="Location" value="${e.location || ""}" onchange="DeerLog.updateEntry(${idx},'location',this.value)" />
        <input type="text" placeholder="///what3words" value="${e.what3words || ""}" onchange="DeerLog.updateEntry(${idx},'what3words',this.value)" />
        <select onchange="DeerLog.updateEntry(${idx},'condition',this.value)">
          ${DEER_CONDITIONS.map((c) => `<option ${c === e.condition ? "selected" : ""}>${c}</option>`).join("")}
        </select>
        </div>
        <div class="log-row">
        <select onchange="DeerLog.handleFirearmChange(${idx}, this)">
          <option value="" ${!e.firearm ? "selected" : ""}>Firearm…</option>
          ${Firearms.list().map((f) => `<option ${f === e.firearm ? "selected" : ""}>${f}</option>`).join("")}
          <option value="__add_new__">+ Add new firearm…</option>
        </select>
        <input type="text" placeholder="Notes" value="${e.notes || ""}" onchange="DeerLog.updateEntry(${idx},'notes',this.value)" />
        </div>
        <div class="log-row photo-row">
          ${photoThumbs}
          <label class="btn small ghost" style="cursor:pointer;">+ Photo
            <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="DeerLog.addPhoto(${idx}, this)" />
          </label>
          <button class="icon-btn" onclick="DeerLog.removeEntry(${idx})" style="margin-left:auto;">✕ Remove entry</button>
        </div>
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
        const rows = list.map((e) => `<div class="grouped-row"><span>${e.date}</span><span>${e.species}</span><span>${e.sex}</span><span>${e.age}</span></div>`).join("");
        return `<div class="grouped-block"><h4>${key} <span class="grouped-count">(${list.length})</span></h4>${rows}</div>`;
      })
      .join("");
  },
};
