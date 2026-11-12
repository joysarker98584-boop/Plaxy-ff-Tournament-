// ArenaX Free Fire Tournament — app.js
// Firebase SDK 11.6.0
// HTML IDs matched with the supplied index.html.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// 1) FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBKOUb6yOmDKN6h5lnaZuZvFXUAnEc4fT0",
  authDomain: "arenax-free-fire-tournament.firebaseapp.com",
  projectId: "arenax-free-fire-tournament",
  storageBucket: "arenax-free-fire-tournament.firebasestorage.app",
  messagingSenderId: "462385161284",
  appId: "1:462385161284:web:158efb7659bb350f6c0811",
  measurementId: "G-Q0BR3YKYEZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (selector) => document.querySelector(selector);

let currentUser = null;
let isAdmin = false;
let currentBalance = 0;
let authReady = false;

function showMessage(message, isError = false) {
  const box = $("#message");
  if (!box) return;
  box.textContent = message;
  box.classList.remove("hide");
  box.style.display = "block";
  box.style.color = isError ? "#ff5252" : "#21c77a";
}

function hideMessage() {
  const box = $("#message");
  if (!box) return;
  box.classList.add("hide");
  box.style.display = "none";
}

// Show or hide the actual login/signup forms based on authentication state.
function setAuthFormsVisible(visible) {
  ["#login", "#signup"].forEach((selector) => {
    const form = $(selector);
    if (form) form.style.display = visible ? "" : "none";
  });

  // Header shortcuts are also only visible while logged out.
  ["#topLogin", "#topSignup"].forEach((selector) => {
    const button = $(selector);
    if (!button) return;
    button.classList.toggle("hide", !visible);
    button.style.display = visible ? "" : "none";
  });
}

// Give the existing message area a polished, consistent notification style.
(function styleMessageBox() {
  if (document.getElementById("arenax-message-style")) return;
  const style = document.createElement("style");
  style.id = "arenax-message-style";
  style.textContent = `
    #message {
      padding: 12px 16px;
      margin: 12px 0;
      border: 1px solid currentColor;
      border-radius: 12px;
      background: rgba(15, 20, 35, .94);
      font-weight: 600;
      line-height: 1.5;
      box-shadow: 0 8px 24px rgba(0,0,0,.18);
      overflow-wrap: anywhere;
    }
  `;
  document.head.appendChild(style);
})();

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString("en-BD") : "0";
}

// 2) PAGE NAVIGATION
function page(name) {
  document.querySelectorAll(".page").forEach((el) => {
    el.classList.toggle("active", el.id === `page-${name}`);
  });

  document.querySelectorAll("[data-page]").forEach((el) => {
    el.classList.toggle("active", el.dataset.page === name);
  });

  closeDrawer();
  hideMessage();

  if (name === "leaderboard") loadLeaderboard();
  if (name === "admin" && isAdmin) loadAdminData();
  if (name === "myMatches" && currentUser) loadPlayerData();
  if (name === "wallet" && currentUser) loadPlayerData();
}

document.querySelectorAll("[data-page]").forEach((el) => {
  el.addEventListener("click", () => page(el.dataset.page));
});

function openDrawer() {
  $("#drawer")?.classList.add("open");
  $("#scrim")?.classList.add("show");
}

function closeDrawer() {
  $("#drawer")?.classList.remove("open");
  $("#scrim")?.classList.remove("show");
}

$("#menuToggle")?.addEventListener("click", openDrawer);
$("#drawerClose")?.addEventListener("click", closeDrawer);
$("#scrim")?.addEventListener("click", closeDrawer);

$("#copyNumber")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText("01346022330");
    showMessage("পেমেন্ট নম্বর কপি হয়েছে।");
  } catch {
    showMessage("নম্বর: 01346022330", false);
  }
});

