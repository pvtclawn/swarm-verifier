import { createPublicClient, createWalletClient, http, keccak256, encodeAbiParameters, parseAbiParameters, type Hex, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// SwarmChallenge contract ABI (minimal)
const SWARM_CHALLENGE_ABI = [
  {
    name: 'createChallenge',
    type: 'function',
    inputs: [
      { name: 'promptHash', type: 'bytes32' },
      { name: 'commitBlocks', type: 'uint64' },
      { name: 'revealBlocks', type: 'uint64' }
    ],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'nonpayable'
  },
  {
    name: 'commit',
    type: 'function',
    inputs: [
      { name: 'challengeId', type: 'bytes32' },
      { name: 'commitHash', type: 'bytes32' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    name: 'reveal',
    type: 'function',
    inputs: [
      { name: 'challengeId', type: 'bytes32' },
      { name: 'answer', type: 'bytes32' },
      { name: 'salt', type: 'bytes32' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    name: 'finalize',
    type: 'function',
    inputs: [{ name: 'challengeId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    name: 'challenges',
    type: 'function',
    inputs: [{ name: 'challengeId', type: 'bytes32' }],
    outputs: [
      { name: 'promptHash', type: 'bytes32' },
      { name: 'verifier', type: 'address' },
      { name: 'startBlock', type: 'uint64' },
      { name: 'commitDeadline', type: 'uint64' },
      { name: 'revealDeadline', type: 'uint64' },
      { name: 'finalized', type: 'bool' },
      { name: 'score', type: 'uint8' },
      { name: 'participantCount', type: 'uint8' },
      { name: 'revealedCount', type: 'uint8' }
    ],
    stateMutability: 'view'
  },
  {
    name: 'ChallengeCreated',
    type: 'event',
    inputs: [
      { name: 'challengeId', type: 'bytes32', indexed: true },
      { name: 'promptHash', type: 'bytes32', indexed: false },
      { name: 'commitDeadline', type: 'uint64', indexed: false },
      { name: 'revealDeadline', type: 'uint64', indexed: false }
    ]
  },
  {
    name: 'Committed',
    type: 'event',
    inputs: [
      { name: 'challengeId', type: 'bytes32', indexed: true },
      { name: 'participant', type: 'address', indexed: true },
      { name: 'blockNumber', type: 'uint64', indexed: false }
    ]
  },
  {
    name: 'Revealed',
    type: 'event',
    inputs: [
      { name: 'challengeId', type: 'bytes32', indexed: true },
      { name: 'participant', type: 'address', indexed: true },
      { name: 'answer', type: 'bytes32', indexed: false }
    ]
  },
  {
    name: 'Finalized',
    type: 'event',
    inputs: [
      { name: 'challengeId', type: 'bytes32', indexed: true },
      { name: 'score', type: 'uint8', indexed: false },
      { name: 'participantCount', type: 'uint8', indexed: false },
      { name: 'revealedCount', type: 'uint8', indexed: false }
    ]
  }
] as const;

// Contract addresses
const CONTRACTS: Record<'sepolia' | 'mainnet', Address> = {
  sepolia: '0xded4B58c1C4E5858098a70DfcF77B0b6a4c3aE0F' as Address,
  mainnet: '0x0000000000000000000000000000000000000000' as Address, // TBD
};

export interface ChallengeInfo {
  promptHash: Hex;
  verifier: Address;
  startBlock: bigint;
  commitDeadline: bigint;
  revealDeadline: bigint;
  finalized: boolean;
  score: number;
  participantCount: number;
  revealedCount: number;
}

export interface CommitData {
  answer: string;
  salt: Hex;
  commitHash: Hex;
  answerHash: Hex;
}

export class SwarmChallengeClient {
  private publicClient;
  private walletClient;
  private contractAddress: Address;

  constructor(privateKey: Hex, network: 'sepolia' | 'mainnet' = 'sepolia') {
    const chain = network === 'sepolia' ? baseSepolia : baseSepolia; // TODO: add mainnet
    const rpcUrl = network === 'sepolia' 
      ? 'https://sepolia.base.org' 
      : 'https://mainnet.base.org';
    
    this.contractAddress = CONTRACTS[network];
    
    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    const account = privateKeyToAccount(privateKey);
    this.walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });
  }

  /**
   * Create a new challenge
   */
  async createChallenge(prompt: string, commitBlocks = 10n, revealBlocks = 10n): Promise<{ challengeId: Hex; txHash: Hex }> {
    const promptHash = keccak256(new TextEncoder().encode(prompt) as unknown as Hex);
    
    const txHash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: SWARM_CHALLENGE_ABI,
      functionName: 'createChallenge',
      args: [promptHash, commitBlocks, revealBlocks],
    });

    // Wait for receipt and extract challengeId from logs
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    const challengeCreatedLog = receipt.logs.find(
      log => log.topics[0] === keccak256(new TextEncoder().encode('ChallengeCreated(bytes32,bytes32,uint64,uint64)') as unknown as Hex)
    );
    
    const challengeId = challengeCreatedLog?.topics[1] as Hex;
    
    return { challengeId, txHash };
  }

  /**
   * Prepare commit data (answer + salt + hash)
   */
  prepareCommit(answer: string): CommitData {
    const answerHash = keccak256(new TextEncoder().encode(answer) as unknown as Hex);
    const salt = keccak256(new TextEncoder().encode(`salt_${Date.now()}_${Math.random()}`) as unknown as Hex);
    
    const encoded = encodeAbiParameters(
      parseAbiParameters('bytes32, bytes32'),
      [answerHash, salt]
    );
    const commitHash = keccak256(encoded);

    return { answer, salt, commitHash, answerHash };
  }

  /**
   * Submit a commit
   */
  async commit(challengeId: Hex, commitHash: Hex): Promise<Hex> {
    return this.walletClient.writeContract({
      address: this.contractAddress,
      abi: SWARM_CHALLENGE_ABI,
      functionName: 'commit',
      args: [challengeId, commitHash],
    });
  }

  /**
   * Reveal answer
   */
  async reveal(challengeId: Hex, answerHash: Hex, salt: Hex): Promise<Hex> {
    return this.walletClient.writeContract({
      address: this.contractAddress,
      abi: SWARM_CHALLENGE_ABI,
      functionName: 'reveal',
      args: [challengeId, answerHash, salt],
    });
  }

  /**
   * Finalize challenge and get score
   */
  async finalize(challengeId: Hex): Promise<Hex> {
    return this.walletClient.writeContract({
      address: this.contractAddress,
      abi: SWARM_CHALLENGE_ABI,
      functionName: 'finalize',
      args: [challengeId],
    });
  }

  /**
   * Get challenge info
   */
  async getChallenge(challengeId: Hex): Promise<ChallengeInfo> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: SWARM_CHALLENGE_ABI,
      functionName: 'challenges',
      args: [challengeId],
    }) as readonly [Hex, Address, bigint, bigint, bigint, boolean, number, number, number];

    return {
      promptHash: result[0],
      verifier: result[1],
      startBlock: result[2],
      commitDeadline: result[3],
      revealDeadline: result[4],
      finalized: result[5],
      score: result[6],
      participantCount: result[7],
      revealedCount: result[8],
    };
  }

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<bigint> {
    return this.publicClient.getBlockNumber();
  }

  /**
   * Wait for blocks
   */
  async waitForBlock(targetBlock: bigint): Promise<void> {
    while (true) {
      const current = await this.getCurrentBlock();
      if (current >= targetBlock) break;
      await new Promise(r => setTimeout(r, 2000)); // Base ~2s blocks
    }
  }
}

// Export for CLI usage
export { CONTRACTS, SWARM_CHALLENGE_ABI };
