// ---------- Menu configuration ----------
// Order matches the confirmed spec: Land and Farms always last, full-width.
const MENU_SECTIONS = [
  { key: "deer",     label: "Deer",           icon: "icons_final/deer.png",   desc: "Cull planning, close seasons, population counts and cull records." },
  { key: "fox",      label: "Fox",            icon: "icons_final/fox.png",    desc: "Locations, tallies and records." },
  { key: "rabbit",   label: "Rabbit",         icon: "icons_final/rabbit.png", desc: "Locations, tallies and records." },
  { key: "rats",     label: "Rats",           icon: "icons_final/rat.png",    desc: "Locations, tallies and records." },
  { key: "squirrel", label: "Squirrels",      icon: "icons_final/squirrel.png", desc: "Locations, tallies and records." },
  { key: "winged",   label: "Winged Vermin",  icon: "icons_final/crow.png",   desc: "Locations, tallies and records." },
  { key: "game",     label: "Game Shooting",  icon: "icons_final/pheasant.png", desc: "Locations, tallies and records." },
  { key: "goats",    label: "Goats",          icon: "icons_final/goat.png",   desc: "Locations, tallies and records." },
  { key: "boar",     label: "Boar",           icon: "icons_final/boar.png",   desc: "Locations, tallies and records." },
  { key: "clay",     label: "Clay Shooting",  icon: "icons_final/clay.png",   desc: "Overall % hit, clays vs hits by ground." },
  { key: "zeroing",  label: "Zeroing",        icon: "icons_final/zero.png",   desc: "Sessions by caliber, with location and weather." },
  { key: "firearms", label: "Firearms",       icon: "icons_final/firearms.png", desc: "Manage your firearms list." },
];

const LAND_AND_FARMS = { key: "land-farms", label: "Land and Farms", icon: "icons_final/farm.png", desc: "Every property/location across the whole site." };
const TRACKING_TILE = { key: "tracking", label: "Tracking", icon: "icons_final/tracking.png", desc: "Footprint, scat and sign guide." };

// Live "X shot (all time)" / "X% hit (all time)" / "X properties" stat per
// tile, matching v3.9's tile-stat behaviour.
function tileStatFor(key) {
  if (key === "deer") {
    const total = (window.APP_DATA.species?.deer || []).length;
    return `${total} shot (all time)`;
  }
  if (SPECIES_SECTIONS[key]) {
    const entries = window.APP_DATA.species?.[key] || [];
    const total = entries.reduce((s, e) => s + (parseInt(e.shots, 10) || 1), 0);
    return `${total} shot (all time)`;
  }
  if (key === "clay") {
    const entries = window.APP_DATA.clay || [];
    const clays = entries.reduce((s, e) => s + (parseInt(e.clays, 10) || 0), 0);
    const hits = entries.reduce((s, e) => s + (parseInt(e.hits, 10) || 0), 0);
    const pct = clays > 0 ? Math.round((hits / clays) * 100) : 0;
    return `${pct}% hit (all time)`;
  }
  if (key === "game") {
    const days = window.APP_DATA.gameShooting || [];
    const total = days.reduce((s, d) => s + (d.species || []).reduce((s2, l) => s2 + (parseInt(l.hits, 10) || 0), 0), 0);
    return `${total} shot (all time)`;
  }
  if (key === "land-farms") {
    return `${(window.APP_DATA.farms || []).length} properties`;
  }
  return "";
}

// ---------- Render menu ----------
function renderMenu() {
  const grid = document.getElementById("menuGrid");
  grid.innerHTML = "";

  MENU_SECTIONS.forEach((section) => {
    grid.appendChild(buildTile(section));
  });

  // Land and Farms: always second-to-last, full-width row
  const farmTile = buildTile(LAND_AND_FARMS);
  farmTile.classList.add("land-farms");
  grid.appendChild(farmTile);

  // Tracking: same full-width treatment, sits below Land and Farms
  const trackingTile = buildTile(TRACKING_TILE);
  trackingTile.classList.add("land-farms");
  grid.appendChild(trackingTile);
}

