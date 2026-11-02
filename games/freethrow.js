/* ---------------- Free-Throw Frenzy ----------------
   Behind-the-shooter pseudo-3D at the Smith Fieldhouse. Flick up from the ball:
   swipe direction aims, swipe length = power (arc). Real-ish rim/backboard physics.
   30 s shot clock, shoot as many as you can (several balls can be in the air).
   After 3 makes the hoop starts sliding, faster with every make.
   Streak multiplier (ON FIRE at 3+ in a row), swish bonus. */
window.MINIGAMES.freethrow = {
  name: 'Free-Throw Frenzy',
  icon: '🏀',
  blurb: 'Flick shots, moving hoop',
  howTo: '<b>Flick up</b> from the ball: direction aims, length = power (match the gold mark).<br>18 seconds. After 3 makes the hoop starts sliding! 3 in a row = ON FIRE 🔥, swishes = bonus.',
  create(api) {
    const DUR = 18;
    const CZ = 2.2, CH = 2.5;                 // camera: metres behind ball, height
    const RIM_Y = 3.05, R = 0.23, BR = 0.12;  // rim height/radius, ball radius
    const HOOP_Z = 4.22, BOARD_Z = 4.6, BASE_Z = 5.82, FT_Z = 0.15;
    const BOARD_HW = 0.9, BOARD_B = 2.9, BOARD_T = 3.95;
    const G = 9.8, ELEV = 62 * Math.PI / 180;
    const START = [0, 1.2, 0];
    const P_IDEAL = 0.72, COOLDOWN = 0.6;
    const BASE_PTS = 40, SWISH_PTS = 20, BANK_PTS = 10;
    // ideal launch speed for a straight free throw at ELEV
    const DH = RIM_Y - START[1], DD = HOOP_Z - START[2];
    const V_IDEAL = Math.sqrt(G * DD * DD / (2 * Math.cos(ELEV) ** 2 * (DD * Math.tan(ELEV) - DH)));

    let W = api.W || 390, H = api.H || 700;
    let t = 0, done = false, ending = false, endT = 0;
    let score = 0, makes = 0, shots = 0, swishes = 0, banks = 0, streak = 0, bestStreak = 0;
    let balls = [], ready = 0, readyPop = 1;
    let hx = 0, hPhase = 0, hMoving = false, hoopVel = 0;
    let drag = null, charge = null, keyAim = 0, keys = {};
    let flash = null, floaters = [], parts = [], shake = 0, netWob = 0, fireT = 0;

    const CROWD = ['#ffffff', '#002e5d', '#f5c842', '#3d6fb6', '#ffffff', '#8fb3e8', '#002e5d', '#ffffff'];
    const dots = [];
    for (let i = 0; i < 1400; i++) dots.push({ u: Math.random() * 2 - 1, v: Math.random(), c: CROWD[(Math.random() * CROWD.length) | 0], ph: Math.random() * 6.28 });

    // ---- projection ----
    function f() { return Math.min(0.5 * H / ((RIM_Y - CH) / (HOOP_Z + CZ) + (CH - START[1]) / (START[2] + CZ)), 1.55 * W); }
    function HY() { return H * 0.35 + (RIM_Y - CH) * f() / (HOOP_Z + CZ); }
    function P(x, y, z) {
      const d = Math.max(0.3, z + CZ), s = f() / d;
      return [W / 2 + x * s, HY() - (y - CH) * s, s];
    }
    function ballScreen() { return P(START[0], START[1], START[2]); }
    function slideAmp() {
      const s = f() / (BOARD_Z + CZ);
      return Math.max(0.25, Math.min(1.0, (W / 2 - 14) / s - BOARD_HW));
    }
    function hoopSpeed() { return Math.min(2.8, 0.9 + 0.17 * Math.max(0, makes - 3)); }
    function hoopAt(tt) { return hMoving ? slideAmp() * Math.sin(hPhase + hoopSpeed() * (tt - t)) : 0; }

    // ---- shooting ----
    function swipeParams(dx, dy) {
      const len = Math.hypot(dx, dy);
      const L = 0.42 * Math.min(H, 1.6 * W);
      const p = Math.min(1.3, len / L);
      let th = Math.atan2(dx, Math.max(1, -dy));
      th = Math.max(-0.7, Math.min(0.7, th));
      return { p, th };
    }
    function shoot(p, th) {
      if (done || ending || ready > 0) return;
      if (p < 0.12) return;
      // compress power error a bit so it's learnable on a phone
      const v = V_IDEAL * (1 + (p / P_IDEAL - 1) * 0.3);
      const vz = v * Math.cos(ELEV), vy = v * Math.sin(ELEV);
      const T = DD / vz;
      const bs = ballScreen(), rs = P(0, RIM_Y, HOOP_Z);
      let xt = 0.7 * Math.tan(th) * (bs[1] - rs[1]) / rs[2];
      const pred = hoopAt(t + T);
      if (Math.abs(xt - pred) < 0.35) xt += (pred - xt) * 0.65; // gentle aim assist
      balls.push({ x: START[0], y: START[1], z: START[2], vx: (xt - START[0]) / T, vy, vz,
        t: 0, rim: 0, board: false, res: null, fade: 1, spin: 0, lastHit: -1, fire: streak >= 3 });
      shots++; ready = COOLDOWN; readyPop = 0;
      api.sfx('whoosh');
    }
    function resolve(b, made) {
      if (b.res) return;
      b.res = made ? 'make' : 'miss';
      if (made) {
        makes++; streak++; bestStreak = Math.max(bestStreak, streak);
        const swish = b.rim === 0 && !b.board;
        const bank = b.board;
        const mult = streak >= 6 ? 2 : streak >= 3 ? 1.5 : 1;
        let pts = BASE_PTS + (swish ? SWISH_PTS : 0) + (bank ? BANK_PTS : 0) + (hMoving ? 10 : 0);
        pts = Math.round(pts * mult);
        score += pts;
        if (swish) swishes++; if (bank) banks++;
        netWob = 1;
        const word = swish ? 'SWISH!' : bank ? 'BANK SHOT!' : ['BUCKET!', 'NOTHING BUT… RIM!', 'COUNTS!'][Math.min(2, b.rim)];
        let sub = mult > 1 ? `${streak} in a row · x${mult}` : swish ? `+${SWISH_PTS} swish bonus` : '';
        if (streak === 3) sub = "HE'S ON FIRE 🔥";
        flash = { text: word, sub, color: swish ? '#f5c842' : '#ffffff', t: 1.0 };
        const rp = P(hx, RIM_Y, HOOP_Z);
        floaters.push({ text: `+${pts}`, x: rp[0], y: rp[1] + 40, t: 1.2, color: mult > 1 ? '#ff9d2e' : '#f5c842' });
        for (let i = 0; i < 18; i++) parts.push({ x: rp[0], y: rp[1] + 20, vx: (Math.random() - 0.5) * 320, vy: -Math.random() * 260, t: 0.6 + Math.random() * 0.5, c: ['#f5c842', '#fff', '#3d6fb6'][i % 3] });
        api.sfx('coin');
        if (makes === 3) { hMoving = true; hPhase = 0; flash.sub = 'Uh oh… the hoop is moving!'; api.sfx('go'); }
      } else {
        const lostFire = streak >= 3;
        streak = 0;
        const msg = b.rim ? 'Rimmed out!' : b.board ? 'Off the glass' : (b.z < HOOP_Z ? 'AIRBALL!' : 'Long!');
        flash = { text: '', sub: lostFire ? `${msg} · fire's out 💨` : msg, color: '#ff6b5e', t: 0.9 };
        api.sfx('bad');
      }
    }
    function end() {
      if (done) return; done = true;
      const pct = shots ? Math.round(100 * makes / shots) : 0;
      api.finish(score, makes
        ? `${makes}/${shots} made (${pct}%) · ${swishes} swish${swishes === 1 ? '' : 'es'} · best streak ${bestStreak}`
        : `0/${shots}… the student section is chanting "AIR-BALL"`);
    }

    function stepBall(b, dt) {
      const py = b.y, pz = b.z;
      b.vy -= G * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.t += dt;
      b.spin -= dt * 9;
      // backboard (front face)
      if (b.vz > 0 && b.z + BR > BOARD_Z && pz + BR <= BOARD_Z + 0.08 && Math.abs(b.x - hx) < BOARD_HW + BR * 0.5 && b.y > BOARD_B - BR && b.y < BOARD_T + BR) {
        b.z = BOARD_Z - BR; b.vz = -Math.abs(b.vz) * 0.55; b.vx = b.vx * 0.8 + hoopVel * 0.3; b.vy *= 0.85;
        if (!b.board && !b.res) api.sfx('thud');
        b.board = true; shake = Math.max(shake, 0.35);
      }
      // rim (torus): closest point on rim circle
      const dx = b.x - hx, dz = b.z - HOOP_Z, hd = Math.hypot(dx, dz) || 1e-6;
      const qx = hx + dx / hd * R, qz = HOOP_Z + dz / hd * R;
      let nx = b.x - qx, ny = b.y - RIM_Y, nz = b.z - qz;
      const dist = Math.hypot(nx, ny, nz);
      if (dist < BR && dist > 1e-6) {
        nx /= dist; ny /= dist; nz /= dist;
        const vn = b.vx * nx + b.vy * ny + b.vz * nz;
        if (vn < 0) {
          const e = 0.5;
          b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; b.vz -= (1 + e) * vn * nz;
          b.vx = b.vx * 0.88 + hoopVel * 0.2; b.vz *= 0.88;
          if (-vn > 0.6 && b.t - b.lastHit > 0.12) { b.rim++; b.lastHit = b.t; if (!b.res) api.sfx('hit'); shake = Math.max(shake, 0.25); }
        }
        b.x = qx + nx * BR; b.y = RIM_Y + ny * BR; b.z = qz + nz * BR;
      }
      // through the hoop?
      if (!b.res && py >= RIM_Y && b.y < RIM_Y && b.vy < 0) {
        const k = (py - RIM_Y) / (py - b.y);
        const cz = pz + (b.z - pz) * k;
        if (Math.hypot(b.x - hx, cz - HOOP_Z) < R - 0.025) resolve(b, true);
      }
      // missed: fell below the rim region, or way off
      if (!b.res && b.vy < 0 && b.y < RIM_Y - 0.55) resolve(b, false);
      if (!b.res && (b.t > 3.5 || b.z > BASE_Z + 1)) resolve(b, false);
      // floor
      if (b.y < BR && b.vy < 0) {
        b.y = BR;
        if (Math.abs(b.vy) > 1.2) { b.vy = -b.vy * 0.6; b.vx *= 0.8; b.vz *= 0.8; }
        else { b.vy = 0; b.vx *= 0.95; b.vz *= 0.95; }
      }
      // back wall
      if (b.z > BASE_Z + 1.6) { b.z = BASE_Z + 1.6; b.vz = -Math.abs(b.vz) * 0.4; }
    }

    // ---- drawing helpers ----
    function quad(ctx, pts, fill) {
      ctx.fillStyle = fill; ctx.beginPath();
      pts.forEach(([x, y, z], i) => { const q = P(x, y, z); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
      ctx.closePath(); ctx.fill();
    }
    function line3(ctx, a, b, color, w, minW = 1) {
      const p = P(...a), q = P(...b);
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(minW, w * (p[2] + q[2]) / 2);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
    function ring3(ctx, cx, y, cz, r, color, w, a0 = 0, a1 = Math.PI * 2, n = 28) {
      ctx.strokeStyle = color; ctx.beginPath();
      let sAvg = 0;
      for (let i = 0; i <= n; i++) {
        const a = a0 + (a1 - a0) * i / n, q = P(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
        sAvg += q[2]; i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      }
      ctx.lineWidth = Math.max(1.5, w * sAvg / (n + 1)); ctx.stroke();
    }
    function drawBallAt(ctx, sx, sy, r, spin, alpha, fire) {
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(sx, sy);
      if (fire) {
        const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2);
        g.addColorStop(0, 'rgba(255,170,40,.7)'); g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, 6.3); ctx.fill();
      }
      const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      grad.addColorStop(0, '#ffa04d'); grad.addColorStop(1, '#d4621a');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.clip();
      ctx.rotate(spin);
      ctx.strokeStyle = '#3a1a06'; ctx.lineWidth = Math.max(1, r * 0.07);
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-r * 0.95, 0, r * 0.55, r * 0.95, 0, -1.6, 1.6); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(r * 0.95, 0, r * 0.55, r * 0.95, 0, 1.55, 4.7); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = 'rgba(40,15,0,.6)'; ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.stroke();
      ctx.restore();
    }
    function drawBall(ctx, b) {
      const sh = P(b.x, 0, b.z);
      ctx.fillStyle = `rgba(0,0,0,${0.25 * b.fade})`; ctx.beginPath();
      ctx.ellipse(sh[0], sh[1], Math.max(2, BR * 1.1 * sh[2]), Math.max(1, BR * 0.35 * sh[2]), 0, 0, 6.3); ctx.fill();
      const q = P(b.x, b.y, b.z);
      drawBallAt(ctx, q[0], q[1], Math.max(3, BR * q[2]), b.spin, b.fade, b.fire && !b.res);
    }
    function fitText(ctx, txt, size, weight, maxW) {
      ctx.font = `${weight} ${size}px sans-serif`;
      const m = ctx.measureText(txt).width;
      if (m > maxW) ctx.font = `${weight} ${size * maxW / m}px sans-serif`;
    }

    return {
      update(dt) {
        if (done) return;
        W = api.W || W; H = api.H || H;
        t += dt;
        shake = Math.max(0, shake - dt * 3);
        netWob = Math.max(0, netWob - dt * 1.6);
        ready = Math.max(0, ready - dt);
        if (ready <= 0) readyPop = Math.min(1, readyPop + dt * 6);
        if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
        floaters.forEach(o => { o.t -= dt; o.y -= dt * 60; }); floaters = floaters.filter(o => o.t > 0);
        parts.forEach(p => { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; }); parts = parts.filter(p => p.t > 0);
        // hoop
        const oldHx = hx;
        if (hMoving) { hPhase += hoopSpeed() * dt; hx = slideAmp() * Math.sin(hPhase); }
        hoopVel = (hx - oldHx) / Math.max(dt, 1e-4);
        // balls
        for (const b of balls) {
          for (let i = 0; i < 8; i++) stepBall(b, dt / 8);
          if (b.res) b.fade -= dt * (b.res === 'make' ? 0.7 : 0.9);
          if (b.fire && !b.res && Math.random() < 0.8) {
            const q = P(b.x, b.y, b.z);
            parts.push({ x: q[0] + (Math.random() - 0.5) * 8, y: q[1], vx: (Math.random() - 0.5) * 40, vy: 30 + Math.random() * 40, t: 0.35, c: Math.random() < 0.5 ? '#ff9d2e' : '#ffd23f', fire: true });
          }
        }
        balls = balls.filter(b => b.fade > 0);
        if (streak >= 3) fireT += dt;
        // keyboard
        if (keys.left) keyAim = Math.max(-0.7, keyAim - dt * 1.1);
        if (keys.right) keyAim = Math.min(0.7, keyAim + dt * 1.1);
        if (charge) charge.p = Math.min(1.3, charge.p + dt * 0.95);
        // clock
        if (!ending && t >= DUR) { ending = true; endT = 0; drag = null; charge = null; api.sfx('beep'); }
        if (ending) {
          endT += dt;
          if ((balls.every(b => b.res) && endT > 0.6) || endT > 3) end();
        }
      },

      tap(x, y) {
        if (done || ending) return;
        drag = { x0: x, y0: y, x, y };
      },
      move(x, y, isDown) {
        if (!drag || !isDown) return;
        drag.x = x; drag.y = y;
      },
      release(x, y) {
        if (!drag || done || ending) { drag = null; return; }
        if (x != null) { drag.x = x; drag.y = y; }
        const dx = drag.x - drag.x0, dy = drag.y - drag.y0;
        drag = null;
        if (dy > -15) { if (!flash) flash = { text: '', sub: 'Flick UP toward the hoop!', color: '#fff', t: 0.8 }; return; }
        const { p, th } = swipeParams(dx, dy);
        shoot(p, th);
      },
      key(k, isDown) {
        if (done || ending) return;
        if (k === 'ArrowLeft' || k === 'a') keys.left = isDown;
        if (k === 'ArrowRight' || k === 'd') keys.right = isDown;
        if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'Enter') {
          if (isDown && !charge) charge = { p: 0 };
          else if (!isDown && charge) { const p = charge.p; charge = null; shoot(p, keyAim); }
        }
      },

      draw(ctx, w, h) {
        W = w; H = h;
        ctx.save();
        if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 10, (Math.random() - 0.5) * shake * 8);
        const hy = HY(), FZ = BASE_Z + 1.8;
        // arena backdrop
        const bg = ctx.createLinearGradient(0, 0, 0, hy);
        bg.addColorStop(0, '#030d1d'); bg.addColorStop(1, '#0c2850');
        ctx.fillStyle = bg; ctx.fillRect(-20, -20, W + 40, H + 40);
        // roof lights
        ctx.fillStyle = 'rgba(255,250,225,.75)';
        for (let i = -3; i <= 3; i++) {
          const q = P(i * 3, 13, FZ + 6);
          ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(2, q[2] * 0.25), 0, 6.3); ctx.fill();
        }
        // stands: rising bowl behind baseline
        quad(ctx, [[-30, 0.7, FZ], [30, 0.7, FZ], [30, 11, FZ + 12], [-30, 11, FZ + 12]], '#0a2246');
        ctx.globalAlpha = 0.75;
        for (const d of dots) {
          const [sx, sy, s] = P(d.u * 28, 1.1 + d.v * 9.6, FZ + 0.4 + d.v * 11.2);
          const hype = (flash && flash.color === '#f5c842') || streak >= 3;
          const bob = Math.sin(t * 7 + d.ph) * (hype ? 0.18 * s : 0.03 * s);
          ctx.fillStyle = d.c; ctx.beginPath(); ctx.arc(sx, sy + bob, Math.max(1, 0.075 * s), 0, 6.3); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // baseline wall / scorer banner
        quad(ctx, [[-30, 0, FZ], [30, 0, FZ], [30, 0.7, FZ], [-30, 0.7, FZ]], '#002e5d');
        {
          const q = P(0, 0.35, FZ);
          ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = `900 ${q[2] * 0.55}px sans-serif`;
          ctx.fillText('SMITH FIELDHOUSE', q[0], q[1]);
          for (const sx of [-1, 1]) { const r = P(sx * 7.5, 0.35, FZ); ctx.fillStyle = '#f5c842'; ctx.fillText('GO COUGS', r[0], r[1]); }
          ctx.textBaseline = 'alphabetic';
        }
        // hardwood floor
        quad(ctx, [[-30, 0, -2], [30, 0, -2], [30, 0, FZ], [-30, 0, FZ]], '#d8a465');
        ctx.globalAlpha = 0.18;
        for (let x = -12; x <= 12; x += 0.4) line3(ctx, [x, 0, -1.5], [x, 0, FZ], (Math.round(x / 0.4) % 3) ? '#8a5a2b' : '#a87038', 0.012, 0.6);
        ctx.globalAlpha = 1;
        // lane (key) + lines
        quad(ctx, [[-2.45, 0, FT_Z], [2.45, 0, FT_Z], [2.45, 0, BASE_Z], [-2.45, 0, BASE_Z]], '#0b3a73');
        line3(ctx, [-2.45, 0, FT_Z], [2.45, 0, FT_Z], '#fff', 0.05);
        line3(ctx, [-2.45, 0, FT_Z], [-2.45, 0, BASE_Z], '#fff', 0.05);
        line3(ctx, [2.45, 0, FT_Z], [2.45, 0, BASE_Z], '#fff', 0.05);
        line3(ctx, [-12, 0, BASE_Z], [12, 0, BASE_Z], '#fff', 0.05);
        ring3(ctx, 0, 0, FT_Z, 1.8, '#fff', 0.05, 0, Math.PI);
        ring3(ctx, 0, 0, HOOP_Z, 1.25, 'rgba(255,255,255,.8)', 0.04, 0, Math.PI);
        {
          const q = P(0, 0, (FT_Z + BASE_Z) / 2 + 1);
          ctx.save(); ctx.translate(q[0], q[1]); ctx.scale(1, 0.32);
          ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.font = `900 ${q[2] * 1.1}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('COUGARS', 0, 0); ctx.restore(); ctx.textBaseline = 'alphabetic';
        }

        // hoop assembly (slides with hx)
        const rx = hx;
        // overhead support cables
        line3(ctx, [rx - 0.6, BOARD_T, BOARD_Z + 0.05], [rx - 0.9, 12, BOARD_Z + 3], '#55657e', 0.04);
        line3(ctx, [rx + 0.6, BOARD_T, BOARD_Z + 0.05], [rx + 0.9, 12, BOARD_Z + 3], '#55657e', 0.04);
        if (hMoving) {
          // track rail
          line3(ctx, [-slideAmp() - 1.2, BOARD_T + 0.35, BOARD_Z + 0.05], [slideAmp() + 1.2, BOARD_T + 0.35, BOARD_Z + 0.05], '#8a96aa', 0.05);
          line3(ctx, [rx, BOARD_T, BOARD_Z + 0.05], [rx, BOARD_T + 0.35, BOARD_Z + 0.05], '#8a96aa', 0.05);
        }
        // backboard
        quad(ctx, [[rx - BOARD_HW, BOARD_B, BOARD_Z], [rx + BOARD_HW, BOARD_B, BOARD_Z], [rx + BOARD_HW, BOARD_T, BOARD_Z], [rx - BOARD_HW, BOARD_T, BOARD_Z]], 'rgba(232,242,255,.94)');
        {
          const a = P(rx - BOARD_HW, BOARD_T, BOARD_Z), b = P(rx + BOARD_HW, BOARD_B, BOARD_Z);
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, 0.05 * a[2]); ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
          // shooter's square
          const c = P(rx - 0.3, RIM_Y + 0.45, BOARD_Z), d = P(rx + 0.3, RIM_Y + 0.02, BOARD_Z);
          ctx.strokeStyle = '#d24a2a'; ctx.lineWidth = Math.max(1.5, 0.04 * a[2]); ctx.strokeRect(c[0], c[1], d[0] - c[0], d[1] - c[1]);
          // padding strip
          const e = P(rx - BOARD_HW, BOARD_B + 0.08, BOARD_Z - 0.01);
          ctx.fillStyle = '#002e5d'; ctx.fillRect(a[0], e[1], b[0] - a[0], b[1] - e[1]);
        }
        // rim bracket
        line3(ctx, [rx, RIM_Y, HOOP_Z + R], [rx, RIM_Y, BOARD_Z], '#ff5a1f', 0.05);
        // back half of rim
        ring3(ctx, rx, RIM_Y, HOOP_Z, R, '#ff5a1f', 0.035, 0, Math.PI);
        // balls behind the front rim
        const sorted = balls.slice().sort((a, b) => b.z - a.z);
        const isBack = b => b.z > HOOP_Z - R * 0.6 && b.y < RIM_Y + 0.5;
        for (const b of sorted) if (isBack(b)) drawBall(ctx, b);
        // net
        {
          const n = 12, depth = 0.45 + netWob * 0.12 * Math.sin(t * 22), br = 0.13 - netWob * 0.04;
          ctx.strokeStyle = 'rgba(255,255,255,.85)';
          const top = [], bot = [];
          for (let i = 0; i < n; i++) {
            const a = i / n * Math.PI * 2;
            top.push(P(rx + Math.cos(a) * R, RIM_Y, HOOP_Z + Math.sin(a) * R));
            bot.push(P(rx + Math.cos(a) * br, RIM_Y - depth, HOOP_Z + Math.sin(a) * br));
          }
          ctx.lineWidth = Math.max(1, top[0][2] * 0.012);
          for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            ctx.beginPath(); ctx.moveTo(top[i][0], top[i][1]); ctx.lineTo(bot[j][0], bot[j][1]); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(top[j][0], top[j][1]); ctx.lineTo(bot[i][0], bot[i][1]); ctx.stroke();
          }
          ctx.beginPath(); bot.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.stroke();
        }
        // front half of rim
        ring3(ctx, rx, RIM_Y, HOOP_Z, R, '#ff6a2a', 0.035, Math.PI, Math.PI * 2);
        // balls in front
        for (const b of sorted) if (!isBack(b)) drawBall(ctx, b);

        // ball in hand
        const [bx, by, bsc] = ballScreen();
        const br0 = BR * bsc;
        if (!ending && !done) {
          const pop = ready > 0 ? 0 : 0.6 + 0.4 * Math.min(1, readyPop) + Math.sin(Math.min(1, readyPop) * Math.PI) * 0.15;
          if (pop > 0) {
            ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(bx, by + br0 * 1.15, br0 * 0.9, br0 * 0.25, 0, 0, 6.3); ctx.fill();
            drawBallAt(ctx, bx, by, br0 * pop, 0.3, 1, streak >= 3);
          }
        }

        // aim guide + power meter
        let aimP = null;
        if (drag) { const dy = drag.y - drag.y0; if (dy < -5) aimP = swipeParams(drag.x - drag.x0, dy); }
        else if (charge) aimP = { p: charge.p, th: keyAim };
        else if (!ending && (keys.left || keys.right || keyAim)) aimP = { p: 0, th: keyAim };
        const sm = Math.min(W, H);
        if (aimP && !ending) {
          const len = sm * 0.1 + sm * 0.28 * Math.min(1, aimP.p);
          const sy0 = by - br0 - 6;
          const the = Math.atan(0.7 * Math.tan(aimP.th));
          const ex = bx + Math.sin(the) * len, ey = sy0 - Math.cos(the) * len;
          const good = Math.abs(aimP.p - P_IDEAL) < 0.035;
          ctx.strokeStyle = aimP.p > 1 ? '#ff6b5e' : good ? '#7dff9b' : '#f5c842'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]);
          ctx.beginPath(); ctx.moveTo(bx, sy0); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, 6.3); ctx.fill();
          // meter
          const mx = Math.max(16, W * 0.07), mh = Math.min(H * 0.3, 220), my = by + br0 - mh, mw = 16;
          ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(mx - 3, my - 3, mw + 6, mh + 6);
          ctx.fillStyle = aimP.p > 1 ? '#ff6b5e' : good ? '#7dff9b' : '#f5c842';
          const fh = mh * Math.min(1.3, aimP.p) / 1.3; ctx.fillRect(mx, my + mh - fh, mw, fh);
          const iy = my + mh - mh * P_IDEAL / 1.3;
          ctx.fillStyle = 'rgba(125,255,155,.35)'; ctx.fillRect(mx, iy - mh * 0.035 / 1.3, mw, mh * 0.07 / 1.3);
          ctx.fillStyle = '#f5c842'; ctx.fillRect(mx - 6, iy - 1.5, mw + 12, 3);
          ctx.fillStyle = '#fff'; ctx.font = '800 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PWR', mx + mw / 2, my + mh + 16);
        } else if (!ending && !done && shots < 2 && !flash) {
          const a = 0.5 + 0.5 * Math.sin(t * 5);
          ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * a})`; ctx.textAlign = 'center';
          const hint = shots === 0 ? '👆 Flick up from the ball!' : '👆 Keep shooting!';
          fitText(ctx, hint, Math.min(22, W * 0.055), 800, W * 0.7);
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(6,26,54,.8)';
          const hyy = Math.max(by - br0 - 70, H * 0.55);
          ctx.strokeText(hint, bx, hyy); ctx.fillText(hint, bx, hyy);
        }

        // particles
        for (const p of parts) {
          ctx.globalAlpha = Math.min(1, p.t * 2.5); ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.fire ? 4 : 3, 0, 6.3); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // HUD panel
        const top = 66, fs = Math.min(19, W * 0.047);
        const pw = Math.min(W - 24, 520), px = (W - pw) / 2, ph = fs * 2.2;
        ctx.fillStyle = 'rgba(6,26,54,.78)';
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px, top, pw, ph, 12) : ctx.rect(px, top, pw, ph); ctx.fill();
        const ty = top + ph / 2 + fs * 0.36;
        ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `800 ${fs}px sans-serif`;
        ctx.fillText(`${score} pts`, px + 12, ty);
        ctx.textAlign = 'right';
        ctx.fillText(`🏀 ${makes}/${shots}`, px + pw - 12, ty);
        // shot clock box
        const left = Math.max(0, DUR - t);
        const cw = fs * 3.4, chh = ph + 10, cx0 = W / 2 - cw / 2;
        ctx.fillStyle = '#111'; ctx.strokeStyle = '#f5c842'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx0, top - 5, cw, chh, 8) : ctx.rect(cx0, top - 5, cw, chh); ctx.fill(); ctx.stroke();
        ctx.textAlign = 'center'; ctx.font = `900 ${fs * 1.5}px monospace`;
        ctx.fillStyle = left < 5 && Math.floor(t * 4) % 2 ? '#ffffff' : '#ff3b30';
        ctx.fillText(String(Math.ceil(left)).padStart(2, '0'), W / 2, top + ph / 2 + fs * 0.52);
        // status line
        let sy2 = top + ph + 24;
        if (streak >= 3) {
          const mult = streak >= 6 ? 2 : 1.5;
          const s = 1 + 0.06 * Math.sin(fireT * 10);
          ctx.save(); ctx.translate(W / 2, sy2); ctx.scale(s, s);
          fitText(ctx, `ON FIRE 🔥 x${mult}`, fs * 1.15, 900, W * 0.8);
          ctx.lineWidth = 5; ctx.strokeStyle = '#3a0d00'; ctx.strokeText(`ON FIRE 🔥 x${mult}`, 0, 0);
          ctx.fillStyle = '#ff9d2e'; ctx.fillText(`ON FIRE 🔥 x${mult}`, 0, 0); ctx.restore();
          sy2 += fs * 1.3;
        } else if (streak > 0) {
          ctx.font = `800 ${fs * 0.8}px sans-serif`; ctx.fillStyle = '#ffd27a';
          ctx.fillText(`Streak ${streak} · ${3 - streak} more for 🔥`, W / 2, sy2); sy2 += fs * 1.1;
        }
        if (!hMoving && makes > 0 && makes < 3) {
          ctx.font = `700 ${fs * 0.7}px sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.7)';
          ctx.fillText(`Hoop starts moving in ${3 - makes}…`, W / 2, sy2);
        }

        // floaters
        for (const o of floaters) {
          ctx.globalAlpha = Math.min(1, o.t * 2); ctx.fillStyle = o.color; ctx.textAlign = 'center';
          ctx.lineWidth = 5; ctx.strokeStyle = '#061a36';
          ctx.font = `900 ${Math.min(38, W * 0.085)}px sans-serif`; ctx.strokeText(o.text, o.x, o.y); ctx.fillText(o.text, o.x, o.y);
          ctx.globalAlpha = 1;
        }
        // flash
        const fy = H * 0.66;
        if (flash) {
          const k = flash.t, pop = 1 + Math.max(0, k - 0.8) * 2;
          ctx.textAlign = 'center';
          if (flash.text) {
            ctx.save(); ctx.translate(W / 2, fy); ctx.scale(pop, pop);
            ctx.lineWidth = 8; ctx.strokeStyle = '#061a36';
            fitText(ctx, flash.text, Math.min(64, W * 0.14), 900, W * 0.9);
            ctx.strokeText(flash.text, 0, 0); ctx.fillStyle = flash.color; ctx.fillText(flash.text, 0, 0); ctx.restore();
          }
          if (flash.sub) {
            const yy = flash.text ? fy + Math.min(40, W * 0.09) : fy;
            fitText(ctx, flash.sub, Math.min(22, W * 0.052), 800, W * 0.9);
            ctx.lineWidth = 5; ctx.strokeStyle = '#061a36'; ctx.strokeText(flash.sub, W / 2, yy);
            ctx.fillStyle = flash.color === '#ff6b5e' ? '#ffb3ab' : '#fff'; ctx.fillText(flash.sub, W / 2, yy);
          }
        }
        if (ending) {
          ctx.textAlign = 'center'; ctx.lineWidth = 8; ctx.strokeStyle = '#061a36';
          fitText(ctx, 'BZZZT! TIME!', Math.min(56, W * 0.12), 900, W * 0.9);
          ctx.strokeText('BZZZT! TIME!', W / 2, H * 0.47); ctx.fillStyle = '#ff3b30'; ctx.fillText('BZZZT! TIME!', W / 2, H * 0.47);
        }
        ctx.restore();
        ctx.textAlign = 'left';
      },
    };
  },
};