// 3) SIGN UP — HTML form ID is "signup"
$("#signup")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const f = Object.fromEntries(new FormData(form));
  const name = String(f.name || "").trim();
  const email = String(f.email || "").trim().toLowerCase();
  const password = String(f.password || "");

  if (!name || !email || password.length < 6) {
    showMessage("নাম, সঠিক Email এবং কমপক্ষে ৬ অক্ষরের Password দাও।", true);
    return;
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });

    await setDoc(doc(db, "users", credential.user.uid), {
      displayName: name,
      email,
      role: "player",
      createdAt: serverTimestamp()
    });

    form.reset();
    showMessage("Account তৈরি হয়েছে। স্বাগতম!");
  } catch (error) {
    console.error("Signup error:", error);
    showMessage(error.message, true);
  }
});

// 4) LOGIN — HTML form ID is "login"
$("#login")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const f = Object.fromEntries(new FormData(form));

  try {
    await signInWithEmailAndPassword(
      auth,
      String(f.email || "").trim().toLowerCase(),
      String(f.password || "")
    );
    form.reset();
    showMessage("Login সফল হয়েছে!");
  } catch (error) {
    console.error("Login error:", error);
    const invalidLoginCodes = [
      "auth/invalid-credential",
      "auth/wrong-password",
      "auth/user-not-found",
      "auth/invalid-email"
    ];
    if (invalidLoginCodes.includes(error.code)) {
      showMessage("পাসওয়ার্ড বা ইমেল ভুল", true);
    } else {
      showMessage("লগইন করা যায়নি। আবার চেষ্টা করো।", true);
    }
  }
});

// 5) LOGOUT
$("#logout")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    page("home");
    showMessage("Logout হয়েছে।");
  } catch (error) {
    showMessage(error.message, true);
  }
});

$("#topLogin")?.addEventListener("click", () => page("account"));
$("#topSignup")?.addEventListener("click", () => page("account"));

// 6) AUTH STATE
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  isAdmin = false;
  authReady = true;

  try {
    if (user) {
      setAuthFormsVisible(false);
      const userSnap = await getDoc(doc(db, "users", user.uid));

      if (userSnap.exists()) {
        isAdmin = userSnap.data().role === "admin";
      }

      if ($("#session")) {
        $("#session").textContent = user.displayName || user.email || "Logged in";
      }
      if ($("#logout")) $("#logout").style.display = "inline-flex";
      if ($("#drawerAdmin")) {
        $("#drawerAdmin").classList.toggle("hide", !isAdmin);
        $("#drawerAdmin").style.display = isAdmin ? "block" : "none";
      }

      setAuthFormsVisible(false);

      await loadTournaments();
      await loadPlayerData();
      await loadLeaderboard();
      if (isAdmin) await loadAdminData();
    } else {
      setAuthFormsVisible(true);
      if ($("#session")) $("#session").textContent = "Login করা হয়নি";
      if ($("#logout")) $("#logout").style.display = "none";
      if ($("#drawerAdmin")) {
        $("#drawerAdmin").classList.add("hide");
        $("#drawerAdmin").style.display = "none";
      }
      $("#topLogin")?.classList.remove("hide");
      $("#topSignup")?.classList.remove("hide");

      currentBalance = 0;
      if ($("#balance")) $("#balance").textContent = "৳ 0.00";
      if ($("#myMatchesList")) $("#myMatchesList").textContent = "ম্যাচ দেখতে Login করো।";
      if ($("#paymentRows")) $("#paymentRows").innerHTML = '<tr><td colspan="4">Login করলে দেখা যাবে।</td></tr>';

      await loadTournaments();
      await loadLeaderboard();
    }
  } catch (error) {
    console.error("Auth state error:", error);
    showMessage("Account তথ্য লোড হয়নি: " + error.message, true);
  }
});

