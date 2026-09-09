<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# The knowledge graph: when to use it, and when it will lie to you

The repo has a graphify knowledge graph indexing code, docs, ADRs and task
definitions together. It is **published**, not committed:
<https://astrea-payouts.github.io/astrea/>. There is no `graphify-out/graph.json`
in a fresh clone — building one locally takes about a minute and costs zero
tokens (structural AST extraction, no LLM).

Three rules, from measuring it on this repo rather than from its description:

**Known identifier → use `grep`/ripgrep, not the graph.** Searching
`release_reward` returned the complete answer in ~2 KB. The same question put
to the graph cost 6.5 KB and 34.5 KB across two phrasings and answered worse.

**A concept with no obvious search string → the graph earns its keep.** Asking
which parts of the system sit on the money path surfaced `CONTRIBUTING.md:79`,
`smart-contracts/README.md:26`, `SECURITY.md` and `docs/architecture.md` as one
cluster, which is several guessed greps otherwise. Expect roughly a third of the
returned nodes to be noise.

**Impact analysis — "what breaks if I change X" — never the graph.** Its edges
are outgoing calls extracted from AST within a file. It does not link the 29
uses of `release_reward` in `src/test.rs` (they go through a generated client
type), nor the 4 in `scripts/run-testnet-proof.sh` (a shell script no AST
parser will connect). Asked what depends on `release_reward` it returned only
what that function *calls*, plus unrelated wallet/session nodes — a confident,
plausible, wrong answer. Use `grep` for this, always.

One more caveat: the graph indexes the docs, so it inherits their staleness. It
still carries a node for "Contracts Task E01: Multi-milestone Escrow Contract",
a design that was never built. Treat it as a map of where things are, never as a
source of truth about what the code does.
