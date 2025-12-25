'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Mail, Lock, Hash } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

type AuthMode = 'password' | 'magic-link' | 'otp' | 'set-password'

function LoginForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [authMode, setAuthMode] = useState<AuthMode>('password')
  const [isLoading, setIsLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
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
        setMessage({ type: 'error', text: 'Invalid email or password.' })
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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setOtpSent(true)
      setMessage({ type: 'success', text: 'Enter the 6-digit code sent to your email.' })
    }
    setIsLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })

    if (error) {
      setMessage({ type: 'error', text: 'Invalid or expired code. Please try again.' })
      setIsLoading(false)
    } else {
      router.push(nextPath)
    }
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      {/* Logo */}
      <div className="text-center mb-8">
        <Link href="/" className="heading-display text-4xl text-ink">Cabinet</Link>
        <p className="body-sans text-ink-muted mt-2">Your council of advisors awaits</p>
      </div>

      {/* Card */}
      <div className="bg-card border border-stone-dark rounded-xl p-8">
        <h2 className="heading-serif text-xl text-ink text-center mb-1">
          {authMode === 'password' && 'Sign In'}
          {authMode === 'magic-link' && 'Magic Link'}
          {authMode === 'otp' && (otpSent ? 'Enter Code' : 'One-Time Password')}
          {authMode === 'set-password' && 'Set Password'}
        </h2>
        <p className="body-sans text-sm text-ink-muted text-center mb-6">
          {authMode === 'password' && 'Enter your credentials'}
          {authMode === 'magic-link' && 'Get a sign-in link via email'}
          {authMode === 'otp' && (otpSent ? 'Check your email inbox' : 'Get a 6-digit code via email')}
          {authMode === 'set-password' && 'First time? Create a password'}
        </p>

        <form
          onSubmit={
            authMode === 'password' ? handlePasswordLogin :
            authMode === 'magic-link' ? handleMagicLink :
            authMode === 'otp' ? (otpSent ? handleVerifyOtp : handleSendOtp) :
            handleSetPassword
          }
          className="space-y-4"
        >
          {/* Email Input */}
          {!(authMode === 'otp' && otpSent) && (
            <div>
              <label className="block body-sans text-sm text-ink-muted mb-2">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-marble border border-stone-dark rounded-lg body-sans text-ink placeholder:text-ink-muted focus:outline-none focus:border-wine/50 transition-colors"
                required
              />
            </div>
          )}

          {/* Password Input */}
          {authMode === 'password' && (
            <div>
              <label className="block body-sans text-sm text-ink-muted mb-2">Password</label>
              <input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-marble border border-stone-dark rounded-lg body-sans text-ink placeholder:text-ink-muted focus:outline-none focus:border-wine/50 transition-colors"
                required
              />
            </div>
          )}

          {/* OTP Input */}
          {authMode === 'otp' && otpSent && (
            <div>
              <label className="block body-sans text-sm text-ink-muted mb-2">6-Digit Code</label>
              <input
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 bg-marble border border-stone-dark rounded-lg body-sans text-ink text-center text-2xl tracking-[0.5em] placeholder:text-ink-muted placeholder:tracking-[0.5em] focus:outline-none focus:border-wine/50 transition-colors"
                maxLength={6}
                required
              />
            </div>
          )}

          {/* Message */}
          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-3 rounded-lg body-sans text-sm ${
                  message.type === 'success'
                    ? 'bg-approve/10 text-approve'
                    : 'bg-wine/10 text-wine'
                }`}
              >
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-6 py-3 bg-wine text-white rounded-lg heading-serif hover:bg-wine-light transition-colors flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {authMode === 'password' && <><Lock className="h-4 w-4" /> Sign In</>}
            {authMode === 'magic-link' && <><Mail className="h-4 w-4" /> Send Magic Link</>}
            {authMode === 'otp' && (otpSent ? <><Hash className="h-4 w-4" /> Verify Code</> : <><Hash className="h-4 w-4" /> Send Code</>)}
            {authMode === 'set-password' && <><Lock className="h-4 w-4" /> Send Reset Email</>}
          </button>
        </form>

        {/* Mode Switchers */}
        <div className="mt-6 pt-6 border-t border-stone space-y-2">
          {authMode === 'password' && (
            <>
              <button
                type="button"
                onClick={() => { setAuthMode('magic-link'); setMessage(null) }}
                className="w-full body-sans text-sm text-ink-muted hover:text-ink transition-colors"
              >
                Use magic link instead
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('otp'); setOtpSent(false); setMessage(null) }}
                className="w-full body-sans text-sm text-ink-muted hover:text-ink transition-colors"
              >
                Use one-time code
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('set-password'); setMessage(null) }}
                className="w-full body-sans text-sm text-ink-muted hover:text-ink transition-colors"
              >
                First time? Set a password
              </button>
            </>
          )}
          {authMode === 'magic-link' && (
            <button
              type="button"
              onClick={() => { setAuthMode('password'); setMessage(null) }}
              className="w-full body-sans text-sm text-ink-muted hover:text-ink transition-colors"
            >
              Sign in with password
            </button>
          )}
          {authMode === 'otp' && (
            <button
              type="button"
              onClick={() => { setAuthMode('password'); setOtpSent(false); setMessage(null) }}
              className="w-full body-sans text-sm text-ink-muted hover:text-ink transition-colors"
            >
              Sign in with password
            </button>
          )}
          {authMode === 'set-password' && (
            <button
              type="button"
              onClick={() => { setAuthMode('password'); setMessage(null) }}
              className="w-full body-sans text-sm text-ink-muted hover:text-ink transition-colors"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function LoginFallback() {
  return (
    <div className="w-full max-w-md">
      <div className="bg-card border border-stone-dark rounded-xl p-8 flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-ink-muted" />
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-marble flex items-center justify-center px-6 py-12">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
