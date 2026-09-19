/* =====================================================================
   PLACES — one shared list of the places you shoot that are NOT properties.
   Built from what's already saved: Game Shooting locations, Clay grounds,
   Zeroing locations, places typed under "Other" on Rabbit / Rats / Winged
   Vermin, plus any added with "+ Add new place". Nothing here ever adds a
   property to Land and Farms — properties stay their own list. A place with
   the same name as a property is left out (the property already covers it).
   The Location boxes in Game Shooting, Rabbit, Rats and Winged Vermin show
   your properties and these saved places together.
===================================================================== */

const Places = {
  saved() {
    const data = window.APP_DATA;
    const farmNames = new Set((data.farms || []).map((f) => String(f.name || "").trim().toLowerCase()));
    const seen = new Set();
    const names = [];
    const add = (n) => {
      const t = String(n === null || n === undefined ? "" : n).trim();
      if (!t) return;
      const k = t.toLowerCase();
      if (seen.has(k) || farmNames.has(k)) return;
      seen.add(k); names.push(t);
    };
    (data.savedPlaces || []).forEach(add);
    (data.gameLocations || []).forEach(add);
    (data.zeroingLocations || []).forEach(add);
    (data.clayGrounds || []).forEach(add);
    ["rabbit", "rats", "winged"].forEach((k) => {
      ((data.species || {})[k] || []).forEach((e) => { if (!e.farmId || e.farmId === "other") add(e.locationText); });
    });
    return names.sort((a, b) => a.localeCompare(b));
  },

  // Adds a new saved place (never a property). Returns the name to use, or null.
  add(name) {
    const t = String(name || "").trim();
    if (!t) return null;
    const existing = this.saved().find((x) => x.toLowerCase() === t.toLowerCase());
    if (existing) return existing;
    if ((window.APP_DATA.farms || []).some((f) => String(f.name || "").trim().toLowerCase() === t.toLowerCase())) return t; // it's a property name already
    window.APP_DATA.savedPlaces = window.APP_DATA.savedPlaces || [];
    window.APP_DATA.savedPlaces.push(t);
    persistData();
    return t;
  },

  // <option>s for a text Location box (Game Shooting): properties, then saved places. The current value is always
  // present so an older entry's location never silently disappears from its box.
  optionsHtml(current) {
    const farms = (window.APP_DATA.farms || []).map((f) => f.name).filter(Boolean);
    const places = this.saved();
    const known = new Set([...farms, ...places]);
    const opt = (n) => `<option value="${escapeHtml(n)}" ${n === current ? "selected" : ""}>${escapeHtml(n)}</option>`;
    let html = "";
    if (current && !known.has(current)) html += opt(current);
    if (farms.length) html += `<optgroup label="My properties">${farms.map(opt).join("")}</optgroup>`;
    if (places.length) html += `<optgroup label="Saved places">${places.map(opt).join("")}</optgroup>`;
    return html;
  },
};
