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
  selectedYear: null,
  subView: "log",
  expanded: {},   // { idx: true } — collapsed-row expand state for Cull Record Log

  toggleExpand(idx) {
    this.expanded[idx] = !this.expanded[idx];
    this.renderFarmBody(this.findFarm(this.currentFarmId));
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
    this.selectedYear = currentSeasonLabel("deer");
    this.render();
  },

  addEntry() {
    const entries = this.entries();
    const last = entries[entries.length - 1];
    const farms = window.APP_DATA.farms || [];
    const defSpecies = SPECIES_LIST[0];
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

  addEntryFromCamera(inputEl) {
    LocationMatch.captureWithCamera(inputEl, (photoDataUrl, loc) => {
      const entries = this.entries();
      const last = entries[entries.length - 1];
      const farms = window.APP_DATA.farms || [];
      const defSpecies = SPECIES_LIST[0];
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
        weight: "", tag: "",
        firearm: last ? last.firearm : "",
        condition: DEER_CONDITIONS[0],
        recordedBy: last ? last.recordedBy : "",
        shotBy: last ? last.shotBy : "",
        destination: last ? last.destination : "",
        time: "", abnormalities: "", shotPlacement: "",
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

  saveAndRender() { persistData(); this.render(); },

  sexOptionsFor(species) {
    const t = SPECIES_TERMS[species];
    return [t.male, t.female, t.young];
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
    this.scopedEntries().forEach((e) => {
      const key = e.location || "(no field name)";
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
    // seasonText like "1 Aug – 30 Apr" — a simple month-based open-season check.
    const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const match = seasonText.toLowerCase().match(/(\d+)\s+(\w+).*?(\d+)\s+(\w+)/);
    if (!match) return null;
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    const month = d.getMonth();
    const startMonth = monthNames.indexOf(match[2].slice(0, 3));
    const endMonth = monthNames.indexOf(match[4].slice(0, 3));
    if (startMonth < 0 || endMonth < 0) return null;
    const inOpenSeason = startMonth <= endMonth
      ? (month >= startMonth && month <= endMonth)
      : (month >= startMonth || month <= endMonth);
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
        <div id="deerYearTable"></div>

        <div class="section-title" style="margin-top:18px;"><h4>Properties</h4></div>
        <p class="hint">Tap a property for its total deer shot and the tally by year.</p>
        <div id="deerQuickPropList"></div>

        <div class="section-title" style="margin-top:18px;"><h4>Cull Plans</h4></div>
        <input type="text" id="deerFarmSearch" placeholder="Filter properties…" oninput="DeerLog.filterCullPlanList(this.value)"
          style="width:100%; box-sizing:border-box; padding:8px 10px; border-radius:8px; border:1px solid var(--gold-dim); background:var(--navy); color:var(--cream); margin-bottom:10px;" />
        <div id="deerCullPlanList"></div>
      </div>`;
    overlay.classList.remove("hidden");

    this.renderYearBlock();
    this.renderQuickPropList();
    this.renderCullPlanList();
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
    el.innerHTML = `<div class="farm-list">${farms.map((f) => renderLocationRow(f, "DeerLog.openPropertyQuickView")).join("")}</div>`;
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

    ReferenceInfo.showModal(farm.name, `
      ${renderStatCards([{ value: total, label: "Total shot" }])}
      <div class="table-scroll" style="margin-top:10px;"><table class="data-table"><tr><th>Season year</th><th>Shot</th><th></th></tr>${rows}</table></div>
      <button class="btn secondary small" style="width:100%; margin-top:14px;" onclick="ShotLocationMap.open('deer','${farmId}')">📍 Total kills map — all seasons</button>
      <button class="btn small" style="width:100%; margin-top:8px;" onclick="DeerLog.drillIntoFarm('${farmId}')">Open full Cull Plan workspace</button>`);
  },

  renderCullPlanList(filter) {
    const farms = (window.APP_DATA.farms || []).filter((f) => !filter || f.name.toLowerCase().includes(filter.toLowerCase()));
    const el = document.getElementById("deerCullPlanList");
    el.innerHTML = renderLocationsListHtml("DeerLog.drillIntoFarm", false) +
      `<button class="btn small" style="margin-top:10px;" onclick="addFarm()">+ Add property</button>`;
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
        <input type="number" placeholder="Est. population" value="${s.estPopulation || ""}" onchange="DeerLog.setSpeciesField('${sp}','estPopulation', this.value)" style="width:110px;" />
        <input type="text" placeholder="Target ratio" value="${s.targetRatio || ""}" onchange="DeerLog.setSpeciesField('${sp}','targetRatio', this.value)" style="width:90px;" />
        <input type="text" placeholder="Notes" value="${s.notes || ""}" onchange="DeerLog.setSpeciesField('${sp}','notes', this.value)" />
      </div>`;
      })
      .join("");

    return `
      <div class="section-title"><h4>Property &amp; season details</h4></div>
      <div class="log-row"><input type="text" placeholder="Season (e.g. 2026/27)" value="${setup.season}" onchange="DeerLog.setSetupField('season', this.value)" /></div>
      <div class="log-row"><input type="text" placeholder="DMQ holder / manager" value="${setup.manager}" onchange="DeerLog.setSetupField('manager', this.value)" /></div>
      <div class="log-row"><input type="text" placeholder="Contact number / email" value="${setup.contact}" onchange="DeerLog.setSetupField('contact', this.value)" /></div>
      <div class="log-row"><input type="number" placeholder="Total land area (ha)" value="${setup.landAreaHa}" onchange="DeerLog.setSetupField('landAreaHa', this.value)" /></div>
      <div class="log-row">
        <select onchange="DeerLog.toggleCullPlan(this.value === 'true')">
          <option value="true" ${setup.hasCullPlan ? "selected" : ""}>Plan in place</option>
          <option value="false" ${!setup.hasCullPlan ? "selected" : ""}>No plan in place</option>
        </select>
      </div>
      <div class="log-row"><textarea class="farm-notes" placeholder="Habitat / management objective" onchange="DeerLog.setSetupField('objective', this.value)">${setup.objective}</textarea></div>

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
      "what3words": e.what3words, Weight: e.weight, Firearm: e.firearm, Condition: e.condition,
      "Recorded by": e.recordedBy, "Shot by": e.shotBy, Destination: e.destination, Notes: e.notes,
    }));
    exportSectionExcel("deer-cull-plan-" + farm.name.replace(/[^a-z0-9]+/gi, "-"), rows, farm.name);
  },

  renderCullRecordLog(farm) {
    return `
      <button class="btn small" onclick="DeerLog.addEntry()">+ Add entry</button>
      <label class="btn small ghost" style="display:inline-block; margin-left:8px; cursor:pointer;">
        📷 Add via camera
        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="DeerLog.addEntryFromCamera(this)" />
      </label>
      <p class="hint">Every entry is checked against the close season for this property's country automatically.</p>
      <button class="icon-btn" onclick="DeerLog.openFieldSettings()" title="Choose which fields show">⚙</button>
      <div class="species-tabs">
        <button class="tab-btn ${this.subView === "log" ? "active" : ""}" onclick="DeerLog.setSubView('log')">Entry Log</button>
        <button class="tab-btn ${this.subView === "by-field" ? "active" : ""}" onclick="DeerLog.setSubView('by-field')">By Field Name</button>
      </div>
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
    const entries = this.scopedEntries();
    const on = (f) => isFieldOn("deer", f);
    const rows = entries
      .map((e) => {
        const idx = this.entries().indexOf(e);
        const photos = e.photos || [];
        const photoThumbs = photos
          .map((p, pIdx) => `<span class="photo-thumb-wrap"><img src="${cloudinaryThumb(p, 60)}" class="zeroing-thumb" /><button class="icon-btn photo-remove" onclick="DeerLog.removePhoto(${idx},${pIdx})">✕</button></span>`)
          .join("");
        const warning = this.checkCompliance(e.farmId, e.species, e.sex, e.date);

        if (!this.expanded[idx]) {
          return `
      <div class="log-row-card compact-row" onclick="DeerLog.toggleExpand(${idx})" style="cursor:pointer;">
        ${warning ? `<div class="compliance-warning">⚠ ${warning}</div>` : ""}
        <div class="log-row compact-summary">
          <span>${e.date}</span>
          <span>${e.sex}</span>
          <span>${e.location || ""}</span>
        </div>
      </div>`;
        }

        return `
      <div class="log-row-card">
        ${warning ? `<div class="compliance-warning">⚠ ${warning}</div>` : ""}
        <div class="log-row" style="justify-content:flex-end;"><button class="icon-btn" onclick="DeerLog.toggleExpand(${idx})">▲ Collapse</button></div>
        <div class="log-row">
        <input type="date" value="${e.date}" onchange="DeerLog.updateEntry(${idx},'date',this.value)" />
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
        ${on("location") ? `<input type="text" placeholder="Location" value="${e.location || ""}" onchange="DeerLog.updateEntry(${idx},'location',this.value)" />` : ""}
        ${on("what3words") ? `<input type="text" placeholder="///what3words" value="${e.what3words || ""}" onchange="DeerLog.updateEntry(${idx},'what3words',this.value)" />` : ""}
        ${on("time") ? `<input type="time" value="${e.time || ""}" onchange="DeerLog.updateEntry(${idx},'time',this.value)" style="width:100px;" />` : ""}
        </div>
        <div class="log-row">
        ${on("weight") ? `<input type="number" placeholder="Weight (kg)" value="${e.weight || ""}" onchange="DeerLog.updateEntry(${idx},'weight',this.value)" style="width:100px;" />` : ""}
        ${on("tag") ? `<input type="text" placeholder="Tag no." value="${e.tag || ""}" onchange="DeerLog.updateEntry(${idx},'tag',this.value)" style="width:90px;" />` : ""}
        ${on("condition") ? `<select onchange="DeerLog.updateEntry(${idx},'condition',this.value)">
          ${DEER_CONDITIONS.map((c) => `<option ${c === e.condition ? "selected" : ""}>${c}</option>`).join("")}
        </select>` : ""}
        </div>
        ${on("firearm") ? `<div class="log-row">
        <select onchange="DeerLog.handleFirearmChange(${idx}, this)">
          <option value="" ${!e.firearm ? "selected" : ""}>Firearm…</option>
          ${Firearms.list().map((f) => `<option ${f === e.firearm ? "selected" : ""}>${f}</option>`).join("")}
          <option value="__add_new__">+ Add new firearm…</option>
        </select>
        </div>` : ""}
        <div class="log-row">
        ${on("abnormalities") ? `<input type="text" placeholder="Abnormalities" value="${e.abnormalities || ""}" onchange="DeerLog.updateEntry(${idx},'abnormalities',this.value)" />` : ""}
        ${on("shotPlacement") ? `<input type="text" placeholder="Shot placement" value="${e.shotPlacement || ""}" onchange="DeerLog.updateEntry(${idx},'shotPlacement',this.value)" />` : ""}
        </div>
        <div class="log-row">
        ${on("shotBy") ? `<input type="text" placeholder="Shot by" value="${e.shotBy || ""}" onchange="DeerLog.updateEntry(${idx},'shotBy',this.value)" />` : ""}
        ${on("recordedBy") ? `<input type="text" placeholder="Inspected by" value="${e.recordedBy || ""}" onchange="DeerLog.updateEntry(${idx},'recordedBy',this.value)" />` : ""}
        </div>
        <div class="log-row">
        ${on("destination") ? `<input type="text" placeholder="Destination" value="${e.destination || ""}" onchange="DeerLog.updateEntry(${idx},'destination',this.value)" />` : ""}
        ${on("notes") ? `<input type="text" placeholder="Notes" value="${e.notes || ""}" onchange="DeerLog.updateEntry(${idx},'notes',this.value)" />` : ""}
        </div>
        ${on("photos") ? `<div class="log-row photo-row">
          ${photoThumbs}
          <label class="btn small ghost" style="cursor:pointer;">+ Photo
            <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="DeerLog.addPhoto(${idx}, this)" />
          </label>
          <button class="icon-btn" onclick="DeerLog.removeEntry(${idx})" style="margin-left:auto;">✕ Remove entry</button>
        </div>` : `<div class="log-row"><button class="icon-btn" onclick="DeerLog.removeEntry(${idx})" style="margin-left:auto;">✕ Remove entry</button></div>`}
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
