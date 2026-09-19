/* =====================================================================
   LAND AND FARMS
   One map per farm. Two kinds of drawn shape, both made with the
   Leaflet.draw toolbar (polygon / rectangle, with Finish / Delete last
   point / Cancel, and an edit tool):
     - ONE farm boundary  — the outline of the whole farm. Reused by every
       species' shot-location matching (a pin inside it belongs to the farm).
     - Any number of named FIELDS inside it — labelled on the map, and an
       entry's pin is matched to its field automatically (see fields.js).
   Plus toggleable point/line layers: Hazards, Gates/Entrances, Water,
   Buildings, Footpaths, and custom categories. Every point marker has a
   description and can be edited or deleted; gates also carry a gate code
   and a what3words point.
   Map: Leaflet + free Esri satellite tiles (no API key), as elsewhere.
===================================================================== */

const BUILT_IN_LAYERS = [
  { key: "hazard",   label: "Hazards",           singular: "hazard",   icon: "icons_final/hazzard.png",  color: "#c0392b", type: "point" },
  { key: "gate",     label: "Gates / Entrances", singular: "gate",     icon: "icons_final/gate.png",     color: "#cda85e", type: "point", extraField: "gateCode" },
  { key: "water",    label: "Water",             singular: "water point", icon: "icons_final/water.png", color: "#3a7bd5", type: "point" },
  { key: "building", label: "Buildings",         singular: "building", icon: "icons_final/building.png", color: "#8a5a34", type: "point" },
  { key: "footpath", label: "Footpaths",         singular: "footpath", icon: "icons_final/footpath.png", color: "#6e9b5e", type: "line" },
];

const FIELD_COLOR = "#e0b84a";
const BOUNDARY_COLOR = "#f4f1e8";

