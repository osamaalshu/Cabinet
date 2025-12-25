import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureUserProfileAndCabinet } from '@/lib/db/queries'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  console.log('Auth callback triggered:', { origin, next: searchParams.get('next') })
  
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    console.log('Exchanging code for session...')
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data?.user) {
      console.log('Auth success for user:', data.user.id)
      try {
        console.log('Ensuring profile and cabinet...')
        await ensureUserProfileAndCabinet(data.user.id)
        console.log('Seeding complete. Redirecting to:', next)
        
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

  console.log('Auth failed or no code. Redirecting to login.')
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
