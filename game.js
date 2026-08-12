/**
 * game.js — CUFFLI CHALLENGE
 * Level + EXP → Voucher diskon marketplace (max 25% di Level 100)
 * Mini-games: Hitung Cepat, Tebak Kata, Memory Card, Tebak Emoji
 */

const GAME_KEY_PREFIX = 'cuffli_game_';
const DAILY_KEY_PREFIX = 'cuffli_daily_';
const LEADERBOARD_KEY = 'cuffli_leaderboard_global';
const LEADERBOARD_MAX = 50;

// Milestone level → voucher % (hanya di level ini voucher di-grant)
// 25% HANYA bisa didapat di Level 100
const VOUCHER_MILESTONES = {
  10: 5,
  20: 10,
  40: 15,
  70: 20,
  100: 25
};

// ===== LEVEL / EXP / VOUCHER =====
function discountForLevel(level) {
  if (level >= 100) return 25;
  if (level >= 70) return 20;
  if (level >= 40) return 15;
  if (level >= 20) return 10;
  if (level >= 10) return 5;
  return 0;
}

function expNeededForLevel(level) {
  // Naik level jauh lebih susah (target Level 100 sulit)
  return Math.floor(60 + level * 40 + Math.pow(level, 1.6) * 14);
}

function getGameUserKey() {
  const user = getCurrentUser();
  if (!user) return null;
  return GAME_KEY_PREFIX + (user.username || user.email || 'guest');
}

function getGameData() {
  const key = getGameUserKey();
  if (!key) {
    return {
      level: 1,
      exp: 0,
      totalExp: 0,
      challengesPlayed: 0,
      challengesWon: 0,
      streak: 0,
      lastPlayDate: null,
      highestLevel: 1,
      vouchersClaimed: []
    };
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return {
        level: 1,
        exp: 0,
        totalExp: 0,
        challengesPlayed: 0,
        challengesWon: 0,
        streak: 0,
        lastPlayDate: null,
        highestLevel: 1,
        vouchersClaimed: []
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      level: 1,
      exp: 0,
      totalExp: 0,
      challengesPlayed: 0,
      challengesWon: 0,
      streak: 0,
      lastPlayDate: null,
      highestLevel: 1,
      vouchersClaimed: []
    };
  }
}

function saveGameData(data) {
  const key = getGameUserKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(data));
  if (window.CuffliFirebase && window.CuffliFirebase.ready) {
    const user = getCurrentUser();
    if (user && user.uid) {
      window.CuffliFirebase.fbUpdateUserData(user.uid, {
        gameLevel: data.level,
        gameExp: data.exp,
        gameTotalExp: data.totalExp
      });
    }
  }
  // Update ranking setiap progress tersimpan
  publishToLeaderboard(data);
}

// ===== LEADERBOARD GLOBAL =====
function getLocalLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalLeaderboard(list) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list.slice(0, LEADERBOARD_MAX)));
}

/** Seed demo ranking biar leaderboard tidak kosong di demo */
function seedDemoLeaderboardIfEmpty() {
  const list = getLocalLeaderboard();
  if (list.length > 0) return;
  const demo = [
    { username: 'pro_ff', nama: 'Pro FF', level: 18, totalExp: 4200, wins: 45, updated: Date.now() - 86400000 },
    { username: 'ml_king', nama: 'ML King', level: 15, totalExp: 3100, wins: 38, updated: Date.now() - 172800000 },
    { username: 'cuffli_fan', nama: 'Cuffli Fan', level: 12, totalExp: 2400, wins: 30, updated: Date.now() - 259200000 },
    { username: 'rookie99', nama: 'Rookie', level: 8, totalExp: 1100, wins: 15, updated: Date.now() - 345600000 },
    { username: 'gamer_id', nama: 'Gamer ID', level: 6, totalExp: 700, wins: 10, updated: Date.now() - 432000000 }
  ];
  saveLocalLeaderboard(demo);
}

/** Sanitize username for Firestore doc id */
function lbDocId(username) {
  return String(username || 'guest')
    .toLowerCase()
    .replace(/[^a-z0-9_\-\.]/g, '_')
    .slice(0, 80) || 'guest';
}

/** Pastikan Firebase siap (init sekali) */
let _lbFirebaseInitPromise = null;
async function ensureFirebaseForLeaderboard() {
  if (window.CuffliFirebase && window.CuffliFirebase.ready && window.CuffliFirebase.db) {
    return true;
  }
  if (!window.CuffliFirebase || typeof window.CuffliFirebase.initFirebase !== 'function') {
    return false;
  }
  if (!_lbFirebaseInitPromise) {
    _lbFirebaseInitPromise = window.CuffliFirebase.initFirebase().catch((e) => {
      console.warn('[Leaderboard] initFirebase gagal', e);
      return false;
    });
  }
  await _lbFirebaseInitPromise;
  return !!(window.CuffliFirebase && window.CuffliFirebase.ready && window.CuffliFirebase.db);
}

