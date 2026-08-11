/**
 * spin.js — Roda spin voucher
 * - Harus login
 * - Dapat 3 spin HANYA dengan redeem kode
 * - 1 kode = 1× pakai saja (kalau orang lain sudah pakai → invalid)
 * - Cek dipakai lewat Firebase (lintas device) + localStorage
 * - Bayar 15rb → admin kasih kode → user input kode di halaman spin
 * - Hasil: ZONK atau Voucher 10% / 15% / 20% / 25% / 30% (max 30%)
 * - Voucher bisa dipakai di halaman pembayaran produk
 * - Catatan: Game challenge max 25% (level 100) — spin terpisah, max 30%
 */

const SPIN_PRICE = 15000;
const SPIN_AMOUNT = 3;
const SPIN_KEY_PREFIX = 'cuffli_spin_';
const USED_CODES_KEY = 'cuffli_used_spin_codes';
const CODE_POOL_KEY = 'cuffli_spin_code_pool'; // semua kode (cadangan + admin buat)
const GENERATED_CODES_KEY = 'cuffli_generated_spin_codes';

// ============================================================
// KODE REDEEM SPIN (cadangan awal)
// Setiap kode HANYA 1× pakai. Setelah dipakai = invalid permanen.
// Admin bisa tambah kode baru lewat Panel Admin.
// ============================================================
const VALID_SPIN_CODES = [
  'CUFFLI-SPIN-A1B2',
  'CUFFLI-SPIN-C3D4',
  'CUFFLI-SPIN-E5F6',
  'CUFFLI-SPIN-G7H8',
  'CUFFLI-SPIN-J9K0',
  'CUFFLI-SPIN-L1M2',
  'CUFFLI-SPIN-N3P4',
  'CUFFLI-SPIN-Q5R6',
  'CUFFLI-SPIN-S7T8',
  'CUFFLI-SPIN-U9V0',
];

// ============================================================
// ADMIN — cara buka panel:
// 1. Login username: admin / cuffli / cuffliadmin
// 2. ATAU masukkan PIN di panel (default: cuffliadmin)
// ============================================================
// Hanya username "admin" yang boleh lihat panel. PIN tidak ditampilkan ke user lain.
const ADMIN_USERNAMES = ['admin'];
const ADMIN_PIN = 'cuffliadmin'; // cadangan internal (panel hanya muncul untuk username admin)
const ADMIN_UNLOCK_KEY = 'cuffli_admin_unlocked';
// ============================================================

// Segmen roda (urutan clockwise) — spin max 30% (beda dari game challenge max 25%)
// Hanya 1 ZONK biar tidak kelihatan “sengaja zonk terus”
const SEGMENTS = [
  { label: '10%', type: 'voucher', value: 10, color: '#00b4ff', weight: 26 },
  { label: '15%', type: 'voucher', value: 15, color: '#25d366', weight: 18 },
  { label: '20%', type: 'voucher', value: 20, color: '#ffaa00', weight: 14 },
  { label: '10%', type: 'voucher', value: 10, color: '#0090cc', weight: 12 },
  { label: 'ZONK', type: 'zonk', color: '#444466', weight: 12 },
  { label: '25%', type: 'voucher', value: 25, color: '#ff6b9d', weight: 8 },
  { label: '15%', type: 'voucher', value: 15, color: '#1db954', weight: 7 },
  { label: '30%', type: 'voucher', value: 30, color: '#ff2d6a', weight: 3 },
];

let spinning = false;
let currentRotation = 0;

// ===== DATA PER USER (localStorage, siap sync Firebase) =====
function getSpinUserKey() {
  const user = getCurrentUser();
  if (!user) return null;
  return SPIN_KEY_PREFIX + (user.username || user.email || 'guest');
}

function getSpinData() {
  const key = getSpinUserKey();
  if (!key) return { spinSisa: 0, vouchers: [], paid: false };
  try {
    return JSON.parse(localStorage.getItem(key) || '{"spinSisa":0,"vouchers":[],"paid":false}');
  } catch {
    return { spinSisa: 0, vouchers: [], paid: false };
  }
}

function saveSpinData(data) {
  const key = getSpinUserKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(data));
  // Sync ke Firebase jika tersedia
  if (window.CuffliFirebase && window.CuffliFirebase.ready) {
    const user = getCurrentUser();
    if (user && user.uid) {
      window.CuffliFirebase.fbUpdateUserData(user.uid, {
        spinSisa: data.spinSisa,
        vouchers: data.vouchers,
        spinPaid: data.paid
      });
    }
  }
}

function addVoucher(percent) {
  const data = getSpinData();
  data.vouchers.push({
    id: Date.now() + Math.random(),
    percent: percent,
    code: 'CUFFLI' + percent + '-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
    created: new Date().toLocaleString('id-ID'),
    used: false
  });
  saveSpinData(data);
  return data.vouchers[data.vouchers.length - 1];
}

/** Ambil daftar voucher yang masih aktif (belum dipakai) */
function getAvailableVouchers() {
  const data = getSpinData();
  return (data.vouchers || []).filter(v => !v.used);
}

