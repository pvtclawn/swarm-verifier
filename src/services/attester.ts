/**
 * Swarm Attester - On-chain attestation for verified swarms
 */

import { createPublicClient, createWalletClient, http, encodeAbiParameters, parseAbiParameters, keccak256, toBytes } from 'viem';
import { base } from 'viem/chains';
import type { SwarmVerification } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// EAS Contract on Base
const EAS_ADDRESS = '0x4200000000000000000000000000000000000021';

// Swarm Verification Schema (registered on Base)
// Schema: bytes32 swarmHash, uint64 timestamp, uint8 score, uint8 verdict, uint8 agentCount, string evidenceUri
export const SWARM_SCHEMA_UID = '0x8f43366d0b0c39dc7c3bf6c11cd76d97416d3e4759ed6d92880b3d4e28142097';

interface AttestationResult {
  uid: string;
  txHash: string;
}

/**
 * Hash the swarm (sorted agent IDs) using keccak256
 */
function hashSwarm(agentIds: string[]): `0x${string}` {
  const sorted = [...agentIds].sort();
  const combined = sorted.join(',');
  return keccak256(toBytes(combined));
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
 * Encode attestation data for EAS
 */
function encodeAttestationData(
  swarmHash: `0x${string}`,
  timestamp: bigint,
  score: number,
  verdict: number,
  agentCount: number,
  evidenceUri: string
): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters('bytes32, uint64, uint8, uint8, uint8, string'),
    [swarmHash, timestamp, score, verdict, agentCount, evidenceUri]
  );
}

/**
 * Attest a swarm verification on-chain using Foundry's cast
 */
export async function attestSwarm(
  verification: SwarmVerification,
  evidenceUri: string,
  walletPassword: string
): Promise<AttestationResult> {
  const swarmHash = hashSwarm(verification.agents.map(a => a.id));
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const score = verification.overallScore;
  const verdict = encodeVerdict(verification.verdict);
  const agentCount = verification.agents.length;
  
  const data = encodeAttestationData(swarmHash, timestamp, score, verdict, agentCount, evidenceUri);
  
  console.log(`\n🏅 Swarm Attestation`);
  console.log(`===================`);
  console.log(`Verification ID: ${verification.id}`);
  console.log(`Swarm Hash: ${swarmHash}`);
  console.log(`Score: ${score}`);
  console.log(`Verdict: ${verification.verdict}`);
  console.log(`Evidence: ${evidenceUri}`);
  
  // Build attestation request
  // Schema: (bytes32 schema, (address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data, uint256 value))
  const attestationRequest = `(${SWARM_SCHEMA_UID},(0x0000000000000000000000000000000000000000,0,true,0x0000000000000000000000000000000000000000000000000000000000000000,${data},0))`;
  
  // Write password to temp file
  const pwFile = '/tmp/castpw_swarm';
  await Bun.write(pwFile, walletPassword);
  
  try {
    const { stdout, stderr } = await execAsync(
      `/home/clawn/.foundry/bin/cast send ${EAS_ADDRESS} "attest((bytes32,(address,uint64,bool,bytes32,bytes,uint256)))" "${attestationRequest}" --rpc-url https://mainnet.base.org --account clawn --password-file ${pwFile}`,
      { timeout: 60000 }
    );
    
    // Parse tx hash from output
    const txHashMatch = stdout.match(/transactionHash\s+(\S+)/);
    const txHash = txHashMatch ? txHashMatch[1] : '';
    
    console.log(`✅ Attestation submitted!`);
    console.log(`TX: ${txHash}`);
    
    // Get the UID from logs
    const uidMatch = stdout.match(/topics.*\[\"0x[^\"]+\",\"(0x[^\"]+)\"\]/);
    const uid = uidMatch ? uidMatch[1] : `pending_${verification.id}`;
    
    return { uid, txHash };
    
  } catch (error) {
    console.error('Attestation failed:', error);
    throw error;
  } finally {
    // Clean up password file
    try {
      await Bun.write(pwFile, '');
    } catch {}
  }
}

/**
 * Upload verification evidence to IPFS via w3 CLI
 */
export async function uploadEvidence(verification: SwarmVerification): Promise<string> {
  const evidence = {
    version: '0.1',
    verificationId: verification.id,
    timestamp: new Date().toISOString(),
    agents: verification.agents.map(a => ({ id: a.id, name: a.name })),
    scores: verification.scores,
    overallScore: verification.overallScore,
    verdict: verification.verdict,
    responses: verification.responses?.map(r => ({
      agentId: r.agentId,
      latencyMs: r.latencyMs,
      hasError: !!r.error,
    })),
  };
  
  // Write to temp file
  const tempFile = `/tmp/swarm_evidence_${verification.id}.json`;
  await Bun.write(tempFile, JSON.stringify(evidence, null, 2));
  
  try {
    const { stdout } = await execAsync(`w3 up ${tempFile} --json`, { timeout: 30000 });
    const result = JSON.parse(stdout);
    const cid = result.root?.['/']; 
    
    if (cid) {
      console.log(`📦 Evidence uploaded: ${cid}`);
      return `https://w3s.link/ipfs/${cid}`;
    }
    
    // Fallback: try to extract CID from output
    const cidMatch = stdout.match(/bafy[a-zA-Z0-9]+/);
    if (cidMatch) {
      return `https://w3s.link/ipfs/${cidMatch[0]}`;
    }
    
    throw new Error('Failed to get CID from w3 output');
    
  } catch (error) {
    console.error('IPFS upload failed:', error);
    // Return mock URI as fallback
    return `ipfs://evidence/${verification.id}`;
  }
}
