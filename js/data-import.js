/* =====================================================================
   DATA IMPORT — reachable from Options. Reads an .xlsx spreadsheet for
   any category, lets Ben map his sheet's columns to the app's fields,
   previews the result, then creates entries. Photos embedded directly
   in the sheet (not a separate image folder) are extracted and
   attached to whichever row they sit on — e.g. Fox's right/left photos
   on each fox's own row, and a group photo sitting on the first fox's
   row when several were shot at one location/night.

   Uses SheetJS (already loaded for exports) for the data columns, and
   JSZip (unzips the .xlsx itself) to read the embedded drawing XML and
   pull out which image belongs to which row — .xlsx files are a zip
   of XML under the hood, and cell/row-anchored images are described in
   xl/drawings/drawingN.xml + xl/drawings/_rels/drawingN.xml.rels,
   referencing files in xl/media/.

   FIRST-PASS IMPLEMENTATION: built without a real sample spreadsheet
   to test against, since none was available at build time. The column
   mapping step exists specifically so it can adapt to whatever a real
   sheet looks like, but the image-extraction step in particular should
   be tried on one real file and checked carefully before relying on it
   for a full 600–700 row import.
===================================================================== */

// Per-category field list offered in the column-mapping step.
const IMPORT_FIELD_DEFS = {
  deer: [
    { key: "date", label: "Date" }, { key: "species", label: "Species" }, { key: "sex", label: "Sex" },
    { key: "age", label: "Age" }, { key: "farmName", label: "Property (farm name)" }, { key: "location", label: "Location" },
    { key: "what3words", label: "what3words" }, { key: "coordinates", label: "Coordinates (lat & long together)" }, { key: "latitude", label: "Latitude" }, { key: "longitude", label: "Longitude" }, { key: "time", label: "Time" }, { key: "weight", label: "Weight (kg)" },
    { key: "tag", label: "Tag no." }, { key: "firearm", label: "Firearm" }, { key: "condition", label: "Condition" },
    { key: "abnormalities", label: "Abnormalities" }, { key: "shotPlacement", label: "Shot placement" },
    { key: "shotBy", label: "Shot by" }, { key: "recordedBy", label: "Inspected by" }, { key: "destination", label: "Destination" },
    { key: "notes", label: "Notes" }, { key: "locationNotes", label: "Location notes" },
  ],
  boar: [
    { key: "date", label: "Date" }, { key: "category", label: "Category (Boar/Sow/Piglet)" },
    { key: "farmName", label: "Property (farm name)" }, { key: "location", label: "Location" },
    { key: "what3words", label: "what3words" }, { key: "coordinates", label: "Coordinates (lat & long together)" }, { key: "latitude", label: "Latitude" }, { key: "longitude", label: "Longitude" }, { key: "time", label: "Time" }, { key: "weight", label: "Weight (kg)" },
    { key: "tag", label: "Tag no." }, { key: "firearm", label: "Firearm" }, { key: "condition", label: "Condition" },
    { key: "abnormalities", label: "Abnormalities" }, { key: "shotPlacement", label: "Shot placement" },
    { key: "shotBy", label: "Shot by" }, { key: "recordedBy", label: "Inspected by" }, { key: "destination", label: "Destination" },
    { key: "notes", label: "Notes" }, { key: "locationNotes", label: "Location notes" },
  ],
  goats: [
    { key: "date", label: "Date" }, { key: "category", label: "Category (Billy/Nanny/Kid)" },
    { key: "farmName", label: "Property (farm name)" }, { key: "location", label: "Location" },
    { key: "what3words", label: "what3words" }, { key: "coordinates", label: "Coordinates (lat & long together)" }, { key: "latitude", label: "Latitude" }, { key: "longitude", label: "Longitude" }, { key: "time", label: "Time" }, { key: "weight", label: "Weight (kg)" },
    { key: "tag", label: "Tag no." }, { key: "firearm", label: "Firearm" }, { key: "condition", label: "Condition" },
    { key: "abnormalities", label: "Abnormalities" }, { key: "shotPlacement", label: "Shot placement" },
    { key: "shotBy", label: "Shot by" }, { key: "recordedBy", label: "Inspected by" }, { key: "destination", label: "Destination" },
    { key: "notes", label: "Notes" }, { key: "locationNotes", label: "Location notes" },
  ],
  fox: [
    { key: "date", label: "Date" }, { key: "category", label: "Category (Dog/Vixen/cub)" },
    { key: "farmName", label: "Property (farm name)" }, { key: "area", label: "Area" }, { key: "shots", label: "Shots (count)" },
    { key: "what3words", label: "what3words" }, { key: "coordinates", label: "Coordinates (lat & long together)" }, { key: "latitude", label: "Latitude" }, { key: "longitude", label: "Longitude" }, { key: "firearm", label: "Firearm" },
    { key: "notes", label: "Notes" }, { key: "locationNotes", label: "Location notes" },
  ],
  squirrel: [
    { key: "date", label: "Date" }, { key: "category", label: "Category (Male/Female)" },
    { key: "farmName", label: "Property (farm name)" }, { key: "area", label: "Area" }, { key: "shots", label: "Shots (count)" },
    { key: "what3words", label: "what3words" }, { key: "coordinates", label: "Coordinates (lat & long together)" }, { key: "latitude", label: "Latitude" }, { key: "longitude", label: "Longitude" }, { key: "firearm", label: "Firearm" },
    { key: "notes", label: "Notes" }, { key: "locationNotes", label: "Location notes" },
  ],
  rabbit: [
    { key: "date", label: "Date" }, { key: "shots", label: "Amount" }, { key: "farmName", label: "Farm/location name" },
    { key: "what3words", label: "what3words" }, { key: "coordinates", label: "Coordinates (lat & long together)" }, { key: "latitude", label: "Latitude" }, { key: "longitude", label: "Longitude" }, { key: "firearm", label: "Firearm" },
    { key: "notes", label: "Notes" }, { key: "locationNotes", label: "Location notes" },
  ],
  rats: [
    { key: "date", label: "Date" }, { key: "shots", label: "Amount" }, { key: "farmName", label: "Farm/location name" },
    { key: "what3words", label: "what3words" }, { key: "coordinates", label: "Coordinates (lat & long together)" }, { key: "latitude", label: "Latitude" }, { key: "longitude", label: "Longitude" }, { key: "firearm", label: "Firearm" },
    { key: "notes", label: "Notes" }, { key: "locationNotes", label: "Location notes" },
  ],
  winged: [
    { key: "date", label: "Date" }, { key: "category", label: "Species (Crow/Rook/etc)" }, { key: "shots", label: "Amount" },
    { key: "farmName", label: "Farm/location name" }, { key: "what3words", label: "what3words" }, { key: "coordinates", label: "Coordinates (lat & long together)" }, { key: "latitude", label: "Latitude" }, { key: "longitude", label: "Longitude" }, { key: "firearm", label: "Firearm" },
    { key: "notes", label: "Notes" }, { key: "locationNotes", label: "Location notes" },
  ],
  game: [
    { key: "date", label: "Date" }, { key: "shootName", label: "Shoot name" }, { key: "location", label: "Location" },
    { key: "species", label: "Species" }, { key: "hits", label: "Shot (hits)" }, { key: "shotsTaken", label: "Shots taken" },
    { key: "gunsStanding", label: "Guns standing" }, { key: "firearm", label: "Firearm" },
    { key: "notes", label: "Notes" }, { key: "locationNotes", label: "Location notes" },
  ],
  clay: [
    { key: "date", label: "Date" }, { key: "location", label: "Ground" }, { key: "clays", label: "Clays" }, { key: "hits", label: "Hits" },
    { key: "what3words", label: "what3words" }, { key: "firearm", label: "Firearm" },
    { key: "notes", label: "Notes" }, { key: "locationNotes", label: "Location notes" },
  ],
  zeroing: [
    { key: "date", label: "Date" }, { key: "rifle", label: "Rifle" }, { key: "location", label: "Location" },
    { key: "distance", label: "Distance zeroed (m)" }, { key: "shots", label: "Shots fired" },
    { key: "adjustmentNotes", label: "Adjustment notes" }, { key: "locationNotes", label: "Location notes" },
  ],
};
const IMPORT_CATEGORY_LABELS = {
  deer: "Deer", boar: "Boar", goats: "Goats", fox: "Fox", squirrel: "Squirrel",
  rabbit: "Rabbit", rats: "Rats", winged: "Winged Vermin", game: "Game Shooting",
  clay: "Clay Shooting", zeroing: "Zeroing",
};

