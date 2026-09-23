# Agent Arena — Pong / Tennis extraction

Reconstructed from beautified production SPA `/tmp/arena.pretty.js` (~25k lines) and CSS `/tmp/arena.css`.

## Files written

| Path | Source (minified name) | Role |
|------|------------------------|------|
| `src/games/pong.js` | class `Rx` | Canvas 2D paddle vs bot |
| `src/games/tennis.js` | class `Ll` | Three.js tennis + scoring |
| `src/shared/audio.js` | class `Zv` + `St()` | Mute/unlock Web Audio singleton |
| `src/shared/meshy.js` | `Wi`/`Nx`/`Sh`/`Lx`/`Ix`/`Dx`/`Vi`/`ca` | GLB fallback loader + model wraps |

## Controls preserved

**Pong**
- Keyboard: `A`/`D`, `ArrowLeft`/`ArrowRight`
- Pointer: drag/move on canvas sets paddle X
- Bot tracks ball at lower speed; score resets ball with serve pause

**Tennis**
- Move: WASD / arrows + optional HUD stick (`bindControls`)
- Swing/serve: Space charge-release; canvas pointer charge + aim; HUD swing button
- Bot auto-serves and swings when ball is near
- Full game/set/tiebreak scoring from production

## Meshy paths

Fallback lists under `/models/tennis/...`:

- racket: `tennis-racket.glb`
- ball: `tennis-ball.glb`
- net: `tennis-net-wide.glb` → `tennis-net.glb`
- chair: `tennis-court-props.glb`
- player: `tennis-player.glb` → `tennis-player-you.glb`
- opponent: `tennis-opponent.glb` → `tennis-player-bot.glb` → `tennis-player.glb`

Procedural placeholders (court lines, stick-figure players, torus racket, sphere ball) are used when a slot fails to load.

## Incomplete / not extracted

1. **App shell / HUD wiring** — production mounts `#pong-root` / `#tennis-root`, updates `#pong-hud` / `#tennis-hud`, mute button, and game picker. Not included; games expect an `onHud` callback and a parent element.
2. **CSS** — styles remain in `/tmp/arena.css` (`.pong-*`, `.tennis-*`, `.mute-btn`). Not copied into this tree.
3. **Flyer / Raid** — intentionally untouched. Note: Flyer also uses `loadFirstGlb`-style loading (`Ar`/`Xv`) and the same `getAudio()` mute API (`St`/`Zv`). Tennis does not call audio SFX in production.
4. **Three.js bundling** — modules assume `three` and `three/examples/jsm/loaders/GLTFLoader.js` are available via your bundler or import map.
5. **normalMap colorSpace** — production used an internal constant (`Cn`); reconstructed as `THREE.NoColorSpace` in the rich loader helper only (Flyer-style). Tennis uses the simpler loader without normalMap handling.
6. **Visual fidelity** — court wall colors, procedural player proportions, and lighting match production numbers; Meshy mesh materials depend on the GLBs at `/models/tennis/...`.
7. **Pointer cleanup on Pong** — production `dispose()` removes key/resize listeners and the canvas but does not explicitly remove canvas pointer listeners (same as original).

## Suggested usage

```js
import { PongGame } from './src/games/pong.js';
import { TennisGame } from './src/games/tennis.js';
import { getAudio } from './src/shared/audio.js';

getAudio(); // restore mute from localStorage + unlock on gesture

const pong = new PongGame(document.getElementById('pong-root'), (hud) => {
  /* update score DOM */
});

const tennis = await TennisGame.create(document.getElementById('tennis-root'), (hud) => {
  /* update score / power meter */
});
tennis.bindControls(document.getElementById('tennis-hud'));
```
