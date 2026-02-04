/**
 * Swarm Verifier Types
 */

export interface Agent {
  id: string;
  name: string;
  endpoint: string; // A2A or HTTP endpoint
  tokenId?: string; // ERC-8004 token ID if registered
}

export interface Challenge {
  id: string;
  type: 'parallel' | 'distributed' | 'consistency';
  prompt: string;
  createdAt: number;
  expiresAt: number;
  targetAgents: string[]; // Agent IDs
}

export interface ChallengeResponse {
  challengeId: string;
  agentId: string;
  response: string;
  receivedAt: number; // Unix timestamp ms
  latencyMs: number;
  error?: string;
}

export interface SwarmVerification {
  id: string;
  challengeId: string;
  agents: Agent[];
  responses: ChallengeResponse[];
  
  // Scores (0-100)
  scores: {
    responseTime: number;    // Fast responses = higher
    timeVariance: number;    // Low variance = higher (coordinated AI)
    consistency: number;     // Similar responses = higher (same model)
    participation: number;   // % responded = higher
  };
  
  overallScore: number;
  verdict: 'genuine' | 'suspicious' | 'likely_fake';
  
  attestationId?: string; // EAS attestation UID
  createdAt: number;
}

export interface ChallengeRequest {
  agents: Agent[];
  challengeType?: 'parallel' | 'distributed' | 'consistency';
  timeoutMs?: number;
}

export interface VerificationResult {
  verificationId: string;
  overallScore: number;
  verdict: 'genuine' | 'suspicious' | 'likely_fake';
  details: SwarmVerification;
}
