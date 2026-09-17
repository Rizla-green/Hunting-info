/* =====================================================================
   LAND AND FARMS
   One map per farm: a boundary polygon (reused by every species'
   shot-location maps elsewhere in the app) plus toggleable layers —
   Hazards, Gates/Entrances, Water, Buildings, Footpaths (lines, not
   points), and any custom categories the user defines. All layers are
   shown by default and can be toggled individually. Pattern follows
   v3.9's PropertyMapModal (Leaflet + free Esri satellite tiles, no API key).
===================================================================== */

const BUILT_IN_LAYERS = [
  { key: "hazard",   label: "Hazards",         icon: "icons_final/hazzard.png",  color: "#c0392b", type: "point" },
  { key: "gate",     label: "Gates / Entrances", icon: "icons_final/gate.png",   color: "#cda85e", type: "point", extraField: "gateCode" },
  { key: "water",    label: "Water",           icon: "icons_final/water.png",    color: "#3a7bd5", type: "point" },
  { key: "building", label: "Buildings",       icon: "icons_final/building.png", color: "#8a5a34", type: "point" },
  { key: "footpath", label: "Footpaths",       icon: "icons_final/footpath.png", color: "#6e9b5e", type: "line" },
];

const LandAndFarms = {
  map: null,
  currentFarmId: null,
  drawingBoundary: false,
  boundaryPoints: [],
  boundaryDraftMarkers: [],
  boundaryDraftLine: null,
  boundaryLayer: null,
  layerGroups: {},        // key -> L.layerGroup, one per built-in + custom layer
  activeLayerKey: null,   // which layer a tap-to-add currently targets
  customCategories: [],   // [{key, label, icon(color-based, no image), color}]

  ensureLeaflet(callback) {
    LeafletLoader.ensure(callback);
  },

  // Farm data shape (stored per farm, alongside the existing Property record):
  //   farm.land = {
  //     boundary: [{lat,lng}, ...] | null,
  //     layers: { hazard: [{lat,lng,note}], gate: [{lat,lng,note,gateCode}],
  //               water: [...], building: [...], footpath: [[{lat,lng},...], ...],
  //               custom_<key>: [...] },
  //     customCategories: [{key,label,color}]
  //   }
  ensureLandData(farm) {
    if (!farm.land) {
      farm.land = { boundary: null, layers: {}, customCategories: [] };
    }
    BUILT_IN_LAYERS.forEach((l) => {
      if (!farm.land.layers[l.key]) farm.land.layers[l.key] = [];
    });
    (farm.land.customCategories || []).forEach((c) => {
      if (!farm.land.layers["custom_" + c.key]) farm.land.layers["custom_" + c.key] = [];
    });
    return farm.land;
  },

  open(farm) {
    this.currentFarmId = farm.id;
    this.ensureLeaflet(() => this._openMap(farm));
  },

  _openMap(farm) {
    const land = this.ensureLandData(farm);
    this.customCategories = land.customCategories || [];

    const overlay = document.getElementById("modalOverlay");
    overlay.innerHTML = `
      <div class="modal-box map-modal-box">
        <div class="map-modal-header">
          <h3>${farm.name || "Farm"} — Land Map</h3>
          <button class="icon-btn" onclick="LandAndFarms.requestClose()">✕</button>
        </div>
        <div id="landMapContainer" class="land-map-container"></div>
        <div id="landLayerToggles" class="land-layer-toggles"></div>
        <div class="land-map-actions">
          <button class="btn" onclick="LandAndFarms.startBoundary()">Draw farm boundary</button>
          <button class="btn ghost" onclick="LandAndFarms.addCustomCategory()">+ Custom category</button>
          <button class="btn ghost" onclick="LandAndFarms.recenterToMyLocation()">📍 My Location</button>
        </div>
        <p class="hint" id="landMapInfo">Toggle layers below, tap one to start adding a marker for it, or draw the farm boundary.</p>
      </div>`;
    overlay.classList.remove("hidden");

    this.drawingBoundary = false;
    this.boundaryPoints = [];
    this.boundaryDraftMarkers = [];
    this.boundaryDraftLine = null;
    this.boundaryLayer = null;
    this.layerGroups = {};
    this.activeLayerKey = null;

    setTimeout(() => {
      this.map = L.map("landMapContainer").setView([51.4816, -3.1791], 15);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri", maxZoom: 19 }
      ).addTo(this.map);

      if (land.boundary && land.boundary.length > 2) {
        this.boundaryLayer = L.polygon(
          land.boundary.map((p) => [p.lat, p.lng]),
          { color: "#cda85e", weight: 2, fillOpacity: 0.08 }
        ).addTo(this.map);
        this.map.fitBounds(this.boundaryLayer.getBounds().pad(0.15));
      }

      this.renderAllLayers(land);
      this.renderLayerToggles(land);
      this.map.on("click", (e) => this.onMapClick(e, land));
    }, 30);
  },

  allLayerDefs() {
    return [
      ...BUILT_IN_LAYERS,
      ...this.customCategories.map((c) => ({
        key: "custom_" + c.key,
        label: c.label,
        color: c.color,
        type: "point",
        custom: true,
      })),
    ];
  },

  renderAllLayers(land) {
    this.allLayerDefs().forEach((def) => {
      const group = L.layerGroup().addTo(this.map);
      this.layerGroups[def.key] = group;
      const entries = land.layers[def.key] || [];

      if (def.type === "line") {
        entries.forEach((line) => {
          L.polyline(line.map((p) => [p.lat, p.lng]), { color: def.color, weight: 3 }).addTo(group);
        });
      } else {
        entries.forEach((pt) => {
          L.circleMarker([pt.lat, pt.lng], {
            radius: 7,
            color: "#fff",
            weight: 2,
            fillColor: def.color,
            fillOpacity: 1,
          })
            .bindPopup(this.popupFor(def, pt))
            .addTo(group);
        });
      }
    });
  },

  popupFor(def, pt) {
    let html = `<strong>${def.label}</strong>`;
    if (def.extraField && pt[def.extraField]) html += `<br>Code: ${pt[def.extraField]}`;
    if (pt.note) html += `<br>${pt.note}`;
    return html;
  },

  renderLayerToggles(land) {
    const wrap = document.getElementById("landLayerToggles");
    wrap.innerHTML = "";
    this.allLayerDefs().forEach((def) => {
      const btn = document.createElement("button");
      btn.className = "layer-toggle" + (this.activeLayerKey === def.key ? " active" : "");
      btn.style.borderColor = def.color;
      btn.textContent = def.label;
      btn.onclick = () => this.selectLayer(def.key);
      wrap.appendChild(btn);

      const visToggle = document.createElement("button");
      visToggle.className = "layer-vis-toggle";
      visToggle.textContent = "👁";
      visToggle.title = "Show/hide this layer";
      visToggle.onclick = () => this.toggleLayerVisibility(def.key);
      wrap.appendChild(visToggle);
    });
  },

  // Pans the map to the device's current GPS location — navigation only,
  // doesn't drop a pin. Available on every map in the app; Zeroing has
  // its own separate "use my location to place a pin" version.
  recenterToMyLocation() {
    if (!navigator.geolocation) {
      alert("This device doesn't support GPS location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.map.setView([pos.coords.latitude, pos.coords.longitude], 16);
      },
      () => alert("Couldn't get your location — check location permissions and try again."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  },

  toggleLayerVisibility(key) {
    const group = this.layerGroups[key];
    if (!group) return;
    if (this.map.hasLayer(group)) this.map.removeLayer(group);
    else group.addTo(this.map);
  },

  selectLayer(key) {
    this.activeLayerKey = this.activeLayerKey === key ? null : key;
    const def = this.allLayerDefs().find((d) => d.key === key);
    document.getElementById("landMapInfo").textContent = this.activeLayerKey
      ? def.type === "line"
        ? `Tap points to trace a ${def.label.toLowerCase()} path, tap the first point again to finish.`
        : `Tap the map to drop a ${def.label.toLowerCase()} marker.`
      : "Toggle layers below, tap one to start adding a marker for it, or draw the farm boundary.";
    this.renderLayerToggles(this.currentLand());
  },

  currentLand() {
    const farm = this.findFarm(this.currentFarmId);
    return farm ? this.ensureLandData(farm) : null;
  },

  findFarm(id) {
    // TODO: wired to the real Firestore-backed farms list once the data layer lands.
    return (window.APP_DATA?.farms || []).find((f) => f.id === id);
  },

  startBoundary() {
    this.drawingBoundary = true;
    this.activeLayerKey = null;
    this.boundaryPoints = [];
    this.boundaryDraftMarkers.forEach((m) => this.map.removeLayer(m));
    this.boundaryDraftMarkers = [];
    if (this.boundaryDraftLine) this.map.removeLayer(this.boundaryDraftLine);
    document.getElementById("landMapInfo").textContent =
      "Tap points to trace the farm boundary. Tap the first point again to close it.";
  },

  onMapClick(e, land) {
    if (this.drawingBoundary) {
      this.handleBoundaryClick(e, land);
      return;
    }
    if (!this.activeLayerKey) return;

    const def = this.allLayerDefs().find((d) => d.key === this.activeLayerKey);
    if (def.type === "line") {
      this.handleLineClick(e, land, def);
    } else {
      this.addPointMarker(e.latlng, land, def);
    }
  },

  handleBoundaryClick(e, land) {
    if (this.boundaryPoints.length > 2) {
      const first = this.map.latLngToContainerPoint(this.boundaryPoints[0]);
      const clicked = this.map.latLngToContainerPoint(e.latlng);
      if (first.distanceTo(clicked) < 15) {
        this.drawingBoundary = false;
        if (this.boundaryDraftLine) this.map.removeLayer(this.boundaryDraftLine);
        if (this.boundaryLayer) this.map.removeLayer(this.boundaryLayer);
        this.boundaryLayer = L.polygon(this.boundaryPoints, { color: "#cda85e", weight: 2, fillOpacity: 0.08 }).addTo(this.map);
        land.boundary = this.boundaryPoints.map((p) => ({ lat: p.lat, lng: p.lng }));
        this.boundaryDraftMarkers.forEach((m) => this.map.removeLayer(m));
        this.boundaryDraftMarkers = [];
        document.getElementById("landMapInfo").textContent = "Boundary set. It's reused automatically on every species' shot-location map.";
        return;
      }
    }
    this.boundaryPoints.push(e.latlng);
    this.boundaryDraftMarkers.push(
      L.circleMarker(e.latlng, { radius: 5, color: "#fff", fillColor: "#cda85e", fillOpacity: 1, weight: 2 }).addTo(this.map)
    );
    if (this.boundaryDraftLine) this.map.removeLayer(this.boundaryDraftLine);
    if (this.boundaryPoints.length > 1) {
      this.boundaryDraftLine = L.polyline(this.boundaryPoints, { color: "#cda85e", dashArray: "4,4" }).addTo(this.map);
    }
  },

  addPointMarker(latlng, land, def) {
    const note = def.extraField ? "" : "";
    const point = { lat: latlng.lat, lng: latlng.lng, note };
    if (def.extraField) {
      const code = prompt(`Gate code (leave blank if none):`) || "";
      point[def.extraField] = code;
    }
    land.layers[def.key].push(point);
    L.circleMarker(latlng, { radius: 7, color: "#fff", weight: 2, fillColor: def.color, fillOpacity: 1 })
      .bindPopup(this.popupFor(def, point))
      .addTo(this.layerGroups[def.key]);
  },

  // Footpaths are drawn as a line, same "tap to trace, tap first point to
  // finish" gesture as the boundary, but stored per-line under their layer key.
  _linePoints: [],
  _lineDraftMarkers: [],
  _lineDraft: null,
  handleLineClick(e, land, def) {
    if (this._linePoints.length > 1) {
      const first = this.map.latLngToContainerPoint(this._linePoints[0]);
      const clicked = this.map.latLngToContainerPoint(e.latlng);
      if (first.distanceTo(clicked) < 15 && this._linePoints.length > 2) {
        this.finishLine(land, def);
        return;
      }
    }
    this._linePoints.push(e.latlng);
    this._lineDraftMarkers.push(
      L.circleMarker(e.latlng, { radius: 4, color: "#fff", fillColor: def.color, fillOpacity: 1, weight: 2 }).addTo(this.map)
    );
    if (this._lineDraft) this.map.removeLayer(this._lineDraft);
    if (this._linePoints.length > 1) {
      this._lineDraft = L.polyline(this._linePoints, { color: def.color, dashArray: "4,4" }).addTo(this.map);
    }
  },
  finishLine(land, def) {
    if (this._lineDraft) this.map.removeLayer(this._lineDraft);
    this._lineDraftMarkers.forEach((m) => this.map.removeLayer(m));
    L.polyline(this._linePoints, { color: def.color, weight: 3 }).addTo(this.layerGroups[def.key]);
    land.layers[def.key].push(this._linePoints.map((p) => ({ lat: p.lat, lng: p.lng })));
    this._linePoints = [];
    this._lineDraftMarkers = [];
    this._lineDraft = null;
    document.getElementById("landMapInfo").textContent = `${def.label} path added. Tap the layer again to add another.`;
  },

  addCustomCategory() {
    const label = prompt("Name for the new category (e.g. 'Bird feeders'):");
    if (!label) return;
    const color = prompt("Colour for this category (hex, e.g. #7a5cff):", "#7a5cff") || "#7a5cff";
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const land = this.currentLand();
    if (!land) return;
    land.customCategories.push({ key, label, color });
    land.layers["custom_" + key] = [];
    this.customCategories = land.customCategories;
    const group = L.layerGroup().addTo(this.map);
    this.layerGroups["custom_" + key] = group;
    this.renderLayerToggles(land);
  },

  requestClose() {
    // TODO: hook into Store.save() / Firestore write + triggerBackup() once the data layer lands.
    document.getElementById("modalOverlay").classList.add("hidden");
    if (this.map) { this.map.remove(); this.map = null; }
  },
};