/** Tandai voucher sebagai sudah dipakai */
function markVoucherUsed(voucherId) {
  const data = getSpinData();
  const v = data.vouchers.find(x => x.id === voucherId);
  if (v) {
    v.used = true;
    saveSpinData(data);
  }
}

// ===== PILIH HASIL BERDASARKAN WEIGHT =====
function pickSegment() {
  const total = SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SEGMENTS.length; i++) {
    r -= SEGMENTS[i].weight;
    if (r <= 0) return i;
  }
  return 0;
}

// ===== GAMBAR RODA (premium, bukan pasaran) =====
function drawWheel() {
  const canvas = document.getElementById('wheelCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const rimW = 18;
  const radius = outerR - rimW;
  const n = SEGMENTS.length;
  const arc = (2 * Math.PI) / n;

  ctx.clearRect(0, 0, size, size);

  // Soft outer shadow disc
  ctx.beginPath();
  ctx.arc(cx, cy + 4, outerR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  // === Chrome/metal outer rim ===
  const rimGrad = ctx.createLinearGradient(cx - outerR, cy - outerR, cx + outerR, cy + outerR);
  rimGrad.addColorStop(0, '#7ef0ff');
  rimGrad.addColorStop(0.22, '#00b4ff');
  rimGrad.addColorStop(0.45, '#0a2a40');
  rimGrad.addColorStop(0.6, '#4ddfff');
  rimGrad.addColorStop(0.8, '#006699');
  rimGrad.addColorStop(1, '#00d4ff');
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fillStyle = rimGrad;
  ctx.fill();

  // Inner rim dark channel
  ctx.beginPath();
  ctx.arc(cx, cy, outerR - 5, 0, Math.PI * 2);
  ctx.fillStyle = '#061018';
  ctx.fill();

  // Rim rivets / studs
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const rx = cx + Math.cos(a) * (outerR - 9);
    const ry = cy + Math.sin(a) * (outerR - 9);
    const rg = ctx.createRadialGradient(rx - 1, ry - 1, 0, rx, ry, 3.5);
    rg.addColorStop(0, '#e8fbff');
    rg.addColorStop(0.5, '#00b4ff');
    rg.addColorStop(1, '#003850');
    ctx.beginPath();
    ctx.arc(rx, ry, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = rg;
    ctx.fill();
  }

  // Dark plate behind slices
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2);
  ctx.fillStyle = '#05080e';
  ctx.fill();

  // === Slices ===
  for (let i = 0; i < n; i++) {
    const start = i * arc - Math.PI / 2;
    const end = start + arc;
    const mid = start + arc / 2;
    const base = SEGMENTS[i].color;
    const isZonk = SEGMENTS[i].type === 'zonk';

    // Main slice fill
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();

    const gx = cx + Math.cos(mid) * radius * 0.35;
    const gy = cy + Math.sin(mid) * radius * 0.35;
    const g = ctx.createRadialGradient(gx, gy, 0, cx, cy, radius);
    if (isZonk) {
      g.addColorStop(0, lightenColor(base, 28));
      g.addColorStop(0.5, base);
      g.addColorStop(1, darkenColor(base, 25));
    } else {
      g.addColorStop(0, lightenColor(base, 55));
      g.addColorStop(0.4, lightenColor(base, 15));
      g.addColorStop(0.75, base);
      g.addColorStop(1, darkenColor(base, 35));
    }
    ctx.fillStyle = g;
    ctx.fill();

    // Highlight arc on outer edge of slice
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 3, start + 0.04, end - 0.04);
    ctx.strokeStyle = isZonk ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Slice divider (gold-ish edge)
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(start) * radius, cy + Math.sin(start) * radius);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label + icon
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(mid);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    if (isZonk) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('ZONK', radius * 0.62, 0);
    } else {
      // Ticket emoji-ish mark
      ctx.font = '14px "Segoe UI Emoji", sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('🎟', radius * 0.42, -1);
      ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(SEGMENTS[i].label, radius * 0.68, -2);
      ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText('VOUCHER', radius * 0.68, 12);
    }
    ctx.restore();
  }

  // Inner bevel ring
  ctx.beginPath();
  ctx.arc(cx, cy, 38, 0, Math.PI * 2);
  const innerRing = ctx.createRadialGradient(cx, cy, 28, cx, cy, 42);
  innerRing.addColorStop(0, 'rgba(0,212,255,0.15)');
  innerRing.addColorStop(0.7, 'rgba(0,180,255,0.35)');
  innerRing.addColorStop(1, 'rgba(0,100,150,0.1)');
  ctx.strokeStyle = innerRing;
  ctx.lineWidth = 10;
  ctx.stroke();

  // Center hub — glossy
  const hubOuter = ctx.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, 32);
  hubOuter.addColorStop(0, '#1e4a66');
  hubOuter.addColorStop(0.45, '#0a1824');
  hubOuter.addColorStop(1, '#02060a');
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, Math.PI * 2);
  ctx.fillStyle = hubOuter;
  ctx.fill();

  // Hub ring stroke
  const hubStroke = ctx.createLinearGradient(cx - 32, cy - 32, cx + 32, cy + 32);
  hubStroke.addColorStop(0, '#7ef0ff');
  hubStroke.addColorStop(0.5, '#00b4ff');
  hubStroke.addColorStop(1, '#005577');
  ctx.strokeStyle = hubStroke;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Inner hub disc
  const hubInner = ctx.createRadialGradient(cx - 4, cy - 5, 1, cx, cy, 20);
  hubInner.addColorStop(0, '#0d2838');
  hubInner.addColorStop(1, '#040a10');
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fillStyle = hubInner;
  ctx.fill();

  // Center label
  ctx.shadowColor = 'rgba(0,212,255,0.9)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#7ef0ff';
  ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SPIN', cx, cy - 1);
  ctx.shadowBlur = 0;

  // Tiny shine on hub
  ctx.beginPath();
  ctx.ellipse(cx - 6, cy - 8, 7, 3.5, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
}

