/**
 * Swarm Dispatcher
 * 
 * Sends challenges to multiple agents simultaneously and collects responses.
 */

import type { Agent, Challenge, ChallengeResponse } from '../types';
import { formatChallengeMessage } from './challenger';

interface DispatchResult {
  responses: ChallengeResponse[];
  totalAgents: number;
  respondedCount: number;
  avgLatencyMs: number;
}

/**
 * Send challenge to a single agent and measure response time
 */
async function challengeAgent(
  agent: Agent,
  challenge: Challenge,
  message: string
): Promise<ChallengeResponse> {
  const startTime = Date.now();
  
  try {
    // Try A2A-style endpoint first
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), challenge.expiresAt - Date.now());
    
    const response = await fetch(agent.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'challenge',
        challengeId: challenge.id,
        message,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    const receivedAt = Date.now();
    const data = await response.json();
    
    return {
      challengeId: challenge.id,
      agentId: agent.id,
      response: data.response || data.message || JSON.stringify(data),
      receivedAt,
      latencyMs: receivedAt - startTime,
    };
  } catch (error) {
    const receivedAt = Date.now();
    return {
      challengeId: challenge.id,
      agentId: agent.id,
      response: '',
      receivedAt,
      latencyMs: receivedAt - startTime,
      error: (error as Error).message,
    };
  }
}

/**
 * Dispatch challenge to all agents in parallel
 */
export async function dispatchChallenge(
  agents: Agent[],
  challenge: Challenge
): Promise<DispatchResult> {
  const message = formatChallengeMessage(challenge);
  
  console.log(`📡 Dispatching challenge ${challenge.id} to ${agents.length} agents...`);
  console.log(`   Prompt: "${challenge.prompt}"`);
  
  // Send to all agents simultaneously
  const startTime = Date.now();
  const promises = agents.map(agent => challengeAgent(agent, challenge, message));
  const responses = await Promise.all(promises);
  
  const totalTime = Date.now() - startTime;
  console.log(`   All responses collected in ${totalTime}ms`);
  
  // Calculate stats
  const successfulResponses = responses.filter(r => !r.error);
  const avgLatency = successfulResponses.length > 0
    ? successfulResponses.reduce((sum, r) => sum + r.latencyMs, 0) / successfulResponses.length
    : 0;
  
  return {
    responses,
    totalAgents: agents.length,
    respondedCount: successfulResponses.length,
    avgLatencyMs: avgLatency,
  };
}
