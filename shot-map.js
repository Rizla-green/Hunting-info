/* =====================================================================
   SHOT-LOCATION MAP — for Deer, Fox, Goat, Boar, Squirrel (the w3w-
   enabled species). Two views: combined (all farms' pins for the
   season) and single-farm filter. Reuses the same Leaflet+Esri setup
   as Land and Farms, plus a "My Location" recenter button.
===================================================================== */

const ShotLocationMap = {
  map: null,
  sectionKey: null,      // 'deer' or a SPECIES_SECTIONS key
  seasonYear: null,
  viewFarmId: null,      // null = combined (all farms)

  // entries() + seasonLabelFor work the same way for Deer and the
  // shared species logs, so this just points at whichever is active.
  getEntries() {
    if (this.sectionKey === "deer") return DeerLog.entries();
    window.APP_DATA.species = window.APP_DATA.species || {};
    return window.APP_DATA.species[this.sectionKey] || [];
  },

  open(sectionKey, presetFarmId) {
    this.sectionKey = sectionKey;
    this.viewFarmId = presetFarmId || null;
    this.seasonYear = currentSeasonLabel(sectionKey === "deer" ? "deer" : sectionKey);
    LeafletLoader.ensure(() => this._openMap());
  },

  _openMap() {
    const overlay = document.getElementById("modalOverlay");
    overlay.innerHTML = `
      <div class="modal-box map-modal-box">
        <div class="map-modal-header">
          <h3>Shot Locations</h3>
          <button class="icon-btn" onclick="ShotLocationMap.close()">✕</button>
        </div>
        <div class="species-tabs" id="shotMapFilters"></div>
        <div id="shotMapContainer" class="land-map-container"></div>
        <div class="land-map-actions">
          <button class="btn ghost" onclick="ShotLocationMap.recenterToMyLocation()">📍 My Location</button>
        </div>
        <p class="hint" id="shotMapInfo"></p>
      </div>`;
    overlay.classList.remove("hidden");

    setTimeout(() => {
      this.map = L.map("shotMapContainer").setView([51.4816, -3.1791], 8);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri", maxZoom: 19 }
      ).addTo(this.map);
      this.renderFilters();
      this.renderPins();
    }, 30);
  },

  renderFilters() {
    const farms = window.APP_DATA.farms || [];
    const years = seasonYearsFor(this.getEntries(), this.sectionKey === "deer" ? "deer" : this.sectionKey);
    const yearButtons = years
      .map((y) => `<button class="tab-btn ${y === this.seasonYear ? "active" : ""}" onclick="ShotLocationMap.setYear('${y}')">${y}</button>`)
      .join("");
    const farmButtons = [
      `<button class="tab-btn ${!this.viewFarmId ? "active" : ""}" onclick="ShotLocationMap.setFarm(null)">All farms</button>`,
      ...farms.map((f) => `<button class="tab-btn ${this.viewFarmId === f.id ? "active" : ""}" onclick="ShotLocationMap.setFarm('${f.id}')">${f.name}</button>`),
    ].join("");
    document.getElementById("shotMapFilters").innerHTML = `<div>${yearButtons}</div><div style="margin-top:6px;">${farmButtons}</div>`;
  },

  setYear(year) { this.seasonYear = year; this.renderFilters(); this.renderPins(); },
  setFarm(farmId) { this.viewFarmId = farmId; this.renderFilters(); this.renderPins(); },

  renderPins() {
    if (this._pinLayer) this.map.removeLayer(this._pinLayer);
    this._pinLayer = L.layerGroup().addTo(this.map);

    const seasonKey = this.sectionKey === "deer" ? "deer" : this.sectionKey;
    const pins = this.getEntries().filter((e) => {
      if (e.lat == null || e.lng == null) return false;
      if (seasonLabelFor(e.date, seasonKey) !== this.seasonYear) return false;
      if (this.viewFarmId && (e.farmId || "other") !== this.viewFarmId) return false;
      return true;
    });

    pins.forEach((e) => {
      const label = this.sectionKey === "deer" ? `${e.species} — ${e.sex}` : e.category;
      L.circleMarker([e.lat, e.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#cda85e", fillOpacity: 1 })
        .bindPopup(`<strong>${label}</strong><br>${e.date}${e.what3words ? "<br>" + e.what3words : ""}`)
        .addTo(this._pinLayer);
    });

    if (pins.length > 0) {
      this.map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])).pad(0.2));
    }
    document.getElementById("shotMapInfo").textContent = pins.length
      ? `${pins.length} shot location${pins.length === 1 ? "" : "s"} shown for ${this.seasonYear}.`
      : `No GPS-tagged entries yet for ${this.seasonYear} — entries logged via "📷 Add via camera" appear here automatically.`;
  },

  recenterToMyLocation() {
    if (!navigator.geolocation) {
      alert("This device doesn't support GPS location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => this.map.setView([pos.coords.latitude, pos.coords.longitude], 15),
      () => alert("Couldn't get your location — check location permissions and try again."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  },

  close() {
    document.getElementById("modalOverlay").classList.add("hidden");
    if (this.map) { this.map.remove(); this.map = null; }
  },
};
