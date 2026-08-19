// Data produk akun game - setiap produk punya detail, QR, foto admin, & WA admin sendiri
const produkData = {
  "free-fire/cuffliallgame/c-024/124/bersg": {
    id: "free-fire/cuffliallgame/c-024/124/bersg",
    nama: "Free Fire",
    subtitle: "Stok Akun Ber Sg Cuffli All Game",
    harga: 55000,
    hargaAsli: 75000,
    diskon: 27,
    hargaFormatted: "Rp 55.000",
    hargaAsliFormatted: "Rp 75.000",
    game: "Free Fire",
    tags: ["free fire"],
    deskripsi: "Setiap Transaksi Pastinya Ada Allreff 24 jam lewat 24 jam invalite. Proses cepat & stok terbatas!",
    spek: [
      "Rank: gold 4",
      "LOG/LOGIN: ggl(gogle)",
      "HTTPS: -caroline",
      "EVO: kaga ada",
      "BIND: kos/kosong",
      "SG: ompet/trompet",
      "LEVEL: 37"
    ],
    foto: [
      "banner 1 1cuffli.jpg",
      "banner 2 1cuffli.jpg",
      "banner 3 1cuffli.jpg",
      "banner 4 1cuffli.jpg",
      "banner 5 1cuffli.jpg",
      "banner 6 1cuffli.jpg",
      "banner 7 1cuffli.jpg"
    ],
    thumbnail: "banner 1 1cuffli.jpg",
    kategori: "PELAJAR",
    cocokUntuk: "Cocok untuk pelajar / main santai",
    adminNama: "Admin Cuffli 1",
    adminFoto: "admin1.png",
    adminWA: "6287722626689",
    qrImage: "qris.jpg",
    qrLabel: "QRIS Admin 1 — Ber Sg"
  },
  
  "mobile-legends/cuffliallgame/r-001/187/mlbb": {
    id: "mobile-legends/cuffliallgame/r-001/187/mlbb",
    nama: "Mobile Legends",
    subtitle: "Stok Akun Mlbb Cuffli All Game",
    harga: 48000,
    hargaAsli: 64000,
    diskon: 25,
    hargaFormatted: "Rp 48.000",
    hargaAsliFormatted: "Rp 64.000",
    game: "Mobile Legends",
    tags: ["Mobile Legends"],
    deskripsi: "Setiap Transaksi Pastinya Ada Allreff 24 jam lewat 24 jam invalite. Proses cepat & stok terbatas!",
    spek: [
      "Rank: legends",
      "LOG/LOGIN: Monton",
      "BIND: all kos",
      "LEVEL: 30",
      "HERO:61",
      "corector:natalia"
    ],
    foto: [
      "banner 1 3cuffli.jpg",
      "banner 2 3cuffli.jpg",
      "banner 3 3cuffli.jpg",
      "banner 4 3cuffli.jpg",
      "banner 5 3cuffli.jpg",
      "banner 6 3cuffli.jpg"
    ],
    thumbnail: "banner 1 3cuffli.jpg",
    kategori: "PELAJAR",
    cocokUntuk: "Cocok untuk yg masih pelajar yg cari akun receh",
    adminNama: "Admin Cuffli 1",
    adminFoto: "admin1.png",
    adminWA: "6287722626689",
    qrImage: "qris.jpg",
    qrLabel: "QRIS Admin 1 — MLBB"
  },
};

function getAllProduk() {
  return Object.values(produkData);
}

function getProdukById(id) {
  return produkData[id] || null;
}

function filterProdukByTag(tag) {
  if (!tag || tag === 'all') return getAllProduk();
  const t = tag.toLowerCase().trim();
  return getAllProduk().filter(p => {
    const tags = (p.tags || []).map(x => x.toLowerCase());
    const game = (p.game || '').toLowerCase();
    const nama = (p.nama || '').toLowerCase();
    const sub = (p.subtitle || '').toLowerCase();
    return tags.some(tg => tg.includes(t) || t.includes(tg)) ||
           game.includes(t) || nama.includes(t) || sub.includes(t);
  });
}
