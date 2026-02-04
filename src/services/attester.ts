/**
 * Swarm Attester - On-chain attestation for verified swarms
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import type { SwarmVerification } from '../types';

// EAS Contract on Base
const EAS_ADDRESS = '0x4200000000000000000000000000000000000021';

// Swarm Verification Schema (registered on Base)
// Schema: bytes32 swarmHash, uint64 timestamp, uint8 score, uint8 verdict, uint8 agentCount, string evidenceUri
export const SWARM_SCHEMA_UID = '0x8f43366d0b0c39dc7c3bf6c11cd76d97416d3e4759ed6d92880b3d4e28142097';

const EAS_ABI = parseAbi([
  'function attest((bytes32 schema, (address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data, uint256 value) data)) external payable returns (bytes32)',
]);

interface AttestationResult {
  uid: string;
  txHash: string;
}

/**
 * Hash the swarm (sorted agent IDs)
 */
function hashSwarm(agentIds: string[]): `0x${string}` {
  const sorted = [...agentIds].sort();
  const combined = sorted.join(',');
  // Simple hash for now - in production use keccak256
  const hash = Buffer.from(combined).toString('hex').padStart(64, '0').slice(0, 64);
  return `0x${hash}`;
}

/**
 * Encode verdict to uint8
 */
function encodeVerdict(verdict: 'genuine' | 'suspicious' | 'likely_fake'): number {
  switch (verdict) {
    case 'genuine': return 2;
    case 'suspicious': return 1;
    case 'likely_fake': return 0;
  }
}

/**
 * Encode attestation data
 */
function encodeAttestationData(
  swarmHash: `0x${string}`,
  timestamp: number,
  score: number,
  verdict: number,
  agentCount: number,
  evidenceUri: string
): `0x${string}` {
  // ABI encode: bytes32, uint64, uint8, uint8, uint8, string
  // For simplicity, pack into hex
  const timestampHex = timestamp.toString(16).padStart(16, '0');
  const scoreHex = score.toString(16).padStart(2, '0');
  const verdictHex = verdict.toString(16).padStart(2, '0');
  const countHex = agentCount.toString(16).padStart(2, '0');
  
  // This is simplified - in production use proper ABI encoding
  return `${swarmHash}${timestampHex}${scoreHex}${verdictHex}${countHex}` as `0x${string}`;
}

/**
 * Attest a swarm verification on-chain
 */
export async function attestSwarm(
  verification: SwarmVerification,
  evidenceUri: string
): Promise<AttestationResult> {
  // For now, just log what we would attest
  console.log(`\n🏅 Swarm Attestation (dry run)`);
  console.log(`==============================`);
  console.log(`Verification ID: ${verification.id}`);
  console.log(`Agents: ${verification.agents.length}`);
  console.log(`Score: ${verification.overallScore}`);
  console.log(`Verdict: ${verification.verdict}`);
  console.log(`Evidence: ${evidenceUri}`);
  
  const swarmHash = hashSwarm(verification.agents.map(a => a.id));
  console.log(`Swarm Hash: ${swarmHash}`);
  
  // TODO: Actually submit to EAS when schema is registered
  // For now, return mock result
  return {
    uid: `mock_${verification.id}`,
    txHash: `0x${'0'.repeat(64)}`,
  };
}

/**
 * Upload verification evidence to IPFS
 */
export async function uploadEvidence(verification: SwarmVerification): Promise<string> {
  // For now, return mock URI
  // In production, upload to web3.storage
  const mockCid = `bafybeig${verification.id.replace(/[^a-z0-9]/g, '')}`;
  return `https://w3s.link/ipfs/${mockCid}`;
}
