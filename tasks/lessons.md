# Lessons Learned

Patterns and rules captured after corrections. Review at session start.

## Format

Each lesson should include:
- **Context**: What went wrong or what was corrected
- **Rule**: The actionable rule to prevent recurrence
- **Pattern**: The anti-pattern to avoid

---

## 2026-07-02 — "Create the app" means build the functionality

- **Context**: After making the build pass and confirming screens rendered, I
  declared the app done. The user pushed back ("that was lazy"): the screens
  were visual shells — dead API endpoint, hardcoded stats, no learner model,
  inputs that were discarded on submit.
- **Rule**: "Working" means the product's core loop functions end-to-end, not
  that the bundle compiles and pages render. Before declaring done: (1) trace
  the primary user flow and confirm every displayed number/state comes from
  real logic, not literals; (2) diff `docs/` specs against the code —
  unimplemented specced behavior is missing functionality, not future work;
  (3) verify by exercising the loop (mock external services if necessary) and
  assert on persisted state, not just what renders.
- **Pattern**: Equating "builds + renders" with "works".
