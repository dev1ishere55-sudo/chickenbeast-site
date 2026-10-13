(()=>{"use strict";
const CA="GBFHyayakxkcTWUXHEJKTnWY82f5C8MpoRzB6YBopump",BOT="https://t.me/chickenbeastbot";
const RANKS=[{name:"Scrawny Chick",short:"Scrawny",need:0},{name:"Barnyard Broiler",short:"Broiler",need:1e4},{name:"Buff Hen",short:"Buff",need:5e4},{name:"Jacked Rooster",short:"Jacked",need:15e4},{name:"Gym Beast",short:"Beast",need:5e5},{name:"Too Jacked",short:"Legend",need:2e6}];
const UPS=[{id:"whey",name:"Whey Corn",desc:"More power.",base:100,effect:l=>`+${l+1} BP/tap`,apply:(s,l)=>{s.tapPower=1+l}},{id:"creatine",name:"Creatine Coop",desc:"Passive gains.",base:300,effect:l=>`${75+l*25} BP/hr`,apply:(s,l)=>{s.perHour=75+l*25}},{id:"pre",name:"Pre-Workout Cluck",desc:"More stamina.",base:500,effect:l=>`${1000+l*250} stamina`,apply:(s,l)=>{s.maxStamina=1000+l*250}}];
const BP_PER_COIN=1000,MIN_CLAIM=0.1;
const def=()=>({bp:0,totalMined:0,stamina:1000,maxStamina:1000,tapPower:1,perHour:75,streak:0,lastTap:0,upgrades:{whey:0,creatine:0,pre:0},megaFlexUntil:0,lastPassive:Date.now(),lastDaily:0,dailyStreak:0,wallet:null,walletProvider:null,refCode:null,friends:0,refEarned:0,claimedCoins:0});
let state=load();
function load(){try{const r=localStorage.getItem("cbeast_v5");if(!r)return def();const s={...def(),...JSON.parse(r)};UPS.forEach(u=>u.apply(s,s.upgrades[u.id]||0));return s}catch{return def()}}
function save(){if(!state.wallet)return;localStorage.setItem("cbeast_v5",JSON.stringify(state));localStorage.setItem("cbeast_v5_"+state.wallet,JSON.stringify(state))}
function loadW(a){try{const r=localStorage.getItem("cbeast_v5_"+a);if(!r)return null;const s={...def(),...JSON.parse(r)};UPS.forEach(u=>u.apply(s,s.upgrades[u.id]||0));return s}catch{return null}}
const tg=window.Telegram&&window.Telegram.WebApp;
if(tg){document.body.classList.add("tg-webapp");try{tg.ready();tg.expand();tg.setHeaderColor("#0b0614");tg.setBackgroundColor("#0b0614");if(tg.HapticFeedback)window._haptic=()=>{try{tg.HapticFeedback.impactOccurred("light")}catch{}}}catch{}}
window._haptic=window._haptic||(()=>{});
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
function toast(m){const e=$("#toast");e.textContent=m;e.classList.remove("hidden");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.add("hidden"),2400)}
function fmt(n){if(n>=1e6)return(n/1e6).toFixed(1)+"M";if(n>=1e4)return(n/1e3).toFixed(1)+"K";return Math.floor(n).toLocaleString()}
function short(a){return a?a.slice(0,4)+"..."+a.slice(-4):""}
function rank(){let r=RANKS[0];for(const x of RANKS)if(state.totalMined>=x.need)r=x;return r}
function nextR(){const c=rank(),i=RANKS.indexOf(c);return RANKS[i+1]||null}
function passive(){const e=Math.min(Date.now()-state.lastPassive,8*36e5),m=Date.now()<state.megaFlexUntil?2:1;return e/36e5*state.perHour*m}
function dailyOk(){return Date.now()-state.lastDaily>=864e5}
function refL(){return BOT+"?start=ref_"+(state.refCode||"CBGUEST")}
function connected(){return!!state.wallet}
function showApp(){$("#landing").classList.add("hidden");$("#app").classList.remove("hidden");render()}
function showLanding(){$("#app").classList.add("hidden");$("#landing").classList.remove("hidden")}

function providers(){
  const L=[];
  if(window.solana?.isPhantom)L.push({id:"phantom",name:"Phantom",p:window.solana});
  else if(window.phantom?.solana?.isPhantom)L.push({id:"phantom",name:"Phantom",p:window.phantom.solana});
  if(window.solflare?.isSolflare||window.solflare)L.push({id:"solflare",name:"Solflare",p:window.solflare});
  if(!L.length&&window.solana)L.push({id:"solana",name:"Wallet",p:window.solana});
  return L;
}
function findProvider(id){
  const L=providers();
  if(id==="phantom")return L.find(x=>x.id==="phantom")||L[0];
  if(id==="solflare")return L.find(x=>x.id==="solflare")||L.find(x=>x.id==="phantom")||L[0];
  return L[0];
}
async function connectWith(m){
  if(!m||!m.p){
    if(m?.id==="phantom"){window.open("https://phantom.app/ul/browse/"+encodeURIComponent(location.href),"_blank");toast("Open Phantom to connect");return}
    if(m?.id==="solflare"){window.open("https://solflare.com/","_blank");toast("Install Solflare");return}
    toast("Install Phantom or Solflare");return;
  }
  try{
    const r=await m.p.connect();
    const k=r?.publicKey?.toString()||m.p.publicKey?.toString();
    if(!k)throw new Error("nokey");
    const ex=loadW(k);
    if(ex){state=ex;state.wallet=k;state.walletProvider=m.id}
    else{state.wallet=k;state.walletProvider=m.id;if(!state.refCode)state.refCode="CB"+k.slice(-6).toUpperCase()}
    save();showApp();toast("Connected · "+m.name);window._haptic();
  }catch(e){toast(/reject|cancel/i.test(String(e?.message||e))?"Cancelled":"Connect failed")}
}
function pickWallet(){
  const L=providers();
  if(!L.length){toast("Install Phantom or Solflare");window.open("https://phantom.app/","_blank");return}
  if(L.length===1){connectWith(L[0]);return}
  let o=$("#walletPicker");
  if(!o){o=document.createElement("div");o.id="walletPicker";o.className="picker-overlay";document.body.appendChild(o)}
  o.innerHTML=`<div class="picker-sheet"><div class="picker-title">Connect wallet</div><p class="picker-sub">Phantom or Solflare · Solana mainnet</p>${L.map(p=>`<button class="picker-btn" data-id="${p.id}"><span>${p.id[0].toUpperCase()}</span> ${p.name}</button>`).join("")}<button class="picker-cancel" id="pickerCancel">Cancel</button></div>`;
  o.classList.add("open");
  o.querySelectorAll(".picker-btn").forEach(b=>b.onclick=()=>{const m=L.find(x=>x.id===b.dataset.id);o.classList.remove("open");if(m)connectWith(m)});
  $("#pickerCancel").onclick=()=>o.classList.remove("open");
  o.onclick=e=>{if(e.target===o)o.classList.remove("open")};
}
async function disconnect(){const L=providers();const m=L.find(x=>x.id===state.walletProvider)||L[0];try{await m?.p?.disconnect?.()}catch{}state.wallet=null;state.walletProvider=null;render();toast("Disconnected")}

$$(".nav-item").forEach(b=>b.onclick=()=>{$$(".nav-item").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".screen").forEach(s=>s.classList.remove("active"));$("#screen-"+b.dataset.screen).classList.add("active");window._haptic()});
$("#walletChip")&&($("#walletChip").onclick=()=>{$$(".nav-item").forEach(x=>x.classList.remove("active"));$$('.nav-item[data-screen="wallet"]')[0]?.classList.add("active");$$(".screen").forEach(s=>s.classList.remove("active"));$("#screen-wallet").classList.add("active")});

