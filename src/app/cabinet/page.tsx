'use client'

import { useEffect, useState } from 'react'
import { Navbar } from '@/components/common/Navbar'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Save } from 'lucide-react'
import { motion } from 'framer-motion'

export const dynamic = 'force-dynamic'

export default function CabinetPage() {
  const [ministers, setMinisters] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const [membersRes, profileRes] = await Promise.all([
          supabase.from('cabinet_members').select('*').order('name'),
          supabase.from('profiles').select('display_name').eq('id', user.id).single()
        ])
        if (membersRes.data) setMinisters(membersRes.data)
        if (profileRes.data) setProfile(profileRes.data)
      }
      setIsLoading(false)
    }
    fetchData()
  }, [supabase])

  const handleToggle = async (id: string, isEnabled: boolean) => {
    setMinisters(prev => prev.map(m => m.id === id ? { ...m, is_enabled: isEnabled } : m))
  }

  const handleChange = (id: string, field: string, value: any) => {
    setMinisters(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  const handleSave = async () => {
    setIsSaving(true)
    const { error } = await supabase.from('cabinet_members').upsert(ministers)
    if (error) alert('Error saving: ' + error.message)
    setIsSaving(false)
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
      <Navbar userEmail={user?.email} userName={profile?.display_name} />
      
      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="heading-display text-4xl md:text-5xl text-ink">Configure the Cabinet</h1>
          <p className="mt-2 body-sans text-ink-muted">Adjust your council of advisors</p>
        </motion.div>

        {/* Save Button */}
        <div className="flex justify-end mb-8">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-wine text-white rounded-lg body-sans font-medium hover:bg-wine-light transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </motion.button>
        </div>

        {/* Ministers Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ministers.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`bg-card border border-stone-dark rounded-lg p-6 transition-opacity ${
                m.is_enabled ? 'opacity-100' : 'opacity-50'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="heading-serif text-lg text-ink">{m.name}</h3>
                  <p className="body-sans text-xs text-ink-muted uppercase tracking-widest mt-0.5">
                    {m.role}
                  </p>
                </div>
                <Switch
                  checked={m.is_enabled}
                  onCheckedChange={(checked) => handleToggle(m.id, checked)}
                />
              </div>

              {/* Config */}
              <div className="space-y-4">
                <div>
                  <label className="body-sans text-xs text-ink-muted uppercase tracking-wider block mb-2">
                    Model
                  </label>
                  <Input
                    value={m.model_name}
                    onChange={(e) => handleChange(m.id, 'model_name', e.target.value)}
                    placeholder="gpt-4o-mini"
                    className="bg-marble border-stone-dark text-ink"
                  />
                </div>
                <div>
                  <label className="body-sans text-xs text-ink-muted uppercase tracking-wider block mb-2">
                    Temperature ({m.temperature})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={m.temperature}
                    onChange={(e) => handleChange(m.id, 'temperature', parseFloat(e.target.value))}
                    className="w-full accent-wine"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
      
      {/* Footer accent */}
      <div className="fixed bottom-0 inset-x-0 h-2 bg-gradient-to-r from-wine via-wine-dark to-wine" />
    </div>
  )
}
