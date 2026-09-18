/* =====================================================================
   SEASON HELPERS — shared by every species Overview screen. Season
   boundaries differ by species: Deer runs 1 Apr–31 Mar, Game Shooting
   runs 1 Sep–21 Feb, everything else is calendar year (1 Jan–31 Dec).
===================================================================== */

const SEASON_TYPE_BY_SECTION = {
  deer: "aprmar",
  game: "sepfeb",
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
  if (type === "sepfeb") {
    // Sep–Dec belongs to the season starting that year; Jan–Aug (including the
    // 1 Jan–21 Feb tail end of the shooting season) belongs to the previous year's season
    return month >= 9 ? `${year}/${String(year + 1).slice(2)}` : `${year - 1}/${String(year).slice(2)}`;
  }
  return String(year);
}

function seasonHintFor(sectionKey) {
  const type = seasonTypeFor(sectionKey);
  if (type === "aprmar") return "Season year runs 1 April – 31 March.";
  if (type === "sepfeb") return "Season year runs 1 September – 21 February.";
  return "Season year runs 1 January – 31 December.";
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

/* =====================================================================
   SHARED UI HELPERS — v3.9 look, reused by every Overview/Locations
   screen (species logs, Deer, Clay Shooting) so they can't drift apart
   from each other again.
===================================================================== */

// Stat-card style all-time/season numbers, matching v3.9's prominent
// number display instead of a plain text line.
function renderStatCards(cards) {
  return `<div class="stat-cards">${cards
    .map((c) => `<div class="stat-card"><div class="num">${c.value}</div><div class="lbl">${c.label}</div></div>`)
    .join("")}</div>`;
}

// Year tabs with "(current)" on whichever season we're actually in —
// v3.9 always marks this explicitly.
function renderYearTabs(years, selectedYear, sectionKey, onclickFn) {
  const cur = currentSeasonLabel(sectionKey);
  return years
    .map((y) => `<button class="tab-btn ${y === selectedYear ? "active" : ""}" onclick="${onclickFn}('${y}')">${y}${y === cur ? " (current)" : ""}</button>`)
    .join("");
}

// Real two-column Category | Total table, matching v3.9's actual
// <table> markup rather than styled flex rows.
function renderCategoryTable(totals, grandTotal, grandLabel, colHeader) {
  const rows = Object.keys(totals)
    .map((c) => `<tr><td>${c}</td><td><strong>${totals[c]}</strong></td></tr>`)
    .join("");
  return `<div class="table-scroll"><table class="data-table">
    <tr><th>${colHeader || "Category"}</th><th>Total</th></tr>
    ${rows}
    <tr style="font-weight:700;"><td>${grandLabel || "All categories"}</td><td>${grandTotal}</td></tr>
  </table></div>`;
}

// Locations list row: letter avatar + name + country, matching v3.9
// (rather than a plain unlabelled button).
function renderLocationRow(farm, onclickFn, extraAttrs) {
  const letter = (farm.name || "?").trim()[0]?.toUpperCase() || "?";
  const country = farm.profile?.country || "";
  return `<div class="prop-row" ${extraAttrs || ""} onclick="${onclickFn}('${farm.id}')">
    <span class="letter-tick">${letter}</span>
    <span class="name">${farm.name}</span>
    <span class="meta">${country}</span>
  </div>`;
}

function renderLocationsListHtml(onclickFn, includeOther) {
  const farms = window.APP_DATA.farms || [];
  const rows = farms.map((f) => renderLocationRow(f, onclickFn)).join("");
  const otherRow = includeOther
    ? `<div class="prop-row" onclick="${onclickFn}('other')"><span class="letter-tick">?</span><span class="name">Other</span><span class="meta">Unmatched location</span></div>`
    : "";
  return `<div class="farm-list">${rows}${otherRow}</div>`;
}
