# Cougar Campus

A phone-first, low-graphics mini-game hub on the BYU campus map, built for a 74th Ward activity.
Walk around campus (tap to walk) and play mini-games at each station; points add up.

**Play:** https://theian-studios.github.io/cougar-campus/

Stations & games: Creamery (Scoop Stack) · Stadium (Field Goal Kick, Tail Run, QB Throw) ·
Rock Canyon (Climb) · Y Mountain (Sled) · Testing Center (Bubble Sheet) · HBLL (Shush) ·
Smith Fieldhouse (Free-Throw Frenzy) · Bean Museum (After Dark) · The Wilk (Scooter Dash).

Campus map and walkway grid come from [Cougar-Man](https://theian-studios.github.io/byu-pacman/).
Map © OpenStreetMap contributors (ODbL). Plain HTML/JS, no build step — open `index.html`.

## Multiplayer
Live positions and the leaderboard use Firebase Realtime Database (project `cougar-campus`, anonymous sign-in).
Projector view: open `index.html#board` on the laptop hooked to the projector.
Reset scores before an event: Firebase console → Realtime Database → Data → delete `players`.
