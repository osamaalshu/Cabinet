import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureUserProfileAndCabinet } from '@/lib/db/queries'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data?.user) {
      try {
        await ensureUserProfileAndCabinet(data.user.id)
        const redirectUrl = new URL(next, origin)
        return NextResponse.redirect(redirectUrl)
      } catch (err) {
        console.error('Error during profile/cabinet seeding:', err)
        return NextResponse.redirect(`${origin}/login?error=seeding_failed`)
      }
    } else if (error) {
      console.error('Auth exchange error:', error.message)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
