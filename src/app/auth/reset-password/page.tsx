'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClient()

  // Listen for auth state changes (the user arrives via email link)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User has arrived via password recovery link
        // They can now set a new password
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setError(error.message)
        setIsLoading(false)
        return
      }

      setIsSuccess(true)
    } catch (err) {
      setError('Failed to update password. Please try again.')
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-marble flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-card border border-stone-dark rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="heading-serif text-xl text-ink mb-2">Password Updated</h2>
            <p className="body-sans text-sm text-ink-muted mb-6">
              Your password has been successfully changed.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-wine text-white rounded-lg heading-serif hover:bg-wine-light transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-marble flex items-center justify-center px-6 py-12">
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
          <h2 className="heading-serif text-xl text-ink text-center mb-1">Set New Password</h2>
          <p className="body-sans text-sm text-ink-muted text-center mb-6">
            Enter your new password below
          </p>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block body-sans text-sm text-ink-muted mb-2">New Password</label>
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

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 rounded-lg bg-wine/10 text-wine body-sans text-sm"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-3 bg-wine text-white rounded-lg heading-serif hover:bg-wine-light transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Update Password
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-stone text-center">
            <Link href="/login" className="body-sans text-sm text-ink-muted hover:text-ink transition-colors">
              Back to Sign In
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

