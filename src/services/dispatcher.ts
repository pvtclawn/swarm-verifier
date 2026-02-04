/**
 * Swarm Dispatcher v2 - Real HTTP implementation
 * 
 * Sends SVP challenges to actual agent endpoints and collects responses.
 */

import type { Agent, Challenge, ChallengeResponse } from '../types';
import { formatChallengeMessage, generateNonce } from './challenger';

interface DispatchResult {
  responses: ChallengeResponse[];
  totalAgents: number;
  respondedCount: number;
  avgLatencyMs: number;
  timingStats: {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
    cv: number; // Coefficient of variation
  };
}

/**
 * Create SVP challenge payload
 */
function createChallengePayload(challenge: Challenge): object {
  return {
    version: "0.1",
    challengeId: challenge.id,
    type: "text",
    prompt: challenge.prompt,
    nonce: generateNonce(),
    timestamp: Date.now(),
    verifier: {
      id: "pvtclawn.base.eth",
    },
  };
}

/**
 * Try multiple endpoint patterns for an agent
 */
function getEndpointVariants(baseEndpoint: string): string[] {
  const base = baseEndpoint.replace(/\/$/, '');
  return [
    `${base}/.well-known/svp-challenge`,
    `${base}/api/challenge`,
    `${base}/challenge`,
    `${base}/verify`,
    base, // Try base endpoint as fallback
  ];
}

/**
 * Send challenge to a single agent and measure response time
 */
async function challengeAgent(
  agent: Agent,
  challenge: Challenge,
  payload: object,
  timeoutMs: number
): Promise<ChallengeResponse> {
  const startTime = Date.now();
  
  // If no endpoint, return error immediately
  if (!agent.endpoint) {
    return {
      challengeId: challenge.id,
      agentId: agent.id,
      response: '',
      receivedAt: Date.now(),
      latencyMs: 0,
      error: 'No endpoint configured',
    };
  }
  
  const endpoints = getEndpointVariants(agent.endpoint);
  
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SwarmVerifier/0.1 (pvtclawn.base.eth)',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      const receivedAt = Date.now();
      
      if (response.ok) {
        const data = await response.json() as { response?: string; message?: string; content?: string; processingTime?: number };
        const responseText = data.response || data.message || data.content || JSON.stringify(data);
        
        return {
          challengeId: challenge.id,
          agentId: agent.id,
          response: responseText,
          receivedAt,
          latencyMs: receivedAt - startTime,
          selfReportedMs: data.processingTime || parseInt(response.headers.get('X-SVP-Response-Time') || '0'),
        };
      }
      // If not OK, try next endpoint variant
    } catch (error) {
      // Try next endpoint variant
      continue;
    }
  }
  
  // All endpoints failed
  const receivedAt = Date.now();
  return {
    challengeId: challenge.id,
    agentId: agent.id,
    response: '',
    receivedAt,
    latencyMs: receivedAt - startTime,
    error: 'All endpoint variants failed',
  };
}

/**
 * Calculate timing statistics
 */
function calculateTimingStats(latencies: number[]): DispatchResult['timingStats'] {
  if (latencies.length === 0) {
    return { min: 0, max: 0, mean: 0, stdDev: 0, cv: 0 };
  }
  
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);
  const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  
  const variance = latencies.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / latencies.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;
  
  return { min, max, mean, stdDev, cv };
}

/**
 * Dispatch challenge to all agents in parallel
 */
export async function dispatchChallenge(
  agents: Agent[],
  challenge: Challenge,
  timeoutMs: number = 10000
): Promise<DispatchResult> {
  const payload = createChallengePayload(challenge);
  
  console.log(`📡 Dispatching challenge ${challenge.id} to ${agents.length} agents...`);
  console.log(`   Prompt: "${challenge.prompt}"`);
  
  // Send to all agents simultaneously
  const startTime = Date.now();
  const promises = agents.map(agent => challengeAgent(agent, challenge, payload, timeoutMs));
  const responses = await Promise.all(promises);
  
  const totalTime = Date.now() - startTime;
  console.log(`   All responses collected in ${totalTime}ms`);
  
  // Calculate stats
  const successfulResponses = responses.filter(r => !r.error);
  const latencies = successfulResponses.map(r => r.latencyMs);
  const avgLatency = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0;
  
  const timingStats = calculateTimingStats(latencies);
  
  console.log(`   Responded: ${successfulResponses.length}/${agents.length}`);
  if (successfulResponses.length > 0) {
    console.log(`   Timing: min=${timingStats.min}ms, max=${timingStats.max}ms, mean=${timingStats.mean.toFixed(0)}ms`);
    console.log(`   CV (coefficient of variation): ${timingStats.cv.toFixed(3)}`);
  }
  
  return {
    responses,
    totalAgents: agents.length,
    respondedCount: successfulResponses.length,
    avgLatencyMs: avgLatency,
    timingStats,
  };
}
