/**
 * komunikasi.js — Feed Komunitas / Komunikasi CUFFLI ALL GAME
 * Edit KOMUNITAS_POSTS di bawah untuk menambah / ubah post.
 * Dipisah dari script.js biar gampang dikelola.
 */
// ===== KOMUNITAS / KOMUNIKASI (feed seperti komunitas) =====
const KOMUNITAS_STATS_KEY = 'cuffli_komunitas_stats';
const KOMUNITAS_COMMENTS_KEY = 'cuffli_komunitas_comments';
const KOMUNITAS_POSTS = [
  {
    id: 'post-gacha-1',
    author: 'Asisten Cuffli',
    authorLogo: 'logo.png',
    pinned: true,
    timeLabel: '3 bln',
    title: 'APAKAH ADA YANG MAU DI TANYAKAN TENTANG EVENT GACHA CUFFLI ALL GAME?',
    body: 'Coba kalian komentar di bawah. Admin siap jawab pertanyaan seputar event gacha, spin voucher, stok akun, dan challenge game.',
    image: 'tanya-diskusi-cuffli.jpg',
    linkPath: 'komunitas.html'
  },
  {
    id: 'post-spin-1',
    author: 'Asisten Cuffli',
    authorLogo: 'logo.png',
    pinned: true,
    timeLabel: '1 bln',
    title: 'SPIN VOUCHER CUFFLI — PUTAR RODA DAPAT DISKON',
    body: 'Yuk putar roda spin! Bisa dapet voucher 10% sampai 30%. Tiket Rp 15.000 = 3× spin. Kode redeem 1× pakai saja.',
    image: 'banner spin1.jpg',
    linkPath: 'spin.html'
  },
  {
    id: 'post-game-1',
    author: 'Admin Cuffli',
    authorLogo: 'logo.png',
    pinned: false,
    timeLabel: '2 bln',
    title: 'CUFFLI CHALLENGE — MAIN GAME DAPAT VOUCHER',
    body: 'Main mini-game gratis, kumpulin EXP, naik level. Voucher max 25% di Level 100. Salah jawab cuma +1 EXP!',
    image: 'banner game1.jpg',
    linkPath: 'game.html'
  }
];

