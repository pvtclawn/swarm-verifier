/**
 * Demo: Simulate swarm verification with mock agents
 */

import type { Agent, ChallengeResponse } from './types';
import { generateChallenge, formatChallengeMessage } from './services/challenger';
import { analyzeSwarm, printVerificationSummary } from './services/analyzer';

// Simulate AI agent responses (fast, consistent)
function simulateAIResponse(prompt: string, agentIndex: number): { response: string; latencyMs: number } {
  // AI responds quickly (200-800ms) with consistent patterns
  const baseLatency = 300 + Math.random() * 400;
  const latency = baseLatency + (agentIndex * 20); // Slight sequential delay
  
  // Consistent responses based on prompt
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
  
  const response = responses[prompt] || 'I can help with that question.';
  
  return { response, latencyMs: Math.round(latency) };
}

// Simulate human responses (slow, variable)
function simulateHumanResponse(prompt: string, agentIndex: number): { response: string; latencyMs: number } {
  // Humans respond slowly (2-8s) with high variance
  const baseLatency = 2000 + Math.random() * 6000;
  const latency = baseLatency + (agentIndex * 500); // More sequential delay
  
  // Variable responses
  const variations = [
    'The answer is 32',
    'thirty-two',
    '32!',
    'I think it\'s 32',
    '32 comes next',
  ];
  
  const response = variations[Math.floor(Math.random() * variations.length)];
  
  return { response, latencyMs: Math.round(latency) };
}

async function runDemo() {
  console.log('🦞 Proof of Swarm - Demo\n');
  
  // Create mock agents
  const aiAgents: Agent[] = Array.from({ length: 5 }, (_, i) => ({
    id: `ai_agent_${i + 1}`,
    name: `AI Agent ${i + 1}`,
    endpoint: `http://mock/agent/${i + 1}`,
  }));
  
  const humanAgents: Agent[] = Array.from({ length: 5 }, (_, i) => ({
    id: `human_agent_${i + 1}`,
    name: `Human Faker ${i + 1}`,
    endpoint: `http://mock/faker/${i + 1}`,
  }));
  
  // Test 1: AI Swarm
  console.log('═══════════════════════════════════════');
  console.log('TEST 1: Genuine AI Swarm (5 agents)');
  console.log('═══════════════════════════════════════');
  
  const aiChallenge = generateChallenge('parallel', aiAgents.map(a => a.id));
  
  // Simulate responses
  const aiResponses: ChallengeResponse[] = aiAgents.map((agent, i) => {
    const sim = simulateAIResponse(aiChallenge.prompt, i);
    return {
      challengeId: aiChallenge.id,
      agentId: agent.id,
      response: sim.response,
      receivedAt: Date.now() + sim.latencyMs,
      latencyMs: sim.latencyMs,
    };
  });
  
  console.log(`\nChallenge: "${aiChallenge.prompt}"`);
  console.log(`\nResponses:`);
  aiResponses.forEach(r => {
    console.log(`  ${r.agentId}: "${r.response}" (${r.latencyMs}ms)`);
  });
  
  const aiVerification = analyzeSwarm(aiAgents, aiChallenge, aiResponses);
  printVerificationSummary(aiVerification);
  
  // Test 2: Human Faker Swarm
  console.log('\n\n═══════════════════════════════════════');
  console.log('TEST 2: Human Faker Swarm (5 agents)');
  console.log('═══════════════════════════════════════');
  
  const humanChallenge = generateChallenge('parallel', humanAgents.map(a => a.id));
  
  const humanResponses: ChallengeResponse[] = humanAgents.map((agent, i) => {
    const sim = simulateHumanResponse(humanChallenge.prompt, i);
    return {
      challengeId: humanChallenge.id,
      agentId: agent.id,
      response: sim.response,
      receivedAt: Date.now() + sim.latencyMs,
      latencyMs: sim.latencyMs,
    };
  });
  
  console.log(`\nChallenge: "${humanChallenge.prompt}"`);
  console.log(`\nResponses:`);
  humanResponses.forEach(r => {
    console.log(`  ${r.agentId}: "${r.response}" (${r.latencyMs}ms)`);
  });
  
  const humanVerification = analyzeSwarm(humanAgents, humanChallenge, humanResponses);
  printVerificationSummary(humanVerification);
  
  // Summary
  console.log('\n\n═══════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`AI Swarm Score:    ${aiVerification.overallScore} (${aiVerification.verdict})`);
  console.log(`Human Swarm Score: ${humanVerification.overallScore} (${humanVerification.verdict})`);
  console.log('\n✅ Demo complete!');
}

runDemo().catch(console.error);