// 7) LOAD TOURNAMENTS
async function loadTournaments() {
  try {
    const snapshot = await getDocs(query(
      collection(db, "tournaments"),
      orderBy("createdAt", "desc")
    ));

    const tournaments = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    const cards = tournaments.map((t) => `
      <article class="tournament-card">
        <h3>${escapeHTML(t.title || "Tournament")}</h3>
        <p>Mode: ${escapeHTML(t.mode || "")}</p>
        <p>Entry Fee: ৳${money(t.entryFee)}</p>
        <p>Prize: ৳${money(t.prizePool)}</p>
        <p>Players: ${Number(t.joined || 0)}/${Number(t.slots || 0)}</p>
        <p>Start: ${t.startsAt ? escapeHTML(new Date(t.startsAt).toLocaleString("bn-BD")) : "TBA"}</p>
        <button class="btn primary" type="button" onclick="joinTournament('${t.id}')">Join Tournament</button>
      </article>
    `).join("");

    if ($("#tournamentList")) {
      $("#tournamentList").innerHTML = cards || '<div class="panel">কোনো Tournament নেই।</div>';
    }
    if ($("#homeTournamentList")) {
      $("#homeTournamentList").innerHTML = cards || '<div class="panel">এখনো Tournament প্রকাশ হয়নি।</div>';
    }
    if ($("#tournamentSelect")) {
      const selected = $("#tournamentSelect").value;
      $("#tournamentSelect").innerHTML =
        '<option value="">টুর্নামেন্ট বেছে নাও</option>' +
        tournaments.map((t) =>
          `<option value="${t.id}">${escapeHTML(t.title || "Tournament")}</option>`
        ).join("");
      if (tournaments.some((t) => t.id === selected)) {
        $("#tournamentSelect").value = selected;
      }
    }
  } catch (error) {
    console.error("Tournament load error:", error);
    if ($("#tournamentList")) {
      $("#tournamentList").innerHTML = '<div class="panel">Tournament লোড হয়নি। Firestore Rules পরীক্ষা করো।</div>';
    }
  }
}

// 8) JOIN BUTTON — sends player to the registration form
window.joinTournament = async (tournamentId) => {
  if (!currentUser) {
    showMessage("প্রথমে Login করো।", true);
    page("account");
    return;
  }

  try {
    const tournamentSnap = await getDoc(doc(db, "tournaments", tournamentId));
    if (!tournamentSnap.exists()) {
      showMessage("Tournament পাওয়া যায়নি।", true);
      return;
    }

    const t = tournamentSnap.data();
    if (Number(t.joined || 0) >= Number(t.slots || 0)) {
      showMessage("এই Tournament-এর Slot পূর্ণ।", true);
      return;
    }

    const existing = await getDocs(query(
      collection(db, "registrations"),
      where("userId", "==", currentUser.uid),
      where("tournamentId", "==", tournamentId)
    ));

    if (!existing.empty) {
      showMessage("এই Tournament-এ তোমার আবেদন আগে থেকেই আছে।", true);
      page("myMatches");
      return;
    }

    if ($("#tournamentSelect")) $("#tournamentSelect").value = tournamentId;
    page("myMatches");
    showMessage("নিচের Registration Form পূরণ করে Submit করো।");
  } catch (error) {
    console.error("Join tournament error:", error);
    showMessage(error.message, true);
  }
};

