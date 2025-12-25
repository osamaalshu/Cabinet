import { createAdminClient } from '../../src/lib/supabase/server'

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

    const { brief_id, chosen_option, user_notes } = JSON.parse(event.body)

    const { data: decision, error: decisionError } = await supabase
      .from('decisions')
      .insert({
        brief_id,
        chosen_option,
        user_notes,
      })
      .select()
      .single()

    if (decisionError) throw decisionError

    return {
      statusCode: 200,
      body: JSON.stringify(decision),
    }
  } catch (error: any) {
    console.error(error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    }
  }
}

