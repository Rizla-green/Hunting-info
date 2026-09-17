// Firebase project config.
// Get these values from: Firebase console → Project settings → General → Your apps → SDK setup and config.
// Safe to leave these visible in the public GitHub repo — Firebase web config
// is not a secret; real access control comes from Firestore security rules
// and the Auth accounts, not from hiding this object.
const FIREBASE_CONFIG = {
  apiKey: "PASTE_FROM_FIREBASE_CONSOLE",
  authDomain: "PASTE_FROM_FIREBASE_CONSOLE",
  projectId: "PASTE_FROM_FIREBASE_CONSOLE",
  storageBucket: "PASTE_FROM_FIREBASE_CONSOLE",
  messagingSenderId: "PASTE_FROM_FIREBASE_CONSOLE",
  appId: "PASTE_FROM_FIREBASE_CONSOLE",
};

// Cloudinary — unsigned upload preset keeps the API secret off the client.
// Set these up in Cloudinary console → Settings → Upload → Add upload preset (unsigned).
const CLOUDINARY_CONFIG = {
  cloudName: "PASTE_FROM_CLOUDINARY_CONSOLE",
  uploadPreset: "PASTE_UNSIGNED_PRESET_NAME",
};

// what3words — reusing the existing key already used across the app.
const W3W_API_KEY = "RZ0SAE21";

// Which logged-in email counts as the admin account, for UI purposes only
// (hiding edit controls for the viewer login) — actual enforcement is in
// firestore.rules, not this check.
const ADMIN_EMAIL = "PASTE_ADMIN_EMAIL_HERE";
