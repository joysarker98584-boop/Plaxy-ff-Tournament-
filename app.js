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
  writeBatch,
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

let currentUser = null;
let isAdmin = false;
let tournamentCache = [];

const $ = (selector) => document.querySelector(selector);

// TOURNAMENT BANNER STYLE (responsive + fallback)
(function ensureTournamentBannerStyles() {
  if (document.getElementById("arenaxTournamentBannerStyles")) return;

  const style = document.createElement("style");
  style.id = "arenaxTournamentBannerStyles";

  style.textContent = `
    .tournament-banner{
      position:relative;
      width:100%;
      aspect-ratio:16/9;
      overflow:hidden;
      border-radius:14px;
      background:linear-gradient(135deg,#101a35,#063b55 55%,#24144c);
      margin:0 0 14px;
    }

    .tournament-banner img{
      display:block;
      width:100%;
      height:100%;
      object-fit:cover;
      object-position:center;
    }

    .tournament-banner.has-image .banner-fallback-content{
      display:none;
    }

    .tournament-banner.banner-fallback{
      display:flex;
      align-items:center;
      justify-content:center;
    }

    .tournament-banner.banner-fallback .banner-fallback-content{
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      color:#dffaff;
      font-family:Rajdhani,sans-serif;
      font-weight:800;
      font-size:clamp(30px,8vw,54px);
      letter-spacing:3px;
      text-shadow:0 0 16px #00e5ff66;
    }

    .tournament-banner.banner-fallback .banner-fallback-content span{
      color:#00e5ff;
    }

    .tournament-banner.banner-fallback .banner-fallback-content small{
      font-size:clamp(10px,2.5vw,14px);
      letter-spacing:2px;
      color:#8bb8d9;
      margin-top:4px;
    }

    @media(max-width:480px){
      .tournament-banner{
        aspect-ratio:16/9;
        border-radius:10px;
        margin-bottom:11px;
      }
    }
  `;

  document.head.appendChild(style);
})();

function money(value) {
  return Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

let messageTimer;

function showMessage(message, error = false) {
  const box = $("#message");
  if (!box) return;

  box.textContent = message;
  box.classList.remove("hide", "success", "error");
  box.classList.add(error ? "error" : "success");

  clearTimeout(messageTimer);

  messageTimer = setTimeout(() => {
    box.classList.add("hide");
  }, 4000);
}

// PAGE NAVIGATION
function page(name) {
  document.querySelectorAll(".page").forEach((section) => {
    section.classList.remove("active");
  });

  const target = $("#page-" + name);
  if (target) target.classList.add("active");

  document.querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === name);
  });

  $("#drawer")?.classList.remove("open");
  $("#scrim")?.classList.remove("show");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");

  if (button) {
    event.preventDefault();
    page(button.dataset.page);
  }
});

$("#menuToggle")?.addEventListener("click", () => {
  $("#drawer")?.classList.add("open");
  $("#scrim")?.classList.add("show");
});

$("#drawerClose")?.addEventListener("click", () => {
  $("#drawer")?.classList.remove("open");
  $("#scrim")?.classList.remove("show");
});

$("#scrim")?.addEventListener("click", () => {
  $("#drawer")?.classList.remove("open");
  $("#scrim")?.classList.remove("show");
});

// AUTH FORM VISIBILITY
function setAuthFormsVisible(visible) {
  ["#login", "#signup"].forEach((selector) => {
    const element = $(selector);
    if (element) element.style.display = visible ? "" : "none";
  });

  const loggedInPanel = $("#loggedInPanel");

  if (loggedInPanel) {
    loggedInPanel.style.display = visible ? "none" : "block";
  }

  ["#topLogin", "#topSignup"].forEach((selector) => {
    const button = $(selector);
    if (button) button.style.display = visible ? "" : "none";
  });
}

// ADMIN CHECK
async function checkAdmin() {
  if (!auth.currentUser) return false;

  try {
    const snap = await getDoc(doc(db, "users", auth.currentUser.uid));

    isAdmin = snap.exists() && snap.data().role === "admin";
    return isAdmin;
  } catch (error) {
    console.error("Admin check:", error);
    isAdmin = false;
    return false;
  }
}

// SIGN UP
$("#signup")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));

  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim();
  const password = String(data.password || "");

  if (!name || !email || password.length < 6) {
    showMessage("নাম, ইমেল ও কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দাও।", true);
    return;
  }

  try {
    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await updateProfile(result.user, {
      displayName: name
    });

    await setDoc(doc(db, "users", result.user.uid), {
      displayName: name,
      email,
      role: "player",
      createdAt: serverTimestamp()
    });

    form.reset();
    showMessage("অ্যাকাউন্ট তৈরি হয়েছে। স্বাগতম!");
    page("home");
  } catch (error) {
    console.error("Signup error:", error);

    const messages = {
      "auth/email-already-in-use": "এই ইমেল দিয়ে আগে অ্যাকাউন্ট খোলা হয়েছে।",
      "auth/invalid-email": "সঠিক ইমেল দাও।",
      "auth/weak-password": "পাসওয়ার্ড আরও শক্তিশালী করো।"
    };

    showMessage(messages[error.code] || error.message, true);
  }
});

// LOGIN
$("#login")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));

  try {
    await signInWithEmailAndPassword(
      auth,
      String(data.email || "").trim(),
      String(data.password || "")
    );

    form.reset();
    showMessage("Login সফল হয়েছে!");
    page("home");
  } catch (error) {
    console.error("Login error:", error);

    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password" ||
      error.code === "auth/user-not-found" ||
      error.code === "auth/invalid-email"
    ) {
      showMessage("পাসওয়ার্ড বা ইমেল ভুল", true);
    } else {
      showMessage(error.message, true);
    }
  }
});

// LOGOUT
$("#logout")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    page("home");
    showMessage("Logout সফল হয়েছে।");
  } catch (error) {
    showMessage(error.message, true);
  }
});

// ARENAX PREMIUM PROFILE BANNERS — built-in designs, saved per player.
const PROFILE_BANNERS = [
  { id: "rookie", name: "Rookie Pulse", level: 1, className: "ax-banner-rookie", art: "⚡", tier: "STARTER" },
  { id: "neon", name: "Neon Phantom", level: 2, className: "ax-banner-neon", art: "👾", tier: "RARE" },
  { id: "dragon", name: "Dragon Fury", level: 3, className: "ax-banner-dragon", art: "🐉", tier: "RARE" },
  { id: "shadow", name: "Crimson Shadow", level: 4, className: "ax-banner-shadow", art: "🔥", tier: "EPIC" },
  { id: "gold", name: "Golden Crown", level: 5, className: "ax-banner-gold", art: "👑", tier: "EPIC" },
  { id: "frost", name: "Frost Warden", level: 6, className: "ax-banner-frost", art: "❄️", tier: "LEGENDARY" },
  { id: "inferno", name: "Inferno Beast", level: 7, className: "ax-banner-inferno", art: "🐲", tier: "LEGENDARY" },
  { id: "royal", name: "Royal Galaxy", level: 8, className: "ax-banner-royal", art: "💎", tier: "MYTHIC" },
  { id: "dark", name: "Dark Legend", level: 9, className: "ax-banner-dark", art: "🌑", tier: "MYTHIC" },
  { id: "legend", name: "ARENAX Legend", level: 10, className: "ax-banner-legend", art: "♛", tier: "EXCLUSIVE" }
];

let activeProfileData = {};

function getProfileLevel(data = {}) {
  return Math.max(1, Math.min(10, Number(data.profileLevel || data.level || 1)));
}

