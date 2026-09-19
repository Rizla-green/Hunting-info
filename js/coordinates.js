/* =====================================================================
   COORDINATES — reading a latitude/longitude typed by a person.
   Understands, for one point (latitude first, or with N/S/E/W letters):
     decimal degrees          51.7654, -2.1234      51.7654 N 2.1234 W
     degrees + decimal mins   N54° 56.117' W005° 09.396'
     degrees min seconds      51°45'55"N 2°7'24"W
   Extra spaces, leading zeros, missing ° ' " marks and letters before or
   after the numbers are all fine. Anything else returns null — never a guess.
===================================================================== */

// The numbers of one half (latitude or longitude) -> signed decimal degrees, or null.
function _coordGroupToDegrees(text, hemisphere) {
  const nums = (text.match(/-?\d+(?:\.\d+)?/g) || []);
  if (nums.length < 1 || nums.length > 3) return null;
  let deg = parseFloat(nums[0]);
  const negative = nums[0].startsWith("-") || hemisphere === "S" || hemisphere === "W";
  deg = Math.abs(deg);
  const min = nums.length > 1 ? parseFloat(nums[1]) : 0;
  const sec = nums.length > 2 ? parseFloat(nums[2]) : 0;
  if (nums.length > 1 && (min < 0 || min >= 60)) return null;
  if (nums.length > 2 && (sec < 0 || sec >= 60)) return null;
  if (nums.length > 1 && nums[1].startsWith("-")) return null;
  if (nums.length > 2 && nums[2].startsWith("-")) return null;
  const value = deg + min / 60 + sec / 3600;
  return negative ? -value : value;
}

function _coordClean(text) {
  return String(text === null || text === undefined ? "" : text)
    .toUpperCase()
    .replace(/[°º˚′’'″"”“]/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Splits a cleaned string into [{letter, text}] groups by its N/S/E/W letters.
function _coordSplit(t) {
  const letters = [...t.matchAll(/[NSEW]/g)].map((m) => ({ letter: m[0], index: m.index }));
  if (!letters.length) return null;
  // Anything other than digits, dots, minus signs, spaces and those letters means we can't trust it.
  if (/[^0-9.\-\sNSEW]/.test(t)) return undefined;
  const prefix = letters[0].index === 0;
  const groups = [];
  if (prefix) {
    letters.forEach((l, i) => groups.push({ letter: l.letter, text: t.slice(l.index + 1, i + 1 < letters.length ? letters[i + 1].index : t.length) }));
  } else {
    if (t[t.length - 1] !== letters[letters.length - 1].letter || letters[letters.length - 1].index !== t.length - 1) return undefined;
    let start = 0;
    letters.forEach((l) => { groups.push({ letter: l.letter, text: t.slice(start, l.index) }); start = l.index + 1; });
  }
  return groups;
}

// One latitude AND longitude together. Returns {lat, lng} or null.
function parseCoordinates(text) {
  const t = _coordClean(text);
  if (!t) return null;
  let latDeg = null, lngDeg = null;
  const groups = _coordSplit(t);
  if (groups === undefined) return null;
  if (groups) {
    if (groups.length !== 2) return null;
    const isLat = (g) => g.letter === "N" || g.letter === "S";
    if (isLat(groups[0]) === isLat(groups[1])) return null; // needs one of each
    const [latG, lngG] = isLat(groups[0]) ? [groups[0], groups[1]] : [groups[1], groups[0]];
    latDeg = _coordGroupToDegrees(latG.text, latG.letter);
    lngDeg = _coordGroupToDegrees(lngG.text, lngG.letter);
  } else {
    if (/[^0-9.\-\s]/.test(t)) return null;
    const nums = t.match(/-?\d+(?:\.\d+)?/g) || [];
    if (nums.length === 2) { latDeg = _coordGroupToDegrees(nums[0], ""); lngDeg = _coordGroupToDegrees(nums[1], ""); }
    else if (nums.length === 4) { latDeg = _coordGroupToDegrees(nums.slice(0, 2).join(" "), ""); lngDeg = _coordGroupToDegrees(nums.slice(2).join(" "), ""); }
    else if (nums.length === 6) { latDeg = _coordGroupToDegrees(nums.slice(0, 3).join(" "), ""); lngDeg = _coordGroupToDegrees(nums.slice(3).join(" "), ""); }
    else return null;
  }
  if (latDeg === null || lngDeg === null || isNaN(latDeg) || isNaN(lngDeg)) return null;
  if (Math.abs(latDeg) > 90 || Math.abs(lngDeg) > 180) return null;
  return { lat: Math.round(latDeg * 1e6) / 1e6, lng: Math.round(lngDeg * 1e6) / 1e6 };
}

// Latitude and longitude in two separate cells. Returns {lat, lng} or null.
function parseLatLngPair(latText, lngText) {
  const one = (text) => {
    const t = _coordClean(text);
    if (!t || /[^0-9.\-\sNSEW]/.test(t)) return null;
    const letters = t.match(/[NSEW]/g) || [];
    if (letters.length > 1) return null;
    const letter = letters[0] || "";
    const value = _coordGroupToDegrees(t.replace(/[NSEW]/g, " "), letter);
    return value === null || isNaN(value) ? null : { value, letter };
  };
  const a = one(latText), b = one(lngText);
  if (!a || !b) return null;
  if (a.letter === "E" || a.letter === "W" || b.letter === "N" || b.letter === "S") return null; // columns the wrong way round
  if (Math.abs(a.value) > 90 || Math.abs(b.value) > 180) return null;
  return { lat: Math.round(a.value * 1e6) / 1e6, lng: Math.round(b.value * 1e6) / 1e6 };
}

// Roughly the UK and its islands (incl. Shetland, Northern Ireland, the Channel Islands' edge).
function isInUK(lat, lng) {
  return lat >= 49.8 && lat <= 61 && lng >= -8.7 && lng <= 1.9;
}
