// ════════════════════════════════════════════════
// FamilieHub — billeder
// ════════════════════════════════════════════════
// Billeder komprimeres på telefonen (maks 1280 px, JPEG) og gemmes for sig i
// family/shared/photos/<id>. Opslag har kun billedets id, så feedet hentes hurtigt,
// og hvert billede hentes først når det vises — og caches derefter på enheden.

const PHOTOS = {
  CACHE: 'familiehub-photos-v1',
  mem: new Map(),
  loading: new Map(),

  // Komprimer en fil fra <input type=file> → dataURL
  async compressFile(file, max = 1280, quality = 0.78) {
    let source;
    try {
      source = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      source = await new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = URL.createObjectURL(file);
      });
    }
    return this.drawScaled(source, max, quality);
  },

  async compressDataUrl(dataUrl, max = 1280, quality = 0.78) {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    return this.drawScaled(img, max, quality);
  },

  drawScaled(src, max, quality) {
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
    const scale = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0, c.width, c.height);
    if (src.close) src.close();
    return c.toDataURL('image/jpeg', quality);
  },

  // Gem billede → returnerer id
  async saveDataUrl(dataUrl, { compress = false } = {}) {
    const data = compress ? await this.compressDataUrl(dataUrl) : dataUrl;
    const id = 'p' + uid();
    await this.cachePut(id, data);
    this.mem.set(id, data);
    // Skriv til databasen (Firebase køer skrivningen hvis vi er offline).
    // Id'et huskes indtil serveren har bekræftet, så billedet sendes igen ved næste start.
    this.queue(id, true);
    FH.S.set(FH.ref('family/shared/photos/' + id), {
      d: data, by: currentUser?.uid || null, ts: Date.now()
    }).then(() => this.queue(id, false))
      .catch(e => console.warn('[foto] upload fejlede', e));
    return id;
  },

  queue(id, add) {
    try {
      let q = JSON.parse(localStorage.getItem('fh4_photo_queue') || '[]').filter(x => x !== id);
      if (add) q.push(id);
      localStorage.setItem('fh4_photo_queue', JSON.stringify(q.slice(-50)));
    } catch (e) {}
  },

  async retryUploads() {
    let q = [];
    try { q = JSON.parse(localStorage.getItem('fh4_photo_queue') || '[]'); } catch (e) {}
    for (const id of q) {
      try {
        const data = await this.cacheGet(id);
        if (!data) { this.queue(id, false); continue; }
        await FH.S.set(FH.ref('family/shared/photos/' + id), { d: data, by: currentUser?.uid || null, ts: Date.now() });
        this.queue(id, false);
      } catch (e) {}
    }
  },

  async cachePut(id, data) {
    try {
      const c = await caches.open(this.CACHE);
      await c.put(new Request('./__foto/' + id), new Response(data, { headers: { 'Content-Type': 'text/plain' } }));
    } catch (e) {}
  },

  async cacheGet(id) {
    try {
      const c = await caches.open(this.CACHE);
      const r = await c.match(new Request('./__foto/' + id));
      return r ? await r.text() : null;
    } catch (e) { return null; }
  },

  async get(id) {
    if (this.mem.has(id)) return this.mem.get(id);
    if (this.loading.has(id)) return this.loading.get(id);
    const p = (async () => {
      let data = await this.cacheGet(id);
      if (!data) {
        const snap = await FH.S.get(FH.ref('family/shared/photos/' + id + '/d'));
        data = snap.val();
        if (data) await this.cachePut(id, data);
      }
      if (data) this.mem.set(id, data);
      this.loading.delete(id);
      return data;
    })();
    this.loading.set(id, p);
    return p;
  },

  remove(id) {
    this.mem.delete(id);
    FH.S.remove(FH.ref('family/shared/photos/' + id)).catch(() => {});
    caches.open(this.CACHE).then(c => c.delete(new Request('./__foto/' + id))).catch(() => {});
  },

  // <img data-photo="id"> → hent og vis
  hydrate(root = document) {
    root.querySelectorAll('img[data-photo]:not([data-loaded])').forEach(img => {
      img.setAttribute('data-loaded', '1');
      const id = img.getAttribute('data-photo');
      this.get(id).then(d => {
        if (d) { img.src = d; img.classList.add('loaded'); }
        else img.closest('.photo-wrap')?.classList.add('missing');
      }).catch(() => img.closest('.photo-wrap')?.classList.add('missing'));
    });
  },

  // HTML til et billede (nyt id-format eller gammelt indlejret billede)
  html(item, cls = 'feed-post-image') {
    if (item.photo) return `<div class="photo-wrap"><img class="${cls}" data-photo="${esc(item.photo)}" alt="Billede" onclick="openPhoto(this)"></div>`;
    if (typeof item.image === 'string' && item.image.startsWith('data:image/'))
      return `<div class="photo-wrap"><img class="${cls} loaded" src="${item.image}" alt="Billede" onclick="openPhoto(this)"></div>`;
    return '';
  }
};

// Fuldskærmsvisning af billede
function openPhoto(img) {
  if (!img.src) return;
  const v = document.createElement('div');
  v.className = 'photo-viewer';
  v.innerHTML = `<img src="${img.src}" alt="Billede">`;
  v.onclick = () => v.remove();
  document.body.appendChild(v);
}
