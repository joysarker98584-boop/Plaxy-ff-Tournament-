
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
  serverTimestamp,
  updateDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// ==================================
// FIREBASE CONFIG
// ==================================

const firebaseConfig = {
  apiKey: "AIzaSyBKOUb6yOmDKN6h5lnaZuZvFXUAnEc4fT0",
  authDomain: "arenax-free-fire-tournament.firebaseapp.com",
  projectId: "arenax-free-fire-tournament",
  storageBucket: "arenax-free-fire-tournament.firebasestorage.app",
  messagingSenderId: "462385161284",
  appId: "1:462385161284:web:158efb7659bb350f6c0811",
  measurementId: "G-Q0BR3YKYEZ"
};

const PAYMENT_NUMBER = "01346022330";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = selector => document.querySelector(selector);

let currentUser = null;
let isAdmin = false;
let tournaments = [];

// ==================================
// HELPER FUNCTIONS
// ==================================

const money = amount =>
  "৳ " + Number(amount || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

const formData = form =>
  Object.fromEntries(new FormData(form).entries());

function message(text, bad = false) {
  const el = $("#message");

  if (!el) {
    alert(text);
    return;
  }

  el.textContent = text;
  el.classList.remove("hide");
  el.style.borderColor = bad ? "#a84d4d" : "#40516e";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function page(name) {
  document.querySelectorAll(".page").forEach(el => {
    el.classList.toggle("active", el.id === `page-${name}`);
  });

  document.querySelectorAll("[data-page]").forEach(el => {
    el.classList.toggle("active", el.dataset.page === name);
  });

  closeDrawer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeDrawer() {
  $("#drawer")?.classList.remove("open");
  $("#scrim")?.classList.remove("show");
}

// ==================================
// NAVIGATION
// ==================================

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    page(button.dataset.page);
  });
});

$("#menuToggle")?.addEventListener("click", () => {
  $("#drawer")?.classList.add("open");
  $("#scrim")?.classList.add("show");
});

$("#drawerClose")?.addEventListener("click", closeDrawer);
$("#scrim")?.addEventListener("click", closeDrawer);

// ==================================
// COPY PAYMENT NUMBER
// ==================================

$("#copyNumber")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(PAYMENT_NUMBER);
    message("পেমেন্ট নম্বর কপি হয়েছে।");
  } catch {
    message("পেমেন্ট নম্বর: " + PAYMENT_NUMBER);
  }
});

// ==================================
// ADMIN ROLE CHECK
// ==================================

async function getRole(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));

  return snapshot.exists()
    ? snapshot.data().role
    : "player";
}

// ==================================
// TOURNAMENT CARD
// ==================================

function matchCard(tournament) {
  const joined = Number(tournament.joined || 0);

  return `
    <article class="match-card">

      <div class="match-banner">
        ARENA X • ${esc(tournament.mode || "MATCH")}
      </div>

      <span class="tag">
        ${esc(tournament.mode || "Solo")} MATCH
      </span>

      <h3>${esc(tournament.title)}</h3>

      <p class="muted">
        ${esc(tournament.description || "ArenaX tournament")}
      </p>

      <div class="prize">
        ${money(tournament.prizePool)}
      </div>

      <div class="meta">
        <div>
          ENTRY FEE
          <b>${money(tournament.entryFee)}</b>
        </div>

        <div>
          SLOTS
          <b>${joined}/${Number(tournament.slots || 0)}</b>
        </div>

        <div>
          STATUS
          <b>${esc(tournament.status || "open")}</b>
        </div>

        <div>
          STARTS
          <b>${tournament.startsAt
            ? esc(new Date(tournament.startsAt).toLocaleString("bn-BD"))
            : "TBA"}</b>
        </div>
      </div>

      <button
        class="btn primary join-btn"
        data-id="${esc(tournament.id)}">
        ম্যাচে Join করো
      </button>

    </article>
  `;
}

// ==================================
// LOAD TOURNAMENTS
// ==================================

