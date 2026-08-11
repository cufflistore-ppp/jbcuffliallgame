// ===== AUTH (Client-side Login dengan localStorage) =====
const AUTH_KEY = 'cuffli_user';
const NOTIF_KEY = 'cuffli_notifs';
const USERS_KEY = 'cuffli_users';


/** Generate ID akun unik (contoh: CUF-A3F9K2) */
function generateUserId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'CUF-';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Pastikan tidak bentrok
  const users = getUsers();
  const exists = Object.values(users).some(u => u.id === id);
  if (exists) return generateUserId();
  return id;
}


function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_KEY);
  updateHeaderAuth();
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function registerUser(username, password, nama) {
  const users = getUsers();
  if (users[username]) return { ok: false, msg: 'Username sudah dipakai' };
  if (username.length < 3) return { ok: false, msg: 'Username min 3 karakter' };
  if (password.length < 4) return { ok: false, msg: 'Password min 4 karakter' };
  const id = generateUserId();
  users[username] = {
    username,
    password,
    nama: (nama || username).trim(),
    id: id,
    created: Date.now()
  };
  saveUsers(users);
  return { ok: true, id: id };
}

function loginUser(username, password) {
  const users = getUsers();
  const u = users[username];
  if (!u || u.password !== password) return { ok: false, msg: 'Username atau password salah' };
  // Pastikan setiap akun punya ID unik (untuk akun lama yang belum ada)
  if (!u.id) {
    u.id = generateUserId();
    users[username] = u;
    saveUsers(users);
  }
  setCurrentUser({
    username: u.username,
    nama: u.nama || u.username,
    id: u.id,
    avatar: u.avatar || null
  });
  addNotification('Login berhasil! Selamat datang, ' + (u.nama || u.username) + '.', 'success');
  return { ok: true };
}

function logoutUser() {
  setCurrentUser(null);
  addNotification('Kamu sudah logout.', 'info');
}

/** Update nama / profil user yang sedang login */
function updateProfile(newNama) {
  const user = getCurrentUser();
  if (!user) return { ok: false, msg: 'Belum login' };
  const nama = (newNama || '').trim();
  if (nama.length < 2) return { ok: false, msg: 'Nama minimal 2 karakter' };
  if (nama.length > 30) return { ok: false, msg: 'Nama maksimal 30 karakter' };

  const users = getUsers();
  if (!users[user.username]) return { ok: false, msg: 'Akun tidak ditemukan' };

  users[user.username].nama = nama;
  saveUsers(users);

  // Update session (pertahankan avatar + id)
  setCurrentUser({
    username: user.username,
    nama: nama,
    id: users[user.username].id || user.id || null,
    uid: user.uid || null,
    avatar: users[user.username].avatar || user.avatar || null
  });
  addNotification('Profil berhasil diperbarui.', 'success');
  return { ok: true };
}

/** Ambil foto profil user (bisa dilihat orang lain lewat username) */
function getUserAvatar(username) {
  if (!username) return null;
  const users = getUsers();
  return (users[username] && users[username].avatar) || null;
}

/** Update foto profil — disimpan di akun, bisa dilihat user lain */
function updateProfileAvatar(dataUrl) {
  const user = getCurrentUser();
  if (!user) return { ok: false, msg: 'Belum login' };
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
    return { ok: false, msg: 'File gambar tidak valid' };
  }
  // Batasi ukuran base64 (~120KB)
  if (dataUrl.length > 160000) {
    return { ok: false, msg: 'Gambar terlalu besar. Pakai foto lebih kecil.' };
  }

  const users = getUsers();
  if (!users[user.username]) return { ok: false, msg: 'Akun tidak ditemukan' };

  users[user.username].avatar = dataUrl;
  saveUsers(users);

  setCurrentUser({
    username: user.username,
    nama: users[user.username].nama || user.nama,
    id: users[user.username].id || user.id || null,
    uid: user.uid || null,
    avatar: dataUrl
  });

  // Sync Firebase jika ada
  if (window.CuffliFirebase && window.CuffliFirebase.ready && user.uid) {
    try {
      window.CuffliFirebase.fbUpdateUserData(user.uid, { avatar: dataUrl });
    } catch (e) {}
  }

  addNotification('Foto profil berhasil diganti.', 'success');
  return { ok: true };
}

/** Hapus foto profil */
function removeProfileAvatar() {
  const user = getCurrentUser();
  if (!user) return { ok: false, msg: 'Belum login' };
  const users = getUsers();
  if (!users[user.username]) return { ok: false, msg: 'Akun tidak ditemukan' };
  delete users[user.username].avatar;
  saveUsers(users);
  setCurrentUser({
    username: user.username,
    nama: users[user.username].nama || user.nama,
    id: users[user.username].id || user.id || null,
    uid: user.uid || null,
    avatar: null
  });
  addNotification('Foto profil dihapus.', 'info');
  return { ok: true };
}

/** Compress gambar ke dataURL kecil (max 200px) */
function compressImageFile(file, maxSize, callback) {
  maxSize = maxSize || 200;
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; }
      } else {
        if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      callback(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = function () { callback(null); };
    img.src = e.target.result;
  };
  reader.onerror = function () { callback(null); };
  reader.readAsDataURL(file);
}

