# 🏡 FamilieHub — GitHub Pages Opsætningsguide

## Trin 1: Opret GitHub repository

1. Gå til **github.com** og log ind (eller opret konto)
2. Klik **"New repository"** (grøn knap øverst til højre)
3. Navngiv det: `familiehub`
4. Sæt det til **Private** (vigtigt — familiedata!)
5. Klik **"Create repository"**

---

## Trin 2: Upload filerne

Upload disse filer til dit repository:
```
familiehub/
├── index.html          ← Selve appen
├── manifest.json       ← PWA manifest
├── sw.js               ← Service Worker
├── firebase.js         ← Firebase + kryptering
├── notifications.js    ← Notifikationer
└── icons/              ← App-ikoner (se trin nedenfor)
    ├── icon-180.png    ← iPhone ikon (180x180)
    ├── icon-192.png    ← Android ikon (192x192)
    └── icon-512.png    ← Splash screen (512x512)
```

### Sådan uploader du:
- Træk og slip filerne direkte ind i GitHub-browseren
- Eller brug GitHub Desktop appen

---

## Trin 3: Aktiver GitHub Pages

1. Gå til dit repository → **Settings** (tandhjul øverst)
2. Scroll ned til **"Pages"** i venstre menu
3. Under "Source" vælg: **Deploy from a branch**
4. Branch: **main** → folder: **/ (root)**
5. Klik **Save**
6. Din app lever nu på: `https://DITBRUGERNAVN.github.io/familiehub`

---

## Trin 4: Opret Firebase projekt

1. Gå til **console.firebase.google.com**
2. Klik **"Tilføj projekt"**
3. Navn: `familiehub-familie` (eller hvad du vil)
4. Deaktiver Google Analytics (ikke nødvendigt)
5. Klik **"Opret projekt"**

### Opret Realtime Database:
1. I venstre menu → **"Realtime Database"**
2. Klik **"Opret database"**
3. Vælg region: **europe-west1 (Belgien)** ← VIGTIGT for GDPR
4. Start i **testmode** (vi låser den bagefter)

### Hent din konfiguration:
1. Klik tandhjulet → **"Projektindstillinger"**
2. Scroll ned til **"Dine apps"** → klik webikon `</>`
3. Registrer appen med navn "FamilieHub Web"
4. Kopier `firebaseConfig` objektet
5. Sæt værdierne ind i `firebase.js` under `FB_CONFIG`

### Sæt sikkerhedsregler:
1. Realtime Database → **"Regler"** fanen
2. Kopier reglerne fra `firebase.js` (`FB_SECURITY_RULES`)
3. Klik **"Publicer"**

---

## Trin 5: Ikoner

Brug et online værktøj til at lave ikonerne:
1. Gå til **realfavicongenerator.net**
2. Upload et billede (f.eks. 🏡 som PNG eller dit eget logo)
3. Download pakken og brug filerne til `icons/` mappen

Eller lav simple ikoner på **canva.com** i størrelserne 180×180, 192×192 og 512×512.

---

## Trin 6: Tilføj til iPhone hjemskærm

1. Åbn **Safari** på iPhone (skal være Safari — ikke Chrome)
2. Gå til din GitHub Pages URL
3. Tryk **Del-knappen** (firkant med pil op) nederst
4. Vælg **"Føj til hjemskærm"**
5. Giv den et navn og tryk **Tilføj**

Nu virker den som en rigtig app! 📱

---

## Trin 7: Push Notifikationer (avanceret)

Push-notifikationer på iPhone kræver iOS 16.4+ og at appen er installeret som PWA.

1. Generer VAPID nøgler på: **web-push-codelab.glitch.me**
2. Kopier den offentlige nøgle ind i `notifications.js` under `vapidKey`
3. Den private nøgle gemmes sikkert — bruges til at sende notifikationer fra server

> **Note:** Til fuld push-support på iOS anbefales Firebase Cloud Messaging (FCM).
> Kontakt mig og vi sætter det op sammen.

---

## Sikkerhedstjekliste ✅

- [ ] Repository sat til **Private**
- [ ] Firebase database i **europe-west1** (GDPR)
- [ ] Firebase sikkerhedsregler aktiveret
- [ ] HTTPS aktiveret (GitHub Pages giver dette automatisk)
- [ ] AES-256 kryptering aktiveret i `firebase.js`
- [ ] SHA-256 password hashing aktiveret
- [ ] Rate limiting på login aktiveret (5 forsøg → 15 min lock)

---

## Hjælp

Har du spørgsmål eller problemer? Spørg Claude — beskriv hvad der sker og hvilken fejl du ser.
