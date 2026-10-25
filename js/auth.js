// ════════════════════════════════════════════════
// FamilieHub — login, roller og brugeradministration
// ════════════════════════════════════════════════
// Login sker via Firebase Authentication. Ingen adgangskoder i koden.
// Roller ligger i family/members/<uid>/role: admin | family | extended
// Databasereglerne (database.rules.json) håndhæver rollerne på serveren.

const ROLE_LABELS = { admin: '👑 Admin', family: '🏠 Familie', extended: '👴 Udvidet familie' };
const ROLE_COLORS = { admin: '#fff3e0', family: '#e8f5e9', extended: '#e3f2fd' };
const AVATARS = ['👑','🌸','👨','👩','👵','👴','👦','👧','🧑','👶','🐻','🦊','🐱','🐶','🌻','⭐'];
const USER_COLORS = ['#f4845f','#f48fb1','#7db87a','#6baed6','#b39ddb','#ffd54f','#ff7043','#4db6ac'];

let membersUnsub = null;
let bootstrapMode = false;

const emailFor = u => {
  const s = String(u || '').trim().toLowerCase();
  return s.includes('@') ? s : `${s}@${USERNAME_DOMAIN}`;
};

const usernameFromEmail = e => String(e || '').endsWith('@' + USERNAME_DOMAIN)
  ? String(e).split('@')[0] : String(e || '');

function authErrorText(err) {
  const c = String(err?.code || '');
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-email'))
    return 'Forkert brugernavn eller adgangskode';
  if (c.includes('too-many-requests')) return 'For mange forsøg — vent lidt og prøv igen';
  if (c.includes('network')) return 'Ingen forbindelse — tjek internettet';
  if (c.includes('email-already-in-use')) return 'Brugernavnet er allerede taget';
  if (c.includes('weak-password')) return 'Adgangskoden skal være mindst 6 tegn';
  if (c.includes('requires-recent-login')) return 'Log ud og ind igen, og prøv så igen';
  if (c.includes('operation-not-allowed')) return 'Login med e-mail/adgangskode er ikke slået til i Firebase';
  return 'Noget gik galt (' + (c || err?.message || 'ukendt') + ')';
}

function setLoginError(msg) {
  const el = document.getElementById('loginErr');
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
}

function setLoginBusy(busy) {
  const btn = document.getElementById('loginBtn');
  btn.disabled = busy;
  btn.textContent = busy ? 'Logger ind…' : (bootstrapMode ? 'Opret admin-konto 👑' : 'Log ind 🚀');
}

// ── LOGIN ──
async function doLogin() {
  if (bootstrapMode) return doBootstrap();
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  if (!u || !p) { setLoginError('Udfyld brugernavn og adgangskode'); return; }
  setLoginError('');
  setLoginBusy(true);
  try {
    sessionStorage.setItem('fh4_justLoggedIn', '1');
    await FH.S.signInWithEmailAndPassword(FH.auth, emailFor(u), p);
    document.getElementById('loginPass').value = '';
  } catch (e) {
    sessionStorage.removeItem('fh4_justLoggedIn');
    setLoginError(authErrorText(e));
  }
  setLoginBusy(false);
}

async function forgotPassword() {
  const u = document.getElementById('loginUser').value.trim();
  if (!u.includes('@')) {
    setLoginError('Har du et brugernavn (uden @), så bed Simon om at nulstille din kode.');
    return;
  }
  try {
    await FH.S.sendPasswordResetEmail(FH.auth, u);
    setLoginError('');
    showToast('📧 Mail med nulstilling er sendt');
  } catch (e) { setLoginError(authErrorText(e)); }
}

// ── FØRSTE OPSÆTNING: opret første admin ──
function toggleBootstrap(on) {
  bootstrapMode = on;
  document.getElementById('bootstrapFields').style.display = on ? 'block' : 'none';
  document.getElementById('bootstrapLink').style.display = on ? 'none' : 'inline';
  document.getElementById('loginTitleSmall').textContent = on ? 'Første opsætning — opret admin' : '';
  setLoginError('');
  setLoginBusy(false);
}

