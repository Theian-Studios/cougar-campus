/* Cougar Campus multiplayer (Firebase Realtime Database).
   Exposes window.CC_NET. Loaded as a module; if the Firebase scripts can't load at all (blocked host, e.g. the
   claude.ai preview), CC_NET never appears and the game runs solo with demo wanderers.

   Data: /players/{uid} = { m: memberId, n: name, x, y (grid cells), p: points, s: activity, on: online, t: time }

   Graceful degradation — the game never depends on the network:
   - status.live === true   → seeing other players move, live leaderboard
   - status.live === false  → "live map paused": mini-games and points keep working locally; points are queued
     and catch up automatically. Reasons:
       'connecting'   still signing in / first load
       'connection'   socket down: Wi-Fi drop, or Firebase's free-plan limit (100 phones at once) refusing us
       'slow-network' writes taking seconds → stop sending positions, keep sending scores
       'slow-phone'   the hub saw low frame rates → stop streaming everyone's moves, refresh the board every 20 s */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { getDatabase, ref, get, onValue, onChildAdded, onChildChanged, onChildRemoved, update, remove, onDisconnect, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAR5VVF6zlhXzBz3VgvhNqc1TgKw9hmnB0',
  authDomain: 'cougar-campus.firebaseapp.com',
  databaseURL: 'https://cougar-campus-default-rtdb.firebaseio.com',
  projectId: 'cougar-campus',
  storageBucket: 'cougar-campus.firebasestorage.app',
  messagingSenderId: '517969980455',
  appId: '1:517969980455:web:32059d9b9633c3af34f202',
};
const MAX_STEP = 3000;   // the database rules refuse a score jump bigger than this in one write

const NET = window.CC_NET = {
  ready: false,        // signed in and got the first copy of the player list
  connected: false,    // socket up right now
  uid: null,
  players: {},         // uid -> latest record (everyone, including offline, for the leaderboard)
  status: { live: false, reason: 'connecting' },
  listeners: new Set(),
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  join: async () => 0, send: () => {}, setOnline: () => {}, pauseLive: () => {}, resumeLive: () => {}, leave: async () => {},
};
const emit = () => NET.listeners.forEach(fn => { try { fn(NET.players); } catch (e) { console.error(e); } });
function setStatus(live, reason) {
  if (NET.status.live === live && NET.status.reason === reason) return;
  NET.status = { live, reason };
  window.dispatchEvent(new CustomEvent('cc-net-status', { detail: NET.status }));
}

