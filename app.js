import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs, query, where, orderBy, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

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
const $ = s => document.querySelector(s);
const money = n => "৳ " + Number(n || 0).toLocaleString("en-BD",{minimumFractionDigits:2,maximumFractionDigits:2});
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const formData = f => Object.fromEntries(new FormData(f).entries());
let currentUser = null, isAdmin = false, tournaments = [];

function message(txt,bad=false){const el=$("#message");el.textContent=txt;el.classList.remove("hide");el.style.borderColor=bad?"#a84d4d":"#40516e";window.scrollTo({top:0,behavior:"smooth"});}
function page(name){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${name}`));
  document.querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
  closeDrawer(); window.scrollTo({top:0,behavior:"smooth"});
}
function closeDrawer(){$("#drawer").classList.remove("open");$("#scrim").classList.remove("show");}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>page(b.dataset.page)));
$("#menuToggle").addEventListener("click",()=>{$("#drawer").classList.add("open");$("#scrim").classList.add("show");});
$("#drawerClose").addEventListener("click",closeDrawer);$("#scrim").addEventListener("click",closeDrawer);
$("#copyNumber").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(PAYMENT_NUMBER);message("পেমেন্ট নম্বর কপি হয়েছে।");}catch{message("নম্বরটি কপি করতে পারোনি: "+PAYMENT_NUMBER,true);}});

async function getRole(uid){const s=await getDoc(doc(db,"users",uid));return s.exists()?s.data().role:"player";}
function matchCard(t){const joined=Number(t.joined||0);return `<article class="match-card"><div class="match-banner">ARENA X • ${esc(t.mode||"MATCH")}</div><span class="tag">${esc(t.mode||"Solo")} MATCH</span><h3>${esc(t.title)}</h3><p class="muted">${esc(t.description||"ArenaX tournament")}</p><div class="prize">${money(t.prizePool)}</div><div class="meta"><div>ENTRY FEE<b>${money(t.entryFee)}</b></div><div>SLOTS<b>${joined}/${Number(t.slots||0)}</b></div><div>STATUS<b>${esc(t.status||"open")}</b></div><div>STARTS<b>${t.startsAt?new Date(t.startsAt).toLocaleString("bn-BD"):"TBA"}</b></div></div><button class="btn primary join-btn" data-id="${t.id}">ম্যাচে Join করো</button></article>`;}
async function loadTournaments(){
  const snap=await getDocs(query(collection(db,"tournaments"),orderBy("createdAt","desc")));
  tournaments=snap.docs.map(d=>({id:d.id,...d.data()})).filter(t=>t.status!=="hidden");
  const html=tournaments.length?tournaments.map(matchCard).join():'<div class="panel">এখনো কোনো টুর্নামেন্ট Publish করা হয়নি।</div>';
  $("#tournamentList").innerHTML=html;$("#homeTournamentList").innerHTML=tournaments.slice(0,2).map(matchCard).join()||'<div class="panel">নতুন টুর্নামেন্ট শিগগিরই আসছে।</div>';
  const options='<option value="">টুর্নামেন্ট বেছে নাও</option>'+tournaments.filter(t=>t.status==="open").map(t=>`<option value="${t.id}">${esc(t.title)} — ${esc(t.mode)}</option>`).join();
  $("#tournamentSelect").innerHTML=options;
  document.querySelectorAll(".join-btn").forEach(b=>b.addEventListener("click",()=>{page("myMatches");$("#tournamentSelect").value=b.dataset.id;}));
}
async function loadPlayer(){
  if(!currentUser){$("#balance").textContent=money(0);$("#paymentRows").innerHTML='<tr><td colspan="4">Login করলে দেখা যাবে।</td></tr>';$("#myMatchesList").textContent="ম্যাচ দেখতে Login করো।";return;}
  const [paySnap,regSnap]=await Promise.all([
    getDocs(query(collection(db,"paymentRequests"),where("userId","==",currentUser.uid))),
    getDocs(query(collection(db,"registrations"),where("userId","==",currentUser.uid)))
  ]);
  const payments=paySnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  const balance=payments.filter(p=>p.status==="approved").reduce((sum,p)=>sum+(p.type==="deposit"?Number(p.amount):-Number(p.amount)),0);
  $("#balance").textContent=money(balance);
  $("#paymentRows").innerHTML=payments.length?payments.map(p=>`<tr><td>${esc(p.type)}</td><td>${money(p.amount)}</td><td>${esc(p.method)}</td><td class="status">${esc(p.status)}</td></tr>`).join():'<tr><td colspan="4">এখনো কোনো লেনদেন নেই।</td></tr>';
  const regs=regSnap.docs.map(d=>({id:d.id,...d.data()}));
  $("#myMatchesList").innerHTML=regs.length?regs.map(r=>`<div class="match-card"><b>${esc(r.tournamentTitle)}</b><p class="muted">Player: ${esc(r.playerName)} • UID: ${esc(r.uid)}</p><p class="status">Status: ${esc(r.status)}</p></div>`).join(""):'তুমি এখনো কোনো ম্যাচে রেজিস্ট্রেশন করোনি।';
}
async function loadLeaderboard(){
  const snap=await getDocs(query(collection(db,"results"),orderBy("placement","asc")));
  const rows=snap.docs.map(d=>d.data());
  $("#leaderboardRows").innerHTML=rows.length?rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.player)}</td><td>${r.placement}</td><td>${r.points}</td></tr>`).join():'<tr><td colspan="4">এখনো ফলাফল প্রকাশ হয়নি।</td></tr>';
}
async function loadAdmin(){
  if(!isAdmin)return;
  const [pSnap,rSnap]=await Promise.all([
    getDocs(query(collection(db,"paymentRequests"),where("status","==","pending"))),
    getDocs(query(collection(db,"registrations"),where("status","==","pending")))
  ]);
  $("#adminPayments").innerHTML=pSnap.empty?'<tr><td colspan="3">কোনো Pending Payment নেই।</td></tr>':pSnap.docs.map(d=>{const p=d.data();return `<tr><td>${esc(p.userEmail||p.userId)}</td><td>${esc(p.type)}<br>${money(p.amount)}<br>${esc(p.method)}<br>Ref: ${esc(p.reference)}</td><td><button class="action-btn" data-pay="${d.id}" data-status="approved">Approve</button><button class="action-btn" data-pay="${d.id}" data-status="rejected">Reject</button></td></tr>`;}).join();
  $("#adminRegistrations").innerHTML=rSnap.empty?'<tr><td colspan="4">কোনো Pending Registration নেই।</td></tr>':rSnap.docs.map(d=>{const r=d.data();return `<tr><td>${esc(r.playerName)}</td><td>${esc(r.uid)}</td><td>${esc(r.tournamentTitle)}</td><td><button class="action-btn" data-reg="${d.id}" data-status="approved">Approve</button><button class="action-btn" data-reg="${d.id}" data-status="rejected">Reject</button></td></tr>`;}).join();
  document.querySelectorAll("[data-pay]").forEach(b=>b.addEventListener("click",async()=>{try{await updateDoc(doc(db,"paymentRequests",b.dataset.pay),{status:b.dataset.status,reviewedAt:serverTimestamp(),reviewedBy:currentUser.uid});message("Payment request "+b.dataset.status);await loadAdmin();await loadPlayer();}catch(e){message(e.message,true);}}));
  document.querySelectorAll("[data-reg]").forEach(b=>b.addEventListener("click",async()=>{try{await updateDoc(doc(db,"registrations",b.dataset.reg),{status:b.dataset.status,reviewedAt:serverTimestamp(),reviewedBy:currentUser.uid});message("Registration "+b.dataset.status);await loadAdmin();}catch(e){message(e.message,true);}}));
}
$("#signup").addEventListener("submit",async e=>{e.preventDefault();const f=formData(e.currentTarget);try{const c=await createUserWithEmailAndPassword(auth,f.email,f.password);await updateProfile(c.user,{displayName:f.name});await setDoc(doc(db,"users",c.user.uid),{displayName:f.name,email:f.email,role:"player",createdAt:serverTimestamp()});message("অ্যাকাউন্ট তৈরি হয়েছে। এখন তুমি Login করা অবস্থায় আছো।");e.currentTarget.reset();}catch(err){message(err.message,true);}});
$("#login").addEventListener("submit",async e=>{e.preventDefault();const f=formData(e.currentTarget);try{await signInWithEmailAndPassword(auth,f.email,f.password);message("Login সফল হয়েছে।");}catch(err){message(err.message,true);}});
$("#logout").addEventListener("click",async()=>{try{await signOut(auth);message("Logout হয়েছে।");}catch(e){message(e.message,true);}});
$("#registrationForm").addEventListener("submit",async e=>{e.preventDefault();if(!currentUser)return message("আগে Login করো।",true);const f=formData(e.currentTarget),t=tournaments.find(x=>x.id===f.tournamentId);if(!t)return message("টুর্নামেন্ট বেছে নাও।",true);try{await addDoc(collection(db,"registrations"),{userId:currentUser.uid,userEmail:currentUser.email,tournamentId:t.id,tournamentTitle:t.title,playerName:f.playerName,uid:f.uid,teamName:f.teamName||"",status:"pending",createdAt:serverTimestamp()});message("রেজিস্ট্রেশন জমা হয়েছে। Admin অনুমোদন করবেন।");e.currentTarget.reset();await loadPlayer();}catch(err){message(err.message,true);}});
$("#paymentForm").addEventListener("submit",async e=>{e.preventDefault();if(!currentUser)return message("আগে Login করো।",true);const f=formData(e.currentTarget),amount=Number(f.amount);if(!Number.isFinite(amount)||amount<=0)return message("সঠিক টাকার পরিমাণ দাও।",true);if(f.type==="deposit"&&f.reference.length<4)return message("সঠিক Transaction ID দাও।",true);try{await addDoc(collection(db,"paymentRequests"),{userId:currentUser.uid,userEmail:currentUser.email,type:f.type,amount,method:f.method,reference:f.reference,paymentNumber:PAYMENT_NUMBER,status:"pending",createdAt:serverTimestamp()});message("রিকোয়েস্ট জমা হয়েছে। Admin যাচাই করবেন।");e.currentTarget.reset();await loadPlayer();}catch(err){message(err.message,true);}});
$("#createTournament").addEventListener("submit",async e=>{e.preventDefault();if(!isAdmin)return message("Admin access প্রয়োজন।",true);const f=formData(e.currentTarget);try{await addDoc(collection(db,"tournaments"),{title:f.title,mode:f.mode,description:f.description,entryFee:Number(f.entryFee),prizePool:Number(f.prizePool),slots:Number(f.slots),startsAt:f.startsAt?new Date(f.startsAt).toISOString():"",status:"open",joined:0,createdAt:serverTimestamp(),createdBy:currentUser.uid});message("নতুন টুর্নামেন্ট Publish হয়েছে।");e.currentTarget.reset();await loadTournaments();}catch(err){message(err.message,true);}});
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs, query, where, orderBy, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

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
const $ = s => document.querySelector(s);
const money = n => "৳ " + Number(n || 0).toLocaleString("en-BD",{minimumFractionDigits:2,maximumFractionDigits:2});
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const formData = f => Object.fromEntries(new FormData(f).entries());
let currentUser = null, isAdmin = false, tournaments = [];

