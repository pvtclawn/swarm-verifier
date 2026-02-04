/**
 * End-to-End Swarm Test
 * 
 * Spins up multiple SVP responders and verifies them as a swarm.
 * This is a real test with actual HTTP calls.
 */

import { spawn, type Subprocess } from 'bun';
import type { Agent } from './types';
import { generateChallenge } from './services/challenger';
import { dispatchChallenge } from './services/dispatcher';
import { analyzeSwarm, printVerificationSummary } from './services/analyzer';

const NUM_AGENTS = 5;
const BASE_PORT = 3510;

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function runE2ETest() {
  console.log('🦞 Proof of Swarm - End-to-End Test\n');
  console.log(`Spawning ${NUM_AGENTS} SVP responder agents...\n`);
  
  const processes: Subprocess[] = [];
  const agents: Agent[] = [];
  
  try {
    // Spawn agents
    for (let i = 0; i < NUM_AGENTS; i++) {
      const port = BASE_PORT + i;
      const agentId = `agent_${i + 1}`;
      
      const proc = spawn(['bun', 'run', 'src/svp-responder.ts'], {
        env: {
          ...process.env,
          SVP_PORT: String(port),
          AGENT_ID: agentId,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      processes.push(proc);
      agents.push({
        id: agentId,
        name: `Test Agent ${i + 1}`,
        endpoint: `http://localhost:${port}`,
      });
      
      console.log(`  Started ${agentId} on port ${port}`);
    }
    
    // Wait for agents to start
    console.log('\nWaiting for agents to start...');
    await sleep(2000);
    
    // Verify agents are up
    console.log('Checking agent health...\n');
    for (const agent of agents) {
      try {
        const response = await fetch(`${agent.endpoint}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          console.log(`  ✅ ${agent.name} is ready`);
        } else {
          console.log(`  ❌ ${agent.name} not responding`);
        }
      } catch {
        console.log(`  ❌ ${agent.name} failed to connect`);
      }
    }
    
    // Run swarm verification
    console.log('\n═══════════════════════════════════════');
    console.log('SWARM VERIFICATION');
    console.log('═══════════════════════════════════════\n');
    
    const challenge = generateChallenge('parallel', agents.map(a => a.id), 10000);
    console.log(`Challenge: "${challenge.prompt}"\n`);
    
    const dispatchResult = await dispatchChallenge(agents, challenge, 10000);
    
    // Show individual responses
    console.log('\nResponses:');
    for (const r of dispatchResult.responses) {
      const agent = agents.find(a => a.id === r.agentId);
      if (r.error) {
        console.log(`  ❌ ${agent?.name}: ${r.error}`);
      } else {
        console.log(`  ✅ ${agent?.name}: "${r.response}" (${r.latencyMs}ms)`);
      }
    }
    
    // Analyze
    const verification = analyzeSwarm(agents, challenge, dispatchResult.responses);
    printVerificationSummary(verification);
    
    // Summary
    console.log('\n═══════════════════════════════════════');
    console.log('TEST RESULT');
    console.log('═══════════════════════════════════════');
    
    if (verification.verdict === 'genuine') {
      console.log('✅ PASS: Swarm verified as GENUINE');
    } else if (verification.verdict === 'suspicious') {
      console.log('⚠️  WARN: Swarm is SUSPICIOUS');
    } else {
      console.log('❌ FAIL: Swarm appears FAKE');
    }
    
    console.log(`\nFinal Score: ${verification.overallScore}/100`);
    
  } finally {
    // Clean up
    console.log('\nCleaning up...');
    for (const proc of processes) {
      proc.kill();
    }
    console.log('Done.');
  }
}

runE2ETest().catch(console.error);
