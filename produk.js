// Data produk akun game - setiap produk punya detail & harga berbeda
const produkData = {
  "ff/cuffliallgame/bersg/1": {
    id: "ff/cuffliallgame/bersg/1",
    nama: "Free Fire",
    subtitle: "Stok Akun Ber Sg Cuffli All Game",
    harga: 55000,
    hargaFormatted: "Rp 55.000",
    game: "Free Fire",
    deskripsi: "Setiap Transaksi Pastinya Ada Allreff 24 jam lewat 24 jam invalite.",
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
      "banner 5 1cuffli.jpg"
    ],
     thumbnail: "banner 1 1cuffli.jpg" 
    },
  "ff/cuffliallgame/res/2": {
    id: "ff/cuffliallgame/res/2",
    nama: "Free Fire",
    subtitle: "Stok Akun Res Cuffli All Game",
    harga: 19000,
    hargaFormatted: "Rp 19.000",
    game: "Free Fire",
    deskripsi: "Setiap Transaksi Pastinya Ada Allreff 24 jam lewat 24 jam invalite.",
        spek: [
      "Rank: Platinum 1",
      "LOG/LOGIN: ggl(gogle)",
      "HTTPS: on",
      "EVO: ada sg panjang level 5",
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
      "banner 6 2cuffli.jpg"
    ],
    thumbnail: "banner 1 2cuffli.jpg"
  },
};
// Ambil semua produk sebagai array
function getAllProduk() {
  return Object.values(produkData);
}

// Ambil produk by ID
function getProdukById(id) {
  return produkData[id] || null;
}
