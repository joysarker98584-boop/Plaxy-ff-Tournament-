
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

// FIREBASE CONFIG
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

function showMessage(message, error = false) {
  const box = $("#message");
  if (!box) return;

  box.textContent = message;
  box.style.display = "block";
  box.style.color = error ? "#ff5252" : "#21c77a";
}

function hideMessage() {
  const box = $("#message");
  if (box) box.style.display = "none";
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function page(name) {
  document.querySelectorAll(".page").forEach(el => {
    el.classList.remove("active");
  });

  const target = $("#page-" + name);
  if (target) target.classList.add("active");

  document.querySelectorAll("[data-page]").forEach(el => {
    el.classList.toggle("active", el.dataset.page === name);
  });

  const drawer = $("#drawer");
  if (drawer) drawer.classList.remove("open");

  hideMessage();
}

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    page(button.dataset.page);
  });
});

// SIGN UP
$("#signupForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  const f = Object.fromEntries(new FormData(e.target));

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      f.email,
      f.password
    );

    await updateProfile(credential.user, {
      displayName: f.name
    });

    await setDoc(doc(db, "users", credential.user.uid), {
      displayName: f.name,
      email: f.email,
      role: "player",
      createdAt: serverTimestamp()
    });

    showMessage("Account তৈরি হয়েছে!");
    e.target.reset();

  } catch (error) {
    showMessage(error.message, true);
  }
});

// LOGIN
$("#loginForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  const f = Object.fromEntries(new FormData(e.target));

  try {
    await signInWithEmailAndPassword(auth, f.email, f.password);
    showMessage("Login সফল হয়েছে!");
    e.target.reset();
  } catch (error) {
    showMessage(error.message, true);
  }
});

// LOGOUT
$("#logout")?.addEventListener("click", async () => {
  await signOut(auth);
  page("home");
  showMessage("Logout হয়েছে!");
});

// NAVIGATION BUTTONS
$("#topLogin")?.addEventListener("click", () => page("account"));
$("#topSignup")?.addEventListener("click", () => page("account"));
$("#drawerAdmin")?.addEventListener("click", () => {
  if (isAdmin) page("admin");
  else showMessage("শুধু Admin প্রবেশ করতে পারবে", true);
});

// AUTH STATE
onAuthStateChanged(auth, async user => {
  currentUser = user;
  isAdmin = false;

  if (user) {
    const userSnap = await getDoc(doc(db, "users", user.uid));

    if (userSnap.exists()) {
      isAdmin = userSnap.data().role === "admin";
    }

    if ($("#session")) {
      $("#session").textContent =
        user.displayName || user.email;
    }

    if ($("#drawerAdmin")) {
      $("#drawerAdmin").style.display =
        isAdmin ? "block" : "none";
    }

    if ($("#logout")) $("#logout").style.display = "block";

    await loadTournaments();
    await loadPlayerData();

    if (isAdmin) await loadAdminData();

  } else {
    if ($("#session")) $("#session").textContent = "Guest";
    if ($("#logout")) $("#logout").style.display = "none";
    if ($("#drawerAdmin")) $("#drawerAdmin").style.display = "none";

    currentBalance = 0;
    if ($("#balance")) $("#balance").textContent = "৳0";
    await loadTournaments();
  }
});

