// ════════════════════════════════════════════════
// FamilieHub — stemning, vagtplan, feriemode, ugens højdepunkt
// ════════════════════════════════════════════════

// ── STEMNINGSVEJR ──
let stemninger = {};   // { 'YYYY-MM-DD': { uid: { emoji, tekst, navn } } }

function saetStemning(emoji, tekst) {
  const dato = today();
  if (!stemninger[dato]) stemninger[dato] = {};
  stemninger[dato][currentUser.uid] = { emoji, tekst, navn: currentUser.name };
  // Ryd dage ældre end 14 dage
  const graense = new Date(); graense.setDate(graense.getDate() - 14);
  const g = dateKey(graense);
  Object.keys(stemninger).forEach(d => { if (d < g) delete stemninger[d]; });
  renderStemningOversigt();
  renderHomeStemning();
  showToast(`${emoji} Stemning gemt!`);
}

function renderStemningOversigt() {
  const el = document.getElementById('stemningOversigt');
  if (!el) return;
  const dagens = stemninger[today()] || {};
  const mine = currentUser ? dagens[currentUser.uid] : null;
  document.querySelectorAll('.stemning-btn').forEach(b =>
    b.classList.toggle('valgt', !!mine && b.dataset.emoji === mine.emoji));
  const entries = Object.values(dagens);
  if (!entries.length) {
    el.innerHTML = '<div class="empty-small">Ingen har sat stemning endnu i dag</div>';
    return;
  }
  el.innerHTML = entries.map(s => `
    <div class="stemning-familie-row">
      <div style="font-size:32px">${esc(s.emoji)}</div>
      <div>
        <div class="row-title">${esc(s.navn)}</div>
        <div class="row-sub">${esc(s.tekst)}</div>
      </div>
    </div>`).join('');
}

function renderHomeStemning() {
  const el = document.getElementById('homeStemning');
  if (!el) return;
  const entries = Object.values(stemninger[today()] || {});
  if (!entries.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = `
    <div class="card" style="margin-bottom:16px" onclick="switchView('stemning')">
      <div class="card-title">🌤️ Familiens stemning</div>
      <div class="home-stemning-row">
        ${entries.map(s => `<div class="home-stemning-chip">${esc(s.emoji)} ${esc(s.navn)}</div>`).join('')}
      </div>
    </div>`;
}

// ── VAGT & FRIPLAN ──
let vagtPlan = {};
const VAGT_TYPER = ['Fri', 'Dagvagt', 'Aftenvagt', 'Nattevagt', 'Hjemmedag'];
const VAGT_PERSONER = [{ key: 'simon', navn: 'Simon' }, { key: 'marlene', navn: 'Marlene' }];

function renderVagtPlan() {
  const el = document.getElementById('vagtPlan');
  if (!el) return;
  const dage = ['Man','Tir','Ons','Tor','Fre','Lør','Søn'];
  el.innerHTML = dage.map(dag => VAGT_PERSONER.map((p, i) => `
    <div class="vagt-row" ${i ? 'style="border-top:none;padding-top:0"' : ''}>
      <div class="vagt-dag">${i ? '' : dag}</div>
      <div class="vagt-navn">${p.navn}</div>
      <select class="vagt-select" onchange="gemVagt('${p.key}','${dag}',this.value)">
        ${VAGT_TYPER.map(t => `<option ${(vagtPlan[p.key]?.[dag] || 'Fri') === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
    </div>`).join('')).join('<hr class="soft-hr">');
}

function gemVagt(person, dag, type) {
  if (!vagtPlan[person]) vagtPlan[person] = {};
  vagtPlan[person][dag] = type;
}

// ── FERIEMODE ──
let ferieMode = false;

function renderFerieMode() {
  const el = document.getElementById('ferieModeIndhold');
  if (!el) return;
  if (ferieMode) {
    el.innerHTML = `
      <div class="ferie-banner">
        <div style="font-size:56px;margin-bottom:12px">🏖️</div>
        <div class="ferie-titel">Feriemode er aktiv!</div>
        <div style="font-size:14px;opacity:0.8;margin-bottom:20px">Slap af og nyd ferien 😊</div>
        <button onclick="toggleFerieMode()" class="ferie-sluk">Sluk feriemode</button>
      </div>
      <div class="card">
        <div class="card-title">📢 Del med familie</div>
        <div class="row-sub" style="margin-bottom:12px">Bedsteforældre kan se at I er på ferie</div>
        <button class="btn-primary" onclick="delFerieIFeed()">📸 Del i Familiefeed</button>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="card" style="text-align:center;padding:30px">
        <div style="font-size:56px;margin-bottom:16px">🏖️</div>
        <div class="ferie-titel">Feriemode</div>
        <div class="row-sub" style="margin-bottom:20px">Viser ferien for hele familien</div>
        <button onclick="toggleFerieMode()" class="btn-primary">🌴 Aktiver feriemode</button>
      </div>`;
  }
}

function toggleFerieMode() {
  ferieMode = !ferieMode;
  renderFerieMode();
  showToast(ferieMode ? '🏖️ Feriemode aktiveret!' : 'Feriemode slukket');
}

function delFerieIFeed() {
  feedItems.unshift(newFeedItem({ text: 'Vi er på ferie! 🏖️ Vi ses snart igen! 👋', greeting: '🏖️' }));
  renderFeed();
  showToast('📸 Delt i Familiefeed!');
}

// ── UGENS HØJDEPUNKT ──
let hojdepunkter = [];

function gemHojdepunkt() {
  const tekst = document.getElementById('hojdepunktText').value.trim();
  if (!tekst) { showToast('Skriv ugens højdepunkt'); return; }
  const d = new Date();
  hojdepunkter.unshift({
    id: uid(), ts: Date.now(),
    tekst,
    uge: getUgeNummer(),
    dato: `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`,
    author: currentUser.name, uid: currentUser.uid
  });
  document.getElementById('hojdepunktText').value = '';
  renderHojdepunkter();
  showToast('🏆 Ugens højdepunkt gemt!');
}

function sletHojdepunkt(id) {
  if (!confirm('Slet højdepunktet?')) return;
  hojdepunkter = hojdepunkter.filter(h => String(h.id) !== String(id));
  renderHojdepunkter();
}

function renderHojdepunkter() {
  const el = document.getElementById('hojdepunktHistorik');
  if (!el) return;
  if (!hojdepunkter.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="section-label">Tidligere højdepunkter</div>` +
    hojdepunkter.map(h => `
      <div class="hojdepunkt-item">
        <div class="row-sub" style="margin-bottom:4px;display:flex">
          <span style="flex:1">Uge ${esc(h.uge)} · ${esc(h.dato)} · ${esc(h.author)}</span>
          ${isMine(h) || currentUser?.role === 'admin' ? `<span class="x-btn" onclick="sletHojdepunkt(${h.id})">✕</span>` : ''}
        </div>
        <div style="font-size:15px;color:var(--text-dark)">${esc(h.tekst)}</div>
      </div>`).join('');
}
