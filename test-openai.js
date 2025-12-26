// Simple test script to verify OpenAI API calls work correctly
// Run with: node test-openai.js

const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testMinisterResponse() {
  console.log('Testing OpenAI API with minister prompt...\n');
  console.log('API Key present:', !!process.env.OPENAI_API_KEY);
  console.log('API Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 10) + '...\n');

  const testPrompt = `You are Minister of Economy, a cabinet advisor with the role of Opportunity Cost.

USER'S SITUATION:
- Goals: Should I take a new job offer?
- Constraints: Need to relocate, higher salary but more stress
- Values: Family, Growth, Stability

YOUR TASK: Provide your opening statement with clear analysis and recommendation.
Include: 1) Your key insight 2) Your recommendation 3) One risk to consider
Keep it focused - 3-4 sentences total.

You MUST respond with valid JSON in this exact format:
{"content": "Your actual statement goes here as a string", "vote": "approve"}

The "content" field must contain your actual advice as a non-empty string.
The "vote" field must be exactly one of: "approve", "abstain", or "oppose".`;

  try {
    console.log('Sending request to OpenAI (gpt-4o-mini)...\n');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a cabinet minister advisor. Be concise and direct.' },
        { role: 'user', content: testPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 300,
    });

    const rawContent = response.choices[0].message.content;
    console.log('=== RAW RESPONSE ===');
    console.log(rawContent);
    console.log('\n=== PARSED ===');
    
    try {
      const parsed = JSON.parse(rawContent);
      console.log('Content:', parsed.content);
      console.log('Vote:', parsed.vote);
      console.log('\n✅ SUCCESS! The API is working correctly.');
    } catch (e) {
      console.log('❌ Failed to parse JSON:', e.message);
    }

  } catch (error) {
    console.error('❌ API ERROR:', error.message);
    if (error.code) console.error('Error code:', error.code);
    if (error.status) console.error('Status:', error.status);
  }
}

// Test GPT-5 with Responses API (new API for GPT-5)
async function testGpt5() {
  console.log('\n\n--- Testing GPT-5 models ---\n');
  
  const testPrompt = `You are Minister of Ethics. Provide advice about taking a new job.
Respond with JSON: {"content": "your advice here", "vote": "approve"}`;

  // Test different model names
  const modelsToTest = ['gpt-5-nano', 'gpt-5-mini', 'gpt-5'];
  
  for (const model of modelsToTest) {
    console.log(`\nTesting ${model}...`);
    
    // Try Responses API first (new GPT-5 API)
    try {
      const response = await openai.responses.create({
        model: model,
        input: testPrompt,
      });
      console.log(`✅ ${model} with Responses API:`, response.output_text?.substring(0, 100));
      continue;
    } catch (e) {
      console.log(`   Responses API not available for ${model}: ${e.message}`);
    }
    
    // Fall back to Chat Completions
    try {
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'user', content: testPrompt },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 200,
      });
      const content = response.choices[0].message.content;
      if (content && content.length > 5) {
        console.log(`✅ ${model} with Chat Completions:`, content.substring(0, 100));
      } else {
        console.log(`❌ ${model} returned empty/short response:`, content);
      }
    } catch (error) {
      console.log(`❌ ${model} error:`, error.message);
    }
  }
}

// Run tests
testMinisterResponse().then(() => testGpt5());

