'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/common/Navbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function NewBriefPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    goals: '',
    constraints: '',
    values: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setProgress('Initializing the Cabinet...')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      // 1. Create the Brief
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
            values: formData.values.split(',').map(v => v.trim()),
          },
        }),
      })

      const { brief_id, ministers } = await createRes.json()
      
      const regularMinisters = ministers.filter((m: any) => m.role !== 'Synthesizer')
      const pm = ministers.find((m: any) => m.role === 'Synthesizer')

      // 2. Run each minister sequentially
      for (const m of regularMinisters) {
        setProgress(`Consulting ${m.role}...`)
        await fetch('/.netlify/functions/briefs-process-agent', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ brief_id, cabinet_member_id: m.id, is_pm: false }),
        })
      }

      // 3. Run Prime Minister
      if (pm) {
        setProgress('Prime Minister is synthesizing...')
        await fetch('/.netlify/functions/briefs-process-agent', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ brief_id, cabinet_member_id: pm.id, is_pm: true }),
        })
      }

      // 4. Mark Done and Redirect
      await supabase.from('briefs').update({ status: 'done' }).eq('id', brief_id)
      router.push(`/brief/${brief_id}`)
    } catch (error: any) {
      console.error(error)
      alert(`Meeting interrupted: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">New Morning Brief</CardTitle>
              <CardDescription>Set the agenda for today's cabinet meeting.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Brief Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goals">Goals</Label>
                  <Textarea
                    id="goals"
                    className="min-h-[100px]"
                    value={formData.goals}
                    onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="constraints">Constraints</Label>
                  <Textarea
                    id="constraints"
                    value={formData.constraints}
                    onChange={(e) => setFormData({ ...formData, constraints: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="values">Values (comma-separated)</Label>
                  <Input
                    id="values"
                    value={formData.values}
                    onChange={(e) => setFormData({ ...formData, values: e.target.value })}
                  />
                </div>
                <Button className="w-full" type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {progress}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Call the Cabinet
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
