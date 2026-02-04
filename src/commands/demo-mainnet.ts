#!/usr/bin/env bun
/**
 * Swarm Challenge Demo - Mainnet
 * 
 * Runs a complete challenge cycle on Base Mainnet:
 * 1. Create challenge
 * 2. Simulate 3 agent commits
 * 3. Wait for commit phase to end
 * 4. Reveal all answers
 * 5. Wait for reveal phase to end
 * 6. Finalize and get score
 * 
 * Usage:
 *   bun run src/commands/demo-mainnet.ts [--dry-run]
 */

import { createPublicClient, createWalletClient, http, keccak256, type Hex, type Address } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join } from 'path';

// Config
const SWARM_CONTRACT = '0x70602b1c50058c27306cebef87fc12987fa770f5' as Address;
const RPC_URL = 'https://mainnet.base.org';
const FOUNDRY_PATH = join(process.env.HOME!, '.foundry/bin');

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-n');

// Get private key from vault
function getPrivateKey(): Hex {
  const vaultPath = process.env.VAULT_PATH;
  if (!vaultPath) {
    throw new Error('VAULT_PATH environment variable not set');
  }
  
  const secrets = JSON.parse(readFileSync(vaultPath, 'utf-8'));
  const password = secrets.WALLET_PASSWORD;
  
  const result = spawnSync(
    `${FOUNDRY_PATH}/cast`,
    ['wallet', 'decrypt-keystore', 'clawn', '--unsafe-password', password],
    { encoding: 'utf8', timeout: 30000 }
  );
  
  if (result.error || result.status !== 0) {
    throw new Error(`Failed to decrypt keystore: ${result.stderr || result.error}`);
  }
  
  const match = result.stdout.match(/0x[a-fA-F0-9]{64}/);
  if (!match) throw new Error('Could not extract private key');
  
  return match[0] as Hex;
}

// Contract ABI (minimal)
const ABI = [
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
    name: 'getChallenge',
    type: 'function',
    inputs: [{ name: 'challengeId', type: 'bytes32' }],
    outputs: [
      { name: 'promptHash', type: 'bytes32' },
      { name: 'startBlock', type: 'uint64' },
      { name: 'commitDeadline', type: 'uint64' },
      { name: 'revealDeadline', type: 'uint64' },
      { name: 'verifier', type: 'address' },
      { name: 'finalized', type: 'bool' },
      { name: 'score', type: 'uint8' }
    ],
    stateMutability: 'view'
  },
  {
    name: 'ChallengeCreated',
    type: 'event',
    inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'promptHash', type: 'bytes32', indexed: false },
      { name: 'commitDeadline', type: 'uint64', indexed: false },
      { name: 'revealDeadline', type: 'uint64', indexed: false }
    ]
  },
  {
    name: 'Finalized',
    type: 'event',
    inputs: [
      { name: 'challengeId', type: 'bytes32', indexed: true },
      { name: 'score', type: 'uint8', indexed: false },
      { name: 'participantCount', type: 'uint256', indexed: false },
      { name: 'revealedCount', type: 'uint256', indexed: false }
    ]
  }
] as const;

