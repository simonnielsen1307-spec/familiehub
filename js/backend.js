// ════════════════════════════════════════════════
// FamilieHub — Firebase-opstart
// ════════════════════════════════════════════════
// FBSDK kommer fra js/vendor/firebase.js (lokal kopi af Firebase SDK).

const FH = (() => {
  const S = window.FBSDK;
  const app = S.initializeApp(FB_CONFIG);
  const auth = S.getAuth(app);
  const db = S.getDatabase(app);

  // Lokal test mod Firebase-emulatorer: åbn http://localhost:5000/?emu=1
  const params = new URLSearchParams(location.search);
  if (params.has('emu') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    S.connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true });
    S.connectDatabaseEmulator(db, location.hostname, 9000);
    console.log('[FamilieHub] Bruger lokale emulatorer');
  }

  return {
    S, app, auth, db,
    ref: path => S.ref(db, path),
  };
})();
