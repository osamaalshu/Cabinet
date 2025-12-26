'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

type AuthMode = 'signin' | 'signup' | 'forgot' | 'verify-email'

function AuthForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [isLoading, setIsLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  const supabase = createClient()
  const nextPath = searchParams.get('next') || '/'
  const errorParam = searchParams.get('error')
  const verified = searchParams.get('verified')

  // Check if already logged in
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        window.location.href = nextPath
      }
    }
    checkSession()
  }, [supabase, nextPath])

  // Handle URL params
  useEffect(() => {
    if (errorParam === 'auth_failed') {
      setMessage({ type: 'error', text: 'Authentication failed. Please try again.' })
    } else if (verified === 'true') {
      setMessage({ type: 'success', text: 'Email verified! You can now sign in.' })
      setAuthMode('signin')
    }
  }, [errorParam, verified])

  // ============ SIGN IN ============
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: email.trim().toLowerCase(), 
        password 
      })

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setMessage({ type: 'error', text: 'Invalid email or password.' })
        } else if (error.message.includes('Email not confirmed')) {
          setMessage({ type: 'error', text: 'Please verify your email first. Check your inbox.' })
        } else {
          setMessage({ type: 'error', text: error.message })
        }
        setIsLoading(false)
        return
      }

      // Success - redirect
      window.location.href = nextPath
    } catch (err) {
      console.error('Sign in error:', err)
      setMessage({ type: 'error', text: 'An unexpected error occurred.' })
      setIsLoading(false)
    }
  }

  // ============ SIGN UP ============
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    // Validate passwords match
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      setIsLoading(false)
      return
    }

    // Validate password strength
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' })
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      })

      if (error) {
        if (error.message.includes('already registered')) {
          setMessage({ type: 'error', text: 'This email is already registered. Try signing in.' })
        } else {
          setMessage({ type: 'error', text: error.message })
        }
        setIsLoading(false)
        return
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        setAuthMode('verify-email')
        setMessage({ type: 'success', text: 'Check your email to verify your account!' })
      } else if (data.session) {
        // Auto-confirmed (e.g., in development)
        window.location.href = nextPath
      }
    } catch (err) {
      console.error('Sign up error:', err)
      setMessage({ type: 'error', text: 'An unexpected error occurred.' })
    }
    setIsLoading(false)
  }

  // ============ FORGOT PASSWORD - Send OTP ============
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false },
      })

      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setOtpSent(true)
        setMessage({ type: 'success', text: 'Check your email for the 6-digit code.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to send code. Please try again.' })
    }
    setIsLoading(false)
  }

  // ============ VERIFY OTP ============
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: 'email',
      })

      if (error) {
        setMessage({ type: 'error', text: 'Invalid or expired code.' })
        setIsLoading(false)
        return
      }

      // Success - redirect
      window.location.href = nextPath
    } catch (err) {
      setMessage({ type: 'error', text: 'Verification failed. Please try again.' })
      setIsLoading(false)
    }
  }

  // ============ RESET PASSWORD (send link) ============
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/auth/reset-password` }
      )

      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setMessage({ type: 'success', text: 'Check your email for the password reset link.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to send reset email.' })
    }
    setIsLoading(false)
  }

  // ============ RENDER ============
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
        
        {/* Verify Email State */}
        {authMode === 'verify-email' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-wine/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-wine" />
            </div>
            <h2 className="heading-serif text-xl text-ink mb-2">Check Your Email</h2>
            <p className="body-sans text-sm text-ink-muted mb-6">
              We sent a verification link to <strong>{email}</strong>. Click the link to activate your account.
            </p>
            <button
              onClick={() => { setAuthMode('signin'); setMessage(null) }}
              className="body-sans text-sm text-wine hover:underline"
            >
              Back to Sign In
            </button>
          </div>
        )}

        {/* Sign In Form */}
        {authMode === 'signin' && (
          <>
            <h2 className="heading-serif text-xl text-ink text-center mb-1">Welcome Back</h2>
            <p className="body-sans text-sm text-ink-muted text-center mb-6">Sign in to your account</p>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block body-sans text-sm text-ink-muted mb-2">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-marble border border-stone-dark rounded-lg body-sans text-ink placeholder:text-ink-muted focus:outline-none focus:border-wine/50 transition-colors"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block body-sans text-sm text-ink-muted mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 bg-marble border border-stone-dark rounded-lg body-sans text-ink placeholder:text-ink-muted focus:outline-none focus:border-wine/50 transition-colors"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Message */}
              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`p-3 rounded-lg body-sans text-sm ${
                      message.type === 'success' ? 'bg-green-500/10 text-green-700' : 'bg-wine/10 text-wine'
                    }`}
                  >
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-wine text-white rounded-lg heading-serif hover:bg-wine-light transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Sign In
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-stone space-y-3">
              <button
                onClick={() => { setAuthMode('forgot'); setMessage(null); setOtpSent(false) }}
                className="w-full body-sans text-sm text-ink-muted hover:text-ink transition-colors"
              >
                Forgot password?
              </button>
              <div className="text-center body-sans text-sm text-ink-muted">
                Don't have an account?{' '}
                <button
                  onClick={() => { setAuthMode('signup'); setMessage(null) }}
                  className="text-wine hover:underline font-medium"
                >
                  Sign Up
                </button>
              </div>
            </div>
          </>
        )}

        {/* Sign Up Form */}
        {authMode === 'signup' && (
          <>
            <h2 className="heading-serif text-xl text-ink text-center mb-1">Create Account</h2>
            <p className="body-sans text-sm text-ink-muted text-center mb-6">Join your council of advisors</p>

            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block body-sans text-sm text-ink-muted mb-2">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-marble border border-stone-dark rounded-lg body-sans text-ink placeholder:text-ink-muted focus:outline-none focus:border-wine/50 transition-colors"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block body-sans text-sm text-ink-muted mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 bg-marble border border-stone-dark rounded-lg body-sans text-ink placeholder:text-ink-muted focus:outline-none focus:border-wine/50 transition-colors"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block body-sans text-sm text-ink-muted mb-2">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-marble border border-stone-dark rounded-lg body-sans text-ink placeholder:text-ink-muted focus:outline-none focus:border-wine/50 transition-colors"
                  required
                  autoComplete="new-password"
                />
              </div>

              {/* Message */}
              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`p-3 rounded-lg body-sans text-sm ${
                      message.type === 'success' ? 'bg-green-500/10 text-green-700' : 'bg-wine/10 text-wine'
                    }`}
                  >
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-wine text-white rounded-lg heading-serif hover:bg-wine-light transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Create Account
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-stone text-center body-sans text-sm text-ink-muted">
              Already have an account?{' '}
              <button
                onClick={() => { setAuthMode('signin'); setMessage(null) }}
                className="text-wine hover:underline font-medium"
              >
                Sign In
              </button>
            </div>
          </>
        )}

        {/* Forgot Password Form */}
        {authMode === 'forgot' && (
          <>
            <h2 className="heading-serif text-xl text-ink text-center mb-1">
              {otpSent ? 'Enter Code' : 'Forgot Password'}
            </h2>
            <p className="body-sans text-sm text-ink-muted text-center mb-6">
              {otpSent ? 'Enter the 6-digit code from your email' : 'We\'ll send you a one-time login code'}
            </p>

            <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-4">
              {!otpSent && (
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

              {otpSent && (
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
                    autoFocus
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
                      message.type === 'success' ? 'bg-green-500/10 text-green-700' : 'bg-wine/10 text-wine'
                    }`}
                  >
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-wine text-white rounded-lg heading-serif hover:bg-wine-light transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {otpSent ? 'Verify & Sign In' : 'Send Code'}
              </button>
            </form>

            {otpSent && (
              <button
                onClick={() => { setOtpSent(false); setOtp(''); setMessage(null) }}
                className="w-full mt-4 body-sans text-sm text-ink-muted hover:text-ink transition-colors"
              >
                Resend code
              </button>
            )}

            <div className="mt-6 pt-6 border-t border-stone">
              <button
                onClick={() => { setAuthMode('signin'); setMessage(null); setOtpSent(false) }}
                className="w-full body-sans text-sm text-ink-muted hover:text-ink transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}

function AuthFallback() {
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
      <Suspense fallback={<AuthFallback />}>
        <AuthForm />
      </Suspense>
    </div>
  )
}
