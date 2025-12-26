'use client'

import { useEffect, useState } from 'react'
import { Navbar } from '@/components/common/Navbar'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '@/lib/models/availableModels'
import { Loader2, Save, Plus, Trash2, Archive, RotateCcw, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export const dynamic = 'force-dynamic'

interface RatingHistory {
  id: string
  cabinet_member_id: string
  rating: number
  created_at: string
  brief_title?: string
}

interface Minister {
  id: string
  user_id: string
  name: string
  role: string
  system_prompt: string
  model_provider: string
  model_name: string
  temperature: number
  is_enabled: boolean
  is_archived?: boolean
  seat_index?: number
  avatar?: string
  created_at: string
  isNew?: boolean
}

const DEFAULT_PROMPTS: Record<string, string> = {
  'Productivity': 'You are the Minister of Productivity. Focus on efficiency, time management, and actionable steps. Always consider ROI of time spent.',
  'Ethics': 'You are the Minister of Ethics. Consider moral implications, fairness, and long-term consequences of decisions.',
  'Philosophy': 'You are the Minister of Philosophy. Provide deeper meaning, question assumptions, and consider existential implications.',
  'Economy': 'You are the Minister of Economy. Focus on opportunity costs, resource allocation, and financial implications.',
  'Skeptic': 'You are the Opposition Leader. Challenge assumptions, play devil\'s advocate, and identify potential failures.',
  'Synthesizer': 'You are the Prime Minister. Synthesize all advice into clear, actionable options for the user.',
}

export default function CabinetPage() {
  const [ministers, setMinisters] = useState<Minister[]>([])
  const [ratingsHistory, setRatingsHistory] = useState<Record<string, RatingHistory[]>>({})
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const [membersRes, profileRes, ratingsRes] = await Promise.all([
          supabase.from('cabinet_members').select('*').eq('user_id', user.id).order('seat_index').order('name'),
          supabase.from('profiles').select('display_name').eq('id', user.id).single(),
          supabase.from('minister_ratings').select('*, briefs(title)').order('created_at', { ascending: true })
        ])
        if (membersRes.data) setMinisters(membersRes.data)
        if (profileRes.data) setProfile(profileRes.data)
        
        // Group ratings by minister
        if (ratingsRes.data) {
          const grouped: Record<string, RatingHistory[]> = {}
          ratingsRes.data.forEach((r: any) => {
            if (!grouped[r.cabinet_member_id]) grouped[r.cabinet_member_id] = []
            grouped[r.cabinet_member_id].push({
              id: r.id,
              cabinet_member_id: r.cabinet_member_id,
              rating: r.rating,
              created_at: r.created_at,
              brief_title: r.briefs?.title,
            })
          })
          setRatingsHistory(grouped)
        }
      }
      setIsLoading(false)
    }
    fetchData()
  }, [supabase])

  const handleChange = (id: string, field: string, value: any) => {
    setMinisters(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  const handleAddMinister = () => {
    const newMinister: Minister = {
      id: `new-${Date.now()}`,
      user_id: user.id,
      name: 'New Minister',
      role: 'Advisor',
      system_prompt: 'You are an advisor. Provide thoughtful analysis and recommendations.',
      model_provider: 'openai',
      model_name: DEFAULT_MODEL,
      temperature: 0.7,
      is_enabled: true,
      is_archived: false,
      seat_index: ministers.length,
      created_at: new Date().toISOString(),
      isNew: true,
    }
    setMinisters(prev => [...prev, newMinister])
    setExpandedId(newMinister.id)
  }

  const handleArchive = (id: string) => {
    setMinisters(prev => prev.map(m => m.id === id ? { ...m, is_archived: true, is_enabled: false } : m))
  }

  const handleRestore = (id: string) => {
    setMinisters(prev => prev.map(m => m.id === id ? { ...m, is_archived: false } : m))
  }

  const handleDelete = async (id: string) => {
    // For new unsaved ministers, just remove from state
    if (id.startsWith('new-')) {
      setMinisters(prev => prev.filter(m => m.id !== id))
      return
    }

    // For existing ministers, confirm and delete from database
    const minister = ministers.find(m => m.id === id)
    if (!minister) return

    const confirmed = window.confirm(
      `Permanently delete "${minister.name}"?\n\nThis will remove all their ratings and performance history. This cannot be undone.`
    )
    
    if (!confirmed) return

    const { error } = await supabase
      .from('cabinet_members')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Error deleting minister: ' + error.message)
      return
    }

    setMinisters(prev => prev.filter(m => m.id !== id))
  }

  const handleSave = async () => {
    setIsSaving(true)
    
    // Separate new vs existing
    const newMinisters = ministers.filter(m => m.isNew)
    const existingMinisters = ministers.filter(m => !m.isNew)

    // Insert new ministers
    for (const m of newMinisters) {
      const { id, isNew, ...data } = m
      const { data: inserted, error } = await supabase
        .from('cabinet_members')
        .insert(data)
        .select()
        .single()
      
      if (error) {
        alert('Error creating minister: ' + error.message)
        continue
      }
      
      // Update local state with real ID
      setMinisters(prev => prev.map(minister => 
        minister.id === id ? { ...inserted, isNew: false } : minister
      ))
    }

    // Update existing ministers
    const { error } = await supabase
      .from('cabinet_members')
      .upsert(existingMinisters.map(({ isNew, ...m }) => m))

    if (error) alert('Error saving: ' + error.message)
    setIsSaving(false)
  }

  const activeMinsters = ministers.filter(m => !m.is_archived)
  const archivedMinisters = ministers.filter(m => m.is_archived)

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
          className="text-center mb-8"
        >
          <h1 className="heading-display text-4xl md:text-5xl text-ink">Cabinet Builder</h1>
          <p className="mt-2 body-sans text-ink-muted">Add, configure, and manage your council of advisors</p>
        </motion.div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={handleAddMinister}
            className="inline-flex items-center gap-2 px-4 py-2 border border-stone-dark rounded-lg body-sans text-sm text-ink hover:bg-stone/50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Minister
          </button>
          
          <div className="flex items-center gap-4">
            {archivedMinisters.length > 0 && (
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="body-sans text-sm text-ink-muted hover:text-ink transition-colors"
              >
                {showArchived ? 'Hide' : 'Show'} Archived ({archivedMinisters.length})
              </button>
            )}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2 bg-wine text-white rounded-lg body-sans font-medium hover:bg-wine-light transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save All
            </motion.button>
          </div>
        </div>

        {/* Active Ministers */}
        <div className="space-y-4 mb-8">
          {activeMinsters.map((m, i) => (
            <MinisterCard
              key={m.id}
              minister={m}
              index={i}
              isExpanded={expandedId === m.id}
              onToggleExpand={() => setExpandedId(expandedId === m.id ? null : m.id)}
              onChange={handleChange}
              onArchive={handleArchive}
              onDelete={handleDelete}
              ratings={ratingsHistory[m.id] || []}
            />
          ))}
        </div>

        {/* Archived Ministers */}
        <AnimatePresence>
          {showArchived && archivedMinisters.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <h2 className="heading-serif text-lg text-ink-muted mb-4">Archived Ministers</h2>
              <div className="space-y-4 opacity-60">
                {archivedMinisters.map((m, i) => (
                  <div key={m.id} className="bg-card border border-stone-dark rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <h3 className="heading-serif text-ink">{m.name}</h3>
                      <p className="body-sans text-xs text-ink-muted">{m.role}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestore(m.id)}
                        className="inline-flex items-center gap-2 px-3 py-1 border border-stone-dark rounded body-sans text-xs hover:bg-stone/50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="inline-flex items-center gap-2 px-3 py-1 border border-wine/30 rounded body-sans text-xs text-wine hover:bg-wine/10"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeMinsters.length === 0 && (
          <div className="text-center py-16 border border-dashed border-stone-dark rounded-lg">
            <p className="body-sans text-ink-muted mb-4">No ministers yet. Add your first advisor!</p>
            <button
              onClick={handleAddMinister}
              className="inline-flex items-center gap-2 px-4 py-2 bg-wine text-white rounded-lg body-sans"
            >
              <Plus className="h-4 w-4" />
              Add Minister
            </button>
          </div>
        )}
      </main>
      
      <div className="fixed bottom-0 inset-x-0 h-2 bg-gradient-to-r from-wine via-wine-dark to-wine" />
    </div>
  )
}

