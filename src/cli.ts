#!/usr/bin/env bun
/**
 * Swarm Verifier CLI
 * 
 * Usage:
 *   bun run cli.ts verify <endpoints...>
 *   bun run cli.ts self-test
 *   bun run cli.ts challenge  (on-chain test)
 *   bun run cli.ts demo
 */

import type { Agent } from './types';
import { generateChallenge } from './services/challenger';
import { dispatchChallenge } from './services/dispatcher';
import { analyzeSwarm, printVerificationSummary } from './services/analyzer';
import { SwarmChallengeClient } from './services/contract-client';

const args = process.argv.slice(2);
const command = args[0];

async function selfTest() {
  console.log('🦞 Proof of Swarm - Self Test\n');
  
  // Simulate swarm
  const agents: Agent[] = Array.from({ length: 5 }, (_, i) => ({
    id: `test_${i + 1}`,
    name: `Test Agent ${i + 1}`,
    endpoint: 'local://self',
  }));
  
  const challenge = generateChallenge('parallel', agents.map(a => a.id));
  console.log(`Challenge: "${challenge.prompt}"\n`);
  
  // Simulate responses
  const responses = await Promise.all(agents.map(async (agent) => {
    const delay = 200 + Math.random() * 400;
    await new Promise(r => setTimeout(r, delay));
    return {
      challengeId: challenge.id,
      agentId: agent.id,
      response: 'Test response',
      receivedAt: Date.now(),
      latencyMs: delay,
    };
  }));
  
  const verification = analyzeSwarm(agents, challenge, responses);
  printVerificationSummary(verification);
}

async function verifyEndpoints(endpoints: string[]) {
  if (endpoints.length < 2) {
    console.error('Error: Need at least 2 endpoints for swarm verification');
    process.exit(1);
  }
  
  console.log('🦞 Proof of Swarm - Verify Endpoints\n');
  
  const agents: Agent[] = endpoints.map((endpoint, i) => ({
    id: `agent_${i + 1}`,
    name: `Agent ${i + 1}`,
    endpoint,
  }));
  
  console.log('Agents:');
  agents.forEach(a => console.log(`  ${a.name}: ${a.endpoint}`));
  console.log('');
  
  const challenge = generateChallenge('parallel', agents.map(a => a.id));
  console.log(`Challenge: "${challenge.prompt}"\n`);
  
  const result = await dispatchChallenge(agents, challenge);
  const verification = analyzeSwarm(agents, challenge, result.responses);
  
  // Show responses
  console.log('\nResponses:');
  for (const r of result.responses) {
    const agent = agents.find(a => a.id === r.agentId);
    if (r.error) {
      console.log(`  ❌ ${agent?.name}: ${r.error}`);
    } else {
      console.log(`  ✅ ${agent?.name}: "${r.response.slice(0, 40)}..." (${r.latencyMs}ms)`);
    }
  }
  
  printVerificationSummary(verification);
}

function showHelp() {
  console.log(`🦞 Swarm Verifier CLI

Usage:
  bun run src/cli.ts self-test           Run self-verification test
  bun run src/cli.ts verify <urls...>    Verify agent endpoints
  bun run src/cli.ts challenge           Test on-chain commit-reveal (Sepolia)
  bun run src/cli.ts help                Show this help

Examples:
  bun run src/cli.ts self-test
  bun run src/cli.ts verify http://agent1.example.com http://agent2.example.com
  PRIVATE_KEY=0x... bun run src/cli.ts challenge
`);
}

async function onChainChallenge() {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    console.error('Error: PRIVATE_KEY environment variable required');
    console.error('Usage: PRIVATE_KEY=0x... bun run src/cli.ts challenge');
    process.exit(1);
  }

  console.log('🦞 Proof of Swarm - On-Chain Challenge (Base Sepolia)\n');

  const client = new SwarmChallengeClient(privateKey, 'sepolia');
  
  // Create challenge
  const prompt = 'What is 2 + 2?';
  console.log(`Creating challenge: "${prompt}"`);
  
  const { challengeId, txHash: createTx } = await client.createChallenge(prompt, 10n, 10n);
  console.log(`✅ Challenge created: ${challengeId.slice(0, 18)}...`);
  console.log(`   TX: https://sepolia.basescan.org/tx/${createTx}`);

  // Prepare and submit commit
  const commitData = client.prepareCommit('4');
  console.log(`\nCommitting answer...`);
  
  const commitTx = await client.commit(challengeId, commitData.commitHash);
  console.log(`✅ Committed: ${commitTx.slice(0, 18)}...`);

  // Wait for commit phase to end
  const info = await client.getChallenge(challengeId);
  console.log(`\nWaiting for commit phase to end (block ${info.commitDeadline})...`);
  await client.waitForBlock(info.commitDeadline);

  // Reveal
  console.log(`\nRevealing answer...`);
  const revealTx = await client.reveal(challengeId, commitData.answerHash, commitData.salt);
  console.log(`✅ Revealed: ${revealTx.slice(0, 18)}...`);

  // Wait for reveal phase to end
  console.log(`\nWaiting for reveal phase to end (block ${info.revealDeadline})...`);
  await client.waitForBlock(info.revealDeadline);

  // Finalize
  console.log(`\nFinalizing challenge...`);
  const finalizeTx = await client.finalize(challengeId);
  console.log(`✅ Finalized: ${finalizeTx.slice(0, 18)}...`);

  // Get final state
  const finalInfo = await client.getChallenge(challengeId);
  console.log(`\n📊 Results:`);
  console.log(`   Score: ${finalInfo.score}/100`);
  console.log(`   Participants: ${finalInfo.participantCount}`);
  console.log(`   Revealed: ${finalInfo.revealedCount}`);
}

// Main
switch (command) {
  case 'self-test':
  case 'selftest':
  case 'test':
    await selfTest();
    break;
    
  case 'verify':
    await verifyEndpoints(args.slice(1));
    break;

  case 'challenge':
  case 'onchain':
    await onChainChallenge();
    break;
    
  case 'help':
  case '--help':
  case '-h':
  default:
    showHelp();
}
