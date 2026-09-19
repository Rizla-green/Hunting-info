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

// Oldest date first; entries with no date go last.
function compareByDateOldestFirst(a, b) {
  const da = a.date || "", db = b.date || "";
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da.localeCompare(db);
}

// ---------- Year buttons on lists ----------
// Every list opens on the current season/year; the year buttons at the top (the
// same ones the Overview screens use) switch to another year. The selected
// year is shared with that screen's Overview so the two always agree.
function listEffectiveYear(entries, sectionKey, selected) {
  const years = seasonYearsFor(entries, sectionKey);
  return years.includes(selected) ? selected : currentSeasonLabel(sectionKey);
}
function listInYear(entries, sectionKey, selected) {
  const year = listEffectiveYear(entries, sectionKey, selected);
  return entries.filter((e) => seasonLabelFor(e.date, sectionKey) === year);
}
function listYearTabsHtml(entries, sectionKey, selected, onclickFn) {
  const years = seasonYearsFor(entries, sectionKey);
  const year = listEffectiveYear(entries, sectionKey, selected);
  return `<div class="species-tabs" style="margin-top:10px;">${renderYearTabs(years, year, sectionKey, onclickFn)}</div>`;
}
function listEmptyYearHtml(entries, sectionKey, selected) {
  return `<p class="hint">Nothing logged for ${listEffectiveYear(entries, sectionKey, selected)}. Use the year buttons above to see other years.</p>`;
}

