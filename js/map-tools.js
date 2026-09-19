/* =====================================================================
   MAP TOOLS — shared by every map (Land map, shot maps, All properties).
   - "Place names" and "Roads" switches: free Esri reference layers drawn
     over the satellite picture (town/village/area names; roads and road
     names). Place names start ON, roads OFF. The choice is remembered on
     this device.
   - A search box: type a town, village or postcode and the map jumps there
     and drops a temporary marker. It saves nothing. Uses the free
     OpenStreetMap "Nominatim" search, which limits how often it can be used —
     if it can't answer, the box says so instead of failing silently.
===================================================================== */

const MAP_TOOLS_KEY = "huntingInfo_mapLayers";
const MAP_NAMES_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const MAP_ROADS_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}";

const MapTools = {
  prefs() {
    const defaults = { names: true, roads: false };
    try { return Object.assign(defaults, JSON.parse(localStorage.getItem(MAP_TOOLS_KEY) || "{}")); } catch (err) { return defaults; }
  },
  savePref(key, value) {
    try {
      const p = this.prefs(); p[key] = value;
      localStorage.setItem(MAP_TOOLS_KEY, JSON.stringify(p));
    } catch (err) { /* private mode etc. — the switch still works for this session */ }
  },

  // Adds the two switches and the search box to a Leaflet map.
  attach(map) {
    if (!map || !window.L) return;
    const prefs = this.prefs();
    if (!map.getPane("labelsPane")) {
      const pane = map.createPane("labelsPane");
      pane.style.zIndex = 250;            // above the satellite picture, below shapes and markers
      pane.style.pointerEvents = "none";
    }
    const layers = {
      names: L.tileLayer(MAP_NAMES_URL, { pane: "labelsPane", maxZoom: 19, attribution: "Labels &copy; Esri" }),
      roads: L.tileLayer(MAP_ROADS_URL, { pane: "labelsPane", maxZoom: 19, attribution: "Roads &copy; Esri" }),
    };
    Object.keys(layers).forEach((k) => { if (prefs[k]) layers[k].addTo(map); });

    let marker = null;
    const control = L.control({ position: "topleft" });
    control.onAdd = () => {
      const div = L.DomUtil.create("div", "map-tools");
      div.innerHTML = `
        <div class="map-tools-search">
          <input type="search" placeholder="Search town or postcode" aria-label="Search town or postcode" />
          <button type="button">Go</button>
        </div>
        <div class="map-tools-status"></div>
        <label><input type="checkbox" data-k="names" ${prefs.names ? "checked" : ""} /> Place names</label>
        <label><input type="checkbox" data-k="roads" ${prefs.roads ? "checked" : ""} /> Roads</label>`;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      const input = div.querySelector("input[type=search]");
      const status = div.querySelector(".map-tools-status");
      const go = async () => {
        const q = input.value.trim();
        if (marker) { map.removeLayer(marker); marker = null; }
        if (!q) { status.textContent = ""; return; }
        status.textContent = "Searching…";
        try {
          const res = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(q));
          if (!res.ok) throw new Error("search " + res.status);
          const hits = await res.json();
          if (!hits.length) { status.textContent = `Nothing found for "${q}".`; return; }
          const h = hits[0], lat = parseFloat(h.lat), lon = parseFloat(h.lon);
          if (h.boundingbox && h.boundingbox.length === 4) {
            const [s, n, w, e] = h.boundingbox.map(parseFloat);
            map.fitBounds([[s, w], [n, e]], { maxZoom: 15 });
          } else {
            map.setView([lat, lon], 14);
          }
          marker = L.circleMarker([lat, lon], { radius: 8, color: "#fff", weight: 2, fillColor: "#e05a5a", fillOpacity: 1 })
            .bindTooltip(String(h.display_name || q).split(",").slice(0, 2).join(","), { direction: "top" })
            .addTo(map);
          status.textContent = "Showing: " + String(h.display_name || q).split(",")[0];
        } catch (err) {
          console.warn("Map search failed:", err);
          status.textContent = "Couldn't search right now — check your connection and try again in a moment.";
        }
      };
      div.querySelector("button").addEventListener("click", go);
      input.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") { ev.preventDefault(); go(); } });
      div.querySelectorAll("input[type=checkbox]").forEach((box) => {
        box.addEventListener("change", () => {
          const k = box.dataset.k;
          if (box.checked) layers[k].addTo(map); else map.removeLayer(layers[k]);
          this.savePref(k, box.checked);
        });
      });
      return div;
    };
    control.addTo(map);
    return { layers, control };
  },
};
