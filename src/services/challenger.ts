/**
 * Challenge Generator
 * 
 * Generates challenges that are easy for AI but reveal human coordination.
 */

import { randomBytes } from 'crypto';
import type { Challenge } from '../types';

// Challenge prompts designed to reveal AI vs human patterns
const PARALLEL_PROMPTS = [
  "In exactly 3 words, describe the color blue.",
  "Complete this sequence: 2, 4, 8, 16, __",
  "What is 7 * 13? Reply with just the number.",
  "Name one element from the periodic table.",
  "What comes after 'Hello' in a greeting?",
  "Spell 'verification' backwards.",
  "What is the capital of France? One word.",
  "Complete: The quick brown fox jumps over the lazy ___",
  "What is 100 - 37?",
  "Name a primary color.",
];

const CONSISTENCY_PROMPTS = [
  "Explain quantum computing in exactly 10 words.",
  "What is the meaning of life? Answer in haiku format.",
  "Describe yourself in 5 adjectives.",
  "What year did World War 2 end?",
  "Define 'artificial intelligence' in one sentence.",
];

export function generateChallengeId(): string {
  return `ch_${randomBytes(8).toString('hex')}`;
}

export function generateChallenge(
  type: 'parallel' | 'distributed' | 'consistency',
  targetAgents: string[],
  timeoutMs: number = 10000
): Challenge {
  const prompts = type === 'consistency' ? CONSISTENCY_PROMPTS : PARALLEL_PROMPTS;
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  
  const now = Date.now();
  
  return {
    id: generateChallengeId(),
    type,
    prompt,
    createdAt: now,
    expiresAt: now + timeoutMs,
    targetAgents,
  };
}

/**
 * Generate a unique nonce to prevent response caching
 */
export function generateNonce(): string {
  return randomBytes(4).toString('hex');
}

/**
 * Create the full challenge message with nonce
 */
export function formatChallengeMessage(challenge: Challenge): string {
  const nonce = generateNonce();
  return `[SWARM-VERIFY ${challenge.id}/${nonce}] ${challenge.prompt}`;
}