/** Ganti password user yang sedang login */
function changePassword(oldPass, newPass) {
  const user = getCurrentUser();
  if (!user) return { ok: false, msg: 'Belum login' };
  if (!newPass || newPass.length < 4) return { ok: false, msg: 'Password baru min 4 karakter' };

  const users = getUsers();
  const u = users[user.username];
  if (!u) return { ok: false, msg: 'Akun tidak ditemukan' };
  if (u.password !== oldPass) return { ok: false, msg: 'Password lama salah' };
  if (oldPass === newPass) return { ok: false, msg: 'Password baru harus beda dari yang lama' };

  users[user.username].password = newPass;
  saveUsers(users);
  addNotification('Password berhasil diganti.', 'success');
  return { ok: true };
}

/** Ambil data lengkap user (termasuk created) */
function getFullUserData() {
  const user = getCurrentUser();
  if (!user) return null;
  const users = getUsers();
  return users[user.username] || null;
}

// ===== NOTIFIKASI =====
function getNotifications() {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveNotifications(list) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(list));
  updateNotifBadge();
}

function addNotification(text, type = 'info') {
  const list = getNotifications();
  list.unshift({
    id: Date.now() + Math.random(),
    text,
    type,
    time: new Date().toLocaleString('id-ID'),
    read: false
  });
  if (list.length > 30) list.length = 30;
  saveNotifications(list);
}

function markAllNotifRead() {
  const list = getNotifications().map(n => ({ ...n, read: true }));
  saveNotifications(list);
}

function getUnreadCount() {
  return getNotifications().filter(n => !n.read).length;
}

function updateNotifBadge() {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  const count = getUnreadCount();
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function initDefaultNotifs() {
  if (getNotifications().length === 0) {
    addNotification('🎉 Selamat datang di CUFFLI ALL GAME! Ada potongan harga spesial hari ini.', 'promo');
    addNotification('⚡ Proses cepat — akun dikirim setelah konfirmasi pembayaran.', 'info');
  }
}

// ===== HEADER AUTH UI =====
function updateHeaderAuth() {
  const user = getCurrentUser();
  const loginBtn = document.getElementById('btnLogin');
  const userArea = document.getElementById('userArea');
  const userNameEl = document.getElementById('userName');
  if (!loginBtn || !userArea) return;

  if (user) {
    loginBtn.style.display = 'none';
    userArea.style.display = 'flex';
    if (userNameEl) userNameEl.textContent = user.nama || user.username;
    // Avatar kecil di header
    let av = userArea.querySelector('.header-avatar');
    if (!av) {
      av = document.createElement('img');
      av.className = 'header-avatar';
      av.alt = '';
      userArea.insertBefore(av, userArea.firstChild);
    }
    const src = user.avatar || getUserAvatar(user.username);
    if (src) {
      av.src = src;
      av.style.display = 'block';
    } else {
      av.removeAttribute('src');
      av.style.display = 'none';
    }
  } else {
    loginBtn.style.display = 'flex';
    userArea.style.display = 'none';
  }
  updateNotifBadge();
}

// ===== MODAL LOGIN / REGISTER =====
function openAuthModal(mode = 'login') {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.add('show');
  document.getElementById('authLoginForm').style.display = mode === 'login' ? 'block' : 'none';
  document.getElementById('authRegisterForm').style.display = mode === 'register' ? 'block' : 'none';
  document.getElementById('authError').textContent = '';
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('show');
}

function setupAuthForms() {
  const loginForm = document.getElementById('formLogin');
  const regForm = document.getElementById('formRegister');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUser').value.trim();
      const password = document.getElementById('loginPass').value;
      const res = loginUser(username, password);
      const err = document.getElementById('authError');
      if (res.ok) {
        closeAuthModal();
        updateHeaderAuth();
      } else {
        err.textContent = res.msg;
      }
    });
  }
  if (regForm) {
    regForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('regUser').value.trim();
      const password = document.getElementById('regPass').value;
      const nama = document.getElementById('regNama').value.trim();
      const res = registerUser(username, password, nama);
      const err = document.getElementById('authError');
      if (res.ok) {
        loginUser(username, password);
        closeAuthModal();
        updateHeaderAuth();
        addNotification('Akun berhasil dibuat! Selamat bergabung.', 'success');
      } else {
        err.textContent = res.msg;
      }
    });
  }
}

// ===== NOTIF PANEL =====
function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  panel.classList.toggle('show');
  if (panel.classList.contains('show')) {
    renderNotifList();
    markAllNotifRead();
  }
}

