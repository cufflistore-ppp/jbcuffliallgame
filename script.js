// ===== BANNER (sudah di CSS animation) =====

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

  // Auto slide
  setInterval(() => {
    current = (current + 1) % total;
    goToSlide(current);
  }, 3500);

  // Touch swipe
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

// ===== RENDER PRODUK DI INDEX =====
function renderProdukList() {
  const grid = document.getElementById('produkGrid');
  if (!grid || typeof getAllProduk !== 'function') return;

  const list = getAllProduk();
  grid.innerHTML = '';

  list.forEach((p) => {
    const card = document.createElement('a');
    card.href = `detail.html?id=${p.id}`;
    card.className = 'produk-card';
    card.innerHTML = `
      <img src="${p.thumbnail}" alt="${p.nama}" loading="lazy">
      <div class="produk-info">
        <div class="game-name">${p.nama}</div>
        <div class="harga">${p.hargaFormatted}</div>
      </div>
    `;
    grid.appendChild(card);
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
  document.getElementById('detailHarga').textContent = p.hargaFormatted;
  document.getElementById('detailDeskripsi').textContent = p.deskripsi;

  const spekEl = document.getElementById('detailSpek');
  spekEl.innerHTML = '';
  p.spek.forEach((s) => {
    const li = document.createElement('li');
    li.textContent = s;
    spekEl.appendChild(li);
  });

  initGallery(p.foto);

  // Tombol beli → simpan id ke session & redirect
  const btn = document.getElementById('btnBeli');
  if (btn) {
    btn.addEventListener('click', () => {
      sessionStorage.setItem('produkId', p.id);
      window.location.href = `pembayaran.html?id=${p.id}`;
    });
  }
}

// ===== LOAD PEMBAYARAN PAGE =====
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

  document.getElementById('payNama').textContent = p.nama + ' — ' + p.subtitle;
  document.getElementById('payHarga').textContent = p.hargaFormatted;

  // WhatsApp konfirmasi
  const pesan = encodeURIComponent(
    `Halo Admin CUFFLI ALL GAME 👋\n\nSaya sudah transfer untuk:\n• Produk: ${p.nama} (${p.subtitle})\n• Harga: ${p.hargaFormatted}\n• ID: ${p.id}\n\nMohon dicek & diproses ya. Terima kasih!`
  );
  // Ganti nomor WA admin di sini
  const nomorWA = '6287722626689';
  document.getElementById('btnWA').href = `https://wa.me/${nomorWA}?text=${pesan}`;

  startQrisTimer(5);
}

// ===== INIT BERDASARKAN HALAMAN =====
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  if (page === 'index') {
    renderProdukList();
  } else if (page === 'detail') {
    loadDetail();
  } else if (page === 'pembayaran') {
    loadPembayaran();
  }
});
