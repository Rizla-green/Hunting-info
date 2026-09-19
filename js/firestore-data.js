/* =====================================================================
   FIRESTORE DATA LAYER — replaces the in-memory-only window.APP_DATA
   with real persistence. The whole app data object (farms, every
   species' entries, zeroing, firearms) is stored as one document:
   appData/main. Simple and fast to wire up; if the app's data grows
   enough to approach Firestore's 1MB document limit (most likely once
   photos are stored here rather than on Cloudinary), this is the first
   thing to split into per-collection documents.

   persistData() is the single call site every module already uses
   (it replaced each module's old triggerBackup?.(...) call) — it
   debounces the Firestore write so rapid edits (typing in a field)
   don't hammer the database with a write per keystroke, and still
   fires the Dropbox backup as before.
===================================================================== */

let firestoreDb = null;
let saveDebounceTimer = null;
let firestoreReady = false;

function initFirestore() {
  if (!window.firebase) return;
  firestoreDb = firebase.firestore();
}

// ---------- Making data safe for Firestore ----------
// Firestore refuses to save a document that contains an `undefined` value
// or an array directly inside another array — and the whole save fails, not
// just that item. So before every save the data is cleaned:
//   - `undefined` values are dropped (inside a list they become null)
//   - an array inside an array is wrapped as {__nested: [...]} and unwrapped
//     again on load (footpath lines on the Land map are stored this way)
// The live in-memory data is never changed by this — only the copy sent.
function toFirestoreSafe(value) {
  if (value === undefined || typeof value === "function") return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => {
      const safe = toFirestoreSafe(item);
      if (safe === undefined) return null;
      return Array.isArray(item) ? { __nested: safe } : safe;
    });
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    Object.keys(value).forEach((k) => {
      const safe = toFirestoreSafe(value[k]);
      if (safe !== undefined) out[k] = safe;
    });
    return out;
  }
  return value;
}
function fromFirestoreSafe(value) {
  if (Array.isArray(value)) return value.map(fromFirestoreSafe);
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === "__nested" && Array.isArray(value.__nested)) return fromFirestoreSafe(value.__nested);
    const out = {};
    keys.forEach((k) => { out[k] = fromFirestoreSafe(value[k]); });
    return out;
  }
  return value;
}

// A save that FAILS (as opposed to just being offline) must never be silent —
// that is how entries can vanish. This shows a banner until a save succeeds.
function showSaveWarning(message) {
  let bar = document.getElementById("saveWarning");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "saveWarning";
    bar.className = "save-warning";
    document.body.appendChild(bar);
  }
  bar.innerHTML = `⚠ Your latest changes haven't been saved online — they're only on this device right now. Don't close or reload the app yet; use Options → Export to keep a copy.<br><small>${escapeHtml(message)}</small>`;
  bar.classList.remove("hidden");
}
function hideSaveWarning() {
  const bar = document.getElementById("saveWarning");
  if (bar) bar.classList.add("hidden");
}

// Loads the saved app data on login. Called once from watchAuthState's
// success branch, before the menu renders, so screens open with real
// data rather than an empty store.
async function loadAppData() {
  if (!firestoreDb) {
    firestoreReady = true; // no Firestore configured yet — carry on with the in-memory demo data
    return;
  }
  try {
    const doc = await firestoreDb.collection("appData").doc("main").get();
    if (doc.exists) {
      const saved = fromFirestoreSafe(doc.data());
      // Merge onto window.APP_DATA rather than replacing it outright,
      // so the demo farm / current session isn't clobbered if a field
      // is missing from an older saved document.
      window.APP_DATA = Object.assign({}, window.APP_DATA, saved);
    }
  } catch (err) {
    console.warn("Couldn't load saved data from Firestore (offline?):", err);
    alert("Couldn't load your saved data — check you're online, or your last offline session's data will be used until you reconnect.");
  }
  firestoreReady = true;
}

// The actual write. Debounced by persistData() below — don't call this directly.
async function saveAppDataNow() {
  if (!firestoreDb) return;
  try {
    await firestoreDb.collection("appData").doc("main").set(toFirestoreSafe(window.APP_DATA));
    hideSaveWarning();
  } catch (err) {
    console.warn("Firestore save failed:", err);
    // Being offline is expected and not an error — the next save carries everything.
    // Anything else means the data is NOT being saved, so say so out loud.
    const offline = (typeof navigator !== "undefined" && navigator.onLine === false) || (err && err.code === "unavailable");
    if (!offline) showSaveWarning((err && (err.message || err.code)) ? String(err.message || err.code).slice(0, 200) : "unknown error");
  }
}

// Called after every change anywhere in the app. Debounces the
// Firestore write (800ms of no further changes) and fires the Dropbox
// backup immediately, same as before.
function persistData() {
  triggerBackup?.(window.APP_DATA);
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(saveAppDataNow, 800);
}

// Flush any pending debounced save immediately — used when the app is
// about to be closed/backgrounded, so a change isn't lost to the timer.
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
    saveAppDataNow();
  }
});
