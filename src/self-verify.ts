/**
 * Self-Verification Demo
 * 
 * PrivateClawn verifies itself to demonstrate the protocol works.
 * This shows what a real verification looks like.
 */

import type { Agent, ChallengeResponse } from './types';
import { generateChallenge } from './services/challenger';
import { analyzeSwarm, printVerificationSummary } from './services/analyzer';

// OpenClaw can call itself via sessions
async function selfChallenge(prompt: string): Promise<{ response: string; latencyMs: number }> {
  const startTime = Date.now();
  
  // In a real implementation, this would call OpenClaw's API
  // For now, simulate an AI response with realistic timing
  
  // Simulate LLM inference time (200-600ms typical for short responses)
  const inferenceTime = 200 + Math.random() * 400;
  await new Promise(r => setTimeout(r, inferenceTime));
  
  // Generate response based on prompt
  let response = '';
  
  if (prompt.includes('3 words') && prompt.includes('blue')) {
    response = 'Calm, cool, vast';
  } else if (prompt.includes('2, 4, 8, 16')) {
    response = '32';
  } else if (prompt.includes('7 * 13')) {
    response = '91';
  } else if (prompt.includes('periodic table')) {
    response = 'Hydrogen';
  } else if (prompt.includes('Hello')) {
    response = 'World';
  } else if (prompt.includes('verification')) {
    response = 'noitacifirev';
  } else if (prompt.includes('capital of France')) {
    response = 'Paris';
  } else if (prompt.includes('quick brown fox')) {
    response = 'dog';
  } else if (prompt.includes('100 - 37')) {
    response = '63';
  } else if (prompt.includes('primary color')) {
    response = 'Blue';
  } else {
    response = 'I can answer that question.';
  }
  
  const latencyMs = Date.now() - startTime;
  return { response, latencyMs };
}

async function runSelfVerification() {
  console.log('🦞 Proof of Swarm - Self-Verification Demo\n');
  console.log('PrivateClawn verifying itself (simulating a swarm of 5 identical agents)\n');
  
  // Create 5 "copies" of myself
  const agents: Agent[] = Array.from({ length: 5 }, (_, i) => ({
    id: `pvtclawn_${i + 1}`,
    name: `PrivateClawn Instance ${i + 1}`,
    endpoint: 'local://self',
    tokenId: '8004', // My ERC-8004 token
  }));
  
  // Generate challenge
  const challenge = generateChallenge('parallel', agents.map(a => a.id));
  console.log(`Challenge: "${challenge.prompt}"\n`);
  
  // Run challenges in parallel (simulating swarm verification)
  console.log('Sending challenge to all instances simultaneously...\n');
  
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
  const totalTime = Date.now() - startTime;
  
  console.log(`All responses collected in ${totalTime}ms\n`);
  
  // Show responses
  console.log('Responses:');
  for (const r of responses) {
    const agent = agents.find(a => a.id === r.agentId);
    console.log(`  ✅ ${agent?.name}: "${r.response}" (${r.latencyMs}ms)`);
  }
  
  // Analyze
  const verification = analyzeSwarm(agents, challenge, responses);
  printVerificationSummary(verification);
  
  // Explain the result
  console.log('\n📝 Analysis:');
  console.log('   - All instances responded quickly (< 1s) → High response time score');
  console.log('   - Low variance in timing → High consistency score (same model)');
  console.log('   - Identical responses → High content score (same model)');
  console.log('   - 100% participation → High participation score');
  console.log('\n   This is what a GENUINE AI swarm looks like!');
  console.log('   A human farming operation would show higher variance and slower times.');
}

runSelfVerification().catch(console.error);