// 9) REGISTRATION FORM
$("#registrationForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;

  if (!currentUser) {
    showMessage("প্রথমে Login করো।", true);
    page("account");
    return;
  }

  const f = Object.fromEntries(new FormData(form));
  const tournamentId = String(f.tournamentId || "").trim();
  const playerName = String(f.playerName || "").trim();
  const uid = String(f.uid || "").trim();
  const teamName = String(f.teamName || "").trim();

  if (!tournamentId || !playerName || !/^[0-9]{5,20}$/.test(uid)) {
    showMessage("Tournament, Player Name এবং সঠিক ৫–২০ সংখ্যার Free Fire UID দাও।", true);
    return;
  }

  try {
    const tournamentSnap = await getDoc(doc(db, "tournaments", tournamentId));
    if (!tournamentSnap.exists()) {
      showMessage("নির্বাচিত Tournament পাওয়া যায়নি।", true);
      return;
    }

    const existing = await getDocs(query(
      collection(db, "registrations"),
      where("userId", "==", currentUser.uid),
      where("tournamentId", "==", tournamentId)
    ));

    if (!existing.empty) {
      showMessage("এই Tournament-এ তুমি ইতিমধ্যে আবেদন করেছ।", true);
      return;
    }

    await addDoc(collection(db, "registrations"), {
      userId: currentUser.uid,
      playerName,
      uid,
      teamName,
      tournamentId,
      status: "pending",
      createdAt: serverTimestamp()
    });

    form.reset();
    showMessage("Registration জমা হয়েছে। Admin Approve করলে Join Confirm হবে।");
    await loadPlayerData();
  } catch (error) {
    console.error("Registration submit error:", error);
    showMessage("Registration হয়নি: " + error.message, true);
  }
});

// 10) LOAD PLAYER WALLET + MATCHES + PAYMENT HISTORY
async function loadPlayerData() {
  if (!currentUser) return;

  try {
    const paymentSnap = await getDocs(query(
      collection(db, "paymentRequests"),
      where("userId", "==", currentUser.uid)
    ));

    let balance = 0;
    paymentSnap.forEach((item) => {
      const p = item.data();
      if (p.status === "approved") {
        if (p.type === "deposit") balance += Number(p.amount || 0);
        if (p.type === "tournament_fee" || p.type === "withdraw") {
          balance -= Number(p.amount || 0);
        }
      }
    });

    currentBalance = balance;
    if ($("#balance")) $("#balance").textContent = "৳ " + money(balance);

    if ($("#paymentRows")) {
      const rows = paymentSnap.docs.map((item) => {
        const p = item.data();
        const type = p.type === "deposit" ? "Deposit" :
          p.type === "tournament_fee" ? "Entry Fee" : escapeHTML(p.type || "");
        return `<tr>
          <td>${type}</td>
          <td>৳${money(p.amount)}</td>
          <td>${escapeHTML(p.method || "Wallet")}</td>
          <td>${escapeHTML(p.status || "pending")}</td>
        </tr>`;
      }).join("");
      $("#paymentRows").innerHTML = rows || '<tr><td colspan="4">কোনো লেনদেন নেই।</td></tr>';
    }

    const registrationSnap = await getDocs(query(
      collection(db, "registrations"),
      where("userId", "==", currentUser.uid)
    ));

    if ($("#myMatchesList")) {
      $("#myMatchesList").innerHTML = registrationSnap.docs.map((item) => {
        const r = item.data();
        return `<div class="match-card">
          <p><b>Player:</b> ${escapeHTML(r.playerName || "")}</p>
          <p><b>Free Fire UID:</b> ${escapeHTML(r.uid || "")}</p>
          <p><b>Tournament ID:</b> ${escapeHTML(r.tournamentId || "")}</p>
          <p><b>Status:</b> ${escapeHTML(r.status || "pending")}</p>
        </div>`;
      }).join("") || '<div class="empty">এখনো কোনো Registration নেই।</div>';
    }
  } catch (error) {
    console.error("Player data load error:", error);
    showMessage("Wallet/Match তথ্য লোড হয়নি: " + error.message, true);
  }
}

