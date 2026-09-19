/* =====================================================================
   MOON PHASE — pure date calculation, no API/key needed. Given an
   entry's date, works out what the moon was doing that NIGHT (the
   night following that calendar date), regardless of what time of
   day the entry itself was logged. Used wherever an entry shows
   weather/moon context (Deer, Fox, Squirrel, Boar, Goats, Rabbit,
   Rats, Winged Vermin, Game Shooting).
===================================================================== */

const MOON_PHASES = [
  { name: "New Moon", emoji: "🌑" },
  { name: "Waxing Crescent", emoji: "🌒" },
  { name: "First Quarter", emoji: "🌓" },
  { name: "Waxing Gibbous", emoji: "🌔" },
  { name: "Full Moon", emoji: "🌕" },
  { name: "Waning Gibbous", emoji: "🌖" },
  { name: "Last Quarter", emoji: "🌗" },
  { name: "Waning Crescent", emoji: "🌘" },
];

function moonPhaseFor(dateStr) {
  const date = new Date(dateStr + "T21:00:00"); // that night
  const knownNewMoon = new Date("2000-01-06T18:14:00Z").getTime();
  const synodicMonth = 29.530588853; // days
  const daysSince = (date.getTime() - knownNewMoon) / 86400000;
  let phaseFraction = (daysSince % synodicMonth) / synodicMonth;
  if (phaseFraction < 0) phaseFraction += 1;
  const index = Math.floor(phaseFraction * 8 + 0.5) % 8;
  return MOON_PHASES[index];
}

function moonPhaseLabel(dateStr) {
  if (!dateStr || isNaN(new Date(dateStr + "T21:00:00"))) return "";
  const p = moonPhaseFor(dateStr);
  return `${p.emoji} ${p.name}`;
}