function lightenColor(hex, pct) {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) + pct;
  let g = ((n >> 8) & 0xff) + pct;
  let b = (n & 0xff) + pct;
  r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function darkenColor(hex, pct) {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) - pct;
  let g = ((n >> 8) & 0xff) - pct;
  let b = (n & 0xff) - pct;
  r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ===== ANIMASI SPIN (premium easing + glow) =====
function doSpin() {
  if (spinning) return;
  const user = getCurrentUser();
  if (!user) {
    alert('Login dulu untuk spin!');
    location.href = 'login.html';
    return;
  }
  const data = getSpinData();
  if (data.spinSisa <= 0) {
    alert('Sisa spin habis. Beli paket spin dulu ya!');
    return;
  }

  spinning = true;
  const btn = document.getElementById('btnSpin');
  if (btn) btn.disabled = true;

  const stage = document.getElementById('wheelStage');
  if (stage) stage.classList.add('is-spinning');

  // Hide previous result
  const resultBox = document.getElementById('spinResult');
  if (resultBox) {
    resultBox.style.display = 'none';
    resultBox.classList.remove('win', 'lose', 'show');
  }

  const winIndex = pickSegment();
  const n = SEGMENTS.length;
  const arcDeg = 360 / n;

  // Pointer di atas → tengah segmen pemenang di atas
  const segmentCenter = winIndex * arcDeg + arcDeg / 2;
  const extraTurns = 6 * 360; // 6 putaran penuh
  const finalRotation = currentRotation + extraTurns + (360 - ((segmentCenter + (currentRotation % 360)) % 360));

  const canvas = document.getElementById('wheelCanvas');
  const duration = 5200; // lebih lama, lebih dramatic
  const start = performance.now();
  const from = currentRotation;

  function easeOutQuint(t) {
    return 1 - Math.pow(1 - t, 5);
  }

  function animate(now) {
    const t = Math.min(1, (now - start) / duration);
    const ease = easeOutQuint(t);
    currentRotation = from + (finalRotation - from) * ease;
    if (canvas) canvas.style.transform = `rotate(${currentRotation}deg)`;

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      spinning = false;
      currentRotation = finalRotation;
      if (stage) stage.classList.remove('is-spinning');
      onSpinEnd(winIndex);
    }
  }
  requestAnimationFrame(animate);
}

function onSpinEnd(index) {
  const seg = SEGMENTS[index];
  const data = getSpinData();
  data.spinSisa = Math.max(0, data.spinSisa - 1);
  saveSpinData(data);

  const resultBox = document.getElementById('spinResult');
  const icon = document.getElementById('spinResultIcon');
  const text = document.getElementById('spinResultText');
  const stage = document.getElementById('wheelStage');

  if (resultBox) {
    resultBox.style.display = 'block';
    resultBox.classList.remove('win', 'lose');
    // retrigger animation
    resultBox.classList.remove('show');
    void resultBox.offsetWidth;
    resultBox.classList.add('show');
  }

  if (seg.type === 'zonk') {
    if (resultBox) resultBox.classList.add('lose');
    if (icon) icon.innerHTML = '<i class="fa-solid fa-face-frown"></i>';
    if (text) text.innerHTML = '<strong>ZONK!</strong><br>Belum beruntung, coba spin lagi.';
    if (typeof addNotification === 'function') {
      addNotification('Spin: ZONK 😅 Sisa spin: ' + data.spinSisa, 'info');
    }
  } else {
    if (resultBox) resultBox.classList.add('win');
    if (stage) {
      stage.classList.add('is-win');
      setTimeout(() => stage.classList.remove('is-win'), 1800);
    }
    spawnConfetti();
    const v = addVoucher(seg.value);
    if (icon) icon.innerHTML = '<i class="fa-solid fa-ticket"></i>';
    if (text) {
      text.innerHTML = `<strong>SELAMAT!</strong><br>Dapat Voucher <span class="result-pct">Diskon ${seg.value}%</span><br><small>Kode: <b>${v.code}</b></small>`;
    }
    if (typeof addNotification === 'function') {
      addNotification(`Spin: Voucher ${seg.value}%! Kode: ${v.code}`, 'success');
    }
  }

  updateSpinUI();
  const btn = document.getElementById('btnSpin');
  if (btn) btn.disabled = data.spinSisa <= 0;
}

