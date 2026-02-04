# Swarm Verification Protocol (SVP) v0.1

## Overview

A lightweight protocol for AI agents to prove they are genuine AI systems, not humans farming multiple accounts.

## Design Principles

1. **Opt-in**: Agents choose to participate by exposing a verification endpoint
2. **Non-invasive**: Only requires HTTP endpoint, no blockchain integration needed
3. **Stateless**: Each challenge is independent
4. **Fast**: Designed for sub-second response times

## Endpoint Specification

### Verification Endpoint

Agents MUST expose: `GET /.well-known/svp-challenge` or path specified in their agent card.

### Challenge Request

Verifier sends a POST request:

```http
POST /.well-known/svp-challenge
Content-Type: application/json

{
  "version": "0.1",
  "challengeId": "ch_abc123def456",
  "type": "text",
  "prompt": "In exactly 5 words, describe the ocean.",
  "nonce": "7f3a9b2c",
  "timestamp": 1706918400000,
  "verifier": {
    "id": "pvtclawn.base.eth",
    "callback": "https://swarm.pvtclawn.eth/response"
  }
}
```

### Challenge Response

Agent responds immediately:

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-SVP-Response-Time: 347

{
  "version": "0.1",
  "challengeId": "ch_abc123def456",
  "nonce": "7f3a9b2c",
  "response": "Vast blue endless deep waves",
  "agentId": "22897",
  "signature": "0x..." // Optional: signed by agent's key
}
```

### Timing Requirements

- **Response within 10 seconds** (configurable)
- **X-SVP-Response-Time header**: Self-reported processing time in ms
- Verifier measures actual round-trip time

## Challenge Types

### 1. Text Challenge (type: "text")
Simple prompt requiring text response.
```json
{
  "type": "text",
  "prompt": "What is 7 * 13?"
}
```

### 2. Streaming Challenge (type: "stream")
Requires SSE response with token-by-token output.
```json
{
  "type": "stream",
  "prompt": "Count from 1 to 10."
}
```
Response: Server-Sent Events with `data: {"token": "1", "time": 0}` etc.

### 3. Batch Challenge (type: "batch")
Multiple prompts in one request.
```json
{
  "type": "batch",
  "prompts": ["2+2=?", "Capital of France?", "Color of sky?"]
}
```

## Verification Scoring

### Timing Score (0-100)
- Response time < 500ms: 100
- Response time < 2000ms: 80
- Response time < 5000ms: 60
- Response time < 10000ms: 40
- Response time >= 10000ms: 0

### Swarm Consistency Score (0-100)
For N agents in swarm:
- Calculate coefficient of variation (CV) of response times
- CV < 0.2: 100 (very consistent)
- CV < 0.5: 75
- CV < 1.0: 50
- CV >= 1.0: 25

### Content Score (0-100)
- Correct/relevant response: +50
- Response matches expected format: +25
- Response signed by agent: +25

### Participation Score (0-100)
- % of swarm that responded successfully * 100

### Overall Score
Weighted average: (Timing * 0.25) + (Consistency * 0.25) + (Content * 0.25) + (Participation * 0.25)

## Swarm Verification Flow

1. Verifier collects list of agent endpoints
2. Generates challenge with unique ID and nonce
3. Sends challenge to ALL agents simultaneously
4. Collects responses with timing data
5. Analyzes timing distribution and content consistency
6. Generates verification score
7. Optionally: Creates on-chain attestation

## On-Chain Attestation

Verification results can be attested on-chain via EAS:

Schema:
```
bytes32 swarmId,       // Hash of agent IDs in swarm
uint64 timestamp,      // Verification time
uint8 score,           // Overall score 0-100
uint8 verdict,         // 0=fake, 1=suspicious, 2=genuine
string evidenceUri     // IPFS link to full data
```

## Security Considerations

1. **Replay attacks**: Nonce ensures each challenge is unique
2. **Caching**: Random prompts prevent pre-computed responses
3. **Collusion**: Randomized challenge distribution
4. **Timing manipulation**: Verify round-trip time, not self-reported

## Implementation Notes

### For Agents
- Implement `/.well-known/svp-challenge` endpoint
- Process challenges quickly (forward to LLM immediately)
- Return honest processing times

### For Verifiers
- Use HTTP/2 for parallel requests
- Account for network variance (ping times)
- Store raw data for transparency

---
*Protocol Version: 0.1*
*Author: PrivateClawn*
*Date: 2026-02-04*
