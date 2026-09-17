/* =====================================================================
   SEASON HELPERS — shared by every species Overview screen. Season
   boundaries differ by species: Deer runs 1 Apr–31 Mar, Game Shooting
   runs 1 Sep–31 Aug, everything else is calendar year.
===================================================================== */

const SEASON_TYPE_BY_SECTION = {
  deer: "aprmar",
  game: "sepaug",
  // fox, rabbit, rats, squirrel, winged, goats, boar, clay: calendar (default)
};

function seasonTypeFor(sectionKey) {
  return SEASON_TYPE_BY_SECTION[sectionKey] || "calendar";
}

// Returns a season label like "2026/27" or "2026" for a given ISO date string.
function seasonLabelFor(dateStr, sectionKey) {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  const type = seasonTypeFor(sectionKey);

  if (type === "calendar") return String(year);
  if (type === "aprmar") {
    // Apr–Dec belongs to the season starting that year; Jan–Mar belongs to the previous year's season
    return month >= 4 ? `${year}/${String(year + 1).slice(2)}` : `${year - 1}/${String(year).slice(2)}`;
  }
  if (type === "sepaug") {
    return month >= 9 ? `${year}/${String(year + 1).slice(2)}` : `${year - 1}/${String(year).slice(2)}`;
  }
  return String(year);
}

function currentSeasonLabel(sectionKey) {
  return seasonLabelFor(new Date().toISOString(), sectionKey);
}

// Newest-first list of every season label present in a set of entries,
// always including the current season even if it has no entries yet.
function seasonYearsFor(entries, sectionKey) {
  const labels = new Set(entries.map((e) => seasonLabelFor(e.date, sectionKey)));
  labels.add(currentSeasonLabel(sectionKey));
  return Array.from(labels).sort().reverse();
}