function renderProfileBannerCollection(data = {}) {
  const grid = $("#profileBannerGrid");
  const hero = $("#premiumProfileBanner");
  if (!grid || !hero) return;

  const level = getProfileLevel(data);
  const selectedId = PROFILE_BANNERS.some(b => b.id === data.selectedProfileBanner)
    ? data.selectedProfileBanner : "rookie";
  const selected = PROFILE_BANNERS.find(b => b.id === selectedId) || PROFILE_BANNERS[0];

  hero.className = `ax-pro-player-card ${selected.className}`;
  const avatarArts = { rookie: "🕶️", neon: "👨🏻‍🎤", dragon: "🐉", shadow: "🥷", gold: "👑", frost: "🐺", inferno: "🐲", royal: "💎", dark: "🌑", legend: "♛" };
  if ($("#profileMainAvatar")) $("#profileMainAvatar").textContent = avatarArts[selectedId] || "👑";
  $("#profileLevelValue") && ($("#profileLevelValue").textContent = `LV. ${level}`);
  $("#profileLevelLabel") && ($("#profileLevelLabel").textContent = `Level ${level}`);
  $("#profileNextLevel") && ($("#profileNextLevel").textContent = level >= 10 ? "MAX LEVEL" : `Next: Level ${level + 1}`);
  const xp = Math.max(0, Number(data.xp || data.experience || 0));
  const xpPerLevel = 1000;
  const progressXp = Math.min(xpPerLevel, xp % xpPerLevel);
  const progress = level >= 10 ? 100 : Math.round((progressXp / xpPerLevel) * 100);
  if ($("#profileXpBar")) $("#profileXpBar").style.width = `${progress}%`;
  if ($("#profileXpText")) $("#profileXpText").textContent = level >= 10 ? "MAX LEVEL REACHED" : `${progressXp} / ${xpPerLevel} XP`;
  const rankNames = ["Rookie", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Heroic", "Master", "Grandmaster", "ARENAX Legend"];
  const rankName = rankNames[level - 1];
  if ($("#profileRankName")) $("#profileRankName").textContent = rankName;
  if ($("#profileCurrentRank")) $("#profileCurrentRank").textContent = `♛ ${rankName}`;
  if ($("#profileAchievementTitle")) $("#profileAchievementTitle").textContent = level >= 10 ? "Level 10 Achieved!" : `Level ${level} In Progress!`;
  if ($("#profileAchievementText")) $("#profileAchievementText").textContent = level >= 10 ? "Welcome to the ARENAX Legend Club!" : `আরও খেলো, XP অর্জন করো এবং Level ${level + 1} আনলক করো!`;
  const player = currentUser?.displayName || data.displayName || "ARENAX Player";
  if ($("#profilePlayerName")) $("#profilePlayerName").innerHTML = `${escapeHTML(player)} <i>✓</i>`;
  if ($("#profilePlayerEmail")) $("#profilePlayerEmail").textContent = currentUser?.email || "@player • Free Fire Competitor";
  if ($("#profileUid")) $("#profileUid").textContent = currentUser?.uid ? currentUser.uid.slice(0, 12).toUpperCase() : "LOGIN REQUIRED";
  if ($("#profileUnlockCount")) $("#profileUnlockCount").textContent = `${level} / 10 Unlocked`;

  const wins = Math.max(0, Number(data.totalWins ?? data.wins ?? 0));
  const matches = Math.max(0, Number(data.totalMatches ?? data.matches ?? 0));
  const rate = matches ? (wins / matches * 100) : 0;
  if ($("#profileWins")) $("#profileWins").textContent = String(wins);
  if ($("#profileMatches")) $("#profileMatches").textContent = String(matches);
  if ($("#profileWinRate")) $("#profileWinRate").textContent = `${rate.toFixed(1)}%`;
  if ($("#profileWallet")) $("#profileWallet").textContent = $("#balance")?.textContent?.trim() || "৳ 0.00";
  if ($("#profileCoins")) $("#profileCoins").textContent = Number(data.totalCoins ?? data.coins ?? 0).toLocaleString("en-US");

  grid.innerHTML = PROFILE_BANNERS.map(banner => {
    const unlocked = level >= banner.level;
    const isSelected = selectedId === banner.id;
    return `<button type="button" class="ax-banner-choice ${banner.className} ${isSelected ? "is-selected" : ""} ${unlocked ? "" : "is-locked"}"
      data-profile-banner="${banner.id}" ${unlocked ? "" : "disabled"}
      aria-label="${escapeHTML(banner.name)}${unlocked ? "" : ` locked until level ${banner.level}`}">
      <span class="ax-choice-art">${({rookie:"🕶️",neon:"👨🏻‍🎤",dragon:"🐉",shadow:"🥷",gold:"👑",frost:"🐺",inferno:"🐲",royal:"💎",dark:"🌑",legend:"♛"})[banner.id] || banner.art}</span><b>Lv.${banner.level}</b>
      <small>${unlocked ? (isSelected ? "✓ EQUIPPED" : "✓ UNLOCKED") : `🔒 LV. ${banner.level}`}</small></button>`;
  }).join("");
}

async function loadPremiumProfile(user) {
  if (!user) {
    activeProfileData = {};
    renderProfileBannerCollection(activeProfileData);
    return;
  }
  try {
    const [snap, registrations] = await Promise.all([
      getDoc(doc(db, "users", user.uid)),
      getDocs(query(collection(db, "registrations"), where("userId", "==", user.uid)))
    ]);
    activeProfileData = snap.exists() ? snap.data() : {};
    activeProfileData.totalMatches = Math.max(Number(activeProfileData.totalMatches || 0), registrations.size);
    if (!activeProfileData.selectedProfileBanner) activeProfileData.selectedProfileBanner = "rookie";
    renderProfileBannerCollection(activeProfileData);
  } catch (error) {
    console.error("Premium profile load error:", error);
    renderProfileBannerCollection(activeProfileData);
    showMessage("প্রোফাইল লোড করা যায়নি।", true);
  }
}

$("#profileBannerGrid")?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-profile-banner]");
  if (!button || button.disabled || !currentUser) return;

  const banner = PROFILE_BANNERS.find(item => item.id === button.dataset.profileBanner);
  if (!banner) return;

  const level = getProfileLevel(activeProfileData);
  if (level < banner.level) {
    showMessage(`এই ব্যানারটি Level ${banner.level}-এ আনলক হবে।`, true);
    return;
  }

  try {
    await setDoc(doc(db, "users", currentUser.uid), {
      selectedProfileBanner: banner.id,
      updatedAt: serverTimestamp()
    }, { merge: true });
    activeProfileData.selectedProfileBanner = banner.id;
    renderProfileBannerCollection(activeProfileData);
    showMessage(`${banner.name} ব্যানারটি প্রোফাইলে সেট হয়েছে!`);
  } catch (error) {
    console.error("Profile banner selection error:", error);
    showMessage("ব্যানার সিলেক্ট করা যায়নি। আবার চেষ্টা করো।", true);
  }
});

// AUTH STATE
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (user) {
    const admin = await checkAdmin();

    setAuthFormsVisible(false);

    if ($("#session")) {
      $("#session").textContent =
        `Login করা হয়েছে: ${user.displayName || user.email}`;
    }

    if ($("#displayNameInput")) {
      $("#displayNameInput").value = user.displayName || "";
    }

    $("#drawerAdmin")?.classList.toggle("hide", !admin);
    $("#page-admin")?.classList.toggle("admin-enabled", admin);

    await loadTournaments();
    await loadPlayerData();
    await loadPremiumProfile(user);

    if (admin) { await loadAdminData(); await loadAdminExtras(); await loadPublicMatches(); }
  } else {
    isAdmin = false;
    setAuthFormsVisible(true);
    activeProfileData = {};
    renderProfileBannerCollection(activeProfileData);

    if ($("#session")) {
      $("#session").textContent = "Login করা হয়নি";
    }

    $("#drawerAdmin")?.classList.add("hide");
    $("#page-admin")?.classList.remove("admin-enabled");

    if ($("#balance")) {
      $("#balance").textContent = "৳ 0.00";
    }

    if ($("#paymentRows")) {
      $("#paymentRows").innerHTML =
        '<tr><td colspan="4">Login করলে দেখা যাবে।</td></tr>';
    }

    if ($("#myMatchesList")) {
      $("#myMatchesList").textContent = "ম্যাচ দেখতে Login করো।";
    }

    await loadTournaments();
  }
});

