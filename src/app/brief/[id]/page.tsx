'use client'

import { useEffect, useState, use, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Chamber } from '@/components/cabinet/Chamber'
import { Seat, SeatState, VoteType } from '@/components/cabinet/Seat'
import { Podium } from '@/components/cabinet/Podium'
import { Loader2, MessageSquare, Users, Play, Send, Star, AlertTriangle, Clock, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'

export const dynamic = 'force-dynamic'

interface DiscussionMessage {
  id: string
  brief_id: string
  turn_index: number
  speaker_member_id: string | null
  speaker_role: string
  message_type: string
  content: string
  metadata: Record<string, any>
  created_at: string
}

interface Minister {
  id: string
  name: string
  role: string
  model_name: string
  status?: string
  total_rating_count?: number
  total_rating_sum?: number
  warnings?: number
}

type ViewMode = 'grid' | 'transcript'

// 2 minute timeout for debates (120 seconds)
const DEBATE_TIMEOUT_MS = 2 * 60 * 1000

function BriefDetailPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const router = useRouter()
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
  const [interjection, setInterjection] = useState('')
  const [pendingInterjection, setPendingInterjection] = useState<string | null>(null)
  const [showRating, setShowRating] = useState(false)
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [debateTimedOut, setDebateTimedOut] = useState(false)
  const supabase = createClient()
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const debateStartTimeRef = useRef<number | null>(null)
  const debateExtendedRef = useRef<boolean>(false)
  const autoStartTriggered = useRef<boolean>(false)
  const startDebateRef = useRef<(() => void) | null>(null)

  const scrollToBottom = useCallback(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const addToTranscript = useCallback((msg: DiscussionMessage | null | undefined) => {
    if (!msg) return // Ignore null/undefined messages
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
        .neq('status', 'suspended')
        .order('seat_index')

      const { data: messages } = await supabase
        .from('discussion_messages')
        .select('*')
        .eq('brief_id', id)
        .order('turn_index')
        .order('created_at')

      setBrief(briefData)
      setMinisters(members || [])
      setResponses(briefData.brief_responses || [])
      // Filter out any null/undefined messages
      setTranscript((messages || []).filter(m => m !== null && m !== undefined))

      // Initialize ratings
      const initialRatings: Record<string, number> = {}
      members?.forEach(m => { initialRatings[m.id] = 3 })
      setRatings(initialRatings)
    }

    initSession()
  }, [id, supabase])

  // Auto-start debate if coming from new brief creation
  useEffect(() => {
    const shouldAutoStart = searchParams.get('autostart') === 'true'
    if (
      shouldAutoStart && 
      !autoStartTriggered.current && 
      brief && 
      ministers.length > 0 && 
      user &&
      brief.status === 'queued' &&
      transcript.length === 0 &&
      startDebateRef.current
    ) {
      autoStartTriggered.current = true
      // Remove the autostart param from URL to prevent re-triggering
      router.replace(`/brief/${id}`, { scroll: false })
      // Start the debate
      startDebateRef.current()
    }
  }, [searchParams, brief, ministers, user, transcript, id, router])

  // Extend debate by another 2 minutes
  const extendDebate = () => {
    debateStartTimeRef.current = Date.now()
    debateExtendedRef.current = true
    setTimeRemaining(DEBATE_TIMEOUT_MS / 1000)
    setDebateTimedOut(false)
  }

  // Submit interjection - extends debate timeout
  const submitInterjection = () => {
    if (!interjection.trim()) return
    setPendingInterjection(interjection)
    
    // Extend the debate timer when user interjects
    debateExtendedRef.current = true
    debateStartTimeRef.current = Date.now()
    setTimeRemaining(DEBATE_TIMEOUT_MS / 1000)
    
    // Add to local transcript as user message (not persisted to DB)
    const userMsg: DiscussionMessage = {
      id: `local-user-${Date.now()}`,
      brief_id: id,
      turn_index: transcript.length,
      speaker_member_id: null,
      speaker_role: 'user',
      message_type: 'interjection',
      content: interjection,
      metadata: {},
      created_at: new Date().toISOString(),
    }
    addToTranscript(userMsg)
    setInterjection('')
  }

  // Check if debate should timeout
  const checkDebateTimeout = (): boolean => {
    if (!debateStartTimeRef.current) return false
    const elapsed = Date.now() - debateStartTimeRef.current
    return elapsed >= DEBATE_TIMEOUT_MS
  }

  // Run a single debate turn - returns null if minister not found
  const runTurn = async (
    token: string,
    ministerId: string,
    turnType: string,
    turnIndex: number,
    previousStatements?: string
  ): Promise<any | null> => {
    try {
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
          user_interjection: pendingInterjection,
        }),
      })

      // Clear interjection after use
      if (pendingInterjection) setPendingInterjection(null)

      if (!res.ok) {
        const error = await res.json()
        // If minister not found, skip them instead of failing entire debate
        if (error.error?.includes('Minister not found')) {
          console.warn(`Skipping minister ${ministerId}: ${error.error}`)
          return null
        }
        throw new Error(error.error || 'Turn failed')
      }

      return res.json()
    } catch (error: any) {
      console.error(`Error in turn for minister ${ministerId}:`, error)
      // Return null to skip this minister rather than fail the whole debate
      if (error.message?.includes('Minister not found')) {
        return null
      }
      throw error
    }
  }

  // Start full debate with 2-minute timeout
  const startDebate = async () => {
    if (!user) return
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    setIsProcessing(true)
    setViewMode('transcript')
    debateStartTimeRef.current = Date.now()
    debateExtendedRef.current = false
    setTimeRemaining(DEBATE_TIMEOUT_MS / 1000)
    
    // Start countdown timer
    const timerInterval = setInterval(() => {
      if (debateStartTimeRef.current) {
        const elapsed = Date.now() - debateStartTimeRef.current
        const remaining = Math.max(0, Math.ceil((DEBATE_TIMEOUT_MS - elapsed) / 1000))
        setTimeRemaining(remaining)
      }
    }, 1000)
    
    await supabase.from('briefs').update({ status: 'running' }).eq('id', id)

    const regularMinisters = ministers.filter(m => m.role !== 'Synthesizer')
    const pmMinister = ministers.find(m => m.role === 'Synthesizer')
    const oppositionLeader = ministers.find(m => m.role === 'Skeptic')
    
    let turnIndex = 0
    const openingStatements: { minister: Minister; content: string; vote?: string }[] = []
    let timedOut = false

    const finishDebate = async (reason: 'completed' | 'timeout') => {
      clearInterval(timerInterval)
      debateStartTimeRef.current = null
      
      if (reason === 'timeout') {
        setDebateTimedOut(true)
        setTimeRemaining(0)
        addSystemMessage('⏱️ Debate time limit reached. Click "Continue Debate" or proceeding to synthesis.', turnIndex++)
      } else {
        setTimeRemaining(null)
      }
    }

    // Helper to create message for transcript when server doesn't return one
    const createLocalMessage = (ministerId: string, content: string, turnIdx: number, msgType: string, vote?: string): DiscussionMessage => ({
      id: `local-${ministerId}-${turnIdx}-${Date.now()}`,
      brief_id: id,
      turn_index: turnIdx,
      speaker_member_id: ministerId,
      speaker_role: ministers.find(m => m.id === ministerId)?.role || 'unknown',
      message_type: msgType,
      content,
      metadata: { vote },
      created_at: new Date().toISOString(),
    })

    try {
      // ROUND 1: Opening Statements (always runs)
      setCurrentPhase('Opening Statements')
      addSystemMessage('📢 Cabinet session begins. Ministers present opening statements.', turnIndex++)

      for (const minister of regularMinisters) {
        setActiveMinisterId(minister.id)
        const currentTurn = turnIndex++
        const result = await runTurn(session.access_token, minister.id, 'opening', currentTurn)
        // Skip if minister was not found
        if (!result) continue
        openingStatements.push({ minister, content: result.content, vote: result.vote })
        // Use server message or create local one
        const msg = result.message || createLocalMessage(minister.id, result.content, currentTurn, 'opening', result.vote)
        addToTranscript(msg)
        setResponses(prev => [...prev, {
          cabinet_member_id: minister.id,
          response_text: result.content,
          vote: result.vote,
        }])
      }

      // Check timeout before rebuttals
      if (checkDebateTimeout()) {
        timedOut = true
        await finishDebate('timeout')
      }

      // ROUND 2: Rebuttals (if time remains)
      if (!timedOut && regularMinisters.length > 1 && openingStatements.length > 0) {
        setCurrentPhase('Rebuttals')
        addSystemMessage('🔄 Rebuttal round. Ministers respond to each other.', turnIndex++)

        for (const minister of regularMinisters) {
          if (checkDebateTimeout()) {
            timedOut = true
            await finishDebate('timeout')
            break
          }
          setActiveMinisterId(minister.id)
          const othersStatements = openingStatements
            .filter(s => s.minister.id !== minister.id)
            .map(s => `${s.minister.name}: ${s.content}`)
            .join('\n\n')

          const currentTurn = turnIndex++
          const result = await runTurn(session.access_token, minister.id, 'rebuttal', currentTurn, othersStatements)
          if (result) {
            const msg = result.message || createLocalMessage(minister.id, result.content, currentTurn, 'rebuttal')
            addToTranscript(msg)
          }
        }
      }

      // ROUND 3: Cross-Examination (if time remains)
      if (!timedOut && oppositionLeader) {
        if (checkDebateTimeout()) {
          timedOut = true
          await finishDebate('timeout')
        } else {
          setCurrentPhase('Cross-Examination')
          addSystemMessage('⚔️ Opposition Leader cross-examines the Cabinet.', turnIndex++)
          
          setActiveMinisterId(oppositionLeader.id)
          const allStatements = openingStatements.map(s => `${s.minister.name}: ${s.content}`).join('\n\n')
          const currentTurn = turnIndex++
          const result = await runTurn(session.access_token, oppositionLeader.id, 'cross_exam', currentTurn, allStatements)
          if (result) {
            const msg = result.message || createLocalMessage(oppositionLeader.id, result.content, currentTurn, 'cross_exam')
            addToTranscript(msg)
          }
        }
      }

      // ROUND 4: Closing Statements (skipped if timeout)
      if (!timedOut) {
        if (checkDebateTimeout()) {
          timedOut = true
          await finishDebate('timeout')
        } else {
          setCurrentPhase('Closing Statements')
          addSystemMessage('📝 Final positions from each minister.', turnIndex++)

          for (const minister of regularMinisters.filter(m => m.role !== 'Skeptic')) {
            if (checkDebateTimeout()) {
              timedOut = true
              await finishDebate('timeout')
              break
            }
            setActiveMinisterId(minister.id)
            const fullDiscussion = transcript.filter(t => t.message_type !== 'system').map(t => 
              `${getMemberName(t.speaker_member_id)}: ${t.content}`
            ).join('\n\n')
            
            const currentTurn = turnIndex++
            const result = await runTurn(session.access_token, minister.id, 'closing', currentTurn, fullDiscussion)
            if (result) {
              const msg = result.message || createLocalMessage(minister.id, result.content, currentTurn, 'closing', result.vote)
              addToTranscript(msg)
            }
          }
        }
      }

      // ROUND 5: PM Synthesis (always runs even if timed out)
      if (pmMinister) {
        setCurrentPhase('Prime Minister Synthesis')
        addSystemMessage('👑 The Prime Minister synthesizes the debate.', turnIndex++)

        setActiveMinisterId(pmMinister.id)
        const fullTranscript = openingStatements
          .map(s => `${s.minister.name} (${s.vote}): ${s.content}`)
          .join('\n\n')

        const currentTurn = turnIndex++
        const result = await runTurn(session.access_token, pmMinister.id, 'synthesis', currentTurn, fullTranscript)
        if (result) {
          const synthContent = result.content || (result.synthesis ? JSON.stringify(result.synthesis) : '')
          const msg = result.message || createLocalMessage(pmMinister.id, synthContent, currentTurn, 'synthesis')
          addToTranscript(msg)
          
          if (result.synthesis) {
            setResponses(prev => [...prev, {
              cabinet_member_id: pmMinister.id,
              response_text: JSON.stringify(result.synthesis),
              vote: 'abstain',
              metadata: { type: 'synthesis' },
            }])
          }
        }
      }

      if (!timedOut) {
        await finishDebate('completed')
      }

      // Done - show rating UI
      await supabase.from('briefs').update({ status: 'done' }).eq('id', id)
      setBrief((prev: any) => ({ ...prev, status: 'done' }))
      setShowRating(true)

    } catch (error: any) {
      console.error('Debate error:', error)
      alert('Error: ' + error.message)
      clearInterval(timerInterval)
    } finally {
      setIsProcessing(false)
      setActiveMinisterId(null)
      setCurrentPhase('')
      setTimeRemaining(null)
      setDebateTimedOut(false)
    }
  }

  // Store startDebate in ref for auto-start
  startDebateRef.current = startDebate

  // Add system message (local only, not persisted to DB)
  const addSystemMessage = (content: string, turnIndex: number) => {
    const msg: DiscussionMessage = {
      id: `local-sys-${Date.now()}-${turnIndex}`,
      brief_id: id,
      turn_index: turnIndex,
      speaker_member_id: null,
      speaker_role: 'system',
      message_type: 'system',
      content,
      metadata: {},
      created_at: new Date().toISOString(),
    }
    addToTranscript(msg)
  }

  const getMemberName = (memberId: string | null) => {
    if (!memberId) return 'System'
    const member = ministers.find(m => m.id === memberId)
    return member?.name || 'Unknown'
  }

  // Submit ratings
  const submitRatings = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const ratingData = Object.entries(ratings).map(([minister_id, rating]) => ({
      minister_id,
      rating,
    }))

    try {
      const res = await fetch('/.netlify/functions/ministers-rate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ brief_id: id, ratings: ratingData }),
      })

      const result = await res.json()
      
      if (result.results) {
        const statusChanges = result.results.filter((r: any) => r.status_change)
        if (statusChanges.length > 0) {
          alert(`Performance updates:\n${statusChanges.map((r: any) => 
            `${r.name}: ${r.status_change.reason}`
          ).join('\n')}`)
        }
      }

      setShowRating(false)
    } catch (error: any) {
      console.error('Rating error:', error)
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

  const getResponse = (ministerId: string) => responses.find(r => r.cabinet_member_id === ministerId)
  const getMinisterAvgRating = (m: Minister) => {
    if (!m.total_rating_count) return null
    return (m.total_rating_sum! / m.total_rating_count).toFixed(1)
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

        <div className="flex items-center gap-4">
          {/* Timer display */}
          {isProcessing && timeRemaining !== null && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full body-sans text-sm ${
              timeRemaining < 30 ? 'bg-wine/20 text-wine' : 'bg-stone text-ink-muted'
            }`}>
              <Clock className="h-4 w-4" />
              <span>{Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</span>
              {timeRemaining < 30 && !debateTimedOut && <span className="text-xs">(add input to extend)</span>}
            </div>
          )}

          {/* Continue Debate button - shown when timed out but still processing */}
          {debateTimedOut && isProcessing && (
            <button
              onClick={extendDebate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-white rounded-lg body-sans font-medium hover:bg-gold/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Continue (+2 min)
            </button>
          )}

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
      </div>

      {/* Transcript View */}
      {viewMode === 'transcript' && (
        <div className="max-w-3xl mx-auto px-4">
          {!hasTranscript && !isProcessing && (
            <div className="text-center py-16 border border-dashed border-stone-dark rounded-lg">
              <MessageSquare className="h-12 w-12 text-ink-muted mx-auto mb-4" />
              <p className="body-sans text-ink-muted mb-4">No debate transcript yet.</p>
            </div>
          )}

          {hasTranscript && (
            <div className="space-y-3">
              {transcript.filter(msg => msg !== null && msg !== undefined).map((msg) => (
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

          {/* User Interjection Input */}
          {isProcessing && (
            <div className="mt-6 p-4 bg-card border border-stone-dark rounded-lg">
              <p className="body-sans text-xs text-ink-muted mb-2">Add context or redirect the discussion:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={interjection}
                  onChange={(e) => setInterjection(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitInterjection()}
                  placeholder="e.g., 'Consider budget is limited to $500' or 'Focus more on long-term impact'"
                  className="flex-1 px-3 py-2 bg-marble border border-stone-dark rounded body-sans text-sm"
                />
                <button
                  onClick={submitInterjection}
                  disabled={!interjection.trim()}
                  className="px-4 py-2 bg-wine text-white rounded disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {pendingInterjection && (
                <p className="mt-2 text-xs text-wine">Pending: "{pendingInterjection}" - will be included in next response</p>
              )}
            </div>
          )}

          {isProcessing && !interjection && (
            <div className="flex items-center justify-center gap-2 py-4 text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="body-sans text-sm">{currentPhase}</span>
            </div>
          )}
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto px-4">
          {councilMembers.map((m, i) => {
            const response = getResponse(m.id)
            const avgRating = getMinisterAvgRating(m)
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative"
              >
                {m.status === 'probation' && (
                  <div className="absolute -top-2 -right-2 bg-gold text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Probation
                  </div>
                )}
                <Seat
                  name={m.name}
                  role={m.role}
                  state={getSeatState(m.id)}
                  vote={response?.vote as VoteType}
                  response={response?.response_text}
                  isOpposition={m.role === 'Skeptic'}
                  onClick={() => {}}
                />
                {avgRating && (
                  <div className="mt-1 text-center text-xs text-ink-muted">
                    ⭐ {avgRating} avg ({m.total_rating_count} sessions)
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {/* PM Podium */}
      <div className="mt-12 px-4">
        <AnimatePresence>
          {pmData && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
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

      {/* Rating Modal */}
      <AnimatePresence>
        {showRating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-marble border border-stone-dark rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
            >
              <h2 className="heading-serif text-xl text-ink mb-2">Rate Your Ministers</h2>
              <p className="body-sans text-sm text-ink-muted mb-6">
                How helpful was each minister? Low ratings over time may lead to probation or replacement.
              </p>

              <div className="space-y-4">
                {councilMembers.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-card rounded-lg">
                    <div>
                      <p className="heading-serif text-ink">{m.name}</p>
                      <p className="text-xs text-ink-muted">{m.role}</p>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          onClick={() => setRatings(prev => ({ ...prev, [m.id]: star }))}
                          className={`p-1 ${ratings[m.id] >= star ? 'text-gold' : 'text-stone-dark'}`}
                        >
                          <Star className="h-5 w-5" fill={ratings[m.id] >= star ? 'currentColor' : 'none'} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowRating(false)}
                  className="flex-1 px-4 py-2 border border-stone-dark rounded-lg body-sans text-sm"
                >
                  Skip
                </button>
                <button
                  onClick={submitRatings}
                  className="flex-1 px-4 py-2 bg-wine text-white rounded-lg body-sans text-sm"
                >
                  Submit Ratings
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Chamber>
  )
}

function TranscriptMessage({ message, memberName, isActive }: { 
  message: DiscussionMessage
  memberName: string
  isActive: boolean
}) {
  const isSystem = message.message_type === 'system'
  const isUser = message.speaker_role === 'user'
  const isSynthesis = message.message_type === 'synthesis'

  if (isSystem) {
    return (
      <div className="text-center py-2">
        <span className="body-sans text-sm text-ink-muted">{message.content}</span>
      </div>
    )
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-wine/10 border border-wine/20 rounded-lg p-3 max-w-[80%]">
          <p className="text-xs text-wine mb-1">You added:</p>
          <p className="body-sans text-sm text-ink">{message.content}</p>
        </div>
      </div>
    )
  }

  let displayContent = message.content
  if (isSynthesis) {
    try {
      const synth = JSON.parse(message.content)
      displayContent = synth.summary
    } catch {}
  }

  const typeLabels: Record<string, string> = {
    opening: 'Opening',
    rebuttal: 'Rebuttal',
    cross_exam: 'Question',
    closing: 'Final',
    synthesis: 'Synthesis',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`p-3 rounded-lg border ${
        isActive ? 'border-wine bg-wine/5' : 'border-stone-dark bg-card'
      } ${isSynthesis ? 'ring-2 ring-gold/30' : ''}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="heading-serif text-sm text-ink">{memberName}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone text-ink-muted uppercase">
          {typeLabels[message.message_type] || message.message_type}
        </span>
        {message.metadata?.vote && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ml-auto ${
            message.metadata.vote === 'approve' ? 'bg-approve/20 text-approve' :
            message.metadata.vote === 'oppose' ? 'bg-wine/20 text-wine' : 'bg-stone'
          }`}>
            {message.metadata.vote}
          </span>
        )}
      </div>
      <p className="body-sans text-sm text-ink-muted">{displayContent}</p>
    </motion.div>
  )
}

// Fallback for Suspense
function BriefPageFallback() {
  return (
    <div className="min-h-screen bg-marble flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-ink-muted" />
    </div>
  )
}

// Export with Suspense wrapper for useSearchParams
export default function BriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<BriefPageFallback />}>
      <BriefDetailPageContent params={params} />
    </Suspense>
  )
}
