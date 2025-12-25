import { createAdminClient } from '../../src/lib/supabase/server'
import { runMinister, runPrimeMinister } from '../../src/lib/agents/orchestrator'

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const authHeader = event.headers.authorization
    if (!authHeader) {
      return { statusCode: 401, body: 'Unauthorized' }
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = await createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return { statusCode: 401, body: 'Unauthorized' }
    }

    const { title, input_context } = JSON.parse(event.body)

    // 1. Insert brief
    const { data: brief, error: briefError } = await supabase
      .from('briefs')
      .insert({
        user_id: user.id,
        title,
        input_context,
        status: 'running',
      })
      .select()
      .single()

    if (briefError) throw briefError

    // 2. Load enabled ministers
    const { data: ministers } = await supabase
      .from('cabinet_members')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_enabled', true)

    if (!ministers || ministers.length === 0) {
      throw new Error('No enabled cabinet members found')
    }

    const pm = ministers.find(m => m.role === 'Synthesizer')
    const others = ministers.filter(m => m.role !== 'Synthesizer')

    // 3. Run ministers in parallel
    const ministerResults = await Promise.all(
      others.map(async (m) => {
        const result = await runMinister(m, input_context)
        return { ...result, cabinet_member_id: m.id, name: m.name, role: m.role }
      })
    )

    // 4. Save minister responses
    await supabase.from('brief_responses').insert(
      ministerResults.map(r => ({
        brief_id: brief.id,
        cabinet_member_id: r.cabinet_member_id,
        response_text: r.response_text,
        vote: r.vote,
        metadata: { justification: r.justification },
      }))
    )

    // 5. Run Prime Minister
    if (pm) {
      const pmResult = await runPrimeMinister(pm, input_context, ministerResults)
      
      // Save PM response as a special response or update brief
      await supabase.from('brief_responses').insert({
        brief_id: brief.id,
        cabinet_member_id: pm.id,
        response_text: JSON.stringify(pmResult),
        vote: 'abstain',
        metadata: { type: 'synthesis' },
      })
    }

    // 6. Update brief status
    await supabase
      .from('briefs')
      .update({ status: 'done' })
      .eq('id', brief.id)

    return {
      statusCode: 200,
      body: JSON.stringify({ id: brief.id }),
    }
  } catch (error: any) {
    console.error(error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    }
  }
}