/** Publish skor pemain ke leaderboard (local + Firebase global) */
function publishToLeaderboard(gameData) {
  const user = getCurrentUser();
  if (!user || !gameData) return;

  const entry = {
    username: user.username,
    nama: user.nama || user.username,
    level: gameData.level || 1,
    totalExp: gameData.totalExp || 0,
    wins: gameData.challengesWon || 0,
    discount: discountForLevel(gameData.level || 1),
    avatar: user.avatar || (typeof getUserAvatar === 'function' ? getUserAvatar(user.username) : null) || null,
    uid: user.uid || null,
    updated: Date.now()
  };

  // Local leaderboard (backup di device)
  let list = getLocalLeaderboard().filter(e => e.username !== entry.username);
  list.push(entry);
  list.sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level;
    return (b.totalExp || 0) - (a.totalExp || 0);
  });
  saveLocalLeaderboard(list);

  // Firebase GLOBAL — semua user yang daftar terlihat di semua device
  (async () => {
    try {
      const ok = await ensureFirebaseForLeaderboard();
      if (!ok || !window.CuffliFirebase.db) return;
      const docId = lbDocId(entry.username);
      await window.CuffliFirebase.db.collection('leaderboard').doc(docId).set(entry, { merge: true });
      console.log('[Leaderboard] Published global:', entry.username, 'LV', entry.level);
    } catch (e) {
      console.warn('[Leaderboard] Firebase write gagal', e);
    }
  })();
}

/** Ambil top ranking GLOBAL dari Firestore (fallback local) */
async function fetchLeaderboard(limit = 30) {
  // Coba Firebase global dulu
  try {
    const ok = await ensureFirebaseForLeaderboard();
    if (ok && window.CuffliFirebase.db) {
      let rows = [];

      // Query sederhana (1 field) supaya tidak wajib composite index
      try {
        const snap = await window.CuffliFirebase.db
          .collection('leaderboard')
          .orderBy('level', 'desc')
          .limit(Math.max(limit * 3, 50))
          .get();
        rows = snap.docs.map(d => d.data());
      } catch (e1) {
        // Jika orderBy gagal (rules/index), ambil semua lalu sort di client
        console.warn('[Leaderboard] orderBy gagal, fallback get()', e1);
        const snap2 = await window.CuffliFirebase.db.collection('leaderboard').limit(100).get();
        rows = snap2.docs.map(d => d.data());
      }

      if (rows.length) {
        rows.sort((a, b) => {
          if ((b.level || 0) !== (a.level || 0)) return (b.level || 0) - (a.level || 0);
          return (b.totalExp || 0) - (a.totalExp || 0);
        });
        // Cache ke local agar offline tetap ada data
        saveLocalLeaderboard(rows.slice(0, LEADERBOARD_MAX));
        return rows.slice(0, limit);
      }
    }
  } catch (e) {
    console.warn('[Leaderboard] Firebase read gagal, pakai local', e);
  }

  // Fallback local (hanya device ini)
  seedDemoLeaderboardIfEmpty();
  return getLocalLeaderboard()
    .sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return (b.totalExp || 0) - (a.totalExp || 0);
    })
    .slice(0, limit);
}

function getMyRank(list) {
  const user = getCurrentUser();
  if (!user || !list) return null;
  const idx = list.findIndex(e => e.username === user.username);
  return idx >= 0 ? idx + 1 : null;
}

async function renderLeaderboard() {
  const el = document.getElementById('leaderboardList');
  const myRankEl = document.getElementById('myRankText');
  if (!el) return;

  el.innerHTML = '<p class="voucher-empty">Memuat ranking...</p>';

  const list = await fetchLeaderboard(20);
  const myRank = getMyRank(list);
  const user = getCurrentUser();

  if (myRankEl) {
    if (!user) myRankEl.textContent = 'Login untuk masuk ranking';
    else if (myRank) myRankEl.textContent = `Peringkat kamu: #${myRank}`;
    else myRankEl.textContent = 'Belum ada di ranking — main challenge dulu!';
  }

  if (!list.length) {
    el.innerHTML = '<p class="voucher-empty">Belum ada data ranking</p>';
    return;
  }

  el.innerHTML = list.map((e, i) => {
    const rank = i + 1;
    const isMe = user && e.username === user.username;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    // Ambil avatar terbaru dari akun (supaya orang lain bisa lihat)
    const av = e.avatar
      || (typeof getUserAvatar === 'function' ? getUserAvatar(e.username) : null)
      || null;
    const avatarHtml = av
      ? `<img class="lb-avatar" src="${av}" alt="">`
      : `<div class="lb-avatar placeholder"><i class="fa-solid fa-user"></i></div>`;
    return `
      <div class="lb-row ${isMe ? 'me' : ''} ${rank <= 3 ? 'top' : ''}">
        <div class="lb-rank">${medal}</div>
        ${avatarHtml}
        <div class="lb-info">
          <div class="lb-name">${escapeLb(e.nama || e.username)}${isMe ? ' <span class="lb-you">(kamu)</span>' : ''}</div>
          <div class="lb-sub">@${escapeLb(e.username)} · ${e.wins || 0} menang</div>
        </div>
        <div class="lb-stats">
          <div class="lb-level">LV ${e.level}</div>
          <div class="lb-exp">${formatNum(e.totalExp || 0)} EXP</div>
        </div>
      </div>
    `;
  }).join('');
}

