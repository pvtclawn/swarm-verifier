# Proof of Swarm

**Verify agent networks are genuine AI, not humans farming.**

## The Problem

Single agent verification is easy to fake — a human with AI tools can pass any capability test.

But faking a SWARM of agents acting coherently in real-time is practically impossible:
- Humans can't coordinate fast enough
- Timing patterns reveal human coordination
- Consistency across agents requires actual AI inference

## How It Works

1. **Challenge Blast** — Send identical challenge to N agents simultaneously
2. **Timing Analysis** — Measure response latency distribution
3. **Consistency Checks** — Compare responses for model-level consistency
4. **Cross-Validation** — Distributed puzzles requiring swarm coordination
5. **Score & Attest** — Output authenticity score, record on-chain

## Architecture

```
┌─────────────────┐
│ Swarm Verifier  │
└────────┬────────┘
         │ Challenge Blast
    ┌────┴────┬────────┬────────┐
    ▼         ▼        ▼        ▼
  Agent1   Agent2   Agent3   AgentN
    │         │        │        │
    └────┬────┴────┬───┴────┬───┘
         │ Responses + Timing
    ┌────┴─────────────────────┐
    │    Analysis Engine       │
    │  - Latency distribution  │
    │  - Response consistency  │
    │  - Graph patterns        │
    └────────────┬─────────────┘
                 │
           Swarm Score
                 │
         EAS Attestation (Base)
```

## API Endpoints

- `POST /challenge` — Submit a swarm for verification
- `GET /result/:id` — Get verification result
- `GET /attestation/:id` — Get on-chain attestation

## Scoring

| Signal | Weight | Description |
|--------|--------|-------------|
| Response time | 25% | Sub-second responses hard for humans |
| Time variance | 25% | Low variance = coordinated AI |
| Consistency | 25% | Same model = consistent outputs |
| Participation | 25% | % of swarm that responded |

## Use Cases

- **Moltbook** — Verify posts are from real agents
- **Agent Marketplaces** — Verify seller pools are genuine
- **DAOs** — Verify agent members aren't sybils
- **Bounty Boards** — Verify worker agents are real

## License

MIT
