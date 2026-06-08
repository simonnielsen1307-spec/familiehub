// ════════════════════════════════════════════════
// FamilieHub — Notifikationer & Badges
// ════════════════════════════════════════════════

const NOTIF = {
  // Badge tællere per fane
  badges: {
    feed:     0,
    chat:     0,
    kalender: 0,
    hente:    0
  },

  // Opdater badge på nav-item
  updateBadge(tab, count) {
    this.badges[tab] = count;
    const navId = tab === 'hente' ? 'nav-home' : `nav-${tab}`;
    const navEl = document.getElementById(navId);
    if (!navEl) return;

    // Fjern eksisterende badge
    const existing = navEl.querySelector('.nav-badge');
    if (existing) existing.remove();

    if (count > 0) {
      const badge = document.createElement('div');
      badge.className = 'nav-badge';
      badge.textContent = count > 9 ? '9+' : count;
      navEl.appendChild(badge);
    }
  },

  // Nulstil badge når man åbner fanen
  clearBadge(tab) {
    this.badges[tab] = 0;
    this.updateBadge(tab, 0);
  },

  // Tjek om hentning mangler for i dag
  checkHentingMangler(hentePlan) {
    const day = getDanishDay ? getDanishDay() : null;
    if (!day || day === 'Lørdag' || day === 'Søndag') return false;
    const aug = hentePlan?.august?.[day];
    const osk = hentePlan?.oskar?.[day];
    const mangler = (!aug?.person || !osk?.person);
    this.updateBadge('hente', mangler ? 1 : 0);
    return mangler;
  },

  // Vis in-app notifikation banner
  showBanner(message, type = 'info', duration = 4000) {
    const existing = document.getElementById('notifBanner');
    if (existing) existing.remove();

    const colors = {
      info:    { bg: '#1565c0', icon: 'ℹ️' },
      success: { bg: '#2e7d32', icon: '✅' },
      warning: { bg: '#e65100', icon: '⚠️' },
      feed:    { bg: '#7b1fa2', icon: '🌟' },
      chat:    { bg: '#0277bd', icon: '💬' },
      hente:   { bg: '#c62828', icon: '🚗' }
    };

    const c = colors[type] || colors.info;
    const banner = document.createElement('div');
    banner.id = 'notifBanner';
    banner.style.cssText = `
      position: fixed; top: 70px; left: 50%; transform: translateX(-50%);
      background: ${c.bg}; color: white; padding: 12px 20px;
      border-radius: 20px; font-size: 14px; font-weight: 700;
      z-index: 9999; display: flex; align-items: center; gap: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 340px;
      font-family: 'Nunito', sans-serif; animation: slideDown 0.3s ease;
      white-space: nowrap;
    `;
    banner.innerHTML = `<span>${c.icon}</span><span>${message}</span>`;
    document.body.appendChild(banner);

    setTimeout(() => {
      banner.style.opacity = '0';
      banner.style.transition = 'opacity 0.3s';
      setTimeout(() => banner.remove(), 300);
    }, duration);
  },

  // Anmod om push-tilladelse (iOS kræver brugerinteraktion)
  async requestPushPermission() {
    if (!('Notification' in window)) {
      this.showBanner('Push ikke understøttet i denne browser', 'warning');
      return false;
    }

    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') {
      this.showBanner('Notifikationer er blokeret — tjek indstillinger', 'warning');
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      this.showBanner('Notifikationer aktiveret! 🔔', 'success');
      return true;
    }
    return false;
  },

  // Registrer service worker og aktiver push
  async registerSW() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] Registreret:', reg.scope);
      return reg;
    } catch(e) {
      console.error('[SW] Registrering fejlede:', e);
    }
  },

  // iOS installationsguide
  showIOSInstallGuide() {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandalone = window.navigator.standalone;
    if (!isIOS || isInStandalone) return;

    // Vis kun én gang
    if (localStorage.getItem('fh_install_shown')) return;

    const guide = document.createElement('div');
    guide.id = 'iosInstallGuide';
    guide.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: white; border-radius: 20px; padding: 16px 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2); z-index: 9999;
      max-width: 320px; width: calc(100% - 32px);
      font-family: 'Nunito', sans-serif; text-align: center;
      border: 2px solid #f0e6d3;
    `;
    guide.innerHTML = `
      <div style="font-size:24px;margin-bottom:8px">📱</div>
      <div style="font-size:15px;font-weight:800;color:#3d2b1f;margin-bottom:6px">Tilføj til hjemskærm</div>
      <div style="font-size:13px;color:#a07860;line-height:1.5;margin-bottom:12px">
        Tryk på <strong>Del</strong> 📤 nederst i Safari,<br>
        og vælg <strong>"Føj til hjemskærm"</strong> 🏠
      </div>
      <button onclick="document.getElementById('iosInstallGuide').remove();localStorage.setItem('fh_install_shown','1')"
        style="padding:8px 20px;background:#f4845f;color:white;border:none;border-radius:16px;font-family:Nunito,sans-serif;font-size:14px;font-weight:800;cursor:pointer">
        Forstået ✓
      </button>
    `;
    document.body.appendChild(guide);
  }
};

// CSS til badges — tilføjes dynamisk
const badgeCSS = document.createElement('style');
badgeCSS.textContent = `
  @keyframes slideDown {
    from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
    to   { transform: translateX(-50%) translateY(0); opacity: 1; }
  }

  .nav-badge {
    position: absolute;
    top: 4px; right: 8px;
    min-width: 18px; height: 18px;
    background: #e53935;
    color: white;
    border-radius: 9px;
    font-size: 10px;
    font-weight: 900;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid white;
    padding: 0 3px;
    font-family: 'Nunito', sans-serif;
    animation: badgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes badgePop {
    from { transform: scale(0); }
    to   { transform: scale(1); }
  }

  .nav-item { position: relative; }
`;
document.head.appendChild(badgeCSS);

console.log('[FamilieHub] Notifikationer indlæst ✅');