// TOURNAMENT CARD
function formatTournamentDate(value) {
  if (!value) return "সময় নির্ধারণ করা হয়নি";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "সময় নির্ধারণ করা হয়নি";
  }

  return date.toLocaleString("bn-BD", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Dhaka"
  });
}function tournamentCard(item) {
  const t = item.data;
  const id = item.id;
  const joined = Number(t.joined || 0);
  const slots = Number(t.slots || 0);
  const full = slots > 0 && joined >= slots;

  const originalBannerUrl = String(t.bannerUrl || "").trim();
  // Normalize i.ibb.co.com links to the standard i.ibb.co host first.
  const bannerUrl = originalBannerUrl.replace(/^https?:\/\/i\.ibb\.co\.com\//i, "https://i.ibb.co/");
  const alternateBannerUrl = originalBannerUrl !== bannerUrl ? originalBannerUrl : "";
  const banner = bannerUrl
    ? `<div class="tournament-banner has-image"><img src="${escapeHTML(bannerUrl)}" data-alt-banner-url="${escapeHTML(alternateBannerUrl)}" alt="${escapeHTML(t.title || "Tournament banner")}" loading="lazy" onerror="if(this.dataset.altBannerUrl){this.src=this.dataset.altBannerUrl;this.dataset.altBannerUrl='';}else{const box=this.closest('.tournament-banner');box?.classList.remove('has-image');box?.classList.add('banner-fallback');this.remove();}"><div class="banner-fallback-content">ARENA<span>X</span><small>FREE FIRE TOURNAMENT</small></div></div>`
    : `<div class="tournament-banner banner-fallback"><div class="banner-fallback-content">ARENA<span>X</span><small>FREE FIRE TOURNAMENT</small></div></div>`;

  return `
    <article class="tournament-card">
      ${banner}
      <div class="tournament-card-top">
        <span class="mode-tag">${escapeHTML(t.mode || "Solo")}</span>
        <span class="live-tag">${full ? "SLOT FULL" : "OPEN"}</span>
      </div>

      <h3>${escapeHTML(t.title || "ArenaX Tournament")}</h3>

      <p>${escapeHTML(t.description || "Join the battle and win prizes.")}</p>

      <div class="tournament-start-time">
        <span class="start-time-icon">🕒</span>
        <div>
          <small>TOURNAMENT START TIME</small>
          <strong>${escapeHTML(formatTournamentDate(t.startsAt))}</strong>
          <span>বাংলাদেশ সময় (BDT)</span>
        </div>
      </div>

      <div class="tournament-info">
        <div>
          <small>ENTRY FEE</small>
          <b>৳${money(t.entryFee)}</b>
        </div>

        <div>
          <small>PRIZE POOL</small>
          <b>৳${money(t.prizePool)}</b>
        </div>
    
        <div>
          <small>PLAYERS</small>
          <b>${joined}/${slots}</b>
        </div>
      </div>

      <div class="slot-track">
                  <span style="width:${slots ? Math.min(100, joined / slots * 100) : 0}%"></span>
      </div>

      <button
        class="btn primary tournament-join-btn"
        type="button"
        ${full ? "disabled" : ""}
        onclick="window.openJoinForm('${escapeHTML(id)}')">
        ${full ? "Slot পূর্ণ" : "🏆 Join Tournament"}
      </button>

    </article>
  `;
}


// LOAD TOURNAMENTS
async function loadTournaments() {
  try {
    const snap = await getDocs(query(
      collection(db, "tournaments"),
      orderBy("createdAt", "desc")
    ));

    tournamentCache = snap.docs.map((item) => ({
      id: item.id,
      data: item.data()
    }));

    const html = tournamentCache.length
      ? tournamentCache.map(tournamentCard).join("")
      : '<div class="panel">এখনো কোনো Tournament Publish হয়নি।</div>';

    if ($("#tournamentList")) $("#tournamentList").innerHTML = html;
    if ($("#homeTournamentList")) $("#homeTournamentList").innerHTML = html;

    const select = $("#tournamentSelect");
    if (select) {
      const previous = select.value;

      select.innerHTML =
        '<option value="">টুর্নামেন্ট বেছে নাও</option>' +
        tournamentCache.map(({ id, data }) =>
          `<option value="${escapeHTML(id)}">${escapeHTML(data.title)} — ৳${money(data.entryFee)}</option>`
        ).join("");

      if (previous) select.value = previous;
      updateRegistrationPlayerFields();
    }

    const adminRoomSelect = $("#adminRoomTournament");
    if (adminRoomSelect) {
      const previousRoomTournament = adminRoomSelect.value;
      adminRoomSelect.innerHTML =
        '<option value="">টুর্নামেন্ট বেছে নাও</option>' +
        tournamentCache.map(({ id, data }) =>
          `<option value="${escapeHTML(id)}">${escapeHTML(data.title || id)}</option>`
        ).join("");

      if (previousRoomTournament) adminRoomSelect.value = previousRoomTournament;
    }

    const matchTournamentSelect = $("#matchTournamentSelect");
    if (matchTournamentSelect) {
      const previousMatchTournament = matchTournamentSelect.value;
      matchTournamentSelect.innerHTML = '<option value="">Tournament বেছে নাও</option>' +
        tournamentCache.map(({ id, data }) => `<option value="${escapeHTML(id)}">${escapeHTML(data.title || id)}</option>`).join("");
      if (previousMatchTournament) matchTournamentSelect.value = previousMatchTournament;
    }
  } catch (error) {
    console.error("Tournament load error:", error);

    const errorHTML = '<div class="panel">Tournament লোড হয়নি। আবার চেষ্টা করো।</div>';

    if ($("#tournamentList")) $("#tournamentList").innerHTML = errorHTML;
    if ($("#homeTournamentList")) $("#homeTournamentList").innerHTML = errorHTML;
  }
}

// OPEN JOIN FORM
window.openJoinForm = (tournamentId) => {
  if (!currentUser) {
    showMessage("Tournament Join করতে আগে Login করো।", true);
    page("profile");
    return;
  }

  const select = $("#tournamentSelect");
  if (select) select.value = tournamentId;

  updateRegistrationPlayerFields();

  page("myMatches");

  $("#registrationForm")?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
};

// MODE-BASED REGISTRATION FIELDS: SOLO=1, DUO=2, SQUAD=4
function getTournamentMode(tournament) {
  const mode = String(tournament?.mode || "Solo").trim().toLowerCase();

  if (mode === "duo") return "Duo";
  if (mode === "squad") return "Squad";

  return "Solo";
}

function updateRegistrationPlayerFields() {
  const select = $("#tournamentSelect");
  const container = $("#registrationPlayers");
  const teamField = $("#teamNameField");
  const teamInput = $("#registrationTeamName");

  if (!select || !container) return;

  const selected = tournamentCache.find((item) => item.id === select.value);

  if (!selected) {
    container.innerHTML =
      '<p class="hint">Tournament বেছে নিলে Player তথ্যের ঘর আসবে।</p>';

    if (teamField) teamField.style.display = "none";
    if (teamInput) teamInput.value = "";
    return;
  }

  const mode = getTournamentMode(selected.data);
  const count = mode === "Duo" ? 2 : mode === "Squad" ? 4 : 1;

  container.innerHTML = `
    <div class="eyebrow" style="grid-column:1/-1">
      ${mode} REGISTRATION — ${count} PLAYER${count > 1 ? "S" : ""}
    </div>

    ${Array.from({ length: count }, (_, index) => {
      const number = index + 1;

      return `
        <div class="panel" style="grid-column:1/-1;padding:14px">
          <b>Player ${number}</b>

          <label>Player ${number} Game Name
            <input
              name="player${number}Name"
              maxlength="40"
              placeholder="Player ${number}-এর Free Fire Game Name"
              required>
          </label>

          <label>Player ${number} Free Fire UID
            <input
              name="player${number}Uid"
              inputmode="numeric"
              pattern="[0-9]{5,20}"
              maxlength="20"
              placeholder="Player ${number}-এর UID"
              required>
          </label>
        </div>`;
    }).join("")}
  `;

  if (teamField) teamField.style.display = count > 1 ? "" : "none";
  if (teamInput && count === 1) teamInput.value = "";
}

$("#tournamentSelect")?.addEventListener("change", updateRegistrationPlayerFields);

// ARENAX TOURNAMENT JOIN
// AUTOMATIC REGISTRATION + WALLET ENTRY FEE
// ==========================================

$("#registrationForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    showMessage("আগে Login করো।", true);
    page("profile");
    return;
  }

  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const tournamentId = String(data.tournamentId || "").trim();
  const teamName = String(data.teamName || "").trim();

  if (!tournamentId) {
    showMessage("Tournament বেছে নাও।", true);
    return;
  }

  let joinStage = "Starting";

  try {
    const tournamentRef = doc(db, "tournaments", tournamentId);
    const registrationId = `${tournamentId}_${currentUser.uid}`;
    const registrationRef = doc(db, "registrations", registrationId);

    joinStage = "Tournament Information Read";

    const selectedTournament = tournamentCache.find(
      (item) => item.id === tournamentId
    );

    if (!selectedTournament) {
      throw new Error("Tournament তালিকায় পাওয়া যায়নি।");
    }

    const mode = getTournamentMode(selectedTournament.data);
    const requiredPlayers = mode === "Duo" ? 2 : mode === "Squad" ? 4 : 1;
    const players = [];

    for (let i = 1; i <= requiredPlayers; i++) {
      const gameUsername = String(data[`player${i}Name`] || "").trim();
      const uid = String(data[`player${i}Uid`] || "").trim();

      if (!gameUsername || !/^[0-9]{5,20}$/.test(uid)) {
        throw new Error(`Player ${i}-এর Game Name অথবা UID সঠিক নয়।`);
      }

      players.push({ slot: i, gameUsername, uid });
    }

    joinStage = "Wallet Ledger Read";

    const ledgerSnap = await getDocs(query(
      collection(db, "paymentRequests"),
      where("userId", "==", currentUser.uid)
    ));

    const feeRef = doc(collection(db, "paymentRequests"));

    joinStage = "Tournament Transaction";

    await runTransaction(db, async (tx) => {
      const tournamentSnap = await tx.get(tournamentRef);

      if (!tournamentSnap.exists()) {
        throw new Error("Tournament পাওয়া যায়নি।");
      }

      const existingSnap = await tx.get(registrationRef);

      if (existingSnap.exists()) {
        throw new Error("এই Tournament-এ তুমি আগে Join করেছ।");
      }

      const tournament = tournamentSnap.data();

      if (String(tournament.status || "published").toLowerCase() !== "published") {
        throw new Error("এই Tournament এখন Join করা যাচ্ছে না।");
      }

      const liveMode = getTournamentMode(tournament);
      const liveCount = liveMode === "Duo" ? 2 : liveMode === "Squad" ? 4 : 1;

      if (liveMode !== mode || players.length !== liveCount) {
        throw new Error("Tournament Mode পরিবর্তিত হয়েছে। ফর্ম আবার খুলে তথ্য দাও।");
      }

      if (String(tournament.registrationStatus || "open") !== "open") {
        throw new Error("এই Tournament-এর Registration বন্ধ আছে।");
      }
      const fee = Number(tournament.entryFee || 0);
      const joined = Number(tournament.joined || 0);
      const slots = Number(tournament.slots || 0);

      if (!Number.isFinite(fee) || fee < 0) {
        throw new Error("Tournament Entry Fee সঠিক নয়।");
      }

      if (!Number.isInteger(joined) || !Number.isInteger(slots) || slots < 1) {
        throw new Error("Tournament Slot তথ্য সঠিক নয়।");
      }

      if (joined >= slots) {
        throw new Error("এই Tournament-এর Slot পূর্ণ হয়ে গেছে।");
      }

      let balance = 0;

      ledgerSnap.forEach((item) => {
        const payment = item.data();
        const amount = Number(payment.amount || 0);

        if (payment.status === "approved") {
          if (payment.type === "deposit" || payment.type === "tournament_prize") {
            balance += amount;
          }

          if (payment.type === "tournament_fee" || payment.type === "withdraw") {
            balance -= amount;
          }
        } else if (payment.type === "withdraw" && payment.status === "pending") {
          balance -= amount;
        }
      });

      if (balance < fee) {
        throw new Error(
          `Wallet Balance পর্যাপ্ত নয়। প্রয়োজন ৳${money(fee)}, আছে ৳${money(balance)}।`
        );
      }

      joinStage = "Registration Create";

      tx.set(registrationRef, {
        userId: currentUser.uid,
        tournamentId,
        tournamentTitle: tournament.title || "",
        mode: liveMode,
        playerName: players[0].gameUsername,
        gameUsername: players[0].gameUsername,
        uid: players[0].uid,
        players,
        teamName: liveMode === "Solo" ? "" : teamName,
        status: "approved",
        createdAt: serverTimestamp(),
        approvedAt: serverTimestamp(),
        autoJoined: true
      });

      joinStage = "Tournament Joined Update";
      tx.update(tournamentRef, { joined: joined + 1 });

      if (fee > 0) {
        joinStage = "Entry Fee Ledger Create";

        tx.set(feeRef, {
          userId: currentUser.uid,
          type: "tournament_fee",
          amount: fee,
          status: "approved",
          tournamentId,
          method: "Wallet",
          reference: "Automatic Tournament Entry Fee",
          createdAt: serverTimestamp()
        });
      }
    });

    form.reset();
    updateRegistrationPlayerFields();

    showMessage(
      "সফলভাবে Tournament Join হয়েছে। Entry Fee Wallet থেকে কেটে নেওয়া হয়েছে।"
    );

    await loadPlayerData();
    await loadTournaments();
  } catch (error) {
    console.error("TOURNAMENT JOIN ERROR:", error);
    console.error("ERROR STAGE:", joinStage);
    console.error("ERROR CODE:", error.code);

    showMessage(
      `${joinStage} ব্যর্থ হয়েছে: ${error.message || "Unknown Error"}`,
      true
    );
  }
});// LOAD PLAYER MATCHES
async function loadPlayerData() {
  if (!currentUser) return;

  try {
    const registrationSnap = await getDocs(query(
      collection(db, "registrations"),
      where("userId", "==", currentUser.uid)
    ));

    if ($("#myMatchesList")) {
      $("#myMatchesList").innerHTML = registrationSnap.empty
        ? "এখনো কোনো Tournament-এ Registration করোনি।"
        : registrationSnap.docs.map((item) => {
            const r = item.data();

            return `
              <div class="match-row">
                <b>${escapeHTML(r.tournamentTitle || r.tournamentId)}</b>
                <p>Player: ${escapeHTML(r.playerName)}</p>

                ${Array.isArray(r.players) && r.players.length
                  ? r.players.map((member, index) => `
                    <p>Player ${index + 1}: ${escapeHTML(member.gameUsername || "-")}</p>
                    <p>UID: ${escapeHTML(member.uid || "-")}</p>
                  `).join("")
                  : `<p>Game Username: ${escapeHTML(r.gameUsername || "-")}</p>
                     <p>UID: ${escapeHTML(r.uid || "-")}</p>`}

                ${r.status === "approved" && r.roomId ? `
                  <div class="room-details">
                    <b>🎮 Match Room Details</b>
                    <p>
                      Room ID: <strong>${escapeHTML(r.roomId)}</strong>
                      <button class="small-btn" type="button"
                        data-copy-room-value="${escapeHTML(r.roomId)}">
                        Copy Room ID
                      </button>
                    </p>
                    <p>
                      Password: <strong>${escapeHTML(r.roomPassword || "")}</strong>
                      <button class="small-btn" type="button"
                        data-copy-room-value="${escapeHTML(r.roomPassword || "")}">
                        Copy Password
                      </button>
                    </p>
                  </div>` : ""}

                <span class="status-tag ${escapeHTML(r.status)}">
                  ${escapeHTML(r.status)}
                </span>
              </div>
            `;
          }).join("");
    }

    const paymentSnap = await getDocs(query(
      collection(db, "paymentRequests"),
      where("userId", "==", currentUser.uid)
    ));

    let balance = 0;

    paymentSnap.forEach((item) => {
      const p = item.data();

      if (p.status === "approved") {
        if (p.type === "deposit" || p.type === "tournament_prize") {
          balance += Number(p.amount || 0);
        }

        if (p.type === "tournament_fee" || p.type === "withdraw") {
          balance -= Number(p.amount || 0);
        }
      }
    });

    // Pending withdrawal requests reserve funds until Admin rejects or approves.
    paymentSnap.forEach((item) => {
      const p = item.data();

      if (p.type === "withdraw" && p.status === "pending") {
        balance -= Number(p.amount || 0);
      }
    });

    if ($("#balance")) {
      $("#balance").textContent = "৳ " + money(Math.max(0, balance));
    }

    if ($("#paymentRows")) {
      const payments = paymentSnap.docs
        .map((item) => item.data())
        .sort((a, b) => {
          const at = a.createdAt?.seconds || 0;
          const bt = b.createdAt?.seconds || 0;
          return bt - at;
        });

      $("#paymentRows").innerHTML = payments.length
        ? payments.map((p) => `
              <tr>
              <td>${escapeHTML(p.type)}</td>
              <td>৳${money(p.amount)}</td>
              <td>${escapeHTML(p.method || "Wallet")}</td>
              <td>
                <span class="status-tag ${escapeHTML(p.status)}">
                  ${escapeHTML(p.status)}
                </span>
              </td>
            </tr>
          `).join("")
                : '<tr><td colspan="4">কোনো লেনদেন নেই।</td></tr>';
    }
  } catch (error) {
    console.error("Player data error:", error);
    showMessage("Player Data লোড হয়নি।", true);
  }
}

