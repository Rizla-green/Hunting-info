/* =====================================================================
   CULL PLAN — Excel import (manual entry supported too, elsewhere).
   Matches each imported row to an existing farm by postcode and/or
   address; creates a new farm if no match. Species/sex terminology is
   parsed using the correct term per species (see SPECIES_TERMS in
   deer-log.js) rather than generic buck/doe for everything.

   Expected columns (from the sample export reviewed):
   Farm, Address, Postcode, Date, Time, Weather, Field name, Method, Animal, Count, Notes
   Quota/surveyor fields aren't present in this export type — left blank,
   filled in manually afterwards if needed.
===================================================================== */

const CullPlanImport = {
  pendingRows: [],
  matchedSummary: [],

  openImportScreen() {
    const overlay = document.getElementById("modalOverlay");
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="map-modal-header">
          <h3>Cull Plan — Import</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">✕</button>
        </div>
        <p class="hint">Import an Excel export (Farm, Address, Postcode, Date, Time, Weather, Field name, Method, Animal, Count, Notes). Rows are matched to an existing farm by postcode and/or address — unmatched rows create a new farm.</p>
        <input type="file" accept=".xlsx,.xls" id="cullPlanFileInput" onchange="CullPlanImport.handleFile(this)" />
        <div id="cullPlanImportSummary"></div>
      </div>`;
    overlay.classList.remove("hidden");
  },

  handleFile(inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    if (!window.XLSX) {
      alert("Excel library didn't load — check your connection and try again.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      this.processRows(rows);
    };
    reader.readAsArrayBuffer(file);
  },

  // Matches each row to an existing farm by postcode first, falling back to
  // address if postcode is blank/unmatched; creates a new farm otherwise.
  matchOrCreateFarm(row) {
    const farms = window.APP_DATA.farms || (window.APP_DATA.farms = []);
    const postcode = String(row.Postcode || "").trim().toLowerCase();
    const address = String(row.Address || "").trim().toLowerCase();

    let farm = farms.find((f) => f.postcode && postcode && f.postcode.toLowerCase() === postcode);
    if (!farm && address) {
      farm = farms.find((f) => f.address && f.address.toLowerCase() === address);
    }
    if (!farm) {
      farm = {
        id: "farm-" + Date.now() + "-" + Math.round(Math.random() * 1000),
        name: row.Farm || "Imported farm",
        address: row.Address || "",
        postcode: row.Postcode || "",
      };
      farms.push(farm);
    }
    return farm;
  },

  // Maps an "Animal" cell (e.g. "Roe deer") + a generic count to the
  // correct species term. Sex/age aren't in this export shape, so the
  // count is logged as adult entries of that species until edited further.
  speciesFromAnimalCell(animalCell) {
    const cleaned = String(animalCell || "").trim();
    const match = Object.keys(SPECIES_TERMS).find(
      (s) => s.toLowerCase() === cleaned.toLowerCase()
    );
    return match || cleaned; // unrecognised species names are kept as-is for manual fixup
  },

  processRows(rows) {
    window.APP_DATA.species = window.APP_DATA.species || {};
    window.APP_DATA.species.deer = window.APP_DATA.species.deer || [];
    const deerLog = window.APP_DATA.species.deer;

    let created = 0;
    let matched = 0;
    const farmsSeen = new Set();

    rows.forEach((row) => {
      const farm = this.matchOrCreateFarm(row);
      if (farmsSeen.has(farm.id)) matched++;
      else { farmsSeen.add(farm.id); if (farm.__justCreated) created++; }

      const species = this.speciesFromAnimalCell(row.Animal);
      const terms = SPECIES_TERMS[species];
      const count = parseInt(row.Count, 10) || 1;

      for (let i = 0; i < count; i++) {
        deerLog.push({
          date: this.parseDate(row.Date),
          species: species,
          sex: terms ? terms.male : "", // sex isn't in this export shape — defaults to the species' male term, edit per-entry afterwards
          age: "Adult",
          farmId: farm.id,
          location: row["Field name"] || "",
          what3words: "",
          weight: "",
          tag: "",
          firearm: "",
          condition: "Good",
          recordedBy: "",
          shotBy: "",
          destination: "",
          time: row.Time || "",
          abnormalities: "",
          shotPlacement: "",
          photos: [],
          notes: [row.Weather ? `Weather: ${row.Weather}` : "", row.Method ? `Method: ${row.Method}` : "", row.Notes || ""]
            .filter(Boolean)
            .join(" — "),
        });
      }
    });

    persistData();
    this.renderSummary(rows.length, farmsSeen.size);
  },

  // A blank or unreadable date stays blank (shown as "No date") rather than
  // being replaced with today's date — see parseFlexibleDate in season-utils.js.
  parseDate(value) {
    return parseFlexibleDate(value);
  },

  renderSummary(rowCount, farmCount) {
    const el = document.getElementById("cullPlanImportSummary");
    if (!el) return;
    el.innerHTML = `<p class="hint">Imported ${rowCount} row(s) across ${farmCount} farm(s) into the Deer Cull Record Log. Species not recognised from the standard terms are kept as-is — fix those up in the log directly. Sex defaults to the species' male term since this export doesn't include it — edit per-entry as needed.</p>`;
  },
};
