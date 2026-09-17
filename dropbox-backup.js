// Dropbox auto-backup.
// Pattern matches the other apps (Deer Count / Farm Survey): a Dropbox API
// access token is entered once in Settings and kept in this device's
// localStorage only — never committed to the public repo, never synced
// to Firestore. Every save that changes data triggers a backup upload.

const DROPBOX_TOKEN_KEY = "huntingInfo_dropboxToken";
const DROPBOX_BACKUP_PATH = "/HuntingInfoBackups";

function getDropboxToken() {
  return localStorage.getItem(DROPBOX_TOKEN_KEY) || "";
}

function setDropboxToken(token) {
  localStorage.setItem(DROPBOX_TOKEN_KEY, token.trim());
}

function hasDropboxBackupConfigured() {
  return getDropboxToken().length > 0;
}

// Uploads a JSON snapshot of the full dataset to Dropbox.
// Called after every save (see triggerBackup below), and manually from Settings.
// Filename includes a timestamp so each backup is a new file, not an overwrite —
// keeps a rolling history in case a bad sync needs to be rolled back.
async function backupToDropbox(dataObject) {
  const token = getDropboxToken();
  if (!token) return { ok: false, reason: "no-token" };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${DROPBOX_BACKUP_PATH}/hunting-info-backup-${timestamp}.json`;
  const payload = JSON.stringify(
    { version: APP_VERSION, exportedAt: new Date().toISOString(), data: dataObject },
    null,
    2
  );

  try {
    const response = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({
          path: filename,
          mode: "add",
          autorename: true,
          mute: true,
        }),
        "Content-Type": "application/octet-stream",
      },
      body: payload,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn("Dropbox backup failed:", errText);
      return { ok: false, reason: "http-error", detail: errText };
    }
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
// silent (logged only) since the next save will retry anyway.
function triggerBackup(dataObject) {
  if (!hasDropboxBackupConfigured()) return;
  backupToDropbox(dataObject);
}
