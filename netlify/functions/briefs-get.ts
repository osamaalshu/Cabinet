import { createAdminClient } from '../../src/lib/supabase/server'

export const handler = async (event: any) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { id } = event.queryStringParameters
    const authHeader = event.headers.authorization
    
    if (!authHeader || !id) {
      return { statusCode: 400, body: 'Missing ID or Authorization' }
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = await createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return { statusCode: 401, body: 'Unauthorized' }
    }

    // Fetch brief, responses, decision, and audit
    const { data: brief, error: briefError } = await supabase
      .from('briefs')
      .select(`
        *,
        responses:brief_responses(
          *,
          member:cabinet_members(*)
        ),
        decision:decisions(*),
        audit:audits(*)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (briefError) throw briefError

    return {
      statusCode: 200,
      body: JSON.stringify(brief),
    }
  } catch (error: any) {
    console.error(error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    }
  }
}

