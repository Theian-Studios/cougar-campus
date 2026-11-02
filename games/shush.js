/* ---------------- HBLL Shush ----------------
   Whack-a-mole in the library. Students pop up in the bookshelf gaps.
   Loud ones (📢 📱 🎧 😂) -> tap to SHUSH (+points, combo builds).
   Quiet studiers (📖 💻) -> leave them alone (tap = -points, "rude!").
   A loud one who slips away un-shushed just breaks the combo. 30 s, pace ramps up. */
window.MINIGAMES.shush = {
  name: 'HBLL Shush',
  icon: '🤫',
  blurb: 'Shush the loud ones',
  howTo: 'Tap the <b>loud</b> students (📢 📱 🎧 😂) to SHUSH them — chain shushes for combo bonus.<br>Leave the quiet studiers (📖 💻) alone: tapping them is rude!',
  create(api) {
    const DUR = 18, BASE = 18, COMBO_STEP = 5, COMBO_MAX = 5, RUDE = 40;
    const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#f3d0b0'];
    const HAIRS = ['#2b1b0e', '#5a3a1a', '#a0522d', '#e6c27a', '#111', '#7a4b2a', '#c0392b'];
    const SHIRTS = ['#e63946', '#2a9d8f', '#f4a261', '#7b5cff', '#0077b6', '#ef476f', '#06d6a0', '#ffd166', '#118ab2'];
    const LOUD = ['mega', 'phone', 'music', 'giggle'];
    const QUIET = ['book', 'laptop'];
    const KEYS3 = ['q', 'w', 'e', 'a', 's', 'd', 'z', 'x', 'c'];
    const KEYS4 = ['q', 'w', 'e', 'r', 'a', 's', 'd', 'f', 'z', 'x', 'c', 'v'];

    let t = 0, done = false, endT = 0, score = 0, combo = 0, bestCombo = 0;
    let shushed = 0, rude = 0, missed = 0, spawnT = 0.5, spawned = 0;
    let cols = 3, rows = 3, cells = [], layout = null, floaters = [], flash = 0, flashColor = '255,59,48';
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const lerp = (a, b, k) => a + (b - a) * k;

    function makeCells(n) {
      const old = cells; cells = [];
      for (let i = 0; i < n; i++) cells.push(old[i] || { occ: null, shake: 0 });
      for (let i = n; i < old.length; i++) if (old[i].occ && !old[i].occ.res) old[i].occ = null;
    }
    makeCells(9);

    function spawn() {
      const free = cells.map((c, i) => c.occ ? -1 : i).filter(i => i >= 0);
      if (!free.length) return;
      const prog = Math.min(1, t / DUR);
      const quietP = spawned < 3 ? 0 : lerp(0.26, 0.38, prog);
      const loud = Math.random() >= quietP;
      const kind = loud ? pick(LOUD) : pick(QUIET);
      spawned++;
      cells[pick(free)].occ = {
        kind, loud, age: 0, stay: lerp(1.7, 1.05, prog) * rnd(0.9, 1.15), res: null, resT: 0,
        skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS), long: Math.random() < 0.45, ph: Math.random() * 6,
        pals: [{ skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS), long: Math.random() < 0.5 },
               { skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS), long: Math.random() < 0.5 }],
      };
    }
    // 0..1 how far the student has popped up
    function riseOf(o) {
      if (o.res) { const hold = o.res === 'rude' ? 0.45 : 0.15; return Math.max(0, Math.min(1, 1 - (o.resT - hold) / 0.3)); }
      if (o.age < 0.14) return o.age / 0.14;
      if (o.age > o.stay) return Math.max(0, 1 - (o.age - o.stay) / 0.16);
      return 1;
    }
    function pop(text, x, y, color, big) { floaters.push({ text, x, y, t: 1, color, big }); }

    function hitCell(i) {
      if (done || endT > 0 || i < 0 || i >= cells.length) return;
      const c = cells[i], o = c.occ;
      if (!o || o.res || riseOf(o) < 0.3 || o.age > o.stay + 0.1) return;
      const r = cellRect(i);
      o.res = o.loud ? 'shh' : 'rude'; o.resT = 0;
      if (o.loud) {
        combo++; bestCombo = Math.max(bestCombo, combo); shushed++;
        const pts = BASE + COMBO_STEP * Math.min(combo - 1, COMBO_MAX) + (o.age < 0.6 ? 5 : 0);
        score += pts;
        api.sfx(combo >= 5 ? 'coin' : 'tap');
        pop('SHHH!', r.x + r.w / 2, r.y + r.h * 0.3, '#ffffff', true);
        pop(`+${pts}${combo >= 2 ? ` ×${combo}` : ''}`, r.x + r.w / 2, r.y + r.h * 0.55, '#f5c842');
      } else {
        rude++; combo = 0; score -= RUDE; c.shake = 0.45; flash = 0.6; flashColor = '255,59,48';
        api.sfx('bad');
        pop('rude!', r.x + r.w / 2, r.y + r.h * 0.3, '#ff5a4e', true);
        pop(`−${RUDE}`, r.x + r.w / 2, r.y + r.h * 0.55, '#ff5a4e');
      }
    }
    function cellRect(i) {
      const L = layout; if (!L) return { x: 0, y: 0, w: 1, h: 1 };
      const cx = i % cols, cy = Math.floor(i / cols);
      return { x: L.gx + cx * L.cw, y: L.gy + cy * L.ch, w: L.cw, h: L.ch };
    }
    function finishNow() {
      if (done) return; done = true;
      api.finish(Math.max(0, score), `🤫 ${shushed} shushed · best combo ×${bestCombo} · ${rude} rude tap${rude === 1 ? '' : 's'} · ${missed} got away`);
    }

    return {
      update(dt) {
        flash = Math.max(0, flash - dt * 2.5);
        for (const f of floaters) f.t -= dt * 1.1;
        floaters = floaters.filter(f => f.t > 0);
        for (const c of cells) {
          c.shake = Math.max(0, c.shake - dt);
          const o = c.occ; if (!o) continue;
          if (o.res) { o.resT += dt; if (o.resT > (o.res === 'rude' ? 0.8 : 0.5)) c.occ = null; continue; }
          o.age += dt;
          if (o.age > o.stay + 0.16) {
            if (o.loud && endT <= 0 && !done) {
              missed++;
              if (combo >= 2) { const i = cells.indexOf(c), r = cellRect(i); pop('combo lost', r.x + r.w / 2, r.y + r.h * 0.35, '#9fb3d1'); }
              combo = 0;
            }
            c.occ = null;
          }
        }
        if (done) return;
        if (endT > 0) { endT -= dt; if (endT <= 0) finishNow(); return; }
        t += dt;
        const prog = Math.min(1, t / DUR);
        spawnT -= dt;
        if (spawnT <= 0) {
          spawn();
          if (prog > 0.45 && Math.random() < prog * 0.35) spawn(); // occasional double pop late
          spawnT = lerp(0.85, 0.45, prog) * rnd(0.8, 1.2);
        }
        if (t >= DUR) { endT = 1.0; api.sfx('beep'); for (const c of cells) if (c.occ && !c.occ.res) c.occ.stay = Math.min(c.occ.stay, c.occ.age); }
      },
      tap(x, y) {
        if (done || !layout) return;
        const L = layout;
        const cx = Math.floor((x - L.gx) / L.cw), cy = Math.floor((y - L.gy) / L.ch);
        if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return;
        hitCell(cy * cols + cx);
      },
      key(k, isDown, isRepeat) {
        if (!isDown || isRepeat) return;
        const map = cols === 4 ? KEYS4 : KEYS3;
        const i = map.indexOf(k);
        if (i >= 0) hitCell(i);
      },
      draw(ctx, W, H) {
        // ---- layout ----
        const fs = Math.min(22, W * 0.052), hy = 66, hh = fs * 2.1;
        const top = hy + hh + 12, bottom = H - (W < 700 ? 74 : 20);
        const availW = Math.max(120, Math.min(W - 24, 1000)), availH = Math.max(120, bottom - top);
        const wantCols = W / H > 1.05 ? 4 : 3, wantRows = availH / availW > 1.35 ? 4 : 3;
        if (wantCols !== cols || wantRows !== rows) { cols = wantCols; rows = wantRows; makeCells(cols * rows); }
        const cw = Math.min(availW / cols, (availH / rows) * 1.1), ch = Math.min(availH / rows, cw * 1.15);
        const gw = cw * cols, gh = ch * rows;
        layout = { gx: (W - gw) / 2, gy: top + (availH - gh) / 2, cw, ch };
        const L = layout;

        // ---- background: library wall + carpet ----
        ctx.fillStyle = '#e9e1cf'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#d8ccb2';
        for (let x = 0; x < W; x += 46) ctx.fillRect(x, 0, 2, H);
        ctx.fillStyle = '#2f4a6e'; ctx.fillRect(0, H * 0.92, W, H * 0.08); // carpet
        // shelf frame (wood)
        const pad = Math.max(8, cw * 0.06);
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; rr(ctx, L.gx - pad + 6, L.gy - pad + 8, gw + pad * 2, gh + pad * 2, 10); ctx.fill();
        ctx.fillStyle = '#7a4e2a'; rr(ctx, L.gx - pad, L.gy - pad, gw + pad * 2, gh + pad * 2, 10); ctx.fill();
        ctx.fillStyle = '#8f5d33'; rr(ctx, L.gx - pad * 0.5, L.gy - pad * 0.5, gw + pad, gh + pad, 6); ctx.fill();

        const desktop = W > 700, keymap = cols === 4 ? KEYS4 : KEYS3;
        for (let i = 0; i < cells.length; i++) {
          const c = cells[i], r = cellRect(i);
          const sh = c.shake > 0 ? Math.sin(c.shake * 60) * c.shake * cw * 0.08 : 0;
          ctx.save(); ctx.translate(sh, 0);
          drawCell(ctx, r, i, c, desktop ? keymap[i] : null);
          ctx.restore();
        }

        // floaters
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const f of floaters) {
          const a = Math.min(1, f.t * 2.2), rise = (1 - f.t) * ch * 0.35;
          ctx.globalAlpha = a;
          if (f.big) {
            const s = 1 + Math.max(0, f.t - 0.8) * 2.5;
            ctx.font = `900 ${Math.max(18, cw * 0.2) * s}px sans-serif`;
            ctx.lineWidth = 6; ctx.strokeStyle = f.color === '#ffffff' ? '#002e5d' : '#3a0b0b';
            ctx.strokeText(f.text, f.x, f.y - rise); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - rise);
          } else {
            ctx.font = `900 ${Math.max(15, cw * 0.13)}px sans-serif`;
            ctx.lineWidth = 4; ctx.strokeStyle = '#061a36';
            ctx.strokeText(f.text, f.x, f.y - rise); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - rise);
          }
        }
        ctx.globalAlpha = 1;
        if (flash > 0) { ctx.fillStyle = `rgba(${flashColor},${flash * 0.22})`; ctx.fillRect(0, 0, W, H); }

        // ---- HUD panel ----
        const hw = Math.min(W - 24, 520), hx = (W - hw) / 2;
        ctx.fillStyle = 'rgba(6,26,54,0.88)'; rr(ctx, hx, hy, hw, hh, 12); ctx.fill();
        ctx.textBaseline = 'middle'; ctx.font = `800 ${fs}px sans-serif`;
        ctx.textAlign = 'left'; ctx.fillStyle = '#f5c842'; ctx.fillText(`${score}`, hx + 14, hy + hh / 2);
        ctx.textAlign = 'center'; ctx.fillStyle = '#f0f4ff';
        ctx.fillText(`${Math.max(0, DUR - t).toFixed(1)}s`, hx + hw * 0.5, hy + hh / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = combo >= 2 ? '#3fd8ff' : 'rgba(240,244,255,0.55)';
        ctx.fillText(combo >= 2 ? `🤫 ×${combo}` : '🤫', hx + hw - 14, hy + hh / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(hx + 10, hy + hh - 5, hw - 20, 3);
        ctx.fillStyle = '#f5c842'; ctx.fillRect(hx + 10, hy + hh - 5, (hw - 20) * Math.min(1, t / DUR), 3);

        // hints / end banner
        if (t < 3.5 && !done && endT <= 0) {
          ctx.globalAlpha = Math.min(1, 3.5 - t);
          const hfs = Math.min(18, W * 0.042);
          ctx.font = `800 ${hfs}px sans-serif`; ctx.textAlign = 'center';
          const msg = 'Tap 📢📱🎧😂 · Leave 📖💻 alone';
          const tw = ctx.measureText(msg).width + 24;
          ctx.fillStyle = 'rgba(6,26,54,0.85)'; rr(ctx, W / 2 - tw / 2, top - 4 - hfs * 0.2, tw, hfs * 1.7, 8);
          // keep the hint out of the grid: draw it over the top shelf edge
          ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(msg, W / 2, top - 4 + hfs * 0.65);
          ctx.globalAlpha = 1;
        }
        if (endT > 0 || done) {
          ctx.fillStyle = 'rgba(6,26,54,0.55)'; ctx.fillRect(0, H * 0.42, W, H * 0.14);
          ctx.font = `900 ${Math.min(40, W * 0.08)}px sans-serif`; ctx.textAlign = 'center';
          ctx.fillStyle = '#f5c842'; ctx.fillText('📚 Library closing!', W / 2, H * 0.49);
        }
        ctx.textBaseline = 'alphabetic';
      },
    };

    // ---------- drawing helpers ----------
    function drawCell(ctx, r, i, c, keyLabel) {
      const m = Math.max(4, r.w * 0.045);
      const x = r.x + m, y = r.y + m, w = r.w - m * 2, h = r.h - m * 2;
      const deskY = y + h * 0.78;
      // gap interior (dark back of shelf) with books on the sides
      ctx.fillStyle = '#3b2615'; ctx.fillRect(x, y, w, h);
      const o = c.occ;
      if (o && o.loud && !o.res) { ctx.fillStyle = `rgba(255,80,60,${0.12 + 0.08 * Math.sin(t * 14 + o.ph)})`; ctx.fillRect(x, y, w, h); }
      drawBooks(ctx, x, y, w, deskY - y, i);
      // student (clipped so they rise from behind the desk)
      if (o) {
        const rise = riseOf(o);
        if (rise > 0) {
          ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, deskY - y); ctx.clip();
          const s = personScale(w, h);
          const off = (1 - rise) * h * 0.85;
          if (o.kind === 'giggle') {
            drawPerson(ctx, x + w * 0.25, deskY + off + s * 0.06, s * 0.72, o.pals[0], o, -1);
            drawPerson(ctx, x + w * 0.75, deskY + off + s * 0.06, s * 0.72, o.pals[1], o, 1);
            drawPerson(ctx, x + w * 0.5, deskY + off, s * 0.82, o, o, 0);
          } else drawPerson(ctx, x + w * 0.5, deskY + off, s, o, o, 0);
          ctx.restore();
        }
      }
      // desk ledge
      ctx.fillStyle = '#b07a45'; ctx.fillRect(x - m * 0.5, deskY, w + m, h * 0.07);
      ctx.fillStyle = '#9a6535'; ctx.fillRect(x, deskY + h * 0.07, w, y + h - deskY - h * 0.07);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x - m * 0.5, deskY, w + m, h * 0.015);
      // props + bubbles drawn on top of desk
      if (o) {
        const rise = riseOf(o);
        if (rise > 0.05) drawProps(ctx, o, x, y, w, h, deskY, rise);
      }
      if (keyLabel) {
        ctx.font = `700 ${Math.max(11, w * 0.07)}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(255,240,210,0.6)'; ctx.fillText(keyLabel.toUpperCase(), x + 5, y + h - 3);
      }
    }

    function drawBooks(ctx, x, y, w, h, seed) {
      // a few spines on the left and right edges of the gap
      const BOOK = ['#b23a48', '#2e86ab', '#e9c46a', '#3d5a80', '#6a994e', '#9c6644', '#f28482', '#264653'];
      let s = seed * 9301 + 49297;
      const R = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      for (const side of [0, 1]) {
        let bx = side ? x + w : x;
        const n = 2 + Math.floor(R() * 2);
        for (let k = 0; k < n; k++) {
          const bw = w * (0.05 + R() * 0.03), bh = h * (0.45 + R() * 0.25);
          ctx.fillStyle = BOOK[Math.floor(R() * BOOK.length)];
          const px = side ? bx - bw : bx;
          ctx.fillRect(px, y + h - bh, bw, bh);
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(px, y + h - bh * 0.8, bw, bh * 0.06);
          bx += side ? -bw - 1 : bw + 1;
        }
      }
    }

    // p = appearance, o = occupant state (for expression), side = for giggle pals
    function drawPerson(ctx, cx, baseY, s, p, o, side) {
      const hr = s * 0.15, headY = baseY - s * 0.36;
      const loudFace = o.loud && !o.res;
      const bob = loudFace ? Math.sin(t * (o.kind === 'giggle' ? 22 : 12) + o.ph + side) * s * 0.012 : 0;
      // body / shirt
      ctx.fillStyle = p.shirt; rr(ctx, cx - s * 0.2, baseY - s * 0.2 + bob, s * 0.4, s * 0.4, s * 0.12); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(cx - s * 0.03, baseY - s * 0.2 + bob, s * 0.06, s * 0.06);
      // long hair behind head
      if (p.long) { ctx.fillStyle = p.hair; rr(ctx, cx - hr * 1.08, headY - hr * 0.3 + bob, hr * 2.16, hr * 1.7, hr * 0.5); ctx.fill(); }
      // head
      ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(cx, headY + bob, hr, 0, Math.PI * 2); ctx.fill();
      // hair cap
      ctx.fillStyle = p.hair; ctx.beginPath(); ctx.arc(cx, headY + bob - hr * 0.12, hr * 1.02, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      // face
      const ey = headY + bob + hr * 0.1, ex = hr * 0.38;
      ctx.fillStyle = '#1b1b1b'; ctx.strokeStyle = '#1b1b1b'; ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.5, hr * 0.13);
      if (o.res === 'rude') {
        // angry brows + frown
        ctx.beginPath(); ctx.moveTo(cx - ex - hr * 0.2, ey - hr * 0.35); ctx.lineTo(cx - ex + hr * 0.15, ey - hr * 0.18);
        ctx.moveTo(cx + ex + hr * 0.2, ey - hr * 0.35); ctx.lineTo(cx + ex - hr * 0.15, ey - hr * 0.18); ctx.stroke();
        dot(ctx, cx - ex, ey, hr * 0.1); dot(ctx, cx + ex, ey, hr * 0.1);
        ctx.beginPath(); ctx.arc(cx, ey + hr * 0.6, hr * 0.28, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      } else if (o.res === 'shh') {
        // embarrassed: wide eyes, tiny "o", blush
        dot(ctx, cx - ex, ey, hr * 0.14); dot(ctx, cx + ex, ey, hr * 0.14);
        ctx.beginPath(); ctx.arc(cx, ey + hr * 0.45, hr * 0.1, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,90,110,0.45)';
        dot(ctx, cx - hr * 0.62, ey + hr * 0.3, hr * 0.17); dot(ctx, cx + hr * 0.62, ey + hr * 0.3, hr * 0.17);
      } else if (loudFace) {
        // eyes squeezed / excited + big open mouth
        if (o.kind === 'giggle') {
          ctx.beginPath(); ctx.arc(cx - ex, ey + hr * 0.05, hr * 0.12, Math.PI * 1.1, Math.PI * 1.9);
          ctx.moveTo(cx + ex + hr * 0.12, ey); ctx.arc(cx + ex, ey + hr * 0.05, hr * 0.12, Math.PI * 1.9, Math.PI * 1.1, true); ctx.stroke();
        } else { dot(ctx, cx - ex, ey, hr * 0.11); dot(ctx, cx + ex, ey, hr * 0.11); }
        const mo = 0.7 + 0.3 * Math.abs(Math.sin(t * 14 + o.ph + side));
        ctx.fillStyle = '#7a1f1f'; ctx.beginPath(); ctx.ellipse(cx, ey + hr * 0.5, hr * 0.3, hr * 0.26 * mo, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        // quiet & focused: eyes looking down, small calm smile
        ctx.beginPath(); ctx.moveTo(cx - ex - hr * 0.1, ey + hr * 0.08); ctx.lineTo(cx - ex + hr * 0.1, ey + hr * 0.08);
        ctx.moveTo(cx + ex - hr * 0.1, ey + hr * 0.08); ctx.lineTo(cx + ex + hr * 0.1, ey + hr * 0.08); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, ey + hr * 0.3, hr * 0.2, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
      }
      if (o.kind === 'music' && side === 0) {
        // headphones band + cups
        ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(2, hr * 0.2);
        ctx.beginPath(); ctx.arc(cx, headY + bob, hr * 1.12, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        ctx.fillStyle = '#e63946';
        rr(ctx, cx - hr * 1.3, headY + bob - hr * 0.2, hr * 0.42, hr * 0.7, hr * 0.15); ctx.fill();
        rr(ctx, cx + hr * 0.88, headY + bob - hr * 0.2, hr * 0.42, hr * 0.7, hr * 0.15); ctx.fill();
      }
    }

    function drawProps(ctx, o, x, y, w, h, deskY, rise) {
      const s = personScale(w, h), off = (1 - rise) * h * 0.85;
      const headY = deskY + off - s * 0.36, cx = x + w / 2;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = Math.min(1, rise * 1.5);
      ctx.fillStyle = '#000';
      if (!o.loud) {
        if (o.kind === 'book') { ctx.font = `${s * 0.36}px sans-serif`; ctx.fillText('📖', cx, deskY - s * 0.02); }
        else { ctx.font = `${s * 0.38}px sans-serif`; ctx.fillText('💻', cx, deskY - s * 0.06); }
        // calm little "quiet" tag
        if (!o.res) {
          ctx.font = `700 ${Math.max(10, s * 0.09)}px sans-serif`; ctx.fillStyle = 'rgba(200,230,255,0.75)';
          ctx.fillText('…', x + w * 0.82, headY - s * 0.12);
        }
      } else if (!o.res) {
        const wob = Math.sin(t * 18 + o.ph) * s * 0.02;
        // prop next to the head
        ctx.fillStyle = '#000';
        if (o.kind === 'mega') { ctx.font = `${s * 0.3}px sans-serif`; ctx.fillText('📢', cx - s * 0.3, headY + s * 0.08 + wob); }
        if (o.kind === 'phone') { ctx.font = `${s * 0.2}px sans-serif`; ctx.fillText('📱', cx + s * 0.2, headY + s * 0.05); }
        if (o.kind === 'music') {
          ctx.font = `900 ${s * 0.14}px sans-serif`; ctx.fillStyle = '#f5c842';
          for (let k = 0; k < 3; k++) {
            const ph = (t * 0.9 + k / 3 + o.ph) % 1;
            ctx.globalAlpha = Math.min(1, rise * 1.5) * (1 - ph);
            ctx.fillText(k % 2 ? '♫' : '♪', cx + (k - 1) * s * 0.28 + Math.sin(ph * 6) * s * 0.04, headY - s * 0.05 - ph * s * 0.3);
          }
          ctx.globalAlpha = Math.min(1, rise * 1.5);
        }
        // speech bubble (top corner of the gap)
        const label = { mega: '📢 HEY!!', phone: '📱 WHAT?!', music: '🎧 🔊', giggle: '😂 hehe' }[o.kind];
        const bfs = Math.max(11, s * 0.13);
        ctx.font = `900 ${bfs}px sans-serif`;
        const bw = ctx.measureText(label).width + bfs * 0.9, bh = bfs * 1.6;
        const right = o.kind !== 'mega';
        let bx = right ? x + w - bw - s * 0.02 : x + s * 0.02;
        const by = y + s * 0.02 + wob;
        bx = Math.max(x - s * 0.05, Math.min(bx, x + w - bw + s * 0.05));
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e63946'; ctx.lineWidth = Math.max(2, s * 0.022);
        rr(ctx, bx, by, bw, bh, bh * 0.4); ctx.fill(); ctx.stroke();
        // tail
        const tx = right ? bx + bw * 0.3 : bx + bw * 0.7;
        ctx.beginPath(); ctx.moveTo(tx - bfs * 0.3, by + bh - 1); ctx.lineTo(cx + (right ? -1 : 1) * s * 0.04, by + bh + bfs * 0.6); ctx.lineTo(tx + bfs * 0.3, by + bh - 1);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c1121f'; ctx.fillText(label, bx + bw / 2, by + bh / 2 + 1);
        // noise lines either side of the head
        if (o.kind !== 'giggle') {
        ctx.strokeStyle = 'rgba(255,90,70,0.9)'; ctx.lineWidth = Math.max(2, s * 0.02); ctx.lineCap = 'round';
        const ny = headY, a = 0.5 + 0.5 * Math.sin(t * 20 + o.ph);
        for (const d of [-1, 1]) {
          for (let k = 0; k < 2; k++) {
            const rr2 = s * (0.22 + k * 0.07 + a * 0.02);
            ctx.beginPath(); ctx.arc(cx, ny, rr2, d < 0 ? Math.PI * 0.85 : -Math.PI * 0.15, d < 0 ? Math.PI * 1.15 : Math.PI * 0.15); ctx.stroke();
          }
        }
        }
      } else if (o.res === 'shh') {
        ctx.fillStyle = '#000'; ctx.font = `${s * 0.26}px sans-serif`; ctx.fillText('🤫', x + w * 0.82, y + s * 0.18);
      }
      ctx.globalAlpha = 1;
    }

    function personScale(w, h) { return Math.min(w * 0.9, h * 0.78 * 1.3); }
    function dot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    function rr(ctx, x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
  },
};
