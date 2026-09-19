// Dropbox auto-backup.
//
// Two ways to be connected (this device only — nothing here is ever
// committed to the public repo or synced to Firestore):
//
//   1. PERMANENT (recommended): "Connect Dropbox" in Options. Uses Dropbox's
//      OAuth "PKCE" flow — no app secret needed. Dropbox hands back a
//      long-lived REFRESH token, kept in this device's localStorage. The
//      app swaps it for a fresh short-lived access token whenever one is
//      needed, so backups keep working indefinitely.
//   2. LEGACY: a short-lived access token pasted into Options (they expire
//      after a few hours, which is why backups used to silently stop).
//      Kept as a fallback.
//
// Backups run once a week: when the app opens and the last backup is 7 or
// more days old (see maybeRunWeeklyBackup), or when "Back up now" is pressed
// in Options. After each upload the app tidies its own old backup files,
// keeping only the newest 12.

// The App key is a public identifier (not a secret) — safe in the repo.
const DROPBOX_APP_KEY = "pie3o0610s0or9o";
// Must match, exactly, a Redirect URI added in the Dropbox App Console.
const DROPBOX_REDIRECT_URI = "https://rizla-green.github.io/Hunting-info/";

const DROPBOX_TOKEN_KEY = "huntingInfo_dropboxToken";       // legacy pasted token
const DROPBOX_REFRESH_KEY = "huntingInfo_dropboxRefresh";   // permanent refresh token
const DROPBOX_ACCESS_KEY = "huntingInfo_dropboxAccess";     // {token, expiresAt} short-lived
const DROPBOX_PKCE_KEY = "huntingInfo_dropboxPkce";         // {verifier, state, ts} during the connect round-trip
const DROPBOX_STATUS_KEY = "huntingInfo_dropboxStatus";     // {ok, at, detail} result of the last backup
const DROPBOX_BACKUP_PATH = "/HuntingInfoBackups";
const DROPBOX_PRUNE_KEY = "huntingInfo_dropboxPruneNote";   // set when old backups couldn't be tidied
const DROPBOX_BACKUP_EVERY_MS = 7 * 24 * 60 * 60 * 1000;    // one backup a week
const DROPBOX_KEEP_BACKUPS = 12;                            // newest backups kept in Dropbox

// ---------- Small helpers ----------
function dropboxStore(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch (err) { console.warn("Couldn't write to localStorage:", err); }
}
function dropboxRead(key) {
  try { return localStorage.getItem(key); } catch (err) { return null; }
}
function dropboxReadJson(key) {
  try { return JSON.parse(dropboxRead(key) || "null"); } catch (err) { return null; }
}

