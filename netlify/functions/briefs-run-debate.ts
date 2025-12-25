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

interface DiscussionMessage {
  brief_id: string
  turn_index: number
  speaker_member_id: string | null
  speaker_role: string
  message_type: 'opening' | 'rebuttal' | 'cross_exam' | 'synthesis' | 'vote' | 'system'
  content: string
  metadata: Record<string, any>
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
      .is('is_archived', false)
      .order('seat_index')

    if (!ministers?.length) throw new Error('No ministers found')

    // Update brief status
    await supabase.from('briefs').update({ status: 'running' }).eq('id', brief_id)

    const regularMinisters = ministers.filter((m: Minister) => m.role !== 'Synthesizer')
    const pmMinister = ministers.find((m: Minister) => m.role === 'Synthesizer')
    const oppositionLeader = ministers.find((m: Minister) => m.role === 'Skeptic')

    let turnIndex = 0
    const context = brief.input_context

    // Helper to insert discussion message
    async function insertMessage(msg: Omit<DiscussionMessage, 'brief_id'>) {
      const { data, error } = await supabase
        .from('discussion_messages')
        .insert({ ...msg, brief_id })
        .select()
        .single()
      if (error) console.error('Error inserting message:', error)
      return data
    }

    // Helper to run a minister
    async function runMinister(
      minister: Minister,
      promptAddition: string,
      messageType: DiscussionMessage['message_type']
    ): Promise<{ content: string; vote?: string }> {
      const prompt = `
CONTEXT:
Goals: ${context.goals}
Constraints: ${context.constraints}
Values: ${(context.values || []).join(', ')}

${promptAddition}

Your role: ${minister.name} (${minister.role})

Respond with a JSON object:
{
  "content": "Your response (1-2 concise paragraphs)",
  "vote": "approve" | "abstain" | "oppose"
}
`
      try {
        const response = await openai.chat.completions.create({
          model: minister.model_name,
          messages: [
            { role: 'system', content: minister.system_prompt },
            { role: 'user', content: prompt },
          ],
          temperature: minister.temperature,
          response_format: { type: 'json_object' },
        }, { timeout: 15000 })

        const result = JSON.parse(response.choices[0].message.content || '{}')
        
        await insertMessage({
          turn_index: turnIndex++,
          speaker_member_id: minister.id,
          speaker_role: minister.role,
          message_type: messageType,
          content: result.content || 'No response',
          metadata: { 
            model: minister.model_name, 
            vote: result.vote,
            latency_ms: Date.now()
          },
        })

        return result
      } catch (error: any) {
        const errorContent = `Error: ${error.message}`
        await insertMessage({
          turn_index: turnIndex++,
          speaker_member_id: minister.id,
          speaker_role: minister.role,
          message_type: messageType,
          content: errorContent,
          metadata: { error: true },
        })
        return { content: errorContent, vote: 'abstain' }
      }
    }

    // ROUND 1: Opening Statements
    await insertMessage({
      turn_index: turnIndex++,
      speaker_member_id: null,
      speaker_role: 'system',
      message_type: 'system',
      content: '📢 The Cabinet session begins. Ministers will now present their opening statements.',
      metadata: { phase: 'opening' },
    })

    const openingStatements: Array<{ minister: Minister; content: string; vote?: string }> = []
    
    for (const minister of regularMinisters) {
      const result = await runMinister(
        minister,
        'Provide your initial analysis and recommendation for the user\'s goals.',
        'opening'
      )
      openingStatements.push({ minister, ...result })
    }

    // ROUND 2: Rebuttals
    await insertMessage({
      turn_index: turnIndex++,
      speaker_member_id: null,
      speaker_role: 'system',
      message_type: 'system',
      content: '🔄 Rebuttal round. Ministers may now respond to their colleagues.',
      metadata: { phase: 'rebuttal' },
    })

    const previousStatements = openingStatements
      .map(s => `${s.minister.name}: ${s.content}`)
      .join('\n\n')

