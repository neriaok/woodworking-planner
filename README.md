# Woodworking Planner

Mobile-first 3D sketch planner for woodworking builds: photograph existing parts, turn them into true-scale 3D pieces, then drag, resize, split and assemble them.

מתכנן סקיצות תלת־ממד לעבודות עץ: צילום חלקים קיימים, המרה לתלת־ממד בקנה מידה אמיתי, והרכבה בגרירה.

## Status
Stage 1 (basic 3D editor) is done. See [`CLAUDE.md`](./CLAUDE.md) for the full spec, decisions and roadmap.

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
