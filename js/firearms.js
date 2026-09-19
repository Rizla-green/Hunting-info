/* =====================================================================
   FIREARMS — dedicated menu item managing the shared firearms list.
   Every "Firearm" field elsewhere (Deer, pest logs, Clay Shooting,
   Zeroing, Game Shooting) reads from this same list via Firearms.list()
   (an array of NAME strings, for backward compatibility with every
   dropdown elsewhere) — but each firearm is actually a richer object
   with setup details, editable from its own detail popup here:
     Caliber, Make and model, Type (Centre fire / Rimfire / Shotgun
     [U/O, SBS, Semi-auto, Pump action, FAC shotgun] / Air rifle /
     FAC air rifle), Magazine capacity (Semi-auto/FAC shotgun only),
     Scope type (Day optics / Digital NV / Thermal — not for shotguns),
     Clip-on NV (Day optics scopes only), Moderator (on/off switch, with
     a notes box for the make when on).
   Also tracks a running ROUND COUNT per firearm — tallied live by
   summing the relevant count field on every entry, across every
   section, that has this firearm selected. Not a stored number; it's
   recalculated each time so it's always accurate.
===================================================================== */

const FIREARM_TYPES = ["Centre fire", "Rimfire", "Shotgun", "Air rifle", "FAC air rifle"];
const SHOTGUN_SUBTYPES = ["Under/over (U/O)", "Side by side (SBS)", "Semi-auto", "Pump action", "FAC shotgun"];
const SCOPE_TYPES = ["Day optics", "Digital NV", "Thermal"];
const SCOPE_ELIGIBLE_TYPES = ["Centre fire", "Rimfire", "Air rifle", "FAC air rifle"];
const MAG_CAPACITY_SUBTYPES = ["Semi-auto", "FAC shotgun"];

// What the ⚙ "List columns" cog can show on the main Firearms list (Name always shows).
const FIREARM_LIST_COLUMNS = [
  { key: "caliber",        label: "Caliber" },
  { key: "makeModel",      label: "Make and model" },
  { key: "type",           label: "Type" },
  { key: "shotgunSubtype", label: "Shotgun type" },
  { key: "magCapacity",    label: "Magazine capacity" },
  { key: "scopeType",      label: "Scope type" },
  { key: "clipOnNV",       label: "Clip-on NV" },
  { key: "moderator",      label: "Moderator (Yes/No)" },
  { key: "rounds",         label: "Rounds fired" },
];
const FIREARM_LIST_DEFAULTS = ["caliber", "rounds"];

// Fields whose change alters which other boxes are shown, so the popup redraws.
// Every other field just saves quietly (redrawing would swallow a tap on Save).
const FIREARM_REDRAW_FIELDS = ["type", "shotgunSubtype", "scopeType", "moderator"];

