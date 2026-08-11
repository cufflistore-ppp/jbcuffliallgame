/**
 * firebase.js — Setup Login Firebase (Google + Phone + Email) + data user
 *
 * YANG HARUS DIAKTIFKAN DI FIREBASE CONSOLE:
 * 1. Authentication → Sign-in method → Google → Enable
 * 2. Authentication → Sign-in method → Phone → Enable
 * 3. Authentication → Settings → Authorized domains → tambahkan domain kamu
 * 4. Firestore Database → Create database (mode production / test)
 *
 * Catatan Phone Auth:
 * - Butuh reCAPTCHA (otomatis dihandle)
 * - SMS hanya terkirim ke nomor asli (bukan dummy) kecuali pakai nomor test di console
 * - Di Firebase Console → Authentication → Phone → bisa tambah nomor test
 */

// ========== CONFIG FIREBASE ==========
const firebaseConfig = {
  apiKey: "AIzaSyAV3V_2tOZQtSLpNSOB3dDiWMprXBGq2EI",
  authDomain: "cuffli-all-game-54f30.firebaseapp.com",
  databaseURL: "https://cuffli-all-game-54f30-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "cuffli-all-game-54f30",
  storageBucket: "cuffli-all-game-54f30.firebasestorage.app",
  messagingSenderId: "509183551168",
  appId: "1:509183551168:web:27eef2c6355c43c2316f25",
  measurementId: "G-JW00MS30TX"
};
// =====================================

let firebaseReady = false;
let auth = null;
let db = null;
let googleProvider = null;
let phoneConfirmationResult = null;
let recaptchaVerifier = null;

function isFirebaseConfigured() {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("GANTI");
}

async function initFirebase() {
  if (!isFirebaseConfigured()) {
    console.log("[Firebase] Config belum diisi — mode localStorage aktif");
    return false;
  }
  try {
    if (typeof firebase === "undefined") {
      console.warn("[Firebase] SDK belum dimuat. Pastikan script Firebase ada di HTML.");
      return false;
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();
    googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });
    firebaseReady = true;
    console.log("[Firebase] Siap");
    return true;
  } catch (e) {
    console.error("[Firebase] Gagal init:", e);
    return false;
  }
}

// ===== HELPER: simpan / update user di Firestore =====
async function ensureUserDoc(user, extra = {}) {
  if (!db || !user) return;
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      nama: user.displayName || extra.nama || user.phoneNumber || "User",
      email: user.email || null,
      phone: user.phoneNumber || extra.phone || null,
      photoURL: user.photoURL || null,
      provider: extra.provider || (user.providerData[0] && user.providerData[0].providerId) || "unknown",
      spinSisa: 0,
      spinPaid: false,
      vouchers: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    const update = {};
    if (user.displayName) update.nama = user.displayName;
    if (user.photoURL) update.photoURL = user.photoURL;
    if (user.email) update.email = user.email;
    if (user.phoneNumber) update.phone = user.phoneNumber;
    if (Object.keys(update).length) {
      await ref.set(update, { merge: true });
    }
  }
}

// ===== EMAIL/PASSWORD (tetap didukung) =====
async function fbRegister(email, password, nama) {
  if (!firebaseReady) return { ok: false, msg: "Firebase belum siap" };
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: nama });
    await ensureUserDoc(cred.user, { nama, provider: "password" });
    return { ok: true, user: cred.user };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

