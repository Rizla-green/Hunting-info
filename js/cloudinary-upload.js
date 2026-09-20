/* =====================================================================
   CLOUDINARY UPLOAD — every photo (species entries, Deer entries,
   Zeroing target photos) uploads here instead of storing the raw
   data-URL. This also doubles as the offline photo queue: a photo is
   saved locally as a data-URL immediately (so it works offline and
   nothing is lost), then uploaded in the background; if that upload
   fails (most likely because the device is offline), the data-URL is
   simply left in place and retried automatically the next time the
   device comes back online.
===================================================================== */

async function uploadPhotoToCloudinary(dataUrl) {
  if (!CLOUDINARY_CONFIG.cloudName || CLOUDINARY_CONFIG.cloudName.startsWith("PASTE_")) {
    return null; // not configured yet — caller keeps the local data-URL
  }
  try {
    const form = new FormData();
    form.append("file", dataUrl);
    form.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`Cloudinary responded ${res.status}`);
    const data = await res.json();
    return data.secure_url || null;
  } catch (err) {
    console.warn("Cloudinary upload failed (likely offline) — keeping local copy for now:", err);
    return null;
  }
}

const _photoUploadsInFlight = new Set();
function _isLocalPhoto(v) { return typeof v === "string" && v.startsWith("data:"); }

// Uploads a single photo and, if successful, swaps the local data-URL
// for the hosted URL in place, then saves. Called right after capture,
// and again by retryPendingPhotoUploads() for anything still pending.
// The swap is found BY VALUE, not by position, so removing another photo
// while this one uploads can't make it replace the wrong picture, and a
// photo deleted meanwhile is simply dropped.
async function uploadAndReplace(photosArray, index) {
  const current = photosArray[index];
  if (!_isLocalPhoto(current) || _photoUploadsInFlight.has(current)) return;
  _photoUploadsInFlight.add(current);
  try {
    const url = await uploadPhotoToCloudinary(current);
    if (!url) return;
    const i = photosArray.indexOf(current);
    if (i < 0) return;   // removed while uploading
    photosArray[i] = url;
    persistData();
  } finally {
    _photoUploadsInFlight.delete(current);
  }
}

// Scans every photo across the app (species, Deer, Clay, Zeroing — anything held in a
// "photos" list or a "photo" field) for ones still stuck as local data-URLs (meaning
// their upload never completed) and retries them. Runs after login and when the device
// comes back online.
async function retryPendingPhotoUploads() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const slots = [];
  (function walk(node, depth) {
    if (!node || typeof node !== "object" || depth > 10) return;
    if (Array.isArray(node)) { node.forEach((v) => walk(v, depth + 1)); return; }
    Object.keys(node).forEach((k) => {
      const v = node[k];
      if (k === "photos" && Array.isArray(v)) {
        v.forEach((p, i) => { if (_isLocalPhoto(p)) slots.push({ arr: v, i }); });
      } else if (k === "photo" && _isLocalPhoto(v)) {
        slots.push({ obj: node, k });
      } else if (v && typeof v === "object" && k !== "currentUser") {
        walk(v, depth + 1);
      }
    });
  })(window.APP_DATA, 0);
  for (const slot of slots) {
    if (slot.arr) { await uploadAndReplace(slot.arr, slot.i); continue; }
    const current = slot.obj[slot.k];
    if (!_isLocalPhoto(current) || _photoUploadsInFlight.has(current)) continue;
    _photoUploadsInFlight.add(current);
    try {
      const url = await uploadPhotoToCloudinary(current);
      if (url && slot.obj[slot.k] === current) { slot.obj[slot.k] = url; persistData(); }
    } finally {
      _photoUploadsInFlight.delete(current);
    }
  }
}

window.addEventListener("online", () => {
  retryPendingPhotoUploads();
});

// Cloudinary lets you resize on the fly by inserting a transform segment
// into the URL — no separate thumbnail file is ever stored. Falls back
// to the original URL untouched for anything not yet uploaded (a local
// data-URL) or not a Cloudinary URL at all.
function cloudinaryThumb(url, width) {
  if (url && url.startsWith("pending:")) return PhotoTools.PENDING_SVG;   // still uploading from another device
  if (!url || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/w_${width},c_limit,q_auto/`);
}
