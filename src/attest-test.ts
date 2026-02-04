/**
 * Attest Self-Verification
 * 
 * Run a swarm verification and attest the result on-chain.
 */

import type { Agent, ChallengeResponse } from './types';
import { generateChallenge } from './services/challenger';
import { analyzeSwarm, printVerificationSummary } from './services/analyzer';
import { attestSwarm, uploadEvidence } from './services/attester';

const WALLET_PASSWORD = process.env.WALLET_PASSWORD;

if (!WALLET_PASSWORD) {
  console.error('WALLET_PASSWORD environment variable required');
  process.exit(1);
}

const walletPassword: string = WALLET_PASSWORD;

// Simple response generator (simulates LLM)
async function selfChallenge(prompt: string): Promise<{ response: string; latencyMs: number }> {
  const startTime = Date.now();
  
  const inferenceTime = 200 + Math.random() * 400;
  await new Promise(r => setTimeout(r, inferenceTime));
  
  const responses: Record<string, string> = {
    'In exactly 3 words, describe the color blue.': 'Calm, cool, vast',
    'Complete this sequence: 2, 4, 8, 16, __': '32',
    'What is 7 * 13? Reply with just the number.': '91',
    'Name one element from the periodic table.': 'Hydrogen',
    "What comes after 'Hello' in a greeting?": 'World',
    "Spell 'verification' backwards.": 'noitacifirev',
    'What is the capital of France? One word.': 'Paris',
    'Complete: The quick brown fox jumps over the lazy ___': 'dog',
    'What is 100 - 37?': '63',
    'Name a primary color.': 'Blue',
  };
  
  let response = 'I can answer that.';
  for (const [key, value] of Object.entries(responses)) {
    if (prompt.includes(key.slice(0, 20))) {
      response = value;
      break;
    }
  }
  
  return { response, latencyMs: Date.now() - startTime };
}

async function main() {
  console.log('🦞 Proof of Swarm - Attestation Test\n');
  
  // Create swarm
  const agents: Agent[] = Array.from({ length: 5 }, (_, i) => ({
    id: `pvtclawn_${i + 1}`,
    name: `PrivateClawn Instance ${i + 1}`,
    endpoint: 'local://self',
    tokenId: '8004',
  }));
  
  // Generate challenge
  const challenge = generateChallenge('parallel', agents.map(a => a.id));
  console.log(`Challenge: "${challenge.prompt}"\n`);
  
  // Run challenges
  const startTime = Date.now();
  const responsePromises = agents.map(async (agent) => {
    const result = await selfChallenge(challenge.prompt);
    return {
      challengeId: challenge.id,
      agentId: agent.id,
      response: result.response,
      receivedAt: Date.now(),
      latencyMs: result.latencyMs,
    } as ChallengeResponse;
  });
  
  const responses = await Promise.all(responsePromises);
  console.log(`Responses collected in ${Date.now() - startTime}ms\n`);
  
  // Show responses
  for (const r of responses) {
    const agent = agents.find(a => a.id === r.agentId);
    console.log(`  ✅ ${agent?.name}: "${r.response}" (${r.latencyMs}ms)`);
  }
  
  // Analyze
  const verification = analyzeSwarm(agents, challenge, responses);
  printVerificationSummary(verification);
  
  // Only attest if genuine
  if (verification.verdict !== 'genuine') {
    console.log('\n❌ Not attesting - verdict is not genuine');
    return;
  }
  
  // Upload evidence and attest
  console.log('\n📦 Uploading evidence to IPFS...');
  const evidenceUri = await uploadEvidence(verification);
  console.log(`Evidence: ${evidenceUri}`);
  
  console.log('\n⛓️  Attesting on Base...');
  const attestation = await attestSwarm(verification, evidenceUri, walletPassword);
  
  console.log('\n✅ ATTESTATION COMPLETE!');
  console.log(`TX: https://basescan.org/tx/${attestation.txHash}`);
}

main().catch(console.error);
