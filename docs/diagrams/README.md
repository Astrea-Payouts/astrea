# Astrea diagrams

Diagrams generated with [Archify](https://github.com/tt-a1i/archify) from the code and `docs/`. Each `.json` is the source; the `.html` is the self-contained viewer generated from it (light/dark theme, zoom, search, PNG/SVG export).

| Diagram | Source | What it shows |
| --- | --- | --- |
| Architecture | `architecture.json` | Web (Next.js) → core-go → Soroban RPC → `EventEscrow`, plus Supabase, Horizon, GitHub OAuth |
| Product flow | `product-workflow.json` | Organizer → participant → judge, plus cancellation and `resolve_dispute` |
| Winner payout | `release-sequence.json` | build → sign → submit for `release_reward`, with `op_log` and `Payout` |
| Event lifecycle | `event-lifecycle.json` | `DRAFT → CREATED → LIVE → JUDGING → COMPLETED`, `DISPUTED`, `CANCELLED` |

To regenerate an HTML file after editing its JSON (from the Archify skill directory):

```bash
node bin/archify.mjs deliver <type> <path>/<name>.json <path>/<name>.html --quality showcase --json
```

`<type>` is `architecture`, `workflow`, `sequence` or `lifecycle`. When a state transition, a core-go endpoint or a contract function changes, update the matching diagram.