async function doBootstrap() {
  const u = document.getElementById('loginUser').value.trim().toLowerCase();
  const p = document.getElementById('loginPass').value;
  const name = document.getElementById('bootName').value.trim();
  if (!u || !p || !name) { setLoginError('Udfyld brugernavn, adgangskode og navn'); return; }
  if (p.length < 8) { setLoginError('Brug mindst 8 tegn til admin-koden'); return; }
  setLoginBusy(true);
  let cred = null;
  try {
    sessionStorage.setItem('fh4_bootstrap', '1');
    cred = await FH.S.createUserWithEmailAndPassword(FH.auth, emailFor(u), p);
    await FH.S.set(FH.ref('family/members/' + cred.user.uid), {
      username: u.includes('@') ? u.split('@')[0] : u,
      email: u.includes('@') ? u : null,
      name, role: 'admin', avatar: '👑', color: '#f4845f', created: Date.now()
    });
    sessionStorage.removeItem('fh4_bootstrap');
    sessionStorage.setItem('fh4_justLoggedIn', '1');
    toggleBootstrap(false);
    // onAuthStateChanged kører videre herfra
    handleUser(cred.user);
  } catch (e) {
    sessionStorage.removeItem('fh4_bootstrap');
    if (cred) {
      // Der findes allerede en admin → slet den netop oprettede konto igen
      try { await FH.S.deleteUser(cred.user); } catch (x) { await FH.S.signOut(FH.auth); }
      setLoginError('Der findes allerede en admin. Log ind med din konto, eller bed admin om at oprette dig.');
    } else {
      setLoginError(authErrorText(e));
    }
  }
  setLoginBusy(false);
}

// ── AUTH-STATUS ──
FH.S.onAuthStateChanged(FH.auth, user => handleUser(user));

let handledUid = null;
function handleUser(user) {
  if (sessionStorage.getItem('fh4_bootstrap')) return; // vent til bootstrap er færdig
  if (!user) {
    handledUid = null;
    if (membersUnsub) { membersUnsub(); membersUnsub = null; }
    stopApp();
    return;
  }
  if (handledUid === user.uid) return;
  handledUid = user.uid;

  // Vis cachet profil med det samme (offline-start)
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem('fh4_profile_' + user.uid) || 'null'); } catch (e) {}
  if (cached) onProfile(user, cached);
  else showScreen('splash');

  // Lyt på min egen profil
  if (membersUnsub) membersUnsub();
  const myUnsub = FH.S.onValue(FH.ref('family/members/' + user.uid), snap => {
    const prof = snap.val();
    if (!prof) {
      // Ingen profil = ingen adgang
      try { localStorage.removeItem('fh4_profile_' + user.uid); } catch (e) {}
      showScreen('login');
      setLoginError('Din konto har ikke adgang endnu. Bed Simon om at give dig adgang.');
      FH.S.signOut(FH.auth);
      return;
    }
    try { localStorage.setItem('fh4_profile_' + user.uid, JSON.stringify(prof)); } catch (e) {}
    onProfile(user, prof);
  }, err => {
    // Ikke medlem (eller adgang fjernet) → databasen afviser læsning
    console.warn('[auth] Profil kunne ikke hentes', err);
    try { localStorage.removeItem('fh4_profile_' + user.uid); } catch (e) {}
    syncForgetUser();
    FH.S.signOut(FH.auth).finally(() => {
      showScreen('login');
      setLoginError('Din konto har ikke adgang. Bed Simon om at give dig adgang.');
    });
  });

  // Lyt på alle medlemmer (navne, telefonnumre, admin-oversigt)
  const allUnsub = FH.S.onValue(FH.ref('family/members'), snap => {
    MEMBERS = snap.val() || {};
    if (currentView === 'admin') safe(renderAdminUserList);
  }, () => {});
  membersUnsub = () => { myUnsub(); allUnsub(); };
}

function onProfile(user, prof) {
  const prevRole = currentUser?.role;
  const wasStarted = appStarted && currentUser?.uid === user.uid;
  currentUser = {
    uid: user.uid,
    email: user.email,
    username: prof.username || usernameFromEmail(user.email),
    name: prof.name || 'Ukendt',
    avatar: prof.avatar || '👤',
    color: prof.color || '#b39ddb',
    role: prof.role || 'extended',
    tlf: prof.tlf || ''
  };

  if (!wasStarted || prevRole !== currentUser.role) {
    syncStart(currentUser);
    startApp();
    PHOTOS.retryUploads();
    if (sessionStorage.getItem('fh4_justLoggedIn')) {
      sessionStorage.removeItem('fh4_justLoggedIn');
      logEvent('ok', 'Logget ind');
    }
  } else {
    // Kun profil ændret (navn/avatar)
    document.getElementById('headerAvatar').textContent = currentUser.avatar;
    document.getElementById('headerUsername').textContent = currentUser.name;
    safe(setWelcome);
  }
}

