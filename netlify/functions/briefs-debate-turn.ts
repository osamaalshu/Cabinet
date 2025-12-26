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
      prompt = `CONTEXT:
Goals: ${context.goals}
Constraints: ${context.constraints}
Values: ${(context.values || []).join(', ')}
${evidenceContext}${interjectionContext}
Your role: ${minister.name} (${minister.role})

Provide your opening statement with clear analysis and recommendation.
Structure: 1) Key insight 2) Recommendation 3) One risk to consider
Keep it focused - 3-4 sentences total.

Respond as JSON: {"content": "your statement", "vote": "approve" | "abstain" | "oppose"}`
    } 
    else if (turn_type === 'rebuttal') {
      prompt = `PREVIOUS STATEMENTS:
${previous_statements}
${evidenceContext}${interjectionContext}
Your role: ${minister.name}

DEBATE RULES:
- Directly address ONE specific point from another minister
- State whether you agree or disagree and WHY
- Keep it sharp: 1-2 sentences only
- Name the minister you're responding to

Respond as JSON: {"content": "your rebuttal", "responding_to": "minister name"}`
    }
    else if (turn_type === 'cross_exam') {
      prompt = `DISCUSSION SO FAR:
${previous_statements}
${interjectionContext}
Your role: ${minister.name} (Opposition Leader)

Ask ONE pointed question that challenges the weakest argument made.
Be specific - name the minister and quote their claim.
Maximum 2 sentences.

Respond as JSON: {"content": "your question", "target_minister": "name"}`
    }
    else if (turn_type === 'closing') {
      prompt = `FULL DISCUSSION:
${previous_statements}
${interjectionContext}
Your role: ${minister.name}

Final position in ONE sentence. State your vote clearly.

Respond as JSON: {"content": "closing statement", "vote": "approve" | "abstain" | "oppose"}`
    }
    else if (turn_type === 'synthesis') {
      prompt = `CABINET DISCUSSION:
${previous_statements}
${interjectionContext}
ORIGINAL CONTEXT:
Goals: ${context.goals}
Constraints: ${context.constraints}

As Prime Minister, provide:
1. One-sentence summary of the debate
2. 2-3 clear options with pros/cons

Respond as JSON:
{
  "summary": "The cabinet [agreed/was divided] on...",
  "consensus": "strong" | "moderate" | "weak",
  "options": [{"title": "Option", "description": "What to do", "tradeoffs": "Key tradeoff", "supporters": ["names"]}]
}`
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

    const result = JSON.parse(response.choices[0].message.content || '{}')

    // Insert discussion message
    const { data: message } = await supabase.from('discussion_messages').insert({
      brief_id,
      turn_index,
      speaker_member_id: minister.id,
      speaker_role: minister.role,
      message_type: messageType,
      content: turn_type === 'synthesis' ? JSON.stringify(result) : result.content,
      metadata: { 
        model: minister.model_name, 
        vote: result.vote,
        responding_to: result.responding_to || result.target_minister,
        had_evidence: !!evidenceContext,
        had_interjection: !!user_interjection,
      },
    }).select().single()

    // Save to brief_responses for backward compatibility
    if (turn_type === 'opening' || turn_type === 'closing' || turn_type === 'synthesis') {
      await supabase.from('brief_responses').insert({
        brief_id,
        cabinet_member_id: minister.id,
        response_text: turn_type === 'synthesis' ? JSON.stringify(result) : result.content,
        vote: result.vote || 'abstain',
        metadata: turn_type === 'synthesis' ? { type: 'synthesis' } : { from_debate: true, turn_type },
      })
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message,
        content: result.content,
        vote: result.vote,
        synthesis: turn_type === 'synthesis' ? result : undefined,
      }),
    }
  } catch (error: any) {
    console.error('Debate turn error:', error)
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}
