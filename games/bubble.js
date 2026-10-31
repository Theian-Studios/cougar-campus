/* ---------------- Bubble Sheet ----------------
   BYU Testing Center, minutes before closing. Rapid-fire TRUE/FALSE BYU & Provo
   trivia on a Scantron-style sheet. Tap T or F (or ← / → / T / F keys).
   30 s round. Correct = 40 + speed bonus (up to 40) + streak bonus; wrong = −25 + short lockout. */
window.MINIGAMES.bubble = {
  name: 'Bubble Sheet',
  icon: '📝',
  blurb: 'Rapid BYU true/false',
  howTo: 'Testing Center closes soon! Fill <b>T</b> or <b>F</b> for each BYU/Provo statement (tap, or ← → / T F keys).<br>Faster = more points, streaks add bonus, wrong answers cost 25 and a second.',
  create(api) {
    const DUR = 18, BASE = 40, SPEED_MAX = 40, SPEED_WIN = 5, WRONG = 25, FEED = 0.42, LOCK = 0.9;
    // [statement, isTrue]
    const POOL = [
      ['The BYU Creamery dates back to the 1940s.', true],
      ['A Cougar Tail is a giant maple bar sold at BYU games.', true],
      ['The Y on Y Mountain is longer than a football field.', true],
      ['The Y on Y Mountain was first built in 1906.', true],
      ['LaVell Edwards Stadium is named after a legendary BYU football coach.', true],
      ['BYU won the college football national championship in 1984.', true],
      ['Ty Detmer won the Heisman Trophy while playing for BYU.', true],
      ['Jimmer Fredette played basketball for BYU.', true],
      ['BYU plays its home basketball games in the Marriott Center.', true],
      ['HBLL stands for Harold B. Lee Library.', true],
      ['Provo sits on the east shore of Utah Lake.', true],
      ['Utah Lake is a freshwater lake.', true],
      ['BYU joined the Big 12 Conference in 2023.', true],
      ['BYU’s fight song is “Rise and Shout.”', true],
      ['The BYU Testing Center is in the Grant Building.', true],
      ['The Eyring Science Center has a Foucault pendulum.', true],
      ['The Wilkinson Student Center has a bowling alley.', true],
      ['Graham Canyon is a BYU Creamery ice cream flavor.', true],
      ['BYU traces its founding back to 1875.', true],
      ['Provo is south of Salt Lake City.', true],
      ['Bridal Veil Falls is in Provo Canyon.', true],
      ['Mount Timpanogos is over 11,000 feet tall.', true],
      ['Steve Young played quarterback at BYU.', true],
      ['BYU’s mascot, Cosmo, is a cougar.', true],
      ['The Cougareat is the food court in the Wilk.', true],
      ['The Eyring Science Center has a planetarium.', true],
      ['Danny Ainge played both pro basketball and pro baseball.', true],
      ['Provo is in Utah County.', true],

      ['The Y on Y Mountain is painted blue.', false],
      ['LaVell Edwards Stadium is named after a BYU basketball coach.', false],
      ['BYU won the college football national championship in 1994.', false],
      ['Steve Young won the Heisman Trophy at BYU.', false],
      ['Jimmer Fredette played football for BYU.', false],
      ['Provo sits on the shore of the Great Salt Lake.', false],
      ['Utah Lake is saltier than the ocean.', false],
      ['BYU’s fight song is “Hail to the Victors.”', false],
      ['The Y on Y Mountain was first built in 1996.', false],
      ['BYU’s school colors are crimson and white.', false],
      ['Provo is north of Salt Lake City.', false],
      ['BYU–Idaho is located in Provo.', false],
      ['Provo is in Salt Lake County.', false],
      ['BYU’s mascot is a grizzly bear.', false],
      ['HBLL stands for “Hall of Big Lecture Labs.”', false],
      ['LaVell Edwards Stadium holds about 6,000 fans.', false],
      ['The Marriott Center is BYU’s football stadium.', false],
      ['A Cougar Tail is a spicy foot-long hot dog.', false],
      ['Mount Timpanogos is shorter than 5,000 feet.', false],
      ['BYU joined the Pac-12 Conference in 2023.', false],
      ['Provo sits on the west shore of Utah Lake.', false],
      ['The letter on Y Mountain is a giant “U.”', false],
      ['Ty Detmer won the Heisman while playing for Utah.', false],
      ['The BYU Creamery only sells frozen yogurt.', false],
      ['The BYU Testing Center is inside the Marriott Center.', false],
      ['Provo sits below sea level.', false],
    ];
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let deck = shuffle(POOL.slice()), qi = 0;
    let t = 0, done = false, score = 0, streak = 0, bestStreak = 0, right = 0, wrong = 0;
    let qT = 0;                 // time on current question
    let feed = 0, pick = null;  // feedback phase after answering: {ans, ok}
    let scrib = 0;              // scribble animation progress 0..1
    let shake = 0, flash = 0, flashOk = true, slide = 1;
    let floaters = [];
    let L = null;               // last layout (for tap hit-testing)
    let lines = [], linesFor = -1, linesW = 0;
    const cur = () => deck[qi % deck.length];

    function nextQ() {
      qi++;
      if (qi % deck.length === 0) { const last = deck[deck.length - 1]; deck = shuffle(POOL.slice()); if (deck[0] === last) deck.push(deck.shift()); }
      qT = 0; pick = null; scrib = 0; slide = 0;
    }
    function answer(ans) {
      if (done || pick || slide < 0.6) return;
      const ok = ans === cur()[1];
      pick = { ans, ok }; feed = ok ? FEED : LOCK; scrib = 0;
      const bx = L ? (ans ? L.tx : L.fx) : 200, by = L ? L.by - L.bh : 300;
      if (ok) {
        streak++; right++; bestStreak = Math.max(bestStreak, streak);
        const sp = Math.round(SPEED_MAX * Math.max(0, 1 - qT / SPEED_WIN));
        const st = Math.min(30, Math.max(0, streak - 1) * 5);
        const pts = BASE + sp + st; score += pts;
        api.sfx(streak >= 3 && streak % 5 === 0 ? 'coin' : 'tap');
        pop(`+${pts}`, bx, by, '#2fb36b');
        if (streak >= 3) pop(`streak ×${streak}`, bx, by + 30, '#f5c842', 0.8);
        flashOk = true; flash = 0.5;
      } else {
        streak = 0; wrong++; score -= WRONG;
        api.sfx('bad'); shake = 1; flashOk = false; flash = 1;
        pop(`−${WRONG}`, bx, by, '#e8463c');
      }
    }
    function pop(text, x, y, color, s = 1) { floaters.push({ text, x, y, t: 1, color, s }); }
    function end() {
      if (done) return; done = true; api.sfx('whoosh');
      const n = right + wrong;
      api.finish(Math.max(0, score), `Pencils down! · ${right}/${n} correct · best streak ${bestStreak}`);
    }

    function wrap(ctx, text, maxW) {
      const words = text.split(' '), out = []; let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
      }
      if (line) out.push(line);
      return out;
    }
    function rr(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    function drawBubble(ctx, cx, cy, bw, bh, label, state) {
      // state: null | {fill: 0..1, ok, correctHint}
      ctx.save();
      ctx.lineWidth = Math.max(2, bh * 0.05);
      ctx.strokeStyle = '#c0504d'; ctx.fillStyle = '#fffdf6';
      ctx.beginPath(); ctx.ellipse(cx, cy, bw / 2, bh / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c0504d'; ctx.font = `700 ${bh * 0.5}px Georgia, serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy + bh * 0.03);
      if (state && state.fill > 0) {
        // pencil scribble: zig-zag strokes clipped to the oval, revealed left→right
        ctx.save();
        ctx.beginPath(); ctx.ellipse(cx, cy, bw / 2 - 2, bh / 2 - 2, 0, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = 'rgba(60,60,70,0.78)'; ctx.fillRect(cx - bw / 2, cy - bh / 2, bw * Math.min(1, state.fill * 1.08), bh);
        ctx.strokeStyle = 'rgba(35,35,42,0.95)'; ctx.lineWidth = bh * 0.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const n = 13, x0 = cx - bw / 2, step = bw / n, upto = state.fill * n;
        ctx.beginPath(); ctx.moveTo(x0, cy - bh / 2);
        let px = x0, py = cy - bh / 2;
        for (let i = 0; i < n && i < upto; i++) {
          const f = Math.min(1, upto - i);
          const nx = x0 + (i + 0.5) * step + step * 0.5 * f, ny = (i % 2 ? cy - bh / 2 : cy + bh / 2);
          px = px + (nx - px) * f; py = py + (ny - py) * f;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
        if (state.fill < 1) { // pencil riding the scribble
          ctx.font = `${bh * 0.7}px sans-serif`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
          const pxp = x0 + bw * state.fill, pyp = cy + (Math.floor(state.fill * 13) % 2 ? -1 : 1) * bh * 0.25;
          ctx.fillText('✏️', pxp - bh * 0.1, pyp);
        }
      }
      ctx.restore();
    }

    return {
      update(dt) {
        shake = Math.max(0, shake - dt * 3.5); flash = Math.max(0, flash - dt * 3);
        for (const f of floaters) f.t -= dt * 1.1;
        floaters = floaters.filter(f => f.t > 0);
        if (done) return;
        t += dt;
        if (slide < 1) slide = Math.min(1, slide + dt * 7);
        if (pick) {
          scrib = Math.min(1, scrib + dt / 0.22);
          feed -= dt; if (feed <= 0) nextQ();
        } else if (slide >= 1) qT += dt;
        if (t >= DUR) end();
      },
      tap(x, y) {
        if (done || !L) return;
        if (y < L.tapTop || y > L.tapBot) return;
        answer(x < L.mid);
      },
      key(k, isDown, isRepeat) {
        if (!isDown || isRepeat) return;
        if (k === 'ArrowLeft' || k === 't') answer(true);
        else if (k === 'ArrowRight' || k === 'f') answer(false);
      },
      draw(ctx, W, H) {
        const phone = W < 600;
        const sx = (Math.random() - 0.5) * shake * 12, sy = (Math.random() - 0.5) * shake * 6;
        // --- wall ---
        ctx.fillStyle = '#d9d4c7'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        for (let x = 0; x < W; x += 46) ctx.fillRect(x, 0, 2, H);
        // floor / desk
        const deskY = Math.max(phone ? 220 : 200, H * 0.26);
        ctx.fillStyle = '#b8895a'; ctx.fillRect(0, deskY, W, H - deskY);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        for (let y = deskY + 18; y < H; y += 34) ctx.fillRect(0, y, W, 2);
        ctx.fillStyle = '#8a6440'; ctx.fillRect(0, deskY, W, 6);

        // --- HUD panel ---
        const fs = Math.min(22, W * 0.052), hy = 66, hh = fs * 2.1;
        const hw = Math.min(W - 24, 520), hx = (W - hw) / 2;
        ctx.fillStyle = 'rgba(6,26,54,0.9)'; rr(ctx, hx, hy, hw, hh, 12); ctx.fill();
        ctx.textBaseline = 'middle'; ctx.font = `800 ${fs}px sans-serif`;
        ctx.textAlign = 'left'; ctx.fillStyle = '#f5c842';
        ctx.fillText(`${Math.max(0, score)}`, hx + 14, hy + hh / 2);
        ctx.textAlign = 'center'; ctx.fillStyle = (DUR - t < 6 && !done) ? (Math.floor(t * 4) % 2 ? '#ff6b5e' : '#fff') : '#f0f4ff';
        ctx.fillText(`${Math.max(0, DUR - t).toFixed(1)}s`, hx + hw * 0.5, hy + hh / 2);
        ctx.textAlign = 'right'; ctx.fillStyle = streak >= 3 ? '#f5c842' : '#9fb3d1'; ctx.font = `800 ${fs * 0.85}px sans-serif`;
        ctx.fillText(streak >= 3 ? `🔥×${streak}` : `✓${right} ✗${wrong}`, hx + hw - 12, hy + hh / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(hx + 10, hy + hh - 5, hw - 20, 3);
        ctx.fillStyle = '#f5c842'; ctx.fillRect(hx + 10, hy + hh - 5, (hw - 20) * Math.min(1, t / DUR), 3);

        // --- wall clock (9:30 → 10:00 over the round) + sign ---
        const wallTop = hy + hh + 8, wallBot = deskY - 6;
        const cr = Math.max(18, Math.min(44, (wallBot - wallTop) / 2 - 4, W * 0.09));
        const ccx = Math.min(W - cr - 18, hx + hw - cr - 6), ccy = (wallTop + wallBot) / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.arc(ccx + 3, ccy + 3, cr + 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(ccx, ccy, cr + 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fbfbf7'; ctx.beginPath(); ctx.arc(ccx, ccy, cr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#333';
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.fillRect(ccx + Math.sin(a) * cr * 0.82 - 1, ccy - Math.cos(a) * cr * 0.82 - 1, 2.5, 2.5); }
        const mins = 30 + 30 * Math.min(1, t / DUR);           // minutes past 9
        const ma = mins / 60 * Math.PI * 2, ha = (9 + mins / 60) / 12 * Math.PI * 2;
        ctx.strokeStyle = '#222'; ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(2, cr * 0.1); ctx.beginPath(); ctx.moveTo(ccx, ccy); ctx.lineTo(ccx + Math.sin(ha) * cr * 0.5, ccy - Math.cos(ha) * cr * 0.5); ctx.stroke();
        ctx.lineWidth = Math.max(1.5, cr * 0.06); ctx.beginPath(); ctx.moveTo(ccx, ccy); ctx.lineTo(ccx + Math.sin(ma) * cr * 0.78, ccy - Math.cos(ma) * cr * 0.78); ctx.stroke();
        const sa = t * Math.PI * 2 / 1.5;                      // frantic second hand
        ctx.strokeStyle = '#d33'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ccx, ccy); ctx.lineTo(ccx + Math.sin(sa) * cr * 0.85, ccy - Math.cos(sa) * cr * 0.85); ctx.stroke();
        // sign
        const sw = Math.min(hw - cr * 2 - 40, 300), sh = Math.min(cr * 1.5, 54), sgx = hx + 6, sgy = ccy - sh / 2;
        if (sw > 120) {
          ctx.fillStyle = '#002e5d'; rr(ctx, sgx, sgy, sw, sh, 6); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = `800 ${Math.min(16, sw * 0.075)}px sans-serif`;
          ctx.fillText('TESTING CENTER', sgx + sw / 2, sgy + sh * 0.33);
          const blink = DUR - t < 8 && Math.floor(t * 3) % 2 === 0;
          ctx.fillStyle = blink ? '#ff6b5e' : '#f5c842'; ctx.font = `700 ${Math.min(13, sw * 0.062)}px sans-serif`;
          ctx.fillText('Closes soon — finish up!', sgx + sw / 2, sgy + sh * 0.7);
        }

        // --- the Scantron sheet ---
        ctx.save(); ctx.translate(sx, sy);
        const pw = Math.min(W - 28, 580), px = (W - pw) / 2;
        const ptop = deskY + 14, pbot = H - (phone ? 92 : 24);
        const ph = pbot - ptop;
        const slideOff = (1 - slide) * 30;
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; rr(ctx, px + 5, ptop + 6, pw, ph, 6); ctx.fill();
        ctx.fillStyle = '#fbf8ec'; rr(ctx, px, ptop, pw, ph, 6); ctx.fill();
        // salmon timing stripes on the left + header band
        ctx.fillStyle = '#e9a39a';
        for (let y = ptop + 14; y < pbot - 10; y += 22) ctx.fillRect(px + 8, y, 12, 6);
        ctx.fillStyle = '#f3d3cc'; ctx.fillRect(px + 28, ptop, pw - 28, Math.min(44, ph * 0.09));
        const hdrH = Math.min(44, ph * 0.09);
        ctx.fillStyle = '#b5443f'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.font = `800 ${Math.min(15, pw * 0.038)}px sans-serif`;
        ctx.fillText('FORM BYU-T/F   ·   USE #2 PENCIL ONLY', px + 36, ptop + hdrH / 2);
        // faint ruled lines
        ctx.strokeStyle = 'rgba(181,68,63,0.14)'; ctx.lineWidth = 1;
        for (let y = ptop + hdrH + 28; y < pbot - 8; y += 28) { ctx.beginPath(); ctx.moveTo(px + 28, y); ctx.lineTo(px + pw - 10, y); ctx.stroke(); }

        // question number + statement
        const q = cur();
        const tfs = Math.max(17, Math.min(30, pw * 0.062, ph * 0.065));
        ctx.font = `700 ${tfs}px Georgia, 'Times New Roman', serif`;
        const textW = pw - 76;
        if (linesFor !== qi || linesW !== textW) { lines = wrap(ctx, q[0], textW); linesFor = qi; linesW = textW; }
        const qnY = ptop + hdrH + Math.max(16, ph * 0.06);
        ctx.globalAlpha = slide;
        ctx.fillStyle = '#b5443f'; ctx.font = `800 ${Math.min(18, tfs * 0.7)}px sans-serif`; ctx.textAlign = 'left';
        ctx.fillText(`${qi + 1}.`, px + 34, qnY + slideOff);
        ctx.fillStyle = '#1e2433'; ctx.font = `700 ${tfs}px Georgia, 'Times New Roman', serif`; ctx.textAlign = 'center';
        const lh = tfs * 1.28, textTop = qnY + tfs * 1.0;
        lines.forEach((ln, i) => ctx.fillText(ln, px + 28 + (pw - 28) / 2, textTop + i * lh + slideOff));
        const textBot = textTop + (lines.length - 0.5) * lh;

        // bubbles
        const bw = Math.min(pw * 0.33, 190), bh = Math.min(bw * 0.62, ph * 0.22);
        const areaTop = textBot + 10;
        const by = Math.max(areaTop + bh * 0.8, Math.min(pbot - bh * 0.9, areaTop + (pbot - areaTop) * 0.5));
        const mid = px + 28 + (pw - 28) / 2, gap = Math.min(pw * 0.27, 150);
        const tx = mid - gap, fx = mid + gap;
        L = { mid, tx, fx, by, bw, bh, tapTop: textTop - tfs, tapBot: pbot + 40 };
        const stT = pick && pick.ans === true ? { fill: scrib } : null;
        const stF = pick && pick.ans === false ? { fill: scrib } : null;
        ctx.translate(0, slideOff);
        drawBubble(ctx, tx, by, bw, bh, 'T', stT);
        drawBubble(ctx, fx, by, bw, bh, 'F', stF);
        ctx.font = `700 ${Math.min(14, bh * 0.22)}px sans-serif`; ctx.fillStyle = '#9a7f78'; ctx.textAlign = 'center';
        ctx.fillText('TRUE', tx, by + bh / 2 + 16); ctx.fillText('FALSE', fx, by + bh / 2 + 16);
        // grading marks
        if (pick && scrib > 0.5) {
          const ax = pick.ans ? tx : fx;
          ctx.lineCap = 'round'; ctx.lineWidth = Math.max(4, bh * 0.09);
          if (pick.ok) {
            ctx.strokeStyle = '#2fb36b';
            ctx.beginPath(); ctx.moveTo(ax + bw * 0.42, by - bh * 0.05); ctx.lineTo(ax + bw * 0.52, by + bh * 0.2); ctx.lineTo(ax + bw * 0.72, by - bh * 0.4); ctx.stroke();
          } else {
            ctx.strokeStyle = '#e8463c';
            const s = bh * 0.32, mx = ax + bw * 0.55, my = by - bh * 0.1;
            ctx.beginPath(); ctx.moveTo(mx - s, my - s); ctx.lineTo(mx + s, my + s); ctx.moveTo(mx + s, my - s); ctx.lineTo(mx - s, my + s); ctx.stroke();
            // circle the right answer
            const cx2 = pick.ans ? fx : tx;
            ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx2, by, bw / 2 + 10, bh / 2 + 10, -0.08, 0, Math.PI * 2); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // hint
        if (t < 3.5 && !done && qi === 0) {
          ctx.globalAlpha = Math.min(1, 3.5 - t);
          ctx.font = `800 ${Math.min(17, W * 0.042)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
          ctx.fillText(phone ? 'Tap T or F' : 'Tap T / F  ·  or ← →  ·  or T / F keys', W / 2, Math.min(H - 20, pbot + (phone ? 30 : 12)));
          ctx.globalAlpha = 1;
        }

        // floaters
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const f of floaters) {
          ctx.globalAlpha = Math.min(1, f.t * 2);
          ctx.font = `900 ${Math.max(18, Math.min(30, W * 0.06)) * f.s}px sans-serif`;
          const fy = f.y - (1 - f.t) * 60;
          ctx.lineWidth = 4; ctx.strokeStyle = '#061a36'; ctx.strokeText(f.text, f.x, fy);
          ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, fy);
        }
        ctx.globalAlpha = 1;

        if (flash > 0) { ctx.fillStyle = flashOk ? `rgba(47,179,107,${flash * 0.12})` : `rgba(232,70,60,${flash * 0.25})`; ctx.fillRect(0, 0, W, H); }
        if (done) {
          ctx.fillStyle = 'rgba(6,26,54,0.55)'; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = '#f5c842'; ctx.font = `900 ${Math.min(48, W * 0.075)}px sans-serif`;
          ctx.fillText('✏️ PENCILS DOWN!', W / 2, H * 0.45);
        }
        ctx.textBaseline = 'alphabetic';
      },
    };
  },
};
