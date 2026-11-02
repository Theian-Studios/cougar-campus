/* ---------------- Rock Canyon Climb ----------------
   Timberman-style speed climber. The next handhold is on the LEFT or RIGHT;
   tap that side (or ← →) to grab it and climb 1 m. A chalk/stamina bar drains
   faster the higher you go; each grab refills a bit. Cracked loose rocks = slip
   (lose a life, fall 3 m). Tapping a blank side also costs a life.
   Round ends at 35 s, 3 lives lost, or stamina 0.
   Score = 6 pts per metre of height + 50 per 25 m milestone. */
window.MINIGAMES.climb = {
  name: 'Rock Canyon Climb',
  icon: '🧗',
  blurb: 'Tap holds to climb',
  howTo: 'Tap the side (or ← →) with the next hold to climb. Go fast, your chalk 💪 bar keeps draining!<br>Cracked loose rocks make you slip, and so does tapping a blank side. 3 slips = out.',
  create(api) {
    const DUR = 21, LIVES = 3, PTS_M = 6, MILE = 25, MILE_PTS = 50, FALLBACK = 3;
    let t = 0, done = false, endT = 0, endReason = '';
    let h = 0, maxH = 0, pos = 0, lives = LIVES, stamina = 1, miles = 0, grabs = 0, slips = 0;
    let lock = 0, shake = 0, flash = 0, reach = 0, slipAnim = 0, banner = null, combo = 0;
    let floaters = [], debris = [], chalk = [];
    let W = 390, H = 844, PW = 390, PL = 0, S = 70, R = 90, BY = 500;
    const steps = [{ side: 1, loose: false }];
    const rnd = (a, b) => a + Math.random() * (b - a);
    const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

    function gen(n) {
      while (steps.length <= n) {
        const i = steps.length, prev = steps[i - 1];
        // runs of same side are allowed but switches are common
        const side = Math.random() < 0.55 ? -prev.side : prev.side;
        const lp = i < 6 ? 0 : Math.min(0.32, 0.12 + i * 0.0015);
        steps.push({ side, loose: Math.random() < lp, tone: hash(i) });
      }
    }
    gen(40);

    const score = () => Math.round(maxH * PTS_M + miles * MILE_PTS);
    function pop(text, x, y, color, big) { floaters.push({ text, x, y, t: 1, color, big }); }
    function end(reason) { if (endT > 0 || done) return; endReason = reason; endT = 0.9; lock = 9; }
    function finish() {
      if (done) return; done = true;
      api.finish(score(), `${endReason} · ${maxH} m high · ${grabs} grab${grabs === 1 ? "" : "s"} · ${slips} slip${slips === 1 ? '' : 's'}`);
    }
    function holdX(side) { return W / 2 + side * R; }
    function holdY(i) { return BY - (i - pos) * S; }

    function grab(side) {
      if (done || endT > 0 || lock > 0) return;
      const nx = steps[h + 1];
      if (side === nx.side) {
        h++; grabs++; combo++; reach = 1;
        stamina = Math.min(1, stamina + 0.085);
        api.sfx('tap');
        for (let i = 0; i < 5; i++) chalk.push({ x: holdX(side) + rnd(-8, 8), y: holdY(h), vx: rnd(-40, 40), vy: rnd(-30, 20), t: rnd(0.4, 0.7) });
        if (h > maxH) {
          maxH = h;
          if (maxH % MILE === 0) {
            miles++; api.sfx('coin');
            banner = { text: `${maxH} m!  +${MILE_PTS}`, t: 1.4 };
          }
        }
        gen(h + 40);
      } else {
        // wrong side: loose rock there, or nothing at all
        const loose = nx.loose;
        lives--; slips++; combo = 0; shake = 1; flash = 1; lock = 0.45; slipAnim = 0.45;
        api.sfx(loose ? 'hit' : 'bad');
        const x = holdX(side), y = holdY(h + 1);
        if (loose) {
          nx.loose = false;
          for (let i = 0; i < 9; i++) debris.push({ x: x + rnd(-10, 10), y: y + rnd(-8, 8), vx: rnd(-60, 60), vy: rnd(-80, 0), r: rnd(3, 8), t: 1.4 });
          pop('LOOSE ROCK!', x, y, '#ff5a4e');
        } else pop('No hold!', x, y, '#ff5a4e');
        h = Math.max(0, h - FALLBACK);
        stamina = Math.max(0.05, stamina - 0.05);
        if (lives <= 0) end('Peeled off!');
        else api.sfx('whoosh');
      }
    }

    return {
      update(dt) {
        shake = Math.max(0, shake - dt * 3); flash = Math.max(0, flash - dt * 3);
        reach = Math.max(0, reach - dt * 8); slipAnim = Math.max(0, slipAnim - dt);
        pos += (h - pos) * Math.min(1, dt * (slipAnim > 0 ? 9 : 20));
        for (const f of floaters) f.t -= dt * 1.1;
        floaters = floaters.filter(f => f.t > 0);
        for (const d of debris) { d.vy += 600 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.t -= dt; }
        debris = debris.filter(d => d.t > 0 && d.y < H + 20);
        for (const c of chalk) { c.x += c.vx * dt; c.y += c.vy * dt; c.t -= dt; }
        chalk = chalk.filter(c => c.t > 0);
        if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
        if (done) return;
        if (endT > 0) { endT -= dt; if (endT <= 0) finish(); return; }
        t += dt; lock = Math.max(0, lock - dt);
        const drain = Math.min(0.55, 0.12 + 0.0024 * maxH + 0.002 * t);
        stamina -= drain * dt;
        if (stamina <= 0) { stamina = 0; api.sfx('thud'); end('Pumped out!'); return; }
        if (t >= DUR) { t = DUR; end("Time's up!"); }
      },
      tap(x) { grab(x < W / 2 ? -1 : 1); },
      key(k, isDown, isRepeat) {
        if (!isDown || isRepeat) return;
        if (k === 'ArrowLeft' || k === 'a') grab(-1);
        else if (k === 'ArrowRight' || k === 'd') grab(1);
      },
      draw(ctx, w, hh) {
        W = w; H = hh;
        PW = Math.min(W, 560); PL = (W - PW) / 2;
        S = Math.max(52, Math.min(H * 0.095, 82));
        R = Math.min(PW * 0.24, 110);
        BY = H * 0.6;
        const sx = (Math.random() - 0.5) * shake * 16, sy = (Math.random() - 0.5) * shake * 10;
        ctx.save(); ctx.translate(sx, sy);

        // ---- rock wall ----
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#c9a77c'); g.addColorStop(0.5, '#b8936a'); g.addColorStop(1, '#9c7d5e');
        ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
        // grey rock bands & cracks tied to world height (scroll with pos)
        const iTop = Math.floor(pos - (H - BY) / S) - 2, iBot = Math.ceil(pos + BY / S) + 3;
        for (let i = iTop; i <= iBot; i++) {
          const y = holdY(i), r1 = hash(i * 3 + 1), r2 = hash(i * 7 + 2), r3 = hash(i * 11 + 5);
          if (r1 < 0.35) { // grey strata band
            ctx.fillStyle = `rgba(110,105,100,${0.12 + r2 * 0.12})`;
            ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(W + 20, y + (r3 - 0.5) * S * 0.8);
            ctx.lineTo(W + 20, y + S * 0.35 + (r3 - 0.5) * S * 0.8); ctx.lineTo(-20, y + S * 0.3); ctx.fill();
          }
          if (r2 < 0.6) { // jagged crack
            const cx = PL + r3 * PW, len = S * (0.6 + r1);
            ctx.strokeStyle = 'rgba(70,50,35,0.45)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(cx, y);
            for (let k = 1; k <= 4; k++) ctx.lineTo(cx + (hash(i * 13 + k) - 0.5) * 18, y + len * k / 4);
            ctx.stroke();
          }
          if (r3 < 0.5) { // light speckle
            ctx.fillStyle = 'rgba(255,240,215,0.25)';
            ctx.beginPath(); ctx.ellipse(PL + r1 * PW, y + S * 0.5, S * 0.3 * (0.5 + r2), S * 0.08, 0, 0, Math.PI * 2); ctx.fill();
          }
        }
        // side shading / outer rock on wide screens
        if (PL > 4) {
          ctx.fillStyle = 'rgba(60,40,25,0.28)'; ctx.fillRect(0, 0, PL, H); ctx.fillRect(PL + PW, 0, W - PL - PW, H);
        }

        // ---- canyon sky at the top (fixed) ----
        const skyH = H * 0.16 + 28;
        const sg = ctx.createLinearGradient(0, 0, 0, skyH);
        sg.addColorStop(0, '#5fa8e0'); sg.addColorStop(1, '#bfe2f7');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.moveTo(-20, -20); ctx.lineTo(W + 20, -20); ctx.lineTo(W + 20, skyH * 0.55);
        // canyon rims: high on the sides, dipping in the middle
        const N = 14;
        for (let k = N; k >= 0; k--) {
          const x = (k / N) * W, edge = Math.abs(k / N - 0.5) * 2;
          ctx.lineTo(x, skyH * (1 - edge * 0.6) + (hash(k + 99) - 0.5) * skyH * 0.25);
        }
        ctx.closePath(); ctx.fill();
        // sun
        ctx.fillStyle = 'rgba(255,240,180,0.9)'; ctx.beginPath(); ctx.arc(W * 0.78, skyH * 0.35, Math.min(22, skyH * 0.2), 0, Math.PI * 2); ctx.fill();

        // ---- side tap zones hint ----
        if (!done && endT <= 0) {
          const nx = steps[h + 1];
          ctx.fillStyle = 'rgba(245,200,66,0.07)';
          if (nx.side < 0) ctx.fillRect(PL, skyH, PW / 2, H - skyH); else ctx.fillRect(W / 2, skyH, PW / 2, H - skyH);
        }

        // ---- quickdraws every 5 steps (center line) ----
        for (let i = Math.max(0, iTop); i <= iBot; i++) {
          if (i % 5 !== 0 || i === 0) continue;
          const y = holdY(i) + S * 0.5;
          ctx.fillStyle = '#777'; ctx.beginPath(); ctx.arc(W / 2, y, 4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#d33'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W / 2, y); ctx.lineTo(W / 2, y + 12); ctx.stroke();
        }
        // height markers on the left edge
        ctx.font = `700 ${Math.max(11, S * 0.2)}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        for (let i = Math.max(0, iTop); i <= iBot; i++) {
          if (i % 5 !== 0) continue;
          const y = holdY(i);
          if (y < skyH + 10) continue;
          ctx.fillStyle = i % MILE === 0 && i > 0 ? '#f5c842' : 'rgba(255,255,255,0.55)';
          ctx.fillRect(PL + 4, y, i % MILE === 0 ? 22 : 12, 2);
          ctx.fillText(`${i}m`, PL + (i % MILE === 0 ? 30 : 18), y);
        }

        // ---- rope: from harness down off the bottom, clipping through quickdraws below ----
        const harnessY = BY + S * 0.95 + (slipAnim > 0 ? slipAnim * 20 : 0);
        ctx.strokeStyle = '#2a9df4'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(W / 2, harnessY);
        ctx.bezierCurveTo(W / 2 + 26, harnessY + 50, W / 2 - 22, H * 0.85, W / 2 + 6, H + 10);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.moveTo(W / 2, harnessY);
        ctx.bezierCurveTo(W / 2 + 26, harnessY + 50, W / 2 - 22, H * 0.85, W / 2 + 6, H + 10);
        ctx.stroke(); ctx.setLineDash([]);

        // ---- holds ----
        for (let i = Math.max(0, iTop); i <= iBot; i++) {
          const st = steps[i]; if (!st) continue;
          const y = holdY(i);
          if (y < skyH * 0.6 || y > H + S) continue;
          const isNext = i === h + 1 && !done && endT <= 0;
          drawHold(ctx, holdX(st.side), y, st.tone, isNext, i <= h);
          if (st.loose) drawLoose(ctx, holdX(-st.side), y, st.tone);
        }

        // ---- climber ----
        drawClimber(ctx);

        // particles
        for (const c of chalk) { ctx.fillStyle = `rgba(255,255,255,${c.t})`; ctx.beginPath(); ctx.arc(c.x, c.y, 3, 0, Math.PI * 2); ctx.fill(); }
        for (const d of debris) {
          ctx.fillStyle = '#8a7a6a'; ctx.strokeStyle = '#4d3d30'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        // floaters
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const f of floaters) {
          ctx.globalAlpha = Math.min(1, f.t * 2);
          ctx.font = `900 ${Math.max(16, S * 0.32)}px sans-serif`;
          const fy = f.y - (1 - f.t) * 50 - 20;
          ctx.lineWidth = 4; ctx.strokeStyle = '#061a36'; ctx.strokeText(f.text, f.x, fy);
          ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, fy);
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        if (flash > 0) { ctx.fillStyle = `rgba(255,59,48,${flash * 0.3})`; ctx.fillRect(0, 0, W, H); }

        // milestone banner
        if (banner) {
          const a = Math.min(1, banner.t * 2), sc = 1 + Math.max(0, banner.t - 1.1) * 1.5;
          ctx.globalAlpha = a;
          ctx.font = `900 ${Math.min(44, W * 0.1) * sc}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 6; ctx.strokeStyle = '#061a36'; ctx.strokeText(banner.text, W / 2, H * 0.33);
          ctx.fillStyle = '#f5c842'; ctx.fillText(banner.text, W / 2, H * 0.33);
          ctx.globalAlpha = 1;
        }

        // ---- HUD (below the host's 60 px bar) ----
        const fs = Math.min(22, W * 0.052), hy = 66, hh2 = fs * 2.1;
        const hw = Math.min(W - 24, 520), hx = (W - hw) / 2;
        ctx.fillStyle = 'rgba(6,26,54,0.88)'; rr(ctx, hx, hy, hw, hh2 + 18, 12); ctx.fill();
        ctx.textBaseline = 'middle'; ctx.font = `800 ${fs}px sans-serif`;
        ctx.textAlign = 'left'; ctx.fillStyle = '#f5c842';
        ctx.fillText(`${score()}`, hx + 14, hy + hh2 / 2);
        ctx.textAlign = 'center'; ctx.fillStyle = '#f0f4ff';
        ctx.fillText(`${maxH} m · ${Math.max(0, DUR - t).toFixed(1)}s`, hx + hw * 0.5, hy + hh2 / 2);
        ctx.textAlign = 'right';
        let hearts = ''; for (let i = 0; i < LIVES; i++) hearts += i < lives ? '❤️' : '🖤';
        ctx.font = `${fs * 0.85}px sans-serif`; ctx.fillText(hearts, hx + hw - 12, hy + hh2 / 2);
        // stamina bar
        const bx = hx + 40, bw = hw - 54, byy = hy + hh2 + 1, bh = 11;
        ctx.font = `${fs * 0.7}px sans-serif`; ctx.textAlign = 'left'; ctx.fillText('💪', hx + 12, byy + bh / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, bx, byy, bw, bh, 5); ctx.fill();
        const low = stamina < 0.25, blink = low && Math.floor(t * 8) % 2 === 0;
        ctx.fillStyle = low ? (blink ? '#ff5a4e' : '#ff8a5a') : stamina < 0.5 ? '#f5c842' : '#ffffff';
        if (stamina > 0) { rr(ctx, bx, byy, Math.max(bh, bw * stamina), bh, 5); ctx.fill(); }

        // start hint
        if (t < 3 && !done) {
          ctx.globalAlpha = Math.min(1, 3 - t);
          ctx.font = `800 ${Math.min(20, W * 0.048)}px sans-serif`; ctx.textAlign = 'center';
          ctx.lineWidth = 4; ctx.strokeStyle = '#061a36';
          const msg = W > 700 ? '◀ ← / → to grab the next hold ▶' : '◀ tap the side with the hold ▶';
          ctx.strokeText(msg, W / 2, H * 0.88); ctx.fillStyle = '#fff'; ctx.fillText(msg, W / 2, H * 0.88);
          ctx.globalAlpha = 1;
        }
        ctx.textBaseline = 'alphabetic';
      },
    };

    function drawHold(ctx, x, y, tone, isNext, used) {
      const s = S * 0.22;
      if (isNext) {
        const p = 1 + Math.sin(t * 10) * 0.08;
        ctx.fillStyle = 'rgba(245,200,66,0.45)'; ctx.beginPath(); ctx.arc(x, y, s * 1.9 * p, 0, Math.PI * 2); ctx.fill();
      }
      const COLS = ['#e63946', '#2a9d8f', '#7b5cff', '#f4a261', '#0077b6'];
      ctx.fillStyle = 'rgba(40,25,15,0.3)';
      ctx.beginPath(); ctx.ellipse(x + 3, y + 4, s * 1.2, s * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = used ? '#9a8f84' : COLS[Math.floor(tone * COLS.length)];
      ctx.beginPath(); ctx.ellipse(x, y, s * 1.2, s * 0.8, (tone - 0.5) * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(x - s * 0.35, y - s * 0.25, s * 0.4, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      if (used) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x + s * 0.2, y, s * 0.3, 0, Math.PI * 2); ctx.fill(); } // chalk mark
    }
    function drawLoose(ctx, x, y, tone) {
      const s = S * 0.26, wob = Math.sin(t * 25 + tone * 9) * 1.2;
      ctx.save(); ctx.translate(x + wob, y);
      ctx.fillStyle = 'rgba(40,25,15,0.3)'; ctx.beginPath(); ctx.ellipse(3, 4, s * 1.2, s * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a39686'; ctx.beginPath();
      ctx.moveTo(-s * 1.2, 0); ctx.lineTo(-s * 0.6, -s * 0.8); ctx.lineTo(s * 0.7, -s * 0.75); ctx.lineTo(s * 1.25, s * 0.1);
      ctx.lineTo(s * 0.5, s * 0.85); ctx.lineTo(-s * 0.8, s * 0.7); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 2; ctx.stroke();
      // cracks
      ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.7); ctx.lineTo(-s * 0.1, -s * 0.1); ctx.lineTo(-s * 0.4, s * 0.3); ctx.lineTo(0, s * 0.75);
      ctx.moveTo(-s * 0.1, -s * 0.1); ctx.lineTo(s * 0.6, s * 0.05); ctx.stroke();
      ctx.restore();
    }
    function drawClimber(ctx) {
      const side = steps[h] ? steps[h].side : 1;
      const prevSide = h > 0 && steps[h - 1] ? steps[h - 1].side : -side;
      const fall = slipAnim > 0 ? slipAnim * 22 : 0;
      const cx = W / 2, by = BY + S * 0.55 + fall + reach * 6;
      const u = S;
      // hands: top hand on current hold, other hand on previous hold
      const hand1 = { x: holdX(side), y: holdY(h) };
      let hand2 = { x: holdX(prevSide), y: holdY(h - 1) };
      if (prevSide === side) hand2 = { x: cx - side * u * 0.55, y: by + u * 0.15 };
      if (slipAnim > 0) { hand1.y += fall * 1.5; hand1.x = cx + side * u * 0.7; hand2.x = cx - side * u * 0.7; hand2.y = by - u * 0.6; }
      const sh = { l: { x: cx - u * 0.24, y: by - u * 0.28 }, r: { x: cx + u * 0.24, y: by - u * 0.28 } };
      const lim = (a, b, col, wdt) => { ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
      const shoulderFor = hx => (hx < cx ? sh.l : sh.r);
      // legs (feet splayed on the wall)
      const step = h % 2 ? 1 : -1;
      const hipL = { x: cx - u * 0.13, y: by + u * 0.35 }, hipR = { x: cx + u * 0.13, y: by + u * 0.35 };
      const kneeL = { x: cx - u * 0.42, y: by + u * (0.55 + (step > 0 ? -0.12 : 0.05)) }, kneeR = { x: cx + u * 0.42, y: by + u * (0.55 + (step < 0 ? -0.12 : 0.05)) };
      const footL = { x: cx - u * 0.45, y: by + u * (0.95 + (step > 0 ? -0.15 : 0)) }, footR = { x: cx + u * 0.45, y: by + u * (0.95 + (step < 0 ? -0.15 : 0)) };
      lim(hipL, kneeL, '#3b4a6b', u * 0.15); lim(kneeL, footL, '#3b4a6b', u * 0.13);
      lim(hipR, kneeR, '#3b4a6b', u * 0.15); lim(kneeR, footR, '#3b4a6b', u * 0.13);
      ctx.fillStyle = '#222'; for (const f of [footL, footR]) { ctx.beginPath(); ctx.ellipse(f.x, f.y + 2, u * 0.11, u * 0.06, 0, 0, Math.PI * 2); ctx.fill(); }
      // arms
      lim(shoulderFor(hand2.x), hand2, '#f1c27d', u * 0.11);
      lim(shoulderFor(hand1.x), hand1, '#f1c27d', u * 0.11);
      // sleeves
      const sl = (s, hnd) => ({ x: s.x + (hnd.x - s.x) * 0.35, y: s.y + (hnd.y - s.y) * 0.35 });
      lim(shoulderFor(hand2.x), sl(shoulderFor(hand2.x), hand2), '#002e5d', u * 0.14);
      lim(shoulderFor(hand1.x), sl(shoulderFor(hand1.x), hand1), '#002e5d', u * 0.14);
      ctx.fillStyle = '#f1c27d'; for (const hd of [hand1, hand2]) { ctx.beginPath(); ctx.arc(hd.x, hd.y, u * 0.08, 0, Math.PI * 2); ctx.fill(); }
      // torso (navy shirt, back view)
      ctx.fillStyle = '#002e5d'; rr(ctx, cx - u * 0.26, by - u * 0.36, u * 0.52, u * 0.68, u * 0.14); ctx.fill();
      // chalk bag
      ctx.fillStyle = '#f5c842'; rr(ctx, cx - u * 0.09, by + u * 0.3, u * 0.18, u * 0.17, u * 0.05); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - u * 0.07, by + u * 0.3, u * 0.14, u * 0.03);
      // harness: waist belt + leg loops
      ctx.fillStyle = '#e8463c'; ctx.fillRect(cx - u * 0.27, by + u * 0.2, u * 0.54, u * 0.09);
      ctx.strokeStyle = '#e8463c'; ctx.lineWidth = u * 0.06;
      ctx.beginPath(); ctx.ellipse(cx - u * 0.15, by + u * 0.38, u * 0.1, u * 0.06, 0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx + u * 0.15, by + u * 0.38, u * 0.1, u * 0.06, -0.3, 0, Math.PI * 2); ctx.stroke();
      // belay loop + rope knot
      ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.arc(cx, by + u * 0.3, u * 0.05, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a9df4'; ctx.beginPath(); ctx.arc(cx, by + u * 0.4, u * 0.06, 0, Math.PI * 2); ctx.fill();
      // head + helmet
      ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(cx, by - u * 0.5, u * 0.17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f5c842'; ctx.beginPath(); ctx.arc(cx, by - u * 0.53, u * 0.19, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, by - u * 0.5, u * 0.2, u * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - u * 0.15, by - u * 0.47); ctx.lineTo(cx, by - u * 0.33); ctx.lineTo(cx + u * 0.15, by - u * 0.47); ctx.stroke();
      // slip face
      if (slipAnim > 0) {
        ctx.font = `${u * 0.35}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('😱', cx + u * 0.4, by - u * 0.8);
      }
    }
    function rr(ctx, x, y, w, hgt, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hgt, r); ctx.arcTo(x + w, y + hgt, x, y + hgt, r);
      ctx.arcTo(x, y + hgt, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
  },
};