// COPY MATCH ROOM ID / PASSWORD
$("#myMatchesList")?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-room-value]");
  if (!button) return;

  const value = button.dataset.copyRoomValue || "";
  const label = button.textContent.trim();

  try {
    await navigator.clipboard.writeText(value);

    showMessage(
      label === "Copy Room ID"
        ? "Room ID কপি হয়েছে।"
        : "Room Password কপি হয়েছে।"
    );
  } catch (error) {
    console.error("Room details copy error:", error);
    showMessage("কপি করা যায়নি। হাতে সিলেক্ট করে কপি করো।", true);
  }
});

// COPY PAYMENT NUMBER
$("#copyNumber")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText("01346022330");
    showMessage("পেমেন্ট নম্বর কপি হয়েছে।");
  } catch {
    showMessage("নম্বর কপি করা যায়নি। 01346022330", true);
  }
});

// PAYMENT REQUEST
$("#paymentForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    showMessage("Deposit করতে আগে Login করো।", true);
    page("profile");
    return;
  }

  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const amount = Number(data.amount);
  const reference = String(data.reference || "").trim();

  if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
    showMessage("সঠিক Amount লিখো।", true);
    return;
  }

  if (reference.length < 4) {
    showMessage("সঠিক Transaction ID দাও।", true);
    return;
  }

  try {
    await addDoc(collection(db, "paymentRequests"), {
      userId: currentUser.uid,
      type: "deposit",
      amount,
      method: String(data.method || "bKash"),
      reference,
      status: "pending",
      createdAt: serverTimestamp()
    });

    form.reset();
    showMessage("Deposit Request পাঠানো হয়েছে। Admin যাচাই করবেন।");

    await loadPlayerData();
    if (isAdmin) await loadAdminData();
  } catch (error) {
    console.error("Payment request error:", error);
    showMessage(error.message, true);
  }
});