/** Confetti kecil saat menang voucher */
function spawnConfetti() {
  const stage = document.getElementById('wheelStage');
  if (!stage) return;
  const colors = ['#00d4ff', '#ff6b9d', '#25d366', '#ffaa00', '#7ef0ff', '#ff2d6a'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('span');
    p.className = 'confetti-piece';
    p.style.left = (20 + Math.random() * 60) + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = (Math.random() * 0.25) + 's';
    p.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
    p.style.setProperty('--rot', (Math.random() * 360) + 'deg');
    stage.appendChild(p);
    setTimeout(() => p.remove(), 1600);
  }
}

// ===== KODE REDEEM — sistem 1× pakai ketat =====
// Pool = semua kode valid (cadangan + yang admin buat)
// Used  = kode yang sudah pernah di-redeem (permanen invalid)

function normalizeCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9\-]/g, '');
}

function getUsedCodes() {
  try {
    const raw = localStorage.getItem(USED_CODES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Harus array. Kalau data lama rusak (object/string), reset.
    if (!Array.isArray(parsed)) {
      localStorage.setItem(USED_CODES_KEY, '[]');
      return [];
    }
    // Rapikan item
    return parsed
      .map(c => {
        if (typeof c === 'string') return { code: normalizeCode(c), usedBy: 'unknown', usedAt: '-' };
        if (c && typeof c === 'object' && c.code) {
          return {
            code: normalizeCode(c.code),
            usedBy: c.usedBy || 'unknown',
            usedAt: c.usedAt || '-'
          };
        }
        return null;
      })
      .filter(Boolean);
  } catch (e) {
    try { localStorage.setItem(USED_CODES_KEY, '[]'); } catch (_) {}
    return [];
  }
}

function saveUsedCodes(list) {
  try {
    const clean = Array.isArray(list) ? list : [];
    localStorage.setItem(USED_CODES_KEY, JSON.stringify(clean));
  } catch (e) {
    console.warn('Gagal simpan used codes', e);
  }
}

/** Semua kode yang boleh di-redeem (cadangan + admin buat), belum tentu available */
function getCodePool() {
  try {
    let pool = JSON.parse(localStorage.getItem(CODE_POOL_KEY) || 'null');
    if (!Array.isArray(pool) || pool.length === 0) {
      // Seed dari VALID_SPIN_CODES + generated lama
      pool = VALID_SPIN_CODES.map(c => ({
        code: String(c).toUpperCase(),
        source: 'manual',
        createdAt: '-',
        createdBy: 'system'
      }));
      // Gabung generated lama biar tidak hilang
      try {
        const gen = JSON.parse(localStorage.getItem(GENERATED_CODES_KEY) || '[]');
        gen.forEach(g => {
          const code = normalizeCode(g.code || g);
          if (code && !pool.some(p => p.code === code)) {
            pool.push({
              code,
              source: 'admin',
              createdAt: g.createdAt || new Date().toLocaleString('id-ID'),
              createdBy: g.createdBy || 'admin',
              forUsername: g.forUsername || null
            });
          }
        });
      } catch (_) {}
      localStorage.setItem(CODE_POOL_KEY, JSON.stringify(pool));
    }
    return pool;
  } catch {
    return VALID_SPIN_CODES.map(c => ({
      code: String(c).toUpperCase(),
      source: 'manual',
      createdAt: '-',
      createdBy: 'system'
    }));
  }
}

function saveCodePool(pool) {
  try {
    localStorage.setItem(CODE_POOL_KEY, JSON.stringify(pool));
  } catch (e) {
    console.warn('Gagal simpan code pool', e);
  }
}

/** Tambah kode ke pool (admin). Return false jika sudah ada. */
function addCodeToPool(code, meta) {
  const upper = normalizeCode(code);
  if (!upper || upper.length < 6) return { ok: false, msg: 'Kode terlalu pendek (min 6 karakter).' };
  const pool = getCodePool();
  if (pool.some(p => p.code === upper)) {
    return { ok: false, msg: 'Kode sudah ada di daftar.' };
  }
  if (isCodeAlreadyUsedLocal(upper)) {
    return { ok: false, msg: 'Kode ini sudah pernah dipakai. Tidak bisa ditambah lagi.' };
  }
  pool.push({
    code: upper,
    source: 'admin',
    createdAt: new Date().toLocaleString('id-ID'),
    createdBy: (meta && meta.createdBy) || 'admin',
    forUsername: (meta && meta.forUsername) || null
  });
  saveCodePool(pool);
  return { ok: true, code: upper };
}

function markCodeUsed(code, username) {
  const upper = normalizeCode(code);
  if (!upper) return;

  // 1. Simpan ke daftar used (permanen)
  let used = getUsedCodes();
  if (!Array.isArray(used)) used = [];
  if (!used.some(c => c && c.code === upper)) {
    used.push({
      code: upper,
      usedBy: username || 'unknown',
      usedAt: new Date().toLocaleString('id-ID')
    });
    saveUsedCodes(used);
  }

  // 2. Update status di generated history
  try {
    const genList = getGeneratedCodes();
    const genItem = genList.find(c => c.code === upper);
    if (genItem) {
      genItem.status = 'used';
      genItem.usedBy = username || 'unknown';
      genItem.usedAt = new Date().toLocaleString('id-ID');
      saveGeneratedCodes(genList);
    }
  } catch (_) {}

  // 3. Firebase (opsional)
  try {
    if (window.CuffliFirebase && window.CuffliFirebase.ready && window.CuffliFirebase.db) {
      const p = window.CuffliFirebase.db.collection('usedSpinCodes').doc(upper).set({
        code: upper,
        usedBy: username || 'unknown',
        usedAt: new Date().toISOString()
      });
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch (_) {}
}

function isCodeAlreadyUsedLocal(code) {
  try {
    const upper = normalizeCode(code);
    const used = getUsedCodes();
    if (!Array.isArray(used)) return false;
    return used.some(c => (c && c.code) === upper);
  } catch {
    return false;
  }
}

/** Cek apakah kode sudah dipakai (1× saja). Firebase opsional. */
async function isCodeAlreadyUsed(code) {
  const upper = normalizeCode(code);

  // Local dulu — paling cepat & pasti
  if (isCodeAlreadyUsedLocal(upper)) return true;

  try {
    if (window.CuffliFirebase && window.CuffliFirebase.ready && window.CuffliFirebase.db) {
      try {
        const doc = await window.CuffliFirebase.db.collection('usedSpinCodes').doc(upper).get();
        const exists = doc && (doc.exists === true || (typeof doc.exists === 'function' && doc.exists()));
        if (exists) {
          const data = typeof doc.data === 'function' ? doc.data() : {};
          markCodeUsed(upper, (data && data.usedBy) || 'unknown');
          return true;
        }
      } catch (e) {
        console.warn('Gagal cek used code di Firebase, pakai local', e);
      }
    }
  } catch (_) {}

  return false;
}

// ===== ADMIN: generate & kasih kode ke user =====
function isAdminUnlocked() {
  try {
    return sessionStorage.getItem(ADMIN_UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

function setAdminUnlocked(val) {
  try {
    if (val) sessionStorage.setItem(ADMIN_UNLOCK_KEY, '1');
    else sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
  } catch (_) {}
}

function isAdmin() {
  // HANYA username "admin" — PIN tidak bisa dipakai orang lain untuk buka panel
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!user) return false;
  const uname = (user.username || '').toLowerCase().trim();
  return ADMIN_USERNAMES.map(a => a.toLowerCase()).includes(uname);
}

/** PIN hanya valid jika sudah login sebagai admin */
function unlockAdminWithPin(pin) {
  if (!isAdmin()) {
    return { ok: false, msg: 'Panel hanya untuk akun admin.' };
  }
  if ((pin || '').trim() === ADMIN_PIN) {
    setAdminUnlocked(true);
    return { ok: true, msg: 'Panel admin terbuka.' };
  }
  return { ok: false, msg: 'PIN salah.' };
}

function getGeneratedCodes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GENERATED_CODES_KEY) || '[]');
    if (!Array.isArray(parsed)) {
      localStorage.setItem(GENERATED_CODES_KEY, '[]');
      return [];
    }
    return parsed.filter(c => c && c.code).map(c => ({
      code: normalizeCode(c.code),
      createdAt: c.createdAt || '-',
      createdBy: c.createdBy || 'admin',
      forUsername: c.forUsername || null,
      status: c.status || 'available',
      usedBy: c.usedBy || null,
      usedAt: c.usedAt || null,
      givenAt: c.givenAt || null
    }));
  } catch {
    try { localStorage.setItem(GENERATED_CODES_KEY, '[]'); } catch (_) {}
    return [];
  }
}

function saveGeneratedCodes(list) {
  try {
    localStorage.setItem(GENERATED_CODES_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Gagal simpan generated codes', e);
  }
  // Sync ke Firebase jika ada (jangan sampai gagalkan flow utama)
  try {
    if (window.CuffliFirebase && window.CuffliFirebase.ready && window.CuffliFirebase.db) {
      list.forEach(entry => {
        try {
          const p = window.CuffliFirebase.db.collection('generatedSpinCodes').doc(entry.code).set(entry, { merge: true });
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (_) {}
      });
    }
  } catch (_) {}
}

/** Buat kode unik format: CUFFLI-SPIN-XXXX */
function makeRandomSpinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part = '';
  for (let i = 0; i < 4; i++) {
    part += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'CUFFLI-SPIN-' + part;
}

/**
 * Admin buat / simpan 1 kode baru.
 * customCode kosong = acak otomatis.
 */
function adminGenerateSpinCode(customCode, forUsername) {
  if (!isAdmin()) {
    return { ok: false, msg: 'Buka panel admin dulu (login admin atau masukkan PIN).' };
  }

  const pool = Array.isArray(getCodePool()) ? getCodePool() : [];
  const usedList = getUsedCodes();
  const existing = new Set([
    ...pool.map(p => p.code),
    ...(Array.isArray(usedList) ? usedList.map(c => c.code) : [])
  ]);

  let code = normalizeCode(customCode);

  if (code) {
    if (code.length < 6) {
      return { ok: false, msg: 'Kode terlalu pendek (min 6 karakter).' };
    }
    if (existing.has(code)) {
      return { ok: false, msg: 'Kode sudah ada / sudah dipakai. Pakai kode lain.' };
    }
  } else {
    code = makeRandomSpinCode();
    let tries = 0;
    while (existing.has(code) && tries < 40) {
      code = makeRandomSpinCode();
      tries++;
    }
  }

  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const createdBy = (user && user.username) || 'admin';
  const forUser = (forUsername || '').trim() || null;

  // 1. Masukkan ke pool (biar bisa di-redeem)
  const addRes = addCodeToPool(code, { createdBy, forUsername: forUser });
  if (!addRes.ok) return addRes;

  // 2. Masukkan ke riwayat generate
  const entry = {
    code: code,
    createdAt: new Date().toLocaleString('id-ID'),
    createdBy: createdBy,
    forUsername: forUser,
    status: 'available'
  };
  const list = getGeneratedCodes();
  list.push(entry);
  saveGeneratedCodes(list);

  return {
    ok: true,
    code: code,
    msg: `Kode siap: ${code}` + (forUser ? ` (untuk @${forUser})` : '') + ' — salin & kirim ke WA pembeli!'
  };
}

/** Tandai kode sudah diberikan ke user (opsional, untuk tracking admin) */
function adminMarkCodeGiven(code, forUsername) {
  if (!isAdmin()) return { ok: false, msg: 'Hanya admin.' };
  const upper = normalizeCode(code);
  const list = getGeneratedCodes();
  const item = list.find(c => c.code === upper);
  if (!item) return { ok: false, msg: 'Kode tidak ditemukan di daftar generate.' };
  item.status = 'given';
  if (forUsername) item.forUsername = forUsername.trim();
  item.givenAt = new Date().toLocaleString('id-ID');
  saveGeneratedCodes(list);
  return { ok: true, msg: 'Kode ditandai sudah diberikan.' };
}

/** Kode valid = ada di pool (cadangan atau admin buat) */
function isValidSpinCode(code) {
  if (!code) return false;
  const upper = normalizeCode(code);
  return getCodePool().some(p => p.code === upper);
}

/**
 * Redeem kode → +3 spin.
 * Setiap kode HANYA bisa dipakai 1× oleh siapapun.
 * Setelah dipakai → invalid permanen (orang lain juga tidak bisa).
 */
async function redeemSpinCode(rawCode) {
  try {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) {
      return { ok: false, msg: 'Login dulu untuk redeem kode!' };
    }

    const code = normalizeCode(rawCode);
    if (!code) {
      return { ok: false, msg: 'Masukkan kode dulu' };
    }

    // Cek valid (ada di pool)
    if (!isValidSpinCode(code)) {
      return { ok: false, msg: 'Kode tidak valid / salah' };
    }

    // Cek sudah dipakai — WAJIB 1× saja
    let alreadyUsed = isCodeAlreadyUsedLocal(code);
    if (!alreadyUsed) {
      try {
        alreadyUsed = await isCodeAlreadyUsed(code);
      } catch (_) {
        alreadyUsed = isCodeAlreadyUsedLocal(code);
      }
    }

    if (alreadyUsed) {
      return { ok: false, msg: 'Kode sudah dipakai. Tidak bisa dipakai lagi (1 kode = 1× saja).' };
    }

    // Tandai TERPAKAI dulu sebelum kasih spin (cegah double)
    markCodeUsed(code, user.username || user.email || 'unknown');

    // Double-check setelah mark (jaga-jaga race)
    if (!isCodeAlreadyUsedLocal(code)) {
      // mark gagal simpan — coba sekali lagi
      markCodeUsed(code, user.username || user.email || 'unknown');
    }

    const data = getSpinData();
    data.spinSisa = (Number(data.spinSisa) || 0) + SPIN_AMOUNT;
    data.paid = true;
    if (!Array.isArray(data.vouchers)) data.vouchers = [];
    saveSpinData(data);

    try {
      if (typeof addNotification === 'function') {
        addNotification(`Kode berhasil! +${SPIN_AMOUNT} spin. Sisa: ${data.spinSisa}`, 'success');
      }
    } catch (_) {}

    return {
      ok: true,
      msg: `Berhasil! Kamu mendapat ${SPIN_AMOUNT}x spin. Sisa spin: ${data.spinSisa}`,
      spinSisa: data.spinSisa
    };
  } catch (e) {
    console.error('redeemSpinCode error', e);
    return { ok: false, msg: 'Gagal redeem: ' + (e && e.message ? e.message : 'coba lagi') };
  }
}

// ===== BELI SPIN (arahin ke pembayaran, admin kasih kode) =====
function beliSpin() {
  const user = getCurrentUser();
  if (!user) {
    alert('Login dulu sebelum beli spin!');
    location.href = 'login.html';
    return;
  }
  sessionStorage.setItem('beliSpin', '1');
  location.href = 'pembayaran-spin.html';
}

/** Dipanggil dari UI tombol redeem */
async function handleRedeemCode() {
  const input = document.getElementById('redeemCodeInput');
  const msgEl = document.getElementById('redeemMsg');
  const btn = document.getElementById('btnRedeemCode');
  if (!input) return;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cek...';
  }

  try {
    const res = await redeemSpinCode(input.value);
    if (msgEl) {
      msgEl.style.color = res.ok ? '#25d366' : '#ff4466';
      msgEl.textContent = res.msg || (res.ok ? 'Berhasil!' : 'Gagal');
    }

    if (res && res.ok) {
      input.value = '';
      try { updateSpinUI(); } catch (_) {}
      try { alert(res.msg); } catch (_) {}
    }
  } catch (e) {
    console.error('handleRedeemCode error', e);
    if (msgEl) {
      msgEl.style.color = '#ff4466';
      msgEl.textContent = 'Error: ' + (e && e.message ? e.message : 'Coba lagi');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-key"></i> Redeem Kode';
    }
  }
}

// ===== UI UPDATE =====
function updateSpinUI() {
  const user = getCurrentUser();
  const statusText = document.getElementById('spinStatusText');
  const sisaText = document.getElementById('spinSisaText');
  const btnSpin = document.getElementById('btnSpin');
  const buyBox = document.getElementById('spinBuyBox');

  if (!user) {
    if (statusText) statusText.textContent = 'Belum login';
    if (sisaText) sisaText.textContent = '0';
    if (btnSpin) btnSpin.disabled = true;
    if (buyBox) buyBox.style.display = 'block';
    renderVouchers([]);
    updateAdminPanel();
    return;
  }

  const data = getSpinData();
  if (statusText) statusText.textContent = user.nama || user.username;
  if (sisaText) sisaText.textContent = data.spinSisa;
  if (btnSpin) btnSpin.disabled = data.spinSisa <= 0 || spinning;
  // Kotak redeem + beli selalu tampil biar bisa beli lagi
  if (buyBox) buyBox.style.display = 'block';
  renderVouchers(data.vouchers);
  updateAdminPanel();
}

function renderVouchers(list) {
  const el = document.getElementById('voucherList');
  if (!el) return;
  if (!list || list.length === 0) {
    el.innerHTML = '<p class="voucher-empty">Belum ada voucher. Spin dulu ya!</p>';
    return;
  }
  el.innerHTML = list.slice().reverse().map(v => `
    <div class="voucher-item ${v.used ? 'used' : ''}">
      <div class="voucher-percent">-${v.percent}%</div>
      <div class="voucher-info">
        <div class="voucher-code">${v.code}</div>
        <div class="voucher-date">${v.created}${v.used ? ' · Sudah dipakai' : ' · Siap dipakai'}</div>
      </div>
      ${!v.used ? `
        <button class="btn-copy-voucher" onclick="copyVoucherCode('${v.code}')" title="Salin kode">
          <i class="fa-regular fa-copy"></i>
        </button>
      ` : `
        <span class="voucher-used-badge"><i class="fa-solid fa-check"></i></span>
      `}
    </div>
  `).join('');
}

function copyVoucherCode(code) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      alert('Kode voucher disalin: ' + code);
    }).catch(() => {
      prompt('Salin kode ini:', code);
    });
  } else {
    prompt('Salin kode ini:', code);
  }
}

