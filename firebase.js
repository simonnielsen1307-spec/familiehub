// ════════════════════════════════════════════════
// FamilieHub — Firebase + Kryptering
// ════════════════════════════════════════════════

// ── FIREBASE CONFIG ──
// Udskift disse værdier med dine egne fra Firebase Console
// console.firebase.google.com → Dit projekt → Projektindstillinger → Din app
const FB_CONFIG = {
  apiKey:            "AIzaSyAq8oS6gWmx5O2cuA-sTsCTp7jBSng6VvI",
  authDomain:        "familiehub-88a59.firebaseapp.com",
  databaseURL:       "https://familiehub-88a59-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "familiehub-88a59",
  storageBucket:     "familiehub-88a59.firebasestorage.app",
  messagingSenderId: "399957886754",
  appId:             "1:399957886754:web:c37544823d1b1818e6477b"
};

// ── KRYPTERING ──
// AES-GCM 256-bit kryptering via Web Crypto API
// Nøglen udledes fra familiens app-hemmelighed + brugerens adgangskode

const CRYPTO = {
  // App-salt — unikt for FamilieHub (skift dette til noget unikt for dig)
  APP_SALT: 'familiehub-2024-simon-malene-august-oskar',

  // Generer krypteringsnøgle fra adgangskode
  async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  // Krypter data
  async encrypt(data, password) {
    try {
      const key = await this.deriveKey(password, this.APP_SALT);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(JSON.stringify(data))
      );
      // Kombiner IV + krypteret data → base64
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      return btoa(String.fromCharCode(...combined));
    } catch(e) {
      console.error('Kryptering fejlede:', e);
      return null;
    }
  },

  // Dekrypter data
  async decrypt(encryptedBase64, password) {
    try {
      const key = await this.deriveKey(password, this.APP_SALT);
      const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch(e) {
      console.error('Dekryptering fejlede:', e);
      return null;
    }
  },

  // Hash adgangskode (SHA-256 + salt) til sammenligning
  async hashPassword(password, username) {
    const enc = new TextEncoder();
    const data = enc.encode(password + username + this.APP_SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
};

// ── FIREBASE REST API ──
const FB = {
  baseURL: FB_CONFIG.databaseURL,
  token: null,

  // Sæt auth token
  setToken(t) { this.token = t; },

  // Byg URL med auth
  url(path) {
    const auth = this.token ? `?auth=${this.token}` : '';
    return `${this.baseURL}/${path}.json${auth}`;
  },

  // Læs data
  async get(path) {
    try {
      const res = await fetch(this.url(path));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch(e) {
      console.error(`FB.get(${path}) fejlede:`, e);
      return null;
    }
  },

  // Skriv data (overskriver)
  async set(path, data) {
    try {
      const res = await fetch(this.url(path), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.ok;
    } catch(e) {
      console.error(`FB.set(${path}) fejlede:`, e);
      return false;
    }
  },

  // Tilføj data (auto-ID)
  async push(path, data) {
    try {
      const res = await fetch(this.url(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.ok ? await res.json() : null;
    } catch(e) {
      console.error(`FB.push(${path}) fejlede:`, e);
      return null;
    }
  },

  // Opdater specifikt felt
  async update(path, data) {
    try {
      const res = await fetch(this.url(path), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.ok;
    } catch(e) {
      console.error(`FB.update(${path}) fejlede:`, e);
      return false;
    }
  },

  // Slet data
  async delete(path) {
    try {
      const res = await fetch(this.url(path), { method: 'DELETE' });
      return res.ok;
    } catch(e) {
      console.error(`FB.delete(${path}) fejlede:`, e);
      return false;
    }
  }
};

// ── LOKAL PERSISTENCE (backup når offline) ──
const LOCAL = {
  prefix: 'fh_',

  save(key, data) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(data));
    } catch(e) {
      console.warn('localStorage fuld:', e);
    }
  },

  load(key, fallback = null) {
    try {
      const val = localStorage.getItem(this.prefix + key);
      return val ? JSON.parse(val) : fallback;
    } catch(e) {
      return fallback;
    }
  },

  remove(key) {
    localStorage.removeItem(this.prefix + key);
  },

  // Gem alle app-data lokalt
  saveAll(appData) {
    const keys = ['events','lists','memories','chatMessages','feedItems','hentePlan','weekPlan','countdown','users'];
    keys.forEach(k => {
      if (appData[k] !== undefined) this.save(k, appData[k]);
    });
  },

  // Indlæs alle app-data
  loadAll() {
    return {
      events:       this.load('events', []),
      lists:        this.load('lists', { shopping: [], todo: [], packing: [] }),
      memories:     this.load('memories', []),
      chatMessages: this.load('chatMessages', []),
      feedItems:    this.load('feedItems', []),
      hentePlan:    this.load('hentePlan', {}),
      weekPlan:     this.load('weekPlan', {}),
      countdown:    this.load('countdown', null),
      users:        this.load('users', null)
    };
  }
};

// ── DATA MANAGER (Firebase + Lokal fallback) ──
const DATA = {
  online: false,

  // Tjek om vi er online
  async checkOnline() {
    try {
      const res = await fetch(FB.url('ping'), { method: 'GET' });
      this.online = res.ok || res.status === 401;
    } catch(e) {
      this.online = false;
    }
    return this.online;
  },

  // Gem data — prøv Firebase, gem altid lokalt
  async save(path, data) {
    LOCAL.save(path.replace(/\//g, '_'), data);
    if (this.online) {
      await FB.set(path, data);
    }
  },

  // Indlæs data — prøv Firebase, fallback til lokal
  async load(path, fallback = null) {
    if (this.online) {
      const fbData = await FB.get(path);
      if (fbData !== null) {
        LOCAL.save(path.replace(/\//g, '_'), fbData);
        return fbData;
      }
    }
    return LOCAL.load(path.replace(/\//g, '_'), fallback);
  }
};

// ── PUSH NOTIFIKATIONER ──
const PUSH = {
  supported: 'serviceWorker' in navigator && 'PushManager' in window,
  vapidKey: 'DIN_VAPID_PUBLIC_KEY', // Generer på: web-push-codelab.glitch.me

  async requestPermission() {
    if (!this.supported) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  async subscribe() {
    if (!this.supported) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidKey)
      });
      // Gem subscription i Firebase
      await FB.set(`pushSubscriptions/${btoa(sub.endpoint).slice(0,20)}`, JSON.parse(JSON.stringify(sub)));
      return sub;
    } catch(e) {
      console.error('Push subscription fejlede:', e);
      return null;
    }
  },

  // Send in-app notifikation (badge + toast)
  sendInApp(type, message, tab) {
    // Opdater badge tæller
    if (typeof updateBadge === 'function') updateBadge(tab);
    // Vis toast hvis appen er åben
    if (typeof showToast === 'function') showToast(message);
  },

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }
};

// ── FIREBASE SIKKERHEDSREGLER ──
// Kopier disse regler ind i Firebase Console → Realtime Database → Regler
// De sikrer at kun autentificerede brugere kan læse/skrive data
const FB_SECURITY_RULES = `
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    "users": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth.uid === $uid || root.child('users').child(auth.uid).child('role').val() === 'admin'"
      }
    },
    "events": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "feedItems": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "chatMessages": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "loginLog": {
      ".read": "root.child('users').child(auth.uid).child('role').val() === 'admin'",
      ".write": "auth != null"
    },
    "pushSubscriptions": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
`;

console.log('[FamilieHub] Firebase + Kryptering indlæst ✅');