try {
  if (/[?&]offline\b/.test(location.search)) throw new Error('offline mode (testing)');
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app), db = getDatabase(app);
  const playersRef = ref(db, 'players');
  let joined = null, wrote = false, last = {}, lastSent = 0, pending = null, timer = null;
  let readyResolve; const readyP = new Promise(r => readyResolve = r);
  let subs = [], pollTimer = null, phoneSlow = false, netSlow = false, downSince = performance.now();

  const myRef = () => ref(db, 'players/' + NET.uid);
  const put = snap => { NET.players[snap.key] = snap.val(); emit(); };
  function subscribe() {          // stream every player's changes (one small event per move)
    unsubscribe();
    subs = [onChildAdded(playersRef, put), onChildChanged(playersRef, put),
            onChildRemoved(playersRef, snap => { delete NET.players[snap.key]; emit(); })];
  }
  function unsubscribe() { subs.forEach(off => { try { off(); } catch (e) {} }); subs = []; }
  async function refreshOnce() {
    try { const snap = await get(playersRef); NET.players = snap.val() || {}; emit(); } catch (e) {}
  }
  function updateStatus() {
    if (!NET.ready) return setStatus(false, 'connecting');
    if (!NET.connected) return setStatus(false, 'connection');
    if (phoneSlow) return setStatus(false, 'slow-phone');
    if (netSlow) return setStatus(false, 'slow-network');
    setStatus(true, 'live');
  }

  // timed write: if the database takes seconds to confirm, the network (or Firebase) is struggling
  function write(fields) {
    const t0 = performance.now();
    return update(myRef(), fields).then(() => {
      const ms = performance.now() - t0;
      if (ms > 4000 && !netSlow) { netSlow = true; updateStatus(); }
      else if (ms < 1500 && netSlow) { netSlow = false; updateStatus(); }
    });
  }

  onAuthStateChanged(auth, user => {
    if (!user) return;
    NET.uid = user.uid;
    get(playersRef).then(snap => {
      NET.players = snap.val() || {};
      NET.ready = true; readyResolve();
      if (!phoneSlow) subscribe();
      updateStatus(); window.dispatchEvent(new Event('cc-net-ready')); emit();
    }).catch(err => console.warn('[net] first read failed', err));
    onValue(ref(db, '.info/connected'), snap => {
      NET.connected = !!snap.val();
      if (NET.connected) {
        downSince = 0;
        if (wrote) {   // after any blip: mark ourselves online again and re-arm the "offline on disconnect" hook
          onDisconnect(myRef()).update({ on: false });
          write({ on: !document.hidden, t: serverTimestamp() }).catch(() => {});
        }
        if (NET.ready && phoneSlow) refreshOnce();
      } else downSince = performance.now();
      updateStatus();
    });
  });
  signInAnonymously(auth).catch(err => console.warn('[net] sign-in failed', err));
  // a socket that's been down a few seconds (or never came up) counts as "paused"; Firebase keeps retrying by itself
  setInterval(updateStatus, 2000);

  // claim a player slot as a ward member. Resolves to the points to start from. Points earned while offline
  // (localPoints) are pushed up in steps the database rules accept.
  NET.join = async (member, localPoints = 0) => {
    joined = { member };
    await readyP;
    const ex = NET.players[NET.uid];
    const server = ex && ex.m === member.id ? (ex.p || 0) : 0;
    const target = Math.max(server, Math.round(localPoints || 0));
    last = { m: member.id, n: member.name, x: 0, y: 0, p: Math.min(target, (ex ? ex.p || 0 : 0) + MAX_STEP), s: '', on: true, t: serverTimestamp() };
    try {
      await write(last); wrote = true; onDisconnect(myRef()).update({ on: false });
      while (last.p < target) { last.p = Math.min(target, last.p + MAX_STEP); await write({ p: last.p, t: serverTimestamp() }); }
    } catch (e) { console.warn('[net] join failed', e); }
    return target;
  };

  // phone locked / app switched: show as offline right away instead of waiting for the socket to time out
  NET.setOnline = on => {
    if (!NET.uid || !wrote) return;
    last.on = on;
    write({ on, t: serverTimestamp() }).catch(() => {});
  };

  // throttled updates (≤ 4 per second, only what changed). While the network is slow, positions are dropped
  // and only score/activity go out. Writes made while disconnected are queued by Firebase and sent on reconnect.
  NET.send = fields => {
    if (!NET.uid || !joined || !wrote) return;
    pending = Object.assign(pending || {}, fields);
    const flush = () => {
      timer = null; if (!pending) return;
      const diff = {};
      for (const k in pending) if (pending[k] !== last[k]) diff[k] = pending[k];
      pending = null;
      if (netSlow || !NET.connected) { delete diff.x; delete diff.y; }
      if (!Object.keys(diff).length) return;
      if (diff.p != null && diff.p > (last.p || 0) + MAX_STEP) diff.p = (last.p || 0) + MAX_STEP;   // catch up next time
      Object.assign(last, diff);
      diff.on = !document.hidden; diff.t = serverTimestamp(); lastSent = performance.now();
      write(diff).catch(e => console.warn('[net] update failed', e));
    };
    const wait = 250 - (performance.now() - lastSent);
    if (wait <= 0) flush(); else if (!timer) timer = setTimeout(flush, wait);
  };

  // the hub calls these when the phone itself can't keep up (or the player taps "try again")
  NET.pauseLive = reason => {
    if (reason !== 'slow-phone' || phoneSlow) return;
    phoneSlow = true; unsubscribe();
    clearInterval(pollTimer); pollTimer = setInterval(refreshOnce, 20000);
    updateStatus();
  };
  NET.resumeLive = () => {
    phoneSlow = false; netSlow = false;
    clearInterval(pollTimer); pollTimer = null;
    if (NET.ready) { refreshOnce().then(() => { if (!phoneSlow) subscribe(); }); }
    updateStatus();
  };

  // remove this phone's own entry (used by automated tests to clean up after themselves)
  NET.leave = async () => {
    if (!NET.uid) return;
    await onDisconnect(myRef()).cancel(); await remove(myRef()); wrote = false; joined = null;
  };
} catch (e) {
  console.warn('[net] multiplayer unavailable', e);
  NET.status = { live: false, reason: 'unavailable' };
}