// LOAD TOURNAMENTS
async function loadTournaments() {
  try {
    const q = query(
      collection(db, "tournaments"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    const tournaments = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    const html = tournaments.map(t => `
      <div class="tournament-card">
        <h3>${escapeHTML(t.title)}</h3>
        <p>Mode: ${escapeHTML(t.mode || "")}</p>
        <p>Entry Fee: ৳${Number(t.entryFee || 0)}</p>
        <p>Prize: ৳${Number(t.prizePool || 0)}</p>
        <p>Players: ${Number(t.joined || 0)}/${Number(t.slots || 0)}</p>
        <p>Start: ${t.startsAt ? escapeHTML(new Date(t.startsAt).toLocaleString("bn-BD")) : "TBA"}</p>
        <button type="button" onclick="joinTournament('${t.id}')">
          Join Tournament
        </button>
      </div>
    `).join("");

    if ($("#tournamentList")) {
      $("#tournamentList").innerHTML =
        html || "<p>কোনো Tournament নেই।</p>";
    }

    if ($("#homeTournamentList")) {
      $("#homeTournamentList").innerHTML =
        html || "<p>কোনো Tournament নেই।</p>";
    }

    if ($("#tournamentSelect")) {
      $("#tournamentSelect").innerHTML =
        '<option value="">Tournament নির্বাচন করুন</option>' +
        tournaments.map(t =>
          `<option value="${t.id}">${escapeHTML(t.title)}</option>`
        ).join("");
    }

  } catch (error) {
    console.error("Tournament load:", error);
  }
}

// JOIN TOURNAMENT
window.joinTournament = async function(tournamentId) {
  if (!currentUser) {
    showMessage("প্রথমে Login করুন।", true);
    page("account");
    return;
  }

  const tournamentSnap = await getDoc(
    doc(db, "tournaments", tournamentId)
  );

  if (!tournamentSnap.exists()) {
    showMessage("Tournament পাওয়া যায়নি।", true);
    return;
  }

  const t = tournamentSnap.data();

  if (Number(t.joined || 0) >= Number(t.slots || 0)) {
    showMessage("Tournament-এর Slot পূর্ণ!", true);
    return;
  }

  const existing = await getDocs(query(
    collection(db, "registrations"),
    where("userId", "==", currentUser.uid),
    where("tournamentId", "==", tournamentId)
  ));

  if (!existing.empty) {
    showMessage("তুমি ইতিমধ্যে আবেদন করেছ।", true);
    return;
  }

  $("#registrationForm")?.querySelector('[name="tournamentId"]') &&
    ($("#registrationForm").querySelector('[name="tournamentId"]').value = tournamentId);

  page("myMatches");
  showMessage("Registration Form পূরণ করে Submit করো।");
};

// REGISTRATION FORM
$("#registrationForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentUser) {
    showMessage("প্রথমে Login করো।", true);
    return;
  }

  const f = Object.fromEntries(new FormData(e.target));

  try {
    await addDoc(collection(db, "registrations"), {
      userId: currentUser.uid,
      tournamentId: f.tournamentId,
      playerName: f.playerName,
      uid: f.uid,
      teamName: f.teamName || "",
      status: "pending",
      createdAt: serverTimestamp()
    });

    showMessage("Registration জমা হয়েছে। Admin Approve করলে Join হবে।");
    e.target.reset();
    await loadPlayerData();

  } catch (error) {
    showMessage(error.message, true);
  }
});

// LOAD PLAYER DATA
async function loadPlayerData() {
  if (!currentUser) return;

  try {
    const paymentSnap = await getDocs(query(
      collection(db, "paymentRequests"),
      where("userId", "==", currentUser.uid)
    ));

    let balance = 0;

    paymentSnap.forEach(d => {
      const p = d.data();

      if (p.status === "approved") {
        if (p.type === "deposit") balance += Number(p.amount || 0);
        else balance -= Number(p.amount || 0);
      }
    });

    currentBalance = balance;

    if ($("#balance")) {
      $("#balance").textContent = "৳" + balance.toFixed(2);
    }

    const registrations = await getDocs(query(
      collection(db, "registrations"),
      where("userId", "==", currentUser.uid)
    ));

    if ($("#myMatchesList")) {
      $("#myMatchesList").innerHTML =
        registrations.docs.map(d => {
          const r = d.data();

          return `
            <div class="match-card">
              <p>Tournament ID: ${escapeHTML(r.tournamentId)}</p>
              <p>Player: ${escapeHTML(r.playerName)}</p>
              <p>Status: ${escapeHTML(r.status)}</p>
            </div>
          `;
        }).join("") || "<p>কোনো Match নেই।</p>";
    }

  } catch (error) {
    console.error("Player data:", error);
  }
}

// ===================================
// WALLET - DEPOSIT REQUEST
// ===================================

$("#paymentForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentUser) {
    showMessage("প্রথমে Login করো।", true);
    return;
  }

  const f = Object.fromEntries(new FormData(e.target));
  const amount = Number(f.amount);

  if (f.type !== "deposit") {
    showMessage("Withdraw এখনো চালু হয়নি।", true);
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    showMessage("সঠিক Amount লিখো।", true);
    return;
  }

  if (!f.reference || !f.method) {
    showMessage("সব তথ্য পূরণ করো।", true);
    return;
  }

  try {
    await addDoc(collection(db, "paymentRequests"), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      type: "deposit",
      amount,
      method: f.method,
      reference: f.reference.trim(),
      status: "pending",
      createdAt: serverTimestamp()
    });

    showMessage("Deposit Request জমা হয়েছে। Admin যাচাই করবে।");
    e.target.reset();
    await loadPlayerData();

  } catch (error) {
    showMessage(error.message, true);
  }
});


// ===================================
// ADMIN CHECK
// ===================================

async function checkAdmin() {
  if (!currentUser) return false;

  const snap = await getDoc(doc(db, "users", currentUser.uid));

  return snap.exists() && snap.data().role === "admin";
}


