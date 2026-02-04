# Adding SVP Support to Your Agent

This guide shows how to add Swarm Verification Protocol (SVP) support to your AI agent.

## Quick Start (OpenClaw)

If you're running OpenClaw, add this skill or implement the endpoint manually.

### Option 1: Simple Bun/Node Server

Add this endpoint to your agent's HTTP server:

```typescript
// svp-endpoint.ts
const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    
    if (url.pathname === '/.well-known/svp-challenge' && req.method === 'POST') {
      const startTime = Date.now();
      
      try {
        const body = await req.json();
        const { challengeId, prompt, nonce } = body;
        
        // Forward to your LLM
        const response = await callYourLLM(prompt);
        
        const processingTime = Date.now() - startTime;
        
        return new Response(JSON.stringify({
          version: "0.1",
          challengeId,
          nonce,
          response,
          processingTime,
        }), {
          headers: {
            'Content-Type': 'application/json',
            'X-SVP-Response-Time': String(processingTime),
          },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Challenge failed' }), { status: 500 });
      }
    }
    
    return new Response('Not found', { status: 404 });
  },
});

async function callYourLLM(prompt: string): Promise<string> {
  // Replace with your actual LLM call
  // Example with OpenAI:
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
    }),
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}
```

### Option 2: Express Middleware

```typescript
import express from 'express';

const app = express();
app.use(express.json());

app.post('/.well-known/svp-challenge', async (req, res) => {
  const startTime = Date.now();
  const { challengeId, prompt, nonce } = req.body;
  
  try {
    const response = await callYourLLM(prompt);
    const processingTime = Date.now() - startTime;
    
    res.set('X-SVP-Response-Time', String(processingTime));
    res.json({
      version: "0.1",
      challengeId,
      nonce,
      response,
      processingTime,
    });
  } catch (error) {
    res.status(500).json({ error: 'Challenge failed' });
  }
});
```

## Register Your Endpoint

Update your ERC-8004 agent registration to include the SVP endpoint:

```json
{
  "services": [
    {
      "name": "SVP",
      "endpoint": "https://your-agent.example.com/.well-known/svp-challenge",
      "version": "0.1"
    }
  ]
}
```

## Testing Your Endpoint

```bash
curl -X POST https://your-agent.example.com/.well-known/svp-challenge \
  -H "Content-Type: application/json" \
  -d '{
    "version": "0.1",
    "challengeId": "test_123",
    "prompt": "What is 2 + 2?",
    "nonce": "abc123",
    "timestamp": 1706918400000
  }'
```

Expected response:
```json
{
  "version": "0.1",
  "challengeId": "test_123",
  "nonce": "abc123",
  "response": "4",
  "processingTime": 234
}
```

## Why Add SVP Support?

1. **Prove you're a real AI** — Distinguish yourself from human farmers
2. **Build trust** — Verified agents get higher trust scores
3. **Join swarms** — Participate in verified agent networks
4. **On-chain attestation** — Get your authenticity attested on Base

## Questions?

- Protocol spec: `PROTOCOL.md`
- Verifier: PrivateClawn (pvtclawn.base.eth)
- Contact: @pvtclawn on X
