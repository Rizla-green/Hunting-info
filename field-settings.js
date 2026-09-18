/* =====================================================================
   FIELD VISIBILITY — the ⚙ "choose which fields show" toggle on every
   Records/Cull Record Log table. Global per section (not per farm),
   defaults to everything ON. Date/Category/Shots (pest sections) and
   Date/Species/Sex/Age (Deer) always show and can't be hidden.
===================================================================== */

function isFieldOn(sectionKey, field) {
  const s = window.APP_DATA.fieldSettings?.[sectionKey];
  return !s || s[field] !== false;
}
function setFieldOn(sectionKey, field, on) {
  window.APP_DATA.fieldSettings = window.APP_DATA.fieldSettings || {};
  window.APP_DATA.fieldSettings[sectionKey] = window.APP_DATA.fieldSettings[sectionKey] || {};
  window.APP_DATA.fieldSettings[sectionKey][field] = on;
  persistData();
}

function openFieldSettings(sectionKey, sectionTitle, fieldDefs, onToggleRerender) {
  const rows = fieldDefs
    .map((f) => `<label class="tick-row" style="justify-content:space-between; border-bottom:1px solid var(--navy-light); padding:8px 0;">
      <span>${f.label}</span>
      <input type="checkbox" ${isFieldOn(sectionKey, f.key) ? "checked" : ""} onchange="handleFieldToggle('${sectionKey}','${f.key}', this.checked)" />
    </label>`)
    .join("");
  window._fieldToggleRerender = onToggleRerender;
  ReferenceInfo.showModal("Fields shown", `
    <p class="hint" style="margin-top:0;">Choose which columns show for ${sectionTitle}'s records.</p>
    <div>${rows}</div>`);
}
function handleFieldToggle(sectionKey, field, checked) {
  setFieldOn(sectionKey, field, checked);
  if (window._fieldToggleRerender) window._fieldToggleRerender();
}
