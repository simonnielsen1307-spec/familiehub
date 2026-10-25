// ════════════════════════════════════════════════
// FamilieHub — forside: nedtælling, dagens aftaler, hentning, familie
// ════════════════════════════════════════════════

// ── NEDTÆLLING ──
const CD_EMOJIS = ['🏖️','✈️','🎄','🎅','🎃','🐣','🎆','🏕️','⛷️','🚢','🎡','🌍','🎠','🎉','🎂','🏔️','🌅','🏄','🎸','⚽'];
let cdSelectedEmoji = '🏖️';
let countdown = null;   // { title, date: 'YYYY-MM-DD', emoji }

function renderCountdownBanner() {
  const el = document.getElementById('countdownBanner');
  if (!el) return;

  if (!countdown || !countdown.date) {
    el.innerHTML = `
      <div class="countdown-add-banner" onclick="openCountdownModal()">
        <div class="countdown-add-icon">⏳</div>
        <div>
          <div class="countdown-add-text">Tilføj en nedtælling</div>
          <div class="countdown-add-sub">Ferie, højtid, udflugter...</div>
        </div>
      </div>`;
    return;
  }

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const [y, m, d] = countdown.date.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const diff = Math.round((target - now) / 86400000);

  let variant = '', daysText, daysLabel;
  if (diff < 0)        { daysText = Math.abs(diff); daysLabel = 'dage siden'; }
  else if (diff === 0) { daysText = '🎉'; daysLabel = 'Det er I DAG!'; variant = 'today-variant'; }
  else if (diff === 1) { daysText = '1'; daysLabel = 'dag tilbage — i morgen!'; variant = 'soon-variant'; }
  else                 { daysText = diff; daysLabel = 'dage tilbage'; if (diff <= 7) variant = 'soon-variant'; }

  const dateStr = `${pad2(d)}-${pad2(m)}-${y}`;
  el.innerHTML = `
    <div class="countdown-banner ${variant}" onclick="openCountdownModal()">
      <button class="countdown-edit-btn" onclick="event.stopPropagation();openCountdownModal()">✏️ Rediger</button>
      <div class="countdown-inner">
        <div class="countdown-emoji">${esc(countdown.emoji)}</div>
        <div class="countdown-text">
          <div class="countdown-label">Nedtælling</div>
          <div class="countdown-title">${esc(countdown.title)}</div>
          <div class="countdown-days-row">
            <div class="countdown-days">${daysText}</div>
            ${daysLabel ? `<div class="countdown-days-label">${daysLabel}</div>` : ''}
          </div>
          <div class="countdown-date-sub">${dateStr}</div>
        </div>
      </div>
    </div>`;
}

function openCountdownModal() {
  cdSelectedEmoji = countdown?.emoji || '🏖️';
  document.getElementById('cdEmojiGrid').innerHTML = CD_EMOJIS.map(e => `
    <div class="emoji-grid-btn ${cdSelectedEmoji === e ? 'selected' : ''}" onclick="selectCdEmoji('${e}', this)">${e}</div>
  `).join('');
  document.getElementById('cdTitle').value = countdown?.title || '';
  document.getElementById('cdDate').value = countdown?.date || '';
  document.getElementById('cdSletBtn').style.display = countdown ? 'block' : 'none';
  openModal('countdownModal');
}

