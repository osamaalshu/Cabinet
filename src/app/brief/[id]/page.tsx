'use client'

import { useEffect, useState, use } from 'react'
import Navbar from '@/components/common/Navbar'
import { MinisterCard } from '@/components/cabinet/MinisterCard'
import { BriefSummary } from '@/components/cabinet/BriefSummary'
import { Loader2, MessageSquare, Sparkles } from 'lucide-react'
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
  const supabase = createClient()

  useEffect(() => {
    async function initSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // 1. Fetch the brief and all enabled ministers
      const { data: briefData } = await supabase.from('briefs').select('*, brief_responses(*)')
        .eq('id', id).single()
      
      const { data: members } = await supabase.from('cabinet_members')
        .select('*').eq('user_id', briefData.user_id).eq('is_enabled', true)

      setBrief(briefData)
      setMinisters(members || [])
      setResponses(briefData.brief_responses || [])

      // 2. If the brief is still 'running' and has no responses, start the live session
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

  if (!brief) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>

  const pmResponse = responses.find((r: any) => r.metadata?.type === 'synthesis')
  const pmData = pmResponse ? JSON.parse(pmResponse.response_text) : null
  const ministerResponses = responses.filter((r: any) => r.metadata?.type !== 'synthesis')

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <Navbar />
      <main className="container mx-auto px-4 py-12">
        <div className="mb-12 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black tracking-tight mb-2 uppercase"
          >
            {brief.title}
          </motion.h1>
          <p className="text-slate-500 font-medium">Cabinet Session in Progress</p>
        </div>

        <AnimatePresence>
          {pmData && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-16"
            >
              <BriefSummary summary={pmData.summary} options={pmData.options} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {ministers.filter(m => m.role !== 'Synthesizer').map((m) => {
            const response = responses.find(r => r.cabinet_member_id === m.id)
            const isActive = activeMinisterId === m.id

            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`relative rounded-xl transition-all duration-500 ${
                  isActive ? 'ring-4 ring-primary ring-offset-4 scale-105 z-10' : ''
                }`}
              >
                {isActive && (
                  <div className="absolute -top-4 -right-4 bg-primary text-white p-2 rounded-full shadow-lg animate-bounce">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                )}
                
                {response ? (
                  <MinisterCard
                    name={m.name}
                    role={m.role}
                    responseText={response.response_text}
                    vote={response.vote}
                    onClick={() => {}}
                  />
                ) : (
                  <div className="h-48 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center bg-white/50 dark:bg-slate-900/50">
                    {isActive ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <span className="text-sm font-bold text-primary animate-pulse">{m.name} is speaking...</span>
                      </>
                    ) : (
                      <>
                        <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-800 mb-2" />
                        <span className="text-xs font-medium text-slate-400 uppercase">{m.role}</span>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </main>

      {isProcessing && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 bg-primary text-white p-4 text-center font-bold flex items-center justify-center gap-2 shadow-2xl"
        >
          <Sparkles className="h-5 w-5 animate-pulse" />
          Live Deliberation Underway...
        </motion.div>
      )}
    </div>
  )
}
