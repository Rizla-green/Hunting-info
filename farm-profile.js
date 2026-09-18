/* =====================================================================
   FARM PROFILE — the full property page from v3.9's "Land and
   Properties": contact details, acres, notes, which species are
   present, and which sections this farm is shared into. The boundary
   +layers map (LandAndFarms module) is reached from here via a button,
   not shown directly — matching the old Property Profile -> Map pattern.
===================================================================== */

const ALL_ANIMAL_TYPES = [
  "Red deer", "Fallow deer", "Roe deer", "Sika deer", "Chinese water deer", "Muntjac",
  "Fox", "Rabbit", "Rat", "Grey Squirrel", "Pigeon", "Crow", "Magpie",
  "Pheasant", "Partridge", "Duck", "Goat", "Boar",
];

const COUNTRIES = ["England", "Wales", "Scotland", "Northern Ireland"];

const FarmProfile = {
  currentFarmId: null,

  ensureProfile(farm) {
    if (!farm.profile) {
      farm.profile = {
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
    return farm.profile;
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

  render() {
    const farm = this.findFarm(this.currentFarmId);
    const profile = this.ensureProfile(farm);
    const overlay = document.getElementById("modalOverlay");

    const speciesTicks = ALL_ANIMAL_TYPES
      .map((a) => `<label class="tick-row"><input type="checkbox" ${profile.species[a] ? "checked" : ""} onchange="FarmProfile.toggleSpecies('${a}', this.checked)" />${a}</label>`)
      .join("");

    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <button class="icon-btn" onclick="openLandAndFarms()">← Back</button>
          <h3>${farm.name}</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
        </div>

        <h4>Details</h4>
        <div class="log-row"><input type="text" placeholder="Address" value="${profile.address}" onchange="FarmProfile.updateField('address', this.value)" /></div>
        <div class="log-row">
          <select onchange="FarmProfile.updateField('country', this.value)">
            ${COUNTRIES.map((c) => `<option ${c === profile.country ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>
        <div class="log-row"><input type="text" placeholder="///what3words" value="${profile.what3words}" onchange="FarmProfile.updateField('what3words', this.value)" /></div>
        <div class="log-row"><input type="text" placeholder="Acres" value="${profile.acres}" onchange="FarmProfile.updateField('acres', this.value)" /></div>
        <div class="log-row"><input type="text" placeholder="Landline" value="${profile.landline}" onchange="FarmProfile.updateField('landline', this.value)" /></div>
        <div class="log-row"><input type="text" placeholder="Mobile" value="${profile.mobile}" onchange="FarmProfile.updateField('mobile', this.value)" /></div>
        <div class="log-row"><input type="text" placeholder="Email" value="${profile.email}" onchange="FarmProfile.updateField('email', this.value)" /></div>

        <h4>Notes</h4>
        <textarea class="farm-notes" placeholder="Notes about this property…" onchange="FarmProfile.updateField('notes', this.value)">${profile.notes}</textarea>

        <h4>Species present</h4>
        <div class="tick-grid">${speciesTicks}</div>

        <button class="btn" style="margin-top:14px;" onclick="FarmProfile.openMap()">Open Land Map</button>
      </div>`;
    overlay.classList.remove("hidden");
  },
};
