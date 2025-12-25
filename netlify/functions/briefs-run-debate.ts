import { createAdminClient } from '../../src/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface Minister {
  id: string
  name: string
  role: string
  system_prompt: string
  model_name: string
  temperature: number
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

    const { brief_id } = JSON.parse(event.body)

    // Load brief and ministers
    const { data: brief } = await supabase.from('briefs').select('*').eq('id', brief_id).single()
    if (!brief) throw new Error('Brief not found')

    const { data: ministers } = await supabase
      .from('cabinet_members')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_enabled', true)
      .order('seat_index')

    if (!ministers?.length) throw new Error('No ministers found')

    // Update brief status
    await supabase.from('briefs').update({ status: 'running' }).eq('id', brief_id)

    const regularMinisters = ministers.filter((m: Minister) => m.role !== 'Synthesizer').slice(0, 3) // Limit to 3 for speed
    const pmMinister = ministers.find((m: Minister) => m.role === 'Synthesizer')

    let turnIndex = 0
    const context = brief.input_context

    // Helper to insert message
    async function insertMessage(msg: any) {
      await supabase.from('discussion_messages').insert({ ...msg, brief_id })
    }

    // System message
    await insertMessage({
      turn_index: turnIndex++,
      speaker_member_id: null,
      speaker_role: 'system',
      message_type: 'system',
      content: '📢 Cabinet session begins.',
      metadata: { phase: 'opening' },
    })

    // Run all ministers in PARALLEL for speed
    const ministerPromises = regularMinisters.map(async (minister: Minister, idx: number) => {
      const prompt = `CONTEXT:
Goals: ${context.goals}
Constraints: ${context.constraints}
Values: ${(context.values || []).join(', ')}

Your role: ${minister.name} (${minister.role})

Give brief advice (2-3 sentences max). Respond as JSON:
{"content": "your advice", "vote": "approve" | "abstain" | "oppose"}`

      try {
        const response = await openai.chat.completions.create({
          model: minister.model_name || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: minister.system_prompt },
            { role: 'user', content: prompt },
          ],
          temperature: minister.temperature,
          response_format: { type: 'json_object' },
          max_tokens: 200,
        }, { timeout: 8000 })

        const result = JSON.parse(response.choices[0].message.content || '{}')
        
        await insertMessage({
          turn_index: turnIndex + idx,
          speaker_member_id: minister.id,
          speaker_role: minister.role,
          message_type: 'opening',
          content: result.content || 'No response',
          metadata: { model: minister.model_name, vote: result.vote },
        })

        // Also save to brief_responses for backward compatibility
        await supabase.from('brief_responses').insert({
          brief_id,
          cabinet_member_id: minister.id,
          response_text: result.content || 'No response',
          vote: result.vote || 'abstain',
          metadata: { from_debate: true },
        })

        return { minister, ...result }
      } catch (error: any) {
        await insertMessage({
          turn_index: turnIndex + idx,
          speaker_member_id: minister.id,
          speaker_role: minister.role,
          message_type: 'opening',
          content: `Error: ${error.message}`,
          metadata: { error: true },
        })
        return { minister, content: 'Error', vote: 'abstain' }
      }
    })

    const results = await Promise.all(ministerPromises)
    turnIndex += regularMinisters.length

    // PM Synthesis (if exists)
    if (pmMinister) {
      const ministerAdvice = results.map(r => `${r.minister.name}: ${r.content}`).join('\n')

      const synthPrompt = `CABINET ADVICE:
${ministerAdvice}

CONTEXT: ${context.goals}

Synthesize into 2 options. Respond as JSON:
{"summary": "brief synthesis", "options": [{"title": "Option 1", "description": "desc", "tradeoffs": "tradeoff"}]}`

      try {
        const response = await openai.chat.completions.create({
          model: pmMinister.model_name || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: pmMinister.system_prompt },
            { role: 'user', content: synthPrompt },
          ],
          temperature: pmMinister.temperature,
          response_format: { type: 'json_object' },
          max_tokens: 300,
        }, { timeout: 8000 })

        const synthesis = JSON.parse(response.choices[0].message.content || '{}')
        
        await insertMessage({
          turn_index: turnIndex++,
          speaker_member_id: pmMinister.id,
          speaker_role: 'Synthesizer',
          message_type: 'synthesis',
          content: JSON.stringify(synthesis),
          metadata: { model: pmMinister.model_name },
        })

        await supabase.from('brief_responses').insert({
          brief_id,
          cabinet_member_id: pmMinister.id,
          response_text: JSON.stringify(synthesis),
          vote: 'abstain',
          metadata: { type: 'synthesis' },
        })
      } catch (error: any) {
        console.error('PM error:', error)
      }
    }

    // Done
    await supabase.from('briefs').update({ status: 'done' }).eq('id', brief_id)

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, turns: turnIndex }),
    }
  } catch (error: any) {
    console.error('Debate error:', error)
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}
