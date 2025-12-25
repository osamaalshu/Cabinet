'use client'

import { useEffect, useState, use } from 'react'
import { Chamber } from '@/components/cabinet/Chamber'
import { Seat, SeatState, VoteType } from '@/components/cabinet/Seat'
import { Podium } from '@/components/cabinet/Podium'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'

export const dynamic = 'force-dynamic'

// Fixed seat positions for a semi-circular arrangement (5 ministers + opposition)
const SEAT_POSITIONS = [
  { top: '45%', left: '5%', transform: 'translateY(-50%)' },   // Left edge
  { top: '15%', left: '15%' },                                   // Top-left
  { top: '0%', left: '50%', transform: 'translateX(-50%)' },    // Top center
  { top: '15%', right: '15%' },                                  // Top-right
  { top: '45%', right: '5%', transform: 'translateY(-50%)' },  // Right edge
]

const OPPOSITION_POSITION = { bottom: '0%', left: '50%', transform: 'translateX(-50%)' }

export default function BriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [brief, setBrief] = useState<any>(null)
  const [ministers, setMinisters] = useState<any[]>([])
  const [responses, setResponses] = useState<any[]>([])
  const [activeMinisterId, setActiveMinisterId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function initSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: briefData } = await supabase.from('briefs').select('*, brief_responses(*)')
        .eq('id', id).single()
      
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
  
  // Separate ministers: regular vs opposition
  const regularMinisters = ministers.filter(m => m.role !== 'Synthesizer' && m.role !== 'Skeptic')
  const opposition = ministers.find(m => m.role === 'Skeptic')

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
    >
      {/* The Round Table */}
      <div className="relative mt-8 mb-16" style={{ minHeight: '500px' }}>
        
        {/* Regular Ministers - Semi-circle arrangement */}
        {regularMinisters.slice(0, 5).map((m, i) => {
          const response = getResponse(m.id)
          const position = SEAT_POSITIONS[i] || SEAT_POSITIONS[0]
          
          return (
            <div
              key={m.id}
              className="absolute w-64"
              style={position}
            >
              <Seat
                name={m.name}
                role={m.role}
                state={getSeatState(m.id)}
                vote={response?.vote as VoteType}
                response={response?.response_text}
                onClick={() => {}}
              />
            </div>
          )
        })}

        {/* Opposition Leader - Separate position at bottom */}
        {opposition && (
          <div
            className="absolute w-72"
            style={OPPOSITION_POSITION}
          >
            <Seat
              name={opposition.name}
              role={opposition.role}
              state={getSeatState(opposition.id)}
              vote={getResponse(opposition.id)?.vote as VoteType}
              response={getResponse(opposition.id)?.response_text}
              isOpposition
              onClick={() => {}}
            />
          </div>
        )}
      </div>

      {/* Prime Minister's Podium - Center Stage */}
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
    </Chamber>
  )
}
