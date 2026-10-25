// ════════════════════════════════════════════════
// FamilieHub — konfiguration
// ════════════════════════════════════════════════
// Firebase web-konfiguration er ikke hemmelig (den er synlig i alle web-apps).
// Sikkerheden ligger i database.rules.json + Firebase Authentication.

const APP_VERSION = '4.0.0';

const FB_CONFIG = {
  apiKey:            "AIzaSyAq8oS6gWmx5O2cuA-sTsCTp7jBSng6VvI",
  authDomain:        "familiehub-88a59.firebaseapp.com",
  databaseURL:       "https://familiehub-88a59-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "familiehub-88a59",
  storageBucket:     "familiehub-88a59.firebasestorage.app",
  messagingSenderId: "399957886754",
  appId:             "1:399957886754:web:c37544823d1b1818e6477b"
};

// Brugernavne uden @ logges ind som <brugernavn>@<USERNAME_DOMAIN>.
// Ændr IKKE efter brugerne er oprettet.
const USERNAME_DOMAIN = 'familiehub-88a59.firebaseapp.com';
