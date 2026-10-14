(() => {
  "use strict";

  const CA = "GBFHyayakxkcTWUXHEJKTnWY82f5C8MpoRzB6YBopump";
  const BOT = "https://t.me/chickenbeastbot";
  const TG = "https://t.me/ChickenBeast";
  const X_URL = "https://x.com/ChickenBeastX";

  const RANKS = [
    { name: "Scrawny Chick", short: "Scrawny", need: 0 },
    { name: "Barnyard Broiler", short: "Broiler", need: 1e4 },
    { name: "Buff Hen", short: "Buff", need: 5e4 },
    { name: "Jacked Rooster", short: "Jacked", need: 15e4 },
    { name: "Gym Beast", short: "Beast", need: 5e5 },
    { name: "Too Jacked", short: "Legend", need: 2e6 },
  ];

  const UPS = [
    { id: "whey", name: "Whey Corn", desc: "More power per tap.", base: 100, effect: (l) => `+${l + 1} BP/tap`, apply: (s, l) => { s.tapPower = 1 + l; } },
    { id: "creatine", name: "Creatine Coop", desc: "Passive gains.", base: 300, effect: (l) => `${75 + l * 25} BP/hr`, apply: (s, l) => { s.perHour = 75 + l * 25; } },
    { id: "pre", name: "Pre-Workout Cluck", desc: "More stamina.", base: 500, effect: (l) => `${1000 + l * 250} stamina`, apply: (s, l) => { s.maxStamina = 1000 + l * 250; } },
  ];

  const BP_PER_COIN = 1000;
  const MIN_CLAIM = 0.1;

  const MISSIONS = [
    { id: "tap50", title: "Tap 50 times", need: 50, reward: 25, key: "taps" },
    { id: "collect", title: "Collect passive once", need: 1, reward: 40, key: "collects" },
    { id: "dash", title: "Score 50 in Beast Dash", need: 50, reward: 60, key: "dashScore" },
  ];

  const def = () => ({
    bp: 0, totalMined: 0, weekMined: 0, weekKey: weekKey(),
    stamina: 1000, maxStamina: 1000, tapPower: 1, perHour: 75,
    streak: 0, lastTap: 0,
    upgrades: { whey: 0, creatine: 0, pre: 0 },
    megaFlexUntil: 0, lastPassive: Date.now(), lastDaily: 0, dailyStreak: 0, checkins: [],
    wallet: null, walletProvider: null, refCode: null, friends: 0, refEarned: 0, claimedCoins: 0,
    sound: true,
    missionsDay: null, missions: { taps: 0, collects: 0, dashScore: 0 }, missionsClaimed: {},
    lastRankIdx: 0, passiveNotified: false,
    runBest: 0, runTotalBp: 0,
  });

  function weekKey() {
    const d = new Date();
    const onejan = new Date(d.getFullYear(), 0, 1);
    return d.getFullYear() + "-W" + Math.ceil((((d - onejan) / 864e5) + onejan.getDay() + 1) / 7);
  }
  function dayKey(ts = Date.now()) { return new Date(ts).toISOString().slice(0, 10); }

  let state = load();
  function load() {
    try {
      const r = localStorage.getItem("cbeast_v7");
      if (!r) return def();
      const s = { ...def(), ...JSON.parse(r) };
      if (s.weekKey !== weekKey()) { s.weekMined = 0; s.weekKey = weekKey(); }
      const today = dayKey();
      if (s.missionsDay !== today) {
        s.missionsDay = today;
        s.missions = { taps: 0, collects: 0, dashScore: 0 };
        s.missionsClaimed = {};
      }
      UPS.forEach((u) => u.apply(s, s.upgrades[u.id] || 0));
      return s;
    } catch { return def(); }
  }
  function save() {
    if (!state.wallet) return;
    localStorage.setItem("cbeast_v7", JSON.stringify(state));
    localStorage.setItem("cbeast_v7_" + state.wallet, JSON.stringify(state));
  }
  function loadW(a) {
    try {
      const r = localStorage.getItem("cbeast_v7_" + a) || localStorage.getItem("cbeast_v6_" + a);
      if (!r) return null;
      const s = { ...def(), ...JSON.parse(r) };
      if (s.weekKey !== weekKey()) { s.weekMined = 0; s.weekKey = weekKey(); }
      UPS.forEach((u) => u.apply(s, s.upgrades[u.id] || 0));
      return s;
    } catch { return null; }
  }

  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    document.body.classList.add("tg-webapp");
    try {
      tg.ready(); tg.expand();
      try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch {}
      tg.setHeaderColor("#0a0c10"); tg.setBackgroundColor("#0a0c10");
      if (tg.HapticFeedback) window._haptic = () => { try { tg.HapticFeedback.impactOccurred("light"); } catch {} };
    } catch {}
  }
  window._haptic = window._haptic || (() => {});

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  function toast(m, t) {
    const e = $("#toast");
    if (!e) return;
    e.textContent = m;
    e.classList.remove("hidden", "ok", "err");
    if (t === "ok") e.classList.add("ok");
    if (t === "err") e.classList.add("err");
    clearTimeout(e._t);
    e._t = setTimeout(() => e.classList.add("hidden"), 2200);
  }
  function fmt(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e4) return (n / 1e3).toFixed(1) + "K";
    return Math.floor(n).toLocaleString();
  }
  function short(a) { return a ? a.slice(0, 4) + "..." + a.slice(-4) : ""; }
  function rank() {
    let r = RANKS[0];
    for (const x of RANKS) if (state.totalMined >= x.need) r = x;
    return r;
  }
  function nextR() {
    const c = rank(), i = RANKS.indexOf(c);
    return RANKS[i + 1] || null;
  }
  function rankIdx() { return RANKS.indexOf(rank()); }
  function seasonBadge() {
    const i = rankIdx();
    if (i >= 5) return "S1 · Legend";
    if (i >= 4) return "S1 · Beast";
    if (i >= 3) return "S1 · Jacked";
    if (i >= 2) return "S1 · Buff";
    if (i >= 1) return "S1 · Broiler";
    return "S1 · Rookie";
  }
  function passive() {
    const e = Math.min(Date.now() - state.lastPassive, 8 * 36e5);
    const m = Date.now() < state.megaFlexUntil ? 2 : 1;
    return (e / 36e5) * state.perHour * m;
  }
  function dailyOk() { return Date.now() - state.lastDaily >= 864e5; }
  function refL() { return BOT + "?start=ref_" + (state.refCode || "CBGUEST"); }
  function connected() { return !!state.wallet; }

  let audioCtx = null;
  function beep() {
    if (!state.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "square"; o.frequency.value = 520 + Math.random() * 80;
      g.gain.value = 0.04; o.connect(g); g.connect(audioCtx.destination);
      o.start(); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
      o.stop(audioCtx.currentTime + 0.09);
    } catch {}
  }
  function toggleSound() {
    state.sound = !state.sound; save(); syncSoundBtn();
    toast(state.sound ? "Sound on" : "Sound muted", "ok");
  }
  function syncSoundBtn() {
    const b = $("#soundBtn");
    if (b) b.textContent = state.sound ? "🔊" : "🔇";
  }

  // Confetti
  function confettiBurst() {
    const c = $("#confetti");
    if (!c) return;
    const ctx = c.getContext("2d");
    c.width = innerWidth; c.height = innerHeight;
    const parts = [];
    for (let i = 0; i < 60; i++) {
      parts.push({
        x: innerWidth / 2, y: innerHeight * 0.4,
        vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 10 - 4,
        g: 0.25 + Math.random() * 0.15, life: 60 + Math.random() * 40,
        col: ["#ff6b2c", "#ffd166", "#c8f542", "#3dd68c", "#ff4d8d"][i % 5],
        s: 3 + Math.random() * 4,
      });
    }
    let frame = 0;
    function draw() {
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--;
        ctx.globalAlpha = Math.max(0, p.life / 80);
        ctx.fillStyle = p.col;
        ctx.fillRect(p.x, p.y, p.s, p.s);
      });
      frame++;
      if (frame < 90) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, c.width, c.height);
    }
    draw();
  }

  // TAP
  function doTap() {
    if (!connected()) { toast("Connect wallet first", "err"); return; }
    if (state.stamina < 1) { toast("Stamina empty — wait or upgrade", "err"); return; }
    const mult = Date.now() < state.megaFlexUntil ? 2 : 1;
    const gain = state.tapPower * mult;
    state.bp += gain;
    state.totalMined += gain;
    state.weekMined += gain;
    state.stamina = Math.max(0, state.stamina - 1);
    state.missions.taps = (state.missions.taps || 0) + 1;
    state.lastTap = Date.now();
    save();
    beep(); window._haptic();
    const area = $("#tapArea");
    if (area) {
      area.classList.add("hit");
      setTimeout(() => area.classList.remove("hit"), 120);
    }
    const fb = $("#tapFeedback");
    if (fb) {
      fb.textContent = "+" + gain;
      fb.classList.remove("show");
      void fb.offsetWidth;
      fb.classList.add("show");
    }
    render();
    checkRankUp();
  }

  function checkRankUp() {
    const i = rankIdx();
    if (i > state.lastRankIdx) {
      state.lastRankIdx = i;
      save();
      confettiBurst();
      toast("Rank up! " + rank().name, "ok");
    }
  }

  // PASSIVE
  function collectPassive() {
    if (!connected()) { toast("Connect wallet first", "err"); return; }
    const p = passive();
    if (p < 1) { toast("Nothing ready yet", "err"); return; }
    state.bp += p;
    state.totalMined += p;
    state.weekMined += p;
    state.lastPassive = Date.now();
    state.missions.collects = (state.missions.collects || 0) + 1;
    state.passiveNotified = false;
    save();
    confettiBurst();
    toast("+" + fmt(p) + " BP collected", "ok");
    render();
  }

  // DAILY
  function claimDaily() {
    if (!connected()) { toast("Connect wallet first", "err"); return; }
    if (!dailyOk()) { toast("Come back later", "err"); return; }
    const today = dayKey();
    const yest = dayKey(Date.now() - 864e5);
    if (state.checkins.includes(yest) || state.dailyStreak === 0) {
      state.dailyStreak = (state.checkins.includes(yest) ? state.dailyStreak : 0) + 1;
    } else {
      state.dailyStreak = 1;
    }
    if (!state.checkins.includes(today)) state.checkins.push(today);
    state.checkins = state.checkins.slice(-14);
    const reward = 50 + Math.min(state.dailyStreak, 14) * 10;
    state.bp += reward;
    state.totalMined += reward;
    state.lastDaily = Date.now();
    save();
    confettiBurst();
    toast("+" + reward + " BP · " + state.dailyStreak + " day streak", "ok");
    render();
  }

  // UPGRADES
  function buyUpgrade(id) {
    if (!connected()) { toast("Connect wallet first", "err"); return; }
    const u = UPS.find((x) => x.id === id);
    if (!u) return;
    const lvl = state.upgrades[id] || 0;
    const cost = Math.floor(u.base * Math.pow(1.55, lvl));
    if (state.bp < cost) { toast("Not enough BP", "err"); return; }
    state.bp -= cost;
    state.upgrades[id] = lvl + 1;
    u.apply(state, state.upgrades[id]);
    if (id === "pre") state.stamina = Math.min(state.stamina + 250, state.maxStamina);
    save();
    toast(u.name + " Lv." + state.upgrades[id], "ok");
    render();
  }

  function buyMega() {
    if (!connected()) { toast("Connect wallet first", "err"); return; }
    if (state.bp < 350) { toast("Need 350 BP", "err"); return; }
    state.bp -= 350;
    state.megaFlexUntil = Date.now() + 10 * 60 * 1000;
    save();
    toast("Mega Flex active 10 min!", "ok");
    render();
  }

  // MISSIONS
  function claimMission(id) {
    const m = MISSIONS.find((x) => x.id === id);
    if (!m || state.missionsClaimed[id]) return;
    const prog = state.missions[m.key] || 0;
    if (prog < m.need) return;
    state.missionsClaimed[id] = true;
    state.bp += m.reward;
    state.totalMined += m.reward;
    save();
    toast("+" + m.reward + " BP mission", "ok");
    render();
  }

  // Token claims are intentionally disabled until the on-chain program has passed
  // legal review, independent security audit and production funding/reconciliation.
  function claimCoins() {
    toast("Token claims are coming soon. No payout is promised.", "err");
  }

  // WALLET
  async function connectWallet(provider) {
    try {
      let sol;
      if (provider === "phantom") {
        sol = window.solana || window.phantom?.solana;
        if (!sol?.isPhantom) { toast("Install Phantom", "err"); return; }
      } else {
        sol = window.solflare;
        if (!sol?.isSolflare) { toast("Install Solflare", "err"); return; }
      }
      const res = await sol.connect();
      const addr = (res.publicKey || sol.publicKey).toString();
      const prev = loadW(addr);
      if (prev) {
        state = prev;
        state.wallet = addr;
        state.walletProvider = provider;
      } else {
        state.wallet = addr;
        state.walletProvider = provider;
        if (!state.refCode) state.refCode = "CB" + addr.slice(0, 6).toUpperCase();
      }
      // ref from start param
      if (tg?.initDataUnsafe?.start_param) {
        const sp = tg.initDataUnsafe.start_param;
        if (sp.startsWith("ref_") && !state.refFrom) state.refFrom = sp.slice(4);
      }
      save();
      toast("Connected " + short(addr), "ok");
      showApp();
      render();
    } catch (e) {
      toast("Connection cancelled", "err");
    }
  }

  function disconnect() {
    state.wallet = null;
    state.walletProvider = null;
    save();
    toast("Disconnected", "ok");
    render();
  }

  // RENDER
  function render() {
    const bpEl = $("#bpDisplay");
    if (bpEl) bpEl.textContent = fmt(state.bp);

    const rate = $("#ratePill");
    if (rate) {
      const m = Date.now() < state.megaFlexUntil ? 2 : 1;
      rate.textContent = (state.perHour * m) + " BP/hr" + (m > 1 ? " 🔥" : "");
    }
    const ms = $("#miningStatus");
    if (ms) ms.textContent = Date.now() < state.megaFlexUntil ? "Mega Flex" : "Mining";
    const sb = $("#seasonBadge");
    if (sb) sb.textContent = seasonBadge();

    const tp = $("#tapPower");
    if (tp) tp.textContent = "+" + state.tapPower;
    const st = $("#staminaText");
    if (st) st.textContent = Math.floor(state.stamina);
    const rn = $("#rankName");
    if (rn) rn.textContent = rank().short;
    const sk = $("#streak");
    if (sk) sk.textContent = state.dailyStreak;

    const rf = $("#rankFull");
    if (rf) rf.textContent = rank().name;
    const nr = nextR();
    const need = nr ? nr.need : rank().need;
    const prevNeed = rank().need;
    const prog = nr ? ((state.totalMined - prevNeed) / (need - prevNeed)) * 100 : 100;
    const rp = $("#rankProgress");
    if (rp) rp.textContent = fmt(state.totalMined) + " / " + fmt(need);
    const rb = $("#rankBar");
    if (rb) rb.style.width = Math.min(100, prog) + "%";
    const nx = $("#nextRank");
    if (nx) nx.textContent = nr ? nr.name : "MAX";

    const p = passive();
    const pb = $("#passiveBar");
    if (pb) pb.style.width = Math.min(100, (p / (state.perHour * 8)) * 100) + "%";
    const pp = $("#passiveBP");
    if (pp) pp.textContent = fmt(p) + " BP ready";

    const sf = $("#staminaFull");
    if (sf) sf.textContent = Math.floor(state.stamina) + " / " + state.maxStamina;
    const sbar = $("#staminaBar");
    if (sbar) sbar.style.width = (state.stamina / state.maxStamina) * 100 + "%";

    const dsl = $("#dailyStreakLabel");
    if (dsl) dsl.textContent = state.dailyStreak + " days";
    renderStreakCal();
    renderMissions();
    renderUpgrades();

    const db = $("#dailyBadge");
    if (db) db.textContent = dailyOk() ? "Ready" : "Claimed";
    const dbtn = $("#dailyBtn");
    if (dbtn) dbtn.disabled = !dailyOk();

    const mfb = $("#megaFlexBtn");
    if (mfb) mfb.disabled = state.bp < 350;

    // wallet
    const ws = $("#walletStatus");
    if (ws) {
      ws.innerHTML = connected()
        ? '<i class="dot on"></i> ' + short(state.wallet)
        : '<i class="dot off"></i> Not connected';
    }
    const cwb = $("#connectWalletBtn");
    const dwb = $("#disconnectWalletBtn");
    if (cwb) cwb.classList.toggle("hidden", connected());
    if (dwb) dwb.classList.toggle("hidden", !connected());

    const claimAmt = state.bp / BP_PER_COIN;
    const ca = $("#claimAmount");
    if (ca) ca.textContent = claimAmt.toFixed(2);
    const ct = $("#claimedTotal");
    if (ct) ct.textContent = state.claimedCoins.toFixed(2);

    const dbadge = $("#detailBadge");
    if (dbadge) dbadge.textContent = seasonBadge();
    const dr = $("#detailRank");
    if (dr) dr.textContent = rank().name;
    const dm = $("#detailMined");
    if (dm) dm.textContent = fmt(state.totalMined) + " BP";
    const du = $("#detailUser");
    if (du) du.textContent = connected() ? short(state.wallet) : "—";

    // ref
    const rl = $("#refLink");
    if (rl) rl.textContent = refL();

    // run stats
    const rbEl = $("#runBest");
    if (rbEl) rbEl.textContent = state.runBest;
    const rt = $("#runTotalBp");
    if (rt) rt.textContent = fmt(state.runTotalBp);

    renderBoard();
    syncSoundBtn();
  }

  function renderStreakCal() {
    const el = $("#streakCal");
    if (!el) return;
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = dayKey(Date.now() - i * 864e5);
      days.push(d);
    }
    const today = dayKey();
    el.innerHTML = days.map((d) => {
      const on = state.checkins.includes(d);
      const isToday = d === today;
      return `<div class="streak-day${on ? " on" : ""}${isToday ? " today" : ""}">${d.slice(8)}</div>`;
    }).join("");
  }

  function renderMissions() {
    const el = $("#missionsList");
    if (!el) return;
    let done = 0;
    el.innerHTML = MISSIONS.map((m) => {
      const prog = state.missions[m.key] || 0;
      const claimed = !!state.missionsClaimed[m.id];
      const complete = prog >= m.need;
      if (claimed || complete) done++;
      return `<div class="mission${claimed ? " done" : ""}">
        <div>
          <div>${m.title}</div>
          <strong>${Math.min(prog, m.need)}/${m.need} · +${m.reward} BP</strong>
        </div>
        ${claimed ? "<span>✓</span>" : complete ? `<button class="btn sm" data-mission="${m.id}">Claim</button>` : ""}
      </div>`;
    }).join("");
    const mp = $("#missionProgress");
    if (mp) mp.textContent = done + "/" + MISSIONS.length;
    el.querySelectorAll("[data-mission]").forEach((b) => {
      b.onclick = () => claimMission(b.dataset.mission);
    });
  }

  function renderUpgrades() {
    const el = $("#upgradesGrid");
    if (!el) return;
    el.innerHTML = UPS.map((u) => {
      const lvl = state.upgrades[u.id] || 0;
      const cost = Math.floor(u.base * Math.pow(1.55, lvl));
      return `<div class="upgrade">
        <div class="info">
          <div class="name">${u.name}</div>
          <div class="desc">${u.desc} · ${u.effect(lvl)}</div>
          <div class="lvl">Lv.${lvl}</div>
        </div>
        <button class="btn" data-up="${u.id}" ${state.bp < cost ? "disabled" : ""}>${fmt(cost)} BP</button>
      </div>`;
    }).join("");
    el.querySelectorAll("[data-up]").forEach((b) => {
      b.onclick = () => buyUpgrade(b.dataset.up);
    });
  }

  function renderBoard() {
    const mode = document.querySelector(".tab.active")?.dataset.board || "all";
    const key = mode === "week" ? "weekMined" : "totalMined";
    // This is a local demo board, not a shared/verified leaderboard.
    const fake = [];
    const youBp = mode === "week" ? state.weekMined : state.totalMined;
    const all = [...fake, { name: "You", bp: youBp, you: true }].sort((a, b) => b.bp - a.bp);
    const youIdx = all.findIndex((x) => x.you);
    const yp = $("#youPos");
    if (yp) yp.textContent = "#" + (youIdx + 1);
    const yn = $("#youName");
    if (yn) yn.textContent = connected() ? short(state.wallet) : "You";
    const yb = $("#youBp");
    if (yb) yb.textContent = fmt(youBp);

    const board = $("#leaderboard");
    if (board) {
      board.innerHTML = all.slice(0, 8).map((r, i) =>
        `<div class="lb-row${r.you ? " you" : ""}">
          <span class="lb-pos">#${i + 1}</span>
          <span class="lb-name">${r.name}</span>
          <span class="lb-bp">${fmt(r.bp)}</span>
        </div>`
      ).join("");
    }
  }

  // NAV
  function showScreen(id) {
    $$(".view").forEach((v) => v.classList.remove("active"));
    const s = $("#screen-" + id);
    if (s) s.classList.add("active");
    $$(".dock-item").forEach((d) => {
      d.classList.toggle("active", d.dataset.screen === id);
    });
    if (id === "run") initRunCanvas();
  }

  function showApp() {
    $("#landing")?.classList.add("hidden");
    $("#app")?.classList.remove("hidden");
  }
  function showLanding() {
    $("#app")?.classList.add("hidden");
    $("#landing")?.classList.remove("hidden");
  }

  // ========== BEAST DASH (simple endless runner) ==========
  let runState = null;
  let runRaf = null;

  function initRunCanvas() {
    const canvas = $("#runCanvas");
    if (!canvas) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = 360, h = 480;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!runState) drawRunIdle(ctx, w, h);
  }

  function drawRunIdle(ctx, w, h) {
    ctx.fillStyle = "#12161e";
    ctx.fillRect(0, 0, w, h);
    // ground
    ctx.fillStyle = "#2a2218";
    ctx.fillRect(0, h - 60, w, 60);
    ctx.fillStyle = "#3d3224";
    for (let x = 0; x < w; x += 40) ctx.fillRect(x, h - 60, 20, 4);
    // chicken emoji placeholder
    ctx.font = "48px serif";
    ctx.textAlign = "center";
    ctx.fillText("🐔", w / 2, h - 90);
  }

  function startRun() {
    if (!connected()) { toast("Connect wallet to earn BP", "err"); return; }
    const canvas = $("#runCanvas");
    if (!canvas) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = 360, H = 480;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    $("#runOverlay")?.classList.add("hidden");
    $("#runStartUI")?.classList.remove("hidden");
    $("#runOverUI")?.classList.add("hidden");

    runState = {
      x: 70, y: H - 120, vy: 0, onGround: true,
      score: 0, speed: 4, obstacles: [], coins: [],
      frame: 0, dead: false, groundY: H - 60,
    };

    function spawn() {
      if (Math.random() < 0.03 + runState.speed * 0.002) {
        runState.obstacles.push({ x: W + 20, w: 28, h: 36 + Math.random() * 20 });
      }
      if (Math.random() < 0.04) {
        runState.coins.push({ x: W + 10, y: H - 140 - Math.random() * 80, r: 10, taken: false });
      }
    }

    function jump() {
      if (runState && runState.onGround && !runState.dead) {
        runState.vy = -11;
        runState.onGround = false;
        beep();
      }
    }

    const onJump = (e) => { e.preventDefault(); jump(); };
    canvas.onclick = onJump;
    const keyH = (e) => { if (e.code === "Space" || e.key === " ") { e.preventDefault(); jump(); } };
    window.addEventListener("keydown", keyH);
    runState._cleanup = () => {
      canvas.onclick = null;
      window.removeEventListener("keydown", keyH);
    };

    function loop() {
      if (!runState || runState.dead) return;
      const s = runState;
      s.frame++;
      s.speed = 4 + s.frame * 0.003;
      s.score = Math.floor(s.frame / 3);

      // physics
      s.vy += 0.45;
      s.y += s.vy;
      if (s.y >= s.groundY - 50) {
        s.y = s.groundY - 50;
        s.vy = 0;
        s.onGround = true;
      }

      spawn();

      // move obstacles
      s.obstacles.forEach((o) => { o.x -= s.speed; });
      s.obstacles = s.obstacles.filter((o) => o.x > -40);
      s.coins.forEach((c) => { c.x -= s.speed; });
      s.coins = s.coins.filter((c) => c.x > -20 && !c.taken);

      // collision
      for (const o of s.obstacles) {
        if (s.x + 30 > o.x && s.x < o.x + o.w && s.y + 40 > s.groundY - o.h) {
          endRun(s.score);
          return;
        }
      }
      for (const c of s.coins) {
        if (!c.taken && Math.hypot(s.x + 20 - c.x, s.y + 20 - c.y) < 28) {
          c.taken = true;
          s.score += 5;
        }
      }

      // draw
      ctx.fillStyle = "#12161e";
      ctx.fillRect(0, 0, W, H);
      // sky gradient accent
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, "#1a2230");
      grd.addColorStop(1, "#12161e");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      // ground
      ctx.fillStyle = "#2a2218";
      ctx.fillRect(0, s.groundY, W, H - s.groundY);
      ctx.fillStyle = "#3d3224";
      const offset = (s.frame * s.speed) % 40;
      for (let x = -offset; x < W; x += 40) ctx.fillRect(x, s.groundY, 18, 3);

      // obstacles (fences)
      ctx.fillStyle = "#8b6914";
      s.obstacles.forEach((o) => {
        ctx.fillRect(o.x, s.groundY - o.h, o.w, o.h);
        ctx.fillStyle = "#a67c1a";
        ctx.fillRect(o.x + 4, s.groundY - o.h + 6, o.w - 8, 4);
        ctx.fillStyle = "#8b6914";
      });

      // coins (corn)
      s.coins.forEach((c) => {
        if (c.taken) return;
        ctx.font = "18px serif";
        ctx.textAlign = "center";
        ctx.fillText("🌽", c.x, c.y);
      });

      // player chicken
      ctx.font = "40px serif";
      ctx.textAlign = "center";
      ctx.fillText("🐔", s.x + 20, s.y + 40);

      // score HUD
      ctx.fillStyle = "#f2f4f8";
      ctx.font = "bold 16px DM Sans, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Score " + s.score, 12, 28);

      runRaf = requestAnimationFrame(loop);
    }
    runRaf = requestAnimationFrame(loop);
  }

  function endRun(score) {
    if (runState?._cleanup) runState._cleanup();
    if (runRaf) cancelAnimationFrame(runRaf);
    const bpGain = Math.floor(score / 2);
    if (bpGain > 0 && connected()) {
      state.bp += bpGain;
      state.totalMined += bpGain;
      state.weekMined += bpGain;
      state.runTotalBp = (state.runTotalBp || 0) + bpGain;
      if (score > (state.missions.dashScore || 0)) state.missions.dashScore = score;
      if (score > state.runBest) state.runBest = score;
      save();
    }
    const overlay = $("#runOverlay");
    if (overlay) overlay.classList.remove("hidden");
    $("#runStartUI")?.classList.add("hidden");
    const over = $("#runOverUI");
    if (over) over.classList.remove("hidden");
    const fs = $("#runFinalScore");
    if (fs) fs.textContent = score;
    const be = $("#runBpEarned");
    if (be) be.textContent = bpGain;
    runState = { dead: true };
    render();
    if (bpGain > 0) toast("+" + bpGain + " BP from dash!", "ok");
  }

  // EVENTS
  function bind() {
    $("#btnPhantom")?.addEventListener("click", () => connectWallet("phantom"));
    $("#btnSolflare")?.addEventListener("click", () => connectWallet("solflare"));
    $("#btnEnterApp")?.addEventListener("click", () => {
      if (connected()) showApp();
      else toast("Connect Phantom or Solflare first", "err");
    });
    $("#tapArea")?.addEventListener("pointerdown", (e) => { e.preventDefault(); doTap(); });
    $("#collectBtn")?.addEventListener("click", collectPassive);
    $("#dailyBtn")?.addEventListener("click", claimDaily);
    $("#megaFlexBtn")?.addEventListener("click", buyMega);
    $("#claimCoinBtn")?.addEventListener("click", claimCoins);
    $("#connectWalletBtn")?.addEventListener("click", () => {
      // prefer phantom
      if (window.solana?.isPhantom) connectWallet("phantom");
      else if (window.solflare?.isSolflare) connectWallet("solflare");
      else toast("Install Phantom or Solflare", "err");
    });
    $("#disconnectWalletBtn")?.addEventListener("click", disconnect);
    $("#soundBtn")?.addEventListener("click", toggleSound);
    $("#walletChip")?.addEventListener("click", () => showScreen("wallet"));
    $("#copyCa")?.addEventListener("click", () => {
      navigator.clipboard?.writeText(CA).then(() => toast("CA copied", "ok")).catch(() => toast(CA, "ok"));
    });
    $("#copyRef")?.addEventListener("click", () => {
      navigator.clipboard?.writeText(refL()).then(() => toast("Link copied", "ok"));
    });
    $("#shareRef")?.addEventListener("click", () => {
      const text = "Join me on CHICKENBEAST — too jacked to rug 🐔 " + refL();
      if (navigator.share) navigator.share({ text }).catch(() => {});
      else navigator.clipboard?.writeText(text).then(() => toast("Copied share text", "ok"));
    });

    $$(".dock-item").forEach((d) => {
      d.addEventListener("click", () => showScreen(d.dataset.screen));
    });
    $$(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        $$(".tab").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        renderBoard();
      });
    });

    $("#runStartBtn")?.addEventListener("click", startRun);
    $("#runRetryBtn")?.addEventListener("click", () => {
      $("#runOverUI")?.classList.add("hidden");
      $("#runStartUI")?.classList.remove("hidden");
      $("#runOverlay")?.classList.remove("hidden");
      startRun();
    });

    // stamina regen
    setInterval(() => {
      if (state.stamina < state.maxStamina) {
        state.stamina = Math.min(state.maxStamina, state.stamina + 0.5);
        const st = $("#staminaText");
        if (st) st.textContent = Math.floor(state.stamina);
        const sf = $("#staminaFull");
        if (sf) sf.textContent = Math.floor(state.stamina) + " / " + state.maxStamina;
        const sbar = $("#staminaBar");
        if (sbar) sbar.style.width = (state.stamina / state.maxStamina) * 100 + "%";
      }
      // passive notify
      if (passive() >= state.perHour && !state.passiveNotified) {
        state.passiveNotified = true;
      }
      // update passive bar live
      const p = passive();
      const pb = $("#passiveBar");
      if (pb) pb.style.width = Math.min(100, (p / (state.perHour * 8)) * 100) + "%";
      const pp = $("#passiveBP");
      if (pp) pp.textContent = fmt(p) + " BP ready";
    }, 2000);
  }

  // boot
  document.body.classList.remove("booting");
  document.body.classList.add("ready");
  bind();
  if (connected()) showApp();
  else showLanding();
  render();
  // online count tick
  setInterval(() => {
    const el = $("#onlineCount");
    if (el) {
      const n = 1800 + Math.floor(Math.random() * 120);
      el.textContent = n.toLocaleString();
    }
  }, 8000);
})();