function base64UrlFromBytes(bytes) {
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randomUrlSafe(byteCount) {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return base64UrlFromBytes(bytes);
}
async function pkceChallengeFor(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlFromBytes(new Uint8Array(digest));
}

// ---------- Legacy pasted token ----------
function getDropboxToken() {
  return dropboxRead(DROPBOX_TOKEN_KEY) || "";
}
function setDropboxToken(token) {
  dropboxStore(DROPBOX_TOKEN_KEY, (token || "").trim());
}

// ---------- Connection state ----------
function hasDropboxRefreshToken() {
  return !!dropboxRead(DROPBOX_REFRESH_KEY);
}
function hasDropboxBackupConfigured() {
  return hasDropboxRefreshToken() || getDropboxToken().length > 0;
}

// ---------- Connect (step 1: send the user to Dropbox) ----------
async function startDropboxConnect() {
  if (!(window.crypto && crypto.subtle)) {
    alert("This browser can't run the secure Dropbox sign-in. Try Safari/Chrome, or paste a token under 'Advanced'.");
    return;
  }
  window.location.href = await prepareDropboxConnect();
}

// Makes the one-off secret for this sign-in (kept on this device), and returns
// the Dropbox address that asks the user to Allow.
async function prepareDropboxConnect() {
  const verifier = randomUrlSafe(64);   // 86 URL-safe characters (Dropbox allows 43–128)
  const state = randomUrlSafe(16);
  dropboxStore(DROPBOX_PKCE_KEY, { verifier, state, ts: Date.now() });
  const challenge = await pkceChallengeFor(verifier);
  const params = new URLSearchParams({
    client_id: DROPBOX_APP_KEY,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    token_access_type: "offline",       // this is what gets us a refresh token
    redirect_uri: DROPBOX_REDIRECT_URI,
    state,
  });
  return "https://www.dropbox.com/oauth2/authorize?" + params.toString();
}

// ---------- Connect (step 2: Dropbox sends the user back with ?code=...) ----------
// Called once on every page load. Does nothing unless the URL carries a
// Dropbox result. Returns a message to show the user, or "" if there was nothing to do.
async function handleDropboxRedirect() {
  const query = new URLSearchParams(window.location.search);
  const code = query.get("code");
  const state = query.get("state");
  const error = query.get("error");
  if (!error && !(code && state)) return "";

  // Clean the address bar straight away so the one-time code can't be reused or bookmarked.
  try { history.replaceState(null, "", window.location.pathname + window.location.hash); } catch (err) { /* ignore */ }

  const pending = dropboxReadJson(DROPBOX_PKCE_KEY);
  if (error) {
    dropboxStore(DROPBOX_PKCE_KEY, null);
    return "Dropbox connection was cancelled or refused. Nothing has changed.";
  }
  if (!pending || pending.state !== state) {
    dropboxStore(DROPBOX_PKCE_KEY, null);
    return "The Dropbox connection didn't complete (the sign-in couldn't be matched to this device). Open the app in your normal browser and press Connect Dropbox again.";
  }

  try {
    const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: DROPBOX_APP_KEY,
        redirect_uri: DROPBOX_REDIRECT_URI,
        code_verifier: pending.verifier,
      }).toString(),
    });
    const data = await res.json();
    dropboxStore(DROPBOX_PKCE_KEY, null);
    if (!res.ok || !data.refresh_token) {
      console.warn("Dropbox token exchange failed:", data);
      return "Dropbox didn't accept the connection" + (data.error_description ? ` (${data.error_description})` : "") + ". Please try Connect Dropbox again.";
    }
    dropboxStore(DROPBOX_REFRESH_KEY, data.refresh_token);
    dropboxStore(DROPBOX_ACCESS_KEY, { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 14400) * 1000 });
    dropboxStore(DROPBOX_STATUS_KEY, null);
    dropboxStore(DROPBOX_PRUNE_KEY, null);
    return "Dropbox connected — your first backup is made as soon as your data has loaded, then one every 7 days.";
  } catch (err) {
    console.warn("Dropbox token exchange couldn't run (offline?):", err);
    dropboxStore(DROPBOX_PKCE_KEY, null);
    return "Couldn't reach Dropbox to finish connecting — check your internet connection and press Connect Dropbox again.";
  }
}

// ---------- Access token (refreshes itself) ----------
let dropboxRefreshInFlight = null;

// Swaps the refresh token for a new short-lived access token. Several saves
// can ask at once, so they share a single request. If Dropbox says the
// refresh token is no longer valid (access revoked), the connection is cleared.
function refreshDropboxAccessToken() {
  if (dropboxRefreshInFlight) return dropboxRefreshInFlight;
  const refresh = dropboxRead(DROPBOX_REFRESH_KEY);
  if (!refresh) return Promise.resolve("");
  dropboxRefreshInFlight = (async () => {
    try {
      const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: DROPBOX_APP_KEY }).toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.access_token) {
        dropboxStore(DROPBOX_ACCESS_KEY, { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 14400) * 1000 });
        return data.access_token;
      }
      if (data && data.error === "invalid_grant") {
        // Access was revoked in Dropbox (or the refresh token is dead) — needs reconnecting.
        dropboxStore(DROPBOX_REFRESH_KEY, null);
        dropboxStore(DROPBOX_ACCESS_KEY, null);
        recordDropboxStatus(false, "Dropbox access was removed — press Connect Dropbox to reconnect.");
      }
      return "";
    } catch (err) {
      return ""; // offline — try again on the next save; keep the connection
    } finally {
      dropboxRefreshInFlight = null;
    }
  })();
  return dropboxRefreshInFlight;
}

