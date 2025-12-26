import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureUserProfileAndCabinet } from '@/lib/db/queries'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/'
  const type = searchParams.get('type') // 'signup', 'recovery', 'magiclink'

  // If no code, check for error or redirect to login
  if (!code) {
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    
    if (error) {
      console.error('Auth error:', error, errorDescription)
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }
    
    return NextResponse.redirect(`${origin}/login`)
  }

  const supabase = await createClient()
  
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth exchange error:', error.message)
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }

    if (!data?.user) {
      console.error('No user after exchange')
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }

    // Seed profile and cabinet in background (non-blocking)
    ensureUserProfileAndCabinet(data.user.id).catch((err) => {
      console.error('Seeding error (non-blocking):', err)
    })

    // If this was email verification from signup, show success message
    if (type === 'signup') {
      return NextResponse.redirect(`${origin}/login?verified=true`)
    }

    // Redirect to intended destination
    return NextResponse.redirect(`${origin}${next}`)
    
  } catch (err) {
    console.error('Callback error:', err)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }
}
