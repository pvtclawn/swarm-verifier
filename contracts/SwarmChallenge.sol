// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SwarmChallenge
 * @notice On-chain commit-reveal protocol for verifying AI agent swarms
 * @dev Agents commit hash of (answer + salt), then reveal after deadline
 * 
 * Key insight: Real AI swarms commit in tight block clusters.
 * Human farms show staggered commits and missed deadlines.
 */
contract SwarmChallenge {
    struct Challenge {
        bytes32 promptHash;        // keccak256(prompt)
        uint64 startBlock;
        uint64 commitDeadline;
        uint64 revealDeadline;
        address verifier;
        bool finalized;
        uint8 score;               // Final score (0-100)
    }
    
    struct Commitment {
        bytes32 commitHash;
        uint64 commitBlock;
        bytes32 revealedAnswer;
        bool revealed;
    }
    
    // Challenge ID => Challenge
    mapping(bytes32 => Challenge) public challenges;
    
    // Challenge ID => Agent => Commitment
    mapping(bytes32 => mapping(address => Commitment)) public commitments;
    
    // Challenge ID => Participant list
    mapping(bytes32 => address[]) public participants;
    
    // Events for indexing
    event ChallengeCreated(
        bytes32 indexed id, 
        bytes32 promptHash, 
        uint64 commitDeadline,
        uint64 revealDeadline
    );
    
    event Committed(
        bytes32 indexed challengeId, 
        address indexed agent, 
        uint64 blockNumber
    );
    
    event Revealed(
        bytes32 indexed challengeId, 
        address indexed agent, 
        bytes32 answer
    );
    
    event Finalized(
        bytes32 indexed challengeId, 
        uint8 score, 
        uint256 participantCount,
        uint256 revealedCount
    );
    
    /**
     * @notice Create a new swarm challenge
     * @param promptHash keccak256 of the challenge prompt
     * @param commitBlocks Number of blocks for commit phase
     * @param revealBlocks Number of blocks for reveal phase
     * @return Challenge ID
     */
    function createChallenge(
        bytes32 promptHash,
        uint64 commitBlocks,
        uint64 revealBlocks
    ) external returns (bytes32) {
        require(commitBlocks > 0, "Commit phase must be > 0");
        require(revealBlocks > 0, "Reveal phase must be > 0");
        
        bytes32 id = keccak256(abi.encodePacked(
            promptHash, 
            block.number, 
            msg.sender,
            block.timestamp
        ));
        
        challenges[id] = Challenge({
            promptHash: promptHash,
            startBlock: uint64(block.number),
            commitDeadline: uint64(block.number) + commitBlocks,
            revealDeadline: uint64(block.number) + commitBlocks + revealBlocks,
            verifier: msg.sender,
            finalized: false,
            score: 0
        });
        
        emit ChallengeCreated(
            id, 
            promptHash, 
            uint64(block.number) + commitBlocks,
            uint64(block.number) + commitBlocks + revealBlocks
        );
        
        return id;
    }
    
    /**
     * @notice Commit a hashed answer
     * @param challengeId The challenge to respond to
     * @param commitHash keccak256(answer + salt)
     */
    function commit(bytes32 challengeId, bytes32 commitHash) external {
        Challenge storage c = challenges[challengeId];
        require(c.startBlock > 0, "Challenge does not exist");
        require(block.number <= c.commitDeadline, "Commit phase ended");
        require(commitments[challengeId][msg.sender].commitHash == bytes32(0), "Already committed");
        
        commitments[challengeId][msg.sender] = Commitment({
            commitHash: commitHash,
            commitBlock: uint64(block.number),
            revealedAnswer: bytes32(0),
            revealed: false
        });
        
        participants[challengeId].push(msg.sender);
        
        emit Committed(challengeId, msg.sender, uint64(block.number));
    }
    
    /**
     * @notice Reveal the answer and salt
     * @param challengeId The challenge
     * @param answer The actual answer
     * @param salt The salt used in commit
     */
    function reveal(bytes32 challengeId, bytes32 answer, bytes32 salt) external {
        Challenge storage c = challenges[challengeId];
        require(c.startBlock > 0, "Challenge does not exist");
        require(block.number > c.commitDeadline, "Commit phase not ended");
        require(block.number <= c.revealDeadline, "Reveal phase ended");
        
        Commitment storage comm = commitments[challengeId][msg.sender];
        require(comm.commitHash != bytes32(0), "Not committed");
        require(!comm.revealed, "Already revealed");
        
        bytes32 expectedHash = keccak256(abi.encodePacked(answer, salt));
        require(expectedHash == comm.commitHash, "Invalid reveal");
        
        comm.revealedAnswer = answer;
        comm.revealed = true;
        
        emit Revealed(challengeId, msg.sender, answer);
    }
    
    /**
     * @notice Finalize the challenge and calculate score
     * @param challengeId The challenge to finalize
     */
    function finalize(bytes32 challengeId) external {
        Challenge storage c = challenges[challengeId];
        require(c.startBlock > 0, "Challenge does not exist");
        require(block.number > c.revealDeadline, "Reveal phase not ended");
        require(!c.finalized, "Already finalized");
        require(msg.sender == c.verifier, "Only verifier can finalize");
        
        address[] memory parts = participants[challengeId];
        uint256 participantCount = parts.length;
        
        if (participantCount == 0) {
            c.finalized = true;
            c.score = 0;
            emit Finalized(challengeId, 0, 0, 0);
            return;
        }
        
        // Calculate metrics
        uint64 minBlock = type(uint64).max;
        uint64 maxBlock = 0;
        uint256 revealedCount = 0;
        
        for (uint256 i = 0; i < participantCount; i++) {
            Commitment storage comm = commitments[challengeId][parts[i]];
            
            if (comm.commitBlock < minBlock) minBlock = comm.commitBlock;
            if (comm.commitBlock > maxBlock) maxBlock = comm.commitBlock;
            if (comm.revealed) revealedCount++;
        }
        
        uint64 blockSpread = maxBlock - minBlock;
        
        // Scoring (simplified)
        // Block spread: 0-2 = 100, 3-5 = 80, 6-10 = 60, >10 = 40
        uint8 spreadScore;
        if (blockSpread <= 2) spreadScore = 100;
        else if (blockSpread <= 5) spreadScore = 80;
        else if (blockSpread <= 10) spreadScore = 60;
        else spreadScore = 40;
        
        // Reveal rate: percentage revealed
        uint8 revealScore = uint8((revealedCount * 100) / participantCount);
        
        // Combined score (50% spread, 50% reveal)
        uint8 finalScore = (spreadScore / 2) + (revealScore / 2);
        
        c.finalized = true;
        c.score = finalScore;
        
        emit Finalized(challengeId, finalScore, participantCount, revealedCount);
    }
    
    /**
     * @notice Get all participants for a challenge
     */
    function getParticipants(bytes32 challengeId) external view returns (address[] memory) {
        return participants[challengeId];
    }
    
    /**
     * @notice Get challenge details
     */
    function getChallenge(bytes32 challengeId) external view returns (
        bytes32 promptHash,
        uint64 startBlock,
        uint64 commitDeadline,
        uint64 revealDeadline,
        address verifier,
        bool finalized,
        uint8 score
    ) {
        Challenge storage c = challenges[challengeId];
        return (
            c.promptHash,
            c.startBlock,
            c.commitDeadline,
            c.revealDeadline,
            c.verifier,
            c.finalized,
            c.score
        );
    }
}