const DataImport = {
  category: null,
  headers: [],
  rows: [],           // array of arrays, raw cell values (row 0 = first data row, header row excluded)
  mapping: {},         // { columnIndex: fieldKey }
  rowImages: {},        // { rowIndex(0-based, within data rows): [dataUrl, dataUrl, ...] }
  fileName: "",

  open() {
    this.category = null;
    this.headers = [];
    this.rows = [];
    this.mapping = {};
    this.rowImages = {};
    this.rowSourceIdx = [];
    Popup.open(this.renderCategoryStep());
  },

  renderCategoryStep() {
    let html = Popup.header("Import Data");
    html += `<div style="padding:0 16px 16px;">`;
    html += `<p class="hint" style="margin-top:0;">Pick which category this spreadsheet is for, then choose the file.</p>`;
    html += `<div class="log-row">${Popup.labeled("Category", `<select id="importCategorySelect">
      <option value="">Choose…</option>
      ${Object.keys(IMPORT_CATEGORY_LABELS).map((k) => `<option value="${k}">${IMPORT_CATEGORY_LABELS[k]}</option>`).join("")}
    </select>`)}</div>`;
    html += `<div class="log-row">
      <input type="file" id="importFileInput" accept=".xlsx,.xls" />
    </div>`;
    html += `<button class="btn popup-save-btn" onclick="DataImport.loadFile()">Next — read spreadsheet</button>`;
    html += `</div>`;
    return html;
  },

  async loadFile() {
    const category = document.getElementById("importCategorySelect").value;
    const fileInput = document.getElementById("importFileInput");
    const file = fileInput.files[0];
    if (!category) { alert("Choose a category first."); return; }
    if (!file) { alert("Choose a spreadsheet file first."); return; }
    this.category = category;
    this.fileName = file.name;

    const buffer = await file.arrayBuffer();

    // 1) Data columns, via SheetJS. Cells are read as their real values
    //    (raw), so a date arrives as an Excel date number rather than text in
    //    whichever order (day/month vs month/day) the sheet happened to display.
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
    this.headers = (rows[0] || []).map((h) => String(h ?? "").trim());
    // Empty rows are dropped, but each kept row remembers its real position in
    // the sheet — that position is how embedded photos are matched to rows.
    this.rows = [];
    this.rowSourceIdx = [];
    rows.slice(1).forEach((r, i) => {
      if (r.some((cell) => String(cell ?? "").trim() !== "")) { this.rows.push(r); this.rowSourceIdx.push(i); }
    });

    // 2) Embedded images, via JSZip — best-effort, anchored to a data row by
    //    the drawing's row index (0-based, header row = 0, so data row N is
    //    spreadsheet row N+1 → drawing row index N).
    try {
      this.rowImages = await this.extractRowImages(buffer);
    } catch (err) {
      console.warn("Image extraction failed (continuing without photos):", err);
      this.rowImages = {};
    }

    Popup.setBody(this.renderMappingStep());
  },

  // Unzip the .xlsx (it's a zip of XML under the hood) and read the
  // drawing anchors to work out which embedded image sits on which row.
  async extractRowImages(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const drawingFiles = Object.keys(zip.files).filter((f) => /^xl\/drawings\/drawing\d+\.xml$/.test(f));
    const images = {};
    for (const drawingPath of drawingFiles) {
      const relsPath = drawingPath.replace("drawings/", "drawings/_rels/") + ".rels";
      const relsFile = zip.files[relsPath];
      if (!relsFile) continue;
      const relsXml = await relsFile.async("string");
      const relMap = {}; // rId -> media path
      relsXml.replace(/<Relationship[^>]+Id="([^"]+)"[^>]+Target="\.\.\/media\/([^"]+)"/g, (m, id, target) => {
        relMap[id] = "xl/media/" + target;
        return m;
      });

      const drawingXml = await zip.files[drawingPath].async("string");
      // Each anchor block: <xdr:twoCellAnchor>...<xdr:from><xdr:row>N</xdr:row>...<a:blip r:embed="rIdX"/>...
      const anchorBlocks = drawingXml.split(/<xdr:(?:twoCellAnchor|oneCellAnchor)/).slice(1);
      for (const block of anchorBlocks) {
        const rowMatch = block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
        const ridMatch = block.match(/r:embed="(rId\d+)"/);
        if (!rowMatch || !ridMatch) continue;
        const anchorRow = parseInt(rowMatch[1], 10); // 0-based sheet row; row 0 is the header row
        const dataRowIdx = anchorRow - 1; // convert to 0-based index into this.rows
        const mediaPath = relMap[ridMatch[1]];
        if (!mediaPath || dataRowIdx < 0) continue;
        const mediaFile = zip.files[mediaPath];
        if (!mediaFile) continue;
        const base64 = await mediaFile.async("base64");
        const ext = mediaPath.split(".").pop().toLowerCase();
        const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";
        images[dataRowIdx] = images[dataRowIdx] || [];
        images[dataRowIdx].push(`data:${mime};base64,${base64}`);
      }
    }
    return images;
  },

  renderMappingStep() {
    const fields = IMPORT_FIELD_DEFS[this.category] || [];
    const totalImages = Object.values(this.rowImages).reduce((s, arr) => s + arr.length, 0);
    let html = Popup.header("Import Data — Map columns");
    html += `<div style="padding:0 16px 16px;">`;
    html += `<p class="hint" style="margin-top:0;">${this.fileName} — ${this.rows.length} rows found${totalImages ? `, ${totalImages} embedded photo(s) detected` : ""}. Match each of your sheet's columns to the field it should fill.</p>`;
    this.headers.forEach((h, colIdx) => {
      const current = this.mapping[colIdx] || "";
      html += `<div class="log-row">${Popup.labeled(h || `Column ${colIdx + 1}`, `<select onchange="DataImport.setMapping(${colIdx}, this.value)">
        <option value="">Ignore this column</option>
        ${fields.map((f) => `<option value="${f.key}" ${current === f.key ? "selected" : ""}>${f.label}</option>`).join("")}
      </select>`)}</div>`;
    });
    html += `<button class="btn popup-save-btn" onclick="DataImport.runImport()">Import ${this.rows.length} rows</button>`;
    html += `</div>`;
    return html;
  },

  setMapping(colIdx, fieldKey) {
    if (fieldKey) this.mapping[colIdx] = fieldKey;
    else delete this.mapping[colIdx];
  },

  // The raw text of the mapped cell (or "" if that field isn't matched to a column).
  rawCell(row, fieldKey) {
    const colIdx = Object.keys(this.mapping).find((idx) => this.mapping[idx] === fieldKey);
    if (colIdx === undefined) return "";
    const v = row[colIdx];
    return v === null || v === undefined ? "" : String(v).trim();
  },

  // A time cell can be text ("06:45") or an Excel time (a fraction of a day).
  timeText(v) {
    if (typeof v === "number" && v >= 0) {
      const frac = v - Math.floor(v);
      const mins = Math.round(frac * 24 * 60) % (24 * 60);
      return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    }
    return v === null || v === undefined ? "" : String(v).trim();
  },

  cellFor(row, fieldKey) {
    const colIdx = Object.keys(this.mapping).find((idx) => this.mapping[idx] === fieldKey);
    if (colIdx === undefined) return "";
    const v = row[colIdx];
    if (fieldKey === "notes") {
      // Any number of columns can be matched to Notes (e.g. "Run" and "Range"); they're joined,
      // each labelled with its own heading so nothing is lost.
      const cols = Object.keys(this.mapping).filter((idx) => this.mapping[idx] === "notes");
      const parts = cols.map((idx) => {
        const cell = row[idx];
        const text = cell === null || cell === undefined ? "" : String(cell).trim();
        if (!text) return "";
        const head = (this.headers[idx] || "").trim();
        return cols.length > 1 && head && !/^notes?$/i.test(head) ? `${head}: ${text}` : text;
      }).filter(Boolean);
      return parts.join(" · ");
    }
    if (fieldKey === "date") return parseFlexibleDate(v);   // "" if it can't be read
    if (fieldKey === "time") return this.timeText(v);
    return v === null || v === undefined ? "" : String(v).trim();
  },

  findFarmIdByName(name) {
    if (!name) return "other";
    const farms = window.APP_DATA.farms || [];
    const match = farms.find((f) => f.name.trim().toLowerCase() === name.trim().toLowerCase());
    return match ? match.id : "other";
  },

  // ---------- Translating a sheet's own words into the app's ----------
  normalizeSpecies(text) {
    const raw = String(text || "").trim();
    const key = raw.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
    const map = {
      "red": "Red deer", "red deer": "Red deer", "fallow": "Fallow deer", "fallow deer": "Fallow deer",
      "roe": "Roe deer", "roe deer": "Roe deer", "sika": "Sika deer", "sika deer": "Sika deer",
      "cwd": "Chinese water deer", "chinese water deer": "Chinese water deer", "water deer": "Chinese water deer",
      "muntjac": "Muntjac", "muntjack": "Muntjac", "goat": "Goat", "goats": "Goat",
    };
    return map[key] || raw;
  },
  // M/F/Buck/Stag/etc -> the right word for that species. "" if it isn't recognised (never guessed).
  normalizeSex(species, text) {
    const t = SPECIES_TERMS[species];
    const key = String(text || "").trim().toLowerCase();
    if (!t || !key) return "";
    if (["m", "male", "buck", "stag"].includes(key)) return t.male;
    if (["f", "female", "doe", "hind"].includes(key)) return t.female;
    if (["calf", "fawn", "kid", "young"].includes(key)) return t.young;
    return "";
  },
  goatCategory(text) {
    const key = String(text || "").trim().toLowerCase();
    if (["m", "male", "billy"].includes(key)) return "Billy";
    if (["f", "female", "nanny"].includes(key)) return "Nanny";
    if (["kid", "young"].includes(key)) return "Kid";
    return "";
  },
  // "14.5KG" -> 14.5 ; "N/A" -> blank ; anything else unreadable -> blank with the original returned as a note.
  parseWeight(text) {
    const s = String(text || "").trim();
    if (!s || /^n\/?a$/i.test(s)) return { value: "", note: "" };
    const m = s.match(/^(\d+(?:\.\d+)?)\s*(kg|kgs)?$/i);
    return m ? { value: m[1], note: "" } : { value: "", note: s };
  },

  // The position on one row, from a "Coordinates" cell (both together) or separate
  // Latitude / Longitude cells. state: none | ok | outside (not in the UK) | bad (unreadable).
  coordsFor(row) {
    const combined = this.rawCell(row, "coordinates");
    const la = this.rawCell(row, "latitude"), lo = this.rawCell(row, "longitude");
    let raw = "", res = null;
    if (combined) { raw = combined; res = parseCoordinates(combined); }
    else if (la || lo) { raw = `${la} / ${lo}`; res = parseLatLngPair(la, lo); }
    if (!raw) return { lat: null, lng: null, raw: "", state: "none" };
    if (!res) return { lat: null, lng: null, raw, state: "bad" };
    return { lat: res.lat, lng: res.lng, raw, state: isInUK(res.lat, res.lng) ? "ok" : "outside" };
  },

  // Which box the category needs to be counted in its section's tables.
  countKeyFor(cat) {
    if (cat === "deer" || cat === "game") return { key: "species", label: "species" };
    if (["boar", "goats", "fox", "squirrel", "winged"].includes(cat)) return { key: "category", label: "category" };
    return null;
  },

  runImport() {
    const cat = this.category;
    let created = 0;
    let photosAttached = 0;

    // Rows with a single word in one cell (like the "RED" / "FALLOW" section headings) are not
    // entries — they're skipped and counted. Every other row is kept. Nothing is made up.
    const skip = new Set();
    this.rows.forEach((r, i) => {
      const filled = r.filter((c) => String(c === null || c === undefined ? "" : c).trim() !== "");
      if (filled.length === 1 && typeof filled[0] === "string" && this.rows.length > 1) skip.add(i);
    });
    const live = this.rows.filter((r, i) => !skip.has(i));
    const noDate = live.filter((r) => !this.cellFor(r, "date")).length;
    const ck = this.countKeyFor(cat);
    let noCat = ck ? live.filter((r) => !this.cellFor(r, ck.key)).length : 0;
    let goatRows = 0, noSex = 0;
    const unknownSp = {};
    if (cat === "deer") {
      noCat = 0;
      live.forEach((r) => {
        const raw = this.rawCell(r, "species");
        if (!raw) { noCat++; return; }
        const sp = this.normalizeSpecies(raw);
        if (sp === "Goat") { goatRows++; return; }
        if (!SPECIES_LIST.includes(sp)) { unknownSp[raw] = (unknownSp[raw] || 0) + 1; return; }
        const rawSex = this.rawCell(r, "sex");
        if (!this.normalizeSex(sp, rawSex)) noSex++;
      });
    }
    const unknownList = Object.keys(unknownSp);
    let withPin = 0;
    const badCoords = [], outsideCoords = [];
    live.forEach((r) => {
      const c = this.coordsFor(r);
      if (c.state === "ok" || c.state === "outside") withPin++;
      if (c.state === "bad") badCoords.push(c.raw);
      if (c.state === "outside") outsideCoords.push(c.raw);
    });
    const eg = (list) => list.slice(0, 5).map((x) => `"${x}"`).join(", ") + (list.length > 5 ? ", …" : "");
    if (skip.size || noDate || noCat || goatRows || noSex || unknownList.length || withPin || badCoords.length) {
      const lines = [`About to import ${live.length} rows.`];
      if (skip.size) lines.push(`• ${skip.size} single-word heading row(s) (like a section title) are skipped — they aren't entries.`);
      if (goatRows) lines.push(`• ${goatRows} row(s) say Goat. They'll be added to Goats (M → Billy, F → Nanny; anything else left blank), not Deer.`);
      if (noDate) lines.push(`• ${noDate} have no readable date. They'll show as "No date" and won't count towards any season until you give them one.`);
      if (noCat) lines.push(`• ${noCat} have no ${ck.label}. They'll be kept and listed, but can't be counted in the ${ck.label} tables until you fill that in.`);
      if (unknownList.length) lines.push(`• Species not recognised (kept exactly as typed, not counted until fixed): ${unknownList.join(", ")}.`);
      if (noSex) lines.push(`• ${noSex} deer have no sex the app can read (blank, "N/A", etc.). They're kept but not counted as male or female.`);
      if (withPin) lines.push(`• ${withPin} have coordinates and will get a map pin (and their property/field if they were on Other).`);
      if (badCoords.length) lines.push(`• ${badCoords.length} have coordinates that can't be read (${eg(badCoords)}). They're imported with no pin, and the original text is kept in Notes.`);
      if (outsideCoords.length) lines.push(`• ${outsideCoords.length} coordinates are outside the UK (${eg(outsideCoords)}). They'll still get pins — check they're right (a swapped latitude and longitude puts a pin in the sea).`);
      lines.push("", "Every other row is kept. Continue?");
      if (!confirm(lines.join("\n"))) return;
    }
    let goatsAdded = 0;
    const sectionsBefore = {};
    REHOME_SECTIONS.forEach((k) => { sectionsBefore[k] = (window.APP_DATA.species[k] || []).length; });

    this.rows.forEach((row, rowIdx) => {
      if (skip.has(rowIdx)) return;
      const get = (key) => this.cellFor(row, key);
      const photos = this.rowImages[this.rowSourceIdx ? this.rowSourceIdx[rowIdx] : rowIdx] || [];
      photosAttached += photos.length;

      if (cat === "deer") {
        window.APP_DATA.species = window.APP_DATA.species || {};
      }

      // A date that can't be read is left blank — the original text is kept in Notes so nothing is lost.
      const rawDate = this.rawCell(row, "date");
      const dateNote = rawDate && !get("date") ? `Original date in spreadsheet: ${rawDate}` : "";
      const base = {
        date: get("date"),
        notes: [get("notes"), dateNote].filter(Boolean).join(" — "),
        locationNotes: get("locationNotes"),
        firearm: get("firearm"),
        photos,
      };

      // Weight: "14.5KG" -> 14.5, "N/A" -> blank; text that can't be read is kept in Notes.
      const wt = this.parseWeight(get("weight"));
      if (wt.note) base.notes = [base.notes, `Weight in spreadsheet: ${wt.note}`].filter(Boolean).join(" — ");
      const pin = this.coordsFor(row);
      if (pin.state === "bad") base.notes = [base.notes, `Coordinates in spreadsheet: ${pin.raw}`].filter(Boolean).join(" — ");

      if (cat === "deer" && this.normalizeSpecies(get("species")) === "Goat") {
        // A Goat row in a Deer sheet goes to Goats.
        window.APP_DATA.species.goats = window.APP_DATA.species.goats || [];
        window.APP_DATA.species.goats.push({
          ...base,
          category: this.goatCategory(get("sex")),
          farmId: this.findFarmIdByName(get("farmName")),
          location: get("location"), what3words: get("what3words"), lat: pin.lat, lng: pin.lng, weather: "",
          time: get("time"), weight: wt.value, tag: get("tag"), condition: get("condition"),
          abnormalities: get("abnormalities"), shotPlacement: get("shotPlacement"),
          shotBy: get("shotBy"), recordedBy: get("recordedBy"), destination: get("destination"),
          shots: 1,
        });
        goatsAdded++;
        created++;
      } else if (cat === "deer") {
        window.APP_DATA.species.deer = window.APP_DATA.species.deer || [];
        const sp = this.normalizeSpecies(get("species"));
        window.APP_DATA.species.deer.push({
          ...base,
          species: sp,
          sex: SPECIES_LIST.includes(sp) ? this.normalizeSex(sp, get("sex")) : get("sex"), age: get("age"),
          farmId: this.findFarmIdByName(get("farmName")),
          location: get("location"), what3words: get("what3words"), lat: pin.lat, lng: pin.lng, weather: "",
          time: get("time"), weight: wt.value, tag: get("tag"), condition: get("condition"),
          abnormalities: get("abnormalities"), shotPlacement: get("shotPlacement"),
          shotBy: get("shotBy"), recordedBy: get("recordedBy"), destination: get("destination"),
        });
        created++;
      } else if (cat === "boar" || cat === "goats") {
        window.APP_DATA.species = window.APP_DATA.species || {};
        window.APP_DATA.species[cat] = window.APP_DATA.species[cat] || [];
        window.APP_DATA.species[cat].push({
          ...base,
          category: cat === "goats" && this.goatCategory(get("category")) ? this.goatCategory(get("category")) : get("category"),
          farmId: this.findFarmIdByName(get("farmName")),
          location: get("location"), what3words: get("what3words"), lat: pin.lat, lng: pin.lng, weather: "",
          time: get("time"), weight: wt.value, tag: get("tag"), condition: get("condition"),
          abnormalities: get("abnormalities"), shotPlacement: get("shotPlacement"),
          shotBy: get("shotBy"), recordedBy: get("recordedBy"), destination: get("destination"),
          shots: 1,
        });
        created++;
      } else if (cat === "fox" || cat === "squirrel") {
        window.APP_DATA.species = window.APP_DATA.species || {};
        window.APP_DATA.species[cat] = window.APP_DATA.species[cat] || [];
        window.APP_DATA.species[cat].push({
          ...base,
          category: get("category"),
          farmId: this.findFarmIdByName(get("farmName")),
          area: get("area"), what3words: get("what3words"), lat: pin.lat, lng: pin.lng, weather: "",
          shots: parseInt(get("shots"), 10) || 1, ampm: "",
        });
        created++;
      } else if (cat === "rabbit" || cat === "rats") {
        window.APP_DATA.species = window.APP_DATA.species || {};
        window.APP_DATA.species[cat] = window.APP_DATA.species[cat] || [];
        const farmName = get("farmName");
        const farmId = this.findFarmIdByName(farmName);
        window.APP_DATA.species[cat].push({
          ...base,
          category: SPECIES_SECTIONS[cat].categories[0],
          farmId, locationText: farmId === "other" ? farmName : "",
          what3words: get("what3words"), lat: pin.lat, lng: pin.lng, weather: "",
          shots: parseInt(get("shots"), 10) || 1,
        });
        created++;
      } else if (cat === "winged") {
        window.APP_DATA.species = window.APP_DATA.species || {};
        window.APP_DATA.species.winged = window.APP_DATA.species.winged || [];
        const farmName = get("farmName");
        const farmId = this.findFarmIdByName(farmName);
        window.APP_DATA.species.winged.push({
          ...base,
          farmId, locationText: farmId === "other" ? farmName : "",
          what3words: get("what3words"), lat: pin.lat, lng: pin.lng, weather: "",
          lines: [{ category: get("category"), shots: parseInt(get("shots"), 10) || 1 }],
        });
        created++;
      } else if (cat === "game") {
        window.APP_DATA.gameShooting = window.APP_DATA.gameShooting || [];
        window.APP_DATA.gameShooting.push({
          ...base,
          shootName: get("shootName"), location: get("location"),
          what3words: "", lat: null, lng: null, weather: "",
          gunsStanding: parseInt(get("gunsStanding"), 10) || 1,
          dayTotalShots: 0, dayTotal: [],
          species: [{ species: get("species"), hits: parseInt(get("hits"), 10) || 0, shotsTaken: parseInt(get("shotsTaken"), 10) || 0 }],
        });
        if (get("location")) GameShooting.addLocation(get("location"));
        created++;
      } else if (cat === "clay") {
        window.APP_DATA.clay = window.APP_DATA.clay || [];
        window.APP_DATA.clay.push({
          ...base,
          location: get("location"), clays: parseInt(get("clays"), 10) || 0, hits: parseInt(get("hits"), 10) || 0,
          what3words: get("what3words"), lat: pin.lat, lng: pin.lng,
        });
        if (get("location")) ClayShooting.addGround(get("location"));
        created++;
      } else if (cat === "zeroing") {
        window.APP_DATA.zeroing = Array.isArray(window.APP_DATA.zeroing) ? window.APP_DATA.zeroing : [];
        window.APP_DATA.zeroing.push({
          date: base.date, locationNotes: base.locationNotes, photos: base.photos,
          rifle: get("rifle"), location: get("location"),
          what3words: "", lat: null, lng: null,
          distance: get("distance"), shots: parseInt(get("shots"), 10) || 1,
          adjusted: !!get("adjustmentNotes"), adjustmentNotes: get("adjustmentNotes"),
        });
        if (get("location")) Zeroing.addLocation(get("location"));
        created++;
      }
    });

    // Entries that arrived with coordinates: pick the property (only if it's on Other) and the field.
    let pinned = 0;
    REHOME_SECTIONS.forEach((k) => {
      (window.APP_DATA.species[k] || []).slice(sectionsBefore[k]).forEach((e) => {
        if (e.lat === null || e.lat === undefined) return;
        pinned++;
        const farmId = Fields.propertyForPin(e.farmId, e.lat, e.lng);
        if (farmId) e.farmId = farmId;
        if (FIELD_SECTIONS.includes(k) && Fields.isRealFarm(e.farmId)) {
          const f = Fields.findForPoint(e.farmId, e.lat, e.lng);
          if (f) e.fieldId = f.id;
        }
      });
    });

    persistData();
    Popup.setBody(`
      ${Popup.header("Import complete")}
      <div style="padding:0 16px 16px;">
        <p>Imported <strong>${created}</strong> ${IMPORT_CATEGORY_LABELS[cat]} entries${goatsAdded ? ` (${goatsAdded} of them were goats and went into Goats)` : ""}${photosAttached ? `, with ${photosAttached} photo(s) attached` : ""}.</p>
        ${skip.size ? `<p class="hint">${skip.size} heading row(s) were skipped.</p>` : ""}
        ${pinned ? `<p class="hint">${pinned} entr${pinned === 1 ? "y" : "ies"} got a map pin from their coordinates.</p>` : ""}
        <p class="hint">Photos were matched by which row they sit on in the spreadsheet — spot-check a few entries, especially any with multiple photos, before importing the rest of your data.</p>
        <button class="btn popup-save-btn" onclick="Popup.close()">Done</button>
      </div>`);
  },
};
