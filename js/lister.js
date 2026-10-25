// ════════════════════════════════════════════════
// FamilieHub — lister (indkøb, huskeliste, pakkeliste)
// ════════════════════════════════════════════════

let lists = { shopping: [], todo: [], packing: [] };
let currentList = 'shopping';

const LIST_PLACEHOLDER = { shopping: 'Tilføj vare...', todo: 'Tilføj til huskelisten...', packing: 'Tilføj til pakkelisten...' };

function switchList(list, el) {
  currentList = list;
  document.querySelectorAll('.list-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('listInput').placeholder = LIST_PLACEHOLDER[list];
  renderList();
}

function renderList() {
  const container = document.getElementById('listItems');
  const empty = document.getElementById('listEmpty');
  if (!container) return;
  const items = lists[currentList] || [];
  // Ikke-afkrydsede øverst
  const sorted = [...items.filter(i => !i.checked), ...items.filter(i => i.checked)];
  empty.style.display = items.length ? 'none' : 'block';
  container.innerHTML = sorted.map(item => `
    <div class="list-item ${item.checked ? 'checked' : ''}">
      <div class="list-checkbox" onclick="toggleItem(${item.id})">${item.checked ? '✓' : ''}</div>
      <div class="list-item-text" onclick="toggleItem(${item.id})">${esc(item.text)}</div>
      ${item.cat ? `<div class="list-item-cat">${esc(item.cat)}</div>` : ''}
      <div class="list-delete" onclick="deleteItem(${item.id})">✕</div>
    </div>`).join('');
  const done = items.filter(i => i.checked).length;
  const clr = document.getElementById('listClearDone');
  if (clr) {
    clr.style.display = done ? 'block' : 'none';
    clr.textContent = `🧹 Fjern ${done} afkrydsede`;
  }
  updateHomeShoppingCard();
}

function addListItem() {
  const input = document.getElementById('listInput');
  const text = input.value.trim();
  if (!text) return;
  // Flere varer på én gang adskilt med komma
  text.split(/\s*,\s*/).filter(Boolean).forEach(t => {
    lists[currentList].push({ id: uid(), text: t, checked: false, by: currentUser.uid });
  });
  input.value = '';
  input.focus();
  renderList();
}

function toggleItem(id) {
  const item = (lists[currentList] || []).find(i => String(i.id) === String(id));
  if (item) { item.checked = !item.checked; renderList(); }
}

function deleteItem(id) {
  lists[currentList] = (lists[currentList] || []).filter(i => String(i.id) !== String(id));
  renderList();
}

function clearDoneItems() {
  lists[currentList] = (lists[currentList] || []).filter(i => !i.checked);
  renderList();
}

function updateHomeShoppingCard() {
  const el = document.getElementById('homeShoppingList');
  if (!el) return;
  const unchecked = (lists.shopping || []).filter(i => !i.checked);
  if (!unchecked.length) { el.textContent = 'Ingen varer mangler ✅'; return; }
  const items = unchecked.slice(0, 5).map(i => `<div class="home-shop-row">• ${esc(i.text)}</div>`);
  if (unchecked.length > 5) items.push(`<div class="home-shop-more">+${unchecked.length - 5} mere...</div>`);
  el.innerHTML = items.join('');
}
