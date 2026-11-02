/* ---------------- Bean Museum After Dark ----------------
   Simon-style memory game. At night in the Bean Life Science Museum the stuffed
   animals "come to life" in a sequence; repeat it by tapping them (or keys 1–4).
   Sequence grows by one and plays faster each round. One wrong tap = they all
   roar at you and the night is over. 27 s cap.
   Score = 20 per correct tap + round bonus (50 + 30 × length). */
window.MINIGAMES.bean = {
  name: 'Bean Museum After Dark',
  icon: '🦁',
  blurb: 'Remember who moved',
  howTo: 'Watch which exhibits come to life, then tap them in the same order (or keys 1–4).<br>Each round adds one more. One mistake and they all wake up… 27 s!',
  create(api) {
    const DUR = 27, TAP_PTS = 20;
    const bonusFor = n => 50 + 30 * n;
    const ANIMALS = [
      { e: '🦁', name: 'LION',  col: '#f5a623', freq: 220.0, type: 'sawtooth' },
      { e: '🐻', name: 'GRIZZLY', col: '#c0703a', freq: 277.2, type: 'square' },
      { e: '🦅', name: 'EAGLE', col: '#3fd8ff', freq: 329.6, type: 'triangle' },
      { e: '🐍', name: 'SNAKE', col: '#5fe36a', freq: 415.3, type: 'sine' },
    ];
    const rnd = (a, b) => a + Math.random() * (b - a);

    let t = 0, done = false, endT = 0;
    let seq = [], step = 0, phase = 'pre', phaseT = 0.8, showOn = -1;
    let round = 0, taps = 0, score = 0, bonus = 0;
    let lit = [0, 0, 0, 0], litDur = [0.3, 0.3, 0.3, 0.3], press = [0, 0, 0, 0];
    let floaters = [], dust = [], shake = 0, flash = 0, failT = 0, wrongIdx = -1;
    let banner = '', bannerT = 0, bannerCol = '#f5c842';
    let light = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }, lastW = 390, lastH = 844;
    let rects = [];
    for (let i = 0; i < 40; i++) dust.push({ x: Math.random(), y: Math.random(), v: rnd(0.005, 0.02), p: Math.random() * 6 });

    // ---- tiny synth for pedestal tones ----
    let ac = null;
    function audio() {
      try {
        // one context shared across rounds (iOS caps how many AudioContexts a page may create)
        if (!ac || ac.state === 'closed') {
          ac = window.__beanAC && window.__beanAC.state !== 'closed' ? window.__beanAC : null;
          if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ac = window.__beanAC = new AC(); }
        }
        if (ac && ac.state !== 'running') { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); }
      } catch (e) { ac = null; }
      return ac;
    }
    function tone(i, dur, roar) {
      try {
        const a = audio(); if (!a) return;
        const now = a.currentTime, o = a.createOscillator(), g = a.createGain();
        o.type = roar ? 'sawtooth' : ANIMALS[i].type;
        if (roar) { o.frequency.setValueAtTime(140 + i * 25, now); o.frequency.exponentialRampToValueAtTime(55, now + dur); }
        else o.frequency.setValueAtTime(ANIMALS[i].freq, now);
        const vol = roar ? 0.09 : (ANIMALS[i].type === 'sine' || ANIMALS[i].type === 'triangle' ? 0.22 : 0.09);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(vol, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        o.connect(g); g.connect(a.destination); o.start(now); o.stop(now + dur + 0.05);
      } catch (e) { /* audio is optional */ }
    }

    const stepGap = () => Math.max(0.24, 0.56 - 0.035 * round); // seconds between sequence lights
    function say(text, col, dur) { banner = text; bannerCol = col || '#f5c842'; bannerT = dur || 1.2; }
    function pop(text, x, y, color, big) { floaters.push({ text, x, y, t: 1, color, big }); }
    function center(i) { const r = rects[i]; return r ? { x: r.x + r.w / 2, y: r.y + r.h * 0.4 } : { x: 0, y: 0 }; }

    function nextRound() {
      round++;
      seq.push(Math.floor(Math.random() * 4));
      // avoid three of the same in a row (feels unfair)
      const n = seq.length;
      if (n >= 3 && seq[n - 1] === seq[n - 2] && seq[n - 2] === seq[n - 3]) seq[n - 1] = (seq[n - 1] + 1 + Math.floor(Math.random() * 3)) % 4;
      step = 0; phase = 'show'; phaseT = 0.55; showOn = -1;
      say(round === 1 ? 'Watch closely…' : `Round ${round}`, '#f5c842', 0.9);
    }
    function light_(i, dur) {
      lit[i] = dur; litDur[i] = dur; tone(i, Math.min(0.6, dur + 0.05));
      const c = center(i); light.tx = c.x / lastW; light.ty = c.y / lastH;
    }
    function finishGame(reason) {
      if (done) return; done = true;
      api.finish(score, `${reason} · reached round ${round} · ${taps} correct taps`);
    }
    function press_(i) {
      if (done || endT > 0) return;
      audio();
      if (phase !== 'input') { press[i] = 0.12; return; }
      press[i] = 0.18;
      const c = center(i);
      if (seq[step] === i) {
        light_(i, 0.28);
        taps++; score += TAP_PTS; step++;
        pop(`+${TAP_PTS}`, c.x, c.y - 30, '#fff');
        if (step >= seq.length) {
          const b = bonusFor(seq.length); bonus += b; score += b;
          api.sfx('coin');
          pop(`Round ${round}! +${b}`, lastW / 2, lastH * 0.5, '#f5c842', true);
          say(['Nice!', 'Sharp!', 'Exhibit-ional!', 'Museum genius!', 'Taxidermy master!'][Math.min(4, Math.floor(round / 2))], '#5fe36a', 0.9);
          phase = 'between'; phaseT = 1.0;
        } else api.sfx('tap');
      } else {
        // WRONG: they all wake up and roar
        wrongIdx = i; phase = 'fail'; failT = 0; endT = 1.9;
        shake = 1; flash = 1;
        api.sfx('bad');
        for (let k = 0; k < 4; k++) { lit[k] = 1.8; litDur[k] = 1.8; tone(k, 1.1, true); }
        say('RAAAWR!!', '#ff5a4e', 2);
        pop('wrong one!', c.x, c.y - 40, '#ff5a4e');
        light.tx = 0.5; light.ty = 0.5;
      }
    }

    function layout(W, H) {
      const top = 170, botPad = W < 700 ? 90 : 40;
      const availH = Math.max(120, H - top - botPad), availW = Math.max(120, W - 24);
      const row = W / H > 1.25 && availW / 4 > 120;
      const cols = row ? 4 : 2, rows = row ? 1 : 2;
      const gap = Math.min(22, W * 0.04);
      let cw = (Math.min(availW, row ? 1000 : 560) - gap * (cols - 1)) / cols;
      let ch = (availH - gap * (rows - 1)) / rows;
      ch = Math.min(ch, cw * 1.5); cw = Math.min(cw, ch * 1.1);
      const totW = cols * cw + (cols - 1) * gap, totH = rows * ch + (rows - 1) * gap;
      const x0 = (W - totW) / 2, y0 = top + (availH - totH) / 2;
      rects = ANIMALS.map((_, i) => ({ x: x0 + (i % cols) * (cw + gap), y: y0 + Math.floor(i / cols) * (ch + gap), w: cw, h: ch }));
    }

    return {
      update(dt) {
        shake = Math.max(0, shake - dt * 1.5); flash = Math.max(0, flash - dt * 2);
        bannerT = Math.max(0, bannerT - dt);
        for (let i = 0; i < 4; i++) { lit[i] = Math.max(0, lit[i] - dt); press[i] = Math.max(0, press[i] - dt); }
        for (const f of floaters) f.t -= dt * 0.9;
        floaters = floaters.filter(f => f.t > 0);
        for (const d of dust) { d.y -= d.v * dt; d.p += dt; if (d.y < 0) { d.y = 1; d.x = Math.random(); } }
        // flashlight drifts toward its target, with a little idle sway
        const sway = phase === 'input' ? 0.04 : 0.02;
        light.x += (light.tx + Math.sin(t * 0.9) * sway - light.x) * Math.min(1, dt * 5);
        light.y += (light.ty + Math.cos(t * 1.3) * sway - light.y) * Math.min(1, dt * 5);
        if (done) return;
        if (endT > 0) {
          failT += dt; endT -= dt;
          if (endT <= 0) finishGame(phase === 'fail' ? 'The exhibits woke up!' : 'Closing time!');
          return;
        }
        t += dt;
        if (t >= DUR) {
          t = DUR; phase = 'timeup'; endT = 0.9; say('Closing time! 🔦', '#3fd8ff', 1.5); api.sfx('thud'); return;
        }
        phaseT -= dt;
        if (phase === 'pre') { if (phaseT <= 0) nextRound(); }
        else if (phase === 'show') {
          if (phaseT <= 0) {
            if (step < seq.length) {
              const g = stepGap();
              light_(seq[step], g * 0.72); step++; phaseT = g;
            } else {
              phase = 'input'; step = 0; say('Your turn!', '#fff', 0.8); api.sfx('beep');
              light.tx = 0.5; light.ty = 0.55;
            }
          }
        } else if (phase === 'between') { if (phaseT <= 0) nextRound(); }
      },
      tap(x, y) {
        if (done) return;
        audio();
        light.tx = x / lastW; light.ty = y / lastH;
        for (let i = 0; i < 4; i++) {
          const r = rects[i];
          if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { press_(i); return; }
        }
      },
      move(x, y) { if (!done && phase === 'input') { light.tx = x / lastW; light.ty = y / lastH; } },
      release() { if (!done) audio(); }, // iOS unlocks audio on touchend/pointerup
      key(k, isDown, isRepeat) {
        if (!isDown || isRepeat) return;
        const i = '1234'.indexOf(k);
        if (i >= 0) press_(i);
      },
      draw(ctx, W, H) {
        lastW = W; lastH = H;
        layout(W, H);
        const sx = (Math.random() - 0.5) * shake * 16, sy = (Math.random() - 0.5) * shake * 12;
        ctx.save(); ctx.translate(sx, sy);

        // exhibit hall: dark navy walls, wooden floor, display windows
        ctx.fillStyle = '#0a1426'; ctx.fillRect(-20, -20, W + 40, H + 40);
        const floorY = H * 0.62;
        const fg = ctx.createLinearGradient(0, floorY, 0, H);
        fg.addColorStop(0, '#2a1d14'); fg.addColorStop(1, '#3a2818');
        ctx.fillStyle = fg; ctx.fillRect(-20, floorY, W + 40, H - floorY + 20);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
        for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * W * 0.04, floorY); ctx.lineTo(W / 2 + i * W * 0.25, H + 20); ctx.stroke(); }
        // back wall diorama windows (very faint)
        ctx.fillStyle = 'rgba(80,120,170,0.08)';
        const nwin = W > 700 ? 5 : 3;
        for (let i = 0; i < nwin; i++) {
          const ww = W / nwin * 0.7, wx = (i + 0.15) * W / nwin;
          ctx.fillRect(wx, H * 0.16, ww, floorY - H * 0.2);
        }
        // a big faint whale skeleton silhouette hanging up high (museum vibes)
        ctx.font = `${Math.min(W, H) * 0.16}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.08; ctx.fillText('🐋', W * 0.78, H * 0.14 + Math.sin(t * 0.4) * 4); ctx.globalAlpha = 1;

        // pedestals
        for (let i = 0; i < 4; i++) {
          const r = rects[i], A = ANIMALS[i];
          const L = lit[i] > 0 ? Math.min(1, lit[i] / Math.max(0.05, litDur[i]) * 1.6) : 0;
          const failing = phase === 'fail';
          const cx = r.x + r.w / 2, baseY = r.y + r.h * 0.72;
          // glow halo
          if (L > 0) {
            const gr = ctx.createRadialGradient(cx, r.y + r.h * 0.42, 5, cx, r.y + r.h * 0.42, r.w * 0.8);
            const col = failing ? '#ff3b30' : A.col;
            gr.addColorStop(0, hexA(col, 0.8 * L)); gr.addColorStop(1, hexA(col, 0));
            ctx.fillStyle = gr; ctx.fillRect(r.x - r.w * 0.3, r.y - r.h * 0.2, r.w * 1.6, r.h * 1.3);
          }
          // glass case outline
          ctx.strokeStyle = L > 0 ? hexA(failing ? '#ff3b30' : A.col, 0.5 + 0.5 * L) : 'rgba(170,200,240,0.18)';
          ctx.lineWidth = L > 0 ? 3 : 1.5;
          rr(ctx, r.x + r.w * 0.06, r.y, r.w * 0.88, baseY - r.y, 10); ctx.stroke();
          ctx.fillStyle = 'rgba(170,200,240,0.04)'; ctx.fill();
          // glass shine
          ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(r.x + r.w * 0.2, r.y + 10); ctx.lineTo(r.x + r.w * 0.12, r.y + r.h * 0.3); ctx.stroke();
          // plinth
          const pdn = press[i] > 0 ? 3 : 0;
          ctx.fillStyle = '#3b2a1c'; rr(ctx, r.x, baseY + pdn, r.w, r.h * 0.2, 8); ctx.fill();
          ctx.fillStyle = '#4d3826'; rr(ctx, r.x, baseY + pdn, r.w, r.h * 0.06, 8); ctx.fill();
          // brass plaque with number + name
          const pw = Math.min(r.w * 0.7, 150), ph = Math.max(18, r.h * 0.09);
          ctx.fillStyle = L > 0 ? '#f5c842' : '#a8893a';
          rr(ctx, cx - pw / 2, baseY + r.h * 0.09 + pdn, pw, ph, 4); ctx.fill();
          ctx.fillStyle = '#2a1d0c'; ctx.font = `800 ${Math.max(10, ph * 0.55)}px sans-serif`;
          ctx.fillText(`${i + 1} · ${A.name}`, cx, baseY + r.h * 0.09 + ph / 2 + 1 + pdn);
          // the animal
          const es = Math.min(r.w * 0.52, r.h * 0.42);
          let rot = 0, sc = 1, dy = 0, face = 1;
          if (L > 0) {
            const k = failing ? 1 : L;
            rot = Math.sin(t * (failing ? 40 : 28) + i) * 0.18 * k;
            sc = 1 + 0.16 * k; dy = -Math.abs(Math.sin(t * 18)) * es * 0.08 * k;
          }
          if (failing) { sc = 1.1 + Math.min(0.25, failT * 0.4); face = cx < W / 2 ? -1 : 1; }
          if (press[i] > 0) sc *= 0.94;
          ctx.save(); ctx.translate(cx, r.y + r.h * 0.42 + dy); ctx.rotate(rot); ctx.scale(sc * face, sc);
          // shadow
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath(); ctx.ellipse(0, es * 0.52 - dy / sc, es * 0.36, es * 0.08, 0, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = L > 0 ? 1 : 0.5;
          ctx.font = `${es}px sans-serif`; ctx.fillStyle = '#000'; ctx.fillText(A.e, 0, 0);
          ctx.globalAlpha = 1;
          ctx.restore();
          // glowing eyes when dormant-but-creepy / angry when failing
          if (failing) {
            ctx.fillStyle = '#ff3b30';
            ctx.font = `900 ${es * 0.3}px sans-serif`;
            ctx.fillText('!!', cx + es * 0.4, r.y + r.h * 0.12);
          }
          if (failing && i === wrongIdx) {
            ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 4; rr(ctx, r.x - 4, r.y - 4, r.w + 8, r.h * 0.95, 14); ctx.stroke();
          }
        }

        // flashlight vignette (darkness everywhere except the beam)
        const lx = light.x * W, ly = light.y * H, R = Math.max(W, H) * (phase === 'fail' ? 0.9 : 0.42);
        const vg = ctx.createRadialGradient(lx, ly, R * 0.25, lx, ly, R);
        vg.addColorStop(0, 'rgba(2,6,14,0)'); vg.addColorStop(0.6, 'rgba(2,6,14,0.45)'); vg.addColorStop(1, 'rgba(2,6,14,0.82)');
        ctx.fillStyle = vg; ctx.fillRect(-20, -20, W + 40, H + 40);
        // warm beam tint
        const bg = ctx.createRadialGradient(lx, ly, 0, lx, ly, R * 0.35);
        bg.addColorStop(0, 'rgba(255,240,190,0.10)'); bg.addColorStop(1, 'rgba(255,240,190,0)');
        ctx.fillStyle = bg; ctx.fillRect(-20, -20, W + 40, H + 40);
        // lit animals punch through the dark: re-draw glow on top
        for (let i = 0; i < 4; i++) {
          if (lit[i] <= 0) continue;
          const r = rects[i], cx = r.x + r.w / 2, cy = r.y + r.h * 0.42;
          const L = phase === 'fail' ? 1 : Math.min(1, lit[i] / Math.max(0.05, litDur[i]) * 1.6);
          const col = phase === 'fail' ? '#ff3b30' : ANIMALS[i].col;
          const gr = ctx.createRadialGradient(cx, cy, 2, cx, cy, r.w * 0.55);
          gr.addColorStop(0, hexA(col, 0.5 * L)); gr.addColorStop(1, hexA(col, 0));
          ctx.fillStyle = gr; ctx.fillRect(r.x - r.w * 0.2, r.y - r.h * 0.1, r.w * 1.4, r.h);
        }
        // dust motes in the beam
        ctx.fillStyle = 'rgba(255,245,210,0.5)';
        for (const d of dust) {
          const x = d.x * W, y = d.y * H;
          if (Math.hypot(x - lx, y - ly) > R * 0.45) continue;
          ctx.beginPath(); ctx.arc(x + Math.sin(d.p) * 6, y, 1.4, 0, Math.PI * 2); ctx.fill();
        }

        // floaters
        for (const f of floaters) {
          ctx.globalAlpha = Math.min(1, f.t * 2);
          const fs = f.big ? Math.min(32, W * 0.07) : Math.min(22, W * 0.05);
          ctx.font = `900 ${fs}px sans-serif`; ctx.lineWidth = 5; ctx.strokeStyle = '#061a36';
          const fy = f.y - (1 - f.t) * 50;
          ctx.strokeText(f.text, f.x, fy); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, fy);
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        if (flash > 0) { ctx.fillStyle = `rgba(255,40,30,${flash * 0.35})`; ctx.fillRect(0, 0, W, H); }

        // HUD panel (below the host's 60px HUD)
        const fs = Math.min(21, W * 0.05), hy = 66, hh = fs * 2.1;
        const hw = Math.min(W - 24, 520), hx = (W - hw) / 2;
        ctx.fillStyle = 'rgba(6,26,54,0.88)'; rr(ctx, hx, hy, hw, hh, 12); ctx.fill();
        ctx.strokeStyle = 'rgba(245,200,66,0.35)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.textBaseline = 'middle'; ctx.font = `800 ${fs}px sans-serif`;
        ctx.textAlign = 'left'; ctx.fillStyle = '#f5c842'; ctx.fillText(`${score}`, hx + 14, hy + hh / 2);
        ctx.textAlign = 'center'; ctx.fillStyle = '#f0f4ff';
        ctx.fillText(`${Math.max(0, DUR - t).toFixed(1)}s`, hx + hw * 0.5, hy + hh / 2);
        ctx.textAlign = 'right'; ctx.fillStyle = '#cfe0ff'; ctx.font = `700 ${fs * 0.8}px sans-serif`;
        ctx.fillText(`Round ${Math.max(1, round)}`, hx + hw - 14, hy + hh / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(hx + 10, hy + hh - 5, hw - 20, 3);
        ctx.fillStyle = DUR - t < 8 ? '#ff5a4e' : '#f5c842'; ctx.fillRect(hx + 10, hy + hh - 5, (hw - 20) * Math.min(1, t / DUR), 3);

        // progress pips for the current sequence (during input)
        if (phase === 'input' && seq.length) {
          const n = seq.length, pr = Math.min(6, (hw - 40) / n / 3), py = hy + hh + 12;
          for (let k = 0; k < n; k++) {
            ctx.fillStyle = k < step ? '#5fe36a' : 'rgba(255,255,255,0.25)';
            ctx.beginPath(); ctx.arc(W / 2 + (k - (n - 1) / 2) * pr * 3, py, pr, 0, Math.PI * 2); ctx.fill();
          }
        }
        // banner
        if (bannerT > 0) {
          ctx.globalAlpha = Math.min(1, bannerT * 3);
          const bs = Math.min(phase === 'fail' ? 54 : 34, W * (phase === 'fail' ? 0.12 : 0.075));
          ctx.font = `900 ${bs}px sans-serif`; ctx.textAlign = 'center';
          ctx.lineWidth = 6; ctx.strokeStyle = '#061a36';
          const byy = phase === 'fail' ? H * 0.5 : hy + hh + 38;
          ctx.strokeText(banner, W / 2, byy); ctx.fillStyle = bannerCol; ctx.fillText(banner, W / 2, byy);
          ctx.globalAlpha = 1;
        }
        // status hint
        if (!done && (phase === 'show' || phase === 'input')) {
          ctx.font = `700 ${Math.min(16, W * 0.04)}px sans-serif`; ctx.textAlign = 'center';
          ctx.fillStyle = phase === 'show' ? 'rgba(255,255,255,0.55)' : 'rgba(245,200,66,0.85)';
          const hintY = Math.min(H - 30, (rects[3] ? rects[3].y + rects[3].h : H) + 22);
          ctx.fillText(phase === 'show' ? '👀 watch…' : (W > 700 ? 'tap them in order — or press 1 2 3 4' : 'tap them in order'), W / 2, hintY);
        }
        ctx.textBaseline = 'alphabetic';
      },
    };

    function hexA(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
    }
    function rr(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
  },
};