function getKomunitasStatsAll() {
  try {
    const raw = localStorage.getItem(KOMUNITAS_STATS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

function saveKomunitasStatsAll(all) {
  localStorage.setItem(KOMUNITAS_STATS_KEY, JSON.stringify(all));
}

function getKomunitasStats(postId) {
  const all = getKomunitasStatsAll();
  const s = all[postId];
  if (!s) return { views: 0, likes: 0, likedBy: [] };
  return {
    views: Number(s.views) || 0,
    likes: Number(s.likes) || 0,
    likedBy: Array.isArray(s.likedBy) ? s.likedBy : []
  };
}

function setKomunitasStats(postId, stats) {
  const all = getKomunitasStatsAll();
  all[postId] = {
    views: Math.max(0, Number(stats.views) || 0),
    likes: Math.max(0, Number(stats.likes) || 0),
    likedBy: Array.isArray(stats.likedBy) ? stats.likedBy : []
  };
  saveKomunitasStatsAll(all);
}

/** Komentar per post */
function getKomunitasCommentsAll() {
  try {
    const raw = localStorage.getItem(KOMUNITAS_COMMENTS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

function saveKomunitasCommentsAll(all) {
  localStorage.setItem(KOMUNITAS_COMMENTS_KEY, JSON.stringify(all));
}

function getPostComments(postId) {
  const all = getKomunitasCommentsAll();
  const list = all[postId];
  return Array.isArray(list) ? list : [];
}

function addPostComment(postId, text) {
  const t = (text || '').trim();
  if (!t) return getPostComments(postId);
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const name = user ? (user.username || user.email || 'User') : 'Pengunjung';
  const all = getKomunitasCommentsAll();
  if (!Array.isArray(all[postId])) all[postId] = [];
  all[postId].push({
    id: 'c' + Date.now(),
    name: name,
    text: t.slice(0, 300),
    time: new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  });
  saveKomunitasCommentsAll(all);
  return all[postId];
}

function getKomunitasUserKey() {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (user) return user.username || user.email || 'guest';
  let id = localStorage.getItem('cuffli_anon_id');
  if (!id) {
    id = 'a' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('cuffli_anon_id', id);
  }
  return 'anon_' + id;
}

function recordKomunitasView(postId) {
  const sk = 'cuffli_kview_' + postId;
  if (sessionStorage.getItem(sk)) return getKomunitasStats(postId);
  const s = getKomunitasStats(postId);
  s.views += 1;
  setKomunitasStats(postId, s);
  sessionStorage.setItem(sk, '1');
  return s;
}

function toggleKomunitasLike(postId) {
  const key = getKomunitasUserKey();
  const s = getKomunitasStats(postId);
  const liked = s.likedBy.includes(key);
  if (liked) {
    s.likedBy = s.likedBy.filter((u) => u !== key);
    s.likes = Math.max(0, s.likes - 1);
  } else {
    s.likedBy.push(key);
    s.likes += 1;
  }
  setKomunitasStats(postId, s);
  return { liked: !liked, likes: s.likes, views: s.views };
}

function getPostShareUrl(post) {
  try {
    const base = location.href.replace(/[^/]*$/, '');
    return base + (post.linkPath || 'komunitas.html') + '?from=share&post=' + encodeURIComponent(post.id);
  } catch {
    return (post.linkPath || 'komunitas.html');
  }
}

function shareKomunitasPost(postId) {
  const post = KOMUNITAS_POSTS.find((p) => p.id === postId);
  if (!post) return;
  const url = getPostShareUrl(post);
  const text = post.title + '\n' + (post.body || '') + '\n' + url;

  if (navigator.share) {
    navigator.share({ title: post.title, text: post.body, url }).catch(() => {
      copyShareLink(url, text);
    });
  } else {
    copyShareLink(url, text);
  }
}

function copyShareLink(url, text) {
  const payload = text || url;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(payload).then(() => {
      alert('Link berhasil disalin!\n' + url);
    }).catch(() => {
      prompt('Salin link ini:', url);
    });
  } else {
    prompt('Salin link ini:', url);
  }
}

function renderKomunitasFeed() {
  const feed = document.getElementById('komunitasFeed');
  if (!feed) return;

  const userKey = getKomunitasUserKey();
  feed.innerHTML = '';

  KOMUNITAS_POSTS.forEach((post) => {
    const st = recordKomunitasView(post.id);
    const liked = st.likedBy.includes(userKey);
    const comments = getPostComments(post.id);
    const logo = post.authorLogo || 'banner 1.jpg';

    const commentsHtml = comments.length
      ? comments.map((c) => `
          <div class="komentar-item">
            <div class="komentar-name">${c.name}</div>
            <div class="komentar-text">${c.text}</div>
            <div class="komentar-time">${c.time || ''}</div>
          </div>
        `).join('')
      : '<div class="komentar-empty">Belum ada komentar. Jadi yang pertama!</div>';

    const card = document.createElement('article');
    card.className = 'komunitas-card';
    card.dataset.postId = post.id;
    card.innerHTML = `
      <div class="komunitas-card-head">
        <img class="komunitas-avatar-img" src="${logo}" alt="Logo" onerror="this.style.display='none'">
        <div class="komunitas-meta">
          <div class="komunitas-author">
            ${post.author || 'Admin Cuffli'}
            ${post.pinned ? '<span class="komunitas-pin"><i class="fa-solid fa-thumbtack"></i> Disematkan</span>' : ''}
          </div>
          <div class="komunitas-time">${post.timeLabel || ''}</div>
        </div>
      </div>
      <h3 class="komunitas-title">${post.title}</h3>
      <p class="komunitas-body">${post.body || ''}</p>
      ${post.image ? `<div class="komunitas-img"><img src="${post.image}" alt="" loading="lazy"></div>` : ''}
      <div class="komunitas-actions">
        <button type="button" class="ka-btn ka-like ${liked ? 'liked' : ''}" data-like-post="${post.id}">
          <i class="fa-${liked ? 'solid' : 'regular'} fa-heart"></i>
          <span class="ka-like-num">${st.likes}</span>
        </button>
        <button type="button" class="ka-btn ka-comment" data-toggle-comment="${post.id}">
          <i class="fa-regular fa-comment"></i>
          <span class="ka-comment-num">${comments.length}</span>
        </button>
        <span class="ka-btn ka-views" title="Dilihat">
          <i class="fa-solid fa-eye"></i>
          <span class="ka-views-num">${st.views}</span>
        </span>
        <button type="button" class="ka-btn ka-share" data-share-post="${post.id}" title="Bagikan">
          <i class="fa-solid fa-share-nodes"></i>
          <span>Bagikan</span>
        </button>
      </div>
      <div class="komentar-box" id="komentar-box-${post.id}" style="display:none">
        <div class="komentar-list" id="komentar-list-${post.id}">${commentsHtml}</div>
        <div class="komentar-form">
          <input type="text" class="komentar-input" id="komentar-input-${post.id}" placeholder="Tulis komentar..." maxlength="300">
          <button type="button" class="komentar-send" data-send-comment="${post.id}">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    `;
    feed.appendChild(card);
  });

  feed.querySelectorAll('[data-like-post]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-like-post');
      const res = toggleKomunitasLike(id);
      btn.classList.toggle('liked', res.liked);
      const icon = btn.querySelector('i');
      if (icon) icon.className = res.liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
      const num = btn.querySelector('.ka-like-num');
      if (num) num.textContent = res.likes;
    });
  });

  feed.querySelectorAll('[data-share-post]').forEach((btn) => {
    btn.addEventListener('click', () => {
      shareKomunitasPost(btn.getAttribute('data-share-post'));
    });
  });

  feed.querySelectorAll('[data-toggle-comment]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle-comment');
      const box = document.getElementById('komentar-box-' + id);
      if (!box) return;
      box.style.display = box.style.display === 'none' ? 'block' : 'none';
    });
  });

  feed.querySelectorAll('[data-send-comment]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-send-comment');
      const input = document.getElementById('komentar-input-' + id);
      if (!input || !input.value.trim()) return;
      addPostComment(id, input.value);
      input.value = '';
      // refresh list + count
      const list = getPostComments(id);
      const listEl = document.getElementById('komentar-list-' + id);
      if (listEl) {
        listEl.innerHTML = list.map((c) => `
          <div class="komentar-item">
            <div class="komentar-name">${c.name}</div>
            <div class="komentar-text">${c.text}</div>
            <div class="komentar-time">${c.time || ''}</div>
          </div>
        `).join('');
      }
      const card = feed.querySelector(`[data-post-id="${id}"]`) || btn.closest('.komunitas-card');
      if (card) {
        const num = card.querySelector('.ka-comment-num');
        if (num) num.textContent = list.length;
      }
    });
  });

  // Enter to send
  feed.querySelectorAll('.komentar-input').forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const id = input.id.replace('komentar-input-', '');
        const sendBtn = feed.querySelector(`[data-send-comment="${id}"]`);
        if (sendBtn) sendBtn.click();
      }
    });
  });
}

// Auto-init saat halaman komunitas / komunikasi
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body && document.body.dataset.page;
  if (page === 'komunitas' || page === 'komunikasi') {
    if (typeof renderKomunitasFeed === 'function') renderKomunitasFeed();
  }
});