const Firearms = {
  detailName: null, // name of the firearm currently open in the detail popup, or null

  objects() {
    window.APP_DATA.firearms = window.APP_DATA.firearms || [];
    // Migrate any legacy plain-string entries to objects in place.
    window.APP_DATA.firearms = window.APP_DATA.firearms.map((f) => (typeof f === "string" ? { name: f } : f));
    return window.APP_DATA.firearms;
  },

  // Array of NAME strings — every other dropdown in the app reads this, unchanged.
  list() {
    return this.objects().map((f) => f.name);
  },

  getByName(name) {
    return this.objects().find((f) => f.name === name);
  },

  add(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    if (this.list().includes(trimmed)) return;
    this.objects().push({ name: trimmed });
    persistData();
  },

  remove(name) {
    if (!confirm(`Remove "${name}" from your firearms list?`)) return;
    const objs = this.objects();
    const idx = objs.findIndex((f) => f.name === name);
    if (idx > -1) objs.splice(idx, 1);
    persistData();
    this.detailName = null;
    this.render();
  },

  updateField(name, field, value) {
    const f = this.getByName(name);
    if (!f) return;
    f[field] = value;
    // Clear fields that no longer apply when Type/Scope type changes.
    if (field === "type") {
      if (value !== "Shotgun") f.shotgunSubtype = "";
      if (!SCOPE_ELIGIBLE_TYPES.includes(value)) { f.scopeType = ""; f.clipOnNV = false; }
    }
    if (field === "shotgunSubtype" && !MAG_CAPACITY_SUBTYPES.includes(value)) f.magCapacity = "";
    if (field === "scopeType" && value !== "Day optics") f.clipOnNV = false;
    persistData();
    if (FIREARM_REDRAW_FIELDS.includes(field)) this.renderDetailBody(name);
  },

  // Save button — everything already saves as you go, so this just closes the popup.
  saveAndClose() {
    Popup.dirty = false;
    Popup.close();
  },

  // ---------- List columns (⚙) ----------
  listColumns() {
    window.APP_DATA.listColumnPrefs = window.APP_DATA.listColumnPrefs || {};
    return window.APP_DATA.listColumnPrefs.firearms || FIREARM_LIST_DEFAULTS;
  },
  openColumnSettings() {
    const current = this.listColumns();
    const html = `
      ${Popup.header("List columns")}
      <div style="padding:0 16px 16px;">
        <p class="hint" style="margin-top:0;">The firearm's name always shows. Choose what else appears on each line of the list.</p>
        ${FIREARM_LIST_COLUMNS.map((c) => `
          <label style="display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--navy-light);">
            <input type="checkbox" ${current.includes(c.key) ? "checked" : ""} onchange="Firearms.toggleListColumn('${c.key}', this.checked)" />
            ${c.label}
          </label>`).join("")}
      </div>`;
    Popup.open(html, () => this.render());
  },
  toggleListColumn(key, checked) {
    window.APP_DATA.listColumnPrefs = window.APP_DATA.listColumnPrefs || {};
    let cols = window.APP_DATA.listColumnPrefs.firearms || FIREARM_LIST_DEFAULTS;
    cols = checked ? [...new Set([...cols, key])] : cols.filter((c) => c !== key);
    window.APP_DATA.listColumnPrefs.firearms = cols;
    persistData();
  },
  // The text for one column of one firearm's list line ("" = nothing to show).
  columnText(f, key) {
    switch (key) {
      case "caliber": return f.caliber || "";
      case "makeModel": return f.makeModel || "";
      case "type": return f.type || "";
      case "shotgunSubtype": return f.shotgunSubtype || "";
      case "magCapacity": return f.magCapacity ? `Mag ${f.magCapacity}` : "";
      case "scopeType": return f.scopeType || "";
      case "clipOnNV": return f.clipOnNV ? "Clip-on NV" : "";
      case "moderator": return `Moderator: ${f.moderator ? "Yes" : "No"}`;
      case "rounds": return `${this.roundCountFor(f.name)} rounds`;
      default: return "";
    }
  },

  renameName(oldName, newName) {
    const trimmed = (newName || "").trim();
    const f = this.getByName(oldName);
    if (!f) return;
    if (!trimmed || trimmed === oldName) { this.renderDetailBody(oldName); return; }
    if (this.list().includes(trimmed)) {
      alert(`There's already a firearm called "${trimmed}". Pick a different name.`);
      this.renderDetailBody(oldName);
      return;
    }
    f.name = trimmed;
    this.renameOnEntries(oldName, trimmed);
    this.detailName = trimmed;
    persistData();
    this.renderDetailBody(trimmed);
  },

  // Entries store the firearm by name, so a rename has to be carried through
  // every place a firearm can be chosen — otherwise its round count and the
  // dropdown selections would be left pointing at the old name.
  renameOnEntries(oldName, newName) {
    const data = window.APP_DATA;
    Object.keys(data.species || {}).forEach((key) => {
      (data.species[key] || []).forEach((e) => { if (e.firearm === oldName) e.firearm = newName; });
    });
    (data.clay || []).forEach((e) => { if (e.firearm === oldName) e.firearm = newName; });
    (data.gameShooting || []).forEach((d) => { if (d.firearm === oldName) d.firearm = newName; });
    (Array.isArray(data.zeroing) ? data.zeroing : []).forEach((s) => { if (s.rifle === oldName) s.rifle = newName; });
  },

  // Called from the inline "+ Add new firearm…" option in any Firearm
  // dropdown elsewhere in the app — prompts, adds to the shared list,
  // and returns the new name so the calling screen can select it.
  addInline() {
    const name = prompt('New firearm (e.g. ".243 Tikka T3"):');
    if (!name) return null;
    this.add(name.trim());
    return name.trim();
  },

  // ---------- Round count — tally every entry, across every section, using this firearm ----------
  roundCountFor(name) {
    let total = 0;
    const species = window.APP_DATA.species || {};
    Object.keys(species).forEach((key) => {
      (species[key] || []).forEach((e) => {
        if (e.firearm !== name) return;
        if (key === "winged" && Array.isArray(e.lines)) {
          // One "Shots taken (whole day)" figure when entered; otherwise the species amounts, as before.
          total += (e.shotsTaken !== undefined && e.shotsTaken !== null && e.shotsTaken !== "")
            ? (parseInt(e.shotsTaken, 10) || 0)
            : e.lines.reduce((s, l) => s + (parseInt(l.shots, 10) || 0), 0);
        } else if (key === "deer") {
          total += 1; // one Deer entry = one animal, no separate shots-fired figure recorded
        } else {
          total += parseInt(e.shots, 10) || 1;
        }
      });
    });
    (window.APP_DATA.clay || []).forEach((e) => { if (e.firearm === name) total += parseInt(e.clays, 10) || 0; });
    (window.APP_DATA.zeroing || []).forEach((s) => { if (Array.isArray(window.APP_DATA.zeroing) && s.rifle === name) total += parseInt(s.shots, 10) || 0; });
    (window.APP_DATA.gameShooting || []).forEach((day) => {
      if (day.firearm !== name) return;
      total += GameShooting.dayShotsTaken(day);
    });
    return total;
  },

  open() {
    this.detailName = null;
    this.render();
  },

  render() {
    const overlay = document.getElementById("modalOverlay");
    const firearms = this.objects();
    const cols = this.listColumns();
    const rows = firearms
      .map((f) => `
      <div class="log-row-card compact-row" onclick="Firearms.openDetail('${f.name.replace(/'/g, "\\'")}')" style="cursor:pointer;">
        <div class="log-row compact-summary">
          <span>${escapeHtml(f.name)}</span>
          <span>${escapeHtml(FIREARM_LIST_COLUMNS.filter((c) => cols.includes(c.key)).map((c) => this.columnText(f, c.key)).filter(Boolean).join(" · "))}</span>
        </div>
      </div>`)
      .join("");

    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">← Back</button>
          <h3>Firearms</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
        </div>
        <p class="hint">Manage your firearms here once — every Firearm field elsewhere picks from this same list. Tap one for its full setup and round count.</p>
        <button class="btn small" style="display:block; width:100%;" onclick="Firearms.promptAdd()">+ Add firearm</button>
        ${listHeaderHtml("Firearms", firearms.length, "Firearms.openColumnSettings()")}
        <div>${rows || '<p class="hint">No firearms added yet.</p>'}</div>
      </div>`;
    overlay.classList.remove("hidden");
  },

  promptAdd() {
    const name = prompt('Firearm (e.g. ".243 Tikka T3"):');
    if (!name) return;
    this.add(name);
    this.render();
  },

  openDetail(name) {
    this.detailName = name;
    Popup.open(this.renderDetailBodyHtml(name), () => this.render());
  },
  renderDetailBody(name) {
    Popup.setBody(this.renderDetailBodyHtml(name));
  },

  renderDetailBodyHtml(name) {
    const f = this.getByName(name) || { name };
    const showShotgunSubtype = f.type === "Shotgun";
    const showMagCapacity = showShotgunSubtype && MAG_CAPACITY_SUBTYPES.includes(f.shotgunSubtype);
    const showScopeType = SCOPE_ELIGIBLE_TYPES.includes(f.type);
    const showClipOnNV = showScopeType && f.scopeType === "Day optics";
    const rounds = this.roundCountFor(name);
    const q = name.replace(/'/g, "\\'");           // safe inside the onclick/onchange strings below
    const upd = (field, valueJs) => `Firearms.updateField('${q}','${field}',${valueJs})`;

    let html = Popup.header("Firearm Setup");
    html += `<div style="padding:0 16px 16px;">`;
    html += `<div class="log-row">${Popup.labeled("Name", `<input type="text" placeholder="Name" value="${escapeHtml(f.name)}" onchange="Firearms.renameName('${q}', this.value)" />`)}</div>`;
    html += `<div class="log-row"><span class="hint" style="margin:0;">🎯 ${rounds} rounds fired through this firearm (tallied from every section)</span></div>`;
    html += `<div class="log-row">${Popup.labeled("Caliber", `<input type="text" placeholder="Caliber" value="${escapeHtml(f.caliber)}" onchange="${upd("caliber", "this.value")}" />`)}</div>`;
    html += `<div class="log-row">${Popup.labeled("Make and model", `<input type="text" placeholder="Make and model" value="${escapeHtml(f.makeModel)}" onchange="${upd("makeModel", "this.value")}" />`)}</div>`;
    html += `<div class="log-row">${Popup.labeled("Type", `<select onchange="${upd("type", "this.value")}">
        <option value="" ${!f.type ? "selected" : ""}>Type…</option>
        ${FIREARM_TYPES.map((t) => `<option ${t === f.type ? "selected" : ""}>${t}</option>`).join("")}
      </select>`)}</div>`;
    if (showShotgunSubtype) {
      html += `<div class="log-row">${Popup.labeled("Shotgun type", `<select onchange="${upd("shotgunSubtype", "this.value")}">
          <option value="" ${!f.shotgunSubtype ? "selected" : ""}>Shotgun type…</option>
          ${SHOTGUN_SUBTYPES.map((t) => `<option ${t === f.shotgunSubtype ? "selected" : ""}>${t}</option>`).join("")}
        </select>`)}</div>`;
    }
    if (showMagCapacity) {
      html += `<div class="log-row">${Popup.labeled("Magazine capacity (shots held)", `<input type="number" min="1" placeholder="Magazine capacity (shots held)" value="${escapeHtml(f.magCapacity)}" onchange="${upd("magCapacity", "this.value")}" />`)}</div>`;
    }
    if (showScopeType) {
      html += `<div class="log-row">${Popup.labeled("Scope type", `<select onchange="${upd("scopeType", "this.value")}">
          <option value="" ${!f.scopeType ? "selected" : ""}>Scope type…</option>
          ${SCOPE_TYPES.map((t) => `<option ${t === f.scopeType ? "selected" : ""}>${t}</option>`).join("")}
        </select>`)}</div>`;
    }
    if (showClipOnNV) {
      html += `<div class="log-row">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
          <input type="checkbox" ${f.clipOnNV ? "checked" : ""} onchange="${upd("clipOnNV", "this.checked")}" />
          Clip-on NV
        </label>
      </div>`;
    }

    // Moderator — on/off switch; when on, a notes box for the make.
    html += `<div class="section-title" style="margin-top:12px;"><h4>Moderator</h4></div>`;
    html += `<div class="log-row">
      <label class="switch-row">
        <span>Fitted with a moderator</span>
        <span class="switch">
          <input type="checkbox" ${f.moderator ? "checked" : ""} onchange="${upd("moderator", "this.checked")}" />
          <span class="slider"></span>
        </span>
      </label>
    </div>`;
    if (f.moderator) {
      html += `<div class="log-row">${Popup.labeled("Moderator make", `<textarea class="farm-notes" rows="2" placeholder="Make (and model) of the moderator" onchange="${upd("moderatorMake", "this.value")}">${escapeHtml(f.moderatorMake)}</textarea>`, "display:block; width:100%;")}</div>`;
    }

    // Same bottom buttons, same order, as every other popup: Remove above Save.
    html += Popup.removeFooter(`Firearms.remove('${q}')`, "Remove firearm");
    html += Popup.saveFooter("Firearms.saveAndClose()");
    html += `</div>`;
    return html;
  },
};
