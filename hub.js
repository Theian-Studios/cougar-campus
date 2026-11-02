/* Cougar Campus hub: walk the BYU walkway network (map + grid from Cougar-Man's data.js)
   and play mini-games at stations. Free play: points add up across every round. */
(() => {
  const D = window.BYU_DATA, G = window.MINIGAMES;
  const W = D.w, H = D.h, CELL = D.cell;
  const open = (x, y) => x >= 0 && y >= 0 && x < W && y < H && D.grid[y][x] === '.';
  const DIRS = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
  const key = (x, y) => y * W + x;
  const cx = gx => gx * CELL + CELL / 2, cy = gy => gy * CELL + CELL / 2;
  const $ = id => document.getElementById(id);

  // ---------- layout / camera (same approach as Cougar-Man) ----------
  const stage = $('stage'), canvas = $('hub'), ctx = canvas.getContext('2d'), mapImg = $('map');
  const mapW = D.x1 - D.x0, mapH = D.y1 - D.y0;
  let S = 1, s = 1, viewW = mapW, viewH = mapH, mobile = false;
  const cam = { x: NaN, y: NaN };
  const BOARD = location.hash === '#board';   // projector view: whole map + live leaderboard, no player
  if (BOARD) document.body.classList.add('board');
  function layout() {
    mobile = !BOARD && (Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer: coarse)').matches);
    document.body.classList.toggle('mobile', mobile);
    const vh = (window.visualViewport && visualViewport.height) || innerHeight;
    let stageW, stageH;
    if (mobile) {
      stageW = innerWidth; stageH = vh;
      s = Math.max(stageW / mapW, stageH / mapH, Math.min(stageW, stageH) / (CELL * 15));
    } else {
      const availW = BOARD ? innerWidth - 16 - 390 : Math.min(innerWidth - 16, 1100);
      const availH = vh - document.querySelector('header').offsetHeight - document.querySelector('footer').offsetHeight - 16;
      s = Math.max(0.3, Math.min(availW / mapW, availH / mapH));
      stageW = mapW * s; stageH = mapH * s;
    }
    viewW = stageW / s; viewH = stageH / s;
    stage.style.setProperty('--w', stageW + 'px'); stage.style.setProperty('--h', stageH + 'px');
    const dpr = devicePixelRatio || 1;
    canvas.width = Math.round(stageW * dpr); canvas.height = Math.round(stageH * dpr);
    S = s * dpr;
    mapImg.style.width = mapW * s + 'px'; mapImg.style.height = mapH * s + 'px';
    cam.x = cam.y = NaN;
    resizeMg();
  }
  function updateCamera(dt) {
    const clamp = (v, span, total) => span >= total ? (total - span) / 2 : Math.max(0, Math.min(total - span, v));
    const gx = clamp(player.x - viewW / 2, viewW, mapW), gy = clamp(player.y - viewH / 2, viewH, mapH);
    if (isNaN(cam.x)) { cam.x = gx; cam.y = gy; }
    else { const k = Math.min(1, dt * 7); cam.x += (gx - cam.x) * k; cam.y += (gy - cam.y) * k; }
    mapImg.style.transform = `translate(${-cam.x * s}px, ${-cam.y * s}px)`;
  }

  // ---------- grid helpers ----------
  const openCells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (open(x, y)) openCells.push({x, y});
  function nearestOpenLocal(lx, ly) {
    let best = null, bd = Infinity;
    for (const c of openCells) { const d = (cx(c.x) - lx) ** 2 + (cy(c.y) - ly) ** 2; if (d < bd) { bd = d; best = c; } }
    return best;
  }
  const nearestOpen = (mx, my) => nearestOpenLocal(mx - D.x0, my - D.y0);
  const bld = code => D.buildings.find(b => b.code === code);
  function path(from, to) { // BFS shortest walkway path, returns list of cells after `from`
    const prev = new Int32Array(W * H).fill(-1), start = key(from.x, from.y), goal = key(to.x, to.y);
    prev[start] = start; const q = [start];
    for (let i = 0; i < q.length && prev[goal] < 0; i++) {
      const k = q[i], x = k % W, y = (k - x) / W;
      for (const d of DIRS) { const nx = x + d.x, ny = y + d.y, nk = key(nx, ny); if (open(nx, ny) && prev[nk] < 0) { prev[nk] = k; q.push(nk); } }
    }
    if (prev[goal] < 0) return [];
    const out = []; for (let k = goal; k !== start; k = prev[k]) out.push({ x: k % W, y: (k - k % W) / W });
    return out.reverse();
  }

  // ---------- stations ----------
  const hrcn = bld('HRCN'), cone = bld('CONE'), hgb = bld('HGB');
  const STATIONS = [
    { id: 'creamery', name: 'The Creamery', icon: '🍦', at: nearestOpen(cone.x, cone.y), games: ['scoop'], off: {x: 0, y: 1.5} },
    { id: 'stadium', name: 'To LaVell Edwards Stadium', icon: '🏟️', at: nearestOpen(690, D.y0), games: ['fieldgoal', 'tailrun', 'qb'], off: {x: 0, y: 1.5} },
    { id: 'rockcanyon', name: 'Rock Canyon', icon: '🧗', at: nearestOpen(D.x1, 875), games: ['climb'], off: {x: -1.5, y: -0.6} },
    { id: 'ymtn', name: 'Y Mountain Trailhead', icon: '⛰️', at: nearestOpen(D.x1, 1000), games: ['sled'], off: {x: -1.5, y: -0.6} },
    { id: 'testing', name: 'Testing Center (HGB)', icon: '📝', at: nearestOpen(hgb.x, hgb.y), games: ['bubble'], off: {x: 0, y: -1.2} },
    { id: 'library', name: 'HBLL Library', icon: '📚', at: nearestOpen(bld('HBLL').x, bld('HBLL').y), games: ['shush'], off: {x: 0, y: -1.2} },
    { id: 'fieldhouse', name: 'Smith Fieldhouse', icon: '🏀', at: nearestOpen(D.x0, bld('SFH').y), games: ['freethrow'], off: {x: 1.5, y: -0.6} },
    { id: 'bean', name: 'Bean Museum', icon: '🦁', at: nearestOpen(bld('MARB').x, bld('MARB').y), games: ['bean'], off: {x: 0, y: -1.2} },
    { id: 'wilk', name: 'The Wilk', icon: '🛴', at: nearestOpen(bld('WSC').x, bld('WSC').y), games: ['scooter'], off: {x: 0, y: -1.2} },
  ];
  const markerPos = st => ({ x: cx(st.at.x) + st.off.x * CELL, y: cy(st.at.y) + st.off.y * CELL });
  const degree = c => DIRS.filter(d => open(c.x + d.x, c.y + d.y)).length;
  const START = (() => { // a walkway junction near Heritage Halls (top edge), so every direction works from the start
    let best = null, bd = Infinity;
    for (const c of openCells) { if (degree(c) < 3) continue; const d = (cx(c.x) - (hrcn.x - D.x0)) ** 2 + (cy(c.y) - 30) ** 2; if (d < bd) { bd = d; best = c; } }
    return best;
  })();

  // ---------- ward-member characters (optional members.js) ----------
  const MEMBERS = (window.MEMBERS || []).map(m => ({ ...m, first: m.name.split(' ')[0], img: null }));
  { // two Elis, two Avas…: show "Eli E." / "Eli H." on name tags so people can tell them apart
    const count = {}; for (const m of MEMBERS) count[m.first] = (count[m.first] || 0) + 1;
    for (const m of MEMBERS) if (count[m.first] > 1) { const parts = m.name.split(' '); m.first += ' ' + parts[parts.length - 1][0] + '.'; }
  }
  const photoOf = m => { if (!m.img) { m.img = new Image(); m.img.src = m.photo; } return m.img; }; // load photos only when needed
  let me = null;          // the member you picked
  let npcs = [];          // other members walking around (stand-ins for other live players)
  function drawCharacter(x, y, bobT, dir, m, isMe) {
    const bob = Math.abs(Math.sin(bobT)) * CELL * 0.14;
    // shadow on the walkway
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y + CELL * 0.5, CELL * 0.85, CELL * 0.3, 0, 0, 7); ctx.fill();
    let topY;
    const img = m && photoOf(m);
    if (img && img.complete && img.naturalWidth) {
      // real photo cut-out (head + shoulders), standing on the walkway
      const H = CELL * 2.5, Wd = H, left = x - Wd / 2, top = y + CELL * 0.55 - H - bob;
      ctx.save();
      // outline so the person pops off the map: gold for you, white for others
      ctx.shadowColor = isMe ? '#f5c842' : 'rgba(255,255,255,.95)'; ctx.shadowBlur = isMe ? 6 : 3;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(img, left + ox * 0.5, top + oy * 0.5, Wd, H);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      ctx.drawImage(img, left, top, Wd, H);
      ctx.restore();
      topY = top + H * 0.02;
    } else {
      // placeholder avatar (no photo)
      const R = CELL * 0.6, hy = y - bob - R * 0.3;
      ctx.fillStyle = '#002e5d'; ctx.strokeStyle = isMe ? '#f5c842' : '#fff'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, hy, R, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `900 ${CELL * 0.75}px sans-serif`; ctx.fillText('Y', x, hy + CELL * 0.05);
      topY = hy - R;
    }
    // name tag
    if (m) {
      ctx.font = `800 ${CELL * 0.62}px sans-serif`; const tw = ctx.measureText(m.first).width + CELL * 0.6;
      const ty = topY - CELL * 0.5;
      ctx.fillStyle = isMe ? '#f5c842' : 'rgba(6,26,54,.85)';
      ctx.beginPath(); ctx.roundRect(x - tw / 2, ty - CELL * 0.42, tw, CELL * 0.84, CELL * 0.42); ctx.fill();
      ctx.fillStyle = isMe ? '#061a36' : '#fff'; ctx.fillText(m.first, x, ty + CELL * 0.03);
    }
  }
  function makeNpc(m, cell) {
    return { m, from: {...cell}, to: {...cell}, t: 1, path: [], speed: 4 + Math.random() * 1.5, x: cx(cell.x), y: cy(cell.y),
             dir: {x: 0, y: 1}, bob: 0, wait: 1 + Math.random() * 2 };
  }
  function moveNpc(n, dt) {
    if (n.t >= 1 && !n.path.length) {
      n.wait -= dt; n.bob = 0;
      if (n.wait > 0) return;
      // head to a random station most of the time (like real players), otherwise a random walkway
      const target = Math.random() < 0.7 ? STATIONS[Math.floor(Math.random() * STATIONS.length)].at : openCells[Math.floor(Math.random() * openCells.length)];
      n.path = path(n.to, target); n.wait = 2 + Math.random() * 4;
    }
    let budget = n.speed * dt;
    while (budget > 0) {
      if (n.t >= 1) {
        n.from = { ...n.to };
        if (!n.path.length) break;
        const next = n.path.shift(); n.dir = { x: next.x - n.from.x, y: next.y - n.from.y }; n.to = next; n.t = 0;
      }
      const step = Math.min(budget, 1 - n.t); n.t += step; budget -= step;
    }
    n.x = cx(n.from.x) + (cx(n.to.x) - cx(n.from.x)) * n.t;
    n.y = cy(n.from.y) + (cy(n.to.y) - cy(n.from.y)) * n.t;
    n.bob = n.t < 1 ? n.bob + dt * 12 : 0;
  }

  // ---------- state ----------
  const player = { from: {...START}, to: {...START}, t: 1, path: [], speed: 7, x: cx(START.x), y: cy(START.y), dir: {x:0,y:1}, bob: 0 };
  let state = 'idle', points = 0, plays = 0;
  const best = {};                  // best score per game this session
  let atStation = null, tapMarker = null, floaters = [];
  const held = new Set();

  function updateHud() {
    $('points').textContent = points.toLocaleString();
  }

  // ---------- movement ----------
  const KEYS = { ArrowUp: {x:0,y:-1}, ArrowDown: {x:0,y:1}, ArrowLeft: {x:-1,y:0}, ArrowRight: {x:1,y:0},
                 w: {x:0,y:-1}, s: {x:0,y:1}, a: {x:-1,y:0}, d: {x:1,y:0} };
  // joystick vector (phones): x,y in -1..1, or null when released
  let joy = null;
  function heldDir(c) {
    if (joy) {
      const ax = Math.abs(joy.x), ay = Math.abs(joy.y);
      const prim = ax >= ay ? {x: Math.sign(joy.x), y: 0} : {x: 0, y: Math.sign(joy.y)};
      const sec = ax >= ay ? (ay > 0.3 * ax ? {x: 0, y: Math.sign(joy.y)} : null) : (ax > 0.3 * ay ? {x: Math.sign(joy.x), y: 0} : null);
      if (open(c.x + prim.x, c.y + prim.y)) return prim;
      if (sec && open(c.x + sec.x, c.y + sec.y)) return sec;
      // otherwise follow the walkway that best matches the stick (so you glide around bends instead of stopping)
      let best = null, bd = -0.15;
      for (const d of DIRS) {
        if (!open(c.x + d.x, c.y + d.y)) continue;
        let dot = (d.x * joy.x + d.y * joy.y) / (Math.hypot(joy.x, joy.y) || 1);
        if (player.dir && d.x === player.dir.x && d.y === player.dir.y) dot += 0.2; // prefer going straight
        if (dot > bd) { bd = dot; best = d; }
      }
      return best;
    }
    const ks = [...held].filter(k => KEYS[k]).reverse();
    for (const k of ks) { const d = KEYS[k]; if (open(c.x + d.x, c.y + d.y)) return d; }
    // Pac-Man-style turn buffering: keep sliding along the walkway until the held turn opens up
    if (ks.length && player.dir && open(c.x + player.dir.x, c.y + player.dir.y)) {
      const d = KEYS[ks[0]]; if (d.x !== -player.dir.x || d.y !== -player.dir.y) return player.dir;
    }
    return null;
  }
  function walkTo(cell) { player.path = path(player.t >= 1 ? player.to : player.to, cell); tapMarker = { ...cell, t: 1 }; }
  function movePlayer(dt) {
    let budget = player.speed * dt;
    while (budget > 0) {
      if (player.t >= 1) {
        player.from = { ...player.to };
        let next = null;
        const kd = heldDir(player.from);
        if (kd) { player.path = []; tapMarker = null; next = { x: player.from.x + kd.x, y: player.from.y + kd.y }; }
        else if (player.path.length) next = player.path.shift();
        if (!next) break;
        player.dir = { x: next.x - player.from.x, y: next.y - player.from.y };
        player.to = next; player.t = 0;
      }
      const step = Math.min(budget, 1 - player.t); player.t += step; budget -= step;
    }
    player.x = cx(player.from.x) + (cx(player.to.x) - cx(player.from.x)) * player.t;
    player.y = cy(player.from.y) + (cy(player.to.y) - cy(player.from.y)) * player.t;
    const moving = player.t < 1;
    player.bob = moving ? player.bob + dt * 14 : 0;
    if (tapMarker && !player.path.length && !moving) tapMarker = null;
  }
  function checkStation() {
    const here = player.t >= 1 ? player.to : null;
    const st = here ? STATIONS.find(s => Math.abs(s.at.x - here.x) + Math.abs(s.at.y - here.y) <= 1) : null;
    if (st !== atStation) { atStation = st; showSheet(st); }
  }

  // ---------- station sheet ----------
  function showSheet(st) {
    const sheet = $('sheet');
    if (!st || state !== 'play') { sheet.classList.remove('show'); document.body.classList.remove('sheet-open'); return; }
    $('sheet-title').textContent = `${st.icon} ${st.name}`;
    const box = $('sheet-games'); box.innerHTML = '';
    for (const id of st.games) {
      const g = G[id], row = document.createElement('div'); row.className = 'game-row';
      const b = best[id] != null ? ` · best ${best[id]}` : '';
      row.innerHTML = `<div class="ic">${g.icon}</div><div class="nm">${g.name}<small>${g.comingSoon ? 'Coming soon' : g.blurb + b}</small></div>`;
      const btn = document.createElement('button'); btn.textContent = g.comingSoon ? 'Soon' : 'Play'; btn.disabled = !!g.comingSoon;
      btn.onclick = () => openMinigame(id);
      row.appendChild(btn); box.appendChild(row);
    }
    sheet.classList.add('show'); document.body.classList.add('sheet-open');
  }

  // ---------- mini-game host ----------
  const mg = $('mg'), mgCanvas = $('mg-canvas'), mgCtx = mgCanvas.getContext('2d'), mgUi = $('mg-ui');
  let mgId = null, mgGame = null, mgPhase = null, mgCount = 0, mgW = 0, mgH = 0;
  function resizeMg() {
    const r = stage.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    mgW = r.width; mgH = r.height;
    mgCanvas.width = Math.round(mgW * dpr); mgCanvas.height = Math.round(mgH * dpr);
    mgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function openMinigame(id) {
    const g = G[id]; if (!g || g.comingSoon || state !== 'play') return;
    mgId = id; mgGame = null; mgPhase = 'intro';
    $('sheet').classList.remove('show');
    held.clear(); player.path = [];
    mg.classList.remove('hidden'); resizeMg();
    joy = null; joyId = null; knob.style.transform = '';
    mgUi.classList.remove('hidden');
    mgUi.innerHTML = `<div style="font-size:3rem">${g.icon}</div><h2>${g.name}</h2><p>${g.howTo}</p>
      <button class="btn" id="mg-go">Go!</button>`;
    $('mg-go').onclick = () => { initAudio(); mgPhase = 'count'; mgCount = 3; mgUi.classList.add('hidden'); sfx('beep'); };
  }
  function closeMinigame() {
    mg.classList.add('hidden'); mgId = null; mgGame = null; mgPhase = null;
    atStation = null; checkStation();
  }
  function finishMinigame(raw, detail) {
    if (mgPhase !== 'play') return;
    mgPhase = 'result';
    const earned = Math.max(0, Math.round(raw));
    points += earned; plays++;
    savePoints();
    if (NET()) NET().send({ p: points });
    best[mgId] = Math.max(best[mgId] || 0, raw);
    floaters.push({ text: `+${earned}`, x: player.x, y: player.y - CELL, t: 1.6 });
    updateHud(); sfx('win');
    mgUi.classList.remove('hidden');
    mgUi.innerHTML = `<div>${detail || ''}</div><div class="big">+${earned}</div>
      <p>Total: <b style="color:#f5c842">${points.toLocaleString()}</b></p>
      <div style="display:flex;gap:10px">
        <button class="btn" id="mg-again">Play again</button>
        <button class="btn" id="mg-back" style="background:#3fd8ff">Back to campus</button>
      </div>`;
    $('mg-again').onclick = () => openMinigame(mgId);
    $('mg-back').onclick = closeMinigame;
  }
  // ✕ mid-round needs a second tap (an accidental brush of the corner shouldn't throw away a round)
  let quitArmed = 0;
  $('mg-close').onclick = () => {
    if (mgPhase === 'play' && performance.now() - quitArmed > 2000) {
      quitArmed = performance.now(); const b = $('mg-close'); b.classList.add('armed'); b.textContent = 'Quit?';
      setTimeout(() => { b.classList.remove('armed'); b.textContent = '✕'; }, 2000);
      return;
    }
    quitArmed = 0; $('mg-close').classList.remove('armed'); $('mg-close').textContent = '✕';
    closeMinigame();
  };
  function updateMinigame(dt) {
    if (mgPhase === 'count') {
      const before = Math.ceil(mgCount); mgCount -= dt;
      if (Math.ceil(mgCount) !== before && mgCount > 0) sfx('beep');
      if (mgCount <= 0) {
        mgPhase = 'play'; sfx('go');
        mgGame = G[mgId].create({ finish: finishMinigame, sfx, data: D, mapImg, get W() { return mgW; }, get H() { return mgH; } });
      }
    } else if (mgPhase === 'play' && mgGame) mgGame.update(dt);
  }
  function drawMinigame() {
    if (!mgId) return;
    mgCtx.clearRect(0, 0, mgW, mgH);
    if (mgGame) mgGame.draw(mgCtx, mgW, mgH);
    else { mgCtx.fillStyle = '#061a36'; mgCtx.fillRect(0, 0, mgW, mgH); }
    if (mgPhase === 'count') {
      mgCtx.fillStyle = '#f5c842'; mgCtx.font = `900 ${Math.min(mgW, mgH) * 0.3}px sans-serif`;
      mgCtx.textAlign = 'center'; mgCtx.textBaseline = 'middle';
      mgCtx.fillText(String(Math.ceil(mgCount)), mgW / 2, mgH / 2); mgCtx.textBaseline = 'alphabetic';
    }
  }
  mgCanvas.addEventListener('pointerdown', e => {
    if (mgPhase !== 'play' || !mgGame) return;
    const r = mgCanvas.getBoundingClientRect();
    mgGame.tap(e.clientX - r.left, e.clientY - r.top);
  });
  mgCanvas.addEventListener('pointermove', e => { if (mgPhase === 'play' && mgGame && mgGame.move) { const r = mgCanvas.getBoundingClientRect(); mgGame.move(e.clientX - r.left, e.clientY - r.top, e.buttons > 0 || e.pointerType === 'touch'); } });
  mgCanvas.addEventListener('pointercancel', e => { if (mgGame && mgGame.release) { const r = mgCanvas.getBoundingClientRect(); mgGame.release(e.clientX - r.left, e.clientY - r.top); } });
  mgCanvas.addEventListener('pointerup', e => { if (mgGame && mgGame.release) { const r = mgCanvas.getBoundingClientRect(); mgGame.release(e.clientX - r.left, e.clientY - r.top); } });

  // ---------- session ----------
  // ---------- multiplayer (net.js → window.CC_NET) ----------
  const NET = () => window.CC_NET;
  const online = () => !!(NET() && NET().ready);
  const liveNow = () => online() && NET().status.live;          // false while the live map is paused
  const netMissing = () => !NET() || NET().status.reason === 'unavailable';   // no multiplayer at all (preview / tests)
  // points are also saved on the phone, so a reload while the network is down doesn't lose them
  const savePoints = () => { try { if (me) localStorage.setItem('cc-points-' + me.id, String(points)); } catch (e) {} };
  const loadPoints = m => { try { return +localStorage.getItem('cc-points-' + m.id) || 0; } catch (e) { return 0; } };
  const memberById = id => MEMBERS.find(m => m.id === id);
  const remotes = new Map();   // uid -> { m, x, y, tx, ty, bob, dir, s }
  function syncRemotes() {
    if (!liveNow()) { remotes.clear(); return; }     // paused: don't show people frozen in place
    const ps = NET().players, mine = NET().uid, seen = new Set();
    for (const uid in ps) {
      const r = ps[uid];
      if (uid === mine || !r || !r.on || !r.m || (r.x === 0 && r.y === 0)) continue;
      seen.add(uid);
      const tx = r.x * CELL, ty = r.y * CELL;
      let e = remotes.get(uid);
      if (!e) { e = { x: tx, y: ty, bob: 0, dir: {x: 0, y: 1} }; remotes.set(uid, e); }
      e.m = memberById(r.m) || { id: r.m, name: r.n || '?', first: (r.n || '?').split(' ')[0], photo: '' };
      e.tx = tx; e.ty = ty; e.s = r.s || '';
    }
    for (const uid of [...remotes.keys()]) if (!seen.has(uid)) remotes.delete(uid);
  }
  function moveRemotes(dt) {
    for (const e of remotes.values()) {
      const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
      if (d > CELL * 8) { e.x = e.tx; e.y = e.ty; continue; }          // teleport after a long gap
      const k = Math.min(1, dt * 8); e.x += dx * k; e.y += dy * k;
      if (d > 0.5) { e.dir = Math.abs(dx) > Math.abs(dy) ? {x: Math.sign(dx), y: 0} : {x: 0, y: Math.sign(dy)}; e.bob += dt * 12; } else e.bob = 0;
    }
  }
  function goOnline() {   // real players replace the demo wanderers
    if (!online()) return;
    npcs = [];
    if (me && !joinedNet) {
      joinedNet = true;
      NET().join(me, points).then(start => { if (start > points) { points = start; updateHud(); savePoints(); } });
    }
    syncRemotes(); renderBoard();
  }
  let joinedNet = false;
  document.addEventListener('visibilitychange', () => { if (joinedNet && NET()) NET().setOnline(!document.hidden); });
  // the leaderboard DOM is only rebuilt when it's visible, at most twice a second (80 players move ~4×/s each)
  let boardDirty = false, boardTimer = null;
  function queueBoard() {
    boardDirty = true;
    if (boardTimer || !$('board-panel').classList.contains('show')) return;
    boardTimer = setTimeout(() => { boardTimer = null; if (boardDirty) { boardDirty = false; renderBoard(); } }, 500);
  }
  window.addEventListener('cc-net-ready', () => { goOnline(); NET().onChange(() => { syncRemotes(); queueBoard(); }); });
  if (online()) setTimeout(() => window.dispatchEvent(new Event('cc-net-ready')), 0);

  // ---------- "live map paused" badge + automatic slow-phone detection ----------
  const PAUSE_TEXT = {
    'connecting': '📡 Connecting… your games still count',
    'connection': '📡 Live map paused (connection) · games & points still work',
    'slow-network': '📡 Slow connection · live map limited · games still work',
    'slow-phone': '⚡ Live map paused to keep your phone fast · tap to try again',
  };
  function showNetStatus() {
    const b = $('net-badge'); if (!b) return;
    const st = NET() && NET().status;
    const show = st && !st.live && st.reason !== 'unavailable' && state === 'play' && !(st.reason === 'connecting' && !me);
    b.textContent = show ? (PAUSE_TEXT[st.reason] || '📡 Live map paused') : '';
    b.classList.toggle('show', !!show);
    b.classList.toggle('tap', !!(show && st.reason === 'slow-phone'));
    syncRemotes(); queueBoard();
  }
  window.addEventListener('cc-net-status', showNetStatus);
  $('net-badge').onclick = () => { if (NET() && NET().status.reason === 'slow-phone') { fpsBad = 0; fpsGrace = 15; NET().resumeLive(); } };
  // if the campus map drops below ~22 fps for 6 s while other players are showing, stop streaming them on this phone
  let fpsAvg = 60, fpsBad = 0, fpsGrace = 8;
  function watchFps(dt) {
    if (!liveNow() || mgId || state !== 'play' || document.hidden || dt <= 0) return;
    if (fpsGrace > 0) { fpsGrace -= dt; return; }
    fpsAvg += (1 / Math.max(dt, 1 / 120) - fpsAvg) * 0.05;
    fpsBad = fpsAvg < 22 && remotes.size > 3 ? fpsBad + dt : 0;
    if (fpsBad > 6) { fpsBad = 0; NET().pauseLive('slow-phone'); }
  }

  // live leaderboard (🏆 panel on phones, sidebar on the projector view)
  function renderBoard() {
    const box = $('board-list'); if (!box) return;
    let rows;
    if (online()) {
      const ps = Object.assign({}, NET().players), byMember = {};
      if (me && NET().uid) ps[NET().uid] = Object.assign({}, ps[NET().uid] || { m: me.id, n: me.name, on: true }, { p: Math.max(points, (ps[NET().uid] || {}).p || 0) });
      for (const uid in ps) { const r = ps[uid]; if (!r || !r.m) continue; const cur = byMember[r.m]; if (!cur || (r.p || 0) > (cur.p || 0) || r.on) byMember[r.m] = { ...r, p: Math.max(r.p || 0, cur ? cur.p || 0 : 0), on: r.on || (cur && cur.on) }; }
      rows = Object.values(byMember).sort((a, b) => (b.p || 0) - (a.p || 0));
      $('board-status').textContent = NET().status.live ? `${rows.filter(r => r.on).length} playing now`
        : NET().status.reason === 'slow-phone' ? 'Updates every 20 s' : 'Paused · will catch up';
    } else {
      rows = me ? [{ m: me.id, n: me.name, p: points, on: true }] : [];
      $('board-status').textContent = netMissing() ? 'Offline: scores aren’t shared' : 'Connecting…';
    }
    box.innerHTML = '';
    rows.slice(0, 100).forEach((r, i) => {
      const m = memberById(r.m), li = document.createElement('div'); li.className = 'board-row' + (me && r.m === me.id ? ' me' : '');
      li.innerHTML = `<span class="rank">${i + 1}</span>${m ? `<img src="${m.photo}" alt="">` : '<span class="noimg">Y</span>'}<span class="bn">${(m ? m.name : r.n) || '?'}</span>${r.on ? '<span class="dot" title="playing"></span>' : ''}<b>${(r.p || 0).toLocaleString()}</b>`;
      box.appendChild(li);
    });
  }
  $('board-btn').onclick = () => { renderBoard(); $('board-panel').classList.toggle('show'); };
  $('board-close').onclick = () => $('board-panel').classList.remove('show');

  function pickMember(m) {
    me = m;
    points = Math.max(points, loadPoints(m));
    if (online()) goOnline();
    else if (netMissing()) {
      // no multiplayer at all (preview link / tests): a dozen other members wander campus as stand-ins
      const others = MEMBERS.filter(o => o !== m).sort(() => Math.random() - 0.5).slice(0, 12);
      npcs = others.map((o, i) => makeNpc(o, STATIONS[i % STATIONS.length].at));
    }
    startSession();
  }
  if (MEMBERS.length) {
    const box = $('who'); box.innerHTML = '';
    const cards = [];
    for (const m of MEMBERS) {
      const b = document.createElement('button'); b.className = 'who-card';
      const img = document.createElement('img'); img.loading = 'lazy'; img.src = m.photo; img.alt = m.name;
      b.appendChild(img); const sp = document.createElement('span'); sp.textContent = m.name; b.appendChild(sp);
      b.onclick = () => pickMember(m);
      box.appendChild(b); cards.push([m.name.toLowerCase(), b]);
    }
    $('who-search').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      for (const [n, b] of cards) b.style.display = !q || n.split(' ').some(w => w.startsWith(q)) || n.startsWith(q) ? '' : 'none';
    });
    $('start-btn').style.display = 'none';
    $('who-wrap').style.display = '';
  }
  function startSession() {
    initAudio();
    state = 'play';
    $('start').classList.add('hidden');
    document.body.classList.add('playing');
    showNetStatus();
    atStation = null; updateHud(); checkStation(); sfx('go');
  }
  $('start-btn').onclick = startSession;

  // ---------- input ----------
  addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (mgId) {
      if (mgPhase === 'play' && mgGame) {
        if (mgGame.key) { if (KEYS[k] || k === ' ' || k === 'Enter') e.preventDefault(); mgGame.key(k, true, e.repeat); }
        else if ((k === ' ' || k === 'Enter') && !e.repeat) { e.preventDefault(); mgGame.tap(mgW / 2, mgH / 2); }
      }
      return;
    }
    if (KEYS[k]) { e.preventDefault(); held.delete(k); held.add(k); }
    if ((k === 'Enter' || k === ' ') && state === 'play' && atStation) {
      const g = atStation.games.find(id => !G[id].comingSoon); if (g) { e.preventDefault(); openMinigame(g); }
    }
  });
  addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; held.delete(k); if (mgId && mgPhase === 'play' && mgGame && mgGame.key) mgGame.key(k, false, false); });
  addEventListener('blur', () => held.clear());
  const joyEl = $('joy'), knob = $('joy-knob');
  let joyId = null;
  function joyMove(e) {
    const r = joyEl.getBoundingClientRect(), R = r.width / 2;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const m = Math.hypot(dx, dy), lim = R * 0.62;
    if (m > lim) { dx *= lim / m; dy *= lim / m; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    joy = m > 10 ? { x: dx / lim, y: dy / lim } : null;
    if (joy) { player.path = []; tapMarker = null; }
  }
  joyEl.addEventListener('pointerdown', e => {
    e.preventDefault(); initAudio(); joyId = e.pointerId; joyEl.classList.add('active');
    try { joyEl.setPointerCapture(e.pointerId); } catch (err) {}
    joyMove(e);
  });
  joyEl.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; joy = null; joyEl.classList.remove('active'); knob.style.transform = ''; };
  joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);

  let down = null;
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; initAudio(); });
  canvas.addEventListener('pointerup', e => {
    if (!down || state !== 'play') return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 14) return;
    const r = canvas.getBoundingClientRect();
    const hx = e.clientX - r.left, hy = e.clientY - r.top;
    const hint = edgeHints.find(h => Math.hypot(h.x - hx, h.y - hy) < h.r);
    if (hint) { walkTo(hint.st.at); return; }
    const lx = cam.x + (e.clientX - r.left) / s, ly = cam.y + (e.clientY - r.top) / s;
    // tapping a station icon walks to that station
    const st = STATIONS.find(st => { const m = markerPos(st); return Math.hypot(m.x - lx, m.y - ly) < CELL * 1.6; });
    walkTo(st ? st.at : nearestOpenLocal(lx, ly));
  });

  // ---------- drawing ----------
  function draw(now) {
    ctx.setTransform(S, 0, 0, S, -cam.x * S, -cam.y * S);
    ctx.clearRect(cam.x, cam.y, viewW, viewH);
    // walkways
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,46,93,0.22)'; ctx.lineWidth = CELL * 0.55;
    ctx.beginPath();
    for (const c of openCells) {
      if (open(c.x + 1, c.y)) { ctx.moveTo(cx(c.x), cy(c.y)); ctx.lineTo(cx(c.x + 1), cy(c.y)); }
      if (open(c.x, c.y + 1)) { ctx.moveTo(cx(c.x), cy(c.y)); ctx.lineTo(cx(c.x), cy(c.y + 1)); }
    }
    ctx.stroke();
    // planned route
    if (player.path.length) {
      ctx.strokeStyle = 'rgba(245,200,66,.75)'; ctx.lineWidth = CELL * 0.18; ctx.setLineDash([CELL * 0.3, CELL * 0.35]);
      ctx.beginPath(); ctx.moveTo(player.x, player.y);
      for (const c of player.path) ctx.lineTo(cx(c.x), cy(c.y));
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (tapMarker) {
      ctx.strokeStyle = '#f5c842'; ctx.lineWidth = 1.5;
      const r = CELL * (0.4 + 0.15 * Math.sin(now / 120));
      ctx.beginPath(); ctx.arc(cx(tapMarker.x), cy(tapMarker.y), r, 0, 7); ctx.stroke();
    }
    // stations
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const st of STATIONS) {
      const m = markerPos(st), x = m.x, y = m.y + Math.sin(now / 300 + st.at.x) * CELL * 0.12;
      const playable = st.games.some(id => !G[id].comingSoon);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(cx(st.at.x), cy(st.at.y), CELL * 0.6, CELL * 0.25, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = playable ? '#f5c842' : '#9ab0d4'; ctx.lineWidth = 2;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, CELL * 1.05, 0, 7); ctx.fill(); ctx.stroke();
      if (playable) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now / 250); ctx.beginPath(); ctx.arc(x, y, CELL * 1.35, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.font = `${CELL * 1.2}px sans-serif`; ctx.fillStyle = '#000'; ctx.fillText(st.icon, x, y + CELL * 0.05);
      ctx.font = `800 ${CELL * 0.62}px sans-serif`; ctx.lineWidth = 2.5; ctx.strokeStyle = '#061a36'; ctx.fillStyle = '#f5c842';
      const label = st.name.replace('To ', '').replace(' (HGB)', '');
      const half = ctx.measureText(label).width / 2 + 2;
      const lx = Math.max(half, Math.min(mapW - half, x)), ly = st.off.y > 0 ? y + CELL * 1.85 : y - CELL * 1.75;
      ctx.strokeText(label, lx, ly); ctx.fillText(label, lx, ly);
    }
    // other members, then you on top
    const people = npcs.map(n => ({ e: n, m: n.m, me: false }))
      .concat([...remotes.values()].map(e => ({ e, m: e.m, me: false, s: e.s })))
      .concat(BOARD ? [] : [{ e: player, m: me, me: true }]).sort((a, b) => a.e.y - b.e.y);
    for (const p of people) {
      drawCharacter(p.e.x, p.e.y, p.e.bob, p.e.dir, p.m, p.me);
      if (p.s && p.s.startsWith('g:') && G[p.s.slice(2)]) {   // "playing a mini-game" bubble
        const ic = G[p.s.slice(2)].icon, bx = p.e.x + CELL * 1.1, by = p.e.y - CELL * 2.6;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, CELL * 0.6, 0, 7); ctx.fill();
        ctx.font = `${CELL * 0.75}px sans-serif`; ctx.fillStyle = '#000';
        ctx.fillText(ic.startsWith('<') ? '🎮' : ic, bx, by + CELL * 0.05);
      }
    }
    // floating point popups
    for (const f of floaters) {
      ctx.globalAlpha = Math.min(1, f.t); ctx.font = `900 ${CELL * 1.1}px sans-serif`;
      ctx.strokeStyle = '#061a36'; ctx.lineWidth = 3; ctx.fillStyle = '#f5c842';
      ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y); ctx.globalAlpha = 1;
    }
    ctx.textBaseline = 'alphabetic';
    drawEdgeHints(now);
  }

  // phone helper: stations that are off-screen get a little icon pinned to the screen edge, pointing toward them
  let edgeHints = [];
  function drawEdgeHints(now) {
    edgeHints = [];
    if (!mobile || state !== 'play') return;
    const vw = viewW * s, vh = viewH * s, pad = 30, top = 64, bottom = vh - 30;
    const pcx = vw / 2, pcy = (top + bottom) / 2; // rays start at the screen center
    const dpr = devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const st of STATIONS) {
      const m = markerPos(st), sx = (m.x - cam.x) * s, sy = (m.y - cam.y) * s;
      if (sx > 10 && sx < vw - 10 && sy > top && sy < vh - 10) continue; // visible already
      // clamp the ray from the player to the station onto the screen rectangle
      const dx = sx - pcx, dy = sy - pcy;
      let k = 1;
      if (sx < pad) k = Math.min(k, (pad - pcx) / dx);
      if (sx > vw - pad) k = Math.min(k, (vw - pad - pcx) / dx);
      if (sy < top + pad) k = Math.min(k, (top + pad - pcy) / dy);
      if (sy > bottom - pad) k = Math.min(k, (bottom - pad - pcy) / dy);
      let ex = pcx + dx * k, ey = pcy + dy * k;
      ex = Math.max(pad, Math.min(vw - pad, ex)); ey = Math.max(top + pad, Math.min(bottom - pad, ey));
      // nudge apart hints that would overlap an earlier one
      for (let pass = 0; pass < 6; pass++) {
        const h = edgeHints.find(h => Math.hypot(h.x - ex, h.y - ey) < 40);
        if (!h) break;
        if (ex <= pad + 1 || ex >= vw - pad - 1) ey = h.y + (ey < h.y || h.y > bottom - pad - 40 ? -42 : 42); else ex = h.x + (ex < h.x || h.x > vw - pad - 40 ? -42 : 42);
      }
      const ang = Math.atan2(dy, dx);
      const r = 17;
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#0b2a55'; ctx.strokeStyle = '#f5c842'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ex, ey, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f5c842'; ctx.beginPath();
      ctx.moveTo(ex + Math.cos(ang) * (r + 9), ey + Math.sin(ang) * (r + 9));
      ctx.lineTo(ex + Math.cos(ang + 0.45) * (r + 1), ey + Math.sin(ang + 0.45) * (r + 1));
      ctx.lineTo(ex + Math.cos(ang - 0.45) * (r + 1), ey + Math.sin(ang - 0.45) * (r + 1));
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
      ctx.fillText(st.icon, ex, ey + 1);
      edgeHints.push({ st, x: ex, y: ey, r: r + 8 });
    }
    ctx.textBaseline = 'alphabetic';
  }

  let nearCode = '';
  function updateNear() {
    const px = player.x + D.x0, py = player.y + D.y0;
    let bestB = null, bd = 55 * 55;
    for (const b of D.buildings) { if (!b.code) continue; const d = (b.x - px) ** 2 + (b.y - py) ** 2; if (d < bd) { bd = d; bestB = b; } }
    const code = bestB ? bestB.code : '';
    if (code !== nearCode) { nearCode = code; $('near').textContent = bestB ? `${bestB.code} — ${bestB.name}` : ''; }
  }

  // ---------- tiny synth sfx ----------
  let AC = null;
  function initAudio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); }
  let lastTap = 0;
  function sfx(kind) {
    // phones: a little haptic buzz on hits / misses (Android; iPhones ignore this)
    try { if (navigator.vibrate) { if (kind === 'hit' || kind === 'bad') navigator.vibrate(40); else if (kind === 'win') navigator.vibrate([20, 40, 20]); } } catch (e) {}
    if (!AC) return;
    const t = AC.currentTime;
    const tone = (f0, f1, dur, type = 'square', vol = 0.05, at = 0) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t + at); o.frequency.exponentialRampToValueAtTime(f1, t + at + dur);
      g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(g).connect(AC.destination); o.start(t + at); o.stop(t + at + dur + 0.02);
    };
    switch (kind) {
      case 'tap': if (t - lastTap < 0.04) return; lastTap = t; tone(260 + Math.random() * 60, 140, 0.06, 'triangle', 0.06); break;
      case 'bad': tone(180, 90, 0.2, 'sawtooth', 0.06); break;
      case 'freeze': tone(1400, 2200, 0.25, 'sine', 0.05); tone(1800, 2600, 0.25, 'sine', 0.03, 0.08); break;
      case 'beep': tone(660, 660, 0.12, 'square', 0.05); break;
      case 'go': tone(990, 990, 0.25, 'square', 0.06); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.14, 'square', 0.05, i * 0.1)); break;
      case 'coin': tone(988, 1319, 0.1, 'square', 0.04); break;
      case 'hit': tone(160, 60, 0.25, 'sawtooth', 0.07); break;
      case 'whoosh': tone(300, 1200, 0.18, 'triangle', 0.04); break;
      case 'thud': tone(120, 50, 0.15, 'square', 0.07); break;
    }
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    for (const n of npcs) moveNpc(n, dt);
    moveRemotes(dt); watchFps(dt);
    if (me && joinedNet && state === 'play') NET().send({ x: Math.round(player.x / CELL * 100) / 100, y: Math.round(player.y / CELL * 100) / 100,
      s: mgId ? 'g:' + mgId : (atStation ? atStation.id : '') });
    if (!mgId) { movePlayer(dt); if (state === 'play') checkStation(); updateNear(); }
    else updateMinigame(dt);
    floaters = floaters.filter(f => (f.t -= dt, f.y -= dt * CELL * 1.2, f.t > 0));
    updateCamera(dt); draw(now); drawMinigame();
    requestAnimationFrame(frame);
  }
  addEventListener('resize', layout);
  if (window.visualViewport) visualViewport.addEventListener('resize', layout);
  layout(); updateHud();
  if (BOARD) { $('start').classList.add('hidden'); state = 'board'; $('board-panel').classList.add('show'); renderBoard(); }
  // debug hook for automated tests
  window.CougarCampus = { get state() { return state; }, get player() { return player; }, get points() { return points; },
    STATIONS, walkTo, openMinigame, get remotes() { return remotes; }, get npcs() { return npcs; }, get me() { return me; }, get mg() { return { mgId, mgPhase }; } };
  requestAnimationFrame(frame);
})();
