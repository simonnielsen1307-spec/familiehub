// ════════════════════════════════════════════════
// FamilieHub — børnene: opgaver, point, ønsker, børnekort, fødselsdage
// ════════════════════════════════════════════════

// ── DAGLIGE OPGAVER ──
// done gemmes som dato (YYYY-MM-DD) → opgaverne nulstilles automatisk hver dag
let opgaveChild = 'august';
let opgaver = { august: [], oskar: [] };

function seedOpgaver() {
  return {
    august: ['Ryd værelse', 'Lav lektier', 'Børste tænder', 'Pakke skoletaske'].map((t, i) => ({ id: 1000 + i, tekst: t, done: null })),
    oskar:  ['Ryd legetøj', 'Børste tænder', 'Vask hænder'].map((t, i) => ({ id: 2000 + i, tekst: t, done: null }))
  };
}

const opgaveDone = o => o.done === today();

function switchOpgave(barn, el) {
  opgaveChild = barn;
  document.querySelectorAll('.opgave-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderOpgaver();
}

function renderOpgaver() {
  const el = document.getElementById('opgaveListe');
  const score = document.getElementById('opgaveScore');
  if (!el) return;
  const liste = opgaver[opgaveChild] || [];
  const done = liste.filter(opgaveDone).length;
  const pct = liste.length ? Math.round((done / liste.length) * 100) : 0;

  el.innerHTML = liste.length ? liste.map(o => `
    <div class="list-item ${opgaveDone(o) ? 'checked' : ''}">
      <div class="list-checkbox ${opgaveDone(o) ? 'on-green' : ''}" onclick="toggleOpgave(${o.id})">${opgaveDone(o) ? '✓' : ''}</div>
      <div class="list-item-text" onclick="toggleOpgave(${o.id})">${esc(o.tekst)}</div>
      <div class="list-delete" onclick="sletOpgave(${o.id})">✕</div>
    </div>`).join('') : '<div class="empty-small">Ingen opgaver — tilføj nogle nedenfor</div>';

  if (score) {
    const stjerner = pct === 100 ? '⭐⭐⭐' : pct >= 66 ? '⭐⭐' : pct >= 33 ? '⭐' : '–';
    score.textContent = `${done}/${liste.length} klaret ${stjerner}`;
  }
}

function toggleOpgave(id) {
  const liste = opgaver[opgaveChild] || [];
  const o = liste.find(x => String(x.id) === String(id));
  if (!o) return;
  o.done = opgaveDone(o) ? null : today();
  renderOpgaver();
  if (liste.length && liste.every(opgaveDone)) showToast('🌟 Alle opgaver klaret! Fantastisk!');
}

function sletOpgave(id) {
  opgaver[opgaveChild] = (opgaver[opgaveChild] || []).filter(x => String(x.id) !== String(id));
  renderOpgaver();
}

function addOpgave() {
  const input = document.getElementById('opgaveInput');
  const tekst = input.value.trim();
  if (!tekst) return;
  if (!opgaver[opgaveChild]) opgaver[opgaveChild] = [];
  opgaver[opgaveChild].push({ id: uid(), tekst, done: null });
  input.value = '';
  renderOpgaver();
}

function nulstilOpgaver() {
  if (!confirm('Nulstil dagens opgaver?')) return;
  (opgaver[opgaveChild] || []).forEach(o => { o.done = null; });
  renderOpgaver();
  showToast('🔄 Opgaver nulstillet!');
}

// ── FAMILIEPUNKTER ──
let point = { august: 0, oskar: 0 };
let beloenninger = [];

function seedBeloenninger() {
  return [
    { id: 1001, tekst: 'Vælge aftensmad', point: 5 },
    { id: 1002, tekst: 'Ekstra skærmtid (30 min)', point: 10 },
    { id: 1003, tekst: 'Is i dag', point: 8 },
    { id: 1004, tekst: 'Vælge weekendaktivitet', point: 20 },
  ];
}

function justerPoint(barn, antal) {
  point[barn] = Math.max(0, (Number(point[barn]) || 0) + antal);
  renderPoint();
  if (antal > 0) showToast(`⭐ +${antal} point til ${barn === 'august' ? 'August' : 'Oskar'}!`);
}

function renderPoint() {
  const aug = document.getElementById('pointAugust');
  const osk = document.getElementById('pointOskar');
  if (aug) aug.textContent = point.august || 0;
  if (osk) osk.textContent = point.oskar || 0;
  renderBeloenninger();
}

function renderBeloenninger() {
  const el = document.getElementById('beloenningListe');
  if (!el) return;
  el.innerHTML = beloenninger.map(b => `
    <div class="list-item">
      <div style="font-size:20px">🎁</div>
      <div class="list-item-text">${esc(b.tekst)}</div>
      <div class="list-item-cat">${esc(b.point)} ⭐</div>
      <div class="list-actions">
        <button class="mini-btn" onclick="indloesBeloenning(${b.id},'august')" title="August indløser">🎒</button>
        <button class="mini-btn" onclick="indloesBeloenning(${b.id},'oskar')" title="Oskar indløser">🧸</button>
        <div class="list-delete" onclick="sletBeloenning(${b.id})">✕</div>
      </div>
    </div>`).join('') || '<div class="empty-small">Ingen belønninger endnu</div>';
}

function addBeloenning() {
  const input = document.getElementById('beloenningInput');
  const tekst = input.value.trim();
  if (!tekst) return;
  const match = tekst.match(/(\d+)\s*(point|p)?\s*$/i) || tekst.match(/(\d+)\s*point/i);
  const pt = match ? parseInt(match[1], 10) : 10;
  const ren = tekst.replace(/[=:\-–]?\s*\d+\s*(point|p)?\s*$/i, '').trim() || tekst;
  beloenninger.push({ id: uid(), tekst: ren, point: pt });
  input.value = '';
  renderBeloenninger();
}

function sletBeloenning(id) {
  beloenninger = beloenninger.filter(b => String(b.id) !== String(id));
  renderBeloenninger();
}

function indloesBeloenning(id, barn) {
  const b = beloenninger.find(x => String(x.id) === String(id));
  if (!b) return;
  const navn = barn === 'august' ? 'August' : 'Oskar';
  if ((point[barn] || 0) < b.point) { showToast(`${navn} mangler ${b.point - (point[barn] || 0)} point`); return; }
  if (!confirm(`${navn} indløser "${b.tekst}" for ${b.point} point?`)) return;
  point[barn] -= b.point;
  renderPoint();
  showToast(`🎉 ${navn} har indløst: ${b.tekst}`);
}

// ── ØNSKESEDDEL ──
let onsker = [];

function addOnske() {
  const navn = document.getElementById('onskeNavn').value.trim();
  const hvem = document.getElementById('onskeHvem').value;
  const link = safeUrl(document.getElementById('onskeLink').value);
  if (!navn) { showToast('Skriv hvad du ønsker'); return; }
  onsker.push({ id: uid(), navn, hvem, link, by: currentUser.uid });
  document.getElementById('onskeNavn').value = '';
  document.getElementById('onskeLink').value = '';
  renderOnsker();
  showToast('🎁 Ønske tilføjet!');
}

function renderOnsker() {
  const el = document.getElementById('onskerListe');
  if (!el) return;
  if (!onsker.length) { el.innerHTML = '<div class="empty-small">Ingen ønsker endnu</div>'; return; }
  const grouped = {};
  onsker.forEach(o => { (grouped[o.hvem] = grouped[o.hvem] || []).push(o); });
  el.innerHTML = Object.entries(grouped).map(([hvem, liste]) => `
    <div style="margin-bottom:12px">
      <div class="section-label">${esc(hvem)}</div>
      ${liste.map(o => `
        <div class="onske-item">
          <div class="onske-navn">${esc(o.navn)}
            ${o.link && safeUrl(o.link) ? `<div><a href="${esc(safeUrl(o.link))}" target="_blank" rel="noopener" class="onske-link">🔗 Se link</a></div>` : ''}
          </div>
          <div class="x-btn" onclick="sletOnske(${o.id})">✕</div>
        </div>`).join('')}
    </div>`).join('');
}

function sletOnske(id) {
  onsker = onsker.filter(o => String(o.id) !== String(id));
  renderOnsker();
}

// ── BØRNEKORT ──
function defaultBoernekort() {
  return {
    august: { toej: '', sko: '', allergi: '', venner: '', institution: 'Skole', note: '' },
    oskar:  { toej: '', sko: '', allergi: '', venner: '', institution: 'Børnehave', note: '' }
  };
}

function fixBoernekort(v) {
  const d = defaultBoernekort();
  return { august: { ...d.august, ...(v?.august || {}) }, oskar: { ...d.oskar, ...(v?.oskar || {}) } };
}

let boernekort = defaultBoernekort();

function renderBoernekort() {
  ['august', 'oskar'].forEach(barn => {
    const el = document.getElementById(barn + 'Kort');
    if (!el) return;
    const k = boernekort[barn] || {};
    const rows = [
      ['👕 Tøjstørrelse', k.toej], ['👟 Skostørrelse', k.sko], ['⚠️ Allergier', k.allergi || 'Ingen'],
      ['👫 Bedste venner', k.venner], ['🏫 Institution', k.institution], ['📝 Note', k.note],
    ];
    el.innerHTML = rows.map(([label, value]) => `
      <div class="boern-info-row">
        <div class="boern-info-label">${label}</div>
        <div class="boern-info-value">${esc(value || '–')}</div>
      </div>`).join('');
  });
}

function editBoernekort(barn) {
  const k = boernekort[barn] || {};
  document.getElementById('bkBarn').value = barn;
  document.getElementById('boernekortModalTitle').textContent = barn === 'august' ? '🎒 August — Info' : '🧸 Oskar — Info';
  const map = { bkToej: 'toej', bkSko: 'sko', bkAllergi: 'allergi', bkVenner: 'venner', bkInstitution: 'institution', bkNote: 'note' };
  Object.entries(map).forEach(([id, f]) => { document.getElementById(id).value = k[f] || ''; });
  openModal('boernekortModal');
}

function saveBoernekort() {
  const barn = document.getElementById('bkBarn').value;
  boernekort[barn] = {
    toej: document.getElementById('bkToej').value.trim(),
    sko: document.getElementById('bkSko').value.trim(),
    allergi: document.getElementById('bkAllergi').value.trim(),
    venner: document.getElementById('bkVenner').value.trim(),
    institution: document.getElementById('bkInstitution').value.trim(),
    note: document.getElementById('bkNote').value.trim(),
  };
  renderBoernekort();
  closeModal('boernekortModal');
  showToast('✅ Børnekort gemt!');
}

// ── FØDSELSDAGE ──
// dato gemmes som DDMM, aar som fødselsår (valgfrit)
let foedseldage = [];

function seedFoedseldage() {
  return [
    ['Simon', '1307', '👑', 1987], ['Marlene', '0101', '🌸', 1990], ['August', '1505', '🎒', 2016],
    ['Oskar', '2209', '🧸', 2019], ['Bedstemor Lene', '0603', '👵', 1955], ['Bedstefar Erik', '1408', '👴', 1953],
    ['Mormor Hanne', '2311', '👵', 1957], ['Morfar Torben', '0502', '👴', 1955], ['Martin', '1709', '👨', 1985],
    ['Karina', '2806', '👩', 1992],
  ].map(([navn, dato, emoji, aar], i) => ({ id: 1001 + i, navn, dato, emoji, aar }));
}

function naesteFoedselsdag(f, now = new Date()) {
  const dag = parseInt(f.dato.slice(0, 2), 10);
  const mdr = parseInt(f.dato.slice(2, 4), 10) - 1;
  const idag = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), mdr, dag);
  if (next < idag) next = new Date(now.getFullYear() + 1, mdr, dag);
  const dage = Math.round((next - idag) / 86400000);
  const alder = f.aar ? next.getFullYear() - f.aar : null;
  return { next, dage, alder };
}

