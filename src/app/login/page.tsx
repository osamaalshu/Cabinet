'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Eye, EyeOff, Mail } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

type AuthView = 'signin' | 'signup' | 'otp' | 'verify-email'

function AuthForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [view, setView] = useState<AuthView>('signin')
  const [isLoading, setIsLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  const supabase = createClient()
  const nextPath = searchParams.get('next') || '/'
  const verified = searchParams.get('verified')

  // Check if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = nextPath
    })
  }, [supabase, nextPath])

  // Handle URL params
  useEffect(() => {
    if (verified === 'true') {
      setMessage({ type: 'success', text: 'Email verified! You can now sign in.' })
    }
  }, [verified])

  const clearForm = () => {
    setMessage(null)
    setOtp('')
    setOtpSent(false)
  }

  // Sign In with password
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.signInWithPassword({ 
      email: email.trim().toLowerCase(), 
      password 
    })

    if (error) {
      setMessage({ type: 'error', text: error.message.includes('Invalid') ? 'Invalid email or password' : error.message })
      setIsLoading(false)
      return
    }

    window.location.href = nextPath
  }

  // Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      setIsLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    })

    if (error) {
      setMessage({ type: 'error', text: error.message.includes('already') ? 'Email already registered' : error.message })
      setIsLoading(false)
      return
    }

    if (data.user && !data.session) {
      setView('verify-email')
    } else if (data.session) {
      window.location.href = nextPath
    }
    setIsLoading(false)
  }

  // Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setOtpSent(true)
      setMessage({ type: 'success', text: 'Code sent! Check your email.' })
    }
    setIsLoading(false)
  }

  // Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp,
      type: 'email',
    })

    if (error) {
      setMessage({ type: 'error', text: 'Invalid or expired code' })
      setIsLoading(false)
      return
    }

    window.location.href = nextPath
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-sm"
    >
      {/* Logo */}
      <div className="text-center mb-10">
        <Link href="/" className="heading-display text-3xl text-ink">Cabinet</Link>
      </div>

      {/* Verify Email View */}
      {view === 'verify-email' && (
        <div className="text-center">
          <div className="w-14 h-14 bg-wine/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="h-7 w-7 text-wine" />
          </div>
          <h2 className="heading-serif text-lg text-ink mb-2">Check your email</h2>
          <p className="body-sans text-sm text-ink-muted mb-6">
            We sent a verification link to<br /><strong className="text-ink">{email}</strong>
          </p>
          <button
            onClick={() => { setView('signin'); clearForm() }}
            className="body-sans text-sm text-wine hover:underline"
          >
            Back to Sign In
          </button>
        </div>
      )}

      {/* Sign In View */}
      {view === 'signin' && (
        <>
          <form onSubmit={handleSignIn} className="space-y-5">
            <div>
              <label className="block body-sans text-sm text-ink mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-stone-dark rounded-lg body-sans text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-wine/20 focus:border-wine/50"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="body-sans text-sm text-ink">Password</label>
                <button
                  type="button"
                  onClick={() => { setView('otp'); clearForm() }}
                  className="body-sans text-sm text-wine hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 bg-white border border-stone-dark rounded-lg body-sans text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-wine/20 focus:border-wine/50"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {message && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`text-sm body-sans ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}
                >
                  {message.text}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-ink text-white rounded-lg body-sans font-medium hover:bg-ink/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-stone-dark" />
            <span className="body-sans text-sm text-ink-muted">or</span>
            <div className="flex-1 h-px bg-stone-dark" />
          </div>

          {/* OTP Button */}
          <button
            onClick={() => { setView('otp'); clearForm() }}
            className="w-full py-3 bg-white border border-stone-dark rounded-lg body-sans text-ink hover:bg-stone/30 transition-colors flex items-center justify-center gap-2"
          >
            <Mail className="h-4 w-4" />
            Sign in with One-Time Code
          </button>

          {/* Sign Up Link */}
          <p className="text-center body-sans text-sm text-ink-muted mt-8">
            Are you new?{' '}
            <button
              onClick={() => { setView('signup'); clearForm() }}
              className="text-wine hover:underline font-medium"
            >
              Create an Account
            </button>
          </p>
        </>
      )}

      {/* Sign Up View */}
      {view === 'signup' && (
        <>
          <form onSubmit={handleSignUp} className="space-y-5">
            <div>
              <label className="block body-sans text-sm text-ink mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-stone-dark rounded-lg body-sans text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-wine/20 focus:border-wine/50"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block body-sans text-sm text-ink mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 bg-white border border-stone-dark rounded-lg body-sans text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-wine/20 focus:border-wine/50"
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block body-sans text-sm text-ink mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-stone-dark rounded-lg body-sans text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-wine/20 focus:border-wine/50"
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>

            <AnimatePresence>
              {message && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`text-sm body-sans ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}
                >
                  {message.text}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-ink text-white rounded-lg body-sans font-medium hover:bg-ink/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Account
            </button>
          </form>

          <p className="text-center body-sans text-sm text-ink-muted mt-8">
            Already have an account?{' '}
            <button
              onClick={() => { setView('signin'); clearForm() }}
              className="text-wine hover:underline font-medium"
            >
              Sign In
            </button>
          </p>
        </>
      )}

      {/* OTP View */}
      {view === 'otp' && (
        <>
          <h2 className="heading-serif text-lg text-ink text-center mb-1">
            {otpSent ? 'Enter your code' : 'Sign in with code'}
          </h2>
          <p className="body-sans text-sm text-ink-muted text-center mb-6">
            {otpSent ? 'We sent a 6-digit code to your email' : 'We\'ll email you a one-time login code'}
          </p>

          <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-5">
            {!otpSent ? (
              <div>
                <label className="block body-sans text-sm text-ink mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-stone-dark rounded-lg body-sans text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-wine/20 focus:border-wine/50"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            ) : (
              <div>
                <label className="block body-sans text-sm text-ink mb-1.5">6-digit code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 bg-white border border-stone-dark rounded-lg body-sans text-ink text-center text-xl tracking-[0.3em] placeholder:text-ink-muted placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-wine/20 focus:border-wine/50"
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
            )}

            <AnimatePresence>
              {message && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`text-sm body-sans ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}
                >
                  {message.text}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-ink text-white rounded-lg body-sans font-medium hover:bg-ink/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {otpSent ? 'Verify code' : 'Send code'}
            </button>
          </form>

          {otpSent && (
            <button
              onClick={() => { setOtpSent(false); setOtp(''); setMessage(null) }}
              className="w-full mt-3 body-sans text-sm text-ink-muted hover:text-ink transition-colors"
            >
              Resend code
            </button>
          )}

          <p className="text-center body-sans text-sm text-ink-muted mt-8">
            <button
              onClick={() => { setView('signin'); clearForm() }}
              className="text-wine hover:underline"
            >
              Back to Sign In
            </button>
          </p>
        </>
      )}
    </motion.div>
  )
}

function AuthFallback() {
  return (
    <div className="w-full max-w-sm flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-ink-muted" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-marble flex items-center justify-center px-6 py-12">
      <Suspense fallback={<AuthFallback />}>
        <AuthForm />
      </Suspense>
    </div>
  )
}
