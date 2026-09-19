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
// Every save that changes data triggers a backup upload (see triggerBackup).

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
    return "Dropbox connected — backups will now run automatically on every save.";
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

// Returns {text, ok} for the Options screen.
function dropboxStatusInfo() {
  const status = dropboxReadJson(DROPBOX_STATUS_KEY);
  const when = status ? new Date(status.at).toLocaleString() : "";
  if (hasDropboxRefreshToken()) {
    if (status && status.ok) return { text: `Connected. Last backup ${when}.`, ok: true };
    if (status && !status.ok) return { text: `Connected, but the last backup (${when}) failed: ${status.detail || "unknown problem"}. It will retry on the next save.`, ok: false };
    return { text: "Connected. The first backup runs on your next save.", ok: true };
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
    return { ok: true };
  } catch (err) {
    // Most likely offline — this is expected and not a hard failure.
    // The next successful save will back up the latest state anyway.
    console.warn("Dropbox backup could not run (likely offline):", err);
    return { ok: false, reason: "network" };
  }
}

// Call this after any write to Firestore/local queue. Fire-and-forget —
// never blocks the UI or the save the user is doing, and failures are
// recorded (see dropboxStatusInfo) rather than interrupting anything.
function triggerBackup(dataObject) {
  if (!hasDropboxBackupConfigured()) return;
  backupToDropbox(dataObject);
}
