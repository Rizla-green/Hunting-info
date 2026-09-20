/* =====================================================================
   FIRESTORE DATA LAYER — the whole app data object (farms, every
   species' entries, zeroing, firearms) is stored as one document:
   appData/main. persistData() is the single call every module uses; it
   debounces the online write so rapid edits don't hammer the database,
   and still fires the Dropbox backup as before.

   v4.17.14 made saving much safer (an entry once vanished):
   1. PHOTOS never go in the online document until they are uploaded.
      A photo still waiting to upload is swapped for a short "pending:…"
      marker in what is sent; the real photo waits in this device's own
      store (LocalStore) and is restored on next load. (Whole phone
      photos in the document pushed it past the database's 1 MB limit,
      so the save failed.)
   2. VERSION CHECK. Every save carries a version stamp (__rev). A save
      only goes through if the cloud is still at the version this device
      last loaded/saved — so an old copy left open on another device can
      no longer silently overwrite newer data. If they differ, nothing is
      overwritten and the person chooses what to do.
   3. LOCAL SAFETY COPY. Every change is also written to this device
      (LocalStore "snapshot", dirty until it reaches the cloud). If the
      app is closed before a save got through, the changes are recovered
      next time it opens (or offered as a download if the cloud changed
      meanwhile).
   4. A save that has not reached the cloud is NEVER silent (offline
      included): a banner stays until it succeeds, and it retries by
      itself.
===================================================================== */

let firestoreDb = null;
let saveDebounceTimer = null;
let snapshotTimer = null;
let retryTimer = null;
let firestoreReady = false;

let knownRev = null;            // the cloud version this device last loaded/saved. null = never loaded -> saving is blocked
let changeSeq = 0;              // bumps on every persistData(); tells a finished save whether newer changes arrived meanwhile
let saving = false;
let resaveNeeded = false;
let syncConflict = false;       // the cloud changed under us: saving is paused until the person chooses
let conflictRemoteRev = null;

function initFirestore() {
  if (!window.firebase) return;
  firestoreDb = firebase.firestore();
}

function isViewerUser() {
  const cu = window.APP_DATA && window.APP_DATA.currentUser;
  return !!(cu && cu.isAdmin === false);
}

