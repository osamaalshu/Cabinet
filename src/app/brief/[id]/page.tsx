'use client'

import { useEffect, useState, use } from 'react'
import { Chamber } from '@/components/cabinet/Chamber'
import { Seat, SeatState, VoteType } from '@/components/cabinet/Seat'
import { Podium } from '@/components/cabinet/Podium'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'

export const dynamic = 'force-dynamic'

export default function BriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [brief, setBrief] = useState<any>(null)
  const [ministers, setMinisters] = useState<any[]>([])
  const [responses, setResponses] = useState<any[]>([])
  const [activeMinisterId, setActiveMinisterId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    async function initSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setUser(session.user)

      const [briefRes, profileRes] = await Promise.all([
        supabase.from('briefs').select('*, brief_responses(*)').eq('id', id).single(),
        supabase.from('profiles').select('display_name').eq('id', session.user.id).single()
      ])
      
      const briefData = briefRes.data
      if (profileRes.data) setProfile(profileRes.data)

      const { data: members } = await supabase.from('cabinet_members')
        .select('*').eq('user_id', briefData.user_id).eq('is_enabled', true)

      setBrief(briefData)
      setMinisters(members || [])
      setResponses(briefData.brief_responses || [])

      if (briefData.status === 'running' && briefData.brief_responses.length === 0) {
        runLiveSession(session.access_token, members || [])
      }
    }

    async function runLiveSession(token: string, members: any[]) {
      setIsProcessing(true)
      const others = members.filter(m => m.role !== 'Synthesizer')
      const pm = members.find(m => m.role === 'Synthesizer')

      for (const m of others) {
        setActiveMinisterId(m.id)
        const res = await fetch('/.netlify/functions/briefs-process-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ brief_id: id, cabinet_member_id: m.id, is_pm: false }),
        })
        const newResponse = await res.json()
        setResponses(prev => [...prev, { ...newResponse, member: m }])
      }

      if (pm) {
        setActiveMinisterId(pm.id)
        const res = await fetch('/.netlify/functions/briefs-process-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ brief_id: id, cabinet_member_id: pm.id, is_pm: true }),
        })
        const pmResponse = await res.json()
        setResponses(prev => [...prev, { ...pmResponse, member: pm }])
      }

      await supabase.from('briefs').update({ status: 'done' }).eq('id', id)
      setActiveMinisterId(null)
      setIsProcessing(false)
    }

    initSession()
  }, [id, supabase])

  if (!brief) {
    return (
      <div className="min-h-screen bg-marble flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ink-muted" />
      </div>
    )
  }

  const pmResponse = responses.find((r: any) => r.metadata?.type === 'synthesis')
  const pmData = pmResponse ? JSON.parse(pmResponse.response_text) : null
  
  // Get all ministers except PM
  const councilMembers = ministers.filter(m => m.role !== 'Synthesizer')

  const getSeatState = (ministerId: string): SeatState => {
    if (activeMinisterId === ministerId) return 'speaking'
    if (responses.find(r => r.cabinet_member_id === ministerId)) return 'responded'
    return 'idle'
  }

  const getResponse = (ministerId: string) => {
    return responses.find(r => r.cabinet_member_id === ministerId)
  }

  return (
    <Chamber
      title={brief.title}
      subtitle={isProcessing ? 'Session in progress' : 'Deliberation complete'}
      isInSession={isProcessing}
      userEmail={user?.email}
      userName={profile?.display_name}
    >
      {/* The Round Table */}
      <div className="relative flex items-center justify-center py-8">
        {/* Central Table Surface */}
        <div className="absolute w-48 h-48 md:w-64 md:h-64 rounded-full border-4 border-stone-dark bg-gradient-to-br from-stone to-stone-dark shadow-inner" />
        <div className="absolute w-40 h-40 md:w-56 md:h-56 rounded-full border border-stone bg-marble-warm" />
        
        {/* Center Label */}
        <div className="absolute flex flex-col items-center justify-center text-center z-10">
          <span className="heading-serif text-lg text-ink-muted">The</span>
          <span className="heading-display text-2xl text-ink">Round Table</span>
        </div>

        {/* Ministers arranged in a circle */}
        <div className="relative w-[700px] h-[700px] md:w-[850px] md:h-[850px]">
          {councilMembers.map((m, i) => {
            const response = getResponse(m.id)
            const total = councilMembers.length
            // Start from top (-90deg) and distribute evenly
            const angle = (-90 + (i * 360 / total)) * (Math.PI / 180)
            const radius = 42 // percentage from center
            const x = 50 + radius * Math.cos(angle)
            const y = 50 + radius * Math.sin(angle)
            const isOpposition = m.role === 'Skeptic'

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="absolute w-56 md:w-64"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <Seat
                  name={m.name}
                  role={m.role}
                  state={getSeatState(m.id)}
                  vote={response?.vote as VoteType}
                  response={response?.response_text}
                  isOpposition={isOpposition}
                  onClick={() => {}}
                />
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Prime Minister's Podium - Below the table */}
      <div className="mt-8">
        <AnimatePresence>
          {pmData && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <Podium
                summary={pmData.summary}
                options={pmData.options || []}
                onSelectOption={(i) => console.log('Selected option:', i)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Waiting for PM */}
        {!pmData && !isProcessing && responses.length > 0 && (
          <div className="text-center py-12">
            <p className="body-sans text-ink-muted">
              Awaiting the Prime Minister's synthesis...
            </p>
          </div>
        )}
      </div>
    </Chamber>
  )
}