function escapeLb(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

function formatNum(n) {
  return Number(n || 0).toLocaleString('id-ID');
}

function getDailyData() {
  const user = getCurrentUser();
  if (!user) return null;
  const key = DAILY_KEY_PREFIX + (user.username || 'guest');
  const today = new Date().toDateString();
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    if (!raw || raw.date !== today) {
      return {
        date: today,
        login: false,
        play1: false,
        win3: false,
        play5: false,
        winsToday: 0,
        playsToday: 0,
        claimed: { login: false, play1: false, win3: false, play5: false }
      };
    }
    return raw;
  } catch {
    return {
      date: today,
      login: false,
      play1: false,
      win3: false,
      play5: false,
      winsToday: 0,
      playsToday: 0,
      claimed: { login: false, play1: false, win3: false, play5: false }
    };
  }
}

function saveDailyData(data) {
  const user = getCurrentUser();
  if (!user) return;
  const key = DAILY_KEY_PREFIX + (user.username || 'guest');
  localStorage.setItem(key, JSON.stringify(data));
}

/** Tambah EXP, handle level up + voucher */
function addExp(amount, reason) {
  const user = getCurrentUser();
  if (!user) return { ok: false, msg: 'Login dulu' };

  const data = getGameData();
  data.exp += amount;
  data.totalExp += amount;

  const leveled = [];
  while (data.exp >= expNeededForLevel(data.level)) {
    data.exp -= expNeededForLevel(data.level);
    data.level += 1;
    if (data.level > data.highestLevel) data.highestLevel = data.level;
    leveled.push(data.level);

    // Voucher hanya di milestone level (10/20/40/70/100)
    // 25% HANYA di Level 100
    if (VOUCHER_MILESTONES[data.level] && !data.vouchersClaimed.includes(data.level)) {
      data.vouchersClaimed.push(data.level);
      grantChallengeVoucher(VOUCHER_MILESTONES[data.level], data.level);
    }
  }

  saveGameData(data);

  if (typeof addNotification === 'function') {
    let msg = `+${amount} EXP` + (reason ? ` (${reason})` : '');
    if (leveled.length) msg += ` · Level up ke ${data.level}!`;
    addNotification(msg, leveled.length ? 'success' : 'info');
  }

  return {
    ok: true,
    amount,
    level: data.level,
    exp: data.exp,
    needed: expNeededForLevel(data.level),
    leveled,
    discount: discountForLevel(data.level)
  };
}

function grantChallengeVoucher(percent, level) {
  // Mabar: voucher dibagi 2
  let givePercent = percent;
  if (window.CuffliMabar && window.CuffliMabar.isCoopActive()) {
    const half = Math.max(1, Math.floor(percent / 2));
    window.CuffliMabar.shareVoucherWithPartner(percent, level);
    givePercent = half;
    if (typeof addNotification === 'function') {
      const partner = window.CuffliMabar.getCoopPartner();
      addNotification('Mabar: voucher ' + percent + '% dibagi 2 → kamu ' + half + '%' + (partner ? ' & @' + partner + ' ' + half + '%' : ''), 'success');
    }
  }
  // Pakai sistem voucher yang sama dengan spin (supaya bisa dipakai di pembayaran)
  if (typeof addVoucher === 'function') {
    const v = addVoucher(givePercent);
    // Override code biar beda dari spin
    const data = getSpinData();
    if (data.vouchers && data.vouchers.length) {
      const last = data.vouchers[data.vouchers.length - 1];
      last.code = 'CHALLENGE' + percent + '-L' + level + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
      last.from = 'challenge';
      last.level = level;
      saveSpinData(data);
    }
    if (typeof addNotification === 'function') {
      addNotification(`🎉 Level ${level}! Voucher diskon ${typeof givePercent !== 'undefined' ? givePercent : percent}% didapat!`, 'success');
    }
    return v;
  }
  // Fallback kalau spin.js belum load
  const user = getCurrentUser();
  if (!user) return null;
  const key = 'cuffli_spin_' + (user.username || 'guest');
  let data;
  try {
    data = JSON.parse(localStorage.getItem(key) || '{"spinSisa":0,"vouchers":[],"paid":false}');
  } catch {
    data = { spinSisa: 0, vouchers: [], paid: false };
  }
  const v = {
    id: Date.now() + Math.random(),
    percent,
    code: 'CHALLENGE' + percent + '-L' + level + '-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
    created: new Date().toLocaleString('id-ID'),
    used: false,
    from: 'challenge',
    level
  };
  data.vouchers.push(v);
  localStorage.setItem(key, JSON.stringify(data));
  return v;
}

