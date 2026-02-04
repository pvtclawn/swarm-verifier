#!/bin/bash
# Register Swarm Verification Schema on Base

# Schema: bytes32 swarmHash, uint64 timestamp, uint8 score, uint8 verdict, uint8 agentCount, string evidenceUri
# - swarmHash: Hash of sorted agent IDs
# - timestamp: When verification was done
# - score: Overall score 0-100
# - verdict: 0=fake, 1=suspicious, 2=genuine
# - agentCount: Number of agents in swarm
# - evidenceUri: IPFS link to full verification data

SCHEMA="bytes32 swarmHash,uint64 timestamp,uint8 score,uint8 verdict,uint8 agentCount,string evidenceUri"
SCHEMA_REGISTRY="0x4200000000000000000000000000000000000020"
RESOLVER="0x0000000000000000000000000000000000000000"
REVOCABLE="true"

echo "Registering Swarm Verification Schema..."
echo "Schema: $SCHEMA"

# Write password
echo "$WALLET_PASSWORD" > /tmp/castpw

cast send "$SCHEMA_REGISTRY" \
  "register(string,address,bool)" \
  "$SCHEMA" \
  "$RESOLVER" \
  "$REVOCABLE" \
  --rpc-url https://mainnet.base.org \
  --account clawn \
  --password-file /tmp/castpw

rm /tmp/castpw

echo ""
echo "Done! Check the tx on basescan for the schema UID."
