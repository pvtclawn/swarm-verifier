/**
 * Real Swarm Test - Test with actual ERC-8004 agents
 */

import type { Agent } from './types';
import { generateChallenge } from './services/challenger';
import { dispatchChallenge } from './services/dispatcher';
import { analyzeSwarm, printVerificationSummary } from './services/analyzer';

// Load agents from sentry data
async function loadAgentsWithEndpoints(): Promise<Agent[]> {
  const file = Bun.file('../sentry/data/agents.json');
  const data = await file.json();
  
  const agents: Agent[] = [];
  
  for (const [id, agent] of Object.entries(data.agents)) {
    const a = agent as any;
    
    // Look for web endpoints in the signals or registration
    let endpoint = null;
    
    if (a.signals?.registration?.services) {
      for (const svc of a.signals.registration.services) {
        if (svc.endpoint && (svc.name === 'web' || svc.name === 'A2A' || svc.name === 'MCP')) {
          endpoint = svc.endpoint;
          break;
        }
      }
    }
    
    if (endpoint) {
      agents.push({
        id: a.tokenId,
        name: a.name || 'Unknown',
        endpoint,
        tokenId: a.tokenId,
      });
    }
  }
  
  return agents;
}

async function runRealTest() {
  console.log('🦞 Proof of Swarm - Real Agent Test\n');
  
  // Load agents with endpoints
  console.log('Loading agents from sentry database...');
  const allAgents = await loadAgentsWithEndpoints();
  console.log(`Found ${allAgents.length} agents with endpoints\n`);
  
  if (allAgents.length === 0) {
    console.log('No agents with endpoints found. Checking raw data...');
    
    const file = Bun.file('../sentry/data/agents.json');
    const data = await file.json();
    
    // Just take first 5 agents and use their URIs as endpoints
    const sampleAgents: Agent[] = [];
    let count = 0;
    
    for (const [id, agent] of Object.entries(data.agents)) {
      if (count >= 5) break;
      const a = agent as any;
      
      // Try to construct endpoint from agent data
      if (a.signals?.registration?.url) {
        sampleAgents.push({
          id: a.tokenId,
          name: a.name || 'Unknown',
          endpoint: a.signals.registration.url,
          tokenId: a.tokenId,
        });
        count++;
      }
    }
    
    if (sampleAgents.length > 0) {
      console.log(`Using ${sampleAgents.length} agents based on registration URLs\n`);
      await testAgents(sampleAgents);
    } else {
      console.log('\nNo suitable agents found. The test requires agents with HTTP endpoints.');
      console.log('This is expected - most ERC-8004 agents don\'t expose challenge endpoints yet.');
      console.log('\nThe SVP protocol (PROTOCOL.md) defines how agents should expose endpoints.');
    }
    return;
  }
  
  // Take up to 10 agents for testing
  const testAgentList = allAgents.slice(0, 10);
  await testAgents(testAgentList);
}

async function testAgents(agents: Agent[]) {
  console.log('═══════════════════════════════════════');
  console.log(`Testing ${agents.length} agents`);
  console.log('═══════════════════════════════════════\n');
  
  agents.forEach(a => {
    console.log(`  ${a.name} (#${a.id}): ${a.endpoint}`);
  });
  console.log('');
  
  // Generate and dispatch challenge
  const challenge = generateChallenge('parallel', agents.map(a => a.id), 15000);
  console.log(`\nChallenge: "${challenge.prompt}"\n`);
  
  const dispatchResult = await dispatchChallenge(agents, challenge, 15000);
  
  // Show individual responses
  console.log('\nResponses:');
  for (const r of dispatchResult.responses) {
    const agent = agents.find(a => a.id === r.agentId);
    if (r.error) {
      console.log(`  ❌ ${agent?.name}: ${r.error}`);
    } else {
      console.log(`  ✅ ${agent?.name}: "${r.response.slice(0, 50)}..." (${r.latencyMs}ms)`);
    }
  }
  
  // Analyze
  const verification = analyzeSwarm(agents, challenge, dispatchResult.responses);
  printVerificationSummary(verification);
  
  // Note about results
  console.log('\n📝 Note: Most agents will fail because they don\'t implement SVP yet.');
  console.log('   This is the baseline - once agents adopt the protocol, we can verify swarms.');
}

runRealTest().catch(console.error);