function renderNotifList() {
  const listEl = document.getElementById('notifList');
  if (!listEl) return;
  const notifs = getNotifications();
  if (notifs.length === 0) {
    listEl.innerHTML = '<p class="notif-empty">Belum ada notifikasi</p>';
    return;
  }
  listEl.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'} type-${n.type}">
      <div class="notif-text">${n.text}</div>
      <div class="notif-time">${n.time}</div>
    </div>
  `).join('');
}

// ===== KOMUNIKASI (Chat sederhana) =====
function openChat() {
  const chat = document.getElementById('chatPanel');
  if (chat) chat.classList.add('show');
}

function closeChat() {
  const chat = document.getElementById('chatPanel');
  if (chat) chat.classList.remove('show');
}

/** AI CS — hanya jawab soal CUFFLI ALL GAME */
function getCuffliAiReply(rawText) {
  const t = (rawText || '').toLowerCase().trim();

  // Tolak: minta kode spin / coding / source code
  if (
    /kasih kode|beri kode|minta kode|kode spin gratis|kode redeem gratis|kasih redeem|bagi kode|share kode/.test(t) ||
    /coding|source code|sourcecode|kode program|script spin|script\.js|spin\.js|buatkan kode|kasih script|kode html|kode css/.test(t) ||
    /generate kode|bikin kode spin|buat kode spin untuk saya/.test(t)
  ) {
    return 'Maaf, saya tidak bisa membantu Anda. Saya cuma <b>Asisten Cuffli</b>.<br>Kalau kamu mau nanya-nanya soal produk / spin / game / info, atau butuh kontak admin asli, tinggal chat saya aja 😊';
  }

  // Topik di luar Cuffli → tolak
  const offTopic = [
    'cuaca', 'politik', 'presiden', 'pacar', 'cinta', 'nonton', 'film', 'lagu',
    'sepak bola', 'bola', 'crypto', 'saham', 'bitcoin', 'program',
    'pekerjaan', 'sekolah', 'kuliah', 'agama', 'suku', 'rasis', 'judi',
    'obat', 'sakit', 'rumah sakit', 'travel', 'hotel', 'tiket pesawat'
  ];
  if (offTopic.some(k => t.includes(k))) {
    return 'Maaf, saya tidak bisa membantu Anda. Saya cuma <b>Asisten Cuffli</b>.<br>Kalau kamu mau nanya-nanya soal produk / spin / game / info, atau butuh kontak admin asli, tinggal chat saya aja 😊';
  }

  // Sapaan
  if (/^(hai|halo|hallo|hi|hey|pagi|siang|sore|malam)\b/.test(t) || t.length < 3) {
    return 'Halo! Selamat datang di <b>CUFFLI ALL GAME</b> 👋<br>Mau tanya stok akun, harga, cara order, spin voucher, atau pembayaran?';
  }

  // Harga / produk / free fire / akun
  if (/harga|berapa|price|murah|mahal|diskon|hemat/.test(t)) {
    return 'Harga akun ada di beranda (ada potongan harga).<br>• Cek produk → detail → tombol Beli<br>• Bisa pakai voucher spin biar lebih hemat.<br>Langsung buka menu <b>Beranda</b> ya!';
  }
  if (/stok|ada akun|ready|ready stock|tersedia|sold/.test(t)) {
    return 'Stok akun ditampilkan di <b>Beranda</b>. Kalau masih muncul di daftar, berarti masih tersedia. Segera order biar tidak kehabisan 🔥';
  }
  if (/free fire|ff|akun|produk|ber sg|res/.test(t)) {
    return 'Kami jual akun <b>Free Fire</b> (dan stok yang tampil di beranda).<br>1. Buka Beranda → pilih produk<br>2. Lihat spek & harga<br>3. Login → Beli → bayar QRIS<br>4. Konfirmasi ke admin WA produk tersebut.';
  }

  // Order / bayar / qris
  if (/order|beli|cara beli|cara order|pesan/.test(t)) {
    return 'Cara order di CUFFLI ALL GAME:<br>1. Login di menu Akun<br>2. Pilih produk di Beranda<br>3. Klik Beli → transfer sesuai QRIS<br>4. Konfirmasi ke WA admin yang tertera di produk<br>Proses cepat setelah pembayaran dikonfirmasi.';
  }
  if (/bayar|pembayaran|qris|transfer|tf|rekening|dana|gopay|ovo/.test(t)) {
    return 'Pembayaran lewat <b>QRIS</b> yang muncul di halaman pembayaran produk (setiap produk bisa beda admin/QR).<br>Setelah transfer, konfirmasi ke WA admin yang ada di halaman produk tersebut.';
  }

  // Spin / voucher / cara pakai (bukan minta dikasih kode)
  if (/spin|voucher|redeem|roda|cara pakai kode|cara spin/.test(t)) {
    return 'Cara Spin Voucher:<br>1. Bayar paket spin Rp 15.000 → konfirmasi admin<br>2. Admin kasih <b>kode redeem</b> (1 kode = 1× pakai)<br>3. Masukkan kode di menu Spin → dapat 3× spin<br>4. Hasil: Zonk atau voucher diskon 10–30%<br>5. Voucher dipakai di halaman pembayaran produk.';
  }

  // WA / admin / kontak
  if (/wa|whatsapp|admin|kontak|hubungi|cs/.test(t)) {
    return 'Setiap produk punya admin & nomor WA sendiri (tertera di halaman detail/pembayaran produk).<br>Untuk spin, konfirmasi ke admin setelah bayar paket spin. Atau tanya di sini khusus soal toko CUFFLI ALL GAME.';
  }

  // Login / akun user
  if (/login|daftar|register|akun saya|password|profil/.test(t)) {
    return 'Buka menu <b>Akun</b> untuk login / daftar.<br>Login diperlukan untuk order, spin, dan simpan voucher. Username tidak bisa diganti setelah daftar.';
  }

  // Proses / lama
  if (/proses|berapa lama|kirim|cepat|fast|kapan/.test(t)) {
    return 'Setelah pembayaran dikonfirmasi admin, akun diproses secepatnya. Pastikan transfer sesuai nominal & kirim bukti ke WA admin produk tersebut.';
  }

  // Default in-topic but unclear
  if (/cuffli|toko|game|bantuan|tolong|info|bantu/.test(t)) {
    return 'Siap bantu soal <b>CUFFLI ALL GAME</b> 😊<br>Kamu bisa tanya: harga, stok akun, cara order, QRIS, spin voucher, atau cara pakai diskon.';
  }

  // Tidak jelas / di luar
  return 'Saya <b>Asisten Cuffli</b> — bantu soal toko ini saja (akun game, harga, order, spin, pembayaran).<br>Coba tanya misalnya: "harga akun FF", "cara order", "cara spin", atau "bayar pakai apa?"';
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const box = document.getElementById('chatMessages');
  if (!input || !box) return;
  const text = input.value.trim();
  if (!text) return;

  const user = getCurrentUser();
  const name = user ? (user.nama || user.username) : 'Guest';

  box.innerHTML += `
    <div class="chat-msg me">
      <div class="chat-bubble">${escapeHtml(text)}</div>
      <div class="chat-meta">${escapeHtml(name)} · sekarang</div>
    </div>
  `;
  input.value = '';
  box.scrollTop = box.scrollHeight;

  setTimeout(() => {
    const reply = getCuffliAiReply(text);
    box.innerHTML += `
      <div class="chat-msg admin">
        <div class="chat-bubble">${reply}</div>
        <div class="chat-meta">Asisten Cuffli · sekarang</div>
      </div>
    `;
    box.scrollTop = box.scrollHeight;
    addNotification('Ada balasan baru dari Asisten Cuffli', 'info');
  }, 600 + Math.random() * 900);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

// ===== DETAIL GALLERY SLIDER =====
function initGallery(fotos) {
  const track = document.getElementById('galleryTrack');
  const dots = document.getElementById('galleryDots');
  if (!track || !dots) return;

  track.innerHTML = '';
  dots.innerHTML = '';

  fotos.forEach((src, i) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Foto ${i + 1}`;
    track.appendChild(img);

    const dot = document.createElement('span');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToSlide(i));
    dots.appendChild(dot);
  });

  let current = 0;
  const total = fotos.length;

  function goToSlide(idx) {
    current = idx;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.querySelectorAll('span').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  }

  setInterval(() => {
    current = (current + 1) % total;
    goToSlide(current);
  }, 3500);

  let startX = 0;
  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  track.addEventListener('touchend', (e) => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) current = (current + 1) % total;
      else current = (current - 1 + total) % total;
      goToSlide(current);
    }
  }, { passive: true });
}

