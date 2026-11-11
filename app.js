// ArenaX Firebase app. Paste your Firebase web config below.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs,
  query, where, orderBy, onSnapshot, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBKOUb6yOmDKN6h5lnaZuZvFXUAnEc4fT0",
  authDomain: "arenax-free-fire-tournament.firebaseapp.com",
  projectId: "arenax-free-fire-tournament",
  storageBucket: "arenax-free-fire-tournament.firebasestorage.app",
  messagingSenderId: "462385161284",
  appId: "1:462385161284:web:158efb7659bb350f6c0811",
  measurementId: "G-Q0BR3YKYEZ"
};
const configured = !Object.values(firebaseConfig).some(v => String(v).includes("PASTE_"));
const $ = s => document.querySelector(s);
const money = n => "৳ " + Number(n || 0).toLocaleString("en-BD");
let app, auth, db, currentUser = null, isAdmin = false, tournaments = [];
if (configured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  showMessage("প্রথমে app.js ফাইলে Firebase Web App config বসাও।", true);
}
function showMessage(message, bad=false) {
  const el = $("#message"); el.textContent = message; el.classList.remove("hide");
  el.style.color = bad ? "#ef9a91" : "#f4d98a";
}
function escapeHtml(s="") {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
async function getAdminFlag(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() && snap.data().role === "admin";
}
async function refreshTournaments() {
  const snap = await getDocs(query(collection(db,"tournaments"), orderBy("createdAt","desc")));
  tournaments = snap.docs.map(d => ({id:d.id,...d.data()}));
  const visible = tournaments.filter(t => t.status !== "hidden");
  $("#tournamentList").innerHTML = visible.length ? visible.map(t => `
    <article class="card"><span class="tag">${escapeHtml(t.mode)} MATCH</span><h3>${escapeHtml(t.title)}</h3>
    <p class="muted">${escapeHtml(t.description || "Compete in ArenaX.")}</p><div class="prize">${money(t.prizePool)}</div>
    <div class="meta"><div>ENTRY<b>${money(t.entryFee)}</b></div><div>SLOTS<b>${t.slots}</b></div><div>STATUS<b>${escapeHtml(t.status)}</b></div><div>STARTS<b>${t.startsAt ? new Date(t.startsAt).toLocaleString() : "TBA"}</b></div></div>
    <button class="btn join-btn" data-id="${t.id}">Join Match</button></article>`).join("") : '<div class="panel">এখনো কোনো টুর্নামেন্ট প্রকাশ করা হয়নি।</div>';
  $("#tournamentSelect").innerHTML = '<option value="">Choose a tournament</option>' + visible.filter(t=>t.status==="open").map(t=>`<option value="${t.id}">${escapeHtml(t.title)} — ${escapeHtml(t.mode)}</option>`).join("");
  document.querySelectorAll(".join-btn").forEach(b => b.addEventListener("click",()=>{ $("#tournamentSelect").value=b.dataset.id; location.hash="#register"; }));
}
async function refreshPlayerData() {
  if (!currentUser) {
    $("#balance").textContent="৳ 0";
    $("#paymentRows").innerHTML='<tr><td colspan="4">Login to view.</td></tr>';
    return;
  }
  const payments = await getDocs(query(collection(db,"paymentRequests"),where("userId","==",currentUser.uid)));
  const rows = payments.docs.map(d=>d.data()).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  $("#paymentRows").innerHTML = rows.length ? rows.map(p=>`<tr><td>${escapeHtml(p.type)}</td><td>${money(p.amount)}</td><td>${escapeHtml(p.method)}</td><td>${escapeHtml(p.status)}</td></tr>`).join("") : '<tr><td colspan="4">No requests yet.</td></tr>';
  const approvedDeposits = rows.filter(p=>p.type==="deposit"&&p.status==="approved").reduce((s,p)=>s+Number(p.amount),0);
  const approvedWithdrawals = rows.filter(p=>p.type==="withdraw"&&p.status==="approved").reduce((s,p)=>s+Number(p.amount),0);
  $("#balance").textContent=money(approvedDeposits-approvedWithdrawals);
}
async function refreshLeaderboard() {
  const snap=await getDocs(query(collection(db,"results"),orderBy("placement","asc")));
  const rows=snap.docs.map(d=>d.data());
  $("#leaderboardRows").innerHTML=rows.length?rows.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.player)}</td><td>${r.placement}</td><td>${r.points}</td></tr>`).join(""):'<tr><td colspan="4">No results published.</td></tr>';
}
async function loadAdmin() {
  const [paySnap, regSnap]=await Promise.all([
    getDocs(query(collection(db,"paymentRequests"),where("status","==","pending"))),
    getDocs(query(collection(db,"registrations"),where("status","==","pending")))
  ]);
  $("#adminPayments").innerHTML=paySnap.empty?'<tr><td colspan="3">No pending payments.</td></tr>':paySnap.docs.map(d=>{const p=d.data();return `<tr><td>${escapeHtml(p.userEmail||p.userId.slice(0,8))}</td><td>${escapeHtml(p.type)}<br>${money(p.amount)}<br>${escapeHtml(p.method)}<br>${escapeHtml(p.reference)}</td><td><button class="action-btn" data-payment="${d.id}" data-status="approved">Approve</button><button class="action-btn" data-payment="${d.id}" data-status="rejected">Reject</button></td></tr>`}).join("");
  $("#adminRegistrations").innerHTML=regSnap.empty?'<tr><td colspan="5">No pending registrations.</td></tr>':regSnap.docs.map(d=>{const r=d.data();return `<tr><td>${escapeHtml(r.playerName)}</td><td>${escapeHtml(r.uid)}</td><td>${escapeHtml(r.tournamentTitle)}</td><td>${escapeHtml(r.status)}</td><td><button class="action-btn" data-reg="${d.id}" data-status="approved">Approve</button><button class="action-btn" data-reg="${d.id}" data-status="rejected">Reject</button></td></tr>`}).join("");
  document.querySelectorAll("[data-payment]").forEach(b=>b.addEventListener("click",async()=>{await updateDoc(doc(db,"paymentRequests",b.dataset.payment),{status:b.dataset.status,reviewedAt:serverTimestamp(),reviewedBy:currentUser.uid});await loadAdmin();await refreshPlayerData();}));
  document.querySelectorAll("[data-reg]").forEach(b=>b.addEventListener("click",async()=>{await updateDoc(doc(db,"registrations",b.dataset.reg),{status:b.dataset.status,reviewedAt:serverTimestamp(),reviewedBy:currentUser.uid});await loadAdmin();}));
}
$("#signup").addEventListener("submit",async e=>{
  e.preventDefault(); if(!configured)return;
  try { const f=formObject(e.currentTarget); const cred=await createUserWithEmailAndPassword(auth,f.email,f.password);
    await updateProfile(cred.user,{displayName:f.name});
    await setDoc(doc(db,"users",cred.user.uid),{displayName:f.name,email:f.email,role:"player",createdAt:serverTimestamp()});
    showMessage("অ্যাকাউন্ট তৈরি হয়েছে। এখন Login করতে পারবে।"); e.currentTarget.reset();
  } catch(err){showMessage(err.message,true);}
});
$("#login").addEventListener("submit",async e=>{
  e.preventDefault();if(!configured)return;
  try{const f=formObject(e.currentTarget);await signInWithEmailAndPassword(auth,f.email,f.password);showMessage("Login successful.");}
  catch(err){showMessage(err.message,true);}
});
$("#logout").addEventListener("click",async()=>{if(auth)try{await signOut(auth);showMessage("Logout successful.");}catch(e){showMessage(e.message,true);}});
$("#registrationForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!currentUser)return showMessage("আগে Login করো।",true);
  try{const f=formObject(e.currentTarget);const t=tournaments.find(x=>x.id===f.tournamentId);if(!t)throw new Error("Tournament নির্বাচন করো।");
    await addDoc(collection(db,"registrations"),{userId:currentUser.uid,userEmail:currentUser.email,tournamentId:t.id,tournamentTitle:t.title,playerName:f.playerName,uid:f.uid,teamName:f.teamName||"",status:"pending",createdAt:serverTimestamp()});
    showMessage("Registration submitted. Admin approval pending.");e.currentTarget.reset();
  }catch(err){showMessage(err.message,true);}
});
$("#paymentForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!currentUser)return showMessage("আগে Login করো।",true);
  try{const f=formObject(e.currentTarget),amount=Number(f.amount);if(!Number.isFinite(amount)||amount<=0)throw new Error("সঠিক Amount দাও।");
    await addDoc(collection(db,"paymentRequests"),{userId:currentUser.uid,userEmail:currentUser.email,type:f.type,amount,method:f.method,reference:f.reference,status:"pending",createdAt:serverTimestamp()});
    showMessage("Payment request submitted. Admin verification pending.");e.currentTarget.reset();await refreshPlayerData();
  }catch(err){showMessage(err.message,true);}
});
$("#createTournament").addEventListener("submit",async e=>{
  e.preventDefault();if(!isAdmin)return showMessage("Admin access required.",true);
  try{const f=formObject(e.currentTarget);await addDoc(collection(db,"tournaments"),{title:f.title,mode:f.mode,description:f.description,entryFee:Number(f.entryFee),prizePool:Number(f.prizePool),slots:Number(f.slots),startsAt:f.startsAt?new Date(f.startsAt).toISOString():"",status:"open",createdAt:serverTimestamp(),createdBy:currentUser.uid});showMessage("Tournament published.");e.currentTarget.reset();await refreshTournaments();}
  catch(err){showMessage(err.message,true);}
});
$("#resultForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!isAdmin)return showMessage("Admin access required.",true);
  try{const f=formObject(e.currentTarget);await addDoc(collection(db,"results"),{player:f.player,placement:Number(f.placement),points:Number(f.points),tournamentId:f.tournamentId,createdAt:serverTimestamp(),createdBy:currentUser.uid});showMessage("Result published.");e.currentTarget.reset();await refreshLeaderboard();}
  catch(err){showMessage(err.message,true);}
});
if(auth) onAuthStateChanged(auth,async user=>{
  currentUser=user;$("#session").textContent=user?`Signed in: ${user.email}`:"Not signed in";
  if(user){try{isAdmin=await getAdminFlag(user.uid);}catch(e){isAdmin=false;showMessage("User profile not ready: "+e.message,true);}}
  else isAdmin=false;
  $("#admin").classList.toggle("hide",!isAdmin);$("#adminLink").classList.toggle("hide",!isAdmin);
  try{await refreshPlayerData();if(isAdmin)await loadAdmin();}catch(e){showMessage(e.message,true);}
});
if(configured){refreshTournaments().catch(e=>showMessage(e.message,true));refreshLeaderboard().catch(e=>showMessage(e.message,true));}
  