function buildTile(section) {
  const tile = document.createElement("div");
  tile.className = "menu-tile";
  tile.dataset.section = section.key;
  tile.innerHTML = `
    <img src="${section.icon}" alt="${section.label}" />
    <span>${section.label}</span>
    ${section.desc ? `<span class="tile-desc">${section.desc}</span>` : ""}
    <span class="tile-stat">${tileStatFor(section.key)}</span>
  `;
  tile.addEventListener("click", () => openSection(section.key));
  return tile;
}

function openSection(key) {
  if (key === "land-farms") {
    openLandAndFarms();
    return;
  }
  if (key === "deer") {
    DeerLog.open();
    return;
  }
  if (key === "clay") {
    ClayShooting.open();
    return;
  }
  if (key === "game") {
    GameShooting.open();
    return;
  }
  if (SPECIES_SECTIONS[key]) {
    SpeciesLog.open(key);
    return;
  }
  if (key === "firearms") {
    Firearms.open();
    return;
  }
  if (key === "tracking") {
    Tracking.open();
    return;
  }
  if (key === "zeroing") {
    Zeroing.open();
    return;
  }
  // Placeholder — Cull Plan import is built in the next pass.
  console.log("Opening section:", key);
  alert(`"${labelFor(key)}" screen is built in a later phase — navigation is wired and ready for it.`);
}

// ---------- Land and Farms: farm picker ----------
// TODO: replace window.APP_DATA.farms with the real Firestore-backed list.
window.APP_DATA = window.APP_DATA || { farms: [{ id: "demo-farm", name: "Demo Farm" }] };