function selectCdEmoji(emoji, el) {
  cdSelectedEmoji = emoji;
  document.querySelectorAll('#cdEmojiGrid .emoji-grid-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

function saveCountdown() {
  const title = document.getElementById('cdTitle').value.trim();
  const date = document.getElementById('cdDate').value;
  if (!title || !date) { showToast('Udfyld navn og dato 😊'); return; }
  countdown = { title, date, emoji: cdSelectedEmoji };
  closeModal('countdownModal');
  renderCountdownBanner();
  showToast('✅ Nedtælling gemt!');
}

function deleteCountdown() {
  if (!confirm('Slet nedtællingen?')) return;
  countdown = null;
  closeModal('countdownModal');
  renderCountdownBanner();
}

// ── DAGENS AFTALER PÅ FORSIDEN ──
function renderHomeToday() {
  const el = document.getElementById('todayEvents');
  if (!el) return;
  const t = today();
  const list = events.filter(e => e.date === t).sort((a, b) => String(a.time || '99').localeCompare(String(b.time || '99')));
  if (!list.length) {
    el.innerHTML = `<div class="empty-small">Ingen aftaler i dag 🌿
      <span class="link" onclick="switchView('kalender'); openEventModal()">+ Tilføj</span></div>`;
    return;
  }
  el.innerHTML = list.map(e => `
    <div class="today-event">
      <div class="event-dot" style="background:${esc(e.color || '#f4845f')}"></div>
      <div class="event-time">${esc(e.time || 'Hele dagen')}</div>
      <div>
        <div class="event-name">${esc(e.title)}</div>
        ${e.who ? `<div class="event-who">${esc(e.who)}</div>` : ''}
      </div>
    </div>`).join('');
}

// ── FAMILIE ──
const FAMILIE = {
  kerne: [
    { id: 'simon',  name: 'Simon',  role: 'Far 👑',        avatar: '👨', color: '#fff3e0', border: '#f4845f', info: { Rolle: 'Far' } },
    { id: 'marlene', name: 'Marlene', role: 'Mor 🌸',       avatar: '👩', color: '#fce4ec', border: '#f48fb1', info: { Rolle: 'Mor' } },
    { id: 'august', name: 'August', role: 'Storebror 🎒',   avatar: '👦', color: '#e3f2fd', border: '#6baed6', info: { Rolle: 'Storebror' } },
    { id: 'oskar',  name: 'Oskar',  role: 'Lillebror 🧸',   avatar: '👶', color: '#e8f5e9', border: '#7db87a', info: { Rolle: 'Lillebror' } },
  ],
  fars: [
    { id: 'lene',   name: 'Bedstemor Lene', role: 'Farmor',       avatar: '👵', color: '#fce4ec', border: '#f48fb1', info: { Side: 'Fars side' } },
    { id: 'erik',   name: 'Bedstefar Erik', role: 'Farfar',       avatar: '👴', color: '#e8f5e9', border: '#7db87a', info: { Side: 'Fars side' } },
    { id: 'martin', name: 'Martin',         role: 'Simons bror',  avatar: '👨', color: '#e3f2fd', border: '#6baed6', info: { Relation: 'Onkel', Kone: 'Sanne', Børn: 'Svend & Viggo' } },
    { id: 'sanne',  name: 'Sanne',          role: 'Martins kone', avatar: '👩', color: '#f3e5f5', border: '#b39ddb', info: { Relation: 'Faster', Mand: 'Martin', Børn: 'Svend & Viggo' } },
    { id: 'svend',  name: 'Svend',          role: 'Fætter',       avatar: '👦', color: '#fff3e0', border: '#f4845f', info: { Forældre: 'Martin & Sanne' } },
    { id: 'viggo',  name: 'Viggo',          role: 'Fætter',       avatar: '👦', color: '#e8f5e9', border: '#7db87a', info: { Forældre: 'Martin & Sanne' } },
  ],
  mors: [
    { id: 'hanne',   name: 'Mormor Hanne',  role: 'Mormor',          avatar: '👵', color: '#fff9c4', border: '#ffd54f', info: { Side: 'Mors side' } },
    { id: 'torben',  name: 'Morfar Torben', role: 'Morfar',          avatar: '👴', color: '#e0f7fa', border: '#80deea', info: { Side: 'Mors side' } },
    { id: 'nikolaj', name: 'Nikolaj',       role: 'Marlenes bror',   avatar: '👨', color: '#e8f5e9', border: '#7db87a', info: { Relation: 'Onkel', Kone: 'Helena', Børn: 'Malthe & Johan' } },
    { id: 'helena',  name: 'Helena',        role: 'Nikolajs kone',   avatar: '👩', color: '#fce4ec', border: '#f48fb1', info: { Relation: 'Moster', Mand: 'Nikolaj', Børn: 'Malthe & Johan' } },
    { id: 'malthe',  name: 'Malthe',        role: 'Fætter',          avatar: '👦', color: '#e3f2fd', border: '#6baed6', info: { Forældre: 'Nikolaj & Helena' } },
    { id: 'johan',   name: 'Johan',         role: 'Fætter',          avatar: '👦', color: '#f3e5f5', border: '#b39ddb', info: { Forældre: 'Nikolaj & Helena' } },
    { id: 'karina',  name: 'Karina',        role: 'Marlenes søster', avatar: '👩', color: '#fff3e0', border: '#f4845f', info: { Relation: 'Moster', Børn: 'Oliver & Sander' } },
    { id: 'oliver',  name: 'Oliver',        role: 'Fætter',          avatar: '👦', color: '#e8f5e9', border: '#7db87a', info: { Forældre: 'Karina' } },
    { id: 'sander',  name: 'Sander',        role: 'Fætter',          avatar: '👦', color: '#e0f7fa', border: '#80deea', info: { Forældre: 'Karina' } },
  ]
};

function renderFamilie() {
  renderFamilieGroup('kerneFamilie', FAMILIE.kerne);
  renderFamilieGroup('farsSide', FAMILIE.fars);
  renderFamilieGroup('morsSide', FAMILIE.mors);
  renderHentePlan();
}

function renderFamilieGroup(elId, members) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = members.map(m => `
    <div class="familie-card" style="border-left-color:${m.border}" onclick="showPerson('${m.id}')">
      <div class="familie-avatar-big" style="background:${m.color}">${m.avatar}</div>
      <div>
        <div class="familie-name">${esc(m.name)}</div>
        <div class="familie-role">${esc(m.role)}</div>
      </div>
    </div>`).join('');
}

function showPerson(id) {
  const p = [...FAMILIE.kerne, ...FAMILIE.fars, ...FAMILIE.mors].find(x => x.id === id);
  if (!p) return;
  // Telefonnummer fra brugerprofil, hvis personen har en konto
  const member = Object.values(MEMBERS).find(m => m.name === p.name || m.username === p.id);
  const info = { ...p.info };
  if (member?.tlf) info.Tlf = member.tlf;
  const fd = foedseldage.find(f => f.navn === p.name);
  if (fd) info['Fødselsdag'] = `${fd.dato.slice(0, 2)}-${fd.dato.slice(2, 4)}${fd.aar ? '-' + fd.aar : ''}`;
  const infoRows = Object.entries(info).filter(([, v]) => v).map(([k, v]) => `
    <div class="person-info-row">
      <div class="person-info-label">${esc(k)}</div>
      <div class="person-info-value">${k === 'Tlf' ? `<a href="tel:${esc(String(v).replace(/[^\d+]/g, ''))}">${esc(v)}</a>` : esc(v)}</div>
    </div>`).join('');
  document.getElementById('personDetail').innerHTML = `
    <div class="person-detail-avatar" style="background:${p.color}">${p.avatar}</div>
    <div class="person-detail-name">${esc(p.name)}</div>
    <div class="person-detail-role">${esc(p.role)}</div>
    ${infoRows ? `<div class="person-detail-info">${infoRows}</div>` : ''}`;
  openModal('personModal');
}

// ── HVEM HENTER ──
const HENTE_PERSONS = ['Simon', 'Marlene', 'Bedstemor Lene', 'Bedstefar Erik', 'Mormor Hanne', 'Morfar Torben', 'Anden'];
const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag'];
const BOERN = {
  august: { navn: 'August', ikon: '🎒', inst: 'Skole',     afl: '08:00', hent: '14:00' },
  oskar:  { navn: 'Oskar',  ikon: '🧸', inst: 'Børnehave', afl: '08:30', hent: '15:00' }
};

function defaultHentePlan() {
  const p = {};
  Object.entries(BOERN).forEach(([k, b]) => {
    p[k] = {};
    DAYS.forEach(d => { p[k][d] = { person: '', time: b.hent }; });
  });
  return p;
}

function fixHentePlan(v) {
  const d = defaultHentePlan();
  Object.keys(d).forEach(k => DAYS.forEach(day => {
    d[k][day] = { ...d[k][day], ...(v?.[k]?.[day] || {}) };
  }));
  return d;
}

let hentePlan = defaultHentePlan();
let currentHenteChild = 'august';

function renderHenteOversigt() {
  const el = document.getElementById('henteOversigtContent');
  if (!el) return;
  const dayName = getDanishDay();
  if (dayName === 'Lørdag' || dayName === 'Søndag') {
    el.innerHTML = `<div class="empty-small" style="text-align:center">🎉 Det er weekend — ingen hentning i dag!</div>`;
    return;
  }
  el.innerHTML = `
    <div class="hente-home-row">
      ${Object.entries(BOERN).map(([k, b]) => {
        const e = hentePlan[k]?.[dayName] || { person: '', time: b.hent };
        return `
        <div class="hente-child-card ${k}">
          <div class="hente-child-label">${b.ikon} ${b.navn}</div>
          <div class="hente-child-institution">${b.inst}</div>
          <div class="hente-section-label">AFLEVERING</div>
          <div class="hente-person-badge">🕗 ${b.afl}</div>
          <div class="hente-section-label">HENTNING</div>
          ${e.person
            ? `<div class="hente-person-badge">🕑 ${esc(e.time)} · 🚗 ${esc(e.person)}</div>`
            : `<div class="hente-not-set">Ikke sat endnu</div>`}
        </div>`;
      }).join('')}
    </div>
    <div class="hente-edit-link" onclick="switchView('familie')">✏️ Rediger ugeplanen</div>`;
}

function switchHenteChild(child, el) {
  currentHenteChild = child;
  document.querySelectorAll('.hente-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderHentePlan();
}

function renderHentePlan() {
  const el = document.getElementById('henteWeek');
  if (!el) return;
  const b = BOERN[currentHenteChild];
  const tider = [];
  for (let h = 6; h <= 18; h++) { tider.push(`${pad2(h)}:00`, `${pad2(h)}:30`); }

  el.innerHTML = DAYS.map(day => {
    const entry = hentePlan[currentHenteChild]?.[day] || { person: '', time: b.hent };
    return `
    <div class="hente-row">
      <div class="hente-day">${day.slice(0, 3)}</div>
      <select class="hente-time-select" onchange="saveHenteTime('${day}', this.value)" aria-label="Tidspunkt ${day}">
        ${tider.map(t => `<option value="${t}" ${entry.time === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <select class="hente-picker" style="flex:1" onchange="saveHente('${day}', this.value)" aria-label="Hvem henter ${day}">
        <option value="">Hvem henter?</option>
        ${HENTE_PERSONS.map(p => `<option value="${p}" ${entry.person === p ? 'selected' : ''}>${p}</option>`).join('')}
      </select>
    </div>`;
  }).join('');
  updateHenteSummary();
}

function saveHente(day, person) {
  hentePlan[currentHenteChild][day].person = person;
  updateHenteSummary();
  renderHenteOversigt();
}

function saveHenteTime(day, time) {
  hentePlan[currentHenteChild][day].time = time;
  renderHenteOversigt();
}

function updateHenteSummary() {
  const el = document.getElementById('henteSummary');
  if (!el) return;
  const plan = hentePlan[currentHenteChild];
  const navn = BOERN[currentHenteChild].navn;
  const idx = Math.max(0, DAYS.indexOf(getDanishDay()));
  const order = [...DAYS.slice(idx), ...DAYS.slice(0, idx)];
  const next = order.find(d => plan[d]?.person);
  el.textContent = next
    ? `Næste: ${next} kl. ${plan[next].time} henter ${plan[next].person} ${navn} 🚗`
    : `Vælg hvem henter ${navn} hver dag 👇`;
}
