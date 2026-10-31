/* Cougar Campus multiplayer (Firebase Realtime Database).
   Exposes window.CC_NET. Loaded as a module; if it can't connect (offline, blocked host), the game
   simply keeps working solo with demo wanderers.

   Data: /players/{uid} = { m: memberId, n: name, x, y (grid cells), p: points, s: activity, on: online, t: time } */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { getDatabase, ref, onValue, update, onDisconnect, serverTimestamp }
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

const NET = window.CC_NET = {
  ready: false,        // signed in and connected
  uid: null,
  players: {},         // uid -> latest record (everyone, including offline, for the leaderboard)
  listeners: new Set(),
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  join: () => {}, send: () => {},
};
const emit = () => NET.listeners.forEach(fn => { try { fn(NET.players); } catch (e) { console.error(e); } });

try {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app), db = getDatabase(app);
  let joined = null, wrote = false, last = {}, lastSent = 0, pending = null, timer = null;
  let readyResolve; const readyP = new Promise(r => readyResolve = r);

  onAuthStateChanged(auth, user => {
    if (!user) return;
    NET.uid = user.uid;
    onValue(ref(db, 'players'), snap => {
      NET.players = snap.val() || {};
      if (!NET.ready) { NET.ready = true; readyResolve(); window.dispatchEvent(new Event('cc-net-ready')); }
      emit();
    }, err => { console.warn('[net] read failed', err); });
  });
  signInAnonymously(auth).catch(err => console.warn('[net] sign-in failed', err));

  // claim a player slot as a ward member. Resolves to the points to start from: a phone that already played
  // as the same member (same anonymous uid) keeps its score after a reload.
  NET.join = async member => {
    joined = { member };
    await readyP;
    const me = ref(db, 'players/' + NET.uid), ex = NET.players[NET.uid];
    const start = ex && ex.m === member.id ? (ex.p || 0) : 0;
    last = { m: member.id, n: member.name, x: 0, y: 0, p: start, s: '', on: true, t: serverTimestamp() };
    await update(me, last).catch(e => console.warn('[net] join failed', e));
    onDisconnect(me).update({ on: false });
    wrote = true;
    return start;
  };

  // throttled position/score/activity updates (max ~5 per second, only when something changed)
  NET.send = fields => {
    if (!NET.uid || !joined || !wrote) return;
    pending = Object.assign(pending || {}, fields);
    const flush = () => {
      timer = null; if (!pending) return;
      const diff = {};
      for (const k in pending) if (pending[k] !== last[k]) diff[k] = pending[k];
      pending = null;
      if (!Object.keys(diff).length) return;
      Object.assign(last, diff);
      diff.on = true; diff.t = serverTimestamp(); lastSent = performance.now();
      update(ref(db, 'players/' + NET.uid), diff).catch(e => console.warn('[net] update failed', e));
    };
    const wait = 200 - (performance.now() - lastSent);
    if (wait <= 0) flush(); else if (!timer) timer = setTimeout(flush, wait);
  };
} catch (e) {
  console.warn('[net] multiplayer unavailable', e);
}
