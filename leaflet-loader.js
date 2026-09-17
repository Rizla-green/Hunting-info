/* Lazy-loads Leaflet + its CSS only when a map is first opened, so the
   app shell stays light for people who never touch a map screen. */
const LeafletLoader = {
  loading: false,
  ready: typeof window !== "undefined" && window.L ? true : false,
  ensure(callback) {
    if (this.ready) { callback(); return; }
    if (this.loading) {
      const check = setInterval(() => {
        if (this.ready) { clearInterval(check); callback(); }
      }, 100);
      return;
    }
    this.loading = true;
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => { this.ready = true; this.loading = false; callback(); };
    script.onerror = () => {
      this.loading = false;
      alert("Could not load the map library — check your internet connection and try again.");
    };
    document.head.appendChild(script);
  },
};
