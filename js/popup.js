/* =====================================================================
   POPUP — shared true pop-out dialog system. Used for every entry
   add/edit across Deer, Fox, Squirrel, Boar, Goats, Rabbit, Rats,
   Winged Vermin, Game Shooting, and for reference content (Lifecycle,
   Disease, Licences, Seasons). Renders into #popupOverlay/#popupCard
   (separate from #modalOverlay, which is the full-page screens) so the
   screen underneath stays in place — a genuine pop-out, not another
   full page.

   Entry popups work on a DRAFT: nothing is written to the real data
   until Save is tapped. Back/Main Menu check for unsaved changes first
   and warn before discarding.
===================================================================== */

const Popup = {
  dirty: false,
  onClosed: null,   // called after the popup actually closes, to refresh the list behind it

  open(html, onClosed) {
    this.dirty = false;
    this.onClosed = onClosed || null;
    document.getElementById("popupCard").innerHTML = html;
    document.getElementById("popupOverlay").classList.remove("hidden");
  },

  setBody(html) {
    document.getElementById("popupCard").innerHTML = html;
  },

  markDirty() { this.dirty = true; },

  // Back — closes the popup only, returning to whatever's behind it.
  requestClose() {
    if (this.dirty && !confirm("You have unsaved changes. Discard them and go back?")) return;
    this.close();
  },

  // Main Menu — closes the popup AND the full-page screen behind it, going straight home.
  requestCloseToMenu() {
    if (this.dirty && !confirm("You have unsaved changes. Discard them and go to the main menu?")) return;
    this.dirty = false;
    this.onClosed = null;
    document.getElementById("popupOverlay").classList.add("hidden");
    document.getElementById("popupCard").innerHTML = "";
    document.getElementById("modalOverlay").classList.add("hidden");
  },

  close() {
    document.getElementById("popupOverlay").classList.add("hidden");
    document.getElementById("popupCard").innerHTML = "";
    this.dirty = false;
    const cb = this.onClosed;
    this.onClosed = null;
    if (cb) cb();
  },

  // Standard header for an entry popup — Back/Main Menu with unsaved-change checks, plus a Save button.
  header(title, onSaveJs) {
    return `
      <div class="map-modal-header">
        <button class="icon-btn" onclick="Popup.requestClose()">← Back</button>
        <h3>${title}</h3>
        <button class="icon-btn" onclick="Popup.requestCloseToMenu()">Main Menu</button>
      </div>
      ${onSaveJs ? `<div class="log-row" style="justify-content:flex-end; padding: 10px 16px 0;">
        <button class="btn small" onclick="${onSaveJs}">💾 Save</button>
      </div>` : ""}`;
  },

  // Simpler header for read-only reference content (no draft/save involved).
  refHeader(title) {
    return `
      <div class="map-modal-header">
        <button class="icon-btn" onclick="Popup.close()">← Back</button>
        <h3>${title}</h3>
        <button class="icon-btn" onclick="document.getElementById('popupOverlay').classList.add('hidden'); document.getElementById('popupCard').innerHTML=''; document.getElementById('modalOverlay').classList.add('hidden');">Main Menu</button>
      </div>`;
  },
};