function openLandAndFarms() {
  const overlay = document.getElementById("modalOverlay");
  const farms = window.APP_DATA.farms;
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="map-modal-header">
        <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">← Back</button>
        <h3>Land and Farms</h3>
        <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">Main Menu</button>
      </div>
      <input type="text" id="farmSearchInput" placeholder="Search farms…" oninput="filterFarmList(this.value)" style="width:100%; box-sizing:border-box; padding:8px 10px; border-radius:8px; border:1px solid var(--gold-dim); background:var(--navy); color:var(--cream); margin-bottom:10px;" />
      <button class="btn-gold-block" style="margin-bottom:10px;" onclick="addFarm()">+ Add farm</button>
      <button class="btn-gold-block" style="margin-bottom:10px;" onclick="AllPropertiesMap.open()">All properties map</button>
      <div class="farm-list" id="farmListItems">
        ${farms.map((f) => {
          const row = renderLocationRow(f, "FarmProfile.open", `data-name="${f.name.toLowerCase()}"`);
          return row.replace('</div>', `<button class="btn ghost small" onclick="event.stopPropagation(); openSharingModal('${f.id}')">Shared with</button></div>`);
        }).join("")}
      </div>
    </div>`;
  overlay.classList.remove("hidden");
}

function filterFarmList(query) {
  const q = query.trim().toLowerCase();
  document.querySelectorAll("#farmListItems .prop-row").forEach((btn) => {
    btn.style.display = btn.dataset.name.includes(q) ? "" : "none";
  });
}

// "Shared with" — which sections a property shows up under. A button on
// each directory row (not the profile page), matching v3.9.
function openSharingModal(farmId) {
  const farm = (window.APP_DATA.farms || []).find((f) => f.id === farmId);
  if (!farm) return;
  const profile = FarmProfile.ensureProfile(farm);
  const ticks = MENU_SECTIONS
    .map((s) => `<label class="tick-row"><input type="checkbox" ${profile.sharedWith[s.key] ? "checked" : ""} onchange="toggleFarmShare('${farmId}','${s.key}', this.checked)" />${s.label}</label>`)
    .join("");
  ReferenceInfo.showModal("Shared with", `<div class="tick-grid">${ticks}</div>`);
}
function toggleFarmShare(farmId, sectionKey, checked) {
  const farm = (window.APP_DATA.farms || []).find((f) => f.id === farmId);
  FarmProfile.ensureProfile(farm).sharedWith[sectionKey] = checked;
  persistData();
}

// Shared across the app — Land and Farms, and every species log's farm
// dropdown, all read from window.APP_DATA.farms, so a farm added here
// shows up everywhere immediately.
function addFarm() {
  const name = prompt("Farm name:");
  if (!name) return;
  const address = prompt("Address (optional):") || "";
  const postcode = prompt("Postcode (optional):") || "";
  window.APP_DATA.farms.push({
    id: "farm-" + Date.now() + "-" + Math.round(Math.random() * 1000),
    name,
    address,
    postcode,
  });
  // TODO: Firestore write here, then triggerBackup(window.APP_DATA) for Dropbox.
  persistData();
  openLandAndFarms();
}

// ---------- Options menu (•••) ----------
// Reached from a ••• button on the main menu. Holds: Dropbox token entry,
// "Export everything", and per-section export links (built out alongside
// each section as its data shape is finalised).
function openOptions() {
  document.getElementById("menuScreen").classList.add("hidden");
  document.getElementById("optionsScreen").classList.remove("hidden");
  document.getElementById("dropboxTokenInput").value = getDropboxToken();
  refreshDropboxUi();
  document.getElementById("matchFieldsStatus").textContent = "";
}

function closeOptions() {
  document.getElementById("optionsScreen").classList.add("hidden");
  document.getElementById("menuScreen").classList.remove("hidden");
}

// Shows whether Dropbox is connected, when the last backup ran, and which buttons make sense.
function refreshDropboxUi() {
  const info = dropboxStatusInfo();
  const el = document.getElementById("dropboxStatus");
  el.textContent = info.text;
  el.className = "options-status " + (info.ok ? "ok" : "bad");
  const connected = hasDropboxRefreshToken();
  document.getElementById("connectDropboxBtn").textContent = connected ? "Reconnect Dropbox" : "Connect Dropbox";
  document.getElementById("disconnectDropboxBtn").classList.toggle("hidden", !connected);
  document.getElementById("backupNowBtn").classList.toggle("hidden", !hasDropboxBackupConfigured());
}

function saveDropboxToken() {
  const token = document.getElementById("dropboxTokenInput").value;
  setDropboxToken(token);
  refreshDropboxUi();
}

async function handleBackupNow() {
  const el = document.getElementById("dropboxStatus");
  el.className = "options-status";
  el.textContent = "Backing up…";
  const result = await backupToDropbox(window.APP_DATA);
  if (!result.ok) {
    el.textContent = result.reason === "network"
      ? "Couldn't reach Dropbox — check your internet connection and try again."
      : dropboxStatusInfo().text;
    el.className = "options-status bad";
    return;
  }
  refreshDropboxUi();
}

async function handleDisconnectDropbox() {
  if (!confirm("Disconnect Dropbox on this device? Backups will stop until you connect again.")) return;
  await disconnectDropbox();
  refreshDropboxUi();
}

// Options → "Match entries to fields"
async function handleMatchFields() {
  if (Fields.running) return;
  const status = document.getElementById("matchFieldsStatus");
  const runBtn = document.getElementById("matchFieldsBtn");
  const stopBtn = document.getElementById("stopMatchFieldsBtn");
  runBtn.classList.add("hidden");
  stopBtn.classList.remove("hidden");
  status.className = "options-status";
  const stats = await Fields.matchExisting((msg) => { status.textContent = msg; }, (msg) => confirm(msg));
  runBtn.classList.remove("hidden");
  stopBtn.classList.add("hidden");
  status.textContent = Fields.summaryText(stats);
}
function handleStopMatchFields() {
  Fields.stopRequested = true;
}

function handleExportEverything() {
  // TODO: swap this placeholder for the real Firestore-backed data store
  // once the data layer is wired up.
  exportEverything({ note: "placeholder — full dataset wired in once Firestore is connected" });
}

function labelFor(key) {
  const all = [...MENU_SECTIONS, LAND_AND_FARMS, TRACKING_TILE];
  return all.find((s) => s.key === key)?.label ?? key;
}

// ---------- Version display ----------
function renderVersion() {
  document.querySelectorAll(".app-version").forEach((el) => {
    el.textContent = `v${APP_VERSION}`;
  });
}

// ---------- Auth (Firebase) ----------
// Two fixed accounts, set up by Ben directly in the Firebase console:
//   - admin@... → full read/write
//   - viewer@... → read-only, enforced by Firestore security rules
//     (see firestore.rules), not just hidden in the UI
let firebaseApp = null;
let firebaseAuth = null;

function initFirebase() {
  if (!window.firebase) {
    console.warn("Firebase SDK didn't load — check the script tags in index.html.");
    return;
  }
  firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
  firebaseAuth = firebase.auth();
}

function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errorEl = document.getElementById("loginError");
  const submitBtn = event.target.querySelector("button[type=submit]");

  if (!email || !password) {
    errorEl.textContent = "Enter your email and password.";
    return;
  }
  errorEl.textContent = "";
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in…";

  firebaseAuth
    .signInWithEmailAndPassword(email, password)
    .then(() => {
      // onAuthStateChanged (below) handles showing the menu once this resolves.
    })
    .catch((err) => {
      errorEl.textContent = friendlyAuthError(err.code);
      submitBtn.disabled = false;
      submitBtn.textContent = "Log in";
    });
}

function friendlyAuthError(code) {
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/user-not-found":
      return "No account found with that email.";
    case "auth/too-many-requests":
      return "Too many attempts — wait a moment and try again.";
    case "auth/network-request-failed":
      return "No connection — check you're online and try again.";
    default:
      return "Couldn't log in — try again.";
  }
}

// Determines admin vs viewer purely for UI purposes (e.g. hiding edit
// controls for viewer). Real enforcement is Firestore security rules,
// not this check — a viewer account can't write even if the UI let them try.
function isAdminUser(user) {
  return user && user.email === ADMIN_EMAIL;
}

function watchAuthState() {
  firebaseAuth.onAuthStateChanged(async (user) => {
    if (user) {
      window.APP_DATA.currentUser = { email: user.email, isAdmin: isAdminUser(user) };
      document.getElementById("loginScreen").classList.add("hidden");
      // Show the menu shell immediately, then swap in real data once it's
      // loaded — avoids a blank screen while Firestore responds.
      document.getElementById("menuScreen").classList.remove("hidden");
      await loadAppData();
      window.__dataLoaded = true;
      renderMenu();
      maybeRunWeeklyBackup();
    } else {
      window.APP_DATA.currentUser = null;
      document.getElementById("menuScreen").classList.add("hidden");
      document.getElementById("loginScreen").classList.remove("hidden");
    }
  });
}

function logOut() {
  firebaseAuth.signOut();
}

// ---------- Service worker registration ----------
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  }
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  renderMenu();
  renderVersion();
  registerServiceWorker();
  initFirebase();
  initFirestore();
  if (firebaseAuth) watchAuthState();
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document.getElementById("optionsButton").addEventListener("click", openOptions);
  document.getElementById("optionsBack").addEventListener("click", closeOptions);
  document.getElementById("saveDropboxToken").addEventListener("click", saveDropboxToken);
  document.getElementById("connectDropboxBtn").addEventListener("click", startDropboxConnect);
  document.getElementById("disconnectDropboxBtn").addEventListener("click", handleDisconnectDropbox);
  document.getElementById("backupNowBtn").addEventListener("click", handleBackupNow);
  document.getElementById("matchFieldsBtn").addEventListener("click", handleMatchFields);
  document.getElementById("stopMatchFieldsBtn").addEventListener("click", handleStopMatchFields);
  // Coming back from Dropbox's "Allow" screen? Finish the connection and say how it went.
  handleDropboxRedirect().then((message) => { if (message) { alert(message); maybeRunWeeklyBackup(); } });
  document.getElementById("exportEverythingBtn").addEventListener("click", handleExportEverything);
});
