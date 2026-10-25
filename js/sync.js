// ════════════════════════════════════════════════
// FamilieHub — live synkronisering med Firebase
// ════════════════════════════════════════════════
//
// Princip:
//  • Alle data ligger i globale variabler (events, lists, feedItems …) som UI-koden ændrer direkte.
//  • Efter hver brugerhandling sammenligner SYNC.flush() variablerne med sidst synkede tilstand
//    og sender KUN de felter der er ændret (per element) til Firebase. Ingen overskrivning af
//    andres ændringer, og ingen Gem-knap.
//  • Ændringer fra andre kommer ind live via onValue og vises med det samme.
//  • Alt caches i localStorage, så appen starter øjeblikkeligt og virker offline.
//    Ændringer lavet offline gemmes i en kø og sendes når der er net igen.
//
// Struktur i databasen:
//   family/data/<node>     — kun familie (admin + familie)
//   family/shared/<node>   — også udvidet familie (feed, chat, minder, billeder)
//   family/members/<uid>   — brugerprofiler og roller
//   family/meta            — migreringsstatus
//   family/loginLog        — login-log (kun admin kan læse)

const SYNC = {
  nodes: [],
  unsubs: [],
  started: false,
  connected: false,
  pending: [],
  uid: null,
  flushTimer: null,
};

// ── NODE-DEFINITIONER ──
// type: 'coll'   = liste af elementer med id (gemmes som objekt med nøgle i<id>)
//       'groups' = objekt med flere lister (f.eks. lists.shopping/todo/packing)
//       'obj'    = almindelig værdi/objekt
function syncNodeDefs() {
  return [
    // Kun familie
    { key: 'events',       scope: 'data', type: 'coll', sort: 'asc',
      get: () => events, set: v => { events = v; },
      render: () => { renderCalendar(); renderHomeToday(); }, badge: 'kalender' },
    { key: 'lists',        scope: 'data', type: 'groups', groups: ['shopping', 'todo', 'packing'], sort: 'asc',
      get: () => lists, set: v => { lists = v; },
      render: () => { renderList(); updateHomeShoppingCard(); } },
    { key: 'weekPlan',     scope: 'data', type: 'obj', def: () => ({}),
      get: () => weekPlan, set: v => { weekPlan = v; },
      render: () => { renderWeekPlan(); updateMealShopList(); } },
    { key: 'hentePlan',    scope: 'data', type: 'obj', def: defaultHentePlan, fix: fixHentePlan,
      get: () => hentePlan, set: v => { hentePlan = v; },
      render: () => { renderHenteOversigt(); if (currentView === 'familie') renderHentePlan(); } },
    { key: 'boernekort',   scope: 'data', type: 'obj', def: defaultBoernekort, fix: fixBoernekort,
      get: () => boernekort, set: v => { boernekort = v; }, render: () => renderBoernekort() },
    { key: 'foedseldage',  scope: 'data', type: 'coll', sort: 'asc', seed: seedFoedseldage,
      get: () => foedseldage, set: v => { foedseldage = v; },
      render: () => { renderFoedseldage(); checkTodayBirthday(); } },
    { key: 'stemninger',   scope: 'data', type: 'obj', def: () => ({}),
      get: () => stemninger, set: v => { stemninger = v; },
      render: () => { renderStemningOversigt(); renderHomeStemning(); } },
    { key: 'opgaver',      scope: 'data', type: 'groups', groups: ['august', 'oskar'], sort: 'asc', seed: seedOpgaver,
      get: () => opgaver, set: v => { opgaver = v; }, render: () => renderOpgaver() },
    { key: 'point',        scope: 'data', type: 'obj', def: () => ({ august: 0, oskar: 0 }),
      fix: v => ({ august: Number(v?.august) || 0, oskar: Number(v?.oskar) || 0 }),
      get: () => point, set: v => { point = v; }, render: () => renderPoint() },
    { key: 'beloenninger', scope: 'data', type: 'coll', sort: 'asc', seed: seedBeloenninger,
      get: () => beloenninger, set: v => { beloenninger = v; }, render: () => renderBeloenninger() },
    { key: 'onsker',       scope: 'data', type: 'coll', sort: 'asc',
      get: () => onsker, set: v => { onsker = v; }, render: () => renderOnsker() },
    { key: 'vagtPlan',     scope: 'data', type: 'obj', def: () => ({}),
      get: () => vagtPlan, set: v => { vagtPlan = v; }, render: () => renderVagtPlan() },
    { key: 'ferieMode',    scope: 'data', type: 'obj', def: () => false, fix: v => !!v,
      get: () => ferieMode, set: v => { ferieMode = v; }, render: () => renderFerieMode() },
    { key: 'hojdepunkter', scope: 'data', type: 'coll', sort: 'desc',
      get: () => hojdepunkter, set: v => { hojdepunkter = v; }, render: () => renderHojdepunkter() },
    { key: 'countdown',    scope: 'data', type: 'obj', def: () => null,
      get: () => countdown, set: v => { countdown = v; }, render: () => renderCountdownBanner() },

    // Også udvidet familie
    { key: 'feedItems',    scope: 'shared', type: 'coll', sort: 'desc', normalize: normalizeFeedItem,
      get: () => feedItems, set: v => { feedItems = v; },
      render: () => { renderFeed(); if (currentView === 'fotobog') renderFotobog(); }, badge: 'feed' },
    { key: 'chatMessages', scope: 'shared', type: 'coll', sort: 'asc',
      get: () => chatMessages, set: v => { chatMessages = v; }, render: () => renderChat(), badge: 'chat' },
    { key: 'memories',     scope: 'shared', type: 'coll', sort: 'desc',
      get: () => memories, set: v => { memories = v; }, render: () => renderMemories() },
  ];
}

