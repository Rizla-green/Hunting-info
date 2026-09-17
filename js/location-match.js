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
  findFarmForPoint(lat, lng) {
    const farms = window.APP_DATA.farms || [];
    for (const farm of farms) {
      const boundary = farm.land?.boundary;
      if (boundary && boundary.length > 2 && this.pointInPolygon(lat, lng, boundary)) {
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

  // Captures the device's current GPS position, converts it to w3w, and
  // matches it to a farm boundary, returning {lat, lng, what3words, farmId}.
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
        const farmId = this.findFarmForPoint(lat, lng);
        onComplete({ lat, lng, what3words, farmId });
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
    const reader = new FileReader();
    reader.onload = () => {
      const photoDataUrl = reader.result;
      this.captureLocation((loc) => onComplete(photoDataUrl, loc));
    };
    reader.readAsDataURL(file);
  },
};