function message(txt,bad=false){const el=$("#message");el.textContent=txt;el.classList.remove("hide");el.style.borderColor=bad?"#a84d4d":"#40516e";window.scrollTo({top:0,behavior:"smooth"});}
function page(name){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${name}`));
  document.querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
  closeDrawer(); window.scrollTo({top:0,behavior:"smooth"});
}
function closeDrawer(){$("#drawer").classList.remove("open");$("#scrim").classList.remove("show");}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>page(b.dataset.page)));
$("#menuToggle").addEventListener("click",()=>{$("#drawer").classList.add("open");$("#scrim").classList.add("show");});
$("#drawerClose").addEventListener("click",closeDrawer);$("#scrim").addEventListener("click",closeDrawer);
$("#copyNumber").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(PAYMENT_NUMBER);message("পেমেন্ট নম্বর কপি হয়েছে।");}catch{message("নম্বরটি কপি করতে পারোনি: "+PAYMENT_NUMBER,true);}});

async function getRole(uid){const s=await getDoc(doc(db,"users",uid));return s.exists()?s.data().role:"player";}
function matchCard(t){const joined=Number(t.joined||0);return `<article class="match-card"><div class="match-banner">ARENA X • ${esc(t.mode||"MATCH")}</div><span class="tag">${esc(t.mode||"Solo")} MATCH</span><h3>${esc(t.title)}</h3><p class="muted">${esc(t.description||"ArenaX tournament")}</p><div class="prize">${money(t.prizePool)}</div><div class="meta"><div>ENTRY FEE<b>${money(t.entryFee)}</b></div><div>SLOTS<b>${joined}/${Number(t.slots||0)}</b></div><div>STATUS<b>${esc(t.status||"open")}</b></div><div>STARTS<b>${t.startsAt?new Date(t.startsAt).toLocaleString("bn-BD"):"TBA"}</b></div></div><button class="btn primary join-btn" data-id="${t.id}">ম্যাচে Join করো</button></article>`;}
async function loadTournaments(){
  const snap=await getDocs(query(collection(db,"tournaments"),orderBy("createdAt","desc")));
  tournaments=snap.docs.map(d=>({id:d.id,...d.data()})).filter(t=>t.status!=="hidden");
  const html=tournaments.length?tournaments.map(matchCard).join():'<div class="panel">এখনো কোনো টুর্নামেন্ট Publish করা হয়নি।</div>';
  $("#tournamentList").innerHTML=html;$("#homeTournamentList").innerHTML=tournaments.slice(0,2).map(matchCard).join()||'<div class="panel">নতুন টুর্নামেন্ট শিগগিরই আসছে।</div>';
  const options='<option value="">টুর্নামেন্ট বেছে নাও</option>'+tournaments.filter(t=>t.status==="open").map(t=>`<option value="${t.id}">${esc(t.title)} — ${esc(t.mode)}</option>`).join();
  $("#tournamentSelect").innerHTML=options;
  document.querySelectorAll(".join-btn").forEach(b=>b.addEventListener("click",()=>{page("myMatches");$("#tournamentSelect").value=b.dataset.id;}));
}
async function loadPlayer(){
  if(!currentUser){$("#balance").textContent=money(0);$("#paymentRows").innerHTML='<tr><td colspan="4">Login করলে দেখা যাবে।</td></tr>';$("#myMatchesList").textContent="ম্যাচ দেখতে Login করো।";return;}
  const [paySnap,regSnap]=await Promise.all([
    getDocs(query(collection(db,"paymentRequests"),where("userId","==",currentUser.uid))),
    getDocs(query(collection(db,"registrations"),where("userId","==",currentUser.uid)))
  ]);
  const payments=paySnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  const balance=payments.filter(p=>p.status==="approved").reduce((sum,p)=>sum+(p.type==="deposit"?Number(p.amount):-Number(p.amount)),0);
  $("#balance").textContent=money(balance);
  $("#paymentRows").innerHTML=payments.length?payments.map(p=>`<tr><td>${esc(p.type)}</td><td>${money(p.amount)}</td><td>${esc(p.method)}</td><td class="status">${esc(p.status)}</td></tr>`).join():'<tr><td colspan="4">এখনো কোনো লেনদেন নেই।</td></tr>';
  const regs=regSnap.docs.map(d=>({id:d.id,...d.data()}));
  $("#myMatchesList").innerHTML=regs.length?regs.map(r=>`<div class="match-card"><b>${esc(r.tournamentTitle)}</b><p class="muted">Player: ${esc(r.playerName)} • UID: ${esc(r.uid)}</p><p class="status">Status: ${esc(r.status)}</p></div>`).join(""):'তুমি এখনো কোনো ম্যাচে রেজিস্ট্রেশন করোনি।';
}
async function loadLeaderboard(){
  const snap=await getDocs(query(collection(db,"results"),orderBy("placement","asc")));
  const rows=snap.docs.map(d=>d.data());
  $("#leaderboardRows").innerHTML=rows.length?rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.player)}</td><td>${r.placement}</td><td>${r.points}</td></tr>`).join():'<tr><td colspan="4">এখনো ফলাফল প্রকাশ হয়নি।</td></tr>';
}
async function loadAdmin(){
  if(!isAdmin)return;
  const [pSnap,rSnap]=await Promise.all([
    getDocs(query(collection(db,"paymentRequests"),where("status","==","pending"))),
    getDocs(query(collection(db,"registrations"),where("status","==","pending")))
  ]);
  $("#adminPayments").innerHTML=pSnap.empty?'<tr><td colspan="3">কোনো Pending Payment নেই।</td></tr>':pSnap.docs.map(d=>{const p=d.data();return `<tr><td>${esc(p.userEmail||p.userId)}</td><td>${esc(p.type)}<br>${money(p.amount)}<br>${esc(p.method)}<br>Ref: ${esc(p.reference)}</td><td><button class="action-btn" data-pay="${d.id}" data-status="approved">Approve</button><button class="action-btn" data-pay="${d.id}" data-status="rejected">Reject</button></td></tr>`;}).join();
  $("#adminRegistrations").innerHTML=rSnap.empty?'<tr><td colspan="4">কোনো Pending Registration নেই।</td></tr>':rSnap.docs.map(d=>{const r=d.data();return `<tr><td>${esc(r.playerName)}</td><td>${esc(r.uid)}</td><td>${esc(r.tournamentTitle)}</td><td><button class="action-btn" data-reg="${d.id}" data-status="approved">Approve</button><button class="action-btn" data-reg="${d.id}" data-status="rejected">Reject</button></td></tr>`;}).join();
  document.querySelectorAll("[data-pay]").forEach(b=>b.addEventListener("click",async()=>{try{await updateDoc(doc(db,"paymentRequests",b.dataset.pay),{status:b.dataset.status,reviewedAt:serverTimestamp(),reviewedBy:currentUser.uid});message("Payment request "+b.dataset.status);await loadAdmin();await loadPlayer();}catch(e){message(e.message,true);}}));
  document.querySelectorAll("[data-reg]").forEach(b=>b.addEventListener("click",async()=>{try{await updateDoc(doc(db,"registrations",b.dataset.reg),{status:b.dataset.status,reviewedAt:serverTimestamp(),reviewedBy:currentUser.uid});message("Registration "+b.dataset.status);await loadAdmin();}catch(e){message(e.message,true);}}));
}
$("#signup").addEventListener("submit",async e=>{e.preventDefault();const f=formData(e.currentTarget);try{const c=await createUserWithEmailAndPassword(auth,f.email,f.password);await updateProfile(c.user,{displayName:f.name});await setDoc(doc(db,"users",c.user.uid),{displayName:f.name,email:f.email,role:"player",createdAt:serverTimestamp()});message("অ্যাকাউন্ট তৈরি হয়েছে। এখন তুমি Login করা অবস্থায় আছো।");e.currentTarget.reset();}catch(err){message(err.message,true);}});
$("#login").addEventListener("submit",async e=>{e.preventDefault();const f=formData(e.currentTarget);try{await signInWithEmailAndPassword(auth,f.email,f.password);message("Login সফল হয়েছে।");}catch(err){message(err.message,true);}});
$("#logout").addEventListener("click",async()=>{try{await signOut(auth);message("Logout হয়েছে।");}catch(e){message(e.message,true);}});
$("#registrationForm").addEventListener("submit",async e=>{e.preventDefault();if(!currentUser)return message("আগে Login করো।",true);const f=formData(e.currentTarget),t=tournaments.find(x=>x.id===f.tournamentId);if(!t)return message("টুর্নামেন্ট বেছে নাও।",true);try{await addDoc(collection(db,"registrations"),{userId:currentUser.uid,userEmail:currentUser.email,tournamentId:t.id,tournamentTitle:t.title,playerName:f.playerName,uid:f.uid,teamName:f.teamName||"",status:"pending",createdAt:serverTimestamp()});message("