// ── HJÆLPERE: rens, sammenlign, diff ──
const isObj = v => v !== null && typeof v === 'object';

// Fjern undefined/null/tomme objekter (Firebase gemmer dem ikke alligevel)
function syncClean(v) {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'function') return undefined;
  if (Array.isArray(v)) {
    const out = {};
    let any = false;
    v.forEach((x, i) => { const c = syncClean(x); if (c !== undefined) { out[i] = c; any = true; } });
    return any ? out : undefined;
  }
  if (isObj(v)) {
    const out = {};
    let any = false;
    for (const k of Object.keys(v)) {
      if (!k || /[.#$\[\]\/]/.test(k)) continue;           // ugyldige Firebase-nøgler
      const c = syncClean(v[k]);
      if (c !== undefined) { out[k] = c; any = true; }
    }
    return any ? out : undefined;
  }
  return v;
}

function syncEqual(a, b) {
  if (a === b) return true;
  if (!isObj(a) || !isObj(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!syncEqual(a[k], b[k])) return false;
  return true;
}

// Find de mindste ændringer mellem a og b → { 'sti/til/felt': nyVærdi | null }
function syncDiff(a, b, path, out) {
  if (syncEqual(a, b)) return out;
  if (isObj(a) && isObj(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) syncDiff(a[k], b[k], path + '/' + k, out);
  } else {
    out[path] = b === undefined ? null : b;
  }
  return out;
}

const collKey = id => 'i' + id;

function collToRemote(arr) {
  const o = {};
  (Array.isArray(arr) ? arr : []).forEach(it => {
    if (it && it.id !== undefined && it.id !== null) o[collKey(it.id)] = it;
  });
  return o;
}

function sortItems(arr, dir) {
  const k = it => idToMs(it.id) || 0;
  arr.sort((a, b) => (k(a) - k(b)) || (Number(a.id) - Number(b.id)));
  if (dir === 'desc') arr.reverse();
  return arr;
}

// Firebase kan returnere arrays, så tag højde for begge
function collFromRemote(raw, n) {
  if (!raw) return [];
  const vals = Array.isArray(raw) ? raw : Object.values(raw);
  let arr = vals.filter(x => isObj(x)).map(x => JSON.parse(JSON.stringify(x)));
  if (n.normalize) arr = arr.map(n.normalize);
  return sortItems(arr, n.sort);
}

function nodeToRemote(n) {
  const v = n.get();
  if (n.type === 'coll') return collToRemote(v);
  if (n.type === 'groups') {
    const o = {};
    n.groups.forEach(g => { o[g] = collToRemote(v?.[g]); });
    return o;
  }
  return v;
}

function nodeFromRemote(n, raw) {
  if (n.type === 'coll') return collFromRemote(raw, n);
  if (n.type === 'groups') {
    const o = {};
    n.groups.forEach(g => { o[g] = collFromRemote(raw?.[g], n); });
    return o;
  }
  let v = (raw === null || raw === undefined) ? n.def() : JSON.parse(JSON.stringify(raw));
  if (n.fix) v = n.fix(v);
  return v;
}

const nodePath = n => `${n.scope}/${n.key}`;

// ── LOKAL CACHE ──
const LS = {
  key: k => `fh4_${SYNC.uid || 'anon'}_${k}`,
  get(k, fb = null) {
    try { const v = localStorage.getItem(this.key(k)); return v === null ? fb : JSON.parse(v); }
    catch (e) { return fb; }
  },
  set(k, v) {
    try { localStorage.setItem(this.key(k), JSON.stringify(v)); }
    catch (e) { console.warn('[cache] Kunne ikke gemme', k, e); }
  },
  clearUser() {
    try {
      const prefix = `fh4_${SYNC.uid}_`;
      Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }
};

function cacheNode(n) {
  LS.set('c_' + n.key, n.get());
}

// ── FLUSH: send lokale ændringer ──
function syncFlush() {
  if (!SYNC.started) return;
  const ops = {};
  for (const n of SYNC.nodes) {
    let cur;
    try { cur = syncClean(nodeToRemote(n)); } catch (e) { continue; }
    const json = JSON.stringify(cur === undefined ? null : cur);
    if (json === n.lastJson) continue;
    syncDiff(n.synced, cur, nodePath(n), ops);
    n.synced = cur;
    n.lastJson = json;
    cacheNode(n);
  }
  if (Object.keys(ops).length) syncSend(ops);
}

function syncSend(ops) {
  const batch = { id: uid(), ts: Date.now(), ops };
  SYNC.pending.push(batch);
  savePending();
  updateSyncDot();
  FH.S.update(FH.ref('family'), ops)
    .then(() => {
      SYNC.pending = SYNC.pending.filter(b => b.id !== batch.id);
      savePending();
      updateSyncDot();
    })
    .catch(err => {
      console.error('[sync] Gem fejlede:', err, ops);
      SYNC.pending = SYNC.pending.filter(b => b.id !== batch.id);
      savePending();
      updateSyncDot();
      if (String(err?.code || err).includes('PERMISSION')) showToast('⛔ Du har ikke adgang til at ændre det');
      else showToast('⚠️ Kunne ikke gemme — prøv igen');
    });
}

function savePending() {
  LS.set('pending', SYNC.pending);
}

function updateSyncDot() {
  if (!SYNC.connected) setSyncStatus('offline');
  else if (SYNC.pending.length) setSyncStatus('pending');
  else setSyncStatus('ok');
}

// Kør flush lige efter hver brugerhandling (efter onclick-handlere er færdige)
function scheduleFlush() {
  clearTimeout(SYNC.flushTimer);
  SYNC.flushTimer = setTimeout(syncFlush, 0);
}

['click', 'change', 'submit'].forEach(ev => document.addEventListener(ev, scheduleFlush, true));
document.addEventListener('keyup', e => { if (e.key === 'Enter') scheduleFlush(); }, true);
document.addEventListener('visibilitychange', () => { if (document.hidden) syncFlush(); });
window.addEventListener('pagehide', syncFlush);
setInterval(syncFlush, 3000);

// ── BEVAR INDTASTNING NÅR SKÆRMEN TEGNES OM ──
function captureInputs() {
  const vals = {};
  document.querySelectorAll('#app input[id], #app textarea[id]').forEach(el => {
    if (el.type !== 'file' && el.value) vals[el.id] = el.value;
  });
  const ae = document.activeElement;
  const focus = ae && ae.id && /INPUT|TEXTAREA/.test(ae.tagName)
    ? { id: ae.id, s: ae.selectionStart, e: ae.selectionEnd } : null;
  return { vals, focus };
}

function restoreInputs(st) {
  for (const [id, v] of Object.entries(st.vals)) {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = v;
  }
  if (st.focus) {
    const el = document.getElementById(st.focus.id);
    if (el && document.activeElement !== el) {
      el.focus({ preventScroll: true });
      try { el.setSelectionRange(st.focus.s, st.focus.e); } catch (e) {}
    }
  }
}

// ── MODTAG ÆNDRINGER ──
function applyRemote(n, raw) {
  syncFlush(); // send egne ventende ændringer først
  const before = JSON.stringify(n.get());
  const prevIds = n.badge && n.loaded && n.type === 'coll' ? new Set(n.get().map(i => String(i.id))) : null;

  const local = nodeFromRemote(n, raw);
  n.set(local);
  const cur = syncClean(nodeToRemote(n));
  n.synced = cur;
  n.lastJson = JSON.stringify(cur === undefined ? null : cur);
  cacheNode(n);

  if (n.afterLoad) n.afterLoad();

  const changed = JSON.stringify(n.get()) !== before;
  if (changed && appStarted) {
    const st = captureInputs();
    safe(n.render);
    restoreInputs(st);
  }

  if (prevIds) {
    const fresh = n.get().filter(i => !prevIds.has(String(i.id)) && !isMine(i));
    if (fresh.length) {
      bumpBadge(n.badge, fresh.length);
      if (n.key === 'chatMessages' && currentView !== 'chat') showToast(`💬 ${fresh[fresh.length - 1].author}: ${String(fresh[fresh.length - 1].text || '').slice(0, 40)}`);
    }
  }
  n.loaded = true;
}

// ── START / STOP ──
async function syncStart(user) {
  syncStop();
  SYNC.uid = user.uid;
  const ext = user.role === 'extended';
  SYNC.nodes = syncNodeDefs().filter(n => !ext || n.scope === 'shared');

  // 1) Vis cachede data med det samme
  for (const n of SYNC.nodes) {
    const cached = LS.get('c_' + n.key, null);
    if (cached !== null && (n.type !== 'coll' || Array.isArray(cached))) {
      try { n.set(cached); } catch (e) {}
    } else {
      n.set(nodeFromRemote(n, null));
    }
    const cur = syncClean(nodeToRemote(n));
    n.synced = cur;
    n.lastJson = JSON.stringify(cur === undefined ? null : cur);
    n.loaded = false;
  }
  SYNC.pending = LS.get('pending', []).filter(b => Date.now() - b.ts < 14 * 86400000);
  SYNC.started = true;

  // 2) Forbindelsesstatus
  SYNC.unsubs.push(FH.S.onValue(FH.ref('.info/connected'), s => {
    SYNC.connected = !!s.val();
    updateSyncDot();
  }));

  // 3) Send ændringer der ikke nåede frem sidst
  for (const b of SYNC.pending) {
    FH.S.update(FH.ref('family'), b.ops)
      .then(() => { SYNC.pending = SYNC.pending.filter(x => x.id !== b.id); savePending(); updateSyncDot(); })
      .catch(() => { SYNC.pending = SYNC.pending.filter(x => x.id !== b.id); savePending(); updateSyncDot(); });
  }

  // 4) Engangs-migrering fra gammel app (v3)
  if (!ext) {
    try { await migrateLegacy(user); }
    catch (e) { console.warn('[migrering] fejlede:', e); }
  }
  if (!SYNC.started || SYNC.uid !== user.uid) return;

  // 5) Live lyttere
  for (const n of SYNC.nodes) {
    const unsub = FH.S.onValue(FH.ref('family/' + nodePath(n)),
      snap => applyRemote(n, snap.val()),
      err => console.warn('[sync] Lytter fejlede', n.key, err));
    SYNC.unsubs.push(unsub);
  }
}

function syncStop() {
  if (SYNC.started) syncFlush();
  SYNC.unsubs.forEach(u => { try { u(); } catch (e) {} });
  SYNC.unsubs = [];
  SYNC.started = false;
}

// Ved log ud: glem lokale data for brugeren på denne enhed
function syncForgetUser() {
  syncStop();
  LS.clearUser();
  SYNC.uid = null;
}

// ════════════════════════════════════════════════
// MIGRERING FRA v3
// ════════════════════════════════════════════════
// Henter data fra den gamle struktur (rod-noder i databasen + localStorage på denne enhed)
// og fletter dem ind i den nye struktur. Kører én gang per enhed; rod-noderne kun af admin.

const LEGACY_SHARED_ROOT = ['lists', 'feedItems', 'chatMessages', 'memories', 'events', 'weekPlan', 'hentePlan'];

// Demo-data fra den gamle app som ikke skal med
function isLegacyDemo(key, it) {
  if (!it || typeof it !== 'object') return false;
  const small = Number(it.id) > 0 && Number(it.id) < 1000;
  const t = String(it.text || it.title || it.navn || it.tekst || '');
  const demo = {
    events: ['Børnehave — Oskar', 'Skole — August', 'Aftensmad med Bedstemor Lene'],
    shopping: ['Mælk', 'Æbler', 'Kyllingefilet'],
    todo: ['Bestil ferie', 'Ring til læge'],
    memories: ['Oskar sagde sit første sætning', 'Glæder mig så meget til at se August og Oskar'],
    feedItems: ['God morgen alle sammen! August og Oskar er afleveret', 'Havde en fantastisk tur med August i skoven'],
    chatMessages: ['Hvem henter August i dag?', 'Det gør jeg! Jeg er fri kl. 15', 'Vi glæder os til at se drengene i weekenden'],
    opgaver: ['Ryd værelse', 'Lav lektier', 'Børste tænder', 'Pakke skoletaske', 'Ryd legetøj', 'Vask hænder'],
    beloenninger: ['Vælge aftensmad', 'Ekstra skærmtid (30 min)', 'Is i dag', 'Vælge weekendaktivitet'],
  }[key];
  if (!demo) return false;
  const hit = demo.some(d => t.startsWith(d));
  return key === 'chatMessages' ? hit : (small && hit);
}

function legacyLocal(key) {
  try {
    const v = localStorage.getItem('fh_' + key);
    return v === null ? null : JSON.parse(v);
  } catch (e) { return null; }
}

function toArrLoose(v) {
  if (!v) return [];
  return (Array.isArray(v) ? v : Object.values(v)).filter(x => x && typeof x === 'object');
}

// Gør et gammelt element klar til den nye struktur
async function upgradeLegacyItem(key, it, idx) {
  const o = JSON.parse(JSON.stringify(it));
  if (o.id === undefined || o.id === null) {
    // Gamle chatbeskeder havde ingen id — giv et stabilt id der sorterer før nye
    o.id = 1500000000000 + idx;
  }
  if (key === 'chatMessages') delete o.mine;
  if (key === 'feedItems') {
    delete o.reacted;
    if (typeof o.image === 'string' && o.image.startsWith('data:')) {
      try { o.photo = await PHOTOS.saveDataUrl(o.image, { compress: true }); delete o.image; }
      catch (e) { console.warn('[migrering] billede kunne ikke flyttes', e); }
    }
  }
  if (key === 'opgaver') o.done = o.done === true ? null : (o.done || null);
  return o;
}

// Flet lister efter id (eksisterende vinder); chat dedupliceres på indhold
function mergeColl(base, extra, key) {
  const out = [...base];
  const ids = new Set(base.map(i => String(i.id)));
  const sig = i => `${i.author}|${i.text}|${i.time || ''}`;
  const sigs = new Set(base.map(sig));
  for (const it of extra) {
    if (isLegacyDemo(key, it)) continue;
    if (ids.has(String(it.id))) continue;
    if (key === 'chatMessages' && sigs.has(sig(it))) continue;
    out.push(it); ids.add(String(it.id)); sigs.add(sig(it));
  }
  return out;
}

async function migrateLegacy(user) {
  const localFlag = 'fh4_migrated_' + user.uid;
  let localDone = false;
  try { localDone = !!localStorage.getItem(localFlag); } catch (e) {}

  const metaSnap = await FH.S.get(FH.ref('family/meta'));
  const meta = metaSnap.val() || {};
  const doRoot = user.role === 'admin' && !meta.v4;
  const hasLocalLegacy = !localDone && Object.keys(localStorage).some(k => k.startsWith('fh_') && k !== 'fh_version');
  if (!doRoot && !hasLocalLegacy) {
    if (!localDone) try { localStorage.setItem(localFlag, '1'); } catch (e) {}
    return;
  }

  showToast('🔄 Flytter data til den nye version…');
  const updates = {};

  for (const n of SYNC.nodes) {
    const remoteRaw = (await FH.S.get(FH.ref('family/' + nodePath(n)))).val();
    const remoteEmpty = remoteRaw === null || remoteRaw === undefined;
    let sources = [];

    if (doRoot && LEGACY_SHARED_ROOT.includes(n.key)) {
      try { sources.push((await FH.S.get(FH.ref(n.key))).val()); }
      catch (e) { console.warn('[migrering] kunne ikke læse gammel', n.key, e); }
    }
    if (hasLocalLegacy) sources.push(legacyLocal(n.key));
    if (n.key === 'countdown' && hasLocalLegacy) sources.push(legacyLocal('countdown'));
    sources = sources.filter(s => s !== null && s !== undefined);

    let merged;
    if (n.type === 'coll') {
      let base = collFromRemote(remoteRaw, n);
      for (const src of sources) {
        const items = [];
        const arr = toArrLoose(src);
        for (let i = 0; i < arr.length; i++) items.push(await upgradeLegacyItem(n.key, arr[i], i));
        base = mergeColl(base, items, n.key);
      }
      if (remoteEmpty && !base.length && doRoot && n.seed) base = n.seed();
      merged = collToRemote(base);
    } else if (n.type === 'groups') {
      merged = {};
      for (const g of n.groups) {
        let base = collFromRemote(remoteRaw?.[g], n);
        for (const src of sources) {
          const items = [];
          const arr = toArrLoose(src?.[g]);
          for (let i = 0; i < arr.length; i++) items.push(await upgradeLegacyItem(n.key, arr[i], i));
          base = mergeColl(base, items, g === 'shopping' || g === 'todo' ? g : n.key);
        }
        merged[g] = base;
      }
      const allEmpty = n.groups.every(g => !merged[g].length);
      if (allEmpty && remoteEmpty && doRoot && n.seed) {
        const sd = n.seed();
        n.groups.forEach(g => { merged[g] = sd[g] || []; });
      }
      n.groups.forEach(g => { merged[g] = collToRemote(merged[g]); });
    } else {
      if (!remoteEmpty) continue;              // eksisterende data vinder
      let val = sources.find(s => s !== null && s !== undefined && !(isObj(s) && !Object.keys(s).length));
      if (val === undefined && doRoot && n.seed) val = n.seed();
      if (val === undefined) continue;
      if (n.key === 'weekPlan' && isObj(val)) {
        const wk = currentWeekKey();
        for (const d of Object.keys(val)) if (isObj(val[d])) val[d].uge = wk;
      }
      merged = val;
    }

    const cleanMerged = syncClean(merged);
    const cleanRemote = syncClean(remoteRaw);
    if (cleanMerged !== undefined && !syncEqual(cleanMerged, cleanRemote)) {
      updates[nodePath(n)] = cleanMerged;
    }
  }

  if (doRoot) updates['meta/v4'] = { ts: Date.now(), by: user.uid };
  if (Object.keys(updates).length) await FH.S.update(FH.ref('family'), updates);

  // Ryd gamle lokale data på denne enhed
  try {
    Object.keys(localStorage).filter(k => k.startsWith('fh_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem(localFlag, '1');
  } catch (e) {}
  showToast('✅ Dine data er flyttet til den nye version');
}
