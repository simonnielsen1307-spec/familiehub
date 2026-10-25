// ════════════════════════════════════════════════
// FamilieHub — mad: opskrifter, ugeplan, indkøb fra ugeplan
// ════════════════════════════════════════════════
// Opskrifterne (data/opskrifter.js) er til 4 personer; mængder skaleres efter "Antal personer".

let currentFood = 'opskrifter';
let persons = 4;
let recipeViewMode = 'cards';
let filtreretKategori = 'alle';
let filtreretSøgning = '';
let matchedeOpskrifter = null;
let weekPlan = {};   // { man: { title, ingredients, recipeId, uge }, ... }

const WEEK_DAYS = [
  { key: 'man', label: 'Man' }, { key: 'tir', label: 'Tir' }, { key: 'ons', label: 'Ons' },
  { key: 'tor', label: 'Tor' }, { key: 'fre', label: 'Fre' }, { key: 'lør', label: 'Lør' }, { key: 'søn', label: 'Søn' }
];

// Ret for en dag — kun hvis den hører til denne uge (ugeplanen nulstilles selv hver mandag)
function planFor(day) {
  const p = weekPlan[day];
  return p && p.uge === currentWeekKey() ? p : null;
}

// "400g" × 1,5 → "600g"
function scaleAmount(v, factor) {
  if (!v || factor === 1) return v || '';
  const m = String(v).match(/^([\d.,]+)(\s*)(.*)$/);
  if (!m) return v;
  const n = parseFloat(m[1].replace(',', '.')) * factor;
  const r = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  return `${String(r).replace('.', ',')}${m[2]}${m[3]}`;
}

const ingText = (i, f = 1) => typeof i === 'object' ? `${scaleAmount(i.v, f)} ${i.n}`.trim() : i;
const getIngredientNames = recipe => recipe.ingredienser.map(i => typeof i === 'object' ? i.n : i);

