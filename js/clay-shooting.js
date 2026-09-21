/* =====================================================================
   CLAY SHOOTING — a hit-percentage tracker (clays thrown vs hits), not
   species counts. NOT tied to Land and Farms — grounds are a separate
   "remembered dropdown" list of names typed here, not farm boundaries.
   Entries collapse to a single summary line; tapping one opens a
   genuine pop-out popup (working on a draft — nothing saves until
   Save is tapped) with the full data, same pattern as every other
   section. Clays and Hits fields are clearly labelled (previously two
   bare unlabelled "0" boxes).
===================================================================== */

const ClayShooting = {
  selectedYear: null,
  draft: null,
  draftIdx: null,

  entries() {
    window.APP_DATA.clay = window.APP_DATA.clay || [];
    return window.APP_DATA.clay;
  },

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

  newEntryDefaults() {
    const grounds = this.grounds();
    return {
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
      locationNotes: "",
    };
  },

  openAddPopup() {
    this.draft = this.newEntryDefaults();
    this.draftIdx = null;
    Popup.open(this.renderPopupBody(), () => this.renderBody());
  },
  openEditPopup(idx) {
    this.draft = { ...this.entries()[idx], photos: [...(this.entries()[idx].photos || [])] };   // own copy of the photo list, so removing a photo isn't final until Save
    this.draftIdx = idx;
    Popup.open(this.renderPopupBody(), () => this.renderBody());
  },
  updateDraft(field, value) {
    this.draft[field] = value;
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },
  saveDraft() {
    if (this.draftIdx === null) this.entries().push(this.draft);
    else this.entries()[this.draftIdx] = this.draft;
    persistData();
    this.selectedYear = seasonLabelFor(this.draft.date, "clay"); // the list moves to the saved entry's year so it doesn't seem to vanish
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

  handleLocationChange(selectEl) {
    if (selectEl.value === "__add_new__") {
      const name = prompt("New ground name:");
      const added = this.addGround(name);
      if (added) this.updateDraft("location", added);
      else Popup.setBody(this.renderPopupBody());
      return;
    }
    this.updateDraft("location", selectEl.value);
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
    LocationMatch.captureLocation((loc) => {
      if (!loc) return;
      if (loc.what3words) this.draft.what3words = loc.what3words; // a failed lookup never wipes words already there
      this.draft.lat = loc.lat;
      this.draft.lng = loc.lng;
      Popup.markDirty();
      Popup.setBody(this.renderPopupBody());
    });
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
    document.getElementById("clayBody").innerHTML = this.renderOverview() + this.renderList();
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
      <button class="btn small" style="margin-top:10px; display:block; width:100%;" onclick="ClayShooting.openAddPopup()">+ Add entry</button>`;
  },

  renderList() {
    const all = this.entries();
    const inYear = new Set(listInYear(all, "clay", this.selectedYear)); // the year buttons above are the Overview's
    const rows = all
      .map((e, idx) => {
        if (!inYear.has(e)) return "";
        const pct = (parseInt(e.clays, 10) || 0) > 0 ? Math.round(((parseInt(e.hits, 10) || 0) / parseInt(e.clays, 10)) * 100) : 0;
        return `
      <div class="log-row-card compact-row" onclick="ClayShooting.openEditPopup(${idx})" style="cursor:pointer;">
        <div class="log-row compact-summary cs-g">
          <span>${displayDate(e.date)}</span>
          <span>${e.location || ""}</span>
          <span>${e.clays || 0} clays, ${e.hits || 0} hits (${pct}%)</span>
        </div>
      </div>`;
      })
      .join("");
    const empty = !all.length ? '<p class="hint">No entries yet — tap "+ Add entry" above to log a round.</p>' : (!rows.trim() ? listEmptyYearHtml(all, "clay", this.selectedYear) : "");
    return `<div style="margin-top:8px;">${rows}${empty}</div>`;
  },

  // ---------- The popup editor (draft) ----------
  renderPopupBody() {
    const e = this.draft;
    const grounds = this.grounds();
    const photos = e.photos || [];
    const photoThumbs = photos
      .map((p, pIdx) => `<span class="photo-thumb-wrap"><img src="${cloudinaryThumb(p, 50)}" class="zeroing-thumb" /><button class="icon-btn photo-remove" onclick="ClayShooting.removePhoto(${pIdx})">✕</button></span>`)
      .join("");
    const pct = (parseInt(e.clays, 10) || 0) > 0 ? Math.round(((parseInt(e.hits, 10) || 0) / parseInt(e.clays, 10)) * 100) : 0;

    const row = (inner) => `<div class="log-row">${inner}</div>`;
    const B = {};
    B.dateGround = row(`
      ${Popup.labeled("Date", `${DateInput.html(e.date, "ClayShooting.updateDraft('date', v)")}`)}
      ${Popup.labeled("Ground", `<select onchange="ClayShooting.handleLocationChange(this)">
        <option value="" ${!e.location ? "selected" : ""}>Ground…</option>
        ${grounds.map((g) => `<option ${g === e.location ? "selected" : ""}>${g}</option>`).join("")}
        <option value="__add_new__">+ Add new ground…</option>
      </select>`)}`);
    B.firearm = row(Popup.labeled("Firearm", `<select onchange="ClayShooting.handleFirearmChange(this)">
        <option value="" ${!e.firearm ? "selected" : ""}>Firearm…</option>
        ${Firearms.list().map((f) => `<option ${f === e.firearm ? "selected" : ""}>${f}</option>`).join("")}
        <option value="__add_new__">+ Add new firearm…</option>
      </select>`));
    B.locNotes = row(Popup.labeled("Location notes", `<input type="text" placeholder="On-the-ground spot description" value="${e.locationNotes || ""}" onchange="ClayShooting.updateDraft('locationNotes',this.value)" />`));
    B.claysHits = `${row(`
      ${Popup.labeled("Clays", `<input type="number" min="0" placeholder="Clays" value="${e.clays}" onchange="ClayShooting.updateDraft('clays',this.value)" />`)}
      ${Popup.labeled("Hits", `<input type="number" min="0" placeholder="Hits" value="${e.hits}" onchange="ClayShooting.updateDraft('hits',this.value)" />`)}`)}
    ${row(`<span class="hint" style="margin:0;">${pct}% hit</span>`)}`;
    B.w3w = row(`
      ${Popup.labeled("what3words", `<input type="text" placeholder="///what3words" value="${e.what3words || ""}" onchange="ClayShooting.updateDraft('what3words',this.value)" />`)}
      <div class="row-below"><button class="btn small ghost" onclick="ClayShooting.captureW3w()">📍 Auto</button></div>`);
    B.notes = row(Popup.labeled("Notes", `<input type="text" placeholder="Notes" value="${e.notes || ""}" onchange="ClayShooting.updateDraft('notes',this.value)" />`));
    B.photos = `<div class="log-row photo-row">
      ${photoThumbs}
      <label class="btn small ghost" style="cursor:pointer;">📷 Take photo
        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="ClayShooting.addPhoto(this)" />
      </label>
      <label class="btn small ghost" style="cursor:pointer;">🖼 From photos
        <input type="file" accept="image/*" multiple style="display:none;" onchange="ClayShooting.addPhoto(this)" />
      </label>
    </div>`;

    // ---- The Clay Shooting form, top to bottom (as laid out by Ben) ----
    const ORDER = ["dateGround", "firearm", "locNotes", "claysHits", "w3w", "notes", "photos"];

    let html = Popup.header("Clay Shooting Entry");
    html += `<div style="padding:0 16px 16px;">`;
    ORDER.forEach((k) => { html += B[k] || ""; });
    html += `${Popup.removeFooter("ClayShooting.removeDraft()", "Remove entry")}
    ${Popup.saveFooter("ClayShooting.saveDraft()")}
    </div>`;
    return html;
  },
};
