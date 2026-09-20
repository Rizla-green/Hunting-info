/* =====================================================================
   LOCAL STORE — a small safety copy kept ON THIS DEVICE (IndexedDB),
   separate from the online database. It holds two things:
     "pending"  photos that have been taken/picked but not yet uploaded
                to Cloudinary (kept out of the main online document so
                they can never make a save too big);
     "state"    the last known copy of all the app data ("snapshot"),
                flagged dirty until it has reached the cloud, so changes
                survive the app being closed before a save got through.
   Every method swallows its own errors (returns null/false) — a problem
   here must never break the app; it just means no safety copy.
===================================================================== */

const LocalStore = {
  _dbp: null,

  _db() {
    if (!this._dbp) {
      this._dbp = new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error("IndexedDB not available")); return; }
        const req = indexedDB.open("hunting-info-local", 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("pending")) db.createObjectStore("pending");
          if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      this._dbp.catch(() => { this._dbp = null; });
    }
    return this._dbp;
  },

  async get(store, key) {
    try {
      const db = await this._db();
      return await new Promise((resolve, reject) => {
        const r = db.transaction(store).objectStore(store).get(key);
        r.onsuccess = () => resolve(r.result === undefined ? null : r.result);
        r.onerror = () => reject(r.error);
      });
    } catch (err) { console.warn("LocalStore get failed:", err); return null; }
  },

  async put(store, key, value) {
    try {
      const db = await this._db();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
      return true;
    } catch (err) { console.warn("LocalStore put failed:", err); return false; }
  },

  async putMany(store, obj) {
    const keys = Object.keys(obj || {});
    if (!keys.length) return true;
    try {
      const db = await this._db();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        const st = tx.objectStore(store);
        keys.forEach((k) => st.put(obj[k], k));
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
      return true;
    } catch (err) { console.warn("LocalStore putMany failed:", err); return false; }
  },

  async del(store, key) {
    try {
      const db = await this._db();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
      return true;
    } catch (err) { console.warn("LocalStore del failed:", err); return false; }
  },

  // Deletes every key in the store that is NOT in keepKeys (used to tidy up photos that have uploaded).
  async pruneExcept(store, keepKeys) {
    try {
      const keep = new Set(keepKeys || []);
      const db = await this._db();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        const st = tx.objectStore(store);
        const req = st.getAllKeys();
        req.onsuccess = () => { (req.result || []).forEach((k) => { if (!keep.has(k)) st.delete(k); }); };
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
      return true;
    } catch (err) { console.warn("LocalStore prune failed:", err); return false; }
  },
};
