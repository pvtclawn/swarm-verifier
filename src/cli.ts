#!/usr/bin/env bun
/**
 * Swarm Verifier CLI
 * 
 * Usage:
 *   bun run cli.ts verify <endpoints...>
 *   bun run cli.ts self-test
 *   bun run cli.ts demo
 */

import type { Agent } from './types';
import { generateChallenge } from './services/challenger';
import { dispatchChallenge } from './services/dispatcher';
import { analyzeSwarm, printVerificationSummary } from './services/analyzer';

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
  bun run src/cli.ts help                Show this help

Examples:
  bun run src/cli.ts self-test
  bun run src/cli.ts verify http://agent1.example.com http://agent2.example.com
`);
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
    
  case 'help':
  case '--help':
  case '-h':
  default:
    showHelp();
}
