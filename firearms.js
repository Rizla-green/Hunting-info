/* =====================================================================
   FIREARMS — dedicated menu item for managing the firearms list. Every
   "Firearm" field elsewhere (Deer Cull Record Log, pest logs, Clay
   Shooting) reads from this same shared list, so adding one here makes
   it available everywhere. Also exposes an inline "+ Add new firearm…"
   helper for use directly from a dropdown, matching v3.9's on-the-fly
   pattern, both writing to the same underlying list.
===================================================================== */

const Firearms = {
  list() {
    window.APP_DATA.firearms = window.APP_DATA.firearms || [];
    return window.APP_DATA.firearms;
  },

  add(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    if (this.list().includes(trimmed)) return;
    this.list().push(trimmed);
    persistData();
  },

  remove(name) {
    if (!confirm(`Remove "${name}" from your firearms list?`)) return;
    const idx = this.list().indexOf(name);
    if (idx > -1) this.list().splice(idx, 1);
    persistData();
    this.render();
  },

  rename(oldName, newName) {
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    const idx = this.list().indexOf(oldName);
    if (idx > -1) this.list()[idx] = trimmed;
    persistData();
    this.render();
  },

  // Called from the inline "+ Add new firearm…" option in any Firearm
  // dropdown elsewhere in the app — prompts, adds to the shared list,
  // and returns the new name so the calling screen can select it.
  addInline() {
    const name = prompt("New firearm (e.g. \".243 Tikka T3\"):");
    if (!name) return null;
    this.add(name.trim());
    return name.trim();
  },

  open() {
    this.render();
  },

  render() {
    const overlay = document.getElementById("modalOverlay");
    const firearms = this.list();
    const rows = firearms
      .map(
        (name) => `
      <div class="log-row">
        <input type="text" value="${name}" onchange="Firearms.rename('${name.replace(/'/g, "\\'")}', this.value)" />
        <button class="icon-btn" onclick="Firearms.remove('${name.replace(/'/g, "\\'")}')">✕</button>
      </div>`
      )
      .join("");

    overlay.innerHTML = `
      <div class="modal-box species-modal-box">
        <div class="map-modal-header">
          <h3>Firearms</h3>
          <button class="icon-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">✕</button>
        </div>
        <p class="hint">Manage your firearms here once — every Firearm field elsewhere picks from this same list.</p>
        <div>${rows || '<p class="hint">No firearms added yet.</p>'}</div>
        <button class="btn small" onclick="Firearms.promptAdd()">+ Add firearm</button>
      </div>`;
    overlay.classList.remove("hidden");
  },

  promptAdd() {
    const name = prompt("Firearm (e.g. \".243 Tikka T3\"):");
    if (!name) return;
    this.add(name);
    this.render();
  },
};