// ===== DAILY MISSIONS =====
function trackDaily(event) {
  // event: 'login' | 'play' | 'win'
  const daily = getDailyData();
  if (!daily) return;

  if (event === 'login') {
    daily.login = true;
  }
  if (event === 'play') {
    daily.playsToday = (daily.playsToday || 0) + 1;
    if (daily.playsToday >= 1) daily.play1 = true;
    if (daily.playsToday >= 5) daily.play5 = true;
  }
  if (event === 'win') {
    daily.winsToday = (daily.winsToday || 0) + 1;
    if (daily.winsToday >= 3) daily.win3 = true;
  }
  saveDailyData(daily);
  updateDailyUI();
}

function claimDailyMission(id) {
  const daily = getDailyData();
  if (!daily) return { ok: false, msg: 'Login dulu' };
  if (!daily[id]) return { ok: false, msg: 'Misi belum selesai' };
  if (daily.claimed[id]) return { ok: false, msg: 'Sudah diklaim' };

  const rewards = { login: 15, play1: 20, win3: 40, play5: 50 };
  const exp = rewards[id] || 10;
  daily.claimed[id] = true;
  saveDailyData(daily);
  const res = addExp(exp, 'Misi harian');
  updateDailyUI();
  updateGameHUD();
  return { ok: true, exp, msg: `+${exp} EXP dari misi harian!` };
}

function updateStreak() {
  const data = getGameData();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (data.lastPlayDate === today) return;
  if (data.lastPlayDate === yesterday) {
    data.streak = (data.streak || 0) + 1;
  } else {
    data.streak = 1;
  }
  data.lastPlayDate = today;
  saveGameData(data);
}

// ===== MINI GAMES DATA =====
const WORDS = [
  { word: 'FREEFIRE', hint: 'Battle royale populer di HP' },
  { word: 'MOBILELEGENDS', hint: 'MOBA 5v5 di HP' },
  { word: 'PUBG', hint: 'PlayerUnknown battle royale' },
  { word: 'GENSHIN', hint: 'Open world anime adventure' },
  { word: 'VALORANT', hint: 'FPS tactical Riot' },
  { word: 'MINECRAFT', hint: 'Game blok kotak' },
  { word: 'ROBLOX', hint: 'Platform game buatan user' },
  { word: 'CUFFLI', hint: 'Nama toko akun ini' },
  { word: 'VOUCHER', hint: 'Kode diskon belanja' },
  { word: 'RANK', hint: 'Tingkatan skill di game' },
  { word: 'SKIN', hint: 'Tampilan karakter di game' },
  { word: 'TURBO', hint: 'Mode cepat Free Fire' },
  { word: 'SQUAD', hint: 'Tim 4 orang' },
  { word: 'HEADSHOT', hint: 'Tembakan ke kepala' },
  { word: 'BOOSTER', hint: 'Barang yang nambah power' }
];

const EMOJI_QUIZ = [
  { emoji: '🔥🔥', answer: 'FREE FIRE', options: ['FREE FIRE', 'PUBG', 'COD', 'FORTNITE'] },
  { emoji: '⚔️🛡️', answer: 'MOBILE LEGENDS', options: ['MOBILE LEGENDS', 'AOV', 'LOL', 'DOTA'] },
  { emoji: '🪂🔫', answer: 'PUBG', options: ['PUBG', 'FREE FIRE', 'COD', 'APEX'] },
  { emoji: '🎮👤', answer: 'AKUN GAME', options: ['AKUN GAME', 'CONSOLE', 'PC', 'SERVER'] },
  { emoji: '💰🎫', answer: 'VOUCHER', options: ['VOUCHER', 'COIN', 'GEM', 'GOLD'] },
  { emoji: '🏆📈', answer: 'RANK', options: ['RANK', 'LEVEL', 'SCORE', 'WIN'] },
  { emoji: '🎯💥', answer: 'HEADSHOT', options: ['HEADSHOT', 'KILL', 'BOOM', 'AIM'] },
  { emoji: '👥4️⃣', answer: 'SQUAD', options: ['SQUAD', 'DUO', 'SOLO', 'PARTY'] }
];

// ===== GAME STATE =====
let currentChallenge = null;
let challengeActive = false;

