/* =====================================================================
   CLAY SHOOTING — a hit-percentage tracker (clays thrown vs hits), not
   species counts. NOT tied to Land and Farms — grounds are a separate
   "remembered dropdown" list of names typed here (Ben returns to the
   same grounds repeatedly), not farm boundaries. No Locations tab, no
   drilling — Overview stats sit above one flat Records list.
===================================================================== */

const ClayShooting = {
  selectedYear: null,

  entries() {
    window.APP_DATA.clay = window.APP_DATA.clay || [];
    return window.APP_DATA.clay;
  },

  // Remembered grounds — a plain list of names typed before, separate
  // from Land and Farms. New ones typed via "+ Add new ground…" persist here.
  grounds() {
    window.APP_DATA.clayGrounds = window.APP_DATA.clayGrounds || [];
    return window.APP_DATA.clayGrounds;
  },

  addGround(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    const grounds = this.grounds();
    if (!grounds.includes(trimmed)) grounds.push(trimmed);
    return trimmed;
  },

  open() {
    this.selectedYear = currentSeasonLabel("clay");
    this.render();
  },

  addEntry() {
    const grounds = this.grounds();
    this.entries().push({
      date: new Date().toISOString().slice(0, 10),
      location: grounds[0] || "",
      firearm: "",
      clays: 0,
      hits: 0,
      what3words: "",
      lat: null,
      lng: null,
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

  handleLocationChange(idx, selectEl) {
    if (selectEl.value === "__add_new__") {
      const name = prompt("New ground name:");
      const added = this.addGround(name);
      if (added) this.updateEntry(idx, "location", added);
      else this.render();
      return;
    }
    this.updateEntry(idx, "location", selectEl.value);
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

  setYear(year) { this.selectedYear = year; this.render(); },

  statsFor(entries) {
    const clays = entries.reduce((s, e) => s + (parseInt(e.clays, 10) || 0), 0);
    const hits = entries.reduce((s, e) => s + (parseInt(e.hits, 10) || 0), 0);
    const pct = clays > 0 ? Math.round((hits / clays) * 100) : 0;
    return { clays, hits, pct };
  },

  render() {
    const overlay = document.getElementById("modalOverlay");
    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">← Back</button>
          <h3>Clay Shooting</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
        </div>
        <div id="clayBody"></div>
      </div>`;
    overlay.classList.remove("hidden");
    this.renderBody();
  },

  renderBody() {
    document.getElementById("clayBody").innerHTML = this.renderOverview() + this.renderTable();
  },

  renderOverview() {
    const entries = this.entries();
    const years = seasonYearsFor(entries, "clay");
    if (!years.includes(this.selectedYear)) this.selectedYear = years[0];
    const yearEntries = entries.filter((e) => seasonLabelFor(e.date, "clay") === this.selectedYear);

    const allTime = this.statsFor(entries);
    const season = this.statsFor(yearEntries);

    return `
      <div class="stat-cards">
        <div class="stat-card"><div class="num">${allTime.pct}%</div><div class="lbl">Overall % hit (all time)</div></div>
        <div class="stat-card"><div class="num">${allTime.clays}</div><div class="lbl">Total clays</div></div>
        <div class="stat-card"><div class="num">${allTime.hits}</div><div class="lbl">Total hits</div></div>
      </div>
      <div class="species-tabs" style="margin-top:10px;">${renderYearTabs(years, this.selectedYear, "clay", "ClayShooting.setYear")}</div>
      <div class="stat-cards" style="margin-top:10px;">
        <div class="stat-card"><div class="num">${season.pct}%</div><div class="lbl">% hit this season</div></div>
        <div class="stat-card"><div class="num">${season.clays}</div><div class="lbl">Clays this season</div></div>
        <div class="stat-card"><div class="num">${season.hits}</div><div class="lbl">Hits this season</div></div>
      </div>
      <div class="section-title" style="margin-top:18px;"><h4>Records</h4></div>
      <button class="icon-btn" onclick="ClayShooting.openFieldSettings()" title="Choose which fields show">⚙</button>
      <button class="btn small" style="margin-top:10px;" onclick="ClayShooting.addEntry()">+ Add entry</button>`;
  },

  fieldDefs: [
    { key: "firearm", label: "Firearm" },
    { key: "photos", label: "Photos" },
    { key: "notes", label: "Notes" },
  ],
  openFieldSettings() {
    openFieldSettings("clay", "Clay Shooting", this.fieldDefs, () => this.render());
  },

  renderTable() {
    const entries = this.entries();
    const grounds = this.grounds();
    const on = (f) => isFieldOn("clay", f);
    const rows = entries
      .map((e, idx) => {
        const photos = e.photos || [];
        const photoThumbs = photos
          .map((p, pIdx) => `<span class="photo-thumb-wrap"><img src="${cloudinaryThumb(p, 50)}" class="zeroing-thumb" /><button class="icon-btn photo-remove" onclick="ClayShooting.removePhoto(${idx},${pIdx})">✕</button></span>`)
          .join("");
        const pct = (parseInt(e.clays, 10) || 0) > 0 ? Math.round(((parseInt(e.hits, 10) || 0) / parseInt(e.clays, 10)) * 100) : 0;
        return `
      <div class="log-row-card">
        <div class="log-row">
          <input type="date" value="${e.date}" onchange="ClayShooting.updateEntry(${idx},'date',this.value)" />
          <select onchange="ClayShooting.handleLocationChange(${idx}, this)">
            <option value="" ${!e.location ? "selected" : ""}>Ground…</option>
            ${grounds.map((g) => `<option ${g === e.location ? "selected" : ""}>${g}</option>`).join("")}
            <option value="__add_new__">+ Add new ground…</option>
          </select>
        </div>
        <div class="log-row">
          <input type="number" min="0" placeholder="Clays" value="${e.clays}" onchange="ClayShooting.updateEntry(${idx},'clays',this.value)" style="width:80px;" />
          <input type="number" min="0" placeholder="Hits" value="${e.hits}" onchange="ClayShooting.updateEntry(${idx},'hits',this.value)" style="width:80px;" />
          <span class="hint" style="margin:0;">${pct}% hit</span>
        </div>
        <div class="log-row">
          <input type="text" placeholder="///what3words" value="${e.what3words || ""}" onchange="ClayShooting.updateEntry(${idx},'what3words',this.value)" />
          <button class="btn small ghost" onclick="ClayShooting.captureW3w(${idx})">📍 Auto</button>
        </div>
        ${on("firearm") ? `<div class="log-row">
          <select onchange="ClayShooting.handleFirearmChange(${idx}, this)">
            <option value="" ${!e.firearm ? "selected" : ""}>Firearm…</option>
            ${Firearms.list().map((f) => `<option ${f === e.firearm ? "selected" : ""}>${f}</option>`).join("")}
            <option value="__add_new__">+ Add new firearm…</option>
          </select>
        </div>` : ""}
        ${on("notes") ? `<div class="log-row">
          <input type="text" placeholder="Notes" value="${e.notes || ""}" onchange="ClayShooting.updateEntry(${idx},'notes',this.value)" />
        </div>` : ""}
        ${on("photos") ? `<div class="log-row photo-row">
          ${photoThumbs}
          <label class="btn small ghost" style="cursor:pointer;">+ Photo
            <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="ClayShooting.addPhoto(${idx}, this)" />
          </label>
          <button class="icon-btn" onclick="ClayShooting.removeEntry(${idx})" style="margin-left:auto;">✕ Remove entry</button>
        </div>` : `<div class="log-row"><button class="icon-btn" onclick="ClayShooting.removeEntry(${idx})" style="margin-left:auto;">✕ Remove entry</button></div>`}
      </div>`;
      })
      .join("");
    return `<div style="margin-top:8px;">${rows || '<p class="hint">No entries yet — tap "+ Add entry" above to log a round.</p>'}</div>`;
  },
};
