import { createClient } from './server'
import { redirect } from 'next/navigation'

/**
 * SERVER-ONLY: Retrieves the user from the current session.
 * Do NOT import this in Client Components.
 */
export async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return null
  }
  return user
}

/**
 * SERVER-ONLY: Ensures a user is logged in or redirects to login.
 */
export async function requireUser() {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }
  return user
}
