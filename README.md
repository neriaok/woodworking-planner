# Woodworking Planner

Mobile-first 3D sketch planner for woodworking builds: photograph existing parts, turn them into true-scale 3D pieces, then drag, resize, split and assemble them.

מתכנן סקיצות תלת־ממד לעבודות עץ: צילום חלקים קיימים, המרה לתלת־ממד בקנה מידה אמיתי, והרכבה בגרירה.

**Live:** https://woodworking-planner-gamma.vercel.app/ (Vercel, deploys every push to `main`; branches get preview URLs)

## Status
Stages 1–6 are done: 3D editor, photo → part (multi-face, A4 scale), groups and splitting, doors and drawers, autosave with projects/inventory/backup, installable PWA. See [`CLAUDE.md`](./CLAUDE.md) for the full spec, decisions and roadmap.

## Getting started
```bash
npm install
npm run dev -- --host   # open the printed network URL on your phone (same Wi-Fi)
npm run test            # unit tests (geometry, snapping, history)
npm run typecheck
npm run build
```

## Controls
| | Phone | Desktop |
|---|---|---|
| Select | tap | click |
| Move a piece | drag it | drag it |
| Orbit | drag empty space | drag empty space |
| Zoom | pinch | wheel |
| Pan | two fingers | right-drag |
| Resize | “גודל” tool → drag the blue dots | same |

## Stack
React · TypeScript · Vite · three.js / react-three-fiber · Redux Toolkit · CSS Modules
