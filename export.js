// Export system.
// Two entry points, both reachable from the ••• Options menu:
//   - "Export everything" → one JSON file with the full dataset
//   - Per-section export → JSON or Excel for just that section's data
// Relies on SheetJS (window.XLSX) for Excel output, loaded via CDN in index.html.

function stampedFilename(baseName, extension) {
  const date = new Date().toISOString().slice(0, 10);
  return `${baseName}-v${APP_VERSION}-${date}.${extension}`;
}

function downloadJSON(dataObject, baseName) {
  const payload = JSON.stringify(
    { version: APP_VERSION, exportedAt: new Date().toISOString(), data: dataObject },
    null,
    2
  );
  const blob = new Blob([payload], { type: "application/json" });
  triggerDownload(blob, stampedFilename(baseName, "json"));
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Export everything ----------
// dataStore is the full app data object (properties, all species logs, zeroing, etc.)
// — wired to the real data layer once Firestore is in place.
function exportEverything(dataStore) {
  downloadJSON(dataStore, "hunting-info-full-backup");
}

// ---------- Per-section export ----------
// sectionKey matches MENU_SECTIONS keys (deer, fox, zeroing, etc.)
// sectionData is that section's slice of the data store.
function exportSectionJSON(sectionKey, sectionData) {
  downloadJSON(sectionData, `hunting-info-${sectionKey}`);
}

// rows: array of flat objects, one per log entry — each section builds its
// own rows (field names differ: Deer has cull-record fields, Zeroing has
// caliber/distance/etc.) then hands them to this shared Excel writer.
function exportSectionExcel(sectionKey, rows, sheetName) {
  if (!window.XLSX) {
    alert("Excel export library didn't load — check your connection and try again.");
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || sectionKey);
  XLSX.writeFile(workbook, stampedFilename(`hunting-info-${sectionKey}`, "xlsx"));
}