// 11) WALLET — MANUAL DEPOSIT REQUEST ONLY
$("#paymentForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;

  if (!currentUser) {
    showMessage("Deposit Request দিতে Login করো।", true);
    page("account");
    return;
  }

  const f = Object.fromEntries(new FormData(form));
  const amount = Number(f.amount);
  const reference = String(f.reference || "").trim();
  const method = String(f.method || "");

  if (f.type !== "deposit") {
    showMessage("Withdraw আপাতত বন্ধ আছে।", true);
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    showMessage("১ থেকে ১০০,০০০ টাকার মধ্যে Amount দাও।", true);
    return;
  }
  if (!reference || !["bKash", "Nagad"].includes(method)) {
    showMessage("সঠিক Transaction ID ও Payment Method দাও।", true);
    return;
  }

  try {
    await addDoc(collection(db, "paymentRequests"), {
      userId: currentUser.uid,
      userEmail: currentUser.email || "",
      type: "deposit",
      amount,
      method,
      reference,
      status: "pending",
      createdAt: serverTimestamp()
    });

    form.reset();
    showMessage("Deposit Request জমা হয়েছে। Admin যাচাই করে Approve করবেন।");
    await loadPlayerData();
  } catch (error) {
    console.error("Deposit request error:", error);
    showMessage("Payment Request জমা হয়নি: " + error.message, true);
  }
});

// 12) ADMIN CHECK — Firestore user document role
async function checkAdmin() {
  if (!auth.currentUser) return false;
  try {
    const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
    return snap.exists() && snap.data().role === "admin";
  } catch (error) {
    console.error("Admin check error:", error);
    return false;
  }
}

// 13) LOAD ADMIN REQUESTS
async function loadAdminData() {
  if (!(await checkAdmin())) return;

  try {
    const [paymentSnap, registrationSnap] = await Promise.all([
      getDocs(query(
        collection(db, "paymentRequests"),
        where("status", "==", "pending")
      )),
      getDocs(query(
        collection(db, "registrations"),
        where("status", "==", "pending")
      ))
    ]);

    if ($("#adminPayments")) {
      $("#adminPayments").innerHTML = paymentSnap.docs.map((item) => {
        const p = item.data();
        return `<tr>
          <td>${escapeHTML(p.userEmail || p.userId || "")}</td>
          <td>${escapeHTML(p.type || "")} • ৳${money(p.amount)} • ${escapeHTML(p.method || "")}<br>ID: ${escapeHTML(p.reference || "")}</td>
          <td>
            <button type="button" class="btn primary" onclick="reviewPayment('${item.id}','approved')">Approve</button>
            <button type="button" class="btn outline" onclick="reviewPayment('${item.id}','rejected')">Reject</button>
          </td>
        </tr>`;
      }).join("") || '<tr><td colspan="3">কোনো Pending Payment নেই।</td></tr>';
    }

    if ($("#adminRegistrations")) {
      $("#adminRegistrations").innerHTML = registrationSnap.docs.map((item) => {
        const r = item.data();
        return `<tr>
          <td>${escapeHTML(r.playerName || "")}</td>
          <td>${escapeHTML(r.uid || "")}</td>
          <td>${escapeHTML(r.tournamentId || "")}</td>
          <td>
            <button type="button" class="btn primary" onclick="approveRegistration('${item.id}')">Approve</button>
            <button type="button" class="btn outline" onclick="rejectRegistration('${item.id}')">Reject</button>
          </td>
        </tr>`;
      }).join("") || '<tr><td colspan="4">কোনো Pending Registration নেই।</td></tr>';
    }
  } catch (error) {
    console.error("Admin dashboard error:", error);
    showMessage("Admin Data লোড হয়নি: " + error.message, true);
  }
}

$("#drawerAdmin")?.addEventListener("click", async () => {
  if (await checkAdmin()) page("admin");
  else showMessage("শুধু Admin প্রবেশ করতে পারবে।", true);
});

