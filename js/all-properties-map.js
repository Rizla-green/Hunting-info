/* =====================================================================
   ALL PROPERTIES MAP — every farm's boundary outline(s) on one map,
   reached from the Land and Farms screen. View only (drawing and editing
   stays on each farm's own Land map).
     - each farm gets its own colour and its name written on it
     - tap a farm for its name and an "Open farm" button
     - "Show fields" switch (off by default) draws every farm's named fields
     - "Shot pins" switch (off by default) shows kills across all farms,
       filtered by species and season
     - lists any farms that have no boundary drawn yet
===================================================================== */

const ALL_PROPS_COLORS = ["#e0b84a", "#5fb3e0", "#e08a5f", "#8fce8f", "#c78fe0", "#e05f7a", "#5fe0c8", "#e0d95f"];
const PIN_COLORS = { deer: "#d9534f", fox: "#f0a04b", squirrel: "#b8b8b8", boar: "#8a5a34", goats: "#f4f1e8" };

const AllPropertiesMap = {
  map: null,
  fieldLayer: null,
  pinLayer: null,
  showFields: false,
  showPins: false,
  species: "all",   // "all" or one of FIELD_SECTIONS
  season: "all",

  open() {
    LeafletLoader.ensure(() => this._open());
  },

  _open() {
    const farms = window.APP_DATA.farms || [];
    const overlay = document.getElementById("modalOverlay");
    overlay.innerHTML = `
      <div class="modal-box map-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="AllPropertiesMap.back()">← Back</button>
          <h3>All properties</h3>
          <button class="icon-btn" onclick="AllPropertiesMap.toMenu()">Main Menu</button>
        </div>
        <div id="allPropsMap" class="land-map-container"></div>
        <p class="hint" id="allPropsInfo"></p>
        <div class="log-row"><label class="switch-row"><span>Show fields</span><span class="switch"><input type="checkbox" id="allPropsFieldsSwitch" onchange="AllPropertiesMap.setFields(this.checked)" /><span class="slider"></span></span></label></div>
        <div class="log-row"><label class="switch-row"><span>Shot pins</span><span class="switch"><input type="checkbox" id="allPropsPinsSwitch" onchange="AllPropertiesMap.setPins(this.checked)" /><span class="slider"></span></span></label></div>
        <div id="allPropsPinFilters" class="hidden"></div>
        <p class="hint" id="allPropsPinInfo"></p>
        <p class="hint" id="allPropsNoOutline"></p>
      </div>`;
    overlay.classList.remove("hidden");
    this.showFields = false; this.showPins = false; this.species = "all"; this.season = "all";

    setTimeout(() => {
      this.map = L.map("allPropsMap").setView([54.5, -3], 5);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri", maxZoom: 19 }
      ).addTo(this.map);
      MapTools.attach(this.map);
      this.drawFarms(farms);
    }, 30);
  },

  drawFarms(farms) {
    const all = [];
    const missing = [];
    farms.forEach((farm, i) => {
      const color = ALL_PROPS_COLORS[i % ALL_PROPS_COLORS.length];
      const outlines = LocationMatch.outlinesOf(farm);
      if (!outlines.length) { missing.push(farm.name); return; }
      outlines.forEach((pts) => {
        const poly = L.polygon(pts.map((p) => [p.lat, p.lng]), { color, weight: 3, fillColor: color, fillOpacity: 0.15 }).addTo(this.map);
        poly.bindTooltip(escapeHtml(farm.name), { permanent: true, direction: "center", className: "farm-label" });
        poly.on("click", (ev) => {
          L.popup().setLatLng(ev.latlng).setContent(`<strong>${escapeHtml(farm.name)}</strong><br>
            <button class="btn small ghost" style="margin-top:6px;" onclick="AllPropertiesMap.openFarm('${farm.id}')">Open farm</button>`).openOn(this.map);
        });
        all.push(poly);
      });
    });
    if (all.length) this.map.fitBounds(L.featureGroup(all).getBounds().pad(0.1));
    document.getElementById("allPropsInfo").textContent = all.length
      ? "Tap a farm for its name and to open it."
      : "No farm boundaries have been drawn yet — draw them on each farm's own Land map.";
    document.getElementById("allPropsNoOutline").textContent = missing.length
      ? `${missing.length} farm${missing.length === 1 ? " has" : "s have"} no boundary drawn yet, so ${missing.length === 1 ? "it isn't" : "they aren't"} on this map: ${missing.join(", ")}.`
      : "";
  },

  // ---------- Fields ----------
  setFields(on) {
    this.showFields = on;
    if (this.fieldLayer) { this.map.removeLayer(this.fieldLayer); this.fieldLayer = null; }
    if (!on) return;
    this.fieldLayer = L.layerGroup().addTo(this.map);
    (window.APP_DATA.farms || []).forEach((farm) => {
      Fields.forFarm(farm.id).forEach((f) => {
        if (!f.points || f.points.length < 3) return;
        L.polygon(f.points.map((p) => [p.lat, p.lng]), { color: "#e0b84a", weight: 1.5, fillOpacity: 0.08, interactive: false })
          .bindTooltip(escapeHtml(f.name), { permanent: true, direction: "center", className: "field-label" })
          .addTo(this.fieldLayer);
      });
    });
  },

  // ---------- Shot pins ----------
  setPins(on) {
    this.showPins = on;
    const box = document.getElementById("allPropsPinFilters");
    box.classList.toggle("hidden", !on);
    if (on) this.renderPinFilters();
    this.renderPins();
  },

  sectionsInUse() {
    return this.species === "all" ? FIELD_SECTIONS : [this.species];
  },

  seasonOptions() {
    const labels = new Set();
    this.sectionsInUse().forEach((sec) => Fields.entriesFor(sec).forEach((e) => labels.add(seasonLabelFor(e.date, sec))));
    const dated = [...labels].filter((l) => l !== NO_DATE_LABEL).sort().reverse();
    return labels.has(NO_DATE_LABEL) ? [...dated, NO_DATE_LABEL] : dated;
  },

  renderPinFilters() {
    const opts = this.seasonOptions();
    document.getElementById("allPropsPinFilters").innerHTML = `
      <div class="log-row">
        ${Popup.labeled("Species", `<select onchange="AllPropertiesMap.setSpecies(this.value)">
          <option value="all" ${this.species === "all" ? "selected" : ""}>All species</option>
          ${FIELD_SECTIONS.map((k) => `<option value="${k}" ${this.species === k ? "selected" : ""}>${FIELD_SECTION_LABELS[k]}</option>`).join("")}
        </select>`)}
        ${Popup.labeled("Season", `<select onchange="AllPropertiesMap.setSeason(this.value)">
          <option value="all" ${this.season === "all" ? "selected" : ""}>All seasons</option>
          ${opts.map((o) => `<option value="${o}" ${this.season === o ? "selected" : ""}>${o}</option>`).join("")}
        </select>`)}
      </div>`;
  },

  setSpecies(sp) {
    this.species = sp;
    // A single species starts on its current season; "All species" starts on all seasons.
    const cur = sp === "all" ? "all" : currentSeasonLabel(sp);
    this.season = sp === "all" || this.seasonOptions().includes(cur) ? cur : "all";
    this.renderPinFilters();
    this.renderPins();
  },
  setSeason(s) { this.season = s; this.renderPins(); },

  renderPins() {
    if (this.pinLayer) { this.map.removeLayer(this.pinLayer); this.pinLayer = null; }
    const info = document.getElementById("allPropsPinInfo");
    if (!this.showPins) { info.textContent = ""; return; }
    this.pinLayer = L.layerGroup().addTo(this.map);
    let shown = 0, noPos = 0;
    const farmsSeen = new Set();
    this.sectionsInUse().forEach((sec) => {
      Fields.entriesFor(sec).forEach((e) => {
        if (this.season !== "all" && seasonLabelFor(e.date, sec) !== this.season) return;
        if (e.lat === null || e.lat === undefined || e.lng === null || e.lng === undefined) { noPos++; return; }
        const farm = Fields.farmById(e.farmId);
        const field = Fields.nameFor(e.farmId, e.fieldId);
        const what = sec === "deer" ? (e.species || "Deer") : `${FIELD_SECTION_LABELS[sec]}${e.category ? " — " + e.category : ""}`;
        L.circleMarker([e.lat, e.lng], { radius: 6, color: "#fff", weight: 1.5, fillColor: PIN_COLORS[sec], fillOpacity: 1 })
          .bindPopup(`<strong>${escapeHtml(what)}</strong><br>${displayDate(e.date)}<br>${escapeHtml(farm ? farm.name : "Other")}${field ? " — " + escapeHtml(field) : ""}${e.what3words ? "<br>" + LandAndFarms.w3wLink(e.what3words) : ""}`)
          .addTo(this.pinLayer);
        shown++;
        farmsSeen.add(farm ? farm.id : "other");
      });
    });
    info.textContent = `${shown} pin${shown === 1 ? "" : "s"} across ${farmsSeen.size} propert${farmsSeen.size === 1 ? "y" : "ies"}` +
      (noPos ? ` · ${noPos} entr${noPos === 1 ? "y has" : "ies have"} no map position so can't be shown (Options → Match entries can look positions up from what3words).` : ".");
  },

  // ---------- Leaving ----------
  teardown() {
    if (this.map) { this.map.remove(); this.map = null; }
    this.fieldLayer = null; this.pinLayer = null;
  },
  back() { this.teardown(); openLandAndFarms(); },
  toMenu() { this.teardown(); document.getElementById("modalOverlay").classList.add("hidden"); },
  openFarm(id) { this.teardown(); FarmProfile.open(id); },
};