// ---------- Minimised property rows ----------
// In the species lists each property is one row — name, the number for the selected year and a small
// Totals button — and its entries stay hidden until the row is tapped (so a long list of properties is
// a short scroll). Open/closed is remembered while the app is open; everything starts closed.
const PropertyRows = {
  openSet: new Set(),
  isOpen(scope, id) { return this.openSet.has(scope + ":" + id); },
  toggle(scope, id) {
    const k = scope + ":" + id;
    if (this.openSet.has(k)) this.openSet.delete(k); else this.openSet.add(k);
  },
  setAll(scope, ids, open) {
    ids.forEach((id) => { const k = scope + ":" + id; if (open) this.openSet.add(k); else this.openSet.delete(k); });
  },
  // Expand all / Collapse all buttons.
  barHtml(scope, ids, rerenderJs) {
    if (!ids.length) return "";
    const ids_ = JSON.stringify(ids).replace(/"/g, "'");
    return `<div class="prop-bar">
      <button class="btn small ghost" onclick="PropertyRows.setAll('${scope}', ${ids_}, true); ${rerenderJs}">Expand all</button>
      <button class="btn small ghost" onclick="PropertyRows.setAll('${scope}', ${ids_}, false); ${rerenderJs}">Collapse all</button>
    </div>`;
  },
  // One property: its row, and (when open) its entries. A property with nothing in the year is muted and doesn't open.
  blockHtml(scope, id, name, count, rowsHtml, rerenderJs, totalsJs) {
    const empty = count === 0;
    const open = !empty && this.isOpen(scope, id);
    const totals = `<button class="btn small ghost prop-totals" onclick="event.stopPropagation(); ${totalsJs}">Totals</button>`;
    return `<div class="prop-row ${empty ? "empty" : ""} ${open ? "open" : ""}" ${empty ? "" : `onclick="PropertyRows.toggle('${scope}', '${id}'); ${rerenderJs}"`}>
        <span class="prop-arrow">${empty ? "" : open ? "▾" : "▸"}</span>
        <span class="prop-name">${escapeHtml(name)}</span>
        <span class="grouped-count">(${count})</span>
        ${totals}
      </div>${open ? rowsHtml : ""}`;
  },
};

// The heading row above a list: "Title (count)" on the left, a small gold
// gear button on the right that opens that list's column chooser.
function listHeaderHtml(title, count, cogOnclick, cogTitle) {
  const tip = cogTitle || "Choose list columns";
  return `<div class="list-head"><span>${title} (${count})</span><button class="cog-btn" onclick="${cogOnclick}" title="${tip}" aria-label="${tip}">⚙</button></div>`;
}

// Escapes text before it goes into innerHTML (names/descriptions typed by the user).
function escapeHtml(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Entries saved without a date (e.g. imported rows with a blank date cell)
// are kept, shown as "No date", and counted under this label instead of
// being silently given today's date or breaking the totals.
const NO_DATE_LABEL = "No date";
// Dates are saved as ISO text (2026-06-19) so sorting and seasons work, but SHOWN the
// English way: dd-mm-yy (19-06-26).
function formatDate(dateStr, blank) {
  const m = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return blank === undefined ? "" : blank;
  return `${m[3]}-${m[2]}-${m[1].slice(2)}`;
}
function displayDate(dateStr) {
  return dateStr ? formatDate(dateStr, String(dateStr)) : NO_DATE_LABEL;
}

// A plain box you type a date into (dd-mm-yy, dd/mm/yy, dd.mm.yyyy… day first), in place of the
// phone's calendar picker (which follows the phone's own region setting). What's typed is turned
// back into the ISO text the app saves; something unreadable is refused and the old date restored.
const DateInput = {
  // handlerJs is a snippet that receives the ISO date (or "") as `v`, e.g. "SpeciesLog.updateDraft('date', v)"
  html(iso, handlerJs) {
    return `<input type="text" inputmode="numeric" placeholder="dd-mm-yy" value="${formatDate(iso)}" data-prev="${formatDate(iso)}" onchange="DateInput.commit(this, function (v) { ${handlerJs}; })" />`;
  },
  commit(el, callback) {
    const text = el.value.trim();
    if (!text) { callback(""); return; }
    const iso = parseFlexibleDate(text);
    if (!iso) {
      alert("Couldn't read that date. Type it as day-month-year, like 19-06-26.");
      el.value = el.dataset.prev || "";
      return;
    }
    callback(iso);
  },
};

// Turns whatever a spreadsheet cell holds into an ISO "YYYY-MM-DD" string,
// or "" if it can't be read. Handles Excel serial numbers, ISO strings,
// UK-style dd/mm/yyyy (and dd-mm-yy, dd.mm.yyyy), US-style when the day
// part is clearly the second number, and plain text like "19 Sep 2026".
function parseFlexibleDate(value) {
  if (value === null || value === undefined || value === "") return "";
  const pad = (n) => String(n).padStart(2, "0");
  const valid = (y, m, d) => {
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";
    const t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return "";
    return `${y}-${pad(m)}-${pad(d)}`;
  };
  if (value instanceof Date) {
    return isNaN(value) ? "" : valid(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === "number") {
    if (!(value > 1)) return "";
    const p = (typeof XLSX !== "undefined" && XLSX.SSF) ? XLSX.SSF.parse_date_code(value) : null;
    return p ? valid(p.y, p.m, p.d) : "";
  }
  const s = String(value).trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})(?:$|[T\s,])/);
  if (m) {
    let a = +m[1], b = +m[2], y = +m[3];
    if (m[3].length === 2) y += y < 70 ? 2000 : 1900;
    // UK order (day first) unless the second number can only be a day.
    if (b > 12 && a <= 12) return valid(y, a, b);
    return valid(y, b, a);
  }
  const parsed = new Date(s);
  if (!isNaN(parsed)) return valid(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  return "";
}

// Returns a season label like "2026/27" or "2026" for a given ISO date string.
function seasonLabelFor(dateStr, sectionKey) {
  const d = new Date(dateStr);
  if (!dateStr || isNaN(d)) return NO_DATE_LABEL;
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
  const dated = Array.from(labels).filter((l) => l !== NO_DATE_LABEL).sort().reverse();
  return labels.has(NO_DATE_LABEL) ? [...dated, NO_DATE_LABEL] : dated; // "No date" always last
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
