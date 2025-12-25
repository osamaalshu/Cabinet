'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    // Using only Magic Link as per spec
    const { error: magicLinkError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // window.location.origin captures the EXACT port you are currently using
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (magicLinkError) {
      setMessage({ type: 'error', text: magicLinkError.message })
    } else {
      setMessage({ type: 'success', text: 'Check your email! Click the link to sign in.' })
    }
    setIsLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">Welcome to the Cabinet</CardTitle>
          <CardDescription>
            Enter your email to receive a magic link for sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {message && (
              <div className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'} p-2 bg-gray-100 rounded`}>
                {message.text}
              </div>
            )}
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Magic Link
            </Button>
            <p className="text-xs text-center text-gray-400">
              Current Origin: {typeof window !== 'undefined' ? window.location.origin : '...'}
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