// ===================================
// ADMIN DASHBOARD
// ===================================

async function loadAdminData() {
  if (!(await checkAdmin())) return;

  try {
    const paymentSnap = await getDocs(query(
      collection(db, "paymentRequests"),
      where("status", "==", "pending")
    ));

    if ($("#adminPayments")) {
      $("#adminPayments").innerHTML =
        paymentSnap.docs.map(d => {
          const p = d.data();

          return `
            <div class="admin-card">
              <p>Type: ${escapeHTML(p.type)}</p>
              <p>Amount: ৳${Number(p.amount || 0)}</p>
              <p>Method: ${escapeHTML(p.method || "")}</p>
              <p>Reference: ${escapeHTML(p.reference || "")}</p>
              <button type="button" onclick="reviewPayment('${d.id}','approved')">
                Approve
              </button>
              <button type="button" onclick="reviewPayment('${d.id}','rejected')">
                Reject
              </button>
            </div>
          `;
        }).join("") || "<p>কোনো Pending Payment নেই।</p>";
    }

    const registrationSnap = await getDocs(query(
      collection(db, "registrations"),
      where("status", "==", "pending")
    ));

    if ($("#adminRegistrations")) {
      $("#adminRegistrations").innerHTML =
        registrationSnap.docs.map(d => {
          const r = d.data();

          return `
            <div class="admin-card">
              <p>Player: ${escapeHTML(r.playerName)}</p>
              <p>UID: ${escapeHTML(r.uid)}</p>
              <p>Team: ${escapeHTML(r.teamName || "")}</p>
              <p>Tournament: ${escapeHTML(r.tournamentId)}</p>
              <button type="button" onclick="approveRegistration('${d.id}')">
                Approve
              </button>
              <button type="button" onclick="rejectRegistration('${d.id}')">
                Reject
              </button>
            </div>
          `;
        }).join("") || "<p>কোনো Pending Registration নেই।</p>";
    }

  } catch (error) {
    console.error("Admin dashboard:", error);
    showMessage(error.message, true);
  }
}


// ===================================
// APPROVE / REJECT PAYMENT
// ===================================

window.reviewPayment = async function(paymentId, status) {
  if (!(await checkAdmin())) {
    showMessage("Admin permission নেই।", true);
    return;
  }

  if (!["approved", "rejected"].includes(status)) return;

  try {
    const paymentRef = doc(db, "paymentRequests", paymentId);
    const paymentSnap = await getDoc(paymentRef);

    if (!paymentSnap.exists()) {
      showMessage("Payment পাওয়া যায়নি।", true);
      return;
    }

    const p = paymentSnap.data();

    if (p.status !== "pending") {
      showMessage("এই Payment আগে Review করা হয়েছে।", true);
      return;
    }

    if (p.type !== "deposit") {
      showMessage("এই Payment Type সমর্থিত নয়।", true);
      return;
    }

    await updateDoc(paymentRef, {
      status,
      reviewedAt: serverTimestamp(),
      reviewedBy: currentUser.uid
    });

    showMessage(
      status === "approved"
        ? "Payment Approve হয়েছে!"
        : "Payment Reject হয়েছে!"
    );

    await loadAdminData();
    await loadPlayerData();

  } catch (error) {
    showMessage(error.message, true);
  }
};


// ===================================
// APPROVE REGISTRATION
// ===================================

