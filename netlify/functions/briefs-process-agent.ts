import { createAdminClient } from '../../src/lib/supabase/server'
import { runMinister, runPrimeMinister } from '../../src/lib/agents/orchestrator'

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  try {
    const authHeader = event.headers.authorization
    if (!authHeader) return { statusCode: 401, body: 'Unauthorized' }

    const token = authHeader.replace('Bearer ', '')
    const supabase = await createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return { statusCode: 401, body: 'Unauthorized' }

    const { brief_id, cabinet_member_id, is_pm } = JSON.parse(event.body)

    const { data: brief } = await supabase.from('briefs').select('*').eq('id', brief_id).single()
    const { data: member } = await supabase.from('cabinet_members').select('*').eq('id', cabinet_member_id).single()
    
    if (!brief || !member) throw new Error('Brief or Member not found')

    // Fetch existing responses to enable "Debate"
    const { data: existingResponses } = await supabase
      .from('brief_responses')
      .select('response_text, cabinet_members(name, role)')
      .eq('brief_id', brief_id)

    const previousAdvice = existingResponses
      ?.map((r: any) => `${r.cabinet_members.name}: ${r.response_text}`)
      .join('\n\n')

    if (is_pm) {
      const pmResult = await runPrimeMinister(member, brief.input_context, existingResponses || [])
      const { data: response } = await supabase.from('brief_responses').insert({
        brief_id,
        cabinet_member_id: member.id,
        response_text: JSON.stringify(pmResult),
        vote: 'abstain',
        metadata: { type: 'synthesis' },
      }).select().single()
      return { statusCode: 200, body: JSON.stringify(response) }
    } else {
      const result = await runMinister(member, brief.input_context, previousAdvice)
      const { data: response } = await supabase.from('brief_responses').insert({
        brief_id,
        cabinet_member_id: member.id,
        response_text: result.response_text,
        vote: result.vote,
        metadata: { justification: result.justification },
      }).select().single()
      return { statusCode: 200, body: JSON.stringify(response) }
    }
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}
