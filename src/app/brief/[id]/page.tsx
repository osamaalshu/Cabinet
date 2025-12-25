'use client'

import { useEffect, useState, use, useCallback, useRef } from 'react'
import { Chamber } from '@/components/cabinet/Chamber'
import { Seat, SeatState, VoteType } from '@/components/cabinet/Seat'
import { Podium } from '@/components/cabinet/Podium'
import { Loader2, MessageSquare, Users, Play } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'

export const dynamic = 'force-dynamic'

interface DiscussionMessage {
  id: string
  brief_id: string
  turn_index: number
  speaker_member_id: string | null
  speaker_role: string
  message_type: 'opening' | 'rebuttal' | 'cross_exam' | 'synthesis' | 'vote' | 'system'
  content: string
  metadata: Record<string, any>
  created_at: string
}

interface Minister {
  id: string
  name: string
  role: string
  model_name: string
}

type ViewMode = 'grid' | 'transcript'

export default function BriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [brief, setBrief] = useState<any>(null)
  const [ministers, setMinisters] = useState<Minister[]>([])
  const [responses, setResponses] = useState<any[]>([])
  const [transcript, setTranscript] = useState<DiscussionMessage[]>([])
  const [activeMinisterId, setActiveMinisterId] = useState<string | null>(null)
  const [currentPhase, setCurrentPhase] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('transcript')
  const supabase = createClient()
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const addToTranscript = useCallback((msg: DiscussionMessage) => {
    setTranscript(prev => [...prev, msg])
    setTimeout(scrollToBottom, 100)
  }, [scrollToBottom])

  // Initial load
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

      const { data: members } = await supabase
        .from('cabinet_members')
        .select('*')
        .eq('user_id', briefData.user_id)
        .eq('is_enabled', true)
        .order('seat_index')

      // Load existing transcript
      const { data: messages } = await supabase
        .from('discussion_messages')
        .select('*')
        .eq('brief_id', id)
        .order('turn_index')
        .order('created_at')

      setBrief(briefData)
      setMinisters(members || [])
      setResponses(briefData.brief_responses || [])
      setTranscript(messages || [])
    }

    initSession()
  }, [id, supabase])

  // Run a single debate turn
  const runTurn = async (
    token: string,
    ministerId: string,
    turnType: string,
    turnIndex: number,
    previousStatements?: string
  ) => {
    const res = await fetch('/.netlify/functions/briefs-debate-turn', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        brief_id: id,
        minister_id: ministerId,
        turn_type: turnType,
        turn_index: turnIndex,
        previous_statements: previousStatements,
      }),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Turn failed')
    }

    return res.json()
  }

  // Start full debate - client orchestrates, server handles each turn
  const startDebate = async () => {
    if (!user) return
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    setIsProcessing(true)
    setViewMode('transcript')

    // Update brief status
    await supabase.from('briefs').update({ status: 'running' }).eq('id', id)

    const regularMinisters = ministers.filter(m => m.role !== 'Synthesizer')
    const pmMinister = ministers.find(m => m.role === 'Synthesizer')
    
    let turnIndex = 0
    const openingStatements: { minister: Minister; content: string; vote?: string }[] = []

    try {
      // System message: Opening
      setCurrentPhase('Opening Statements')
      const systemMsg: DiscussionMessage = {
        id: `sys-${Date.now()}`,
        brief_id: id,
        turn_index: turnIndex++,
        speaker_member_id: null,
        speaker_role: 'system',
        message_type: 'system',
        content: '📢 The Cabinet session begins. Ministers will present their opening statements.',
        metadata: { phase: 'opening' },
        created_at: new Date().toISOString(),
      }
      addToTranscript(systemMsg)
      await supabase.from('discussion_messages').insert(systemMsg)

      // ROUND 1: Opening Statements (sequential for live effect)
      for (const minister of regularMinisters) {
        setActiveMinisterId(minister.id)
        
        const result = await runTurn(session.access_token, minister.id, 'opening', turnIndex++)
        
        openingStatements.push({ 
          minister, 
          content: result.content, 
          vote: result.vote 
        })

        // Add to local transcript
        addToTranscript(result.message)
        setResponses(prev => [...prev, {
          cabinet_member_id: minister.id,
          response_text: result.content,
          vote: result.vote,
        }])
      }

      // ROUND 2: Rebuttals (if more than 2 ministers)
      if (regularMinisters.length > 2) {
        setCurrentPhase('Rebuttals')
        
        const rebuttalSystemMsg: DiscussionMessage = {
          id: `sys-rebuttal-${Date.now()}`,
          brief_id: id,
          turn_index: turnIndex++,
          speaker_member_id: null,
          speaker_role: 'system',
          message_type: 'system',
          content: '🔄 Rebuttal round. Ministers respond to their colleagues.',
          metadata: { phase: 'rebuttal' },
          created_at: new Date().toISOString(),
        }
        addToTranscript(rebuttalSystemMsg)
        await supabase.from('discussion_messages').insert(rebuttalSystemMsg)

        const allStatements = openingStatements
          .map(s => `${s.minister.name}: ${s.content}`)
          .join('\n\n')

        for (const minister of regularMinisters) {
          setActiveMinisterId(minister.id)
          
          const othersStatements = openingStatements
            .filter(s => s.minister.id !== minister.id)
            .map(s => `${s.minister.name}: ${s.content}`)
            .join('\n\n')

          const result = await runTurn(
            session.access_token, 
            minister.id, 
            'rebuttal', 
            turnIndex++,
            othersStatements
          )

          addToTranscript(result.message)
        }
      }

      // ROUND 3: PM Synthesis
      if (pmMinister) {
        setCurrentPhase('Prime Minister Synthesis')
        
        const synthSystemMsg: DiscussionMessage = {
          id: `sys-synth-${Date.now()}`,
          brief_id: id,
          turn_index: turnIndex++,
          speaker_member_id: null,
          speaker_role: 'system',
          message_type: 'system',
          content: '👑 The Prime Minister will now synthesize the discussion.',
          metadata: { phase: 'synthesis' },
          created_at: new Date().toISOString(),
        }
        addToTranscript(synthSystemMsg)
        await supabase.from('discussion_messages').insert(synthSystemMsg)

        setActiveMinisterId(pmMinister.id)

        const fullTranscript = openingStatements
          .map(s => `${s.minister.name} (${s.vote}): ${s.content}`)
          .join('\n\n')

        const result = await runTurn(
          session.access_token,
          pmMinister.id,
          'synthesis',
          turnIndex++,
          fullTranscript
        )

        addToTranscript(result.message)
        
        if (result.synthesis) {
          setResponses(prev => [...prev, {
            cabinet_member_id: pmMinister.id,
            response_text: JSON.stringify(result.synthesis),
            vote: 'abstain',
            metadata: { type: 'synthesis' },
          }])
        }
      }

      // Done
      await supabase.from('briefs').update({ status: 'done' }).eq('id', id)
      setBrief((prev: any) => ({ ...prev, status: 'done' }))

    } catch (error: any) {
      console.error('Debate error:', error)
      alert('Error: ' + error.message)
    } finally {
      setIsProcessing(false)
      setActiveMinisterId(null)
      setCurrentPhase('')
    }
  }

  if (!brief) {
    return (
      <div className="min-h-screen bg-marble flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ink-muted" />
      </div>
    )
  }

  const pmResponse = responses.find((r: any) => r.metadata?.type === 'synthesis')
  const pmData = pmResponse ? JSON.parse(pmResponse.response_text) : null
  const councilMembers = ministers.filter(m => m.role !== 'Synthesizer')
  const hasTranscript = transcript.length > 0
  const canStartDebate = brief.status === 'queued' || (brief.status !== 'done' && !hasTranscript)

  const getSeatState = (ministerId: string): SeatState => {
    if (activeMinisterId === ministerId) return 'speaking'
    if (responses.find(r => r.cabinet_member_id === ministerId)) return 'responded'
    return 'idle'
  }

  const getResponse = (ministerId: string) => {
    return responses.find(r => r.cabinet_member_id === ministerId)
  }

  const getMemberName = (memberId: string | null) => {
    if (!memberId) return 'System'
    const member = ministers.find(m => m.id === memberId)
    return member?.name || 'Unknown'
  }

  return (
    <Chamber
      title={brief.title}
      subtitle={isProcessing ? currentPhase || 'Debate in progress...' : (hasTranscript ? 'Deliberation complete' : 'Ready to begin')}
      isInSession={isProcessing}
      userEmail={user?.email}
      userName={profile?.display_name}
    >
      {/* View Toggle + Start Debate */}
      <div className="flex items-center justify-between mb-6 px-4">
        <div className="inline-flex items-center gap-1 p-1 bg-stone/50 rounded-lg border border-stone-dark">
          <button
            onClick={() => setViewMode('transcript')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md body-sans text-sm transition-all ${
              viewMode === 'transcript' ? 'bg-marble text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Transcript
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md body-sans text-sm transition-all ${
              viewMode === 'grid' ? 'bg-marble text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Users className="h-4 w-4" />
            Ministers
          </button>
        </div>

        {canStartDebate && (
          <button
            onClick={startDebate}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-6 py-2 bg-wine text-white rounded-lg body-sans font-medium hover:bg-wine-light transition-colors disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isProcessing ? 'Running...' : 'Start Debate'}
          </button>
        )}
      </div>

      {/* Transcript View */}
      {viewMode === 'transcript' && (
        <div className="max-w-3xl mx-auto px-4">
          {!hasTranscript && !isProcessing && (
            <div className="text-center py-16 border border-dashed border-stone-dark rounded-lg">
              <MessageSquare className="h-12 w-12 text-ink-muted mx-auto mb-4" />
              <p className="body-sans text-ink-muted mb-4">No debate transcript yet.</p>
              <p className="body-sans text-sm text-ink-muted">Click "Start Debate" to begin the Cabinet session.</p>
            </div>
          )}

          {hasTranscript && (
            <div className="space-y-4">
              {transcript.map((msg) => (
                <TranscriptMessage 
                  key={msg.id} 
                  message={msg} 
                  memberName={getMemberName(msg.speaker_member_id)}
                  isActive={activeMinisterId === msg.speaker_member_id && isProcessing}
                />
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center justify-center gap-2 py-8 text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="body-sans text-sm">{currentPhase || 'Ministers are deliberating...'}</span>
            </div>
          )}
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto px-4">
          {councilMembers.map((m, i) => {
            const response = getResponse(m.id)
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Seat
                  name={m.name}
                  role={m.role}
                  state={getSeatState(m.id)}
                  vote={response?.vote as VoteType}
                  response={response?.response_text}
                  isOpposition={m.role === 'Skeptic'}
                  onClick={() => {}}
                />
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Prime Minister's Podium */}
      <div className="mt-12 px-4">
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
      </div>
    </Chamber>
  )
}

// Transcript Message Component
function TranscriptMessage({ 
  message, 
  memberName,
  isActive 
}: { 
  message: DiscussionMessage
  memberName: string
  isActive: boolean
}) {
  const isSystem = message.message_type === 'system'
  const isSynthesis = message.message_type === 'synthesis'

  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-3"
      >
        <span className="body-sans text-sm text-ink-muted">{message.content}</span>
      </motion.div>
    )
  }

  let displayContent = message.content
  if (isSynthesis) {
    try {
      const synth = JSON.parse(message.content)
      displayContent = synth.summary || message.content
    } catch {
      // Keep original
    }
  }

  const typeLabels: Record<string, string> = {
    opening: 'Opening',
    rebuttal: 'Rebuttal',
    cross_exam: 'Cross-Exam',
    synthesis: 'Synthesis',
    vote: 'Vote',
  }

  const typeColors: Record<string, string> = {
    opening: 'bg-stone text-ink-muted',
    rebuttal: 'bg-blue-100 text-blue-800',
    cross_exam: 'bg-wine/10 text-wine',
    synthesis: 'bg-gold/20 text-gold-muted',
    vote: 'bg-approve/10 text-approve',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`p-4 rounded-lg border ${
        isActive ? 'border-wine bg-wine/5' : 'border-stone-dark bg-card'
      } ${isSynthesis ? 'ring-2 ring-gold/30' : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="heading-serif text-ink">{memberName}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${typeColors[message.message_type] || 'bg-stone'}`}>
            {typeLabels[message.message_type] || message.message_type}
          </span>
        </div>
        {message.metadata?.vote && (
          <span className={`text-xs px-2 py-0.5 rounded uppercase ${
            message.metadata.vote === 'approve' ? 'bg-approve/10 text-approve' :
            message.metadata.vote === 'oppose' ? 'bg-wine/10 text-wine' :
            'bg-stone text-ink-muted'
          }`}>
            {message.metadata.vote}
          </span>
        )}
      </div>
      <p className="body-sans text-sm text-ink-muted leading-relaxed">{displayContent}</p>
      {isActive && (
        <div className="mt-2 flex items-center gap-1 text-wine">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-xs">Speaking...</span>
        </div>
      )}
    </motion.div>
  )
}