// ===== HITUNG CEPAT =====
function startHitungCepat() {
  if (!requireLogin()) return;
  const a = 5 + Math.floor(Math.random() * 20);
  const b = 3 + Math.floor(Math.random() * 15);
  const ops = ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let answer;
  if (op === '+') answer = a + b;
  else if (op === '-') answer = a - b;
  else answer = a * b;

  currentChallenge = {
    type: 'hitung',
    question: `${a} ${op} ${b} = ?`,
    answer,
    expWin: 15,
    expLose: 1
  };
  showChallengeUI('Hitung Cepat', `
    <div class="challenge-q">${currentChallenge.question}</div>
    <input type="number" id="challengeAnswer" class="challenge-input" placeholder="Jawaban" inputmode="numeric">
    <button class="btn-primary" onclick="submitHitung()">Kirim Jawaban</button>
    <p class="challenge-hint">Benar = +15 EXP · Salah = +1 EXP</p>
  `);
  setTimeout(() => {
    const el = document.getElementById('challengeAnswer');
    if (el) el.focus();
  }, 100);
}

function submitHitung() {
  if (!currentChallenge || currentChallenge.type !== 'hitung') return;
  const val = parseInt(document.getElementById('challengeAnswer').value, 10);
  const win = val === currentChallenge.answer;
  finishChallenge(win, currentChallenge.expWin, currentChallenge.expLose, win
    ? `Benar! ${currentChallenge.question.replace('?', currentChallenge.answer)}`
    : `Salah. Jawaban: ${currentChallenge.answer}`);
}

// ===== TEBAK KATA =====
function startTebakKata() {
  if (!requireLogin()) return;
  const item = WORDS[Math.floor(Math.random() * WORDS.length)];
  const scrambled = item.word.split('').sort(() => Math.random() - 0.5).join('');
  // Pastikan tidak sama dengan asli
  let scramble = scrambled;
  if (scramble === item.word) scramble = item.word.split('').reverse().join('');

  currentChallenge = {
    type: 'kata',
    answer: item.word,
    hint: item.hint,
    expWin: 20,
    expLose: 1
  };
  showChallengeUI('Tebak Kata', `
    <div class="challenge-q scramble">${scramble}</div>
    <p class="challenge-hint">Hint: ${item.hint}</p>
    <input type="text" id="challengeAnswer" class="challenge-input" placeholder="Susun katanya..." autocomplete="off" spellcheck="false">
    <button class="btn-primary" onclick="submitKata()">Kirim Jawaban</button>
    <p class="challenge-hint">Benar = +20 EXP · Salah = +1 EXP</p>
  `);
  setTimeout(() => {
    const el = document.getElementById('challengeAnswer');
    if (el) el.focus();
  }, 100);
}

function submitKata() {
  if (!currentChallenge || currentChallenge.type !== 'kata') return;
  const val = (document.getElementById('challengeAnswer').value || '').trim().toUpperCase().replace(/\s/g, '');
  const win = val === currentChallenge.answer;
  finishChallenge(win, currentChallenge.expWin, currentChallenge.expLose, win
    ? `Benar! Jawabannya: ${currentChallenge.answer}`
    : `Salah. Jawaban: ${currentChallenge.answer}`);
}