async function loadTournaments() {
  const snapshot = await getDocs(
    query(
      collection(db, "tournaments"),
      orderBy("createdAt", "desc")
    )
  );

  tournaments = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(t => t.status !== "hidden");

  const html = tournaments.length
    ? tournaments.map(matchCard).join("")
    : '<div class="panel">এখনো কোনো Tournament Publish করা হয়নি।</div>';

  if ($("#tournamentList")) {
    $("#tournamentList").innerHTML = html;
  }

  if ($("#homeTournamentList")) {
    $("#homeTournamentList").innerHTML =
      tournaments.slice(0, 2).map(matchCard).join("") ||
      '<div class="panel">নতুন Tournament শিগগিরই আসছে।</div>';
  }

  if ($("#tournamentSelect")) {
    $("#tournamentSelect").innerHTML =
      '<option value="">টুর্নামেন্ট বেছে নাও</option>' +
      tournaments
        .filter(t => t.status === "open")
        .map(t => `
          <option value="${esc(t.id)}">
            ${esc(t.title)} — ${esc(t.mode)}
          </option>
        `).join("");
  }

  document.querySelectorAll(".join-btn").forEach(button => {
    button.addEventListener("click", () => {
      if (!currentUser) {
        message("আগে Login করো।", true);
        page("login");
        return;
      }

      page("myMatches");

      if ($("#tournamentSelect")) {
        $("#tournamentSelect").value = button.dataset.id;
      }
    });
  });
}

// ==================================
// LOAD PLAYER INFORMATION
// ==================================

