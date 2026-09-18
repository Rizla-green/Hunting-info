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

// Uploads a single photo and, if successful, swaps the local data-URL
// for the hosted URL in place, then saves. Called right after capture,
// and again by retryPendingPhotoUploads() for anything still pending.
async function uploadAndReplace(photosArray, index) {
  const current = photosArray[index];
  if (!current || !current.startsWith("data:")) return; // already uploaded, or empty
  const url = await uploadPhotoToCloudinary(current);
  if (url) {
    photosArray[index] = url;
    persistData();
  }
}

// Scans every photo across the app for ones still stuck as local
// data-URLs (meaning their upload never completed) and retries them.
// Runs automatically when the device comes back online.
async function retryPendingPhotoUploads() {
  const species = window.APP_DATA.species || {};
  for (const key of Object.keys(species)) {
    for (const entry of species[key]) {
      if (Array.isArray(entry.photos)) {
        for (let i = 0; i < entry.photos.length; i++) await uploadAndReplace(entry.photos, i);
      }
    }
  }
  const zeroing = window.APP_DATA.zeroing || {};
  for (const caliber of Object.keys(zeroing)) {
    for (const session of zeroing[caliber]) {
      if (session.photo && session.photo.startsWith("data:")) {
        const url = await uploadPhotoToCloudinary(session.photo);
        if (url) { session.photo = url; persistData(); }
      }
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
  if (!url || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/w_${width},c_limit,q_auto/`);
}
