'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Mail, Lock } from 'lucide-react'

type AuthMode = 'password' | 'magic-link' | 'set-password'

function LoginForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<AuthMode>('password')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const supabase = createClient()

  const nextPath = searchParams.get('next') || '/'
  const errorParam = searchParams.get('error')

  useEffect(() => {
    if (errorParam === 'auth_failed') {
      setMessage({ type: 'error', text: 'Authentication failed. Please try again.' })
    } else if (errorParam === 'seeding_failed') {
      setMessage({ type: 'error', text: 'Failed to initialize your account. Please try again.' })
    }
  }, [errorParam])

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setMessage({ type: 'error', text: 'Invalid email or password. Try magic link if you haven\'t set a password.' })
      } else {
        setMessage({ type: 'error', text: error.message })
      }
      setIsLoading(false)
    } else {
      router.push(nextPath)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    const callbackUrl = new URL('/auth/callback', window.location.origin)
    if (nextPath && nextPath !== '/') {
      callbackUrl.searchParams.set('next', nextPath)
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl.toString() },
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Check your email for the magic link!' })
    }
    setIsLoading(false)
  }

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/set-password`,
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Check your email to set your password!' })
    }
    setIsLoading(false)
  }

  return (
    <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 backdrop-blur">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight text-white">Welcome to the Cabinet</CardTitle>
        <CardDescription className="text-slate-400">
          {authMode === 'password' && 'Sign in with your email and password'}
          {authMode === 'magic-link' && 'Get a magic link sent to your email'}
          {authMode === 'set-password' && 'Set a password for instant login'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={
          authMode === 'password' ? handlePasswordLogin :
          authMode === 'magic-link' ? handleMagicLink :
          handleSetPassword
        } className="space-y-4">
          <Input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
            required
          />

          {authMode === 'password' && (
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
              required
            />
          )}

          {message && (
            <div className={`text-sm p-3 rounded ${
              message.type === 'success' 
                ? 'bg-green-900/50 text-green-300 border border-green-700' 
                : 'bg-red-900/50 text-red-300 border border-red-700'
            }`}>
              {message.text}
            </div>
          )}

          <Button className="w-full bg-primary hover:bg-primary/90" type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {authMode === 'password' && (
              <><Lock className="mr-2 h-4 w-4" /> Sign In</>
            )}
            {authMode === 'magic-link' && (
              <><Mail className="mr-2 h-4 w-4" /> Send Magic Link</>
            )}
            {authMode === 'set-password' && (
              <><Lock className="mr-2 h-4 w-4" /> Send Password Reset</>
            )}
          </Button>
        </form>

        <div className="mt-6 space-y-2">
          {authMode === 'password' && (
            <>
              <button
                type="button"
                onClick={() => setAuthMode('magic-link')}
                className="w-full text-sm text-slate-400 hover:text-white transition-colors"
              >
                Use magic link instead
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('set-password')}
                className="w-full text-sm text-slate-400 hover:text-white transition-colors"
              >
                First time? Set a password
              </button>
            </>
          )}
          {authMode === 'magic-link' && (
            <button
              type="button"
              onClick={() => setAuthMode('password')}
              className="w-full text-sm text-slate-400 hover:text-white transition-colors"
            >
              Sign in with password instead
            </button>
          )}
          {authMode === 'set-password' && (
            <button
              type="button"
              onClick={() => setAuthMode('password')}
              className="w-full text-sm text-slate-400 hover:text-white transition-colors"
            >
              Back to sign in
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function LoginFallback() {
  return (
    <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 backdrop-blur">
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
