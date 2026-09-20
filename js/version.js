// Single source of truth for the app version.
// Bump this on every release — it drives:
//   1. The version shown on the menu screen and login screen
//   2. The filename/header stamped into downloaded exports
//   3. The service worker cache name (a changed cache name is what
//      forces the phone to fetch fresh files next time it's online)
const APP_VERSION = "4.17.12";