window.approveRegistration = async function(registrationId) {
  if (!(await checkAdmin())) {
    showMessage("Admin permission নেই।", true);
    return;
  }

  try {
    const registrationRef = doc(db, "registrations", registrationId);
    const registrationSnap = await getDoc(registrationRef);

    if (!registrationSnap.exists()) {
      showMessage("Registration পাওয়া যায়নি।", true);
      return;
    }

    const registration = registrationSnap.data();

    if (registration.status !== "pending") {
      showMessage("Registration আগে Review করা হয়েছে।", true);
      return;
    }

    const tournamentRef = doc(
      db,
      "tournaments",
      registration.tournamentId
    );

    const tournamentSnap = await getDoc(tournamentRef);

    if (!tournamentSnap.exists()) {
      showMessage("Tournament পাওয়া যায়নি।", true);
      return;
    }

    const tournament = tournamentSnap.data();
    const fee = Number(tournament.entryFee || 0);

    const paymentsSnap = await getDocs(query(
      collection(db, "paymentRequests"),
      where("userId", "==", registration.userId)
    ));

    let balance = 0;

    paymentsSnap.forEach(d => {
      const p = d.data();

      if (p.status === "approved") {
        if (p.type === "deposit") balance += Number(p.amount || 0);
        else balance -= Number(p.amount || 0);
      }
    });

    if (balance < fee) {
      showMessage("Player-এর Wallet Balance পর্যাপ্ত নয়।", true);
      return;
    }

    await runTransaction(db, async transaction => {
      const latestRegistration = await transaction.get(registrationRef);
      const latestTournament = await transaction.get(tournamentRef);

      if (!latestRegistration.exists() || !latestTournament.exists()) {
        throw new Error("Registration অথবা Tournament পাওয়া যায়নি।");
      }

      if (latestRegistration.data().status !== "pending") {
        throw new Error("Registration ইতিমধ্যে Review হয়েছে।");
      }

      const latestTournamentData = latestTournament.data();

      if (Number(latestTournamentData.joined || 0) >= Number(latestTournamentData.slots || 0)) {
        throw new Error("Tournament Slot পূর্ণ হয়ে গেছে।");
      }

      transaction.update(registrationRef, {
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedBy: currentUser.uid
      });

      transaction.update(tournamentRef, {
        joined: Number(latestTournamentData.joined || 0) + 1
      });

      if (fee > 0) {
        const debitRef = doc(collection(db, "paymentRequests"));

        transaction.set(debitRef, {
          userId: registration.userId,
          type: "tournament_fee",
          amount: fee,
          status: "approved",
          tournamentId: registration.tournamentId,
          reference: "Tournament Entry Fee",
          createdAt: serverTimestamp(),
          reviewedBy: currentUser.uid
        });
      }
    });

    showMessage("Registration Approve হয়েছে!");
    await loadAdminData();
    await loadPlayerData();

  } catch (error) {
    showMessage(error.message, true);
  }
};


// ===================================
// REJECT REGISTRATION
// ===================================

window.rejectRegistration = async function(registrationId) {
  if (!(await checkAdmin())) {
    showMessage("Admin permission নেই।", true);
    return;
  }

  try {
    await updateDoc(
      doc(db, "registrations", registrationId),
      {
        status: "rejected",
        reviewedAt: serverTimestamp(),
        reviewedBy: currentUser.uid
      }
    );

    showMessage("Registration Reject হয়েছে!");
    await loadAdminData();

  } catch (error) {
    showMessage(error.message, true);
  }
};


// ===================================
// CREATE TOURNAMENT
// ===================================

$("#createTournament")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!(await checkAdmin())) {
    showMessage("শুধু Admin Tournament তৈরি করতে পারবে।", true);
    return;
  }

  const f = Object.fromEntries(new FormData(e.target));

  try {
    await addDoc(collection(db, "tournaments"), {
      title: f.title,
      mode: f.mode,
      description: f.description || "",
      entryFee: Number(f.entryFee || 0),
      prizePool: Number(f.prizePool || 0),
      slots: Number(f.slots || 0),
      joined: 0,
      startsAt: f.startsAt
        ? new Date(f.startsAt).toISOString()
        : "",
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });

    showMessage("Tournament তৈরি হয়েছে!");
    e.target.reset();

    await loadTournaments();
    await loadAdminData();

  } catch (error) {
    showMessage(error.message, true);
  }
});


// ===================================
// PUBLISH RESULT
// ===================================

$("#resultForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!(await checkAdmin())) {
    showMessage("শুধু Admin Result Publish করতে পারবে।", true);
    return;
  }

  const f = Object.fromEntries(new FormData(e.target));

  try {
    await addDoc(collection(db, "results"), {
      player: f.player,
      placement: Number(f.placement || 0),
      points: Number(f.points || 0),
      tournamentId: f.tournamentId,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });

    showMessage("Result Publish হয়েছে!");
    e.target.reset();

    await loadLeaderboard();

  } catch (error) {
    showMessage(error.message, true);
  }
});


// ===================================
// LEADERBOARD
// ===================================

async function loadLeaderboard() {
  try {
    const snapshot = await getDocs(query(
      collection(db, "results"),
      orderBy("points", "desc")
    ));

    if ($("#leaderboardRows")) {
      $("#leaderboardRows").innerHTML =
        snapshot.docs.map((d, index) => {
          const r = d.data();

          return `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHTML(r.player)}</td>
              <td>${Number(r.placement || 0)}</td>
              <td>${Number(r.points || 0)}</td>
            </tr>
          `;
        }).join("") || "<tr><td colspan='4'>কোনো Result নেই।</td></tr>";
    }

  } catch (error) {
    console.error("Leaderboard:", error);
  }
}


// ===================================
// INITIAL LOAD
// ===================================

loadTournaments();
loadLeaderboard();
