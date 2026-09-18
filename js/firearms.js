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
     Clip-on NV (Day optics scopes only).
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
    this.renderDetailBody(name);
  },

  renameName(oldName, newName) {
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    const f = this.getByName(oldName);
    if (!f) return;
    f.name = trimmed;
    this.detailName = trimmed;
    persistData();
    this.renderDetailBody(trimmed);
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
          total += e.lines.reduce((s, l) => s + (parseInt(l.shots, 10) || 0), 0);
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
      total += (day.species || []).reduce((s, l) => s + (parseInt(l.shotsTaken, 10) || 0), 0);
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
    const rows = firearms
      .map((f) => `
      <div class="log-row-card compact-row" onclick="Firearms.openDetail('${f.name.replace(/'/g, "\\'")}')" style="cursor:pointer;">
        <div class="log-row compact-summary">
          <span>${f.name}</span>
          <span>${f.caliber || ""}</span>
          <span>${this.roundCountFor(f.name)} rounds</span>
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
        <div style="margin-top:8px;">${rows || '<p class="hint">No firearms added yet.</p>'}</div>
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

    let html = Popup.header("Firearm Setup");
    html += `<div style="padding:0 16px 16px;">`;
    html += `<div class="log-row">
      <input type="text" placeholder="Name" value="${f.name}" onchange="Firearms.renameName('${name.replace(/'/g, "\\'")}', this.value)" />
    </div>`;
    html += `<div class="log-row"><span class="hint" style="margin:0;">🎯 ${rounds} rounds fired through this firearm (tallied from every section)</span></div>`;
    html += `<div class="log-row">
      <input type="text" placeholder="Caliber" value="${f.caliber || ""}" onchange="Firearms.updateField('${name.replace(/'/g, "\\'")}','caliber',this.value)" />
    </div>`;
    html += `<div class="log-row">
      <input type="text" placeholder="Make and model" value="${f.makeModel || ""}" onchange="Firearms.updateField('${name.replace(/'/g, "\\'")}','makeModel',this.value)" />
    </div>`;
    html += `<div class="log-row">
      <select onchange="Firearms.updateField('${name.replace(/'/g, "\\'")}','type',this.value)">
        <option value="" ${!f.type ? "selected" : ""}>Type…</option>
        ${FIREARM_TYPES.map((t) => `<option ${t === f.type ? "selected" : ""}>${t}</option>`).join("")}
      </select>
    </div>`;
    if (showShotgunSubtype) {
      html += `<div class="log-row">
        <select onchange="Firearms.updateField('${name.replace(/'/g, "\\'")}','shotgunSubtype',this.value)">
          <option value="" ${!f.shotgunSubtype ? "selected" : ""}>Shotgun type…</option>
          ${SHOTGUN_SUBTYPES.map((t) => `<option ${t === f.shotgunSubtype ? "selected" : ""}>${t}</option>`).join("")}
        </select>
      </div>`;
    }
    if (showMagCapacity) {
      html += `<div class="log-row">
        <input type="number" min="1" placeholder="Magazine capacity (shots held)" value="${f.magCapacity || ""}" onchange="Firearms.updateField('${name.replace(/'/g, "\\'")}','magCapacity',this.value)" />
      </div>`;
    }
    if (showScopeType) {
      html += `<div class="log-row">
        <select onchange="Firearms.updateField('${name.replace(/'/g, "\\'")}','scopeType',this.value)">
          <option value="" ${!f.scopeType ? "selected" : ""}>Scope type…</option>
          ${SCOPE_TYPES.map((t) => `<option ${t === f.scopeType ? "selected" : ""}>${t}</option>`).join("")}
        </select>
      </div>`;
    }
    if (showClipOnNV) {
      html += `<div class="log-row">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
          <input type="checkbox" ${f.clipOnNV ? "checked" : ""} onchange="Firearms.updateField('${name.replace(/'/g, "\\'")}','clipOnNV',this.checked)" />
          Clip-on NV
        </label>
      </div>`;
    }
    html += Popup.removeFooter(`Firearms.remove('${name.replace(/'/g, "\\'")}')`, "Remove firearm");
    html += `</div>`;
    return html;
  },
};