async function fbLogin(email, password) {
  if (!firebaseReady) return { ok: false, msg: "Firebase belum siap" };
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    await ensureUserDoc(cred.user, { provider: "password" });
    return { ok: true, user: cred.user };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

// ===== GOOGLE LOGIN =====
async function fbLoginGoogle() {
  if (!firebaseReady) return { ok: false, msg: "Firebase belum siap" };
  try {
    const result = await auth.signInWithPopup(googleProvider);
    await ensureUserDoc(result.user, { provider: "google.com" });
    return { ok: true, user: result.user };
  } catch (e) {
    if (e.code === "auth/popup-closed-by-user") {
      return { ok: false, msg: "Login dibatalkan" };
    }
    if (e.code === "auth/popup-blocked") {
      return { ok: false, msg: "Popup diblokir browser. Izinkan popup lalu coba lagi." };
    }
    return { ok: false, msg: e.message };
  }
}

// ===== PHONE AUTH =====
function setupRecaptcha(containerId = "recaptcha-container") {
  if (!firebaseReady) return null;
  try {
    if (recaptchaVerifier) {
      try { recaptchaVerifier.clear(); } catch (_) {}
      recaptchaVerifier = null;
    }
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier(containerId, {
      size: "invisible",
      callback: function () {},
      "expired-callback": function () {
        console.warn("[Firebase] reCAPTCHA expired");
      }
    });
    return recaptchaVerifier;
  } catch (e) {
    console.error("[Firebase] Gagal setup reCAPTCHA:", e);
    return null;
  }
}

/**
 * Kirim OTP ke nomor HP
 * @param {string} phoneNumber - format: 081234567890 atau +6281234567890
 */
async function fbSendOtp(phoneNumber, containerId = "recaptcha-container") {
  if (!firebaseReady) return { ok: false, msg: "Firebase belum siap" };

  let phone = (phoneNumber || "").trim().replace(/[\s\-()]/g, "");
  if (phone.startsWith("08")) {
    phone = "+62" + phone.slice(1);
  } else if (phone.startsWith("62") && !phone.startsWith("+")) {
    phone = "+" + phone;
  } else if (!phone.startsWith("+")) {
    phone = "+62" + phone;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    return { ok: false, msg: "Nomor HP tidak valid. Contoh: 081234567890" };
  }

  try {
    const verifier = setupRecaptcha(containerId);
    if (!verifier) return { ok: false, msg: "Gagal setup reCAPTCHA" };

    phoneConfirmationResult = await auth.signInWithPhoneNumber(phone, verifier);
    return { ok: true, msg: "Kode OTP dikirim ke " + phone, phone };
  } catch (e) {
    console.error("[Firebase] sendOtp error:", e);
    if (recaptchaVerifier) {
      try { recaptchaVerifier.clear(); } catch (_) {}
      recaptchaVerifier = null;
    }
    let msg = e.message;
    if (e.code === "auth/too-many-requests") msg = "Terlalu banyak percobaan. Coba lagi nanti.";
    if (e.code === "auth/invalid-phone-number") msg = "Nomor HP tidak valid.";
    if (e.code === "auth/quota-exceeded") msg = "Kuota SMS habis. Coba lagi nanti.";
    return { ok: false, msg };
  }
}

/**
 * Verifikasi kode OTP (6 digit)
 */
async function fbVerifyOtp(code) {
  if (!firebaseReady) return { ok: false, msg: "Firebase belum siap" };
  if (!phoneConfirmationResult) {
    return { ok: false, msg: "Belum kirim OTP. Kirim dulu nomor HP-nya." };
  }
  try {
    const result = await phoneConfirmationResult.confirm(String(code).trim());
    await ensureUserDoc(result.user, {
      provider: "phone",
      phone: result.user.phoneNumber
    });
    phoneConfirmationResult = null;
    return { ok: true, user: result.user };
  } catch (e) {
    let msg = e.message;
    if (e.code === "auth/invalid-verification-code") msg = "Kode OTP salah.";
    if (e.code === "auth/code-expired") msg = "Kode OTP sudah kedaluwarsa. Kirim ulang.";
    return { ok: false, msg };
  }
}

async function fbLogout() {
  if (!firebaseReady || !auth) return;
  await auth.signOut();
}

function fbOnAuthChange(callback) {
  if (!firebaseReady || !auth) return function () {};
  return auth.onAuthStateChanged(callback);
}

async function fbGetUserData(uid) {
  if (!firebaseReady || !db) return null;
  const doc = await db.collection("users").doc(uid).get();
  return doc.exists ? doc.data() : null;
}

async function fbUpdateUserData(uid, data) {
  if (!firebaseReady || !db) return;
  await db.collection("users").doc(uid).set(data, { merge: true });
}

/** Convert Firebase user → objek yang dipakai app */
function mapFirebaseUser(fbUser, extraData) {
  if (!fbUser) return null;
  extraData = extraData || {};
  const provider = (fbUser.providerData[0] && fbUser.providerData[0].providerId) || "unknown";
  let username = fbUser.uid;
  if (fbUser.email) username = fbUser.email.split("@")[0];
  else if (fbUser.phoneNumber) username = fbUser.phoneNumber;

  // ID tampilan singkat dari uid (tetap unik per akun)
  const shortId = "CUF-" + String(fbUser.uid).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return {
    uid: fbUser.uid,
    id: shortId,
    username: username,
    nama: fbUser.displayName || extraData.nama || fbUser.phoneNumber || "User",
    email: fbUser.email || null,
    phone: fbUser.phoneNumber || null,
    avatar: fbUser.photoURL || extraData.photoURL || null,
    provider: provider,
    isFirebase: true
  };
}

// Export ke window
window.CuffliFirebase = {
  initFirebase: initFirebase,
  isFirebaseConfigured: isFirebaseConfigured,
  fbRegister: fbRegister,
  fbLogin: fbLogin,
  fbLoginGoogle: fbLoginGoogle,
  fbSendOtp: fbSendOtp,
  fbVerifyOtp: fbVerifyOtp,
  fbLogout: fbLogout,
  fbOnAuthChange: fbOnAuthChange,
  fbGetUserData: fbGetUserData,
  fbUpdateUserData: fbUpdateUserData,
  mapFirebaseUser: mapFirebaseUser,
  ensureUserDoc: ensureUserDoc,
  get auth() { return auth; },
  get db() { return db; },
  get ready() { return firebaseReady; }
};
