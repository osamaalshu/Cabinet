import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureUserProfileAndCabinet } from '@/lib/db/queries'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data?.user) {
    console.error('Auth exchange error:', error?.message)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // Redirect immediately - don't block on seeding
  const redirectUrl = new URL(next, origin)
  
  // Seed profile and cabinet members asynchronously (non-blocking)
  // This happens in the background so login feels instant
  ensureUserProfileAndCabinet(data.user.id).catch((err) => {
    console.error('Error during profile/cabinet seeding (non-blocking):', err)
    // Don't fail the login if seeding fails - user can still use the app
  })

  return NextResponse.redirect(redirectUrl)
}
