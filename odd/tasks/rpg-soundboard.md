# Feature: rpg-soundboard

- **Objective:** Static Next.js soundboard for a Trail of Cthulhu GM, deployed on Vercel.
- **Spec:** `docs/superpowers/specs/2026-10-02-rpg-soundboard-design.md`
- **Plan (task detail, acceptance criteria, checks):** `docs/superpowers/plans/2026-10-02-rpg-soundboard.md`
- **Branch:** `feat/rpg-soundboard`
- **TDD:** on (source: approved spec §9), runner `npm test` (Vitest)
- **Route:** delegated direct per task (writer trigger: every task touches 2+ non-trivial files), executed via subagent-driven development with per-task review.
- **Delivery strategy:** deferred until a remote/PR is requested (no remote exists).

## Tasks

- [x] T1 Project scaffold (commits 970ce78, 2910919; review clean)
- [x] T2 Domain types and content integrity (commit 39c5f5f; review clean)
- [x] T3 Audio engine core (commit 3cc54c9; review clean)
- [x] T4 Track channels (crossfade) (commit 802680c; review clean)
- [x] T5 SFX playback + browser engine (commits 9d470eb, 726a5b3; review clean)
- [x] T6 Audio sourcing pipeline + library content (commits 57d2db8..78783b5; review clean after 1 fix round)
- [x] T7 Adventure La última inspección (commit 8f817aa; review clean)
- [x] T8 Soundboard UI (commits 039e6f6, bd22acf, 046fed2; review clean after 1 fix round)
- [x] T9 Library drawer + credits (commit 386fe1b; review clean)
- [ ] T10 Smoke test + README (deploy cancelled: user deploys personally). README 3cea710; browser smoke passed (Chromium preview); real iPad check pending

## Progress / evidence

(commit ids and check results appended per task)

## Next step

Final review fix wave, then real iPad smoke test by the user.
