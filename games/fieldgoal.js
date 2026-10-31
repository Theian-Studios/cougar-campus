/* ---------------- Field Goal Kick ----------------
   Behind-the-kicker pseudo-3D. Swipe up from the ball: direction = aim, length = power.
   Wind (changes every kick) curves the ball. Each make moves the kick back 5 yards.
   3 misses or 40 s ends the round. */
window.MINIGAMES.fieldgoal = {
  name: 'Field Goal Kick',
  icon: '🏈',
  blurb: 'Swipe kicks through the wind',
  howTo: '<b>Swipe up</b> from the ball: direction aims, length = power (don\'t overdo it!).<br>Watch the 🚩 wind. Every make backs you up 5 yards. 3 misses and you\'re out.',
  create(api) {
    const DUR = 40, MAX_MISS = 3;
    const CZ = 6, CH = 2.5;              // camera: yards behind ball, height
    const HW = 3.08, CB = 3.33, UP = 7.5; // goal half-width, crossbar height, upright height above bar (yards)
    const G = 10.7, VMAX = 30, ELEV = 35 * Math.PI / 180;
    let t = 0, done = false, score = 0, makes = 0, misses = 0, longest = 0, kicks = 0;
    let dist = 20, wind = 0;
    let phase = 'aim', ball = null, trail = [], decided = null, resT = 0, spin = 0;
    let drag = null, charge = null, keyAim = 0, keys = {};
    let flash = null, floaters = [], shake = 0;
    let W = api.W || 390, H = api.H || 700;

    // crowd dots (normalized), fixed for the round
    const CROWD = ['#ffffff', '#002e5d', '#f5c842', '#3d6fb6', '#ffffff', '#8fb3e8', '#ff6b5e', '#ffffff'];
    const dots = [];
    for (let i = 0; i < 1300; i++) dots.push({ u: Math.random() * 2 - 1, v: Math.random(), c: CROWD[(Math.random() * CROWD.length) | 0], ph: Math.random() * 6.28 });

    function newWind() {
      const maxW = Math.min(5, 1.5 + kicks * 0.5);
      wind = (Math.random() < 0.5 ? -1 : 1) * maxW * (kicks === 0 ? Math.random() : 0.4 + 0.6 * Math.random());
    }
    newWind();

    // ---- projection ----
    function f() { return Math.min(1.47 * W, 0.78 * H); }
    function ballY() { return H * 0.84; }
    function hy() { return ballY() - CH * f() / CZ; }
    function P(x, y, z) {
      const d = Math.max(0.6, z + CZ), s = f() / d;
      return [W / 2 + x * s, hy() - (y - CH) * s, s];
    }

    // ---- kicking ----
    function swipeParams(dx, dy) {
      const len = Math.hypot(dx, dy);
      const L = 0.36 * Math.min(H, 1.4 * W);
      const p = Math.min(1.3, len / L);
      let th = Math.atan2(dx, Math.max(1, -dy));
      th = Math.max(-0.8, Math.min(0.8, th));
      return { p, th };
    }
    function kick(p, th) {
      if (phase !== 'aim' || done) return;
      if (p < 0.12) return;
      let aim = th * 0.4;
      if (p > 1) aim += (Math.random() * 2 - 1) * (p - 1) * 0.9; // over-swiped: shank
      const v = VMAX * Math.min(1, p);
      const vh = v * Math.cos(ELEV);
      ball = { x: 0, y: 0.15, z: 0, vx: vh * Math.sin(aim), vy: v * Math.sin(ELEV), vz: vh * Math.cos(aim), t: 0, landed: false };
      trail = []; decided = null; resT = 0; phase = 'flight'; kicks++;
      api.sfx('whoosh');
    }
    function decide(good, msg, x) {
      if (decided) return;
      decided = { good, msg }; resT = 0;
      if (good) {
        const mid = Math.abs(x) < 0.8;
        const pts = 40 + 5 * dist + (mid ? 25 : 0);
        score += pts; makes++; longest = Math.max(longest, dist);
        flash = { text: 'GOOD!', sub: mid ? 'Right down the middle! +25' : `${dist} yards`, color: '#f5c842', t: 1.3 };
        floaters.push({ text: `+${pts}`, x: W / 2, y: H * 0.36 + Math.min(100, W * 0.22), t: 1.2 });
        api.sfx('coin');
      } else {
        misses++;
        flash = { text: 'NO GOOD', sub: msg, color: '#ff6b5e', t: 1.3 };
        api.sfx('bad');
      }
    }
    function nextKick() {
      if (decided && decided.good) dist += 5;
      ball = null; trail = []; decided = null; phase = 'aim'; drag = null; charge = null;
      newWind();
      if (misses >= MAX_MISS || t >= DUR) end();
    }
    function end() {
      if (done) return; done = true;
      api.finish(score, makes ? `${makes} field goal${makes > 1 ? 's' : ''} · longest ${longest} yds` : 'No field goals… the crowd is booing.');
    }

    function stepBall(dt) {
      const b = ball, pz = b.z, px = b.x, py = b.y;
      b.vx += wind * dt;
      b.vy -= G * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.t += dt;
      spin += dt * 14;
      // crossing the goal plane
      if (!decided && pz < dist && b.z >= dist) {
        const k = (dist - pz) / (b.z - pz), cx = px + (b.x - px) * k, cy = py + (b.y - py) * k;
        const ax = Math.abs(cx);
        if (cy < CB - 0.15) {
          if (Math.abs(cy - CB) < 0.3 && ax < HW) { doink(); decide(false, 'Off the crossbar!', cx); }
          else decide(false, 'Short!', cx);
        } else if (Math.abs(ax - HW) < 0.22 && cy < CB + UP) {
          doink(); decide(false, cx < 0 ? 'Doinked off the left upright!' : 'Doinked off the right upright!', cx);
          b.vz *= -0.35; b.vx = -b.vx * 0.5 + (cx < 0 ? 2 : -2);
        } else if (cy < CB + 0.15 && ax < HW) {
          doink(); decide(false, 'Off the crossbar!', cx); b.vz *= -0.3;
        } else if (ax < HW) decide(true, '', cx);
        else decide(false, cx < 0 ? 'Wide left' : 'Wide right', cx);
      }
      if (b.y <= 0 && b.vy < 0) {
        b.y = 0;
        if (!decided) decide(false, b.z < dist ? 'Short!' : 'Short!', b.x);
        if (Math.abs(b.vy) > 2) { b.vy = -b.vy * 0.35; b.vz *= 0.5; b.vx *= 0.5; api.sfx('thud'); }
        else { b.vy = 0; b.vz *= 0.9; b.vx *= 0.9; b.landed = true; }
      }
      trail.push([b.x, b.y, b.z]); if (trail.length > 22) trail.shift();
    }
    function doink() { shake = 1; api.sfx('hit'); }

    // ---- drawing helpers ----
    function quad(ctx, pts, fill) {
      ctx.fillStyle = fill; ctx.beginPath();
      pts.forEach(([x, y, z], i) => { const q = P(x, y, z); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
      ctx.closePath(); ctx.fill();
    }
    function line3(ctx, a, b, color, w) {
      const p = P(...a), q = P(...b);
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, w * (p[2] + q[2]) / 2);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
    function drawBall(ctx, x, y, z, alpha) {
      const [sx, sy, s] = P(x, y, z);
      const r = Math.max(4.5, 0.24 * s);
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(sx, sy);
      const squish = 0.45 + 0.55 * Math.abs(Math.cos(spin));
      ctx.fillStyle = '#8b4a1c'; ctx.strokeStyle = r < 9 ? '#fff' : '#4a240c'; ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.62, r * squish, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (r > 6) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, r * 0.08);
        ctx.beginPath(); ctx.moveTo(0, -r * squish * 0.45); ctx.lineTo(0, r * squish * 0.45); ctx.stroke();
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.14, i * r * squish * 0.16); ctx.lineTo(r * 0.14, i * r * squish * 0.16); ctx.stroke(); }
      }
      ctx.restore();
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
        if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
        floaters.forEach(o => { o.t -= dt; o.y -= dt * 60; }); floaters = floaters.filter(o => o.t > 0);
        if (phase === 'aim') {
          if (keys.left) keyAim = Math.max(-0.8, keyAim - dt * 1.2);
          if (keys.right) keyAim = Math.min(0.8, keyAim + dt * 1.2);
          if (charge) charge.p = Math.min(1.3, charge.p + dt * 0.8);
          if (t >= DUR) end();
        } else if (phase === 'flight') {
          // substeps for reliable plane crossing
          for (let i = 0; i < 3; i++) stepBall(dt / 3);
          if (decided) resT += dt;
          if (decided && (resT > 1.3 || (ball.landed && resT > 0.8)) || ball.t > 5) {
            if (!decided) decide(false, 'Short!', ball.x);
            nextKick();
          }
        }
      },

      tap(x, y) {
        if (done || phase !== 'aim') return;
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
        if (dy > -15) { flash = flash || { text: '', sub: 'Swipe UP toward the goal!', color: '#fff', t: 0.9 }; return; }
        const { p, th } = swipeParams(dx, dy);
        kick(p, th);
      },
      key(k, isDown) {
        if (done) return;
        if (k === 'ArrowLeft' || k === 'a') keys.left = isDown;
        if (k === 'ArrowRight' || k === 'd') keys.right = isDown;
        if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'Enter') {
          if (isDown && !charge && phase === 'aim') charge = { p: 0 };
          else if (!isDown && charge) { const p = charge.p; charge = null; kick(p, keyAim); }
        }
      },

      draw(ctx, w, h) {
        W = w; H = h;
        ctx.save();
        if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 10);
        const HY = hy(), D = dist, ZS = D + 12;
        // sky
        const sky = ctx.createLinearGradient(0, 0, 0, HY);
        sky.addColorStop(0, '#061a36'); sky.addColorStop(1, '#183f73');
        ctx.fillStyle = sky; ctx.fillRect(-20, -20, W + 40, H + 40);
        // stadium lights
        for (const lx of [0.12, 0.88]) {
          const gx = W * lx, gy = Math.max(70, HY - 0.75 * (HY));
          const gl = ctx.createRadialGradient(gx, gy, 2, gx, gy, W * 0.18);
          gl.addColorStop(0, 'rgba(255,250,220,.55)'); gl.addColorStop(1, 'rgba(255,250,220,0)');
          ctx.fillStyle = gl; ctx.fillRect(gx - W * 0.2, gy - W * 0.2, W * 0.4, W * 0.4);
          ctx.fillStyle = '#fffbe6';
          for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.arc(gx + (i - 1) * 9, gy + j * 9, 3, 0, 6.3); ctx.fill(); }
        }
        // stands (back wall)
        quad(ctx, [[-70, 0, ZS], [70, 0, ZS], [70, 28, ZS + 18], [-70, 28, ZS + 18]], '#0d2547');
        quad(ctx, [[-70, 0, ZS], [70, 0, ZS], [70, 1.6, ZS], [-70, 1.6, ZS]], '#002e5d');
        ctx.globalAlpha = 0.6;
        for (const d of dots) {
          const [sx, sy, s] = P(d.u * 70, 2 + d.v * 26, ZS + d.v * 16.5);
          const bob = Math.sin(t * 6 + d.ph) * (flash && flash.color === '#f5c842' ? 0.35 * s : 0.05 * s);
          ctx.fillStyle = d.c; ctx.beginPath(); ctx.arc(sx, sy + bob, Math.max(1, 0.2 * s), 0, 6.3); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // field
        quad(ctx, [[-30, 0, -5], [30, 0, -5], [30, 0, ZS], [-30, 0, ZS]], '#2f8a3c');
        for (let z = -5; z < D - 10; z += 5) { if (Math.floor((z + 100 - D) / 5) % 2) quad(ctx, [[-30, 0, z], [30, 0, z], [30, 0, Math.min(z + 5, D - 10)], [-30, 0, Math.min(z + 5, D - 10)]], '#2a7e36'); }
        // end zone
        quad(ctx, [[-26.7, 0, D - 10], [26.7, 0, D - 10], [26.7, 0, D], [-26.7, 0, D]], '#002e5d');
        // end zone lettering (flat on ground, pseudo)
        {
          const a = P(0, 0, D - 5), s = a[2];
          ctx.save(); ctx.translate(a[0], a[1]); ctx.scale(1, Math.min(1, CH / (D - 5 + CZ) * 2.2));
          ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `900 ${s * 4.2}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('COUGARS', 0, 0); ctx.restore(); ctx.textBaseline = 'alphabetic';
        }
        // lines
        quad(ctx, [[-26.8, 0, -5], [-26.6, 0, -5], [-26.6, 0, ZS - 2], [-26.8, 0, ZS - 2]], '#fff');
        quad(ctx, [[26.6, 0, -5], [26.8, 0, -5], [26.8, 0, ZS - 2], [26.6, 0, ZS - 2]], '#fff');
        line3(ctx, [-26.7, 0, D], [26.7, 0, D], '#fff', 0.15);
        for (let z = D - 10; z > -6; z -= 5) {
          line3(ctx, [-26.7, 0, z], [26.7, 0, z], 'rgba(255,255,255,.85)', 0.12);
          const yl = D - 10 - z; // yard line number (distance from goal line)
          if (yl > 0 && yl % 10 === 0 && z > -2) {
            for (const sx of [-20, 20]) {
              const q = P(sx, 0, z); ctx.fillStyle = 'rgba(255,255,255,.8)';
              ctx.font = `800 ${Math.max(8, q[2] * 2)}px sans-serif`; ctx.textAlign = 'center';
              ctx.fillText(String(Math.min(yl, 100 - yl)), q[0], q[1] - 2);
            }
          }
        }
        for (let z = D - 11; z > -5; z--) { line3(ctx, [-3.1, 0, z], [-2.8, 0, z], 'rgba(255,255,255,.6)', 0.08); line3(ctx, [2.8, 0, z], [3.1, 0, z], 'rgba(255,255,255,.6)', 0.08); }

        const ballBehind = ball && ball.z > D;
        if (ballBehind) drawBallStuff();
        // goal posts
        const gold = '#f5d742';
        line3(ctx, [0, 0, D + 1.5], [0, CB - 0.6, D + 1.5], gold, 0.2);
        line3(ctx, [0, CB - 0.6, D + 1.5], [0, CB, D], gold, 0.2);
        line3(ctx, [-HW, CB, D], [HW, CB, D], gold, 0.15);
        line3(ctx, [-HW, CB, D], [-HW, CB + UP, D], gold, 0.12);
        line3(ctx, [HW, CB, D], [HW, CB + UP, D], gold, 0.12);
        // little ribbons on top showing wind
        for (const sx of [-HW, HW]) {
          const top = P(sx, CB + UP, D), s = top[2];
          ctx.strokeStyle = '#ff6b5e'; ctx.lineWidth = Math.max(1.5, 0.12 * s);
          ctx.beginPath(); ctx.moveTo(top[0], top[1]);
          const L = (0.5 + Math.abs(wind) * 0.5) * s, dirx = Math.sign(wind) || 0;
          ctx.quadraticCurveTo(top[0] + dirx * L * 0.5, top[1] + s * (0.3 + Math.sin(t * 9) * 0.15), top[0] + dirx * L, top[1] + s * (wind ? 0.4 : 1));
          ctx.stroke();
        }
        if (!ballBehind) drawBallStuff();

        // big translucent wind arrows drifting across the screen (size/speed/opacity grow with wind)
        if (wind) {
          const dir = Math.sign(wind), k = Math.min(1, Math.abs(wind) * 3 / 15);
          const size = Math.min(W, H) * (0.07 + 0.07 * k), gap = size * 2.6;
          const rows = [H * 0.36, H * 0.52, H * 0.68];
          const shift = (t * (60 + 220 * k)) % gap;
          ctx.save();
          ctx.globalAlpha = 0.16 + 0.22 * k;
          ctx.fillStyle = '#ffffff';
          rows.forEach((ry, ri) => {
            const off = (ri % 2) * gap / 2;
            for (let x = -gap; x < W + gap; x += gap) {
              const ax = dir > 0 ? x + shift + off : W - (x + shift + off);
              ctx.save(); ctx.translate(ax, ry); ctx.scale(dir, 1);
              // chevron arrow pointing in +x
              ctx.beginPath();
              ctx.moveTo(-size * 0.9, -size * 0.28); ctx.lineTo(size * 0.1, -size * 0.28); ctx.lineTo(size * 0.1, -size * 0.6);
              ctx.lineTo(size * 0.9, 0);
              ctx.lineTo(size * 0.1, size * 0.6); ctx.lineTo(size * 0.1, size * 0.28); ctx.lineTo(-size * 0.9, size * 0.28);
              ctx.closePath(); ctx.fill();
              ctx.restore();
            }
          });
          ctx.restore();
        }

        function drawBallStuff() {
          // tee
          if (!ball || ball.z > 1) { const tq = P(0, 0, 0); ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(tq[0] - 0.15 * tq[2], tq[1]); ctx.lineTo(tq[0] + 0.15 * tq[2], tq[1]); ctx.lineTo(tq[0], tq[1] - 0.18 * tq[2]); ctx.fill(); }
          if (!ball) { drawBall(ctx, 0, 0.3, 0, 1); return; }
          // shadow
          const sh = P(ball.x, 0, ball.z);
          ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(sh[0], sh[1], Math.max(2, 0.2 * sh[2]), Math.max(1, 0.06 * sh[2]), 0, 0, 6.3); ctx.fill();
          // trail
          for (let i = 0; i < trail.length - 1; i += 1) {
            const a = P(...trail[i]), b = P(...trail[i + 1]);
            ctx.strokeStyle = `rgba(255,255,255,${(i / trail.length) * 0.5})`; ctx.lineWidth = Math.max(1, 0.1 * b[2]);
            ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          }
          drawBall(ctx, ball.x, ball.y + 0.15, ball.z, 1);
        }

        const BY = ballY(), cx = W / 2, sm = Math.min(W, H);
        // aim guide + power meter
        let aimP = null;
        if (drag) { const dy = drag.y - drag.y0; if (dy < -5) aimP = swipeParams(drag.x - drag.x0, dy); }
        else if (charge) aimP = { p: charge.p, th: keyAim };
        else if (phase === 'aim' && (keys.left || keys.right || keyAim)) aimP = { p: 0, th: keyAim };
        if (aimP) {
          const len = sm * 0.12 + sm * 0.25 * Math.min(1, aimP.p);
          const ex = cx + Math.sin(aimP.th) * len, ey = BY - 20 - Math.cos(aimP.th) * len;
          ctx.strokeStyle = aimP.p > 1 ? '#ff6b5e' : '#f5c842'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]);
          ctx.beginPath(); ctx.moveTo(cx, BY - 20); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, 6.3); ctx.fill();
          // meter
          const mx = Math.max(16, W * 0.08), mh = Math.min(H * 0.3, 220), my = BY - mh, mw = 16;
          ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(mx - 3, my - 3, mw + 6, mh + 6);
          const okH = mh / 1.3;
          ctx.fillStyle = 'rgba(255,107,94,.35)'; ctx.fillRect(mx, my, mw, mh - okH);
          ctx.fillStyle = aimP.p > 1 ? '#ff6b5e' : '#f5c842';
          const fh = mh * Math.min(1.3, aimP.p) / 1.3; ctx.fillRect(mx, my + mh - fh, mw, fh);
          ctx.fillStyle = '#fff'; ctx.fillRect(mx - 4, my + mh - okH - 1, mw + 8, 2);
          ctx.font = '800 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PWR', mx + mw / 2, BY + 16);
        } else if (phase === 'aim' && !done) {
          const a = 0.5 + 0.5 * Math.sin(t * 5);
          ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * a})`; ctx.textAlign = 'center';
          const hint = kicks === 0 ? '👆 Swipe up from the ball!' : '👆 Swipe up to kick';
          fitText(ctx, hint, Math.min(22, W * 0.055), 800, W * 0.7);
          ctx.fillText(hint, cx, Math.min(H - 18, BY + 46));
        }

        // HUD panel (below the host's top HUD strip)
        const top = 68, fs = Math.min(20, W * 0.048);
        ctx.fillStyle = 'rgba(6,26,54,.72)';
        const pw = Math.min(W - 24, 520), px = (W - pw) / 2;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px, top, pw, fs * 3.4, 12) : ctx.rect(px, top, pw, fs * 3.4); ctx.fill();
        ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `800 ${fs}px sans-serif`;
        ctx.fillText(`${score} pts`, px + 12, top + fs * 1.3);
        ctx.textAlign = 'center'; ctx.fillStyle = '#f5c842'; ctx.font = `900 ${fs * 1.1}px sans-serif`;
        ctx.fillText(`${dist} YD`, W / 2, top + fs * 1.3);
        ctx.textAlign = 'right'; ctx.font = `800 ${fs}px sans-serif`;
        const left = Math.max(0, DUR - t);
        ctx.fillStyle = left < 8 ? '#ff6b5e' : '#fff';
        ctx.fillText(`⏱ ${left.toFixed(0)}s`, px + pw - 12, top + fs * 1.3);
        // misses left + wind
        ctx.textAlign = 'left'; ctx.font = `700 ${fs * 0.85}px sans-serif`; ctx.fillStyle = '#fff';
        let lives = ''; for (let i = 0; i < MAX_MISS; i++) lives += i < MAX_MISS - misses ? '🏈' : '✖️';
        ctx.fillText(lives, px + 12, top + fs * 2.8);
        // wind flag
        const mph = Math.round(Math.abs(wind) * 3);
        const wx = px + pw - 12, wy = top + fs * 2.8;
        ctx.textAlign = 'right'; ctx.fillStyle = mph >= 10 ? '#ff6b5e' : mph >= 5 ? '#f5c842' : '#bfe6ff';
        const arrow = wind < 0 ? '◀ ' : wind > 0 ? '' : '';
        const arrowR = wind > 0 ? ' ▶' : '';
        const wtxt = mph === 0 ? 'Wind: calm' : `Wind ${arrow}${mph} mph${arrowR}`;
        ctx.fillText(wtxt, wx, wy);
        // flag drawing
        {
          const tw = ctx.measureText(wtxt).width, fx = wx - tw - 22, fy = wy - fs * 0.9;
          ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy + fs); ctx.stroke();
          const dir = Math.sign(wind) || 0.15, fl = 6 + Math.abs(wind) * 4, wav = Math.sin(t * (6 + Math.abs(wind) * 3)) * 2;
          ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + dir * fl, fy + 3 + wav); ctx.lineTo(fx, fy + 8); ctx.fill();
        }

        // floaters
        for (const o of floaters) {
          ctx.globalAlpha = Math.min(1, o.t * 2); ctx.fillStyle = '#f5c842'; ctx.textAlign = 'center';
          ctx.font = `900 ${Math.min(40, W * 0.09)}px sans-serif`; ctx.fillText(o.text, o.x, o.y); ctx.globalAlpha = 1;
        }
        // flash
        if (flash) {
          const k = flash.t, pop = 1 + Math.max(0, k - 1.1) * 2;
          ctx.textAlign = 'center';
          if (flash.text) {
            ctx.save(); ctx.translate(W / 2, H * 0.36); ctx.scale(pop, pop);
            ctx.lineWidth = 8; ctx.strokeStyle = '#061a36';
            fitText(ctx, flash.text, Math.min(76, W * 0.17), 900, W * 0.9);
            ctx.strokeText(flash.text, 0, 0); ctx.fillStyle = flash.color; ctx.fillText(flash.text, 0, 0); ctx.restore();
          }
          if (flash.sub) {
            fitText(ctx, flash.sub, Math.min(24, W * 0.055), 800, W * 0.9);
            ctx.lineWidth = 5; ctx.strokeStyle = '#061a36'; ctx.strokeText(flash.sub, W / 2, H * 0.36 + Math.min(44, W * 0.1));
            ctx.fillStyle = '#fff'; ctx.fillText(flash.sub, W / 2, H * 0.36 + Math.min(44, W * 0.1));
          }
        }
        ctx.restore();
        ctx.textAlign = 'left';
      },
    };
  },
};