// ===== TEBAK EMOJI =====
function startTebakEmoji() {
  if (!requireLogin()) return;
  const item = EMOJI_QUIZ[Math.floor(Math.random() * EMOJI_QUIZ.length)];
  const opts = [...item.options].sort(() => Math.random() - 0.5);
  currentChallenge = {
    type: 'emoji',
    answer: item.answer,
    expWin: 28,
    expLose: 1
  };
  showChallengeUI('Tebak Emoji', `
    <div class="challenge-emoji">${item.emoji}</div>
    <p class="challenge-hint">Gambar ini maksudnya apa?</p>
    <div class="challenge-options">
      ${opts.map(o => `<button class="btn-option" onclick="submitEmoji('${o.replace(/'/g, "\\'")}')">${o}</button>`).join('')}
    </div>
    <p class="challenge-hint">Benar = +28 EXP · Salah = +1 EXP</p>
  `);
}

function submitEmoji(choice) {
  if (!currentChallenge || currentChallenge.type !== 'emoji') return;
  const win = choice === currentChallenge.answer;
  finishChallenge(win, currentChallenge.expWin, currentChallenge.expLose, win
    ? `Benar! ${currentChallenge.answer}`
    : `Salah. Jawaban: ${currentChallenge.answer}`);
}

// ===== MEMORY CARD =====
function startMemory() {
  if (!requireLogin()) return;
  const symbols = ['🔥', '⚔️', '🎮', '🏆', '💎', '🎯'];
  const cards = [...symbols, ...symbols].sort(() => Math.random() - 0.5);
  currentChallenge = {
    type: 'memory',
    cards,
    flipped: [],
    matched: [],
    moves: 0,
    expWin: 33,
    expLose: 1,
    lock: false
  };
  renderMemoryBoard();
}

function renderMemoryBoard() {
  const c = currentChallenge;
  if (!c || c.type !== 'memory') return;
  const board = c.cards.map((sym, i) => {
    const isFlipped = c.flipped.includes(i) || c.matched.includes(i);
    return `<button class="mem-card ${isFlipped ? 'flipped' : ''} ${c.matched.includes(i) ? 'matched' : ''}"
      onclick="flipMemory(${i})" ${c.matched.includes(i) ? 'disabled' : ''}>
      <span class="mem-front">?</span>
      <span class="mem-back">${sym}</span>
    </button>`;
  }).join('');

  showChallengeUI('Memory Card', `
    <p class="challenge-hint">Cocokkan pasangan kartu · Moves: <b id="memMoves">${c.moves}</b></p>
    <div class="mem-board">${board}</div>
    <p class="challenge-hint">Selesai = +33 EXP · Salah/Menyerah = +1 EXP</p>
    <button class="btn-secondary" onclick="finishChallenge(false, 33, 1, 'Menyerah dari Memory')">Menyerah</button>
  `);
}

function flipMemory(i) {
  const c = currentChallenge;
  if (!c || c.type !== 'memory' || c.lock) return;
  if (c.flipped.includes(i) || c.matched.includes(i)) return;
  if (c.flipped.length >= 2) return;

  c.flipped.push(i);
  renderMemoryBoard();

  if (c.flipped.length === 2) {
    c.moves++;
    c.lock = true;
    const [a, b] = c.flipped;
    if (c.cards[a] === c.cards[b]) {
      c.matched.push(a, b);
      c.flipped = [];
      c.lock = false;
      if (c.matched.length === c.cards.length) {
        finishChallenge(true, c.expWin, c.expLose, `Selesai dalam ${c.moves} moves!`);
        return;
      }
      renderMemoryBoard();
    } else {
      setTimeout(() => {
        c.flipped = [];
        c.lock = false;
        renderMemoryBoard();
      }, 700);
    }
  }
}

// ===== TEBAK PLANET =====
const PLANET_QUIZ = [
  { img: 'mars.jpg', name: 'MARS', hint: 'Planet merah, tetangga Bumi', options: ['MARS', 'VENUS', 'MERKURIUS', 'JUPITER'] },
  { img: 'jupiter.jpg', name: 'JUPITER', hint: 'Planet terbesar di tata surya', options: ['JUPITER', 'SATURNUS', 'NEPTUNUS', 'MARS'] },
  { img: 'saturnus.jpg', name: 'SATURNUS', hint: 'Punya cincin indah', options: ['SATURNUS', 'URANUS', 'JUPITER', 'NEPTUNUS'] },
  { img: 'neptunus.jpg', name: 'NEPTUNUS', hint: 'Planet biru paling jauh (resmi)', options: ['NEPTUNUS', 'URANUS', 'BUMI', 'MARS'] },
  { img: 'bumi.jpg', name: 'BUMI', hint: 'Planet kita, ada kehidupan', options: ['BUMI', 'MARS', 'VENUS', 'MERKURIUS'] },
  { img: 'venus.jpg', name: 'VENUS', hint: 'Planet terpanas, sering disebut bintang fajar', options: ['VENUS', 'MARS', 'MERKURIUS', 'BUMI'] },
  { img: 'merkurius.jpg', name: 'MERKURIUS', hint: 'Planet terdekat dengan Matahari', options: ['MERKURIUS', 'VENUS', 'MARS', 'PLUTO'] },
  { img: 'uranus.jpg', name: 'URANUS', hint: 'Planet es yang miring sumbunya', options: ['URANUS', 'NEPTUNUS', 'SATURNUS', 'JUPITER'] },
  { img: 'pluto.jpg', name: 'PLUTO', hint: 'Dulu planet ke-9, sekarang planet kerdil', options: ['PLUTO', 'NEPTUNUS', 'MARS', 'BULAN'] },
  { img: 'matahari.jpg', name: 'MATAHARI', hint: 'Bintang pusat tata surya (bukan planet)', options: ['MATAHARI', 'BULAN', 'MARS', 'JUPITER'] }
];

function startTebakPlanet() {
  if (!requireLogin()) return;
  const item = PLANET_QUIZ[Math.floor(Math.random() * PLANET_QUIZ.length)];
  const options = item.options.slice().sort(() => Math.random() - 0.5);
  currentChallenge = {
    type: 'planet',
    answer: item.name,
    img: item.img,
    hint: item.hint,
    options,
    expWin: 22,
    expLose: 1
  };
  const btns = options.map((o) =>
    `<button type="button" class="btn-emoji-opt" onclick="submitPlanet('${o}')">${o}</button>`
  ).join('');
  showChallengeUI('Tebak Planet', `
    <div class="planet-photo-wrap">
      <img class="planet-photo" src="${item.img}" alt="Planet" onerror="this.style.display='none'">
    </div>
    <p class="challenge-hint">${item.hint}</p>
    <div class="emoji-options">${btns}</div>
  `);
}

function submitPlanet(choice) {
  if (!currentChallenge || currentChallenge.type !== 'planet') return;
  const win = (choice || '').toUpperCase() === currentChallenge.answer;
  finishChallenge(win, currentChallenge.expWin, currentChallenge.expLose, win
    ? `Benar! Itu ${currentChallenge.answer}`
    : `Salah. Jawaban: ${currentChallenge.answer}`);
}

// ===== PUZZLE — susun potongan jadi gambar game =====
const PUZZLE_IMAGES = [
  'puzzle ff.jpg',
  'puzzle ml.jpg',
  'puzzle roblox.jpg',
  'puzzle hok.jpg',
  'puzzle pubg.jpg'
];

function startPuzzle() {
  if (!requireLogin()) return;
  const size = 3; // 3x3
  const img = PUZZLE_IMAGES[Math.floor(Math.random() * PUZZLE_IMAGES.length)];
  // tiles: 0..8, last is blank in sliding puzzle style — OR tile-swap puzzle
  // Gunakan model: klik 2 ubin untuk tukar posisi (lebih mudah di HP)
  const order = [];
  for (let i = 0; i < size * size; i++) order.push(i);
  // acak sampai tidak solved
  do {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  } while (order.every((v, i) => v === i));

  currentChallenge = {
    type: 'puzzle',
    size,
    img,
    order, // order[slot] = piece index
    selected: null,
    moves: 0,
    expWin: 35,
    expLose: 1
  };
  renderPuzzleBoard();
}

function renderPuzzleBoard() {
  const c = currentChallenge;
  if (!c || c.type !== 'puzzle') return;
  const size = c.size;
  const pct = 100 / (size - 1);
  let tiles = '';
  for (let slot = 0; slot < size * size; slot++) {
    const piece = c.order[slot];
    const row = Math.floor(piece / size);
    const col = piece % size;
    const sel = c.selected === slot ? ' selected' : '';
    tiles += `
      <button type="button" class="puzzle-tile${sel}" data-slot="${slot}"
        style="background-image:url('${c.img}');background-size:${size * 100}% ${size * 100}%;background-position:${col * pct}% ${row * pct}%"
        onclick="onPuzzleTile(${slot})"></button>`;
  }
  showChallengeUI('Puzzle Game', `
    <p class="challenge-hint">Susun potongan jadi gambar utuh. Klik 2 kotak untuk tukar posisi.</p>
    <div class="puzzle-grid" style="grid-template-columns:repeat(${size},1fr)">${tiles}</div>
    <p class="challenge-hint">Langkah: <strong>${c.moves}</strong> · Benar = +35 EXP · Menyerah = +1 EXP</p>
    <button class="btn-secondary" onclick="finishChallenge(false, 35, 1, 'Menyerah dari Puzzle')">Menyerah</button>
  `);
}

function onPuzzleTile(slot) {
  const c = currentChallenge;
  if (!c || c.type !== 'puzzle') return;
  if (c.selected === null) {
    c.selected = slot;
    renderPuzzleBoard();
    return;
  }
  if (c.selected === slot) {
    c.selected = null;
    renderPuzzleBoard();
    return;
  }
  // tukar
  const a = c.selected;
  const tmp = c.order[a];
  c.order[a] = c.order[slot];
  c.order[slot] = tmp;
  c.selected = null;
  c.moves += 1;
  if (c.order.every((v, i) => v === i)) {
    finishChallenge(true, c.expWin, c.expLose,
      `Puzzle selesai dalam ${c.moves} langkah!`);
    return;
  }
  renderPuzzleBoard();
}

// ===== SHARED CHALLENGE FLOW =====
function requireLogin() {
  if (!getCurrentUser()) {
    alert('Login dulu untuk main challenge!');
    location.href = 'login.html';
    return false;
  }
  return true;
}

function showChallengeUI(title, html) {
  challengeActive = true;
  const box = document.getElementById('challengeArea');
  if (!box) return;
  box.style.display = 'block';
  box.innerHTML = `
    <div class="challenge-box">
      <div class="challenge-title"><i class="fa-solid fa-gamepad"></i> ${title}</div>
      ${html}
      <button class="btn-close-challenge" onclick="closeChallenge()">Tutup</button>
    </div>
  `;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeChallenge() {
  challengeActive = false;
  currentChallenge = null;
  const box = document.getElementById('challengeArea');
  if (box) {
    box.style.display = 'none';
    box.innerHTML = '';
  }
}

function finishChallenge(win, expWin, expLose, message) {
  updateStreak();
  trackDaily('play');
  if (win) trackDaily('win');

  const data = getGameData();
  data.challengesPlayed = (data.challengesPlayed || 0) + 1;
  if (win) data.challengesWon = (data.challengesWon || 0) + 1;
  saveGameData(data);

  let exp = win ? expWin : expLose;
  // Mabar: EXP digabung — partner dapat bagian, host tetap full
  if (window.CuffliMabar && window.CuffliMabar.isCoopActive()) {
    window.CuffliMabar.shareExpWithPartner(exp);
    const partner = window.CuffliMabar.getCoopPartner();
    if (partner && typeof addNotification === 'function') {
      addNotification('Mabar: +' + Math.floor(exp / 2) + ' EXP juga dikirim ke @' + partner, 'info');
    }
  }
  const res = addExp(exp, win ? 'Menang challenge' : 'Coba challenge');

  const box = document.getElementById('challengeArea');
  if (box) {
    box.innerHTML = `
      <div class="challenge-box result ${win ? 'win' : 'lose'}">
        <div class="challenge-result-icon">${win ? '🎉' : '😅'}</div>
        <div class="challenge-result-text">${message}</div>
        <div class="challenge-exp">+${exp} EXP</div>
        ${res.leveled && res.leveled.length ? `<div class="level-up-banner">LEVEL UP → ${res.level} · Voucher ${res.discount}%</div>` : ''}
        <button class="btn-primary" onclick="closeChallenge()">Kembali</button>
      </div>
    `;
  }
  updateGameHUD();
  updateDailyUI();
  renderLeaderboard();
  currentChallenge = null;
  challengeActive = false;
}

// ===== UI =====
function updateGameHUD() {
  const user = getCurrentUser();
  const nameEl = document.getElementById('gameUserName');
  const levelEl = document.getElementById('gameLevel');
  const expEl = document.getElementById('gameExp');
  const expBar = document.getElementById('gameExpBar');
  const discEl = document.getElementById('gameDiscount');
  const streakEl = document.getElementById('gameStreak');
  const statsEl = document.getElementById('gameStats');

  if (!user) {
    if (nameEl) nameEl.textContent = 'Belum login';
    if (levelEl) levelEl.textContent = '1';
    if (expEl) expEl.textContent = '0 / —';
    if (expBar) expBar.style.width = '0%';
    if (discEl) discEl.textContent = '0%';
    if (streakEl) streakEl.textContent = '0';
    return;
  }

  const data = getGameData();
  const needed = expNeededForLevel(data.level);
  const pct = Math.min(100, Math.round((data.exp / needed) * 100));
  const disc = discountForLevel(data.level);

  if (nameEl) nameEl.textContent = data.nama || user.nama || user.username;
  if (levelEl) levelEl.textContent = data.level;
  if (expEl) expEl.textContent = `${data.exp} / ${needed}`;
  if (expBar) expBar.style.width = pct + '%';
  if (discEl) discEl.textContent = disc + '%';
  if (streakEl) streakEl.textContent = data.streak || 0;
  if (statsEl) {
    statsEl.innerHTML = `
      <span>Main: <b>${data.challengesPlayed || 0}</b></span>
      <span>Menang: <b>${data.challengesWon || 0}</b></span>
      <span>Total EXP: <b>${data.totalExp || 0}</b></span>
    `;
  }

  // Reward table highlight
  document.querySelectorAll('.reward-row').forEach(row => {
    const lv = parseInt(row.dataset.level, 10);
    row.classList.toggle('current', lv === data.level);
    row.classList.toggle('reached', lv <= data.level);
  });
}

function updateDailyUI() {
  const daily = getDailyData();
  if (!daily) return;

  const missions = [
    { id: 'login', label: 'Login hari ini', exp: 15, done: daily.login },
    { id: 'play1', label: 'Main 1 challenge', exp: 20, done: daily.play1 },
    { id: 'win3', label: 'Menang 3 challenge', exp: 40, done: daily.win3 },
    { id: 'play5', label: 'Main 5 challenge', exp: 50, done: daily.play5 }
  ];

  const el = document.getElementById('dailyMissions');
  if (!el) return;
  el.innerHTML = missions.map(m => {
    const claimed = daily.claimed[m.id];
    let btn = '';
    if (claimed) btn = `<span class="mission-done"><i class="fa-solid fa-check"></i> Klaim</span>`;
    else if (m.done) btn = `<button class="btn-claim" onclick="claimDaily('${m.id}')">Klaim +${m.exp}</button>`;
    else btn = `<span class="mission-locked">+${m.exp} EXP</span>`;
    return `
      <div class="mission-item ${m.done ? 'done' : ''} ${claimed ? 'claimed' : ''}">
        <div class="mission-label">${m.label}</div>
        ${btn}
      </div>
    `;
  }).join('');
}

function claimDaily(id) {
  const res = claimDailyMission(id);
  if (res.ok) alert(res.msg);
  else alert(res.msg);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  if (document.body.dataset.page !== 'game') return;

  // Init Firebase dulu supaya leaderboard GLOBAL
  try {
    if (window.CuffliFirebase && typeof window.CuffliFirebase.initFirebase === 'function') {
      await window.CuffliFirebase.initFirebase();
    }
  } catch (e) {
    console.warn('[Game] Firebase init:', e);
  }

  const user = getCurrentUser();
  if (user) {
    trackDaily('login');
    // Publish skor terkini ke leaderboard GLOBAL
    publishToLeaderboard(getGameData());
  }

  updateGameHUD();
  updateDailyUI();
  await renderLeaderboard();
});
