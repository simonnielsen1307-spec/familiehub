# FamilieHub v4

Familiens private PWA: kalender, lister, feed, chat, mad, børn og meget mere. Alt synkroniseres live mellem alle telefoner.

## Første gang (skal gøres én gang)

1. **Firebase Console → Authentication → Sign-in method → Email/Password → Slå til.**
2. Deploy app + sikkerhedsregler fra mappen:
   ```
   firebase deploy
   ```
   (`firebase.json` deployer både hosting og `database.rules.json`.)
3. Åbn appen → **"Første opsætning"** → opret dig selv (brugernavn `simon`, kode på mindst 8 tegn). Den første konto bliver admin.
4. Appen flytter automatisk de gamle data (indkøb, feed, chat, aftaler, billeder) over i den nye struktur.
5. **Mere → Admin → Tilføj ny bruger** for Marlene, Hanne osv. De logger ind med brugernavn + kode og kan selv skifte koden under "Min profil".

Hver telefon flytter også sine egne gamle lokale data (opgaver, børnekort, ønsker …) første gang den logger ind.

## Struktur

| Fil | Indhold |
|---|---|
| `index.html` | Markup |
| `css/app.css` | Al styling (v4-rettelser står nederst) |
| `js/config.js` | Firebase-konfiguration, version |
| `js/backend.js` | Firebase-opstart |
| `js/auth.js` | Login, roller, admin, profil |
| `js/sync.js` | Live synk, offline-kø, migrering fra v3 |
| `js/photos.js` | Komprimering og lazy-loading af billeder |
| `js/core.js` | Hjælpere, navigation, opstart |
| `js/*.js` | Funktioner pr. område (kalender, lister, feed, mad, børn, mere, forside) |
| `js/vendor/firebase.js` | Lokal kopi af Firebase SDK (bygges med `cd tools && npm i && npm run build`) |
| `sw.js` | Offline + automatiske opdateringer |
| `database.rules.json` | Hvem må læse/skrive hvad |

## Roller

- **admin**: alt + brugeradministration og login-log
- **family**: alt undtagen admin
- **extended**: feed, chat, minder, fotobog

## Database

```
family/members/<uid>   profiler og roller
family/data/...        kun familie
family/shared/...      feed, chat, minder, billeder (også udvidet familie)
family/loginLog        login-log (kun admin)
```

De gamle rod-noder (`lists`, `feedItems` …) er låst til admin og kan slettes i Firebase Console, når alt ser rigtigt ud.
