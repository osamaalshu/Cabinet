'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/common/Navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Save } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function CabinetPage() {
  const [ministers, setMinisters] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchMinisters() {
      const { data } = await supabase.from('cabinet_members').select('*').order('name')
      if (data) setMinisters(data)
      setIsLoading(false)
    }
    fetchMinisters()
  }, [supabase])

  const handleToggle = async (id: string, isEnabled: boolean) => {
    setMinisters(prev => prev.map(m => m.id === id ? { ...m, is_enabled: isEnabled } : m))
  }

  const handleChange = (id: string, field: string, value: any) => {
    setMinisters(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  const handleSave = async () => {
    setIsSaving(true)
    const { error } = await supabase.from('cabinet_members').upsert(ministers)
    if (error) alert('Error saving cabinet: ' + error.message)
    else alert('Cabinet updated successfully!')
    setIsSaving(false)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      <Navbar />
      <main className="container mx-auto px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">The Cabinet</h1>
            <p className="text-gray-500">Configure your ministers and their AI models.</p>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ministers.map((m) => (
            <Card key={m.id} className={m.is_enabled ? '' : 'opacity-60'}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">{m.name}</CardTitle>
                  <CardDescription>{m.role}</CardDescription>
                </div>
                <Switch
                  checked={m.is_enabled}
                  onCheckedChange={(checked) => handleToggle(m.id, checked)}
                />
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase">Model Name</Label>
                  <Input
                    value={m.model_name}
                    onChange={(e) => handleChange(m.id, 'model_name', e.target.value)}
                    placeholder="gpt-4o-mini"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase">Temperature ({m.temperature})</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={m.temperature}
                    onChange={(e) => handleChange(m.id, 'temperature', parseFloat(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}

