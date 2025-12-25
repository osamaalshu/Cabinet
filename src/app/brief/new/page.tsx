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
      if (!session) return router.push('/login')

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

      const { brief_id } = await createRes.json()
      // Redirect immediately to the live session page
      router.push(`/brief/${brief_id}`)
    } catch (error: any) {
      console.error(error)
      alert(`Error initializing the Cabinet: ${error.message}`)
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
              <CardDescription>Assemble the Cabinet to deliberate on your agenda.</CardDescription>
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
                <Button className="w-full h-12 text-lg" type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Assembling Cabinet...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
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