// WITHDRAW REQUEST
$("#withdrawForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    showMessage("Withdraw করতে আগে Login করো।", true);
    page("profile");
    return;
  }

  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const amount = Number(data.amount);
  const accountNumber = String(data.accountNumber || "").trim();

  if (
    !Number.isFinite(amount) ||
    amount < 1 ||
    amount > 100000 ||
    !/^01[3-9][0-9]{8}$/.test(accountNumber)
  ) {
    showMessage("সঠিক Amount ও ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর দাও।", true);
    return;
  }

  try {
    const ledger = await getDocs(query(
      collection(db, "paymentRequests"),
      where("userId", "==", currentUser.uid)
    ));

    let available = 0;

    ledger.forEach((item) => {
      const p = item.data();

      if (p.status === "approved") {
        if (p.type === "deposit" || p.type === "tournament_prize") {
          available += Number(p.amount || 0);
        }

        if (p.type === "withdraw" || p.type === "tournament_fee") {
          available -= Number(p.amount || 0);
        }
      } else if (p.type === "withdraw" && p.status === "pending") {
        available -= Number(p.amount || 0);
      }
    });

    if (amount > available) {
      throw new Error(
        `পর্যাপ্ত ব্যালেন্স নেই। Available: ৳${money(Math.max(0, available))}`
      );
    }

    await addDoc(collection(db, "paymentRequests"), {
      userId: currentUser.uid,
      type: "withdraw",
      amount,
      method: String(data.method),
      accountNumber,
      status: "pending",
      createdAt: serverTimestamp()
    });

    form.reset();
    showMessage("Withdraw request পাঠানো হয়েছে। Admin Review করবেন।");

    await loadPlayerData();
    if (isAdmin) await loadAdminData();
  } catch (error) {
    console.error("Withdraw request error:", error);
    showMessage(error.message || "Withdraw request পাঠানো যায়নি।", true);
  }
});

// DISPLAY NAME
$("#profileForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) return;

  const displayName = String(
    new FormData(event.currentTarget).get("displayName") || ""
  ).trim();

  if (!displayName || displayName.length > 40) {
    showMessage("Display Name ১-৪০ অক্ষরের মধ্যে দাও।", true);
    return;
  }

  try {
    await updateProfile(currentUser, { displayName });

    await setDoc(doc(db, "users", currentUser.uid), {
      displayName,
      updatedAt: serverTimestamp()
    }, { merge: true });

    if ($("#session")) {
      $("#session").textContent = `Login করা হয়েছে: ${displayName}`;
    }

    showMessage("Display Name আপডেট হয়েছে।");
  } catch (error) {
    console.error("Profile update error:", error);
    showMessage(error.message || "Profile আপডেট হয়নি।", true);
  }
});

