// ════════════════════════════════════════════════
// FamilieHub — kerne: hjælpefunktioner, navigation, opstart
// ════════════════════════════════════════════════

let currentUser = null;   // { uid, username, name, avatar, color, role, tlf }
let currentView = 'home';
let MEMBERS = {};         // uid → profil (alle familiemedlemmer)

// ── HJÆLPERE ──
// Escape tekst før den sættes ind i HTML (forhindrer at indhold ødelægger siden)
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Sikker URL til href (kun http/https)
function safeUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  const withProto = /^https?:\/\//i.test(s) ? s : 'https://' + s;
  try { const url = new URL(withProto); return /^https?:$/.test(url.protocol) ? url.href : ''; }
  catch (e) { return ''; }
}

// Unikt numerisk id (tid + tilfældighed) — sikkert i JS-tal
function uid() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

// Tidspunkt (ms) ud fra et id lavet med uid() eller Date.now()
function idToMs(id) {
  const n = Number(id) || 0;
  return n > 1e14 ? Math.floor(n / 1000) : n;
}

const pad2 = n => String(n).padStart(2, '0');

// Dagens dato som YYYY-MM-DD i lokal tid (ikke UTC)
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Mandag i denne uge som YYYY-MM-DD (bruges til ugeplan-nulstilling)
function currentWeekKey() {
  const d = new Date();
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - day);
  return dateKey(d);
}

// "I dag kl. 14:22" / "I går kl. 09:10" / "12-10-2026 kl. 08:00"
function fmtTime(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const diffMin = (now - d) / 60000;
  if (diffMin < 1 && diffMin > -1) return 'Lige nu';
  if (dateKey(d) === dateKey(now)) return `I dag kl. ${hm}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (dateKey(d) === dateKey(y)) return `I går kl. ${hm}`;
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} kl. ${hm}`;
}

// Tid for et opslag: brug ts hvis den findes, ellers gammel tekst
function itemTime(item) {
  return item.ts ? fmtTime(item.ts) : (item.time || '');
}

function getDanishDay() {
  return ['Søndag','Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag'][new Date().getDay()];
}

function getUgeNummer(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

// Antal reaktioner — understøtter både gamle tal og nye {uid:true}
function reactCount(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  return Object.entries(v).reduce((s, [k, x]) => s + (k === '_n' ? (Number(x) || 0) : 1), 0);
}

function hasReacted(v) {
  return !!(v && typeof v === 'object' && currentUser && v[currentUser.uid]);
}

// Slå min reaktion til/fra og returner nyt objekt
function toggleReaction(v) {
  const obj = typeof v === 'number' ? { _n: v } : { ...(v || {}) };
  if (obj[currentUser.uid]) delete obj[currentUser.uid];
  else obj[currentUser.uid] = true;
  return obj;
}

function isMine(item) {
  if (!currentUser) return false;
  if (item.uid) return item.uid === currentUser.uid;
  return item.author === currentUser.name;
}

let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

// Luk modal ved tryk på baggrund eller ESC
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('open')) {
    e.target.classList.remove('open');
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
});

// Kald en render-funktion uden at én fejl stopper resten
function safe(fn) {
  try { fn(); } catch (e) { console.error('[FamilieHub]', e); }
}

// ── BADGES ──
const BADGES = { feed: 0, chat: 0, kalender: 0, home: 0 };

function setBadge(tab, count) {
  BADGES[tab] = count;
  const navId = tab === 'chat' ? 'nav-mere' : `nav-${tab}`;
  const navEl = document.getElementById(navId);
  if (!navEl) return;
  navEl.querySelector('.nav-badge')?.remove();
  const total = tab === 'chat' ? BADGES.chat : count;
  if (total > 0) {
    const b = document.createElement('div');
    b.className = 'nav-badge';
    b.textContent = total > 9 ? '9+' : total;
    navEl.appendChild(b);
  }
}

function bumpBadge(tab, n = 1) {
  if (currentView === tab && !document.hidden) return;
  setBadge(tab, (BADGES[tab] || 0) + n);
}

// ── NAVIGATION ──
const EXTENDED_VIEWS = ['feed', 'chat', 'minder', 'mere', 'profil', 'fotobog'];
const MERE_VIEWS = ['familie','chat','minder','admin','boernekort','foedsler','stemning','opgaver','point',
                    'onsker','vagt','ferie','ugens-hojdepunkt','fotobog','profil'];

function canSee(view) {
  if (!currentUser) return false;
  if (view === 'admin') return currentUser.role === 'admin';
  if (currentUser.role === 'extended') return EXTENDED_VIEWS.includes(view);
  return true;
}

function switchView(view) {
  if (!canSee(view)) return;
  const viewEl = document.getElementById('view-' + view);
  if (!viewEl) return;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  viewEl.classList.add('active');

  const navId = MERE_VIEWS.includes(view) ? 'nav-mere' : 'nav-' + view;
  document.getElementById(navId)?.classList.add('active');

  currentView = view;
  window.scrollTo(0, 0);

  const fab = document.querySelector('.add-event-btn');
  if (fab) fab.style.display = view === 'kalender' ? 'flex' : 'none';

  if (view !== 'kalender') closeModal('eventModal');

  // Opdater visningen når man går ind i den
  const refresh = {
    mere: initMereView, admin: renderAdmin, foedsler: renderFoedseldage, boernekort: renderBoernekort,
    stemning: renderStemningOversigt, opgaver: renderOpgaver, point: renderPoint, onsker: renderOnsker,
    vagt: renderVagtPlan, ferie: renderFerieMode, 'ugens-hojdepunkt': renderHojdepunkter,
    fotobog: renderFotobog, profil: renderProfil, familie: renderFamilie, chat: renderChat,
    feed: renderFeed, minder: renderMemories, home: renderHome, kalender: renderCalendar
  }[view];
  if (refresh) safe(refresh);

  if (view === 'feed' || view === 'chat' || view === 'kalender') setBadge(view, 0);
  if (view === 'chat') setTimeout(scrollChatToBottom, 50);
}