// Sparkline Chart Component for Ratings
function RatingSparkline({ ratings }: { ratings: RatingHistory[] }) {
  if (ratings.length === 0) return null
  
  const last10 = ratings.slice(-10)
  const avg = last10.reduce((sum, r) => sum + r.rating, 0) / last10.length
  const trend = last10.length >= 2 
    ? last10[last10.length - 1].rating - last10[0].rating 
    : 0
  
  // SVG sparkline
  const width = 80
  const height = 24
  const padding = 2
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  
  const points = last10.map((r, i) => {
    const x = padding + (i / (last10.length - 1 || 1)) * chartWidth
    const y = padding + chartHeight - ((r.rating - 1) / 4) * chartHeight
    return `${x},${y}`
  }).join(' ')
  
  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={avg >= 3 ? '#22c55e' : avg >= 2 ? '#eab308' : '#ef4444'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Current rating dot */}
        {last10.length > 0 && (
          <circle
            cx={padding + chartWidth}
            cy={padding + chartHeight - ((last10[last10.length - 1].rating - 1) / 4) * chartHeight}
            r="3"
            fill={avg >= 3 ? '#22c55e' : avg >= 2 ? '#eab308' : '#ef4444'}
          />
        )}
      </svg>
      <div className="flex items-center gap-1">
        <span className="body-sans text-xs font-medium">{avg.toFixed(1)}</span>
        {trend > 0 && <TrendingUp className="h-3 w-3 text-green-500" />}
        {trend < 0 && <TrendingDown className="h-3 w-3 text-red-500" />}
        {trend === 0 && ratings.length > 1 && <Minus className="h-3 w-3 text-ink-muted" />}
      </div>
    </div>
  )
}

