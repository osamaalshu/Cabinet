'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateProfileAction } from '@/lib/supabase/actions'
import { Navbar } from '@/components/common/Navbar'
import { User, Mail, Lock, Save, Loader2, Check } from 'lucide-react'
import { motion } from 'framer-motion'

export default function AccountPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<{ display_name: string }>({ display_name: '' })
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

      if (profileData) {
        setProfile({ display_name: profileData.display_name || '' })
      }
      setIsLoading(false)
    }
    loadProfile()
  }, [supabase, router])

  const handleSaveProfile = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      await updateProfileAction({ display_name: profile.display_name })
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
      redirectTo: `${window.location.origin}/auth/set-password`,
    })
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Check your email for the password reset link!' })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-marble flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ink-muted" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-marble">
      <Navbar userEmail={user?.email} userName={profile.display_name} />

      <main className="max-w-2xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="heading-display text-4xl text-ink mb-2">Account Settings</h1>
          <p className="body-sans text-ink-muted mb-12">Manage your profile and preferences</p>

          {/* Profile Section */}
          <section className="mb-12">
            <h2 className="heading-serif text-lg text-ink mb-6 flex items-center gap-3">
              <User className="h-5 w-5 text-wine" />
              Profile
            </h2>
            <div className="bg-card border border-stone-dark rounded-lg p-6 space-y-6">
              <div>
                <label className="block body-sans text-sm text-ink-muted mb-2">Display Name</label>
                <input
                  type="text"
                  value={profile.display_name}
                  onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 bg-marble border border-stone-dark rounded-lg body-sans text-ink placeholder:text-ink-muted focus:outline-none focus:border-wine/50 transition-colors"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="px-6 py-2 bg-wine text-white rounded-lg body-sans text-sm hover:bg-wine-light transition-colors flex items-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : saved ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saved ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>
          </section>

          {/* Email Section */}
          <section className="mb-12">
            <h2 className="heading-serif text-lg text-ink mb-6 flex items-center gap-3">
              <Mail className="h-5 w-5 text-wine" />
              Email
            </h2>
            <div className="bg-card border border-stone-dark rounded-lg p-6">
              <p className="body-sans text-ink">{user?.email}</p>
              <p className="body-sans text-sm text-ink-muted mt-1">
                Your email is used for sign-in and notifications
              </p>
            </div>
          </section>

          {/* Password Section */}
          <section className="mb-12">
            <h2 className="heading-serif text-lg text-ink mb-6 flex items-center gap-3">
              <Lock className="h-5 w-5 text-wine" />
              Password
            </h2>
            <div className="bg-card border border-stone-dark rounded-lg p-6">
              <p className="body-sans text-sm text-ink-muted mb-4">
                Set or change your password for quick sign-in
              </p>
              <button
                onClick={handleChangePassword}
                className="px-6 py-2 border border-stone-dark rounded-lg body-sans text-sm text-ink hover:border-wine/50 hover:text-wine transition-colors"
              >
                Change Password
              </button>
            </div>
          </section>

          {/* Messages */}
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg body-sans text-sm ${
                message.type === 'success'
                  ? 'bg-approve/10 text-approve border border-approve/20'
                  : 'bg-wine/10 text-wine border border-wine/20'
              }`}
            >
              {message.text}
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  )
}