// ── LOG UD ──
async function doLogout() {
  if (!confirm('Log ud?')) return;
  await logEvent('out', 'Logget ud');
  syncForgetUser();
  try { localStorage.removeItem('fh4_profile_' + currentUser?.uid); } catch (e) {}
  await FH.S.signOut(FH.auth);
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  setLoginError('');
}

// ── LOGIN-LOG ──
async function logEvent(type, detail) {
  if (!currentUser) return;
  try {
    await FH.S.push(FH.ref('family/loginLog'), {
      type, detail, uid: currentUser.uid, name: currentUser.name, ts: Date.now(),
      device: /iphone|ipad/i.test(navigator.userAgent) ? 'iPhone/iPad'
        : /android/i.test(navigator.userAgent) ? 'Android' : 'Computer'
    });
  } catch (e) { /* log er ikke kritisk */ }
}

// ── MIN PROFIL ──
let profilAvatar = null, profilColor = null;

function renderProfil() {
  if (!currentUser) return;
  profilAvatar = currentUser.avatar;
  profilColor = currentUser.color;
  document.getElementById('profilName').value = currentUser.name;
  document.getElementById('profilTlf').value = currentUser.tlf || '';
  document.getElementById('profilUsername').textContent =
    `@${currentUser.username} · ${ROLE_LABELS[currentUser.role] || currentUser.role}`;
  renderPickers('profil', profilAvatar, profilColor);
}

function renderPickers(prefix, avatar, color) {
  const a = document.getElementById(prefix + 'AvatarPicker');
  const c = document.getElementById(prefix + 'ColorPicker');
  if (a) a.innerHTML = AVATARS.map(e =>
    `<div class="emoji-grid-btn ${e === avatar ? 'selected' : ''}" onclick="pickAvatar('${prefix}','${e}',this)">${e}</div>`).join('');
  if (c) c.innerHTML = USER_COLORS.map(col =>
    `<div class="color-opt ${col === color ? 'selected' : ''}" style="background:${col}" onclick="pickUserColor('${prefix}','${col}',this)"></div>`).join('');
}

