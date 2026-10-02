# Feature: rpg-soundboard

- **Objective:** Static Next.js soundboard for a Trail of Cthulhu GM, deployed on Vercel.
- **Spec:** `docs/superpowers/specs/2026-10-02-rpg-soundboard-design.md`
- **Plan (task detail, acceptance criteria, checks):** `docs/superpowers/plans/2026-10-02-rpg-soundboard.md`
- **Branch:** `feat/rpg-soundboard`
- **TDD:** on (source: approved spec §9), runner `npm test` (Vitest)
- **Route:** delegated direct per task (writer trigger: every task touches 2+ non-trivial files), executed via subagent-driven development with per-task review.
- **Delivery strategy:** deferred until a remote/PR is requested (no remote exists).

## Tasks

- [ ] T1 Project scaffold
- [ ] T2 Domain types and content integrity
- [ ] T3 Audio engine core
- [ ] T4 Track channels (crossfade)
- [ ] T5 SFX playback + browser engine
- [ ] T6 Audio sourcing pipeline + library content
- [ ] T7 Adventure La última inspección
- [ ] T8 Soundboard UI
- [ ] T9 Library drawer + credits
- [ ] T10 Smoke test + deploy

## Progress / evidence

(commit ids and check results appended per task)

## Next step

T1.
