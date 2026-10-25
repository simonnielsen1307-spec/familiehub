// ════════════════════════════════════════════════
// FamilieHub — kalender
// ════════════════════════════════════════════════

const COLORS = ['#f4845f','#7db87a','#6baed6','#b39ddb','#f48fb1','#ffd54f','#ff7043'];
let events = [];
let calDate = new Date();
let calSelected = null;       // valgt dag (YYYY-MM-DD) eller null = kommende
let selectedColor = COLORS[0];
let editEventId = null;

function renderCalendar() {
  const grid = document.getElementById('calGrid');
  if (!grid) return;
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const label = calDate.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
  document.getElementById('calMonthLabel').textContent = label.charAt(0).toUpperCase() + label.slice(1);

  const first = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = today();
  const withEvents = new Set(events.map(e => e.date));

  let html = ['Ma','Ti','On','To','Fr','Lø','Sø'].map(d => `<div class="cal-day-name">${d}</div>`).join('');
  for (let i = 0; i < startDay; i++) html += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${pad2(month + 1)}-${pad2(d)}`;
    const cls = ['cal-day'];
    if (ds === todayStr) cls.push('today');
    if (withEvents.has(ds)) cls.push('has-event');
    if (ds === calSelected) cls.push('selected');
    html += `<div class="${cls.join(' ')}" onclick="selectCalDay('${ds}')">${d}</div>`;
  }
  grid.innerHTML = html;
  renderEventList();
}

function selectCalDay(ds) {
  calSelected = calSelected === ds ? null : ds;
  renderCalendar();
}

function renderEventList() {
  const el = document.getElementById('eventList');
  const title = document.getElementById('eventListTitle');
  if (!el) return;
  const t = today();
  let list;
  if (calSelected) {
    list = events.filter(e => e.date === calSelected);
    if (title) title.textContent = '📋 ' + formatDate(calSelected);
  } else {
    list = events.filter(e => e.date >= t);
    if (title) title.textContent = '📋 Kommende aftaler';
  }
  list.sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));

  if (!list.length) {
    el.innerHTML = `<div class="empty-small">${calSelected ? 'Ingen aftaler denne dag' : 'Ingen kommende aftaler'}</div>`;
    return;
  }
  el.innerHTML = list.map(e => `
    <div class="event-list-item" onclick="openEventModal(${e.id})">
      <div class="event-color-bar" style="background:${esc(e.color || COLORS[0])}"></div>
      <div class="event-list-info">
        <div class="event-list-name">${esc(e.title)}</div>
        <div class="event-list-meta">${esc(formatDate(e.date))}${e.time ? ' · ' + esc(e.time) : ''}${e.who ? ' · ' + esc(e.who) : ''}</div>
      </div>
    </div>`).join('');
}

function formatDate(d) {
  const dt = new Date(d + 'T12:00:00');
  const wd = dt.toLocaleDateString('da-DK', { weekday: 'short' });
  return `${wd} ${pad2(dt.getDate())}-${pad2(dt.getMonth() + 1)}-${dt.getFullYear()}`;
}

function changeMonth(dir) {
  calDate = new Date(calDate.getFullYear(), calDate.getMonth() + dir, 1);
  calSelected = null;
  renderCalendar();
}

function initColorPicker(sel = COLORS[0]) {
  selectedColor = sel;
  const cp = document.getElementById('colorPicker');
  cp.innerHTML = COLORS.map(c => `
    <div class="color-opt ${c === sel ? 'selected' : ''}" style="background:${c}" onclick="selectColor('${c}', this)"></div>
  `).join('');
}

function selectColor(c, el) {
  selectedColor = c;
  document.querySelectorAll('#colorPicker .color-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

function openEventModal(id = null) {
  editEventId = id;
  const e = id ? events.find(x => String(x.id) === String(id)) : null;
  document.getElementById('eventModalTitle').textContent = e ? '📅 Rediger aftale' : '📅 Ny aftale';
  document.getElementById('evtTitle').value = e?.title || '';
  document.getElementById('evtDate').value = e?.date || calSelected || today();
  document.getElementById('evtTime').value = e?.time || '';
  document.getElementById('evtWho').value = e?.who || '';
  document.getElementById('evtSletBtn').style.display = e ? 'block' : 'none';
  initColorPicker(e?.color || COLORS[0]);
  openModal('eventModal');
}

function saveEvent() {
  const title = document.getElementById('evtTitle').value.trim();
  const date = document.getElementById('evtDate').value;
  if (!title || !date) { showToast('Udfyld titel og dato'); return; }
  const rec = {
    title, date,
    time: document.getElementById('evtTime').value,
    who: document.getElementById('evtWho').value.trim(),
    color: selectedColor
  };
  if (editEventId) {
    const e = events.find(x => String(x.id) === String(editEventId));
    if (e) Object.assign(e, rec);
  } else {
    events.push({ id: uid(), by: currentUser.uid, ...rec });
  }
  closeModal('eventModal');
  renderCalendar();
  renderHomeToday();
  showToast('✅ Aftale gemt!');
}

function deleteEvent() {
  if (!editEventId || !confirm('Slet aftalen?')) return;
  events = events.filter(x => String(x.id) !== String(editEventId));
  closeModal('eventModal');
  renderCalendar();
  renderHomeToday();
  showToast('🗑️ Aftale slettet');
}