    for (const minister of regularMinisters) {
      const othersStatements = openingStatements
        .filter(s => s.minister.id !== minister.id)
        .map(s => `${s.minister.name}: ${s.content}`)
        .join('\n\n')

      await runMinister(
        minister,
        `PREVIOUS STATEMENTS:\n${othersStatements}\n\nProvide a rebuttal or additional thoughts. You MUST reference at least one other minister's point.`,
        'rebuttal'
      )
    }

    // ROUND 3: Opposition Cross-Examination (if Opposition Leader exists)
    if (oppositionLeader) {
      await insertMessage({
        turn_index: turnIndex++,
        speaker_member_id: null,
        speaker_role: 'system',
        message_type: 'system',
        content: '⚔️ The Opposition Leader will now cross-examine the Cabinet.',
        metadata: { phase: 'cross_exam' },
      })

      await runMinister(
        oppositionLeader,
        `ALL PREVIOUS STATEMENTS:\n${previousStatements}\n\nAs Opposition Leader, challenge the weakest arguments. Identify risks and blind spots.`,
        'cross_exam'
      )
    }

    // ROUND 4: Prime Minister Synthesis
    if (pmMinister) {
      await insertMessage({
        turn_index: turnIndex++,
        speaker_member_id: null,
        speaker_role: 'system',
        message_type: 'system',
        content: '👑 The Prime Minister will now synthesize the discussion.',
        metadata: { phase: 'synthesis' },
      })

      // Fetch all messages for synthesis
      const { data: allMessages } = await supabase
        .from('discussion_messages')
        .select('*')
        .eq('brief_id', brief_id)
        .neq('message_type', 'system')
        .order('turn_index')

      const transcript = allMessages
        ?.map((m: any) => `[${m.message_type.toUpperCase()}] ${m.speaker_role}: ${m.content}`)
        .join('\n\n')

      const synthPrompt = `
FULL DISCUSSION TRANSCRIPT:
${transcript}

CONTEXT:
Goals: ${context.goals}
Constraints: ${context.constraints}
Values: ${(context.values || []).join(', ')}

As Prime Minister, synthesize this debate into 2-3 actionable options for the user.
Respond with a JSON object:
{
  "summary": "Brief synthesis of the debate (2-3 sentences)",
  "options": [
    {
      "title": "Option name",
      "description": "What this option entails (1 sentence)",
      "tradeoffs": "Key tradeoffs (1 sentence)",
      "supported_by": ["Minister names who would support this"]
    }
  ]
}
`
      try {
        const response = await openai.chat.completions.create({
          model: pmMinister.model_name,
          messages: [
            { role: 'system', content: pmMinister.system_prompt },
            { role: 'user', content: synthPrompt },
          ],
          temperature: pmMinister.temperature,
          response_format: { type: 'json_object' },
        }, { timeout: 20000 })

        const synthesis = JSON.parse(response.choices[0].message.content || '{}')
        
        await insertMessage({
          turn_index: turnIndex++,
          speaker_member_id: pmMinister.id,
          speaker_role: 'Synthesizer',
          message_type: 'synthesis',
          content: JSON.stringify(synthesis),
          metadata: { model: pmMinister.model_name },
        })

        // Also save to brief_responses for backward compatibility
        await supabase.from('brief_responses').insert({
          brief_id,
          cabinet_member_id: pmMinister.id,
          response_text: JSON.stringify(synthesis),
          vote: 'abstain',
          metadata: { type: 'synthesis' },
        })
      } catch (error: any) {
        await insertMessage({
          turn_index: turnIndex++,
          speaker_member_id: pmMinister.id,
          speaker_role: 'Synthesizer',
          message_type: 'synthesis',
          content: JSON.stringify({ summary: 'Error generating synthesis', options: [] }),
          metadata: { error: error.message },
        })
      }
    }

    // Final: Record votes in brief_responses for backward compatibility
    for (const statement of openingStatements) {
      await supabase.from('brief_responses').insert({
        brief_id,
        cabinet_member_id: statement.minister.id,
        response_text: statement.content,
        vote: statement.vote || 'abstain',
        metadata: { from_debate: true },
      })
    }

    // Update brief status
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

