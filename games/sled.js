/* ---------------- Y Mountain Sled ----------------
   Top-down endless downhill. You sled automatically; steer left/right to dodge
   rocks, pines and hikers. Grab Creamery coupons. 3 crashes or 40 s ends the run.
   Score = distance + coupons + near-miss bonus. */
window.MINIGAMES.sled = {
  name: 'Y Mountain Sled',
  icon: '🛷',
  blurb: 'Dodge rocks on the way down',
  howTo: 'Drag left/right (or ← →) to steer down Y Mountain.<br>Dodge 🪨 rocks, 🌲 trees and hikers, grab 🎟️ coupons, skim close for bonus. 3 crashes = out!',
  create(api) {
    const DUR = 24, LIVES = 3, COUPON = 25, NEAR = 15, DIST_PTS = 1.6;
    const PR = 0.32;                      // player radius (in units)
    let t = 0, d = 0, speed = 5, done = false, endT = 0;
    let px = 0.5, vx = 0, targetX = null, keyL = false, keyR = false;
    let lives = LIVES, tumble = 0, inv = 0, shake = 0, flash = 0;
    let coupons = 0, nears = 0, bonus = 0;
    let objs = [], nextRow = 9, floaters = [], trail = [], puffs = [];
    let PW = 390, PL = 0, U = 43, PY = 250, Wc = 390, Hc = 844;
    const SCEN = []; // background scenery: shading blobs
    for (let i = 0; i < 40; i++) SCEN.push({ x: Math.random(), y: Math.random() * 30, w: 1 + Math.random() * 3, h: 0.25 + Math.random() * 0.5 });
    const Y_AT = 3.2;                       // world y of the big gold Y (top)

    const rnd = (a, b) => a + Math.random() * (b - a);
    function spawnRow() {
      const prog = Math.min(1, t / DUR);
      const gap = 2.4 - 1.0 * prog;
      const y = nextRow; nextRow += gap * rnd(0.8, 1.2);
      const n = Math.random() < 0.35 + prog * 0.45 ? 2 : 1;
      const used = [];
      for (let i = 0; i < n; i++) {
        let x, tries = 0;
        do { x = rnd(0.06, 0.94); tries++; } while (tries < 10 && used.some(u => Math.abs(u - x) < 0.28));
        used.push(x);
        const r = Math.random();
        const kind = r < 0.38 ? 'tree' : r < 0.74 ? 'rock' : (t > 4 ? 'hiker' : 'rock');
        objs.push({ kind, x, y: y + rnd(-0.3, 0.3), r: kind === 'tree' ? 0.36 : kind === 'rock' ? 0.34 : 0.28,
          vx: kind === 'hiker' ? rnd(0.04, 0.09) * (Math.random() < 0.5 ? -1 : 1) : 0, passed: false, hitDone: false, ph: Math.random() * 6 });
      }
      if (Math.random() < 0.42) {
        let x, tries = 0;
        do { x = rnd(0.08, 0.92); tries++; } while (tries < 10 && used.some(u => Math.abs(u - x) < 0.18));
        objs.push({ kind: 'coupon', x, y: y + gap * 0.5, r: 0.34, vx: 0, ph: Math.random() * 6 });
      }
    }
    function pop(text, x, y, color) { floaters.push({ text, x, y, t: 1, color }); }
    function score() { return Math.round(d * DIST_PTS + coupons * COUPON + bonus); }
    function end(reason) {
      if (done) return; done = true;
      const s = score();
      api.finish(s, `${reason} · ${Math.round(d * 2)} m · 🎟️×${coupons} · ${nears} close calls`);
    }
    function crash(o) {
      lives--; tumble = 0.9; inv = 2.4; shake = 1; flash = 1; speed *= 0.45;
      api.sfx('hit');
      for (let i = 0; i < 14; i++) puffs.push({ x: px, y: d, vx: rnd(-2, 2), vy: rnd(-1, 3), t: rnd(0.4, 0.8) });
      pop(o.kind === 'hiker' ? 'Sorry!! 🙏' : 'OOF!', px, d, '#ff5a4e');
      if (lives <= 0) { endT = 1.1; api.sfx('thud'); }
    }

    function steerTo(x) { targetX = Math.max(0.04, Math.min(0.96, (x - PL) / PW)); }

    return {
      update(dt) {
        shake = Math.max(0, shake - dt * 3); flash = Math.max(0, flash - dt * 3);
        for (const f of floaters) f.t -= dt * 0.9;
        floaters = floaters.filter(f => f.t > 0);
        for (const p of puffs) { p.x += p.vx * dt / 9; p.y += p.vy * dt; p.t -= dt; }
        puffs = puffs.filter(p => p.t > 0);
        if (done) return;
        if (endT > 0) { endT -= dt; tumble = Math.max(tumble, 0.2); d += speed * dt * 0.3; speed *= 0.97; if (endT <= 0) end('Wiped out!'); return; }
        t += dt;
        tumble = Math.max(0, tumble - dt); inv = Math.max(0, inv - dt);
        // speed ramps 5 → ~14 units/s; recovers after a crash
        const want = 5 + 5.5 * Math.min(1, t / DUR);
        speed += (want - speed) * Math.min(1, dt * (tumble > 0 ? 0.3 : 1.2));
        d += speed * dt;
        // steering
        const steerSpeed = 1.15;            // corridor-widths per second, max
        if (tumble <= 0) {
          if (keyL || keyR) { vx += ((keyR - keyL) * steerSpeed - vx) * Math.min(1, dt * 10); targetX = null; }
          else if (targetX !== null) { const want2 = Math.max(-steerSpeed, Math.min(steerSpeed, (targetX - px) * 9)); vx += (want2 - vx) * Math.min(1, dt * 14); }
          else vx *= Math.pow(0.02, dt);
        } else vx *= Math.pow(0.05, dt);
        px = Math.max(0.04, Math.min(0.96, px + vx * dt));
        trail.push({ x: px, y: d }); if (trail.length > 90) trail.shift();
        // spawn ahead
        const ahead = d + (Hc - PY) / U + 2;
        while (nextRow < ahead) spawnRow();
        // objects
        const pxU = px * PW / U;
        for (const o of objs) {
          if (o.vx) { o.x += o.vx * dt; if (o.x < 0.05 || o.x > 0.95) o.vx *= -1; }
          if (o.gone) continue;
          const dx = o.x * PW / U - pxU, dy = o.y - d, dist = Math.hypot(dx, dy);
          if (o.kind === 'coupon') {
            if (dist < PR + o.r + 0.1 && tumble <= 0) {
              o.gone = true; coupons++; api.sfx('coin'); pop(`+${COUPON} 🍦`, o.x, o.y, '#f5c842');
            }
            continue;
          }
          if (!o.hitDone && dist < PR + o.r - 0.06) {
            o.hitDone = true;
            if (inv <= 0) { crash(o); if (lives <= 0) return; }
            continue;
          }
          if (!o.passed && dy < -0.1) {
            o.passed = true;
            if (!o.hitDone && inv <= 0 && tumble <= 0 && Math.abs(dx) < PR + o.r + 0.55) {
              nears++; bonus += NEAR; api.sfx('whoosh'); pop(`close! +${NEAR}`, o.x, o.y, '#3fd8ff');
            }
          }
        }
        objs = objs.filter(o => o.y > d - PY / U - 2);
        if (t >= DUR) end('Made it down!');
      },
      tap(x) { if (!done) steerTo(x); },
      move(x, y, isDown) { if (!done && isDown) steerTo(x); },
      release() {},
      key(k, isDown) {
        if (k === 'ArrowLeft' || k === 'a') keyL = isDown;
        else if (k === 'ArrowRight' || k === 'd') keyR = isDown;
      },
      draw(ctx, W, H) {
        Wc = W; Hc = H;
        PW = Math.min(W, Math.max(360, H * 0.8)); PL = (W - PW) / 2;
        U = PW / 9; PY = Math.max(150, Math.min(H * 0.3, 170 + (H - 600) * 0.1));
        const sx = (Math.random() - 0.5) * shake * 14, sy = (Math.random() - 0.5) * shake * 10;
        ctx.save(); ctx.translate(sx, sy);
        const SX = x => PL + x * PW, SY = y => PY + (y - d) * U;
        // snow
        ctx.fillStyle = '#f4f8fc'; ctx.fillRect(-20, -20, W + 40, H + 40);
        // blue-grey shading drifts (repeat every 30 units)
        ctx.fillStyle = 'rgba(120,150,185,0.13)';
        const base = Math.floor(d / 30) * 30;
        for (const off of [-30, 0, 30]) for (const s of SCEN) {
          const yy = SY(base + off + s.y);
          if (yy < -60 || yy > H + 60) continue;
          ctx.beginPath(); ctx.ellipse(SX(s.x), yy, s.w * U, s.h * U, 0, 0, Math.PI * 2); ctx.fill();
        }
        // side forest (outside corridor) + edge shading
        if (PL > 4) {
          ctx.fillStyle = '#dfe8f2'; ctx.fillRect(0, 0, PL, H); ctx.fillRect(PL + PW, 0, W - PL - PW, H);
          ctx.font = `${U * 0.9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const step = 1.3, y0 = Math.floor((d - PY / U) / step) * step;
          for (let y = y0; SY(y) < H + U; y += step) {
            const k = Math.round(y / step);
            for (let c = 0; c * U * 1.1 < PL; c++) {
              const j = ((k * 7 + c * 13) % 5) / 5;
              ctx.fillText('🌲', PL - U * 0.5 - c * U * 1.1 - j * U * 0.4, SY(y + j));
              ctx.fillText('🌲', PL + PW + U * 0.5 + c * U * 1.1 + j * U * 0.4, SY(y + j * 0.7));
            }
          }
        }
        const eg = ctx.createLinearGradient(PL, 0, PL + U * 0.6, 0);
        eg.addColorStop(0, 'rgba(110,140,175,0.28)'); eg.addColorStop(1, 'rgba(110,140,175,0)');
        ctx.fillStyle = eg; ctx.fillRect(PL, 0, U * 0.6, H);
        const eg2 = ctx.createLinearGradient(PL + PW, 0, PL + PW - U * 0.6, 0);
        eg2.addColorStop(0, 'rgba(110,140,175,0.28)'); eg2.addColorStop(1, 'rgba(110,140,175,0)');
        ctx.fillStyle = eg2; ctx.fillRect(PL + PW - U * 0.6, 0, U * 0.6, H);

        // big gold block Y on the mountainside (scenery)
        const yTop = SY(Y_AT), yh = U * 5.2;
        if (yTop < H && yTop + yh > 0) {
          const cx = SX(0.5), bw = U * 1.1, armW = U * 2.6;
          ctx.save();
          ctx.fillStyle = 'rgba(70,90,120,0.18)'; // shadow
          drawY(ctx, cx + 6, yTop + 6, bw, armW, yh);
          ctx.fillStyle = '#f5c842'; drawY(ctx, cx, yTop, bw, armW, yh);
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(cx - bw / 2, yTop + yh * 0.5, bw * 0.25, yh * 0.5);
          ctx.restore();
        }

        // sled tracks
        if (trail.length > 1) {
          ctx.strokeStyle = 'rgba(120,150,190,0.45)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
          for (const side of [-1, 1]) {
            ctx.beginPath();
            trail.forEach((p, i) => { const X = SX(p.x) + side * U * 0.17, Yy = SY(p.y); i ? ctx.lineTo(X, Yy) : ctx.moveTo(X, Yy); });
            ctx.stroke();
          }
        }

        // objects
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const sorted = objs.slice().sort((a, b) => a.y - b.y);
        for (const o of sorted) {
          if (o.gone) continue;
          const X = SX(o.x), Yy = SY(o.y);
          if (Yy < -U * 2 || Yy > H + U * 2) continue;
          ctx.fillStyle = 'rgba(80,100,130,0.2)';
          ctx.beginPath(); ctx.ellipse(X + U * 0.12, Yy + U * 0.3, U * o.r * 1.1, U * o.r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#000';
          if (o.kind === 'tree') { ctx.font = `${U * 1.05}px sans-serif`; ctx.fillText('🌲', X, Yy - U * 0.15); }
          else if (o.kind === 'rock') { ctx.font = `${U * 0.8}px sans-serif`; ctx.fillText('🪨', X, Yy); }
          else if (o.kind === 'hiker') {
            // little drawn hiker walking across the slope (seen from above, facing their walking direction)
            const JACKETS = ['#e63946', '#2a9d8f', '#f4a261', '#7b5cff', '#0077b6'];
            const jacket = JACKETS[Math.floor(o.ph * 10) % JACKETS.length];
            const face = o.vx >= 0 ? 1 : -1, sw = Math.sin(t * 9 + o.ph);
            ctx.save(); ctx.translate(X, Yy); ctx.scale(face, 1);
            // legs (swinging)
            ctx.fillStyle = '#3b3b4f';
            ctx.fillRect(-U * 0.05 + sw * U * 0.12, U * 0.05, U * 0.1, U * 0.28);
            ctx.fillRect(-U * 0.05 - sw * U * 0.12, U * 0.05, U * 0.1, U * 0.28);
            // backpack (behind)
            ctx.fillStyle = '#6b4f2a'; ctx.beginPath(); ctx.roundRect(-U * 0.3, -U * 0.22, U * 0.2, U * 0.32, U * 0.05); ctx.fill();
            // jacket
            ctx.fillStyle = jacket; ctx.beginPath(); ctx.roundRect(-U * 0.16, -U * 0.25, U * 0.34, U * 0.36, U * 0.1); ctx.fill();
            // trekking pole
            ctx.strokeStyle = '#555'; ctx.lineWidth = Math.max(1, U * 0.03);
            ctx.beginPath(); ctx.moveTo(U * 0.16, -U * 0.08); ctx.lineTo(U * 0.3 + sw * U * 0.06, U * 0.32); ctx.stroke();
            // head + beanie
            ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(U * 0.02, -U * 0.36, U * 0.13, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#002e5d'; ctx.beginPath(); ctx.arc(U * 0.02, -U * 0.38, U * 0.135, Math.PI, 0); ctx.fill();
            ctx.fillStyle = '#f5c842'; ctx.beginPath(); ctx.arc(U * 0.02, -U * 0.52, U * 0.045, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          } else if (o.kind === 'coupon') {
            const s = 1 + Math.sin(t * 6 + o.ph) * 0.08;
            ctx.fillStyle = 'rgba(245,200,66,0.35)';
            ctx.beginPath(); ctx.arc(X, Yy, U * 0.42 * s, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000'; ctx.font = `${U * 0.62 * s}px sans-serif`; ctx.fillText('🎟️', X, Yy);
          }
        }

        // player
        const PXs = SX(px), PYs = SY(d);
        if (!(inv > 0 && tumble <= 0 && Math.floor(inv * 10) % 2 === 0)) {
          ctx.save(); ctx.translate(PXs, PYs);
          const ang = tumble > 0 ? (0.9 - tumble) * 14 : vx * 0.35;
          ctx.rotate(ang);
          ctx.fillStyle = 'rgba(80,100,130,0.25)';
          ctx.beginPath(); ctx.ellipse(U * 0.08, U * 0.3, U * 0.4, U * 0.15, 0, 0, Math.PI * 2); ctx.fill();
          // sled body (navy toboggan) + rider
          ctx.fillStyle = '#002e5d'; roundRect(ctx, -U * 0.26, -U * 0.42, U * 0.52, U * 0.84, U * 0.2); ctx.fill();
          ctx.fillStyle = '#f5c842'; ctx.fillRect(-U * 0.26, U * 0.28, U * 0.52, U * 0.06);
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, -U * 0.02, U * 0.2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e8463c'; ctx.beginPath(); ctx.arc(0, -U * 0.02, U * 0.13, 0, Math.PI * 2); ctx.fill(); // beanie
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -U * 0.02, U * 0.05, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        // snow puffs
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = 'rgba(140,165,200,0.6)'; ctx.lineWidth = 1;
        for (const p of puffs) { ctx.beginPath(); ctx.arc(SX(p.x), SY(p.y), U * 0.14 * (p.t + 0.4), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        // speed spray behind sled
        if (!done && tumble <= 0 && speed > 7) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(PXs + rnd(-U * 0.3, U * 0.3), PYs - U * rnd(0.4, 0.9), rnd(2, 4), 0, Math.PI * 2); ctx.fill(); }
        }
        // floaters
        for (const f of floaters) {
          ctx.globalAlpha = Math.min(1, f.t * 2);
          ctx.font = `900 ${Math.max(15, U * 0.42)}px sans-serif`;
          ctx.lineWidth = 4; ctx.strokeStyle = '#061a36'; const fy = SY(f.y) - (1 - f.t) * U * 1.6 - U * 0.6;
          ctx.strokeText(f.text, SX(f.x), fy); ctx.fillStyle = f.color; ctx.fillText(f.text, SX(f.x), fy);
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        if (flash > 0) { ctx.fillStyle = `rgba(255,59,48,${flash * 0.3})`; ctx.fillRect(0, 0, W, H); }

        // HUD panel (below the host's 60px HUD)
        const fs = Math.min(22, W * 0.052), hy = 66, hh = fs * 2.1;
        const hw = Math.min(W - 24, 520), hx = (W - hw) / 2;
        ctx.fillStyle = 'rgba(6,26,54,0.86)'; roundRect(ctx, hx, hy, hw, hh, 12); ctx.fill();
        ctx.textBaseline = 'middle'; ctx.font = `800 ${fs}px sans-serif`;
        ctx.textAlign = 'left'; ctx.fillStyle = '#f5c842';
        ctx.fillText(`${score()}`, hx + 14, hy + hh / 2);
        ctx.textAlign = 'center'; ctx.fillStyle = '#f0f4ff';
        ctx.fillText(`${Math.max(0, DUR - t).toFixed(1)}s`, hx + hw * 0.47, hy + hh / 2);
        ctx.textAlign = 'right';
        let hearts = ''; for (let i = 0; i < LIVES; i++) hearts += i < lives ? '❤️' : '🖤';
        ctx.fillStyle = '#fff'; ctx.font = `${fs * 0.9}px sans-serif`; ctx.fillText(hearts, hx + hw - 12, hy + hh / 2);
        // time bar
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(hx + 10, hy + hh - 5, hw - 20, 3);
        ctx.fillStyle = '#f5c842'; ctx.fillRect(hx + 10, hy + hh - 5, (hw - 20) * Math.min(1, t / DUR), 3);
        // first-seconds hint
        if (t < 3 && !done) {
          ctx.globalAlpha = Math.min(1, (3 - t));
          ctx.font = `800 ${Math.min(20, W * 0.048)}px sans-serif`; ctx.textAlign = 'center';
          ctx.fillStyle = '#002e5d'; ctx.fillText(W > 700 ? '◀ ← → or drag to steer ▶' : '◀ drag to steer ▶', W / 2, H * 0.86);
          ctx.globalAlpha = 1;
        }
        ctx.textBaseline = 'alphabetic';
      },
    };
    function drawY(ctx, cx, top, bw, armW, h) {
      // block Y: two arms meeting at the middle, then a stem
      const mid = top + h * 0.48;
      ctx.beginPath();
      ctx.moveTo(cx - armW, top); ctx.lineTo(cx - armW + bw * 1.15, top);
      ctx.lineTo(cx, mid - bw * 0.9); ctx.lineTo(cx + armW - bw * 1.15, top);
      ctx.lineTo(cx + armW, top); ctx.lineTo(cx + bw / 2, mid);
      ctx.lineTo(cx + bw / 2, top + h); ctx.lineTo(cx - bw / 2, top + h);
      ctx.lineTo(cx - bw / 2, mid); ctx.closePath(); ctx.fill();
    }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
  },
};
