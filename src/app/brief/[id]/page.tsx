'use client'

import { useEffect, useState, use } from 'react'
import Navbar from '@/components/common/Navbar'
import { MinisterCard } from '@/components/cabinet/MinisterCard'
import { BriefSummary } from '@/components/cabinet/BriefSummary'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function BriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [brief, setBrief] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchBrief() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/.netlify/functions/briefs-get?id=${id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setBrief(data)
      }
      setIsLoading(false)
    }

    fetchBrief()
  }, [id, supabase])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!brief) return <div>Brief not found</div>

  const pmResponse = brief.responses.find((r: any) => r.metadata?.type === 'synthesis')
  const pmData = pmResponse ? JSON.parse(pmResponse.response_text) : null
  const ministerResponses = brief.responses.filter((r: any) => r.metadata?.type !== 'synthesis')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      <Navbar />
      <main className="container mx-auto px-4 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">{brief.title}</h1>
          <p className="text-gray-500">Called on {new Date(brief.created_at).toLocaleDateString()}</p>
        </div>

        {pmData && (
          <div className="mb-12">
            <BriefSummary summary={pmData.summary} options={pmData.options} />
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Cabinet Responses</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ministerResponses.map((r: any) => (
              <MinisterCard
                key={r.id}
                name={r.member.name}
                role={r.member.role}
                responseText={r.response_text}
                vote={r.vote}
                onClick={() => {}} // TODO: Show dialog
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

