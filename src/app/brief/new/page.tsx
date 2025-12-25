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
  const [formData, setFormData] = useState({
    title: '',
    goals: '',
    constraints: '',
    values: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('You must be logged in to create a brief.')
        router.push('/login')
        return
      }

      const response = await fetch('/.netlify/functions/briefs-create', {
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

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create brief')
      }

      const { id } = await response.json()
      router.push(`/brief/${id}`)
    } catch (error: any) {
      console.error(error)
      alert(`Error calling the Cabinet: ${error.message}`)
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
              <CardDescription>
                Set the agenda for today's cabinet meeting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Brief Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g. Thursday Strategy"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goals">What are your main goals for today?</Label>
                  <Textarea
                    id="goals"
                    placeholder="e.g. Finish the project proposal, go for a run..."
                    className="min-h-[100px]"
                    value={formData.goals}
                    onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="constraints">Any constraints or blockers?</Label>
                  <Textarea
                    id="constraints"
                    placeholder="e.g. Meeting at 2pm, low energy in the afternoon..."
                    value={formData.constraints}
                    onChange={(e) => setFormData({ ...formData, constraints: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="values">Core values for today (comma-separated)</Label>
                  <Input
                    id="values"
                    placeholder="e.g. Health, Focus, Family"
                    value={formData.values}
                    onChange={(e) => setFormData({ ...formData, values: e.target.value })}
                  />
                </div>
                <Button className="w-full" type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Calling the Cabinet...
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

