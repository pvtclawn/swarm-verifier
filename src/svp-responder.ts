/**
 * SVP Responder - A simple SVP endpoint for testing
 * 
 * Run this to expose an SVP challenge endpoint.
 */

const PORT = process.env.SVP_PORT ? parseInt(process.env.SVP_PORT) : 3500;
const AGENT_ID = process.env.AGENT_ID || 'test-agent-1';

// Simple response generator (simulates LLM)
function generateResponse(prompt: string): string {
  // Simple pattern matching for test prompts
  const responses: Record<string, string> = {
    'In exactly 3 words, describe the color blue.': 'Calm cool vast',
    'Complete this sequence: 2, 4, 8, 16, __': '32',
    'What is 7 * 13? Reply with just the number.': '91',
    'Name one element from the periodic table.': 'Hydrogen',
    "What comes after 'Hello' in a greeting?": 'World',
    "Spell 'verification' backwards.": 'noitacifirev',
    'What is the capital of France? One word.': 'Paris',
    'Complete: The quick brown fox jumps over the lazy ___': 'dog',
    'What is 100 - 37?': '63',
    'Name a primary color.': 'Blue',
  };
  
  // Check for exact match
  if (responses[prompt]) {
    return responses[prompt];
  }
  
  // Check for partial match
  for (const [key, value] of Object.entries(responses)) {
    if (prompt.includes(key.slice(0, 20))) {
      return value;
    }
  }
  
  return 'I can answer that question.';
}

// Simulate realistic LLM timing (200-600ms)
async function simulateInference(): Promise<void> {
  const delay = 200 + Math.random() * 400;
  await new Promise(r => setTimeout(r, delay));
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    
    // Health check
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'SVP Responder',
        agentId: AGENT_ID,
        endpoint: '/.well-known/svp-challenge',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // SVP Challenge endpoint
    if (url.pathname === '/.well-known/svp-challenge' && req.method === 'POST') {
      const startTime = Date.now();
      
      try {
        const body = await req.json() as { challengeId?: string; prompt?: string; nonce?: string; version?: string };
        const { challengeId, prompt, nonce, version } = body;
        
        if (!challengeId || !prompt || !nonce) {
          return new Response(JSON.stringify({ 
            error: 'Missing required fields: challengeId, prompt, nonce' 
          }), { status: 400 });
        }
        
        // Simulate LLM inference
        await simulateInference();
        
        // Generate response
        const response = generateResponse(prompt);
        const processingTime = Date.now() - startTime;
        
        console.log(`[SVP] Challenge ${challengeId}: "${prompt.slice(0, 30)}..." → "${response}" (${processingTime}ms)`);
        
        return new Response(JSON.stringify({
          version: version || "0.1",
          challengeId,
          nonce,
          response,
          agentId: AGENT_ID,
          processingTime,
        }), {
          headers: {
            'Content-Type': 'application/json',
            'X-SVP-Response-Time': String(processingTime),
          },
        });
        
      } catch (error) {
        console.error('[SVP] Error:', error);
        return new Response(JSON.stringify({ 
          error: 'Challenge processing failed' 
        }), { status: 500 });
      }
    }
    
    return new Response('Not found', { status: 404 });
  },
});

console.log(`🤖 SVP Responder (Agent: ${AGENT_ID})`);
console.log(`================================`);
console.log(`Listening on http://localhost:${PORT}`);
console.log(`\nEndpoints:`);
console.log(`  GET  /health                     - Health check`);
console.log(`  POST /.well-known/svp-challenge  - SVP challenge endpoint`);
console.log(`\nTest with:`);
console.log(`  curl -X POST http://localhost:${PORT}/.well-known/svp-challenge \\`);
console.log(`    -H "Content-Type: application/json" \\`);
console.log(`    -d '{"challengeId":"test","prompt":"What is 2+2?","nonce":"abc"}'`);
