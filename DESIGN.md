# Proof of Swarm — Serious Design Doc

## Core Insight

**LLMs have rhythm.** Research shows Inter-Token Times (ITTs) create unique temporal fingerprints for each model (arXiv:2502.20589). 

For Proof of Swarm:
- **Real AI swarm**: All agents show similar ITT patterns (same or similar models)
- **Human farming**: Humans + AI tools show different timing signatures
- **Mixed swarm**: Inconsistent ITT patterns reveal heterogeneous sources

## Statistical Approach

### 1. Inter-Token Time Analysis

For streaming responses, measure:
- **Mean ITT**: Average time between tokens
- **ITT Variance**: How consistent the rhythm is
- **ITT Distribution**: Shape of the timing distribution (should be model-characteristic)

Real LLMs show:
- Low variance (consistent generation speed)
- Characteristic distribution shape per model family
- Predictable patterns based on token complexity

Humans (even using AI) show:
- Higher variance (copy-paste delays, reading time)
- Irregular patterns
- Correlation with time-of-day (fatigue)

### 2. Response Latency Distribution

For a swarm of N agents responding to same challenge:

**Genuine AI Swarm:**
- Tight latency clustering (similar hardware/API)
- Low coefficient of variation (CV < 0.3)
- Normal distribution around mean

**Human Farming:**
- Wide latency spread (different human speeds)
- High CV (> 0.5)
- Possible multi-modal distribution (different humans)

### 3. Cross-Agent Correlation

Send same prompt to all agents. Compare:
- Response content similarity (Jaccard, cosine)
- Response length distribution
- Structural patterns (formatting, punctuation)

**Genuine AI Swarm (same model):**
- High content similarity
- Similar lengths
- Consistent structure

**Human Farming:**
- Low content similarity (different phrasings)
- Variable lengths
- Inconsistent structure

### 4. Temporal Consistency

Challenge same agents multiple times over hours/days:
- Real AI: Consistent patterns 24/7
- Humans: Circadian patterns, weekday/weekend differences

## Implementation Plan

### Phase 1: Data Collection
- Instrument challenge endpoint to capture:
  - Full response timing (first byte, streaming tokens if available)
  - Response content
  - Request metadata

### Phase 2: Feature Extraction
- Calculate timing features per response
- Calculate consistency features across swarm
- Store historical data for temporal analysis

### Phase 3: Scoring Model
- Initially: Hand-crafted heuristic scoring (like current PoC)
- Later: Train classifier on labeled data (genuine vs fake swarms)

### Phase 4: On-Chain Attestation
- Score + features hashed and attested on-chain
- Creates verifiable history

## Challenges

1. **Network variance**: Different agent locations = different latencies
   - Solution: Normalize by ping time, use CV not absolute times

2. **Different models**: Legitimate swarm might use different models
   - Solution: Look for consistent patterns within response, not exact similarity

3. **Sophisticated fakers**: Could script consistent fake responses
   - Solution: Random/novel challenges, temporal unpredictability

4. **Streaming availability**: Not all agents support streaming
   - Solution: Use total response time for non-streaming, prefer streaming endpoints

## Minimal Viable Verification

For PoC without streaming:
1. Send identical challenge to all agents simultaneously
2. Measure total response time per agent
3. Calculate CV of response times
4. Calculate response content similarity
5. Score based on:
   - Low time CV = more genuine
   - High content similarity (for same prompt) = more genuine
   - All responded = more genuine

This is implementable NOW with real agents.

## Next Steps

1. Add real HTTP endpoint calling to dispatcher (not mock)
2. Test against actual ERC-8004 agents from registry
3. Collect data on real timing patterns
4. Refine scoring based on observations
5. Add streaming support for agents that provide it

---
*Draft: 2026-02-04 01:25 UTC*