// 14) ADMIN APPROVE / REJECT DEPOSIT
window.reviewPayment = async (paymentId, status) => {
  if (!(await checkAdmin())) {
    showMessage("Admin permission নেই।", true);
    return;
  }
  if (!["approved", "rejected"].includes(status)) return;

  try {
    const ref = doc(db, "paymentRequests", paymentId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("Payment পাওয়া যায়নি।");
      const p = snap.data();
      if (p.status !== "pending" || p.type !== "deposit") {
        throw new Error("এই Payment আর Review করা যাবে না।");
      }
      tx.update(ref, {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser.uid
      });
    });

    showMessage(status === "approved" ? "Payment Approve হয়েছে।" : "Payment Reject হয়েছে।");
    await loadAdminData();
    if (currentUser) await loadPlayerData();
  } catch (error) {
    console.error("Review payment error:", error);
    showMessage(error.message, true);
  }
};

// 15) ADMIN APPROVE REGISTRATION + ENTRY FEE LEDGER RECORD
// NOTE: This browser-side wallet flow is suitable for a demo/manual workflow only.
// It is not a secure real-money wallet. A trusted server/Cloud Function is needed
// for production-grade balance enforcement and concurrent approvals.
window.approveRegistration = async (registrationId) => {
  if (!(await checkAdmin())) {
    showMessage("Admin permission নেই।", true);
    return;
  }

  try {
    const registrationRef = doc(db, "registrations", registrationId);
    const registrationSnap = await getDoc(registrationRef);
    if (!registrationSnap.exists()) throw new Error("Registration পাওয়া যায়নি।");

    const registration = registrationSnap.data();
    if (registration.status !== "pending") throw new Error("Registration আগে Review হয়েছে।");

    const tournamentRef = doc(db, "tournaments", registration.tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists()) throw new Error("Tournament পাওয়া যায়নি।");

    const fee = Number(tournamentSnap.data().entryFee || 0);

    // Read the player's approved ledger entries before starting the transaction.
    const ledgerSnap = await getDocs(query(
      collection(db, "paymentRequests"),
      where("userId", "==", registration.userId)
    ));

    let balance = 0;
    ledgerSnap.forEach((item) => {
      const p = item.data();
      if (p.status === "approved") {
        if (p.type === "deposit") balance += Number(p.amount || 0);
        if (p.type === "tournament_fee" || p.type === "withdraw") {
          balance -= Number(p.amount || 0);
        }
      }
    });

    if (balance < fee) {
      throw new Error(`Player-এর Wallet Balance পর্যাপ্ত নয়। বর্তমান Balance: ৳${money(balance)}`);
    }

    await runTransaction(db, async (tx) => {
      const latestReg = await tx.get(registrationRef);
      const latestTournament = await tx.get(tournamentRef);

      if (!latestReg.exists() || !latestTournament.exists()) {
        throw new Error("Registration অথবা Tournament পাওয়া যায়নি।");
      }
      if (latestReg.data().status !== "pending") {
        throw new Error("Registration ইতিমধ্যে Review হয়েছে।");
      }

      const t = latestTournament.data();
      const joined = Number(t.joined || 0);
      const slots = Number(t.slots || 0);
      if (joined >= slots) throw new Error("Tournament Slot পূর্ণ হয়ে গেছে।");

      tx.update(registrationRef, {
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedBy: auth.currentUser.uid
      });
      tx.update(tournamentRef, { joined: joined + 1 });

      if (fee > 0) {
        const debitRef = doc(collection(db, "paymentRequests"));
        tx.set(debitRef, {
          userId: registration.userId,
          type: "tournament_fee",
          amount: fee,
          status: "approved",
          tournamentId: registration.tournamentId,
          method: "Wallet",
          reference: "Tournament Entry Fee",
          createdAt: serverTimestamp(),
          reviewedBy: auth.currentUser.uid
        });
      }
    });

    showMessage("Registration Approve হয়েছে।");
    await loadAdminData();
    if (currentUser) await loadPlayerData();
  } catch (error) {
    console.error("Approve registration error:", error);
    showMessage(error.message, true);
  }
};

