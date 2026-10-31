/* ---------------- Creamery Scoop Stack ----------------
   Slide the cone (drag anywhere / arrow keys) to catch falling Creamery scoops and build a tall stack.
   Off-center catches add wobble, centered catches steady it; the taller the stack, the more it sways.
   📝 tests and 🅿️ parking tickets knock 3 scoops off. Golden scoops = bonus. 30 s, or until it topples. */
window.MINIGAMES.scoop = {
  name: 'Creamery Scoop Stack',
  icon: '🍦',
  blurb: 'Catch & stack scoops',
  howTo: 'Drag (or ←/→) to slide the cone and stack falling scoops. Catch them <b>centered</b> to steady the sway.<br>Dodge 📝 tests & 🅿️ tickets (−3 scoops). ✨ Golden scoop = bonus!',
  create(api) {
    const DUR = 18;
    const FLAVORS = [
      ['Graham Canyon', '#d8a35f', '#8a5a2b'],
      ['Cougar Tracks', '#f1e2bf', '#6b3b1f'],
      ['Mint Brownie', '#9fe3c3', '#4a2a17'],
      ['Y Be Normal', '#f4b6c9', '#d94f7a'],
      ['Caramel Cashew', '#e9b56c', '#b5722e'],
      ['Chocolate', '#7a4a2a', '#4a2a17'],
      ['Strawberry', '#ff9db0', '#e2435f'],
      ['Cookies & Cream', '#eeeeea', '#2b2b2b'],
      ['Huckleberry', '#9b6fd0', '#5b2f8f'],
      ['Blue Raspberry', '#7fc4ff', '#2b6fd6'],
      ['Lemon Custard', '#fbe77a', '#d9b21f'],
    ];
    const GOLD = ['Golden Scoop', '#f5c842', '#fff3b0'];

    let t = 0, done = false, ending = 0, endReason = '';
    let score = 0, combo = 0, bestCombo = 0, caught = 0, perfects = 0, maxH = 0;
    let wobble = 0, phase = 0, lean = 0, leanV = 0;
    let coneX = null, coneV = 0, lastConeX = null;
    let dragging = false, dragLastX = 0, keyL = false, keyR = false;
    let spawnT = 0.5, lastSpawnX = null;
    let scale = 1, camY = 0, shake = 0, flash = 0, flashCol = '255,59,48';
    let topple = null; // {dir, t}
    const stack = [];   // {f: flavor, dx, gold, pop}
    const items = [];   // falling: {x, y, kind:'scoop'|'gold'|'hazard', f, emoji, rot}
    const debris = [];  // knocked-off scoops / particles
    const floats = [];  // {text, x, y, t, col}

    // ---- layout (recomputed each frame from W,H) ----
    let W = api.W || 390, H = api.H || 700, R = 26, STEP = 32, FW = 390, FX = 0, GROUND = 600, TOP = 130, CONE_H = 60;
    function layout(w, h) {
      W = w; H = h;
      FW = Math.min(W, 620); FX = (W - FW) / 2;           // play field (world x = screen x at scale 1)
      R = Math.max(16, Math.min(FW * 0.075, H * 0.042, 32));
      STEP = R * 1.22;
      CONE_H = R * 2.4;
      GROUND = H - (W < 600 ? Math.max(40, H * 0.08) : Math.max(24, H * 0.05));                  // screen y of cone tip
      TOP = (W < 600 ? 60 : 12) + 84;                         // below HUD + our score panel
      if (coneX === null) coneX = W / 2;
    }
    layout(W, H);

    const baseY = () => CONE_H + R * 0.55;                   // world y of first scoop center (up = +)
    const scoopY = i => baseY() + i * STEP;
    const sx = wx => W / 2 + (wx - W / 2) * scale;
    const sy = wy => GROUND - (wy - camY) * scale;
    const swayAmp = () => (wobble + 0.1 + stack.length * 0.012) * R * (1 + stack.length * 0.1);
    // horizontal offset of scoop i (world units), relative to cone
    const offsets = [];
    function computeOffsets() {
      offsets.length = 0;
      const n = stack.length; let acc = 0;
      const amp = swayAmp(), s = Math.sin(phase);
      for (let i = 0; i < n; i++) {
        acc += stack[i].dx;
        const h = (i + 1) / Math.max(6, n);
        offsets.push(acc + (amp * s + lean) * Math.pow(h, 1.4));
      }
    }
    function topX() { return stack.length ? coneX + offsets[stack.length - 1] : coneX; }
    function topY() { return stack.length ? scoopY(stack.length - 1) + R * 0.75 : CONE_H; } // landing surface

    function addFloat(text, x, y, col) { floats.push({ text, x, y, t: 1.1, col: col || '#f5c842' }); }
    function burst(x, y, col, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 220;
        debris.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 120, r: R * (0.12 + Math.random() * 0.15), col, t: 0.7, spin: 0, dot: true });
      }
    }

    function spawn() {
      const diff = Math.min(1, t / DUR);
      let r = Math.random(), kind = 'scoop';
      if (t > 2.5 && r < 0.14 + diff * 0.06) kind = 'hazard';
      else if (r > 0.94) kind = 'gold';
      const margin = R * 1.3;
      let x;
      do { x = FX + margin + Math.random() * (FW - margin * 2); }
      while (lastSpawnX !== null && Math.abs(x - lastSpawnX) < R * 1.5);
      // early on keep throws reachable
      if (lastSpawnX !== null && t < 6) x = lastSpawnX + (x - lastSpawnX) * 0.6;
      lastSpawnX = x;
      items.push({
        x, y: camY + (GROUND - TOP - R * 1.2) / scale, kind, rot: (Math.random() - 0.5) * 0.6,
        f: kind === 'gold' ? GOLD : FLAVORS[(Math.random() * FLAVORS.length) | 0],
        emoji: Math.random() < 0.5 ? '📝' : '🅿️', vyMul: 0.9 + Math.random() * 0.25,
      });
    }

    function knockOff(n, dirHint) {
      const k = Math.min(n, stack.length);
      for (let j = 0; j < k; j++) {
        const i = stack.length - 1, s = stack.pop();
        const x = coneX + (offsets[i] || 0), y = scoopY(i);
        debris.push({ x, y, vx: (dirHint || (Math.random() < 0.5 ? -1 : 1)) * (160 + Math.random() * 200) + (Math.random() - 0.5) * 100,
          vy: 200 + Math.random() * 200 + j * 60, r: R, col: s.f[1], col2: s.f[2], t: 1.6, spin: (Math.random() - 0.5) * 10, rot: 0 });
      }
      return k;
    }

    function catchItem(it) {
      const tx = topX(), d = it.x - tx, f = Math.min(1, Math.abs(d) / (R * 1.25));
      const n = stack.length, txs = sx(tx), tys = sy(topY());
      if (it.kind === 'hazard') {
        const lost = knockOff(3, Math.sign(d) || 1);
        combo = 0; shake = 1; flash = 1; flashCol = '255,59,48';
        wobble = Math.min(0.95, wobble + 0.08);
        api.sfx('hit');
        addFloat(lost ? `−${lost} scoops!` : 'Oof!', txs, tys - 20, '#ff6b5e');
        addFloat(it.emoji === '📝' ? 'Pop quiz!' : 'Ticketed!', txs, tys - 50, '#ffffff');
        return;
      }
      const perfect = f < 0.28;
      stack.push({ f: it.f, dx: d * 0.45, gold: it.kind === 'gold', pop: 1 });
      caught++; combo++; bestCombo = Math.max(bestCombo, combo); maxH = Math.max(maxH, stack.length);
      const heightBonus = Math.floor(stack.length / 5) * 3;
      let pts = 10 + Math.min(combo, 10) * 1.5 + heightBonus;
      if (perfect) { pts += 6; perfects++; wobble = Math.max(0, wobble - 0.11); }
      else wobble += 0.03 + f * f * 0.2 + n * 0.0035;
      if (it.kind === 'gold') { pts += 60; wobble = Math.max(0, wobble - 0.2); api.sfx('coin'); burst(txs, tys, '#f5c842', 14); flash = 0.6; flashCol = '245,200,66'; }
      else api.sfx(perfect ? 'coin' : 'tap');
      // nudge the sway in the direction of the hit
      leanV += d * 2;
      pts = Math.round(pts); score += pts;
      addFloat(`+${pts}`, txs, tys - 24, it.kind === 'gold' ? '#fff3b0' : '#f5c842');
      if (perfect) addFloat('PERFECT', txs, tys - 54, '#7fffd4');
      else if (Math.random() < 0.5) addFloat(it.f[0], txs, tys - 54, '#ffffff');
      if (combo > 0 && combo % 5 === 0) addFloat(`${combo} combo!`, W / 2, TOP + 30, '#3fd8ff');
    }

    function finish() {
      if (done) return; done = true;
      const survived = !topple;
      const bonus = survived ? stack.length * 8 : 0;
      score += bonus;
      const detail = survived
        ? `🍦 ${stack.length}-scoop tower! (${caught} caught, best combo ${bestCombo}${bonus ? `, +${bonus} height bonus` : ''})`
        : `💥 Toppled at ${maxH} scoops! (${caught} caught, best combo ${bestCombo})`;
      api.finish(score, detail);
      window.__scoopDebug = { score, caught, maxH, bestCombo, perfects, toppled: !survived };
    }

    function startTopple() {
      if (topple) return;
      topple = { dir: (offsets.length ? offsets[offsets.length - 1] : Math.sin(phase)) >= 0 ? 1 : -1, t: 0 };
      api.sfx('thud'); shake = 1; endReason = 'topple';
      // the whole stack flies off
      const n = stack.length;
      for (let i = n - 1; i >= 0; i--) {
        const s = stack[i], x = coneX + (offsets[i] || 0), y = scoopY(i), h = (i + 1) / n;
        debris.push({ x, y, vx: topple.dir * (60 + h * 380) + (Math.random() - 0.5) * 60, vy: 40 + Math.random() * 120,
          r: R, col: s.f[1], col2: s.f[2], t: 2.2, spin: topple.dir * (2 + Math.random() * 6), rot: 0 });
      }
      stack.length = 0;
      addFloat('TOPPLED!', W / 2, H * 0.42, '#ff6b5e');
      ending = 1.4;
    }

    const game = {
      get _dbg() { return { coneX, topX: topX(), items: items.map(i => ({ x: i.x, y: i.y, kind: i.kind })), scale, n: stack.length, wobble, score, t }; },
      update(dt) {
        if (done) return;
        layout(api.W || W, api.H || H);
        // timers
        shake = Math.max(0, shake - dt * 3); flash = Math.max(0, flash - dt * 2.5);
        for (const s of stack) s.pop = Math.max(0, s.pop - dt * 5);
        for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.t -= dt; f.y -= 50 * dt; if (f.t <= 0) floats.splice(i, 1); }
        for (let i = debris.length - 1; i >= 0; i--) {
          const p = debris[i]; p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 900 * dt; p.rot = (p.rot || 0) + (p.spin || 0) * dt;
          if (p.t <= 0) debris.splice(i, 1);
        }
        // cone motion
        const kSpeed = Math.max(520, FW * 1.5);
        if (keyL || keyR) coneX += ((keyR ? 1 : 0) - (keyL ? 1 : 0)) * kSpeed * dt / scale;
        const minX = FX + R * 1.1, maxX = FX + FW - R * 1.1;
        coneX = Math.max(minX, Math.min(maxX, coneX));
        if (lastConeX === null) lastConeX = coneX;
        const v = (coneX - lastConeX) / Math.max(dt, 1e-3); lastConeX = coneX;
        coneV += (v - coneV) * Math.min(1, dt * 12);
        // sway: lean is a damped spring driven by cone velocity (stack lags behind)
        const stiff = 30 / (1 + stack.length * 0.06);
        leanV += (-lean * stiff - leanV * 4 - coneV * 0.45 * Math.min(1, stack.length / 4)) * dt;
        lean += leanV * dt;
        lean = Math.max(-R * 2, Math.min(R * 2, lean));
        phase += dt * (3.4 - Math.min(1.6, stack.length * 0.05));
        for (const s of stack) s.dx *= Math.pow(0.6, dt); // scoops slowly settle
        wobble = Math.max(0, wobble - dt * 0.02);
        if (!topple && wobble >= 1) { computeOffsets(); startTopple(); }

        if (ending > 0) {
          ending -= dt;
          for (const it of items) it.y -= 400 * dt / scale;
          if (ending <= 0) finish();
          return;
        }
        t += dt;
        if (t >= DUR) { t = DUR; ending = 0.6; api.sfx('whoosh'); addFloat("Time's up!", W / 2, H * 0.42, '#ffffff'); return; }

        // camera: scale down so the stack fits, then scroll
        const usable = GROUND - TOP;
        const need = topY() + R * 2;
        const room = usable * 0.55;
        let ts = Math.min(1, room / need), tc = 0;
        if (ts < 0.5) { ts = 0.5; tc = need - room / ts; }
        scale += (ts - scale) * Math.min(1, dt * 3);
        camY += (tc - camY) * Math.min(1, dt * 3);

        computeOffsets();
        // spawn
        spawnT -= dt;
        if (spawnT <= 0) { spawn(); spawnT = 0.78 - Math.min(0.28, t * 0.011) + Math.random() * 0.2; }

        // falling items (screen-speed constant regardless of zoom)
        const fallSpd = (H * 0.36 + t * H * 0.009) / scale;
        const ly = topY(), tx = topX();
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i], prevY = it.y;
          it.y -= fallSpd * it.vyMul * dt;
          const reach = it.kind === 'hazard' ? R * 1.05 : R * 1.25;
          if (!it.missed && prevY >= ly + R * 0.6 && it.y < ly + R * 0.6) {
            if (Math.abs(it.x - tx) < reach) { catchItem(it); items.splice(i, 1); computeOffsets(); continue; }
            it.missed = true;
            if (it.kind !== 'hazard') { if (combo >= 3) addFloat('combo lost', sx(it.x), sy(ly) - 10, '#9ab0d4'); combo = 0; }
          }
          if (sy(it.y) > H + R * 3) {
            if (it.kind !== 'hazard') { burst(it.x, Math.max(it.y, camY), it.f[1], 5); api.sfx('bad'); }
            items.splice(i, 1);
          }
        }
      },

      tap(x) { if (done) return; dragging = true; dragLastX = x; },
      move(x, y, isDown) {
        if (done) return;
        if (!isDown) { dragging = false; return; }
        if (!dragging) { dragging = true; dragLastX = x; return; }
        coneX += (x - dragLastX) / scale * 1.15; dragLastX = x;
      },
      release() { dragging = false; },
      key(k, isDown) {
        if (k === 'ArrowLeft' || k === 'a') keyL = isDown;
        if (k === 'ArrowRight' || k === 'd') keyR = isDown;
      },

      draw(ctx, w, h) {
        layout(w, h);
        computeOffsets();
        // background: navy night with a soft gradient + field band
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#061a36'); g.addColorStop(1, '#0d3466');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,.03)'; ctx.fillRect(FX, 0, FW, H);
        // sprinkles in the bg (static pattern)
        for (let i = 0; i < 26; i++) {
          const px = ((i * 97) % 100) / 100 * W, py = ((i * 61 + 13) % 100) / 100 * H;
          ctx.fillStyle = ['rgba(245,200,66,.18)', 'rgba(255,157,176,.16)', 'rgba(127,196,255,.16)'][i % 3];
          ctx.save(); ctx.translate(px, py); ctx.rotate(i); ctx.fillRect(-5, -1.5, 10, 3); ctx.restore();
        }
        if (flash > 0) { ctx.fillStyle = `rgba(${flashCol},${flash * 0.25})`; ctx.fillRect(0, 0, W, H); }

        ctx.save();
        if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 8);

        // counter / ground
        const gy = sy(0);
        ctx.fillStyle = '#c99a5b'; ctx.fillRect(0, gy, W, H - gy + 20);
        ctx.fillStyle = '#a77a40'; ctx.fillRect(0, gy, W, 4);

        // cone
        const cx = sx(coneX), cTop = sy(CONE_H), cw = R * 1.05 * scale;
        ctx.fillStyle = '#e0a458'; ctx.strokeStyle = '#9a6328'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx - cw, cTop); ctx.lineTo(cx + cw, cTop); ctx.lineTo(cx, gy); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.clip();
        ctx.strokeStyle = 'rgba(154,99,40,.6)'; ctx.lineWidth = 1.5;
        for (let k = -4; k <= 4; k++) {
          ctx.beginPath(); ctx.moveTo(cx + k * cw * 0.5 - cw, cTop); ctx.lineTo(cx + k * cw * 0.5 + cw, gy); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx + k * cw * 0.5 + cw, cTop); ctx.lineTo(cx + k * cw * 0.5 - cw, gy); ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = '#c98b44'; ctx.fillRect(cx - cw * 1.08, cTop - 3 * scale, cw * 2.16, 6 * scale);

        // stack
        for (let i = 0; i < stack.length; i++) {
          const s = stack[i];
          drawScoop(ctx, sx(coneX + offsets[i]), sy(scoopY(i)), R * scale * (1 + s.pop * 0.18), s.f, s.gold);
        }
        // landing guide (faint) on top of stack
        if (!topple && ending <= 0) {
          ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 2;
          const gx = sx(topX());
          ctx.beginPath(); ctx.moveTo(gx, sy(topY()) - 6); ctx.lineTo(gx, TOP); ctx.stroke(); ctx.setLineDash([]);
        }
        // falling items
        for (const it of items) {
          const x = sx(it.x), y = sy(it.y);
          if (y < TOP - R * 2) continue;
          if (it.kind === 'hazard') {
            const fs = R * 1.7 * scale;
            ctx.save(); ctx.translate(x, y); ctx.rotate(it.rot + Math.sin(t * 6 + it.x) * 0.15);
            ctx.fillStyle = 'rgba(255,59,48,.25)'; ctx.beginPath(); ctx.arc(0, 0, fs * 0.62, 0, Math.PI * 2); ctx.fill();
            ctx.font = `${fs}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.emoji, 0, 0);
            ctx.restore();
          } else {
            if (it.kind === 'gold') {
              ctx.fillStyle = `rgba(245,200,66,${0.25 + 0.15 * Math.sin(t * 10)})`;
              ctx.beginPath(); ctx.arc(x, y, R * scale * 1.6, 0, Math.PI * 2); ctx.fill();
            }
            drawScoop(ctx, x, y, R * scale, it.f, it.kind === 'gold');
          }
        }
        // debris
        for (const p of debris) {
          const x = sx(p.x), y = sy(p.y);
          ctx.globalAlpha = Math.min(1, p.t * 2);
          if (p.dot) { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x, y, p.r * scale, 0, Math.PI * 2); ctx.fill(); }
          else { ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); drawScoop(ctx, 0, 0, p.r * scale, [0, p.col, p.col2], false); ctx.restore(); }
          ctx.globalAlpha = 1;
        }
        ctx.restore();

        // floats
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const f of floats) {
          ctx.globalAlpha = Math.min(1, f.t * 2);
          ctx.font = `900 ${Math.min(24, W * 0.055)}px sans-serif`;
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(6,26,54,.85)'; ctx.strokeText(f.text, f.x, f.y);
          ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, f.y);
        }
        ctx.globalAlpha = 1;

        // ---- score panel ----
        const py = TOP - 80, pw = Math.min(W - 24, 560), px = (W - pw) / 2;
        ctx.fillStyle = 'rgba(6,26,54,.72)';
        roundRect(ctx, px, py, pw, 70, 14); ctx.fill();
        const frac = Math.max(0, 1 - t / DUR);
        ctx.fillStyle = 'rgba(255,255,255,.15)'; roundRect(ctx, px + 12, py + 10, pw - 24, 8, 4); ctx.fill();
        ctx.fillStyle = frac < 0.25 ? '#ff6b5e' : '#f5c842'; roundRect(ctx, px + 12, py + 10, (pw - 24) * frac, 8, 4); ctx.fill();
        const fs = Math.min(22, W * 0.052);
        ctx.font = `800 ${fs}px sans-serif`; ctx.textBaseline = 'middle';
        ctx.textAlign = 'left'; ctx.fillStyle = '#f5c842'; ctx.fillText(`${score}`, px + 14, py + 36);
        ctx.font = `600 ${fs * 0.6}px sans-serif`; ctx.fillStyle = '#9ab0d4'; ctx.fillText('points', px + 14, py + 56);
        ctx.textAlign = 'center'; ctx.font = `800 ${fs}px sans-serif`; ctx.fillStyle = '#ffffff';
        ctx.fillText(`🍦 ${stack.length}`, px + pw * 0.4, py + 36);
        ctx.font = `600 ${fs * 0.6}px sans-serif`; ctx.fillStyle = combo >= 3 ? '#3fd8ff' : '#9ab0d4';
        ctx.fillText(combo >= 2 ? `combo ×${combo}` : 'scoops', px + pw * 0.4, py + 56);
        ctx.textAlign = 'right'; ctx.font = `800 ${fs}px sans-serif`; ctx.fillStyle = '#ffffff';
        ctx.fillText(`${Math.max(0, DUR - t).toFixed(1)}s`, px + pw - 14, py + 36);
        // wobble meter
        const mw = pw * 0.26, mx = px + pw * 0.62, my = py + 50;
        ctx.font = `700 ${fs * 0.55}px sans-serif`; ctx.textAlign = 'left'; ctx.fillStyle = '#9ab0d4';
        ctx.fillText('wobble', mx, py + 32);
        ctx.fillStyle = 'rgba(255,255,255,.15)'; roundRect(ctx, mx, my, mw, 9, 4.5); ctx.fill();
        const wv = Math.min(1, wobble);
        ctx.fillStyle = wv > 0.7 ? '#ff6b5e' : wv > 0.4 ? '#f5c842' : '#7fffd4';
        if (wv > 0.7 && Math.sin(t * 20) > 0) ctx.fillStyle = '#ffffff';
        roundRect(ctx, mx, my, Math.max(9, mw * wv), 9, 4.5); ctx.fill();
        ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      },
    };
    window.__scoopGame = game;
    return game;

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function drawScoop(ctx, x, y, r, f, gold) {
      const base = f[1], accent = f[2];
      // body: round scoop with a wavy drip rim at the bottom
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(x, y - r * 0.12, r * 0.9, 0, Math.PI * 2); ctx.fill();
      const n = 5, rimY = y + r * 0.42;
      for (let k = 0; k < n; k++) {
        const bx = x - r + (2 * r * (k + 0.5)) / n;
        ctx.beginPath(); ctx.arc(bx, rimY + (k % 2 ? r * 0.06 : 0), r * 0.24, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillRect(x - r * 0.95, rimY - r * 0.3, r * 1.9, r * 0.3);
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.beginPath(); ctx.ellipse(x, rimY - r * 0.06, r * 0.9, r * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      // chips / swirl
      ctx.fillStyle = accent;
      for (let k = 0; k < 4; k++) {
        const a = k * 1.7 + 0.6, d = r * (0.3 + (k % 2) * 0.25);
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y - r * 0.2 + Math.sin(a) * d * 0.55, r * 0.1, 0, Math.PI * 2); ctx.fill();
      }
      // highlight
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.55, r * 0.22, r * 0.13, -0.5, 0, Math.PI * 2); ctx.fill();
      if (gold) {
        ctx.fillStyle = '#ffffff'; ctx.font = `${r * 0.8}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✨', x + r * 0.35, y - r * 0.15);
      }
    }
  },
};