// ===== QRIS COUNTDOWN TIMER =====
function startQrisTimer(minutes = 5) {
  const el = document.getElementById('qrisTimer');
  if (!el) return;

  let total = minutes * 60;

  function update() {
    const m = Math.floor(total / 60);
    const s = total % 60;
    el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (total <= 0) {
      el.textContent = '00:00';
      el.style.color = '#ff4466';
      return;
    }
    total--;
  }

  update();
  setInterval(update, 1000);
}

// ===== STATS PRODUK: views (mata) + likes (suka) =====
const PRODUCT_STATS_KEY = 'cuffli_product_stats';

function getAllProductStats() {
  try {
    const raw = localStorage.getItem(PRODUCT_STATS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveAllProductStats(all) {
  localStorage.setItem(PRODUCT_STATS_KEY, JSON.stringify(all));
}

function getProductStats(productId) {
  const all = getAllProductStats();
  const s = all[productId];
  if (!s || typeof s !== 'object') {
    return { views: 0, likes: 0, likedBy: [] };
  }
  return {
    views: Number(s.views) || 0,
    likes: Number(s.likes) || 0,
    likedBy: Array.isArray(s.likedBy) ? s.likedBy : []
  };
}

function setProductStats(productId, stats) {
  const all = getAllProductStats();
  all[productId] = {
    views: Math.max(0, Number(stats.views) || 0),
    likes: Math.max(0, Number(stats.likes) || 0),
    likedBy: Array.isArray(stats.likedBy) ? stats.likedBy : []
  };
  saveAllProductStats(all);
}

/** +1 view tiap buka detail (1× per produk per sesi tab, biar refresh tidak spam) */
function recordProductView(productId) {
  if (!productId) return getProductStats(productId);
  const sessionKey = 'cuffli_viewed_' + productId;
  if (sessionStorage.getItem(sessionKey)) {
    return getProductStats(productId);
  }
  const s = getProductStats(productId);
  s.views += 1;
  setProductStats(productId, s);
  sessionStorage.setItem(sessionKey, '1');
  return s;
}

function hasUserLiked(productId) {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const key = user ? (user.username || user.email || 'guest') : ('anon_' + (localStorage.getItem('cuffli_anon_id') || (function () {
    const id = 'a' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('cuffli_anon_id', id);
    return id;
  })()));
  const s = getProductStats(productId);
  return { liked: s.likedBy.includes(key), userKey: key, stats: s };
}

/** Favorit per user (sinkron dengan like produk) */
const FAVORITES_KEY_PREFIX = 'cuffli_favorites_';

function getFavoritesUserKey() {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (user) return user.username || user.email || 'guest';
  let id = localStorage.getItem('cuffli_anon_id');
  if (!id) {
    id = 'a' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('cuffli_anon_id', id);
  }
  return 'anon_' + id;
}

function getFavoritesList() {
  const key = FAVORITES_KEY_PREFIX + getFavoritesUserKey();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveFavoritesList(ids) {
  const key = FAVORITES_KEY_PREFIX + getFavoritesUserKey();
  localStorage.setItem(key, JSON.stringify(Array.isArray(ids) ? ids.filter(Boolean) : []));
}

/** Hapus favorit yang produknya sudah tidak ada */
function cleanDeletedFavorites() {
  if (typeof getProdukById !== 'function') return getFavoritesList();
  const list = getFavoritesList();
  const kept = list.filter((id) => !!getProdukById(id));
  if (kept.length !== list.length) saveFavoritesList(kept);
  return kept;
}

function addToFavorites(productId) {
  if (!productId) return;
  const list = getFavoritesList();
  if (!list.includes(productId)) {
    list.unshift(productId);
    saveFavoritesList(list);
  }
}

function removeFromFavorites(productId) {
  saveFavoritesList(getFavoritesList().filter((id) => id !== productId));
}

/** Toggle like + sync favorite + notif */
function toggleProductLike(productId) {
  const { liked, userKey, stats } = hasUserLiked(productId);
  let nowLiked;
  if (liked) {
    stats.likedBy = stats.likedBy.filter((u) => u !== userKey);
    stats.likes = Math.max(0, stats.likes - 1);
    nowLiked = false;
    removeFromFavorites(productId);
    if (typeof addNotification === 'function') {
      const p = typeof getProdukById === 'function' ? getProdukById(productId) : null;
      const name = p ? (p.nama + (p.subtitle ? ' — ' + p.subtitle : '')) : 'Produk';
      addNotification('Dihapus dari Favorite: ' + name, 'info');
    }
  } else {
    stats.likedBy.push(userKey);
    stats.likes += 1;
    nowLiked = true;
    addToFavorites(productId);
    if (typeof addNotification === 'function') {
      const p = typeof getProdukById === 'function' ? getProdukById(productId) : null;
      const name = p ? (p.nama + (p.subtitle ? ' — ' + p.subtitle : '')) : 'Produk';
      addNotification('Liked! Ditambahkan ke Favorite: ' + name, 'success');
    }
  }
  setProductStats(productId, stats);
  return { liked: nowLiked, views: stats.views, likes: stats.likes };
}

/** Render halaman favorite.html */
function renderFavoritesPage() {
  const grid = document.getElementById('favoriteGrid');
  const empty = document.getElementById('favoriteEmpty');
  if (!grid) return;

  const ids = cleanDeletedFavorites();
  grid.innerHTML = '';

  if (!ids.length) {
    if (empty) empty.style.display = 'block';
    grid.style.display = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';
  grid.style.display = 'grid';

  ids.forEach((id) => {
    const p = typeof getProdukById === 'function' ? getProdukById(id) : null;
    if (!p) return;
    const st = getProductStats(p.id);
    const card = document.createElement('div');
    card.className = 'produk-card';
    card.innerHTML = `
      <a class="produk-card-link" href="detail.html?id=${encodeURIComponent(p.id)}">
        <div class="produk-img-wrap">
          <img src="${p.thumbnail}" alt="${p.nama}" loading="lazy">
        </div>
        <div class="produk-info">
          ${p.kategori ? `<span class="produk-kategori">${p.kategori}</span>` : ''}
          <div class="game-name">${p.nama}</div>
          <div class="subtitle-small">${p.subtitle || ''}</div>
          <div class="harga">${p.hargaFormatted || ''}</div>
        </div>
      </a>
      <div class="produk-stats">
        <span class="stat-views"><i class="fa-solid fa-eye"></i> <b>${formatStatNum(st.views)}</b></span>
        <button type="button" class="stat-likes liked" data-fav-unlike="${encodeURIComponent(p.id)}">
          <i class="fa-solid fa-heart"></i> <b>${formatStatNum(st.likes)}</b>
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('[data-fav-unlike]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pid = decodeURIComponent(btn.getAttribute('data-fav-unlike'));
      toggleProductLike(pid);
      renderFavoritesPage();
    });
  });
}

function formatStatNum(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'jt';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'rb';
  return String(n);
}

// ===== RENDER PRODUK DI INDEX (dengan diskon & badge) =====
function renderProdukList() {
  const grid = document.getElementById('produkGrid');
  if (!grid || typeof getAllProduk !== 'function') return;

  const list = getAllProduk();
  grid.innerHTML = '';

  list.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'produk-card' + (p.badge ? ' has-flash' : '');

    const badgeHtml = p.badge
      ? `<span class="produk-badge flash"><i class="fa-solid fa-fire"></i> ${p.badge}</span>`
      : '';
    const prosesHtml = p.proses
      ? `<span class="produk-proses">${p.proses}</span>`
      : '';
    const kategoriHtml = p.kategori
      ? `<span class="produk-kategori">${p.kategori}</span>`
      : '';

    let hematHtml = '';
    if (p.hargaAsli && p.harga && p.hargaAsli > p.harga) {
      const hemat = p.hargaAsli - p.harga;
      hematHtml = `<div class="produk-hemat">Hemat Rp ${hemat.toLocaleString('id-ID')}</div>`;
    }

    const diskonHtml = p.diskon ? `
      <div class="harga-wrap">
        <span class="harga-asli">${p.hargaAsliFormatted}</span>
        <span class="harga">${p.hargaFormatted}</span>
      </div>
      ${hematHtml}
    ` : `<div class="harga">${p.hargaFormatted}</div>`;

    const cocokHtml = p.cocokUntuk
      ? `<div class="produk-cocok">${p.cocokUntuk}</div>`
      : '';

    const st = getProductStats(p.id);
    const { liked } = hasUserLiked(p.id);
    const safeId = encodeURIComponent(p.id);

    card.innerHTML = `
      <a class="produk-card-link" href="detail.html?id=${safeId}">
        <div class="produk-img-wrap">
          <img src="${p.thumbnail}" alt="${p.nama}" loading="lazy">
          ${badgeHtml}
          ${prosesHtml}
        </div>
        <div class="produk-info">
          ${kategoriHtml}
          <div class="game-name">${p.nama}</div>
          <div class="subtitle-small">${p.subtitle}</div>
          ${cocokHtml}
          ${diskonHtml}
        </div>
      </a>
      <div class="produk-stats" data-pid="${safeId}">
        <span class="stat-views" title="Dilihat">
          <i class="fa-solid fa-eye"></i>
          <b class="stat-views-num">${formatStatNum(st.views)}</b>
        </span>
        <button type="button" class="stat-likes ${liked ? 'liked' : ''}" title="Suka" data-like-id="${safeId}">
          <i class="fa-${liked ? 'solid' : 'regular'} fa-heart"></i>
          <b class="stat-likes-num">${formatStatNum(st.likes)}</b>
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  // Like buttons (stop navigation)
  grid.querySelectorAll('[data-like-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pid = decodeURIComponent(btn.getAttribute('data-like-id'));
      const res = toggleProductLike(pid);
      btn.classList.toggle('liked', res.liked);
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = res.liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
      }
      const num = btn.querySelector('.stat-likes-num');
      if (num) num.textContent = formatStatNum(res.likes);
    });
  });
}

// ===== LOAD DETAIL PAGE =====
function loadDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id || typeof getProdukById !== 'function') {
    document.body.innerHTML = '<div class="loading">Produk tidak ditemukan.</div>';
    return;
  }

  const p = getProdukById(id);
  if (!p) {
    document.body.innerHTML = '<div class="loading">Produk tidak ditemukan.</div>';
    return;
  }

  document.getElementById('detailNama').textContent = p.nama;
  document.getElementById('detailSubtitle').textContent = p.subtitle;

  const hargaEl = document.getElementById('detailHarga');
  if (p.diskon) {
    hargaEl.innerHTML = `
      <span class="harga-asli-detail">${p.hargaAsliFormatted}</span>
      <span class="harga-now">${p.hargaFormatted}</span>
      <span class="diskon-badge">-${p.diskon}%</span>
    `;
  } else {
    hargaEl.textContent = p.hargaFormatted;
  }

  document.getElementById('detailDeskripsi').textContent = p.deskripsi;

  // Kategori & cocok untuk
  const catEl = document.getElementById('detailKategori');
  if (catEl) {
    if (p.kategori) {
      catEl.style.display = 'inline-block';
      catEl.textContent = p.kategori;
    } else {
      catEl.style.display = 'none';
    }
  }
  const cocokEl = document.getElementById('detailCocok');
  if (cocokEl) {
    cocokEl.textContent = p.cocokUntuk || '';
    cocokEl.style.display = p.cocokUntuk ? 'block' : 'none';
  }
  const hematEl = document.getElementById('detailHemat');
  if (hematEl && p.hargaAsli && p.harga && p.hargaAsli > p.harga) {
    const hemat = p.hargaAsli - p.harga;
    hematEl.textContent = 'Hemat Rp ' + hemat.toLocaleString('id-ID');
    hematEl.style.display = 'block';
  } else if (hematEl) {
    hematEl.style.display = 'none';
  }

  // Views (+1 saat buka detail) & Likes
  const st = recordProductView(p.id);
  const likeState = hasUserLiked(p.id);
  const viewsNum = document.getElementById('detailViewsNum');
  const likesNum = document.getElementById('detailLikesNum');
  const likeBtn = document.getElementById('detailLikeBtn');
  const likeIcon = document.getElementById('detailLikeIcon');
  if (viewsNum) viewsNum.textContent = formatStatNum(st.views);
  if (likesNum) likesNum.textContent = formatStatNum(st.likes);
  if (likeBtn && likeIcon) {
    if (likeState.liked) {
      likeBtn.classList.add('liked');
      likeIcon.className = 'fa-solid fa-heart';
    }
    likeBtn.onclick = () => {
      const res = toggleProductLike(p.id);
      likeBtn.classList.toggle('liked', res.liked);
      likeIcon.className = res.liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
      if (likesNum) likesNum.textContent = formatStatNum(res.likes);
    };
  }

  const badgeArea = document.getElementById('detailBadges');
  if (badgeArea) {
    let html = '';
    if (p.badge) html += `<span class="detail-badge promo">${p.badge}</span>`;
    if (p.proses) html += `<span class="detail-badge fast">${p.proses}</span>`;
    badgeArea.innerHTML = html;
  }

  const spekEl = document.getElementById('detailSpek');
  spekEl.innerHTML = '';
  p.spek.forEach((s) => {
    const li = document.createElement('li');
    li.textContent = s;
    spekEl.appendChild(li);
  });

  initGallery(p.foto);

  // === ADMIN CARD (foto + chat WA khusus produk) ===
  const adminFoto = document.getElementById('adminFoto');
  const adminNama = document.getElementById('adminNama');
  const btnChatAdmin = document.getElementById('btnChatAdmin');
  if (adminFoto && p.adminFoto) adminFoto.src = p.adminFoto;
  if (adminNama) adminNama.textContent = p.adminNama || 'Admin CUFFLI';
  if (btnChatAdmin && p.adminWA) {
    const chatPesan = encodeURIComponent(
      `Halo ${p.adminNama || 'Admin'} 👋\n\nSaya tertarik dengan:\n• Produk: ${p.nama} (${p.subtitle})\n• Harga: ${p.hargaFormatted}\n• ID: ${p.id}\n\nMau tanya dulu ya.`
    );
    btnChatAdmin.href = `https://wa.me/${p.adminWA}?text=${chatPesan}`;
  }

  // Tombol Beli → langsung ke QR produk ini
  const btn = document.getElementById('btnBeli');
  if (btn) {
    btn.addEventListener('click', () => {
      const user = getCurrentUser();
      if (!user) {
        openAuthModal('login');
        addNotification('Silakan login dulu sebelum membeli ya!', 'info');
        return;
      }
      sessionStorage.setItem('produkId', p.id);
      window.location.href = `pembayaran.html?id=${encodeURIComponent(p.id)}`;
    });
  }

  // Produk terkait = game yang sama (FF→FF, ML→ML, dst)
  renderRelatedProduk(p);
}

/** Tampilkan produk lain dari game yang sama di bawah detail */
function renderRelatedProduk(current) {
  const section = document.getElementById('relatedSection');
  const grid = document.getElementById('relatedGrid');
  const label = document.getElementById('relatedGameLabel');
  if (!section || !grid || typeof getAllProduk !== 'function') return;

  const gameName = (current.game || current.nama || '').trim();
  if (!gameName) {
    section.style.display = 'none';
    return;
  }

  const related = getAllProduk().filter((p) => {
    if (p.id === current.id) return false;
    const g = (p.game || p.nama || '').trim().toLowerCase();
    return g === gameName.toLowerCase();
  });

  if (!related.length) {
    section.style.display = 'none';
    return;
  }

  if (label) label.textContent = '· ' + gameName;
  section.style.display = 'block';
  grid.innerHTML = '';

  related.forEach((p) => {
    const st = typeof getProductStats === 'function' ? getProductStats(p.id) : { views: 0, likes: 0 };
    const card = document.createElement('a');
    card.href = `detail.html?id=${encodeURIComponent(p.id)}`;
    card.className = 'related-card';
    card.innerHTML = `
      <div class="related-img">
        <img src="${p.thumbnail}" alt="${p.nama}" loading="lazy">
      </div>
      <div class="related-info">
        <div class="related-name">${p.nama}</div>
        <div class="related-sub">${p.subtitle || ''}</div>
        <div class="related-harga">${p.hargaFormatted || ''}</div>
        <div class="related-stats">
          <span><i class="fa-solid fa-eye"></i> ${typeof formatStatNum === 'function' ? formatStatNum(st.views) : st.views}</span>
          <span><i class="fa-solid fa-heart"></i> ${typeof formatStatNum === 'function' ? formatStatNum(st.likes) : st.likes}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ===== LOAD PEMBAYARAN PAGE (support voucher dari spin) =====
function loadPembayaran() {
  const params = new URLSearchParams(window.location.search);
  let id = params.get('id') || sessionStorage.getItem('produkId');

  if (!id || typeof getProdukById !== 'function') {
    document.getElementById('payContent').innerHTML =
      '<p class="loading">Tidak ada produk dipilih. <a href="index.html" style="color:#00b4ff">Kembali</a></p>';
    return;
  }

  const p = getProdukById(id);
  if (!p) {
    document.getElementById('payContent').innerHTML =
      '<p class="loading">Produk tidak ditemukan. <a href="index.html" style="color:#00b4ff">Kembali</a></p>';
    return;
  }

  // Simpan harga dasar
  let hargaAkhir = p.harga;
  let voucherDipakai = null;

  document.getElementById('payNama').textContent = p.nama + ' — ' + p.subtitle;

  function updateHargaDisplay() {
    const payHarga = document.getElementById('payHarga');
    if (!payHarga) return;

    if (voucherDipakai) {
      const potongan = Math.round(p.harga * (voucherDipakai.percent / 100));
      hargaAkhir = p.harga - potongan;
      payHarga.innerHTML = `
        <span class="harga-asli-detail">${p.hargaFormatted}</span>
        <span class="harga-now">Rp ${hargaAkhir.toLocaleString('id-ID')}</span>
        <span class="diskon-badge">Voucher -${voucherDipakai.percent}%</span>
      `;
    } else if (p.diskon) {
      hargaAkhir = p.harga;
      payHarga.innerHTML = `
        <span class="harga-asli-detail">${p.hargaAsliFormatted}</span>
        <span class="harga-now">${p.hargaFormatted}</span>
        <span class="diskon-badge">Hemat ${p.diskon}%</span>
      `;
    } else {
      hargaAkhir = p.harga;
      payHarga.textContent = p.hargaFormatted;
    }

    // Update pesan WA setiap kali harga berubah
    updateWAPesan();
  }

  function updateWAPesan() {
    const btnWA = document.getElementById('btnWA');
    if (!btnWA) return;
    let extraVoucher = '';
    if (voucherDipakai) {
      extraVoucher = `\n• Voucher: ${voucherDipakai.code} (-${voucherDipakai.percent}%)\n• Harga setelah voucher: Rp ${hargaAkhir.toLocaleString('id-ID')}`;
    }
    const pesan = encodeURIComponent(
      `Halo ${p.adminNama || 'Admin'} CUFFLI ALL GAME 👋\n\nSaya sudah transfer untuk:\n• Produk: ${p.nama} (${p.subtitle})\n• Harga: ${p.hargaFormatted}${extraVoucher}\n• ID: ${p.id}\n\nMohon dicek & diproses ya. Terima kasih!`
    );
    const nomorWA = p.adminWA || '6287722626689';
    btnWA.href = `https://wa.me/${nomorWA}?text=${pesan}`;
  }

  // === QR KHUSUS PRODUK INI ===
  const payQR = document.getElementById('payQR');
  const payQRLabel = document.getElementById('payQRLabel');
  if (payQR && p.qrImage) payQR.src = p.qrImage;
  if (payQRLabel) payQRLabel.textContent = p.qrLabel || 'QRIS Pembayaran';

  // === ADMIN KHUSUS PRODUK INI ===
  const payAdminFoto = document.getElementById('payAdminFoto');
  const payAdminNama = document.getElementById('payAdminNama');
  if (payAdminFoto && p.adminFoto) payAdminFoto.src = p.adminFoto;
  if (payAdminNama) payAdminNama.textContent = p.adminNama || 'Admin CUFFLI';

  // === VOUCHER DARI SPIN (jika ada) ===
  const voucherBox = document.getElementById('voucherSelectBox');
  if (voucherBox && typeof getAvailableVouchers === 'function') {
    const available = getAvailableVouchers();
    if (available.length > 0) {
      voucherBox.style.display = 'block';
      const select = document.getElementById('voucherSelect');
      select.innerHTML = '<option value="">— Tidak pakai voucher —</option>' +
        available.map(v => `<option value="${v.id}">${v.code} (−${v.percent}%)</option>`).join('');

      select.addEventListener('change', () => {
        const idV = select.value;
        if (!idV) {
          voucherDipakai = null;
        } else {
          voucherDipakai = available.find(v => String(v.id) === String(idV)) || null;
        }
        updateHargaDisplay();
      });
    } else {
      voucherBox.style.display = 'none';
    }
  }

  // Tombol "Sudah bayar" (opsional) — tandai voucher terpakai
  const btnConfirm = document.getElementById('btnConfirmPay');
  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      if (voucherDipakai && typeof markVoucherUsed === 'function') {
        markVoucherUsed(voucherDipakai.id);
        addNotification(`Voucher ${voucherDipakai.code} berhasil dipakai!`, 'success');
      }
      alert('Terima kasih! Silakan konfirmasi ke admin via WhatsApp.');
    });
  }

  updateHargaDisplay();
  startQrisTimer(5);
  addNotification(`Menunggu pembayaran untuk ${p.nama}. Scan QR admin: ${p.adminNama || 'Admin'}`, 'info');
}

