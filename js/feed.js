// ════════════════════════════════════════════════
// FamilieHub — familiefeed, minder, chat og fotobog
// ════════════════════════════════════════════════

const FEED_HILSNER = ['❤️','😊','🎉','🥰','😂','🙏','🌸','👏','💪','🤗','😘','🌟','🎂','☀️','🌈','🦋'];
const FEED_REACTIONS = ['❤️','😊','🎉','😂','🥰'];

let feedItems = [];
let memories = [];
let chatMessages = [];

let feedPhotoData = null;     // komprimeret billede klar til at blive delt
let feedSelectedEmoji = null;
let feedPosting = false;

// Sikrer at alle felter findes (data fra gamle versioner kan mangle felter)
function normalizeFeedItem(item) {
  return {
    ...item,
    author:    item.author || 'Ukendt',
    avatar:    item.avatar || '👤',
    avatarBg:  item.avatarBg || 'var(--beige)',
    reactions: item.reactions && typeof item.reactions === 'object' ? item.reactions : {},
    comments:  Array.isArray(item.comments) ? item.comments.filter(Boolean)
             : item.comments && typeof item.comments === 'object' ? Object.values(item.comments).filter(Boolean) : [],
  };
}

// ── FEED ──
function renderFeed() {
  const el = document.getElementById('feedList');
  if (!el) return;
  if (currentUser) document.getElementById('feedComposerAvatar').textContent = currentUser.avatar;

  if (!feedItems.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🌟</div>
      <div class="empty-state-text">Ingen opslag endnu</div>
      <div class="empty-state-sub">Vær den første til at dele noget!</div>
    </div>`;
    return;
  }

  el.innerHTML = feedItems.map(raw => {
    const item = normalizeFeedItem(raw);
    const mine = isMine(item);
    const canDelete = mine || currentUser?.role === 'admin';
    return `
    <div class="feed-post" id="fpost-${item.id}">
      <div class="feed-post-header">
        <div class="feed-post-avatar" style="background:${esc(item.avatarBg)}">${esc(item.avatar)}</div>
        <div style="flex:1">
          <div class="feed-post-author">${esc(item.author)}</div>
          <div class="feed-post-time">${esc(itemTime(item))}</div>
        </div>
        ${canDelete ? `<button class="icon-btn" onclick="deleteFeedItem(${item.id})" aria-label="Slet opslag">🗑️</button>` : ''}
      </div>

      ${PHOTOS.html(item)}

      <div class="feed-post-body">
        ${item.greeting ? `<span class="feed-post-greeting">${esc(item.greeting)}</span>` : ''}
        ${item.text ? `<div class="feed-post-text">${esc(item.text)}</div>` : ''}
      </div>

      <div class="feed-post-reactions">
        ${FEED_REACTIONS.map(e => {
          const n = reactCount(item.reactions[e]);
          return `<button class="feed-reaction ${hasReacted(item.reactions[e]) ? 'reacted' : ''}"
            onclick="reactFeed(${item.id}, '${e}')">${e} ${n || ''}</button>`;
        }).join('')}
      </div>

      <div class="feed-comment-section">
        ${item.comments.map(c => `
          <div class="feed-comment">
            <div class="feed-comment-avatar" style="background:${esc(c.avatarBg || 'var(--beige)')}">${esc(c.avatar || '👤')}</div>
            <div class="feed-comment-bubble">
              <div class="feed-comment-name">${esc(c.author || '')}</div>
              <div class="feed-comment-text">${esc(c.text || '')}</div>
            </div>
          </div>
        `).join('')}
        <div class="feed-add-comment">
          <div class="feed-comment-avatar" style="background:${esc(currentUser?.color || '#ccc')}22">${esc(currentUser?.avatar || '👤')}</div>
          <input class="feed-comment-input" id="fcomment-${item.id}" placeholder="Skriv en kommentar..."
            enterkeyhint="send" onkeydown="if(event.key==='Enter')addFeedComment(${item.id})">
          <button class="feed-comment-send" onclick="addFeedComment(${item.id})" aria-label="Send">➤</button>
        </div>
      </div>
    </div>`;
  }).join('');
  PHOTOS.hydrate(el);
}

function findFeed(id) {
  return feedItems.find(f => String(f.id) === String(id));
}

function reactFeed(id, emoji) {
  const item = findFeed(id);
  if (!item) return;
  if (!item.reactions || typeof item.reactions !== 'object') item.reactions = {};
  item.reactions[emoji] = toggleReaction(item.reactions[emoji]);
  renderFeed();
}

function addFeedComment(id) {
  const input = document.getElementById('fcomment-' + id);
  const text = input?.value.trim();
  if (!text) return;
  const item = findFeed(id);
  if (!item) return;
  if (!Array.isArray(item.comments)) item.comments = normalizeFeedItem(item).comments;
  item.comments.push({
    uid: currentUser.uid,
    author: currentUser.name,
    avatar: currentUser.avatar,
    avatarBg: currentUser.color + '33',
    text, ts: Date.now()
  });
  input.value = '';
  renderFeed();
}

function deleteFeedItem(id) {
  const item = findFeed(id);
  if (!item || !confirm('Slet opslaget?')) return;
  if (item.photo) PHOTOS.remove(item.photo);
  feedItems = feedItems.filter(f => String(f.id) !== String(id));
  renderFeed();
  showToast('🗑️ Opslag slettet');
}

async function handleFeedPhoto(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const box = document.getElementById('feedPhotoPreviewBox');
  const img = document.getElementById('feedPhotoPreviewImg');
  box.style.display = 'block';
  box.classList.add('busy');
  try {
    feedPhotoData = await PHOTOS.compressFile(file);
    img.src = feedPhotoData;
  } catch (e) {
    feedPhotoData = null;
    box.style.display = 'none';
    showToast('Kunne ikke læse billedet');
  }
  box.classList.remove('busy');
}

function clearFeedPhoto() {
  feedPhotoData = null;
  document.getElementById('feedPhotoPreviewBox').style.display = 'none';
  document.getElementById('feedPhotoPreviewImg').removeAttribute('src');
}

function pickFeedEmoji() {
  const picker = document.getElementById('feedEmojiPicker');
  if (picker.style.display !== 'none') { picker.style.display = 'none'; return; }
  document.getElementById('feedEmojiRow').innerHTML = FEED_HILSNER.map(e =>
    `<div class="feed-emoji-opt ${feedSelectedEmoji === e ? 'selected' : ''}" onclick="selectFeedEmoji('${e}')">${e}</div>`).join('');
  picker.style.display = 'block';
}

function selectFeedEmoji(emoji) {
  feedSelectedEmoji = feedSelectedEmoji === emoji ? null : emoji;
  document.getElementById('feedEmojiPicker').style.display = 'none';
  document.querySelector('.feed-action-btn.gif').textContent = feedSelectedEmoji ? `${feedSelectedEmoji} Hilsen` : '😊 Hilsen';
}

function newFeedItem(fields) {
  return {
    id: uid(),
    ts: Date.now(),
    uid: currentUser.uid,
    author: currentUser.name,
    avatar: currentUser.avatar,
    avatarBg: currentUser.color + '33',
    text: null, greeting: null, photo: null,
    reactions: {}, comments: [],
    ...fields
  };
}

async function postFeedItem() {
  if (feedPosting) return;
  const text = document.getElementById('feedTextInput').value.trim();
  if (!text && !feedPhotoData && !feedSelectedEmoji) {
    showToast('Skriv noget eller vælg et billede 😊'); return;
  }
  feedPosting = true;
  const btn = document.querySelector('.feed-post-btn');
  btn.disabled = true;
  try {
    const photo = feedPhotoData ? await PHOTOS.saveDataUrl(feedPhotoData) : null;
    feedItems.unshift(newFeedItem({ text: text || null, greeting: feedSelectedEmoji || null, photo }));
    document.getElementById('feedTextInput').value = '';
    clearFeedPhoto();
    feedSelectedEmoji = null;
    document.querySelector('.feed-action-btn.gif').textContent = '😊 Hilsen';
    renderFeed();
    syncFlush();
    showToast('🌟 Delt med hele familien!');
  } catch (e) {
    console.error(e);
    showToast('⚠️ Kunne ikke dele — prøv igen');
  } finally {
    feedPosting = false;
    btn.disabled = false;
  }
}

// ── MINDER ──
const EMOJIS = ['😊','❤️','🌟','🎉','😂','🥰','🙏','🌸'];
let emojiIdx = 0;

function cycleEmoji() {
  emojiIdx = (emojiIdx + 1) % EMOJIS.length;
  document.getElementById('selectedEmoji').textContent = EMOJIS[emojiIdx];
}

function postMemory() {
  const text = document.getElementById('memoryText').value.trim();
  if (!text) { showToast('Skriv noget først 😊'); return; }
  memories.unshift({
    id: uid(), ts: Date.now(), uid: currentUser.uid,
    author: currentUser.name,
    avatar: currentUser.avatar,
    color: currentUser.color + '22',
    emoji: EMOJIS[emojiIdx],
    text,
    reactions: {}
  });
  document.getElementById('memoryText').value = '';
  renderMemories();
  showToast('💛 Delt med familien!');
}

function addReaction(id, emoji) {
  const mem = memories.find(m => String(m.id) === String(id));
  if (!mem) return;
  if (!mem.reactions || typeof mem.reactions !== 'object') mem.reactions = {};
  mem.reactions[emoji] = toggleReaction(mem.reactions[emoji]);
  renderMemories();
}

function deleteMemory(id) {
  if (!confirm('Slet mindet?')) return;
  memories = memories.filter(m => String(m.id) !== String(id));
  renderMemories();
}

function renderMemories() {
  const list = document.getElementById('memoriesList');
  if (!list) return;
  if (!memories.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📸</div><div class="empty-state-text">Ingen minder endnu</div></div>';
    return;
  }
  list.innerHTML = memories.map(m => {
    const r = m.reactions || {};
    const canDelete = isMine(m) || currentUser?.role === 'admin';
    return `
    <div class="memory-item">
      <div class="memory-header">
        <div class="memory-avatar" style="background:${esc(m.color || 'var(--beige)')}">${esc(m.avatar || '👤')}</div>
        <div style="flex:1">
          <div class="memory-author">${esc(m.author)}</div>
          <div class="memory-time">${esc(itemTime(m))}</div>
        </div>
        ${canDelete ? `<button class="icon-btn" onclick="deleteMemory(${m.id})" aria-label="Slet">🗑️</button>` : ''}
      </div>
      <span class="memory-emoji">${esc(m.emoji || '')}</span>
      <div class="memory-text">${esc(m.text)}</div>
      <div class="memory-reactions">
        ${['❤️','😊','🎉','😂'].map(e => `
          <button class="reaction-btn ${hasReacted(r[e]) ? 'reacted' : ''}" onclick="addReaction(${m.id},'${e}')">
            ${e} ${reactCount(r[e]) || ''}
          </button>`).join('')}
      </div>
    </div>`;
  }).join('');
}

// ── CHAT ──
function renderChat() {
  const el = document.getElementById('chatMessages');
  if (!el) return;
  if (!chatMessages.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-text">Ingen beskeder endnu</div></div>';
    return;
  }
  const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 120;
  let lastDay = '';
  el.innerHTML = chatMessages.map(m => {
    const mine = isMine(m);
    const day = m.ts ? dateKey(new Date(m.ts)) : '';
    let sep = '';
    if (day && day !== lastDay) {
      lastDay = day;
      const d = new Date(m.ts);
      const label = day === today() ? 'I dag' : `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
      sep = `<div class="chat-day">${label}</div>`;
    }
    const time = m.ts ? `${pad2(new Date(m.ts).getHours())}:${pad2(new Date(m.ts).getMinutes())}` : (m.time || '');
    return `${sep}
    <div class="chat-msg ${mine ? 'mine' : ''}">
      <div class="chat-avatar" style="background:${esc(m.color || 'var(--beige)')}">${esc(m.avatar || '👤')}</div>
      <div>
        <div class="chat-bubble">${esc(m.text)}</div>
        <div class="chat-meta">${mine ? '' : esc(m.author) + ' · '}${esc(time)}</div>
      </div>
    </div>`;
  }).join('');
  if (currentView === 'chat' && nearBottom) scrollChatToBottom();
}

