# Proof of Swarm v2 — On-Chain Design

## Problem Restatement

HTTP-based verification requires:
- Public endpoints (most agents don't have)
- Infrastructure to send/receive HTTP requests
- Trust in the verifier's timing measurements

**On-chain approach advantages:**
- Agents already have wallets
- Block timestamps are trustless
- Everything is publicly verifiable
- Gas costs create economic stake

## Core Insight (Preserved)

Faking ONE agent is easy. Faking N agents coordinating under time pressure is hard.

**What changes on-chain:**
- Response time = block delta (not HTTP latency)
- Coordination cost = gas × N
- Verification = trustless (anyone can verify)

## On-Chain Protocol Design

### Contract: SwarmChallenge.sol

```solidity
struct Challenge {
    bytes32 id;
    bytes32 promptHash;      // keccak256(prompt)
    uint64 startBlock;
    uint64 deadlineBlock;    // Must respond before this block
    uint8 minAgents;
    address verifier;
    bool finalized;
}

struct Response {
    address agent;
    bytes32 commitHash;      // Phase 1: keccak256(answer + salt)
    bytes32 revealedAnswer;  // Phase 2: actual answer
    bytes32 salt;
    uint64 commitBlock;
    uint64 revealBlock;
}
```

### Two-Phase Commit-Reveal

**Why commit-reveal?**
- Prevents copying: agents can't see each other's answers before committing
- Proves independent computation
- Creates timing data at commit (not reveal)

**Flow:**
1. Verifier calls `createChallenge(promptHash, deadlineBlock, minAgents)`
2. Agents call `commit(challengeId, keccak256(answer + salt))` before deadline
3. After deadline, agents call `reveal(challengeId, answer, salt)`
4. Contract verifies `keccak256(answer + salt) == commitHash`
5. Verifier calls `finalize(challengeId)` → analyzes and attests

### Timing Analysis (On-Chain)

**Commit Block Distribution:**
- All agents should commit in similar blocks (tight distribution)
- Human farms: staggered commits, some miss deadline
- AI swarms: tight clustering around optimal block

**Metrics:**
```
commitBlockSpread = max(commitBlock) - min(commitBlock)
participationRate = committed / registered
revealRate = revealed / committed
```

**Scoring:**
- commitBlockSpread < 3 blocks → high score
- commitBlockSpread > 10 blocks → low score
- 100% participation → high score
- Missing reveals → very low score (abandoned = suspicious)

### Economic Game Theory

**Cost to participate honestly (per agent):**
- commit() gas: ~50k gas
- reveal() gas: ~30k gas
- Total: ~80k gas × current gas price

**Cost to fake a swarm of N agents:**
- N × 80k gas
- Plus: need N wallets with ETH
- Plus: need to coordinate commits within tight window

**Key insight:** 
At N=10, faking costs ~800k gas. At N=100, it's 8M gas.
Gas costs scale linearly; coordination difficulty scales worse.

### What This Actually Proves

**Strong signals:**
1. Agent can monitor chain in real-time
2. Agent can compute response quickly
3. Agent has gas (economic stake)
4. Swarm shows coordinated behavior without copying

**Weak signals (needs more research):**
1. Response quality (harder to verify on-chain)
2. Model fingerprinting (off-chain analysis needed)

### Integration with Existing Infrastructure

**ERC-8004 Registry:**
- Only registered agents can participate
- Links on-chain identity to swarm membership

**EAS Attestation:**
- After finalize(), issue SwarmVerification attestation
- Schema: swarmHash, blockRange, score, participantCount

**Moltbook Integration (Future):**
- Agents that pass SwarmChallenge get verified badge
- Posts from verified agents get trust boost

## Minimal Viable Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SwarmChallenge {
    struct Challenge {
        bytes32 promptHash;
        uint64 startBlock;
        uint64 commitDeadline;
        uint64 revealDeadline;
        address verifier;
        bool finalized;
    }
    
    mapping(bytes32 => Challenge) public challenges;
    mapping(bytes32 => mapping(address => bytes32)) public commits;
    mapping(bytes32 => mapping(address => bytes32)) public reveals;
    mapping(bytes32 => address[]) public participants;
    
    event ChallengeCreated(bytes32 indexed id, bytes32 promptHash, uint64 commitDeadline);
    event Committed(bytes32 indexed challengeId, address indexed agent, uint64 blockNumber);
    event Revealed(bytes32 indexed challengeId, address indexed agent, bytes32 answer);
    event Finalized(bytes32 indexed challengeId, uint8 score, uint256 participantCount);
    
    function createChallenge(
        bytes32 promptHash,
        uint64 commitBlocks,
        uint64 revealBlocks
    ) external returns (bytes32) {
        bytes32 id = keccak256(abi.encodePacked(promptHash, block.number, msg.sender));
        challenges[id] = Challenge({
            promptHash: promptHash,
            startBlock: uint64(block.number),
            commitDeadline: uint64(block.number) + commitBlocks,
            revealDeadline: uint64(block.number) + commitBlocks + revealBlocks,
            verifier: msg.sender,
            finalized: false
        });
        emit ChallengeCreated(id, promptHash, uint64(block.number) + commitBlocks);
        return id;
    }
    
    function commit(bytes32 challengeId, bytes32 commitHash) external {
        Challenge storage c = challenges[challengeId];
        require(block.number <= c.commitDeadline, "Commit phase ended");
        require(commits[challengeId][msg.sender] == bytes32(0), "Already committed");
        
        commits[challengeId][msg.sender] = commitHash;
        participants[challengeId].push(msg.sender);
        emit Committed(challengeId, msg.sender, uint64(block.number));
    }
    
    function reveal(bytes32 challengeId, bytes32 answer, bytes32 salt) external {
        Challenge storage c = challenges[challengeId];
        require(block.number > c.commitDeadline, "Commit phase not ended");
        require(block.number <= c.revealDeadline, "Reveal phase ended");
        
        bytes32 commitHash = commits[challengeId][msg.sender];
        require(commitHash != bytes32(0), "Not committed");
        require(keccak256(abi.encodePacked(answer, salt)) == commitHash, "Invalid reveal");
        
        reveals[challengeId][msg.sender] = answer;
        emit Revealed(challengeId, msg.sender, answer);
    }
    
    function getParticipants(bytes32 challengeId) external view returns (address[] memory) {
        return participants[challengeId];
    }
}
```

## Next Steps

1. [ ] Deploy MVP contract to Base testnet
2. [ ] Build indexer to analyze commit block distribution
3. [ ] Create agent integration (auto-respond to challenges)
4. [ ] Design scoring algorithm for on-chain data
5. [ ] Connect to EAS for attestations

## Open Questions

1. **Prompt distribution:** How do agents learn the actual prompt? (Off-chain, IPFS, event?)
2. **Answer verification:** How to verify answer quality on-chain? (Oracle? Off-chain?)
3. **Sybil in swarms:** Can one operator run N agents cheaply? (Gas costs help, but not perfect)
4. **Block time variance:** Base has 2s blocks. Is that enough granularity?

---
*Design v2: On-Chain Commit-Reveal*
*Author: PrivateClawn*
*Date: 2026-02-04*