// ===== SHARED UI (Header, Modal, Chat, Notif) =====
function injectSharedUI() {
  if (!document.getElementById('authModal')) {
    const modal = document.createElement('div');
    modal.id = 'authModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box">
        <button class="modal-close" onclick="closeAuthModal()">&times;</button>
        <h2 id="authTitle">Masuk / Daftar</h2>
        <p class="auth-sub">Login untuk order lebih cepat & dapat notifikasi</p>
        <div id="authError" class="auth-error"></div>

        <form id="formLogin" class="auth-form">
          <div id="authLoginForm">
            <input type="text" id="loginUser" placeholder="Username" required autocomplete="username">
            <input type="password" id="loginPass" placeholder="Password" required autocomplete="current-password">
            <button type="submit" class="btn-primary">Masuk</button>
            <p class="auth-switch">Belum punya akun? <a href="#" onclick="openAuthModal('register');return false;">Daftar</a></p>
          </div>
        </form>

        <form id="formRegister" class="auth-form" style="display:none">
          <div id="authRegisterForm">
            <input type="text" id="regNama" placeholder="Nama panggilan" required>
            <input type="text" id="regUser" placeholder="Username" required autocomplete="username">
            <input type="password" id="regPass" placeholder="Password (min 4)" required autocomplete="new-password">
            <button type="submit" class="btn-primary">Daftar</button>
            <p class="auth-switch">Sudah punya akun? <a href="#" onclick="openAuthModal('login');return false;">Masuk</a></p>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeAuthModal(); });
  }

  if (!document.getElementById('notifPanel')) {
    const panel = document.createElement('div');
    panel.id = 'notifPanel';
    panel.className = 'notif-panel';
    panel.innerHTML = `
      <div class="notif-header">
        <h3>Notifikasi</h3>
        <button onclick="toggleNotifPanel()">&times;</button>
      </div>
      <div id="notifList" class="notif-list"></div>
    `;
    document.body.appendChild(panel);
  }

  if (!document.getElementById('chatPanel')) {
    const chat = document.createElement('div');
    chat.id = 'chatPanel';
    chat.className = 'chat-panel';
    chat.innerHTML = `
      <div class="chat-header">
        <div>
          <strong>Chat CS CUFFLI</strong>
          <span class="chat-status">● Online</span>
        </div>
        <button onclick="closeChat()">&times;</button>
      </div>
      <div id="chatMessages" class="chat-messages">
        <div class="chat-msg admin">
          <div class="chat-bubble">Halo! Ada yang bisa dibantu? Tanyakan stok, harga, atau cara order di sini 😊</div>
          <div class="chat-meta">Asisten Cuffli · sekarang</div>
        </div>
      </div>
      <div class="chat-input-wrap">
        <input type="text" id="chatInput" placeholder="Ketik pesan..." onkeydown="if(event.key==='Enter')sendChatMessage()">
        <button onclick="sendChatMessage()"><i class="fa-solid fa-paper-plane"></i></button>
      </div>
    `;
    document.body.appendChild(chat);
  }

  if (!document.getElementById('btnChatFloat')) {
    const btn = document.createElement('button');
    btn.id = 'btnChatFloat';
    btn.className = 'chat-float';
    btn.innerHTML = '<i class="fa-solid fa-comments"></i>';
    btn.title = 'Chat CS';
    btn.onclick = openChat;
    document.body.appendChild(btn);
  }
}



// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  injectSharedUI();
  setupAuthForms();
  initDefaultNotifs();
  updateHeaderAuth();

  document.addEventListener('click', (e) => {
    const panel = document.getElementById('notifPanel');
    const bell = document.getElementById('btnNotif');
    if (panel && panel.classList.contains('show') && !panel.contains(e.target) && bell && !bell.contains(e.target)) {
      panel.classList.remove('show');
    }
  });

  const page = document.body.dataset.page;

  if (page === 'index') {
    renderProdukList();
  } else if (page === 'detail') {
    loadDetail();
  } else if (page === 'pembayaran') {
    loadPembayaran();
  } else if (page === 'favorite') {
    renderFavoritesPage();
  }
});