const LandAndFarms = {
  map: null,
  currentFarmId: null,
  layerGroups: {},        // key -> L.layerGroup, one per built-in + custom layer
  activeLayerKey: null,   // which layer a tap-to-add currently targets
  customCategories: [],   // [{key, label, color}]
  drawMode: "boundary",   // what the polygon/rectangle tools make right now: "boundary" | "field"
  isDrawing: false,       // true while a draw/edit is in progress (blocks marker popups/drops)
  editGroup: null,        // featureGroup holding the boundary + field shapes (what the edit tool works on)
  boundaryLayer: null,
  fieldLayers: {},        // fieldId -> L.polygon
  pointDraft: null,       // marker being added/edited in the popup editor

  ensureLeaflet(callback) {
    LeafletLoader.ensureDraw(callback);
  },

  // Farm data shape (stored per farm, alongside the existing Property record):
  //   farm.land = {
  //     boundary: [{lat,lng}, ...] | null,           // the whole-farm outline
  //     fields:   [{id, name, points:[{lat,lng}]}],  // named fields inside it
  //     layers: { hazard: [{lat,lng,note}], gate: [{lat,lng,note,gateCode,what3words}],
  //               water: [...], building: [...], footpath: [[{lat,lng},...], ...],
  //               custom_<key>: [...] },
  //     customCategories: [{key,label,color}]
  //   }
  // For markers, "note" is the description shown to the user.
  ensureLandData(farm) {
    if (!farm.land) {
      farm.land = { boundary: null, layers: {}, customCategories: [] };
    }
    if (!farm.land.layers) farm.land.layers = {};
    if (!Array.isArray(farm.land.fields)) farm.land.fields = [];
    BUILT_IN_LAYERS.forEach((l) => {
      if (!farm.land.layers[l.key]) farm.land.layers[l.key] = [];
    });
    (farm.land.customCategories || []).forEach((c) => {
      if (!farm.land.layers["custom_" + c.key]) farm.land.layers["custom_" + c.key] = [];
    });
    return farm.land;
  },

  // opts.activateLayer — open with that marker layer already selected (e.g. "gate")
  open(farm, opts) {
    this.currentFarmId = farm.id;
    this.ensureLeaflet(() => this._openMap(farm, opts || {}));
  },

  _openMap(farm, opts) {
    const land = this.ensureLandData(farm);
    this.customCategories = land.customCategories || [];

    const overlay = document.getElementById("modalOverlay");
    overlay.innerHTML = `
      <div class="modal-box map-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="LandAndFarms.requestClose()">← Back</button>
          <h3>${farm.name || "Farm"} — Land Map</h3>
          <button class="icon-btn" onclick="LandAndFarms.closeToMenu()">Main Menu</button>
        </div>
        <div id="landMapContainer" class="land-map-container"></div>
        <div class="section-title" style="margin-top:10px;"><h4>Drawing tools make a…</h4></div>
        <div class="species-tabs" id="landDrawMode"></div>
        <p class="hint" id="landMapInfo"></p>
        <div id="landFieldList"></div>
        <div class="section-title" style="margin-top:14px;"><h4>Markers</h4></div>
        <div id="landLayerToggles" class="land-layer-toggles"></div>
        <div class="land-map-actions">
          <button class="btn ghost" onclick="LandAndFarms.addCustomCategory()">+ Custom category</button>
          <button class="btn ghost" onclick="LandAndFarms.recenterToMyLocation()">📍 My Location</button>
        </div>
      </div>`;
    overlay.classList.remove("hidden");

    this.isDrawing = false;
    this.layerGroups = {};
    this.activeLayerKey = null;
    this.fieldLayers = {};
    this.boundaryLayer = null;
    this.drawMode = land.boundary && land.boundary.length > 2 ? "field" : "boundary";

    setTimeout(() => {
      this.map = L.map("landMapContainer").setView([51.4816, -3.1791], 15);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri", maxZoom: 19 }
      ).addTo(this.map);

      this.editGroup = L.featureGroup().addTo(this.map);
      this.renderBoundary(land);
      (land.fields || []).forEach((f) => this.addFieldLayer(f));
      this.fitToShapes(land);

      this.renderAllLayers(land);
      this.renderLayerToggles(land);
      this.renderDrawMode();
      this.renderFieldList(land);
      this.addDrawControl();
      this.map.on("click", (e) => this.onMapClick(e, land));

      if (opts.activateLayer) this.selectLayer(opts.activateLayer);
    }, 30);
  },

  fitToShapes(land) {
    let bounds = null;
    if (this.boundaryLayer) bounds = this.boundaryLayer.getBounds();
    else if (this.editGroup && this.editGroup.getLayers().length) bounds = this.editGroup.getBounds();
    if (bounds && bounds.isValid()) this.map.fitBounds(bounds.pad(0.15));
  },

  // ---------- Leaflet.draw toolbar (polygon / rectangle / edit) ----------
  addDrawControl() {
    if (!(window.L && L.Control && L.Control.Draw)) {
      document.getElementById("landMapInfo").textContent =
        "The drawing tools didn't load — check your internet connection, then go Back and reopen the map.";
      return;
    }
    const shape = { color: FIELD_COLOR, weight: 2 };
    this.drawControl = new L.Control.Draw({
      position: "topright",
      draw: {
        polygon: { allowIntersection: false, showArea: false, shapeOptions: shape, drawError: { color: "#c0392b", message: "Lines can't cross" } },
        rectangle: { showArea: false, shapeOptions: shape },
        polyline: false, circle: false, marker: false, circlemarker: false,
      },
      edit: { featureGroup: this.editGroup, remove: false },
    });
    this.map.addControl(this.drawControl);

    this.map.on(L.Draw.Event.CREATED, (e) => this.onShapeCreated(e));
    this.map.on(L.Draw.Event.EDITED, (e) => this.onShapesEdited(e));
    const busy = () => {
      this.isDrawing = true;
      this.activeLayerKey = null;
      this.map.closePopup();
      this.renderLayerToggles(this.currentLand());
    };
    const idle = () => { this.isDrawing = false; };
    this.map.on(L.Draw.Event.DRAWSTART, busy);
    this.map.on(L.Draw.Event.EDITSTART, busy);
    this.map.on(L.Draw.Event.DRAWSTOP, idle);
    this.map.on(L.Draw.Event.EDITSTOP, idle);
  },

  pointsFromLayer(layer) {
    let ll = layer.getLatLngs();
    if (Array.isArray(ll[0])) ll = ll[0];
    return ll.map((p) => ({ lat: p.lat, lng: p.lng }));
  },

  setDrawMode(mode) {
    this.drawMode = mode;
    this.renderDrawMode();
  },

  renderDrawMode() {
    const el = document.getElementById("landDrawMode");
    if (!el) return;
    el.innerHTML = `
      <button class="tab-btn ${this.drawMode === "boundary" ? "active" : ""}" onclick="LandAndFarms.setDrawMode('boundary')">Farm boundary</button>
      <button class="tab-btn ${this.drawMode === "field" ? "active" : ""}" onclick="LandAndFarms.setDrawMode('field')">Field</button>`;
    document.getElementById("landMapInfo").textContent = this.drawMode === "boundary"
      ? "Draw the outline of the whole farm with the polygon or rectangle tool (top right of the map). Tap Finish when you've closed the shape. Drawing a new one replaces the current farm boundary."
      : "Draw a field inside the farm with the polygon or rectangle tool (top right of the map), then give it a name. Use the pencil tool to reshape any shape, and tap a field to rename or delete it.";
  },

  // ---------- Farm boundary ----------
  renderBoundary(land) {
    if (this.boundaryLayer) { this.editGroup.removeLayer(this.boundaryLayer); this.boundaryLayer = null; }
    if (land.boundary && land.boundary.length > 2) {
      this.boundaryLayer = L.polygon(land.boundary.map((p) => [p.lat, p.lng]), {
        color: BOUNDARY_COLOR, weight: 3, dashArray: "8 6", fill: false,
      });
      this.boundaryLayer._landRef = { type: "boundary" };
      this.editGroup.addLayer(this.boundaryLayer);
      if (this.boundaryLayer.bringToBack) this.boundaryLayer.bringToBack();
    }
  },

  // ---------- Fields ----------
  addFieldLayer(field) {
    if (!field.points || field.points.length < 3) return;
    const layer = L.polygon(field.points.map((p) => [p.lat, p.lng]), { color: FIELD_COLOR, weight: 2, fillOpacity: 0.12 });
    layer._landRef = { type: "field", id: field.id };
    layer.bindTooltip(escapeHtml(field.name), { permanent: true, direction: "center", className: "field-label" });
    layer.on("click", (ev) => {
      if (this.activeLayerKey || this.isDrawing) return; // let the tap fall through to marker placement / drawing
      L.popup().setLatLng(ev.latlng).setContent(this.fieldPopupHtml(field.id)).openOn(this.map);
    });
    this.editGroup.addLayer(layer);
    this.fieldLayers[field.id] = layer;
  },

  currentFieldById(id) {
    const land = this.currentLand();
    return land ? land.fields.find((f) => f.id === id) : null;
  },

  fieldPopupHtml(id) {
    const f = this.currentFieldById(id);
    if (!f) return "";
    return `<strong>${escapeHtml(f.name)}</strong><br>
      <button class="btn small ghost" style="margin-top:6px;" onclick="LandAndFarms.renameField('${id}')">Rename</button>
      <button class="btn small ghost" style="margin-top:6px;" onclick="LandAndFarms.deleteField('${id}')">Delete</button>`;
  },

  renderFieldList(land) {
    const el = document.getElementById("landFieldList");
    if (!el) return;
    const fields = land.fields || [];
    if (!fields.length) {
      el.innerHTML = `<p class="hint">No fields drawn yet. Choose "Field" above, then draw one on the map.</p>`;
      return;
    }
    el.innerHTML = `<div class="section-title" style="margin-top:14px;"><h4>Fields (${fields.length})</h4></div>` + fields
      .map((f) => `<div class="log-row">
        <span style="flex:1; cursor:pointer;" onclick="LandAndFarms.zoomToField('${f.id}')">${escapeHtml(f.name)}</span>
        <button class="btn small ghost" onclick="LandAndFarms.renameField('${f.id}')">Rename</button>
        <button class="btn small ghost" onclick="LandAndFarms.deleteField('${f.id}')">Delete</button>
      </div>`)
      .join("");
  },

  zoomToField(id) {
    const layer = this.fieldLayers[id];
    if (layer && this.map) this.map.fitBounds(layer.getBounds().pad(0.2));
  },

  renameField(id) {
    const land = this.currentLand();
    const f = this.currentFieldById(id);
    if (!land || !f) return;
    const name = prompt("Field name:", f.name);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) { alert("A field needs a name."); return; }
    if (Fields.nameTaken(this.currentFarmId, trimmed, id) && !confirm(`Another field on this farm is already called "${trimmed}". Use the same name anyway?`)) return;
    f.name = trimmed;
    const layer = this.fieldLayers[id];
    if (layer) layer.setTooltipContent(escapeHtml(trimmed));
    persistData();
    this.map.closePopup();
    this.renderFieldList(land);
  },

  deleteField(id) {
    const land = this.currentLand();
    const f = this.currentFieldById(id);
    if (!land || !f) return;
    const linked = Fields.countLinked(this.currentFarmId, id);
    const msg = linked
      ? `Delete the field "${f.name}"? ${linked} entr${linked === 1 ? "y is" : "ies are"} linked to it — they'll keep everything else, but their Field box will go blank.`
      : `Delete the field "${f.name}"?`;
    if (!confirm(msg)) return;
    const layer = this.fieldLayers[id];
    if (layer) { this.editGroup.removeLayer(layer); delete this.fieldLayers[id]; }
    land.fields = land.fields.filter((x) => x.id !== id);
    Fields.clearLinked(this.currentFarmId, id);
    persistData();
    this.map.closePopup();
    this.renderFieldList(land);
  },

  // A polygon/rectangle has just been drawn.
  onShapeCreated(e) {
    const land = this.currentLand();
    if (!land) return;
    const points = this.pointsFromLayer(e.layer);
    if (points.length < 3) return;

    if (this.drawMode === "boundary") {
      if (land.boundary && land.boundary.length > 2 && !confirm("Replace this farm's existing boundary with the one you just drew?")) return;
      land.boundary = points;
      this.renderBoundary(land);
      persistData();
      this.drawMode = "field"; // the next thing to draw is normally a field
      this.renderDrawMode();
      document.getElementById("landMapInfo").textContent = "Farm boundary saved. It's used to match every shot to this farm. Now draw the fields inside it — the tools make Fields from here.";
      return;
    }

    const suggested = String(land.fields.length + 1);
    const answer = prompt("Name for this field (you can change it any time):", suggested);
    if (answer === null) return; // cancelled — the shape isn't kept
    const name = answer.trim() || suggested;
    if (Fields.nameTaken(this.currentFarmId, name) && !confirm(`Another field on this farm is already called "${name}". Use the same name anyway?`)) return;
    const field = { id: Fields.newId(), name, points };
    land.fields.push(field);
    this.addFieldLayer(field);
    persistData();
    this.renderFieldList(land);
  },

  // The pencil (edit) tool was saved — write every reshaped shape back.
  onShapesEdited(e) {
    const land = this.currentLand();
    if (!land) return;
    e.layers.eachLayer((layer) => {
      const ref = layer._landRef;
      if (!ref) return;
      const points = this.pointsFromLayer(layer);
      if (ref.type === "boundary") land.boundary = points;
      else {
        const f = land.fields.find((x) => x.id === ref.id);
        if (f) f.points = points;
      }
    });
    persistData();
  },

  // ---------- Marker layers ----------
  allLayerDefs() {
    return [
      ...BUILT_IN_LAYERS,
      ...this.customCategories.map((c) => ({
        key: "custom_" + c.key,
        label: c.label,
        singular: c.label.toLowerCase(),
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
      if (def.type === "line") {
        (land.layers[def.key] || []).forEach((line) => {
          L.polyline(line.map((p) => [p.lat, p.lng]), { color: def.color, weight: 3 }).addTo(group);
        });
      } else {
        this.rebuildPointLayer(def, land);
      }
    });
  },

  // Redraws one point layer from the saved data (also re-numbers the markers
  // after an add or delete, since each one is looked up by its position).
  rebuildPointLayer(def, land) {
    const group = this.layerGroups[def.key];
    if (!group) return;
    group.clearLayers();
    (land.layers[def.key] || []).forEach((pt, idx) => {
      L.circleMarker([pt.lat, pt.lng], { radius: 7, color: "#fff", weight: 2, fillColor: def.color, fillOpacity: 1 })
        .on("click", (ev) => {
          if (this.activeLayerKey || this.isDrawing) return;
          L.popup().setLatLng(ev.latlng).setContent(this.markerPopupHtml(def, pt, idx)).openOn(this.map);
        })
        .addTo(group);
    });
  },

  w3wLink(words) {
    const clean = String(words || "").trim().replace(/^\/+/, "");
    return clean ? `<a href="https://what3words.com/${encodeURIComponent(clean)}" target="_blank" rel="noopener">///${escapeHtml(clean)}</a>` : "";
  },

  markerPopupHtml(def, pt, idx) {
    let html = `<strong>${def.label}</strong>`;
    if (pt.note) html += `<br>${escapeHtml(pt.note)}`;
    if (def.extraField && pt[def.extraField]) html += `<br>Code: ${escapeHtml(pt[def.extraField])}`;
    if (def.key === "gate" && pt.what3words) html += `<br>${this.w3wLink(pt.what3words)}`;
    html += `<br>
      <button class="btn small ghost" style="margin-top:6px;" onclick="LandAndFarms.editPointOnMap('${def.key}', ${idx})">Edit</button>
      <button class="btn small ghost" style="margin-top:6px;" onclick="LandAndFarms.deletePointOnMap('${def.key}', ${idx})">Delete</button>`;
    return html;
  },

  renderLayerToggles(land) {
    const wrap = document.getElementById("landLayerToggles");
    if (!wrap) return;
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
  // doesn't drop a pin.
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
    if (this.activeLayerKey) this.map.closePopup();
    document.getElementById("landMapInfo").textContent = this.activeLayerKey
      ? def.type === "line"
        ? `Tap points to trace a ${def.label.toLowerCase()} path, tap the first point again to finish.`
        : key === "gate"
          ? "Tap the map where the gate is. You'll then be asked for a description and code, and its what3words is looked up for you."
          : `Tap the map to drop a ${def.singular} marker.`
      : "";
    if (!this.activeLayerKey) this.renderDrawMode();
    this.renderLayerToggles(this.currentLand());
  },

  currentLand() {
    const farm = this.findFarm(this.currentFarmId);
    return farm ? this.ensureLandData(farm) : null;
  },

  findFarm(id) {
    return (window.APP_DATA?.farms || []).find((f) => f.id === id);
  },

  onMapClick(e, land) {
    if (this.isDrawing || !this.activeLayerKey) return;
    const def = this.allLayerDefs().find((d) => d.key === this.activeLayerKey);
    if (!def) return;
    if (def.type === "line") this.handleLineClick(e, land, def);
    else this.openPointEditor(this.currentFarmId, def.key, null, e.latlng, () => this.afterPointChange(def.key));
  },

  afterPointChange(layerKey) {
    const land = this.currentLand();
    const def = this.allLayerDefs().find((d) => d.key === layerKey);
    if (land && def && this.map && this.layerGroups[layerKey]) {
      this.rebuildPointLayer(def, land);
      this.map.closePopup();
    }
  },

  editPointOnMap(layerKey, idx) {
    this.openPointEditor(this.currentFarmId, layerKey, idx, null, () => this.afterPointChange(layerKey));
  },

  deletePointOnMap(layerKey, idx) {
    this.deletePoint(this.currentFarmId, layerKey, idx);
    this.afterPointChange(layerKey);
  },

  // ---------- Marker editor (add / edit) — a labelled popup ----------
  // idx === null adds a new marker at latlng; otherwise edits that marker.
  // Works with or without the map open (Farm Profile uses it for gates).
  // onClosed runs when the popup closes, whether saved or not.
  openPointEditor(farmId, layerKey, idx, latlng, onClosed) {
    const farm = this.findFarm(farmId);
    if (!farm) return;
    const land = this.ensureLandData(farm);
    const isNew = idx === null || idx === undefined;
    const existing = isNew ? null : land.layers[layerKey][idx];
    if (!isNew && !existing) return;
    this.pointDraft = {
      farmId, layerKey, idx: isNew ? null : idx, isNew,
      lat: isNew ? latlng.lat : existing.lat,
      lng: isNew ? latlng.lng : existing.lng,
      note: existing ? existing.note || "" : "",
      gateCode: existing ? existing.gateCode || "" : "",
      what3words: existing ? existing.what3words || "" : "",
    };
    Popup.open(this.pointEditorHtml(), onClosed);
    // A brand-new gate gets its what3words looked up straight away.
    if (isNew && layerKey === "gate") this.lookupPointW3w(true);
  },

  pointEditorHtml() {
    const d = this.pointDraft;
    const isGate = d.layerKey === "gate";
    const farm = this.findFarm(d.farmId);
    const custom = (farm && farm.land && farm.land.customCategories || []).map((c) => ({ key: "custom_" + c.key, label: c.label, singular: c.label.toLowerCase() }));
    const def = [...BUILT_IN_LAYERS, ...custom].find((x) => x.key === d.layerKey) || { singular: "marker", label: "Marker" };
    const esc = escapeHtml;
    let html = Popup.header(`${d.isNew ? "Add" : "Edit"} ${def.singular}`);
    html += `<div style="padding:0 16px 16px;">`;
    html += `<div class="log-row">${Popup.labeled("Description", `<input type="text" placeholder="${isGate ? "e.g. Top gate off the Slad road" : "Description"}" value="${esc(d.note)}" onchange="LandAndFarms.setPointField('note', this.value)" />`)}</div>`;
    if (isGate) {
      html += `<div class="log-row">${Popup.labeled("Gate code", `<input type="text" placeholder="Leave blank if none" value="${esc(d.gateCode)}" onchange="LandAndFarms.setPointField('gateCode', this.value)" />`)}</div>`;
      html += `<div class="log-row">
        ${Popup.labeled("what3words", `<input type="text" id="pointW3wInput" placeholder="///what3words" value="${esc(d.what3words)}" onchange="LandAndFarms.setPointField('what3words', this.value)" />`)}
        <button class="btn small ghost" onclick="LandAndFarms.lookupPointW3w(false)">📍 Look up</button>
      </div>`;
      html += `<p class="hint" style="margin-top:0;">"Look up" fills in the what3words for the spot where this gate was placed on the map.</p>`;
    }
    if (!d.isNew) html += Popup.removeFooter("LandAndFarms.removePointFromEditor()", `Remove ${def.singular}`);
    html += Popup.saveFooter("LandAndFarms.savePoint()");
    html += `</div>`;
    return html;
  },

  setPointField(field, value) {
    if (!this.pointDraft) return;
    this.pointDraft[field] = value;
    Popup.markDirty();
  },

  // Fills the what3words box from the marker's own position. quiet = the
  // automatic lookup on a new gate (only fills an empty box, no error popups).
  async lookupPointW3w(quiet) {
    const d = this.pointDraft;
    if (!d) return;
    const words = await LocationMatch.convertToWhat3Words(d.lat, d.lng);
    if (this.pointDraft !== d) return; // editor closed / replaced while waiting
    if (!words) {
      if (!quiet) alert("Couldn't look up the what3words — check your internet connection and try again, or type it in.");
      return;
    }
    if (quiet && d.what3words) return;
    d.what3words = words;
    const input = document.getElementById("pointW3wInput");
    if (input) input.value = words;
    if (!quiet) Popup.markDirty();
  },

  savePoint() {
    const d = this.pointDraft;
    if (!d) return;
    const farm = this.findFarm(d.farmId);
    if (!farm) return;
    const land = this.ensureLandData(farm);
    const arr = land.layers[d.layerKey];
    const pt = { lat: d.lat, lng: d.lng, note: (d.note || "").trim() };
    if (d.layerKey === "gate") {
      pt.gateCode = (d.gateCode || "").trim();
      pt.what3words = (d.what3words || "").trim();
    }
    if (d.isNew) arr.push(pt);
    else arr[d.idx] = { ...arr[d.idx], ...pt };
    persistData();
    this.pointDraft = null;
    Popup.dirty = false;
    Popup.close();
  },

  removePointFromEditor() {
    const d = this.pointDraft;
    if (!d || d.isNew) return;
    if (!this.deletePoint(d.farmId, d.layerKey, d.idx)) return;
    this.pointDraft = null;
    Popup.dirty = false;
    Popup.close();
  },

  deletePoint(farmId, layerKey, idx) {
    const farm = this.findFarm(farmId);
    if (!farm) return false;
    const land = this.ensureLandData(farm);
    const pt = land.layers[layerKey] && land.layers[layerKey][idx];
    if (!pt) return false;
    if (!confirm("Delete this marker? This can't be undone.")) return false;
    land.layers[layerKey].splice(idx, 1);
    persistData();
    return true;
  },

  // Footpaths are drawn as a line — tap points to trace, tap the first point to finish.
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
    persistData();
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
    persistData();
    this.renderLayerToggles(land);
  },

  teardownMap() {
    if (this.map) { this.map.remove(); this.map = null; }
    this.editGroup = null;
    this.boundaryLayer = null;
    this.fieldLayers = {};
    this.isDrawing = false;
    this._linePoints = []; this._lineDraftMarkers = []; this._lineDraft = null;
  },

  // ← Back: return to the farm's profile page (where the Gates list is).
  requestClose() {
    this.teardownMap();
    if (typeof FarmProfile !== "undefined" && this.currentFarmId) FarmProfile.open(this.currentFarmId);
    else document.getElementById("modalOverlay").classList.add("hidden");
  },

  closeToMenu() {
    this.teardownMap();
    document.getElementById("modalOverlay").classList.add("hidden");
  },
};
