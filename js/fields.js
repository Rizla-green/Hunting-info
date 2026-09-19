/* =====================================================================
   FIELDS — the named field shapes drawn inside a farm's boundary.

   Data (per farm):  farm.land.fields = [{ id, name, points:[{lat,lng},...] }]
   Entries store the field's hidden id (entry.fieldId), never its name,
   so renaming a field on the map renames it everywhere automatically.

   Field-enabled sections: Deer, Fox, Squirrel, Boar, Goats. (Rabbit,
   Rats, Winged Vermin, Game Shooting, Clay and Zeroing don't use it.)

   What lives here:
   - lookups (list a farm's fields, name for an id, which field holds a point)
   - the labelled "Field" dropdown shared by the Deer and species popups
   - the "By field" totals block used in each farm quick-view popup
   - "Match existing entries to fields" (Options) for entries logged
     before fields existed, or imported from a spreadsheet
===================================================================== */

const FIELD_SECTIONS = ["deer", "fox", "squirrel", "boar", "goats"];
const FIELD_SECTION_LABELS = { deer: "Deer", fox: "Fox", squirrel: "Squirrels", boar: "Boar", goats: "Goats" };

const Fields = {
  // ---------- Lookups ----------
  farmById(farmId) {
    return (window.APP_DATA.farms || []).find((f) => f.id === farmId);
  },

  isRealFarm(farmId) {
    return !!farmId && farmId !== "other" && !!this.farmById(farmId);
  },

  forFarm(farmId) {
    const farm = this.farmById(farmId);
    const list = farm && farm.land && farm.land.fields;
    return Array.isArray(list) ? list : [];
  },

  ensureList(farm) {
    if (!farm.land) farm.land = { boundary: null, layers: {}, customCategories: [] };
    if (!Array.isArray(farm.land.fields)) farm.land.fields = [];
    return farm.land.fields;
  },

  newId() {
    return "field-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  },

  byId(farmId, fieldId) {
    if (!fieldId) return null;
    return this.forFarm(farmId).find((f) => f.id === fieldId) || null;
  },

  nameFor(farmId, fieldId) {
    const f = this.byId(farmId, fieldId);
    return f ? f.name : "";
  },

  // True if another field on this farm already uses the name (case-insensitive).
  nameTaken(farmId, name, exceptId) {
    const n = String(name || "").trim().toLowerCase();
    return this.forFarm(farmId).some((f) => f.id !== exceptId && String(f.name).trim().toLowerCase() === n);
  },

  // Keeps an entry's fieldId only if it still belongs to the farm now chosen.
  validFieldId(farmId, fieldId) {
    return this.byId(farmId, fieldId) ? fieldId : "";
  },

  // ---------- Geometry ----------
  polygonArea(points) {
    let a = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      a += (points[j].lng * points[i].lat) - (points[i].lng * points[j].lat);
    }
    return Math.abs(a / 2);
  },

  // The field (on this farm) containing the point. If shapes overlap, the
  // smaller one wins. Returns null when the point is in no drawn field.
  findForPoint(farmId, lat, lng) {
    if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
    let best = null, bestArea = Infinity;
    this.forFarm(farmId).forEach((f) => {
      if (!f.points || f.points.length < 3) return;
      if (!LocationMatch.pointInPolygon(lat, lng, f.points)) return;
      const area = this.polygonArea(f.points);
      if (area < bestArea) { best = f; bestArea = area; }
    });
    return best;
  },

  // Farm to use when a pin is captured in a popup: the farm chosen on the
  // entry if it's a real one, otherwise the farm the pin itself landed in.
  farmForPin(chosenFarmId, loc) {
    if (this.isRealFarm(chosenFarmId)) return chosenFarmId;
    return loc && this.isRealFarm(loc.farmId) ? loc.farmId : null;
  },

  fieldIdForPin(chosenFarmId, loc) {
    if (!loc) return "";
    const farmId = this.farmForPin(chosenFarmId, loc);
    if (!farmId) return "";
    const f = this.findForPoint(farmId, loc.lat, loc.lng);
    return f ? f.id : "";
  },

  // ---------- The labelled Field dropdown (entry popups) ----------
  // sectionName is the module whose updateDraft() the change goes to
  // ("DeerLog" or "SpeciesLog").
  selectRowHtml(entry, sectionName) {
    const farmId = entry.farmId;
    const fields = this.isRealFarm(farmId) ? this.forFarm(farmId) : [];
    const current = this.validFieldId(farmId, entry.fieldId);
    const select = fields.length
      ? `<select onchange="${sectionName}.updateDraft('fieldId',this.value)">
          <option value="" ${!current ? "selected" : ""}>None</option>
          ${fields.map((f) => `<option value="${f.id}" ${f.id === current ? "selected" : ""}>${escapeHtml(f.name)}</option>`).join("")}
        </select>`
      : `<select disabled><option>${this.isRealFarm(farmId) ? "No fields drawn for this property yet" : "Choose a property first"}</option></select>`;
    return `<div class="log-row">${Popup.labeled("Field", select)}</div>`;
  },

  // Property + Field, both labelled, for the species popups.
  propertyAndFieldHtml(entry, sectionName, otherLabel) {
    const farms = window.APP_DATA.farms || [];
    const property = Popup.labeled("Property", `<select onchange="${sectionName}.updateDraft('farmId',this.value)">
        ${farms.map((f) => `<option value="${f.id}" ${entry.farmId === f.id ? "selected" : ""}>${f.name}</option>`).join("")}
        <option value="other" ${!entry.farmId || entry.farmId === "other" ? "selected" : ""}>${otherLabel || "Other"}</option>
      </select>`);
    return `<div class="log-row">${property}</div>${this.selectRowHtml(entry, sectionName)}`;
  },

  // ---------- Entries that carry a field ----------
  entriesFor(sectionKey) {
    window.APP_DATA.species = window.APP_DATA.species || {};
    return window.APP_DATA.species[sectionKey] || [];
  },

  countLinked(farmId, fieldId) {
    let n = 0;
    FIELD_SECTIONS.forEach((k) => {
      this.entriesFor(k).forEach((e) => { if (e.farmId === farmId && e.fieldId === fieldId) n++; });
    });
    return n;
  },

  clearLinked(farmId, fieldId) {
    FIELD_SECTIONS.forEach((k) => {
      this.entriesFor(k).forEach((e) => { if (e.farmId === farmId && e.fieldId === fieldId) e.fieldId = ""; });
    });
  },

  // ---------- "By field" totals block for a farm quick-view popup ----------
  _ctx: {},
  _ctxSeq: 0,

  // entries: this farm's entries in the section; sectionKey drives the season
  // label; countFn(entry) gives how many that entry counts as. Returns "" if
  // the farm has no fields drawn (nothing to break down).
  byFieldBlockHtml(farmId, entries, sectionKey, countFn) {
    if (!this.forFarm(farmId).length) return "";
    const uid = "bf" + (++this._ctxSeq);
    this._ctx[uid] = { farmId, entries, sectionKey, countFn };
    const years = seasonYearsFor(entries, sectionKey);
    const cur = currentSeasonLabel(sectionKey);
    const options = years.map((y) => `<option value="${y}" ${y === cur ? "selected" : ""}>${y}${y === cur ? " (current)" : ""}</option>`).join("");
    return `
      <div class="section-title" style="margin-top:16px;"><h4>By field</h4></div>
      ${Popup.labeled("Season", `<select onchange="Fields.updateByField('${uid}', this.value)">${options}</select>`, "display:block;")}
      <div id="byField-${uid}">${this.byFieldTableHtml(uid, cur)}</div>`;
  },

  byFieldTableHtml(uid, season) {
    const c = this._ctx[uid];
    if (!c) return "";
    const totals = {};
    this.forFarm(c.farmId).forEach((f) => { totals[f.id] = 0; });
    let none = 0;
    c.entries.forEach((e) => {
      if (seasonLabelFor(e.date, c.sectionKey) !== season) return;
      const n = c.countFn(e);
      if (!n) return;
      if (e.fieldId && totals[e.fieldId] !== undefined) totals[e.fieldId] += n;
      else none += n;
    });
    let grand = none;
    let rows = this.forFarm(c.farmId).map((f) => { grand += totals[f.id]; return `<tr><td>${escapeHtml(f.name)}</td><td><strong>${totals[f.id]}</strong></td></tr>`; }).join("");
    rows += `<tr><td><em>No field</em></td><td><strong>${none}</strong></td></tr>`;
    rows += `<tr style="font-weight:700;"><td>All fields</td><td>${grand}</td></tr>`;
    return `<div class="table-scroll" style="margin-top:8px;"><table class="data-table"><tr><th>Field</th><th>Total</th></tr>${rows}</table></div>`;
  },

  updateByField(uid, season) {
    const el = document.getElementById("byField-" + uid);
    if (el) el.innerHTML = this.byFieldTableHtml(uid, season);
  },

  // ---------- Match existing entries to fields (Options button) ----------
  running: false,
  stopRequested: false,

  cleanWords(raw) {
    const w = String(raw || "").trim().replace(/^\/+/, "").toLowerCase();
    return /^[a-z]+\.[a-z]+\.[a-z]+$/.test(w) ? w : "";
  },

  // Goes through every Deer/Fox/Squirrel/Boar/Goats entry whose Field is
  // blank and whose property has fields drawn. Entries with only what3words
  // text (e.g. imported) get their position looked up first, then saved, so
  // they also start appearing on the shot maps. Never overwrites a field
  // already set. Safe to run again — it resumes where lookups failed.
  async matchExisting(onProgress) {
    if (this.running) return null;
    this.running = true;
    this.stopRequested = false;
    const stats = { checked: 0, matched: 0, noField: 0, noPosition: 0, lookedUp: 0, unreadable: 0, alreadySet: 0, stopped: "" };
    const cache = {};
    const say = (msg) => { if (onProgress) onProgress(msg, stats); };

    try {
      const todo = [];
      FIELD_SECTIONS.forEach((k) => {
        this.entriesFor(k).forEach((e) => {
          if (e.fieldId) { stats.alreadySet++; return; }
          if (!this.isRealFarm(e.farmId) || !this.forFarm(e.farmId).length) return;
          todo.push(e);
        });
      });
      say(`Checking ${todo.length} entr${todo.length === 1 ? "y" : "ies"}…`);

      for (let i = 0; i < todo.length; i++) {
        if (this.stopRequested) { stats.stopped = "stopped"; break; }
        const e = todo[i];
        stats.checked++;
        let unreadable = false; // counted once — not again as "no position"

        if ((e.lat === null || e.lat === undefined || e.lng === null || e.lng === undefined) && e.what3words) {
          const words = this.cleanWords(e.what3words);
          if (!words) {
            stats.unreadable++; unreadable = true;
          } else {
            let res = cache[words];
            if (res === undefined) {
              res = await LocationMatch.convertFromWhat3Words(words);
              stats.lookedUp++;
              if (res && res.fatal) { stats.stopped = res.fatal; break; }
              cache[words] = res;
            }
            if (res && res.lat !== undefined) { e.lat = res.lat; e.lng = res.lng; }
            else { stats.unreadable++; unreadable = true; }
          }
        }

        if (e.lat === null || e.lat === undefined || e.lng === null || e.lng === undefined) {
          if (!unreadable) stats.noPosition++;
        } else {
          const f = this.findForPoint(e.farmId, e.lat, e.lng);
          if (f) { e.fieldId = f.id; stats.matched++; } else stats.noField++;
        }
        if (i % 10 === 0) say(`Checked ${i + 1} of ${todo.length}…`);
      }
      persistData();
    } finally {
      this.running = false;
    }
    return stats;
  },

  summaryText(stats) {
    if (!stats) return "";
    const parts = [
      `Checked ${stats.checked}. Put ${stats.matched} into a field.`,
    ];
    if (stats.noField) parts.push(`${stats.noField} are on a property but outside every field you've drawn.`);
    if (stats.noPosition) parts.push(`${stats.noPosition} have no map position or what3words to go on.`);
    if (stats.unreadable) parts.push(`${stats.unreadable} what3words couldn't be read or looked up.`);
    if (stats.lookedUp) parts.push(`${stats.lookedUp} what3words lookups made.`);
    if (stats.alreadySet) parts.push(`${stats.alreadySet} already had a field and were left alone.`);
    if (stats.stopped === "stopped") parts.push("Stopped — press the button again to carry on.");
    else if (stats.stopped === "offline") parts.push("Stopped because the lookup couldn't connect — check your connection and press the button again to carry on.");
    else if (stats.stopped) parts.push(`Stopped early (${stats.stopped}) — check your what3words key/allowance, then press the button again to carry on.`);
    return parts.join(" ");
  },
};
