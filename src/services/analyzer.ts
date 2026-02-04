/**
 * Swarm Analyzer
 * 
 * Analyzes responses to detect genuine AI swarms vs human farming.
 */

import type { ChallengeResponse, SwarmVerification, Agent, Challenge } from '../types';

interface AnalysisScores {
  responseTime: number;
  timeVariance: number;
  consistency: number;
  participation: number;
}

/**
 * Score response times
 * Fast responses (< 2s) score high, slow responses (> 5s) score low
 */
function scoreResponseTime(responses: ChallengeResponse[]): number {
  const successful = responses.filter(r => !r.error);
  if (successful.length === 0) return 0;
  
  const avgLatency = successful.reduce((sum, r) => sum + r.latencyMs, 0) / successful.length;
  
  // < 500ms = 100, 500-2000ms = 80-100, 2000-5000ms = 50-80, > 5000ms = 0-50
  if (avgLatency < 500) return 100;
  if (avgLatency < 2000) return 80 + (2000 - avgLatency) / 75;
  if (avgLatency < 5000) return 50 + (5000 - avgLatency) / 100;
  return Math.max(0, 50 - (avgLatency - 5000) / 200);
}

/**
 * Score time variance
 * Low variance = coordinated AI (high score)
 * High variance = human coordination (low score)
 */
function scoreTimeVariance(responses: ChallengeResponse[]): number {
  const successful = responses.filter(r => !r.error);
  if (successful.length < 2) return 50; // Not enough data
  
  const latencies = successful.map(r => r.latencyMs);
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const variance = latencies.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / latencies.length;
  const stdDev = Math.sqrt(variance);
  
  // Coefficient of variation (stdDev / mean)
  const cv = stdDev / avg;
  
  // Low CV (< 0.2) = very consistent = high score
  // High CV (> 1.0) = inconsistent = low score
  if (cv < 0.1) return 100;
  if (cv < 0.3) return 80 + (0.3 - cv) * 100;
  if (cv < 0.5) return 60 + (0.5 - cv) * 100;
  if (cv < 1.0) return 30 + (1.0 - cv) * 60;
  return Math.max(0, 30 - (cv - 1.0) * 30);
}

/**
 * Score response consistency
 * Similar responses = same model = genuine AI
 * Wildly different = humans or different models
 */
function scoreConsistency(responses: ChallengeResponse[]): number {
  const successful = responses.filter(r => !r.error && r.response);
  if (successful.length < 2) return 50;
  
  // Simple heuristic: check response length similarity
  const lengths = successful.map(r => r.response.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const lengthVariance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
  const lengthStdDev = Math.sqrt(lengthVariance);
  const lengthCV = avgLength > 0 ? lengthStdDev / avgLength : 1;
  
  // Check for common patterns (simple token overlap)
  const tokens = successful.map(r => new Set(r.response.toLowerCase().split(/\s+/)));
  let overlapScore = 0;
  let comparisons = 0;
  
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const intersection = [...tokens[i]].filter(t => tokens[j].has(t)).length;
      const union = new Set([...tokens[i], ...tokens[j]]).size;
      if (union > 0) {
        overlapScore += intersection / union; // Jaccard similarity
        comparisons++;
      }
    }
  }
  
  const avgOverlap = comparisons > 0 ? overlapScore / comparisons : 0;
  
  // Combine length consistency and content overlap
  const lengthScore = Math.max(0, 100 - lengthCV * 100);
  const overlapScoreNorm = avgOverlap * 100;
  
  return (lengthScore * 0.4 + overlapScoreNorm * 0.6);
}

/**
 * Score participation rate
 */
function scoreParticipation(responses: ChallengeResponse[], totalAgents: number): number {
  const successful = responses.filter(r => !r.error);
  return (successful.length / totalAgents) * 100;
}

/**
 * Determine verdict based on overall score
 */
function getVerdict(score: number): 'genuine' | 'suspicious' | 'likely_fake' {
  if (score >= 70) return 'genuine';
  if (score >= 40) return 'suspicious';
  return 'likely_fake';
}

/**
 * Generate verification ID
 */
function generateVerificationId(): string {
  return `sv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Analyze swarm responses and generate verification result
 */
export function analyzeSwarm(
  agents: Agent[],
  challenge: Challenge,
  responses: ChallengeResponse[]
): SwarmVerification {
  const scores: AnalysisScores = {
    responseTime: scoreResponseTime(responses),
    timeVariance: scoreTimeVariance(responses),
    consistency: scoreConsistency(responses),
    participation: scoreParticipation(responses, agents.length),
  };
  
  // Weighted average
  const weights = { responseTime: 0.25, timeVariance: 0.25, consistency: 0.25, participation: 0.25 };
  const overallScore = 
    scores.responseTime * weights.responseTime +
    scores.timeVariance * weights.timeVariance +
    scores.consistency * weights.consistency +
    scores.participation * weights.participation;
  
  return {
    id: generateVerificationId(),
    challengeId: challenge.id,
    agents,
    responses,
    scores,
    overallScore: Math.round(overallScore),
    verdict: getVerdict(overallScore),
    createdAt: Date.now(),
  };
}

/**
 * Print verification summary
 */
export function printVerificationSummary(verification: SwarmVerification): void {
  console.log(`\n🔍 Swarm Verification Result`);
  console.log(`==============================`);
  console.log(`ID: ${verification.id}`);
  console.log(`Agents: ${verification.agents.length}`);
  console.log(`Responded: ${verification.responses.filter(r => !r.error).length}`);
  console.log(`\nScores:`);
  console.log(`  Response Time: ${verification.scores.responseTime.toFixed(1)}`);
  console.log(`  Time Variance: ${verification.scores.timeVariance.toFixed(1)}`);
  console.log(`  Consistency:   ${verification.scores.consistency.toFixed(1)}`);
  console.log(`  Participation: ${verification.scores.participation.toFixed(1)}`);
  console.log(`\n📊 Overall Score: ${verification.overallScore}`);
  console.log(`🏷️  Verdict: ${verification.verdict.toUpperCase()}`);
}