function pickAvatar(prefix, e, el) {
  if (prefix === 'profil') profilAvatar = e; else editAvatar = e;
  el.parentElement.querySelectorAll('.emoji-grid-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

function pickUserColor(prefix, c, el) {
  if (prefix === 'profil') profilColor = c; else editColor = c;
  el.parentElement.querySelectorAll('.color-opt').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

async function saveProfil() {
  const name = document.getElementById('profilName').value.trim();
  const tlf = document.getElementById('profilTlf').value.trim();
  if (!name) { showToast('Skriv dit navn'); return; }
  try {
    await FH.S.update(FH.ref('family/members/' + currentUser.uid), {
      name, tlf: tlf || null, avatar: profilAvatar, color: profilColor
    });
    showToast('✅ Profil gemt');
  } catch (e) { showToast('⚠️ ' + authErrorText(e)); }
}

async function changeOwnPassword() {
  const cur = document.getElementById('pwCurrent').value;
  const nyt = document.getElementById('pwNew').value;
  const nyt2 = document.getElementById('pwNew2').value;
  if (!cur || !nyt) { showToast('Udfyld felterne'); return; }
  if (nyt.length < 6) { showToast('Mindst 6 tegn'); return; }
  if (nyt !== nyt2) { showToast('De to nye koder er ikke ens'); return; }
  try {
    const user = FH.auth.currentUser;
    const cred = FH.S.EmailAuthProvider.credential(user.email, cur);
    await FH.S.reauthenticateWithCredential(user, cred);
    await FH.S.updatePassword(user, nyt);
    ['pwCurrent', 'pwNew', 'pwNew2'].forEach(id => { document.getElementById(id).value = ''; });
    showToast('🔑 Adgangskode ændret');
  } catch (e) { showToast('⚠️ ' + authErrorText(e)); }
}

// ── ADMIN ──
let currentLogFilter = 'all';
let loginLogCache = [];

function renderAdmin() {
  renderAdminUserList();
  loadLoginLog();
}

function renderAdminUserList() {
  const el = document.getElementById('adminUserList');
  if (!el) return;
  const entries = Object.entries(MEMBERS).sort((a, b) => {
    const order = { admin: 0, family: 1, extended: 2 };
    return (order[a[1].role] - order[b[1].role]) || String(a[1].name).localeCompare(b[1].name, 'da');
  });
  if (!entries.length) {
    el.innerHTML = '<div class="empty-small">Ingen brugere endnu</div>';
    return;
  }
  el.innerHTML = entries.map(([id, u]) => `
    <div class="admin-user-row">
      <div class="admin-user-avatar" style="background:${esc(u.color || '#ccc')}33">${esc(u.avatar || '👤')}</div>
      <div class="admin-user-info">
        <div class="admin-user-name">${esc(u.name)}${id === currentUser.uid ? ' <span class="you-tag">dig</span>' : ''}</div>
        <div class="admin-user-meta">
          <span class="role-chip" style="background:${ROLE_COLORS[u.role] || '#eee'}">${ROLE_LABELS[u.role] || esc(u.role)}</span>
          @${esc(u.username || '')}
        </div>
      </div>
      <button class="admin-edit-btn" onclick="openEditUser('${esc(id)}')">✏️</button>
    </div>
  `).join('');
}

async function loadLoginLog() {
  const el = document.getElementById('adminLogList');
  if (!el) return;
  try {
    const q = FH.S.query(FH.ref('family/loginLog'), FH.S.orderByKey(), FH.S.limitToLast(60));
    const snap = await FH.S.get(q);
    loginLogCache = Object.values(snap.val() || {}).sort((a, b) => b.ts - a.ts);
  } catch (e) {
    el.innerHTML = '<div class="empty-small">Kunne ikke hente loggen</div>';
    return;
  }
  renderAdminLog();
}

function renderAdminLog() {
  const el = document.getElementById('adminLogList');
  if (!el) return;
  const list = currentLogFilter === 'all' ? loginLogCache : loginLogCache.filter(l => l.type === currentLogFilter);
  if (!list.length) { el.innerHTML = '<div class="empty-small">Ingen aktivitet endnu</div>'; return; }
  el.innerHTML = list.slice(0, 40).map(l => `
    <div class="log-entry">
      <div class="log-icon">${l.type === 'ok' ? '✅' : l.type === 'out' ? '🚪' : 'ℹ️'}</div>
      <div class="log-info">
        <div class="log-user">${esc(l.name)}</div>
        <div class="log-detail">${esc(l.detail)}${l.device ? ' · ' + esc(l.device) : ''}</div>
      </div>
      <div class="log-time">${esc(fmtTime(l.ts))}</div>
    </div>`).join('');
}

function showLog(filter, el) {
  currentLogFilter = filter;
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderAdminLog();
}

function openAddUserModal() {
  ['nuUsername', 'nuName', 'nuPass'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('nuRole').value = 'extended';
  openModal('addUserModal');
}

// Opretter brugeren via en separat Firebase-instans, så admin ikke bliver logget ud
async function addUser() {
  const username = document.getElementById('nuUsername').value.trim().toLowerCase();
  const name = document.getElementById('nuName').value.trim();
  const pass = document.getElementById('nuPass').value;
  const role = document.getElementById('nuRole').value;
  if (!username || !name || !pass) { showToast('Udfyld alle felter'); return; }
  if (!username.includes('@') && !/^[a-zæøå0-9._-]{2,30}$/.test(username)) {
    showToast('Brugernavn: kun små bogstaver, tal, . _ -'); return;
  }
  if (pass.length < 6) { showToast('Adgangskoden skal være mindst 6 tegn'); return; }

  const btn = document.getElementById('addUserBtn');
  btn.disabled = true; btn.textContent = 'Opretter…';
  let secApp = null;
  try {
    secApp = FH.S.initializeApp(FB_CONFIG, 'admin-' + Date.now());
    const secAuth = FH.S.initializeAuth(secApp, { persistence: FH.S.inMemoryPersistence });
    const cred = await FH.S.createUserWithEmailAndPassword(secAuth, emailFor(username), pass);
    const newUid = cred.user.uid;
    await FH.S.signOut(secAuth);
    await FH.S.set(FH.ref('family/members/' + newUid), {
      username: username.includes('@') ? username.split('@')[0] : username,
      email: username.includes('@') ? username : null,
      name, role,
      avatar: role === 'extended' ? '👵' : '🧑',
      color: USER_COLORS[Object.keys(MEMBERS).length % USER_COLORS.length],
      created: Date.now(), createdBy: currentUser.uid
    });
    closeModal('addUserModal');
    showToast(`✅ ${name} oprettet — log ind med "${username}"`);
  } catch (e) {
    showToast('⚠️ ' + authErrorText(e));
  } finally {
    if (secApp) FH.S.deleteApp(secApp).catch(() => {});
    btn.disabled = false; btn.textContent = 'Opret bruger';
  }
}

let editUid = null, editAvatar = null, editColor = null;

function openEditUser(id) {
  const u = MEMBERS[id];
  if (!u) return;
  editUid = id;
  editAvatar = u.avatar || '👤';
  editColor = u.color || '#b39ddb';
  document.getElementById('editUserTitle').textContent = `✏️ ${u.name}`;
  document.getElementById('editUserInfo').textContent = `@${u.username || ''}${u.email ? ' · ' + u.email : ''}`;
  document.getElementById('editName').value = u.name || '';
  document.getElementById('editTlf').value = u.tlf || '';
  const roleSel = document.getElementById('editRole');
  roleSel.value = u.role;
  roleSel.disabled = id === currentUser.uid; // admin kan ikke fjerne sin egen admin-rolle
  document.getElementById('deleteUserBtn').style.display = id === currentUser.uid ? 'none' : 'block';
  document.getElementById('resetPwInfo').style.display = id === currentUser.uid ? 'none' : 'block';
  renderPickers('edit', editAvatar, editColor);
  openModal('editUserModal');
}

async function saveUserEdit() {
  const name = document.getElementById('editName').value.trim();
  if (!name) { showToast('Navn mangler'); return; }
  const upd = {
    name, avatar: editAvatar, color: editColor,
    tlf: document.getElementById('editTlf').value.trim() || null
  };
  if (editUid !== currentUser.uid) upd.role = document.getElementById('editRole').value;
  try {
    await FH.S.update(FH.ref('family/members/' + editUid), upd);
    closeModal('editUserModal');
    showToast(`✅ ${name} opdateret`);
  } catch (e) { showToast('⚠️ ' + authErrorText(e)); }
}

async function sendResetForUser() {
  const u = MEMBERS[editUid];
  if (!u?.email) {
    showToast('Brugeren har intet e-mail. Slet og opret igen med ny kode.');
    return;
  }
  try {
    await FH.S.sendPasswordResetEmail(FH.auth, u.email);
    showToast('📧 Nulstillingsmail sendt til ' + u.email);
  } catch (e) { showToast('⚠️ ' + authErrorText(e)); }
}

async function deleteUser() {
  const u = MEMBERS[editUid];
  if (!u || editUid === currentUser.uid) return;
  if (!confirm(`Fjern ${u.name}s adgang? De kan ikke længere logge ind i appen.`)) return;
  try {
    await FH.S.remove(FH.ref('family/members/' + editUid));
    closeModal('editUserModal');
    showToast(`🗑️ ${u.name} har ikke længere adgang`);
  } catch (e) { showToast('⚠️ ' + authErrorText(e)); }
}

// ── RING TIL FAMILIEN ──
function ringTilFamilien() {
  const list = Object.entries(MEMBERS)
    .filter(([id, m]) => id !== currentUser?.uid)
    .sort((a, b) => String(a[1].name).localeCompare(b[1].name, 'da'));
  const el = document.getElementById('ringListe');
  el.innerHTML = list.length ? list.map(([, m]) => {
    const tel = String(m.tlf || '').replace(/[^\d+]/g, '');
    return `
      <div class="ring-row">
        <div class="admin-user-avatar" style="background:${esc(m.color || '#ccc')}33">${esc(m.avatar || '👤')}</div>
        <div style="flex:1">
          <div class="admin-user-name">${esc(m.name)}</div>
          <div class="admin-user-meta">${tel ? esc(m.tlf) : 'Intet nummer'}</div>
        </div>
        ${tel ? `<a class="ring-btn" href="tel:${esc(tel)}">📞 Ring</a>` : ''}
      </div>`;
  }).join('') : '<div class="empty-small">Ingen andre brugere endnu</div>';
  openModal('ringModal');
}

// Enter i login-felter
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('loginScreen').style.display !== 'none' &&
      e.target.closest && e.target.closest('#loginScreen')) {
    doLogin();
  }
});