async function main() {
  console.log('🦞 Swarm Challenge Demo - Base Mainnet\n');
  console.log(`Contract: ${SWARM_CONTRACT}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no transactions)' : 'LIVE'}\n`);
  
  if (dryRun) {
    console.log('--- DRY RUN MODE ---');
    console.log('Would execute:');
    console.log('1. createChallenge("What is 2+2?", 15 blocks, 15 blocks)');
    console.log('2. commit x3 (same wallet simulating 3 agents)');
    console.log('3. Wait ~30 seconds for commit phase');
    console.log('4. reveal x3');
    console.log('5. Wait ~30 seconds for reveal phase');
    console.log('6. finalize()');
    console.log('\nEstimated gas: ~0.0006 ETH');
    console.log('Run without --dry-run to execute.');
    return;
  }
  
  // Setup clients
  const privateKey = getPrivateKey();
  const account = privateKeyToAccount(privateKey);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  });
  
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(RPC_URL),
  });
  
  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Wallet: ${account.address}`);
  console.log(`Balance: ${Number(balance) / 1e18} ETH\n`);
  
  if (balance < 500000000000000n) {
    console.error('❌ Insufficient balance (need ~0.0005 ETH minimum)');
    process.exit(1);
  }
  
  // Step 1: Create challenge
  const prompt = 'What is 2 + 2?';
  const promptHash = keccak256(new TextEncoder().encode(prompt) as unknown as Hex);
  const commitBlocks = 15n;  // ~30 seconds
  const revealBlocks = 15n;  // ~30 seconds
  
  console.log('📝 Step 1: Creating challenge...');
  console.log(`   Prompt: "${prompt}"`);
  
  const createHash = await walletClient.writeContract({
    address: SWARM_CONTRACT,
    abi: ABI,
    functionName: 'createChallenge',
    args: [promptHash, commitBlocks, revealBlocks],
  });
  
  console.log(`   TX: https://basescan.org/tx/${createHash}`);
  
  const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
  const challengeId = createReceipt.logs[0]?.topics[1] as Hex;
  console.log(`   ✅ Challenge ID: ${challengeId?.slice(0, 18)}...`);
  
  // Wait a moment for chain state to settle
  await new Promise(r => setTimeout(r, 2000));
  
  // Get challenge info
  const challengeInfo = await publicClient.readContract({
    address: SWARM_CONTRACT,
    abi: ABI,
    functionName: 'getChallenge',
    args: [challengeId],
  });
  
  // Type assert the result properly
  const [, , rawCommitDeadline, rawRevealDeadline] = challengeInfo as [Hex, bigint, bigint, bigint, Hex, boolean, number];
  const commitDeadline = BigInt(rawCommitDeadline);
  const revealDeadline = BigInt(rawRevealDeadline);
  const currentBlock = await publicClient.getBlockNumber();
  
  console.log(`   Current block: ${currentBlock}`);
  console.log(`   Commit deadline: ${commitDeadline}`);
  console.log(`   Reveal deadline: ${revealDeadline}\n`);
  
  if (commitDeadline === 0n) {
    console.error('❌ Error: Failed to read challenge deadlines. Try again.');
    process.exit(1);
  }
  
  // Step 2: Commit (simulate 3 agents with same wallet)
  console.log('📝 Step 2: Committing answers (simulating 3 agents)...');
  
  const commits: Array<{ answer: string; salt: Hex; commitHash: Hex; answerHash: Hex }> = [];
  
  for (let i = 0; i < 3; i++) {
    const answer = `4_agent${i}`;
    const answerHash = keccak256(new TextEncoder().encode(answer) as unknown as Hex);
    const salt = keccak256(new TextEncoder().encode(`salt_${Date.now()}_${i}`) as unknown as Hex);
    const commitHash = keccak256(`${answerHash}${salt.slice(2)}` as Hex);
    
    commits.push({ answer, salt, commitHash, answerHash });
    
    // Note: Same wallet = only 1 commit counted (contract checks msg.sender)
    // For real demo, would need multiple wallets
  }
  
  // Submit first commit only (contract prevents duplicate commits from same address)
  const commitHash = await walletClient.writeContract({
    address: SWARM_CONTRACT,
    abi: ABI,
    functionName: 'commit',
    args: [challengeId, commits[0].commitHash],
  });
  
  console.log(`   TX: https://basescan.org/tx/${commitHash}`);
  await publicClient.waitForTransactionReceipt({ hash: commitHash });
  console.log(`   ✅ Committed 1 answer (single wallet limitation)\n`);
  
  // Step 3: Wait for commit phase
  console.log('⏳ Step 3: Waiting for commit phase to end...');
  while (true) {
    const block = await publicClient.getBlockNumber();
    if (block > commitDeadline) break;
    const remaining = Number(commitDeadline - block) * 2;
    process.stdout.write(`\r   Block ${block}/${commitDeadline} (~${remaining}s remaining)   `);
    await new Promise(r => setTimeout(r, 4000));
  }
  console.log('\n   ✅ Commit phase ended\n');
  
  // Step 4: Reveal
  console.log('📝 Step 4: Revealing answer...');
  
  const revealHash = await walletClient.writeContract({
    address: SWARM_CONTRACT,
    abi: ABI,
    functionName: 'reveal',
    args: [challengeId, commits[0].answerHash, commits[0].salt],
  });
  
  console.log(`   TX: https://basescan.org/tx/${revealHash}`);
  await publicClient.waitForTransactionReceipt({ hash: revealHash });
  console.log(`   ✅ Revealed\n`);
  
  // Step 5: Wait for reveal phase
  console.log('⏳ Step 5: Waiting for reveal phase to end...');
  while (true) {
    const block = await publicClient.getBlockNumber();
    if (block > revealDeadline) break;
    const remaining = Number(revealDeadline - block) * 2;
    process.stdout.write(`\r   Block ${block}/${revealDeadline} (~${remaining}s remaining)   `);
    await new Promise(r => setTimeout(r, 4000));
  }
  console.log('\n   ✅ Reveal phase ended\n');
  
  // Step 6: Finalize
  console.log('📝 Step 6: Finalizing challenge...');
  
  const finalizeHash = await walletClient.writeContract({
    address: SWARM_CONTRACT,
    abi: ABI,
    functionName: 'finalize',
    args: [challengeId],
  });
  
  console.log(`   TX: https://basescan.org/tx/${finalizeHash}`);
  const finalizeReceipt = await publicClient.waitForTransactionReceipt({ hash: finalizeHash });
  
  // Get final score
  const finalInfo = await publicClient.readContract({
    address: SWARM_CONTRACT,
    abi: ABI,
    functionName: 'getChallenge',
    args: [challengeId],
  });
  
  const score = finalInfo[6];
  
  console.log(`   ✅ Finalized!`);
  console.log(`\n🏆 RESULT: Score = ${score}/100\n`);
  
  console.log('Summary:');
  console.log(`  Challenge ID: ${challengeId}`);
  console.log(`  Participants: 1 (single wallet demo)`);
  console.log(`  Score: ${score}`);
  console.log(`  Contract: https://basescan.org/address/${SWARM_CONTRACT}`);
}

main().catch(err => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
