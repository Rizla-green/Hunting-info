// Firebase project config.
// Safe to leave these visible in the public GitHub repo — Firebase web config
// is not a secret; real access control comes from Firestore security rules
// and the Auth accounts, not from hiding this object.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCRfvyi0h3urvIRH1z_wchHMUlx3C6Rltk",
  authDomain: "hunting-info.firebaseapp.com",
  projectId: "hunting-info",
  storageBucket: "hunting-info.firebasestorage.app",
  messagingSenderId: "687415065367",
  appId: "1:687415065367:web:d0a2822b98e422b3bb5552",
};

// Cloudinary — unsigned upload preset keeps the API secret off the client.
// Set these up in Cloudinary console → Settings → Upload → Add upload preset (unsigned).
const CLOUDINARY_CONFIG = {
  cloudName: "q7cde5pf",
  uploadPreset: "e8l4ed4y",
};

// what3words — reusing the existing key already used across the app.
const W3W_API_KEY = "RZ0SAE21";

// Which logged-in email counts as the admin account, for UI purposes only
// (hiding edit controls for the viewer login) — actual enforcement is in
// firestore.rules, not this check.
const ADMIN_EMAIL = "ben_hunting@yahoo.com";