// ===== PANEL ADMIN (generate & kasih kode) =====
function updateAdminPanel() {
  const panel = document.getElementById('adminSpinPanel');
  if (!panel) return;

  const admin = isAdmin(); // hanya username "admin"

  // Sembunyikan total panel + form PIN dari semua akun selain admin
  if (!admin) {
    panel.style.display = 'none';
    setAdminUnlocked(false); // hapus unlock sesi kalau user bukan admin
    return;
  }

  panel.style.display = 'block';

  const lockBox = document.getElementById('adminLockBox');
  const toolsBox = document.getElementById('adminToolsBox');

  // Admin langsung lihat tools (tanpa perlu PIN di UI publik)
  if (lockBox) lockBox.style.display = 'none';
  if (toolsBox) toolsBox.style.display = 'block';

  renderManualCodeList();
  renderAdminCodeList();
}

/** Daftar semua kode (cadangan + admin buat) — ambil manual, salin, kirim ke WA */
function renderManualCodeList() {
  const el = document.getElementById('adminManualCodeList');
  if (!el) return;

  let usedSet = new Set();
  try {
    const usedList = getUsedCodes();
    if (Array.isArray(usedList)) {
      usedSet = new Set(usedList.map(c => c && c.code).filter(Boolean));
    }
  } catch (_) {}

  const pool = getCodePool();
  if (!pool || pool.length === 0) {
    el.innerHTML = '<p class="voucher-empty">Belum ada kode. Buat kode di form atas.</p>';
    return;
  }

  // Hanya tampilkan kode yang BELUM dipakai (yang sudah dipakai = hilang dari daftar)
  const available = pool.filter(item => !usedSet.has(item.code));
  if (available.length === 0) {
    el.innerHTML = '<p class="voucher-empty">Semua kode sudah dipakai. Buat kode baru di form atas.</p>';
    return;
  }

  el.innerHTML = available.map(item => {
    const upper = item.code;
    return `
      <div class="admin-code-item">
        <div class="admin-code-main">
          <strong class="admin-code-text">${upper}</strong>
          <span class="admin-status available">Siap dikasih</span>
        </div>
        <div class="admin-code-actions">
          <button type="button" class="btn-copy-voucher" onclick="copyAdminCode('${upper}')">
            <i class="fa-regular fa-copy"></i> Salin & kasih ke pembeli
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderAdminCodeList() {
  const el = document.getElementById('adminCodeList');
  if (!el) return;
  const list = getGeneratedCodes().slice().reverse();
  if (list.length === 0) {
    el.innerHTML = '<p class="voucher-empty">Belum ada kode di-generate. Boleh pakai daftar manual di atas, atau klik Generate.</p>';
    return;
  }
  el.innerHTML = list.map(c => {
    const statusLabel = c.status === 'used'
      ? `<span class="admin-status used">Dipakai${c.usedBy ? ' @' + c.usedBy : ''}</span>`
      : c.status === 'given'
        ? `<span class="admin-status given">Sudah dikasih${c.forUsername ? ' @' + c.forUsername : ''}</span>`
        : `<span class="admin-status available">Siap dikasih</span>`;
    return `
      <div class="admin-code-item">
        <div class="admin-code-main">
          <strong class="admin-code-text">${c.code}</strong>
          ${statusLabel}
        </div>
        <div class="admin-code-meta">${c.createdAt}${c.forUsername ? ' · untuk @' + c.forUsername : ''}</div>
        <div class="admin-code-actions">
          <button type="button" class="btn-copy-voucher" onclick="copyAdminCode('${c.code}')" title="Salin kode">
            <i class="fa-regular fa-copy"></i> Salin
          </button>
          ${c.status === 'available' ? `
            <button type="button" class="btn-mark-given" onclick="handleMarkGiven('${c.code}')">
              <i class="fa-solid fa-check"></i> Sudah dikasih
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function copyAdminCode(code) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      alert('Kode disalin! Kirim ke pembeli via WA:\n' + code);
    }).catch(() => {
      prompt('Salin kode ini lalu kirim ke pembeli:', code);
    });
  } else {
    prompt('Salin kode ini lalu kirim ke pembeli:', code);
  }
}

function handleAdminUnlock() {
  const input = document.getElementById('adminPinInput');
  const msgEl = document.getElementById('adminPinMsg');
  const pin = input ? input.value : '';
  const res = unlockAdminWithPin(pin);
  if (msgEl) {
    msgEl.style.color = res.ok ? '#25d366' : '#ff4466';
    msgEl.textContent = res.msg;
  }
  if (res.ok) {
    if (input) input.value = '';
    updateAdminPanel();
  }
}

function handleAdminGenerate() {
  try {
    if (!isAdmin()) {
      alert('Hanya akun username admin yang bisa buat kode.');
      return;
    }
    const customInput = document.getElementById('adminCustomCode');
    const forInput = document.getElementById('adminForUsername');
    const customCode = customInput ? customInput.value.trim() : '';
    const forUsername = forInput ? forInput.value.trim() : '';

    // Kalau kosong → acak otomatis
    const res = adminGenerateSpinCode(customCode, forUsername);
    const msgEl = document.getElementById('adminGenerateMsg');
    if (msgEl) {
      msgEl.style.color = res.ok ? '#25d366' : '#ff4466';
      msgEl.textContent = res.msg || '';
    }

    if (res && res.ok) {
      const latest = document.getElementById('adminLatestCode');
      if (latest) {
        latest.innerHTML = '<b>' + res.code + '</b><br><small style="font-weight:600;opacity:.85">Sudah disimpan! Salin & kirim ke WA pembeli</small>';
        latest.style.display = 'block';
      }
      if (customInput) customInput.value = '';
      if (forInput) forInput.value = '';
      try { renderAdminCodeList(); } catch (_) {}
      try { renderManualCodeList(); } catch (_) {}
      alert('Kode berhasil disimpan!\n\n' + res.code + '\n\nSalin & kirim ke pembeli via WA.');
      try { copyAdminCode(res.code); } catch (_) {}
    } else {
      alert((res && res.msg) || 'Gagal simpan kode');
    }
  } catch (e) {
    console.error('handleAdminGenerate', e);
    alert('Gagal simpan kode: ' + (e && e.message ? e.message : 'coba lagi'));
  }
}

function handleMarkGiven(code) {
  const forInput = document.getElementById('adminForUsername');
  const forUsername = forInput ? forInput.value.trim() : '';
  const res = adminMarkCodeGiven(code, forUsername);
  if (res.ok) {
    renderAdminCodeList();
    renderManualCodeList();
  } else {
    alert(res.msg);
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  drawWheel();
  updateSpinUI();

  const btnSpin = document.getElementById('btnSpin');
  if (btnSpin) btnSpin.addEventListener('click', doSpin);

  const btnBeli = document.getElementById('btnBeliSpin');
  if (btnBeli) btnBeli.addEventListener('click', beliSpin);

  const btnRedeem = document.getElementById('btnRedeemCode');
  if (btnRedeem) btnRedeem.addEventListener('click', handleRedeemCode);

  const redeemInput = document.getElementById('redeemCodeInput');
  if (redeemInput) {
    redeemInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRedeemCode();
      }
    });
  }

  const btnGen = document.getElementById('btnAdminGenerate');
  if (btnGen) btnGen.addEventListener('click', handleAdminGenerate);

  const btnUnlock = document.getElementById('btnAdminUnlock');
  if (btnUnlock) btnUnlock.addEventListener('click', handleAdminUnlock);

  const pinInput = document.getElementById('adminPinInput');
  if (pinInput) {
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdminUnlock();
      }
    });
  }

  // Pastikan panel admin selalu di-update
  updateAdminPanel();
});