function makeRev() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Same photo -> same marker, every time.
function photoPendingId(dataUrl) {
  let h = 0x811c9dc5;
  for (let i = 0; i < dataUrl.length; i++) { h ^= dataUrl.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return "pending:" + (h >>> 0).toString(16) + "-" + dataUrl.length;
}

// ---------- Making data safe for Firestore ----------
// Firestore refuses to save a document that contains an `undefined` value
// or an array directly inside another array — and the whole save fails, not
// just that item. So before every save the data is cleaned:
//   - `undefined` values are dropped (inside a list they become null)
//   - an array inside an array is wrapped as {__nested: [...]} and unwrapped
//     again on load (footpath lines on the Land map are stored this way)
//   - when a `pending` object is given, any photo still held as a data-URL is replaced
//     by a "pending:…" marker and the real photo is collected into `pending`
// The live in-memory data is never changed by this — only the copy sent.
function toFirestoreSafe(value, pending) {
  if (value === undefined || typeof value === "function") return undefined;
  if (typeof value === "string" && pending && value.startsWith("data:image/")) {
    const id = photoPendingId(value);
    pending[id] = value;
    return id;
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      const safe = toFirestoreSafe(item, pending);
      if (safe === undefined) return null;
      return Array.isArray(item) ? { __nested: safe } : safe;
    });
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    Object.keys(value).forEach((k) => {
      const safe = toFirestoreSafe(value[k], pending);
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

// What is actually sent to the cloud / kept as the local safety copy.
function buildPayload(pending) {
  const safe = toFirestoreSafe(window.APP_DATA, pending) || {};
  delete safe.currentUser;   // who is logged in is per-device, never shared
  return safe;
}

// Puts the real photos back in place of "pending:…" markers (from this device's own store).
async function restorePendingPhotos(node, depth) {
  depth = depth || 0;
  if (!node || typeof node !== "object" || depth > 10) return;
  const keys = Array.isArray(node) ? node.map((_, i) => i) : Object.keys(node);
  for (const k of keys) {
    const v = node[k];
    if (typeof v === "string") {
      if (v.startsWith("pending:")) {
        const data = await LocalStore.get("pending", v);
        if (data) node[k] = data;
      }
    } else if (v && typeof v === "object") {
      await restorePendingPhotos(v, depth + 1);
    }
  }
}

// ---------- The banner (never silent) ----------
let saveWarningActive = false;
let startupConflictActive = false;   // the 'changes that never reached the cloud' banner stays until dealt with
function _bar() {
  let bar = document.getElementById("saveWarning");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "saveWarning";
    bar.className = "save-warning";
    document.body.appendChild(bar);
  }
  return bar;
}
function showSaveWarning(message) {
  const bar = _bar();
  saveWarningActive = true;
  bar.innerHTML = `⚠ Your latest changes haven't reached the cloud yet. They're kept safe on this device and will save automatically as soon as they can — keep the app open if you can.<br><small>${escapeHtml(message)}</small>`;
  bar.classList.remove("hidden");
}
function hideSaveWarning() {
  if (startupConflictActive) return;
  saveWarningActive = false;
  const bar = document.getElementById("saveWarning");
  if (bar) bar.classList.add("hidden");
}

function showConflictBanner() {
  const bar = _bar();
  saveWarningActive = true;
  bar.innerHTML = `⚠ <strong>Newer data has been saved from another device.</strong> To protect it, this device has stopped saving. Your changes here are kept safe on this device.
    <div class="save-warning-actions">
      <button onclick="conflictDownloadCopy()">Save a copy of my changes</button>
      <button onclick="conflictLoadNewest()">Load the newest</button>
      <button onclick="conflictOverwrite()">Overwrite with mine</button>
    </div>`;
  bar.classList.remove("hidden");
}

function showStartupConflictBanner() {
  const bar = _bar();
  saveWarningActive = true;
  startupConflictActive = true;
  bar.innerHTML = `⚠ <strong>Changes made on this device last time never reached the cloud</strong>, and the cloud has changed since, so they were not applied. They're kept safe here.
    <div class="save-warning-actions">
      <button onclick="downloadStartupConflictCopy()">Download those changes</button>
      <button onclick="discardStartupConflictCopy()">Discard them</button>
    </div>`;
  bar.classList.remove("hidden");
}

async function conflictDownloadCopy() {
  await restorePendingPhotos(window.APP_DATA);
  downloadJSON(window.APP_DATA, "hunting-info-my-changes");
}
function conflictLoadNewest() {
  if (!confirm("Load the newest data from the cloud? Anything you changed on this device since the conflict will be lost unless you saved a copy first.")) return;
  LocalStore.put("state", "snapshot", { dirty: false, baseRev: null, at: Date.now(), data: null }).then(() => location.reload());
}
function conflictOverwrite() {
  if (!confirm("Overwrite the cloud with THIS device's data? Anything saved from the other device since will be lost.")) return;
  knownRev = conflictRemoteRev;
  syncConflict = false;
  hideSaveWarning();
  saveAppDataNow();
}
async function downloadStartupConflictCopy() {
  const copy = await LocalStore.get("state", "conflictCopy");
  if (!copy || !copy.data) { alert("The saved copy couldn't be found on this device."); return; }
  const data = fromFirestoreSafe(copy.data);
  await restorePendingPhotos(data);
  downloadJSON(data, "hunting-info-unsaved-changes");
}
async function discardStartupConflictCopy() {
  if (!confirm("Discard the changes that never reached the cloud? This can't be undone.")) return;
  await LocalStore.del("state", "conflictCopy");
  startupConflictActive = false;
  hideSaveWarning();
}

function _scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => { retryTimer = null; saveAppDataNow(); }, 20000);
}

// ---------- Loading ----------
// Loads the saved app data on login. Called once from watchAuthState's
// success branch, before the menu renders.
async function loadAppData() {
  if (!firestoreDb) {
    knownRev = "";
    firestoreReady = true; // no Firestore configured yet — carry on with the in-memory demo data
    return;
  }
  const localUser = window.APP_DATA.currentUser;
  let loaded = false, remoteRev = "";
  try {
    const doc = await firestoreDb.collection("appData").doc("main").get();
    if (doc.exists) {
      const raw = doc.data();
      remoteRev = raw.__rev || "";
      delete raw.__rev;
      const saved = fromFirestoreSafe(raw);
      // Merge onto window.APP_DATA rather than replacing it outright,
      // so the demo farm / current session isn't clobbered if a field
      // is missing from an older saved document.
      window.APP_DATA = Object.assign({}, window.APP_DATA, saved);
    }
    loaded = true;
  } catch (err) {
    console.warn("Couldn't load saved data from Firestore (offline?):", err);
  }
  window.APP_DATA.currentUser = localUser;

  const snap = await LocalStore.get("state", "snapshot");
  let recovered = false;

  if (loaded) {
    knownRev = remoteRev;
    if (snap && snap.dirty && snap.data) {
      if ((snap.baseRev || "") === remoteRev) {
        // Nobody else has saved since: this device's unsaved changes are the newest — put them back.
        const restored = fromFirestoreSafe(snap.data);
        window.APP_DATA = Object.assign({}, window.APP_DATA, restored);
        window.APP_DATA.currentUser = localUser;
        recovered = true;
      } else {
        // The cloud moved on as well. Never overwrite either side: keep this device's copy for download.
        await LocalStore.put("state", "conflictCopy", snap);
        await LocalStore.put("state", "snapshot", { dirty: false, baseRev: knownRev, at: Date.now(), data: null });
      }
    }
  } else if (snap && snap.data) {
    // Couldn't reach the cloud: work from this device's last copy. Saves are still version-checked later.
    const restored = fromFirestoreSafe(snap.data);
    window.APP_DATA = Object.assign({}, window.APP_DATA, restored);
    window.APP_DATA.currentUser = localUser;
    knownRev = snap.baseRev || "";
    showSaveWarning("Couldn't reach the cloud, so this is the last copy kept on this device. New changes will save when you're back online.");
  } else {
    knownRev = null;   // nothing to work from and nothing loaded: saving stays blocked so the cloud copy can't be overwritten
    alert("Couldn't load your saved data — check you're online and reload the app. Nothing will be saved until it loads, so your cloud data stays safe.");
  }

  await restorePendingPhotos(window.APP_DATA);
  firestoreReady = true;

  if (await LocalStore.get("state", "conflictCopy")) showStartupConflictBanner();
  if (recovered) {
    persistData();
    setTimeout(() => alert("Some changes you made last time never reached the cloud before the app closed. They've been recovered and are saving now."), 300);
  }
}

