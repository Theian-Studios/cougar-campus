/* Scooter Dash: a 45-second Pac-Man on the BYU campus walkway grid (same grid/map as Cougar-Man).
   Eat Cougar Tail bites, dodge campus hazards, grab chocolate milk to bump them out of the way. */
window.MINIGAMES.scooter = {
  name: 'Scooter Dash',
  icon: '🛴',
  blurb: 'Pac-Man on a scooter',
  howTo: '<b>Swipe</b> (or arrow keys) to steer. Eat Cougar Tail bites, dodge 👮🐿️🚶🤷.<br>🥛 Chocolate milk = 5 s of speed: bump hazards for bonus points!',
  create(api) {
    const D = api.data, mapImg = api.mapImg;
    const GW = D.w, GH = D.h, CELL = D.cell;
    const mapW = D.x1 - D.x0, mapH = D.y1 - D.y0;
    const isOpen = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && D.grid[y][x] === '.';
    const DIRS = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
    const K = (x, y) => y * GW + x;
    const cx = gx => gx * CELL + CELL / 2, cy = gy => gy * CELL + CELL / 2;

    const DUR = 27, LIVES = 3, POWER_DUR = 5;
    const P_SPEED = 5.6;

    function bfs(sx, sy) {
      const dist = new Int32Array(GW * GH).fill(-1);
      const q = [K(sx, sy)]; dist[q[0]] = 0;
      for (let i = 0; i < q.length; i++) {
        const k = q[i], x = k % GW, y = (k - x) / GW;
        for (const d of DIRS) {
          const nx = x + d.x, ny = y + d.y;
          if (isOpen(nx, ny) && dist[K(nx, ny)] < 0) { dist[K(nx, ny)] = dist[k] + 1; q.push(K(nx, ny)); }
        }
      }
      return dist;
    }
    // nearest open cell to absolute map coords, restricted to the main connected network
    const allOpen = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (isOpen(x, y)) allOpen.push({x, y});
    const degree = c => DIRS.filter(d => isOpen(c.x + d.x, c.y + d.y)).length;
    function nearestIn(cells, mx, my, minDeg = 0) {
      const lx = mx - D.x0, ly = my - D.y0; let best = null, bd = Infinity;
      for (const c of cells) { if (degree(c) < minDeg) continue; const d = (cx(c.x) - lx) ** 2 + (cy(c.y) - ly) ** 2; if (d < bd) { bd = d; best = c; } }
      return best;
    }
    const START = nearestIn(allOpen, 800, 880, 3) || allOpen[0];
    const startDist = bfs(START.x, START.y);
    const cells = allOpen.filter(c => startDist[K(c.x, c.y)] >= 0);
    const nearest = (mx, my, md) => nearestIn(cells, mx, my, md);
    const midX = (D.x0 + D.x1) / 2, midY = (D.y0 + D.y1) / 2;
    const corners = [nearest(D.x0, D.y0), nearest(D.x1, D.y0), nearest(D.x0, D.y1), nearest(D.x1, D.y1)];

    // pickups
    const MILK = new Set([...corners, nearest(midX, D.y1), nearest(D.x1, midY)].map(c => K(c.x, c.y)));
    const dots = new Set();
    function fillDots() {
      for (const c of cells) if ((c.x + c.y) % 2 === 0) dots.add(K(c.x, c.y));
      dots.delete(K(START.x, START.y));
      for (const m of MILK) dots.add(m);
    }
    fillDots();

    // ---------- entities ----------
    function ent(cell, speed) { return { from: {...cell}, to: {...cell}, t: 1, dir: null, want: null, speed, x: cx(cell.x), y: cy(cell.y) }; }
    function pos(e) {
      e.x = cx(e.from.x) + (cx(e.to.x) - cx(e.from.x)) * e.t;
      e.y = cy(e.from.y) + (cy(e.to.y) - cy(e.from.y)) * e.t;
    }
    function reverse(e) {
      if (e.t >= 1 || !e.dir) return;
      [e.from, e.to] = [e.to, e.from]; e.t = 1 - e.t; e.dir = {x: -e.dir.x, y: -e.dir.y};
    }
    function advance(e, dt, choose) {
      let budget = e.speed * dt;
      while (budget > 0) {
        if (e.t >= 1) {
          e.from = {...e.to};
          const d = choose(e.from);
          if (!d) { e.dir = null; pos(e); return; }
          e.dir = d; e.to = {x: e.from.x + d.x, y: e.from.y + d.y}; e.t = 0;
        }
        const step = Math.min(budget, 1 - e.t);
        e.t += step; budget -= step;
      }
      pos(e);
    }
    const player = ent(START, P_SPEED);
    player.face = 1; player.wob = 0;
    const playerChoose = c => {
      if (player.want && isOpen(c.x + player.want.x, c.y + player.want.y)) { const d = player.want; player.want = null; return d; }
      if (player.dir && isOpen(c.x + player.dir.x, c.y + player.dir.y)) return player.dir;
      return null;
    };
    let started = false;
    function setWant(d) {
      if (done) return;
      started = true;
      if (d.x) player.face = d.x;
      if (player.dir && d.x === -player.dir.x && d.y === -player.dir.y && player.t < 1) { reverse(player); player.want = null; }
      else player.want = d;
    }

    // hazards: home = respawn corner, delay = seconds before they leave home
    const HAZ = [
      { id: 'cop',   icon: '👮', name: 'Parking Officer', color: '#ff3b30', speed: 3.9, home: corners[1], delay: 4 },
      { id: 'sq',    icon: '🐿️', name: 'Squirrel',        color: '#b8733a', speed: 4.3, home: corners[0], delay: 6 },
      { id: 'tour',  icon: '🚶', name: 'Tour Group',      color: '#3fd8ff', speed: 2.6, home: nearest(midX, D.y1), delay: 1.5 },
      { id: 'fresh', icon: '🤷', name: 'Lost Freshman',   color: '#ffa03b', speed: 3.6, home: corners[3], delay: 3 },
    ];
    const hazards = HAZ.map(def => Object.assign(ent(def.home, def.speed), { def, state: 'wait', timer: def.delay, fly: null }));
    function sendHome(h, wait) {
      Object.assign(h, ent(h.def.home, h.def.speed));
      h.state = 'wait'; h.timer = wait;
    }

    let playerDist = null, aheadDist = null;
    function towards(dist, c, cand) {
      return cand.reduce((a, b) => dist[K(c.x + b.x, c.y + b.y)] < dist[K(c.x + a.x, c.y + a.y)] ? b : a);
    }
    function hazardChoose(h, c) {
      const options = DIRS.filter(d => isOpen(c.x + d.x, c.y + d.y));
      if (!options.length) return null;
      const back = h.dir ? {x: -h.dir.x, y: -h.dir.y} : null;
      let cand = options.filter(d => !back || d.x !== back.x || d.y !== back.y);
      if (!cand.length) cand = options;
      const rnd = () => cand[Math.floor(Math.random() * cand.length)];
      if (power > 0) { // flee: prefer moving away from the player, with some randomness
        if (Math.random() < 0.35) return rnd();
        return cand.reduce((a, b) => playerDist[K(c.x + b.x, c.y + b.y)] > playerDist[K(c.x + a.x, c.y + a.y)] ? b : a);
      }
      switch (h.def.id) {
        case 'cop': return towards(playerDist, c, cand);
        case 'sq': {
          const near = playerDist[K(c.x, c.y)] < 4;
          return towards(near || !aheadDist ? playerDist : aheadDist, c, cand);
        }
        case 'tour': { // ambles along, mostly straight, drifts loosely toward the player
          if (h.dir && cand.some(d => d.x === h.dir.x && d.y === h.dir.y) && Math.random() < 0.7) return h.dir;
          return Math.random() < 0.4 ? towards(playerDist, c, cand) : rnd();
        }
        default: { // lost freshman: random, sometimes turns right around
          if (Math.random() < 0.15) return options[Math.floor(Math.random() * options.length)];
          return Math.random() < 0.25 ? towards(playerDist, c, cand) : rnd();
        }
      }
    }
    function aheadCell() {
      const d = player.dir; let c = {...player.to};
      if (!d) return c;
      for (let i = 0; i < 5 && isOpen(c.x + d.x, c.y + d.y); i++) c = {x: c.x + d.x, y: c.y + d.y};
      return c;
    }

    // ---------- state ----------
    let t = 0, score = 0, lives = LIVES, done = false;
    let power = 0, combo = 0, invuln = 0, shake = 0, flash = 0, flashCol = '255,59,48';
    let bites = 0, bumps = 0, milks = 0, tails = 0;
    let gold = null, goldIn = 9 + Math.random() * 3;
    let banner = '', bannerT = 0;
    const floaters = [];
    const pop = (text, x, y, col = '#f5c842') => floaters.push({ text, x, y, t: 1, col });
    function say(txt) { banner = txt; bannerT = 1.8; }

    function finish() {
      if (done) return; done = true;
      api.finish(score, `${bites} bites · ${bumps} bumps${tails ? ` · ${tails} golden tail${tails > 1 ? 's' : ''}` : ''}${lives <= 0 ? ' · caught 3×!' : ''}`);
    }

    function update(dt) {
      if (done) { for (const f of floaters) f.t -= dt; return; }
      t += dt;
      if (t >= DUR) { finish(); return; }
      const ramp = 1 + 0.12 * (t / DUR);
      if (power > 0) { power -= dt; if (power <= 0) { power = 0; combo = 0; } }
      invuln = Math.max(0, invuln - dt); shake = Math.max(0, shake - dt * 3); flash = Math.max(0, flash - dt * 2.5);
      bannerT -= dt;
      for (const f of floaters) f.t -= dt * 0.9;
      for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].t <= 0) floaters.splice(i, 1);

      // golden Cougar Tail
      if (gold) { gold.ttl -= dt; if (gold.ttl <= 0) gold = null; }
      else if ((goldIn -= dt) <= 0) {
        let c, tries = 0;
        do { c = cells[Math.floor(Math.random() * cells.length)]; } while (tries++ < 50 && Math.abs(c.x - player.to.x) + Math.abs(c.y - player.to.y) < 7);
        gold = { x: c.x, y: c.y, ttl: 8 }; goldIn = 10 + Math.random() * 4;
        say('✨ Golden Cougar Tail spotted!');
      }

      // player
      player.speed = P_SPEED * (power > 0 ? 1.35 : 1);
      advance(player, dt, playerChoose);
      if (player.dir) player.wob += dt * 12;
      const pk = K(player.to.x, player.to.y);
      if (player.t > 0.5 && dots.has(pk)) {
        dots.delete(pk);
        if (MILK.has(pk)) {
          score += 50; milks++; power = POWER_DUR; combo = 0;
          hazards.forEach(h => h.state === 'active' && reverse(h));
          pop('+50', player.x, player.y - CELL); say('🥛 CHOCOLATE MILK! Bump them!');
          flash = 0.6; flashCol = '120,70,30'; api.sfx('whoosh');
        } else {
          score += 10; bites++; api.sfx('tap');
          if (bites % 10 === 0) pop('+10', player.x, player.y - CELL * 0.8, '#fff');
        }
        if (dots.size === 0) { fillDots(); score += 200; say('🧹 Campus cleared! +200'); api.sfx('win'); }
      }
      if (gold && player.to.x === gold.x && player.to.y === gold.y && player.t > 0.5) {
        score += 250; tails++; gold = null; pop('+250', player.x, player.y - CELL, '#ffe27a');
        say('✨ GOLDEN COUGAR TAIL +250'); api.sfx('coin');
      }

      // hazards
      playerDist = bfs(player.to.x, player.to.y);
      const ac = aheadCell(); aheadDist = bfs(ac.x, ac.y);
      for (const h of hazards) {
        if (h.fly) { h.fly.t += dt; if (h.fly.t > 0.8) { h.fly = null; sendHome(h, 2.5); } continue; }
        if (h.state === 'wait') { h.timer -= dt; if (h.timer <= 0) h.state = 'active'; else continue; }
        h.speed = h.def.speed * ramp * (power > 0 ? 0.6 : 1);
        advance(h, dt, c => hazardChoose(h, c));
        const dx = h.x - player.x, dy = h.y - player.y;
        if (dx * dx + dy * dy < (CELL * 0.75) ** 2) {
          if (power > 0) {
            const pts = [100, 150, 200, 250][Math.min(combo, 3)]; combo++;
            score += pts; bumps++; pop('+' + pts, h.x, h.y - CELL, '#7cf');
            const a = Math.atan2(dy, dx) || -Math.PI / 2;
            h.fly = { t: 0, x: h.x, y: h.y, vx: Math.cos(a) * CELL * 14, vy: Math.sin(a) * CELL * 14 - CELL * 8 };
            shake = Math.max(shake, 0.4); api.sfx('hit');
          } else if (invuln <= 0) {
            lives--; invuln = 3; shake = 1; flash = 1; flashCol = '255,59,48'; api.sfx('bad');
            const msg = { cop: '👮 TICKETED!', sq: '🐿️ SQUIRREL ATTACK!', tour: '🚶 STUCK IN A TOUR!', fresh: '🤷 "Where\'s the JFSB?"' }[h.def.id];
            say(msg + (lives > 0 ? `  ${lives} left` : ''));
            sendHome(h, 2);
            if (lives <= 0) { finish(); return; }
          }
        }
      }
    }

    // ---------- input ----------
    let touch = null;
    const KEYS = { ArrowUp: {x:0,y:-1}, ArrowDown: {x:0,y:1}, ArrowLeft: {x:-1,y:0}, ArrowRight: {x:1,y:0},
                   w: {x:0,y:-1}, s: {x:0,y:1}, a: {x:-1,y:0}, d: {x:1,y:0} };

    // ---------- drawing ----------
    let mobile = false, sc = 1, offX = 0, offY = 0, viewW = mapW, viewH = mapH;
    const cam = { x: NaN, y: NaN };
    let lastW = 0, lastH = 0, lastNow = 0;
    function layout(W, H) {
      mobile = W < 700 || H > W * 1.1;
      if (mobile) {
        sc = Math.max(W / mapW, H / mapH, Math.min(W, H) / (CELL * 14));
        viewW = W / sc; viewH = H / sc;
      } else {
        const top = 46;
        sc = Math.min(W / mapW, (H - top) / mapH);
        viewW = mapW; viewH = mapH;
        offX = (W - mapW * sc) / 2; offY = top + (H - top - mapH * sc) / 2;
      }
      cam.x = cam.y = NaN; lastW = W; lastH = H;
    }
    function updateCam(dt) {
      if (!mobile) { cam.x = 0; cam.y = 0; return; }
      const clamp = (v, span, total) => span >= total ? (total - span) / 2 : Math.max(0, Math.min(total - span, v));
      const gx = clamp(player.x - viewW / 2, viewW, mapW), gy = clamp(player.y - viewH / 2, viewH, mapH);
      if (isNaN(cam.x)) { cam.x = gx; cam.y = gy; }
      else { const k = Math.min(1, dt * 7); cam.x += (gx - cam.x) * k; cam.y += (gy - cam.y) * k; }
      offX = -cam.x * sc; offY = -cam.y * sc;
    }

    function drawScooter(ctx, x, y, face, blink) {
      if (blink) return;
      const u = CELL / 12;
      ctx.save(); ctx.translate(x, y + Math.sin(player.wob) * 0.4 * u); ctx.scale(face, 1);
      if (power > 0) { ctx.fillStyle = 'rgba(245,200,66,.35)'; ctx.beginPath(); ctx.arc(0, 0, CELL * 0.95, 0, 7); ctx.fill(); }
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 6 * u, 8 * u, 2 * u, 0, 0, 7); ctx.fill();
      // deck + stem + bar
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#002e5d'; ctx.lineWidth = 2.2 * u;
      ctx.beginPath(); ctx.moveTo(-6 * u, 4 * u); ctx.lineTo(5 * u, 4 * u); ctx.stroke();
      ctx.strokeStyle = '#9aa7b8'; ctx.lineWidth = 1.5 * u;
      ctx.beginPath(); ctx.moveTo(5 * u, 4 * u); ctx.lineTo(7 * u, -8 * u); ctx.moveTo(5 * u, -8 * u); ctx.lineTo(9 * u, -8 * u); ctx.stroke();
      // wheels
      ctx.fillStyle = '#111';
      for (const wx of [-6, 6.5]) { ctx.beginPath(); ctx.arc(wx * u, 5.5 * u, 1.9 * u, 0, 7); ctx.fill(); }
      // rider
      ctx.strokeStyle = '#061a36'; ctx.lineWidth = 1.8 * u;
      ctx.beginPath(); ctx.moveTo(-1 * u, 3 * u); ctx.lineTo(0, -2 * u); ctx.lineTo(1.5 * u, 3 * u); ctx.stroke(); // legs
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#002e5d'; ctx.lineWidth = 0.8 * u;
      ctx.beginPath(); ctx.moveTo(-2.5 * u, -2 * u); ctx.lineTo(2.5 * u, -2 * u); ctx.lineTo(2 * u, -8 * u); ctx.lineTo(-2 * u, -8 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4 * u;
      ctx.beginPath(); ctx.moveTo(1.5 * u, -7 * u); ctx.lineTo(6.5 * u, -8 * u); ctx.stroke(); // arm
      ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(0.5 * u, -10.5 * u, 2.6 * u, 0, 7); ctx.fill(); // head
      ctx.fillStyle = '#f5c842'; ctx.beginPath(); ctx.arc(0.5 * u, -11 * u, 2.9 * u, Math.PI, 0); ctx.fill(); // helmet
      ctx.restore();
    }

    function drawHazard(ctx, h, now) {
      if (h.state === 'wait' && !h.fly) {
        // waiting at home: faint, blinking just before they come out
        if (h.timer > 1 || Math.floor(now / 120) % 2) return;
      }
      let x = h.x, y = h.y, rot = 0, alpha = 1;
      if (h.fly) {
        const ft = h.fly.t; x = h.fly.x + h.fly.vx * ft; y = h.fly.y + h.fly.vy * ft + CELL * 18 * ft * ft;
        rot = ft * 14; alpha = Math.max(0, 1 - ft / 0.8);
      }
      const r = CELL * 0.7;
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot);
      let col = h.def.color;
      if (power > 0 && !h.fly) col = (power < 1.5 && Math.floor(now / 150) % 2) ? '#ffffff' : '#2b4cff';
      ctx.fillStyle = col; ctx.strokeStyle = '#061a36'; ctx.lineWidth = CELL * 0.08;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.font = `${CELL * 1.05}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (h.def.id === 'tour') { // a little group with a flag
        ctx.font = `${CELL * 0.62}px sans-serif`;
        ctx.fillText('🚶', -r * 0.38, r * 0.1); ctx.fillText('🚶', r * 0.38, r * 0.1); ctx.fillText('🚶', 0, -r * 0.25);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = CELL * 0.07;
        ctx.beginPath(); ctx.moveTo(r * 0.7, r * 0.4); ctx.lineTo(r * 0.7, -r * 1.25); ctx.stroke();
        ctx.fillStyle = '#f5c842'; ctx.fillRect(r * 0.7, -r * 1.25, r * 0.6, r * 0.4);
      } else ctx.fillText(h.def.icon, 0, CELL * 0.04);
      ctx.restore(); ctx.textBaseline = 'alphabetic';
    }

    function draw(ctx, W, H) {
      const now = performance.now();
      const dt = Math.min(0.1, (now - (lastNow || now)) / 1000); lastNow = now;
      if (W !== lastW || H !== lastH) layout(W, H);
      updateCam(dt);
      ctx.fillStyle = '#061a36'; ctx.fillRect(0, 0, W, H);
      const shx = shake > 0 ? (Math.random() - 0.5) * shake * 10 : 0, shy = shake > 0 ? (Math.random() - 0.5) * shake * 10 : 0;

      ctx.save();
      ctx.translate(offX + shx, offY + shy); ctx.scale(sc, sc);
      // campus map
      ctx.fillStyle = '#f3f1ea'; ctx.fillRect(0, 0, mapW, mapH);
      if (mapImg && mapImg.complete && mapImg.naturalWidth) { try { ctx.drawImage(mapImg, 0, 0, mapW, mapH); } catch (e) {} }
      ctx.fillStyle = 'rgba(6,26,54,.18)'; ctx.fillRect(0, 0, mapW, mapH);
      // walkway corridors
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,46,93,0.45)'; ctx.lineWidth = CELL * 0.62;
      ctx.beginPath();
      for (const c of cells) {
        if (isOpen(c.x + 1, c.y)) { ctx.moveTo(cx(c.x), cy(c.y)); ctx.lineTo(cx(c.x + 1), cy(c.y)); }
        if (isOpen(c.x, c.y + 1)) { ctx.moveTo(cx(c.x), cy(c.y)); ctx.lineTo(cx(c.x), cy(c.y + 1)); }
      }
      ctx.stroke();

      // bites + chocolate milk
      const pulse = 0.9 + 0.15 * Math.sin(now / 150);
      ctx.fillStyle = '#f5c842';
      ctx.beginPath();
      for (const k of dots) {
        if (MILK.has(k)) continue;
        const x = k % GW, y = (k - x) / GW;
        ctx.moveTo(cx(x) + CELL * 0.16, cy(y)); ctx.arc(cx(x), cy(y), CELL * 0.16, 0, 7);
      }
      ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const k of MILK) {
        if (!dots.has(k)) continue;
        const x = k % GW, y = (k - x) / GW;
        ctx.fillStyle = '#6b3b1f'; ctx.strokeStyle = '#f5c842'; ctx.lineWidth = CELL * 0.1; ctx.beginPath(); ctx.arc(cx(x), cy(y), CELL * 0.62 * pulse, 0, 7); ctx.fill(); ctx.stroke();
        ctx.font = `${CELL * 0.95 * pulse}px sans-serif`; ctx.fillText('🥛', cx(x), cy(y) + CELL * 0.05);
      }
      if (gold) {
        const bob = Math.sin(now / 200) * CELL * 0.12;
        ctx.globalAlpha = gold.ttl < 2 ? (Math.floor(now / 150) % 2 ? 0.35 : 1) : 1;
        const g = ctx.createRadialGradient(cx(gold.x), cy(gold.y), 0, cx(gold.x), cy(gold.y), CELL * 1.1);
        g.addColorStop(0, 'rgba(255,226,122,.95)'); g.addColorStop(1, 'rgba(255,226,122,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx(gold.x), cy(gold.y), CELL * 1.1, 0, 7); ctx.fill();
        window.drawMapleBar(ctx, cx(gold.x), cy(gold.y) + bob, CELL * 1.5);
        ctx.globalAlpha = 1;
      }
      ctx.textBaseline = 'alphabetic';

      for (const h of hazards) drawHazard(ctx, h, now);
      drawScooter(ctx, player.x, player.y, player.face, invuln > 0 && Math.floor(now / 100) % 2 === 0);

      // floating points
      ctx.textAlign = 'center'; ctx.font = `900 ${CELL * 0.9}px sans-serif`; ctx.lineJoin = 'round';
      for (const f of floaters) {
        const y = f.y - (1 - f.t) * CELL * 1.6;
        ctx.globalAlpha = Math.max(0, Math.min(1, f.t * 2));
        ctx.strokeStyle = '#061a36'; ctx.lineWidth = CELL * 0.2; ctx.strokeText(f.text, f.x, y);
        ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, y);
      }
      ctx.globalAlpha = 1;
      if (!started && !done) {
        ctx.font = `900 ${CELL * 1.1}px sans-serif`; ctx.strokeStyle = '#061a36'; ctx.lineWidth = CELL * 0.25;
        const msg = mobile ? 'Swipe to ride!' : 'Arrows / WASD / swipe!';
        ctx.strokeText(msg, player.x, player.y - CELL * 1.8); ctx.fillStyle = '#f5c842'; ctx.fillText(msg, player.x, player.y - CELL * 1.8);
      }
      ctx.restore();

      if (flash > 0) { ctx.fillStyle = `rgba(${flashCol},${flash * 0.3})`; ctx.fillRect(0, 0, W, H); }

      // ---- HUD pill (below the hub HUD on phones; top bar on desktop, left of the ✕) ----
      const hudY = mobile ? 66 : 6, ph = 36;
      const pw = Math.min(W - 24, mobile ? W - 24 : 520), px = mobile ? 12 : Math.max(12, (W - pw) / 2 - 20);
      ctx.fillStyle = 'rgba(6,26,54,.82)'; ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, hudY, pw, ph, 18); else ctx.rect(px, hudY, pw, ph);
      ctx.fill();
      const left = Math.max(0, DUR - t);
      const fs = Math.min(19, pw / 20);
      ctx.font = `800 ${fs}px sans-serif`; ctx.textBaseline = 'middle';
      ctx.textAlign = 'left'; ctx.fillStyle = left < 10 ? '#ff6b5e' : '#f0f4ff';
      ctx.fillText(`⏱ ${left.toFixed(1)}`, px + 14, hudY + ph / 2);
      ctx.textAlign = 'center'; ctx.fillStyle = '#f5c842';
      ctx.fillText(`${score} pts`, px + pw / 2, hudY + ph / 2);
      ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
      ctx.fillText('🛴'.repeat(Math.max(0, lives)) + '·'.repeat(LIVES - Math.max(0, lives)), px + pw - 14, hudY + ph / 2);
      ctx.textBaseline = 'alphabetic';
      // time bar
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(px + 18, hudY + ph - 4, pw - 36, 3);
      ctx.fillStyle = left < 10 ? '#ff6b5e' : '#f5c842'; ctx.fillRect(px + 18, hudY + ph - 4, (pw - 36) * left / DUR, 3);
      // power meter + banner
      let by = hudY + ph + 8;
      if (power > 0) {
        const bw = Math.min(220, pw * 0.6);
        ctx.fillStyle = 'rgba(6,26,54,.75)'; ctx.fillRect(W / 2 - bw / 2 - 4, by - 2, bw + 8, 14);
        ctx.fillStyle = '#8a5230'; ctx.fillRect(W / 2 - bw / 2, by + 1, bw * power / POWER_DUR, 8);
        by += 18;
      }
      if (bannerT > 0) {
        const bfs = Math.min(22, W * 0.05);
        ctx.font = `900 ${bfs}px sans-serif`; ctx.textAlign = 'center';
        ctx.globalAlpha = Math.min(1, bannerT * 2);
        ctx.strokeStyle = '#061a36'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
        ctx.strokeText(banner, W / 2, by + bfs); ctx.fillStyle = '#f5c842'; ctx.fillText(banner, W / 2, by + bfs);
        ctx.globalAlpha = 1;
      }
    }

    const game = {
      update, draw,
      tap(x, y) { touch = { x, y }; },
      move(x, y, isDown) {
        if (!touch || !isDown) return;
        const dx = x - touch.x, dy = y - touch.y;
        if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
        touch = null; // turn fires mid-swipe; lift and swipe again for the next turn
        setWant(Math.abs(dx) > Math.abs(dy) ? {x: Math.sign(dx), y: 0} : {x: 0, y: Math.sign(dy)});
      },
      release() { touch = null; },
      key(k, isDown) { if (isDown && KEYS[k]) setWant(KEYS[k]); },
      // test hook
      _dbg: { get player() { return player; }, get hazards() { return hazards; }, get score() { return score; }, get lives() { return lives; }, get power() { return power; }, get bumps() { return bumps; }, setWant, dots, cells, get t() { return t; }, set t(v) { t = v; } },
    };
    window.__scooterDbg = game._dbg; // test hook
    return game;
  },
};