// 16) ADMIN REJECT REGISTRATION
window.rejectRegistration = async (registrationId) => {
  if (!(await checkAdmin())) {
    showMessage("Admin permission নেই।", true);
    return;
  }

  try {
    const ref = doc(db, "registrations", registrationId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("Registration পাওয়া যায়নি।");
      if (snap.data().status !== "pending") {
        throw new Error("Registration আগে Review হয়েছে।");
      }
      tx.update(ref, {
        status: "rejected",
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser.uid
      });
    });

    showMessage("Registration Reject হয়েছে।");
    await loadAdminData();
    if (currentUser) await loadPlayerData();
  } catch (error) {
    console.error("Reject registration error:", error);
    showMessage(error.message, true);
  }
};

// 17) CREATE TOURNAMENT
$("#createTournament")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!(await checkAdmin())) {
    showMessage("শুধু Admin Tournament তৈরি করতে পারবে।", true);
    return;
  }

  const form = e.currentTarget;
  const f = Object.fromEntries(new FormData(form));
  const entryFee = Number(f.entryFee);
  const prizePool = Number(f.prizePool);
  const slots = Number(f.slots);

  if (!String(f.title || "").trim() ||
      !Number.isFinite(entryFee) || entryFee < 0 ||
      !Number.isFinite(prizePool) || prizePool < 0 ||
      !Number.isInteger(slots) || slots < 1 || slots > 500) {
    showMessage("Tournament-এর তথ্য সঠিকভাবে পূরণ করো।", true);
    return;
  }

  try {
    await addDoc(collection(db, "tournaments"), {
      title: String(f.title).trim(),
      mode: String(f.mode || "Solo"),
      description: String(f.description || "").trim(),
      entryFee,
      prizePool,
      slots,
      joined: 0,
      startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : "",
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    });

    form.reset();
    showMessage("Tournament Publish হয়েছে।");
    await loadTournaments();
    await loadAdminData();
  } catch (error) {
    console.error("Create tournament error:", error);
    showMessage(error.message, true);
  }
});

// 18) PUBLISH RESULT
$("#resultForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!(await checkAdmin())) {
    showMessage("শুধু Admin Result Publish করতে পারবে।", true);
    return;
  }

  const form = e.currentTarget;
  const f = Object.fromEntries(new FormData(form));
  const placement = Number(f.placement);
  const points = Number(f.points);

  if (!String(f.player || "").trim() ||
      !String(f.tournamentId || "").trim() ||
      !Number.isInteger(placement) || placement < 1 ||
      !Number.isFinite(points) || points < 0) {
    showMessage("Result-এর তথ্য সঠিকভাবে পূরণ করো।", true);
    return;
  }

  try {
    await addDoc(collection(db, "results"), {
      player: String(f.player).trim(),
      placement,
      points,
      tournamentId: String(f.tournamentId).trim(),
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    });

    form.reset();
    showMessage("Result Publish হয়েছে।");
    await loadLeaderboard();
  } catch (error) {
    console.error("Publish result error:", error);
    showMessage(error.message, true);
  }
});

// 19) LEADERBOARD
async function loadLeaderboard() {
  try {
    const snapshot = await getDocs(query(
      collection(db, "results"),
      orderBy("points", "desc")
    ));

    if ($("#leaderboardRows")) {
      $("#leaderboardRows").innerHTML = snapshot.docs.map((item, index) => {
        const r = item.data();
        return `<tr>
          <td>${index + 1}</td>
          <td>${escapeHTML(r.player || "")}</td>
          <td>${Number(r.placement || 0)}</td>
          <td>${Number(r.points || 0)}</td>
        </tr>`;
      }).join("") || '<tr><td colspan="4">এখনো ফলাফল প্রকাশ হয়নি।</td></tr>';
    }
  } catch (error) {
    console.error("Leaderboard error:", error);
    if ($("#leaderboardRows")) {
      $("#leaderboardRows").innerHTML = '<tr><td colspan="4">Leaderboard লোড হয়নি।</td></tr>';
    }
  }
}

// Initial public data
loadTournaments();
loadLeaderboard();
