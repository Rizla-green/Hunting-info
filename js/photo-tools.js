/* =====================================================================
   PHOTO TOOLS — every photo taken or picked goes through here first.
   Phone photos are 3-8 MB; kept raw they made the online save too big
   (the database refuses documents over 1 MB), which is how an entry
   could fail to save. Photos are now shrunk to a sensible size
   (longest side 1600px, JPEG) before they are stored or uploaded.
===================================================================== */

const PhotoTools = {
  MAX_DIM: 1600,
  QUALITY: 0.8,
  SMALL_ENOUGH: 250 * 1024,   // a file already this small is used as it is

  // Shown instead of a photo that is still uploading from another device.
  PENDING_SVG: "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#2a3b30"/>' +
    '<text x="60" y="56" font-size="11" fill="#cda85e" text-anchor="middle" font-family="sans-serif">Photo still</text>' +
    '<text x="60" y="72" font-size="11" fill="#cda85e" text-anchor="middle" font-family="sans-serif">uploading…</text></svg>'),

  _readRaw(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  },

  // File -> data-URL of the shrunk photo. Falls back to the original if the browser can't decode it.
  async fileToDataUrl(file) {
    if (!file) return null;
    if (file.size <= this.SMALL_ENOUGH) return this._readRaw(file);
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("decode failed"));
        i.src = objectUrl;
      });
      const w = img.naturalWidth, h = img.naturalHeight;
      const scale = Math.min(1, this.MAX_DIM / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = cw; canvas.height = ch;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch);   // PNGs with transparency
      ctx.drawImage(img, 0, 0, cw, ch);
      const out = canvas.toDataURL("image/jpeg", this.QUALITY);
      return out && out.startsWith("data:image/") ? out : this._readRaw(file);
    } catch (err) {
      console.warn("Couldn't shrink photo, using the original:", err);
      return this._readRaw(file);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },
};
