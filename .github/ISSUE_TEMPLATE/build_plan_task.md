---
name: Build plan task
about: Pick up (or propose) a task from docs/build-plan.md or docs/contracts-build-plan.md
title: "[CODE] Short task title"
labels: []
---

### CODE — Short task title

| Field | Value |
|-------|-------|
| **Code** | e.g. E02, U01, S07 |
| **Phase** | e.g. Phase 2 — escrow core |
| **Size** | S / M / L |
| **Depends on** | other issue numbers/codes, or — |
| **Money path** | Yes/No — Yes needs the `security` label and extra review |
| **Screenshot required** | Yes/No — Yes for any `phase: product-ui` task; the PR isn't mergeable without one (see PR template) |

**Executive summary**
2-4 sentences: what this delivers, why it matters, what breaks or stalls without it.

**Product context**
How this fits into the surrounding system — which doc (build-plan.md / contracts-build-plan.md / architecture.md) it comes from, what it unblocks.

**User stories**
- As a `<role>`, I want `<capability>` so that `<benefit>`.

**Prerequisites**
- What must already exist/be merged before this is pickable.

**Scope — In**
- Concrete, bulleted.

**Scope — Out**
- Explicitly what this issue does *not* cover, so a reviewer isn't surprised by what's missing.

**Architecture & conventions**
Relevant ADR(s) from docs/architecture.md, and any pattern this should follow.

**Files to create/modify**
- `path/to/file.ts`

**Implementation guide**
1. Step-by-step, numbered.

**Acceptance criteria**
- [ ] Concrete, verifiable statements — not "works well," but "X returns Y when Z."

**Test plan**
- **Unit:** what's covered by automated tests.
- **Manual:** what a human verifies by hand (e.g. a real testnet transaction). For UI tasks, include a screenshot of the rendered result — attach it to the PR (see PR template), not just described in words.

**Risks & pitfalls**
- Known sharp edges, past mistakes in this area, non-obvious failure modes.

**Definition of done**
- [ ] The handful of things that must all be true for this to be mergeable.

---

**Source:** [docs/build-plan.md](../../docs/build-plan.md) or [docs/contracts-build-plan.md](../../docs/contracts-build-plan.md)