// Minister Card Component
function MinisterCard({
  minister,
  index,
  isExpanded,
  onToggleExpand,
  onChange,
  onArchive,
  onDelete,
  ratings,
}: {
  minister: Minister
  index: number
  isExpanded: boolean
  onToggleExpand: () => void
  onChange: (id: string, field: string, value: any) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  ratings: RatingHistory[]
}) {
  const isPM = minister.role === 'Synthesizer'
  const isOpposition = minister.role === 'Skeptic'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`bg-card border rounded-lg overflow-hidden transition-all ${
        minister.is_enabled ? 'border-stone-dark' : 'border-stone opacity-60'
      } ${isPM ? 'ring-2 ring-wine/20' : ''} ${isOpposition ? 'border-l-4 border-l-wine' : ''}`}
    >
      {/* Header - Always visible */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-stone/30 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-stone flex items-center justify-center text-ink heading-serif">
            {minister.name.charAt(0)}
          </div>
          <div>
            <h3 className="heading-serif text-lg text-ink">{minister.name}</h3>
            <p className="body-sans text-xs text-ink-muted uppercase tracking-widest">{minister.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Rating Sparkline */}
          {ratings.length > 0 && (
            <div onClick={(e) => e.stopPropagation()}>
              <RatingSparkline ratings={ratings} />
            </div>
          )}
          <span className="body-sans text-xs text-ink-muted">{minister.model_name}</span>
          <Switch
            checked={minister.is_enabled}
            onCheckedChange={(checked) => onChange(minister.id, 'is_enabled', checked)}
            onClick={(e) => e.stopPropagation()}
          />
          {isExpanded ? <ChevronUp className="h-4 w-4 text-ink-muted" /> : <ChevronDown className="h-4 w-4 text-ink-muted" />}
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-stone space-y-4">
              {/* Name & Role */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="body-sans text-xs text-ink-muted uppercase tracking-wider block mb-2">Name</label>
                  <Input
                    value={minister.name}
                    onChange={(e) => onChange(minister.id, 'name', e.target.value)}
                    className="bg-marble border-stone-dark text-ink"
                  />
                </div>
                <div>
                  <label className="body-sans text-xs text-ink-muted uppercase tracking-wider block mb-2">Role</label>
                  <select
                    value={minister.role}
                    onChange={(e) => {
                      const role = e.target.value
                      onChange(minister.id, 'role', role)
                      if (DEFAULT_PROMPTS[role]) {
                        onChange(minister.id, 'system_prompt', DEFAULT_PROMPTS[role])
                      }
                    }}
                    className="w-full px-3 py-2 bg-marble border border-stone-dark rounded-md body-sans text-ink"
                  >
                    <option value="Advisor">Advisor</option>
                    <option value="Productivity">Productivity</option>
                    <option value="Ethics">Ethics</option>
                    <option value="Philosophy">Philosophy</option>
                    <option value="Economy">Economy</option>
                    <option value="Skeptic">Opposition Leader</option>
                    <option value="Synthesizer">Prime Minister</option>
                  </select>
                </div>
              </div>

              {/* Model Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="body-sans text-xs text-ink-muted uppercase tracking-wider block mb-2">Model</label>
                  <select
                    value={minister.model_name}
                    onChange={(e) => onChange(minister.id, 'model_name', e.target.value)}
                    className="w-full px-3 py-2 bg-marble border border-stone-dark rounded-md body-sans text-ink"
                  >
                    {AVAILABLE_MODELS.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.costTier})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="body-sans text-xs text-ink-muted uppercase tracking-wider block mb-2">
                    Temperature ({minister.temperature})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={minister.temperature}
                    onChange={(e) => onChange(minister.id, 'temperature', parseFloat(e.target.value))}
                    className="w-full accent-wine mt-2"
                  />
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <label className="body-sans text-xs text-ink-muted uppercase tracking-wider block mb-2">System Prompt</label>
                <Textarea
                  value={minister.system_prompt}
                  onChange={(e) => onChange(minister.id, 'system_prompt', e.target.value)}
                  rows={3}
                  className="bg-marble border-stone-dark text-ink text-sm"
                />
              </div>

              {/* Seat Index */}
              <div>
                <label className="body-sans text-xs text-ink-muted uppercase tracking-wider block mb-2">
                  Seat Order (for display)
                </label>
                <Input
                  type="number"
                  min="0"
                  value={minister.seat_index || 0}
                  onChange={(e) => onChange(minister.id, 'seat_index', parseInt(e.target.value))}
                  className="bg-marble border-stone-dark text-ink w-24"
                />
              </div>

              {/* Rating History */}
              {ratings.length > 0 && (
                <div>
                  <label className="body-sans text-xs text-ink-muted uppercase tracking-wider block mb-2">
                    <Star className="h-3 w-3 inline mr-1" />
                    Approval History ({ratings.length} sessions)
                  </label>
                  <div className="bg-marble border border-stone-dark rounded-lg p-3">
                    {/* Stats Summary */}
                    <div className="grid grid-cols-4 gap-4 mb-3 text-center">
                      <div>
                        <div className="body-sans text-lg font-medium text-ink">
                          {(ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)}
                        </div>
                        <div className="body-sans text-xs text-ink-muted">Avg Rating</div>
                      </div>
                      <div>
                        <div className="body-sans text-lg font-medium text-green-600">
                          {ratings.filter(r => r.rating >= 4).length}
                        </div>
                        <div className="body-sans text-xs text-ink-muted">High (4-5)</div>
                      </div>
                      <div>
                        <div className="body-sans text-lg font-medium text-yellow-600">
                          {ratings.filter(r => r.rating === 3).length}
                        </div>
                        <div className="body-sans text-xs text-ink-muted">Neutral (3)</div>
                      </div>
                      <div>
                        <div className="body-sans text-lg font-medium text-red-600">
                          {ratings.filter(r => r.rating <= 2).length}
                        </div>
                        <div className="body-sans text-xs text-ink-muted">Low (1-2)</div>
                      </div>
                    </div>
                    
                    {/* Recent Ratings List */}
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {ratings.slice(-5).reverse().map((r) => (
                        <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b border-stone/50 last:border-0">
                          <span className="text-ink-muted truncate max-w-[60%]">
                            {r.brief_title || 'Session'}
                          </span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-3 w-3 ${star <= r.rating ? 'fill-gold text-gold' : 'text-stone-dark'}`}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => onArchive(minister.id)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-stone-dark rounded body-sans text-xs text-ink-muted hover:text-ink hover:bg-stone/50 transition-colors"
                >
                  <Archive className="h-3 w-3" />
                  Archive
                </button>
                <button
                  onClick={() => onDelete(minister.id)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-wine/30 rounded body-sans text-xs text-wine hover:bg-wine/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  {minister.isNew ? 'Remove' : 'Delete'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