async function getDropboxAccessToken() {
  if (hasDropboxRefreshToken()) {
    const cached = dropboxReadJson(DROPBOX_ACCESS_KEY);
    if (cached && cached.token && cached.expiresAt - 60000 > Date.now()) return cached.token;
    return await refreshDropboxAccessToken();
  }
  return getDropboxToken();
}

// ---------- Disconnect ----------
async function disconnectDropbox() {
  const cached = dropboxReadJson(DROPBOX_ACCESS_KEY);
  if (cached && cached.token) {
    try {
      await fetch("https://api.dropboxapi.com/2/auth/token/revoke", { method: "POST", headers: { Authorization: `Bearer ${cached.token}` } });
    } catch (err) { /* best effort — we still forget it locally */ }
  }
  dropboxStore(DROPBOX_REFRESH_KEY, null);
  dropboxStore(DROPBOX_ACCESS_KEY, null);
  dropboxStore(DROPBOX_STATUS_KEY, null);
}

// ---------- Status (so a stalled backup is visible, not silent) ----------
function recordDropboxStatus(ok, detail) {
  dropboxStore(DROPBOX_STATUS_KEY, { ok: !!ok, at: Date.now(), detail: detail || "" });
}

// True when a weekly backup is owed: never backed up, the last attempt failed,
// or the last good backup is 7 or more days old.
function dropboxBackupDue() {
  const status = dropboxReadJson(DROPBOX_STATUS_KEY);
  if (!status || !status.ok) return true;
  return Date.now() - status.at >= DROPBOX_BACKUP_EVERY_MS;
}

// Returns {text, ok} for the Options screen.
function dropboxStatusInfo() {
  const status = dropboxReadJson(DROPBOX_STATUS_KEY);
  const when = status ? new Date(status.at).toLocaleString() : "";
  const next = status && status.ok ? new Date(status.at + DROPBOX_BACKUP_EVERY_MS).toLocaleDateString() : "";
  const pruneNote = dropboxRead(DROPBOX_PRUNE_KEY);
  const tail = pruneNote ? ` ${pruneNote}` : "";
  if (hasDropboxRefreshToken()) {
    if (status && status.ok) return { text: `Connected. Last backup ${when}. Next automatic backup due on or after ${next}, when you open the app.${tail}`, ok: true };
    if (status && !status.ok) return { text: `Connected, but the last backup (${when}) failed: ${status.detail || "unknown problem"}. It will retry on the next save.`, ok: false };
    return { text: "Connected. The first backup runs when the app next opens.", ok: true };
  }
  if (getDropboxToken()) {
    if (status && !status.ok) return { text: `Using a pasted token, and the last backup (${when}) failed: ${status.detail || "unknown problem"}. Pasted tokens expire after a few hours — use Connect Dropbox instead.`, ok: false };
    if (status && status.ok) return { text: `Using a pasted token. Last backup ${when}. (Pasted tokens expire after a few hours.)`, ok: true };
    return { text: "Using a pasted token (these expire after a few hours). Connect Dropbox for a permanent link.", ok: false };
  }
  if (status && !status.ok) return { text: status.detail, ok: false };
  return { text: "Not connected — auto-backup is off.", ok: false };
}

