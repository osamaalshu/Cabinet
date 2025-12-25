'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/common/Navbar'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export default function NewBriefPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    goals: '',
    constraints: '',
    values: '',
  })

  useEffect(() => {
    async function loadUser() {
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
      
      if (profileData) setProfile(profileData)
    }
    loadUser()
  }, [supabase, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const createRes = await fetch('/.netlify/functions/briefs-create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title: formData.title,
          input_context: {
            goals: formData.goals,
            constraints: formData.constraints,
            values: formData.values.split(',').map(v => v.trim()).filter(Boolean),
          },
        }),
      })

      const { brief_id } = await createRes.json()
      router.push(`/brief/${brief_id}`)
    } catch (error: any) {
      console.error(error)
      alert(`Error: ${error.message}`)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-marble">
      <Navbar userEmail={user?.email} userName={profile?.display_name} />

      {/* Main */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="heading-display text-4xl text-ink mb-3">
              Set the Agenda
            </h1>
            <p className="body-sans text-ink-muted">
              What shall the Cabinet deliberate upon today?
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="bg-card border border-stone-dark rounded-lg p-8">
              {/* Title Field */}
              <div className="mb-8">
                <label className="block mb-2">
                  <span className="heading-serif text-lg text-ink">Session Title</span>
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Career Crossroads"
                  className="bg-marble border-stone-dark text-ink text-lg py-6"
                  required
                />
              </div>

              {/* Goals */}
              <div className="mb-8">
                <label className="block mb-2">
                  <span className="heading-serif text-lg text-ink">Your Goals</span>
                  <span className="body-sans text-sm text-ink-muted ml-2">What do you want to achieve?</span>
                </label>
                <Textarea
                  value={formData.goals}
                  onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                  placeholder="Describe what you're trying to accomplish..."
                  className="bg-marble border-stone-dark text-ink min-h-[120px]"
                  required
                />
              </div>

              {/* Constraints */}
              <div className="mb-8">
                <label className="block mb-2">
                  <span className="heading-serif text-lg text-ink">Constraints</span>
                  <span className="body-sans text-sm text-ink-muted ml-2">What limitations exist?</span>
                </label>
                <Textarea
                  value={formData.constraints}
                  onChange={(e) => setFormData({ ...formData, constraints: e.target.value })}
                  placeholder="Time, resources, obligations..."
                  className="bg-marble border-stone-dark text-ink min-h-[100px]"
                />
              </div>

              {/* Values */}
              <div>
                <label className="block mb-2">
                  <span className="heading-serif text-lg text-ink">Core Values</span>
                  <span className="body-sans text-sm text-ink-muted ml-2">Comma-separated</span>
                </label>
                <Input
                  value={formData.values}
                  onChange={(e) => setFormData({ ...formData, values: e.target.value })}
                  placeholder="Health, Family, Growth, Freedom..."
                  className="bg-marble border-stone-dark text-ink"
                />
              </div>
            </div>

            {/* Submit */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-wine text-white rounded-lg heading-serif text-xl hover:bg-wine-light transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Convening the Cabinet...</span>
                </>
              ) : (
                <>
                  <span>Convene the Cabinet</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </motion.button>
          </form>
        </motion.div>
      </main>
      
      {/* Footer accent */}
      <div className="fixed bottom-0 inset-x-0 h-2 bg-gradient-to-r from-wine via-wine-dark to-wine" />
    </div>
  )
}
