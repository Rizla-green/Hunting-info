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

  // Close — single button, replaces the old separate Back/Main Menu split.
  requestClose() {
    if (this.dirty && !confirm("You have unsaved changes. Discard them and close?")) return;
    this.close();
  },

  close() {
    document.getElementById("popupOverlay").classList.add("hidden");
    document.getElementById("popupCard").innerHTML = "";
    this.dirty = false;
    const cb = this.onClosed;
    this.onClosed = null;
    if (cb) cb();
  },

  // Standard header for an entry/reference popup — a single Close button, title, nothing else.
  header(title) {
    return `
      <div class="map-modal-header">
        <h3>${title}</h3>
        <button class="icon-btn" onclick="Popup.requestClose()">✕ Close</button>
      </div>`;
  },

  // Footer with the Save action — sits at the BOTTOM of the popup content, styled as a proper full-width button.
  saveFooter(onSaveJs) {
    return `<button class="btn popup-save-btn" onclick="${onSaveJs}">💾 Save</button>`;
  },

  refHeader(title) { return this.header(title); },
};
