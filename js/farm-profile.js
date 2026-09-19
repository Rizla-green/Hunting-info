/* =====================================================================
   FARM PROFILE — the full property page from v3.9's "Land and
   Properties": contact details, acres, notes, which species are
   present, and which sections this farm is shared into. The boundary
   +layers map (LandAndFarms module) is reached from here via a button,
   not shown directly — matching the old Property Profile -> Map pattern.
===================================================================== */

const ALL_ANIMAL_TYPES = [
  "Red deer", "Fallow deer", "Roe deer", "Sika deer", "Chinese water deer", "Muntjac",
  "Fox", "Rabbit", "Rat", "Grey Squirrel",
  "Pigeon", "Crow", "Rook", "Jackdaw", "Magpie", "Jay",
  "Pheasant", "French partridge", "English partridge",
  "Duck", "Mallard", "Wigeon", "Teal",
  "Canada goose", "Greylag goose", "Pinkfoot goose", "Egyptian goose",
  "Snipe", "Woodcock",
  "Goat", "Boar",
];

const COUNTRIES = ["England", "Wales", "Scotland", "Northern Ireland"];

const FarmProfile = {
  currentFarmId: null,

  ensureProfile(farm) {
    if (!farm.profile) {
      farm.profile = {
        landOwner: "",
        address: farm.address || "",
        country: "England",
        what3words: "",
        acres: "",
        landline: "",
        mobile: "",
        email: "",
        notes: "",
        species: {},
        sharedWith: {},
      };
    }
    const profile = farm.profile;
    if (profile.landOwner === undefined) profile.landOwner = "";
    if (!profile.species) profile.species = {};
    // "Partridge" became French + English partridge — carry an existing tick across to both.
    if (profile.species["Partridge"] !== undefined) {
      if (profile.species["Partridge"]) {
        if (profile.species["French partridge"] === undefined) profile.species["French partridge"] = true;
        if (profile.species["English partridge"] === undefined) profile.species["English partridge"] = true;
      }
      delete profile.species["Partridge"];
    }
    return profile;
  },

  findFarm(id) {
    return (window.APP_DATA.farms || []).find((f) => f.id === id);
  },

  open(farmId) {
    this.currentFarmId = farmId;
    this.render();
  },

  updateField(field, value) {
    const farm = this.findFarm(this.currentFarmId);
    if (field === "name") {
      // The farm's own name — what it's called everywhere in the app.
      const trimmed = String(value || "").trim();
      if (!trimmed) { alert("A farm needs a name."); this.render(); return; }
      const clash = (window.APP_DATA.farms || []).some((f) => f.id !== farm.id && (f.name || "").trim().toLowerCase() === trimmed.toLowerCase());
      if (clash && !confirm(`Another farm is already called "${trimmed}". Use the same name anyway? (Spreadsheet imports match farms by name.)`)) { this.render(); return; }
      farm.name = trimmed;
      persistData();
      this.render();
      return;
    }
    this.ensureProfile(farm)[field] = value;
    if (field === "address") farm.address = value; // keep top-level address in sync for Cull Plan import matching
    persistData();
  },

  toggleSpecies(animal, checked) {
    const farm = this.findFarm(this.currentFarmId);
    this.ensureProfile(farm).species[animal] = checked;
    persistData();
  },

  toggleShared(sectionKey, checked) {
    const farm = this.findFarm(this.currentFarmId);
    this.ensureProfile(farm).sharedWith[sectionKey] = checked;
    persistData();
  },

  openMap() {
    LandAndFarms.open(this.findFarm(this.currentFarmId));
  },

  // ---------- Gates (dropped on the land map; listed here with their codes) ----------
  addGate() {
    // Opens the map with Gates already selected — tap where the gate is.
    LandAndFarms.open(this.findFarm(this.currentFarmId), { activateLayer: "gate" });
  },
  editGate(idx) {
    LandAndFarms.openPointEditor(this.currentFarmId, "gate", idx, null, () => this.render());
  },
  gatesHtml(farm) {
    const land = LandAndFarms.ensureLandData(farm);
    const gates = land.layers.gate || [];
    const rows = gates
      .map((g, i) => `
      <div class="log-row-card compact-row" style="cursor:default;">
        <div class="log-row" style="align-items:flex-start;">
          <div style="flex:1;">
            <strong>${g.note ? escapeHtml(g.note) : "Gate " + (i + 1)}</strong><br>
            <span class="hint" style="margin:0;">Code: ${g.gateCode ? escapeHtml(g.gateCode) : "none"}</span><br>
            <span class="hint" style="margin:0;">${g.what3words ? LandAndFarms.w3wLink(g.what3words) : "No what3words yet"}</span>
          </div>
          <button class="btn small ghost" onclick="FarmProfile.editGate(${i})">Edit</button>
        </div>
      </div>`)
      .join("");
    return `
      <h4>Gates</h4>
      <button class="btn small" style="display:block; width:100%; margin-bottom:8px;" onclick="FarmProfile.addGate()">+ Add gate</button>
      ${rows || '<p class="hint">No gates yet — tap "+ Add gate", then tap the map where the gate is.</p>'}`;
  },

  render() {
    const farm = this.findFarm(this.currentFarmId);
    const profile = this.ensureProfile(farm);
    const overlay = document.getElementById("modalOverlay");
    const L8 = (label, inner, style) => Popup.labeled(label, inner, style);
    const val = (v) => escapeHtml(v);

    const speciesTicks = ALL_ANIMAL_TYPES
      .map((a) => `<label class="tick-row"><input type="checkbox" ${profile.species[a] ? "checked" : ""} onchange="FarmProfile.toggleSpecies('${a}', this.checked)" />${a}</label>`)
      .join("");

    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="openLandAndFarms()">← Back</button>
          <h3>${escapeHtml(farm.name)}</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
        </div>

        <h4>Details</h4>
        <div class="log-row">${L8("Farm name", `<input type="text" placeholder="What you call this farm" value="${val(farm.name)}" onchange="FarmProfile.updateField('name', this.value)" />`)}</div>
        <div class="log-row">${L8("Name of land owner", `<input type="text" placeholder="Land owner" value="${val(profile.landOwner)}" onchange="FarmProfile.updateField('landOwner', this.value)" />`)}</div>
        <div class="log-row">${L8("Address of farm", `<input type="text" placeholder="Address" value="${val(profile.address)}" onchange="FarmProfile.updateField('address', this.value)" />`)}</div>
        <div class="log-row">${L8("Country", `<select onchange="FarmProfile.updateField('country', this.value)">
            ${COUNTRIES.map((c) => `<option ${c === profile.country ? "selected" : ""}>${c}</option>`).join("")}
          </select>`)}</div>
        <div class="log-row">${L8("what3words (farm)", `<input type="text" placeholder="///what3words" value="${val(profile.what3words)}" onchange="FarmProfile.updateField('what3words', this.value)" />`)}</div>
        <div class="log-row">${L8("Acres", `<input type="text" placeholder="Acres" value="${val(profile.acres)}" onchange="FarmProfile.updateField('acres', this.value)" />`)}</div>
        <div class="log-row">${L8("Landline", `<input type="text" placeholder="Landline" value="${val(profile.landline)}" onchange="FarmProfile.updateField('landline', this.value)" />`)}</div>
        <div class="log-row">${L8("Mobile", `<input type="text" placeholder="Mobile" value="${val(profile.mobile)}" onchange="FarmProfile.updateField('mobile', this.value)" />`)}</div>
        <div class="log-row">${L8("Email", `<input type="text" placeholder="Email" value="${val(profile.email)}" onchange="FarmProfile.updateField('email', this.value)" />`)}</div>

        <h4>Notes</h4>
        ${L8("Notes about this property", `<textarea class="farm-notes" placeholder="Notes about this property…" onchange="FarmProfile.updateField('notes', this.value)">${val(profile.notes)}</textarea>`, "display:block; width:100%;")}

        ${this.gatesHtml(farm)}

        <h4>Land map</h4>
        <p class="hint" style="margin-top:0;">The farm boundary, its fields, gates and other markers.</p>
        <button class="btn small" style="display:block; width:100%;" onclick="FarmProfile.openMap()">Open Land Map</button>

        <h4>Species present</h4>
        <div class="tick-grid">${speciesTicks}</div>
      </div>`;
    overlay.classList.remove("hidden");
  },
};
