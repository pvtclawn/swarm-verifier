/**
 * Swarm Attester - On-chain attestation for verified swarms
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { keccak256, toBytes } from 'viem';
import type { SwarmVerification } from '../types';

// EAS Contract on Base
const EAS_ADDRESS = '0x4200000000000000000000000000000000000021';
const FOUNDRY_PATH = '/home/clawn/.foundry/bin';
const W3_PATH = '/home/clawn/.npm-global/bin/w3';

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
 * Attest a swarm verification on-chain using Foundry's cast
 */
export async function attestSwarm(
  verification: SwarmVerification,
  evidenceUri: string,
  walletPassword: string
): Promise<AttestationResult> {
  const swarmHash = hashSwarm(verification.agents.map(a => a.id));
  const timestamp = Math.floor(Date.now() / 1000);
  const score = verification.overallScore;
  const verdict = encodeVerdict(verification.verdict);
  const agentCount = verification.agents.length;
  
  console.log(`\n🏅 Swarm Attestation`);
  console.log(`===================`);
  console.log(`Verification ID: ${verification.id}`);
  console.log(`Swarm Hash: ${swarmHash}`);
  console.log(`Score: ${score}`);
  console.log(`Verdict: ${verification.verdict}`);
  console.log(`Evidence: ${evidenceUri}`);
  
  const pwFile = '/tmp/castpw_swarm';
  writeFileSync(pwFile, walletPassword);
  
  try {
    // Step 1: Encode the data using cast abi-encode
    const encodeCmd = `${FOUNDRY_PATH}/cast abi-encode "f(bytes32,uint64,uint8,uint8,uint8,string)" ${swarmHash} ${timestamp} ${score} ${verdict} ${agentCount} "${evidenceUri}"`;
    const data = execSync(encodeCmd, { encoding: 'utf8', timeout: 10000 }).trim();
    
    // Step 2: Build attestation struct
    const attestStruct = `(${SWARM_SCHEMA_UID},(0x0000000000000000000000000000000000000000,0,true,0x0000000000000000000000000000000000000000000000000000000000000000,${data},0))`;
    
    // Step 3: Send attestation
    const sendCmd = `${FOUNDRY_PATH}/cast send ${EAS_ADDRESS} "attest((bytes32,(address,uint64,bool,bytes32,bytes,uint256)))(bytes32)" "${attestStruct}" --rpc-url https://mainnet.base.org --account clawn --password-file ${pwFile}`;
    const result = execSync(sendCmd, { encoding: 'utf8', timeout: 60000 });
    
    // Parse tx hash from output
    const txMatch = result.match(/transactionHash\s+(\S+)/);
    const txHash = txMatch?.[1] ?? 'unknown';
    
    // Parse attestation UID from logs
    const uidMatch = result.match(/topics.*\[\"0x[^\"]+\",\"(0x[^\"]+)\"\]/);
    const uid = uidMatch?.[1] ?? 'unknown';
    
    console.log(`✅ Attestation submitted!`);
    console.log(`TX: https://basescan.org/tx/${txHash}`);
    
    return { uid, txHash };
    
  } catch (error) {
    console.error('Attestation failed:', error);
    throw error;
  } finally {
    // Clean up password file
    if (existsSync(pwFile)) {
      try { execSync(`rm ${pwFile}`); } catch {}
    }
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
    const result = execSync(`${W3_PATH} up ${tempFile} --json`, { encoding: 'utf8', timeout: 30000 });
    const parsed = JSON.parse(result);
    const cid = parsed.root?.['/'];
    
    if (cid) {
      console.log(`📦 Evidence uploaded: ${cid}`);
      return `https://w3s.link/ipfs/${cid}`;
    }
    
    // Fallback: try to extract CID from output
    const cidMatch = result.match(/bafy[a-zA-Z0-9]+/);
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
