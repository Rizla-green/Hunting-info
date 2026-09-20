/* =====================================================================
   LOCATION MATCHING — shared by every species' "+ Camera" quick-add.
   Flow: take a photo -> grab GPS -> convert to what3words -> check the
   point against every farm's drawn boundary (point-in-polygon) -> tag
   the entry to whichever farm contains it, or "other" if none match.
   Manual drop-pin (in the Land and Farms map) goes through the same
   matching, just without the camera step.
===================================================================== */

const LocationMatch = {
  // Standard ray-casting point-in-polygon test.
  pointInPolygon(lat, lng, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lat, yi = polygon[i].lng;
      const xj = polygon[j].lat, yj = polygon[j].lng;
      const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  },

  // Returns a farm id, or "other" if the point falls outside every
  // drawn boundary (or no boundaries are drawn yet).
  // Every outline (as a list of points) that makes up a farm's land.
  outlinesOf(farm) {
    const raw = Array.isArray(farm.land?.boundaries) ? farm.land.boundaries.map((b) => b.points) : [farm.land?.boundary];
    return raw.filter((pts) => pts && pts.length > 2);
  },

  findFarmForPoint(lat, lng) {
    const farms = window.APP_DATA.farms || [];
    for (const farm of farms) {
      // A farm can be several separate pieces of land — inside ANY of its outlines counts.
      const outlines = Array.isArray(farm.land?.boundaries)
        ? farm.land.boundaries.map((b) => b.points)
        : [farm.land?.boundary];               // farms not yet opened on the Land map still have the old single outline
      if (outlines.some((pts) => pts && pts.length > 2 && this.pointInPolygon(lat, lng, pts))) {
        return farm.id;
      }
    }
    return "other";
  },

  async convertToWhat3Words(lat, lng) {
    try {
      const url = `https://api.what3words.com/v3/convert-to-3wa?coordinates=${lat},${lng}&key=${W3W_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      return data.words ? `///${data.words}` : "";
    } catch (err) {
      console.warn("what3words conversion failed (likely offline):", err);
      return "";
    }
  },

  // Reverse lookup: three words -> position. Returns {lat, lng} on success,
  // null if those words don't exist / can't be read, or {fatal: reason} when
  // the lookup can't work at all right now ("offline", or a key/allowance
  // problem) so a bulk run can stop instead of failing every row.
  async convertFromWhat3Words(words) {
    const clean = String(words || "").trim().replace(/^\/+/, "");
    if (!clean) return null;
    try {
      const url = `https://api.what3words.com/v3/convert-to-coordinates?words=${encodeURIComponent(clean)}&key=${W3W_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.coordinates) return { lat: data.coordinates.lat, lng: data.coordinates.lng };
      const code = data && data.error && data.error.code;
      if (["MissingKey", "InvalidKey", "SuspendedKey", "QuotaExceeded", "ForbiddenKey"].includes(code)) return { fatal: code };
      return null;
    } catch (err) {
      console.warn("what3words reverse lookup failed (likely offline):", err);
      return { fatal: "offline" };
    }
  },

  // Captures the device's current GPS position, converts it to w3w, and
  // matches it to a farm boundary (and, inside that, a named field),
  // returning {lat, lng, what3words, farmId, fieldId}.
  // Falls back to a manual prompt if GPS isn't available or fails.
  captureLocation(onComplete) {
    if (!navigator.geolocation) {
      alert("This device doesn't support GPS location — place the pin manually on the Land and Farms map instead.");
      onComplete(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        const what3words = await this.convertToWhat3Words(lat, lng);
        if (!what3words) alert("Your position was saved, but the three words couldn't be looked up (no signal, or a what3words problem). Everything else on the entry still works.");
        const farmId = this.findFarmForPoint(lat, lng);
        const field = (farmId !== "other" && typeof Fields !== "undefined") ? Fields.findForPoint(farmId, lat, lng) : null;
        onComplete({ lat, lng, what3words, farmId, fieldId: field ? field.id : "" });
      },
      () => {
        alert("Couldn't get your location — check location permissions, or place the pin manually on the Land and Farms map.");
        onComplete(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  },

  // Wired to a hidden <input type="file" capture="environment"> so the
  // camera opens directly; once a photo is taken, GPS/w3w/farm-match
  // run automatically and the calling screen's addEntry-style callback
  // gets the photo plus the resolved location.
  captureWithCamera(inputEl, onComplete) {
    const file = inputEl.files[0];
    if (!file) return;
    inputEl.value = "";   // so the same photo can be picked again later
    // GPS runs while the photo is being shrunk (phone photos are big), so the position is where you took it.
    const locPromise = new Promise((resolve) => this.captureLocation(resolve));
    Promise.all([PhotoTools.fileToDataUrl(file), locPromise]).then(([photoDataUrl, loc]) => onComplete(photoDataUrl, loc));
  },
};
