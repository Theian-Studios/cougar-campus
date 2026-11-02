/* Mini-game registry.
   Each game: { name, icon, blurb, howTo, create(api) -> { update(dt), draw(ctx, W, H), tap(x, y), release?() } }
   api.finish(score) ends the round. Coordinates are CSS pixels of the mini-game canvas.
   Each real game lives in games/<id>.js and replaces its placeholder below. */
window.MINIGAMES = {};

/* roundRect polyfill (iOS Safari < 16 doesn't have it, and the hub + several games use it) */
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    let rr = Array.isArray(r) ? (r[0] || 0) : (+r || 0);
    if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
    rr = Math.max(0, Math.min(rr, w / 2, h / 2));
    this.moveTo(x + rr, y); this.arcTo(x + w, y, x + w, y + h, rr); this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr); this.arcTo(x, y, x + w, y, rr); this.closePath();
    return this;
  };
}

/* Cougar Tail = a long maple bar. Shared icon (HTML) + canvas drawing helper. */
window.MAPLE_BAR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
  + '<g transform="rotate(-35 32 32)">'
  + '<rect x="4" y="22" width="56" height="20" rx="10" fill="#d99a4e" stroke="#8a5a22" stroke-width="2"/>'
  + '<path d="M8 27 Q8 23 14 23 H50 Q56 23 56 27 V31 Q53 34 50 31 Q47 35 43 31 Q39 34 35 31 Q31 35 27 31 Q23 34 19 31 Q15 35 11 31 Q8 33 8 30 Z" fill="#a8621f"/>'
  + '<path d="M14 26 H46" stroke="#d98f3f" stroke-width="2" stroke-linecap="round" opacity=".8"/>'
  + '</g></svg>';
window.MAPLE_BAR_ICON = '<img alt="Cougar Tail" style="width:1.15em;height:1.15em;vertical-align:-0.2em" src="data:image/svg+xml,'
  + encodeURIComponent(window.MAPLE_BAR_SVG) + '">';
window.drawMapleBar = function (ctx, x, y, len, angle = -0.6) {
  const h = len * 0.34, r = h / 2;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = '#d99a4e'; ctx.strokeStyle = '#8a5a22'; ctx.lineWidth = Math.max(1, len * 0.04);
  ctx.beginPath(); ctx.roundRect(-len / 2, -r, len, h, r); ctx.fill(); ctx.stroke();
  // maple glaze with drips
  ctx.fillStyle = '#a8621f'; ctx.beginPath();
  ctx.moveTo(-len / 2 + r * 0.6, -r * 0.55);
  ctx.quadraticCurveTo(-len / 2 + r * 0.6, -r * 0.85, -len / 2 + r * 1.2, -r * 0.85);
  ctx.lineTo(len / 2 - r * 1.2, -r * 0.85);
  ctx.quadraticCurveTo(len / 2 - r * 0.6, -r * 0.85, len / 2 - r * 0.6, -r * 0.55);
  const n = 6;
  for (let i = 0; i <= n; i++) { const px = len / 2 - r * 0.6 - i * (len - r * 1.2) / n; ctx.lineTo(px, i % 2 ? r * 0.25 : r * 0.05); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,140,.7)'; ctx.lineWidth = Math.max(1, len * 0.035); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-len / 2 + r * 1.3, -r * 0.5); ctx.lineTo(len * 0.15, -r * 0.5); ctx.stroke();
  ctx.restore();
};

/* Placeholders for games not built yet (shown as "coming soon" at their station). */
for (const [id, name, icon, blurb] of [
  ['scoop', 'Creamery Scoop Stack', '🍦', 'Catch & stack scoops'],
  ['fieldgoal', 'Field Goal Kick', '🏈', 'Swipe kicks through the wind'],
  ['tailrun', 'Tail Run', window.MAPLE_BAR_ICON, 'Carry a Cougar Tail past defenders'],
  ['sled', 'Y Mountain Sled', '🛷', 'Dodge rocks on the way down'],
  ['scooter', 'Scooter Dash', '🛴', 'Pac-Man on a scooter'],
  ['qb', 'QB Throw', '🎯', 'Lead receivers with passes'],
  ['freethrow', 'Free-Throw Frenzy', '🏀', 'Flick shots, moving hoop'],
  ['climb', 'Rock Canyon Climb', '🧗', 'Tap holds to climb'],
  ['shush', 'HBLL Shush', '🤫', 'Shush the loud ones'],
  ['bean', 'Bean Museum After Dark', '🦁', 'Remember who moved'],
  ['bubble', 'Bubble Sheet', '📝', 'Rapid BYU true/false'],
]) window.MINIGAMES[id] = { name, icon, blurb, comingSoon: true };
