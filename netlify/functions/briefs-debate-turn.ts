import { createAdminClient } from '../../src/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const TAVILY_API_KEY = process.env.TAVILY_API_KEY

interface SearchResult {
  title: string
  url: string
  content: string
}

// Web search for evidence (optional - only if TAVILY_API_KEY is set)
async function searchForEvidence(query: string): Promise<SearchResult[]> {
  if (!TAVILY_API_KEY) return []
  
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 3,
      }),
    })
    
    const data = await response.json()
    return data.results?.map((r: any) => ({
      title: r.title,
      url: r.url,
      content: r.content?.slice(0, 200),
    })) || []
  } catch (error) {
    console.error('Search error:', error)
    return []
  }
}

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  try {
    const authHeader = event.headers.authorization
    if (!authHeader) return { statusCode: 401, body: 'Unauthorized' }

    const token = authHeader.replace('Bearer ', '')
    const supabase = await createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return { statusCode: 401, body: 'Unauthorized' }

    const { 
      brief_id, 
      minister_id, 
      turn_type, 
      turn_index, 
      previous_statements,
      user_interjection,
      search_query 
    } = JSON.parse(event.body)

    // Load data
    const [{ data: brief, error: briefError }, { data: minister, error: ministerError }] = await Promise.all([
      supabase.from('briefs').select('*').eq('id', brief_id).single(),
      supabase.from('cabinet_members').select('*').eq('id', minister_id).single()
    ])

    if (briefError) {
      console.error('Brief load error:', briefError)
      throw new Error(`Brief not found: ${brief_id}`)
    }
    if (ministerError) {
      console.error('Minister load error:', ministerError)
      throw new Error(`Minister not found: ${minister_id}. They may have been deleted or archived.`)
    }
    if (!brief || !minister) throw new Error('Brief or Minister not found')

    const context = brief.input_context
    
    // Optional: Search for evidence if requested
    let evidenceContext = ''
    if (search_query) {
      const results = await searchForEvidence(search_query)
      if (results.length > 0) {
        evidenceContext = `\n\nRELEVANT EVIDENCE FROM WEB SEARCH:\n${results.map(r => 
          `- ${r.title}: ${r.content} (Source: ${r.url})`
        ).join('\n')}\n`
      }
    }

    // Include user interjection if provided
    const interjectionContext = user_interjection 
      ? `\n\nUSER INTERJECTION: "${user_interjection}"\nAddress this new information in your response.\n`
      : ''

    let prompt = ''
    let messageType = turn_type || 'opening'

    if (turn_type === 'opening') {
      prompt = `You are ${minister.name}, a cabinet advisor with the role of ${minister.role}.

USER'S SITUATION:
- Goals: ${context.goals || 'Not specified'}
- Constraints: ${context.constraints || 'None specified'}
- Values: ${(context.values || []).join(', ') || 'Not specified'}
${evidenceContext}${interjectionContext}

YOUR TASK: Provide your opening statement with clear analysis and recommendation.
Include: 1) Your key insight 2) Your recommendation 3) One risk to consider
Keep it focused - 3-4 sentences total.

You MUST respond with valid JSON in this exact format:
{"content": "Your actual statement goes here as a string", "vote": "approve"}

The "content" field must contain your actual advice as a non-empty string.
The "vote" field must be exactly one of: "approve", "abstain", or "oppose".`
    } 
    else if (turn_type === 'rebuttal') {
      prompt = `You are ${minister.name}. Here's what other ministers said:

${previous_statements || 'No previous statements yet.'}
${evidenceContext}${interjectionContext}

YOUR TASK: Respond to ONE specific point from another minister.
- State whether you agree or disagree and WHY
- Keep it to 1-2 sentences
- Name which minister you're responding to

You MUST respond with valid JSON in this exact format:
{"content": "Your rebuttal goes here", "responding_to": "Minister Name"}`
    }
    else if (turn_type === 'cross_exam') {
      prompt = `You are ${minister.name} (Opposition Leader). Discussion so far:

${previous_statements || 'No discussion yet.'}
${interjectionContext}

YOUR TASK: Ask ONE pointed question that challenges the weakest argument.
Be specific - name the minister and quote their claim. Maximum 2 sentences.

You MUST respond with valid JSON in this exact format:
{"content": "Your challenging question goes here", "target_minister": "Minister Name"}`
    }
    else if (turn_type === 'closing') {
      prompt = `You are ${minister.name}. Full discussion:

${previous_statements || 'No discussion available.'}
${interjectionContext}

YOUR TASK: Give your final position in ONE sentence. State your vote clearly.

You MUST respond with valid JSON in this exact format:
{"content": "Your final statement goes here", "vote": "approve"}`
    }
    else if (turn_type === 'synthesis') {
      prompt = `You are the Prime Minister. Your cabinet has finished deliberating.

CABINET DISCUSSION:
${previous_statements || 'No discussion recorded.'}
${interjectionContext}

ORIGINAL CONTEXT:
- Goals: ${context.goals || 'Not specified'}
- Constraints: ${context.constraints || 'None'}

YOUR TASK: Synthesize the debate and present options to the user.

You MUST respond with valid JSON in this exact format:
{
  "summary": "One sentence summary of what the cabinet discussed and concluded",
  "consensus": "moderate",
  "options": [
    {"title": "Option A", "description": "What this option involves", "tradeoffs": "Key tradeoff to consider", "supporters": ["Minister Name"]}
  ]
}

Include 2-3 options. The "consensus" must be "strong", "moderate", or "weak".`
    }

    // Call OpenAI - handle GPT-5 vs GPT-4 parameter differences
    const maxTokens = turn_type === 'synthesis' ? 500 : turn_type === 'opening' ? 300 : 150
    const modelName = minister.model_name || 'gpt-4o-mini'
    const isGpt5 = modelName.startsWith('gpt-5') || modelName.startsWith('o1') || modelName.startsWith('o3')
    
    // GPT-5 models: no temperature, use max_completion_tokens
    // GPT-4 models: support temperature, use max_tokens
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: minister.system_prompt + '\nBe concise and direct. No filler words.' },
        { role: 'user', content: prompt },
      ],
      ...(isGpt5 ? {} : { temperature: minister.temperature || 0.7 }),
      response_format: { type: 'json_object' },
      ...(isGpt5 ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
    }, { timeout: 8000 })

    const rawContent = response.choices[0].message.content || '{}'
    console.log('OpenAI raw response:', rawContent)
    let result: any = {}
    try {
      result = JSON.parse(rawContent)
    } catch (e) {
      console.log('Failed to parse JSON, using raw content')
      result = { content: rawContent }
    }
    console.log('Parsed result:', result)
    
    // Ensure we have content - try multiple possible field names
    let finalContent = result.content || result.response || result.text || result.statement || result.answer
    
    // If still empty, use the raw response or a fallback
    if (!finalContent || finalContent === '{}' || finalContent.trim() === '') {
      console.log('Content was empty, using fallback')
      // Try to extract any string value from the result
      const anyValue = Object.values(result).find(v => typeof v === 'string' && v.length > 10)
      finalContent = anyValue as string || `[${minister.name} is thinking...]`
    }

    // Insert discussion message
    const { data: message, error: insertError } = await supabase.from('discussion_messages').insert({
      brief_id,
      turn_index,
      speaker_member_id: minister.id,
      speaker_role: minister.role,
      message_type: messageType,
      content: turn_type === 'synthesis' ? JSON.stringify(result) : finalContent,
      metadata: { 
        model: minister.model_name, 
        vote: result.vote,
        responding_to: result.responding_to || result.target_minister,
        had_evidence: !!evidenceContext,
        had_interjection: !!user_interjection,
      },
    }).select().single()
    
    if (insertError) {
      console.log('Discussion message insert error:', insertError)
    }

    // Save to brief_responses for backward compatibility
    if (turn_type === 'opening' || turn_type === 'closing' || turn_type === 'synthesis') {
      await supabase.from('brief_responses').insert({
        brief_id,
        cabinet_member_id: minister.id,
        response_text: turn_type === 'synthesis' ? JSON.stringify(result) : finalContent,
        vote: result.vote || 'abstain',
        metadata: turn_type === 'synthesis' ? { type: 'synthesis' } : { from_debate: true, turn_type },
      })
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message,
        content: finalContent,
        vote: result.vote,
        synthesis: turn_type === 'synthesis' ? result : undefined,
      }),
    }
  } catch (error: any) {
    console.error('Debate turn error:', error)
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}