function initMereView() {
  const isAdmin = currentUser?.role === 'admin';
  const isExt = currentUser?.role === 'extended';
  const adminSec = document.getElementById('mereAdminSection');
  if (adminSec) adminSec.style.display = isAdmin ? 'block' : 'none';
  // Udvidet familie ser kun det de har adgang til
  document.querySelectorAll('#view-mere [data-family-only]').forEach(el => {
    el.style.display = isExt ? 'none' : '';
  });
}

// ── VELKOMST ──
function setWelcome() {
  const h = new Date().getHours();
  const greet = h < 10 ? 'God morgen' : h < 12 ? 'God formiddag' : h < 18 ? 'God eftermiddag' : 'God aften';
  const icon = h < 12 ? '☀️' : h < 18 ? '🌤️' : '🌙';
  document.getElementById('welcomeGreeting').textContent = `${greet}, ${currentUser.name}! ${icon}`;
  document.getElementById('welcomeDate').textContent = new Date().toLocaleDateString('da-DK',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── HJEM ──
function renderHome() {
  if (!currentUser || currentUser.role === 'extended') return;
  safe(setWelcome);
  safe(checkTodayBirthday);
  safe(renderHomeStemning);
  safe(renderCountdownBanner);
  safe(renderHenteOversigt);
  safe(renderHomeToday);
  safe(updateHomeShoppingCard);
}

// ── RENDER ALT ──
function renderAll() {
  safe(renderHome);
  safe(renderCalendar);
  safe(renderList);
  safe(renderMemories);
  safe(renderChat);
  safe(renderFeed);
  safe(renderWeekPlan);
  safe(updateMealShopList);
  safe(renderRecipes);
  safe(renderFamilie);
  safe(renderBoernekort);
  safe(renderFoedseldage);
  safe(renderOpgaver);
  safe(renderPoint);
  safe(renderOnsker);
  safe(renderVagtPlan);
  safe(renderFerieMode);
  safe(renderHojdepunkter);
  safe(renderFotobog);
  safe(renderStemningOversigt);
  safe(initMereView);
}

// ── START APP (kaldes af auth.js når brugeren er logget ind) ──
let appStarted = false;

function showScreen(name) {
  document.getElementById('splash').style.display = name === 'splash' ? 'flex' : 'none';
  document.getElementById('loginScreen').style.display = name === 'login' ? 'flex' : 'none';
  document.getElementById('app').style.display = name === 'app' ? 'flex' : 'none';
}

function startApp() {
  document.getElementById('headerAvatar').textContent = currentUser.avatar || '👤';
  document.getElementById('headerUsername').textContent = currentUser.name;
  document.getElementById('feedComposerAvatar').textContent = currentUser.avatar || '👤';

  const ext = currentUser.role === 'extended';
  ['nav-home', 'nav-kalender', 'nav-lister', 'nav-mad'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = ext ? 'none' : '';
  });

  showScreen('app');
  if (!appStarted) {
    appStarted = true;
    safe(initColorPicker);
  }
  renderAll();
  switchView(ext ? 'feed' : (canSee(currentView) ? currentView : 'home'));
}

function stopApp() {
  appStarted = false;
  currentUser = null;
  currentView = 'home';
  showScreen('login');
}

// ── SYNK-STATUS I HEADEREN ──
function setSyncStatus(state) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  const map = {
    ok:      { t: 'Synkroniseret', c: 'ok' },
    pending: { t: 'Gemmer…',       c: 'pending' },
    offline: { t: 'Offline — gemmes når der er net', c: 'offline' }
  };
  const s = map[state] || map.ok;
  el.className = 'sync-dot ' + s.c;
  el.title = s.t;
  el.setAttribute('aria-label', s.t);
}

// ── IOS INSTALLATIONSGUIDE ──
function showIOSInstallGuide() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!isIOS || window.navigator.standalone) return;
  try { if (localStorage.getItem('fh4_install_shown')) return; } catch (e) { return; }
  const guide = document.createElement('div');
  guide.id = 'iosInstallGuide';
  guide.className = 'install-guide';
  guide.innerHTML = `
    <div style="font-size:24px;margin-bottom:8px">📱</div>
    <div class="install-guide-title">Tilføj til hjemskærm</div>
    <div class="install-guide-text">Tryk på <strong>Del</strong> 📤 nederst i Safari,<br>og vælg <strong>"Føj til hjemskærm"</strong> 🏠</div>
    <button class="btn-primary" style="padding:10px" onclick="dismissInstallGuide()">Forstået ✓</button>`;
  document.body.appendChild(guide);
}

function dismissInstallGuide() {
  document.getElementById('iosInstallGuide')?.remove();
  try { localStorage.setItem('fh4_install_shown', '1'); } catch (e) {}
}

// ── SERVICE WORKER + OPDATERING ──
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let refreshing = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    showUpdateBanner();
  });
  navigator.serviceWorker.register('./sw.js').then(reg => {
    // Tjek for opdatering når appen åbnes igen
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(err => console.warn('[SW] Registrering fejlede:', err));
}

function showUpdateBanner() {
  if (document.getElementById('updateBanner')) return;
  const b = document.createElement('div');
  b.id = 'updateBanner';
  b.className = 'update-banner';
  b.innerHTML = `<span>✨ Ny version klar</span><button onclick="location.reload()">Opdater</button>`;
  document.body.appendChild(b);
}

// ── OPSTART ──
document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  setTimeout(showIOSInstallGuide, 3000);
});
