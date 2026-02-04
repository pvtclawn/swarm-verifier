/**
 * Deploy SwarmChallenge contract to Base Mainnet
 */
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const FOUNDRY_PATH = join(process.env.HOME!, '.foundry/bin');

// Load wallet - use spawn to avoid shell escaping issues
function getPrivateKey(): Hex {
  const secretsPath = process.env.VAULT_PATH;
  if (!secretsPath) {
    throw new Error('VAULT_PATH environment variable not set');
  }
  
  const secrets = JSON.parse(readFileSync(secretsPath, 'utf-8'));
  const password = secrets.WALLET_PASSWORD;
  
  // Get private key from foundry keystore 
  // Use spawnSync to avoid shell escaping issues with special chars in password
  const result = require('child_process').spawnSync(
    `${FOUNDRY_PATH}/cast`,
    ['wallet', 'decrypt-keystore', 'clawn', '--unsafe-password', password],
    { encoding: 'utf8', timeout: 30000 }
  );
  
  if (result.error || result.status !== 0) {
    throw new Error(`Failed to decrypt keystore: ${result.stderr || result.error}`);
  }
  
  // Output is like "clawn's private key is: 0x..."
  const match = result.stdout.match(/0x[a-fA-F0-9]{64}/);
  if (!match) {
    throw new Error('Could not extract private key from output');
  }
  
  return match[0] as Hex;
}

async function deploy() {
  console.log('🚀 Deploying SwarmChallenge to Base Mainnet...\n');
  
  // Get private key
  const privateKey = getPrivateKey();
  const account = privateKeyToAccount(privateKey);
  console.log(`📍 Deployer: ${account.address}`);
  
  // Create clients
  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });
  
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  });
  
  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance: ${Number(balance) / 1e18} ETH`);
  
  if (balance < 500000000000000n) { // 0.0005 ETH min
    console.error('❌ Insufficient balance for deployment');
    process.exit(1);
  }
  
  // Load bytecode from compiled contract
  const artifactPath = `${process.cwd()}/out/SwarmChallenge.sol/SwarmChallenge.json`;
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
  const bytecode = artifact.bytecode.object as Hex;
  
  console.log(`📦 Bytecode size: ${bytecode.length / 2 - 1} bytes`);
  
  // Deploy
  console.log('\n⏳ Sending deployment transaction...');
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode,
  });
  
  console.log(`📤 TX: https://basescan.org/tx/${hash}`);
  
  // Wait for receipt
  console.log('⏳ Waiting for confirmation...');
  const receipt = await publicClient.waitForTransactionReceipt({ 
    hash,
    timeout: 60_000,
  });
  
  if (receipt.status !== 'success') {
    console.error('❌ Deployment failed!');
    process.exit(1);
  }
  
  const contractAddress = receipt.contractAddress!;
  console.log(`\n✅ SwarmChallenge deployed!`);
  console.log(`📍 Contract: ${contractAddress}`);
  console.log(`🔗 https://basescan.org/address/${contractAddress}`);
  console.log(`⛽ Gas used: ${receipt.gasUsed}`);
  
  // Output for updating config
  console.log('\n📝 Update contract-client.ts with:');
  console.log(`  mainnet: '${contractAddress}' as Address,`);
  
  return contractAddress;
}

deploy().catch(err => {
  console.error('❌ Deployment failed:', err);
  process.exit(1);
});