// ---------- Saving ----------
// Writes this device's safety copy. Debounced by persistData(); also flushed when the app is hidden.
async function writeLocalSnapshot() {
  if (!firestoreDb || isViewerUser() || knownRev === null) return;
  const pending = {};
  const safe = buildPayload(pending);
  await LocalStore.putMany("pending", pending);
  await LocalStore.put("state", "snapshot", { dirty: true, baseRev: knownRev, at: Date.now(), seq: changeSeq, data: safe });
}

// The actual write. Debounced by persistData() below — don't call this directly.
async function saveAppDataNow() {
  if (!firestoreDb || isViewerUser()) return;
  if (knownRev === null) {
    showSaveWarning("Your saved data never loaded from the cloud, so nothing has been saved (this protects the cloud copy). Reconnect and reload the app.");
    return;
  }
  if (syncConflict) return;
  if (saving) { resaveNeeded = true; return; }
  saving = true;
  const seqAtStart = changeSeq;
  try {
    const pending = {};
    const safe = buildPayload(pending);
    await LocalStore.putMany("pending", pending);
    const newRev = makeRev();
    const ref = firestoreDb.collection("appData").doc("main");
    await firestoreDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const remoteRev = snap.exists ? (snap.data().__rev || "") : "";
      if (remoteRev !== knownRev) {
        const e = new Error("The cloud data changed since this device loaded it");
        e.code = "rev-conflict";
        e.remoteRev = remoteRev;
        throw e;
      }
      tx.set(ref, Object.assign({}, safe, { __rev: newRev }));
    });
    knownRev = newRev;
    hideSaveWarning();
    clearTimeout(retryTimer); retryTimer = null;
    if (changeSeq === seqAtStart) {
      await LocalStore.put("state", "snapshot", { dirty: false, baseRev: newRev, at: Date.now(), data: safe });
      await LocalStore.pruneExcept("pending", Object.keys(pending));
    }
  } catch (err) {
    console.warn("Firestore save failed:", err);
    if (err && err.code === "rev-conflict") {
      syncConflict = true;
      conflictRemoteRev = err.remoteRev;
      showConflictBanner();
    } else {
      const offline = (typeof navigator !== "undefined" && navigator.onLine === false) || (err && (err.code === "unavailable" || /offline|network/i.test(String(err.message || ""))));
      showSaveWarning(offline ? "You're offline or have no signal." : ((err && (err.message || err.code)) ? String(err.message || err.code).slice(0, 200) : "unknown error"));
      _scheduleRetry();
    }
  } finally {
    saving = false;
    if (resaveNeeded) { resaveNeeded = false; saveAppDataNow(); }
  }
}

// Called after every change anywhere in the app. Writes this device's safety copy
// almost immediately, debounces the online write (800ms of no further changes), and
// fires the Dropbox backup immediately, same as before.
function persistData() {
  triggerBackup?.(window.APP_DATA);
  changeSeq++;
  clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(writeLocalSnapshot, 250);
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(saveAppDataNow, 800);
}

// About to be closed/backgrounded: write the safety copy now and try the online save now.
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && (saveDebounceTimer || snapshotTimer)) {
    clearTimeout(snapshotTimer);
    clearTimeout(saveDebounceTimer);
    writeLocalSnapshot();
    saveAppDataNow();
  }
});

// Back online: retry anything that hasn't reached the cloud.
window.addEventListener("online", () => {
  if (saveWarningActive && !syncConflict) saveAppDataNow();
});
