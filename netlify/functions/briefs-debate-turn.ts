import { createAdminClient } from '../../src/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Single debate turn - fast, no timeout issues
export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  try {
    const authHeader = event.headers.authorization
    if (!authHeader) return { statusCode: 401, body: 'Unauthorized' }

    const token = authHeader.replace('Bearer ', '')
    const supabase = await createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return { statusCode: 401, body: 'Unauthorized' }

    const { brief_id, minister_id, turn_type, turn_index, previous_statements } = JSON.parse(event.body)

    // Load data
    const [{ data: brief }, { data: minister }] = await Promise.all([
      supabase.from('briefs').select('*').eq('id', brief_id).single(),
      supabase.from('cabinet_members').select('*').eq('id', minister_id).single()
    ])

    if (!brief || !minister) throw new Error('Brief or Minister not found')

    const context = brief.input_context
    let prompt = ''
    let messageType = turn_type || 'opening'

    if (turn_type === 'opening') {
      prompt = `CONTEXT:
Goals: ${context.goals}
Constraints: ${context.constraints}
Values: ${(context.values || []).join(', ')}

Your role: ${minister.name} (${minister.role})

Provide your analysis and recommendation (2-3 sentences). Be concise.
Respond as JSON: {"content": "your advice", "vote": "approve" | "abstain" | "oppose"}`
    } 
    else if (turn_type === 'rebuttal') {
      prompt = `CONTEXT:
Goals: ${context.goals}

PREVIOUS STATEMENTS:
${previous_statements}

Your role: ${minister.name} (${minister.role})

Respond to your colleagues. Reference at least one other minister's point. Be brief (2 sentences).
Respond as JSON: {"content": "your rebuttal"}`
    }
    else if (turn_type === 'synthesis') {
      prompt = `CABINET DISCUSSION:
${previous_statements}

ORIGINAL CONTEXT:
Goals: ${context.goals}
Constraints: ${context.constraints}
Values: ${(context.values || []).join(', ')}

As Prime Minister, synthesize this into 2-3 actionable options.
Respond as JSON:
{
  "summary": "Brief synthesis (2 sentences)",
  "options": [{"title": "Option name", "description": "What it entails", "tradeoffs": "Key tradeoffs"}]
}`
    }

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: minister.model_name || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: minister.system_prompt },
        { role: 'user', content: prompt },
      ],
      temperature: minister.temperature,
      response_format: { type: 'json_object' },
      max_tokens: turn_type === 'synthesis' ? 400 : 200,
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
      },
    }).select().single()

    // For opening statements, also save to brief_responses for backward compatibility
    if (turn_type === 'opening' || turn_type === 'synthesis') {
      await supabase.from('brief_responses').insert({
        brief_id,
        cabinet_member_id: minister.id,
        response_text: turn_type === 'synthesis' ? JSON.stringify(result) : result.content,
        vote: result.vote || 'abstain',
        metadata: turn_type === 'synthesis' ? { type: 'synthesis' } : { from_debate: true },
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