function renderFoedseldage() {
  const el = document.getElementById('foedslerListe');
  if (!el) return;
  const sorted = foedseldage.filter(f => /^\d{4}$/.test(f.dato || ''))
    .map(f => ({ ...f, ...naesteFoedselsdag(f) }))
    .sort((a, b) => a.dage - b.dage);

  if (!sorted.length) { el.innerHTML = '<div class="empty-small">Ingen fødselsdage endnu</div>'; return; }

  el.innerHTML = sorted.map(f => {
    const dagStr = `${f.dato.slice(0, 2)}-${f.dato.slice(2, 4)}`;
    let badge;
    if (f.dage === 0) badge = `<div class="foedsdag-badge foedsdag-today">🎉 I DAG!</div>`;
    else if (f.dage <= 7) badge = `<div class="foedsdag-badge foedsdag-soon">om ${f.dage} ${f.dage === 1 ? 'dag' : 'dage'}</div>`;
    else badge = `<div class="foedsdag-badge foedsdag-normal">${dagStr}</div>`;
    const sub = f.alder ? `${dagStr} · ${f.dage === 0 ? 'Fylder' : 'Fylder'} ${f.alder} år` : dagStr;
    return `
      <div class="foedsdag-item" onclick="openFoedseldagModal(${f.id})">
        <div class="foedsdag-avatar">${esc(f.emoji || '🎂')}</div>
        <div style="flex:1">
          <div class="foedsdag-name">${esc(f.navn)}</div>
          <div class="foedsdag-date">${sub}</div>
        </div>
        ${badge}
      </div>`;
  }).join('');
}

