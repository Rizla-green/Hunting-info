/* =====================================================================
   ZEROING — flattened, no caliber grouping: one single list of
   sessions. Rifle comes from the shared Firearms list (replacing the
   old free-text caliber). Location uses the same "remembered dropdown"
   pattern as Clay Shooting — its own separate list, not tied to Land
   and Farms or shared with Clay Shooting's grounds. What3words auto-pin
   via the shared LocationMatch module. Adjustment is a Yes/No toggle;
   choosing Yes reveals a Notes popup for the adjustment detail.
   Weather auto-fetch and ballistics are intentionally NOT built —
   ballistics stays deferred until Ben supplies data.
===================================================================== */

const Zeroing = {
  notesPopupIdx: null,

  sessions() {
    window.APP_DATA.zeroing = window.APP_DATA.zeroing || [];
    return window.APP_DATA.zeroing;
  },

  // Remembered zeroing locations — separate list from Clay Shooting's grounds.
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

  open() {
    this.render();
  },

  addSession() {
    this.sessions().push({
      date: new Date().toISOString().slice(0, 10),
      rifle: "",
      location: this.locations()[0] || "",
      what3words: "",
      lat: null,
      lng: null,
      distance: "",
      shots: 1,
      adjusted: false,
      adjustmentNotes: "",
      photos: [],
    });
    this.saveAndRender();
  },

  removeSession(idx) {
    if (!confirm("Remove this session? This can't be undone.")) return;
    this.sessions().splice(idx, 1);
    this.saveAndRender();
  },

  updateSession(idx, field, value) {
    this.sessions()[idx][field] = value;
    this.saveAndRender();
  },

  handleRifleChange(idx, selectEl) {
    if (selectEl.value === "__add_new__") {
      const added = Firearms.addInline();
      if (added) this.updateSession(idx, "rifle", added);
      else this.render();
      return;
    }
    this.updateSession(idx, "rifle", selectEl.value);
  },

  handleLocationChange(idx, selectEl) {
    if (selectEl.value === "__add_new__") {
      const name = prompt("New location name:");
      const added = this.addLocation(name);
      if (added) this.updateSession(idx, "location", added);
      else this.render();
      return;
    }
    this.updateSession(idx, "location", selectEl.value);
  },

  toggleAdjusted(idx, checked) {
    this.sessions()[idx].adjusted = checked;
    this.saveAndRender();
    if (checked) this.openAdjustmentNotes(idx);
  },

  // Adjustment notes open as their own popup screen (per spec), with a
  // "Done" button returning to the flat Zeroing list rather than closing
  // everything, matching the app's Back/Main Menu navigation elsewhere.
  openAdjustmentNotes(idx) {
    this.notesPopupIdx = idx;
    const session = this.sessions()[idx];
    const overlay = document.getElementById("modalOverlay");
    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="Zeroing.closeAdjustmentNotes()">← Back</button>
          <h3>Adjustment Notes</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
        </div>
        <div class="log-row">
          <textarea rows="6" style="width:100%; box-sizing:border-box; padding:8px; border-radius:8px; border:1px solid var(--gold-dim); background:var(--navy); color:var(--cream);" placeholder="What did you adjust, and by how much?" onchange="Zeroing.updateSession(${idx},'adjustmentNotes',this.value)">${session.adjustmentNotes || ""}</textarea>
        </div>
        <button class="btn small" onclick="Zeroing.closeAdjustmentNotes()">Done</button>
      </div>`;
    overlay.classList.remove("hidden");
  },

  closeAdjustmentNotes() {
    this.notesPopupIdx = null;
    this.render();
  },

  captureW3w(idx) {
    LocationMatch.captureLocation((loc) => {
      if (!loc) return;
      const session = this.sessions()[idx];
      session.what3words = loc.what3words;
      session.lat = loc.lat;
      session.lng = loc.lng;
      this.saveAndRender();
    });
  },

  addPhoto(idx, inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const session = this.sessions()[idx];
      session.photos = session.photos || [];
      session.photos.push(reader.result);
      const photoIdx = session.photos.length - 1;
      this.saveAndRender();
      uploadAndReplace(session.photos, photoIdx);
    };
    reader.readAsDataURL(file);
  },
  removePhoto(idx, photoIdx) {
    if (!confirm("Remove this photo? This can't be undone.")) return;
    this.sessions()[idx].photos.splice(photoIdx, 1);
    this.saveAndRender();
  },

  saveAndRender() {
    persistData();
    if (this.notesPopupIdx === null) this.render();
  },

  render() {
    const sessions = this.sessions().slice().sort((a, b) => a.date.localeCompare(b.date));
    const rifles = Firearms.list();
    const locations = this.locations();
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

    const body = document.getElementById("zeroingBody");
    const rows = sessions
      .map((s) => {
        const idx = this.sessions().indexOf(s);
        const photos = s.photos || [];
        const photoThumbs = photos
          .map((p, pIdx) => `<span class="photo-thumb-wrap"><img src="${cloudinaryThumb(p, 60)}" class="zeroing-thumb" /><button class="icon-btn photo-remove" onclick="Zeroing.removePhoto(${idx},${pIdx})">✕</button></span>`)
          .join("");
        return `
      <div class="log-row-card">
        <div class="log-row">
          <input type="date" value="${s.date}" onchange="Zeroing.updateSession(${idx},'date',this.value)" />
          <select onchange="Zeroing.handleRifleChange(${idx}, this)">
            <option value="" ${!s.rifle ? "selected" : ""}>Rifle…</option>
            ${rifles.map((f) => `<option ${f === s.rifle ? "selected" : ""}>${f}</option>`).join("")}
            <option value="__add_new__">+ Add new firearm…</option>
          </select>
        </div>
        <div class="log-row">
          <select onchange="Zeroing.handleLocationChange(${idx}, this)">
            <option value="" ${!s.location ? "selected" : ""}>Location…</option>
            ${locations.map((l) => `<option ${l === s.location ? "selected" : ""}>${l}</option>`).join("")}
            <option value="__add_new__">+ Add new location…</option>
          </select>
        </div>
        <div class="log-row">
          <input type="text" placeholder="///what3words" value="${s.what3words || ""}" onchange="Zeroing.updateSession(${idx},'what3words',this.value)" />
          <button class="btn small ghost" onclick="Zeroing.captureW3w(${idx})">📍 Auto</button>
        </div>
        <div class="log-row">
          <input type="number" placeholder="Distance zeroed (m)" value="${s.distance}" onchange="Zeroing.updateSession(${idx},'distance',this.value)" style="width:140px;" />
          <input type="number" min="1" placeholder="Shots fired" value="${s.shots}" onchange="Zeroing.updateSession(${idx},'shots',this.value)" style="width:100px;" />
        </div>
        <div class="log-row">
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;">
            <input type="checkbox" ${s.adjusted ? "checked" : ""} onchange="Zeroing.toggleAdjusted(${idx}, this.checked)" />
            Adjustment made
          </label>
          ${s.adjusted ? `<button class="btn small ghost" onclick="Zeroing.openAdjustmentNotes(${idx})">📝 Adjustment notes${s.adjustmentNotes ? " ✓" : ""}</button>` : ""}
        </div>
        <div class="log-row photo-row">
          ${photoThumbs}
          <label class="btn small ghost" style="cursor:pointer;">+ Photo
            <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="Zeroing.addPhoto(${idx}, this)" />
          </label>
          <button class="icon-btn" onclick="Zeroing.removeSession(${idx})" style="margin-left:auto;">✕ Remove entry</button>
        </div>
      </div>`;
      })
      .join("");
    body.innerHTML = `${rows || '<p class="hint">No sessions yet.</p>'}<button class="btn small" style="margin-top:10px;" onclick="Zeroing.addSession()">+ Add session</button>`;
  },
};
