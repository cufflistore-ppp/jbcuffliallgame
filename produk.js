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
    tags: ["ff", "akun ff", "free fire"],
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

  "free-fire/cuffliallgame/c-025/127/receh": {
    id: "free-fire/cuffliallgame/c-025/127/receh",
    nama: "Free Fire",
    subtitle: "Stok Akun Res Cuffli All Game",
    harga: 19000,
    hargaAsli: 25000,
    diskon: 24,
    hargaFormatted: "Rp 19.000",
    hargaAsliFormatted: "Rp 25.000",
    game: "Free Fire",
    tags: ["ff", "akun ff", "free fire", "receh"],
    deskripsi: "Setiap Transaksi Pastinya Ada Allreff 24 jam lewat 24 jam invalite. Proses cepat & stok terbatas!",
    spek: [
      "Rank: Platinum 1",
      "LOG/LOGIN: ggl(gogle)",
      "HTTPS: on",
      "EVO: sg panjang level 5",
      "BIND: kos/kosong",
      "SG: kayu",
      "LEVEL: 39"
    ],
    foto: [
      "banner 1 2cuffli.jpg",
      "banner 2 2cuffli.jpg",
      "banner 3 2cuffli.jpg",
      "banner 4 2cuffli.jpg",
      "banner 5 2cuffli.jpg",
      "banner 6 2cuffli.jpg",
      "banner 7 2cuffli.jpg"
    ],
    thumbnail: "banner 1 2cuffli.jpg",
    kategori: "PELAJAR",
    cocokUntuk: "Cocok untuk yg masih pelajar yg cari akun receh",
    adminNama: "Admin Cuffli 1",
    adminFoto: "admin1.png",
    adminWA: "6287722626689",
    qrImage: "qris.jpg",
    qrLabel: "QRIS Admin 1 — Res"
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
