# Tasks

Use this file to track work in progress. Each session should add a plan section.

## Format

```
## [Session Date] — [Task Title]

### Plan
- [ ] Step 1
- [ ] Step 2

### Review
- What worked
- What didn't
- Lessons learned
```

---

## 2026-07-02 — Build the actual app functionality

The screens existed but were shells: dead Gemini endpoint, no transcription,
fake dashboard stats, discarded audit rating, no learner model or persistence.

### Plan
- [x] `src/domain/tokens.ts` — seed vocabulary bank (stage-tagged, with readings + translations) and session topics
- [x] `src/domain/learner.ts` — learner profile: tier progression (3 fast productions → advance, 3+ struggles/session → regress), stage advancement, streak, audit calibration, session token selection (new-vs-familiar ratio)
- [x] `src/domain/prompt.ts` — system prompt builder implementing docs/SYSTEM_PROMPT.md learner-state injection
- [x] Unit tests for the domain layer (node:test, `npm test`) — 18 tests
- [x] `src/store/learnerStore.ts` + `src/utils/storage.ts` — persisted profile, React hook
- [x] Rewrite `src/hooks/useGeminiRealtime.ts` — v1beta BidiGenerateContent endpoint, system instruction, input/output transcription, interruption handling, speech-onset detection → real response-latency telemetry, text turns
- [x] Rewrite `src/hooks/useSession.ts` — per-turn transcript, token attribution, furigana decay, JIT translation (struggle count), session persistence
- [x] `app/session.tsx` — wire live engine states, text input fallback, missing-key guidance
- [x] `app/dashboard.tsx` — real stats from profile (streak, tokens, sessions, stage progress, weak tokens)
- [x] `app/audit.tsx` — real week-over-week summary, persist rating, apply difficulty calibration
- [x] Guest mode so the app is usable without Supabase configured
- [x] Verify: unit tests, typecheck, web build, browser smoke test

### Review
- 18 domain unit tests pass (`npm test`), typecheck clean, web export clean.
- Full E2E against a protocol-faithful mock of the Gemini Live WS API
  (19/19 checks): guest login → dashboard (empty profile) → session
  (calibrated system prompt with active tokens verified server-side) →
  typed production turn → latency measured and attributed to tokens →
  JIT tap increments struggle → session persisted → dashboard stats update
  → weak token surfaces → audit shows week stats and calibrates
  newTokenRatio 0.30 → 0.35.
- Live voice against the real API still needs a human test with
  EXPO_PUBLIC_GEMINI_API_KEY set (mic + audio can't be verified headless).
- Native (iOS/Android) audio capture is web-only for now; typed turns work
  everywhere. Supabase sync of the learner profile not yet implemented
  (local-first storage).
