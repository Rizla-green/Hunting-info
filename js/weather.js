/* =====================================================================
   WEATHER — auto-filled once an entry has a what3words/GPS location.
   Uses Open-Meteo's free, keyless historical archive API (no account,
   no key — same "keyless" standard as Leaflet/Esri elsewhere in this
   app) so it works for the entry's actual date, not just "now". Very
   recent dates (last few days) may not have archive data yet; if so
   this fails quietly and leaves the weather field blank rather than
   showing something wrong.
===================================================================== */

const WEATHER_CODES = {
  0: "☀️ Clear", 1: "🌤️ Mostly clear", 2: "⛅ Partly cloudy", 3: "☁️ Overcast",
  45: "🌫️ Fog", 48: "🌫️ Fog",
  51: "🌦️ Light drizzle", 53: "🌦️ Drizzle", 55: "🌧️ Heavy drizzle",
  61: "🌦️ Light rain", 63: "🌧️ Rain", 65: "🌧️ Heavy rain",
  71: "🌨️ Light snow", 73: "🌨️ Snow", 75: "❄️ Heavy snow",
  80: "🌦️ Rain showers", 81: "🌧️ Rain showers", 82: "⛈️ Violent showers",
  95: "⛈️ Thunderstorm", 96: "⛈️ Thunderstorm with hail", 99: "⛈️ Thunderstorm with hail",
};

async function fetchWeatherForEntry(lat, lng, dateStr) {
  if (!dateStr || isNaN(new Date(dateStr))) return ""; // no (valid) date on the entry — nothing to look up
  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${dateStr}&end_date=${dateStr}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.daily || !data.daily.time || data.daily.time.length === 0) return "";
    const code = data.daily.weathercode[0];
    const max = Math.round(data.daily.temperature_2m_max[0]);
    const min = Math.round(data.daily.temperature_2m_min[0]);
    const desc = WEATHER_CODES[code] || "";
    return `${desc} ${min}–${max}°C`.trim();
  } catch (err) {
    console.warn("Weather lookup failed (likely offline or date too recent):", err);
    return "";
  }
}
