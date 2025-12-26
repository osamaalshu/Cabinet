'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/common/Navbar'
import { Loader2, Check } from 'lucide-react'
import { motion } from 'framer-motion'

export default function AccountPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [user, setUser] = useState<any>(null)
  const [displayName, setDisplayName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()

      if (profileData?.display_name) {
        setDisplayName(profileData.display_name)
      }
      setIsLoading(false)
    }
    loadProfile()
  }, [supabase, router])

  const handleSaveProfile = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', user.id)

      if (updateError) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({ id: user.id, display_name: displayName })
        if (insertError) throw insertError
      }
      
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save' })
    }
    setIsSaving(false)
  }

  const handleChangePassword = async () => {
    setMessage(null)
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Password reset link sent to your email' })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-marble flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-muted" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-marble">
      <Navbar userEmail={user?.email} userName={displayName} />

      <main className="max-w-lg mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="heading-serif text-2xl text-ink mb-8">Account</h1>

          {/* Single Card */}
          <div className="bg-white border border-stone-dark/50 rounded-xl divide-y divide-stone-dark/30">
            
            {/* Display Name */}
            <div className="p-5">
              <label className="block body-sans text-xs text-ink-muted uppercase tracking-wide mb-2">
                Display Name
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="flex-1 px-3 py-2 bg-marble border border-stone-dark rounded-lg body-sans text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-wine/50"
                />
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="px-4 py-2 bg-ink text-white rounded-lg body-sans text-sm hover:bg-ink/90 transition-colors disabled:opacity-50 flex items-center gap-2 min-w-[80px] justify-center"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : saved ? (
                    <><Check className="h-4 w-4" /> Saved</>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </div>

            {/* Email */}
            <div className="p-5">
              <label className="block body-sans text-xs text-ink-muted uppercase tracking-wide mb-2">
                Email
              </label>
              <p className="body-sans text-sm text-ink">{user?.email}</p>
            </div>

            {/* Password */}
            <div className="p-5">
              <label className="block body-sans text-xs text-ink-muted uppercase tracking-wide mb-2">
                Password
              </label>
              <button
                onClick={handleChangePassword}
                className="body-sans text-sm text-wine hover:underline"
              >
                Change password
              </button>
            </div>
          </div>

          {/* Messages */}
          {message && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`mt-4 body-sans text-sm ${
                message.type === 'success' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {message.text}
            </motion.p>
          )}
        </motion.div>
      </main>
    </div>
  )
}