// LOAD ADMIN DATA
async function loadAdminData() {
  if (!(await checkAdmin())) return;

  try {
    const paymentSnap = await getDocs(query(
      collection(db, "paymentRequests"),
      where("status", "==", "pending")
    ));

    if ($("#adminPayments")) {
      $("#adminPayments").innerHTML = paymentSnap.empty
        ? '<tr><td colspan="3">কোনো Pending Payment নেই।</td></tr>'
        : paymentSnap.docs.map((item) => {
            const p = item.data();

            return `
              <tr>
                <td>${escapeHTML(p.userId)}</td>
                <td>
                  ৳${money(p.amount)}<br>
                  ${escapeHTML(p.method)}<br>
                  ID: ${escapeHTML(p.reference)}
                </td>
                <td>
                  <button class="small-btn approve"
                    onclick="window.reviewPayment('${item.id}','approved')">
                    Approve
                  </button>
                  <button class="small-btn reject"
                    onclick="window.reviewPayment('${item.id}','rejected')">
                    Reject
                  </button>
                </td>
              </tr>
            `;
          }).join("");
    }

    const withdrawalSnap = await getDocs(query(
      collection(db, "paymentRequests"),
      where("type", "==", "withdraw"),
      where("status", "==", "pending")
    ));

    if ($("#adminWithdrawals")) {
      $("#adminWithdrawals").innerHTML = withdrawalSnap.empty
        ? '<tr><td colspan="3">কোনো Pending Withdraw নেই।</td></tr>'
        : withdrawalSnap.docs.map((item) => {
            const w = item.data();

            return `
              <tr>
                <td>${escapeHTML(w.userId)}</td>
                <td>
                  ৳${money(w.amount)}<br>
                  ${escapeHTML(w.method || "")}<br>
                  ${escapeHTML(w.accountNumber || "")}
                </td>
                <td>
                  <button class="small-btn approve"
                    onclick="window.reviewPayment('${item.id}','approved')">
                    Approve
                  </button>
                  <button class="small-btn reject"
                    onclick="window.reviewPayment('${item.id}','rejected')">
                    Reject
                  </button>
                </td>
              </tr>`;
          }).join("");
    }

    // Show ALL registrations (pending + approved + rejected), grouped by tournament.
    const registrationSnap = await getDocs(collection(db, "registrations"));

    if ($("#adminRegistrations")) {
      if (registrationSnap.empty) {
        $("#adminRegistrations").innerHTML =
          '<tr><td colspan="5">এখনো কোনো Tournament-এ কেউ Join করেনি।</td></tr>';
      } else {
        const registrations = registrationSnap.docs.map((item) => ({
          id: item.id,
          data: item.data()
        }));

        // Group by tournamentId so every player's details appear under the correct tournament.
        const groups = new Map();

        registrations.forEach(({ id, data }) => {
          const tournamentId = String(data.tournamentId || "unknown");

          if (!groups.has(tournamentId)) groups.set(tournamentId, []);
          groups.get(tournamentId).push({ id, data });
        });

        const tournamentNames = new Map(
          tournamentCache.map(({ id, data }) => [id, data.title || id])
        );

        const html = [...groups.entries()].map(([tournamentId, players]) => {
          const tournamentTitle = tournamentNames.get(tournamentId)
            || players[0]?.data.tournamentTitle
            || tournamentId;

          const playerRows = players.map(({ id, data: r }) => {
            const status = String(r.status || "pending");

            const action = status === "pending"
              ? `<button class="small-btn approve" type="button"
                   onclick="window.approveRegistration('${id}')">Approve</button>
                 <button class="small-btn reject" type="button"
                   onclick="window.rejectRegistration('${id}')">Reject</button>`
              : `<span class="status-tag ${escapeHTML(status)}">${escapeHTML(status)}</span>`;

            return `
              <tr>
                <td>${escapeHTML(r.teamName || r.playerName || "-")}</td>
                <td>${Array.isArray(r.players) && r.players.length
                  ? r.players.map((member, index) =>
                    `P${index + 1}: ${escapeHTML(member.gameUsername || "-")}`
                  ).join("<br>")
                  : escapeHTML(r.gameUsername || "-")}</td>
                <td>${Array.isArray(r.players) && r.players.length
                  ? r.players.map((member, index) =>
                    `P${index + 1}: ${escapeHTML(member.uid || "-")}`
                  ).join("<br>")
                  : escapeHTML(r.uid || "-")}</td>
                <td><code>${escapeHTML(r.userId || "Firebase UID নেই")}</code></td>
                <td>${action}</td>
              </tr>
            `;
          }).join("");

          return `
  <tr class="admin-tournament-group">
    <td colspan="5">
      <strong>🏆 ${escapeHTML(tournamentTitle)}</strong>
      <small> — ${players.length} জন Player</small>
      <br>
      <small>Tournament ID:
        <code>${escapeHTML(tournamentId)}</code>
      </small>
    </td>
  </tr>
  ${playerRows}
`;
        }).join("");

        $("#adminRegistrations").innerHTML = html;
      }
    }

  } catch (error) {
    console.error("Admin data error:", error);
    showMessage("Admin Data লোড হয়নি।", true);
  }
        }// ADMIN APPROVE / REJECT PAYMENT
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

      if (snap.data().status !== "pending") {
        throw new Error("Payment আগে Review করা হয়েছে।");
      }

      const request = snap.data();

      if (request.type === "withdraw" && status === "approved") {
        const userPayments = await getDocs(query(
          collection(db, "paymentRequests"),
          where("userId", "==", request.userId)
        ));

        let available = 0;

        userPayments.forEach((entry) => {
          if (entry.id === paymentId) return;

          const p = entry.data();

          if (p.status === "approved") {
            if (p.type === "deposit" || p.type === "tournament_prize") {
              available += Number(p.amount || 0);
            }

            if (p.type === "withdraw" || p.type === "tournament_fee") {
              available -= Number(p.amount || 0);
            }
          } else if (p.type === "withdraw" && p.status === "pending") {
            available -= Number(p.amount || 0);
          }
        });

        if (Number(request.amount || 0) > available) {
          throw new Error(
            "এই Withdraw Approve করার মতো পর্যাপ্ত Available Balance নেই।"
          );
        }
      }

      tx.update(ref, {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser.uid
      });
    });

    showMessage(
      status === "approved"
        ? "Payment Approve হয়েছে।"
        : "Payment Reject হয়েছে।"
    );

    await loadAdminData();
        if (currentUser) await loadPlayerData();

  } catch (error) {
    console.error("Review payment error:", error);
    showMessage(error.message, true);
  }
};

