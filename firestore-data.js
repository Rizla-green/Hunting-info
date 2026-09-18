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
      const saved = doc.data();
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
    await firestoreDb.collection("appData").doc("main").set(window.APP_DATA);
  } catch (err) {
    // Most likely offline — this is expected. The offline queue (once
    // wired up) is what guarantees this write isn't just lost; for now
    // the next successful save will include everything since it writes
    // the whole document, not a diff.
    console.warn("Firestore save failed (likely offline):", err);
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
