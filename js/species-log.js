/* =====================================================================
   SPECIES LOG — the shared template every pest/game section reuses
   (Fox, Rabbit, Rats, Squirrels, Winged Vermin, Game Shooting, Goats,
   Boar, Clay Shooting). Deer gets its own fuller Cull Record Log
   (separate module) but shares the farm-grouping / field-name
   breakdown views built here.

   Each entry: {date, ampm, firearm, farmId, area, what3words, category,
                shots, photos, notes}

   New in this build (not in v3.9):
     - what3words + camera-capture pin-drop now also apply to Deer, Fox,
       Goat, Boar, Squirrel (was Fox/Boar/Goat/Squirrel only)
     - Farm-grouped view: entries grouped under farm headings, date-order within each
     - Field Name breakdown: entries grouped by the "area" (field) name
   Both new views sit alongside the flat log as separate tabs, not nested.
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
  currentView: "log", // 'log' | 'by-farm' | 'by-field'

  open(sectionKey) {
    this.currentSection = sectionKey;
    this.currentView = "log";
    this.render();
  },

  entries() {
    // TODO: wired to the real Firestore-backed data store; for now reads
    // a per-section array on window.APP_DATA so the UI is fully testable.
    window.APP_DATA.species = window.APP_DATA.species || {};
    window.APP_DATA.species[this.currentSection] = window.APP_DATA.species[this.currentSection] || [];
    return window.APP_DATA.species[this.currentSection];
  },

  addEntry() {
    const def = SPECIES_SECTIONS[this.currentSection];
    const farms = window.APP_DATA.farms || [];
    this.entries().push({
      date: new Date().toISOString().slice(0, 10),
      ampm: "AM",
      farmId: farms[0]?.id || "",
      area: "",
      what3words: "",
      category: def.categories[0],
      shots: 1,
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
    this.entries()[idx][field] = value;
    this.saveAndRender();
  },

  saveAndRender() {
    // TODO: Firestore write here, then triggerBackup(window.APP_DATA) for Dropbox.
    triggerBackup?.(window.APP_DATA);
    this.render();
  },

  farmName(farmId) {
    return (window.APP_DATA.farms || []).find((f) => f.id === farmId)?.name || "(no farm set)";
  },

  // ---------- Grouping ----------
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
    const w3wEnabled = W3W_SPECIES.includes(this.currentSection);

    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <h3>${def.title}</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">✕</button>
        </div>
        <div class="species-tabs">
          <button class="tab-btn ${this.currentView === "log" ? "active" : ""}" onclick="SpeciesLog.setView('log')">Log</button>
          <button class="tab-btn ${this.currentView === "by-farm" ? "active" : ""}" onclick="SpeciesLog.setView('by-farm')">By Farm</button>
          <button class="tab-btn ${this.currentView === "by-field" ? "active" : ""}" onclick="SpeciesLog.setView('by-field')">By Field Name</button>
          ${w3wEnabled ? `<button class="tab-btn" onclick="alert('Shot-location map opens here once the maps phase is wired up.')">📍 Map</button>` : ""}
        </div>
        <div id="speciesLogBody"></div>
      </div>`;
    overlay.classList.remove("hidden");

    this.renderBody(w3wEnabled);
  },

  setView(view) {
    this.currentView = view;
    this.render();
  },

  renderBody(w3wEnabled) {
    const body = document.getElementById("speciesLogBody");
    if (this.currentView === "log") {
      body.innerHTML = this.renderFlatLog(w3wEnabled);
    } else if (this.currentView === "by-farm") {
      body.innerHTML = this.renderGrouped(this.groupByFarm(), (id) => this.farmName(id));
    } else {
      body.innerHTML = this.renderGrouped(this.groupByField(), (k) => k);
    }
  },

  renderFlatLog(w3wEnabled) {
    const entries = this.entries();
    const def = SPECIES_SECTIONS[this.currentSection];
    const rows = entries
      .map(
        (e, idx) => `
      <div class="log-row">
        <input type="date" value="${e.date}" onchange="SpeciesLog.updateEntry(${idx},'date',this.value)" />
        <select onchange="SpeciesLog.updateEntry(${idx},'category',this.value)">
          ${def.categories.map((c) => `<option ${c === e.category ? "selected" : ""}>${c}</option>`).join("")}
        </select>
        <input type="text" placeholder="Field / area" value="${e.area || ""}" onchange="SpeciesLog.updateEntry(${idx},'area',this.value)" />
        ${w3wEnabled ? `<input type="text" placeholder="///what3words" value="${e.what3words || ""}" onchange="SpeciesLog.updateEntry(${idx},'what3words',this.value)" />` : ""}
        <input type="number" min="0" value="${e.shots}" onchange="SpeciesLog.updateEntry(${idx},'shots',this.value)" style="width:60px;" />
        <button class="icon-btn" onclick="SpeciesLog.removeEntry(${idx})">✕</button>
      </div>`
      )
      .join("");
    return `${rows || '<p class="hint">No entries yet.</p>'}<button class="btn small" onclick="SpeciesLog.addEntry()">+ Add entry</button>`;
  },

  renderGrouped(groups, labelFn) {
    const keys = Object.keys(groups);
    if (keys.length === 0) return '<p class="hint">No entries yet.</p>';
    return keys
      .map((key) => {
        const list = groups[key];
        const rows = list
          .map((e) => `<div class="grouped-row"><span>${e.date}</span><span>${e.category}</span><span>${e.shots} shots</span></div>`)
          .join("");
        return `<div class="grouped-block"><h4>${labelFn(key)} <span class="grouped-count">(${list.length})</span></h4>${rows}</div>`;
      })
      .join("");
  },
};
