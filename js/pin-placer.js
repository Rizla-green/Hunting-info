/* =====================================================================
   PLACE PINS (Options > Place pins on the map)
   For entries that have no map position — e.g. imported from a
   spreadsheet — you drop the pin yourself, using the description you
   wrote. Free: it uses no what3words lookups to find the position.
     1. Pick an entry from the list (filter by species / property).
     2. Tap the spot on the satellite map.
   That saves the position, sets the Property from your farm outlines (only
   if the entry is still on Other) and the Field from your drawn fields, and
   — if the entry has no what3words yet — fills them in using the free
   "position -> words" lookup. Placed pins can be moved (pick again, tap
   again) or cleared.
===================================================================== */

const PIN_SECTION_LABELS = { deer: "Deer", fox: "Fox", squirrel: "Squirrels", boar: "Boar", goats: "Goats", rabbit: "Rabbit", rats: "Rats", winged: "Winged Vermin" };
const PIN_LIST_LIMIT = 60;

const PinPlacer = {
  map: null,
  markers: null,       // pins placed this session
  context: null,       // outlines + labelled fields of the selected entry's farm
  section: "all",
  farm: "all",
  selected: null,      // {section, e}
  placed: [],          // [{section, e}] placed this session (can be moved/cleared)

  hasPos(e) { return e.lat !== null && e.lat !== undefined && e.lng !== null && e.lng !== undefined; },

  open() {
    LeafletLoader.ensure(() => this._open());
  },

  _open() {
    const overlay = document.getElementById("modalOverlay");
    overlay.innerHTML = `
      <div class="modal-box map-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="PinPlacer.back()">← Back</button>
          <h3>Place pins</h3>
          <button class="icon-btn" onclick="PinPlacer.toMenu()">Main Menu</button>
        </div>
        <div id="pinPlacerMap" class="land-map-container"></div>
        <p class="hint" id="pinPlacerInfo"></p>
        <div id="pinPlacerFilters"></div>
        <div id="pinPlacerList"></div>
      </div>`;
    overlay.classList.remove("hidden");
    this.section = "all"; this.farm = "all"; this.selected = null; this.placed = [];
    setTimeout(() => {
      this.map = L.map("pinPlacerMap").setView([54.5, -3], 5);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri", maxZoom: 19 }
      ).addTo(this.map);
      MapTools.attach(this.map);
      this.markers = L.layerGroup().addTo(this.map);
      this.context = L.layerGroup().addTo(this.map);
      this.map.on("click", (ev) => this.onMapClick(ev));
      this.renderFilters();
      this.renderList();
      this.say("Choose an entry from the list, then tap the map where it was shot.");
    }, 30);
  },

  say(text) {
    const el = document.getElementById("pinPlacerInfo");
    if (el) el.textContent = text;
  },

  // ---------- Which entries ----------
  candidates() {
    const out = [];
    REHOME_SECTIONS.forEach((sec) => {
      if (this.section !== "all" && this.section !== sec) return;
      Fields.entriesFor(sec).forEach((e) => {
        if (this.hasPos(e)) return;
        const farmKey = e.farmId && Fields.farmById(e.farmId) ? e.farmId : "other";
        if (this.farm !== "all" && this.farm !== farmKey) return;
        out.push({ section: sec, e });
      });
    });
    out.sort((a, b) => compareByDateOldestFirst(a.e, b.e));
    return out;
  },

  describe(item) {
    const { section, e } = item;
    const what = section === "deer" ? `${e.species || "Deer"}${e.sex ? " " + e.sex : ""}` : `${PIN_SECTION_LABELS[section]}${e.category ? " — " + e.category : ""}`;
    const farm = Fields.farmById(e.farmId);
    const where = e.location || e.area || e.locationNotes || "";
    return { what, farmName: farm ? farm.name : "Other", where };
  },

  renderFilters() {
    const farms = window.APP_DATA.farms || [];
    document.getElementById("pinPlacerFilters").innerHTML = `
      <div class="log-row">
        ${Popup.labeled("Species", `<select onchange="PinPlacer.setSection(this.value)">
          <option value="all" ${this.section === "all" ? "selected" : ""}>All species</option>
          ${REHOME_SECTIONS.map((k) => `<option value="${k}" ${this.section === k ? "selected" : ""}>${PIN_SECTION_LABELS[k]}</option>`).join("")}
        </select>`)}
        ${Popup.labeled("Property", `<select onchange="PinPlacer.setFarm(this.value)">
          <option value="all" ${this.farm === "all" ? "selected" : ""}>All properties</option>
          ${farms.map((f) => `<option value="${f.id}" ${this.farm === f.id ? "selected" : ""}>${escapeHtml(f.name)}</option>`).join("")}
          <option value="other" ${this.farm === "other" ? "selected" : ""}>Other</option>
        </select>`)}
      </div>`;
  },
  setSection(v) { this.section = v; this.selected = null; this.renderList(); },
  setFarm(v) { this.farm = v; this.selected = null; this.renderList(); },

  renderList() {
    const items = this.candidates();
    this.items = items;
    const isSel = (it) => this.selected && this.selected.e === it.e;
    const row = (it, i, placed) => {
      const d = this.describe(it);
      return `<div class="log-row-card compact-row pin-row ${isSel(it) ? "pin-selected" : ""}" onclick="PinPlacer.select(${placed ? "'p'" : "'c'"}, ${i})" style="cursor:pointer;">
        <div class="log-row compact-summary">
          <span>${displayDate(it.e.date)}</span>
          <span>${escapeHtml(d.what)} · ${escapeHtml(d.farmName)}${d.where ? " · " + escapeHtml(d.where) : ""}</span>
          ${placed ? `<button class="btn small ghost" onclick="event.stopPropagation(); PinPlacer.clear(${i})">Clear</button>` : ""}
        </div>
      </div>`;
    };
    const shown = items.slice(0, PIN_LIST_LIMIT);
    let html = `<div class="section-title" style="margin-top:14px;"><h4>To place (${items.length})</h4></div>`;
    html += items.length ? shown.map((it, i) => row(it, i, false)).join("") : `<p class="hint">Nothing left to place${this.section !== "all" || this.farm !== "all" ? " for these filters" : ""} — every entry has a map position.</p>`;
    if (items.length > shown.length) html += `<p class="hint">Showing the first ${PIN_LIST_LIMIT}. Use the filters above to narrow the list.</p>`;
    if (this.placed.length) {
      html += `<div class="section-title" style="margin-top:14px;"><h4>Placed this time (${this.placed.length})</h4></div>`;
      html += this.placed.map((it, i) => row(it, i, true)).join("");
    }
    document.getElementById("pinPlacerList").innerHTML = html;
  },

  // ---------- Choosing an entry ----------
  select(which, i) {
    const item = which === "p" ? this.placed[i] : this.items[i];
    if (!item) return;
    this.selected = item;
    const d = this.describe(item);
    this.say(`Placing: ${displayDate(item.e.date)} — ${d.what}${d.where ? " — " + d.where : ""}. Tap the map where it was shot.`);
    this.showContext(item.e.farmId);
    this.renderList();
  },

  // Outlines and labelled fields of the selected entry's farm, so the description can be matched to the land.
  showContext(farmId) {
    this.context.clearLayers();
    if (!Fields.isRealFarm(farmId)) return;
    const farm = Fields.farmById(farmId);
    const shapes = [];
    LocationMatch.outlinesOf(farm).forEach((pts) => {
      shapes.push(L.polygon(pts.map((p) => [p.lat, p.lng]), { color: "#f4f1e8", weight: 2, dashArray: "8 6", fill: false, interactive: false }).addTo(this.context));
    });
    Fields.forFarm(farmId).forEach((f) => {
      if (!f.points || f.points.length < 3) return;
      shapes.push(L.polygon(f.points.map((p) => [p.lat, p.lng]), { color: "#e0b84a", weight: 1.5, fillOpacity: 0.08, interactive: false })
        .bindTooltip(escapeHtml(f.name), { permanent: true, direction: "center", className: "field-label" }).addTo(this.context));
    });
    if (shapes.length) this.map.fitBounds(L.featureGroup(shapes).getBounds().pad(0.15));
  },

  // ---------- Dropping the pin ----------
  onMapClick(ev) {
    const item = this.selected;
    if (!item) { this.say("Choose an entry from the list first, then tap the map."); return; }
    const e = item.e;
    e.lat = ev.latlng.lat; e.lng = ev.latlng.lng;
    // Property: only replaces "Other" — a farm already chosen is never changed.
    const farmId = Fields.propertyForPin(e.farmId, e.lat, e.lng);
    if (farmId) e.farmId = farmId;
    // Field: from the drawn fields of the entry's (real) farm.
    if (FIELD_SECTIONS.includes(item.section) && Fields.isRealFarm(e.farmId)) {
      const f = Fields.findForPoint(e.farmId, e.lat, e.lng);
      if (f) e.fieldId = f.id;
    }
    persistData();
    if (!this.placed.includes(item)) this.placed.push(item);
    this.drawMarker(item);
    const d = this.describe(item);
    this.say(`Pin saved for ${displayDate(e.date)} — ${d.what}${farmId ? ` (Property set to ${d.farmName})` : ""}. Choose the next entry.`);
    this.selected = null;
    this.renderList();
    // Fill in the what3words for the spot (free lookup) — only if the entry has none.
    if (!e.what3words) {
      LocationMatch.convertToWhat3Words(e.lat, e.lng).then((words) => {
        if (words && !e.what3words && e.lat === ev.latlng.lat) { e.what3words = words; persistData(); }
      });
    }
  },

  drawMarker(item) {
    if (item.marker) this.markers.removeLayer(item.marker);
    const e = item.e;
    item.marker = L.circleMarker([e.lat, e.lng], { radius: 7, color: "#fff", weight: 2, fillColor: PIN_COLORS[item.section] || "#e0b84a", fillOpacity: 1 })
      .bindTooltip(escapeHtml(this.describe(item).what), { direction: "top" }).addTo(this.markers);
  },

  // Removes the position again (the entry goes back to "To place").
  clear(i) {
    const item = this.placed[i];
    if (!item) return;
    item.e.lat = null; item.e.lng = null;
    if (item.marker) { this.markers.removeLayer(item.marker); item.marker = null; }
    this.placed.splice(i, 1);
    if (this.selected === item) this.selected = null;
    persistData();
    this.say("Pin cleared — that entry is back in the list.");
    this.renderList();
  },

  // ---------- Leaving ----------
  teardown() {
    if (this.map) { this.map.remove(); this.map = null; }
    this.markers = null; this.context = null; this.selected = null;
  },
  back() { this.teardown(); document.getElementById("modalOverlay").classList.add("hidden"); },   // the Options screen is still underneath
  toMenu() { this.back(); if (typeof closeOptions === "function") closeOptions(); },
};
