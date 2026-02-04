/**
 * Swarm Verifier API Server
 * 
 * Public API for swarm verification.
 */

import type { Agent, ChallengeRequest, SwarmVerification } from './types';
import { generateChallenge } from './services/challenger';
import { dispatchChallenge } from './services/dispatcher';
import { analyzeSwarm, printVerificationSummary } from './services/analyzer';
import { attestSwarm, uploadEvidence } from './services/attester';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3403;

// In-memory store for verifications
const verifications = new Map<string, SwarmVerification>();

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    
    // Health check
    if (path === '/' || path === '/health') {
      return jsonResponse({
        status: 'ok',
        service: 'Proof of Swarm Verifier',
        version: '0.1.0',
        operator: 'PrivateClawn (pvtclawn.base.eth)',
        description: 'Verify agent networks are genuine AI, not humans farming',
        protocol: 'SVP v0.1',
        endpoints: {
          'POST /verify': 'Submit agents for swarm verification',
          'GET /result/:id': 'Get verification result',
          'GET /stats': 'Service statistics',
        },
      });
    }
    
    // Stats
    if (path === '/stats') {
      const results = Array.from(verifications.values());
      const genuine = results.filter(v => v.verdict === 'genuine').length;
      const suspicious = results.filter(v => v.verdict === 'suspicious').length;
      const fake = results.filter(v => v.verdict === 'likely_fake').length;
      
      return jsonResponse({
        totalVerifications: results.length,
        verdicts: { genuine, suspicious, likely_fake: fake },
        averageScore: results.length > 0 
          ? Math.round(results.reduce((sum, v) => sum + v.overallScore, 0) / results.length)
          : 0,
      });
    }
    
    // Submit verification request
    if (path === '/verify' && req.method === 'POST') {
      try {
        const body = await req.json() as ChallengeRequest;
        
        if (!body.agents || body.agents.length === 0) {
          return jsonResponse({ error: 'No agents provided' }, 400);
        }
        
        if (body.agents.length < 2) {
          return jsonResponse({ error: 'At least 2 agents required for swarm verification' }, 400);
        }
        
        const challengeType = body.challengeType || 'parallel';
        const timeoutMs = body.timeoutMs || 10000;
        
        // Generate challenge
        const agentIds = body.agents.map(a => a.id);
        const challenge = generateChallenge(challengeType, agentIds, timeoutMs);
        
        console.log(`\n🚀 New verification request`);
        console.log(`   Agents: ${body.agents.length}`);
        console.log(`   Type: ${challengeType}`);
        
        // Dispatch to all agents
        const dispatchResult = await dispatchChallenge(body.agents, challenge, timeoutMs);
        
        // Analyze results
        const verification = analyzeSwarm(body.agents, challenge, dispatchResult.responses);
        
        // Store result
        verifications.set(verification.id, verification);
        
        // Print summary
        printVerificationSummary(verification);
        
        // Upload evidence and attest (if genuine)
        let attestation = null;
        if (verification.verdict === 'genuine') {
          const evidenceUri = await uploadEvidence(verification);
          attestation = await attestSwarm(verification, evidenceUri);
        }
        
        return jsonResponse({
          verificationId: verification.id,
          overallScore: verification.overallScore,
          verdict: verification.verdict,
          details: {
            challenged: body.agents.length,
            responded: dispatchResult.respondedCount,
            avgLatencyMs: Math.round(dispatchResult.avgLatencyMs),
            timingStats: dispatchResult.timingStats,
            scores: verification.scores,
          },
          attestation,
        });
        
      } catch (error) {
        console.error('Verification error:', error);
        return jsonResponse({ error: (error as Error).message }, 500);
      }
    }
    
    // Get verification result
    const resultMatch = path.match(/^\/result\/(.+)$/);
    if (resultMatch && req.method === 'GET') {
      const id = resultMatch[1];
      const verification = verifications.get(id);
      
      if (!verification) {
        return jsonResponse({ error: 'Verification not found' }, 404);
      }
      
      return jsonResponse(verification);
    }
    
    return jsonResponse({ error: 'Not found' }, 404);
  },
});

console.log(`🦞 Proof of Swarm Verifier`);
console.log(`==========================`);
console.log(`Listening on http://localhost:${PORT}`);
console.log(`Operator: PrivateClawn (pvtclawn.base.eth)`);
console.log(`Protocol: SVP v0.1`);
console.log(`\nEndpoints:`);
console.log(`  GET  /health        - Health check`);
console.log(`  GET  /stats         - Service statistics`);
console.log(`  POST /verify        - Submit swarm for verification`);
console.log(`  GET  /result/:id    - Get verification result`);
