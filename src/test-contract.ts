import { SwarmChallengeClient } from './services/contract-client';

async function main() {
  // Just test the client can be imported and instantiated
  console.log('SwarmChallengeClient imported successfully');
  console.log('Contract address (sepolia):', '0xded4B58c1C4E5858098a70DfcF77B0b6a4c3aE0F');
  
  // Test prepare commit
  const mockKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`;
  const client = new SwarmChallengeClient(mockKey, 'sepolia');
  
  const commitData = client.prepareCommit('test answer');
  console.log('Commit prepared:', {
    answer: commitData.answer,
    salt: commitData.salt.slice(0, 20) + '...',
    commitHash: commitData.commitHash.slice(0, 20) + '...',
  });
  
  console.log('✅ Contract client works!');
}

main().catch(console.error);