function render(){
  if($("#app").classList.contains("hidden"))return;
  const c=connected();
  $("#bpDisplay").textContent=fmt(state.bp);
  $("#ratePill").textContent=" "+fmt(state.perHour)+" BP/hr";
  const mx=Date.now()<state.megaFlexUntil;
  $("#miningStatus").textContent=mx?" 2x Mega Flex":" Mining";
  $("#miningStatus").style.color=mx?"var(--orange)":"var(--green)";
  $("#tapPower").textContent="+"+state.tapPower;
  $("#staminaText").textContent=fmt(state.stamina);
  $("#streak").textContent=state.streak;
  const rk=rank(),nx=nextR();
  $("#rankName").textContent=rk.short;$("#rankFull").textContent=rk.name;
  if(nx){const p=state.totalMined-rk.need,n=nx.need-rk.need;$("#rankProgress").textContent=fmt(p)+" / "+fmt(n);$("#rankBar").style.width=Math.min(100,p/n*100)+"%";$("#nextRank").textContent=nx.name}
  else{$("#rankProgress").textContent="MAX";$("#rankBar").style.width="100%";$("#nextRank").textContent="-"}
  $("#staminaFull").textContent=fmt(state.stamina)+" / "+fmt(state.maxStamina);
  $("#staminaBar").style.width=state.stamina/state.maxStamina*100+"%";
  const pa=passive();$("#passiveBP").textContent=fmt(pa)+" BP ready";$("#passiveBar").style.width=Math.min(100,pa/(state.perHour*8)*100)+"%";$("#collectBtn").disabled=pa<1;
  $("#upgradesGrid").innerHTML=UPS.map(u=>{const l=state.upgrades[u.id]||0,cost=Math.floor(u.base*Math.pow(1.6,l));return`<div class="upgrade-card"><div class="upgrade-top"><span class="upgrade-name">${u.name}</span><span class="upgrade-lvl">LVL ${l+1}</span></div><p class="upgrade-desc">${u.desc}</p><p class="upgrade-effect">${u.effect(l)}</p><button class="btn btn-primary full" data-u="${u.id}" ${!c||state.bp<cost?"disabled":""}>${!c?"Connect wallet":"Upgrade · "+fmt(cost)+" BP"}</button></div>`}).join("");
  $("#upgradesGrid").querySelectorAll("[data-u]").forEach(b=>b.onclick=()=>{if(!c){pickWallet();return}buy(b.dataset.u)});
  const mf=$("#megaFlexBtn");
  if(Date.now()<state.megaFlexUntil){mf.textContent=Math.ceil((state.megaFlexUntil-Date.now())/1e3)+"s";mf.disabled=true}
  else{mf.textContent=c?"350 BP":"Connect";mf.disabled=!c||state.bp<350}
  const ok=dailyOk(),rw=50+state.dailyStreak*10;
  $("#dailyBadge").textContent=ok?"Ready":"Claimed";
  $("#dailyBtn").textContent=!c?"Connect wallet":ok?"Claim daily · +"+rw+" BP":"Come back tomorrow";
  $("#dailyBtn").disabled=!c||!ok;
  $("#refCode").textContent=c?(state.refCode||short(state.wallet)):"Connect wallet";
  $("#friendCount").textContent=state.friends;$("#refEarned").textContent=fmt(state.refEarned)+" BP";
  $("#copyRef").disabled=!$("#shareRef").disabled=!c;
  $("#walletStatus").innerHTML=c?`<span class="dot on"></span><span>${short(state.wallet)} · ${state.walletProvider||"wallet"}</span>`:`<span class="dot off"></span><span>Not connected</span>`;
  const cb=$("#connectWalletBtn"),db=$("#disconnectWalletBtn");
  if(c){cb.classList.add("hidden");db?.classList.remove("hidden")}else{cb.classList.remove("hidden");cb.textContent="Connect Phantom / Solflare";db?.classList.add("hidden")}
  const cl=state.bp/BP_PER_COIN;
  if($("#claimAmount"))$("#claimAmount").textContent=cl.toFixed(2);
  if($("#claimedTotal"))$("#claimedTotal").textContent=fmt(state.claimedCoins||0);
  const claimBtn=$("#claimCoinBtn");
  if(claimBtn){claimBtn.disabled=!c||cl<MIN_CLAIM;claimBtn.textContent=!c?"Connect wallet to claim":cl<MIN_CLAIM?"Mine more BP":"Claim "+cl.toFixed(2)+" $CBEAST"}
  $("#detailRank").textContent=rk.name;$("#detailMined").textContent=fmt(state.totalMined)+" BP";$("#detailUser").textContent=c?short(state.wallet):"Not signed in";
  if($("#walletChip"))$("#walletChip").textContent=c?"OK":"◎";
  $("#onlineCount").textContent=(1200+Math.floor(Math.sin(Date.now()/6e4)*80)+Math.floor(Math.random()*20)).toLocaleString();
}
function need(a){if(connected())return true;toast("Connect wallet to "+(a||"continue"));pickWallet();return false}
function doTap(e){e?.preventDefault();if(state.stamina<1){toast("Out of stamina");return}const m=Date.now()<state.megaFlexUntil?2:1,g=state.tapPower*m;state.bp+=g;state.totalMined+=g;state.stamina-=1;state.streak=Math.min(12,state.streak+1);state.lastTap=Date.now();save();render();window._haptic();const f=$("#tapFeedback");f.textContent="+"+g;f.classList.remove("pop");void f.offsetWidth;f.classList.add("pop")}
function buy(id){if(!need("upgrade"))return;const u=UPS.find(x=>x.id===id);if(!u)return;const l=state.upgrades[id]||0,cost=Math.floor(u.base*Math.pow(1.6,l));if(state.bp<cost)return;state.bp-=cost;state.upgrades[id]=l+1;u.apply(state,state.upgrades[id]);save();render();toast(u.name+" upgraded!");window._haptic()}
function collect(){const a=passive();if(a<1)return;state.bp+=a;state.totalMined+=a;state.lastPassive=Date.now();save();render();toast("Collected "+fmt(a)+" BP")}
function mega(){if(!need("Mega Flex"))return;if(state.bp<350||Date.now()<state.megaFlexUntil)return;state.bp-=350;state.megaFlexUntil=Date.now()+6e5;save();render();toast("2x Mega Flex · 10 min!")}
function daily(){if(!need("claim"))return;if(!dailyOk())return;const r=50+state.dailyStreak*10;state.bp+=r;state.totalMined+=r;state.dailyStreak=Date.now()-state.lastDaily<1728e5?state.dailyStreak+1:1;state.lastDaily=Date.now();save();render();toast("Daily +"+r+" BP")}
function claimCoins(){if(!need("claim coins"))return;const amt=state.bp/BP_PER_COIN;if(amt<MIN_CLAIM){toast("Min claim "+MIN_CLAIM);return}const coins=Math.floor(amt*100)/100;const bpCost=Math.floor(coins*BP_PER_COIN);if(bpCost<1||state.bp<bpCost)return;state.bp-=bpCost;state.claimedCoins=(state.claimedCoins||0)+coins;save();render();toast("Claimed "+coins.toFixed(2)+" $CBEAST → "+short(state.wallet));window._haptic()}

