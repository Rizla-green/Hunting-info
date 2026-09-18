/* =====================================================================
   CLAY SHOOTING — structurally different from every other section:
   it's a hit-percentage tracker (clays thrown vs hits), not species
   counts. Overview shows all-time and per-season % hit; Locations
   lists "grounds" (the same farms list, just used as shooting grounds
   here); each ground's own page has its own %hit stats plus the
   Records table (Date, Firearm, Clays, Hits, Photos, Notes).
===================================================================== */

const ClayShooting = {
  topTab: "overview",     // 'overview' | 'locations' — species-wide only
  currentFarmId: null,
  farmSubTab: "overview", // 'overview' | 'log', once drilled into a ground
  selectedYear: null,
  subView: "log",

  entries() {
    window.APP_DATA.clay = window.APP_DATA.clay || [];
    return window.APP_DATA.clay;
  },

  scopedEntries() {
    if (!this.currentFarmId) return this.entries();
    return this.entries().filter((e) => (e.farmId || "other") === this.currentFarmId);
  },

  farmName(farmId) {
    if (!farmId || farmId === "other") return "Other";
    return (window.APP_DATA.farms || []).find((f) => f.id === farmId)?.name || "Other";
  },

  open() {
    this.topTab = "overview";
    this.currentFarmId = null;
    this.farmSubTab = "overview";
    this.selectedYear = currentSeasonLabel("clay");
    this.render();
  },

  addEntry() {
    const farms = window.APP_DATA.farms || [];
    this.entries().push({
      date: new Date().toISOString().slice(0, 10),
      farmId: this.currentFarmId || farms[0]?.id || "other",
      firearm: "",
      clays: 0,
      hits: 0,
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

  setTopTab(tab) { this.topTab = tab; this.render(); },
  setYear(year) { this.selectedYear = year; this.render(); },
  setFarmSubTab(tab) { this.farmSubTab = tab; this.render(); },
  drillIntoFarm(farmId) {
    this.currentFarmId = farmId;
    this.farmSubTab = "overview";
    this.render();
  },
  backToSpeciesWide() {
    this.currentFarmId = null;
    this.topTab = "overview";
    this.render();
  },

  statsFor(entries) {
    const clays = entries.reduce((s, e) => s + (parseInt(e.clays, 10) || 0), 0);
    const hits = entries.reduce((s, e) => s + (parseInt(e.hits, 10) || 0), 0);
    const pct = clays > 0 ? Math.round((hits / clays) * 100) : 0;
    return { clays, hits, pct };
  },

  render() {
    const overlay = document.getElementById("modalOverlay");
    const inFarm = !!this.currentFarmId;

    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <h3>Clay Shooting${inFarm ? " — " + this.farmName(this.currentFarmId) : ""}</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">✕</button>
        </div>
        ${inFarm ? `<button class="tab-btn" onclick="ClayShooting.backToSpeciesWide()">← All grounds</button>` : ""}
        <div class="species-tabs">
          ${inFarm
            ? `<button class="tab-btn ${this.farmSubTab === "overview" ? "active" : ""}" onclick="ClayShooting.setFarmSubTab('overview')">Overview</button>
               <button class="tab-btn ${this.farmSubTab === "log" ? "active" : ""}" onclick="ClayShooting.setFarmSubTab('log')">Records</button>`
            : `<button class="tab-btn ${this.topTab === "overview" ? "active" : ""}" onclick="ClayShooting.setTopTab('overview')">Overview</button>
               <button class="tab-btn ${this.topTab === "locations" ? "active" : ""}" onclick="ClayShooting.setTopTab('locations')">Locations</button>`}
        </div>
        <div id="clayBody"></div>
      </div>`;
    overlay.classList.remove("hidden");
    this.renderBody();
  },

  renderBody() {
    const body = document.getElementById("clayBody");
    const inFarm = !!this.currentFarmId;
    if (inFarm) {
      body.innerHTML = this.farmSubTab === "log" ? this.renderRecords() : this.renderOverview();
    } else if (this.topTab === "locations") {
      body.innerHTML = this.renderLocationsList();
    } else {
      body.innerHTML = this.renderOverview();
    }
  },

  renderLocationsList() {
    return renderLocationsListHtml("ClayShooting.drillIntoFarm", this.entries().some((e) => !e.farmId || e.farmId === "other")) +
      `<p class="hint">Clay shooting locations are the same list as Land and Farms.</p>`;
  },

  renderOverview() {
    const scoped = this.scopedEntries();
    const years = seasonYearsFor(scoped, "clay");
    if (!years.includes(this.selectedYear)) this.selectedYear = years[0];
    const yearEntries = scoped.filter((e) => seasonLabelFor(e.date, "clay") === this.selectedYear);

    const allTime = this.statsFor(scoped);
    const season = this.statsFor(yearEntries);

    return `
      <div class="stat-cards">
        <div class="stat-card"><div class="num">${allTime.pct}%</div><div class="lbl">Overall % hit (all time)</div></div>
      </div>
      <div class="species-tabs" style="margin-top:10px;">${renderYearTabs(years, this.selectedYear, "clay", "ClayShooting.setYear")}</div>
      <div class="stat-cards" style="margin-top:10px;">
        <div class="stat-card"><div class="num">${season.pct}%</div><div class="lbl">% hit this season</div></div>
        <div class="stat-card"><div class="num">${season.clays}</div><div class="lbl">Clays this season</div></div>
        <div class="stat-card"><div class="num">${season.hits}</div><div class="lbl">Hits this season</div></div>
      </div>
      ${this.currentFarmId ? "" : `<p class="hint">Open a ground under Locations to add or view Records.</p>`}`;
  },

  renderRecords() {
    return `
      <button class="btn small" onclick="ClayShooting.addEntry()">+ Add entry</button>
      <div style="margin-top:12px;">${this.renderTable()}</div>`;
  },

  renderTable() {
    const entries = this.scopedEntries();
    const rows = entries
      .map((e) => {
        const idx = this.entries().indexOf(e);
        const photos = e.photos || [];
        const photoThumbs = photos
          .map((p, pIdx) => `<span class="photo-thumb-wrap"><img src="${cloudinaryThumb(p, 50)}" class="zeroing-thumb" /><button class="icon-btn photo-remove" onclick="ClayShooting.removePhoto(${idx},${pIdx})">✕</button></span>`)
          .join("");
        const pct = (parseInt(e.clays, 10) || 0) > 0 ? Math.round(((parseInt(e.hits, 10) || 0) / parseInt(e.clays, 10)) * 100) : 0;
        return `
      <div class="log-row-card">
        <div class="log-row">
          <input type="date" value="${e.date}" onchange="ClayShooting.updateEntry(${idx},'date',this.value)" />
          <select onchange="ClayShooting.handleFirearmChange(${idx}, this)">
            <option value="" ${!e.firearm ? "selected" : ""}>Firearm…</option>
            ${Firearms.list().map((f) => `<option ${f === e.firearm ? "selected" : ""}>${f}</option>`).join("")}
            <option value="__add_new__">+ Add new firearm…</option>
          </select>
        </div>
        <div class="log-row">
          <input type="number" min="0" placeholder="Clays" value="${e.clays}" onchange="ClayShooting.updateEntry(${idx},'clays',this.value)" style="width:80px;" />
          <input type="number" min="0" placeholder="Hits" value="${e.hits}" onchange="ClayShooting.updateEntry(${idx},'hits',this.value)" style="width:80px;" />
          <span class="hint" style="margin:0;">${pct}% hit</span>
        </div>
        <div class="log-row">
          <input type="text" placeholder="Notes" value="${e.notes || ""}" onchange="ClayShooting.updateEntry(${idx},'notes',this.value)" />
        </div>
        <div class="log-row photo-row">
          ${photoThumbs}
          <label class="btn small ghost" style="cursor:pointer;">+ Photo
            <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="ClayShooting.addPhoto(${idx}, this)" />
          </label>
          <button class="icon-btn" onclick="ClayShooting.removeEntry(${idx})" style="margin-left:auto;">✕ Remove entry</button>
        </div>
      </div>`;
      })
      .join("");
    return rows || '<p class="hint">No entries yet — tap "+ Add entry" above to log a round.</p>';
  },
};