let editFoedseldagId = null;

function openFoedseldagModal(id = null) {
  editFoedseldagId = id;
  const f = id ? foedseldage.find(x => String(x.id) === String(id)) : null;
  document.getElementById('fdNavn').value = f?.navn || '';
  document.getElementById('fdEmoji').value = f?.emoji || '';
  document.getElementById('fdDato').value = f
    ? `${f.aar || 2000}-${f.dato.slice(2, 4)}-${f.dato.slice(0, 2)}` : '';
  document.getElementById('fdUkendtAar').checked = f ? !f.aar : false;
  document.getElementById('fdSletBtn').style.display = f ? 'block' : 'none';
  openModal('foedseldagModal');
}

function saveFoedseldag() {
  const navn = document.getElementById('fdNavn').value.trim();
  const dato = document.getElementById('fdDato').value;
  const emoji = document.getElementById('fdEmoji').value.trim() || '🎂';
  const ukendt = document.getElementById('fdUkendtAar').checked;
  if (!navn || !dato) { showToast('Udfyld navn og dato'); return; }
  const [y, m, d] = dato.split('-');
  const rec = { navn, dato: d + m, emoji, aar: ukendt ? null : parseInt(y, 10) };
  if (editFoedseldagId) {
    const f = foedseldage.find(x => String(x.id) === String(editFoedseldagId));
    if (f) Object.assign(f, rec);
  } else {
    foedseldage.push({ id: uid(), ...rec });
  }
  renderFoedseldage();
  checkTodayBirthday();
  closeModal('foedseldagModal');
  showToast(`🎂 ${navn} gemt!`);
}

function sletFoedseldag() {
  if (!editFoedseldagId || !confirm('Slet fødselsdagen?')) return;
  foedseldage = foedseldage.filter(x => String(x.id) !== String(editFoedseldagId));
  renderFoedseldage();
  checkTodayBirthday();
  closeModal('foedseldagModal');
}

function checkTodayBirthday() {
  const banner = document.getElementById('birthdayBanner');
  if (!banner) return;
  const now = new Date();
  const imDag = pad2(now.getDate()) + pad2(now.getMonth() + 1);
  const dagens = foedseldage.filter(f => f.dato === imDag);
  if (!dagens.length) { banner.style.display = 'none'; return; }
  banner.style.display = 'block';
  banner.innerHTML = `
    <div class="birthday-banner">
      <div style="font-size:40px">🎂</div>
      <div>
        <div class="birthday-title">Tillykke med fødselsdagen!</div>
        <div class="birthday-sub">${esc(dagens.map(f => f.navn).join(' & '))} har fødselsdag i dag! 🎉</div>
      </div>
    </div>`;
}
