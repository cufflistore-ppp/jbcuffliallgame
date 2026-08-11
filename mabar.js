/**
 * mabar.js — Kerja sama / Mabar CUFFLI Challenge
 * Invite teman · EXP gabung · voucher dibagi 2
 */
(function () {
  const FRIENDS_PREFIX = 'cuffli_friends_';
  const INVITES_PREFIX = 'cuffli_mabar_invites_';
  const COOP_KEY = 'cuffli_mabar_active';
  const PENDING_EXP_PREFIX = 'cuffli_mabar_pending_exp_';
  const PENDING_VOUCHER_PREFIX = 'cuffli_mabar_pending_voucher_';

  function getUser() {
    return typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  }

  function unameOf(user) {
    if (!user) return null;
    return (user.username || user.email || '').toLowerCase().trim() || null;
  }

  function myName() {
    return unameOf(getUser());
  }

  function getFriends() {
    const me = myName();
    if (!me) return [];
    try {
      const arr = JSON.parse(localStorage.getItem(FRIENDS_PREFIX + me) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveFriends(list) {
    const me = myName();
    if (!me) return;
    localStorage.setItem(FRIENDS_PREFIX + me, JSON.stringify(list));
  }

  function addFriend(name) {
    const me = myName();
    if (!me) return { ok: false, msg: 'Login dulu.' };
    const n = (name || '').toLowerCase().trim();
    if (!n) return { ok: false, msg: 'Isi username teman.' };
    if (n === me) return { ok: false, msg: 'Tidak bisa add diri sendiri.' };
    const list = getFriends();
    if (list.includes(n)) return { ok: false, msg: '@' + n + ' sudah di daftar.' };
    list.push(n);
    saveFriends(list);
    return { ok: true, msg: 'Ditambahkan: @' + n };
  }

  function removeFriend(name) {
    const n = (name || '').toLowerCase().trim();
    saveFriends(getFriends().filter((f) => f !== n));
    const coop = getActiveCoop();
    if (coop && coop.partner === n) clearCoop();
  }

  function getInvitesFor(username) {
    const u = (username || '').toLowerCase().trim();
    if (!u) return [];
    try {
      const arr = JSON.parse(localStorage.getItem(INVITES_PREFIX + u) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveInvitesFor(username, list) {
    const u = (username || '').toLowerCase().trim();
    if (!u) return;
    localStorage.setItem(INVITES_PREFIX + u, JSON.stringify(list));
  }

  /** Kirim invite mabar ke username teman */
  function inviteFriend(partnerName) {
    const me = myName();
    if (!me) return { ok: false, msg: 'Login dulu.' };
    const partner = (partnerName || '').toLowerCase().trim();
    if (!partner) return { ok: false, msg: 'Pilih teman dulu.' };
    if (partner === me) return { ok: false, msg: 'Tidak bisa invite diri sendiri.' };

    const invites = getInvitesFor(partner).filter((i) => i.from !== me || i.status !== 'pending');
    invites.unshift({
      id: 'inv-' + Date.now(),
      from: me,
      to: partner,
      status: 'pending',
      at: new Date().toLocaleString('id-ID')
    });
    saveInvitesFor(partner, invites);

    // Notif untuk target (disimpan di key notif user target)
    try {
      const notifKey = 'cuffli_notifs_' + partner;
      let notifs = [];
      try { notifs = JSON.parse(localStorage.getItem(notifKey) || '[]'); } catch (_) {}
      if (!Array.isArray(notifs)) notifs = [];
      notifs.unshift({
        id: Date.now() + Math.random(),
        text: '🎮 @' + me + ' invite kamu Mabar CUFFLI Challenge! Buka Game → terima invite.',
        type: 'success',
        time: new Date().toISOString(),
        read: false
      });
      localStorage.setItem(notifKey, JSON.stringify(notifs.slice(0, 50)));
    } catch (_) {}

    if (typeof addNotification === 'function') {
      addNotification('Invite mabar dikirim ke @' + partner, 'success');
    }
    return { ok: true, msg: 'Invite terkirim ke @' + partner };
  }

  function getMyPendingInvites() {
    const me = myName();
    if (!me) return [];
    return getInvitesFor(me).filter((i) => i.status === 'pending');
  }

  function acceptInvite(inviteId) {
    const me = myName();
    if (!me) return { ok: false, msg: 'Login dulu.' };
    const list = getInvitesFor(me);
    const inv = list.find((i) => i.id === inviteId);
    if (!inv || inv.status !== 'pending') return { ok: false, msg: 'Invite tidak ditemukan.' };

    inv.status = 'accepted';
    saveInvitesFor(me, list);

    // Auto-add saling teman
    const myFriends = getFriends();
    if (!myFriends.includes(inv.from)) {
      myFriends.push(inv.from);
      saveFriends(myFriends);
    }
    try {
      const theirKey = FRIENDS_PREFIX + inv.from;
      let their = JSON.parse(localStorage.getItem(theirKey) || '[]');
      if (!Array.isArray(their)) their = [];
      if (!their.includes(me)) {
        their.push(me);
        localStorage.setItem(theirKey, JSON.stringify(their));
      }
    } catch (_) {}

    setActiveCoop(inv.from);
    if (typeof addNotification === 'function') {
      addNotification('Mabar aktif dengan @' + inv.from + '! EXP digabung, voucher dibagi 2.', 'success');
    }
    return { ok: true, msg: 'Mabar dengan @' + inv.from };
  }

  function rejectInvite(inviteId) {
    const me = myName();
    if (!me) return;
    const list = getInvitesFor(me).map((i) => {
      if (i.id === inviteId) i.status = 'rejected';
      return i;
    });
    saveInvitesFor(me, list);
  }

  function setActiveCoop(partner) {
    const me = myName();
    if (!me || !partner) return;
    localStorage.setItem(COOP_KEY, JSON.stringify({
      me,
      partner: (partner || '').toLowerCase().trim(),
      since: Date.now()
    }));
  }

  function getActiveCoop() {
    try {
      const raw = localStorage.getItem(COOP_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw);
      const me = myName();
      if (!c || !me || c.me !== me) return null;
      return c;
    } catch {
      return null;
    }
  }

  function clearCoop() {
    localStorage.removeItem(COOP_KEY);
  }

  function isCoopActive() {
    return !!getActiveCoop();
  }

  function getCoopPartner() {
    const c = getActiveCoop();
    return c ? c.partner : null;
  }

  /** Setelah challenge: kirim setengah EXP ke partner (pending claim) */
  function shareExpWithPartner(amount) {
    const partner = getCoopPartner();
    if (!partner || !amount) return;
    const half = Math.max(1, Math.floor(amount / 2));
    const key = PENDING_EXP_PREFIX + partner;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) {}
    if (!Array.isArray(list)) list = [];
    list.push({
      from: myName(),
      amount: half,
      at: Date.now(),
      reason: 'Mabar EXP dari @' + (myName() || 'teman')
    });
    localStorage.setItem(key, JSON.stringify(list));
  }

  /** Claim pending EXP mabar saat buka game */
  function claimPendingMabarExp() {
    const me = myName();
    if (!me || typeof addExp !== 'function') return 0;
    const key = PENDING_EXP_PREFIX + me;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) {}
    if (!Array.isArray(list) || !list.length) return 0;
    let total = 0;
    list.forEach((e) => { total += Number(e.amount) || 0; });
    localStorage.removeItem(key);
    if (total > 0) {
      addExp(total, 'Mabar dari teman');
      if (typeof addNotification === 'function') {
        addNotification('🤝 +' + total + ' EXP dari Mabar teman!', 'success');
      }
    }
    return total;
  }

  /** Voucher dibagi 2 saat mabar */
  function shareVoucherWithPartner(percent, level) {
    const partner = getCoopPartner();
    if (!partner || !percent) return null;
    const half = Math.max(1, Math.floor(percent / 2));
    const key = PENDING_VOUCHER_PREFIX + partner;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) {}
    if (!Array.isArray(list)) list = [];
    list.push({ percent: half, level, from: myName(), at: Date.now() });
    localStorage.setItem(key, JSON.stringify(list));
    return half;
  }

  function claimPendingMabarVouchers() {
    const me = myName();
    if (!me) return 0;
    const key = PENDING_VOUCHER_PREFIX + me;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) {}
    if (!Array.isArray(list) || !list.length) return 0;
    localStorage.removeItem(key);
    let n = 0;
    list.forEach((v) => {
      const p = Number(v.percent) || 0;
      if (p <= 0) return;
      if (typeof addVoucher === 'function') {
        addVoucher(p);
        n++;
      }
      if (typeof addNotification === 'function') {
        addNotification('🎫 Voucher mabar ' + p + '% dari @' + (v.from || 'teman'), 'success');
      }
    });
    return n;
  }

  function getShareLink() {
    try {
      const base = location.href.replace(/[^/]*$/, '');
      const me = myName() || 'cuffli';
      return base + 'game.html?mabar=' + encodeURIComponent(me);
    } catch {
      return 'game.html?mabar=invite';
    }
  }

  function shareMabar() {
    const url = getShareLink();
    const text = 'Yuk Mabar CUFFLI Challenge bareng aku! Kerja sama, EXP digabung, voucher dibagi 2.\n' + url;
    if (navigator.share) {
      navigator.share({ title: 'Mabar CUFFLI Challenge', text, url }).catch(() => copyText(text));
    } else {
      copyText(text);
    }
  }

  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(() => alert('Link mabar disalin!\n' + t)).catch(() => prompt('Salin:', t));
    } else {
      prompt('Salin:', t);
    }
  }

  /** UI panel mabar di game.html */
  function renderMabarPanel() {
    const box = document.getElementById('mabarPanel');
    if (!box) return;
    const me = myName();
    if (!me) {
      box.innerHTML = '<p class="mabar-hint">Login dulu untuk Mabar bareng teman / pacar / sodara.</p>';
      return;
    }

    const friends = getFriends();
    const invites = getMyPendingInvites();
    const coop = getActiveCoop();

    let invitesHtml = '';
    if (invites.length) {
      invitesHtml = '<div class="mabar-invites"><div class="mabar-label">Invite masuk</div>' +
        invites.map((i) => `
          <div class="mabar-invite-row">
            <span>@${i.from} invite mabar</span>
            <button type="button" class="btn-mabar-accept" data-accept="${i.id}">Terima</button>
            <button type="button" class="btn-mabar-reject" data-reject="${i.id}">Tolak</button>
          </div>
        `).join('') + '</div>';
    }

    let coopHtml = coop
      ? `<div class="mabar-active">🤝 Mabar aktif dengan <strong>@${coop.partner}</strong>
           <button type="button" class="btn-mabar-end" id="btnEndMabar">Akhiri</button>
           <p class="mabar-hint">EXP digabung · Voucher milestone dibagi 2</p>
         </div>`
      : `<p class="mabar-hint">Belum mabar. Add teman lalu klik Invite.</p>`;

    const friendsHtml = friends.length
      ? friends.map((f) => `
          <div class="mabar-friend-row">
            <div class="mabar-friend-info">
              <span class="mabar-friend-name">@${f}</span>
            </div>
            <button type="button" class="btn-mabar-invite" data-invite="${f}">Invite</button>
            <button type="button" class="btn-mabar-remove" data-remove="${f}" title="Hapus">×</button>
          </div>
        `).join('')
      : '<p class="mabar-hint">Belum ada teman. Tambah username di bawah.</p>';

    box.innerHTML = `
      <div class="mabar-card">
        <h2 class="section-title"><i class="fa-solid fa-user-group" style="color:#00b4ff"></i> Mabar / Kerja Sama</h2>
        <p class="mabar-desc">Main bareng teman, sodara, sahabat, atau pacar. EXP digabung, voucher dibagi 2.</p>
        ${coopHtml}
        ${invitesHtml}
        <div class="mabar-label">Teman</div>
        <div class="mabar-friends">${friendsHtml}</div>
        <div class="mabar-add-row">
          <input type="text" id="mabarAddInput" class="challenge-input" placeholder="Username" autocomplete="off">
          <button type="button" class="btn-primary" id="btnMabarAdd"><i class="fa-solid fa-user-plus"></i> Add</button>
        </div>
        <div class="mabar-share-row">
          <button type="button" class="btn-secondary" id="btnMabarShare">
            <i class="fa-solid fa-share-nodes"></i> Bagikan Game / Invite Link
          </button>
        </div>
      </div>
    `;

    const addBtn = document.getElementById('btnMabarAdd');
    const addInput = document.getElementById('mabarAddInput');
    if (addBtn) {
      addBtn.onclick = () => {
        const res = addFriend(addInput ? addInput.value : '');
        alert(res.msg);
        if (res.ok) renderMabarPanel();
      };
    }
    const shareBtn = document.getElementById('btnMabarShare');
    if (shareBtn) shareBtn.onclick = () => shareMabar();
    const endBtn = document.getElementById('btnEndMabar');
    if (endBtn) endBtn.onclick = () => { clearCoop(); renderMabarPanel(); };

    box.querySelectorAll('[data-invite]').forEach((btn) => {
      btn.onclick = () => {
        const res = inviteFriend(btn.getAttribute('data-invite'));
        alert(res.msg);
      };
    });
    box.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.onclick = () => {
        removeFriend(btn.getAttribute('data-remove'));
        renderMabarPanel();
      };
    });
    box.querySelectorAll('[data-accept]').forEach((btn) => {
      btn.onclick = () => {
        const res = acceptInvite(btn.getAttribute('data-accept'));
        alert(res.msg);
        renderMabarPanel();
      };
    });
    box.querySelectorAll('[data-reject]').forEach((btn) => {
      btn.onclick = () => {
        rejectInvite(btn.getAttribute('data-reject'));
        renderMabarPanel();
      };
    });
  }

  // Auto: ?mabar=username di URL → tawarkan add + invite
  function handleMabarQuery() {
    try {
      const params = new URLSearchParams(location.search);
      const from = (params.get('mabar') || '').toLowerCase().trim();
      if (!from) return;
      const me = myName();
      if (!me) return;
      if (from === me) return;
      if (!getFriends().includes(from)) {
        if (confirm('@' + from + ' bagikan link mabar. Tambah ke teman?')) {
          addFriend(from);
        }
      }
    } catch (_) {}
  }

  window.CuffliMabar = {
    addFriend,
    removeFriend,
    inviteFriend,
    acceptInvite,
    rejectInvite,
    getFriends,
    getActiveCoop,
    isCoopActive,
    getCoopPartner,
    clearCoop,
    setActiveCoop,
    shareExpWithPartner,
    claimPendingMabarExp,
    shareVoucherWithPartner,
    claimPendingMabarVouchers,
    shareMabar,
    renderMabarPanel,
    handleMabarQuery
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body && document.body.dataset.page === 'game') {
      handleMabarQuery();
      claimPendingMabarExp();
      claimPendingMabarVouchers();
      // Notif invite pending
      const pending = getMyPendingInvites();
      if (pending.length && typeof addNotification === 'function') {
        pending.forEach((i) => {
          addNotification('🎮 @' + i.from + ' invite kamu Mabar! Scroll ke Mabar → Terima.', 'success');
        });
      }
      renderMabarPanel();
    }
  });
})();
