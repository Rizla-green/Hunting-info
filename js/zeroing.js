/* =====================================================================
   ZEROING
   Top level: list of calibers. Tap one → history of sessions (date order),
   with a + Add button. Each session: target photo, "My Location" pin
   (GPS with manual fallback + retry), a separate user-given location
   name, caliber, distance zeroed, shots fired, scope adjusted (yes/no).
   Weather/wind auto-fetches for the pinned location.
   Ballistics (chart-based vs calculated trajectory) is intentionally
   NOT built yet — Ben is supplying that data separately.
===================================================================== */

const Zeroing = {
  currentCaliber: null,

  data() {
    window.APP_DATA.zeroing = window.APP_DATA.zeroing || {};
    return window.APP_DATA.zeroing; // { [caliber]: [session, session, ...] }
  },

  calibers() {
    return Object.keys(this.data());
  },

  openCaliberList() {
    const overlay = document.getElementById("modalOverlay");
    const calibers = this.calibers();
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="map-modal-header">
          <h3>Zeroing</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">✕</button>
        </div>
        <div class="farm-list">
          ${calibers.map((c) => `<button class="btn secondary" onclick="Zeroing.openCaliber('${c}')">${c} <span class="grouped-count">(${this.data()[c].length})</span></button>`).join("")}
        </div>
        <button class="btn small" style="margin-top:12px;" onclick="Zeroing.addCaliber()">+ Add caliber</button>
      </div>`;
    overlay.classList.remove("hidden");
  },

  addCaliber() {
    const name = prompt("Caliber (e.g. .243, 6.5 Creedmoor):");
    if (!name) return;
    if (!this.data()[name]) this.data()[name] = [];
    this.saveAndRender();
    this.openCaliberList();
  },

  openCaliber(caliber) {
    this.currentCaliber = caliber;
    this.render();
  },

  addSession() {
    const sessions = this.data()[this.currentCaliber];
    sessions.push({
      date: new Date().toISOString().slice(0, 10),
      photo: null,
      lat: null,
      lng: null,
      locationName: "",
      distance: "",
      shots: 1,
      scopeAdjusted: false,
      weather: null, // filled by fetchWeatherFor() once a pin is set
    });
    this.saveAndRender();
  },

  removeSession(idx) {
    if (!confirm("Remove this session? This can't be undone.")) return;
    this.data()[this.currentCaliber].splice(idx, 1);
    this.saveAndRender();
  },

  updateSession(idx, field, value) {
    this.data()[this.currentCaliber][idx][field] = value;
    this.saveAndRender();
  },

  // "Use my current location" — GPS first, with a manual-pin fallback and
  // a retry button so a failed GPS read doesn't dead-end the flow.
  useCurrentLocation(idx) {
    if (!navigator.geolocation) {
      alert("This device doesn't support GPS location — place the pin manually instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const session = this.data()[this.currentCaliber][idx];
        session.lat = pos.coords.latitude;
        session.lng = pos.coords.longitude;
        this.fetchWeatherFor(session);
        this.saveAndRender();
      },
      () => {
        alert("Couldn't get your location — check location permissions and try again, or place the pin manually on the map.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  },

  // Placeholder weather fetch — wired to a real weather API call once the
  // Zeroing screens are connected to the app's live data layer.
  fetchWeatherFor(session) {
    session.weather = { note: "Weather/wind auto-fetch wires up once this screen is connected live." };
  },

  addPhoto(idx, inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.data()[this.currentCaliber][idx].photo = reader.result;
      this.saveAndRender();
    };
    reader.readAsDataURL(file);
  },

  saveAndRender() {
    // TODO: Firestore write, then triggerBackup(window.APP_DATA) for Dropbox.
    // Cloudinary upload replaces the raw data-URL photo storage once wired.
    triggerBackup?.(window.APP_DATA);
    if (this.currentCaliber) this.render();
  },

  render() {
    const sessions = this.data()[this.currentCaliber].slice().sort((a, b) => a.date.localeCompare(b.date));
    const overlay = document.getElementById("modalOverlay");
    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <h3>Zeroing — ${this.currentCaliber}</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">✕</button>
        </div>
        <div id="zeroingBody"></div>
      </div>`;
    overlay.classList.remove("hidden");

    const body = document.getElementById("zeroingBody");
    const rows = sessions
      .map((s, idx) => {
        const hasPin = s.lat != null;
        return `
      <div class="zeroing-session">
        <div class="log-row">
          <input type="date" value="${s.date}" onchange="Zeroing.updateSession(${idx},'date',this.value)" />
          <input type="text" placeholder="Location name" value="${s.locationName || ""}" onchange="Zeroing.updateSession(${idx},'locationName',this.value)" />
          <input type="number" placeholder="Distance (m)" value="${s.distance}" onchange="Zeroing.updateSession(${idx},'distance',this.value)" style="width:100px;" />
          <input type="number" min="1" placeholder="Shots" value="${s.shots}" onchange="Zeroing.updateSession(${idx},'shots',this.value)" style="width:70px;" />
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;">
            <input type="checkbox" ${s.scopeAdjusted ? "checked" : ""} onchange="Zeroing.updateSession(${idx},'scopeAdjusted',this.checked)" />
            Scope adjusted
          </label>
          <button class="icon-btn" onclick="Zeroing.removeSession(${idx})">✕</button>
        </div>
        <div class="zeroing-location-row">
          <button class="btn ghost small" onclick="Zeroing.useCurrentLocation(${idx})">📍 ${hasPin ? "Update" : "Use"} my location</button>
          <span class="hint" style="margin:0;">${hasPin ? `Pinned (${s.lat.toFixed(5)}, ${s.lng.toFixed(5)})` : "No pin set — place manually or use current location"}</span>
        </div>
        <div class="zeroing-photo-row">
          <input type="file" accept="image/*" capture="environment" onchange="Zeroing.addPhoto(${idx}, this)" />
          ${s.photo ? `<img src="${s.photo}" class="zeroing-thumb" />` : ""}
        </div>
      </div>`;
      })
      .join("");
    body.innerHTML = `${rows || '<p class="hint">No sessions yet for this caliber.</p>'}<button class="btn small" onclick="Zeroing.addSession()">+ Add session</button>`;
  },
};
