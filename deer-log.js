/* =====================================================================
   DEER — Cull Record Log. The fullest section: follows The Deer
   Initiative's Best Practice Guide field set, with species-correct
   sex/young terminology and several fields that carry forward from
   the previous entry (Location, Firearm, Inspected by, Shot by,
   Destination), since these usually stay the same across one outing.
   Shares the farm-grouping / field-name breakdown views with the other
   species logs (SpeciesLog module) and gets what3words + shot-location
   map like Fox/Goat/Boar/Squirrel.
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
  currentView: "log", // 'log' | 'by-farm' | 'by-field'

  entries() {
    window.APP_DATA.species = window.APP_DATA.species || {};
    window.APP_DATA.species.deer = window.APP_DATA.species.deer || [];
    return window.APP_DATA.species.deer;
  },

  open() {
    this.currentView = "log";
    this.render();
  },

  // Location, Firearm, Inspected by, Shot by and Destination carry forward
  // from the last entry automatically — the same details usually repeat
  // across one outing, per The Deer Initiative's Cull Records guide.
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
      farmId: last ? last.farmId : farms[0]?.id || "",
      location: last ? last.location : "",
      what3words: "",
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

  removeEntry(idx) {
    if (!confirm("Remove this entry? This can't be undone.")) return;
    this.entries().splice(idx, 1);
    this.saveAndRender();
  },

  updateEntry(idx, field, value) {
    const entry = this.entries()[idx];
    entry[field] = value;
    // Sex options depend on species — reset to that species' male term
    // whenever the species changes, so the two stay consistent.
    if (field === "species") entry.sex = SPECIES_TERMS[value].male;
    this.saveAndRender();
  },

  saveAndRender() {
    // TODO: Firestore write, then triggerBackup(window.APP_DATA) for Dropbox.
    triggerBackup?.(window.APP_DATA);
    this.render();
  },

  farmName(farmId) {
    return (window.APP_DATA.farms || []).find((f) => f.id === farmId)?.name || "(no farm set)";
  },

  groupByFarm() {
    const groups = {};
    this.entries().forEach((e) => {
      const key = e.farmId || "unassigned";
      groups[key] = groups[key] || [];
      groups[key].push(e);
    });
    Object.values(groups).forEach((list) => list.sort((a, b) => a.date.localeCompare(b.date)));
    return groups;
  },

  groupByField() {
    const groups = {};
    this.entries().forEach((e) => {
      const key = e.location || "(no field name)";
      groups[key] = groups[key] || [];
      groups[key].push(e);
    });
    return groups;
  },

  sexOptionsFor(species) {
    const terms = SPECIES_TERMS[species];
    return [terms.male, terms.female, terms.young];
  },

  setView(view) {
    this.currentView = view;
    this.render();
  },

  render() {
    const overlay = document.getElementById("modalOverlay");
    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <h3>Deer — Cull Record Log</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">✕</button>
        </div>
        <div class="species-tabs">
          <button class="tab-btn ${this.currentView === "log" ? "active" : ""}" onclick="DeerLog.setView('log')">Log</button>
          <button class="tab-btn ${this.currentView === "by-farm" ? "active" : ""}" onclick="DeerLog.setView('by-farm')">By Farm</button>
          <button class="tab-btn ${this.currentView === "by-field" ? "active" : ""}" onclick="DeerLog.setView('by-field')">By Field Name</button>
          <button class="tab-btn" onclick="alert('Shot-location map opens here once the maps phase is wired up.')">📍 Map</button>
          <button class="tab-btn" onclick="CullPlanImport.openImportScreen()">⤓ Import Cull Plan</button>
        </div>
        <div id="deerLogBody"></div>
      </div>`;
    overlay.classList.remove("hidden");
    this.renderBody();
  },

  renderBody() {
    const body = document.getElementById("deerLogBody");
    if (this.currentView === "log") {
      body.innerHTML = this.renderFlatLog();
    } else if (this.currentView === "by-farm") {
      body.innerHTML = this.renderGrouped(this.groupByFarm(), (id) => this.farmName(id));
    } else {
      body.innerHTML = this.renderGrouped(this.groupByField(), (k) => k);
    }
  },

  renderFlatLog() {
    const entries = this.entries();
    const rows = entries
      .map(
        (e, idx) => `
      <div class="log-row">
        <input type="date" value="${e.date}" onchange="DeerLog.updateEntry(${idx},'date',this.value)" />
        <select onchange="DeerLog.updateEntry(${idx},'species',this.value)">
          ${Object.keys(SPECIES_TERMS)
            .map((s) => `<option ${s === e.species ? "selected" : ""}>${s}</option>`)
            .join("")}
        </select>
        <select onchange="DeerLog.updateEntry(${idx},'sex',this.value)">
          ${this.sexOptionsFor(e.species)
            .map((s) => `<option ${s === e.sex ? "selected" : ""}>${s}</option>`)
            .join("")}
        </select>
        <select onchange="DeerLog.updateEntry(${idx},'age',this.value)">
          ${["Adult", "Young"].map((a) => `<option ${a === e.age ? "selected" : ""}>${a}</option>`).join("")}
        </select>
        <input type="text" placeholder="Location" value="${e.location || ""}" onchange="DeerLog.updateEntry(${idx},'location',this.value)" />
        <input type="text" placeholder="///what3words" value="${e.what3words || ""}" onchange="DeerLog.updateEntry(${idx},'what3words',this.value)" />
        <select onchange="DeerLog.updateEntry(${idx},'condition',this.value)">
          ${DEER_CONDITIONS.map((c) => `<option ${c === e.condition ? "selected" : ""}>${c}</option>`).join("")}
        </select>
        <button class="icon-btn" onclick="DeerLog.removeEntry(${idx})">✕</button>
      </div>`
      )
      .join("");
    return `${rows || '<p class="hint">No entries yet.</p>'}<button class="btn small" onclick="DeerLog.addEntry()">+ Add entry</button>`;
  },

  renderGrouped(groups, labelFn) {
    const keys = Object.keys(groups);
    if (keys.length === 0) return '<p class="hint">No entries yet.</p>';
    return keys
      .map((key) => {
        const list = groups[key];
        const rows = list
          .map((e) => `<div class="grouped-row"><span>${e.date}</span><span>${e.species}</span><span>${e.sex}</span><span>${e.age}</span></div>`)
          .join("");
        return `<div class="grouped-block"><h4>${labelFn(key)} <span class="grouped-count">(${list.length})</span></h4>${rows}</div>`;
      })
      .join("");
  },
};
