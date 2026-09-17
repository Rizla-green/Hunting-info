// ---------- Menu configuration ----------
// Order matches the confirmed spec: Land and Farms always last, full-width.
const MENU_SECTIONS = [
  { key: "deer",     label: "Deer",           icon: "icons_final/deer.png" },
  { key: "fox",      label: "Fox",            icon: "icons_final/fox.png" },
  { key: "rabbit",   label: "Rabbit",         icon: "icons_final/rabbit.png" },
  { key: "rats",     label: "Rats",           icon: "icons_final/rat.png" },
  { key: "squirrel", label: "Squirrels",      icon: "icons_final/squirrel.png" },
  { key: "winged",   label: "Winged Vermin",  icon: "icons_final/crow.png" },
  { key: "game",     label: "Game Shooting",  icon: "icons_final/pheasant.png" },
  { key: "goats",    label: "Goats",          icon: "icons_final/goat.png" },
  { key: "boar",     label: "Boar",           icon: "icons_final/boar.png" },
  { key: "clay",     label: "Clay Shooting",  icon: "icons_final/clay.png" },
  { key: "zeroing",  label: "Zeroing",        icon: "icons_final/zero.png" },
  { key: "firearms", label: "Firearms",       icon: "icons_final/firearms.png" },
];

const LAND_AND_FARMS = { key: "land-farms", label: "Land and Farms", icon: "icons_final/farm.png" };
const TRACKING_TILE = { key: "tracking", label: "Tracking", icon: "icons_final/tracking.png" };

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
    Zeroing.openCaliberList();
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
        <h3>Land and Farms</h3>
        <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">✕</button>
      </div>
      <input type="text" id="farmSearchInput" placeholder="Search farms…" oninput="filterFarmList(this.value)" style="width:100%; box-sizing:border-box; padding:8px 10px; border-radius:8px; border:1px solid var(--gold-dim); background:var(--navy); color:var(--cream); margin-bottom:10px;" />
      <div class="farm-list" id="farmListItems">
        ${farms.map((f) => `<button class="btn secondary farm-list-item" data-name="${f.name.toLowerCase()}" onclick="FarmProfile.open('${f.id}')">${f.name}</button>`).join("")}
      </div>
      <button class="btn small" style="margin-top:12px;" onclick="addFarm()">+ Add farm</button>
    </div>`;
  overlay.classList.remove("hidden");
}

function filterFarmList(query) {
  const q = query.trim().toLowerCase();
  document.querySelectorAll(".farm-list-item").forEach((btn) => {
    btn.style.display = btn.dataset.name.includes(q) ? "" : "none";
  });
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
  triggerBackup?.(window.APP_DATA);
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
}

function closeOptions() {
  document.getElementById("optionsScreen").classList.add("hidden");
  document.getElementById("menuScreen").classList.remove("hidden");
}

function saveDropboxToken() {
  const token = document.getElementById("dropboxTokenInput").value;
  setDropboxToken(token);
  document.getElementById("dropboxStatus").textContent = token.trim()
    ? "Saved — backups will run automatically on every save."
    : "Cleared — auto-backup is off until a token is entered.";
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
  firebaseAuth.onAuthStateChanged((user) => {
    if (user) {
      window.APP_DATA.currentUser = { email: user.email, isAdmin: isAdminUser(user) };
      document.getElementById("loginScreen").classList.add("hidden");
      document.getElementById("menuScreen").classList.remove("hidden");
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
  if (firebaseAuth) watchAuthState();
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document.getElementById("optionsButton").addEventListener("click", openOptions);
  document.getElementById("optionsBack").addEventListener("click", closeOptions);
  document.getElementById("saveDropboxToken").addEventListener("click", saveDropboxToken);
  document.getElementById("exportEverythingBtn").addEventListener("click", handleExportEverything);
});