function toggleRecipeView(mode, el) {
  recipeViewMode = mode;
  document.querySelectorAll('.recipe-view-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderRecipes();
}

function switchFood(tab, el) {
  currentFood = tab;
  document.querySelectorAll('.food-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('foodOpskrifter').style.display = tab === 'opskrifter' ? 'block' : 'none';
  document.getElementById('foodPlan').style.display = tab === 'plan' ? 'block' : 'none';
  document.getElementById('foodShop').style.display = tab === 'shop' ? 'block' : 'none';
  if (tab === 'shop') updateMealShopList();
  if (tab === 'plan') renderWeekPlan();
}

function changePersons(dir) {
  persons = Math.max(1, Math.min(12, persons + dir));
  document.getElementById('personsCount').textContent = persons;
  renderRecipes();
}

function filterCat(kat, el) {
  filtreretKategori = kat;
  matchedeOpskrifter = null;
  document.querySelectorAll('.recipe-cat-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderRecipes();
}

function filterRecipes() {
  filtreretSøgning = document.getElementById('recipeSearch').value.toLowerCase().trim();
  matchedeOpskrifter = null;
  renderRecipes();
}

function renderRecipes() {
  const el = document.getElementById('recipeList');
  if (!el) return;
  let liste = matchedeOpskrifter || OPSKRIFTER;
  if (filtreretKategori !== 'alle' && !matchedeOpskrifter) liste = liste.filter(r => r.kategori === filtreretKategori);
  if (filtreretSøgning) {
    liste = liste.filter(r => r.navn.toLowerCase().includes(filtreretSøgning) ||
      getIngredientNames(r).some(i => i.toLowerCase().includes(filtreretSøgning)));
  }
  if (!liste.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-text">Ingen opskrifter fundet 🍽️</div></div>`;
    return;
  }
  const f = persons / 4;

  if (recipeViewMode === 'list') {
    el.innerHTML = `<div class="card" style="padding:8px 16px">` + liste.map(r => `
      <div class="recipe-row">
        <div class="recipe-row-emoji">${r.emoji}</div>
        <div style="flex:1">
          <div class="recipe-row-name">${esc(r.navn)}</div>
          <div class="recipe-row-meta">⏱ ${r.tid} · ${r.sværhed}${r.matchPct ? ` · ✅ ${r.matchPct}%` : ''}</div>
        </div>
        <div class="recipe-row-add" onclick="addToPlanFromDB(${r.id})" aria-label="Tilføj til ugeplan">＋</div>
      </div>`).join('') + `</div>`;
    return;
  }

  el.innerHTML = liste.map(r => {
    const ingVis = r.ingredienser.slice(0, 3).map(i => ingText(i, f)).join(' · ');
    return `
    <div class="recipe-card">
      ${r.billede ? `<img class="recipe-img" src="${r.billede}" alt="" onerror="this.style.display='none'" loading="lazy">` : ''}
      <div style="padding:14px">
        ${r.matchPct ? `<div class="recipe-match-badge">✅ ${r.matchPct}% match</div>` : ''}
        <div class="recipe-name">${r.emoji} ${esc(r.navn)}</div>
        <div class="recipe-meta"><span>⏱ ${r.tid}</span><span>📊 ${r.sværhed}</span><span>👥 ${persons} pers.</span></div>
        <div class="recipe-ingredients">${esc(ingVis)}${r.ingredienser.length > 3 ? ` · +${r.ingredienser.length - 3} mere` : ''}</div>
        <div class="recipe-actions">
          <button class="btn-recipe-plan" onclick="addToPlanFromDB(${r.id})">+ Ugeplanen</button>
          <button class="btn-recipe-expand" onclick="toggleSteps(${r.id})">📋 Vis opskrift</button>
        </div>
        <div class="recipe-steps" id="steps-${r.id}">
          <div class="section-label">Ingredienser (${persons} pers.)</div>
          ${r.ingredienser.map(i => `<div class="recipe-ing-row">${esc(ingText(i, f))}</div>`).join('')}
          <div class="section-label" style="margin-top:10px">Fremgangsmåde</div>
          ${r.fremgangsmåde.map((s, i) => `
            <div class="recipe-step"><span class="recipe-step-num">${i + 1}.</span><span>${esc(s)}</span></div>`).join('')}
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleSteps(id) {
  document.getElementById('steps-' + id)?.classList.toggle('open');
}

function addToPlanFromDB(id) {
  const recipe = OPSKRIFTER.find(r => r.id === id);
  if (!recipe) return;
  // Første ledige dag fra i dag og frem; ellers første ledige i ugen
  const idx = (new Date().getDay() + 6) % 7;
  const order = [...WEEK_DAYS.slice(idx), ...WEEK_DAYS.slice(0, idx)];
  const free = order.find(d => !planFor(d.key));
  if (!free) { showToast('Ugeplanen er fuld — fjern en dag først'); return; }
  weekPlan[free.key] = { title: recipe.navn, recipeId: recipe.id, ingredients: recipe.ingredienser, uge: currentWeekKey(), persons };
  renderWeekPlan();
  updateMealShopList();
  showToast(`✅ ${recipe.navn} → ${free.label}`);
}

function matchRecipesFromFridge() {
  const tekst = document.getElementById('fridgeText2').value.toLowerCase().trim();
  if (!tekst) { showToast('Skriv hvad du har i køleskabet 🧊'); return; }
  const varer = tekst.split(/[,\n]/).map(v => v.trim()).filter(Boolean);
  const scored = OPSKRIFTER.map(r => {
    const navne = getIngredientNames(r).map(n => n.toLowerCase());
    const hits = navne.filter(n => varer.some(v => n.includes(v) || v.includes(n)));
    return { ...r, matchPct: Math.round((hits.length / navne.length) * 100) };
  }).filter(r => r.matchPct > 0).sort((a, b) => b.matchPct - a.matchPct);

  matchedeOpskrifter = scored;
  renderRecipes();
  showToast(scored.length ? `✅ Fandt ${scored.length} opskrifter der matcher!` : 'Ingen opskrifter matcher dine varer 😕');
}

function clearFridgeMatch() {
  matchedeOpskrifter = null;
  document.getElementById('fridgeText2').value = '';
  renderRecipes();
}

function generateShoppingFromPlan() {
  switchFood('shop');
}

function renderWeekPlan() {
  const el = document.getElementById('weekPlan');
  if (!el) return;
  const todayIdx = (new Date().getDay() + 6) % 7;
  el.innerHTML = WEEK_DAYS.map((d, i) => {
    const p = planFor(d.key);
    return `
    <div class="week-day-card ${i === todayIdx ? 'is-today' : ''}">
      <div class="week-day-name">${d.label}</div>
      <div class="week-day-meal">${p ? `<span>${esc(p.title)}</span>` : '<span class="week-day-empty">Ingen ret planlagt</span>'}</div>
      <div class="week-day-icon">${p ? `<span class="x-btn" onclick="removePlan('${d.key}')">✕</span>` : '🍽️'}</div>
    </div>`;
  }).join('');
}

function removePlan(day) {
  delete weekPlan[day];
  renderWeekPlan();
  updateMealShopList();
}

// Sammenlæg mængder med samme enhed: ["400g","200g"] → "600g"
function sumMængder(mængder) {
  if (!mængder.length) return '';
  if (mængder.length === 1) return mængder[0];
  const parsed = mængder.map(m => {
    const match = String(m).match(/^([\d.,]+)(\s*)(.*)$/);
    return match ? { tal: parseFloat(match[1].replace(',', '.')), sep: match[2], enhed: match[3].trim() } : null;
  });
  if (parsed.every(Boolean) && new Set(parsed.map(p => p.enhed)).size === 1) {
    const total = parsed.reduce((s, p) => s + p.tal, 0);
    const t = Number.isInteger(total) ? total : String(Math.round(total * 10) / 10).replace('.', ',');
    return `${t}${parsed[0].sep}${parsed[0].enhed}`.trim();
  }
  return mængder.join(' + ');
}

let mealShopItems = [];

function updateMealShopList() {
  const el = document.getElementById('mealShopList');
  if (!el) return;
  const planlagte = WEEK_DAYS.map(d => planFor(d.key)).filter(Boolean);
  if (!planlagte.length) {
    mealShopItems = [];
    el.innerHTML = '<div class="empty-small" style="text-align:center">Tilføj opskrifter til ugeplanen først 🍽️</div>';
    return;
  }
  const merged = {};
  planlagte.forEach(ret => {
    const f = (ret.persons || persons) / 4;
    (ret.ingredients || []).forEach(ing => {
      const obj = typeof ing === 'object' ? ing : { v: '', n: ing };
      const key = obj.n.toLowerCase().trim();
      if (!merged[key]) merged[key] = { n: obj.n, mængder: [], retter: [] };
      if (obj.v) merged[key].mængder.push(scaleAmount(obj.v, f));
      if (!merged[key].retter.includes(ret.title)) merged[key].retter.push(ret.title);
    });
  });
  mealShopItems = Object.values(merged).map(i => ({ ...i, mængde: sumMængder(i.mængder), har: false }));
  renderMealShopList();
}

function renderMealShopList() {
  const el = document.getElementById('mealShopList');
  el.innerHTML = `
    <div class="row-sub" style="margin-bottom:12px">✅ Mængder er lagt sammen på tværs af ugens retter. Sæt hak ved det du har hjemme.</div>
    ${mealShopItems.map((ing, i) => `
      <div class="list-item ${ing.har ? 'checked' : ''}">
        <div class="list-checkbox ${ing.har ? 'on-green' : ''}" onclick="toggleShopIng(${i})">${ing.har ? '✓' : ''}</div>
        <div class="list-item-text" onclick="toggleShopIng(${i})">${ing.mængde ? `<strong>${esc(ing.mængde)}</strong> ` : ''}${esc(ing.n)}</div>
        <div class="${ing.retter.length > 1 ? 'tag-orange' : 'tag-light'}">${ing.retter.length > 1 ? ing.retter.length + ' retter' : esc(ing.retter[0] || '')}</div>
      </div>`).join('')}
    <div class="btn-col">
      <button class="btn-primary" onclick="addMealShopToList()">🛒 Læg i fælles indkøbsliste</button>
      <button class="btn-cancel" onclick="exportShoppingList()">📋 Kopier som tekst</button>
    </div>`;
}

function toggleShopIng(i) {
  if (!mealShopItems[i]) return;
  mealShopItems[i].har = !mealShopItems[i].har;
  renderMealShopList();
}

function addMealShopToList() {
  const mangler = mealShopItems.filter(i => !i.har);
  if (!mangler.length) { showToast('Du har det hele ✅'); return; }
  const eksisterende = new Set((lists.shopping || []).filter(i => !i.checked).map(i => i.text.toLowerCase()));
  let n = 0;
  mangler.forEach(i => {
    const text = `${i.mængde ? i.mængde + ' ' : ''}${i.n}`;
    if (eksisterende.has(text.toLowerCase())) return;
    lists.shopping.push({ id: uid(), text, checked: false, cat: '🍽️ Ugeplan', by: currentUser.uid });
    n++;
  });
  renderList();
  showToast(`🛒 ${n} varer lagt i indkøbslisten`);
}

function exportShoppingList() {
  const liste = mealShopItems.filter(i => !i.har).map(i => `• ${i.mængde ? i.mængde + ' ' : ''}${i.n}`).join('\n');
  if (!liste) { showToast('Ingen varer mangler — alt er tjekket af! ✅'); return; }
  navigator.clipboard?.writeText(liste)
    .then(() => showToast('📋 Indkøbsliste kopieret!'))
    .catch(() => showToast('Kunne ikke kopiere'));
}