// Uploads a JSON snapshot of the full dataset to Dropbox.
// Called after every save (see triggerBackup below), and manually from Options.
// Filename includes a timestamp so each backup is a new file, not an overwrite —
// keeps a rolling history in case a bad sync needs to be rolled back.
async function backupToDropbox(dataObject) {
  let token = await getDropboxAccessToken();
  if (!token) {
    if (!hasDropboxBackupConfigured()) return { ok: false, reason: "no-token" };
    // Connected but couldn't get a token right now (most likely offline).
    return { ok: false, reason: "network" };
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${DROPBOX_BACKUP_PATH}/hunting-info-backup-${timestamp}.json`;
  const payload = JSON.stringify(
    { version: APP_VERSION, exportedAt: new Date().toISOString(), data: dataObject },
    null,
    2
  );
  const upload = (t) => fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      "Dropbox-API-Arg": JSON.stringify({ path: filename, mode: "add", autorename: true, mute: true }),
      "Content-Type": "application/octet-stream",
    },
    body: payload,
  });

  try {
    let response = await upload(token);
    if (response.status === 401 && hasDropboxRefreshToken()) {
      // The short-lived token expired earlier than expected — get a new one and retry once.
      dropboxStore(DROPBOX_ACCESS_KEY, null);
      token = await refreshDropboxAccessToken();
      if (token) response = await upload(token);
    }
    if (!response.ok) {
      const errText = await response.text();
      console.warn("Dropbox backup failed:", errText);
      const expired = response.status === 401;
      recordDropboxStatus(false, expired ? "the Dropbox token has expired" : `Dropbox said no (${response.status})`);
      return { ok: false, reason: "http-error", detail: errText };
    }
    recordDropboxStatus(true, "");
    await pruneDropboxBackups(token);   // never throws
    return { ok: true };
  } catch (err) {
    // Most likely offline — this is expected and not a hard failure.
    // The next successful save will back up the latest state anyway.
    console.warn("Dropbox backup could not run (likely offline):", err);
    return { ok: false, reason: "network" };
  }
}

// Keeps only the newest DROPBOX_KEEP_BACKUPS files that this app made
// (hunting-info-backup-*.json) in the backup folder. Anything else in the
// folder, or elsewhere in Dropbox, is never touched. Failure is non-fatal:
// the most likely cause is the Dropbox app not having the "files.metadata.read"
// permission, which is noted for the Options screen instead of interrupting.
async function pruneDropboxBackups(token) {
  try {
    const post = (endpoint, body) => fetch("https://api.dropboxapi.com/2/files/" + endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let res = await post("list_folder", { path: DROPBOX_BACKUP_PATH, limit: 2000 });
    let data = await res.json().catch(() => ({}));
    if (!res.ok) {
      dropboxStore(DROPBOX_PRUNE_KEY, "Old backups couldn't be tidied — in the Dropbox App Console tick files.metadata.read, Submit, then press Reconnect Dropbox.");
      return;
    }
    let entries = data.entries || [];
    while (data.has_more) {
      res = await post("list_folder/continue", { cursor: data.cursor });
      data = await res.json().catch(() => ({}));
      if (!res.ok) break;
      entries = entries.concat(data.entries || []);
    }
    const mine = entries
      .filter((e) => e[".tag"] === "file" && /^hunting-info-backup-.*\.json$/.test(e.name))
      .sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0)); // timestamped names: newest first
    for (const f of mine.slice(DROPBOX_KEEP_BACKUPS)) {
      const del = await post("delete_v2", { path: f.path_lower || f.path_display });
      if (!del.ok) {
        dropboxStore(DROPBOX_PRUNE_KEY, "Old backups couldn't be tidied (Dropbox refused the delete).");
        return;
      }
    }
    dropboxStore(DROPBOX_PRUNE_KEY, null);
  } catch (err) {
    console.warn("Couldn't tidy old Dropbox backups (likely offline):", err);
  }
}

// Called once each time the app has finished loading the user's data (and
// again right after connecting Dropbox). Makes the weekly backup if one is due.
// Only runs once the real data has loaded, so an empty starter dataset is never
// backed up — and never counts as "this week's backup".
let dropboxWeeklyRunning = false;
async function maybeRunWeeklyBackup() {
  if (dropboxWeeklyRunning || !window.__dataLoaded) return;
  if (!hasDropboxBackupConfigured() || !dropboxBackupDue()) return;
  dropboxWeeklyRunning = true;
  try { await backupToDropbox(window.APP_DATA); } finally { dropboxWeeklyRunning = false; }
  if (typeof refreshDropboxUi === "function" && document.getElementById("dropboxStatus")) refreshDropboxUi();
}

// Kept so existing calls to it still work. Backups no longer run on every
// save — they run weekly (maybeRunWeeklyBackup) or from "Back up now".
function triggerBackup(dataObject) { /* intentionally does nothing */ }