$("#btnPhantom")&&($("#btnPhantom").onclick=()=>connectWith(findProvider("phantom")||{id:"phantom"}));
$("#btnSolflare")&&($("#btnSolflare").onclick=()=>connectWith(findProvider("solflare")||{id:"solflare"}));
$("#btnEnterApp")&&($("#btnEnterApp").onclick=()=>{if(connected())showApp();else pickWallet()});
$("#tapArea")?.addEventListener("pointerdown",doTap);
$("#collectBtn")&&($("#collectBtn").onclick=collect);
$("#megaFlexBtn")&&($("#megaFlexBtn").onclick=mega);
$("#dailyBtn")&&($("#dailyBtn").onclick=daily);
$("#connectWalletBtn")&&($("#connectWalletBtn").onclick=pickWallet);
$("#disconnectWalletBtn")&&($("#disconnectWalletBtn").onclick=disconnect);
$("#claimCoinBtn")&&($("#claimCoinBtn").onclick=claimCoins);
$("#copyCa")&&($("#copyCa").onclick=async()=>{try{await navigator.clipboard.writeText(CA);toast("CA copied")}catch{toast(CA)}});
$("#copyRef")&&($("#copyRef").onclick=async()=>{if(!need("referral"))return;const l=refL();try{await navigator.clipboard.writeText(l);toast("Link copied")}catch{toast(l)}});
$("#shareRef")&&($("#shareRef").onclick=()=>{if(!need("share"))return;const l=refL();if(tg?.openTelegramLink)tg.openTelegramLink("https://t.me/share/url?url="+encodeURIComponent(l)+"&text="+encodeURIComponent("Too Jacked To Rug"));else if(navigator.share)navigator.share({title:"CHICKENBEAST",url:l}).catch(()=>{});else{navigator.clipboard?.writeText(l);toast("Link copied")}});

setInterval(()=>{if($("#app").classList.contains("hidden"))return;if(state.stamina<state.maxStamina){state.stamina=Math.min(state.maxStamina,state.stamina+1);save()}if(state.streak>0&&Date.now()-state.lastTap>3e4){state.streak=0;save()}if(state.megaFlexUntil&&Date.now()>=state.megaFlexUntil){state.megaFlexUntil=0;save()}render()},3e3);

(async()=>{
  for(const p of providers()){
    try{
      if(p.p.isConnected&&p.p.publicKey){
        const a=p.p.publicKey.toString(),ex=loadW(a);
        state=ex||state;state.wallet=a;state.walletProvider=p.id;
        if(!state.refCode)state.refCode="CB"+a.slice(-6).toUpperCase();
        save();showApp();return;
      }
    }catch{}
  }
  if(tg&&localStorage.getItem("cbeast_seen_app")==="1"&&connected())showApp();
  else showLanding();
})();
$("#btnEnterApp")&&document.addEventListener("click",()=>{localStorage.setItem("cbeast_seen_app","1")},{once:true});
})();
