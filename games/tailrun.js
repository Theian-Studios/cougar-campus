/* ---------------- Tail Run ----------------
   Top-down vertical runner. You auto-run upfield carrying a giant Cougar Tail; steer left/right.
   Defenders take bites out of the tail (3 bites = done). Goal line every 100 yards = TOUCHDOWN. */
window.MINIGAMES.tailrun = {
  name: 'Tail Run',
  icon: window.MAPLE_BAR_ICON,
  blurb: 'Carry a Cougar Tail past defenders',
  howTo: '<b>Drag</b> (or ←/→) to dodge defenders. Each hit bites your Cougar Tail; 3 bites and it\'s gone!<br>🍁 = speed burst · 🥛 = shield · cross the goal line for a TOUCHDOWN.',
  create(api) {
    const DUR = 40, TD_BONUS = 150, NEAR_BONUS = 15, PERIOD = 110; // 100-yard field + 10-yard end zone
    let t = 0, done = false, endTimer = -1;
    let dist = 0;                 // yards travelled
    let drive = 0, tds = 0, nearMisses = 0, nearPts = 0, tdPts = 0;
    let px = 0.5, vx = 0, targetX = 0.5;   // lateral position, 0..1 of field width
    let bites = 0, invuln = 0, stun = 0, burst = 0, shield = 0;
    let shake = 0, tdFlash = 0, biteFlash = 0;
    let dragX = null, keyL = false, keyR = false;
    let nextSpawn = 14, nextPickup = 22 + Math.random() * 10;
    const foes = [], pickups = [], floaters = [], crumbs = [];
    let L = { W: 390, H: 844, fx: 0, fw: 390, ypx: 35, py: 600, pr: 18 };

    const baseSpeed = () => 9 + drive * 2.2;            // yards / s
    const speed = () => (baseSpeed() + (burst > 0 ? 7 : 0)) * (stun > 0 ? 0.35 : 1);
    const score = () => Math.round(dist + tdPts + nearPts);

    function layout(W, H) {
      const fw = Math.min(W, H * 0.78);
      L = { W, H, fw, fx: (W - fw) / 2, ypx: H / 27, py: H * 0.79, pr: Math.max(13, Math.min(24, fw * 0.045)) };
    }
    // world -> screen
    const sx = x => L.fx + x * L.fw;
    const sy = y => L.py - (y - dist) * L.ypx;

    function float(text, x, y, color, size) { floaters.push({ text, x, y, color: color || '#fff', size: size || 1, t: 1 }); }

    function spawnFoe() {
      const r = Math.random(), d = drive;
      const pSafety = Math.min(0.35, 0.12 + d * 0.07), pLB = 0.4;
      const y = dist + 26 + Math.random() * 4;
      if (r < pSafety) {
        const fromLeft = Math.random() < 0.5;
        foes.push({ kind: 'S', x: fromLeft ? 0.05 : 0.95, y, vy: 12 + d * 1.5, vx: (fromLeft ? 1 : -1) * (0.35 + Math.random() * 0.2), w: 1, h: 1, num: 20 + (Math.random() * 30 | 0) });
      } else if (r < pSafety + pLB) {
        foes.push({ kind: 'LB', x: 0.1 + Math.random() * 0.8, y, vy: 5 + d * 0.8, vx: 0, w: 1.15, h: 1.15, num: 40 + (Math.random() * 20 | 0) });
      } else {
        foes.push({ kind: 'OL', x: 0.12 + Math.random() * 0.76, y, vy: 2.5 + d * 0.4, vx: 0, w: 2.3, h: 1.35, num: 60 + (Math.random() * 40 | 0) });
      }
    }

    function hit(f) {
      if (shield > 0) {
        f.knock = 1; f.vx = (f.x < px ? -1 : 1) * 1.2; api.sfx('thud'); shake = 0.6;
        float('BLOCKED!', sx(px), L.py - L.pr * 3, '#7fd8ff');
        return;
      }
      if (invuln > 0) return;
      bites++; invuln = 1.3; stun = 0.45; shake = 1; biteFlash = 1;
      f.knock = 1; f.vx = (f.x < px ? -1 : 1) * 0.9;
      api.sfx('hit');
      for (let i = 0; i < 10; i++) crumbs.push({ x: sx(px), y: L.py - L.pr * 2.2, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 220, t: 0.7 });
      float(bites >= 3 ? 'TAIL GONE!' : 'CHOMP! 😱', sx(px), L.py - L.pr * 3, '#ff6b5e', 1.2);
      if (bites >= 3) end(false);
    }

    function end(timeUp) {
      if (endTimer >= 0 || done) return;
      endTimer = timeUp ? 0.6 : 1.0;
      if (timeUp) {
        const left = 3 - bites, bonus = left * 50;
        if (bonus) { nearPts += bonus; float(`Tail left +${bonus}`, L.W / 2, L.H * 0.45, '#f5c842', 1.3); }
      }
    }
    function finish() {
      if (done) return; done = true;
      const yd = Math.round(dist);
      let msg = `${yd} yards · ${tds} TD${tds === 1 ? '' : 's'} · ${nearMisses} close call${nearMisses === 1 ? '' : 's'}`;
      msg = (bites >= 3 ? 'Your Cougar Tail got eaten! ' : 'Time! ') + msg;
      api.finish(score(), msg);
    }

    function drawTail(ctx, x, y, r) {
      // long maple bar held upfield; front end bitten off
      const fullLen = r * 4.2, w = r * 1.05;
      const len = fullLen * (1 - bites * 0.24);
      const top = y - r * 0.4 - len, left = x - w / 2;
      ctx.save();
      // clip out bite marks at the front end
      ctx.beginPath(); ctx.rect(left - 10, top - 20, w + 20, len + 40);
      if (bites > 0) {
        const br = w * 0.32;
        ctx.moveTo(left + br * 1.0 + br, top); ctx.arc(left + br * 1.0, top, br, 0, Math.PI * 2);
        ctx.moveTo(left + w - br * 0.9 + br, top + 2); ctx.arc(left + w - br * 0.9, top + 2, br, 0, Math.PI * 2);
      }
      ctx.clip('evenodd');
      // dough
      ctx.fillStyle = '#c98a45'; ctx.strokeStyle = '#6b3b1f'; ctx.lineWidth = 2;
      rr(ctx, left, top, w, len, w / 2); ctx.fill(); ctx.stroke();
      // maple glaze
      ctx.fillStyle = '#8a4b1c';
      rr(ctx, left + w * 0.16, top + w * 0.12, w * 0.68, len - w * 0.24, w * 0.34); ctx.fill();
      // twist lines
      ctx.strokeStyle = 'rgba(255,220,160,.55)'; ctx.lineWidth = 1.5;
      for (let k = top + w * 0.5; k < top + len - w * 0.3; k += w * 0.7) {
        ctx.beginPath(); ctx.moveTo(left + w * 0.2, k); ctx.lineTo(left + w * 0.8, k + w * 0.35); ctx.stroke();
      }
      ctx.restore();
    }
    function rr(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    return {
      update(dt) {
        if (done) return;
        if (endTimer >= 0) {
          endTimer -= dt; shake = Math.max(0, shake - dt * 3);
          for (const f of floaters) { f.t -= dt * 0.8; f.y -= dt * 40; }
          if (endTimer <= 0) finish();
          return;
        }
        t += dt;
        // timers
        invuln = Math.max(0, invuln - dt); stun = Math.max(0, stun - dt);
        burst = Math.max(0, burst - dt); shield = Math.max(0, shield - dt);
        shake = Math.max(0, shake - dt * 4); tdFlash = Math.max(0, tdFlash - dt * 0.8); biteFlash = Math.max(0, biteFlash - dt * 3);

        // steering
        if (keyL || keyR) targetX = Math.max(0.07, Math.min(0.93, px + (keyR - keyL) * 0.25));
        const steer = (targetX - px) * 14;
        const maxV = 1.6;
        vx = Math.max(-maxV, Math.min(maxV, steer));
        px = Math.max(0.07, Math.min(0.93, px + vx * dt));

        // run
        const prevDist = dist;
        dist += speed() * dt;
        // touchdown?
        const goal = drive * PERIOD + 100;
        if (prevDist < goal && dist >= goal) {
          tds++; const bonus = TD_BONUS + drive * 50; tdPts += bonus;
          tdFlash = 1.6; api.sfx('win');
          float(`TOUCHDOWN! +${bonus}`, L.W / 2, L.H * 0.4, '#f5c842', 1.6);
          for (const f of foes) f.knock = 1, f.vx = (f.x < 0.5 ? -1.5 : 1.5);
          drive++;
          nextSpawn = drive * PERIOD + 6; nextPickup = Math.max(nextPickup, drive * PERIOD + 14);
        }
        // spawn
        const inEndZone = (dist % PERIOD) > 100 - 18;   // keep end zone approach a bit clearer
        const gap = Math.max(3.2, 7.8 - drive * 1.2);
        while (dist >= nextSpawn) {
          if (!inEndZone) { spawnFoe(); if (drive >= 1 && Math.random() < 0.25 + drive * 0.1) spawnFoe(); }
          nextSpawn += gap * (0.7 + Math.random() * 0.6);
        }
        if (dist >= nextPickup) {
          pickups.push({ kind: Math.random() < 0.5 ? 'maple' : 'milk', x: 0.12 + Math.random() * 0.76, y: dist + 26 });
          nextPickup += 24 + Math.random() * 14;
        }

        // foes
        const ppx = sx(px), ppy = L.py, pr = L.pr;
        for (const f of foes) {
          const wasAhead = f.y > dist;
          f.y -= f.vy * dt;
          if (f.knock) { f.x += f.vx * dt; f.knock = Math.max(0.001, f.knock - dt); }
          else if (f.kind === 'LB') {
            const ahead = f.y - dist;
            if (ahead > 1) f.vx += Math.sign(px - f.x) * 0.9 * dt;
            f.vx = Math.max(-0.32, Math.min(0.32, f.vx * (1 - dt * 0.5)));
            f.x += f.vx * dt;
          } else if (f.kind === 'S') {
            f.x += f.vx * dt;
            if (f.x < 0.07 || f.x > 0.93) { f.vx = -f.vx; f.x = Math.max(0.07, Math.min(0.93, f.x)); }
          }
          if (f.knock || f.done) continue;
          // collision (ellipse vs circle)
          const fr = pr * 1.0;
          const dx = sx(f.x) - ppx, dy = sy(f.y) - (ppy - pr * 0.6);
          const a = (fr * f.w + pr * 0.85) * 0.8, b = (fr * f.h + pr * 1.5) * 0.8;   // player hit-box includes the tail
          if ((dx / a) ** 2 + (dy / b) ** 2 < 1) { hit(f); if (endTimer >= 0) return; continue; }
          // near miss: passes our row closely
          if (wasAhead && f.y <= dist && Math.abs(dx) < a + pr * 1.1 && invuln <= 0) {
            f.done = true; nearMisses++; nearPts += NEAR_BONUS; api.sfx('whoosh');
            float(`CLOSE! +${NEAR_BONUS}`, sx(f.x), ppy - pr * 1.5, '#9fffb0', 0.9);
          }
        }
        for (let i = foes.length - 1; i >= 0; i--) { const f = foes[i]; if (sy(f.y) > L.H + 80 || f.x < -0.4 || f.x > 1.4) foes.splice(i, 1); }

        // pickups
        for (let i = pickups.length - 1; i >= 0; i--) {
          const p = pickups[i];
          const dx = sx(p.x) - ppx, dy = sy(p.y) - (ppy - pr);
          if (Math.hypot(dx, dy) < pr * 2.2) {
            if (p.kind === 'maple') { burst = 2.5; float('MAPLE RUSH! 🍁', ppx, ppy - pr * 3, '#f5c842'); api.sfx('coin'); }
            else { shield = 4; float('CHOC MILK SHIELD! 🥛', ppx, ppy - pr * 3, '#7fd8ff'); api.sfx('coin'); }
            pickups.splice(i, 1); continue;
          }
          if (sy(p.y) > L.H + 40) pickups.splice(i, 1);
        }

        // fx
        for (const f of floaters) { f.t -= dt * 0.8; f.y -= dt * 40; }
        for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].t <= 0) floaters.splice(i, 1);
        for (const c of crumbs) { c.t -= dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 500 * dt; }
        for (let i = crumbs.length - 1; i >= 0; i--) if (crumbs[i].t <= 0) crumbs.splice(i, 1);

        if (t >= DUR) end(true);
      },

      get _dbg() { return { foes, pickups, px, dist, L }; },
      tap(x) { if (done || endTimer >= 0) return; dragX = x; },
      move(x, y, isDown) {
        if (done || endTimer >= 0) return;
        if (!isDown) { dragX = null; return; }
        if (dragX === null) { dragX = x; return; }
        targetX = Math.max(0.07, Math.min(0.93, targetX + (x - dragX) * 1.3 / L.fw));
        dragX = x;
      },
      release() { dragX = null; },
      key(k, isDown) {
        if (k === 'ArrowLeft' || k === 'a') keyL = isDown;
        else if (k === 'ArrowRight' || k === 'd') keyR = isDown;
        if (!keyL && !keyR && (k === 'ArrowLeft' || k === 'a' || k === 'ArrowRight' || k === 'd')) targetX = px;
      },

      draw(ctx, W, H) {
        if (W !== L.W || H !== L.H) layout(W, H);
        const { fx, fw, ypx } = L;
        ctx.save();
        if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 10);
        // stands / sidelines
        ctx.fillStyle = '#061a36'; ctx.fillRect(-20, -20, W + 40, H + 40);
        if (fx > 4) {
          // crowd dots scrolling
          const off = (dist * ypx * 0.5) % 24;
          for (const side of [0, 1]) {
            const x0 = side ? fx + fw + 8 : 0, x1 = side ? W : fx - 8;
            for (let yy = -24 + off; yy < H + 24; yy += 24) for (let xx = x0 + 10; xx < x1 - 6; xx += 22) {
              ctx.fillStyle = ((xx * 7 + Math.floor((yy - off) / 24) * 13) | 0) % 5 === 0 ? '#f5c842' : ((xx + yy) | 0) % 3 ? '#1b4a86' : '#ffffff';
              ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(xx, yy, 5, 0, Math.PI * 2); ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
        }
        // grass with stripes every 5 yards
        const yTop = dist + (L.py) / ypx + 2, yBot = dist - (H - L.py) / ypx - 2;
        ctx.fillStyle = '#2e8b3e'; ctx.fillRect(fx, 0, fw, H);
        for (let y5 = Math.floor(yBot / 5) * 5; y5 < yTop; y5 += 5) {
          const m = ((y5 % PERIOD) + PERIOD) % PERIOD;
          const yA = sy(y5 + 5), yB = sy(y5);
          if (m >= 100) {                      // end zone
            ctx.fillStyle = '#002e5d'; ctx.fillRect(fx, yA, fw, yB - yA + 1);
          } else if ((y5 / 5) % 2 === 0) { ctx.fillStyle = '#34974a'; ctx.fillRect(fx, yA, fw, yB - yA + 1); }
        }
        // yard lines + numbers
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let y5 = Math.floor(yBot / 5) * 5; y5 < yTop; y5 += 5) {
          const m = ((y5 % PERIOD) + PERIOD) % PERIOD, yy = sy(y5);
          if (m > 100) continue;
          const isGoal = m === 0 || m === 100;
          ctx.strokeStyle = isGoal ? '#f5c842' : 'rgba(255,255,255,.75)'; ctx.lineWidth = isGoal ? 5 : 2;
          ctx.beginPath(); ctx.moveTo(fx + 4, yy); ctx.lineTo(fx + fw - 4, yy); ctx.stroke();
          if (m % 10 === 0 && !isGoal) {
            const n = m <= 50 ? m : 100 - m;
            ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `900 ${Math.round(ypx * 1.6)}px sans-serif`;
            ctx.fillText(String(n), fx + fw * 0.12, yy); ctx.fillText(String(n), fx + fw * 0.88, yy);
          }
          // hash marks
          if (!isGoal) {
            ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
            for (let k = 1; k < 5; k++) {
              const hy = sy(y5 + k);
              for (const hx of [0.36, 0.64]) { ctx.beginPath(); ctx.moveTo(fx + fw * hx - 6, hy); ctx.lineTo(fx + fw * hx + 6, hy); ctx.stroke(); }
            }
          }
        }
        // end zone text
        for (let d = Math.floor(yBot / PERIOD); d <= Math.floor(yTop / PERIOD); d++) {
          const yy = sy(d * PERIOD + 105);
          if (yy < -60 || yy > H + 60) continue;
          ctx.fillStyle = '#f5c842'; ctx.font = `900 ${Math.round(Math.min(fw * 0.12, ypx * 4))}px sans-serif`;
          ctx.fillText('END ZONE', fx + fw / 2, yy);
        }
        // sideline borders
        ctx.fillStyle = '#ffffff'; ctx.fillRect(fx, 0, 4, H); ctx.fillRect(fx + fw - 4, 0, 4, H);

        // pickups
        const pr = L.pr;
        ctx.font = `${Math.round(pr * 1.8)}px sans-serif`;
        for (const p of pickups) {
          const x = sx(p.x), y = sy(p.y), bob = Math.sin(t * 6 + p.x * 10) * 3;
          ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(x, y + bob, pr * 1.3, 0, Math.PI * 2); ctx.fill();
          ctx.fillText(p.kind === 'maple' ? '🍁' : '🥛', x, y + bob);
        }

        // defenders
        for (const f of foes) {
          const x = sx(f.x), y = sy(f.y);
          if (y < -60 || y > H + 60) continue;
          const a = pr * f.w, b = pr * f.h;
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 5, a, b, 0, 0, Math.PI * 2); ctx.fill();
          const col = f.kind === 'OL' ? '#c8102e' : f.kind === 'LB' ? '#e8642c' : '#7a1fa2';
          ctx.fillStyle = col; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, y, a, b, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          // shoulder pads / arms reaching downfield
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(x - a * 0.8, y + b * 0.5, pr * 0.35, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + a * 0.8, y + b * 0.5, pr * 0.35, 0, Math.PI * 2); ctx.fill();
          // helmet
          ctx.fillStyle = '#e9e9e9'; ctx.beginPath(); ctx.arc(x, y + b * 0.1, pr * 0.55, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = col; ctx.fillRect(x - pr * 0.1, y + b * 0.1 - pr * 0.55, pr * 0.2, pr * 1.1);
          // number
          ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(pr * 0.7)}px sans-serif`;
          ctx.fillText(String(f.num), x, y - b * 0.6);
          if (f.kind === 'S' && !f.knock) { // speed lines
            ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
            for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(x - f.vx * 30 + k * 6, y - b - 4); ctx.lineTo(x - f.vx * 60 + k * 6, y - b - 18); ctx.stroke(); }
          }
        }

        // player
        const x = sx(px), y = L.py;
        const blink = invuln > 0 && Math.floor(invuln * 12) % 2 === 0;
        if (!blink) {
          if (burst > 0) { // maple trail
            ctx.fillStyle = 'rgba(245,200,66,.35)';
            for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(x, y + k * pr * 0.7, pr * (1 - k * 0.18), 0, Math.PI * 2); ctx.fill(); }
          }
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 5, pr * 1.1, pr * 0.9, 0, 0, Math.PI * 2); ctx.fill();
          // legs (running)
          const step = Math.sin(dist * 1.6) * pr * 0.45;
          ctx.fillStyle = '#002e5d';
          ctx.beginPath(); ctx.arc(x - pr * 0.4, y + pr * 0.6 + step, pr * 0.32, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + pr * 0.4, y + pr * 0.6 - step, pr * 0.32, 0, Math.PI * 2); ctx.fill();
          // body: white concessions shirt + navy apron
          ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#002e5d'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, y, pr * 1.05, pr * 0.75, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          // arms holding tail
          ctx.fillStyle = '#f1c27d';
          ctx.beginPath(); ctx.arc(x - pr * 0.55, y - pr * 0.75, pr * 0.25, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + pr * 0.55, y - pr * 0.75, pr * 0.25, 0, Math.PI * 2); ctx.fill();
          // head w/ paper hat
          ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(x, y, pr * 0.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#002e5d'; ctx.fillRect(x - pr * 0.5, y - pr * 0.12, pr, pr * 0.24);
          drawTail(ctx, x, y, pr);
          if (shield > 0) {
            ctx.strokeStyle = `rgba(127,216,255,${shield < 1 ? 0.4 + 0.4 * Math.sin(t * 30) : 0.85})`; ctx.lineWidth = 4;
            ctx.fillStyle = 'rgba(127,216,255,.15)';
            ctx.beginPath(); ctx.ellipse(x, y - pr * 1.4, pr * 1.8, pr * 3.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          }
        }
        // crumbs
        ctx.fillStyle = '#c98a45';
        for (const c of crumbs) { ctx.globalAlpha = Math.max(0, c.t / 0.7); ctx.fillRect(c.x - 3, c.y - 3, 6, 6); }
        ctx.globalAlpha = 1;
        ctx.restore();

        if (biteFlash > 0) { ctx.fillStyle = `rgba(255,59,48,${biteFlash * 0.3})`; ctx.fillRect(0, 0, W, H); }
        if (tdFlash > 0) { ctx.fillStyle = `rgba(245,200,66,${Math.min(0.3, tdFlash * 0.2)})`; ctx.fillRect(0, 0, W, H); }

        // floaters
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const f of floaters) {
          const fs = Math.round(Math.min(W * 0.075, 30) * f.size);
          ctx.globalAlpha = Math.max(0, Math.min(1, f.t * 2));
          ctx.font = `900 ${fs}px sans-serif`;
          ctx.lineWidth = 4; ctx.strokeStyle = '#061a36'; ctx.strokeText(f.text, f.x, f.y);
          ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
        }
        ctx.globalAlpha = 1;

        // HUD panel (below the host's top ~60px)
        const hy = 66, hh = 58, hx = Math.max(8, W / 2 - 230), hw = Math.min(W - 16, 460);
        ctx.fillStyle = 'rgba(6,26,54,.82)'; rr(ctx, hx, hy, hw, hh, 12); ctx.fill();
        const frac = Math.max(0, 1 - t / DUR);
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(hx + 10, hy + hh - 9, hw - 20, 5);
        ctx.fillStyle = frac < 0.25 ? '#ff6b5e' : '#f5c842'; ctx.fillRect(hx + 10, hy + hh - 9, (hw - 20) * frac, 5);
        const fs = Math.min(20, W * 0.048);
        ctx.font = `900 ${fs}px sans-serif`; ctx.textAlign = 'left'; ctx.fillStyle = '#f5c842';
        ctx.fillText(`${score()} pts`, hx + 12, hy + 20);
        ctx.textAlign = 'center'; ctx.fillStyle = '#f0f4ff';
        const toGo = Math.max(0, Math.ceil(drive * PERIOD + 100 - dist));
        ctx.fillText(toGo > 100 ? 'END ZONE' : `${toGo} yd to TD`, hx + hw / 2, hy + 20);
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.max(0, DUR - t).toFixed(1)}s`, hx + hw - 12, hy + 20);
        // tail lives
        ctx.font = `${Math.round(fs * 0.85)}px sans-serif`; ctx.textAlign = 'left'; ctx.fillStyle = '#f0f4ff';
        let lx = hx + 12;
        ctx.fillText('Tail:', lx, hy + 36 + 1); lx += ctx.measureText('Tail: ').width;
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i < 3 - bites ? '#c98a45' : 'rgba(255,255,255,.2)';
          rr(ctx, lx + i * fs * 1.5, hy + 31, fs * 1.25, fs * 0.5, fs * 0.25); ctx.fill();
        }
        ctx.textAlign = 'right'; ctx.fillStyle = '#9fb4d8';
        ctx.fillText(`Drive ${drive + 1}${burst > 0 ? ' · 🍁' : ''}${shield > 0 ? ' · 🥛' : ''}`, hx + hw - 12, hy + 37);
        ctx.textBaseline = 'alphabetic';
      },
    };
  },
};