function scrollChatToBottom() {
  window.scrollTo(0, document.body.scrollHeight);
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  chatMessages.push({
    id: uid(), ts: Date.now(), uid: currentUser.uid,
    author: currentUser.name,
    avatar: currentUser.avatar,
    color: currentUser.color + '33',
    text
  });
  // Behold de seneste 500 beskeder
  if (chatMessages.length > 500) chatMessages = chatMessages.slice(-500);
  input.value = '';
  renderChat();
  scrollChatToBottom();
}

// ── FOTOBOG ──
function renderFotobog() {
  const el = document.getElementById('fotobogIndhold');
  if (!el) return;
  const billeder = feedItems.filter(f => f.photo || (typeof f.image === 'string' && f.image.startsWith('data:image/')));
  if (!billeder.length) {
    el.innerHTML = `<div class="card empty-state">
      <div class="empty-state-icon">📷</div>
      <div class="empty-state-sub">Ingen billeder endnu — del billeder i Familiefeedet</div>
    </div>`;
    return;
  }
  // Gruppér efter måned opslaget blev lavet
  const maaneder = new Map();
  billeder.forEach(f => {
    const ms = f.ts || idToMs(f.id) || Date.now();
    const label = new Date(ms).toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
    if (!maaneder.has(label)) maaneder.set(label, []);
    maaneder.get(label).push(f);
  });
  el.innerHTML = [...maaneder.entries()].map(([m, imgs]) => `
    <div class="fotobog-maaned">
      <div class="fotobog-titel">${esc(m.charAt(0).toUpperCase() + m.slice(1))}</div>
      <div class="fotobog-billeder">
        ${imgs.map(f => `<div class="fotobog-billede">${PHOTOS.html(f, 'fotobog-img')}</div>`).join('')}
      </div>
    </div>`).join('');
  PHOTOS.hydrate(el);
}
