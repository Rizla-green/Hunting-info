/* =====================================================================
   ZEROING — flattened, no caliber grouping: one single list of
   sessions. Rifle comes from the shared Firearms list. Location uses
   its own remembered-dropdown list, same pattern as Clay Shooting.
   Entries collapse to a single summary line; tapping one opens a
   genuine pop-out popup (working on a draft — nothing saves until
   Save is tapped), same pattern as every other section. Adjustment
   notes open as their own nested popup. Weather auto-fetch and
   ballistics are intentionally NOT built.
===================================================================== */

const Zeroing = {
  draft: null,
  draftIdx: null,
  notesPopupOpen: false,

  sessions() {
    // Old builds stored zeroing grouped by caliber as an OBJECT; the
    // flat structure is an ARRAY. Reset a stale object shape rather
    // than trust it.
    if (!Array.isArray(window.APP_DATA.zeroing)) window.APP_DATA.zeroing = [];
    return window.APP_DATA.zeroing;
  },

  locations() {
    window.APP_DATA.zeroingLocations = window.APP_DATA.zeroingLocations || [];
    return window.APP_DATA.zeroingLocations;
  },
  addLocation(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    const locations = this.locations();
    if (!locations.includes(trimmed)) locations.push(trimmed);
    return trimmed;
  },

  open() { this.render(); },

  newSessionDefaults() {
    return {
      date: new Date().toISOString().slice(0, 10),
      rifle: "",
      location: this.locations()[0] || "",
      what3words: "", lat: null, lng: null,
      distance: "",
      shots: 1,
      adjusted: false,
      adjustmentNotes: "",
      photos: [],
      locationNotes: "",
    };
  },

  openAddPopup() {
    this.draft = this.newSessionDefaults();
    this.draftIdx = null;
    Popup.open(this.renderPopupBody(), () => this.render());
  },
  openEditPopup(idx) {
    this.draft = { ...this.sessions()[idx] };
    this.draftIdx = idx;
    Popup.open(this.renderPopupBody(), () => this.render());
  },
  updateDraft(field, value) {
    this.draft[field] = value;
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
  },
  saveDraft() {
    if (this.draftIdx === null) this.sessions().push(this.draft);
    else this.sessions()[this.draftIdx] = this.draft;
    persistData();
    Popup.dirty = false;
    this.draft = null;
    this.draftIdx = null;
    Popup.close();
  },
  removeDraft() {
    if (this.draftIdx === null) { Popup.dirty = false; Popup.close(); return; }
    if (!confirm("Remove this session? This can't be undone.")) return;
    this.sessions().splice(this.draftIdx, 1);
    persistData();
    Popup.dirty = false;
    this.draft = null;
    this.draftIdx = null;
    Popup.close();
  },

  handleRifleChange(selectEl) {
    if (selectEl.value === "__add_new__") {
      const added = Firearms.addInline();
      if (added) this.updateDraft("rifle", added);
      else Popup.setBody(this.renderPopupBody());
      return;
    }
    this.updateDraft("rifle", selectEl.value);
  },
  handleLocationChange(selectEl) {
    if (selectEl.value === "__add_new__") {
      const name = prompt("New location name:");
      const added = this.addLocation(name);
      if (added) this.updateDraft("location", added);
      else Popup.setBody(this.renderPopupBody());
      return;
    }
    this.updateDraft("location", selectEl.value);
  },
  toggleAdjusted(checked) {
    this.draft.adjusted = checked;
    Popup.markDirty();
    Popup.setBody(this.renderPopupBody());
    if (checked) this.openAdjustmentNotes();
  },

  // Adjustment notes open as their own NESTED popup, on top of the entry popup.
  openAdjustmentNotes() {
    this.notesPopupOpen = true;
    Popup.setBody(this.renderAdjustmentNotesBody());
  },
  closeAdjustmentNotes() {
    this.notesPopupOpen = false;
    Popup.setBody(this.renderPopupBody());
  },
  renderAdjustmentNotesBody() {
    return `
      ${Popup.header("Adjustment Notes")}
      <div style="padding:0 16px 16px;">
        <textarea rows="6" style="width:100%; box-sizing:border-box; padding:8px; border-radius:8px; border:1px solid var(--gold-dim); background:var(--navy); color:var(--cream);" placeholder="What did you adjust, and by how much?" onchange="Zeroing.updateDraft('adjustmentNotes',this.value)">${this.draft.adjustmentNotes || ""}</textarea>
        <button class="btn small" style="margin-top:10px;" onclick="Zeroing.closeAdjustmentNotes()">Done</button>
      </div>`;
  },

  captureW3w() {
    LocationMatch.captureLocation((loc) => {
      if (!loc) return;
      this.draft.what3words = loc.what3words;
      this.draft.lat = loc.lat;
      this.draft.lng = loc.lng;
      Popup.markDirty();
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

  render() {
    const sessions = this.sessions().slice().sort((a, b) => a.date.localeCompare(b.date));
    const overlay = document.getElementById("modalOverlay");
    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">← Back</button>
          <h3>Zeroing</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
        </div>
        <div id="zeroingBody"></div>
      </div>`;
    overlay.classList.remove("hidden");

    const rows = sessions
      .map((s) => {
        const idx = this.sessions().indexOf(s);
        return `
      <div class="log-row-card compact-row" onclick="Zeroing.openEditPopup(${idx})" style="cursor:pointer;">
        <div class="log-row compact-summary">
          <span>${s.date}</span>
          <span>${s.rifle || ""}</span>
          <span>${s.location || ""}</span>
        </div>
      </div>`;
      })
      .join("");
    document.getElementById("zeroingBody").innerHTML = `${rows || '<p class="hint">No sessions yet.</p>'}<button class="btn small" style="margin-top:10px; display:block; width:100%;" onclick="Zeroing.openAddPopup()">+ Add session</button>`;
  },

  // ---------- The popup editor (draft) ----------
  renderPopupBody() {
    if (this.notesPopupOpen) return this.renderAdjustmentNotesBody();
    const s = this.draft;
    const rifles = Firearms.list();
    const locations = this.locations();
    const photos = s.photos || [];
    const photoThumbs = photos
      .map((p, pIdx) => `<span class="photo-thumb-wrap"><img src="${cloudinaryThumb(p, 60)}" class="zeroing-thumb" /><button class="icon-btn photo-remove" onclick="Zeroing.removePhoto(${pIdx})">✕</button></span>`)
      .join("");

    let html = Popup.header("Zeroing Session");
    html += `<div style="padding:0 16px 16px;">`;
    html += `<div class="log-row">
      ${Popup.labeled("Date", `<input type="date" value="${s.date}" onchange="Zeroing.updateDraft('date',this.value)" />`)}
      ${Popup.labeled("Rifle", `<select onchange="Zeroing.handleRifleChange(this)">
        <option value="" ${!s.rifle ? "selected" : ""}>Rifle…</option>
        ${rifles.map((f) => `<option ${f === s.rifle ? "selected" : ""}>${f}</option>`).join("")}
        <option value="__add_new__">+ Add new firearm…</option>
      </select>`)}
    </div>
    <div class="log-row">
      ${Popup.labeled("Location", `<select onchange="Zeroing.handleLocationChange(this)">
        <option value="" ${!s.location ? "selected" : ""}>Location…</option>
        ${locations.map((l) => `<option ${l === s.location ? "selected" : ""}>${l}</option>`).join("")}
        <option value="__add_new__">+ Add new location…</option>
      </select>`)}
    </div>
    <div class="log-row">
      ${Popup.labeled("what3words", `<input type="text" placeholder="///what3words" value="${s.what3words || ""}" onchange="Zeroing.updateDraft('what3words',this.value)" />`)}
      <button class="btn small ghost" onclick="Zeroing.captureW3w()">📍 Auto</button>
    </div>
    <div class="log-row">
      ${Popup.labeled("Distance zeroed (m)", `<input type="number" placeholder="Distance zeroed (m)" value="${s.distance}" onchange="Zeroing.updateDraft('distance',this.value)" />`)}
      ${Popup.labeled("Shots fired", `<input type="number" min="1" placeholder="Shots fired" value="${s.shots}" onchange="Zeroing.updateDraft('shots',this.value)" />`)}
    </div>
    <div class="log-row">
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;">
        <input type="checkbox" ${s.adjusted ? "checked" : ""} onchange="Zeroing.toggleAdjusted(this.checked)" />
        Adjustment made
      </label>
      ${s.adjusted ? `<button class="btn small ghost" onclick="Zeroing.openAdjustmentNotes()">📝 Adjustment notes${s.adjustmentNotes ? " ✓" : ""}</button>` : ""}
    </div>
    <div class="log-row">${Popup.labeled("Location notes", `<input type="text" placeholder="On-the-ground spot description" value="${s.locationNotes || ""}" onchange="Zeroing.updateDraft('locationNotes',this.value)" />`)}</div>
    <div class="log-row photo-row">
      ${photoThumbs}
      <label class="btn small ghost" style="cursor:pointer;">+ Photo
        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="Zeroing.addPhoto(this)" />
      </label>
    </div>
    ${Popup.removeFooter("Zeroing.removeDraft()", "Remove session")}
    ${Popup.saveFooter("Zeroing.saveDraft()")}
    </div>`;
    return html;
  },
};