async function loadPlayer() {
  if (!currentUser) {
    if ($("#balance")) {
      $("#balance").textContent = money(0);
    }

    if ($("#paymentRows")) {
      $("#paymentRows").innerHTML =
        '<tr><td colspan="4">Login করলে দেখা যাবে।</td></tr>';
    }

    if ($("#myMatchesList")) {
      $("#myMatchesList").textContent =
        "ম্যাচ দেখতে Login করো।";
    }

    return;
  }

  const [paymentSnapshot, registrationSnapshot] =
    await Promise.all([
      getDocs(query(
        collection(db, "paymentRequests"),
        where("userId", "==", currentUser.uid)
      )),

      getDocs(query(
        collection(db, "registrations"),
        where("userId", "==", currentUser.uid)
      ))
    ]);

  const payments = paymentSnapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) =>
      (b.createdAt?.seconds || 0) -
      (a.createdAt?.seconds || 0)
    );

  const balance = payments
    .filter(p => p.status === "approved")
    .reduce((sum, p) => {
      const amount = Number(p.amount || 0);

      return sum + (
        p.type === "deposit"
          ? amount
          : -amount
      );
    }, 0);

  if ($("#balance")) {
    $("#balance").textContent = money(balance);
  }

  if ($("#paymentRows")) {
    $("#paymentRows").innerHTML = payments.length
      ? payments.map(p => `
          <tr>
            <td>${esc(p.type)}</td>
            <td>${money(p.amount)}</td>
            <td>${esc(p.method)}</td>
            <td class="status">${esc(p.status)}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="4">এখনো কোনো লেনদেন নেই।</td></tr>';
  }

  const registrations = registrationSnapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  if ($("#myMatchesList")) {
    $("#myMatchesList").innerHTML = registrations.length
      ? registrations.map(r => `
          <div class="match-card">
            <b>${esc(r.tournamentTitle)}</b>

            <p class="muted">
              Player: ${esc(r.playerName)}
              • UID: ${esc(r.uid)}
            </p>

            <p class="status">
              Status: ${esc(r.status)}
            </p>
          </div>
        `).join("")
      : "তুমি এখনো কোনো ম্যাচে Registration করোনি।";
  }
}

// ==================================
// LEADERBOARD
// ==================================

async function loadLeaderboard() {
  const snapshot = await getDocs(
    query(
      collection(db, "results"),
      orderBy("placement", "asc")
    )
  );

  const rows = snapshot.docs.map(d => d.data());

  if ($("#leaderboardRows")) {
    $("#leaderboardRows").innerHTML = rows.length
      ? rows.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${esc(r.player)}</td>
            <td>${esc(r.placement)}</td>
            <td>${esc(r.points)}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="4">এখনো ফলাফল প্রকাশ হয়নি।</td></tr>';
  }
}

// ==================================
// SIGNUP
// ==================================

$("#signup")?.addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.currentTarget;
  const f = formData(form);

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

    message("অ্যাকাউন্ট তৈরি হয়েছে।");
    form.reset();

  } catch (error) {
    console.error(error);
    message(error.message, true);
  }
});

// ==================================
// LOGIN
// ==================================

$("#login")?.addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.currentTarget;
  const f = formData(form);

  try {
    await signInWithEmailAndPassword(
      auth,
      f.email,
      f.password
    );

    message("Login সফল হয়েছে।");
    form.reset();

  } catch (error) {
    message(error.message, true);
  }
});

// ==================================
// LOGOUT
// ==================================

$("#logout")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    message("Logout হয়েছে।");
  } catch (error) {
    message(error.message, true);
  }
});

// ==================================
// PLAYER JOIN REQUEST
// ==================================

$("#registrationForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.currentTarget;

  if (!currentUser) {
    return message("আগে Login করো।", true);
  }

  const f = formData(form);

  const tournament = tournaments.find(
    t => t.id === f.tournamentId
  );

  if (!tournament) {
    return message("টুর্নামেন্ট বেছে নাও।", true);
  }

  if (tournament.status !== "open") {
    return message("এই Tournament এখন বন্ধ।", true);
  }

  if (!f.playerName || !f.uid) {
    return message("Player Name ও Game UID দাও।", true);
  }

  const registrationId =
    `${tournament.id}_${currentUser.uid}`;

  const registrationRef =
    doc(db, "registrations", registrationId);

  try {
    await runTransaction(db, async transaction => {
      const existing = await transaction.get(registrationRef);

      if (existing.exists()) {
        const oldStatus = existing.data().status;

        if (oldStatus !== "rejected") {
          throw new Error(
            "তুমি ইতিমধ্যে এই Tournament-এর Request পাঠিয়েছো।"
          );
        }
      }

      transaction.set(registrationRef, {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        tournamentId: tournament.id,
        tournamentTitle: tournament.title,
        playerName: f.playerName,
        uid: f.uid,
        teamName: f.teamName || "",
        status: "pending",
        entryFee: Number(tournament.entryFee || 0),
        createdAt: serverTimestamp()
      });
    });

    message(
      "Join Request পাঠানো হয়েছে। Admin Approve করলে Entry Fee কাটা হবে।"
    );

    form.reset();

    await loadPlayer();
    await loadAdmin();

  } catch (error) {
    console.error(error);
    message(error.message, true);
  }
});

// ==================================
// ADMIN APPROVE REGISTRATION
// ==================================

// সতর্কতা:
// Payment History Query Transaction-এর বাইরে পড়া হচ্ছে,
// তাই এটি Production-এর নিরাপদ Wallet পদ্ধতি নয়।

async function approveRegistration(registrationId) {
  if (!currentUser || !isAdmin) {
    return message("শুধু Admin Approve করতে পারবেন।", true);
  }

  try {
    const registrationRef = doc(
      db, "registrations", registrationId
    );

    // প্রথমে Registration পড়ি
    const firstSnapshot = await getDoc(registrationRef);

    if (!firstSnapshot.exists()) {
      throw new Error("Registration পাওয়া যায়নি।");
    }

    const firstData = firstSnapshot.data();

    if (!firstData.userId || !firstData.tournamentId) {
      throw new Error("Registration-এর তথ্য অসম্পূর্ণ।");
    }

    // Payment History Transaction-এর বাইরে পড়া
    const paymentQuery = query(
      collection(db, "paymentRequests"),
      where("userId", "==", firstData.userId)
    );

    const paymentSnapshot = await getDocs(paymentQuery);

    // নতুন Payment Document
    const paymentRef = doc(
      collection(db, "paymentRequests")
    );

    await runTransaction(db, async transaction => {

      // Registration পুনরায় যাচাই
      const registrationSnapshot =
        await transaction.get(registrationRef);

      if (!registrationSnapshot.exists()) {
        throw new Error("Registration পাওয়া যায়নি।");
      }

      const registration = registrationSnapshot.data();

      if (registration.status !== "pending") {
        throw new Error("এই Request আগে Process করা হয়েছে।");
      }

      // Tournament পড়া
      const tournamentRef = doc(
        db, "tournaments", registration.tournamentId
      );

      const tournamentSnapshot =
        await transaction.get(tournamentRef);

      if (!tournamentSnapshot.exists()) {
        throw new Error("Tournament পাওয়া যায়নি।");
      }

      const tournament = tournamentSnapshot.data();

      if (tournament.status !== "open") {
        throw new Error("Tournament এখন Open নেই।");
      }

      const fee = Number(tournament.entryFee || 0);
      const joined = Number(tournament.joined || 0);
      const slots = Number(tournament.slots || 0);

      if (!Number.isFinite(fee) || fee < 0) {
        throw new Error("Entry Fee সঠিক নয়।");
      }

      if (!Number.isFinite(slots) || slots <= 0) {
        throw new Error("Tournament Slot সঠিক নয়।");
      }

      if (joined >= slots) {
        throw new Error("Tournament-এর সব Slot পূর্ণ।");
      }

      // Wallet Balance হিসাব
      let balance = 0;

      paymentSnapshot.forEach(d => {
        const p = d.data();

        if (p.status !== "approved") return;

        const amount = Number(p.amount || 0);

        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error("Payment History-তে ভুল Amount আছে।");
        }

        if (p.type === "deposit") {
          balance += amount;
        } else {
          balance -= amount;
        }
      });

      if (balance < fee) {
        throw new Error(
          `Wallet-এ পর্যাপ্ত টাকা নেই। প্রয়োজন ${money(fee)}, আছে ${money(balance)}।`
        );
      }

      // Entry Fee Debit Record
      transaction.set(paymentRef, {
        userId: registration.userId,
        userEmail: registration.userEmail || "",
        type: "tournament_fee",
        amount: fee,
        method: "Wallet",
        reference: `Tournament: ${registration.tournamentId}`,
        tournamentId: registration.tournamentId,
        registrationId: registrationId,
        status: "approved",
        reviewedBy: currentUser.uid,
        createdAt: serverTimestamp()
      });

      // Registration Approve
      transaction.update(registrationRef, {
        status: "approved",
        approvedAt: serverTimestamp(),
        reviewedBy: currentUser.uid
      });

      // Tournament Slot Update
      transaction.update(tournamentRef, {
        joined: joined + 1
      });
    });

    message(
      "Registration Approved হয়েছে এবং Entry Fee-এর Debit Record তৈরি হয়েছে।"
    );

    await loadAdmin();
    await loadPlayer();
    await loadTournaments();

  } catch (error) {
    console.error("Approve error:", error);
    message("Approve হয়নি: " + error.message, true);
  }
}

// ==================================
// ADMIN REJECT REGISTRATION
// ==================================

async function rejectRegistration(registrationId) {
  if (!currentUser || !isAdmin) {
    return message("Admin access প্রয়োজন।", true);
  }

  try {
    const registrationRef =
      doc(db, "registrations", registrationId);

    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(registrationRef);

      if (!snapshot.exists()) {
        throw new Error("Registration পাওয়া যায়নি।");
      }

      if (snapshot.data().status !== "pending") {
        throw new Error("এই Request আগে Process করা হয়েছে।");
      }

      transaction.update(registrationRef, {
        status: "rejected",
        reviewedAt: serverTimestamp(),
        reviewedBy: currentUser.uid
      });
    });

    message("Registration Reject করা হয়েছে।");

    await loadAdmin();
    await loadPlayer();

  } catch (error) {
    console.error(error);
    message(error.message, true);
  }
}

// ==================================
// ADMIN PAYMENT APPROVE / REJECT
// ==================================

async function reviewPayment(paymentId, status) {
  if (!currentUser || !isAdmin) {
    return message("Admin access প্রয়োজন।", true);
  }

  if (!["approved", "rejected"].includes(status)) {
    return message("Payment Status সঠিক নয়।", true);
  }

  try {
    const paymentRef = doc(
      db, "paymentRequests", paymentId
    );

    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(paymentRef);

      if (!snapshot.exists()) {
        throw new Error("Payment Request পাওয়া যায়নি।");
      }

      const payment = snapshot.data();

      if (payment.status !== "pending") {
        throw new Error("এই Payment আগে Process করা হয়েছে।");
      }

      if (payment.type !== "deposit") {
        throw new Error("এই Payment Request Deposit নয়।");
      }

      transaction.update(paymentRef, {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: currentUser.uid
      });
    });

    message("Payment " + status + " হয়েছে।");

    await loadAdmin();
    await loadPlayer();

  } catch (error) {
    console.error(error);
    message(error.message, true);
  }
}

// ==================================
// ADMIN DASHBOARD
// ==================================

async function loadAdmin() {
  if (!isAdmin) return;

  const [paymentSnapshot, registrationSnapshot] =
    await Promise.all([
      getDocs(query(
        collection(db, "paymentRequests"),
        where("status", "==", "pending")
      )),

      getDocs(query(
        collection(db, "registrations"),
        where("status", "==", "pending")
      ))
    ]);

  // Pending Payments
  if ($("#adminPayments")) {
    $("#adminPayments").innerHTML =
      paymentSnapshot.empty
        ? '<tr><td colspan="3">কোনো Pending Payment নেই।</td></tr>'
        : paymentSnapshot.docs.map(d => {
            const p = d.data();

            return `
              <tr>
                <td>${esc(p.userEmail || p.userId)}</td>

                <td>
                  ${esc(p.type)}<br>
                  ${money(p.amount)}<br>
                  ${esc(p.method)}<br>
                  Ref: ${esc(p.reference)}
                </td>

                <td>
                  <button class="action-btn"
                    data-pay="${esc(d.id)}"
                    data-status="approved">
                    Approve
                  </button>

                  <button class="action-btn"
                    data-pay="${esc(d.id)}"
                    data-status="rejected">
                    Reject
                  </button>
                </td>
              </tr>
            `;
          }).join("");
  }

  // Pending Registrations
  if ($("#adminRegistrations")) {
    $("#adminRegistrations").innerHTML =
      registrationSnapshot.empty
        ? '<tr><td colspan="4">কোনো Pending Registration নেই।</td></tr>'
        : registrationSnapshot.docs.map(d => {
            const r = d.data();

            return `
              <tr>
                <td>${esc(r.playerName)}</td>
                <td>${esc(r.uid)}</td>

                <td>
                  ${esc(r.tournamentTitle)}<br>
                  Entry Fee: ${money(r.entryFee)}
                </td>

                <td>
                  <button class="action-btn"
                    data-reg="${esc(d.id)}"
                    data-status="approved">
                    Approve
                  </button>

                  <button class="action-btn"
                    data-reg="${esc(d.id)}"
                    data-status="rejected">
                    Reject
                  </button>
                </td>
              </tr>
            `;
          }).join("");
  }
}

// ==================================
// ADMIN BUTTON EVENTS
// ==================================

document.addEventListener("click", async event => {
  const button = event.target.closest(
    "[data-pay], [data-reg]"
  );

  if (!button) return;

  if (!isAdmin) {
    return message("Admin access প্রয়োজন।", true);
  }

  if (button.dataset.pay) {
    await reviewPayment(
      button.dataset.pay,
      button.dataset.status
    );
  }

  if (button.dataset.reg) {
    if (button.dataset.status === "approved") {
      const confirmed = confirm(
        "এই Player-এর Wallet থেকে Entry Fee কেটে Approve করবেন?"
      );

      if (!confirmed) return;

      await approveRegistration(button.dataset.reg);

    } else {
      const confirmed = confirm(
        "এই Registration Reject করবেন?"
      );

      if (!confirmed) return;

      await rejectRegistration(button.dataset.reg);
    }
  }
});

// ==================================
// PLAYER PAYMENT REQUEST
// ==================================

$("#paymentForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentUser) {
    return message("আগে Login করো।", true);
  }

  const form = e.currentTarget;
  const f = formData(form);
  const amount = Number(f.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return message("সঠিক Amount লিখো।", true);
  }

  if (!f.reference || !f.method) {
    return message("Payment Method ও Transaction ID দাও।", true);
  }

  try {
    await addDoc(collection(db, "paymentRequests"), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      type: "deposit",
      amount,
      method: f.method,
      reference: f.reference,
      status: "pending",
      createdAt: serverTimestamp()
    });

    message("Deposit Request পাঠানো হয়েছে। Admin Review করবেন।");

    form.reset();

    await loadPlayer();
    await loadAdmin();

  } catch (error) {
    console.error(error);
    message(error.message, true);
  }
});

// ==================================
// ADMIN CREATE TOURNAMENT
// ==================================

$("#tournamentForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentUser || !isAdmin) {
    return message("শুধু Admin Tournament তৈরি করতে পারবেন।", true);
  }

  const form = e.currentTarget;
  const f = formData(form);

  const entryFee = Number(f.entryFee || 0);
  const prizePool = Number(f.prizePool || 0);
  const slots = Number(f.slots || 0);

  if (
    !Number.isFinite(entryFee) ||
    entryFee < 0 ||
    !Number.isFinite(prizePool) ||
    prizePool < 0 ||
    !Number.isInteger(slots) ||
    slots < 1
  ) {
    return message("Tournament-এর Fee, Prize ও Slots সঠিকভাবে দাও।", true);
  }

  try {
    await addDoc(collection(db, "tournaments"), {
      title: f.title,
      mode: f.mode,
      description: f.description || "",
      entryFee,
      prizePool,
      slots,
      joined: 0,
      startsAt: f.startsAt || "",
      status: "open",
      createdBy: currentUser.uid,
      createdAt: serverTimestamp()
    });

    message("Tournament তৈরি হয়েছে।");

    form.reset();

    await loadTournaments();
    await loadAdmin();

  } catch (error) {
    console.error(error);
    message(error.message, true);
  }
});

// ==================================
// ADMIN PUBLISH RESULT
// ==================================

$("#resultForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentUser || !isAdmin) {
    return message("শুধু Admin Result Publish করতে পারবেন।", true);
  }

  const form = e.currentTarget;
  const f = formData(form);

  const placement = Number(f.placement);
  const points = Number(f.points);

  if (
    !f.player ||
    !f.tournamentId ||
    !Number.isInteger(placement) ||
    placement < 1 ||
    !Number.isFinite(points) ||
    points < 0
  ) {
    return message("Result-এর তথ্য সঠিকভাবে পূরণ করো।", true);
  }

  try {
    await addDoc(collection(db, "results"), {
      player: f.player,
      placement,
      points,
      tournamentId: f.tournamentId,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp()
    });

    message("Result Publish হয়েছে।");

    form.reset();

    await loadLeaderboard();

  } catch (error) {
    console.error(error);
    message(error.message, true);
  }
});

// ==================================
// AUTH STATE
// ==================================

onAuthStateChanged(auth, async user => {
  currentUser = user;
  isAdmin = false;

  try {
    if (user) {
      isAdmin = (await getRole(user.uid)) === "admin";
    }

    const session = $("#session");

    if (session) {
      session.textContent = user
        ? `Logged in: ${user.displayName || user.email}`
        : "Guest";
    }

    $("#topLogin")?.classList.toggle("hide", !!user);
    $("#topSignup")?.classList.toggle("hide", !!user);

    $("#logout")?.classList.toggle("hide", !user);
    $("#drawerAdmin")?.classList.toggle("hide", !isAdmin);

    $("#adminNav")?.classList.toggle("hide", !isAdmin);

    if (isAdmin) {
      page("admin");
    } else if (user) {
      page("home");
    }

    await Promise.all([
      loadTournaments(),
      loadPlayer(),
      loadLeaderboard()
    ]);

    if (isAdmin) {
      await loadAdmin();
    }

  } catch (error) {
    console.error("Auth state error:", error);
    message("লোড করতে সমস্যা হয়েছে: " + error.message, true);
  }
});

// ==================================
// APP.JS COMPLETE
// ==================================
