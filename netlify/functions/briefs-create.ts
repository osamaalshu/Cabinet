import { createAdminClient } from '../../src/lib/supabase/server'

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  try {
    const authHeader = event.headers.authorization
    if (!authHeader) return { statusCode: 401, body: 'Unauthorized' }

    const token = authHeader.replace('Bearer ', '')
    const supabase = await createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return { statusCode: 401, body: 'Unauthorized' }

    const { title, input_context } = JSON.parse(event.body)

    const { data: brief, error: briefError } = await supabase
      .from('briefs')
      .insert({ user_id: user.id, title, input_context, status: 'running' })
      .select().single()

    if (briefError) throw briefError

    const { data: ministers } = await supabase
      .from('cabinet_members')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('is_enabled', true)

    return {
      statusCode: 200,
      body: JSON.stringify({ brief_id: brief.id, ministers }),
    }
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}
