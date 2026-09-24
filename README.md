# Agent Arena

Phone-first bot playground: **Grid Defense** (Flyer), **Pong**, and **3D Tennis**.

**Live:** https://www.agentarena.tech

## Games

| Game | Route (hub card) | Notes |
|------|------------------|-------|
| Grid Defense | Flyer | US map → region setup → defend cyan-lit campuses |
| Pong | Pong | Canvas 2D paddle vs bot |
| Tennis | Tennis | Three.js + Meshy court props |

## How to play Grid Defense

1. Open hub → **Grid Defense**
2. Drag the dotted US map; tap a glowing region
3. Pick Scout / Fighter (3 secured) / Striker (6 secured)
4. **Launch defense**
5. Desktop: `WASD` fly · `Space` guns · `E` missile · `Q` flares · `Esc` pause  
   Phone: on-screen stick + Fire / Missile / Flare

Progress saves in `localStorage` (`agent-arena-grid-defense-v1`).

## Dev

```bash
npm install
npm run dev
```

```bash
npm run build && npm run preview
```

## Stack

- Vite + Three.js
- Meshy GLBs under `public/models/` (planes, datacenters, watchtowers, tennis)

## Deploy

Static Vite build on Vercel (`npm run build` → `dist/`).
