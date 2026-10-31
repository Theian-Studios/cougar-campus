/* ---------------- QB Throw ----------------
   Top-down from behind the quarterback. 2–3 receivers run routes (go / slant / out / post),
   red defenders shadow them. Swipe: direction = where to throw, length = how far. The ball
   flies for ~1–1.5 s so you must LEAD the receiver. Catch = points (more for deep balls, bonus
   for perfect hits / touchdowns / streaks). Defender at the spot = pick. Hold it ~4 s = sack.
   40 s or 3 strikes (picks + sacks) ends the round. World units are yards: x = 0 at the
   middle of the field, y = 0 at the line of scrimmage (downfield = +y). QB stands at y = -5. */
window.MINIGAMES.qb = {
  name: 'QB Throw',
  icon: '🎯',
  blurb: 'Lead receivers with passes',
  howTo: '<b>Swipe</b> toward where the ball should land — longer swipe = longer throw. <b>Lead</b> your receiver!<br>Red defenders near the ball = pick. Hold it too long = sack. 3 strikes and you\'re out.',
  create(api) {
    const DUR = 40, STRIKES = 3, POCKET = 5.0, QBY = -5, EZ = 32, XMAX = 14, YMAX = 41;
    const CATCH_R = 2.0, PERFECT_R = 0.65, PICK_R = 1.2;
    let t = 0, done = false, endT = 0, score = 0, strikes = 0, streak = 0, bestStreak = 0;
    const tally = { int: 0, sack: 0, inc: 0, catch: 0, perfect: 0 };
    let comps = 0, att = 0, yards = 0, longest = 0, tds = 0, perfects = 0, plays = 0;
    let phase = 'pre', phaseT = 0, recv = [], defs = [], rush = [], ball = null, result = null;
    let drag = null, reticle = null, keys = {}, floaters = [], parts = [], shake = 0, flash = null;
    const CROWD = ['#ffffff', '#002e5d', '#f5c842', '#3d6fb6', '#ffffff', '#8fb3e8', '#c8102e'];
    const crowd = [];
    for (let i = 0; i < 700; i++) crowd.push({ u: Math.random(), v: Math.random(), c: CROWD[(Math.random() * CROWD.length) | 0], ph: Math.random() * 6.28 });
    let W = api.W || 390, H = api.H || 700, S = 12, QX = 195, QSY = 700;

    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = a => a[(Math.random() * a.length) | 0];
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const len = (x, y) => Math.hypot(x, y);

    // ---- layout ----
    function layout(w, h) {
      W = w; H = h;
      QSY = H - Math.max(70, H * 0.1);
      S = Math.min(W / 31, (QSY - 120) / 47);
      QX = W / 2;
    }
    const SX = x => QX + x * S;
    const SY = y => QSY - (y - QBY) * S;
    const WX = sx => (sx - QX) / S;
    const WY = sy => (QSY - sy) / S + QBY;

    // ---- play setup ----
    const SLOTS = [-13, -7.5, -3, 3, 7.5, 13];
    function makeRoute(x0, kind) {
      const side = x0 < 0 ? -1 : 1, inw = -side;
      switch (kind) {
        case 'go': return [[x0, 1], [x0 + side * 1.5, 60]];
        case 'slant': return [[x0, 3.5], [x0 + inw * 40, 3.5 + 32]];
        case 'out': { const yb = rnd(7, 10); return [[x0, yb], [side * 40, yb], [null, 60]]; } // null x = keep x, go up
        case 'post': return [[x0, rnd(9, 12)], [x0 + inw * 40, 60]];
        case 'corner': return [[x0, rnd(9, 11)], [x0 + side * 40, 60]];
      }
    }
    function newPlay() {
      plays++;
      const n = plays <= 1 ? 2 : Math.random() < 0.55 ? 3 : 2;
      const slots = SLOTS.slice().sort(() => Math.random() - 0.5).slice(0, n);
      // make sure receivers aren't stacked too close
      slots.sort((a, b) => a - b);
      for (let i = 1; i < slots.length; i++) if (slots[i] - slots[i - 1] < 4) slots[i] = slots[i - 1] + 4.5;
      const used = new Set();
      const nums = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 15, 17, 18, 21, 22, 81, 84, 88].sort(() => Math.random() - 0.5);
      recv = slots.map((x0, i) => {
        let kind;
        do { kind = pick(Math.abs(x0) < 6 ? ['slant', 'go', 'post', 'out', 'corner'] : ['go', 'slant', 'out', 'post', 'corner']); } while (used.has(kind) && used.size < 4);
        used.add(kind);
        const route = makeRoute(clamp(x0, -XMAX, XMAX), kind);
        return { x: x0, y: 0, vx: 0, vy: 0, route, seg: 0, kind, num: nums[i], sp: rnd(6.8, 8.2), path: tracePath(x0, route), caught: false, ph: Math.random() * 6 };
      });
      const deep = plays >= 3 ? 1 : 0;
      defs = recv.map(r => {
        const inw = r.x < 0 ? 1 : -1;
        return { x: r.x + inw * rnd(0.5, 1.5), y: rnd(4.5, 7.5), vx: 0, vy: 0, mark: r,
          off: Math.random() < 0.5 ? [inw * 1.0, -1.9] : [inw * 0.9, 2.1], sp: r.sp * rnd(0.86, 0.98), react: rnd(5, 8), ph: Math.random() * 6 };
      });
      if (deep) defs.push({ x: rnd(-4, 4), y: rnd(20, 24), vx: 0, vy: 0, mark: null, safety: true, sp: 6.8, react: 4, ph: 0 });
      rush = [{ x: -2.2, y: 0.8 }, { x: 2.2, y: 0.8 }];
      ball = null; result = null; drag = null;
      phase = 'pre'; phaseT = 0;
      reticle = { x: recv[0].x, y: 12 };
    }
    function tracePath(x0, route) {
      // sample the route for the faint guide line
      const p = [[x0, 0]];
      let x = x0, y = 0;
      for (const [rx, wy] of route) {
        const wx = rx === null ? x : rx;
        let tx = wx, ty = wy;
        const dx = wx - x, dy = wy - y;
        let k = 1;
        if (Math.abs(wx) > XMAX && dx !== 0) k = Math.min(k, (Math.sign(dx) * XMAX - x) / dx);
        if (wy > YMAX && dy !== 0) k = Math.min(k, (YMAX - y) / dy);
        tx = x + dx * k; ty = y + dy * k;
        p.push([tx, ty]); x = tx; y = ty;
        if (ty >= YMAX - 0.01) break;
      }
      return p;
    }

    // ---- motion ----
    function moveReceiver(r, dt) {
      if (r.caught) { r.vx *= 0.9; r.vy *= 0.9; r.x += r.vx * dt; r.y += r.vy * dt; return; }
      let tx, ty;
      const p = r.path;
      if (r.seg < p.length - 1) {
        [tx, ty] = p[r.seg + 1];
        if (len(tx - r.x, ty - r.y) < 0.4) { r.seg++; return moveReceiver(r, dt); }
      } else { tx = r.x; ty = r.y; }
      let dx = tx - r.x, dy = ty - r.y, d = len(dx, dy);
      let wx = d > 0.01 ? dx / d * r.sp : 0, wy = d > 0.01 ? dy / d * r.sp : 0;
      // go get the ball: in the last moments of the flight, receivers near the spot adjust
      if (ball && ball.k > 0.55) {
        const bx = ball.tx - r.x, by = ball.ty - r.y, bd = len(bx, by);
        if (bd < 3.6 && bd > 0.05) { const w = 0.45; wx = wx * (1 - w) + bx / bd * r.sp * w; wy = wy * (1 - w) + by / bd * r.sp * w; }
      }
      const a = Math.min(1, dt * 9);
      r.vx += (wx - r.vx) * a; r.vy += (wy - r.vy) * a;
      r.x = clamp(r.x + r.vx * dt, -XMAX - 1, XMAX + 1); r.y = Math.min(YMAX + 1, r.y + r.vy * dt);
    }
    function moveDefender(d, dt) {
      let tx, ty, sp = d.sp;
      if (d.safety) {
        // drift toward the deepest receiver's side, stay deep
        let deep = recv[0]; for (const r of recv) if (r.y > deep.y) deep = r;
        tx = deep.x * 0.7; ty = Math.max(20, deep.y + 4);
      } else {
        const r = d.mark;
        tx = r.x + r.vx * 0.25 + d.off[0]; ty = r.y + r.vy * 0.25 + d.off[1];
      }
      // break on the ball once it's in the air (with a reaction delay)
      if (ball && ball.k > 0.5) {
        const bx = ball.tx - d.x, by = ball.ty - d.y, bd = len(bx, by);
        if (bd < 3) { tx = (tx + ball.tx) / 2; ty = (ty + ball.ty) / 2; sp *= 0.9; }
      }
      const dx = tx - d.x, dy = ty - d.y, dd = len(dx, dy);
      const want = Math.min(sp, dd * 4);
      const wx = dd > 0.01 ? dx / dd * want : 0, wy = dd > 0.01 ? dy / dd * want : 0;
      const a = Math.min(1, dt * d.react);
      d.vx += (wx - d.vx) * a; d.vy += (wy - d.vy) * a;
      d.x += d.vx * dt; d.y += d.vy * dt;
    }

    // ---- throwing ----
    function swipeToTarget(dx, dy) {
      const L = len(dx, dy);
      const full = 0.42 * Math.min(H, 1.5 * W);   // swipe this long = 40 yd throw
      const dist = clamp(L / full * 40, 0, 50);
      const ux = dx / L, uy = -dy / L;
      return { x: clamp(ux * dist, -24, 24), y: QBY + uy * dist };
    }
    function throwTo(tx, ty) {
      if (phase !== 'live' || done) return;
      const dist = len(tx, ty - QBY);
      if (dist < 3) return;
      const T = 0.65 + dist * 0.021;
      ball = { sx: 0, sy: QBY + 0.6, tx, ty, T, t: 0, k: 0, peak: 1.2 + dist * 0.16, trail: [] };
      phase = 'air'; phaseT = 0; att++;
      api.sfx('whoosh');
    }
    function land() {
      const b = ball;
      let bestR = null, dR = 1e9, dD = 1e9, bestD = null;
      for (const r of recv) { const d = len(r.x - b.tx, r.y - b.ty); if (d < dR) { dR = d; bestR = r; } }
      for (const d of defs) { const e = len(d.x - b.tx, d.y - b.ty); if (e < dD) { dD = e; bestD = d; } }
      const air = Math.max(0, Math.round(b.ty));
      if (dD < PICK_R && dD + 0.7 < dR) {
        strikes++; streak = 0;
        tally.int++; result = { kind: 'int', x: bestD.x, y: bestD.y };
        bestD.hasBall = true;
        flash = { text: 'PICKED OFF!', sub: pick(['A Ute jumped the route 😬', 'Right into red hands…', 'Throw it AWAY from the red guys!', 'That\'s going on SportsCenter']), color: '#ff5a4e', t: 1.4 };
        shake = 0.8; api.sfx('bad');
      } else if (dR < CATCH_R) {
        const perfect = dR < PERFECT_R, td = bestR.y >= EZ;
        streak++; bestStreak = Math.max(bestStreak, streak); comps++;
        yards += air; longest = Math.max(longest, air);
        let pts = 25 + 3 * air;
        let sub = `${air} yd catch`;
        if (perfect) { pts += 40; perfects++; sub = 'Right on the numbers! +40'; }
        if (td) { pts += 50; tds++; }
        if (streak > 1) pts += 10 * Math.min(streak - 1, 6);
        score += pts;
        bestR.caught = true; bestR.vx *= 0.5; bestR.vy *= 0.5;
        tally.catch++; if (perfect) tally.perfect++; result = { kind: 'catch', x: bestR.x, y: bestR.y };
        flash = td ? { text: 'TOUCHDOWN!', sub: perfect ? 'Perfect strike! 🙌' : `${air} yards`, color: '#f5c842', t: 1.5 }
          : { text: perfect ? 'PERFECT!' : 'CAUGHT!', sub: streak > 1 ? `${sub} · 🔥×${streak}` : sub, color: perfect ? '#f5c842' : '#7dff9a', t: 1.3 };
        floaters.push({ text: `+${pts}`, x: bestR.x, y: bestR.y + 1.5, t: 1.2, color: '#f5c842' });
        burst(bestR.x, bestR.y, td ? 26 : perfect ? 18 : 10, td ? '#f5c842' : '#ffffff');
        api.sfx(perfect || td ? 'win' : 'coin');
        if (td) shake = 0.5;
      } else {
        streak = 0;
        tally.inc++; result = { kind: 'inc', x: b.tx, y: b.ty };
        flash = { text: 'INCOMPLETE', sub: dR < 4.5 ? (bestR.y > b.ty ? 'Behind him — lead more!' : 'Overthrown!') : pick(['Nobody there!', 'Throwing to the grass?', 'Lead the receiver!']), color: '#cfd8e6', t: 1.1 };
        api.sfx('thud');
      }
      phase = 'result'; phaseT = 0;
    }
    function sack() {
      strikes++; streak = 0; att++;
      tally.sack++; result = { kind: 'sack', x: 0, y: QBY };
      flash = { text: 'SACKED!', sub: 'Get rid of it faster!', color: '#ff5a4e', t: 1.3 };
      shake = 1; api.sfx('hit');
      phase = 'result'; phaseT = 0;
    }
    function burst(x, y, n, color) {
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = rnd(2, 7); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rnd(0.4, 0.9), color }); }
    }
    function end() {
      if (done) return; done = true;
      const pct = att ? Math.round(comps / att * 100) : 0;
      api.finish(score, comps ? `${comps}/${att} passing (${pct}%) · ${yards} yds · ${tds} TD${tds === 1 ? '' : 's'} · long ${longest}`
        : 'No completions… the coach wants a word.');
    }

    newPlay();

    // ---- drawing helpers ----
    function player(ctx, x, y, fill, ring, label, r, bob) {
      const px = SX(x), py = SY(y) + (bob || 0);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(px + r * 0.15, py + r * 0.55, r * 0.95, r * 0.45, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = fill; ctx.strokeStyle = ring; ctx.lineWidth = Math.max(2, r * 0.18);
      ctx.beginPath(); ctx.arc(px, py, r, 0, 6.3); ctx.fill(); ctx.stroke();
      if (label) {
        ctx.fillStyle = ring === '#f5c842' ? '#fff' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `900 ${r * (String(label).length > 1 ? 0.95 : 1.15)}px sans-serif`; ctx.fillText(label, px, py + 1);
        ctx.textBaseline = 'alphabetic';
      }
    }
    function fitText(ctx, txt, size, weight, maxW) {
      ctx.font = `${weight} ${size}px sans-serif`;
      const m = ctx.measureText(txt).width;
      if (m > maxW) ctx.font = `${weight} ${size * maxW / m}px sans-serif`;
    }

    return {
      update(dt) {
        shake = Math.max(0, shake - dt * 3);
        if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
        for (const f of floaters) { f.t -= dt; f.y += dt * 2.5; }
        floaters = floaters.filter(f => f.t > 0);
        for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.t -= dt; }
        parts = parts.filter(p => p.t > 0);
        if (done) return;
        if (endT > 0) { endT -= dt; if (endT <= 0) end(); return; }
        W = api.W || W; H = api.H || H;
        t += dt; phaseT += dt;
        if (phase === 'pre') {
          if (phaseT > 0.7) { phase = 'live'; phaseT = 0; api.sfx('tap'); }
        } else if (phase === 'live' || phase === 'air') {
          for (const r of recv) moveReceiver(r, dt);
          for (const d of defs) moveDefender(d, dt);
          if (phase === 'live') {
            // pass rush closes in on the QB
            const k = Math.min(1, phaseT / POCKET);
            rush[0].x = -2.2 + 2.0 * k; rush[0].y = 0.8 + (QBY + 0.9 - 0.8) * k * k;
            rush[1].x = 2.2 - 2.0 * k; rush[1].y = 0.8 + (QBY + 0.9 - 0.8) * k * k;
            if (keys.left) reticle.x -= dt * 22; if (keys.right) reticle.x += dt * 22;
            if (keys.up) reticle.y += dt * 22; if (keys.down) reticle.y -= dt * 22;
            reticle.x = clamp(reticle.x, -22, 22); reticle.y = clamp(reticle.y, QBY + 3, 46);
            if (phaseT >= POCKET) sack();
          } else {
            const b = ball;
            b.t += dt; b.k = Math.min(1, b.t / b.T);
            b.trail.push([b.sx + (b.tx - b.sx) * b.k, b.sy + (b.ty - b.sy) * b.k, 4 * b.peak * b.k * (1 - b.k)]);
            if (b.trail.length > 14) b.trail.shift();
            if (b.k >= 1) land();
          }
        } else if (phase === 'result') {
          for (const r of recv) moveReceiver(r, dt);
          for (const d of defs) {
            if (d.hasBall) { d.vy += (-d.sp - d.vy) * Math.min(1, dt * 5); d.vx *= 0.95; d.x += d.vx * dt; d.y += d.vy * dt; }
            else moveDefender(d, dt);
          }
          if (phaseT > (result.kind === 'catch' ? 1.25 : 1.1)) {
            if (strikes >= STRIKES) { endT = 0.4; return; }
            if (t >= DUR) { end(); return; }
            newPlay();
          }
        }
        if (t >= DUR && (phase === 'pre' || phase === 'live')) end();
      },

      tap(x, y) {
        if (done) return;
        drag = { x0: x, y0: y, x, y };
      },
      move(x, y, isDown) {
        if (!drag || !isDown) return;
        drag.x = x; drag.y = y;
      },
      release(x, y) {
        if (!drag || done) { drag = null; return; }
        if (x != null) { drag.x = x; drag.y = y; }
        const dx = drag.x - drag.x0, dy = drag.y - drag.y0;
        drag = null;
        if (len(dx, dy) < 25 || dy > -8) {
          if (phase === 'live' && !flash) flash = { text: '', sub: 'Swipe UP toward the spot!', color: '#fff', t: 0.9 };
          return;
        }
        const tg = swipeToTarget(dx, dy);
        throwTo(tg.x, tg.y);
      },
      key(k, isDown) {
        if (done) return;
        if (k === 'ArrowLeft' || k === 'a') keys.left = isDown;
        else if (k === 'ArrowRight' || k === 'd') keys.right = isDown;
        else if (k === 'ArrowUp' || k === 'w') keys.up = isDown;
        else if (k === 'ArrowDown' || k === 's') keys.down = isDown;
        else if ((k === ' ' || k === 'Enter') && isDown && reticle) throwTo(reticle.x, reticle.y);
      },

      draw(ctx, w, h) {
        layout(w, h);
        ctx.save(); ctx.lineJoin = 'round';
        if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 10);
        // stands / background
        ctx.fillStyle = '#0d2547'; ctx.fillRect(-20, -20, W + 40, H + 40);
        { // crowd in the stands behind the end zone
          const sb = SY(EZ + 13);
          if (sb > 40) {
            ctx.globalAlpha = 0.55;
            for (const c of crowd) {
              const cy = sb - c.v * sb, bob = Math.sin(t * 6 + c.ph) * (flash && flash.color === '#f5c842' ? 4 : 0.6);
              ctx.fillStyle = c.c; ctx.beginPath(); ctx.arc(c.u * W, cy + bob, 2.6, 0, 6.3); ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#002e5d'; ctx.fillRect(-20, sb, W + 40, Math.max(6, S * 1.2));
          }
        }
        // grass with 5-yard stripes
        const FL = SX(-26.7), FR = SX(26.7);
        ctx.fillStyle = '#2f8a3c'; ctx.fillRect(FL - 3 * S, SY(EZ + 10), FR - FL + 6 * S, H - SY(EZ + 10) + 30);
        for (let y = -15; y < EZ; y += 5) {
          if (Math.round((y + 15) / 5) % 2) { ctx.fillStyle = '#2a7e36'; ctx.fillRect(FL, SY(y + 5), FR - FL, 5 * S); }
        }
        // end zone
        ctx.fillStyle = '#002e5d'; ctx.fillRect(FL, SY(EZ + 10), FR - FL, 10 * S);
        ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        fitText(ctx, 'COUGARS', S * 6, 900, Math.min(FR - FL, W) * 0.85);
        ctx.fillText('COUGARS', W / 2, SY(EZ + 5)); ctx.restore();
        // lines
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1.5, S * 0.14);
        ctx.beginPath(); ctx.moveTo(FL, SY(EZ + 10)); ctx.lineTo(FL, H + 10); ctx.moveTo(FR, SY(EZ + 10)); ctx.lineTo(FR, H + 10); ctx.stroke();
        ctx.lineWidth = Math.max(1, S * 0.1);
        for (let y = -15; y <= EZ + 10; y += 5) {
          ctx.strokeStyle = y === EZ ? '#fff' : 'rgba(255,255,255,.55)'; ctx.lineWidth = y === EZ ? Math.max(2, S * 0.2) : Math.max(1, S * 0.1);
          ctx.beginPath(); ctx.moveTo(FL, SY(y)); ctx.lineTo(FR, SY(y)); ctx.stroke();
        }
        // hash marks
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
        for (let y = -15; y < EZ; y++) for (const hx of [-3.1, 3.1]) { ctx.beginPath(); ctx.moveTo(SX(hx - 0.35), SY(y)); ctx.lineTo(SX(hx + 0.35), SY(y)); ctx.stroke(); }
        // yard numbers (LOS at the opponent's 35 → end zone 32 yd away... label like a real field)
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `800 ${Math.max(10, S * 1.7)}px sans-serif`;
        for (let y = EZ - 10; y >= -10; y -= 10) {
          const n = EZ - y; if (n <= 0 || n > 50) continue;
          for (const nx of [-11.5, 11.5]) { if (SX(nx) > 10 && SX(nx) < W - 10) ctx.fillText(String(n), SX(nx), SY(y)); }
        }
        ctx.textBaseline = 'alphabetic';
        // line of scrimmage (blue) — first-down-ish yellow line 10 yd ahead
        ctx.lineWidth = Math.max(2, S * 0.22);
        ctx.strokeStyle = 'rgba(80,160,255,.9)'; ctx.beginPath(); ctx.moveTo(FL, SY(0)); ctx.lineTo(FR, SY(0)); ctx.stroke();
        ctx.strokeStyle = 'rgba(245,200,66,.8)'; ctx.beginPath(); ctx.moveTo(FL, SY(10)); ctx.lineTo(FR, SY(10)); ctx.stroke();

        // route guides
        if (phase !== 'result') {
          ctx.setLineDash([6, 7]); ctx.lineWidth = 2;
          for (const r of recv) {
            ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.beginPath();
            r.path.forEach(([x, y], i) => i ? ctx.lineTo(SX(x), SY(y)) : ctx.moveTo(SX(x), SY(y)));
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }

        const R = Math.max(10, S * 1.0);
        // offensive line
        for (const ox of [-2.4, -1.2, 0, 1.2, 2.4]) {
          const px = SX(ox), py = SY(-0.8);
          ctx.fillStyle = '#123a6b'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(px - R * 0.55, py - R * 0.5, R * 1.1, R * 1.0, 3); ctx.fill(); ctx.stroke();
        }
        // pass rushers
        if (phase !== 'result' || result.kind === 'sack') {
          for (const p of rush) player(ctx, p.x, p.y, '#c8102e', '#7a0010', '', R * 0.85);
        }
        // landing spot marker while ball flies
        if (ball && phase === 'air') {
          const lx = SX(ball.tx), ly = SY(ball.ty), pr = R * (1.4 - 0.5 * ball.k);
          ctx.strokeStyle = 'rgba(245,200,66,.9)'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(lx, ly, pr, 0, 6.3); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(lx - pr * 0.5, ly); ctx.lineTo(lx + pr * 0.5, ly); ctx.moveTo(lx, ly - pr * 0.5); ctx.lineTo(lx, ly + pr * 0.5); ctx.stroke();
        }
        // defenders
        for (const d of defs) player(ctx, d.x, d.y, '#e23b3b', '#fff', d.hasBall ? '🏈' : '', R * 0.95, Math.sin(t * 14 + d.ph) * 0.8);
        // receivers
        for (const r of recv) {
          player(ctx, r.x, r.y, '#002e5d', '#f5c842', r.num, R, r.caught ? 0 : Math.sin(t * 14 + r.ph) * 0.8);
          if (r.caught) { ctx.font = `${R * 1.1}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('🏈', SX(r.x) + R * 0.9, SY(r.y) - R * 0.6); }
        }
        // QB + pocket timer ring
        const qx = SX(0), qy = SY(QBY);
        if (phase === 'live') {
          const k = Math.min(1, phaseT / POCKET);
          ctx.lineWidth = Math.max(4, R * 0.35); ctx.strokeStyle = 'rgba(0,0,0,.35)';
          ctx.beginPath(); ctx.arc(qx, qy, R * 1.9, 0, 6.3); ctx.stroke();
          ctx.strokeStyle = k < 0.55 ? '#7dff9a' : k < 0.8 ? '#f5c842' : '#ff5a4e';
          ctx.beginPath(); ctx.arc(qx, qy, R * 1.9, -Math.PI / 2, -Math.PI / 2 + 6.283 * (1 - k)); ctx.stroke();
        }
        player(ctx, 0, QBY, '#002e5d', '#ffffff', 'QB', R * 1.1);
        if (phase === 'pre' || (phase === 'live' && phaseT < 0.15)) {
          ctx.font = `900 ${R * 1.4}px sans-serif`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
          ctx.lineWidth = 4; ctx.strokeStyle = '#061a36';
          ctx.strokeText(phase === 'pre' ? 'Set…' : 'HUT!', qx, qy - R * 2.6); ctx.fillText(phase === 'pre' ? 'Set…' : 'HUT!', qx, qy - R * 2.6);
        }

        // aim preview while swiping / keyboard reticle
        let aim = null;
        if (drag && phase === 'live') {
          const dx = drag.x - drag.x0, dy = drag.y - drag.y0;
          if (len(dx, dy) > 12 && dy < 0) aim = swipeToTarget(dx, dy);
        } else if (phase === 'live' && (keys.left || keys.right || keys.up || keys.down || reticle.moved)) {
          reticle.moved = true; aim = reticle;
        }
        if (aim) {
          ctx.strokeStyle = 'rgba(245,200,66,.85)'; ctx.lineWidth = 3; ctx.setLineDash([9, 7]);
          ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(SX(aim.x), SY(aim.y)); ctx.stroke(); ctx.setLineDash([]);
          const ax = SX(aim.x), ay = SY(aim.y);
          ctx.strokeStyle = '#f5c842'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ax, ay, R * 1.2, 0, 6.3); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ax - R * 1.7, ay); ctx.lineTo(ax + R * 1.7, ay); ctx.moveTo(ax, ay - R * 1.7); ctx.lineTo(ax, ay + R * 1.7); ctx.stroke();
          ctx.fillStyle = '#f5c842'; ctx.font = `800 ${Math.max(11, R * 0.95)}px sans-serif`; ctx.textAlign = 'left';
          ctx.fillText(`${Math.max(0, Math.round(aim.y))} yd`, ax + R * 1.5, ay - R * 1.2);
        }

        // ball (shadow on the ground + ball raised by its height)
        if (ball && phase === 'air') {
          const b = ball, gx = b.sx + (b.tx - b.sx) * b.k, gy = b.sy + (b.ty - b.sy) * b.k, hgt = 4 * b.peak * b.k * (1 - b.k);
          const sx = SX(gx), sy = SY(gy);
          ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(sx, sy, R * 0.55, R * 0.3, 0, 0, 6.3); ctx.fill();
          for (let i = 0; i < b.trail.length; i++) {
            const [x, y, hh] = b.trail[i];
            ctx.fillStyle = `rgba(255,255,255,${(i / b.trail.length) * 0.35})`;
            ctx.beginPath(); ctx.arc(SX(x), SY(y) - hh * S * 0.6, R * 0.25, 0, 6.3); ctx.fill();
          }
          const by = sy - hgt * S * 0.6, br = R * (0.55 + hgt * 0.035);
          const ang = Math.atan2(-(b.ty - b.sy), b.tx - b.sx);
          ctx.save(); ctx.translate(sx, by); ctx.rotate(ang);
          ctx.fillStyle = '#8b4a1c'; ctx.strokeStyle = '#4a240c'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(0, 0, br, br * 0.6, 0, 0, 6.3); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-br * 0.4, 0); ctx.lineTo(br * 0.4, 0); ctx.stroke();
          ctx.restore();
        } else if (phase === 'pre' || phase === 'live') {
          ctx.font = `${R * 1.0}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('🏈', qx + R * 1.0, qy - R * 0.4);
        }
        // incompletion: ball on the grass
        if (result && result.kind === 'inc') { ctx.font = `${R * 1.0}px sans-serif`; ctx.textAlign = 'center'; ctx.globalAlpha = 0.8; ctx.fillText('🏈', SX(result.x), SY(result.y) + R * 0.35); ctx.globalAlpha = 1; }
        // particles
        for (const p of parts) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = p.color; ctx.fillRect(SX(p.x) - 2.5, SY(p.y) - 2.5, 5, 5); }
        ctx.globalAlpha = 1;
        // floaters
        for (const f of floaters) {
          ctx.globalAlpha = Math.min(1, f.t * 2); ctx.textAlign = 'center'; ctx.font = `900 ${Math.min(34, W * 0.08)}px sans-serif`;
          ctx.lineWidth = 5; ctx.strokeStyle = '#061a36'; ctx.strokeText(f.text, SX(f.x), SY(f.y));
          ctx.fillStyle = f.color; ctx.fillText(f.text, SX(f.x), SY(f.y));
        }
        ctx.globalAlpha = 1;

        // hint
        if (!done && phase === 'live' && !drag && !flash && plays <= 2 && att < 2) {
          const a = 0.55 + 0.45 * Math.sin(t * 6);
          ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.textAlign = 'center';
          fitText(ctx, '👆 Swipe up — throw AHEAD of a receiver', Math.min(20, W * 0.048), 800, W * 0.86);
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(6,26,54,.8)';
          const hy = 68 + Math.min(20, W * 0.048) * 3.4 + Math.min(60, H * 0.07);
          ctx.strokeText('👆 Swipe up — throw AHEAD of a receiver', W / 2, hy);
          ctx.fillText('👆 Swipe up — throw AHEAD of a receiver', W / 2, hy);
        }

        // HUD panel
        const top = 68, fs = Math.min(20, W * 0.048);
        const pw = Math.min(W - 24, 520), px = (W - pw) / 2, ph = fs * 3.4;
        ctx.fillStyle = 'rgba(6,26,54,.78)';
        ctx.beginPath(); ctx.roundRect(px, top, pw, ph, 12); ctx.fill();
        ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `800 ${fs}px sans-serif`;
        ctx.fillText(`${score} pts`, px + 12, top + fs * 1.3);
        ctx.textAlign = 'center'; ctx.fillStyle = '#f5c842'; ctx.font = `900 ${fs}px sans-serif`;
        ctx.fillText(`${comps}/${att}`, W / 2, top + fs * 1.3);
        ctx.textAlign = 'right';
        const left = Math.max(0, DUR - t);
        ctx.fillStyle = left < 8 ? '#ff5a4e' : '#fff'; ctx.font = `800 ${fs}px sans-serif`;
        ctx.fillText(`⏱ ${Math.ceil(left)}s`, px + pw - 12, top + fs * 1.3);
        ctx.textAlign = 'left'; ctx.font = `700 ${fs * 0.85}px sans-serif`; ctx.fillStyle = '#fff';
        let lives = ''; for (let i = 0; i < STRIKES; i++) lives += i < STRIKES - strikes ? '🏈' : '✖️';
        ctx.fillText(lives, px + 12, top + fs * 2.8);
        ctx.textAlign = 'right'; ctx.fillStyle = streak > 1 ? '#f5c842' : 'rgba(255,255,255,.7)';
        ctx.fillText(streak > 1 ? `🔥 ${streak} in a row` : `${yards} yds`, px + pw - 12, top + fs * 2.8);

        // flash text
        if (flash) {
          const k = flash.t, pop = 1 + Math.max(0, k - (flash.text ? 1.1 : 9)) * 2;
          const fy = top + ph + Math.min(70, H * 0.09);
          ctx.textAlign = 'center';
          if (flash.text) {
            ctx.save(); ctx.translate(W / 2, fy); ctx.scale(pop, pop);
            fitText(ctx, flash.text, Math.min(60, W * 0.13), 900, W * 0.9);
            ctx.lineWidth = 8; ctx.strokeStyle = '#061a36'; ctx.strokeText(flash.text, 0, 0);
            ctx.fillStyle = flash.color; ctx.fillText(flash.text, 0, 0); ctx.restore();
          }
          if (flash.sub) {
            fitText(ctx, flash.sub, Math.min(22, W * 0.05), 800, W * 0.9);
            const sy = fy + Math.min(36, W * 0.085);
            ctx.lineWidth = 5; ctx.strokeStyle = '#061a36'; ctx.strokeText(flash.sub, W / 2, sy);
            ctx.fillStyle = '#fff'; ctx.fillText(flash.sub, W / 2, sy);
          }
        }
        ctx.restore();
        ctx.textAlign = 'left';
      },

      // test hook (read-only snapshot)
      _debug() { return { tally, phase, t, score, strikes, comps, att, recv: recv.map(r => ({ x: r.x, y: r.y, vx: r.vx, vy: r.vy })), defs: defs.map(d => ({ x: d.x, y: d.y })), S, QX, QSY, W, H }; },
    };
  },
};
