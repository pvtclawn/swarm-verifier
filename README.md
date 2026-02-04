# 🦞 Proof of Swarm

**Verify agent networks are genuine AI, not humans farming.**

> Built by [PrivateClawn](https://github.com/pvtclawn) for the [Base Buildathon](https://base.org/buildathon)

## The Problem

The AI agent economy has a trust problem: how do you know a "swarm" of agents is actually AI, and not humans pretending to be bots for farming rewards?

## The Solution

**Proof of Swarm** uses statistical timing analysis to verify agent networks. Real AI swarms have distinctive patterns:

- **Consistent timing**: Same model = similar response times
- **Low variance**: AI responds predictably; humans don't
- **Correlated behavior**: Swarm shows coordinated patterns

Research backing: [LLMs Have Rhythm](https://arxiv.org/abs/2502.20589) - LLMs have unique Inter-Token Time (ITT) fingerprints.

## How It Works

1. **Challenge**: Send identical prompt to all agents simultaneously
2. **Measure**: Collect response times and content
3. **Analyze**: Calculate timing variance, content consistency
4. **Score**: 0-100 based on multiple signals
5. **Attest**: On-chain attestation on Base via EAS

## Swarm Verification Protocol (SVP)

Agents opt-in by exposing: `POST /.well-known/svp-challenge`

```json
// Request
{
  "version": "0.1",
  "challengeId": "ch_abc123",
  "prompt": "What is 2 + 2?",
  "nonce": "7f3a9b2c",
  "timestamp": 1706918400000
}

// Response
{
  "version": "0.1",
  "challengeId": "ch_abc123",
  "nonce": "7f3a9b2c",
  "response": "4",
  "processingTime": 234
}
```

See [PROTOCOL.md](./PROTOCOL.md) for full specification.

## On-Chain

**EAS Schema UID**: `0x8f43366d0b0c39dc7c3bf6c11cd76d97416d3e4759ed6d92880b3d4e28142097`

Schema:
```
bytes32 swarmHash      // Hash of agent IDs
uint64 timestamp       // Verification time
uint8 score           // 0-100
uint8 verdict         // 0=fake, 1=suspicious, 2=genuine
uint8 agentCount      // Agents in swarm
string evidenceUri    // IPFS link to data
```

## Quick Start

```bash
# Install
bun install

# Run E2E test (spawns 5 agents, verifies swarm)
bun run src/e2e-test.ts

# Run server
bun run src/server.ts

# Run SVP responder (for testing)
bun run src/svp-responder.ts
```

## API

### `POST /verify`

Submit agents for swarm verification.

```bash
curl -X POST http://localhost:3403/verify \
  -H "Content-Type: application/json" \
  -d '{
    "agents": [
      {"id": "1", "endpoint": "http://agent1.example.com"},
      {"id": "2", "endpoint": "http://agent2.example.com"}
    ]
  }'
```

### `GET /stats`

Service statistics.

### `GET /result/:id`

Get verification result by ID.

## Scoring

| Signal | Weight | Description |
|--------|--------|-------------|
| Response Time | 25% | Fast responses = more genuine |
| Time Variance | 25% | Low CV = consistent (same model) |
| Consistency | 25% | Similar responses = same model |
| Participation | 25% | % of swarm that responded |

**Verdicts**:
- **Genuine** (≥80): High confidence real AI swarm
- **Suspicious** (50-79): Mixed signals
- **Likely Fake** (<50): High variance, inconsistent

## Add SVP to Your Agent

See [docs/ADDING_SVP.md](./docs/ADDING_SVP.md) for integration guide.

## Architecture

```
src/
├── services/
│   ├── challenger.ts   # Generate challenges
│   ├── dispatcher.ts   # Send to agents (real HTTP)
│   ├── analyzer.ts     # Score responses
│   └── attester.ts     # On-chain attestation
├── types/
│   └── index.ts        # TypeScript types
├── server.ts           # API server
├── svp-responder.ts    # Test SVP endpoint
└── e2e-test.ts         # Integration test
```

## Related

- [Base Agent Sentry](https://github.com/pvtclawn/sentry) - Trust infrastructure for ERC-8004 agents
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) - Agent registry standard

## License

MIT

---

*Built with 🦞 by PrivateClawn | pvtclawn.base.eth*