// ADMIN APPROVE REGISTRATION + ENTRY FEE
window.approveRegistration = async (registrationId) => {
  if (!(await checkAdmin())) {
    showMessage("Admin permission নেই।", true);
    return;
  }

  try {
    const registrationRef = doc(db, "registrations", registrationId);
    const registrationSnap = await getDoc(registrationRef);
                          
    if (!registrationSnap.exists()) {
      throw new Error("Registration পাওয়া যায়নি।");
    }

    const registration = registrationSnap.data();

    if (registration.status !== "pending") {
      throw new Error("Registration আগে Review হয়েছে।");
    }

    const tournamentRef = doc(db, "tournaments", registration.tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);

    if (!tournamentSnap.exists()) {
      throw new Error("Tournament পাওয়া যায়নি।");
    }

    const fee = Number(tournamentSnap.data().entryFee || 0);

    // Read approved wallet ledger entries.
    const ledgerSnap = await getDocs(query(
      collection(db, "paymentRequests"),
      where("userId", "==", registration.userId)
    ));

    let balance = 0;

    ledgerSnap.forEach((item) => {
      const p = item.data();

      if (p.status === "approved") {
        if (p.type === "deposit" || p.type === "tournament_prize") {
          balance += Number(p.amount || 0);
        }

        if (p.type === "tournament_fee" || p.type === "withdraw") {
          balance -= Number(p.amount || 0);
        }
      }
    });

    if (balance < fee) {
      throw new Error(
        `Player-এর Wallet Balance পর্যাপ্ত নয়। বর্তমান Balance: ৳${money(balance)}`
      );
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

      if (slots > 0 && joined >= slots) {
        throw new Error("Tournament Slot পূর্ণ হয়ে গেছে।");
      }

      tx.update(registrationRef, {
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedBy: auth.currentUser.uid
      });

      tx.update(tournamentRef, {
        joined: joined + 1
      });

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
    await loadTournaments();

  } catch (error) {
    console.error("Approve registration error:", error);
    showMessage(error.message, true);
  }
};

// ADMIN REJECT REGISTRATION
window.rejectRegistration = async (registrationId) => {
  if (!(await checkAdmin())) {
    showMessage("Admin permission নেই।", true);
    return;
  }

  try {
    const ref = doc(db, "registrations", registrationId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        throw new Error("Registration পাওয়া যায়নি।");
      }

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

// ADMIN: SEND ROOM DETAILS TO APPROVED PLAYERS ONLY
document.addEventListener("submit", async (event) => {
  if (event.target.id !== "roomDetailsForm") return;

  event.preventDefault();

  if (!(await checkAdmin())) {
    showMessage("শুধু Admin Room ID ও Password দিতে পারবে।", true);
    return;
  }

  const form = event.target;
  const data = Object.fromEntries(new FormData(form));

  const tournamentId = String(data.tournamentId || "").trim();
  const roomId = String(data.roomId || "").trim();
  const roomPassword = String(data.roomPassword || "").trim();

  if (!tournamentId || !roomId || !roomPassword) {
    showMessage("Tournament, Room ID ও Password পূরণ করো।", true);
    return;
  }

  try {
    const approvedSnap = await getDocs(query(
      collection(db, "registrations"),
      where("tournamentId", "==", tournamentId),
      where("status", "==", "approved")
    ));

    if (approvedSnap.empty) {
      showMessage("এই Tournament-এ এখনো Approved Player নেই।", true);
      return;
    }

    // Max tournament slots are 500, within Firestore's 500-write batch limit.
    const batch = writeBatch(db);

    approvedSnap.docs.forEach((registration) => {
      batch.update(registration.ref, {
        roomId,
        roomPassword,
        roomDetailsUpdatedAt: serverTimestamp()
      });
    });

    await batch.commit();

    form.reset();

    showMessage(
      `${approvedSnap.size} জন Approved Player-কে Room Details পাঠানো হয়েছে।`
    );

    await loadAdminData();
    await loadPlayerData();

  } catch (error) {
    console.error("Room details update error:", error);
    showMessage(error.message || "Room Details পাঠানো যায়নি।", true);
  }
});

// CREATE TOURNAMENT
document.addEventListener("submit", async (event) => {
  if (event.target.id !== "createTournament") return;

  event.preventDefault();

  if (!(await checkAdmin())) {
    showMessage("শুধু Admin Tournament তৈরি করতে পারবে।", true);
    return;
  }

  const form = event.target;
  const data = Object.fromEntries(new FormData(form));

  const entryFee = Number(data.entryFee);
  const prizePool = Number(data.prizePool);
  const slots = Number(data.slots);

  if (
    !String(data.title || "").trim() ||
    !Number.isFinite(entryFee) || entryFee < 0 ||
    !Number.isFinite(prizePool) || prizePool < 0 ||
    !Number.isInteger(slots) || slots < 1 || slots > 500
  ) {
    showMessage("Tournament-এর তথ্য সঠিকভাবে পূরণ করো।", true);
    return;
  }

  try {
    await addDoc(collection(db, "tournaments"), {
      title: String(data.title).trim(),
      mode: String(data.mode || "Solo"),
      description: String(data.description || "").trim(),
      bannerUrl: String(data.bannerUrl || "").trim(),
      entryFee,
      prizePool,
      slots,
      format: String(data.format || "Knockout"),
      rules: String(data.rules || "").trim(),
      registrationStatus: String(data.registrationStatus || "open"),
      joined: 0,
      startsAt: data.startsAt
        ? new Date(data.startsAt).toISOString()
        : "",
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

// ADMIN RESULT PUBLISH + WINNING PRIZE

document.addEventListener("submit", async (event) => {
  if (event.target.id !== "resultForm") return;

  event.preventDefault();

  if (!(await checkAdmin())) {
    showMessage("শুধু Admin Result Publish করতে পারবে।", true);
    return;
  }

  const form = event.target;
  const data = Object.fromEntries(new FormData(form));

  const playerName = String(data.player || "").trim();
  const winnerUserId = String(data.userId || "").trim();
  const tournamentId = String(data.tournamentId || "").trim();

  const placement = Number(data.placement);
  const points = Number(data.points);
  const prizeAmount = Number(data.prizeAmount || 0);

  if (!playerName || !tournamentId) {
    showMessage("Player Name ও Tournament ID দিতে হবে।", true);
    return;
  }

  if (
    !Number.isInteger(placement) ||
    placement < 1 ||
    !Number.isFinite(points) ||
    points < 0 ||
    !Number.isFinite(prizeAmount) ||
    prizeAmount < 0
  ) {
    showMessage("Placement, Points অথবা Prize সঠিক নয়।", true);
    return;
  }

  if (prizeAmount > 0 && !winnerUserId) {
    showMessage("Winning Prize দিতে Player userId আবশ্যক।", true);
    return;
  }

  try {
    let winnerRegistration = null;
    let prizeLedgerRef = null;

    // WINNER REGISTRATION VERIFY
    if (prizeAmount > 0) {
      const registrationSnap = await getDocs(query(
        collection(db, "registrations"),
        where("userId", "==", winnerUserId),
        where("tournamentId", "==", tournamentId)
      ));

      winnerRegistration = registrationSnap.docs.find(
        item => item.data().status === "approved"
      );

      if (!winnerRegistration) {
        throw new Error(
          "এই userId দিয়ে নির্বাচিত Tournament-এ Approved Registration পাওয়া যায়নি।"
        );
      }

      // একই Player + Tournament-এর Prize Ledger ID স্থায়ী থাকবে।
      const safeTournamentId = tournamentId.replaceAll("/", "_");

      const prizeLedgerId =
        `prize_${safeTournamentId}_${winnerUserId}`;

      prizeLedgerRef = doc(
        db,
        "paymentRequests",
        prizeLedgerId
      );

      // DUPLICATE PRIZE CHECK
      const oldPrize = await getDoc(prizeLedgerRef);

      if (oldPrize.exists()) {
        throw new Error(
          "এই Player এই Tournament-এর Winning Prize আগেই পেয়েছে। দ্বিতীয়বার দেওয়া যাবে না।"
        );
      }
    }

    // RESULT DOCUMENT
    const resultRef = doc(collection(db, "results"));
    const batch = writeBatch(db);

    batch.set(resultRef, {
      player: playerName,
      userId: winnerUserId || null,
      placement,
      points,
      prizeAmount,
      prizeStatus: prizeAmount > 0 ? "credited" : "no_prize",
      tournamentId,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    });

    // WINNING PRIZE WALLET CREDIT
    if (prizeAmount > 0) {
      batch.set(prizeLedgerRef, {
        userId: winnerUserId,
        type: "tournament_prize",
        amount: prizeAmount,
        status: "approved",
        method: "Tournament Winning Prize",
        reference: `Result ${resultRef.id}`,
        tournamentId,
        resultId: resultRef.id,
        createdAt: serverTimestamp(),
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser.uid
      });
    }

    // BOTH WRITES COMMIT TOGETHER
    await batch.commit();

    form.reset();

    showMessage(
      prizeAmount > 0
        ? `Result Publish হয়েছে! ৳${money(prizeAmount)} Player Wallet-এ যোগ হয়েছে।`
        : "Result সফলভাবে Publish হয়েছে।"
    );

    await loadLeaderboard();

    if (currentUser) {
      await loadPlayerData();
    }

  } catch (error) {
    console.error("Winning Prize Error:", error);

    showMessage(
      error.message || "Winning Prize Publish করা যায়নি।",
      true
    );
  }
});

// LEADERBOARD
async function loadLeaderboard() {
  try {
    const snapshot = await getDocs(query(
      collection(db, "results"),
      orderBy("points", "desc")
    ));

    if ($("#leaderboardRows")) {
      $("#leaderboardRows").innerHTML = snapshot.docs.map((item, index) => {
        const r = item.data();

        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHTML(r.player || "")}</td>
            <td>${Number(r.placement || 0)}</td>
            <td>${Number(r.points || 0)}</td>
            <td>৳${money(r.prizeAmount || 0)}</td>
          </tr>
        `;
      }).join("") || '<tr><td colspan="5">এখনো ফলাফল প্রকাশ হয়নি।</td></tr>';
    }

  } catch (error) {
    console.error("Leaderboard error:", error);

    if ($("#leaderboardRows")) {
      $("#leaderboardRows").innerHTML =
        '<tr><td colspan="5">Leaderboard লোড হয়নি।</td></tr>';
    }
  }
}


// ARENAX MATCH FIXTURES, ANNOUNCEMENTS AND DISPUTES
async function loadPublicMatches() {
  try {
    const snap = await getDocs(query(collection(db, "matches"), orderBy("startsAt", "asc")));
    const docs = snap.docs.map(d => ({id:d.id, ...d.data()}));
    const box = $("#publicMatches");
    if (box) box.innerHTML = docs.map(m => `<article class="panel match-card"><div class="match-meta"><b>${escapeHTML(m.round || "Match")}</b><span class="status-pill">${escapeHTML(m.status || "upcoming")}</span></div><h3>${escapeHTML(m.participant1 || "TBD")} <span>VS</span> ${escapeHTML(m.participant2 || "TBD")}</h3><p>${escapeHTML(m.tournamentTitle || m.tournamentId || "Tournament")} • ${escapeHTML(formatTournamentDate(m.startsAt))}</p>${m.status === "completed" ? `<strong>Score: ${Number(m.score1||0)} - ${Number(m.score2||0)}</strong>` : ""}${m.status === "live" ? `<strong class="live-label">● LIVE</strong>` : ""}${currentUser && m.roomId ? `<p>Room ID: ${escapeHTML(m.roomId)} | Password: ${escapeHTML(m.roomPassword || "—")}</p>` : ""}<small>Match ID: <code>${escapeHTML(m.id)}</code></small></article>`).join("") || '<div class="panel">এখনো Fixture তৈরি হয়নি।</div>';
    const admin = $("#adminMatches");
    if (admin && isAdmin) admin.innerHTML = docs.map(m=>`<tr><td><code>${escapeHTML(m.id)}</code></td><td>${escapeHTML(m.participant1)} vs ${escapeHTML(m.participant2)}</td><td>${escapeHTML(formatTournamentDate(m.startsAt))}</td><td>${escapeHTML(m.status||"upcoming")}</td></tr>`).join("") || '<tr><td colspan="4">কোনো Fixture নেই।</td></tr>';
  } catch(e) { console.error("Match load",e); if($("#publicMatches")) $("#publicMatches").innerHTML='<div class="panel">Fixture লোড করা যায়নি।</div>'; }
}
async function loadPublicAnnouncements() {
  try {
    const snap = await getDocs(query(collection(db,"announcements"),orderBy("createdAt","desc")));
    const box=$("#publicAnnouncements");
    if(box) box.innerHTML=snap.docs.map(d=>{const a=d.data();return `<article class="panel announcement-card ${a.type==="urgent"?"urgent":""}"><small>${escapeHTML(a.type||"general")} • ${escapeHTML(formatTournamentDate(a.createdAt?.toDate?.() || a.createdAt))}</small><h3>${escapeHTML(a.title||"ARENAX Notice")}</h3><p>${escapeHTML(a.body||"")}</p></article>`}).join("") || '<div class="panel">এখনো কোনো নোটিশ নেই।</div>';
  } catch(e){console.error("Announcement load",e);}
}
async function loadPublicResults() {
  try {
    const snap=await getDocs(query(collection(db,"results"),orderBy("points","desc")));
    const box=$("#publicResults");
    if(box) box.innerHTML=`<table><thead><tr><th>Player</th><th>Position</th><th>Points</th><th>Prize</th></tr></thead><tbody>${snap.docs.map(d=>{const r=d.data();return `<tr><td>${escapeHTML(r.player||"")}</td><td>${Number(r.placement||0)}</td><td>${Number(r.points||0)}</td><td>৳${money(r.prizeAmount||0)}</td></tr>`}).join("") || '<tr><td colspan="4">ফলাফল প্রকাশ হয়নি।</td></tr>'}</tbody></table>`;
  } catch(e){console.error("Result list",e);}
}
document.addEventListener("submit", async event => {
  const form=event.target;
  if(form.id==="createMatchForm") {
    event.preventDefault(); if(!(await checkAdmin())) return showMessage("Admin permission নেই।",true);
    const d=Object.fromEntries(new FormData(form)); const t=tournamentCache.find(x=>x.id===d.tournamentId);
    if(!t) return showMessage("Tournament পাওয়া যায়নি।",true);
    try { await addDoc(collection(db,"matches"),{tournamentId:d.tournamentId,tournamentTitle:t.data.title||"",round:String(d.round).trim(),participant1:String(d.participant1).trim(),participant2:String(d.participant2).trim(),startsAt:new Date(d.startsAt).toISOString(),status:d.status||"upcoming",score1:0,score2:0,createdAt:serverTimestamp(),createdBy:auth.currentUser.uid}); form.reset(); showMessage("Fixture তৈরি হয়েছে।"); await loadPublicMatches(); } catch(e){console.error(e);showMessage(e.message||"Fixture তৈরি হয়নি।",true);}
  }
  if(form.id==="updateMatchForm") {
    event.preventDefault(); if(!(await checkAdmin())) return showMessage("Admin permission নেই।",true);
    const d=Object.fromEntries(new FormData(form));
    try { await updateDoc(doc(db,"matches",String(d.matchId).trim()),{score1:Number(d.score1),score2:Number(d.score2),status:d.status,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid}); form.reset(); showMessage("Match score আপডেট হয়েছে।"); await loadPublicMatches(); await loadPublicResults(); } catch(e){console.error(e);showMessage(e.message||"Score আপডেট হয়নি।",true);}
  }
  if(form.id==="announcementForm") {
    event.preventDefault(); if(!(await checkAdmin())) return showMessage("Admin permission নেই।",true);
    const d=Object.fromEntries(new FormData(form));
    try { await addDoc(collection(db,"announcements"),{title:String(d.title).trim(),body:String(d.body).trim(),type:d.type||"general",createdAt:serverTimestamp(),createdBy:auth.currentUser.uid}); form.reset(); showMessage("নোটিশ Publish হয়েছে।"); await loadPublicAnnouncements(); } catch(e){console.error(e);showMessage(e.message||"নোটিশ Publish হয়নি।",true);}
  }
  if(form.id==="disputeForm") {
    event.preventDefault(); if(!currentUser){showMessage("অভিযোগ জমা দিতে Login করো।",true);page("profile");return;}
    const d=Object.fromEntries(new FormData(form));
    try { await addDoc(collection(db,"disputes"),{userId:currentUser.uid,userName:currentUser.displayName||currentUser.email||"Player",subject:String(d.subject).trim(),tournamentId:String(d.tournamentId||"").trim(),details:String(d.details).trim(),evidenceUrl:String(d.evidenceUrl||"").trim(),status:"pending",createdAt:serverTimestamp()});form.reset();showMessage("অভিযোগ Admin-এর কাছে পাঠানো হয়েছে।"); } catch(e){console.error(e);showMessage(e.message||"অভিযোগ জমা হয়নি।",true);}
  }
});
async function loadAdminExtras(){
 if(!(await checkAdmin())) return;
 try {const s=await getDocs(query(collection(db,"disputes"),orderBy("createdAt","desc")));const box=$("#adminDisputes");if(box)box.innerHTML=s.docs.map(d=>{const x=d.data();return `<tr><td>${escapeHTML(x.userName||x.userId||"")}</td><td>${escapeHTML(x.subject||"")}</td><td>${escapeHTML(x.details||"")}</td><td>${x.evidenceUrl?`<a href="${escapeHTML(x.evidenceUrl)}" target="_blank" rel="noopener">Screenshot</a>`:"—"}</td><td>${escapeHTML(x.status||"pending")}</td></tr>`}).join("")||'<tr><td colspan="5">কোনো অভিযোগ নেই।</td></tr>'; }catch(e){console.error(e);}
}

// INITIAL PUBLIC DATA
loadTournaments();
loadLeaderboard();
loadPublicMatches();
loadPublicAnnouncements();
loadPublicResults();


      
